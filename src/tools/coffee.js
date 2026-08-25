/* ============================================================
   Coffee Roulette — pairs a team up for a coffee, over and over.

   Same shape as Kris Kringle: a draw, then one private capability
   URL per person showing only their own result. The difference is
   what makes this a year-round tool rather than a December one:

     PARTICIPANT TOKENS ARE STABLE ACROSS ROUNDS.

   A person claims their name once, bookmarks /p/:token, and that
   link keeps working every fortnight — it just shows a different
   partner. Re-drawing does NOT rotate tokens or clear claims, which
   is the opposite of what kringle's redraw does, and is deliberate.
   Making eight people re-claim their name every fortnight is how a
   recurring tool stops being used by round three.

   Odd numbers make a three, not a leftover. Nobody sits out.

   Recent pairings are remembered for a few rounds and avoided, so a
   team of eight doesn't get the same two people twice running. It's
   a soft constraint — if the only remaining pairing repeats, the
   round still happens.
   ============================================================ */
import {
  esc, json, html, randomString, rand, shuffle, badInput, pageShell,
  getBySlug, getByToken, createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";
import { STARTERS } from "./coffee-starters.js";

const MAX_TITLE = 80;
const MIN_NAMES = 3;
const MAX_NAMES = 200;
const MAX_NAME_LEN = 40;
const MAX_CADENCE = 40;
const MAX_NOTE = 300;

/* How many past rounds to avoid repeating. Three is enough to feel
   varied without making a small team impossible to pair. */
const MEMORY = 3;

const NOUNS = ["flatwhite", "cortado", "brew", "kettle", "mug", "beans",
  "roast", "crema", "pot", "cuppa"];

const HOME = "/coffee-roulette/";

/* ---------- the draw ----------------------------------------- */

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/* Every pairing inside a group, as keys. A three yields three. */
function keysFor(groups) {
  const out = [];
  for (const g of groups)
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++) out.push(pairKey(g[i], g[j]));
  return out;
}

/* Shuffle, pair off consecutively, and give the odd one out a three
   rather than a bye. Retries until it finds a round that repeats no
   recent pairing; gives up after enough attempts and allows a repeat,
   because a round that happens beats a round that is perfect. */
function drawGroups(n, avoid) {
  const build = () => {
    const order = shuffle([...Array(n).keys()]);
    const groups = [];
    const even = n % 2 === 0;
    const limit = even ? n : n - 3;
    for (let i = 0; i < limit; i += 2) groups.push([order[i], order[i + 1]]);
    if (!even) groups.push([order[n - 3], order[n - 2], order[n - 1]]);
    return groups;
  };
  for (let attempt = 0; attempt < 300; attempt++) {
    const groups = build();
    if (!keysFor(groups).some((k) => avoid.has(k))) return groups;
  }
  return build();
}

/* A starter per group, avoiding the ones used last round so the same
   question doesn't come round twice in a fortnight. */
function pickStarters(count, lastUsed) {
  const pool = STARTERS.map((_, i) => i).filter((i) => !lastUsed.includes(i));
  const from = pool.length >= count ? pool : STARTERS.map((_, i) => i);
  const picked = shuffle([...from]).slice(0, count);
  while (picked.length < count) picked.push(rand(STARTERS.length));
  return picked;
}

/** Build the next round in place. Returns the new data object. */
function nextRound(data) {
  const history = (data.history || []).slice(-(MEMORY - 1));
  const avoid = new Set(history.flat());
  const groups = drawGroups(data.names.length, avoid);
  return {
    ...data,
    round: (data.round || 0) + 1,
    groups,
    starters: pickStarters(groups.length, data.starters || []),
    history: [...history, keysFor(groups)],
    drawnAt: new Date().toISOString(),
  };
}

/* ---------- validation --------------------------------------- */

