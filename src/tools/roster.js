/* ============================================================
   Volunteer Roster — sign-up shifts for a school fete, canteen,
   working bee or sausage sizzle. Same claims-table slot model as
   Bring a Plate, but framed as shifts with times: each shift has
   a fixed number of spots, claimed in the open, first in best
   dressed. The UNIQUE(instance_id, slot_id) constraint is the
   race protection — two people going for the last grill spot
   resolve at the database, not in JS.

   The coordinator's organiser page can print the filled roster
   and export it as CSV (gated by the edit token).
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_TITLE = 80;
const MAX_DATE = 60;
const MAX_NOTE = 300;
const MAX_SHIFTS = 20;
const MAX_LABEL = 50;
const MAX_CAP = 30;
const MAX_NAME = 40;
const MAX_MESSAGE = 120;

const NOUNS = ["shift", "apron", "urn", "sausage", "raffle", "canteen",
  "marquee", "clipboard", "hiviz", "roster"];

const HOME = "/volunteer-roster/";

/* ---------- validation -------------------------------------- */

function parseCreate(body) {
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, MAX_TITLE);
  const eventDate = String(body.eventDate || "").trim().replace(/\s+/g, " ").slice(0, MAX_DATE);
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);

  const raw = Array.isArray(body.shifts) ? body.shifts : [];
  if (!raw.length) throw badInput("Add at least one shift.");
  if (raw.length > MAX_SHIFTS) throw badInput("Twenty shifts is the limit — split the day if you need more.");

  const shifts = raw.map((s) => {
    const label = String((s && s.label) || "").trim().replace(/\s+/g, " ").slice(0, MAX_LABEL);
    const capacity = Number(s && s.capacity);
    if (!label) throw badInput("Every shift needs a label — a job and a time.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAP)
      throw badInput("Spots per shift must be a whole number from 1 to 30.");
    return { label, capacity };
  });

  return { title, eventDate, note, shifts };
}

/* Slot ids are positional and stable: s<shiftIndex>-<n>, n from 1. */
function slotSet(shifts) {
  const set = new Set();
  shifts.forEach((s, i) => {
    for (let n = 1; n <= s.capacity; n++) set.add(`s${i}-${n}`);
  });
  return set;
}

const getClaims = async (env, instanceId) =>
  (await env.DB.prepare("SELECT * FROM claims WHERE instance_id = ?")
    .bind(instanceId).all()).results;

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { title, eventDate, note, shifts } =
    parseCreate(await request.json().catch(() => ({})));
  const data = JSON.stringify({ shifts, eventDate, note });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "roster", title, data, nouns: NOUNS,
  });
  await logEvent(env, id, "roster", "created");
  return json({ slug, editToken }, 201);
}

async function claim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "roster") return json({ error: "not found" }, 404);

  const data = JSON.parse(row.data);
  const slotId = String(body.slotId || "");
  if (!slotSet(data.shifts).has(slotId))
    throw badInput("That shift spot doesn't exist on this roster.");

  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  const message = String(body.message || "").trim().replace(/\s+/g, " ").slice(0, MAX_MESSAGE);
  if (!name) throw badInput("Add your name so the coordinator knows who's on.");

  const secret = randomString(16);
  try {
    // UNIQUE(instance_id, slot_id) makes this atomic: whoever inserts
    // first holds the spot, the other gets a constraint violation.
    await env.DB.prepare(
      `INSERT INTO claims (instance_id, slot_id, name, message, cents, ref, paid, created_at)
       VALUES (?, ?, ?, ?, 0, ?, 0, ?)`
    ).bind(row.id, slotId, name, message, secret, new Date().toISOString()).run();
  } catch (e) {
    if (/UNIQUE/.test(String(e)))
      return json({ error: "Someone just grabbed that shift — pick another." }, 409);
    throw e;
  }
  return json({ secret }, 201);
}

async function unclaim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "roster") return json({ error: "not found" }, 404);

  const slotId = String(body.slotId || "");
  const secret = String(body.secret || "");
  if (!slotId || !secret) return json({ error: "That spot wasn't found." }, 404);

  const res = await env.DB.prepare(
    "DELETE FROM claims WHERE instance_id = ? AND slot_id = ? AND ref = ?"
  ).bind(row.id, slotId, secret).run();
  if (!res.meta.changes) return json({ error: "That spot wasn't found." }, 404);
  return json({ ok: true });
}

async function orgRemove(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "roster") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const slotId = String(body.slotId || "");
  const res = await env.DB.prepare(
    "DELETE FROM claims WHERE instance_id = ? AND slot_id = ?"
  ).bind(row.id, slotId).run();
  if (!res.meta.changes) return json({ error: "That spot wasn't found." }, 404);
  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "roster") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "roster", "deleted");
  return json({ ok: true });
}

/* Full roster for the organiser's CSV — every filled spot in shift
   order, gated by the edit token. Names + notes are private-ish, so
   this only ever answers a valid organiser link. */
