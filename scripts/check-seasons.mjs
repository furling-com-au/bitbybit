/* Prove the homepage seasonal card covers every day of the year exactly once.
 *
 * The card used to be hard-coded in public/index.html reading "Footy finals ·
 * September". Nothing rotated it, so it was wrong for ten months of the year
 * and would have stayed wrong for as long as nobody deployed. It is now
 * computed per request from the clock.
 *
 * That trades one failure for two subtler ones, and this checks both:
 *
 *   A GAP - a date no window claims - shows a visitor whatever the fallback
 *   is, on a page where the card is the first thing under the fold. A single
 *   missed day between two windows would be invisible until it happened, and
 *   then invisible again the next day.
 *
 *   An OVERLAP means two windows both claim a date and which one wins depends
 *   on array order, which nobody editing the list will be thinking about.
 *
 * Also checks each season points at a page and an icon that really exist,
 * because a seasonal card is the one thing on the site nobody looks at in the
 * ten months it is not showing.
 *
 * SEASONS is read out of src/worker.js at run time, not copied here.
 */
import { readFileSync, existsSync } from "node:fs";

const src = readFileSync("src/worker.js", "utf8");
const m = src.match(/const SEASONS = \[[\s\S]*?\n\];/);
if (!m) {
  console.error("\n  ! SEASONS not found in src/worker.js — it was renamed or removed,");
  console.error("  ! and the homepage card is now unchecked.\n");
  process.exit(1);
}
const pick = src.match(/function pickSeason\(md\) \{[\s\S]*?\n\}/);
if (!pick) {
  console.error("\n  ! pickSeason() not found in src/worker.js.\n");
  process.exit(1);
}
/* Both out of ONE evaluation. Building them separately gives pickSeason its
   own copy of SEASONS, and then the identity check below compares objects
   from two different arrays and always fails. */
const { SEASONS, pickSeason } =
  new Function(`${m[0]}; ${pick[0]}; return { SEASONS, pickSeason };`)();

const problems = [];

/* Every day of a leap year, so 02-29 is covered too. */
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const claims = new Map();
for (let mo = 1; mo <= 12; mo++) {
  for (let d = 1; d <= DAYS_IN[mo - 1]; d++) {
    const md = `${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hits = SEASONS.filter((s) => {
      const wraps = s.from > s.to;
      return wraps ? (md >= s.from || md <= s.to) : (md >= s.from && md <= s.to);
    });
    claims.set(md, hits);
  }
}

const gaps = [...claims].filter(([, h]) => h.length === 0).map(([d]) => d);
const overlaps = [...claims].filter(([, h]) => h.length > 1);

if (gaps.length) {
  problems.push(`${gaps.length} day(s) claimed by no season: ${gaps.slice(0, 8).join(", ")}${gaps.length > 8 ? ` and ${gaps.length - 8} more` : ""}`);
}
for (const [day, hits] of overlaps.slice(0, 6)) {
  problems.push(`${day} claimed by ${hits.length} seasons: ${hits.map((h) => h.title).join(" / ")}`);
}
if (overlaps.length > 6) problems.push(`…and ${overlaps.length - 6} more overlapping days`);

/* Every season must land somewhere real. */
for (const s of SEASONS) {
  const page = `public${s.href.replace(/\/?$/, "/")}index.html`;
  if (!existsSync(page)) problems.push(`${s.title}: href ${s.href} has no page at ${page}`);
  if (!existsSync(`public/icons/${s.icon}`)) problems.push(`${s.title}: icon ${s.icon} does not exist`);
  if (!/^\d{2}-\d{2}$/.test(s.from) || !/^\d{2}-\d{2}$/.test(s.to)) {
    problems.push(`${s.title}: from/to must be "MM-DD", got "${s.from}".."${s.to}"`);
  }
  for (const f of ["tag", "title", "blurb"]) {
    if (!s[f] || !String(s[f]).trim()) problems.push(`${s.title || s.href}: empty ${f}`);
  }
  /* The markup is injected with {html:true}, so a stray < or & would break
     the card rather than render. */
  if (/[<>]/.test(`${s.tag}${s.title}${s.blurb}`)) {
    problems.push(`${s.title}: tag/title/blurb must not contain < or >`);
  }
}

/* And the picker must actually agree with the tiling. */
for (const [md, hits] of claims) {
  if (hits.length === 1 && pickSeason(md) !== hits[0]) {
    problems.push(`pickSeason("${md}") disagrees with the only season claiming it`);
    break;
  }
}

/* The sweep's "what's next" banner duplicates two of these boundaries.
 *
 * src/tools/sweep.js cannot import SEASONS - worker.js imports sweep.js, so
 * the dependency only runs one way - and a settled Cup sweep pointing at Kris
 * Kringle on a different day from the homepage card is the kind of drift
 * nobody notices, because both halves look right in isolation and they are
 * only ever wrong together for a few days a year.
 *
 * So the copy is allowed, and checked. SEASON_ENDS must hold the CLOSING day
 * of each matching window, keyed by the sweep kind. */
const sweepSrc = readFileSync("src/tools/sweep.js", "utf8");
const se = sweepSrc.match(/const SEASON_ENDS = \{[\s\S]*?\};/);
if (!se) {
  problems.push("SEASON_ENDS not found in src/tools/sweep.js - the sweep's season banner is now unchecked");
} else {
  const SEASON_ENDS = new Function(`${se[0]}; return SEASON_ENDS;`)();
  const endOf = (href) => (SEASONS.find((s) => s.href === href) || {}).to;
  for (const [kind, href] of [["gf", "/grand-final-sweep"], ["cup", "/melbourne-cup-sweep"]]) {
    const want = endOf(href);
    if (!want) {
      problems.push(`SEASONS has no window for ${href}, so SEASON_ENDS.${kind} cannot be checked`);
    } else if (SEASON_ENDS[kind] !== want) {
      problems.push(
        `SEASON_ENDS.${kind} is "${SEASON_ENDS[kind]}" but the ${href} window closes "${want}" ` +
        `- a settled sweep would point at the next tool on a different day from the homepage card`);
    }
  }
}

const covered = [...claims].filter(([, h]) => h.length === 1).length;
console.log(`seasons: ${SEASONS.length} windows, ${covered}/${claims.size} days covered exactly once`);

if (problems.length) {
  console.error("\n  ! The homepage seasonal card does not tile the year cleanly.\n");
  for (const p of problems) console.error(`      ${p}`);
  console.error("");
  process.exit(1);
}
