/* ============================================================
   Meal Train — a roster of meals by date for a new parent,
   someone home from surgery, or a grieving family. Same claims-
   table slot model as Bring a Plate and the Volunteer Roster,
   but keyed by DATE: each day needs one (or a few) cooked meals,
   claimed in the open. The UNIQUE(instance_id, slot_id) constraint
   is the race protection — two people reaching for the same day
   resolve at the database, not in JS.

   Two fields carry weight beyond convenience:
     - allergies / dietary needs are PUBLIC and shown prominently.
       That's a safety feature — everyone dropping a meal must see
       it, so it never hides behind the organiser link.
     - the drop-off address is coordinator-gated. It lives only on
       the /e/ organiser page and never touches the public /s/
       board — a household's home address shouldn't ride on a link
       that gets forwarded around a group chat.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_FORWHOM = 80;
const MAX_NOTE = 400;
const MAX_ALLERGIES = 200;
const MAX_DROPOFF = 120;
const MAX_NAME = 40;
const MAX_DISH = 120;
const MAX_DAYS = 60;
const MAX_CAP = 3;

/* "Other ways to help" — the jobs that aren't meals. A meal train is
   really a special case of a help roster: when something awful
   happens, the people around a family want to walk the dog, do the
   school run, take the washing. Meals are just the socially legible
   version, and the coordinator ends up running the rest by text.

   These reuse the claims table and the same UNIQUE(instance_id,
   slot_id) race protection as the days. Only the slot-id prefix
   differs: t… instead of d….

   Task ids are STABLE and monotonic, never positional. Removing the
   second of four tasks must not silently re-point the third task's
   claims at the fourth — the same index-shifting trap the question
   bank carries a warning about. */
const MAX_TASKS = 12;
const MAX_TASK_LABEL = 70;
const MAX_TASK_CAP = 20;

/* Organiser-supplied links to local places: "can't cook? they love
   the Thai place on High St". Plain outbound links — the site takes
   no cut, brokers nothing and handles no money, which is the same
   line the gift registry holds. */
const MAX_LINKS = 8;
const MAX_LINK_LABEL = 70;
const MAX_LINK_URL = 300;

const NOUNS = ["casserole", "lasagne", "soup", "roast", "curry", "bake",
  "stew", "pie", "hotpot", "ladle"];

const HOME = "/meal-train/";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- dates ------------------------------------------- */
/* Parse a strict "YYYY-MM-DD" into a UTC Date, rejecting anything
   that isn't a real calendar day (e.g. 2026-02-30). Everything is
   done in UTC so the Worker's timezone can't shift a date across a
   midnight boundary. */
