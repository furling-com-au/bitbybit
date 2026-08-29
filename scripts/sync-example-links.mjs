/* Puts a "see a finished one" link on every tool landing page.
 *
 * Hand-maintaining 20 of these is how the FAQ markup drifted out of sync
 * with the visible FAQs, so this derives the set from the filesystem and
 * fails loudly rather than quietly skipping:
 *   - every page with a <form> must have a matching demo in seed-demos.mjs
 *   - every demo must have a page
 * The one exception is declared below, with its reason.
 *
 * Idempotent: rewrites the strip in place if the copy changes.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUB = "public";
const SEED = readFileSync("scripts/seed-demos.mjs", "utf8");

/* team-picker runs entirely in the browser and prints its result on the
   page the moment you press the button. There is no share link to show,
   and nothing to see that the page does not already show you. */
const NO_DEMO = new Set(["team-picker"]);

/* What the reader gets, in their words. "See a finished one" is vague;
   "See a finished roster" tells them what is on the other side. */
const NOUN = {
  "grand-final-sweep": "sweep",
  "melbourne-cup-sweep": "sweep",
  "kris-kringle": "Kris Kringle",
  "secret-role-dealer": "game",
  "bring-a-plate": "list",
  "tournament-bracket": "bracket",
  "group-card": "card",
  "gift-registry": "registry",
  "fact-matcher": "game",
  "baby-guess-pool": "pool",
  "volunteer-roster": "roster",
  "meal-train": "meal train",
  "group-vote": "vote",
  "recipe-collection": "collection",
  "gift-ideas": "list",
  "hens-planner": "plan",
  "question-of-the-day": "question",
  "coffee-roulette": "round",
  "weekly-pulse": "pulse",
  "kudos-wall": "wall",
  "scrum-poker": "round",
};

/* Five tools need nothing typed: every field is optional or ships with a
   real value, so pressing the button yields a genuine, shareable thing.
   Verified by POSTing each pristine payload to its own API — all five
   return a slug. Nobody has ever been in a position to discover that,
   because the button sits about 1,400px down a phone screen. This puts a
   second submit next to the example link at ~332px, the only above-the-fold
   real estate on these pages that has actually been measured.

   `form=` is the HTML form-owner attribute, so the button submits the real
   form from outside it — no duplicated handler, no second code path. */
/* ---------- the baked worked example -------------------------
   Tools whose module exports examplePreview(). The fragment is rendered HERE,
   at build time, by the tool's own code — so the strip shows markup the tool
   would really produce, and it is in the HTML at first paint rather than
   arriving afterwards and shoving the form down the page (see
   check-qotd-preview.mjs for what that cost last time).

   Emitted AFTER the one-tap button, deliberately. builder-above-fold.mjs
   measured that button at ~332px on a phone and the in-form submit at ~1,400px;
   putting a preview above it would spend that win to save a scroll nobody was
   making. Below it, the example still lands inside the first screen.

   Fenced with comment sentinels rather than matched by shape: STRIP below is a
   lazy match and this block carries lists and divs of its own. */
const PREVIEW_MODULES = {
  "scrum-poker": "../src/tools/poker.js",
};

const PREVIEWS = {};
for (const [dir, mod] of Object.entries(PREVIEW_MODULES)) {
  const m = await import(mod);
  const fn = m.default && m.default.examplePreview;
  if (typeof fn !== "function")
    throw new Error(`${mod} is in PREVIEW_MODULES but exports no examplePreview()`);
  PREVIEWS[dir] = fn();
}

const ONE_TAP = {
  "bring-a-plate": { form: "plateForm", cta: "Make the board now",
    promise: "Six categories are already filled in, Mains through Wildcards.",
    hint: "or change them below" },
  "volunteer-roster": { form: "rosterForm", cta: "Build the roster now",
    promise: "Five shifts are already filled in, setup through pack-down.",
    hint: "or change them below" },
  "kudos-wall": { form: "kudosForm", cta: "Start the wall now",
    promise: "Nothing needs filling in — the team name is optional.",
    hint: "or name it first" },
  "weekly-pulse": { form: "pulseForm", cta: "Start the pulse now",
    promise: "Nothing needs filling in — it ships with a question ready to go.",
    hint: "or write your own question" },
  "scrum-poker": { form: "pokerForm", cta: "Deal the cards now",
    promise: "Nothing needs filling in — Fibonacci is ready to go.",
    hint: "or name the story first" },
  "question-of-the-day": { form: "qotdForm", cta: "Start it now",
    promise: "Nothing needs filling in — today's question is already chosen.",
    hint: "or name the team first" },
};

