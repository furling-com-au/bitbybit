/* Keeps the press kit's facts true.
 *
 * It said "18 tools live" when there were 22 — on the one page written for
 * journalists, whose entire job is to be checkable. Someone counting the
 * shelf and finding a different number learns something about the rest of
 * the page.
 *
 * The count comes from the homepage shelf, which is what a reader would
 * actually count, not from src/tools/ (which holds data modules too).
 */
import { readFileSync, writeFileSync } from "node:fs";

const shelf = readFileSync("public/index.html", "utf8");
const count = (shelf.match(/class="tool-name"/g) || []).length;
if (count < 5) { console.error("  ! counted " + count + " tools — that cannot be right"); process.exit(1); }

const file = "public/press/index.html";
let html = readFileSync(file, "utf8");
const RE = /<li>\d+ tools live; more each season<\/li>/;
if (!RE.test(html)) {
  console.error("  ! the press kit's tool-count line has been reworded — update this script");
  process.exit(1);
}
const want = `<li>${count} tools live; more each season</li>`;
const next = html.replace(RE, want);
if (next === html) { console.log(`press facts: already current (${count} tools)`); }
else { writeFileSync(file, next); console.log(`press facts: updated to ${count} tools`); }
