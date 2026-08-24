/* ============================================================
   Kris Kringle — draw names with private reveals and wishlists.

   The draw is a single-cycle permutation (Sattolo's algorithm),
   so nobody can draw themselves. Assignments live only in the
   participants rows: each person claims their name once and gets
   a private /p/:token link. The organiser page deliberately never
   learns who drew whom — it only shows claimed / opened status.
   ============================================================ */
import {
  esc, json, html, rand, randomString, badInput, pageShell,
  getBySlug, getByToken, getParticipant, getInstanceById,
  createInstance, deleteInstance, logEvent, fmtDate, shareNudge, viewedBeacon} from "../lib.js";

const MAX_TITLE = 80;
const MIN_NAMES = 3;
const MAX_NAMES = 100;
const MAX_NAME_LEN = 40;
const MAX_BUDGET = 40;
const MAX_DATE = 60;
const MAX_NOTE = 300;
const MAX_WISHLIST = 500;

const NOUNS = ["tinsel", "sleigh", "mistletoe", "bauble", "eggnog", "cracker",
  "pud", "carol", "gumtree", "pavlova", "stocking", "prawn"];

const HOME = "/kris-kringle/";

/* ---------- the draw ---------------------------------------- */
/* Sattolo's algorithm: a uniformly random permutation that is one
   single cycle. One cycle means no fixed points — nobody draws
   themselves — and no little sub-loops of two people quietly
   gifting each other either. The subtle bit: j = rand(i), never
   rand(i + 1); the classic Fisher–Yates off-by-one would allow
   self-draws. names[i] gives to shuffled[i]. */
function sattolo(names) {
  const a = [...names];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i); // 0..i-1 — deliberately never i itself
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Fresh participant INSERT statements for a draw. Wishlists (keyed
   by name) survive a re-draw; everything else starts over. */
function participantRows(env, instanceId, names, wishlists = {}) {
  const shuffled = sattolo(names);
  const now = new Date().toISOString();
  const stmt = env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, created_at)
     VALUES (?, ?, ?, ?, ?)`);
  return names.map((n, i) => stmt.bind(
    instanceId, randomString(22), n,
    JSON.stringify({ givesTo: shuffled[i], wishlist: wishlists[n] || "" }), now));
}

const allParticipants = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT * FROM participants WHERE instance_id = ? ORDER BY name COLLATE NOCASE"
  ).bind(instanceId).all()).results;

/* ---------- input ------------------------------------------- */

function parseCreate(body) {
  const title = String(body.title || "").trim().slice(0, MAX_TITLE);
  const names = (Array.isArray(body.names) ? body.names : [])
    .map((s) => String(s).trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LEN))
    .filter(Boolean);

  if (names.length < MIN_NAMES)
    throw badInput("Add at least three names — with two it's not a secret, it's a swap.");
  if (names.length > MAX_NAMES)
    throw badInput("That's more than 100 people — split it into two draws.");

  const seen = new Set();
  for (const n of names) {
    const key = n.toLowerCase();
    if (seen.has(key))
      throw badInput(`"${n}" is in the list twice — add a surname initial so the right one gets claimed.`);
    seen.add(key);
  }

  return {
    title, names,
    budget: String(body.budget || "").trim().slice(0, MAX_BUDGET),
    exchangeDate: String(body.exchangeDate || "").trim().slice(0, MAX_DATE),
    note: String(body.note || "").trim().slice(0, MAX_NOTE),
  };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { title, names, budget, exchangeDate, note } =
    parseCreate(await request.json().catch(() => ({})));
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "kringle", title,
    data: JSON.stringify({ names, budget, exchangeDate, note }),
    nouns: NOUNS,
  });
  await env.DB.batch(participantRows(env, id, names));
  await logEvent(env, id, "kringle", "created");
  return json({ slug, editToken }, 201);
}

async function claim(request, env) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || "");
  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LEN);
  const row = await getBySlug(env, slug);
  if (!row || row.tool_type !== "kringle" || !name)
    return json({ error: "That name isn't in this draw." }, 404);

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
    return json({ error: "That name's already been claimed. If it's yours, ask the organiser to reset you." }, 409);
  return json({ error: "That name isn't in this draw." }, 404);
}

async function saveWishlist(ptoken, request, env) {
  const prow = await getParticipant(env, ptoken);
  const row = prow && await getInstanceById(env, prow.instance_id);
  if (!row || row.tool_type !== "kringle") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").slice(0, MAX_WISHLIST);
  const pdata = JSON.parse(prow.data);
  await env.DB.prepare("UPDATE participants SET data = ? WHERE id = ?")
    .bind(JSON.stringify({ ...pdata, wishlist: text }), prow.id).run();
  return json({ ok: true });
}

async function reset(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "kringle") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "");
  // Rotate the token so the old private link dies, reopen the claim.
  // Assignment and wishlist stay put — only the key changes.
  const hit = await env.DB.prepare(
    `UPDATE participants SET token = ?, claimed_at = NULL, viewed_at = NULL
     WHERE instance_id = ? AND name = ?
     RETURNING id`
  ).bind(randomString(22), row.id, name).first();
  if (!hit) return json({ error: "That name isn't in this draw." }, 404);
  return json({ ok: true });
}

async function redraw(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "kringle") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);

  // Carry each person's wishlist across, keyed by name.
  const wishlists = {};
  for (const p of await allParticipants(env, row.id)) {
    try { wishlists[p.name] = JSON.parse(p.data).wishlist || ""; } catch { /* fine */ }
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM participants WHERE instance_id = ?").bind(row.id),
    ...participantRows(env, row.id, data.names, wishlists),
  ]);
  await logEvent(env, row.id, "kringle", "redrawn");
  return json({ ok: true });
}

async function remove(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "kringle") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "kringle", "deleted");
  return json({ ok: true });
}

/* ---------- rendering --------------------------------------- */

function chips(data) {
  const bits = [];
  if (data.budget)
    bits.push(`<li class="kk-chip">Budget <strong>${esc(data.budget)}</strong></li>`);
  if (data.exchangeDate)
    bits.push(`<li class="kk-chip">Swap <strong>${esc(data.exchangeDate)}</strong></li>`);
  return bits.length ? `<ul class="kk-chips">${bits.join("")}</ul>` : "";
}

const noteBlock = (data) =>
  data.note ? `<div class="pixel-note kk-note">${esc(data.note)}</div>` : "";

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const parts = await allParticipants(env, row.id);
  const claimed = parts.filter((p) => p.claimed_at).length;

  const cards = parts.map((p) => p.claimed_at
    ? `<li><div class="kk-name is-claimed">
        <span class="kk-person">${esc(p.name)}</span>
        <span class="kk-cta">claimed ✓</span>
      </div></li>`
    : `<li><button class="kk-name" type="button" data-name="${esc(p.name)}">
        <span class="kk-person">${esc(p.name)}</span>
        <span class="kk-cta">That's me</span>
      </button></li>`).join("");

  const body = `