async function adminData(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "roster") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);
  const claims = await getClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;

  const rows = [];
  data.shifts.forEach((s, si) => {
    for (let n = 1; n <= s.capacity; n++) {
      const c = bySlot[`s${si}-${n}`];
      if (c) rows.push({ shift: s.label, name: c.name, note: c.message || "" });
    }
  });
  return json({ title: row.title || "Volunteer roster", eventDate: data.eventDate || "", rows });
}

/* ---------- rendering --------------------------------------- */

function board(data, bySlot, organiser) {
  return data.shifts.map((shift, si) => {
    let filled = 0;
    const cards = [];
    for (let n = 1; n <= shift.capacity; n++) {
      const sid = `s${si}-${n}`;
      const c = bySlot[sid];
      if (c) {
        filled++;
        cards.push(`
      <li class="rost-slot claimed" data-slot="${sid}">
        <span class="rost-slot-name">${esc(c.name)}</span>${c.message ? `
        <span class="rost-slot-note">${esc(c.message)}</span>` : ""}${organiser ? `
        <button class="btn ghost rost-mini rost-remove" type="button" data-slot="${sid}">Remove</button>` : ""}
      </li>`);
      } else if (organiser) {
        cards.push(`
      <li class="rost-slot open" data-slot="${sid}">
        <span class="rost-open-label">Open</span>
      </li>`);
      } else {
        cards.push(`
      <li class="rost-slot open" data-slot="${sid}">
        <button class="btn rost-put" type="button">Put me down</button>
        <form class="rost-form" hidden>
          <input type="text" name="name" maxlength="${MAX_NAME}" placeholder="Your name" aria-label="Your name" autocomplete="name">
          <input type="text" name="message" maxlength="${MAX_MESSAGE}" placeholder="Note (optional) — phone, 'can bring urn'" aria-label="Note (optional)">
          <div class="rost-form-row">
            <button class="btn primary rost-mini" type="submit">Put me down</button>
            <button class="btn ghost rost-mini rost-cancel" type="button">Never mind</button>
          </div>
          <p class="rost-form-err" hidden></p>
        </form>
      </li>`);
      }
    }
    const full = filled >= shift.capacity;
    return `
  <section class="rost-shift">
    <h2 class="rost-shift-head">${esc(shift.label)} <span class="rost-count">— ${filled} of ${shift.capacity} filled</span>${
      full ? ` <span class="rost-tick" role="img" aria-label="fully staffed">✓</span>` : ""}</h2>
    <ul class="rost-grid">${cards.join("")}
    </ul>
  </section>`;
  }).join("");
}

function topMeta(data) {
  const chip = data.eventDate
    ? `<div class="rost-meta"><span class="rost-chip">${esc(data.eventDate)}</span></div>` : "";
  const note = data.note ? `<p class="rost-note">${esc(data.note)}</p>` : "";
  return chip + note;
}

