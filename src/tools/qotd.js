/* ============================================================
   Question of the Day — the site's first RECURRING tool.

   A team makes ONE instance and bookmarks ONE share link. The
   question changes by itself every day. There is no cron, no
   scheduled worker, no "advance" button, and deliberately no
   stored "current index" that something has to move along.

   How the rotation actually works:
     - At create time we store `order`: a shuffled array of indexes
       into the shared question bank, seeded per instance (crypto
       shuffle), so two teams get different sequences.
     - Today's question is a pure function of the calendar:
           day   = whole days between createdDay and today
           index = order[ day % order.length ]
       Nothing is written when the day rolls over. A page load on a
       new day simply computes a new index.
     - `overrides` is a per-day map the organiser can write to when
       they skip a day, and where a freshly added custom question
       gets queued. It never changes what any OTHER day resolves to.

   Day arithmetic is calendar-based, in a fixed timezone
   (Australia/Sydney — this is an Australian site and the whole point
   is that the question flips overnight for the team, not at some
   UTC hour). Both dates are reduced to YYYY-MM-DD in that zone and
   subtracted as UTC midnights, so DST never shifts a day boundary
   and Date.now() drift can't half-advance anything.

   Question addressing, and why custom questions live at 100000+:
   `order` and `overrides` store indexes. The shared bank can gain
   questions in a future deploy, so a custom question addressed as
   "QUESTIONS.length + k" would silently point at a different
   question after the next release. Custom questions therefore get
   indexes CUSTOM_BASE + k, a space the shared bank can never reach.
   (Corollary for whoever edits qotd-questions.js: only ever APPEND
   to QUESTIONS. Reordering or removing entries would reshuffle the
   rotation of every live instance.)

   Votes are per (instance, dayNumber): one participants row each,
   name = '' (two people may share a display name), the day and the
   choice in the data JSON. Each day gets its own tally and its own
   archive entry. Yesterday's vote never blocks today's.

   One vote per person is soft — localStorage only, no accounts.
   The copy says so. It's a workplace laugh, not an election.
   ============================================================ */
import {
  esc, json, html, randomString, shuffle, badInput, pageShell, fmtDate,
  getBySlug, getByToken, getParticipant, getInstanceById,
  createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";
import { QUESTIONS } from "./qotd-questions.js";

const MAX_TEAM = 60;
const MAX_QUESTION = 140;
const MAX_OPTION = 60;
const MAX_VOTER_NAME = 40;
const MAX_CUSTOM = 100;
const MAX_VOTES = 2000;      // storage cap per instance
const ARCHIVE_DAYS = 30;     // how far back the archive renders
const PRUNE_AT = 1200;       // start shedding old vote rows above this
const PRUNE_TARGET = 900;    // ...and keep shedding until we're back under here
const PRUNE_CEILING = 400;   // rows deleted per round, so one request stays bounded
const WARN_AT = Math.round(MAX_VOTES * 0.8); // tell the organiser before it gets tight
const OVERRIDE_KEEP = 60;    // prune override entries older than this
const LOOKAHEAD = 14;        // days of upcoming questions a skip won't reach for
const CUSTOM_BASE = 100000;  // index space for organiser-added questions
const MAX_CUSTOM_SLOTS = 300; // add-then-remove churn: tombstoned slots never come back

const TZ = "Australia/Sydney";

const NOUNS = ["debate", "hunch", "toss-up", "quibble", "verdict",
  "banter", "standoff", "pickle", "dilemma", "waffle"];

const HOME = "/question-of-the-day/";

/* Last-resort question, used only if the shared bank ever ships
   empty. Every array access below is guarded, and this is what the
   guards fall back to so a page can still render. */
const FALLBACK = { text: "Is a hot dog a sandwich?", a: "Sandwich", b: "Not a sandwich" };

/* Safe JSON for inlining into a <script> — stops a stray "</script>"
   (or U+2028/9) inside user text from breaking out. */
const sj = (v) => JSON.stringify(v)
  .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
  .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/* ---------- the calendar ------------------------------------ */

let _fmt = null;
function dayFormatter() {
  if (!_fmt) {
    _fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    });
  }
  return _fmt;
}

