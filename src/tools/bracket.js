/* ============================================================
   Tournament Bracket — single elimination for ping pong, FIFA,
   backyard cricket. Built server-side at create: entrants pad
   to the next power of two with byes, spread by standard seed
   pairing (1vN, 2vN-1 …) so the byes never stack in one half.

   The whole bracket lives in the instance data JSON. Results
   cascade: the winner of match (r, i) occupies the a/b slot of
   rounds[r+1][i >> 1]; if a slot's occupant changes, any result
   recorded for that match no longer describes a game that
   happened, so it clears — and the clearing walks forward
   through every later round the old winner had reached.
   ============================================================ */
import {
  esc, json, html, shuffle, badInput, pageShell,
  getByToken, createInstance, updateInstanceData, deleteInstance,
  logEvent, shareNudge, ownCta, cardPreview, fillTrack,
} from "../lib.js";

const MAX_TITLE = 80;
const MIN_ENTRANTS = 2;
const MAX_ENTRANTS = 64;
const MAX_NAME_LEN = 40;

const NOUNS = ["rally", "smash", "volley", "tiebreak", "upset", "finals",
  "paddle", "grudge", "rematch", "clash"];

const HOME = "/tournament-bracket/";

/* ---------- building the bracket ---------------------------- */

/* Standard bracket order for `size` slots: seed 1 plays seed N,
   2 plays N-1, and so on, folded so the top seeds land in
   opposite halves. Consecutive pairs are round-one matches. */
function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const m = order.length * 2 + 1;
    const next = [];
    for (const s of order) next.push(s, m - s);
    order = next;
  }
  return order;
}

/* Winner of match (r, i) occupies rounds[r+1][i >> 1]: side "a"
   for even i, "b" for odd. */
function feedNext(rounds, r, i, occupant) {
  if (r + 1 >= rounds.length) return;
  setSlot(rounds, r + 1, i >> 1, i % 2 === 0 ? "a" : "b", occupant);
}

/* Change who occupies one side of a match. If the match had a
   recorded winner, that result described a game between the old
   pair — void it, and walk the void forward. */
function setSlot(rounds, r, i, side, name) {
  const m = rounds[r][i];
  if (m[side] === name) return;
  m[side] = name;
  if (m.winner !== null) {
    m.winner = null;
    feedNext(rounds, r, i, null);
  }
}

function buildBracket(entrants, seeding) {
  const seeded = seeding === "random" ? shuffle([...entrants]) : [...entrants];
  let size = 1;
  while (size < seeded.length) size *= 2;

  const bySeed = (s) => (s <= seeded.length ? seeded[s - 1] : null);
  const order = seedOrder(size);
  const first = [];
  for (let i = 0; i < size; i += 2)
    first.push({ a: bySeed(order[i]), b: bySeed(order[i + 1]), winner: null });

  const rounds = [first];
  for (let n = first.length; n > 1; n /= 2)
    rounds.push(Array.from({ length: n / 2 }, () => ({ a: null, b: null, winner: null })));

  /* Byes resolve themselves. Only round one can hold them — the
     next power of two is always under 2x the entrant count, so
     two byes never meet. */
  first.forEach((m, i) => {
    if ((m.a === null) !== (m.b === null)) {
      m.winner = m.a !== null ? m.a : m.b;
      feedNext(rounds, 0, i, m.winner);
    }
  });

  return rounds;
}

/* ---------- input ------------------------------------------- */

function parseCreate(body) {
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, MAX_TITLE);
  const entrants = (Array.isArray(body.entrants) ? body.entrants : [])
    .map((s) => String(s).trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LEN))
    .filter(Boolean);

  if (entrants.length < MIN_ENTRANTS)
    throw badInput("Add at least two names — one person is just practice.");
  if (entrants.length > MAX_ENTRANTS)
    throw badInput("64 is the limit — run two brackets and stage a grand final.");

  const seen = new Set();
  for (const n of entrants) {
    const k = n.toLowerCase();
    if (seen.has(k))
      throw badInput(`"${n}" is in the list twice — add a surname initial to tell them apart.`);
    seen.add(k);
  }

  const seeding = body.seeding === "listed" ? "listed" : "random";
  return { title, entrants, seeding };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { title, entrants, seeding } = parseCreate(await request.json().catch(() => ({})));
  const rounds = buildBracket(entrants, seeding);
  const data = JSON.stringify({ entrants, seeding, rounds });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "bracket", title, data, nouns: NOUNS,
  });
  await logEvent(env, id, "bracket", "created");
  return json({ slug, editToken }, 201);
}

