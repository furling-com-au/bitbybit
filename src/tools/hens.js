/* ============================================================
   Hens & Shower Planner — coordinate a hen's do, a bridal or
   baby shower, or any group celebration. Three parts:

     1. The details    — who it's for, when, where, a note, and a
                          TEXT-ONLY kitty note (how costs get split).
                          No money is handled anywhere.
     2. The plan        — a display-only agenda list (activities).
     3. Who brings what — a claims-table "bring a list" exactly like
                          Bring a Plate: categories with a fixed
                          number of spots, claimed in the open. The
                          UNIQUE(instance_id, slot_id) constraint is
                          the race protection — two people going for
                          the same spot resolve at the database.

   Privacy: the venue address and the kitty note are semi-private —
   guests need them, so they render on the /s/ page (which is
   noindex + no-store), but they are never placed in og/meta. The
   claim's "what" is public among guests (that's the whole point of a
   who's-bringing-what board); it holds no contact details.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_TITLE = 80;
const MAX_FORWHOM = 80;
const MAX_WHEN = 80;
const MAX_WHERE = 120;
const MAX_NOTE = 400;
const MAX_KITTY = 200;
const MAX_CATS = 12;
const MAX_CAT_NAME = 40;
const MAX_CAP = 20;
const MAX_ACTIVITIES = 20;
const MAX_ACTIVITY = 100;
const MAX_NAME = 40;
const MAX_MESSAGE = 120;

const NOUNS = ["sash", "fizz", "bubbly", "confetti", "cheers",
  "glam", "soiree", "shindig", "hurrah", "frolic"];

const HOME = "/hens-planner/";

/* ---------- validation -------------------------------------- */

function parseCreate(body) {
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, MAX_TITLE);
  if (!title) throw badInput("Give the do a name — even just \"Mia's Hens\".");

  const forWhom = String(body.forWhom || "").trim().replace(/\s+/g, " ").slice(0, MAX_FORWHOM);
  const when = String(body.when || "").trim().replace(/\s+/g, " ").slice(0, MAX_WHEN);
  const where = String(body.where || "").trim().replace(/\s+/g, " ").slice(0, MAX_WHERE);
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);
  const kitty = String(body.kitty || "").trim().slice(0, MAX_KITTY);

  const rawCats = Array.isArray(body.categories) ? body.categories : [];
  if (!rawCats.length) throw badInput("Add at least one thing to bring or sort.");
  if (rawCats.length > MAX_CATS) throw badInput("Twelve lists is the limit — combine a couple.");

  const categories = rawCats.map((c) => {
    const name = String((c && c.name) || "").trim().replace(/\s+/g, " ").slice(0, MAX_CAT_NAME);
    const capacity = Number(c && c.capacity);
    if (!name) throw badInput("Every list needs a name.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAP)
      throw badInput("Spots per list must be a whole number from 1 to 20.");
    return { name, capacity };
  });

  if (new Set(categories.map((c) => c.name.toLowerCase())).size !== categories.length)
    throw badInput("Two lists share a name — make each one different.");

  const activities = (Array.isArray(body.activities) ? body.activities : [])
    .map((a) => String(a || "").trim().replace(/\s+/g, " ").slice(0, MAX_ACTIVITY))
    .filter(Boolean)
    .slice(0, MAX_ACTIVITIES);

  return { title, forWhom, when, where, note, kitty, categories, activities };
}

/* Slot ids are positional and stable: c<catIndex>-<n>, n from 1. */
function slotSet(categories) {
  const set = new Set();
  categories.forEach((c, i) => {
    for (let n = 1; n <= c.capacity; n++) set.add(`c${i}-${n}`);
  });
  return set;
}

const getClaims = async (env, instanceId) =>
  (await env.DB.prepare("SELECT * FROM claims WHERE instance_id = ?")
    .bind(instanceId).all()).results;

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { title, forWhom, when, where, note, kitty, categories, activities } =
    parseCreate(await request.json().catch(() => ({})));
  const data = JSON.stringify({ forWhom, when, where, note, kitty, categories, activities });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "hens", title, data, nouns: NOUNS,
  });
  await logEvent(env, id, "hens", "created");
  return json({ slug, editToken }, 201);
}