function subLine(data, claimCount) {
  const total = data.shifts.reduce((s, c) => s + c.capacity, 0);
  const n = data.shifts.length;
  return `${claimCount} of ${total} spots filled · ${n} ${n === 1 ? "shift" : "shifts"}`;
}

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const claims = await getClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;

  const body = `
<main class="wrap page">
  <p class="kicker">Who's on which shift</p>
  <h1>${esc(row.title || "Volunteer roster")}</h1>
  <p class="page-sub">${subLine(data, claims.length)}</p>
  ${topMeta(data)}
  ${board(data, bySlot, false)}
  <footer class="page-foot">
    <p class="fine">No accounts — this browser remembers which spots are yours,
    and your own cards get an undo. On someone else's phone? Just ask the
    coordinator to shuffle things.</p>
    <p><a class="quiet-link" href="/via/roster">made with bitibybit.com →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var KEY = "bbb:roster:" + slug;

  function mine() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveMine(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function cardFor(slotId) {
    if (!/^s\\d+-\\d+$/.test(slotId)) return null;
    return document.querySelector('.rost-slot.claimed[data-slot="' + slotId + '"]');
  }
  var norm = function (t) { return String(t || "").trim().replace(/\\s+/g, " ").slice(0, 40); };

  /* ---- your own spots: badge + undo ---- */
  var list = mine().filter(function (c) {
    var card = cardFor(c.slotId);
    if (!card) return false; // spot is open again (coordinator removed it, or someone else holds it)
    var nameEl = card.querySelector(".rost-slot-name");
    // Compare against the server's whitespace normalisation, or a spot
    // someone else re-took would still look like ours.
    return nameEl && norm(nameEl.textContent) === norm(c.name);
  });
  saveMine(list);

  list.forEach(function (c) {
    var card = cardFor(c.slotId);
    var badge = document.createElement("span");
    badge.className = "rost-you";
    badge.textContent = "that's you";
    card.insertBefore(badge, card.firstChild);

    var undo = document.createElement("button");
    undo.type = "button";
    undo.className = "btn ghost rost-mini";
    undo.textContent = "Can't make it?";
    undo.addEventListener("click", function () {
      if (!confirm("Take your name off this shift? It opens up for someone else.")) return;
      fetch("/api/roster/unclaim", {
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
  document.querySelectorAll(".rost-slot.open").forEach(function (card) {
    var put = card.querySelector(".rost-put");
    var form = card.querySelector(".rost-form");
    if (!put || !form) return;
    var nameInput = form.querySelector('input[name="name"]');
    var msgInput = form.querySelector('input[name="message"]');
    var submitBtn = form.querySelector('button[type="submit"]');
    var err = form.querySelector(".rost-form-err");

    put.addEventListener("click", function () {
      put.hidden = true;
      form.hidden = false;
      nameInput.focus();
    });
    form.querySelector(".rost-cancel").addEventListener("click", function () {
      form.hidden = true;
      err.hidden = true;
      put.hidden = false;
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var name = nameInput.value.trim();
      var msg = msgInput.value.trim();
      if (!name) return fail("Your name first — so the coordinator knows who's on.");

      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      fetch("/api/roster/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: slug, slotId: card.getAttribute("data-slot"), name: name, message: msg,
        }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 409) {
            fail(d.error || "Someone just grabbed that shift — pick another.");
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
        submitBtn.textContent = "Put me down";
        return false;
      }
    });
  });
})();
</script>`;
  return html(pageShell({ title: row.title || "Volunteer roster", body }));
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
    <strong>This is your coordinator page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with your volunteers.
  </div>

  <p class="kicker">Coordinator view</p>
  <h1>${esc(row.title || "Volunteer roster")}</h1>
  <p class="page-sub">${subLine(data, claims.length)}</p>
  ${topMeta(data)}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with your volunteers</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("We need hands for " + (row.title || "the day") + " — grab a shift here (takes 20 seconds, no sign-up): " + shareUrl)}

  <div class="rost-tools">
    <button class="btn" id="csvBtn" type="button">Download roster (CSV)</button>
    <button class="btn" id="printBtn" type="button">Print this roster</button>
  </div>

  ${board(data, bySlot, true)}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared roster</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this roster</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Removing a name opens the spot straight back up — maybe give
    the person a heads-up first. To take a shift yourself, use the shared link
    like everyone else. Deleting is permanent — the shared link stops working
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

  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });

  /* ---- CSV export, built client-side from the admin endpoint ---- */
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    // Formula-injection guard: a spreadsheet treats a cell that starts
    // with = + - @ (or a control char) as a formula. Prefix with an
    // apostrophe so it stays plain text.
    if (/^[=+\\-@\\t\\r]/.test(s)) s = "'" + s;
    if (/[",\\n\\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function slugName(t) {
    return (String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "volunteer-roster");
  }
  document.getElementById("csvBtn").addEventListener("click", function () {
    var btn = this;
    btn.disabled = true;
    var old = btn.textContent;
    btn.textContent = "Building…";
    fetch("/api/roster/" + token + "/admin")
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "Couldn't fetch the roster."); });
        return r.json();
      })
      .then(function (d) {
        var lines = ["Shift,Name,Note"];
        (d.rows || []).forEach(function (row) {
          lines.push([csvCell(row.shift), csvCell(row.name), csvCell(row.note)].join(","));
        });
        // BOM so Excel reads UTF-8 names correctly.
        var blob = new Blob(["\\ufeff" + lines.join("\\r\\n")], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "roster-" + slugName(d.title) + ".csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        btn.textContent = old;
        btn.disabled = false;
      })
      .catch(function (e) {
        alert((e && e.message) || "That didn't work — try again.");
        btn.textContent = old;
        btn.disabled = false;
      });
  });

  document.querySelectorAll(".rost-remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!confirm("Remove this name? The shift opens up again.")) return;
      fetch("/api/roster/" + token + "/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: btn.getAttribute("data-slot") }),
      }).then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.reload(); })
        .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  });

  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this roster for good? The shared link will stop working.")) return;
    fetch("/api/roster/" + token + "/delete", { method: "POST" })
      .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Volunteer roster"} (coordinator)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "roster",

  async api(request, env, url) {
    const p = url.pathname;
    if (!p.startsWith("/api/roster")) return null;

    let m;
    if (request.method === "GET") {
      if ((m = p.match(/^\/api\/roster\/([a-z0-9]+)\/admin$/))) return adminData(m[1], env);
      return null;
    }
    if (request.method !== "POST") return null;

    if (p === "/api/roster") return create(request, env);
    if (p === "/api/roster/claim") return claim(request, env);
    if (p === "/api/roster/unclaim") return unclaim(request, env);
    if ((m = p.match(/^\/api\/roster\/([a-z0-9]+)\/(remove|delete)$/)))
      return m[2] === "remove" ? orgRemove(m[1], request, env) : orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