function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d)
    return null;
  return dt;
}
function toISO(dt) {
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mo}-${d}`;
}
const fmtDay = (iso) => {
  const d = parseISO(iso);
  return d ? `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}` : iso;
};
const fmtDayLong = (iso) => {
  const d = parseISO(iso);
  return d ? `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]} ${d.getUTCFullYear()}` : iso;
};

/* Slot ids: d<dayIndex>-<n> for meals, t<taskId>-<n> for the other
   jobs. Day indexes are positional because the date list is fixed at
   creation and never reordered; task ids are explicit because tasks
   can be added and removed while the roster is live. */
function slotSet(data) {
  const set = new Set();
  data.dates.forEach((_, i) => {
    for (let n = 1; n <= data.capacityPerDay; n++) set.add(`d${i}-${n}`);
  });
  for (const t of data.tasks || []) {
    for (let n = 1; n <= t.capacity; n++) set.add(`t${t.id}-${n}`);
  }
  return set;
}

/* The meal tally must count meal slots only. Task claims live in the
   same table, so counting rows would report "9 of 6 meals covered"
   the moment anyone offers to walk the dog. */
const mealClaimCount = (claims) =>
  claims.filter((c) => String(c.slot_id).startsWith("d")).length;

const getClaims = async (env, instanceId) =>
  (await env.DB.prepare("SELECT * FROM claims WHERE instance_id = ?")
    .bind(instanceId).all()).results;

/* ---------- validation -------------------------------------- */

/* Tasks arrive as {label, capacity} and leave with a stable id. */
function parseTasks(raw, startId = 1) {
  if (!Array.isArray(raw)) return { tasks: [], nextTaskId: startId };
  const tasks = [];
  let id = startId;
  for (const t of raw.slice(0, MAX_TASKS)) {
    const label = String((t && t.label) || "").trim().replace(/\s+/g, " ").slice(0, MAX_TASK_LABEL);
    if (!label) continue;
    let capacity = Number(t && t.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) capacity = 1;
    capacity = Math.min(capacity, MAX_TASK_CAP);
    tasks.push({ id: id++, label, capacity });
  }
  return { tasks, nextTaskId: id };
}

/* Only http(s) survives. An organiser link is rendered on a page that
   gets forwarded round a school group, so a javascript: or data: URL
   sitting in there would be an XSS vector handed to whoever opens it. */
function safeUrl(raw) {
  const s = String(raw || "").trim().slice(0, MAX_LINK_URL);
  if (!s) return "";
  let u;
  try { u = new URL(s); } catch { return ""; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  return u.href.slice(0, MAX_LINK_URL);
}

function parseLinks(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const l of raw.slice(0, MAX_LINKS)) {
    const url = safeUrl(l && l.url);
    if (!url) continue;
    const label = String((l && l.label) || "").trim().replace(/\s+/g, " ").slice(0, MAX_LINK_LABEL);
    out.push({ label: label || new URL(url).hostname.replace(/^www\./, ""), url });
  }
  return out;
}

function parseCreate(body) {
  const forWhom = String(body.forWhom || "").trim().replace(/\s+/g, " ").slice(0, MAX_FORWHOM);
  if (!forWhom) throw badInput("Who are the meals for? Add a name — a family, a person, whoever.");
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);
  const allergies = String(body.allergies || "").trim().replace(/\s+/g, " ").slice(0, MAX_ALLERGIES);
  const dropoff = String(body.dropoff || "").trim().replace(/\s+/g, " ").slice(0, MAX_DROPOFF);

  let dates = [];
  if (Array.isArray(body.dates) && body.dates.length) {
    const seen = new Set();
    for (const raw of body.dates.slice(0, MAX_DAYS + 1)) { // cap before processing
      const dt = parseISO(raw);
      if (!dt) throw badInput("One of those days isn't a real calendar date.");
      const iso = toISO(dt);
      if (!seen.has(iso)) { seen.add(iso); dates.push(iso); }
    }
    dates.sort();
  } else {
    const start = parseISO(body.startDate);
    if (!start) throw badInput("Pick a valid first day.");
    let days = Number(body.days);
    if (!Number.isInteger(days) || days < 1)
      throw badInput("How many days need a meal? At least one.");
    days = Math.min(days, MAX_DAYS);
    for (let i = 0; i < days; i++)
      dates.push(toISO(new Date(Date.UTC(
        start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i))));
  }
  if (!dates.length) throw badInput("Add at least one day that needs a meal.");
  if (dates.length > MAX_DAYS)
    throw badInput("Sixty days is the limit — start a second roster if it runs longer.");

  let capacityPerDay = Number(body.capacityPerDay);
  if (!Number.isInteger(capacityPerDay) || capacityPerDay < 1) capacityPerDay = 1;
  capacityPerDay = Math.min(capacityPerDay, MAX_CAP);

  const { tasks, nextTaskId } = parseTasks(body.tasks);
  const helpLinks = parseLinks(body.helpLinks);

  return { forWhom, note, allergies, dropoff, dates, capacityPerDay, tasks, nextTaskId, helpLinks };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const parsed = parseCreate(await request.json().catch(() => ({})));
  const { forWhom } = parsed;
  const data = JSON.stringify(parsed);
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "meal", title: `Meals for ${forWhom}`.slice(0, 120), data, nouns: NOUNS,
  });
  await logEvent(env, id, "meal", "created");
  return json({ slug, editToken }, 201);
}

async function claim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "meal") return json({ error: "not found" }, 404);

  const data = JSON.parse(row.data);
  const slotId = String(body.slotId || "");
  if (!slotSet(data).has(slotId))
    throw badInput("That isn't on this roster.");

  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  // Dish is optional — some people sign up before they've decided what to
  // cook. Knowing it helps the family (variety, a dietary cross-check), so
  // the form nudges for it, but an empty one still books the day.
  const dish = String(body.dish || "").trim().replace(/\s+/g, " ").slice(0, MAX_DISH);
  if (!name) throw badInput("Add your name so the family knows who's cooking.");

  const secret = randomString(16);
  try {
    // UNIQUE(instance_id, slot_id) makes this atomic: whoever inserts first
    // holds the day, the other gets a constraint violation.
    await env.DB.prepare(
      `INSERT INTO claims (instance_id, slot_id, name, message, cents, ref, paid, created_at)
       VALUES (?, ?, ?, ?, 0, ?, 0, ?)`
    ).bind(row.id, slotId, name, dish, secret, new Date().toISOString()).run();
  } catch (e) {
    if (/UNIQUE/.test(String(e)))
      return json({ error: "Someone's already taken that one — pick another." }, 409);
    throw e;
  }
  return json({ secret }, 201);
}

async function uncook(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "meal") return json({ error: "not found" }, 404);

  const slotId = String(body.slotId || "");
  const secret = String(body.secret || "");
  if (!slotId || !secret) return json({ error: "That day wasn't found." }, 404);

  const res = await env.DB.prepare(
    "DELETE FROM claims WHERE instance_id = ? AND slot_id = ? AND ref = ?"
  ).bind(row.id, slotId, secret).run();
  if (!res.meta.changes) return json({ error: "That day wasn't found." }, 404);
  return json({ ok: true });
}

async function orgRemove(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "meal") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const slotId = String(body.slotId || "");
  const res = await env.DB.prepare(
    "DELETE FROM claims WHERE instance_id = ? AND slot_id = ?"
  ).bind(row.id, slotId).run();
  if (!res.meta.changes) return json({ error: "That day wasn't found." }, 404);
  return json({ ok: true });
}

/* Compare-and-swap on instances.data. Two coordinator tabs adding a
   job at the same time would otherwise silently lose one of them:
   both read, both write, last write wins. Same helper the poll and
   bracket tools use. */
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
  const e = new Error("Two people edited this roster at once — try again in a moment.");
  e.status = 409;
  throw e;
}

async function orgAddTask(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "meal") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const label = String(body.label || "").trim().replace(/\s+/g, " ").slice(0, MAX_TASK_LABEL);
  if (!label) throw badInput("What's the job? Give it a short name.");
  let capacity = Number(body.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) capacity = 1;
  capacity = Math.min(capacity, MAX_TASK_CAP);

  const next = await mutateData(env, row.id, (data) => {
    const tasks = data.tasks || [];
    if (tasks.length >= MAX_TASKS)
      throw badInput(`That's ${MAX_TASKS} jobs already — plenty to be going on with.`);
    const id = data.nextTaskId || tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    return { ...data, tasks: [...tasks, { id, label, capacity }], nextTaskId: id + 1 };
  });
  const added = next.tasks[next.tasks.length - 1];
  return json({ ok: true, id: added.id });
}

