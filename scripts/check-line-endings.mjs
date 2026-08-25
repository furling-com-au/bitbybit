/* Fail the build if any source file has CRLF line endings.
 *
 * Every generator in scripts/ writes with newline:"\n" and matches on "\n".
 * When core.autocrlf=true converted the working tree to CRLF, they all
 * silently stopped recognising their own output: sync-example-links appended
 * a second "see a finished one" block to twenty of twenty-one tool pages and
 * then reported "0 written, 21 already current" forever after. It shipped.
 *
 * .gitattributes stops git reintroducing it. This stops an editor doing it,
 * and — more importantly — it turns a silent corruption into a build failure,
 * which is the only reason it will ever be noticed again.
 *
 * Kept first in the build chain so nothing downstream runs on bad input.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";

/* .csv is deliberately NOT here. RFC 4180 specifies CRLF, these files are
   downloadable roster templates meant to open in Excel, and writeCsv() emits
   CRLF on purpose. A guard that "fixes" them would break the deliverable. The
   rule is LF for everything the generators read and rewrite — not LF for its
   own sake. */
const TEXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".jsonc",
  ".md", ".txt", ".xml", ".svg", ".yml", ".yaml", ".sql"]);
const EXTRA = new Set(["llms.txt", "api-catalog", ".gitattributes", ".gitignore"]);
const SKIP = new Set(["node_modules", ".git", ".wrangler"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { walk(full, out); continue; }
    if (TEXT.has(extname(name).toLowerCase()) || EXTRA.has(name)) out.push(full);
  }
  return out;
}

const bad = [];
let checked = 0;
for (const file of walk(".")) {
  checked++;
  if (readFileSync(file).includes("\r\n")) bad.push(file);
}

console.log(`line endings: ${checked} text files checked, ${bad.length} with CRLF`);
if (bad.length) {
  console.error("\n  ! These files have CRLF line endings, which silently breaks every");
  console.error("  ! generator in scripts/ — they write and match LF.\n");
  for (const f of bad.slice(0, 20)) console.error(`      ${f}`);
  if (bad.length > 20) console.error(`      …and ${bad.length - 20} more`);
  console.error("\n  Fix: check .gitattributes is present and core.autocrlf is not");
  console.error("  rewriting the working tree, then re-checkout or convert in place.\n");
  process.exit(1);
}