/* Matches every block this script has ever emitted, including one carrying
   the extra is-one-tap class. Requiring a quote immediately after
   "see-example" is exactly what made an earlier version fail to recognise
   its own output. Global, so duplicates are all removed, not just the first. */
/* 
? on every newline. check-line-endings.mjs should mean a CRLF file
   never reaches here, but this regex is the one that did real damage when
   it did: with <\/p>
 unable to match </p>\r\n the lazy [\s\S]*? runs on
   until it finds a bare 
 further down the file, so a strip can take page
   content with it. Two guards for the failure that already happened. */
const STRIP = /[ \t]*<p class="see-example[^"]*">[\s\S]*?<\/p>\r?\n(?:[ \t]*<p class="one-tap">[\s\S]*?<\/p>\r?\n)?(?:\r?\n)*/g;

/* Where the preview goes depends on whether the tool has a one-tap button, and
   the reason is measured rather than aesthetic.

   With one: the button sits at ~380px on a phone, so the fast path is already
   above the fold and a strip beneath it costs nothing that matters.

   Without one: the visitor has to reach the form, and on /meal-train/ a strip
   above it pushed the builder from 507px to 956px — entirely below the fold, on
   a site whose README says "the tool page IS the tool — it works above the
   fold". So for those tools the example goes AFTER the builder instead. The
   .see-example link stays above the fold either way, which is what points at it.

   Stripped globally rather than as part of STRIP, because it now has two
   possible homes and a block left behind in the old one would be a duplicate. */
const PREVIEW_STRIP = /[ \t]*<!-- example-preview:start -->[\s\S]*?<!-- example-preview:end -->\r?\n(?:\r?\n)*/g;

function previewFor(dir, indent) {
  const noun = NOUN[dir];
  return `${indent}<!-- example-preview:start -->\n` +
    `${indent}<div class="example-preview" role="group" aria-label="An example of a finished ${noun}">\n` +
    `${indent}  <p class="example-preview-label">A finished one, for instance</p>\n` +
    `${PREVIEWS[dir].trim().split("\n").map((l) => `${indent}  ${l.trim()}`).join("\n")}\n` +
    `${indent}</div>\n` +
    `${indent}<!-- example-preview:end -->\n`;
}

/* End of the <section class="builder"> block, by depth count — the builder
   holds a <form> and the page holds more sections after it, so the first
   </section> after the opening tag is not reliably the right one. */
function afterBuilder(html) {
  /* class="builder" on some pages, class="builder panel" on others. */
  const m0 = html.match(/<section class="builder(?:[ "])/);
  if (!m0) return -1;
  const open = m0.index;
  const re = /<section\b|<\/section>/g;
  re.lastIndex = open;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0] === "</section>" ? -1 : 1;
    if (depth === 0) return html.indexOf("\n", m.index) + 1;
  }
  return -1;
}

function stripFor(dir, indent) {
  const noun = NOUN[dir];
  if (!noun) throw new Error(`no noun for ${dir} — add one to NOUN`);
  const tap = ONE_TAP[dir];

  /* "See a finished round" directly above an actual finished round is the same
     redundancy this whole change is about — telling someone to go and look at a
     thing that is right there. So when the strip lands immediately beneath this
     line (the one-tap case, see previewFor), the link stops advertising the
     example and starts offering the one thing the strip cannot be: the real,
     full-size, interactive board.

     Where the strip goes AFTER the builder, the two are about a thousand pixels
     apart and this line is the only example affordance above the fold, so it
     keeps its original wording. The wording follows adjacency, not tool. */
  const adjacent = PREVIEWS[dir] && tap;
  const link = adjacent
    ? `Open the live ${noun} &rarr;`
    : `See a finished ${noun} &rarr;`;
  let out = `${indent}<p class="see-example${tap ? " is-one-tap" : ""}">` +
    `${tap ? tap.promise + " " : "Not sure what you get? "}` +
    `<a href="/s/demo-${dir}">${link}</a></p>\n`;
  if (tap)
    out += `${indent}<p class="one-tap">` +
      `<button type="submit" form="${tap.form}" id="makeBtnTop" class="btn primary">` +
      `${tap.cta} &rarr;</button>` +
      `<a class="fine" href="#${tap.form}">${tap.hint}</a></p>\n`;
  if (PREVIEWS[dir] && tap) out += previewFor(dir, indent);
  return out;
}

