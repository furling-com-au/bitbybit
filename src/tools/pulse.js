/* ============================================================
   Weekly Pulse — one standing link, one tap a week.

   Everyone taps 1-5 for how the week went and optionally adds a
   few words. The team sees the average, the spread, a trend over
   recent weeks, and a word cloud of what people wrote. Nobody sees
   who said what, including whoever set it up.

   THE ANONYMITY IS STRUCTURAL, NOT PROMISED. Every competitor in
   this space is seat-based with SSO, so "anonymous" means "we have
   your identity and have chosen not to show it". Here there is no
   account, no email, no cookie and no analytics on /s/ or /e/ —
   there is nothing to identify anyone with. That is the product.
   Two rules protect it and neither is negotiable:

     1. SMALL WEEKS ARE SUPPRESSED. Under MIN_SHOW responses a week
        shows a count and nothing else. On a team of six, three
        responses and one visible "2" identifies the dissenter.
     2. A COMMENT IS NEVER A ROW OF ITS OWN. Each week's comments
        live together in one array that is reshuffled on every
        write, so there is no per-person comment record and no
        insertion order to line up against the scores. The first
        version got this wrong — see the storage section below.
     3. A WORD SAID ONCE IS NOT SHOWN. The cloud needs two people,
        with no small-team exception, because one person's unusual
        word is a fingerprint.

   Same standing-link shape as Question of the Day: one link the
   team bookmarks, bucketed by week instead of by day, so it never
   needs re-creating. A week is Monday-anchored in Australia/Sydney.
   ============================================================ */
import {
  esc, json, html, randomString, shuffle, badInput, pageShell,
  getBySlug, getByToken, createInstance, deleteInstance, logEvent, shareNudge, ownCta, cardPreview,
} from "../lib.js";

const MAX_TEAM = 60;
const MAX_QUESTION = 120;
const MAX_COMMENT = 140;
const MAX_ROWS = 4000;        // hard cap on stored rows per instance
const PRUNE_AT = 3000;
const PRUNE_TARGET = 2400;   // shed down to here, so one prune buys many writes
const KEEP_WEEKS = 26;        // half a year of history is plenty

/* Below this many responses in a week, results are withheld. Four is
   the smallest number where one visible outlier is not automatically
   attributable on a small team. */
const MIN_SHOW = 4;

const TREND_WEEKS = 8;
const TZ = "Australia/Sydney";

const NOUNS = ["pulse", "check", "weekly", "tempo", "gauge", "signal",
  "barometer", "readout", "dial", "meter"];

const HOME = "/weekly-pulse/";

/* ---------- weeks -------------------------------------------- */

let _fmt = null;
function dayFormatter() {
  if (!_fmt) {
    _fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    });
  }
  return _fmt;
}

/** Today in TZ as "YYYY-MM-DD". */
function todayISO(now = new Date()) {
  const parts = {};
  for (const p of dayFormatter().formatToParts(now)) parts[p.type] = p.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const dayIndex = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
};

/* Monday-anchored week number. 1970-01-01 was a Thursday, so shifting
   by 4 puts Monday at the start of the bucket. */
const weekOf = (iso) => {
  const d = dayIndex(iso);
  return d === null ? null : Math.floor((d + 4) / 7);
};

const currentWeek = () => weekOf(todayISO());

/** Monday's date for a week number, as "YYYY-MM-DD". */
function mondayOf(week) {
  const days = week * 7 - 4;
  const d = new Date(days * 86400000);
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mo}-${dd}`;
}

const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function weekLabel(week) {
  const iso = mondayOf(week);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${+m[3]} ${MO[+m[2] - 1]}` : iso;
}

/* ---------- storage ------------------------------------------ */