async function claim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "hens") return json({ error: "not found" }, 404);

  const data = JSON.parse(row.data);
  const slotId = String(body.slotId || "");
  if (!slotSet(data.categories).has(slotId))
    throw badInput("That spot doesn't exist on this board.");

  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  const message = String(body.message || "").trim().replace(/\s+/g, " ").slice(0, MAX_MESSAGE);
  if (!name) throw badInput("Add your name so people know who's got it.");

  const secret = randomString(16);
  try {
    // The UNIQUE(instance_id, slot_id) constraint makes this atomic:
    // whoever inserts first wins, the other gets a constraint violation.
    await env.DB.prepare(
      `INSERT INTO claims (instance_id, slot_id, name, message, cents, ref, paid, created_at)
       VALUES (?, ?, ?, ?, 0, ?, 0, ?)`
    ).bind(row.id, slotId, name, message, secret, new Date().toISOString()).run();
  } catch (e) {
    if (/UNIQUE/.test(String(e)))
      return json({ error: "Someone grabbed that spot seconds ago — pick another." }, 409);
    throw e;
  }
  return json({ secret }, 201);
}

async function unclaim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "hens") return json({ error: "not found" }, 404);

  const slotId = String(body.slotId || "");
  const secret = String(body.secret || "");
  if (!slotId || !secret) return json({ error: "That claim wasn't found." }, 404);

  const res = await env.DB.prepare(
    "DELETE FROM claims WHERE instance_id = ? AND slot_id = ? AND ref = ?"
  ).bind(row.id, slotId, secret).run();
  if (!res.meta.changes) return json({ error: "That claim wasn't found." }, 404);
  return json({ ok: true });
}

async function orgRemove(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "hens") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const slotId = String(body.slotId || "");
  const res = await env.DB.prepare(
    "DELETE FROM claims WHERE instance_id = ? AND slot_id = ?"
  ).bind(row.id, slotId).run();
  if (!res.meta.changes) return json({ error: "That claim wasn't found." }, 404);
  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "hens") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "hens", "deleted");
  return json({ ok: true });
}

/* ---------- rendering --------------------------------------- */

function board(data, bySlot, organiser) {
  return data.categories.map((cat, ci) => {
    let sorted = 0;
    const cards = [];
    for (let n = 1; n <= cat.capacity; n++) {
      const sid = `c${ci}-${n}`;
      const c = bySlot[sid];
      if (c) {
        sorted++;
        cards.push(`
      <li class="plate-slot claimed" data-slot="${sid}">
        <span class="plate-slot-name">${esc(c.name)}</span>${c.message ? `
        <span class="plate-slot-dish">${esc(c.message)}</span>` : ""}${organiser ? `
        <button class="btn ghost plate-mini plate-remove" type="button" data-slot="${sid}">Remove</button>` : ""}
      </li>`);
      } else if (organiser) {
        cards.push(`
      <li class="plate-slot open" data-slot="${sid}">
        <span class="plate-open-label">Open</span>
      </li>`);
      } else {
        cards.push(`
      <li class="plate-slot open" data-slot="${sid}">
        <button class="btn plate-put" type="button">I've got this</button>
        <form class="plate-form" hidden>
          <input type="text" name="name" maxlength="${MAX_NAME}" placeholder="Your name" aria-label="Your name" autocomplete="name">
          <input type="text" name="message" maxlength="${MAX_MESSAGE}" placeholder="What exactly? (optional)" aria-label="What are you bringing or sorting?">
          <div class="plate-form-row">
            <button class="btn primary plate-mini" type="submit">Lock it in</button>
            <button class="btn ghost plate-mini plate-cancel" type="button">Never mind</button>
          </div>
          <p class="plate-form-err" hidden></p>
        </form>
      </li>`);
      }
    }
    const full = sorted >= cat.capacity;
    return `
  <section class="plate-cat">
    <h2 class="plate-cat-head">${esc(cat.name)} <span class="plate-count">— ${sorted} of ${cat.capacity} sorted</span>${
      full ? ` <span class="plate-tick" role="img" aria-label="all sorted">✓</span>` : ""}</h2>
    <ul class="plate-grid">${cards.join("")}
    </ul>
  </section>`;
  }).join("");
}

