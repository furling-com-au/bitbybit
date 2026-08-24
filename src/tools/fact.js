/* ============================================================
   Fact Matcher — the office icebreaker. Everyone secretly submits
   a fun fact about themselves; the group guesses who's who, then
   the organiser reveals the answers.

   Two phases:
     1. Collection — names are seeded one-per-row (like Kris Kringle).
        A person claims their name to get a private /p/ link, then
        writes their fact where only they (and, later, the organiser)
        can see it. The partial UNIQUE(instance_id, name) index makes
        the claim atomic — two people tapping the same name race at
        the database, and exactly one wins.
     2. Reveal — the organiser flips a flag. The shared page turns
        from the join grid into the answer key: every submitted fact,
        in a stable shuffled order, with the name attached.

   The guessing itself happens out loud in the room. This tool
   collects the facts privately and hands the organiser the key.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, getParticipant, getInstanceById,
  createInstance, updateInstanceData, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_TITLE = 80;
const MAX_PROMPT = 140;
const MAX_NOTE = 300;
const MIN_NAMES = 3;
const MAX_NAMES = 60;
const MAX_NAME_LEN = 40;
const MAX_FACT = 280;

const DEFAULT_PROMPT = "Share a fun fact about yourself";

const NOUNS = ["hunch", "alibi", "reveal", "riddle", "tell", "guesswork",
  "mixer", "icebreak", "whodunit", "shuffle"];

const HOME = "/fact-matcher/";

/* ---------- data access ------------------------------------- */

const allParticipants = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT * FROM participants WHERE instance_id = ? ORDER BY name COLLATE NOCASE"
  ).bind(instanceId).all()).results;

/* Their fact, trimmed. Empty string when unwritten (or bad JSON). */
function pfact(p) {
  try { return String(JSON.parse(p.data).fact || "").trim(); }
  catch { return ""; }
}

/* A stable shuffle of the submitted facts. Order is derived from a
   hash of each row's random token, so it's the same on every load
   (no Math.random — the Worker forbids it and it must not reorder
   each render) and it doesn't leak the order the organiser typed
   the names in. Only rows with a fact make the cut. */
function hashToken(t) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function shuffledSubmitted(parts) {
  return parts
    .filter((p) => pfact(p))
    .sort((a, b) =>
      (hashToken(a.token) - hashToken(b.token)) ||
      (a.token < b.token ? -1 : 1));
}

/* ---------- input ------------------------------------------- */