function parseCreate(body) {
  const title = String(body.title || "").trim().slice(0, MAX_TITLE);
  const names = (Array.isArray(body.names) ? body.names : [])
    .map((s) => String(s).trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LEN))
    .filter(Boolean);
  if (names.length < MIN_NAMES)
    throw badInput("Add at least three names — with two there's only ever one pairing.");
  if (names.length > MAX_NAMES)
    throw badInput(`That's ${names.length} people — this tops out at ${MAX_NAMES}.`);
  const seen = new Set();
  for (const n of names) {
    const k = n.toLowerCase();
    if (seen.has(k))
      throw badInput(`"${n}" is in the list twice — add a surname initial so the right one gets claimed.`);
    seen.add(k);
  }
  const cadence = String(body.cadence || "").trim().slice(0, MAX_CADENCE);
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);
  return { title, names, cadence, note };
}

const allParticipants = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT * FROM participants WHERE instance_id = ? ORDER BY name COLLATE NOCASE"
  ).bind(instanceId).all()).results;

/* ---------- api ---------------------------------------------- */

async function create(request, env) {
  const { title, names, cadence, note } = parseCreate(await request.json().catch(() => ({})));
  const base = { names, cadence, note, round: 0, history: [], starters: [] };
  const data = nextRound(base);

  const { id, slug, editToken } = await createInstance(env, {
    toolType: "coffee", title: title || "Coffee roulette",
    data: JSON.stringify(data), nouns: NOUNS,
  });

  /* One row per person, created once and kept. The index into
     data.names is what ties a person to their pairing, so it must
     never be recomputed from the name later. */
  const now = new Date().toISOString();
  const stmt = env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, created_at)
     VALUES (?, ?, ?, ?, ?)`);
  await env.DB.batch(names.map((n, i) =>
    stmt.bind(id, randomString(22), n, JSON.stringify({ idx: i }), now)));

  await logEvent(env, id, "coffee", "created");
  return json({ slug, editToken }, 201);
}

async function claim(request, env) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LEN);
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "coffee" || !name)
    return json({ error: "That name isn't on this list." }, 404);

  // Atomic: two people tapping the same name, exactly one wins.
  const won = await env.DB.prepare(
    `UPDATE participants SET claimed_at = ?
     WHERE instance_id = ? AND name = ? AND claimed_at IS NULL
     RETURNING token`
  ).bind(new Date().toISOString(), row.id, name).first();
  if (won) return json({ token: won.token });

  const exists = await env.DB.prepare(
    "SELECT id FROM participants WHERE instance_id = ? AND name = ?"
  ).bind(row.id, name).first();
  if (exists)
    return json({ error: "That name's already been claimed. If it's yours, ask the organiser to reset it." }, 409);
  return json({ error: "That name isn't on this list." }, 404);
}

/* Draw the next round. Tokens and claims are untouched — everyone's
   existing private link simply starts showing the new partner. */
async function orgNext(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "coffee") return json({ error: "not found" }, 404);
  const data = nextRound(JSON.parse(row.data));
  await env.DB.prepare("UPDATE instances SET data = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(data), new Date().toISOString(), row.id).run();
  await logEvent(env, row.id, "coffee", "redrawn");
  return json({ ok: true, round: data.round });
}

/* Reopen one person's claim and rotate their token — for the person
   who opened their link on a work laptop they no longer have. */
async function orgReset(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "coffee") return json({ error: "not found" }, 404);
  const name = String((await request.json().catch(() => ({}))).name || "");
  if (!name) throw badInput("Which person?");
  const res = await env.DB.prepare(
    `UPDATE participants SET token = ?, claimed_at = NULL, viewed_at = NULL
     WHERE instance_id = ? AND name = ?`
  ).bind(randomString(22), row.id, name).run();
  if (!res.meta.changes) return json({ error: "No one by that name." }, 404);
  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "coffee") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "coffee", "deleted");
  return json({ ok: true });
}

/* ---------- rendering ---------------------------------------- */

const groupOf = (data, idx) =>
  (data.groups || []).findIndex((g) => g.includes(idx));

function chips(data) {
  const bits = [`Round ${data.round}`];
  if (data.cadence) bits.push(esc(data.cadence));
  bits.push(`${data.names.length} people`);
  return `<p class="page-sub">${bits.join(" · ")}</p>`;
}

const noteBlock = (data) =>
  data.note ? `<div class="pixel-note">${esc(data.note)}</div>` : "";

/* ---------- public page (/s/:slug) --------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const parts = await allParticipants(env, row.id);
  const claimed = new Set(parts.filter((p) => p.claimed_at).map((p) => p.name));

  const list = data.names.map((n) => {
    const taken = claimed.has(n);
    return `
      <li class="claim-name${taken ? " taken" : ""}" data-name="${esc(n)}">
        <span class="cn-name">${esc(n)}</span>
        ${taken
          ? `<span class="cn-state">claimed</span>`
          : `<button class="btn cn-btn" type="button">That's me</button>`}
      </li>`;
  }).join("");

  const body = `
