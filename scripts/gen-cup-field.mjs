/* Render each Melbourne Cup year page's field block from scripts/cup-field.json.
 * Run: node scripts/gen-cup-field.mjs
 *
 * WHY A GENERATOR FOR ONE TABLE
 *
 * The field of 24 is declared the Saturday before the race — 31 October for
 * the 2026 Cup, three days out. That is the worst possible moment to be
 * hand-editing a table in HTML: one afternoon, real traffic arriving, and a
 * mistyped barrier number that nothing would catch. So the page ships in
 * September with the block generated empty, and the job on the Saturday is to
 * paste 24 rows into a JSON file and run the build.
 *
 * The same reasoning as gen-live-preview.mjs: the page owns the words, this
 * owns the part that changes, and the fence marks the seam.
 *
 * TWO STATES, BOTH USEFUL
 *
 * Empty runners renders the draw-by-numbers explanation, which is the correct
 * advice for anyone running a sweep before the field exists — and that is most
 * of October. A filled list renders the runner table. The page is never a stub
 * waiting for data and never claims a field it does not have.
 *
 * WHAT IT REFUSES TO SHIP
 *
 * A partial field. Pasting 18 of 24 rows on the Saturday is a far more likely
 * mistake than pasting none, and it would render a table that looks finished
 * and is wrong. So a non-empty list must be exactly 24 runners numbered 1-24
 * with no repeats, or the build fails and says which numbers are missing.
 *
 * A field that does not exist yet. This one is written from experience: while
 * building the page I pasted twenty-four past Cup runners with invented
 * barrier numbers, purely to exercise the declared branch, and the only thing
 * that stopped them shipping was remembering to undo it before the next
 * build. On a page whose whole job is telling somebody which horse is number
 * seven, a reader has no way to know an invented barrier is invented.
 *
 * So runners dated before declaredOn now fail the build outright. It is not a
 * warning, because the failure mode is silent and the cost of it is a page
 * confidently stating fiction. Pass --preview to render them anyway for a
 * visual check; the next ordinary build fails again, which is the point — you
 * cannot deploy without building.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DATA = "scripts/cup-field.json";
const FENCE = /([ \t]*)<!-- cup-field:start -->[\s\S]*?<!-- cup-field:end -->/;
const FIELD_SIZE = 24;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* "2026-11-03" -> "Tuesday 3 November 2026". The site writes dates in words,
   and a page about one specific race should not make anyone parse an ISO
   string to find out when it is. */
function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

/* Short form for a chip: "Sat 31 Oct". */
const shortDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
};

/* The three dates that decide what an organiser does, as a sequence rather
   than a paragraph. Generated so they cannot drift from cup-field.json. */
const timeline = (declaredOn, raceDate) => `<ol class="timeline">
      <li>
        <b>Any time now</b>
        <strong>Draw the numbers</strong>
        <span>1 to 24. Just as random before the field exists as after.</span>
      </li>
      <li>
        <b>${shortDate(declaredOn)}</b>
        <strong>Field declared</strong>
        <span>Final acceptances and the barrier draw. This page fills in.</span>
      </li>
      <li class="is-race">
        <b>${shortDate(raceDate)}</b>
        <strong>They jump at 3:00pm</strong>
        <span>Match your numbers to the saddlecloths and watch.</span>
      </li>
    </ol>`;

/* The 24 saddlecloths, which are the thing a sweep actually draws from.
   ONE component for both states: numbers alone before the field is
   declared - which is literally what you are drawing, so the advice needs
   no paragraph - and the same cells carrying horse names afterwards. */
const saddles = (runners) => `<ol class="saddles">
${Array.from({ length: FIELD_SIZE }, (_, i) => {
  const r = runners.find((x) => Number(x.no) === i + 1);
  return `        <li><span class="n">${i + 1}</span>` +
    (r ? `<span class="h">${esc(r.horse)}</span><span class="b">Barrier ${esc(r.barrier)}</span>` : "") +
    `</li>`;
}).join("\n")}
    </ol>`;

