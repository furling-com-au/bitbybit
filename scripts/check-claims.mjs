/* Fail the build on open-ended promises about what the business will never do.
 *
 * The site used to say "No accounts, no fees" in the homepage hero, the meta
 * description, the JSON-LD, llms.txt and the press kit. "No fees" does not
 * read as "this tool costs nothing today" - it reads as a permanent promise
 * about the whole business. Add a paid collection option later, or take a
 * percentage for handling money, and that line is a screenshot with a date on
 * it, sitting in a search index and in every model that scraped llms.txt.
 *
 * "Free to use" and "the tools are free" say the same thing to a visitor
 * deciding whether to click, and describe the present rather than promising
 * the future. That is the whole fix: same reassurance, no hostage.
 *
 * Statements about MECHANISM are fine and are deliberately not banned - "the
 * money goes straight to you", "the site never touches the money" describe how
 * the thing is built, are true today, and stay true whatever the pricing does.
 * The gift registry keeps those; it only lost the word "fees".
 *
 * "never takes a cut" is NOT in the list, and that is a considered omission
 * rather than an oversight. It is a business promise when the site says it
 * about itself - the gift registry said exactly that and was reworded to
 * describe the mechanism instead - but it is ordinary advice when a guide says
 * it to an organiser, which is what baby-guess-pool/ideas does: "don't make
 * the parents buy it, and never take a cut". A pattern broad enough to catch
 * the first would fail the build on the second, and a check that cries wolf is
 * one people learn to route around.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/* Each entry: the pattern, and what to say instead. Kept small on purpose -
   a banned-phrase list that grows without thought becomes a list people
   route around rather than a rule they understand. */
const BANNED = [
  [/\bno fees?\b/i, 'reads as a permanent pricing promise — say "free to use"'],
  [/\bfee-free\b/i, 'reads as a permanent pricing promise — say "free to use"'],
  [/\bfree forever\b/i, "promises the future — say what it costs today"],
  [/\balways (be )?free\b/i, "promises the future — say what it costs today"],
  [/\bnever charge\b/i, "promises the future — say what it costs today"],
  [/\bwill never cost\b/i, "promises the future — say what it costs today"],
  [/\b100% free\b/i, 'the percentage adds nothing — say "free to use"'],
];

const SKIP_DIRS = new Set(["node_modules", ".git", ".wrangler"]);
const CHECK = new Set([".html", ".txt", ".json", ".md"]);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP_DIRS.has(n)) continue;
    const f = join(dir, n);
    if (statSync(f).isDirectory()) { walk(f, out); continue; }
    if (CHECK.has(n.slice(n.lastIndexOf(".")).toLowerCase()) || n === "llms.txt") out.push(f);
  }
  return out;
}

const hits = [];
let checked = 0;
for (const file of walk("public")) {
  checked++;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const [re, why] of BANNED) {
      const m = re.exec(line);
      if (m) hits.push({ file: relative("public", file).replace(/\\/g, "/"), line: i + 1, text: m[0], why });
    }
  });
}

console.log(`claims: ${checked} files checked, ${hits.length} open-ended promise(s)`);

if (hits.length) {
  console.error("\n  ! These promise something about the future of the business rather than");
  console.error("  ! describing what it costs today. Say what a visitor gets now.\n");
  for (const h of hits.slice(0, 25)) {
    console.error(`      ${h.file}:${h.line}  "${h.text}" — ${h.why}`);
  }
  if (hits.length > 25) console.error(`      …and ${hits.length - 25} more`);
  console.error("\n  Statements about mechanism are fine and are not banned:");
  console.error('  "the money goes straight to you", "the site never touches the money".\n');
  process.exit(1);
}
