/* What is actually happening on the live site.
 *
 * Run:  npm run stats          (add --local to read the dev database)
 *
 * "Instances created" is the wrong headline number: seed-demos.mjs inserts
 * twenty real rows through the real API, and a one-tap button makes an
 * empty instance nearly free to produce. The number that means something
 * is whether an instance ever reached a SECOND person.
 *
 * There is no single predicate for that, because the tools record
 * participation three different ways. Verified by reading every INSERT and
 * its enclosing function:
 *
 *   claims table            hens, meal, plate, registry, roster, giftidea(claim)
 *   participants + a later  baby, card, poll, qotd, recipe   (row written by the action)
 *     claimed_at stamp      coffee, fact, kringle, roles     (row written AT CREATE,
 *                                                             claimed_at set on claim)
 *   participants, no stamp  giftidea(suggest), kudos, pulse
 *
 * The third group matters: those three never write claimed_at at all, so a
 * claimed_at test scores every gift-ideas suggestion and every kudos note
 * as nothing. The first group matters in the other direction: coffee, fact,
 * kringle and roles have participant rows from the moment they are created,
 * so a bare EXISTS(participants) would score every fresh instance as a win.
 *
 * sweep and bracket write to neither table, which made them structurally
 * unmeasurable — not "reads as zero", genuinely no signal at all. Migration
 * 0004 gives every instance a first_opened_at, set from the generic /s/
 * handler, so sweep and bracket now read it as their only reach signal.
 * Rows created before that migration shipped have no first_opened_at and
 * will never get one retroactively — their reach stays 0 by construction,
 * same as always, and that is correct rather than a regression.
 *
 * REACHED has no time threshold, and on 26 Aug 2026 that made it lie. It
 * reported 5 of 11 instances as reaching a second person. Every one of those
 * five claims landed 0-41 seconds after the instance was created (25s, 41s,
 * 0s, 24s, 0s) - one person making a thing and immediately clicking their own
 * link to check it works. Correct by the predicate, useless as a signal.
 *
 * So COLD is reported alongside it: the same three participation shapes, but
 * only counting action more than COLD_MINUTES after creation. That is the
 * number that separates a tool being USED from a tool being TRIED, and it is
 * the one to watch. It reads 0 today. Do not average the two or quote REACHED
 * on its own again.
 */
import { execSync } from "node:child_process";

const LOCAL = process.argv.includes("--local");

/* Same shape as seed-demos.mjs: one double-quoted --command argument, so
   no double quotes and no newlines (a newline is silently truncated by the
   shell rather than reported), and a retry for wrangler's intermittent
   libuv abort. */
function sql(statement) {
  if (statement.includes('"')) throw new Error("SQL must not contain double quotes");
  if (/[\r\n]/.test(statement)) throw new Error("SQL must be a single line");
  const cmd = `npx wrangler d1 execute bitbybit ${LOCAL ? "--local" : "--remote"} --command "${statement}" --json`;
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return JSON.parse(execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }))[0].results;
    } catch (e) {
      last = String(e.stderr || e.message);
      if (!/UV_HANDLE_CLOSING|Assertion failed/.test(last)) break;
    }
  }
  throw new Error(`SQL failed: ${last.slice(0, 200)}`);
}

const UNMEASURABLE = new Set(["sweep", "bracket"]);
const NO_STAMP = "'giftidea','kudos','pulse'";

const REACHED =
  `(EXISTS (SELECT 1 FROM claims c WHERE c.instance_id = i.id)` +
  ` OR EXISTS (SELECT 1 FROM participants p WHERE p.instance_id = i.id AND p.claimed_at IS NOT NULL)` +
  ` OR (i.tool_type IN (${NO_STAMP}) AND EXISTS (SELECT 1 FROM participants p2 WHERE p2.instance_id = i.id))` +
  ` OR (i.tool_type IN ('sweep','bracket') AND i.first_opened_at IS NOT NULL))`;

/* Anything sooner than this after creation is the maker checking their own
   link, not a second person arriving. Five minutes is deliberately generous:
   the observed self-tests all landed inside 41 seconds, so the threshold has
   a lot of headroom before it starts discarding real early participation. */
const COLD_MINUTES = 5;
const LATE = (t) => `julianday(${t}) - julianday(i.created_at) > ${COLD_MINUTES}.0/1440`;

const COLD =
  `(EXISTS (SELECT 1 FROM claims c WHERE c.instance_id = i.id AND ${LATE("c.created_at")})` +
  ` OR EXISTS (SELECT 1 FROM participants p WHERE p.instance_id = i.id AND p.claimed_at IS NOT NULL AND ${LATE("p.claimed_at")})` +
  ` OR (i.tool_type IN (${NO_STAMP}) AND EXISTS (SELECT 1 FROM participants p2 WHERE p2.instance_id = i.id AND ${LATE("p2.created_at")}))` +
  ` OR (i.tool_type IN ('sweep','bracket') AND i.first_opened_at IS NOT NULL AND ${LATE("i.first_opened_at")}))`;