/* Removing a job takes its claims with it. The people who signed up
   lose their slot, which is why the organiser page confirms first. */
async function orgRemoveTask(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "meal") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw badInput("Which job?");

  let found = false;
  await mutateData(env, row.id, (data) => {
    const tasks = data.tasks || [];
    if (!tasks.some((t) => t.id === id)) return data; // already gone
    found = true;
    return { ...data, tasks: tasks.filter((t) => t.id !== id) };
  });
  if (!found) return json({ error: "That job isn't on this roster." }, 404);

  await env.DB.prepare(
    "DELETE FROM claims WHERE instance_id = ? AND (slot_id = ? OR slot_id LIKE ?)"
  ).bind(row.id, `t${id}`, `t${id}-%`).run();
  return json({ ok: true });
}

/* The whole list is replaced in one go — simpler than add/remove for
   a handful of links, and it keeps the organiser UI a single form. */
async function orgSetLinks(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "meal") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.links)) throw badInput("Send a list of links.");
  const overflow = Math.max(0, body.links.length - MAX_LINKS);
  const dropped = body.links.slice(0, MAX_LINKS).filter((l) => l && l.url && !safeUrl(l.url)).length + overflow;
  const helpLinks = parseLinks(body.links);

  await mutateData(env, row.id, (data) => ({ ...data, helpLinks }));
  return json({ ok: true, saved: helpLinks.length, dropped });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "meal") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "meal", "deleted");
  return json({ ok: true });
}