/** Today's calendar date in TZ, as "YYYY-MM-DD". */
function todayISO(now = new Date()) {
  const parts = {};
  for (const p of dayFormatter().formatToParts(now)) parts[p.type] = p.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** "YYYY-MM-DD" -> whole days since the epoch, or null. */
function dayIndex(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? Math.floor(t / 86400000) : null;
}

/** The instance's start date, with a fallback to its created_at. */
function createdDayOf(row, data) {
  const stored = data && typeof data.createdDay === "string" ? data.createdDay : "";
  if (dayIndex(stored) !== null) return stored;
  return String(row.created_at || "").slice(0, 10);
}

/** Whole days from createdDay to today, floored at 0. Day 0 = the day it was made. */
function dayNumber(createdDay) {
  const a = dayIndex(createdDay);
  const b = dayIndex(todayISO());
  if (a === null || b === null) return 0;
  return Math.max(0, b - a);
}

/** The calendar date of a given day number, as "YYYY-MM-DD". */
function isoForDay(createdDay, day) {
  const a = dayIndex(createdDay);
  if (a === null) return "";
  return new Date((a + day) * 86400000).toISOString().slice(0, 10);
}

/* ---------- the question bank ------------------------------- */

const customOf = (data) => (Array.isArray(data.custom) ? data.custom : []);

/* A custom question the organiser removed. The slot is tombstoned
   (null) rather than spliced out, because live overrides and archive
   rows hold the raw CUSTOM_BASE+k index — splicing would silently
   re-point them at somebody else's question. */
const REMOVED = { text: "One of your own, since removed", a: "Option A", b: "Option B" };

/** Resolve an index to a question object, or null if it points nowhere. */
function questionByIndex(data, i) {
  if (!Number.isInteger(i) || i < 0) return null;
  if (i >= CUSTOM_BASE) {
    const c = customOf(data)[i - CUSTOM_BASE];
    // A tombstone reads as "points nowhere", so it drops out of the
    // rotation. History renders it separately — see questionForDay().
    return c && typeof c.text === "string" ? c : null;
  }
  const q = QUESTIONS[i];
  return q && typeof q.text === "string" ? q : null;
}

/** The stored order, with anything that no longer resolves dropped.
    Custom indexes count: an added question joins the rotation for good. */
function validOrder(data) {
  const raw = Array.isArray(data.order) ? data.order : [];
  return raw.filter((i) => questionByIndex(data, i) !== null);
}

const overridesOf = (data) =>
  (data.overrides && typeof data.overrides === "object" && !Array.isArray(data.overrides))
    ? data.overrides : {};

/**
 * Which question a given day lands on. Pure — no writes, no state.
 * Returns { index, q } with q never null (FALLBACK if the bank is empty).
 */
function resolveDay(data, day) {
  const ov = overridesOf(data);
  const key = String(day);
  if (Object.prototype.hasOwnProperty.call(ov, key)) {
    const i = ov[key];
    const q = questionByIndex(data, i);
    if (q) return { index: i, q };
  }
  const order = validOrder(data);
  if (order.length) {
    const i = order[((day % order.length) + order.length) % order.length];
    const q = questionByIndex(data, i);
    if (q) return { index: i, q };
  }
  // Bank shrank to nothing, or an instance was created before the bank
  // existed. Still render something rather than a broken page.
  if (QUESTIONS.length) {
    const i = ((day % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length;
    const q = questionByIndex(data, i);
    if (q) return { index: i, q };
  }
  return { index: -1, q: FALLBACK };
}

/** Every index this instance has spent, or is about to (past days, the
    next fortnight of scheduled days, and every override). */
function usedIndexes(data, day) {
  const used = new Set();
  const ov = overridesOf(data);
  // Future overrides count too — otherwise a skip could grab the very
  // question already queued for tomorrow and show it twice.
  for (const k of Object.keys(ov)) used.add(ov[k]);
  const order = validOrder(data);
  if (order.length) {
    const upto = Math.min(day, order.length - 1);
    for (let d = 0; d <= upto; d++) used.add(order[d]);
    /* And the days still to come. A skip calls nextUnusedIndex(), which
       walks forward from today's slot in `order`; with only days 0..today
       marked, the first "unused" candidate was order[pos+1] — literally
       tomorrow's question — so every skip showed the same question two
       mornings running. Treating the next fortnight as already spent
       sends the skip further down the rotation instead. Only worth doing
       when the rotation has days to spare; a tiny bank falls back to the
       old behaviour rather than running out of candidates. */
    const ahead = order.length > LOOKAHEAD + 2 ? LOOKAHEAD : 0;
    for (let d = 1; d <= ahead; d++) used.add(order[(day + d) % order.length]);
  }
  return used;
}

/** The next question this instance hasn't shown. Organiser's own go first. */
function nextUnusedIndex(data, day) {
  const used = usedIndexes(data, day);
  const custom = customOf(data);
  for (let k = 0; k < custom.length; k++) {
    const i = CUSTOM_BASE + k;
    if (!used.has(i) && questionByIndex(data, i)) return i;
  }
  const order = validOrder(data);
  if (order.length) {
    const pos = ((day % order.length) + order.length) % order.length;
    for (let step = 1; step <= order.length; step++) {
      const i = order[(pos + step) % order.length];
      if (!used.has(i)) return i;
    }
    // Been through the whole bank — go round again, but never hand back
    // the question already sitting on today (a skip has to move), and
    // never tomorrow's either (that's the same question two days running,
    // which is exactly what a skip is meant to avoid). Steps start at 2
    // because order[pos + 1] IS tomorrow.
    const currentToday = overridesOf(data)[String(day)];
    const tomorrow = order[(day + 1) % order.length];
    for (let step = 2; step <= order.length + 1; step++) {
      const i = order[(pos + step) % order.length];
      if (i !== currentToday && i !== tomorrow) return i;
    }
    return order[pos]; // a one- or two-question rotation: nothing else exists
  }
  if (QUESTIONS.length) return (day + (QUESTIONS.length > 2 ? 2 : 1)) % QUESTIONS.length;
  return -1;
}

/** Drop override entries well behind the archive window, so the JSON stays small. */
function pruneOverrides(overrides, today) {
  const out = {};
  for (const k of Object.keys(overrides)) {
    const n = Number(k);
    if (!Number.isInteger(n)) continue;
    if (n < today - OVERRIDE_KEEP) continue;
    out[k] = overrides[k];
  }
  return out;
}

/* ---------- votes ------------------------------------------- */

const allVotes = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT * FROM participants WHERE instance_id = ? ORDER BY id"
  ).bind(instanceId).all()).results;

function parseVote(p) {
  let d;
  try { d = JSON.parse(p.data); } catch { return null; }
  if (!d || !Number.isInteger(d.day)) return null;
  const choice = d.choice === "a" ? "a" : d.choice === "b" ? "b" : null;
  if (!choice) return null;
  // qi = the question index this vote was actually cast against. Rows
  // written before qi existed have none; everything downstream copes.
  return {
    day: d.day, choice,
    qi: Number.isInteger(d.qi) ? d.qi : null,
    voterName: String(d.voterName || "").trim(),
  };
}

/** Map of dayNumber -> { a, b, total, names:[{name,choice}], qis:Map }. */
function talliesByDay(parts) {
  const byDay = new Map();
  for (const p of parts) {
    const v = parseVote(p);
    if (!v) continue;
    let t = byDay.get(v.day);
    if (!t) { t = { a: 0, b: 0, total: 0, names: [], qis: new Map() }; byDay.set(v.day, t); }
    t[v.choice]++;
    t.total++;
    if (v.voterName) t.names.push({ name: v.voterName, choice: v.choice });
    if (v.qi !== null) t.qis.set(v.qi, (t.qis.get(v.qi) || 0) + 1);
  }
  return byDay;
}

const tallyFor = (byDay, day) =>
  byDay.get(day) || { a: 0, b: 0, total: 0, names: [], qis: new Map() };

/** The index the most people on a given day actually voted against. */
function recordedQi(t) {
  let best = null;
  let bestN = 0;
  if (t && t.qis) for (const [i, n] of t.qis) { if (n > bestN) { best = i; bestN = n; } }
  return best;
}

/* What a past day's question WAS. Read back from the votes cast that
   day, not re-derived from `order` — otherwise appending a custom
   question (which changes order.length, and so every day % length)
   would retroactively rewrite what the archive says the team argued
   about. Days nobody voted on have nothing recorded, so they fall back
   to the rotation; there's no tally to misattribute either way. */
function questionForDay(data, day, t) {
  const qi = recordedQi(t);
  if (qi !== null) {
    const q = questionByIndex(data, qi);
    if (q) return q;
    if (qi >= CUSTOM_BASE) return REMOVED; // tombstoned, but the split still stands
  }
  return resolveDay(data, day).q;
}
const publicTally = (t) => ({ a: t.a, b: t.b, total: t.total });

async function deleteVoteRows(env, instanceId, ids) {
  let removed = 0;
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const res = await env.DB.prepare(
      `DELETE FROM participants WHERE instance_id = ? AND id IN (${chunk.map(() => "?").join(",")})`
    ).bind(instanceId, ...chunk).run();
    removed += (res.meta && res.meta.changes) || 0;
  }
  return removed;
}