function parseCreate(body) {
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, MAX_TITLE);
  let prompt = String(body.prompt || "").trim().replace(/\s+/g, " ").slice(0, MAX_PROMPT);
  if (!prompt) prompt = DEFAULT_PROMPT;
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);

  const names = (Array.isArray(body.names) ? body.names : [])
    .map((s) => String(s).trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LEN))
    .filter(Boolean);

  if (names.length < MIN_NAMES)
    throw badInput("Add at least three names — a guessing game needs a few people.");
  if (names.length > MAX_NAMES)
    throw badInput("Sixty names is the limit — split a big group into two rounds.");

  const seen = new Set();
  for (const n of names) {
    const key = n.toLowerCase();
    if (seen.has(key))
      throw badInput(`"${n}" is on the list twice — add a surname initial so the right person claims it.`);
    seen.add(key);
  }

  return { title, prompt, note, names };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { title, prompt, note, names } =
    parseCreate(await request.json().catch(() => ({})));
  const data = JSON.stringify({ prompt, note, revealed: false });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "fact", title, data, nouns: NOUNS,
  });

  // One row per name, seeded with an empty fact. The name is stored
  // (not blank), so the partial unique index enforces one row per
  // person and the claim UPDATE below can match on it.
  const now = new Date().toISOString();
  const stmt = env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, created_at)
     VALUES (?, ?, ?, ?, ?)`);
  await env.DB.batch(names.map((n) =>
    stmt.bind(id, randomString(22), n, JSON.stringify({ fact: "" }), now)));

  await logEvent(env, id, "fact", "created");
  return json({ slug, editToken }, 201);
}

async function submit(request, env) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || "");
  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LEN);
  const row = await getBySlug(env, slug);
  if (!row || row.tool_type !== "fact" || !name)
    return json({ error: "That name isn't on this list." }, 404);

  // One atomic UPDATE: if two people tap the same name at once,
  // exactly one statement matches the claimed_at IS NULL row.
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
    return json({ error: "That name's already been taken. If it's you, ask the organiser to reset it." }, 409);
  return json({ error: "That name isn't on this list." }, 404);
}

async function saveFact(ptoken, request, env) {
  const prow = await getParticipant(env, ptoken);
  const row = prow && await getInstanceById(env, prow.instance_id);
  if (!row || row.tool_type !== "fact") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const fact = String(body.fact || "").trim().slice(0, MAX_FACT);
  const pdata = JSON.parse(prow.data);
  await env.DB.prepare("UPDATE participants SET data = ? WHERE id = ?")
    .bind(JSON.stringify({ ...pdata, fact }), prow.id).run();
  return json({ ok: true });
}

async function reset(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "fact") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "");
  // Rotate the token so the old private link dies, reopen the claim,
  // AND clear the fact. Whoever re-claims the name would otherwise be
  // handed the previous person's secret fact before the reveal, so a
  // reset wipes it — the rightful owner re-enters theirs.
  const hit = await env.DB.prepare(
    `UPDATE participants SET token = ?, claimed_at = NULL, viewed_at = NULL, data = '{"fact":""}'
     WHERE instance_id = ? AND name = ?
     RETURNING id`
  ).bind(randomString(22), row.id, name).first();
  if (!hit) return json({ error: "That name isn't on this list." }, 404);
  return json({ ok: true });
}

async function reveal(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "fact") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const revealed = !!body.revealed;
  const data = JSON.parse(row.data);
  await updateInstanceData(env, row.id, JSON.stringify({ ...data, revealed }));
  if (revealed) await logEvent(env, row.id, "fact", "revealed");
  return json({ ok: true, revealed });
}

async function remove(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "fact") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "fact", "deleted");
  return json({ ok: true });
}

/* ---------- rendering helpers ------------------------------- */

const noteBlock = (data) =>
  data.note ? `<div class="pixel-note fact-note">${esc(data.note)}</div>` : "";

function answerKey(parts) {
  const submitted = shuffledSubmitted(parts);
  if (!submitted.length)
    return `<p class="fact-empty">No facts came in — nothing to reveal yet.</p>`;
  return `<ol class="fact-key">${submitted.map((p) => `
    <li class="fact-key-item">
      <p class="fact-key-text">${esc(pfact(p))}</p>
      <p class="fact-key-name">— ${esc(p.name)}</p>
    </li>`).join("")}
  </ol>`;
}

/* ---------- public page (/s/:slug) -------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const parts = await allParticipants(env, row.id);

  if (data.revealed) return revealedPage(row, data, parts);
  return collectionPage(row, data, parts);
}

function revealedPage(row, data, parts) {
  const body = `
<main class="wrap page">
  <p class="kicker">The big reveal — who said what</p>
  <h1>${esc(row.title || "Fact Matcher")}</h1>
  <p class="page-sub">${esc(data.prompt)}</p>
  ${noteBlock(data)}

  <p class="lede">The answers are in. Each fact below, and the person behind it.</p>
  ${answerKey(parts)}

  <footer class="page-foot">
    <p class="fine">Played it already? The organiser can start a fresh round
    any time — new names, new facts.</p>
    <p><a class="quiet-link" href="/via/fact">made with bitibybit.com →</a></p>
  </footer>
</main>`;
  return html(pageShell({ title: row.title || "Fact Matcher", body }));
}

function collectionPage(row, data, parts) {
  const claimed = parts.filter((p) => p.claimed_at).length;
  const inCount = parts.filter((p) => pfact(p)).length;

  const cards = parts.map((p) => {
    if (!p.claimed_at) {
      return `<li><button class="fact-name" type="button" data-name="${esc(p.name)}">
        <span class="fact-person">${esc(p.name)}</span>
        <span class="fact-cta">That's me</span>
      </button></li>`;
    }
    const done = !!pfact(p);
    return `<li><div class="fact-name is-claimed ${done ? "is-submitted" : "is-joined"}">
      <span class="fact-person">${esc(p.name)}</span>
      <span class="fact-cta">${done ? "submitted ✓" : "joined"}</span>
    </div></li>`;
  }).join("");

  const body = `
