/* ============================================================
   Kudos Wall — a standing wall of short thank-yous.

   Group Card's mechanic (many people writing into one shared
   surface through a link) pointed at a standing thing rather than a
   one-off. A card gets handed over and is finished; a wall keeps
   going, which is the difference between a tool used once and a
   tool bookmarked.

   Notes are week-bucketed like the Weekly Pulse. This week's are up
   top, previous weeks fold into an archive, and old weeks age out.
   Reads degrade gracefully — the page is worth opening whenever
   somebody happens to open it, which is what makes a standing link
   survive in a bookmark bar.

   These are NAMED, deliberately, and that is the opposite choice to
   the Pulse next door. A thank-you from nobody in particular is
   worth nothing; the whole value is that Priya said it and put her
   name to it. Which also means the moderation story matters, so the
   organiser can remove any note and anyone can remove their own.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_TEAM = 60;
const MAX_NOTE_INTRO = 300;
const MAX_FROM = 40;
const MAX_TO = 60;
const MAX_MESSAGE = 280;

const MAX_ROWS = 3000;
const PRUNE_AT = 2200;
const KEEP_WEEKS = 12;        // a quarter of history

const ARCHIVE_WEEKS = 6;      // how many past weeks the page shows
const TZ = "Australia/Sydney";

const NOUNS = ["kudos", "cheers", "nod", "praise", "shoutout", "highfive",
  "thanks", "credit", "wrap", "clap"];

const HOME = "/kudos-wall/";

/* ---------- weeks (same anchoring as the pulse) --------------- */

let _fmt = null;
const dayFormatter = () => (_fmt ||= new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
}));

function todayISO(now = new Date()) {
  const parts = {};
  for (const p of dayFormatter().formatToParts(now)) parts[p.type] = p.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const dayIndex = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
};
const weekOf = (iso) => { const d = dayIndex(iso); return d === null ? null : Math.floor((d + 4) / 7); };
const currentWeek = () => weekOf(todayISO());

function mondayOf(week) {
  const d = new Date((week * 7 - 4) * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function weekLabel(week) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(mondayOf(week));
  return m ? `${+m[3]} ${MO[+m[2] - 1]}` : mondayOf(week);
}

/* ---------- storage ------------------------------------------ */

/* One participants row per note. `name` stays empty so the partial
   unique index on (instance_id, name) never applies — two people
   thanking the same colleague must both be able to post. */
const allNotes = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT id, token, data, created_at FROM participants WHERE instance_id = ? ORDER BY id DESC"
  ).bind(instanceId).all()).results;

const parse = (r) => { try { return JSON.parse(r.data || "{}"); } catch { return {}; } };

async function prune(env, instanceId, rows, keepFrom) {
  const ids = rows.filter((r) => {
    const d = parse(r);
    return typeof d.w === "number" && d.w < keepFrom;
  }).map((r) => r.id);
  if (!ids.length) return 0;
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    await env.DB.prepare(
      `DELETE FROM participants WHERE id IN (${part.map(() => "?").join(",")})`
    ).bind(...part).run();
  }
  return ids.length;
}

/* ---------- validation --------------------------------------- */

function parseCreate(body) {
  const team = String(body.team || "").trim().replace(/\s+/g, " ").slice(0, MAX_TEAM);
  const intro = String(body.intro || "").trim().slice(0, MAX_NOTE_INTRO);
  return { team, intro, createdDay: todayISO() };
}

/* ---------- api ---------------------------------------------- */

async function create(request, env) {
  const data = parseCreate(await request.json().catch(() => ({})));
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "kudos",
    title: data.team ? `${data.team} — kudos wall` : "Kudos wall",
    data: JSON.stringify(data), nouns: NOUNS,
  });
  await logEvent(env, id, "kudos", "created");
  return json({ slug, editToken }, 201);
}