/* The who-it's-for line and the when/where chips. 'where' is
   semi-private (venue address) — safe here because every instance
   page is noindex + no-store; it just never reaches og/meta. */
function forLine(data) {
  return data.forWhom
    ? `<p class="hens-for">In honour of <strong>${esc(data.forWhom)}</strong></p>` : "";
}

function factsBlock(data) {
  const chips = [];
  if (data.when)
    chips.push(`<li class="hens-chip"><span class="hens-chip-label">When</span> ${esc(data.when)}</li>`);
  if (data.where)
    chips.push(`<li class="hens-chip"><span class="hens-chip-label">Where</span> ${esc(data.where)}</li>`);
  return chips.length ? `<ul class="hens-facts">${chips.join("")}</ul>` : "";
}

const noteBlock = (data) =>
  data.note ? `<div class="pixel-note hens-note">${esc(data.note)}</div>` : "";

/* The kitty is a plain-text note about how costs are split — no
   money is captured or moved anywhere. */
const kittyBlock = (data) =>
  data.kitty
    ? `<div class="hens-kitty">
    <span class="hens-kitty-label">The kitty</span>
    <p class="hens-kitty-text">${esc(data.kitty)}</p>
    <p class="fine hens-kitty-fine">Sort the actual money between yourselves — this planner never touches it.</p>
  </div>` : "";

const agendaBlock = (data) =>
  (data.activities && data.activities.length)
    ? `<h2>The plan</h2>
  <ol class="hens-agenda">${data.activities.map((a) => `
    <li>${esc(a)}</li>`).join("")}
  </ol>` : "";

