/* ============================================================
   Group Vote — the site's voting primitive. A dead-simple poll
   for a group decision: the next book, a baby name, where to eat,
   which date works.

   Each vote is one row in the participants table (name = '' so
   two voters may share a display name; the display name and the
   chosen option ids live in the data JSON). The voter's row token
   is their edit key — kept in this-browser localStorage so they
   can change their vote. The tally is computed server-side by
   counting choices across the rows.

   Privacy, decided per field:
     - The PUBLIC /s/ page shows only the aggregate bars + a total
       voter count. It never renders who voted for what.
     - The ORGANISER /e/ page (gated by the 26-char edit token) is
       the intended audience for the breakdown, so it lists each
       voter's name and picks.
   The copy on the ballot says so plainly.

   One-vote-per-person is soft (localStorage only — there are no
   accounts). That's honest in the copy: this is for friendly group
   decisions, not elections.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, getParticipant, getInstanceById,
  createInstance, updateInstanceData, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_QUESTION = 140;
const MAX_OPTION = 80;
const MAX_NAME = 40;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 30;
const MAX_VOTERS = 2000;

const NOUNS = ["tally", "ballot", "quorum", "showhands", "verdict",
  "uptake", "motion", "aye", "shortlist", "pick"];

const HOME = "/group-vote/";

/* Safe JSON for inlining into a <script> — stops a stray "</script>"
   (or U+2028/9) inside user text from breaking out. Values here are
   only ever slug/mode/booleans, but we route everything through it. */
const sj = (v) => JSON.stringify(v)
  .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
  .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/* Option ids are short randoms so they stay stable when options are
   removed (removing one simply drops it from the list; the tally
   ignores any choice id that no longer maps to an option). */
const optId = () => randomString(6);

const allVotes = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT * FROM participants WHERE instance_id = ? ORDER BY id"
  ).bind(instanceId).all()).results;

function computeTally(options, parts) {
  const counts = {};
  for (const o of options) counts[o.id] = 0;
  let voters = 0;
  for (const p of parts) {
    voters++;
    let ch = [];
    try { const d = JSON.parse(p.data); ch = Array.isArray(d.choices) ? d.choices : []; }
    catch { ch = []; }
    const seen = new Set();
    for (const c of ch) {
      if (Object.prototype.hasOwnProperty.call(counts, c) && !seen.has(c)) {
        counts[c]++;
        seen.add(c);
      }
    }
  }
  return { voters, counts };
}

/* ---------- input ------------------------------------------- */

function cleanOptions(raw, usedIds = new Set()) {
  const out = [];
  const seen = new Set();
  for (const s of (Array.isArray(raw) ? raw : []).slice(0, 200)) {
    const text = String(s == null ? "" : (s.text != null ? s.text : s))
      .trim().replace(/\s+/g, " ").slice(0, MAX_OPTION);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue; // silently drop duplicates
    seen.add(key);
    let id;
    do { id = optId(); } while (usedIds.has(id) || out.some((o) => o.id === id));
    out.push({ id, text });
  }
  return out;
}

function parseCreate(body) {
  const question = String(body.question || "").trim().replace(/\s+/g, " ").slice(0, MAX_QUESTION);
  if (!question) throw badInput("Add a question — what's the group deciding?");
  const options = cleanOptions(body.options);
  if (options.length < MIN_OPTIONS)
    throw badInput("Give people at least two options to choose between.");
  if (options.length > MAX_OPTIONS)
    throw badInput("Thirty options is the limit — trim the list a bit.");
  const mode = body.mode === "multi" ? "multi" : "single";
  const allowSuggestions = !!body.allowSuggestions;
  return { question, options, mode, allowSuggestions };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { question, options, mode, allowSuggestions } =
    parseCreate(await request.json().catch(() => ({})));
  const data = JSON.stringify({ question, options, mode, allowSuggestions, closed: false });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "poll", title: question, data, nouns: NOUNS,
  });
  await logEvent(env, id, "poll", "created");
  return json({ slug, editToken }, 201);
}

function sanitiseChoices(raw, validIds) {
  const arr = Array.isArray(raw) ? raw.map((c) => String(c)) : [];
  return [...new Set(arr.filter((c) => validIds.has(c)))];
}


