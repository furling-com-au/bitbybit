/* The question-of-the-day preview in the HTML must match SAMPLES[0] in qotd.js.
 *
 * That page used to pick a random sample on load and write it into the
 * preview. Three of the four samples render at a different height from the one
 * shipped in the HTML — 242px, 307px, 237px and 307px on a 375px viewport — so
 * most loads moved the form and everything below it by up to 70px, after first
 * paint, with no user input to excuse it. Cloudflare reported 12% of CLS
 * samples as poor and named that preview's span as the element.
 *
 * The fix was to stop writing to the DOM on load at all and let the
 * server-rendered markup stand. That works only while the markup and
 * SAMPLES[0] agree. If someone edits one and not the other, the page silently
 * goes back to shifting on load — the exact bug, reintroduced, with no error
 * anywhere and nothing to notice until the field data drifts weeks later.
 *
 * Clicking "Show me another" still swaps freely. A shift the browser can
 * attribute to a click does not count against CLS, so variety costs nothing.
 */
import { readFileSync } from "node:fs";

const js = readFileSync("public/qotd.js", "utf8");
const html = readFileSync("public/question-of-the-day/index.html", "utf8");
const problems = [];

const block = js.match(/const SAMPLES = \[([\s\S]*?)\n {2}\];/);
if (!block) {
  console.error("\n  ! SAMPLES not found in public/qotd.js — it was renamed or restructured,");
  console.error("  ! and the preview is now unchecked.\n");
  process.exit(1);
}
const first = block[1].match(/\{\s*text:\s*"((?:[^"\\]|\\.)*)"\s*,\s*a:\s*"((?:[^"\\]|\\.)*)"\s*,\s*b:\s*"((?:[^"\\]|\\.)*)"\s*\}/);
if (!first) {
  console.error("\n  ! Could not parse SAMPLES[0] out of public/qotd.js.\n");
  process.exit(1);
}
const [, text, a, b] = first;

/* Whatever the page renders inside each preview element, entities decoded. */
const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&mdash;": "—", "&rsquo;": "\u2019" };
const decode = (s) => s.replace(/&[a-z#0-9]+;/gi, (m) => ENT[m] ?? m);
function rendered(id) {
  const m = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)<`));
  return m ? decode(m[1]).replace(/\s+/g, " ").trim() : null;
}

for (const [id, want, what] of [["previewQ", text, "question"], ["previewA", a, "option A"], ["previewB", b, "option B"]]) {
  const got = rendered(id);
  if (got === null) problems.push(`#${id} is not in the page at all`);
  else if (got !== want) problems.push(`#${id} (${what})\n          html: ${JSON.stringify(got)}\n          js:   ${JSON.stringify(want)}`);
}

/* And the load-time swap must not come back. */
if (/showSample\(\s*Math\.random|showSample\(\s*Math\.floor/.test(js)) {
  problems.push("qotd.js calls showSample() with a random index on load — that is the layout shift this check exists to prevent");
}

console.log(`qotd preview: ${problems.length ? problems.length + " mismatch(es)" : "html matches SAMPLES[0]"}`);

if (problems.length) {
  console.error("\n  ! The rendered preview and SAMPLES[0] disagree, so the page will shift");
  console.error("  ! on load again — the CLS bug this check exists to prevent.\n");
  for (const p of problems) console.error(`      ${p}`);
  console.error("");
  process.exit(1);
}
