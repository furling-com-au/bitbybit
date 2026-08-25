/* Find capability described ONLY inside a builder form.
 *
 * The meal train hid "add up to twelve other jobs - school run, dog, washing"
 * in a textarea placeholder and a field hint. gen-markdown.mjs drops forms, so
 * it never reached the Markdown twin; search engines saw it only as attribute
 * text. A whole category of use was invisible.
 *
 * NOT in the build chain: the output needs a human to sort real features from
 * example flavour, and a noisy check that always "fails" teaches people to
 * ignore it. Run it by hand after adding a tool - npm run audit:hidden.
 *
 * It has paid for itself twice. It found the volunteer roster's ten club duty
 * presets (238 shift lines, the word "preset" appearing zero times in the
 * prose) and scrum poker's t-shirt deck - and chasing that second one turned
 * up a bug that made the whole deck useless.
 *
 * Method: for each tool page, take the text that lives ONLY in form furniture
 * (placeholders, field hints, labels, legends, options, aria-labels) and ask
 * which of its content words never appear in the page's prose. Words that
 * appear nowhere in the prose are candidate hidden features.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";

const NAMES = new Set(["allira", "arjun", "bec", "con", "craig", "dave", "deng", "grace", "hazem", "jarrah", "josh", "karen", "kevin", "kirra", "kyah", "lachie", "linh", "lowanna", "macca", "marlee", "matt", "mei", "michelle", "minh", "nathan", "nic", "priya", "raj", "sharon", "shaz", "tarni", "tony", "trent", "trev", "tuan", "vy", "wei", "alex", "sam", "jules", "meredith", "tom", "nguyen", "mia", "ruby", "rosella", "galahs", "lions", "pies", "fitzroy", "dawn", "doctor", "villager", "payroll", "roasters", "platform", "vine", "tennis", "warehouse", "esky", "kitchen", "hall", "park", "garden"]);
const STOP = new Set(`a about after all also an and any are as at back be been before but by can
cant come could did do does doesn dont down each even every few first for from get give go had has
have he her here hers him his how i if in into is it its just know like made make many may me more
most much must my no nor not now of off on once one only or other our out over own re same see she
should so some such take than that the their them then there these they this those through time to
too under until up us use used using very was way we well were what when where which while who why
will with would you your yours it's don't you'll we'll they'll one two three four five six seven
eight nine ten put add set type name names day days date dates line lines each per optional
example eg ie etc anything something someone people person thing things want need needs left right
top bottom new old next last`.split(/\s+/));

const SKIP_DIRS = new Set(["node_modules", ".git", ".wrangler"]);
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP_DIRS.has(n)) continue;
    const f = join(dir, n);
    if (statSync(f).isDirectory()) { walk(f, out); continue; }
    if (n === "index.html") out.push(f);
  }
  return out;
}

const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&mdash;/g, "-")
  .replace(/&rarr;/g, "->").replace(/&hellip;/g, "...").replace(/&#39;|&apos;/g, "'");

const words = (s) => (decode(s).toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
  .map((w) => w.replace(/'s$/, ""))
  .filter((w) => !STOP.has(w) && !NAMES.has(w));

const rows = [];
for (const file of walk("public")) {
  const html = readFileSync(file, "utf8");
  const page = relative("public", dirname(file)).replace(/\\/g, "/") || "(home)";
  const mdPath = join(dirname(file), "index.md");
  if (!existsSync(mdPath)) continue;

  /* Everything the markdown twin drops: forms plus the attribute text that
     never renders as prose anywhere. */
  const forms = html.match(/<form[\s\S]*?<\/form>/gi) || [];
  const formText = forms.join("\n");
  const attrs = [
    ...[...formText.matchAll(/placeholder="([^"]*)"/g)].map((m) => m[1]),
    ...[...formText.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]),
    ...[...formText.matchAll(/title="([^"]*)"/g)].map((m) => m[1]),
  ].join("\n");
  /* Field hints and labels render visually but sit inside the form, so the
     twin drops them too. */
  const hints = [
    ...[...formText.matchAll(/<em class="field-hint"[^>]*>([\s\S]*?)<\/em>/g)].map((m) => m[1]),
    ...[...formText.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map((m) => m[1]),
    ...[...formText.matchAll(/<legend[^>]*>([\s\S]*?)<\/legend>/g)].map((m) => m[1]),
    ...[...formText.matchAll(/<p class="[^"]*hint[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]),
  ].join("\n").replace(/<[^>]*>/g, " ");

  const inForm = new Set([...words(attrs), ...words(hints)]);
  if (!inForm.size) continue;

  const prose = new Set(words(readFileSync(mdPath, "utf8")));
  const missing = [...inForm].filter((w) => !prose.has(w)).sort();
  if (missing.length) rows.push({ page, missing, count: missing.length });
}

rows.sort((a, b) => b.count - a.count);
console.log(`pages with form-only vocabulary absent from prose: ${rows.length}\n`);
for (const r of rows) {
  console.log(`  ${r.page}  (${r.count})`);
  console.log(`      ${r.missing.join(" ")}\n`);
}