/* Optimistic read-modify-write on instances.data. The whole poll
   config lives in one JSON column, so a naive read-then-write lets a
   voter's suggestion clobber an organiser's "close" (and vice versa).
   This re-reads inside a guarded UPDATE and retries on a concurrent
   writer — same pattern as bracket.js. `mutate(data)` returns the new
   data object, or throws an Error (with optional .status) to abort. */
async function mutateData(env, id, mutate) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await env.DB.prepare(
      "SELECT data, updated_at FROM instances WHERE id = ?"
    ).bind(id).first();
    if (!cur) { const e = new Error("not found"); e.status = 404; throw e; }
    const data = JSON.parse(cur.data);
    const next = mutate(data); // may throw a domain error to abort
    const res = await env.DB.prepare(
      "UPDATE instances SET data = ?, updated_at = ? WHERE id = ? AND updated_at = ?"
    ).bind(JSON.stringify(next), new Date().toISOString(), id, cur.updated_at).run();
    if (res.meta.changes) return next;
  }
  const e = new Error("Too many people editing this poll at once — try again in a moment.");
  e.status = 409;
  throw e;
}

async function vote(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "poll") return json({ error: "not found" }, 404);

  let data = JSON.parse(row.data);
  if (data.closed) return json({ error: "Voting's closed on this one." }, 409);

  let choices = sanitiseChoices(body.choices, new Set(data.options.map((o) => o.id)));

  // Voter-suggested option: match an existing one case-insensitively,
  // else append it atomically (mutateData re-reads + CAS-retries, so a
  // suggestion can never clobber a concurrent close or another suggestion).
  let addedOptionId = null;
  if (data.allowSuggestions) {
    const sug = String(body.suggestion || "").trim().replace(/\s+/g, " ").slice(0, MAX_OPTION);
    if (sug) {
      const existing = data.options.find((o) => o.text.toLowerCase() === sug.toLowerCase());
      if (existing) {
        if (!choices.includes(existing.id)) choices.push(existing.id);
      } else {
        const nid = optId();
        data = await mutateData(env, row.id, (d) => {
          if (d.closed) { const e = new Error("Voting's closed on this one."); e.status = 409; throw e; }
          if (d.options.some((o) => o.text.toLowerCase() === sug.toLowerCase())) return d; // someone added it first
          if (d.options.length >= MAX_OPTIONS) { const e = new Error("This poll's hit the thirty-option limit — vote for one that's already there."); e.status = 409; throw e; }
          return { ...d, options: d.options.concat([{ id: nid, text: sug }]) };
        });
        // resolve the id actually stored (a racing duplicate may have won)
        const stored = data.options.find((o) => o.text.toLowerCase() === sug.toLowerCase());
        addedOptionId = stored ? stored.id : nid;
        choices.push(addedOptionId);
      }
    }
  }

  // Single-choice poll: a fresh suggestion IS the ballot; otherwise keep the first pick.
  if (data.mode !== "multi") choices = addedOptionId ? [addedOptionId] : choices.slice(0, 1);
  if (!choices.length) throw badInput("Pick an option before you vote.");

  // Cap the ballot box, like every other participants-based tool.
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM participants WHERE instance_id = ?"
  ).bind(row.id).first();
  if (((count && count.n) || 0) >= MAX_VOTERS)
    return json({ error: "This poll's had two thousand votes — that's plenty for a group decision." }, 409);

  const voterName = String(body.voterName || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  const token = randomString(22);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, claimed_at, created_at)
     VALUES (?, ?, '', ?, ?, ?)`
  ).bind(row.id, token, JSON.stringify({ voterName, choices }), now, now).run();

  const parts = await allVotes(env, row.id);
  return json({ token, choices, addedOptionId, tally: computeTally(data.options, parts) }, 201);
}

async function changeVote(vtoken, request, env) {
  const prow = await getParticipant(env, vtoken);
  const row = prow && await getInstanceById(env, prow.instance_id);
  if (!row || row.tool_type !== "poll")
    return json({ error: "That vote wasn't found — it may have been reset. Vote again." }, 404);

  const data = JSON.parse(row.data);
  if (data.closed) return json({ error: "Voting's closed — you can't change your vote now." }, 409);

  const validIds = new Set(data.options.map((o) => o.id));
  const body = await request.json().catch(() => ({}));
  let choices = sanitiseChoices(body.choices, validIds);
  if (data.mode !== "multi") choices = choices.slice(0, 1);
  if (!choices.length) throw badInput("Pick an option to change your vote to.");

  const pdata = JSON.parse(prow.data);
  await env.DB.prepare("UPDATE participants SET data = ? WHERE id = ?")
    .bind(JSON.stringify({ ...pdata, choices }), prow.id).run();

  const parts = await allVotes(env, row.id);
  return json({ ok: true, choices, tally: computeTally(data.options, parts) });
}

async function setClosed(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "poll") return json({ error: "not found" }, 404);
  const body = await request.json().catch(() => ({}));
  const closed = !!body.closed;
  await mutateData(env, row.id, (d) => ({ ...d, closed }));
  return json({ ok: true, closed });
}

async function addOption(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "poll") return json({ error: "not found" }, 404);
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim().replace(/\s+/g, " ").slice(0, MAX_OPTION);
  if (!text) throw badInput("Type the option first.");
  await mutateData(env, row.id, (d) => {
    if (d.options.some((o) => o.text.toLowerCase() === text.toLowerCase())) { const e = new Error("That option's already on the list."); e.status = 409; throw e; }
    if (d.options.length >= MAX_OPTIONS) { const e = new Error("Thirty options is the limit."); e.status = 409; throw e; }
    return { ...d, options: d.options.concat([{ id: optId(), text }]) };
  });
  return json({ ok: true });
}

async function removeOption(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "poll") return json({ error: "not found" }, 404);
  const body = await request.json().catch(() => ({}));
  const optionId = String(body.optionId || "");
  await mutateData(env, row.id, (d) => {
    if (d.options.length <= MIN_OPTIONS) { const e = new Error("A poll needs at least two options — add another before removing this one."); e.status = 409; throw e; }
    const options = d.options.filter((o) => o.id !== optionId);
    if (options.length === d.options.length) { const e = new Error("That option wasn't found."); e.status = 404; throw e; }
    return { ...d, options };
  });
  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "poll") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "poll", "deleted");
  return json({ ok: true });
}

/* ---------- rendering helpers ------------------------------- */

const voteWord = (n) => `${n} ${n === 1 ? "vote" : "votes"}`;

function modeLabel(mode) {
  return mode === "multi" ? "Choose any that work" : "Choose one";
}

function bars(data, tally) {
  const max = Math.max(0, ...data.options.map((o) => tally.counts[o.id] || 0));
  const total = tally.voters;
  return `<ul class="poll-bars">${data.options.map((o) => {
    const n = tally.counts[o.id] || 0;
    const pct = max > 0 ? Math.round((n / max) * 100) : 0;
    const share = total > 0 ? Math.round((n / total) * 100) : 0;
    const isLeader = max > 0 && n === max;
    return `
    <li class="poll-bar${isLeader ? " is-leader" : ""}" data-optid="${esc(o.id)}">
      <div class="poll-bar-head">
        <span class="poll-bar-label">${esc(o.text)}</span>
        <span class="poll-bar-count">${n} <span class="poll-bar-unit">${n === 1 ? "vote" : "votes"}</span> <span class="poll-bar-pct">· ${share}%</span></span>
      </div>
      <div class="poll-bar-track"><i style="width:${pct}%"></i></div>
    </li>`;
  }).join("")}
  </ul>`;
}

function winnerLine(data, tally) {
  const max = Math.max(0, ...data.options.map((o) => tally.counts[o.id] || 0));
  if (max === 0) return "Voting closed — no votes came in.";
  const leaders = data.options.filter((o) => (tally.counts[o.id] || 0) === max);
  if (leaders.length === 1)
    return `Voting closed — winner: <strong>${esc(leaders[0].text)}</strong>`;
  return `Voting closed — it's a tie: <strong>${leaders.map((o) => esc(o.text)).join(" &amp; ")}</strong>`;
}

