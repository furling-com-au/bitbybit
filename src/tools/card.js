/* ============================================================
   Group Card — one card everyone signs. Farewells, new babies,
   big birthdays, retirements.

   Messages are participants rows. Two Sams must both be able to
   sign, and participants has a partial UNIQUE(instance_id, name)
   WHERE name <> '' — so every row is inserted with name = '' and
   the display name lives in the data JSON ({name, message, hue}).
   Each signer gets back their row token, which is the only way
   to remove that message (short of the organiser link).
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, getParticipant, getInstanceById,
  createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_TITLE = 80;
const MAX_RECIPIENT = 60;
const MAX_NOTE = 300;
const MAX_NAME = 40;
const MAX_MESSAGE = 400;
const MAX_MESSAGES = 400;

/* Sticky-note colours rotate through this list so neighbouring
   messages rarely match. Chosen server-side and stored per row —
   a note keeps its colour forever. */
const HUES = ["sage", "terra", "gold", "sky", "plum"];
const HUE_SET = new Set(HUES);

const NOUNS = ["confetti", "streamer", "hurrah", "sendoff", "cheers",
  "huzzah", "toast", "banner", "encore", "fanfare"];

const HOME = "/group-card/";

/* ---------- data access ------------------------------------- */

const allMessages = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT * FROM participants WHERE instance_id = ? ORDER BY id"
  ).bind(instanceId).all()).results;

/* ---------- input ------------------------------------------- */

function parseCreate(body) {
  const recipient = String(body.recipient || "").trim().replace(/\s+/g, " ").slice(0, MAX_RECIPIENT);
  if (!recipient) throw badInput("Who's the card for? Add their name.");
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, MAX_TITLE)
    || `A card for ${recipient}`.slice(0, MAX_TITLE);
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);
  return { title, recipient, note };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { title, recipient, note } = parseCreate(await request.json().catch(() => ({})));
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "card", title,
    data: JSON.stringify({ recipient, note }),
    nouns: NOUNS,
  });
  await logEvent(env, id, "card", "created");
  return json({ slug, editToken }, 201);
}

async function sign(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "card") return json({ error: "not found" }, 404);

  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  const message = String(body.message || "").trim().slice(0, MAX_MESSAGE);
  if (!name) throw badInput("Add your name — it signs off your message.");
  if (!message) throw badInput("Write a message — even a short one beats a blank note.");

  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM participants WHERE instance_id = ?"
  ).bind(row.id).first();
  const n = (count && count.n) || 0;
  if (n >= MAX_MESSAGES)
    return json({ error: "This card is chockers — 400 messages is the limit." }, 409);

  // name stays '' so duplicate display names are allowed (the
  // partial unique index only bites on non-empty names).
  const token = randomString(22);
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, claimed_at, created_at)
     VALUES (?, ?, '', ?, ?, ?)`
  ).bind(row.id, token, JSON.stringify({ name, message, hue: HUES[n % HUES.length] }), now, now).run();
  return json({ token, id: res.meta.last_row_id }, 201);
}

async function unsign(request, env) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "");
  const prow = token ? await getParticipant(env, token) : null;
  const row = prow && await getInstanceById(env, prow.instance_id);
  if (!row || row.tool_type !== "card")
    return json({ error: "That message wasn't found — it may already be gone." }, 404);
  await env.DB.prepare("DELETE FROM participants WHERE id = ?").bind(prow.id).run();
  return json({ ok: true });
}

async function orgRemove(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "card") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const msgToken = String(body.msgToken || "");
  if (!msgToken) return json({ error: "That message wasn't found." }, 404);
  const res = await env.DB.prepare(
    "DELETE FROM participants WHERE instance_id = ? AND token = ?"
  ).bind(row.id, msgToken).run();
  if (!res.meta.changes) return json({ error: "That message wasn't found." }, 404);
  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "card") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "card", "deleted");
  return json({ ok: true });
}

/* ---------- rendering --------------------------------------- */

function noteCard(p, organiser) {
  let d = {};
  try { d = JSON.parse(p.data); } catch { /* fine */ }
  const hue = HUE_SET.has(d.hue) ? d.hue : "sage";
  return `
    <li class="card-note card-hue-${hue}" data-id="${p.id}">
      <p class="card-msg">${esc(d.message || "")}</p>
      <span class="card-signed">— ${esc(d.name || "Someone")}</span>${organiser ? `
      <div class="card-note-actions">
        <button class="btn ghost card-mini card-remove" type="button" data-token="${esc(p.token)}">Remove</button>
      </div>` : ""}
    </li>`;
}

const board = (parts, organiser) => parts.length
  ? `<ul class="card-board">${parts.map((p) => noteCard(p, organiser)).join("")}
  </ul>`
  : `<p class="card-empty">No messages yet — be the first, set the tone.</p>`;

const briefBlock = (data) =>
  data.note ? `<div class="pixel-note card-brief">${esc(data.note)}</div>` : "";

/* The title defaults to "A card for <recipient>"; when it's still
   that, repeating it under the big "For <recipient>" is just noise. */
function subLine(row, data, n, extra = "") {
  const count = `${n} ${n === 1 ? "message" : "messages"} so far`;
  const custom = row.title &&
    row.title.toLowerCase() !== `a card for ${data.recipient}`.toLowerCase();
  return `${custom ? `${esc(row.title)} · ` : ""}${count}${extra}`;
}

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const parts = await allMessages(env, row.id);

  const body = `