/* Scores live in the participants table, one row each, with an empty
   name so the partial unique index on (instance_id, name) never
   applies.

   COMMENTS DO NOT GET THEIR OWN ROW, and that is the whole point.
   The first version of this stored a score row and a comment row per
   response. They came from the same DB.batch(), so they got
   consecutive AUTOINCREMENT ids — which meant a single SELECT
   relinked every comment to the score beside it. "Stored separately"
   achieved nothing, because the ordering WAS the link.

   Now every week has ONE row holding all of that week's comments in
   an array, reshuffled on every write. There is no per-person comment
   row to line up against anything, and no insertion order to read
   off. The row is keyed by a deterministic token so it can be found
   and updated without a second lookup. */
const allRows = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT id, data FROM participants WHERE instance_id = ? ORDER BY id"
  ).bind(instanceId).all()).results;

function parseRow(r) {
  try { return JSON.parse(r.data || "{}"); } catch { return {}; }
}

/** The deterministic key for a week's shared comment row. */
const wordsToken = (instanceId, week) => `pw${instanceId}x${week}`;

/** Group rows by week: scores array and words array per week. */
function byWeek(rows) {
  const m = new Map();
  const bucket = (w) => {
    if (!m.has(w)) m.set(w, { scores: [], words: [] });
    return m.get(w);
  };
  for (const r of rows) {
    const d = parseRow(r);
    if (typeof d.w !== "number") continue;
    if (typeof d.s === "number") bucket(d.w).scores.push(d.s);
    // the week's shared comment row
    if (Array.isArray(d.cs)) bucket(d.w).words.push(...d.cs.filter((x) => typeof x === "string" && x));
  }
  return m;
}

/* Append a comment to the week's shared row, reshuffling the whole
   array each time so position carries no information. Compare-and-
   swap on the row's own data, because two people can answer at once. */
async function addComment(env, instanceId, week, comment) {
  const token = wordsToken(instanceId, week);
  for (let attempt = 0; attempt < 6; attempt++) {
    const row = await env.DB.prepare(
      "SELECT id, data FROM participants WHERE token = ?"
    ).bind(token).first();

    if (!row) {
      try {
        await env.DB.prepare(
          `INSERT INTO participants (instance_id, token, name, data, created_at)
           VALUES (?, ?, '', ?, ?)`
        ).bind(instanceId, token, JSON.stringify({ w: week, cs: [comment] }),
          new Date().toISOString()).run();
        return true;
      } catch (e) {
        if (!/UNIQUE/.test(String(e))) throw e;
        continue;  // someone else created it first — re-read and append
      }
    }

    const cur = parseRow(row);
    const next = shuffle([...(Array.isArray(cur.cs) ? cur.cs : []), comment]);
    const res = await env.DB.prepare(
      "UPDATE participants SET data = ? WHERE id = ? AND data = ?"
    ).bind(JSON.stringify({ w: week, cs: next }), row.id, row.data).run();
    if (res.meta.changes) return true;
  }
  return false;   // a comment is optional; losing one is not worth a 500
}

/* Shed by ROW BUDGET, oldest whole weeks first — never the current
   week. The age rule is a retention policy, not the only lever.

   The first version sheds by age alone while the cap counted total
   rows, which is the deadlock qotd.js documents in its own history:
   once the cap is reached with nothing old enough to drop, every
   write is refused and only the calendar can fix it. Whole weeks
   rather than individual rows, so a surviving week is never a
   partial sample of itself. */
async function prune(env, instanceId, rows, week, target, keepFrom) {
  const byW = new Map();
  for (const r of rows) {
    const d = parseRow(r);
    if (typeof d.w !== "number") continue;
    if (!byW.has(d.w)) byW.set(d.w, []);
    byW.get(d.w).push(r.id);
  }

  const weeks = [...byW.keys()].filter((w) => w !== week).sort((a, b) => a - b);
  const doomed = [];
  let remaining = rows.length;

  // anything past the retention window goes regardless of budget
  for (const w of weeks) {
    if (w < keepFrom) { doomed.push(...byW.get(w)); remaining -= byW.get(w).length; }
  }
  // then oldest whole weeks until the budget is met
  for (const w of weeks) {
    if (remaining <= target) break;
    if (w < keepFrom) continue;                 // already taken above
    doomed.push(...byW.get(w));
    remaining -= byW.get(w).length;
  }
  if (!doomed.length) return 0;

  for (let i = 0; i < doomed.length; i += 200) {
    const part = doomed.slice(i, i + 200);
    await env.DB.prepare(
      `DELETE FROM participants WHERE id IN (${part.map(() => "?").join(",")})`
    ).bind(...part).run();
  }
  return doomed.length;
}

