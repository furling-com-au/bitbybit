/* ============================================================
   Sweep — margin sweeps (Grand Final) and Cup sweeps share this
   module; `data.kind` ("gf" | "cup") only changes the copy and
   which tool page the links point back to.
   ============================================================ */
import {
  esc, json, html, shuffle, badInput, pageShell,
  getByToken, createInstance, updateInstanceData, deleteInstance,
  logEvent, fmtDate,
} from "../lib.js";

const MAX_TITLE = 80;
const MAX_OUTCOMES = 64;
const MAX_OUTCOME_LEN = 60;
const MAX_NAMES = 300;
const MAX_NAME_LEN = 40;

const NOUNS = {
  gf: ["kick", "punt", "torp", "screamer", "banana", "bounce",
    "huddle", "siren", "goal", "mark", "ruck", "handball", "specky", "chip"],
  cup: ["gallop", "furlong", "photo", "trifecta", "canter", "hoof",
    "saddle", "silks", "barrier", "fashions", "flutter", "nose"],
};

const HOME = { gf: "/grand-final-sweep/", cup: "/melbourne-cup-sweep/" };
const NOUN_FOR = (kind) => NOUNS[kind] || NOUNS.gf;
const HOME_FOR = (kind) => HOME[kind] || HOME.gf;

/* ---------- the draw ---------------------------------------- */
/* Every outcome gets a name (the whole board is always sold):
   fewer names than outcomes → names cycle fairly (floor/ceil draws
   each); more names than outcomes → surplus miss out, listed. */
function drawSweep(outcomes, names) {
  if (names.length >= outcomes.length) {
    const pool = shuffle([...names]);
    return {
      assignments: outcomes.map((o, i) => ({ outcome: o, name: pool[i] })),
      missed: pool.slice(outcomes.length).sort((a, b) => a.localeCompare(b)),
    };
  }
  let pool = [];
  while (pool.length < outcomes.length) pool = pool.concat(shuffle([...names]));
  pool = shuffle(pool.slice(0, outcomes.length));
  return {
    assignments: outcomes.map((o, i) => ({ outcome: o, name: pool[i] })),
    missed: [],
  };
}

function parseInput(body) {
  const title = String(body.title || "").trim().slice(0, MAX_TITLE);
  const kind = body.kind === "cup" ? "cup" : "gf";

  const clean = (list, maxLen, maxCount) =>
    (Array.isArray(list) ? list : [])
      .map((s) => String(s).trim().replace(/\s+/g, " ").slice(0, maxLen))
      .filter(Boolean)
      .slice(0, maxCount);

  const outcomes = clean(body.outcomes, MAX_OUTCOME_LEN, MAX_OUTCOMES);
  const names = clean(body.names, MAX_NAME_LEN, MAX_NAMES);

  if (outcomes.length < 2) throw badInput("Add at least two outcomes.");
  if (new Set(outcomes.map((o) => o.toLowerCase())).size !== outcomes.length)
    throw badInput("Outcomes contain a duplicate — each one must be different.");
  if (names.length < 2) throw badInput("Add at least two names.");

  return { title, kind, outcomes, names };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { title, kind, outcomes, names } = parseInput(await request.json().catch(() => ({})));
  const { assignments, missed } = drawSweep(outcomes, names);
  const data = JSON.stringify({
    kind, outcomes, names, assignments, missed,
    drawnAt: new Date().toISOString(),
  });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "sweep", title, data, nouns: NOUN_FOR(kind),
  });
  await logEvent(env, id, "sweep", "created");
  return json({ slug, editToken }, 201);
}

async function redraw(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "sweep") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);
  const { assignments, missed } = drawSweep(data.outcomes, data.names);
  await updateInstanceData(env, row.id, JSON.stringify({
    ...data, assignments, missed, drawnAt: new Date().toISOString(),
  }));
  await logEvent(env, row.id, "sweep", "redrawn");
  return json({ ok: true });
}

async function remove(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "sweep") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "sweep", "deleted");
  return json({ ok: true });
}

/* ---------- rendering --------------------------------------- */

function grid(data, { reveal }) {
  const cards = data.assignments.map((a, i) => `
    <li class="draw-card${reveal ? " reveal" : ""}"${reveal ? ` style="animation-delay:${i * 70}ms"` : ""}>
      <span class="draw-outcome">${esc(a.outcome)}</span>
      <span class="draw-arrow" aria-hidden="true">▼</span>
      <span class="draw-name">${esc(a.name)}</span>
    </li>`).join("");

  const counts = {};
  for (const a of data.assignments) counts[a.name] = (counts[a.name] || 0) + 1;
  const doubles = Object.keys(counts).filter((n) => counts[n] > 1).sort();

  const doubleNote = doubles.length
    ? `<p class="draw-note">Fewer names than outcomes, so some drew twice: ${doubles.map(esc).join(", ")}.</p>`
    : "";
  const missed = data.missed.length
    ? `<p class="draw-missed">Missed the draw (more names than outcomes): ${data.missed.map(esc).join(", ")}.
        Re-draw with more outcomes to fit everyone in.</p>`
    : "";

  return `<ul class="draw-grid">${cards}</ul>${doubleNote}${missed}`;
}

const subLine = (data) =>
  `Drawn ${fmtDate(data.drawnAt)} · ${data.assignments.length} outcomes · ${data.names.length} in the draw`;

function publicPage(row) {
  const data = JSON.parse(row.data);
  const body = `
<main class="wrap page">
  <p class="kicker">A sweep, drawn fair and square</p>
  <h1>${esc(row.title || "The office sweep")}</h1>
  <p class="page-sub">${subLine(data)}</p>
  ${grid(data, { reveal: true })}
  <footer class="page-foot">
    <p><a class="quiet-link" href="${HOME_FOR(data.kind)}">made with bitibybit.com →</a></p>
  </footer>
</main>`;
  return html(pageShell({ title: row.title || "Sweep", body }));
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
  <h1>${esc(row.title || "The office sweep")}</h1>
  <p class="page-sub">${subLine(data)}</p>

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the group</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>

  ${grid(data, { reveal: false })}

  <div class="organiser-actions">
    <button class="btn" id="redrawBtn" type="button">↻ Re-draw</button>
    <button class="btn danger" id="deleteBtn" type="button">Delete this sweep</button>
    <a class="btn ghost" href="${HOME_FOR(data.kind)}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Re-drawing reshuffles every name. Deleting is permanent —
    the shared link stops working immediately.</p>
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
  function post(path, confirmMsg, after) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    fetch("/api/sweeps/" + token + "/" + path, { method: "POST" })
      .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); after(); })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  }
  document.getElementById("redrawBtn").addEventListener("click", function () {
    post("redraw", "Re-draw the whole sweep? Everyone gets shuffled to a new outcome.",
      function () { location.reload(); });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    post("delete", "Delete this sweep for good? The shared link will stop working.",
      function () { location.href = ${JSON.stringify(HOME_FOR(data.kind))}; });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Sweep"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "sweep",

  async api(request, env, url) {
    const p = url.pathname;
    if (p === "/api/sweeps" && request.method === "POST") return create(request, env);
    const m = p.match(/^\/api\/sweeps\/([a-z0-9]+)\/(redraw|delete)$/);
    if (m && request.method === "POST")
      return m[2] === "redraw" ? redraw(m[1], env) : remove(m[1], env);
    return null;
  },

  publicPage: (row) => publicPage(row),
  editPage: (row, env, url) => editPage(row, url.origin),
};