/* ---------- public page (/s/:slug) -------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const parts = await allVotes(env, row.id);
  const tally = computeTally(data.options, parts);
  const closed = !!data.closed;
  const inputType = data.mode === "multi" ? "checkbox" : "radio";

  const optionsHtml = data.options.map((o) => `
      <li class="poll-opt">
        <label class="poll-opt-label" data-optid="${esc(o.id)}">
          <input type="${inputType}" name="choice" value="${esc(o.id)}">
          <span class="poll-opt-text">${esc(o.text)}</span>
        </label>
      </li>`).join("");

  const suggestField = data.allowSuggestions ? `
        <div class="poll-suggest">
          <label class="field">
            <span>Add your own option <em>(optional)</em></span>
            <input type="text" id="suggestion" maxlength="${MAX_OPTION}"
              placeholder="Something that isn't listed" autocomplete="off">
          </label>
        </div>` : "";

  const ballot = closed ? "" : `
  <form id="ballot" class="poll-ballot panel" novalidate>
    <fieldset class="poll-fieldset">
      <legend class="poll-legend">${esc(data.question)}</legend>
      <ul class="poll-opts">${optionsHtml}</ul>
      ${suggestField}
    </fieldset>
    <label class="field poll-name">
      <span>Your name <em>(optional)</em></span>
      <input type="text" id="voterName" maxlength="${MAX_NAME}" autocomplete="name"
        placeholder="So the organiser knows who's chimed in">
    </label>
    <p class="form-error" id="ballotErr" hidden></p>
    <button class="btn primary big" id="voteBtn" type="submit">Cast my vote →</button>
  </form>

  <div class="poll-voted" id="votedBox" hidden>
    <p class="poll-voted-line">You've voted<span id="votedPicks"></span>.</p>
    <div class="poll-voted-actions">
      <button class="btn" id="changeBtn" type="button">Change my vote</button>
    </div>
    <p class="fine">Not your vote, or it's gone missing?
      <a href="#" id="pollRejoin">Vote fresh →</a></p>
  </div>

  <p class="poll-peek" id="peekWrap"><button class="btn ghost" id="peekBtn" type="button">Peek at the results without voting</button></p>`;

  const resultsHead = closed ? "Final results" : "Results so far";
  const results = `
  <section class="poll-results" id="results"${closed ? "" : " hidden"}>
    <h2>${resultsHead}</h2>
    ${bars(data, tally)}
    <p class="fine">${voteWord(tally.voters)} in. One vote per person is on the
    honour system — this browser remembers your vote, but there are no accounts,
    so it's for friendly group decisions, not elections.</p>
  </section>`;

  const body = `
<main class="wrap page">
  <p class="kicker">Group vote</p>
  <h1>${esc(data.question)}</h1>
  <p class="page-sub">${voteWord(tally.voters)} · ${esc(modeLabel(data.mode))}${closed ? " · closed" : ""}</p>

  ${closed ? `<div class="poll-closed-banner pixel-note">${winnerLine(data, tally)}</div>` : ""}
  ${ballot}
  ${results}

  <footer class="page-foot">
    <p class="fine">Your name and pick are visible to the poll's organiser;
    everyone else sees only the running totals.</p>
    <p><a class="quiet-link" href="/via/poll">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${sj(row.slug)};
  var mode = ${sj(data.mode)};
  var KEY = "bbb:poll:" + slug;
  var form = document.getElementById("ballot");
  if (!form) return; // closed poll — results only, nothing interactive

  var results = document.getElementById("results");
  var votedBox = document.getElementById("votedBox");
  var peekWrap = document.getElementById("peekWrap");
  var err = document.getElementById("ballotErr");
  var voteBtn = document.getElementById("voteBtn");
  var editing = false;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function clearMine() { try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
  function sel(id) { return String(id).replace(/["\\\\\\]]/g, "\\\\$&"); } // ids are alnum, belt & braces

  var inputs = form.querySelectorAll('input[name="choice"]');
  function selected() {
    var out = [];
    inputs.forEach(function (i) { if (i.checked) out.push(i.value); });
    return out;
  }
  function setChecked(ids) {
    var set = {};
    (ids || []).forEach(function (id) { set[id] = 1; });
    inputs.forEach(function (i) { i.checked = !!set[i.value]; });
  }
  function labelText(id) {
    var el = document.querySelector('.poll-opt-label[data-optid="' + sel(id) + '"] .poll-opt-text');
    return el ? el.textContent : null;
  }

  var mine = load();

  function showVoted() {
    form.hidden = true;
    if (peekWrap) peekWrap.hidden = true;
    votedBox.hidden = false;
    results.hidden = false;
    var picks = (mine && mine.choices) || [];
    var names = picks.map(labelText).filter(Boolean);
    var span = document.getElementById("votedPicks");
    if (span && names.length) span.textContent = " for " + names.join(", ");
    picks.forEach(function (id) {
      var bar = document.querySelector('.poll-bar[data-optid="' + sel(id) + '"]');
      if (bar) bar.classList.add("is-mine");
    });
  }

  if (mine && mine.token) showVoted();

  var peekBtn = document.getElementById("peekBtn");
  if (peekBtn) peekBtn.addEventListener("click", function () {
    results.hidden = false;
    peekWrap.hidden = true;
  });

  var changeBtn = document.getElementById("changeBtn");
  if (changeBtn) changeBtn.addEventListener("click", function () {
    editing = true;
    votedBox.hidden = true;
    form.hidden = false;
    setChecked((mine && mine.choices) || []);
    var sug = document.getElementById("suggestion");
    if (sug) { var wrap = sug.closest(".poll-suggest"); if (wrap) wrap.hidden = true; }
    voteBtn.textContent = "Save my change →";
    form.scrollIntoView({ block: "center" });
  });

  var rejoin = document.getElementById("pollRejoin");
  if (rejoin) rejoin.addEventListener("click", function (e) {
    e.preventDefault();
    clearMine();
    location.reload();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.hidden = true;
    var choices = selected();
    if (mode !== "multi" && choices.length > 1) choices = [choices[0]];
    var sugEl = document.getElementById("suggestion");
    var suggestion = (!editing && sugEl) ? sugEl.value.trim() : "";
    if (!choices.length && !suggestion)
      return fail(mode === "multi" ? "Tick at least one option." : "Pick an option first.");

    voteBtn.disabled = true;
    voteBtn.textContent = "Saving…";
    var url, payload;
    if (editing && mine && mine.token) {
      url = "/api/poll/v/" + mine.token;
      payload = { choices: choices };
    } else {
      url = "/api/poll/vote";
      var nameEl = document.getElementById("voterName");
      payload = { slug: slug, choices: choices, voterName: nameEl ? nameEl.value.trim() : "", suggestion: suggestion };
    }
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "Server said " + r.status + ".");
        var tok = (editing && mine && mine.token) ? mine.token : d.token;
        save({ token: tok, choices: (d.choices || choices) });
        location.reload();
      });
    }).catch(function (ex) {
      fail((ex && ex.message) || "That didn't work — try again.");
    });

    function fail(m) {
      err.textContent = m;
      err.hidden = false;
      voteBtn.disabled = false;
      voteBtn.textContent = editing ? "Save my change →" : "Cast my vote →";
      return false;
    }
  });
})();
</script>`;
  return html(pageShell({ title: data.question || "Group vote", body, shareType: "poll", shareSlug: row.slug }));
}

/* ---------- organiser page (/e/:token) ---------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const parts = await allVotes(env, row.id);
  const tally = computeTally(data.options, parts);
  const closed = !!data.closed;
  const shareUrl = `${origin}/s/${row.slug}`;
  const optById = Object.fromEntries(data.options.map((o) => [o.id, o.text]));

  const manageHtml = data.options.map((o) => `
      <li class="poll-manage-item" data-optid="${esc(o.id)}">
        <span class="poll-manage-text">${esc(o.text)}
          <span class="poll-manage-votes">— ${voteWord(tally.counts[o.id] || 0)}</span></span>
        <button class="btn ghost poll-mini poll-remove" type="button" data-optid="${esc(o.id)}">Remove</button>
      </li>`).join("");

  // Per-voter breakdown — organiser only, this is its intended audience.
  const voterRows = parts.map((p) => {
    let pd = {};
    try { pd = JSON.parse(p.data); } catch { /* fine */ }
    const name = String(pd.voterName || "").trim();
    const picks = (Array.isArray(pd.choices) ? pd.choices : [])
      .map((id) => optById[id]).filter(Boolean);
    return `
      <tr>
        <td class="st-name">${name ? esc(name) : '<span class="st-no">Anonymous</span>'}</td>
        <td>${picks.length ? picks.map((t) => esc(t)).join(", ") : '<span class="st-no">—</span>'}</td>
      </tr>`;
  }).join("");

  const breakdown = parts.length ? `
  <div class="status-wrap">
    <table class="status-table">
      <thead><tr><th>Voter</th><th>Picked</th></tr></thead>
      <tbody>${voterRows}</tbody>
    </table>
  </div>` : `<p class="poll-empty">No votes yet — this fills in as people vote.</p>`;

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with everyone who gets a vote.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(data.question)}</h1>
  <p class="page-sub">${voteWord(tally.voters)} · ${esc(modeLabel(data.mode))}${closed ? " · closed" : " · open"}</p>

  ${closed ? `<div class="poll-closed-banner pixel-note">${winnerLine(data, tally)}</div>` : ""}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link — everyone taps it and votes</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🗳 Quick group vote — " + data.question + " — tap to pick: " + shareUrl)}

  <h2>${closed ? "Final results" : "Results so far"}</h2>
  ${bars(data, tally)}

  <div class="poll-toggle-row">
    <button class="btn primary" id="closeBtn" type="button" data-closed="${closed ? "1" : "0"}">${closed ? "Reopen voting" : "Close voting"}</button>
  </div>
  <p class="fine">Closing voting freezes the tally and flips the shared link to
  results-only — nobody can vote or change their vote. You can reopen it if you
  jumped the gun.</p>

  <h2>Who voted</h2>
  <p class="lede">Only you can see this breakdown. Everyone on the shared link
  sees just the totals above.</p>
  ${breakdown}

  <h2>Options</h2>
  <p class="lede">Add an option, or remove one. Removing an option deletes its
  votes for good — the count doesn't move to anything else.</p>
  <ul class="poll-manage">${manageHtml}</ul>
  <div class="poll-addopt">
    <input type="text" id="newOpt" maxlength="${MAX_OPTION}" placeholder="Add another option" autocomplete="off">
    <button class="btn" id="addOptBtn" type="button">Add option</button>
  </div>
  <p class="form-error" id="orgErr" hidden></p>

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared vote</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this poll</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">One vote per person runs on the honour system — there are no
    accounts, so a keen voter on two devices can vote twice. Fine for a friendly
    decision; not a ballot box. Deleting is permanent: every link stops working
    immediately.</p>
  </footer>