<main class="wrap page">
  <p class="kicker">Coffee roulette</p>
  <h1>${esc(row.title || "Coffee roulette")}</h1>
  ${chips(data)}
  ${noteBlock(data)}

  <p class="meal-intro">Find your name and tap it once. You'll get a private
  link — bookmark it. Every round it shows who you're having a coffee with next,
  and something to talk about. You only claim your name once, not every round.</p>

  <ul class="claim-list">${list}
  </ul>

  <footer class="page-foot">
    <p class="fine">Only you can see who you're paired with. The organiser can't
    see it either — they can see who has claimed a name, and that's all.</p>
    <p><a class="quiet-link" href="/via/coffee">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  document.querySelectorAll(".claim-name .cn-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var li = btn.closest(".claim-name");
      var name = li.getAttribute("data-name");
      btn.disabled = true;
      btn.textContent = "…";
      fetch("/api/coffee/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug, name: name }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(d.error || "That didn't work — try again.");
          location.href = "/p/" + d.token;
        });
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = "That's me";
        alert((e && e.message) || "That didn't work — try again.");
      });
    });
  });
})();
</script>`;
  return html(pageShell({ title: row.title || "Coffee roulette", body,
    shareType: "coffee", shareSlug: row.slug }));
}

/* ---------- participant page (/p/:token) --------------------- */

async function participantPage(prow, row, env) {
  const data = JSON.parse(row.data);
  const idx = JSON.parse(prow.data || "{}").idx;
  const gi = groupOf(data, idx);
  const group = gi >= 0 ? data.groups[gi] : [];
  const others = group.filter((i) => i !== idx).map((i) => data.names[i]);
  const starter = STARTERS[data.starters?.[gi]] || STARTERS[0];

  const who = others.length === 0
    ? `<p class="coffee-with-none">You're not paired this round — the next draw will sort it.</p>`
    : `<p class="coffee-label">Round ${data.round} — you're having a coffee with</p>
       <p class="coffee-with">${others.map(esc).join(" <span>and</span> ")}</p>`;

  const body = `
<main class="wrap page narrow">
  <p class="kicker">${esc(row.title || "Coffee roulette")}</p>
  ${who}

  <div class="coffee-starter">
    <span class="coffee-starter-label">Something to start with</span>
    <p class="coffee-starter-q">${esc(starter)}</p>
  </div>

  ${/* The organiser's note lives on the shared page too, but once
        someone bookmarks this page they never see that one again —
        and the note is usually the bit that says how long it should
        take and who pays. */ ""}
  ${noteBlock(data)}

  ${data.cadence ? `<p class="fine">${esc(data.cadence)}. Keep this link — it updates itself each round.</p>`
    : `<p class="fine">Keep this link — it updates itself each round.</p>`}

  <footer class="page-foot">
    <p class="fine">This page is yours. Nobody else sees it, including whoever set
    this up. Bookmark it rather than re-claiming your name each time.</p>
    <p><a class="quiet-link" href="/via/coffee">made with biti by bit →</a></p>
  </footer>
</main>`;
  return html(pageShell({ title: `${row.title || "Coffee roulette"} — your pairing`, body }));
}