/* Full schedule for the coordinator's CSV — every day slot in order,
   filled or open, gated by the edit token. Cook names are semi-private,
   so this only ever answers a valid organiser link, and never caches. */
async function adminData(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "meal") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);
  const claims = await getClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;

  const rows = [];
  data.dates.forEach((iso, di) => {
    for (let n = 1; n <= data.capacityPerDay; n++) {
      const c = bySlot[`d${di}-${n}`];
      rows.push({ date: fmtDayLong(iso), cook: c ? c.name : "", dish: c ? (c.message || "") : "" });
    }
  });
  /* The other jobs go in the same export. A coordinator who prints the
     roster and finds the dog-walking roster missing has been handed an
     incomplete picture of who is helping. */
  for (const t of data.tasks || []) {
    for (let n = 1; n <= t.capacity; n++) {
      const c = bySlot[`t${t.id}-${n}`];
      rows.push({ date: t.label, cook: c ? c.name : "", dish: c ? (c.message || "") : "" });
    }
  }
  return new Response(
    JSON.stringify({ title: row.title || `Meals for ${data.forWhom}`, forWhom: data.forWhom, rows }),
    { status: 200, headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    } });
}

/* ---------- rendering --------------------------------------- */

/* Allergies / dietary needs are PUBLIC and prominent — the safety
   field. Shown identically on the shared board and the organiser page. */
function allergiesBanner(data) {
  if (!data.allergies) return "";
  return `
  <div class="meal-allergies" role="note">
    <span class="meal-allergies-label">Dietary needs &amp; allergies</span>
    <p class="meal-allergies-text">${esc(data.allergies)}</p>
  </div>`;
}

const noteBlock = (data) =>
  data.note ? `<div class="pixel-note meal-note">${esc(data.note)}</div>` : "";

function subLine(data, mealsCovered) {
  const total = data.dates.length * data.capacityPerDay;
  const n = data.dates.length;
  return `${mealsCovered} of ${total} meals covered · ${n} ${n === 1 ? "day" : "days"}`;
}

/* The non-meal jobs. Same claim mechanics as a day, different
   framing: a job can be a one-off ("mow the lawn") or a standing
   thing ("school run, Tuesdays"), so the label carries the when and
   the capacity is just how many people are needed. */
function taskBoard(data, bySlot, organiser) {
  const tasks = data.tasks || [];
  if (!tasks.length) return "";

  const items = tasks.map((t) => {
    let filled = 0;
    const slots = [];
    for (let n = 1; n <= t.capacity; n++) {
      const sid = `t${t.id}-${n}`;
      const c = bySlot[sid];
      if (c) {
        filled++;
        slots.push(`
        <li class="meal-slot claimed" data-slot="${sid}">
          <span class="meal-cook">${esc(c.name)}</span>${c.message ? `
          <span class="meal-dish">${esc(c.message)}</span>` : ""}${organiser ? `
          <button class="btn ghost meal-mini meal-remove" type="button" data-slot="${sid}">Remove</button>` : ""}
        </li>`);
      } else if (organiser) {
        slots.push(`
        <li class="meal-slot open" data-slot="${sid}">
          <span class="meal-open-label">Open</span>
        </li>`);
      } else {
        slots.push(`
        <li class="meal-slot open" data-slot="${sid}">
          <button class="btn meal-put" type="button">I can do this</button>
          <form class="meal-form" hidden>
            <input type="text" name="name" maxlength="${MAX_NAME}" placeholder="Your name" aria-label="Your name" autocomplete="name">
            <input type="text" name="dish" maxlength="${MAX_DISH}" placeholder="Anything the coordinator should know — optional" aria-label="Note (optional)">
            <div class="meal-form-row">
              <button class="btn primary meal-mini" type="submit">Put me down</button>
              <button class="btn ghost meal-mini meal-cancel" type="button">Never mind</button>
            </div>
            <p class="meal-form-err" hidden></p>
          </form>
        </li>`);
      }
    }
    const full = filled >= t.capacity;
    const status = full
      ? `<span class="meal-day-status covered">sorted ✓</span>`
      : `<span class="meal-day-status open">${filled > 0 ? `${filled} of ${t.capacity}` : "open"}</span>`;
    return `
    <li class="meal-day${full ? " is-covered" : ""}">
      <div class="meal-day-head">
        <span class="meal-day-date">${esc(t.label)}</span>
        ${status}
        ${organiser ? `<button class="btn ghost meal-mini meal-task-del" type="button" data-task="${t.id}">Delete job</button>` : ""}
      </div>
      <ul class="meal-day-slots">${slots.join("")}
      </ul>
    </li>`;
  }).join("");

  return `
  <h2 class="meal-section-h">Other ways to help</h2>
  <p class="meal-intro">Not everyone can cook, and a meal isn't always what's
  needed most. These are the other jobs going.</p>
  <ol class="meal-days">${items}
  </ol>`;
}