/* A team that runs this every workday would hit the 2000-row cap and the
   tool would simply stop, which is a rotten end for something built to
   run forever. It used to shed by AGE (anything older than 90 days) while
   the cap counted TOTAL rows — so a busy team filled up in about seventy
   days and then had nothing old enough to delete. Every vote 409'd for a
   fortnight, and came back round every quarter.

   So: shed by ROW BUDGET. Take whole day-buckets, oldest first, until
   we're back under PRUNE_TARGET. Whole buckets only — half a day's votes
   is a lie in the archive — and never today's, which is still being voted
   on. Rows too broken to parse go first; they can't be tallied anyway. */
function prunePlan(parts, today, total, target) {
  const buckets = new Map();
  const junk = [];
  for (const p of parts) {
    const v = parseVote(p);
    if (!v) { junk.push(p.id); continue; }
    if (v.day >= today) continue; // today is untouchable; so is anything ahead of it
    let b = buckets.get(v.day);
    if (!b) { b = []; buckets.set(v.day, b); }
    b.push(p.id);
  }

  const ids = junk.slice(0, PRUNE_CEILING);
  let n = total - ids.length;
  const days = [...buckets.keys()].sort((x, y) => x - y); // oldest first
  for (const day of days) {
    if (n <= target) break;
    const b = buckets.get(day);
    // Stop at the ceiling so one request stays bounded — the next vote
    // picks up where this one left off. Unless we've queued nothing yet,
    // in which case take the bucket whole however big it is: refusing to
    // start is how the old deadlock happened.
    if (ids.length && ids.length + b.length > PRUNE_CEILING) break;
    for (const id of b) ids.push(id);
    n -= b.length;
  }
  return ids;
}

/** Shed rows until the instance is back under PRUNE_TARGET. Bounded. */
async function pruneOldVotes(env, instanceId, parts, today, total) {
  let removed = 0;
  let rows = parts;
  for (let round = 0; round < 4; round++) {
    if (total - removed <= PRUNE_TARGET) break;
    const ids = prunePlan(rows, today, total - removed, PRUNE_TARGET);
    if (!ids.length) break;
    await deleteVoteRows(env, instanceId, ids);
    removed += ids.length;
    const gone = new Set(ids);
    rows = rows.filter((p) => !gone.has(p.id));
  }
  return removed;
}

/* ---------- optimistic concurrency -------------------------- */

/* Read-modify-write on instances.data, guarded on updated_at. The
   whole rotation lives in one JSON column, so a naive read-then-write
   lets an "add a question" clobber a "skip today" (and vice versa).
   Same pattern as poll.js / bracket.js. `mutate(data)` returns the new
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
  const e = new Error("Two changes landed at once — try that again in a moment.");
  e.status = 409;
  throw e;
}

/* ---------- api --------------------------------------------- */

const cleanLine = (s, max) => String(s == null ? "" : s).trim().replace(/\s+/g, " ").slice(0, max);

async function create(request, env) {
  const body = await request.json().catch(() => ({}));
  const teamName = cleanLine(body.teamName, MAX_TEAM);

  // The per-instance seed: a crypto shuffle of every index in the bank.
  // Two teams starting on the same morning get different sequences.
  const order = shuffle(QUESTIONS.map((_, i) => i));
  const createdDay = todayISO();

  const data = JSON.stringify({ teamName, order, custom: [], overrides: {}, createdDay });
  const title = teamName ? `${teamName} — question of the day` : "Question of the day";

  const { id, slug, editToken } = await createInstance(env, {
    toolType: "qotd", title, data, nouns: NOUNS,
  });
  await logEvent(env, id, "qotd", "created");
  return json({ slug, editToken }, 201);
}

function readChoice(body) {
  const c = body && body.choice;
  if (c === "a" || c === "b") return c;
  throw badInput("Pick one of the two.");
}

/* A ballot has to say which day and which question it was filled in for.
   Without that, a page left open across midnight files its vote against
   the next day's question, and a page open across a skip files it against
   the replacement — with A and B pointing at different words than the
   ones the voter read. Mismatch means the page is stale, not that the
   voter did anything wrong, so the client just reloads. */
function staleBallot(body, today, qi) {
  const dayOff = Number.isInteger(body && body.day) && body.day !== today;
  const qiOff = Number.isInteger(body && body.qi) && body.qi !== qi;
  if (!dayOff && !qiOff) return null;
  return json({
    stale: true,
    error: dayOff
      ? "That page was open when the day rolled over — here's today's question."
      : "Today's question changed while that page was open — here's the one on now.",
  }, 409);
}

