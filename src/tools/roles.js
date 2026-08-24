/* ============================================================
   Secret Role Dealer — hidden party-game roles through one
   shared link. Second user of the participants table: rows are
   created blank with the role tucked in `data`; joining claims
   a random unclaimed row atomically, so nobody — including the
   organiser — knows who got what.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, createInstance, deleteInstance,
  logEvent, fmtDate,
} from "../lib.js";

const MAX_TITLE = 80;
const MAX_ROLES = 40;
const MAX_ROLE_LEN = 80;
const MAX_NOTE = 300;
const MAX_NAME_LEN = 40;
const HOME = "/secret-role-dealer/";

const NOUNS = ["moon", "howl", "cloak", "dagger", "lantern", "mask",
  "shadow", "alibi", "whisper", "bluff", "decoy", "motive"];

/* ---------- api --------------------------------------------- */

function parseInput(body) {
  const title = String(body.title || "").trim().slice(0, MAX_TITLE);
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);
  const roles = (Array.isArray(body.roles) ? body.roles : [])
    .map((s) => String(s).trim().replace(/\s+/g, " ").slice(0, MAX_ROLE_LEN))
    .filter(Boolean);
  if (roles.length < 2) throw badInput("Add at least two roles — one per line.");
  if (roles.length > MAX_ROLES)
    throw badInput(`That's ${roles.length} roles — this tool tops out at ${MAX_ROLES}.`);
  return { title, note, roles };
}

async function create(request, env) {
  const { title, note, roles } = parseInput(await request.json().catch(() => ({})));
  const data = JSON.stringify({ total: roles.length, note });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "roles", title, data, nouns: NOUNS,
  });
  const now = new Date().toISOString();
  await env.DB.batch(roles.map((role) =>
    env.DB.prepare(
      `INSERT INTO participants (instance_id, token, name, data, created_at)
       VALUES (?, ?, '', ?, ?)`
    ).bind(id, randomString(22), JSON.stringify({ role }), now)
  ));
  await logEvent(env, id, "roles", "created");
  return json({ slug, editToken }, 201);
}

/* Claiming: pick a random unclaimed slot, then take it with a
   guarded UPDATE. A single UPDATE is atomic in D1, so two people
   racing for the same slot can't both win — the loser simply
   goes around again and draws a different one. */
async function claim(request, env) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LEN);
  if (!name) throw badInput("Tell us your name first.");
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "roles") return json({ error: "not found" }, 404);

  for (let attempt = 0; attempt < 3; attempt++) {
    const slot = await env.DB.prepare(
      "SELECT id FROM participants WHERE instance_id = ? AND claimed_at IS NULL ORDER BY RANDOM() LIMIT 1"
    ).bind(row.id).first();
    if (!slot) return json({ error: "All the roles are dealt." }, 409);

    try {
      const won = await env.DB.prepare(
        "UPDATE participants SET name = ?, claimed_at = ? WHERE id = ? AND claimed_at IS NULL RETURNING token"
      ).bind(name, new Date().toISOString(), slot.id).first();
      if (won) return json({ token: won.token });
      // Someone beat us to that slot — draw again.
    } catch (e) {
      if (/UNIQUE/.test(String(e)))
        return json({ error: "Someone already joined with that name — add a surname initial." }, 409);
      throw e;
    }
  }
  return json({ error: "Everyone grabbed at once — try again." }, 409);
}

/* Organiser returns one player's slot to the pool. The role stays
   attached to the slot — it simply re-enters the random draw. The
   token rotates so the old private link goes dead. */
async function reset(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "roles") return json({ error: "not found" }, 404);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) throw badInput("Which player?");
  const res = await env.DB.prepare(
    "UPDATE participants SET name = '', claimed_at = NULL, viewed_at = NULL, token = ? WHERE instance_id = ? AND name = ?"
  ).bind(randomString(22), row.id, name).run();
  if (!res.meta.changes) return json({ error: "No player by that name." }, 404);
  return json({ ok: true });
}

/* Full reset: every token rotates, every name clears. Roles stay
   on their rows — random claiming re-randomises who gets what. */