const fieldBlock = (year, y) => {
  const runners = y.runners || [];
  const lead = runners.length
    ? `<p>The declared field for the ${year} Melbourne Cup, by saddlecloth
    number &mdash; the list to draw from.</p>`
    : `<p>Not declared until <strong>${longDate(y.declaredOn)}</strong>. Until
    then these are the twenty-four you draw, and the numbers are all you need
    &mdash; names get matched to them on the day.</p>`;
  return `${timeline(y.declaredOn, y.raceDate)}

    <h3>${runners.length ? "The field" : "The twenty-four"}</h3>
    ${lead}
    ${saddles(runners)}`;
};

const data = JSON.parse(readFileSync(DATA, "utf8"));
const problems = [];
let written = 0, already = 0, empty = 0;

const PREVIEW = process.argv.includes("--preview");

const daysUntil = (iso) =>
  Math.ceil((Date.parse(iso + "T00:00:00Z") - Date.parse(todayInSydney() + "T00:00:00Z")) / 86400000);

/* Australian local date, because the field is declared on an Australian
   Saturday and a build machine on UTC is eleven hours behind it. */
const todayInSydney = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });

for (const [year, y] of Object.entries(data.years)) {
  const file = `public/melbourne-cup-sweep/${year}/index.html`;
  if (!existsSync(file)) {
    problems.push(`${DATA} has ${year} but there is no page at ${file}`);
    continue;
  }
  const html = readFileSync(file, "utf8");
  const fence = html.match(FENCE);
  if (!fence) {
    problems.push(`${file} has no <!-- cup-field --> fence to render into`);
    continue;
  }

  const runners = y.runners || [];

  /* Runners cannot exist before the day they are declared. */
  if (runners.length && todayInSydney() < y.declaredOn) {
    if (!PREVIEW) {
      problems.push(
        `${year}: the field is not declared until ${y.declaredOn} (today is ` +
        `${todayInSydney()} in Sydney), but ${DATA} already lists ` +
        `${runners.length} runners. A field that does not exist yet must not ` +
        `ship. Clear them, or pass --preview to render locally for a look.`);
      continue;
    }
    console.warn(
      `
  ! PREVIEW ONLY — ${year} runners rendered ${daysUntil(y.declaredOn)} day(s) ` +
      `before the field is declared.
  ! This page must not be committed or deployed. ` +
      `The next plain build will fail until ${DATA} is cleared.
`);
  }

  if (runners.length) {
    /* A partial or mis-numbered paste must never render as a finished table. */
    const nums = runners.map((r) => Number(r.no));
    const missing = Array.from({ length: FIELD_SIZE }, (_, i) => i + 1)
      .filter((n) => !nums.includes(n));
    if (runners.length !== FIELD_SIZE || missing.length) {
      problems.push(
        `${year}: the field must be ${FIELD_SIZE} runners numbered 1-${FIELD_SIZE} — ` +
        `got ${runners.length}${missing.length ? `, missing ${missing.join(", ")}` : ""}`);
      continue;
    }
    if (new Set(nums).size !== nums.length)
      { problems.push(`${year}: two runners share a saddlecloth number`); continue; }
    runners.sort((a, b) => a.no - b.no);
  } else {
    empty++;
  }

  const body = fieldBlock(year, y);

  /* The facts strip at the top of the page states the race date in its own
     words. It is not generated - it is the page's headline - so it can drift
     from cup-field.json without anything noticing. Check it. */
  if (!html.includes(longDate(y.raceDate))) {
    problems.push(
      `${file} does not state "${longDate(y.raceDate)}" anywhere, but that is ` +
      `the race date in ${DATA} — the page and the data disagree`);
    continue;
  }

  const indent = fence[1];
  const block =
    `${indent}<!-- cup-field:start -->\n` +
    `${indent}<!-- Generated by scripts/gen-cup-field.mjs from scripts/cup-field.json.\n` +
    `${indent}     Do not edit by hand — the next build will overwrite it. -->\n` +
    `${indent}${body}\n` +
    `${indent}<!-- cup-field:end -->`;

  const next = html.replace(FENCE, block);
  if (next === html) { already++; continue; }
  writeFileSync(file, next);
  written++;
}

console.log(
  `cup field: ${Object.keys(data.years).length} year(s), ${written} rewritten, ` +
  `${already} already current, ${empty} awaiting a declared field`);

if (problems.length) {
  console.error("\n  ! The Cup field pages could not be generated.\n");
  for (const p of problems) console.error(`      ${p}`);
  console.error("");
  process.exit(1);
}