<main class="wrap page">
  <p class="kicker">Fact Matcher — the facts are being collected</p>
  <h1>${esc(row.title || "Fact Matcher")}</h1>
  <p class="page-sub">${parts.length} on the list · ${claimed} joined · ${inCount} fact${inCount === 1 ? "" : "s"} in</p>
  ${noteBlock(data)}

  <div class="fact-banner" id="factBanner" hidden>
    You're in — <a id="factBannerLink" href="#">open your card →</a>
    <a class="fact-rejoin" id="factRejoin" href="#">Link not working, or not you? Claim again</a>
  </div>

  <p class="lede">Find your name and claim it. You'll get a private page to
  write your answer to: <strong>${esc(data.prompt)}</strong>. Nobody sees it
  until the big reveal.</p>

  <p class="form-error" id="factError" hidden></p>
  <ul class="fact-grid">${cards}</ul>

  <footer class="page-foot">
    <p class="fine">One claim per name. Grabbed the wrong one, or someone took
    yours? The organiser can reset it. The answers stay hidden until the
    organiser reveals them.</p>
    <p><a class="quiet-link" href="/via/fact">made with bitibybit.com →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var lsKey = "bbb:fact:" + slug;
  var err = document.getElementById("factError");
  var buttons = document.querySelectorAll("button.fact-name");
  var saved = null;
  try { saved = localStorage.getItem(lsKey); } catch (e) { /* private mode */ }
  if (saved) {
    document.getElementById("factBannerLink").href = "/p/" + saved;
    document.getElementById("factBanner").hidden = false;
    document.getElementById("factRejoin").addEventListener("click", function (e) {
      e.preventDefault();
      try { localStorage.removeItem(lsKey); } catch (e2) { /* private mode */ }
      location.reload();
    });
    buttons.forEach(function (b) { b.disabled = true; });
    return;
  }
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-name");
      if (!confirm('Claim "' + name + '"? One claim per name — only take your own.')) return;
      err.hidden = true;
      btn.disabled = true;
      fetch("/api/fact/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug, name: name }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.ok && d.token) {
            try { localStorage.setItem(lsKey, d.token); } catch (e) { /* fine */ }
            location.href = "/p/" + d.token;
            return;
          }
          err.textContent = d.error || "That didn't work — try again.";
          err.hidden = false;
          if (r.status === 409) {
            btn.classList.add("is-claimed", "is-joined");
            btn.querySelector(".fact-cta").textContent = "taken";
          } else {
            btn.disabled = false;
          }
        });
      }).catch(function () {
        err.textContent = "That didn't work — check your connection and try again.";
        err.hidden = false;
        btn.disabled = false;
      });
    });
  });
})();
</script>`;
  return html(pageShell({ title: row.title || "Fact Matcher", body }));
}

/* ---------- participant page (/p/:token) -------------------- */

async function participantPage(prow, row, env) {
  if (!prow.viewed_at) {
    await env.DB.prepare(
      "UPDATE participants SET viewed_at = ? WHERE id = ? AND viewed_at IS NULL"
    ).bind(new Date().toISOString(), prow.id).run();
  }
  const data = JSON.parse(row.data);
  const pdata = JSON.parse(prow.data);

  const body = `
<main class="wrap page">
  <p class="kicker">Ssh — this page is just for ${esc(prow.name)}</p>
  <h1>${esc(row.title || "Fact Matcher")}</h1>
  ${noteBlock(data)}

  <div class="fact-prompt">${esc(data.prompt)}</div>

  <label class="field">
    <span>Your answer</span>
    <textarea id="factText" aria-label="Your fun fact" rows="4" maxlength="${MAX_FACT}"
      placeholder="Once got a hole-in-one. Have never told anyone at work.">${esc(pdata.fact || "")}</textarea>
  </label>
  <div class="fact-saverow">
    <button class="btn primary" id="factSave" type="button">Save my fact</button>
    <span class="status-line" id="factStatus"></span>
  </div>

  <p class="fine">Only the organiser sees this until the big reveal. Keep your
  link handy — bookmark it. It's the only way back in to change your answer.
  Lost it? The organiser can reset your name so you can claim it again.</p>

  <footer class="page-foot">
    <p><a class="quiet-link" href="/via/fact">made with bitibybit.com →</a></p>
  </footer>
</main>

<script>
(function () {
  var token = ${JSON.stringify(prow.token)};
  try {
    localStorage.setItem("bbb:fact:" + ${JSON.stringify(row.slug)}, token);
  } catch (e) { /* private mode */ }
  var btn = document.getElementById("factSave");
  var status = document.getElementById("factStatus");
  btn.addEventListener("click", function () {
    btn.disabled = true;
    status.textContent = "";
    status.classList.remove("warn");
    fetch("/api/fact/p/" + token + "/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fact: document.getElementById("factText").value }),
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); });
      btn.textContent = "Saved ✓";
      setTimeout(function () {
        btn.textContent = "Save my fact";
        btn.disabled = false;
      }, 1500);
    }).catch(function () {
      btn.disabled = false;
      status.classList.add("warn");
      status.textContent = "Couldn't save — try again.";
    });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Fact Matcher"} — your card`, body }));
}

