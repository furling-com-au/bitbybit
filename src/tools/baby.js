/* ============================================================
   Baby Guess Pool — everyone guesses the bub's arrival date and
   weight; once the baby lands, the closest guess wins.

   Guesses are participants rows. Two Sams must both be able to
   guess, and participants has a partial UNIQUE(instance_id, name)
   WHERE name <> '' — so every row is inserted with name = '' and
   the guesser's name lives in the data JSON ({guesser, date,
   weightGrams, message}). Each guesser gets back their row token,
   which is the only way to take that guess out (short of the
   organiser link). The actual birth is stored on the instance
   (data.result); setting it closes guessing and reveals the board.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, getParticipant, getInstanceById,
  createInstance, updateInstanceData, deleteInstance, logEvent, fmtDate, shareNudge,
} from "../lib.js";

const MAX_PARENTS = 80;
const MAX_DUE = 60;
const MAX_NOTE = 300;
const MAX_GUESSER = 40;
const MAX_MESSAGE = 200;
const MAX_ARRIVED = 40;
const MAX_GUESSES = 300;

const MIN_G = 500;   // 0.5 kg — smaller than any real newborn, but a floor
const MAX_G = 7000;  // 7 kg — a whopper, but a ceiling

const DAY = 86400000;
const BACK = 400 * DAY;  // a guess/birth date can't be more than ~13 months old
const FWD = 550 * DAY;   // …or more than ~18 months out (baby-shower lead time)

const NOUNS = ["bub", "nappy", "pram", "rattle", "booties", "cuddle",
  "stork", "onesie", "dummy", "wombat"];

const HOME = "/baby-guess-pool/";

/* ---------- data access ------------------------------------- */

const allGuesses = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT * FROM participants WHERE instance_id = ? ORDER BY id DESC"
  ).bind(instanceId).all()).results;

function guessData(p) {
  let d = {};
  try { d = JSON.parse(p.data); } catch { /* fine */ }
  return {
    guesser: d.guesser || "Someone",
    date: typeof d.date === "string" ? d.date : "",
    weightGrams: Number(d.weightGrams) || 0,
    message: d.message || "",
  };
}

/* ---------- input ------------------------------------------- */

/* A calendar day as YYYY-MM-DD. Round-trips through Date to reject
   impossible days (2026-02-30 rolls over, so its ISO won't match),
   and clamps to a sane window so nobody guesses the year 1200. */
function parseDayString(x, missingMsg) {
  const s = String(x || "").trim();
  if (!s) throw badInput(missingMsg);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
    throw badInput("That date doesn't look right — use the date picker.");
  const t = Date.parse(s + "T00:00:00Z");
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s)
    throw badInput("That date doesn't look right — check the day and month.");
  const now = Date.now();
  if (t < now - BACK || t > now + FWD)
    throw badInput("Keep the date within a year or so — it's a guess, not a prophecy.");
  return s;
}

function parseWeightGrams(x) {
  const g = Math.round(Number(x));
  if (!Number.isFinite(g) || g < MIN_G || g > MAX_G)
    throw badInput("Give a weight between 0.5 and 7 kg.");
  return g;
}

function parseCreate(body) {
  const parents = String(body.parents || "").trim().replace(/\s+/g, " ").slice(0, MAX_PARENTS);
  if (!parents) throw badInput("Whose bub is it? Add the parents' names.");
  const dueDate = String(body.dueDate || "").trim().replace(/\s+/g, " ").slice(0, MAX_DUE);
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);
  return { parents, dueDate, note };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { parents, dueDate, note } = parseCreate(await request.json().catch(() => ({})));
  const data = JSON.stringify({ parents, dueDate, note, units: "metric", result: null });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "baby", title: parents, data, nouns: NOUNS,
  });
  await logEvent(env, id, "baby", "created");
  return json({ slug, editToken }, 201);
}