async function postNote(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "kudos") return json({ error: "not found" }, 404);

  const to = String(body.to || "").trim().replace(/\s+/g, " ").slice(0, MAX_TO);
  const from = String(body.from || "").trim().replace(/\s+/g, " ").slice(0, MAX_FROM);
  const message = String(body.message || "").trim().replace(/\s+/g, " ").slice(0, MAX_MESSAGE);
  if (!to) throw badInput("Who's it for?");
  if (!message) throw badInput("Add a line about what they did.");
  if (!from) throw badInput("Put your name on it — an anonymous thank-you isn't worth much.");

  const rows = await allNotes(env, row.id);
  const week = currentWeek();
  if (rows.length >= MAX_ROWS) {
    const pruned = await prune(env, row.id, rows, week - KEEP_WEEKS);
    if (!pruned) return json({ error: "This wall is full — start a fresh one." }, 409);
  } else if (rows.length >= PRUNE_AT) {
    await prune(env, row.id, rows, week - KEEP_WEEKS);
  }

  /* The token is the note's own capability: whoever posted it holds
     the only handle that can take it down again. */
  const secret = randomString(22);
  await env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, created_at)
     VALUES (?, ?, '', ?, ?)`
  ).bind(row.id, secret, JSON.stringify({ w: week, to, from, m: message }), new Date().toISOString()).run();

  return json({ ok: true, secret }, 201);
}

/** Take down your own note, using the token you were given. */
async function unpost(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "kudos") return json({ error: "not found" }, 404);
  const res = await env.DB.prepare(
    "DELETE FROM participants WHERE instance_id = ? AND token = ?"
  ).bind(row.id, String(body.secret || "")).run();
  if (!res.meta.changes) return json({ error: "That note wasn't found." }, 404);
  return json({ ok: true });
}

async function orgRemove(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "kudos") return json({ error: "not found" }, 404);
  const id = Number((await request.json().catch(() => ({}))).id);
  if (!Number.isInteger(id)) throw badInput("Which note?");
  const res = await env.DB.prepare(
    "DELETE FROM participants WHERE instance_id = ? AND id = ?"
  ).bind(row.id, id).run();
  if (!res.meta.changes) return json({ error: "That note wasn't found." }, 404);
  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "kudos") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "kudos", "deleted");
  return json({ ok: true });
}

/* ---------- rendering ---------------------------------------- */

function noteCard(r, d, organiser) {
  return `
      <li class="kudo" data-id="${r.id}">
        <p class="kudo-to">${esc(d.to)}</p>
        <p class="kudo-msg">${esc(d.m)}</p>
        <p class="kudo-from">— ${esc(d.from)}</p>
        ${organiser ? `<button class="btn ghost meal-mini kudo-del" type="button" data-id="${r.id}">Remove</button>` : ""}
      </li>`;
}

function wall(rows, week, organiser) {
  const byWeek = new Map();
  for (const r of rows) {
    const d = parse(r);
    if (typeof d.w !== "number" || !d.to) continue;
    if (!byWeek.has(d.w)) byWeek.set(d.w, []);
    byWeek.get(d.w).push([r, d]);
  }

  const now = byWeek.get(week) || [];
  const thisWeek = now.length
    ? `<ul class="kudo-list">${now.map(([r, d]) => noteCard(r, d, organiser)).join("")}
    </ul>`
    : `<p class="meal-intro">Nothing up yet this week. Be the first.</p>`;

  const past = [];
  for (let w = week - 1; w >= week - ARCHIVE_WEEKS; w--) {
    const items = byWeek.get(w);
    if (!items || !items.length) continue;
    past.push(`
    <details class="kudo-week">
      <summary>Week of ${esc(weekLabel(w))} <span class="fine">· ${items.length} note${items.length === 1 ? "" : "s"}</span></summary>
      <ul class="kudo-list">${items.map(([r, d]) => noteCard(r, d, organiser)).join("")}
      </ul>
    </details>`);
  }

  return { thisWeek, past: past.join(""), count: now.length };
}

/* ---------- public page (/s/:slug) --------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const rows = await allNotes(env, row.id);
  const week = currentWeek();
  const { thisWeek, past, count } = wall(rows, week, false);

  const body = `
