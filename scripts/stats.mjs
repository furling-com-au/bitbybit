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
 * sweep and bracket write to neither table. They are structurally
 * unmeasurable here and are labelled as such rather than reported as zero.
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
  ` OR (i.tool_type IN (${NO_STAMP}) AND EXISTS (SELECT 1 FROM participants p2 WHERE p2.instance_id = i.id)))`;

const rows = sql(
  `SELECT i.tool_type AS tool, COUNT(*) AS made,` +
  ` SUM(CASE WHEN ${REACHED} THEN 1 ELSE 0 END) AS reached,` +
  ` SUM(CASE WHEN i.updated_at > i.created_at THEN 1 ELSE 0 END) AS touched` +
  ` FROM instances i WHERE i.slug NOT LIKE 'demo-%' GROUP BY i.tool_type ORDER BY reached DESC, made DESC`
);

const fails = sql(
  `SELECT tool_type AS tool, kind, COUNT(*) AS n FROM events` +
  ` WHERE kind LIKE 'fail:%' GROUP BY tool_type, kind ORDER BY n DESC`
);

const via = sql(
  `SELECT tool_type AS tool, COUNT(*) AS n FROM events WHERE kind = 'via' GROUP BY tool_type ORDER BY n DESC`
);

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

console.log(`\n  ${LOCAL ? "LOCAL" : "PRODUCTION"} — demo-* excluded\n`);
console.log(`  ${pad("tool", 11)}${num("made", 5)}${num("reached", 9)}${num("edited", 8)}`);
console.log("  " + "-".repeat(32));
let made = 0, reached = 0;
for (const r of rows) {
  made += r.made; reached += r.reached;
  const note = UNMEASURABLE.has(r.tool) ? "   (reach not recorded)" : "";
  console.log(`  ${pad(r.tool, 11)}${num(r.made, 5)}${num(r.reached, 9)}${num(r.touched, 8)}${note}`);
}
console.log("  " + "-".repeat(32));
console.log(`  ${pad("total", 11)}${num(made, 5)}${num(reached, 9)}\n`);

console.log("  refused creates (a person pressed the button and got nothing):");
if (!fails.length) console.log("    none recorded");
for (const f of fails) console.log(`    ${pad(f.tool, 11)} ${pad(f.kind, 10)} ${f.n}`);

console.log("\n  clicks back through the 'made with' credit on a shared page:");
if (!via.length) console.log("    none recorded");
for (const v of via) console.log(`    ${pad(v.tool, 11)} ${v.n}`);

console.log(
  `\n  Note: sweep and bracket store no claims or participants, so their\n` +
  `  'reached' is structurally always 0 — that is not a measurement.\n` +
  `  Read 'refused creates' against 'made': both zero means nobody is\n` +
  `  pressing the button, which is a geometry problem, not a broken API.\n`
);