/* ---------- word cloud --------------------------------------- */

/* Deliberately small and boring. A cloud is a frequency count, and
   the interesting part is which words recur — not clever stemming.
   Stopwords are the usual English filler plus the words this
   particular question always produces. */
const STOP = new Set(("a an the and or but if so as at by for from in into of on to with " +
  "is are was were be been being am it its it's this that these those i we you they " +
  "he she them us our your my me not no yes very really quite just about too also " +
  "had has have do does did done will would can could should there here what when " +
  "week weeks been feel feeling felt bit lot got get").split(" "));

function cloud(phrases, limit = 28) {
  const counts = new Map();
  for (const p of phrases) {
    const words = String(p).toLowerCase().match(/[a-z][a-z'-]{1,}/g) || [];
    const seenHere = new Set();               // one vote per word per person
    for (const w of words) {
      const t = w.replace(/^'+|'+$/g, "");
      if (t.length < 3 || STOP.has(t) || seenHere.has(t)) continue;
      seenHere.add(t);
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  /* Two people minimum, with no exception. An earlier version let a
     small cloud through unfiltered so it would not look empty, which
     defeated the protection on exactly the small teams that need it —
     one person's unusual word is a fingerprint. An empty cloud is the
     correct output when nobody has said the same thing twice. */
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

/* ---------- validation --------------------------------------- */

function parseCreate(body) {
  const team = String(body.team || "").trim().replace(/\s+/g, " ").slice(0, MAX_TEAM);
  const question = String(body.question || "").trim().replace(/\s+/g, " ").slice(0, MAX_QUESTION);
  const askWords = body.askWords !== false;
  return { team, question, askWords, createdDay: todayISO() };
}

/* ---------- api ---------------------------------------------- */

async function create(request, env) {
  const data = parseCreate(await request.json().catch(() => ({})));
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "pulse",
    title: data.team ? `${data.team} — weekly pulse` : "Weekly pulse",
    data: JSON.stringify(data), nouns: NOUNS,
  });
  await logEvent(env, id, "pulse", "created");
  return json({ slug, editToken }, 201);
}

async function respond(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "pulse") return json({ error: "not found" }, 404);

  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 1 || score > 5)
    throw badInput("Pick a number from 1 to 5.");
  const comment = String(body.comment || "").trim().replace(/\s+/g, " ").slice(0, MAX_COMMENT);

  const rows = await allRows(env, row.id);
  const week = currentWeek();

  const expired = rows.some((r) => { const d = parseRow(r); return typeof d.w === "number" && d.w < week - KEEP_WEEKS; });
  if (rows.length >= PRUNE_AT || expired) {
    const left = rows.length - await prune(env, row.id, rows, week, PRUNE_TARGET, week - KEEP_WEEKS);
    if (left >= MAX_ROWS)
      return json({ error: "This pulse has had a huge week — try again in a moment." }, 409);
  }

  /* The score gets its own row. The comment goes into the week's
     shared, reshuffled array — never a row of its own, because a row
     of its own lands next to the score in id order and relinks the
     two. Score first, so a failed comment append cannot lose a vote. */
  await env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, created_at)
     VALUES (?, ?, '', ?, ?)`
  ).bind(row.id, randomString(22), JSON.stringify({ w: week, s: score }),
    new Date().toISOString()).run();

  if (comment) await addComment(env, row.id, week, comment);

  return json({ ok: true, week });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "pulse") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "pulse", "deleted");
  return json({ ok: true });
}

/* ---------- rendering ---------------------------------------- */

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function distribution(scores) {
  const counts = [0, 0, 0, 0, 0];
  for (const s of scores) counts[s - 1]++;
  const max = Math.max(1, ...counts);
  return counts.map((n, i) => `
        <li class="pulse-bar-row">
          <span class="pulse-bar-n">${i + 1}</span>
          <span class="pulse-bar"><span class="pulse-bar-fill" style="width:${Math.round((n / max) * 100)}%"></span></span>
          <span class="pulse-bar-c">${n}</span>
        </li>`).join("");
}

function trend(weeks, upTo) {
  const items = [];
  for (let w = upTo - TREND_WEEKS + 1; w <= upTo; w++) {
    const b = weeks.get(w);
    const n = b ? b.scores.length : 0;
    const a = n >= MIN_SHOW ? avg(b.scores) : null;
    const h = a === null ? 0 : Math.round(((a - 1) / 4) * 100);
    items.push(`
        <li class="trend-col${w === upTo ? " now" : ""}">
          <span class="trend-bar" style="height:${h}%" title="${a === null ? "not enough responses" : a.toFixed(1)}"></span>
          <span class="trend-label">${esc(weekLabel(w))}</span>
          <span class="trend-val">${a === null ? "–" : a.toFixed(1)}</span>
        </li>`);
  }
  return `<ol class="pulse-trend">${items.join("")}</ol>`;
}

function cloudBlock(words) {
  const c = cloud(words);
  if (!c.length) return "";
  const max = c[0][1];
  const spans = c.map(([w, n]) => {
    const size = 0.8 + (n / max) * 1.5;   // 0.8rem – 2.3rem
    const dim = 0.45 + (n / max) * 0.55;
    return `<span class="cw" style="font-size:${size.toFixed(2)}rem;opacity:${dim.toFixed(2)}" title="${n}×">${esc(w)}</span>`;
  }).join(" ");
  return `
  <h2 class="meal-section-h">What people said</h2>
  <p class="meal-intro">Words two or more people used. Said once by one person,
  it stays out — that is how a word cloud gives someone away.</p>
  <div class="wordcloud">${spans}</div>`;
}

/* ---------- public page (/s/:slug) --------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const rows = await allRows(env, row.id);
  const weeks = byWeek(rows);
  const week = currentWeek();
  const now = weeks.get(week) || { scores: [], words: [] };
  const n = now.scores.length;
  const enough = n >= MIN_SHOW;

  const question = data.question || "How was your week?";

  /* RESULTS ARE PUBLISHED ONLY FOR CLOSED WEEKS.

     The in-progress week shows a count and nothing else. This is not
     caution, it is the only thing that works: any figure that moves
     when one person answers hands you that person's answer. Load the
     page, wait for a colleague to respond, load it again, and the bar
     that changed is theirs — no arithmetic required. A threshold of
     four does not help, because it gates the FIRST reveal and every
     response after it still moves a visible number.

     A closed week is a fixed set. Nothing about it can be differenced,
     and padding it after the fact changes nothing anyone can watch. */
  const lastClosed = week - 1;
  const closed = weeks.get(lastClosed) || { scores: [], words: [] };
  const closedN = closed.scores.length;
  const showClosed = closedN >= MIN_SHOW;

  const liveCount = `
  <div class="pulse-hold">
    <p class="pulse-hold-n">${n} response${n === 1 ? "" : "s"} this week</p>
    <p class="fine">This week's numbers stay closed until Monday. A figure that
    moves every time somebody answers tells you what they answered — so the week
    is published once it is finished and can no longer be watched.</p>
  </div>`;

  const results = showClosed ? `
  <h2 class="meal-section-h">Week of ${esc(weekLabel(lastClosed))}</h2>
  <p class="pulse-big">${avg(closed.scores).toFixed(1)}<span class="pulse-of"> / 5</span></p>
  <p class="page-sub">${closedN} response${closedN === 1 ? "" : "s"}</p>
  <ul class="pulse-bars">${distribution(closed.scores)}
  </ul>
  ${cloudBlock(closed.words)}
  <h2 class="meal-section-h">Recent weeks</h2>
  ${trend(weeks, lastClosed)}`
    : `
  <div class="pulse-hold">
    <p class="pulse-hold-n">Nothing published yet</p>
    <p class="fine">A week is published once it has closed and at least
    ${MIN_SHOW} people have answered. Below that, an average points straight at
    whoever gave the low one.</p>
  </div>`;

  const body = `
<main class="wrap page">
  <p class="kicker">Weekly pulse${data.team ? ` · ${esc(data.team)}` : ""}</p>
  <h1>${esc(question)}</h1>

  <form class="pulse-form" id="pulseForm">
    <p class="pulse-ask">1 is a rough week, 5 is a good one.</p>
    <div class="pulse-scale">
      ${[1, 2, 3, 4, 5].map((i) => `
      <button class="pulse-num" type="button" data-score="${i}" aria-label="${i} out of 5">${i}</button>`).join("")}
    </div>
    ${data.askWords ? `
    <label class="field pulse-words" hidden id="wordsField">
      <span>In a few words — optional</span>
      <input type="text" id="comment" maxlength="${MAX_COMMENT}" placeholder="busy but good" autocomplete="off">
    </label>` : ""}
    <div class="pulse-actions" hidden id="pulseActions">
      <button class="btn primary" type="submit" id="sendBtn">Send it</button>
      <button class="btn ghost" type="button" id="cancelBtn">Never mind</button>
    </div>
    <p class="meal-form-err" id="pulseErr" hidden></p>
  </form>

  <div id="pulseDone" hidden>
    <p class="pulse-thanks">Thanks — that's in.</p>
  </div>

  ${liveCount}

  ${results}

  ${ownCta("pulse",
    "Want an honest pulse check on your own team?",
    "Start your own pulse")}
  <footer class="page-foot">
    <p class="fine"><strong>Nobody can tell it was you.</strong> There are no
    accounts here, no email addresses and no cookies, so there is nothing to
    identify you with — not for your manager, not for whoever set this up, and
    not for us. Your words never get a record of their own either — each week's
    comments go into one shuffled list, so there is no entry of yours sitting
    beside your score for anyone to line up.</p>
    <p><a class="quiet-link" href="/via/pulse">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var KEY = "bbb:pulse:" + slug + ":" + ${JSON.stringify(String(week))};
  var chosen = null;

  var form = document.getElementById("pulseForm");
  var done = document.getElementById("pulseDone");
  var actions = document.getElementById("pulseActions");
  var wordsField = document.getElementById("wordsField");
  var err = document.getElementById("pulseErr");

  // Soft one-per-week, the same way the daily question does it: this
  // browser remembers, nothing server-side identifies anyone.
  try { if (localStorage.getItem(KEY)) { form.hidden = true; done.hidden = false; } } catch (e) {}

  document.querySelectorAll(".pulse-num").forEach(function (b) {
    b.addEventListener("click", function () {
      chosen = parseInt(b.getAttribute("data-score"), 10);
      document.querySelectorAll(".pulse-num").forEach(function (o) { o.classList.remove("picked"); });
      b.classList.add("picked");
      if (wordsField) wordsField.hidden = false;
      actions.hidden = false;
    });
  });

  document.getElementById("cancelBtn").addEventListener("click", function () {
    chosen = null;
    document.querySelectorAll(".pulse-num").forEach(function (o) { o.classList.remove("picked"); });
    if (wordsField) wordsField.hidden = true;
    actions.hidden = true;
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!chosen) return;
    err.hidden = true;
    var c = document.getElementById("comment");
    document.getElementById("sendBtn").disabled = true;
    fetch("/api/pulse/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: slug, score: chosen, comment: c ? c.value : "" }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "That didn't send — try again.");
        try { localStorage.setItem(KEY, "1"); } catch (e) {}
        location.reload();
      });
    }).catch(function (e) {
      document.getElementById("sendBtn").disabled = false;
      err.textContent = e.message; err.hidden = false;
    });
  });
})();
</script>`;
  return html(pageShell({ title: data.team ? `${data.team} — weekly pulse` : "Weekly pulse",
    body, shareType: "pulse", shareSlug: row.slug }));
}

/* ---------- organiser page (/e/:token) ----------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const rows = await allRows(env, row.id);
  const weeks = byWeek(rows);
  const week = currentWeek();
  const shareUrl = `${origin}/s/${row.slug}`;

  const history = [];
  /* Starts at week-1: the in-progress week's average is exactly the
     number an organiser could difference to read one person's score. */
  for (let w = week - 1; w > week - TREND_WEEKS * 2; w--) {
    const b = weeks.get(w);
    if (!b || !b.scores.length) continue;
    const n = b.scores.length;
    history.push(`
        <tr>
          <td>${esc(weekLabel(w))}</td>
          <td>${n}</td>
          <td>${n >= MIN_SHOW ? avg(b.scores).toFixed(1) : "<span class=\"fine\">withheld</span>"}</td>
        </tr>`);
  }

  const body = `
