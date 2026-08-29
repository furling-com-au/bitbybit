/* ============================================================
   Meal train — the live preview, shared by both sides.

   Same arrangement as preview/roster.js: plain ESM under public/, so
   the browser fetches it and the Worker can import it, and there is
   one copy of the rendering rather than one per consumer.

   IT ALSO ABSORBS A DUPLICATE THAT WAS ALREADY HERE.
   public/meal.js carried its own parseISO / toISO / fmtDay under a
   comment reading "all in UTC, mirroring the server". Mirroring by
   hand is the thing that stops being true quietly. These now live in
   one place and meal.js imports them.

   UTC throughout, deliberately, and for the same reason the server
   does it: a meal train is a list of calendar days, and doing the
   arithmetic in local time lets a browser west of the line render a
   roster starting the day before the one that was typed.

   THE DATE PROBLEM, AND WHY THE BOX HAS A FIXED HEIGHT.
   The start date ships EMPTY in the HTML and public/meal.js seeds it
   to tomorrow on load. That default cannot be baked — a date written
   into the page at build time is wrong the next morning, which is the
   same trap the seasonal card in src/worker.js documents.

   So the first frame here is a one-line placeholder and the real board
   arrives a few milliseconds later, after paint, with no user action to
   excuse the shift. The fix is not to bake the date, it is to stop the
   swap from moving anything: #mealPreview has a FIXED height in
   styles.css and scrolls internally, so the placeholder and a sixty-day
   roster occupy exactly the same space. Same principle as the
   width/height check-hero-loading.mjs insists on for images — reserve
   the box, then whatever lands in it costs nothing.
   ============================================================ */

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const MAX_DAYS = 60;

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* Strict YYYY-MM-DD, rejecting dates that do not exist (2026-02-30). */
export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function toISO(dt) {
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mo}-${d}`;
}

export function fmtDay(iso) {
  const d = parseISO(iso);
  return d ? `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}` : iso;
}

/* first day + how many + the gap between them. spacing is 1, 2 or 7. */
export function buildDates(firstDate, meals, spacing) {
  const start = parseISO(firstDate);
  if (!start) return [];
  let count = parseInt(meals, 10);
  if (!Number.isFinite(count) || count < 1) count = 0;
  count = Math.min(count, MAX_DAYS);
  const step = parseInt(spacing, 10) || 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(toISO(new Date(Date.UTC(
      start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i * step))));
  }
  return out;
}

/* Spoken on every keystroke, so it stays one line. See the note in
   preview/roster.js about why the board itself is not a live region. */
export function previewSummary(dates, capacity) {
  if (!dates.length) return "";
  const cap = parseInt(capacity, 10) || 1;
  const meals = dates.length * cap;
  const span = dates.length > 1
    ? `${fmtDay(dates[0])} to ${fmtDay(dates[dates.length - 1])}`
    : fmtDay(dates[0]);
  return `${meals} ${meals === 1 ? "meal" : "meals"} over ` +
    `${dates.length} ${dates.length === 1 ? "day" : "days"} — ${span}`;
}

/* The board, in the same .meal-day / .meal-slot shape the real /s/ page
   renders — minus every control. A preview offering "I can do this" would
   be lying about what it is.

   The allergies line is included because it demonstrates a real feature
   rather than decorating one: dietary needs sit at the TOP of the board
   where nobody can miss them, and that used to be a sentence. Only shown
   once the coordinator has typed something into it. */
export const SHOW_DAYS = 3;

export function renderMealPreview(dates, capacity, allergies) {
  if (!dates.length) return "";
  const cap = Math.min(3, Math.max(1, parseInt(capacity, 10) || 1));

  const banner = String(allergies || "").trim()
    ? `
  <p class="meal-allergies-preview"><strong>Dietary needs:</strong> ${esc(allergies.trim())}</p>`
    : "";

  const shown = dates.slice(0, SHOW_DAYS);
  const rest = dates.length - shown.length;

  const days = shown.map((iso) => {
    const slots = Array.from({ length: cap }, () =>
      `\n      <li class="meal-slot open"><span class="meal-open-label">Open</span></li>`
    ).join("");
    return `
  <li class="meal-day">
    <div class="meal-day-head">
      <span class="meal-day-date">${esc(fmtDay(iso))}</span>
      <span class="meal-day-status open">open</span>
    </div>
    <ul class="meal-day-slots">${slots}
    </ul>
  </li>`;
  }).join("");

  /* Counted, not drawn. Sixty days rendered in full would scroll inside a
     form — which traps a thumb — or push the submit button most of a
     screen further away. The label above already gives the full span. */
  const more = rest
    ? `
  <p class="live-preview-more">&hellip; and ${rest} more ${rest === 1 ? "day" : "days"}, through to ${esc(fmtDay(dates[dates.length - 1]))}</p>`
    : "";

  return `${banner}
  <ol class="meal-days">${days}
  </ol>${more}`;
}

/* ---------- the build-time contract -------------------------- */

export const PREVIEW_IDS = { label: "mealPreviewLabel", board: "mealPreview" };

export const PAGE_INPUTS = {
  firstDate: /<input type="date" id="firstDate"[^>]*?(?:value="([^"]*)")?[^>]*>/,
  meals: /<input[^>]*id="meals"[^>]*value="([^"]*)"/,
  spacing: /<select id="spacing">[\s\S]*?<option value="([^"]*)" selected>/,
  capacity: /<select id="capacity">[\s\S]*?<option value="([^"]*)" selected>/,
  allergies: /<input[^>]*id="allergies"[^>]*?(?:value="([^"]*)")?[^>]*>/,
};

/* There is always a frame — a placeholder when no date has been chosen, so
   the box is never an empty dashed rectangle and the no-JS case still reads
   as something rather than as breakage. */
export const REQUIRE_FIRST_FRAME = true;

const PLACEHOLDER =
  `<p class="live-preview-empty">Pick a first day and the roster lays itself out here.</p>`;

export function firstFrame({ firstDate, meals, spacing, capacity, allergies }) {
  const dates = buildDates(firstDate, meals, spacing);
  return {
    summary: previewSummary(dates, capacity),
    board: dates.length ? renderMealPreview(dates, capacity, allergies) : PLACEHOLDER,
  };
}