function subLine(data, claimCount) {
  const total = data.categories.reduce((s, c) => s + c.capacity, 0);
  const n = data.categories.length;
  return `${claimCount} of ${total} sorted · ${n} ${n === 1 ? "list" : "lists"}`;
}

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const claims = await getClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;

  const body = `
<main class="wrap page">
  <p class="kicker">Let's sort the celebration</p>
  <h1>${esc(row.title || "Hens & shower planner")}</h1>
  ${forLine(data)}
  <p class="page-sub">${subLine(data, claims.length)}</p>
  ${factsBlock(data)}
  ${noteBlock(data)}
  ${kittyBlock(data)}
  ${agendaBlock(data)}

  <h2>Who's bringing what</h2>
  ${board(data, bySlot, false)}

  <footer class="page-foot">
    <p class="fine">No accounts — this browser remembers which spots are yours,
    and your own cards get an undo. On someone else's phone? Just ask the
    organiser to shift things.</p>
    <p><a class="quiet-link" href="/via/hens">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var KEY = "bbb:hens:" + slug;

  function mine() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveMine(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function cardFor(slotId) {
    if (!/^c\\d+-\\d+$/.test(slotId)) return null;
    return document.querySelector('.plate-slot.claimed[data-slot="' + slotId + '"]');
  }
  var norm = function (t) { return String(t || "").trim().replace(/\\s+/g, " ").slice(0, ${MAX_NAME}); };

  /* ---- your own claims: badge + undo ---- */
  var list = mine().filter(function (c) {
    var card = cardFor(c.slotId);
    if (!card) return false; // spot is open again (organiser removed it, or someone else holds it)
    var nameEl = card.querySelector(".plate-slot-name");
    // Compare against the server's whitespace normalisation, or a spot
    // someone else re-took would still look like ours.
    return nameEl && norm(nameEl.textContent) === norm(c.name);
  });
  saveMine(list);

  list.forEach(function (c) {
    var card = cardFor(c.slotId);
    var badge = document.createElement("span");
    badge.className = "plate-you";
    badge.textContent = "that's you";
    card.insertBefore(badge, card.firstChild);

    var undo = document.createElement("button");
    undo.type = "button";
    undo.className = "btn ghost plate-mini";
    undo.textContent = "Changed plans?";
    undo.addEventListener("click", function () {
      if (!confirm("Take your name off this spot? It opens up for someone else.")) return;
      fetch("/api/hens/unclaim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug, slotId: c.slotId, secret: c.secret }),
      }).then(function (r) {
        if (!r.ok && r.status !== 404)
          return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); });
        saveMine(mine().filter(function (x) { return x.slotId !== c.slotId; }));
        location.reload();
      }).catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
    card.appendChild(undo);
  });

  /* ---- open spots: reveal the mini-form, claim ---- */
  document.querySelectorAll(".plate-slot.open").forEach(function (card) {
    var put = card.querySelector(".plate-put");
    var form = card.querySelector(".plate-form");
    if (!put || !form) return;
    var nameInput = form.querySelector('input[name="name"]');
    var msgInput = form.querySelector('input[name="message"]');
    var submitBtn = form.querySelector('button[type="submit"]');
    var err = form.querySelector(".plate-form-err");

    put.addEventListener("click", function () {
      put.hidden = true;
      form.hidden = false;
      nameInput.focus();
    });
    form.querySelector(".plate-cancel").addEventListener("click", function () {
      form.hidden = true;
      err.hidden = true;
      put.hidden = false;
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var name = nameInput.value.trim();
      var msg = msgInput.value.trim();
      if (!name) return fail("Your name first — so people know who's got it.");

      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      fetch("/api/hens/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: slug, slotId: card.getAttribute("data-slot"), name: name, message: msg,
        }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 409) {
            fail(d.error || "Someone beat you to it — pick another.");
            setTimeout(function () { location.reload(); }, 2000);
            return;
          }
          if (!r.ok) throw new Error(d.error || "Server said " + r.status + ".");
          var l = mine();
          l.push({ slotId: card.getAttribute("data-slot"), secret: d.secret, name: name });
          saveMine(l);
          location.reload();
        });
      }).catch(function (ex) {
        fail(ex.message || "That didn't work — try again.");
      });

      function fail(msg2) {
        err.textContent = msg2;
        err.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "Lock it in";
        return false;
      }
    });
  });
})();
</script>`;
  return html(pageShell({ title: row.title || "Hens & shower planner", body }));
}

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const claims = await getClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;
  const shareUrl = `${origin}/s/${row.slug}`;

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with everyone else.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(row.title || "Hens & shower planner")}</h1>
  ${forLine(data)}
  <p class="page-sub">${subLine(data, claims.length)}</p>
  ${factsBlock(data)}
  ${noteBlock(data)}
  ${kittyBlock(data)}
  ${agendaBlock(data)}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the group</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🥂 Helping plan " + (row.title || "the do") + " — pop your name on what you're bringing: " + shareUrl)}

  <h2>Who's bringing what</h2>
  ${board(data, bySlot, true)}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared board</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this board</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Removing a claim opens the spot straight back up — maybe give
    the person a heads-up first. To claim spots yourself, use the shared link like
    everyone else. Deleting is permanent — the shared link stops working
    immediately.</p>
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
  document.querySelectorAll(".plate-remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!confirm("Remove this claim? The spot opens up again.")) return;
      fetch("/api/hens/" + token + "/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: btn.getAttribute("data-slot") }),
      }).then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.reload(); })
        .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this board for good? The shared link will stop working.")) return;
    fetch("/api/hens/" + token + "/delete", { method: "POST" })
      .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Hens & shower planner"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "hens",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/hens")) return null;
    if (p === "/api/hens") return create(request, env);
    if (p === "/api/hens/claim") return claim(request, env);
    if (p === "/api/hens/unclaim") return unclaim(request, env);
    const m = p.match(/^\/api\/hens\/([a-z0-9]+)\/(remove|delete)$/);
    if (m) return m[2] === "remove" ? orgRemove(m[1], request, env) : orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