async function vote(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "qotd") return json({ error: "not found" }, 404);

  const choice = readChoice(body);
  const data = JSON.parse(row.data);
  const today = dayNumber(createdDayOf(row, data));
  const { index: qi } = resolveDay(data, today);
  const stale = staleBallot(body, today, qi);
  if (stale) return stale;

  const c = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM participants WHERE instance_id = ?"
  ).bind(row.id).first();
  let n = (c && c.n) || 0;

  if (n >= PRUNE_AT) {
    const existing = await allVotes(env, row.id);
    n -= await pruneOldVotes(env, row.id, existing, today, n);
  }
  if (n >= MAX_VOTES)
    return json({ error: "That's two thousand votes sitting on today's question — the ballot box is full. Tomorrow's starts with room again." }, 409);

  const voterName = cleanLine(body.voterName, MAX_VOTER_NAME);
  const token = randomString(22);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, claimed_at, created_at)
     VALUES (?, ?, '', ?, ?, ?)`
  ).bind(row.id, token, JSON.stringify({ day: today, qi, choice, voterName }), now, now).run();

  const parts = await allVotes(env, row.id);
  return json({ token, day: today, qi, choice, tally: publicTally(tallyFor(talliesByDay(parts), today)) }, 201);
}

async function changeVote(vtoken, request, env) {
  const prow = await getParticipant(env, vtoken);
  const row = prow && await getInstanceById(env, prow.instance_id);
  if (!row || row.tool_type !== "qotd")
    return json({ stale: true, error: "That vote wasn't found — it may have been cleared. Vote again." }, 404);

  const body = await request.json().catch(() => ({}));
  const choice = readChoice(body);
  const data = JSON.parse(row.data);
  const today = dayNumber(createdDayOf(row, data));
  const { index: qi } = resolveDay(data, today);
  const stale = staleBallot(body, today, qi);
  if (stale) return stale;

  let pdata = {};
  try { pdata = JSON.parse(prow.data) || {}; } catch { pdata = {}; }
  // The whole point of the tool: yesterday's vote must never trap
  // anyone. Nor should a vote cast against a question that has since
  // been swapped out. The browser should have spotted both first; this
  // is the server saying no in case it didn't.
  if (pdata.day !== today || (Number.isInteger(pdata.qi) && pdata.qi !== qi))
    return json({ stale: true, error: "That vote was for a different question — here's the one on now." }, 409);

  await env.DB.prepare("UPDATE participants SET data = ? WHERE id = ?")
    .bind(JSON.stringify({ ...pdata, day: today, qi, choice }), prow.id).run();

  const parts = await allVotes(env, row.id);
  return json({ ok: true, day: today, qi, choice, tally: publicTally(tallyFor(talliesByDay(parts), today)) });
}

/* Today's split, on request. The daily page ships its bars EMPTY (see
   blankBars) so the numbers genuinely aren't in the source for someone
   who hasn't voted — the on-page copy says so, so it has to be true.
   This is where the script gets them once it holds a vote. */
async function tallyToday(slug, env) {
  const row = await getBySlug(env, String(slug || ""));
  if (!row || row.tool_type !== "qotd") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);
  const today = dayNumber(createdDayOf(row, data));
  const { index: qi, q } = resolveDay(data, today);
  const parts = await allVotes(env, row.id);
  const t = tallyFor(talliesByDay(parts), today);
  return json({ day: today, qi, a: t.a, b: t.b, total: t.total, labels: { a: q.a, b: q.b } });
}

async function skipToday(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "qotd") return json({ error: "not found" }, 404);

  const data0 = JSON.parse(row.data);
  const today = dayNumber(createdDayOf(row, data0));

  await mutateData(env, row.id, (d) => {
    const idx = nextUnusedIndex(d, today);
    if (idx < 0) { const e = new Error("There aren't any questions to swap to."); e.status = 409; throw e; }
    const overrides = pruneOverrides({ ...overridesOf(d) }, today);
    overrides[String(today)] = idx;
    return { ...d, overrides };
  });

  // Today's votes were about the question we just replaced, so they go
  // with it. Yesterday and the archive are untouched.
  const parts = await allVotes(env, row.id);
  const ids = parts.filter((p) => { const v = parseVote(p); return v && v.day === today; }).map((p) => p.id);
  if (ids.length) await deleteVoteRows(env, row.id, ids);

  return json({ ok: true, cleared: ids.length });
}

async function addQuestion(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "qotd") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const text = cleanLine(body.text, MAX_QUESTION);
  const a = cleanLine(body.a, MAX_OPTION);
  const b = cleanLine(body.b, MAX_OPTION);
  if (!text) throw badInput("Write the question first.");
  if (!a || !b) throw badInput("Give it two sides — an A and a B.");
  if (a.toLowerCase() === b.toLowerCase())
    throw badInput("The two options are the same — that's not much of a debate.");

  const data0 = JSON.parse(row.data);
  const today = dayNumber(createdDayOf(row, data0));
  let queuedDay = today + 1;

  await mutateData(env, row.id, (d) => {
    const custom = customOf(d).slice();
    if (custom.filter(Boolean).length >= MAX_CUSTOM) {
      const e = new Error("A hundred of your own is the limit — remove one to make room.");
      e.status = 409;
      throw e;
    }
    if (custom.length >= MAX_CUSTOM_SLOTS) {
      const e = new Error("This list has been added to and removed from a lot — there's no room for another. The shared bank still rotates as normal.");
      e.status = 409;
      throw e;
    }
    if (custom.some((c) => c && String(c.text || "").toLowerCase() === text.toLowerCase())) {
      const e = new Error("You've already added that one.");
      e.status = 409;
      throw e;
    }
    custom.push({ text, a, b });
    const index = CUSTOM_BASE + (custom.length - 1);

    /* Into the rotation for good: APPENDED to the end of order, never
       spliced into the middle. Splicing would shift every later position
       and change what days already gone resolve to — safe now only
       because history reads its question back from the votes, not from
       order. Appending changes future days only. */
    const order = (Array.isArray(d.order) ? d.order.slice() : []);
    order.push(index);

    // Plus a short lead, so an added question actually turns up this week
    // instead of waiting a full lap of the bank for its turn.
    const overrides = pruneOverrides({ ...overridesOf(d) }, today);
    let day = today + 1;
    while (Object.prototype.hasOwnProperty.call(overrides, String(day)) && day < today + 400) day++;
    overrides[String(day)] = index;
    queuedDay = day;

    return { ...d, custom, order, overrides };
  });

  return json({ ok: true, inDays: Math.max(1, queuedDay - today) });
}

async function removeQuestion(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "qotd") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const index = body && body.index;
  if (!Number.isInteger(index) || index < CUSTOM_BASE)
    throw badInput("That isn't one of your own questions.");

  await mutateData(env, row.id, (d) => {
    const k = index - CUSTOM_BASE;
    const custom = customOf(d).slice();
    if (k < 0 || k >= custom.length || !custom[k]) {
      const e = new Error("That one's already gone.");
      e.status = 404;
      throw e;
    }
    // Tombstone, never splice: overrides and archive rows hold the raw
    // index, and closing the gap would re-point them at a neighbour.
    custom[k] = null;
    const order = (Array.isArray(d.order) ? d.order : []).filter((i) => i !== index);
    const overrides = {};
    for (const key of Object.keys(overridesOf(d))) {
      if (overridesOf(d)[key] !== index) overrides[key] = overridesOf(d)[key];
    }
    return { ...d, custom, order, overrides };
  });

  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "qotd") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "qotd", "deleted");
  return json({ ok: true });
}

/* ---------- rendering --------------------------------------- */

const voteWord = (n) => `${n} ${n === 1 ? "vote" : "votes"}`;

function split(t) {
  const total = t.total;
  const pa = total ? Math.round((t.a / total) * 100) : 0;
  const pb = total ? 100 - pa : 0;
  return { total, pa, pb };
}

/* TODAY's bars, shipped EMPTY. The page says the split stays hidden
   until you've voted, and it used to mean "hidden by a CSS attribute,
   with every number sitting in view-source". Now the numbers aren't in
   the page at all: the script asks /api/qotd/:slug/tally for them once
   this browser holds a vote for today's question. History is different —
   those days are done, and their numbers are rendered below. */
function blankBars(q) {
  const row = (key, label) => `
    <li class="poll-bar qotd-bar" data-choice="${key}">
      <div class="poll-bar-head">
        <span class="poll-bar-label"><span class="qotd-bar-key">${key.toUpperCase()}</span> ${esc(label)}</span>
        <span class="poll-bar-count"><span class="qotd-n"></span> <span class="poll-bar-unit"></span> <span class="poll-bar-pct"></span></span>
      </div>
      <div class="poll-bar-track"><i style="width:0%"></i></div>
    </li>`;
  return `<ul class="poll-bars">${row("a", q.a)}${row("b", q.b)}</ul>`;
}

/* Two pixel bars, reusing the poll tool's bar chrome. `mine` marks the
   voter's own side once they've voted (the class is added by script,
   never rendered server-side — the server has no idea who's looking). */
function bars(q, t) {
  const { total, pa, pb } = split(t);
  const lead = t.a === t.b ? null : (t.a > t.b ? "a" : "b");
  const row = (key, label, n, pct) => `
    <li class="poll-bar qotd-bar${lead === key ? " is-leader" : ""}" data-choice="${key}">
      <div class="poll-bar-head">
        <span class="poll-bar-label"><span class="qotd-bar-key">${key.toUpperCase()}</span> ${esc(label)}</span>
        <span class="poll-bar-count">${n} <span class="poll-bar-unit">${n === 1 ? "vote" : "votes"}</span> <span class="poll-bar-pct">· ${pct}%</span></span>
      </div>
      <div class="poll-bar-track"><i style="width:${total ? pct : 0}%"></i></div>
    </li>`;
  return `<ul class="poll-bars">${row("a", q.a, t.a, pa)}${row("b", q.b, t.b, pb)}</ul>`;
}

/** A compact one-line result, for the archive. */
function miniSplit(q, t) {
  const { pa, pb } = split(t);
  return `<span class="qotd-mini-split"><strong>${esc(q.a)}</strong> ${t.a} (${pa}%) · <strong>${esc(q.b)}</strong> ${t.b} (${pb}%)</span>`;
}

function dayLabel(createdDay, day) {
  const iso = isoForDay(createdDay, day);
  return iso ? fmtDate(iso) : "";
}

/* The daily block — question, ballot, empty result. Shared by the
   public page and the organiser page so the organiser votes too.

   Vote-then-reveal: the results block renders with no numbers in it at
   all, and the script fetches today's split only once this browser holds
   a vote for today's question. One vote per person is still the honour
   system — no accounts — but "the split stays hidden until you've voted"
   is now true of the page source, not just of a hidden attribute. */
function dailyBlock(q) {
  return `
  <form id="qotdBallot" class="qotd-ballot panel" novalidate>
    <p class="qotd-ask">Tap your side.</p>
    <label class="field qotd-namefield">
      <span>Your name <em>(optional — only the organiser sees it)</em></span>
      <input type="text" id="qotdName" maxlength="${MAX_VOTER_NAME}" autocomplete="name"
             placeholder="So the organiser knows who's chimed in">
    </label>
    <div class="qotd-choices">
      <button class="qotd-choice" type="button" data-choice="a">
        <span class="qotd-choice-key">A</span>
        <span class="qotd-choice-text">${esc(q.a)}</span>
      </button>
      <button class="qotd-choice" type="button" data-choice="b">
        <span class="qotd-choice-key">B</span>
        <span class="qotd-choice-text">${esc(q.b)}</span>
      </button>
    </div>
    <p class="form-error" id="qotdErr" role="alert" hidden></p>
    <p class="fine">The split stays hidden until you've voted — the numbers
    aren't even in this page until then, so nobody gets swayed by whoever
    got in first.</p>
  </form>

  <div class="qotd-voted" id="qotdVoted" role="status" tabindex="-1" hidden>
    <p class="qotd-voted-line">You're in — you picked <strong id="qotdMine"></strong>.</p>
    <div class="qotd-actions">
      <button class="btn" id="qotdChange" type="button">Change my vote</button>
    </div>
    <p class="fine">Not your vote, or it's gone missing?
      <a href="#" id="qotdRejoin">Vote fresh →</a></p>
  </div>

  <section class="qotd-results" id="qotdResults" hidden>
    <h2>Where the team landed</h2>
    ${blankBars(q)}
    <p class="fine"><span id="qotdCount"></span>One vote per person is on the
    honour system — this browser remembers yours, but there are no accounts.
    It's a talking point, not a ballot box.</p>
  </section>`;
}

function dailyScript(row, day, qi, q) {
  return `