async function guess(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "baby") return json({ error: "not found" }, 404);

  const data = JSON.parse(row.data);
  if (data.result)
    return json({ error: "Bub's already here — the guessing's closed." }, 409);

  const guesser = String(body.guesser || "").trim().replace(/\s+/g, " ").slice(0, MAX_GUESSER);
  if (!guesser) throw badInput("Add your name so we know whose guess it is.");
  const date = parseDayString(body.date, "Pick a date for your guess.");
  const weightGrams = parseWeightGrams(body.weightGrams);
  const message = String(body.message || "").trim().slice(0, MAX_MESSAGE);

  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM participants WHERE instance_id = ?"
  ).bind(row.id).first();
  const n = (count && count.n) || 0;
  if (n >= MAX_GUESSES)
    return json({ error: "This pool's chockers — that's the limit on guesses." }, 409);

  // name stays '' so duplicate guesser names are allowed (the partial
  // unique index only bites on non-empty names). claimed_at orders the wall.
  const token = randomString(22);
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, claimed_at, created_at)
     VALUES (?, ?, '', ?, ?, ?)`
  ).bind(row.id, token, JSON.stringify({ guesser, date, weightGrams, message }), now, now).run();
  return json({ token, id: res.meta.last_row_id }, 201);
}

async function guesserRemove(ptoken, env) {
  const prow = await getParticipant(env, ptoken);
  const row = prow && await getInstanceById(env, prow.instance_id);
  if (!row || row.tool_type !== "baby")
    return json({ error: "That guess wasn't found — it may already be gone." }, 404);
  await env.DB.prepare("DELETE FROM participants WHERE id = ?").bind(prow.id).run();
  return json({ ok: true });
}

async function setResult(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "baby") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const data = JSON.parse(row.data);

  if (body.result === null) {
    data.result = null;
    await updateInstanceData(env, row.id, JSON.stringify(data));
    return json({ ok: true });
  }

  const date = parseDayString(body.date, "Pop in the birth date.");
  const weightGrams = parseWeightGrams(body.weightGrams);
  const arrivedAt = String(body.arrivedAt || "").trim().replace(/\s+/g, " ").slice(0, MAX_ARRIVED);
  data.result = { date, weightGrams, arrivedAt };
  await updateInstanceData(env, row.id, JSON.stringify(data));
  await logEvent(env, row.id, "baby", "resulted");
  return json({ ok: true });
}

async function orgRemoveGuess(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "baby") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const gtoken = String(body.gtoken || "");
  if (!gtoken) return json({ error: "That guess wasn't found." }, 404);
  const res = await env.DB.prepare(
    "DELETE FROM participants WHERE instance_id = ? AND token = ?"
  ).bind(row.id, gtoken).run();
  if (!res.meta.changes) return json({ error: "That guess wasn't found." }, 404);
  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "baby") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "baby", "deleted");
  return json({ ok: true });
}

/* ---------- scoring ----------------------------------------- */

/* Combined closeness: one point per day off the actual date, plus one
   point per 100 g off the actual weight (so 100 g ≈ 1 day). Lowest
   wins; ties break to whoever guessed first (smaller id). */
function scored(guesses, result) {
  const at = Date.parse(result.date + "T00:00:00Z");
  return guesses.map((p) => {
    const d = guessData(p);
    const gt = Date.parse(d.date + "T00:00:00Z");
    const dayDiff = Number.isNaN(gt) ? 99999 : Math.round(Math.abs(gt - at) / DAY);
    const gramDiff = Math.abs(d.weightGrams - result.weightGrams);
    return { p, d, dayDiff, gramDiff, score: dayDiff + gramDiff / 100 };
  }).sort((a, b) => a.score - b.score || a.p.id - b.p.id);
}

/* ---------- rendering --------------------------------------- */

const fmtWeight = (g) => `${(g / 1000).toFixed(2)} kg`;
const fmtDay = (s) => (s ? fmtDate(s) : "—");

function chips(data) {
  const bits = [];
  if (data.dueDate) bits.push(`<li class="bb-chip">Due <strong>${esc(data.dueDate)}</strong></li>`);
  return bits.length ? `<ul class="bb-chips">${bits.join("")}</ul>` : "";
}

const noteBlock = (data) =>
  data.note ? `<div class="pixel-note bb-note">${esc(data.note)}</div>` : "";

const scoringNote = `<p class="fine bb-scoring">Closeness is scored simply: one
  point for every day away from the actual date, plus one point for every 100 g
  away from the actual weight. Lowest score wins — so being 200 g out is about
  the same as being two days out. A tie goes to whoever guessed first.</p>`;

function guessCard(d, p, removable) {
  return `
      <li class="bb-guess" data-id="${p.id}">
        <span class="bb-guess-name">${esc(d.guesser)}</span>
        <span class="bb-guess-meta">${esc(fmtDay(d.date))} · ${fmtWeight(d.weightGrams)}</span>${d.message ? `
        <span class="bb-guess-msg">${esc(d.message)}</span>` : ""}${removable ? `
        <button class="btn ghost bb-mini bb-org-remove" type="button" data-token="${esc(p.token)}">Remove</button>` : ""}
      </li>`;
}

function wall(guesses, removable) {
  if (!guesses.length)
    return `<p class="bb-empty">No guesses yet — someone's got to go first.
      Might as well be a bold one.</p>`;
  return `<ul class="bb-wall">${guesses.map((p) => guessCard(guessData(p), p, removable)).join("")}
    </ul>`;
}

function arrivalBanner(result) {
  const timeBit = result.arrivedAt ? ` at ${esc(result.arrivedAt)}` : "";
  return `
  <div class="bb-arrival">
    <span class="bb-arrival-kicker">Bub has landed</span>
    <p class="bb-arrival-line">Arrived <strong>${esc(fmtDay(result.date))}</strong>${timeBit},
    weighing <strong>${fmtWeight(result.weightGrams)}</strong>.</p>
  </div>`;
}

function leaderboard(rows, organiser) {
  const body = rows.map((r, i) => {
    const win = i === 0;
    return `
        <tr class="${win ? "bb-winner-row" : ""}" data-id="${r.p.id}">
          <td class="bb-rank">${i + 1}</td>
          <td class="st-name">${esc(r.d.guesser)}${win ? ` <span class="bb-tag">closest</span>` : ""}</td>
          <td>${esc(fmtDay(r.d.date))}<span class="bb-sub">${fmtWeight(r.d.weightGrams)}</span></td>
          <td>${r.dayDiff} ${r.dayDiff === 1 ? "day" : "days"}<span class="bb-sub">${r.gramDiff} g</span></td>
          <td class="bb-score">${r.score.toFixed(1)}</td>${organiser ? `
          <td class="st-action"><button class="btn bb-mini bb-org-remove" type="button" data-token="${esc(r.p.token)}">Remove</button></td>` : ""}
        </tr>`;
  }).join("");
  return `
  <div class="status-wrap">
    <table class="status-table bb-board">
      <thead><tr><th>#</th><th>Guesser</th><th>Guess</th><th>Off by</th><th>Score</th>${organiser ? "<th></th>" : ""}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