/* ---------- organiser page (/e/:token) ----------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const parts = await allParticipants(env, row.id);
  const claimed = parts.filter((p) => p.claimed_at).length;
  const shareUrl = `${origin}/s/${row.slug}`;

  const rows = parts.map((p) => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${p.claimed_at ? '<span class="st-yes">✓</span>' : '<span class="st-no">–</span>'}</td>
        <td><button class="btn ghost meal-mini co-reset" type="button" data-name="${esc(p.name)}">Reset</button></td>
      </tr>`).join("");

  const body = `
<main class="wrap page">
  <div class="organiser-banner">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with the team.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(row.title || "Coffee roulette")}</h1>
  ${chips(data)}
  <p class="page-sub">${claimed} of ${data.names.length} have claimed their name</p>
  ${noteBlock(data)}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the team</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("☕ Coffee roulette — tap your name once and you'll get a private link that shows who you're paired with each round: " + shareUrl)}

  <div class="dl-panel">
    <p class="dl-label">Round ${data.round}</p>
    <p class="fine">Drawing the next round re-pairs everyone. Nobody has to
    re-claim their name — each person's private link just starts showing their
    new partner. Recent pairings are avoided for a few rounds.</p>
    <p class="dl-row"><button class="btn primary" id="nextBtn" type="button">Draw round ${data.round + 1}</button></p>
  </div>

  <h2 class="meal-section-h">Who has claimed a name</h2>
  <p class="meal-intro">You can see who has picked up their link. You cannot see
  who anyone is paired with — that only exists on their own page.</p>
  <div class="table-scroll">
    <table class="api-table">
      <thead><tr><th>Name</th><th>Claimed</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared page</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this roulette</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Resetting a name rotates that person's private link and lets
    them claim again — for someone who lost their bookmark. Deleting is permanent.</p>
  </footer>
</main>

<script>
(function () {
  var token = ${JSON.stringify(row.edit_token)};
  function post(path, body) {
    return fetch("/api/coffee/" + token + "/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "That didn't work — try again.");
        return d;
      });
    });
  }

  document.getElementById("copyBtn").addEventListener("click", function () {
    var input = document.getElementById("shareUrl");
    input.select();
    navigator.clipboard.writeText(input.value).then(function () {
      var b = document.getElementById("copyBtn");
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy"; }, 1500);
    });
  });

  document.getElementById("nextBtn").addEventListener("click", function () {
    if (!confirm("Draw the next round? Everyone gets a new partner. Their links keep working.")) return;
    post("next").then(function () { location.reload(); })
      .catch(function (e) { alert(e.message); });
  });

  document.querySelectorAll(".co-reset").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!confirm("Reset this person? Their old link stops working and they claim their name again.")) return;
      post("reset", { name: b.getAttribute("data-name") })
        .then(function () { location.reload(); })
        .catch(function (e) { alert(e.message); });
    });
  });

  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this roulette for everyone? This cannot be undone.")) return;
    post("delete").then(function () { location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert(e.message); });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Coffee roulette"} (organiser)`, body }));
}

/* ---------- module contract ---------------------------------- */

export default {
  type: "coffee",

  async api(request, env, url) {
    const p = url.pathname;
    if (!p.startsWith("/api/coffee")) return null;
    if (request.method !== "POST") return null;

    let m;
    if (p === "/api/coffee") return create(request, env);
    if (p === "/api/coffee/claim") return claim(request, env);
    if ((m = p.match(/^\/api\/coffee\/([a-z0-9]+)\/(next|reset|delete)$/))) {
      if (m[2] === "next") return orgNext(m[1], env);
      if (m[2] === "reset") return orgReset(m[1], request, env);
      return orgDelete(m[1], env);
    }
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
  participantPage: (prow, row, env) => participantPage(prow, row, env),
};
