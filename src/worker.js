/* ============================================================
   bitbybit — the Worker.

   Static pages are served from /public by the assets layer.
   This file only handles the dynamic routes:

     POST /api/sweeps                    create a sweep (draws it)
     POST /api/sweeps/:token/redraw      organiser: reshuffle
     POST /api/sweeps/:token/delete      organiser: delete
     GET  /s/:slug                       public result page (noindex)
     GET  /e/:token                      organiser page     (noindex)
   ============================================================ */

/* ---------- limits ------------------------------------------ */
const MAX_TITLE = 80;
const MAX_OUTCOMES = 64;
const MAX_OUTCOME_LEN = 60;
const MAX_NAMES = 300;
const MAX_NAME_LEN = 40;

/* ---------- tiny utils -------------------------------------- */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function randomString(len, alphabet = "abcdefghjkmnpqrstuvwxyz23456789") {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/* Readable slugs so a shared link looks friendly, plus enough
   randomness that they aren't guessable in bulk. */
const SLUG_A = ["swift", "lucky", "plucky", "rowdy", "tidy", "bold", "spare",
  "handy", "keen", "solid", "bright", "cheeky", "quiet", "rapid", "wily"];
const SLUG_B = ["kick", "punt", "torp", "screamer", "banana", "bounce",
  "huddle", "siren", "goal", "mark", "ruck", "handball", "specky", "chip"];

const newSlug = () =>
  `${SLUG_A[rand(SLUG_A.length)]}-${SLUG_B[rand(SLUG_B.length)]}-${randomString(4)}`;

function rand(n) {
  // Rejection sampling — unbiased, unlike modulo.
  const max = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= max);
  return x % n;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- the draw ---------------------------------------- */
/*
   Every outcome must end up with a name (that's how a real sweep
   works — the whole board is always sold):
     - fewer names than outcomes  → names cycle; someone draws twice.
     - more names than outcomes   → surplus names miss out, listed.
   Fairness: each name appears floor(k) or ceil(k) times, never worse.
*/
function drawSweep(outcomes, names) {
  if (names.length >= outcomes.length) {
    const pool = shuffle([...names]);
    const chosen = pool.slice(0, outcomes.length);
    const missed = pool.slice(outcomes.length).sort((a, b) => a.localeCompare(b));
    return {
      assignments: outcomes.map((o, i) => ({ outcome: o, name: chosen[i] })),
      missed,
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

/* ---------- validation -------------------------------------- */

function parseSweepInput(body) {
  const title = String(body.title || "").trim().slice(0, MAX_TITLE);

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

  return { title, outcomes, names };
}

function badInput(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

/* ---------- data access ------------------------------------- */

async function getBySlug(env, slug) {
  return env.DB.prepare("SELECT * FROM instances WHERE slug = ?").bind(slug).first();
}
async function getByToken(env, token) {
  return env.DB.prepare("SELECT * FROM instances WHERE edit_token = ?").bind(token).first();
}
async function logEvent(env, instanceId, toolType, kind) {
  await env.DB.prepare(
    "INSERT INTO events (instance_id, tool_type, kind, created_at) VALUES (?, ?, ?, ?)"
  ).bind(instanceId, toolType, kind, new Date().toISOString()).run();
}

/* ---------- handlers ---------------------------------------- */

async function createSweep(request, env) {
  const body = await request.json().catch(() => ({}));
  const { title, outcomes, names } = parseSweepInput(body);
  const { assignments, missed } = drawSweep(outcomes, names);

  const data = JSON.stringify({
    outcomes, names, assignments, missed,
    drawnAt: new Date().toISOString(),
  });
  const editToken = randomString(26);
  const now = new Date().toISOString();

  // Slug collisions are astronomically unlikely but retry anyway.
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = newSlug();
    try {
      const res = await env.DB.prepare(
        `INSERT INTO instances (slug, edit_token, tool_type, title, data, created_at, updated_at)
         VALUES (?, ?, 'sweep', ?, ?, ?, ?)`
      ).bind(slug, editToken, title, data, now, now).run();
      await logEvent(env, res.meta.last_row_id, "sweep", "created");
      return json({ slug, editToken }, 201);
    } catch (e) {
      if (!/UNIQUE/.test(String(e))) throw e;
    }
  }
  return json({ error: "Could not allocate a link — try again." }, 500);
}

async function redrawSweep(token, env) {
  const row = await getByToken(env, token);
  if (!row) return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);
  const { assignments, missed } = drawSweep(data.outcomes, data.names);
  const next = JSON.stringify({ ...data, assignments, missed, drawnAt: new Date().toISOString() });
  await env.DB.prepare("UPDATE instances SET data = ?, updated_at = ? WHERE id = ?")
    .bind(next, new Date().toISOString(), row.id).run();
  await logEvent(env, row.id, row.tool_type, "redrawn");
  return json({ ok: true });
}

async function deleteSweep(token, env) {
  const row = await getByToken(env, token);
  if (!row) return json({ error: "not found" }, 404);
  await env.DB.prepare("DELETE FROM instances WHERE id = ?").bind(row.id).run();
  await logEvent(env, row.id, row.tool_type, "deleted");
  return json({ ok: true });
}

/* ---------- server-rendered pages --------------------------- */

const px = (n) => `${n}px`;

function pageShell({ title, body, noindex = true }) {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — bit by bit</title>
${noindex ? '<meta name="robots" content="noindex">' : ""}
<meta name="theme-color" content="#f4ead8">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="scanlines" aria-hidden="true"></div>
<header class="site-head wrap">
  <a class="wordmark" href="/" aria-label="bit by bit — home">
    <span class="wordmark-blocks" aria-hidden="true"><i></i><i></i><i></i></span>
    bit&nbsp;by&nbsp;bit
  </a>
</header>
${body}
</body>
</html>`;
}

function sweepGrid(data, { reveal }) {
  const cards = data.assignments.map((a, i) => `
    <li class="draw-card${reveal ? " reveal" : ""}"${reveal ? ` style="animation-delay:${i * 70}ms"` : ""}>
      <span class="draw-outcome">${esc(a.outcome)}</span>
      <span class="draw-arrow" aria-hidden="true">▼</span>
      <span class="draw-name">${esc(a.name)}</span>
    </li>`).join("");

  const missed = data.missed.length
    ? `<p class="draw-missed">Missed the draw (more names than outcomes):
        ${data.missed.map(esc).join(", ")}.
        Re-draw with more outcomes to fit everyone in.</p>`
    : "";

  const doubles = countDoubles(data);
  const doubleNote = doubles.length
    ? `<p class="draw-note">Fewer names than outcomes, so some drew twice:
        ${doubles.map(esc).join(", ")}.</p>`
    : "";

  return `<ul class="draw-grid">${cards}</ul>${doubleNote}${missed}`;
}

function countDoubles(data) {
  const counts = {};
  for (const a of data.assignments) counts[a.name] = (counts[a.name] || 0) + 1;
  return Object.keys(counts).filter((n) => counts[n] > 1).sort();
}

function drawnLine(data) {
  const d = new Date(data.drawnAt);
  return `Drawn ${d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
          · ${data.assignments.length} outcomes · ${data.names.length} in the draw`;
}

async function publicPage(slug, env) {
  const row = await getBySlug(env, slug);
  if (!row || row.tool_type !== "sweep") return notFoundPage(env);
  const data = JSON.parse(row.data);

  const body = `
<main class="wrap page">
  <p class="kicker">A sweep, drawn fair and square</p>
  <h1>${esc(row.title || "The office sweep")}</h1>
  <p class="page-sub">${drawnLine(data)}</p>
  ${sweepGrid(data, { reveal: true })}
  <footer class="page-foot">
    <p><a class="quiet-link" href="/grand-final-sweep">made with bit by bit →</a></p>
  </footer>
</main>`;

  return new Response(pageShell({ title: row.title || "Sweep", body }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "no-store",
    },
  });
}

async function editPage(token, env, origin) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "sweep") return notFoundPage(env);
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
  <p class="page-sub">${drawnLine(data)}</p>

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the group</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>

  ${sweepGrid(data, { reveal: false })}

  <div class="organiser-actions">
    <button class="btn" id="redrawBtn" type="button">↻ Re-draw</button>
    <button class="btn danger" id="deleteBtn" type="button">Delete this sweep</button>
    <a class="btn ghost" href="/grand-final-sweep">Make another</a>
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
      .then(function (r) { if (!r.ok) throw new Error("failed"); after(); })
      .catch(function () { alert("That didn't work — try again."); });
  }

  document.getElementById("redrawBtn").addEventListener("click", function () {
    post("redraw",
      "Re-draw the whole sweep? Everyone gets shuffled to a new outcome.",
      function () { location.reload(); });
  });

  document.getElementById("deleteBtn").addEventListener("click", function () {
    post("delete",
      "Delete this sweep for good? The shared link will stop working.",
      function () { location.href = "/grand-final-sweep"; });
  });
})();
</script>`;

  return new Response(pageShell({ title: `${row.title || "Sweep"} (organiser)`, body }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "no-store",
    },
  });
}

async function notFoundPage(env) {
  const asset = await env.ASSETS.fetch(new Request("https://assets.local/404.html"));
  return new Response(asset.body, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
  });
}

/* ---------- router ------------------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/sweeps" && request.method === "POST")
        return await createSweep(request, env);

      let m;
      if ((m = path.match(/^\/api\/sweeps\/([a-z0-9]+)\/(redraw|delete)$/)) &&
          request.method === "POST")
        return m[2] === "redraw"
          ? await redrawSweep(m[1], env)
          : await deleteSweep(m[1], env);

      if ((m = path.match(/^\/s\/([a-z0-9-]+)\/?$/)) && request.method === "GET")
        return await publicPage(m[1], env);

      if ((m = path.match(/^\/e\/([a-z0-9]+)\/?$/)) && request.method === "GET")
        return await editPage(m[1], env, url.origin);

      if (path.startsWith("/api/")) return json({ error: "not found" }, 404);
      return await notFoundPage(env);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      return json({ error: e.status ? e.message : "Something went wrong." }, status);
    }
  },
};