/* ---------- public page ------------------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const guesses = await allGuesses(env, row.id);
  const n = guesses.length;
  const result = data.result || null;

  const beforeBody = `
  <p class="kicker">Guess the arrival — closest wins</p>
  <h1>${esc(data.parents)}</h1>
  <p class="page-sub">${n} ${n === 1 ? "guess" : "guesses"} in${n ? ' · <a href="#bbGuess">add yours ↓</a>' : ""}</p>
  ${chips(data)}
  ${noteBlock(data)}
  ${wall(guesses, false)}

  <section class="bb-add" id="bbGuess">
    <h2>Add your guess</h2>
    <div class="panel">
      <form id="guessForm" novalidate>
        <label class="field">
          <span>Your name</span>
          <input type="text" id="gName" maxlength="${MAX_GUESSER}" placeholder="Sam" autocomplete="name">
        </label>
        <div class="bb-form-row">
          <label class="field">
            <span>Arrival date</span>
            <input type="date" id="gDate">
          </label>
          <label class="field">
            <span>Weight <em>(kg)</em></span>
            <input type="number" id="gWeight" step="0.01" min="0.5" max="7" inputmode="decimal" placeholder="3.4">
          </label>
        </div>
        <label class="field">
          <span>Message <em>(optional)</em></span>
          <input type="text" id="gMsg" maxlength="${MAX_MESSAGE}" placeholder="A big spring baby — calling it now.">
        </label>
        <p class="form-error" id="gErr" hidden></p>
        <button class="btn primary" id="gBtn" type="submit">Lock in my guess →</button>
      </form>
    </div>
    <p class="fine">No account — a name and a guess is all it takes. Weight's in
    kilograms (type "3.4"). This browser remembers your guesses, so you can take
    one back.</p>
    ${scoringNote}
  </section>`;

  const afterBody = result ? `
  <p class="kicker">The pool's decided</p>
  <h1>${esc(data.parents)}</h1>
  ${arrivalBanner(result)}
  ${chips(data)}
  ${noteBlock(data)}
  <h2>Leaderboard</h2>
  <p class="page-sub">${n} ${n === 1 ? "guess" : "guesses"} · closest to the mark wins</p>
  ${leaderboard(scored(guesses, result), false)}
  ${scoringNote}` : "";

  const body = `
<main class="wrap page">
  ${result ? afterBody : beforeBody}
  <footer class="page-foot">
    <p class="fine">No accounts here — this browser remembers which guesses are
    yours. On someone else's phone? Just ask the organiser to shift things.</p>
    <p><a class="quiet-link" href="/via/baby">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var hasResult = ${result ? "true" : "false"};
  var KEY = "bbb:baby:" + slug;

  function mine() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveMine(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function rowFor(id) {
    if (!/^\\d+$/.test(String(id))) return null;
    return document.querySelector('[data-id="' + id + '"]');
  }

  /* ---- your own guesses: badge (+ remove, while guessing's open) ---- */
  var list = mine().filter(function (m) { return rowFor(m.id); });
  saveMine(list);
  list.forEach(function (m) {
    var el = rowFor(m.id);
    if (!el) return;
    var badge = document.createElement("span");
    badge.className = "bb-you";
    badge.textContent = "yours";
    var nameCell = el.querySelector(".st-name");
    if (nameCell) { nameCell.appendChild(document.createTextNode(" ")); nameCell.appendChild(badge); }
    else { el.insertBefore(badge, el.firstChild); }

    if (!hasResult) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost bb-mini";
      btn.textContent = "Remove";
      btn.addEventListener("click", function () {
        if (!confirm("Take your guess out of the pool? This can't be undone.")) return;
        fetch("/api/baby/g/" + m.token + "/remove", { method: "POST" }).then(function (r) {
          if (!r.ok && r.status !== 404)
            return r.json().catch(function () { return {}; }).then(function (d) {
              throw new Error(d.error || "That didn't work — try again.");
            });
          saveMine(mine().filter(function (x) { return x.id !== m.id; }));
          location.reload();
        }).catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
      });
      el.appendChild(btn);
    }
  });

  /* ---- adding a guess ---- */
  var form = document.getElementById("guessForm");
  if (form) {
    var gBtn = document.getElementById("gBtn");
    var err = document.getElementById("gErr");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var name = document.getElementById("gName").value.trim();
      var date = document.getElementById("gDate").value;
      var kg = parseFloat(document.getElementById("gWeight").value);
      var msg = document.getElementById("gMsg").value.trim();
      if (!name) return fail("Your name first — so we know whose guess it is.");
      if (!date) return fail("Pick a date for your guess.");
      if (!(kg >= 0.5 && kg <= 7)) return fail("Give a weight between 0.5 and 7 kg.");
      var weightGrams = Math.round(kg * 1000);

      gBtn.disabled = true;
      gBtn.textContent = "Locking it in…";
      fetch("/api/baby/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug, guesser: name, date: date, weightGrams: weightGrams, message: msg }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(d.error || "Server said " + r.status + ".");
          var l = mine();
          l.push({ id: d.id, token: d.token });
          saveMine(l);
          location.reload();
        });
      }).catch(function (ex) { fail((ex && ex.message) || "That didn't work — try again."); });

      function fail(m2) {
        err.textContent = m2;
        err.hidden = false;
        gBtn.disabled = false;
        gBtn.textContent = "Lock in my guess →";
        return false;
      }
    });
  }
})();
</script>`;
  return html(pageShell({ title: `${data.parents} — baby guess pool`, body, shareType: "baby", shareSlug: row.slug }));
}

/* ---------- organiser page ---------------------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const guesses = await allGuesses(env, row.id);
  const n = guesses.length;
  const result = data.result || null;
  const shareUrl = `${origin}/s/${row.slug}`;
  const recordBtnLabel = result ? "Update the result" : "Record it & reveal the winner →";

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with everyone else.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(data.parents)}</h1>
  <p class="page-sub">${n} ${n === 1 ? "guess" : "guesses"} in${result ? " · arrival recorded" : ""}</p>
  ${chips(data)}
  ${noteBlock(data)}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the group</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("👶 Baby pool for " + data.parents + " — guess the arrival date and weight, closest wins: " + shareUrl)}

  <section class="bb-record">
    <h2>${result ? "The arrival" : "Record the arrival"}</h2>
    ${result ? arrivalBanner(result) : ""}
    <div class="panel">
      <form id="resultForm" novalidate>
        <div class="bb-form-row">
          <label class="field">
            <span>Birth date</span>
            <input type="date" id="rDate" value="${esc(result ? result.date : "")}">
          </label>
          <label class="field">
            <span>Weight <em>(kg)</em></span>
            <input type="number" id="rWeight" step="0.01" min="0.5" max="7" inputmode="decimal"
              placeholder="3.4" value="${result ? (result.weightGrams / 1000).toFixed(2) : ""}">
          </label>
        </div>
        <label class="field">
          <span>Time of arrival <em>(optional)</em></span>
          <input type="text" id="rTime" maxlength="${MAX_ARRIVED}" placeholder="2:14am"
            value="${esc(result ? result.arrivedAt : "")}">
        </label>
        <p class="form-error" id="rErr" hidden></p>
        <div class="bb-record-actions">
          <button class="btn primary" id="rBtn" type="submit">${result ? "Update the result" : "Record it & reveal the winner →"}</button>
          ${result ? `<button class="btn ghost" id="clearBtn" type="button">Reopen guessing</button>` : ""}
        </div>
      </form>
    </div>
    <p class="fine">Recording the arrival closes guessing and reveals the
    leaderboard to everyone with the link. Get it wrong? Reopen guessing to
    clear it and try again.</p>
    ${scoringNote}
  </section>

  ${result
    ? `<h2>Leaderboard</h2>${leaderboard(scored(guesses, result), true)}`
    : `<h2>Guesses so far</h2>${wall(guesses, true)}`}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared pool</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this pool</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Removing a guess is permanent — maybe give the guesser a
    heads-up first. To add a guess yourself, use the shared link like everyone
    else. Deleting the whole pool is permanent too — the shared link stops
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

  function post(path, payload) {
    return fetch("/api/baby/" + token + "/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) {
        throw new Error(d.error || "That didn't work — try again.");
      });
    });
  }

  var rForm = document.getElementById("resultForm");
  var rBtn = document.getElementById("rBtn");
  var rErr = document.getElementById("rErr");
  rForm.addEventListener("submit", function (e) {
    e.preventDefault();
    rErr.hidden = true;
    var date = document.getElementById("rDate").value;
    var kg = parseFloat(document.getElementById("rWeight").value);
    var time = document.getElementById("rTime").value.trim();
    if (!date) return rfail("Pop in the birth date.");
    if (!(kg >= 0.5 && kg <= 7)) return rfail("Weight should be between 0.5 and 7 kg.");
    if (!confirm("Record the arrival? This closes guessing and shows everyone the leaderboard.")) return;
    rBtn.disabled = true;
    rBtn.textContent = "Saving…";
    post("result", { date: date, weightGrams: Math.round(kg * 1000), arrivedAt: time })
      .then(function () { location.reload(); })
      .catch(function (ex) { rfail((ex && ex.message) || "That didn't work — try again."); });
  });
  function rfail(m) {
    rErr.textContent = m;
    rErr.hidden = false;
    rBtn.disabled = false;
    rBtn.textContent = ${JSON.stringify(recordBtnLabel)};
    return false;
  }

  var clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!confirm("Reopen guessing? This clears the recorded result and hides the leaderboard until you record it again.")) return;
      post("result", { result: null }).then(function () { location.reload(); })
        .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  }

  document.querySelectorAll(".bb-org-remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!confirm("Remove this guess? This can't be undone.")) return;
      post("removeGuess", { gtoken: btn.getAttribute("data-token") })
        .then(function () { location.reload(); })
        .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  });

  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this pool for good? Every guess goes with it and the shared link stops working.")) return;
    post("delete", {}).then(function () { location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  });
})();
</script>`;
  return html(pageShell({ title: `${data.parents} — baby pool (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "baby",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/baby")) return null;
    if (p === "/api/baby") return create(request, env);
    if (p === "/api/baby/guess") return guess(request, env);
    let m;
    if ((m = p.match(/^\/api\/baby\/g\/([a-z0-9]+)\/remove$/)))
      return guesserRemove(m[1], env);
    if ((m = p.match(/^\/api\/baby\/([a-z0-9]+)\/(result|removeGuess|delete)$/))) {
      if (m[2] === "result") return setResult(m[1], request, env);
      if (m[2] === "removeGuess") return orgRemoveGuess(m[1], request, env);
      return orgDelete(m[1], env);
    }
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