<main class="wrap page">
  <p class="kicker">Kris Kringle — the names are drawn</p>
  <h1>${esc(row.title || "Kris Kringle")}</h1>
  <p class="page-sub">${parts.length} in the hat · ${claimed} claimed so far</p>
  ${chips(data)}
  ${noteBlock(data)}

  <div class="kk-banner" id="kkBanner" hidden>
    You're already in — <a id="kkBannerLink" href="#">open your draw →</a>
    <a class="kk-rejoin" id="kkRejoin" href="#">Link not working, or not you? Claim again</a>
  </div>

  <p class="lede">Find your name and claim it. You'll get a private page
  showing who you're buying for — nobody else sees it, including the
  organiser.</p>

  <p class="form-error" id="kkError" hidden></p>
  <ul class="kk-grid">${cards}</ul>

  <footer class="page-foot">
    <p class="fine">One claim per name. Grabbed the wrong one, or someone
    pinched yours? The organiser can reset it.</p>
    <p><a class="quiet-link" href="/via/kringle">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var lsKey = "bbb:kringle:" + slug;
  var err = document.getElementById("kkError");
  var buttons = document.querySelectorAll("button.kk-name");
  var saved = null;
  try { saved = localStorage.getItem(lsKey); } catch (e) { /* private mode */ }
  if (saved) {
    document.getElementById("kkBannerLink").href = "/p/" + saved;
    document.getElementById("kkBanner").hidden = false;
    document.getElementById("kkRejoin").addEventListener("click", function (e) {
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
      fetch("/api/kringle/claim", {
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
            btn.classList.add("is-claimed");
            btn.querySelector(".kk-cta").textContent = "claimed ✓";
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
  return html(pageShell({ title: row.title || "Kris Kringle", body, shareType: "kringle", shareSlug: row.slug }));
}

async function participantPage(prow, row, env) {
  const data = JSON.parse(row.data);
  const pdata = JSON.parse(prow.data);

  const giftee = await env.DB.prepare(
    "SELECT data FROM participants WHERE instance_id = ? AND name = ?"
  ).bind(row.id, pdata.givesTo).first();
  let gifteeWish = "";
  if (giftee) { try { gifteeWish = JSON.parse(giftee.data).wishlist || ""; } catch { /* fine */ } }

  const body = `
<main class="wrap page">
  <p class="kicker">Ssh — this page is just for ${esc(prow.name)}</p>
  <h1>${esc(row.title || "Kris Kringle")}</h1>
  ${chips(data)}
  ${noteBlock(data)}

  <div class="kk-reveal">
    <span class="kk-reveal-label">You're buying for</span>
    <span class="kk-giftee">${esc(pdata.givesTo)}</span>
  </div>

  <h2>Their wishlist</h2>
  ${gifteeWish
    ? `<p class="kk-wishlist">${esc(gifteeWish)}</p>`
    : `<p class="kk-wishlist kk-wishlist-empty">No wishlist yet — check back later.</p>`}

  <h2>Your wishlist</h2>
  <p class="fine">Whatever you write here shows up for exactly one person —
  whoever drew you. Sizes, colours, "no candles please".</p>
  <label class="field">
    <textarea id="wishText" aria-label="Your wishlist" rows="5" maxlength="${MAX_WISHLIST}"
      placeholder="Book vouchers, dark chocolate, socks with a bit of personality…">${esc(pdata.wishlist || "")}</textarea>
  </label>
  <div class="kk-wishrow">
    <button class="btn primary" id="wishSave" type="button">Save wishlist</button>
    <span class="status-line" id="wishStatus"></span>
  </div>

  <footer class="page-foot">
    <p class="fine">Keep this page to yourself. Bookmark it — it's the only
    way back in. Lost it? The organiser can reset your name so you can claim
    it again.</p>
    <p><a class="quiet-link" href="/via/kringle">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var token = ${JSON.stringify(prow.token)};
  try {
    localStorage.setItem("bbb:kringle:" + ${JSON.stringify(row.slug)}, token);
  } catch (e) { /* private mode */ }
  var btn = document.getElementById("wishSave");
  var status = document.getElementById("wishStatus");
  btn.addEventListener("click", function () {
    btn.disabled = true;
    status.textContent = "";
    status.classList.remove("warn");
    fetch("/api/kringle/p/" + token + "/wishlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: document.getElementById("wishText").value }),
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); });
      btn.textContent = "Saved ✓";
      setTimeout(function () {
        btn.textContent = "Save wishlist";
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
  return html(pageShell({ title: `${row.title || "Kris Kringle"} — your draw`, body: body + viewedBeacon(prow.token) }));
}

async function editPage(row, env, url) {
  const data = JSON.parse(row.data);
  const parts = await allParticipants(env, row.id);
  const claimed = parts.filter((p) => p.claimed_at).length;
  const shareUrl = `${url.origin}/s/${row.slug}`;

  const tableRows = parts.map((p) => `
      <tr>
        <td class="st-name">${esc(p.name)}</td>
        <td>${p.claimed_at ? '<span class="st-yes">✓</span>' : '<span class="st-no">–</span>'}</td>
        <td>${p.viewed_at ? '<span class="st-yes">✓</span>' : '<span class="st-no">–</span>'}</td>
        <td class="st-action"><button class="btn" type="button" data-reset="${esc(p.name)}">Reset</button></td>
      </tr>`).join("");

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with the group.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(row.title || "Kris Kringle")}</h1>
  <p class="page-sub">${parts.length} in the draw · ${claimed} claimed · drawn ${fmtDate(row.updated_at)}</p>
  ${chips(data)}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link — everyone claims their own name</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🎁 Kris Kringle time — claim your name and see who you drew (takes 10 seconds, no emails): " + shareUrl)}

  <p class="pixel-note">This page never shows who drew whom — we can't spoil
  it for you either. If someone claimed a name that wasn't theirs, a reset restores access — but they've already seen that draw, so the clean fix is a full re-draw.</p>

  <div class="status-wrap">
    <table class="status-table">
      <thead><tr><th>Name</th><th>Claimed</th><th>Opened</th><th></th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <p class="fine">Reset a name if the wrong person claimed it or a link is
  lost: the old private link stops working on the spot and the name becomes
  claimable again. Their assignment and wishlist stay put.</p>

  <div class="organiser-actions">
    <button class="btn" id="redrawBtn" type="button">↻ Re-draw names</button>
    <button class="btn danger" id="deleteBtn" type="button">Delete this draw</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Re-drawing voids every private link — wishlists survive,
    but everyone claims their name again. Deleting is permanent: every link
    stops working immediately.</p>
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
    fetch("/api/kringle/" + token + "/" + path, {
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
        "Reset " + name + "? Their current private link stops working " +
        "immediately, and the name goes back to unclaimed so the right " +
        "person can grab it. Their wishlist is kept.",
        function () { location.reload(); });
    });
  });
  document.getElementById("redrawBtn").addEventListener("click", function () {
    post("redraw", null,
      "Re-draws everyone and voids all links. Wishlists survive. " +
      "Everyone re-claims their name.",
      function () { location.reload(); });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    post("delete", null,
      "Delete this Kris Kringle for good? Every link stops working immediately.",
      function () { location.href = ${JSON.stringify(HOME)}; });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Kris Kringle"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "kringle",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/kringle")) return null;
    if (p === "/api/kringle") return create(request, env);
    if (p === "/api/kringle/claim") return claim(request, env);
    let m;
    if ((m = p.match(/^\/api\/kringle\/p\/([a-z0-9]+)\/wishlist$/)))
      return saveWishlist(m[1], request, env);
    if ((m = p.match(/^\/api\/kringle\/([a-z0-9]+)\/(reset|redraw|delete)$/)))
      return m[2] === "reset" ? reset(m[1], request, env)
        : m[2] === "redraw" ? redraw(m[1], env)
        : remove(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url),
  participantPage: (prow, row, env) => participantPage(prow, row, env),
};
