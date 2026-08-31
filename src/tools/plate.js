/* ============================================================
   Bring a Plate — the potluck board. Categories with a fixed
   number of spots; guests claim a spot with their name and dish.
   First user of the `claims` table: the UNIQUE(instance_id,
   slot_id) constraint is the race protection — two people going
   for the same spot resolve at the database, not in JS.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, createInstance, deleteInstance, logEvent, ownCta, shareNudge, cardPreview,
  fillTrack,
} from "../lib.js";

const MAX_TITLE = 80;
const MAX_DATE = 60;
const MAX_NOTE = 300;
const MAX_CATS = 12;
const MAX_CAT_NAME = 40;
const MAX_CAP = 20;
const MAX_NAME = 40;
const MAX_DISH = 80;

const NOUNS = ["pav", "snag", "lamington", "esky", "tongs", "platter",
  "trifle", "damper", "salad", "sanger", "icecube", "gravy"];

const HOME = "/bring-a-plate/";

/* ---------- validation -------------------------------------- */

function parseCreate(body) {
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, MAX_TITLE);
  const eventDate = String(body.eventDate || "").trim().replace(/\s+/g, " ").slice(0, MAX_DATE);
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);

  const raw = Array.isArray(body.categories) ? body.categories : [];
  if (!raw.length) throw badInput("Add at least one category.");
  if (raw.length > MAX_CATS) throw badInput("Twelve categories is the limit — combine a couple.");

  const categories = raw.map((c) => {
    const name = String((c && c.name) || "").trim().replace(/\s+/g, " ").slice(0, MAX_CAT_NAME);
    const capacity = Number(c && c.capacity);
    if (!name) throw badInput("Every category needs a name.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAP)
      throw badInput("Spots per category must be a whole number from 1 to 20.");
    return { name, capacity };
  });

  if (new Set(categories.map((c) => c.name.toLowerCase())).size !== categories.length)
    throw badInput("Two categories share a name — make each one different.");

  return { title, eventDate, note, categories };
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
  const { title, eventDate, note, categories } =
    parseCreate(await request.json().catch(() => ({})));
  const data = JSON.stringify({ categories, eventDate, note });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "plate", title, data, nouns: NOUNS,
  });
  await logEvent(env, id, "plate", "created");
  return json({ slug, editToken }, 201);
}

async function claim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "plate") return json({ error: "not found" }, 404);

  const data = JSON.parse(row.data);
  const slotId = String(body.slotId || "");
  if (!slotSet(data.categories).has(slotId))
    throw badInput("That spot doesn't exist on this board.");

  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  const dish = String(body.dish || "").trim().replace(/\s+/g, " ").slice(0, MAX_DISH);
  if (!name) throw badInput("Add your name so people know who's got it.");
  if (!dish) throw badInput("Say what you're bringing — that's the whole point.");

  const secret = randomString(16);
  try {
    // The UNIQUE(instance_id, slot_id) constraint makes this atomic:
    // whoever inserts first wins, the other gets a constraint violation.
    await env.DB.prepare(
      `INSERT INTO claims (instance_id, slot_id, name, message, cents, ref, paid, created_at)
       VALUES (?, ?, ?, ?, 0, ?, 0, ?)`
    ).bind(row.id, slotId, name, dish, secret, new Date().toISOString()).run();
  } catch (e) {
    if (/UNIQUE/.test(String(e)))
      return json({ error: "Someone snapped that spot up seconds ago — pick another." }, 409);
    throw e;
  }
  return json({ secret }, 201);
}