/* Local places the coordinator has pointed at. Deliberately dumb
   outbound links: no affiliate codes, no commission, no basket. The
   site doesn't broker any of it and never sees the money. */
function linksBlock(data) {
  const links = data.helpLinks || [];
  if (!links.length) return "";
  const items = links.map((l) => `
      <li><a class="meal-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(l.label)} <span aria-hidden="true">↗</span></a></li>`).join("");
  return `
  <section class="meal-links">
    <h2 class="meal-section-h">Can't cook? These might help</h2>
    <p class="meal-intro">Places the coordinator has suggested — a delivered
    meal, a voucher, a hand from someone local. You arrange it with them
    directly.</p>
    <ul class="meal-link-list">${items}
    </ul>
  </section>`;
}

/* The calendar-ish list of days. Empty days read simply as "open" —
   no red, no urgency. The recipient may well be reading this page. */
function board(data, bySlot, organiser) {
  const days = data.dates.map((iso, di) => {
    let filled = 0;
    const slots = [];
    for (let n = 1; n <= data.capacityPerDay; n++) {
      const sid = `d${di}-${n}`;
      const c = bySlot[sid];
      if (c) {
        filled++;
        slots.push(`
        <li class="meal-slot claimed" data-slot="${sid}">
          <span class="meal-cook">${esc(c.name)}</span>${c.message ? `
          <span class="meal-dish">${esc(c.message)}</span>` : ""}${organiser ? `
          <button class="btn ghost meal-mini meal-remove" type="button" data-slot="${sid}">Remove</button>` : ""}
        </li>`);
      } else if (organiser) {
        slots.push(`
        <li class="meal-slot open" data-slot="${sid}">
          <span class="meal-open-label">Open</span>
        </li>`);
      } else {
        slots.push(`
        <li class="meal-slot open" data-slot="${sid}">
          <button class="btn meal-put" type="button">I'll cook this day</button>
          <form class="meal-form" hidden>
            <input type="text" name="name" maxlength="${MAX_NAME}" placeholder="Your name" aria-label="Your name" autocomplete="name">
            <input type="text" name="dish" maxlength="${MAX_DISH}" placeholder="What you'll bring — optional (helps avoid three lasagnes)" aria-label="What you'll bring (optional)">
            <div class="meal-form-row">
              <button class="btn primary meal-mini" type="submit">Put me down</button>
              <button class="btn ghost meal-mini meal-cancel" type="button">Never mind</button>
            </div>
            <p class="meal-form-err" hidden></p>
          </form>
        </li>`);
      }
    }
    const full = filled >= data.capacityPerDay;
    const status = full
      ? `<span class="meal-day-status covered">covered ✓</span>`
      : `<span class="meal-day-status open">${filled > 0 ? `${filled} of ${data.capacityPerDay}` : "open"}</span>`;
    return `
    <li class="meal-day${full ? " is-covered" : ""}">
      <div class="meal-day-head">
        <span class="meal-day-date">${esc(fmtDay(iso))}</span>
        ${status}
      </div>
      <ul class="meal-day-slots">${slots.join("")}
      </ul>
    </li>`;
  }).join("");
  return `<ol class="meal-days">${days}
  </ol>`;
}

