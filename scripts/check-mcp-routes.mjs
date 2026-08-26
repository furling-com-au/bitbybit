/* Every API path the MCP server calls must be a route the tool actually has.
 *
 * src/mcp.js does not reimplement Scrum Poker - it calls poker.api() in
 * process, which is the right call, but it means the paths are hand-written
 * strings in one file and hand-written regexes in another. I got one wrong
 * immediately: the state route is /api/poker/:slug/state and mcp.js asked for
 * /api/poker/state/:slug. Nothing caught it. The tool returned a 404, the
 * handler turned that into a polite "could not read that room", and it took a
 * live end-to-end call to notice - which is the expensive way to find a typo.
 *
 * This pulls the route patterns out of src/tools/poker.js and the paths out of
 * src/mcp.js and checks each path matches something.
 *
 * It checks SHAPE, not method: telling GET routes from POST routes means
 * tracking which branch of the router a pattern sits in, which is fragile
 * parsing for a failure mode that has not happened. If a wrong method ever
 * does ship, add it then rather than guessing at it now.
 */
import { readFileSync } from "node:fs";

const poker = readFileSync("src/tools/poker.js", "utf8");
const mcp = readFileSync("src/mcp.js", "utf8");

/* The router lives in the api() method; only look there, so an unrelated
   /api/poker string elsewhere in the file cannot count as a route. */
const api = poker.match(/api\(request, env, url\) \{[\s\S]*?\n {2}\},/);
if (!api) {
  console.error("\n  ! Could not find poker.api() in src/tools/poker.js — this check is blind.\n");
  process.exit(1);
}
const body = api[0];

const routes = [];
for (const m of body.matchAll(/p === "(\/api\/[^"]+)"/g)) {
  routes.push({ src: m[1], test: (path) => path === m[1] });
}
/* Match the regex literal itself, from /^\/api to the closing $/. Do NOT try
   to match p.match( ... ) by balancing brackets — these patterns contain
   capture groups, so a [^)] scan stops at the first ')' and silently finds
   only the routes that have none. That is how this check first "passed" with
   two of the four routes missing and four false positives. */
for (const m of body.matchAll(/\/\^\\\/api[^\n]*?\$\//g)) {
  let re;
  try { re = new RegExp(m[0].slice(1, -1)); }
  catch { continue; }
  routes.push({ src: m[0], test: (path) => re.test(path) });
}

if (!routes.length) {
  console.error("\n  ! No routes parsed out of poker.api() — the router was restructured.\n");
  process.exit(1);
}

/* Paths as mcp.js writes them, with ${...} standing in for a real token.
   Tokens are [a-z0-9] and slugs are [a-z0-9-], so a value matching both is
   used - a path that only works for one shape still needs to be caught. */
const SAMPLE = "abc123";
const paths = [];
for (const m of mcp.matchAll(/pokerApi\(\s*env\s*,\s*"(GET|POST|DELETE)"\s*,\s*([`"])((?:[^`"\\]|\\.)*?)\2/g)) {
  const raw = m[3];
  const line = mcp.slice(0, m.index).split("\n").length;
  paths.push({ method: m[1], raw, line, concrete: raw.replace(/\$\{[^}]*\}/g, SAMPLE) });
}

if (!paths.length) {
  console.error("\n  ! No pokerApi() calls found in src/mcp.js — it was renamed or restructured.\n");
  process.exit(1);
}

const bad = paths.filter((p) => !routes.some((r) => r.test(p.concrete)));

console.log(`mcp routes: ${paths.length} path(s) checked against ${routes.length} poker route(s), ${bad.length} unmatched`);

if (bad.length) {
  console.error("\n  ! These paths in src/mcp.js do not match any route in poker.api().");
  console.error("  ! The tool will 404 and the agent will be told the room does not exist.\n");
  for (const p of bad) console.error(`      src/mcp.js:${p.line}  ${p.method} ${p.raw}`);
  console.error("\n  Routes that do exist:");
  for (const r of routes) console.error(`      ${r.src}`);
  console.error("");
  process.exit(1);
}