async function unclaim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "plate") return json({ error: "not found" }, 404);

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
  if (!row || row.tool_type !== "plate") return json({ error: "not found" }, 404);

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
  if (!row || row.tool_type !== "plate") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "plate", "deleted");
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
        <span class="plate-slot-name">${esc(c.name)}</span>
        <span class="plate-slot-dish">${esc(c.message)}</span>${organiser ? `
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
        <button class="btn primary plate-put" type="button">Put me down</button>
        <form class="plate-form" hidden>
          <input type="text" name="name" maxlength="${MAX_NAME}" placeholder="Your name" aria-label="Your name" autocomplete="name">
          <input type="text" name="dish" maxlength="${MAX_DISH}" placeholder="What are you bringing?" aria-label="What are you bringing?">
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
    // Section rung: same N/M as .plate-count just above it, so this is
    // the heading's own count redrawn as a bar, not a second fact. Reuse
    // the lead-rung helper and rename the class — .fill-track and
    // .fill-sect share --n/--m plumbing and only differ in geometry
    // (public/styles.css), and a per-category capacity (max 20) is
    // always <= 24 so this is always notched.
    const sectFill = fillTrack({ n: sorted, m: cat.capacity }).replace("fill-track", "fill-sect");
    return `
  <section class="plate-cat">
    <h2 class="plate-cat-head">${esc(cat.name)} <span class="plate-count">— <strong>${sorted}</strong> of ${cat.capacity} sorted</span>${
      full ? ` <span class="plate-tick" role="img" aria-label="all sorted">✓</span>` : ""}</h2>
    ${sectFill}
    <ul class="plate-grid">${cards.join("")}
    </ul>
  </section>`;
  }).join("");
}

function topMeta(data) {
  const chip = data.eventDate
    ? `<div class="plate-meta"><span class="plate-chip">${esc(data.eventDate)}</span></div>` : "";
  const note = data.note ? `<p class="plate-note">${esc(data.note)}</p>` : "";
  return chip + note;
}

const totalCapacity = (data) => data.categories.reduce((s, c) => s + c.capacity, 0);

/* The tick is not decoration. The lead bar is aria-hidden by design, so at
   N = M a full board announced completion in no word at all — the picture was
   full and the sentence still read "10 of 10 spots sorted", which is true but
   is not "you are done". Every per-category head already ticks at capacity
   (08-fill.md §D.5); the board-level line was the one place the state had no
   word. Same shape as roles.js:156 and roster.js:247. */
function subLine(data, claimCount) {
  const total = totalCapacity(data);
  const n = data.categories.length;
  const full = total > 0 && claimCount >= total;
  return `<strong>${claimCount}</strong> of ${total} spots sorted · ${n} ${n === 1 ? "category" : "categories"}${
    full ? ` <span role="img" aria-label="every spot is sorted">✓</span>` : ""}`;
}

// Lead rung: N = claims across the whole board, M = the declared total
// capacity (sum of every category's spot count) — the same two numbers
// subLine() already says in words, drawn as the one bar per page
// (docs/review/08-fill.md §D.2). MAX_CATS x MAX_CAP caps this at 240,
// so it is smooth (not notched) on any board bigger than 24 spots.
const leadFill = (data, claimCount) => fillTrack({ n: claimCount, m: totalCapacity(data) });

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const claims = await getClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;

  const body = `
<main class="wrap page">
  <p class="kicker">Who's bringing what</p>
  <h1>${esc(row.title || "Bring a plate")}</h1>
  <p class="page-sub">${subLine(data, claims.length)}</p>
  ${leadFill(data, claims.length)}
  ${topMeta(data)}
  ${board(data, bySlot, false)}
  ${ownCta("plate",
    "Got a team lunch, a party or a fete coming up?",
    "Make your own list")}
  <footer class="page-foot">
    <p class="fine">No accounts — this browser remembers which spots are yours,
    and your own cards get an undo. If you're on someone else's phone,
    just ask the organiser to shift things.</p>
    <p><a class="quiet-link" href="/via/plate">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var KEY = "bbb:plate:" + slug;

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

  /* ---- your own claims: badge + undo ---- */
  var list = mine().filter(function (c) {
    var card = cardFor(c.slotId);
    if (!card) return false; // spot is open again (organiser removed it)
    var dishEl = card.querySelector(".plate-slot-dish");
    // Compare with the server's whitespace normalisation, or our own
    // claims look stale the moment a dish has a double space in it.
    var norm = function (t) { return String(t || "").trim().replace(/\s+/g, " ").slice(0, 80); };
    return dishEl && norm(dishEl.textContent) === norm(c.dish); // stale if someone else holds it now
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
      fetch("/api/plate/unclaim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug, slotId: c.slotId, secret: c.secret }),
      }).then(function (r) {
        if (!r.ok && r.status !== 404) throw new Error("failed");
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
    var dishInput = form.querySelector('input[name="dish"]');
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
      var dish = dishInput.value.trim();
      if (!name) return fail("Your name first — so people know who's got it.");
      if (!dish) return fail("Say what you're bringing.");

      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      fetch("/api/plate/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: slug, slotId: card.getAttribute("data-slot"), name: name, dish: dish,
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
          l.push({ slotId: card.getAttribute("data-slot"), secret: d.secret, dish: dish });
          saveMine(l);
          location.reload();
        });
      }).catch(function (ex) {
        fail(ex.message || "That didn't work — try again.");
      });

      function fail(msg) {
        err.textContent = msg;
        err.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "Lock it in";
        return false;
      }
    });
  });
})();
</script>`;
  return html(pageShell({ title: row.title || "Bring a plate", body, shareType: "plate", shareSlug: row.slug }));
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
  <h1>${esc(row.title || "Bring a plate")}</h1>
  <p class="page-sub">${subLine(data, claims.length)}</p>
  ${leadFill(data, claims.length)}
  ${topMeta(data)}

  <p class="share-label">This is what shows when you paste the link:</p>
  ${cardPreview("plate", row.title || "Bring a plate")}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the group</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🍴 Put your name on a plate — pick what you’re bringing: " + shareUrl, row.edit_token)}

  <button class="btn" id="printBtn" type="button">Print this list</button>

  ${board(data, bySlot, true)}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared board</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this board</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Removing a claim opens the spot straight back up — maybe give
    the person a heads-up first. To claim spots yourself, use the shared link like
    everyone else. Deleting is permanent — the shared link stops working immediately.</p>
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
  document.querySelectorAll(".plate-remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!confirm("Remove this claim? The spot opens up again.")) return;
      fetch("/api/plate/" + token + "/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: btn.getAttribute("data-slot") }),
      }).then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.reload(); })
        .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this board for good? The shared link will stop working.")) return;
    fetch("/api/plate/" + token + "/delete", { method: "POST" })
      .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Bring a plate"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "plate",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/plate")) return null;
    if (p === "/api/plate") return create(request, env);
    if (p === "/api/plate/claim") return claim(request, env);
    if (p === "/api/plate/unclaim") return unclaim(request, env);
    const m = p.match(/^\/api\/plate\/([a-z0-9]+)\/(remove|delete)$/);
    if (m) return m[2] === "remove" ? orgRemove(m[1], request, env) : orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