const dirs = readdirSync(PUB, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(PUB, d.name, "index.html")))
  .map((d) => d.name)
  .filter((d) => readFileSync(join(PUB, d, "index.html"), "utf8").includes("<form"))
  .sort();

const problems = [];
let changed = 0, already = 0;

for (const dir of dirs) {
  if (NO_DEMO.has(dir)) continue;
  if (!SEED.includes(`slug: "demo-${dir}"`)) {
    problems.push(`${dir}/ has a builder form but no demo in seed-demos.mjs`);
    continue;
  }
  const file = join(PUB, dir, "index.html");
  let html = readFileSync(file, "utf8");

  /* A one-tap button carries a form= pointing at a real form id. If that id
     is ever renamed, the button silently submits nothing — so fail the build
     rather than ship a dead primary CTA above the fold. */
  const tap = ONE_TAP[dir];
  if (tap && !html.includes(`id="${tap.form}"`)) {
    problems.push(`${dir}/ ONE_TAP names form "${tap.form}" but no element has that id`);
    continue;
  }
  const ledeAt = html.indexOf('<p class="lede">');
  const lineStart = html.lastIndexOf("\n", ledeAt) + 1;
  const want = stripFor(dir, ledeAt === -1 ? "  " : html.slice(lineStart, ledeAt));

  if (ledeAt === -1) { problems.push(`${dir}/ has no <p class="lede"> to anchor to`); continue; }

  /* Strip every existing block, then insert exactly one, anchored after the
     lede — the last thing above the fold on a phone.

     Rewriting in place is what an earlier version did, and it required the
     emitted markup to keep matching the pattern used to find it. The moment
     the output grew an extra class the pattern stopped matching its own
     output, the insert branch ran instead, and the script quietly appended a
     second copy on every run. Strip-then-insert cannot drift that way: the
     end state is the same whatever the file started as, so a file that has
     already collected duplicates repairs itself. */
  const cleaned = html.replace(STRIP, "").replace(PREVIEW_STRIP, "");
  const cleanLede = cleaned.indexOf('<p class="lede">');
  const end = cleaned.indexOf("</p>", cleanLede);
  if (end === -1) { problems.push(`${dir}/ lede is unclosed`); continue; }
  const at = cleaned.indexOf("\n", end) + 1;
  let next = cleaned.slice(0, at) + "\n" + want + cleaned.slice(at);

  /* No one-tap button: the example goes after the builder, so the form keeps
     the fold. See the note on PREVIEW_STRIP above. */
  if (PREVIEWS[dir] && !ONE_TAP[dir]) {
    const bAt = afterBuilder(next);
    if (bAt === -1) { problems.push(`${dir}/ has a preview but no <section class="builder"> to place it after`); continue; }
    next = next.slice(0, bAt) + "\n" + previewFor(dir, "  ") + next.slice(bAt);
  }
  if (next === html) { already++; continue; }
  writeFileSync(file, next);
  changed++;
}

// A demo nobody links to is a demo nobody sees.
for (const m of SEED.matchAll(/slug: "demo-([a-z0-9-]+)"/g))
  if (!dirs.includes(m[1])) problems.push(`demo-${m[1]} has no page at /${m[1]}/`);

console.log(`example links: ${changed} written, ${already} already current, ${dirs.length - NO_DEMO.size} pages`);
if (problems.length) {
  for (const p of problems) console.error("  ! " + p);
  process.exit(1);
}
