/* Keep public/auth.md honest about the code.
 *
 * Every other agent-facing document here is generated: openapi.json and
 * /.well-known/api-catalog both derive their endpoint list from the
 * filesystem, so they cannot drift. auth.md is hand-written prose, which is
 * why it is worth keeping - and exactly why it drifted. Four tools shipped
 * after it was written (coffee, pulse, kudos, poker) and none of them ever
 * appeared in it, so an agent reading auth.md literally could not discover
 * Scrum Poker or Coffee Roulette. It also promised a flat 240/hour for
 * non-create POSTs, months after poker votes were given 900.
 *
 * The prose stays hand-written. Only the load-bearing facts are checked:
 * the endpoint list, and the rate limit numbers an agent uses to decide how
 * hard to back off. Both are read out of src/worker.js rather than restated
 * here, so this file cannot drift either.
 */
import { readFileSync } from "node:fs";

const worker = readFileSync("src/worker.js", "utf8");
const auth = readFileSync("public/auth.md", "utf8");
const problems = [];

/* ---- endpoint list ---- */
const cre = worker.match(/const CREATE_RE = \/[^(]*\(([^)]+)\)/);
if (!cre) {
  problems.push("CREATE_RE not found in src/worker.js — this check is now blind");
} else {
  const code = new Set(cre[1].split("|"));
  const doc = new Set([...auth.matchAll(/POST \/api\/([a-z]+)\s*$/gm)].map((m) => m[1]));
  const missing = [...code].filter((t) => !doc.has(t)).sort();
  const stale = [...doc].filter((t) => !code.has(t)).sort();
  if (missing.length) problems.push(`auth.md is missing create endpoints: ${missing.join(", ")}`);
  if (stale.length) problems.push(`auth.md lists endpoints that no longer exist: ${stale.join(", ")}`);
}

/* ---- rate limits ---- */
const lim = worker.match(/const limit = kind === "create" \? (\d+) : kind === "poker" \? (\d+) : (\d+)/);
if (!lim) {
  problems.push("the rate limit expression in src/worker.js changed shape — re-check auth.md by hand");
} else {
  const [, create, poker, act] = lim;
  for (const [n, what] of [[create, "the create limit"], [poker, "the poker limit"], [act, "the general POST limit"]]) {
    if (!new RegExp(`\\*\\*${n}\\*\\*`).test(auth)) {
      problems.push(`auth.md never states ${what} (${n}/hour) — an agent will back off wrongly`);
    }
  }
}

console.log(`auth.md: ${problems.length ? problems.length + " drifted from the code" : "endpoint list and rate limits match src/worker.js"}`);

if (problems.length) {
  console.error("\n  ! public/auth.md is the one agent-facing document that is not");
  console.error("  ! generated, so nothing else catches it going stale.\n");
  for (const p of problems) console.error(`      ${p}`);
  console.error("");
  process.exit(1);
}