<script>
(function () {
  var slug = ${sj(row.slug)};
  var day = ${sj(day)};
  var qi = ${sj(qi)};
  var OPT = { a: ${sj(q.a)}, b: ${sj(q.b)} };
  var KEY = "bbb:qotd:" + slug;

  var form = document.getElementById("qotdBallot");
  if (!form) return;
  var results = document.getElementById("qotdResults");
  var voted = document.getElementById("qotdVoted");
  var err = document.getElementById("qotdErr");
  var nameField = document.getElementById("qotdName");
  var buttons = form.querySelectorAll("button[data-choice]");
  var editing = false;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function clearMine() { try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ } }

  var mine = load();
  // The recurring bit: a vote from a previous day is not today's vote.
  // Neither is a vote against a question that has since been swapped
  // out — the organiser skipped, and qi is what tells us, since a skip
  // always lands on a different question. Either way: drop it and let
  // them vote on what's actually on screen.
  if (mine && (mine.day !== day || mine.qi !== qi)) { clearMine(); mine = null; }

  function showBallot() {
    voted.hidden = true;
    results.hidden = true;
    form.hidden = false;
    buttons.forEach(function (b) { b.disabled = false; b.classList.remove("is-sending"); });
  }

  function showVoted(announce) {
    form.hidden = true;
    voted.hidden = false;
    results.hidden = false;
    var pick = mine && mine.choice;
    var label = document.getElementById("qotdMine");
    if (label) label.textContent = (pick && OPT[pick]) || "your side";
    if (pick) {
      var bar = document.querySelector('.qotd-bar[data-choice="' + (pick === "b" ? "b" : "a") + '"]');
      if (bar) bar.classList.add("is-mine");
    }
    // The page hard-reloads after a vote, which a screen reader has no
    // reason to notice. Put the cursor on the confirmation instead.
    if (announce) { try { voted.focus(); } catch (e) { /* older browsers */ } }
  }

  // The numbers are not in this page. We ask for them only once this
  // browser holds a vote for today's question.
  function fill(d) {
    if (!d || d.day !== day || d.qi !== qi) return;
    if (!d.total && mine && mine.token) {
      // Nobody's votes are on today, so ours isn't either — the row went
      // when the organiser skipped. Start clean rather than claim a vote.
      clearMine();
      mine = null;
      showBallot();
      return;
    }
    var pa = d.total ? Math.round((d.a / d.total) * 100) : 0;
    var pct = { a: pa, b: d.total ? 100 - pa : 0 };
    var lead = d.a === d.b ? null : (d.a > d.b ? "a" : "b");
    ["a", "b"].forEach(function (k) {
      var bar = document.querySelector('.qotd-bar[data-choice="' + k + '"]');
      if (!bar) return;
      var n = k === "a" ? d.a : d.b;
      var nEl = bar.querySelector(".qotd-n");
      var uEl = bar.querySelector(".poll-bar-unit");
      var pEl = bar.querySelector(".poll-bar-pct");
      var barFill = bar.querySelector(".poll-bar-track > i");
      if (nEl) nEl.textContent = n;
      if (uEl) uEl.textContent = n === 1 ? "vote" : "votes";
      if (pEl) pEl.textContent = "· " + pct[k] + "%";
      if (barFill) barFill.style.width = (d.total ? pct[k] : 0) + "%";
      if (lead === k) bar.classList.add("is-leader"); else bar.classList.remove("is-leader");
    });
    var count = document.getElementById("qotdCount");
    if (count) count.textContent = d.total + (d.total === 1 ? " vote" : " votes") + " today. ";
  }

  function loadTally() {
    fetch("/api/qotd/" + encodeURIComponent(slug) + "/tally")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(fill)
      .catch(function () { /* the bars just stay empty */ });
  }

  if (mine && mine.token) { showVoted(true); loadTally(); }

  form.addEventListener("submit", function (e) { e.preventDefault(); });

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () { send(btn.getAttribute("data-choice"), btn); });
  });

  function send(choice, btn) {
    if (choice !== "a" && choice !== "b") return;
    err.hidden = true;
    buttons.forEach(function (b) { b.disabled = true; });
    btn.classList.add("is-sending");

    var url = (editing && mine && mine.token) ? "/api/qotd/v/" + mine.token : "/api/qotd/vote";
    // day + qi go with every ballot: the server checks them against what
    // is actually on right now and refuses a vote from a stale page.
    var payload = (editing && mine && mine.token)
      ? { choice: choice, day: day, qi: qi }
      : { slug: slug, choice: choice, day: day, qi: qi, voterName: nameField ? nameField.value.trim() : "" };

    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          // The day rolled over, or the organiser swapped the question,
          // while this page sat open. Show them what's actually on rather
          // than arguing about it in an error message.
          if (d && d.stale) { clearMine(); location.reload(); return; }
          // A stale vote token (yesterday's, or one wiped by a skip) —
          // forget it and let them start clean rather than nagging.
          if (editing && (r.status === 404 || r.status === 409)) { clearMine(); location.reload(); return; }
          throw new Error(d.error || "Server said " + r.status + ".");
        }
        var tok = (editing && mine && mine.token) ? mine.token : d.token;
        save({ day: day, qi: qi, token: tok, choice: choice });
        location.reload();
      });
    }).catch(function (ex) {
      btn.classList.remove("is-sending");
      buttons.forEach(function (b) { b.disabled = false; });
      err.textContent = (ex && ex.message) || "That didn't work — try again.";
      err.hidden = false;
    });
  }

  var changeBtn = document.getElementById("qotdChange");
  if (changeBtn) changeBtn.addEventListener("click", function () {
    editing = true;
    voted.hidden = true;
    form.hidden = false;
    var nf = form.querySelector(".qotd-namefield");
    if (nf) nf.hidden = true;
    var ask = form.querySelector(".qotd-ask");
    if (ask) ask.textContent = "Changed your mind? Tap the other one.";
    form.scrollIntoView({ block: "center" });
  });

  var rejoin = document.getElementById("qotdRejoin");
  if (rejoin) rejoin.addEventListener("click", function (e) {
    e.preventDefault();
    if (!confirm("Forget the vote this browser is holding? Whatever was already cast stays counted in today's split — you just won't be able to change it any more.")) return;
    clearMine();
    location.reload();
  });
})();
</script>`;
}

/** Yesterday + the collapsible archive. Pure history, safe to show. */
function historyBlock(data, createdDay, today, byDay) {
  if (today < 1) {
    return `
  <section class="qotd-history">
    <h2>Yesterday's answer</h2>
    <p class="qotd-empty">Nothing yet — this is day one. Tomorrow's question turns
    up here with today's split beside it.</p>
  </section>`;
  }

  const yDay = today - 1;
  const yt = tallyFor(byDay, yDay);
  const yq = questionForDay(data, yDay, yt);
  const yesterday = `
    <div class="qotd-past">
      <p class="qotd-past-meta">Day ${yDay + 1} · ${esc(dayLabel(createdDay, yDay))}</p>
      <p class="qotd-past-q">${esc(yq.text)}</p>
      ${yt.total
        ? bars(yq, yt) + `<p class="fine">${voteWord(yt.total)} in the end.</p>`
        : `<p class="qotd-empty">Nobody voted on that one. It happens.</p>`}
    </div>`;

  const items = [];
  const from = Math.max(0, today - ARCHIVE_DAYS);
  for (let d = today - 2; d >= from; d--) {
    const t = tallyFor(byDay, d);
    if (!t.total) continue; // quiet days aren't worth a line
    const q = questionForDay(data, d, t);
    items.push(`
      <li class="qotd-archive-item">
        <p class="qotd-archive-meta">Day ${d + 1} · ${esc(dayLabel(createdDay, d))}</p>
        <p class="qotd-archive-q">${esc(q.text)}</p>
        <p class="qotd-archive-split">${miniSplit(q, t)}</p>
      </li>`);
  }

  const archive = items.length ? `
    <details class="qotd-archive">
      <summary>Earlier questions (${items.length})</summary>
      <ul class="qotd-archive-list">${items.join("")}</ul>
      <p class="fine">The last ${ARCHIVE_DAYS} days, minus the days nobody voted.</p>
    </details>` : "";

  return `
  <section class="qotd-history">
    <h2>Yesterday's answer</h2>
    ${yesterday}
    ${archive}
  </section>`;
}

/* ---------- public page (/s/:slug) -------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const createdDay = createdDayOf(row, data);
  const today = dayNumber(createdDay);
  const { index: qi, q } = resolveDay(data, today);

  const parts = await allVotes(env, row.id);
  const byDay = talliesByDay(parts);

  const team = String(data.teamName || "").trim();

  const body = `