async function result(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "bracket") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);
  const body = await request.json().catch(() => ({}));

  const r = Number(body.round);
  const i = Number(body.match);
  if (!Number.isInteger(r) || !Number.isInteger(i) ||
      r < 0 || r >= data.rounds.length || i < 0 || i >= data.rounds[r].length)
    throw badInput("That match isn't in this bracket.");

  const m = data.rounds[r][i];
  if (m.a === null || m.b === null)
    throw badInput(r === 0
      ? "That one's a bye — it sorted itself out."
      : "Both spots in that match need filling first — decide the earlier games.");

  let winner = body.winner;
  if (winner !== null) {
    winner = String(winner);
    if (winner !== m.a && winner !== m.b)
      throw badInput("The winner has to be one of the two names in that match.");
  }

  if (m.winner !== winner) {
    m.winner = winner;
    feedNext(data.rounds, r, i, winner);
    // Optimistic write: result() is a read-modify-write of the whole
  // bracket, so guard on updated_at and let the client retry on clash.
  const guard = await env.DB.prepare(
    "UPDATE instances SET data = ?, updated_at = ? WHERE id = ? AND updated_at = ?"
  ).bind(JSON.stringify(data), new Date().toISOString(), row.id, row.updated_at).run();
  if (!guard.meta.changes)
    return json({ error: "Two results landed at once — refresh and tap again." }, 409);
  }
  return json({ ok: true });
}

async function remove(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "bracket") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "bracket", "deleted");
  return json({ ok: true });
}

/* ---------- rendering --------------------------------------- */

function roundLabel(r, total) {
  const fromEnd = total - r;
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semis";
  if (fromEnd === 3) return "Quarters";
  return `Round ${r + 1}`;
}

const champion = (data) => data.rounds[data.rounds.length - 1][0].winner;

/* A game is decided when it had two entrants and one of them won. A
   bye is neither: one name, no opponent, nothing played. And a match
   waiting on an earlier round has one occupied slot at most, which is
   not half a result. So both ends of the count exclude them, and the
   denominator is entrants − 1, the number of games a single-elimination
   bracket actually contains — not the padded bracket size. */
const decidedGames = (data) => data.rounds.flat()
  .filter((m) => m.a !== null && m.b !== null && m.winner !== null).length;

function subLine(data) {
  const n = data.entrants.length;
  const size = data.rounds[0].length * 2;
  const byes = size - n;
  return `${n} entrants · bracket of ${size}` +
    (byes ? ` · ${byes} bye${byes === 1 ? "" : "s"}` : "") +
    ` · <strong>${decidedGames(data)}</strong> of ${n - 1} games decided`;
}

/* The lead rung, one per page. N and M are the last two numbers
   subLine() just put into words above it — this draws the same fact,
   never a different one. Both are already countable on the page below
   it: every match renders its two names and marks its winner, so a
   viewer who counted the boxes would land on the same fraction.

   No per-round rungs. A .bracket-col already shows a round's state by
   drawing it, and a bar under each column is a second copy of a picture
   that is on the screen. The full state needs no ✓ either: the champion
   banner appears exactly when the final is decided, which for a bracket
   is exactly N = M, and it says the word. */
const leadFill = (data) =>
  fillTrack({ n: decidedGames(data), m: data.entrants.length - 1 });