const rows = sql(
  `SELECT i.tool_type AS tool, COUNT(*) AS made,` +
  ` SUM(CASE WHEN ${REACHED} THEN 1 ELSE 0 END) AS reached,` +
  ` SUM(CASE WHEN ${COLD} THEN 1 ELSE 0 END) AS cold,` +
  ` SUM(CASE WHEN i.shared_at IS NOT NULL THEN 1 ELSE 0 END) AS shared,` +
  ` SUM(CASE WHEN i.updated_at > i.created_at THEN 1 ELSE 0 END) AS touched` +
  ` FROM instances i WHERE i.slug NOT LIKE 'demo-%' GROUP BY i.tool_type ORDER BY reached DESC, made DESC`
);

const fails = sql(
  `SELECT tool_type AS tool, kind, COUNT(*) AS n FROM events` +
  ` WHERE kind LIKE 'fail:%' GROUP BY tool_type, kind ORDER BY n DESC`
);

/* via:foot and via:cta since the placement split; plain 'via' is the
   pre-split history and still counts. */
const via = sql(
  `SELECT tool_type AS tool, kind, COUNT(*) AS n FROM events` +
  ` WHERE kind LIKE 'via%' GROUP BY tool_type, kind ORDER BY n DESC`
);

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

console.log(`\n  ${LOCAL ? "LOCAL" : "PRODUCTION"} — demo-* excluded\n`);
console.log(`  ${pad("tool", 11)}${num("made", 5)}${num("shared", 8)}${num("reached", 9)}${num("cold", 7)}${num("edited", 8)}`);
console.log("  " + "-".repeat(47));
let made = 0, shared = 0, reached = 0, cold = 0;
for (const r of rows) {
  made += r.made; shared += r.shared; reached += r.reached; cold += r.cold;
  const note = UNMEASURABLE.has(r.tool) ? "   (reach: first_opened_at only, since migration 0004)" : "";
  console.log(`  ${pad(r.tool, 11)}${num(r.made, 5)}${num(r.shared, 8)}${num(r.reached, 9)}${num(r.cold, 7)}${num(r.touched, 8)}${note}`);
}
console.log("  " + "-".repeat(47));
console.log(`  ${pad("total", 11)}${num(made, 5)}${num(shared, 8)}${num(reached, 9)}${num(cold, 7)}`);
console.log("");
console.log("  shared  = the organiser pressed Copy or Share on the link.");
console.log("  reached = anyone claimed, at any time.");
console.log(`  cold    = claimed more than ${COLD_MINUTES} min after creation, so plausibly`);
console.log("            NOT the maker clicking their own link to check it.");
console.log("  cold is the real number. reached on its own overstates badly.");
console.log("");
console.log("  made but not shared  -> the share step is the problem.");
console.log("  shared but not cold  -> the link lands and nobody bites.");
console.log("  nothing made at all  -> it is a traffic problem, not a product one.");
console.log("");

console.log("  refused creates (a person pressed the button and got nothing):");
if (!fails.length) console.log("    none recorded");
for (const f of fails) console.log(`    ${pad(f.tool, 11)} ${pad(f.kind, 22)} ${f.n}`);

console.log("\n  clicks back from a shared page (foot = credit line, cta = completion prompt):");
if (!via.length) console.log("    none recorded");
const place = (k) => k.replace("via:", "").replace(/^via$/, "foot");
for (const v of via) console.log(`    ${pad(v.tool, 11)} ${pad(place(v.kind), 6)} ${v.n}`);
const byPlacement = via.reduce((a, v) => { const k = place(v.kind); a[k] = (a[k] || 0) + v.n; return a; }, {});
const top = Math.max(0, ...Object.values(byPlacement));
/* Written down before the data exists so it cannot be rationalised later. */
if (top && top < 50)
  console.log(`\n    Best placement has ${top} clicks. Do not change either until one has 50.`);

console.log(
  `\n  Note: sweep and bracket store no claims or participants, so their\n` +
  `  reach comes only from first_opened_at (migration 0004) — whether anyone\n` +
  `  opened the shared page at all, not who or how many. Instances made\n` +
  `  before that migration shipped will never get one and read as 0 forever;\n` +
  `  that is old data lacking the column, not the tool failing to reach anyone.\n` +
  `  Read 'refused creates' against 'made': both zero means nobody is\n` +
  `  pressing the button, which is a geometry problem, not a broken API.\n`
);