<main class="wrap page">
  <div class="organiser-banner">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link with the team.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(data.team ? `${data.team} — weekly pulse` : "Weekly pulse")}</h1>
  <p class="page-sub">${esc(data.question || "How was your week?")}</p>

  <p class="share-label">This is what shows when you paste the link:</p>
  ${cardPreview("pulse", data.team ? `${data.team} — weekly pulse` : "Weekly pulse")}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link once — the team bookmarks it</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("Weekly pulse — one tap, takes five seconds, and nobody can tell who said what. Same link every week: " + shareUrl, row.edit_token)}

  <div class="dl-panel">
    <p class="dl-label">You see the same as everyone else</p>
    <p class="fine">There is no organiser-only view of the responses, and there is
    no way to add one — no account, no email and no cookie means there is nothing
    stored that could identify a respondent. Weeks with fewer than ${MIN_SHOW}
    responses are withheld from you too. That is the point: if you could see it,
    so could a manager, and then nobody answers honestly.</p>
    <p class="dl-row"><a class="btn" href="/s/${esc(row.slug)}">Open the team's view</a></p>
  </div>

  <h2 class="meal-section-h">Response counts by week</h2>
  <button class="btn" id="printBtn" type="button">Print this history</button>
  <div class="table-scroll">
    <table class="api-table">
      <thead><tr><th>Week of</th><th>Responses</th><th>Average</th></tr></thead>
      <tbody>${history.join("") || '<tr><td colspan="3">Nothing yet.</td></tr>'}</tbody>
    </table>
  </div>

  <div class="organiser-actions">
    <button class="btn danger" id="deleteBtn" type="button">Delete this pulse</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Deleting removes every response permanently. History older
    than about six months is dropped automatically.</p>
  </footer>
</main>

<script>
(function () {
  var token = ${JSON.stringify(row.edit_token)};
  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
  document.getElementById("copyBtn").addEventListener("click", function () {
    var i = document.getElementById("shareUrl");
    i.select();
    navigator.clipboard.writeText(i.value).then(function () {
      var b = document.getElementById("copyBtn");
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy"; }, 1500);
    });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this pulse and every response? This cannot be undone.")) return;
    fetch("/api/pulse/" + token + "/delete", { method: "POST" })
      .then(function () { location.href = ${JSON.stringify(HOME)}; });
  });
})();
</script>`;
  return html(pageShell({ title: `${data.team || "Weekly"} pulse (organiser)`, body }));
}

/* ---------- module contract ---------------------------------- */

export default {
  type: "pulse",

  async api(request, env, url) {
    const p = url.pathname;
    if (!p.startsWith("/api/pulse")) return null;
    if (request.method !== "POST") return null;

    let m;
    if (p === "/api/pulse") return create(request, env);
    if (p === "/api/pulse/respond") return respond(request, env);
    if ((m = p.match(/^\/api\/pulse\/([a-z0-9]+)\/delete$/))) return orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