function renderBracket(data, organiser) {
  const total = data.rounds.length;
  const cols = data.rounds.map((matches, r) => {
    const cards = matches.map((m, i) => {
      const playable = m.a !== null && m.b !== null;
      const side = (name) => {
        if (name === null)
          return `<span class="bracket-side is-null">${r === 0 ? "bye" : "tbd"}</span>`;
        const cls = "bracket-side" +
          (m.winner === name ? " is-winner" : m.winner !== null ? " is-loser" : "");
      const ariaWin = m.winner === name ? ' aria-pressed="true" aria-label="' + name.replace(/"/g, "&quot;") + ' — winner"' : m.winner !== null ? ' aria-pressed="false"' : "";
        if (organiser && playable)
          return `<button class="${cls}" type="button" data-r="${r}" data-m="${i}" data-name="${esc(name)}"${ariaWin}>${esc(name)}</button>`;
        return `<span class="${cls}">${esc(name)}</span>`;
      };
      const decided = organiser && playable ? ` data-decided="${m.winner !== null ? 1 : 0}"` : "";
      return `
      <div class="bracket-match"${decided}>
        ${side(m.a)}
        ${side(m.b)}
      </div>`;
    }).join("");
    return `
    <div class="bracket-col">
      <p class="bracket-col-head">${roundLabel(r, total)}</p>
      <div class="bracket-matches">${cards}
      </div>
    </div>`;
  }).join("");

  return `<div class="bracket-scroll"><div class="bracket-cols">${cols}
  </div></div>`;
}

const champBanner = (name) => name ? `
  <div class="bracket-champ">
    <img class="pixel" src="/icons/trophy.png" alt="" width="48" height="48">
    <div>
      <span class="bracket-champ-label">Champion</span>
      <span class="bracket-champ-name">${esc(name)}</span>
    </div>
  </div>` : "";

function publicPage(row) {
  const data = JSON.parse(row.data);
  const body = `
<main class="wrap page">
  <p class="kicker">Single elimination — lose once, you're done</p>
  <h1>${esc(row.title || "Tournament bracket")}</h1>
  <p class="page-sub">${subLine(data)}</p>
  ${leadFill(data)}
  ${champBanner(champion(data))}
  ${renderBracket(data, false)}
  ${ownCta("bracket",
    "Got an office ping pong ladder?",
    "Make your own bracket")}
  <footer class="page-foot">
    <p class="fine">Results land as the organiser taps them in — refresh for
    the latest. Reckon a score's wrong? Bail up the organiser, not us.</p>
    <p><a class="quiet-link" href="/via/bracket">made with biti by bit →</a></p>
  </footer>
</main>`;
  return html(pageShell({
    title: row.title || "Tournament bracket", body,
    shareType: "bracket", shareSlug: row.slug,
  }));
}

function editPage(row, origin) {
  const data = JSON.parse(row.data);
  const shareUrl = `${origin}/s/${row.slug}`;
  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with everyone else.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(row.title || "Tournament bracket")}</h1>
  <p class="page-sub">${subLine(data)}</p>
  ${leadFill(data)}

  <p class="share-label">This is what shows when you paste the link:</p>
  ${cardPreview("bracket", row.title || "Tournament bracket")}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the group</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🏆 The bracket’s live — watch it fill in: " + shareUrl, row.edit_token)}

  <p class="pixel-note">Tap the winner as each game finishes. Everyone watching
  the shared link sees it live-ish (on refresh). Tapped the wrong name? Tap the
  winner again to clear it, or tap the other name to switch — later results
  that built on that game are wiped either way.</p>

  <button class="btn" id="printBtn" type="button">Print this bracket</button>

  ${champBanner(champion(data))}
  ${renderBracket(data, true)}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared bracket</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this bracket</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Byes decided themselves and can't be changed. Deleting is
    permanent — the shared link stops working immediately.</p>
  </footer>
</main>

<script>
(function () {
  var token = ${JSON.stringify(row.edit_token)};
  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
  document.getElementById("copyBtn").addEventListener("click", function () {
    var input = document.getElementById("shareUrl");
    input.select();
    navigator.clipboard.writeText(input.value).then(function () {
      var b = document.getElementById("copyBtn");
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy"; }, 1500);
    });
  });
  var busy = false;
  function send(round, match, winner) {
    if (busy) return;
    busy = true;
    document.querySelectorAll("button.bracket-side").forEach(function (b) { b.disabled = true; });
    fetch("/api/bracket/" + token + "/result", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ round: round, match: match, winner: winner }),
    }).then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.reload(); })
      .catch(function (e) {
        busy = false;
        document.querySelectorAll("button.bracket-side").forEach(function (b) { b.disabled = false; });
        alert((e && e.message) || "That didn't work — try again.");
      });
  }
  document.querySelectorAll("button.bracket-side").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var round = parseInt(btn.getAttribute("data-r"), 10);
      var match = parseInt(btn.getAttribute("data-m"), 10);
      var name = btn.getAttribute("data-name");
      if (btn.classList.contains("is-winner")) {
        if (!confirm("Clear this result? Any later results that built on it are wiped too.")) return;
        send(round, match, null);
        return;
      }
      if (btn.parentElement.getAttribute("data-decided") === "1" &&
          !confirm('Make "' + name + '" the winner instead? Any later results that built on this game are wiped.')) return;
      send(round, match, name);
    });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this bracket for good? The shared link will stop working.")) return;
    fetch("/api/bracket/" + token + "/delete", { method: "POST" })
      .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Tournament bracket"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "bracket",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/bracket")) return null;
    if (p === "/api/bracket") return create(request, env);
    const m = p.match(/^\/api\/bracket\/([a-z0-9]+)\/(result|delete)$/);
    if (m) return m[2] === "result" ? result(m[1], request, env) : remove(m[1], env);
    return null;
  },

  publicPage: (row) => publicPage(row),
  editPage: (row, env, url) => editPage(row, url.origin),
};