</main>

<script>
(function () {
  var token = ${sj(row.edit_token)};
  var orgErr = document.getElementById("orgErr");

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
    orgErr.hidden = true;
    fetch("/api/poll/" + token + "/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); });
      after();
    }).catch(function (e) {
      orgErr.textContent = (e && e.message) || "That didn't work — try again.";
      orgErr.hidden = false;
    });
  }

  var closeBtn = document.getElementById("closeBtn");
  closeBtn.addEventListener("click", function () {
    var isClosed = this.getAttribute("data-closed") === "1";
    if (isClosed) {
      post("close", { closed: false }, "Reopen voting? People can vote and change votes again.", function () { location.reload(); });
    } else {
      post("close", { closed: true }, "Close voting? The tally freezes and nobody can vote or change their vote.", function () { location.reload(); });
    }
  });

  document.querySelectorAll(".poll-remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      post("removeOption", { optionId: btn.getAttribute("data-optid") },
        "Remove this option? Any votes for it are deleted — this can't be undone.",
        function () { location.reload(); });
    });
  });

  var addBtn = document.getElementById("addOptBtn");
  var newOpt = document.getElementById("newOpt");
  function addOption() {
    var text = newOpt.value.trim();
    if (!text) { orgErr.textContent = "Type the option first."; orgErr.hidden = false; newOpt.focus(); return; }
    post("addOption", { text: text }, null, function () { location.reload(); });
  }
  addBtn.addEventListener("click", addOption);
  newOpt.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addOption(); } });

  document.getElementById("deleteBtn").addEventListener("click", function () {
    post("delete", null, "Delete this poll for good? Every vote goes with it and the shared link stops working.",
      function () { location.href = ${sj(HOME)}; });
  });
})();
</script>`;
  return html(pageShell({ title: `${data.question || "Group vote"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "poll",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/poll")) return null;
    if (p === "/api/poll") return create(request, env);
    if (p === "/api/poll/vote") return vote(request, env);
    let m;
    if ((m = p.match(/^\/api\/poll\/v\/([a-z0-9]+)$/)))
      return changeVote(m[1], request, env);
    if ((m = p.match(/^\/api\/poll\/([a-z0-9]+)\/(close|addOption|removeOption|delete)$/)))
      return m[2] === "close" ? setClosed(m[1], request, env)
        : m[2] === "addOption" ? addOption(m[1], request, env)
        : m[2] === "removeOption" ? removeOption(m[1], request, env)
        : orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