/* ---------- public page (/s/:slug) -------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const claims = await getClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;

  const body = `
<main class="wrap page">
  <p class="kicker">A meal roster</p>
  <h1>Meals for ${esc(data.forWhom)}</h1>
  <p class="page-sub">${subLine(data, mealClaimCount(claims))}</p>
  ${allergiesBanner(data)}
  ${noteBlock(data)}

  <p class="meal-intro">Pick a day you can cook and put your name down. No
  account, no fuss — just a warm meal turning up when it's needed most. Not
  sure what to make? Leave the dish blank and decide closer to the day.</p>

  ${board(data, bySlot, false)}

  ${taskBoard(data, bySlot, false)}

  ${linksBlock(data)}

  <footer class="page-foot">
    <p class="fine">No accounts — this browser remembers the days you took, and
    you can hand one back if life gets in the way. On someone else's phone? Ask
    the coordinator to shuffle things. The coordinator will pass on where and
    when to drop the meal once you've claimed a day.</p>
    <p><a class="quiet-link" href="/via/meal">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var KEY = "bbb:meal:" + slug;

  function mine() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveMine(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function cardFor(slotId) {
    if (!/^[dt]\\d+-\\d+$/.test(slotId)) return null;
    return document.querySelector('.meal-slot.claimed[data-slot="' + slotId + '"]');
  }
  var norm = function (t) { return String(t || "").trim().replace(/\\s+/g, " ").slice(0, 40); };

  /* ---- your own days: badge + hand back ---- */
  var list = mine().filter(function (c) {
    var card = cardFor(c.slotId);
    if (!card) return false; // opened up again (coordinator removed it, or someone else holds it)
    var cookEl = card.querySelector(".meal-cook");
    // Compare against the server's whitespace normalisation, or a day someone
    // else re-took would still look like ours.
    return cookEl && norm(cookEl.textContent) === norm(c.cook);
  });
  saveMine(list);

  list.forEach(function (c) {
    var card = cardFor(c.slotId);
    var badge = document.createElement("span");
    badge.className = "meal-you";
    badge.textContent = "that's you";
    card.insertBefore(badge, card.firstChild);

    var undo = document.createElement("button");
    undo.type = "button";
    undo.className = "btn ghost meal-mini";
    undo.textContent = "Can't make it?";
    undo.addEventListener("click", function () {
      if (!confirm("Take your name off this day? It opens up for someone else.")) return;
      fetch("/api/meal/uncook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug, slotId: c.slotId, secret: c.secret }),
      }).then(function (r) {
        if (!r.ok && r.status !== 404) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); });
        saveMine(mine().filter(function (x) { return x.slotId !== c.slotId; }));
        location.reload();
      }).catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
    card.appendChild(undo);
  });

  /* ---- open days: reveal the mini-form, claim ---- */
  document.querySelectorAll(".meal-slot.open").forEach(function (card) {
    var put = card.querySelector(".meal-put");
    var form = card.querySelector(".meal-form");
    if (!put || !form) return;
    var nameInput = form.querySelector('input[name="name"]');
    var dishInput = form.querySelector('input[name="dish"]');
    var submitBtn = form.querySelector('button[type="submit"]');
    var err = form.querySelector(".meal-form-err");

    put.addEventListener("click", function () {
      put.hidden = true;
      form.hidden = false;
      nameInput.focus();
    });
    form.querySelector(".meal-cancel").addEventListener("click", function () {
      form.hidden = true;
      err.hidden = true;
      put.hidden = false;
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var name = nameInput.value.trim();
      var dish = dishInput.value.trim();
      if (!name) return fail("Your name first — so the family knows who's cooking.");

      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      fetch("/api/meal/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: slug, slotId: card.getAttribute("data-slot"), name: name, dish: dish,
        }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 409) {
            fail(d.error || "Someone's already taken that one — pick another.");
            setTimeout(function () { location.reload(); }, 2000);
            return;
          }
          if (!r.ok) throw new Error(d.error || "Server said " + r.status + ".");
          var l = mine();
          l.push({ slotId: card.getAttribute("data-slot"), secret: d.secret, cook: name });
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
        submitBtn.textContent = "Put me down";
        return false;
      }
    });
  });
})();
</script>`;
  return html(pageShell({ title: `Meals for ${data.forWhom}`, body, shareType: "meal", shareSlug: row.slug }));
}

/* ---------- organiser page (/e/:token) ---------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const claims = await getClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;
  const shareUrl = `${origin}/s/${row.slug}`;

  const dropoffBlock = data.dropoff
    ? `
  <div class="meal-dropoff">
    <span class="meal-dropoff-label">Drop-off details — only you see this</span>
    <p class="meal-dropoff-text">${esc(data.dropoff)}</p>
    <p class="fine">This never appears on the shared board — a home address
    shouldn't ride on a link that gets forwarded around. Pass it to each cook
    directly once they've claimed a day.</p>
  </div>`
    : `<p class="fine meal-dropoff-empty">No drop-off address saved — keeping it
    off the shared board is the safe default. Share it with each cook directly
    once they claim a day.</p>`;

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your coordinator page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with everyone else.
  </div>

  <p class="kicker">Coordinator view</p>
  <h1>Meals for ${esc(data.forWhom)}</h1>
  <p class="page-sub">${subLine(data, mealClaimCount(claims))}</p>
  ${allergiesBanner(data)}
  ${noteBlock(data)}
  ${dropoffBlock}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with friends, family and neighbours</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🍲 We're setting up meals for " + data.forWhom + " — grab a day you can cook a meal (takes 20 seconds, no sign-up): " + shareUrl)}

  <div class="meal-tools">
    <button class="btn" id="csvBtn" type="button">Download schedule (CSV)</button>
    <button class="btn" id="printBtn" type="button">Print this roster</button>
  </div>

  ${board(data, bySlot, true)}

  ${taskBoard(data, bySlot, true)}

  <section class="meal-admin">
    <h2 class="meal-section-h">Add another way to help</h2>
    <p class="meal-intro">Not everyone cooks. Add the other jobs that would
    actually take weight off — a school run, the dog, a load of washing, the
    lawn. Say when it is in the name: “School pickup, Tuesdays”.</p>
    <form id="taskForm" class="meal-admin-form">
      <input type="text" id="taskLabel" maxlength="${MAX_TASK_LABEL}" placeholder="e.g. Walk Ruby — weekday evenings" aria-label="What's the job?" required>
      <label class="meal-admin-cap">How many people?
        <input type="number" id="taskCap" min="1" max="${MAX_TASK_CAP}" value="1" aria-label="How many people are needed">
      </label>
      <button class="btn primary" type="submit">Add the job</button>
      <p class="meal-form-err" id="taskErr" hidden></p>
    </form>
  </section>

  <section class="meal-admin">
    <h2 class="meal-section-h">Local places that could help</h2>
    <p class="meal-intro">Somewhere that delivers, does vouchers, or would drop
    a hamper round. People who can't cook still want to do something. You
    arrange it with the business directly — this is just a list of links, and
    nothing here goes through us.</p>
    <div id="linkRows"></div>
    <div class="meal-admin-form">
      <button class="btn" id="addLinkRow" type="button">Add a place</button>
      <button class="btn primary" id="saveLinks" type="button">Save the list</button>
      <p class="meal-form-err" id="linkErr" hidden></p>
      <p class="fine" id="linkOk" hidden>Saved.</p>
    </div>
  </section>

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared board</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this roster</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Removing a name opens the day straight back up — maybe give
    the person a heads-up first. To take a day yourself, use the shared link like
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

  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });

  /* ---- other ways to help: add a job ---- */
  function post(path, body) {
    return fetch("/api/meal/" + token + "/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "That didn't work — try again.");
        return d;
      });
    });
  }
  function showErr(el, e) {
    el.textContent = (e && e.message) || "That didn't work — try again.";
    el.hidden = false;
  }

  document.getElementById("taskForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = document.getElementById("taskErr");
    err.hidden = true;
    var label = document.getElementById("taskLabel").value;
    var cap = parseInt(document.getElementById("taskCap").value, 10) || 1;
    post("addTask", { label: label, capacity: cap })
      .then(function () { location.reload(); })
      .catch(function (e) { showErr(err, e); });
  });

  document.querySelectorAll(".meal-task-del").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!confirm("Delete this job? Anyone who signed up for it loses their spot.")) return;
      post("removeTask", { id: parseInt(b.getAttribute("data-task"), 10) })
        .then(function () { location.reload(); })
        .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  });

  /* ---- local places: edit the whole list, save in one go ---- */
  var LINKS = ${JSON.stringify((JSON.parse(row.data).helpLinks) || [])};
  var rows = document.getElementById("linkRows");

  function addRow(label, url) {
    var wrap = document.createElement("div");
    wrap.className = "meal-admin-form meal-link-row";
    var l = document.createElement("input");
    l.type = "text"; l.maxLength = ${MAX_LINK_LABEL}; l.placeholder = "Name — e.g. Thai place on High St";
    l.setAttribute("aria-label", "Name of the place"); l.value = label || "";
    var u = document.createElement("input");
    u.type = "url"; u.maxLength = ${MAX_LINK_URL}; u.placeholder = "https://…";
    u.setAttribute("aria-label", "Link"); u.value = url || "";
    var x = document.createElement("button");
    x.type = "button"; x.className = "btn ghost meal-mini"; x.textContent = "Remove";
    x.addEventListener("click", function () { wrap.remove(); });
    wrap.appendChild(l); wrap.appendChild(u); wrap.appendChild(x);
    rows.appendChild(wrap);
  }
  LINKS.forEach(function (l) { addRow(l.label, l.url); });
  if (!LINKS.length) addRow("", "");

  document.getElementById("addLinkRow").addEventListener("click", function () { addRow("", ""); });

  document.getElementById("saveLinks").addEventListener("click", function () {
    var err = document.getElementById("linkErr");
    var ok = document.getElementById("linkOk");
    err.hidden = true; ok.hidden = true;
    var list = [];
    rows.querySelectorAll(".meal-link-row").forEach(function (w) {
      var ins = w.querySelectorAll("input");
      if (ins[1].value.trim()) list.push({ label: ins[0].value, url: ins[1].value });
    });
    post("setLinks", { links: list }).then(function (d) {
      if (d.dropped) {
        err.textContent = d.dropped + (d.dropped === 1 ? " link was" : " links were") +
          " skipped — a link has to start with http:// or https://.";
        err.hidden = false;
      }
      ok.hidden = false;
      setTimeout(function () { location.reload(); }, 700);
    }).catch(function (e) { showErr(err, e); });
  });

  /* ---- CSV export, built client-side from the admin endpoint ---- */
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    // Formula-injection guard: a spreadsheet treats a cell starting with
    // = + - @ (or a control char) as a formula. Prefix an apostrophe so it
    // stays plain text.
    if (/^[=+\\-@\\t\\r]/.test(s)) s = "'" + s;
    if (/[",\\n\\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function slugName(t) {
    return (String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "meal-train");
  }
  document.getElementById("csvBtn").addEventListener("click", function () {
    var btn = this;
    btn.disabled = true;
    var old = btn.textContent;
    btn.textContent = "Building…";
    fetch("/api/meal/" + token + "/admin")
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "Couldn't fetch the schedule."); });
        return r.json();
      })
      .then(function (d) {
        var lines = ["Date,Cook,Dish"];
        (d.rows || []).forEach(function (row) {
          lines.push([csvCell(row.date), csvCell(row.cook), csvCell(row.dish)].join(","));
        });
        // BOM so Excel reads UTF-8 names correctly.
        var blob = new Blob(["\\ufeff" + lines.join("\\r\\n")], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "meal-train-" + slugName(d.forWhom || d.title) + ".csv";
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

  document.querySelectorAll(".meal-remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!confirm("Remove this name? The day opens up again.")) return;
      fetch("/api/meal/" + token + "/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: btn.getAttribute("data-slot") }),
      }).then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.reload(); })
        .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  });

  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this roster for good? The shared link will stop working.")) return;
    fetch("/api/meal/" + token + "/delete", { method: "POST" })
      .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  });
})();
</script>`;
  return html(pageShell({ title: `Meals for ${data.forWhom} (coordinator)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "meal",

  async api(request, env, url) {
    const p = url.pathname;
    if (!p.startsWith("/api/meal")) return null;

    let m;
    if (request.method === "GET") {
      if ((m = p.match(/^\/api\/meal\/([a-z0-9]+)\/admin$/))) return adminData(m[1], env);
      return null;
    }
    if (request.method !== "POST") return null;

    if (p === "/api/meal") return create(request, env);
    if (p === "/api/meal/claim") return claim(request, env);
    if (p === "/api/meal/uncook") return uncook(request, env);
    if ((m = p.match(/^\/api\/meal\/([a-z0-9]+)\/(remove|delete|addTask|removeTask|setLinks)$/))) {
      if (m[2] === "remove") return orgRemove(m[1], request, env);
      if (m[2] === "delete") return orgDelete(m[1], env);
      if (m[2] === "addTask") return orgAddTask(m[1], request, env);
      if (m[2] === "removeTask") return orgRemoveTask(m[1], request, env);
      return orgSetLinks(m[1], request, env);
    }
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