<main class="wrap page">
  <p class="kicker">Kudos wall${data.team ? ` · ${esc(data.team)}` : ""}</p>
  <h1>${esc(row.title || "Kudos wall")}</h1>
  <p class="page-sub">Week of ${esc(weekLabel(week))} · ${count} note${count === 1 ? "" : "s"}</p>
  ${data.intro ? `<div class="pixel-note">${esc(data.intro)}</div>` : ""}

  <form class="kudo-form" id="kudoForm">
    <div class="kudo-fields">
      <label class="field">
        <span>Who's it for?</span>
        <input type="text" id="to" maxlength="${MAX_TO}" placeholder="Priya" autocomplete="off" required>
      </label>
      <label class="field">
        <span>From</span>
        <input type="text" id="from" maxlength="${MAX_FROM}" placeholder="Your name" autocomplete="name" required>
      </label>
    </div>
    <label class="field">
      <span>What did they do?</span>
      <input type="text" id="message" maxlength="${MAX_MESSAGE}" placeholder="Stayed back to get the release out and never mentioned it" required>
    </label>
    <div class="pulse-actions">
      <button class="btn primary" type="submit" id="postBtn">Put it up</button>
    </div>
    <p class="meal-form-err" id="kudoErr" hidden></p>
  </form>

  <h2 class="meal-section-h">This week</h2>
  ${thisWeek}

  ${past ? `<h2 class="meal-section-h">Earlier</h2>${past}` : ""}

  <footer class="page-foot">
    <p class="fine">Notes are signed on purpose — a thank-you from nobody in
    particular isn't worth much. This browser remembers the ones you put up, so
    you can take yours down. Older weeks drop off after a few months.</p>
    <p><a class="quiet-link" href="/via/kudos">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var KEY = "bbb:kudos:" + slug;

  function mine() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} }

  var err = document.getElementById("kudoErr");
  document.getElementById("kudoForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    err.hidden = true;
    var btn = document.getElementById("postBtn");
    btn.disabled = true;
    fetch("/api/kudos/post", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: slug,
        to: document.getElementById("to").value,
        from: document.getElementById("from").value,
        message: document.getElementById("message").value,
      }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "That didn't post — try again.");
        save(mine().concat([d.secret]));
        location.reload();
      });
    }).catch(function (e) {
      btn.disabled = false;
      err.textContent = e.message; err.hidden = false;
    });
  });

  /* Anything this browser posted gets its own take-down button. The
     secret is the only handle to it, so nobody else sees this. */
  var secrets = mine();
  if (secrets.length) {
    document.querySelectorAll(".kudo").forEach(function (li) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost meal-mini kudo-mine";
      btn.textContent = "Take mine down";
      btn.addEventListener("click", function () {
        if (!confirm("Take this note down?")) return;
        var tried = 0;
        function attempt(i) {
          if (i >= secrets.length) { alert("That one wasn't yours."); return; }
          fetch("/api/kudos/unpost", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug: slug, secret: secrets[i] }),
          }).then(function (r) {
            if (r.ok) { save(secrets.filter(function (s, j) { return j !== i; })); location.reload(); }
            else attempt(i + 1);
          });
        }
        attempt(0);
      });
      li.appendChild(btn);
    });
  }
})();
</script>`;
  return html(pageShell({ title: row.title || "Kudos wall", body,
    shareType: "kudos", shareSlug: row.slug }));
}

/* ---------- organiser page (/e/:token) ----------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const rows = await allNotes(env, row.id);
  const week = currentWeek();
  const { thisWeek, past, count } = wall(rows, week, true);
  const shareUrl = `${origin}/s/${row.slug}`;

  const body = `
<main class="wrap page">
  <div class="organiser-banner">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link with the team.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(row.title || "Kudos wall")}</h1>
  <p class="page-sub">Week of ${esc(weekLabel(week))} · ${count} note${count === 1 ? "" : "s"} · ${rows.length} in total</p>

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link once — the team bookmarks it</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("👏 Kudos wall — if someone's done something worth saying out loud, put it up here. Same link every week: " + shareUrl)}

  <div class="dl-panel">
    <p class="dl-label">Reading it out</p>
    <p class="fine">The usual habit that makes these work: read the week's notes
    at the top of a Monday stand-up. It takes ninety seconds and it is the reason
    people keep posting. A wall nobody reads out goes quiet within a month.</p>
  </div>

  <h2 class="meal-section-h">This week</h2>
  ${thisWeek}

  ${past ? `<h2 class="meal-section-h">Earlier</h2>${past}` : ""}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared wall</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this wall</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">You can remove any note. Whoever posted one can take their own
    down from the shared page. Weeks older than about three months drop off.</p>
  </footer>
</main>

<script>
(function () {
  var token = ${JSON.stringify(row.edit_token)};
  document.getElementById("copyBtn").addEventListener("click", function () {
    var i = document.getElementById("shareUrl");
    i.select();
    navigator.clipboard.writeText(i.value).then(function () {
      var b = document.getElementById("copyBtn");
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy"; }, 1500);
    });
  });
  document.querySelectorAll(".kudo-del").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!confirm("Remove this note?")) return;
      fetch("/api/kudos/" + token + "/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: parseInt(b.getAttribute("data-id"), 10) }),
      }).then(function (r) { if (r.ok) location.reload(); else alert("That didn't work."); });
    });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this wall and every note on it? This cannot be undone.")) return;
    fetch("/api/kudos/" + token + "/delete", { method: "POST" })
      .then(function () { location.href = ${JSON.stringify(HOME)}; });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Kudos wall"} (organiser)`, body }));
}

/* ---------- module contract ---------------------------------- */

export default {
  type: "kudos",

  async api(request, env, url) {
    const p = url.pathname;
    if (!p.startsWith("/api/kudos")) return null;
    if (request.method !== "POST") return null;

    let m;
    if (p === "/api/kudos") return create(request, env);
    if (p === "/api/kudos/post") return postNote(request, env);
    if (p === "/api/kudos/unpost") return unpost(request, env);
    if ((m = p.match(/^\/api\/kudos\/([a-z0-9]+)\/(remove|delete)$/)))
      return m[2] === "remove" ? orgRemove(m[1], request, env) : orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