<main class="wrap page">
  <p class="kicker">${team ? `${esc(team)} · question of the day` : "Question of the day"}</p>
  <h1 class="qotd-q">${esc(q.text)}</h1>
  <p class="page-sub">Day ${today + 1} · ${esc(dayLabel(createdDay, today))}</p>

  ${dailyBlock(q)}

  ${historyBlock(data, createdDay, today, byDay)}

  <div class="qotd-bookmark pixel-note">
    <strong>Bookmark this link.</strong> A new question lands here every morning
    on its own — same link, no reminders to send, nobody has to remember to
    post anything.
  </div>

  <footer class="page-foot">
    <p class="fine">Your name, if you put one, is visible to whoever set this up.
    Everyone else sees just the two numbers.</p>
    <p><a class="quiet-link" href="/via/qotd">made with biti by bit →</a></p>
  </footer>
</main>
${dailyScript(row, today, qi, q)}`;

  return html(pageShell({
    title: team ? `${team} — question of the day` : "Question of the day",
    body,
    shareType: "qotd", shareSlug: row.slug,
  }));
}

/* ---------- organiser page (/e/:token) ---------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const createdDay = createdDayOf(row, data);
  const today = dayNumber(createdDay);
  const { index: qi, q } = resolveDay(data, today);

  const parts = await allVotes(env, row.id);
  const byDay = talliesByDay(parts);
  const t = tallyFor(byDay, today);

  const team = String(data.teamName || "").trim();
  const custom = customOf(data);
  const liveCustom = custom.filter(Boolean).length;
  const totalVotes = parts.reduce((n, p) => n + (parseVote(p) ? 1 : 0), 0);
  const shareUrl = `${origin}/s/${row.slug}`;

  const customList = liveCustom ? `
  <ul class="qotd-custom">${custom.map((c, k) => c ? `
    <li class="qotd-custom-item">
      <span class="qotd-custom-q">${esc(c.text)}</span>
      <span class="qotd-custom-opts">${esc(c.a)} <em>vs</em> ${esc(c.b)}</span>
      <button class="btn small danger qotd-custom-remove" type="button"
              data-remove="${CUSTOM_BASE + k}">Remove</button>
    </li>` : "").join("")}
  </ul>` : `<p class="qotd-empty">None of your own yet — the shared bank is doing all the work.</p>`;

  /* Old days get shed automatically as new ones land, so nothing ever
     stops working — but the organiser deserves to hear it before the
     archive quietly stops reaching as far back as it used to. */
  const fullWarning = totalVotes >= WARN_AT ? `
  <div class="qotd-explain pixel-note">
    <strong>This one's getting full.</strong> It's holding ${totalVotes} votes of
    the ${MAX_VOTES} it keeps. Nothing breaks: the oldest days are cleared out on
    their own as new votes come in, and today's question always has room. It just
    means the archive won't reach quite as far back as it did.
  </div>` : "";

  const voterNames = t.names.length ? `
  <p class="qotd-voters"><span class="qotd-voters-label">Voted today:</span>
    ${t.names.map((n) => `<span class="qotd-voter">${esc(n.name)} <em>${n.choice.toUpperCase()}</em></span>`).join(" ")}</p>
  <p class="fine">Only you see these names — the shared link shows the two numbers and nothing else.</p>`
    : "";

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. The other link below is the one the team keeps.
  </div>

  <p class="kicker">Organiser view${team ? ` · ${esc(team)}` : ""}</p>
  <h1 class="qotd-q">${esc(q.text)}</h1>
  <p class="page-sub">Day ${today + 1} · ${esc(dayLabel(createdDay, today))} · ${voteWord(t.total)} today · ${totalVotes} all up</p>

  <div class="qotd-explain pixel-note">
    <strong>You don't have to do anything.</strong> The question changes by itself
    at midnight, Sydney time, in the same order every day, forever. No reminder to
    set, no button to press, nothing to post. Share the one link once and it keeps
    going.
  </div>
  ${fullWarning}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link once — it's the same one every day</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge(`🪧 Question of the day${team ? " for " + team : ""} — today's: "${q.text}" — ${q.a} or ${q.b}? Tap and pick. Fresh one every morning, same link: ${shareUrl}`, row.edit_token)}

  ${dailyBlock(q)}
  ${voterNames}

  <h2>Not feeling today's?</h2>
  <p class="lede">Skip it and the next question in your rotation takes its place
  for the rest of the day. Tomorrow carries on as normal. It isn't a permanent
  block — the one you skipped comes back around on the next lap.</p>
  <div class="qotd-toggle-row">
    <button class="btn" id="qotdSkip" type="button">Skip today's question</button>
  </div>
  <p class="fine">Skipping clears any votes already cast today — they were about
  the question you just swapped out. Yesterday and the archive stay put.</p>

  <h2>Add your own</h2>
  <p class="lede">Something only your lot would argue about. Added questions join
  this team's rotation for good — they turn up on the next free day, and then
  again every time the rotation comes round to them.</p>
  <div class="qotd-add panel">
    <label class="field">
      <span>The question</span>
      <input type="text" id="qotdText" maxlength="${MAX_QUESTION}"
             placeholder="Would you rather have the office fridge or the office kettle taken away?">
    </label>
    <div class="qotd-add-row">
      <label class="field">
        <span>Option A</span>
        <input type="text" id="qotdA" maxlength="${MAX_OPTION}" placeholder="Fridge goes">
      </label>
      <label class="field">
        <span>Option B</span>
        <input type="text" id="qotdB" maxlength="${MAX_OPTION}" placeholder="Kettle goes">
      </label>
    </div>
    <button class="btn" id="qotdAdd" type="button">Add it to the rotation</button>
  </div>
  <p class="form-error" id="orgErr" role="alert" hidden></p>
  <p class="qotd-stat">${liveCustom} of your own · ${MAX_CUSTOM} is the limit</p>
  ${customList}

  ${historyBlock(data, createdDay, today, byDay)}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared page</a>
    <button class="btn danger" id="qotdDelete" type="button">Delete this question of the day</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">One vote per person runs on the honour system — no accounts,
    so a keen voter on two devices can vote twice. Fine for a bit of a laugh at
    ten past nine. Deleting is permanent: the shared link stops working
    immediately and every day's votes go with it.</p>
    <p><a class="quiet-link" href="/via/qotd">made with biti by bit →</a></p>
  </footer>