/* ---------- organiser page (/e/:token) ---------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const parts = await allParticipants(env, row.id);
  const claimed = parts.filter((p) => p.claimed_at).length;
  const inCount = parts.filter((p) => pfact(p)).length;
  const revealed = !!data.revealed;
  const shareUrl = `${origin}/s/${row.slug}`;

  const tableRows = parts.map((p) => `
      <tr>
        <td class="st-name">${esc(p.name)}</td>
        <td>${p.claimed_at ? '<span class="st-yes">✓</span>' : '<span class="st-no">–</span>'}</td>
        <td>${pfact(p) ? '<span class="st-yes">✓</span>' : '<span class="st-no">–</span>'}</td>
        <td class="st-action"><button class="btn" type="button" data-reset="${esc(p.name)}">Reset</button></td>
      </tr>`).join("");

  const submitted = shuffledSubmitted(parts);
  const readout = submitted.length
    ? `<ol class="fact-key">${submitted.map((p) => `
        <li class="fact-key-item">
          <p class="fact-key-text">${esc(pfact(p))}</p>${revealed ? `
          <p class="fact-key-name">— ${esc(p.name)}</p>` : ""}
        </li>`).join("")}
      </ol>`
    : `<p class="fact-empty">No facts in yet — this fills up as people submit.</p>`;

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with the group.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(row.title || "Fact Matcher")}</h1>
  <p class="page-sub">${parts.length} on the list · ${claimed} joined · ${inCount} fact${inCount === 1 ? "" : "s"} in${revealed ? " · revealed" : ""}</p>
  ${noteBlock(data)}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link — everyone claims their name and adds a fact</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🔎 Fun-facts icebreaker — claim your name and add one secret fact before the big reveal (takes 20 seconds): " + shareUrl)}

  <p class="pixel-note">How it runs: everyone submits privately, you gather the
  room, read the facts out one by one and let people guess, then hit reveal.
  The facts below are numbered in the order you'd read them out — the numbering
  doesn't change when you reveal, so answer 4 stays answer 4.</p>

  <div class="status-wrap">
    <table class="status-table">
      <thead><tr><th>Name</th><th>Joined</th><th>Fact in</th><th></th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <p class="fine">Reset a name if the wrong person claimed it or a link is lost:
  the old private link stops working on the spot and the name becomes claimable
  again — their fact is cleared, and they re-enter it when they rejoin.</p>

  <h2>${revealed ? "The answer key" : "The facts to read out"}</h2>
  ${revealed
    ? `<p class="lede">Revealed. Everyone with the shared link can now see who said what.</p>`
    : `<p class="lede">Read these out and let the room guess. Names appear here once you reveal.</p>`}
  ${readout}

  <div class="organiser-actions">
    <button class="btn primary big" id="revealBtn" type="button" data-revealed="${revealed ? "1" : "0"}">${revealed ? "Hide the answers again" : "Reveal the answers"}</button>
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared page</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this game</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Revealing flips the shared link from the join grid to the
    answer key — do it once you've played the guessing game. You can hide it
    again if you jumped the gun. Deleting is permanent: every link stops
    working immediately.</p>
  </footer>
</main>

<script>
(function () {
  var token = ${JSON.stringify(row.edit_token)};
  document.getElementById("copyBtn").addEventListener("click", function () {
    var input = document.getElementById("shareUrl");
    input.select();
    navigator.clipboard.writeText(input.value).then(function () {
      var b = document.getElementById("copyBtn");
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy"; }, 1500);
    });
  });
  function post(path, payload, confirmMsg, after) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    fetch("/api/fact/" + token + "/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    }).then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); after(); })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  }
  document.querySelectorAll("[data-reset]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-reset");
      post("reset", { name: name },
        "Reset " + name + "? Their private link stops working and the " +
        "name reopens for claiming — so their fact is cleared too (whoever " +
        "re-claims would otherwise see it). They re-enter it when they rejoin.",
        function () { location.reload(); });
    });
  });
  document.getElementById("revealBtn").addEventListener("click", function () {
    var isRevealed = this.getAttribute("data-revealed") === "1";
    if (isRevealed) {
      post("reveal", { revealed: false }, null, function () { location.reload(); });
    } else {
      post("reveal", { revealed: true },
        "Show everyone who said what? Do this once you've played the guessing game.",
        function () { location.reload(); });
    }
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    post("delete", null,
      "Delete this Fact Matcher for good? Every link stops working immediately.",
      function () { location.href = ${JSON.stringify(HOME)}; });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Fact Matcher"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "fact",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/fact")) return null;
    if (p === "/api/fact") return create(request, env);
    if (p === "/api/fact/submit") return submit(request, env);
    let m;
    if ((m = p.match(/^\/api\/fact\/p\/([a-z0-9]+)\/save$/)))
      return saveFact(m[1], request, env);
    if ((m = p.match(/^\/api\/fact\/([a-z0-9]+)\/(reset|reveal|delete)$/)))
      return m[2] === "reset" ? reset(m[1], request, env)
        : m[2] === "reveal" ? reveal(m[1], request, env)
        : remove(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
  participantPage: (prow, row, env) => participantPage(prow, row, env),
};