async function redeal(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "roles") return json({ error: "not found" }, 404);
  const { results } = await env.DB.prepare(
    "SELECT id FROM participants WHERE instance_id = ?"
  ).bind(row.id).all();
  await env.DB.batch(results.map((p) =>
    env.DB.prepare(
      "UPDATE participants SET token = ?, name = '', claimed_at = NULL, viewed_at = NULL WHERE id = ?"
    ).bind(randomString(22), p.id)
  ));
  await logEvent(env, row.id, "roles", "redrawn");
  return json({ ok: true });
}

async function remove(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "roles") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "roles", "deleted");
  return json({ ok: true });
}

/* ---------- rendering --------------------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const { n: taken } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM participants WHERE instance_id = ? AND claimed_at IS NOT NULL"
  ).bind(row.id).first();
  const full = taken >= data.total;

  const body = `
<main class="wrap page">
  <p class="kicker">Secret roles — one each</p>
  <h1>${esc(row.title || "Secret roles")}</h1>
  <p class="page-sub">${taken} of ${data.total} roles dealt</p>
  ${data.note ? `<div class="pixel-note">${esc(data.note)}</div>` : ""}

  <div class="night-panel">
    <div id="haveRole" hidden>
      <p class="night-lede">You&#39;re dealt in.</p>
      <a class="btn primary big" id="roleLink" href="#">See your role →</a>
      <p class="fine night-fine"><a class="quiet-link" id="rejoinLink" href="#">Link stopped working? Join again.</a></p>
    </div>
    <form id="joinForm"${full ? " hidden" : ""}>
      <label class="field">
        <span>Your name</span>
        <input type="text" id="joinName" maxlength="40" autocomplete="name" placeholder="Sam">
      </label>
      <p class="form-error" id="joinError" hidden></p>
      <button type="submit" class="btn primary big" id="joinBtn">Deal me in →</button>
      <p class="fine night-fine">You&#39;ll get a private page only you can see.
      One role each, drawn at random.</p>
    </form>
    <div id="fullBox"${full ? "" : " hidden"}>
      <p class="night-lede">All roles dealt. Gather round.</p>
    </div>
  </div>

  <footer class="page-foot">
    <p><a class="quiet-link" href="${HOME}">made with bit by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var full = ${full ? "true" : "false"};
  var key = "bbb:roles:" + slug;

  function show(dealtIn) {
    document.getElementById("haveRole").hidden = !dealtIn;
    document.getElementById("joinForm").hidden = dealtIn || full;
    document.getElementById("fullBox").hidden = dealtIn || !full;
  }

  var token = null;
  try { token = localStorage.getItem(key); } catch (e) {}
  if (token) {
    document.getElementById("roleLink").href = "/p/" + token;
    show(true);
  }

  document.getElementById("rejoinLink").addEventListener("click", function (e) {
    e.preventDefault();
    try { localStorage.removeItem(key); } catch (e2) {}
    show(false);
  });

  document.getElementById("joinForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("joinError");
    var btn = document.getElementById("joinBtn");
    var name = document.getElementById("joinName").value.trim();
    err.hidden = true;
    if (!name) { err.textContent = "Tell us your name first."; err.hidden = false; return; }
    btn.disabled = true;
    btn.textContent = "Dealing…";
    fetch("/api/roles/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: slug, name: name }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; })
        .then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (res) {
      if (!res.ok) throw new Error(res.d.error || "Something went wrong — try again.");
      try { localStorage.setItem(key, res.d.token); } catch (e2) {}
      location.href = "/p/" + res.d.token;
    }).catch(function (ex) {
      err.textContent = ex.message || "Something went wrong — try again.";
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "Deal me in →";
    });
  });
})();
</script>`;
  return html(pageShell({ title: row.title || "Secret roles", body }));
}

async function participantPage(prow, row, env) {
  if (!prow.viewed_at) {
    await env.DB.prepare("UPDATE participants SET viewed_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), prow.id).run();
  }
  const data = JSON.parse(row.data);
  const role = JSON.parse(prow.data).role;

  const body = `
<main class="wrap page">
  <p class="kicker">Your role</p>
  <h1>${esc(row.title || "The game")}</h1>
  <p class="page-sub">Dealt to ${esc(prow.name || "you")}</p>

  <div class="role-card">
    <span class="role-text">${esc(role)}</span>
  </div>

  ${data.note ? `<div class="pixel-note role-note"><strong>From the organiser:</strong> ${esc(data.note)}</div>` : ""}

  <p class="keep-secret">Keep it secret. Keep the screen to yourself.</p>
  <p class="fine">The page stays here — bookmark it if the game runs long.</p>

  <footer class="page-foot">
    <p><a class="quiet-link" href="${HOME}">made with bit by bit →</a></p>
  </footer>
</main>`;
  return html(pageShell({ title: "Your role", body }));
}

async function editPage(row, env, url) {
  const data = JSON.parse(row.data);
  const reveal = url.searchParams.get("reveal") === "1";
  const { results: players } = await env.DB.prepare(
    "SELECT name, data, viewed_at FROM participants WHERE instance_id = ? AND claimed_at IS NOT NULL ORDER BY claimed_at"
  ).bind(row.id).all();
  const shareUrl = `${url.origin}/s/${row.slug}`;

  const tableRows = players.map((p) => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${p.viewed_at ? '<span class="tick">✓ seen</span>' : '<span class="unseen">not yet</span>'}</td>
        ${reveal ? `<td>${esc(JSON.parse(p.data).role)}</td>` : ""}
        <td class="cell-right"><button class="btn small danger" type="button" data-reset="${esc(p.name)}">Reset</button></td>
      </tr>`).join("");

  const table = players.length ? `
  <div class="table-scroll">
    <table class="status-table">
      <thead><tr><th>Player</th><th>Role seen</th>${reveal ? "<th>Role</th>" : ""}<th></th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>` : `
  <p class="fine no-players">No one has joined yet — share the link above and
  the names will turn up here.</p>`;

  const revealLink = reveal
    ? `<a class="quiet-link" href="${url.pathname}">hide the roles again</a>`
    : `<a class="quiet-link" href="?reveal=1">reveal all roles (after the game — spoils it)</a>`;

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with everyone else.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(row.title || "Secret roles")}</h1>
  <p class="page-sub">${players.length} of ${data.total} roles dealt · created ${fmtDate(row.created_at)}</p>

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the players</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
    <p class="fine">Each player opens it, types their name, and draws a random role
    on a private page. Playing yourself? Join from the same link — roles stay
    hidden here so nothing gets spoiled for you.</p>
  </div>

  ${table}
  <p class="fine reveal-line">${revealLink}</p>

  <div class="organiser-actions">
    <button class="btn" id="redealBtn" type="button">↻ Re-deal everything</button>
    <button class="btn danger" id="deleteBtn" type="button">Delete this deal</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Resetting a player returns their role to the pool and kills
    their private link. Re-dealing clears everyone — the group joins again from
    the shared link. Deleting is permanent.</p>
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
    fetch("/api/roles/" + token + "/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    })
      .then(function (r) { if (!r.ok) throw new Error("failed"); after(); })
      .catch(function () { alert("That didn't work — try again."); });
  }
  var resets = document.querySelectorAll("[data-reset]");
  for (var i = 0; i < resets.length; i++) {
    resets[i].addEventListener("click", function () {
      var name = this.getAttribute("data-reset");
      post("reset", { name: name },
        "Return " + name + "'s role to the pool? Their private link stops working and the role goes back in the deal.",
        function () { location.reload(); });
    });
  }
  document.getElementById("redealBtn").addEventListener("click", function () {
    post("redeal", null,
      "Re-deal everything? Every player is cleared, every private link stops working, and the group joins again from scratch.",
      function () { location.reload(); });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    post("delete", null,
      "Delete this for good? The shared link and every role page stop working.",
      function () { location.href = ${JSON.stringify(HOME)}; });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Secret roles"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "roles",

  async api(request, env, url) {
    if (request.method !== "POST") return null;
    const p = url.pathname;
    if (p === "/api/roles") return create(request, env);
    if (p === "/api/roles/claim") return claim(request, env);
    const m = p.match(/^\/api\/roles\/([a-z0-9]+)\/(reset|redeal|delete)$/);
    if (m) {
      if (m[2] === "reset") return reset(m[1], request, env);
      if (m[2] === "redeal") return redeal(m[1], env);
      return remove(m[1], env);
    }
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url),
  participantPage: (prow, row, env) => participantPage(prow, row, env),
};