<main class="wrap page">
  <p class="kicker">One card, everyone signs</p>
  <h1>For ${esc(data.recipient)}</h1>
  <p class="page-sub">${subLine(row, data, parts.length, ' · <a href="#cardSign">add yours ↓</a>')}</p>
  ${briefBlock(data)}
  ${board(parts, false)}

  <section class="card-sign" id="cardSign">
    <h2>Add your message</h2>
    <div class="panel">
      <form id="signForm" novalidate>
        <label class="field">
          <span>Your name</span>
          <input type="text" id="signName" maxlength="${MAX_NAME}" placeholder="Sam" autocomplete="name">
        </label>
        <label class="field">
          <span>Your message</span>
          <textarea id="signMsg" rows="4" maxlength="${MAX_MESSAGE}"
            placeholder="Good luck, congratulations, we'll miss you — say it how you'd say it."></textarea>
        </label>
        <p class="form-error" id="signErr" hidden></p>
        <button class="btn primary" id="signBtn" type="submit">Sign the card →</button>
      </form>
    </div>
    <p class="fine">No account — just a name and a message. This browser
    remembers which messages are yours, so you can take one back off.</p>
  </section>

  <footer class="page-foot">
    <p><a class="quiet-link" href="/via/card">made with bitibybit.com →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var KEY = "bbb:card:" + slug;

  function mine() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveMine(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function noteFor(id) {
    if (!/^\\d+$/.test(String(id))) return null;
    return document.querySelector('.card-note[data-id="' + id + '"]');
  }

  /* ---- your own messages: badge + remove ---- */
  var list = mine().filter(function (m) { return noteFor(m.id); }); // prune removed ones
  saveMine(list);
  list.forEach(function (m) {
    var note = noteFor(m.id);
    var actions = document.createElement("div");
    actions.className = "card-note-actions";
    var you = document.createElement("span");
    you.className = "card-you";
    you.textContent = "yours";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost card-mini";
    btn.textContent = "Remove";
    btn.addEventListener("click", function () {
      if (!confirm("Take your message off the card? This can't be undone.")) return;
      fetch("/api/card/unsign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: m.token }),
      }).then(function (r) {
        if (!r.ok && r.status !== 404)
          return r.json().catch(function () { return {}; }).then(function (d) {
            throw new Error(d.error || "That didn't work — try again.");
          });
        saveMine(mine().filter(function (x) { return x.id !== m.id; }));
        location.reload();
      }).catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
    actions.append(you, btn);
    note.appendChild(actions);
  });

  /* ---- signing ---- */
  var form = document.getElementById("signForm");
  var signBtn = document.getElementById("signBtn");
  var err = document.getElementById("signErr");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.hidden = true;
    var name = document.getElementById("signName").value.trim();
    var msg = document.getElementById("signMsg").value.trim();
    if (!name) return fail("Your name first — it signs off your message.");
    if (!msg) return fail("Write a message — even a short one.");

    signBtn.disabled = true;
    signBtn.textContent = "Signing…";
    fetch("/api/card/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: slug, name: name, message: msg }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "Server said " + r.status + ".");
        var l = mine();
        l.push({ id: d.id, token: d.token });
        saveMine(l);
        location.reload();
      });
    }).catch(function (ex) {
      fail((ex && ex.message) || "That didn't work — try again.");
    });

    function fail(msg2) {
      err.textContent = msg2;
      err.hidden = false;
      signBtn.disabled = false;
      signBtn.textContent = "Sign the card →";
      return false;
    }
  });
})();
</script>`;
  return html(pageShell({ title: row.title || `A card for ${data.recipient}`, body }));
}

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const parts = await allMessages(env, row.id);
  const shareUrl = `${origin}/s/${row.slug}`;

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with everyone else.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>For ${esc(data.recipient)}</h1>
  <p class="page-sub">${subLine(row, data, parts.length)}</p>
  ${briefBlock(data)}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the group</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("✍️ We’re signing a card — add your message before it gets handed over: " + shareUrl)}

  <p class="pixel-note">Share the link with everyone <strong>except
  ${esc(data.recipient)}</strong>. When it's full, share it with them too —
  or print this page (the print view is just the card, no buttons).</p>

  ${board(parts, true)}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared card</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this card</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Removing a message is permanent — there's no undo, so maybe
    give the writer a heads-up first. To sign the card yourself, use the shared
    link like everyone else. Deleting the whole card is permanent too — the
    shared link stops working immediately.</p>
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
  document.querySelectorAll(".card-remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!confirm("Remove this message from the card? This can't be undone.")) return;
      fetch("/api/card/" + token + "/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msgToken: btn.getAttribute("data-token") }),
      }).then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.reload(); })
        .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this card for good? Every message goes with it and the shared link stops working.")) return;
    fetch("/api/card/" + token + "/delete", { method: "POST" })
      .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Group card"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "card",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/card")) return null;
    if (p === "/api/card") return create(request, env);
    if (p === "/api/card/sign") return sign(request, env);
    if (p === "/api/card/unsign") return unsign(request, env);
    const m = p.match(/^\/api\/card\/([a-z0-9]+)\/(remove|delete)$/);
    if (m) return m[2] === "remove" ? orgRemove(m[1], request, env) : orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