</main>
${dailyScript(row, today, qi, q)}
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
    fetch("/api/qotd/" + token + "/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "That didn't work — try again.");
        after(d);
      });
    }).catch(function (e) {
      orgErr.textContent = (e && e.message) || "That didn't work — try again.";
      orgErr.hidden = false;
      orgErr.scrollIntoView({ block: "center" });
    });
  }

  document.getElementById("qotdSkip").addEventListener("click", function () {
    post("skip", null,
      "Skip today's question? The next one in the rotation takes over for the rest of the day, and any votes cast today are cleared.",
      function () {
        try { localStorage.removeItem("bbb:qotd:" + ${sj(row.slug)}); } catch (e) { /* private mode */ }
        location.reload();
      });
  });

  var addBtn = document.getElementById("qotdAdd");
  function addQuestion() {
    var text = document.getElementById("qotdText").value.trim();
    var a = document.getElementById("qotdA").value.trim();
    var b = document.getElementById("qotdB").value.trim();
    if (!text) { fail("Write the question first."); return; }
    if (!a || !b) { fail("Give it two sides — an A and a B."); return; }
    addBtn.disabled = true;
    post("add", { text: text, a: a, b: b }, null, function (d) {
      var when = (d && d.inDays === 1) ? "tomorrow" : "in " + ((d && d.inDays) || 1) + " days";
      alert("Added — it's queued for " + when + ", and it's in the rotation from now on.");
      location.reload();
    });
    setTimeout(function () { addBtn.disabled = false; }, 2000);
  }
  addBtn.addEventListener("click", addQuestion);
  // Typing three fields and then having to reach for the mouse is a
  // small indignity. Enter does it, same as the poll tool.
  ["qotdText", "qotdA", "qotdB"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addQuestion(); }
    });
  });

  document.querySelectorAll("[data-remove]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      post("remove", { index: Number(btn.getAttribute("data-remove")) },
        "Remove this question of yours? It comes out of the rotation from here on. Days it has already been on keep it, with their votes.",
        function () { location.reload(); });
    });
  });

  function fail(m) {
    orgErr.textContent = m;
    orgErr.hidden = false;
  }

  document.getElementById("qotdDelete").addEventListener("click", function () {
    post("delete", null,
      "Delete this for good? The shared link stops working immediately and every day's votes go with it.",
      function () { location.href = ${sj(HOME)}; });
  });
})();
</script>`;

  return html(pageShell({
    title: `${team ? team + " — " : ""}Question of the day (organiser)`,
    body,
  }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "qotd",

  async api(request, env, url) {
    const p = url.pathname;
    if (!p.startsWith("/api/qotd")) return null;
    let m;
    if (request.method === "GET") {
      // Today's split, for a browser that has voted. Nothing else is GET.
      if ((m = p.match(/^\/api\/qotd\/([a-z0-9-]+)\/tally$/))) return tallyToday(m[1], env);
      return null;
    }
    if (request.method !== "POST") return null;
    if (p === "/api/qotd") return create(request, env);
    if (p === "/api/qotd/vote") return vote(request, env);
    if ((m = p.match(/^\/api\/qotd\/v\/([a-z0-9]+)$/)))
      return changeVote(m[1], request, env);
    if ((m = p.match(/^\/api\/qotd\/([a-z0-9]+)\/(skip|add|remove|delete)$/)))
      return m[2] === "skip" ? skipToday(m[1], env)
        : m[2] === "add" ? addQuestion(m[1], request, env)
        : m[2] === "remove" ? removeQuestion(m[1], request, env)
        : orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
