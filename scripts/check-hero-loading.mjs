/* Fail the build if a tool page's hero image is marked loading="lazy".
 *
 * Cloudflare's Core Web Vitals flagged one 2,596ms LCP sample on
 * /volunteer-roster/, attributed to div.tool-hero-art>img.pixel. The image is
 * 6.3KB, so it was never a payload problem — it was a DISCOVERY problem.
 *
 * loading="lazy" removes an image from the preload scanner's reach. Measured on
 * production before the fix: styles.css and all three scripts began at 100ms,
 * fetched in parallel while the HTML was still being parsed; the hero image
 * began at 206ms, after domInteractive (209ms). The browser cannot start the
 * fetch until parse -> CSS -> layout has proved the image is near the viewport.
 * That serialisation costs ~100ms on a fast connection and roughly the whole
 * CSS load time on a slow one, which is exactly the shape of the reported data
 * (P50 929ms healthy, P99 2,596ms).
 *
 * It only bites some visitors, which is why it hid: the hero sits below the
 * form, at y=997 on a 1512px-wide viewport. Under about 1000px of viewport
 * height it is out of frame and never becomes LCP. Above that it is in frame
 * and its visible area is 292,610px vs the h1's 48,466 - six times larger, so
 * it becomes the LCP element decisively, on the one element the page had told
 * the browser to deprioritise.
 *
 * No fetchpriority="high" here on purpose. The bottleneck is discovery (~100ms)
 * not transfer (32ms for 6.3KB), and for most viewports the hero really is
 * below the fold. Plain eager loading lets the preload scanner find it early
 * and lets the browser's own heuristic decide priority once layout knows where
 * it landed - which adapts per viewport in a way a static attribute cannot.
 *
 * width/height stay mandatory: they reserve the box and keep CLS at zero.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const HERO = /<div class="tool-hero-art">\s*(<img\b[^>]*>)/s;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { walk(full, out); continue; }
    if (name === "index.html") out.push(full);
  }
  return out;
}

const lazy = [], nodim = [];
let heroes = 0;
for (const file of walk("public")) {
  const m = HERO.exec(readFileSync(file, "utf8"));
  if (!m) continue;
  heroes++;
  const tag = m[1];
  if (tag.includes('loading="lazy"')) lazy.push(relative("public", file));
  if (!/width="\d+"/.test(tag) || !/height="\d+"/.test(tag)) nodim.push(relative("public", file));
}

console.log(`hero images: ${heroes} checked, ${lazy.length} lazy, ${nodim.length} missing dimensions`);

if (lazy.length || nodim.length) {
  if (lazy.length) {
    console.error('\n  ! These hero images are loading="lazy". The hero is the largest');
    console.error("  ! element on a tool page and becomes LCP on any viewport tall enough");
    console.error("  ! to show it. lazy hides it from the preload scanner, so its fetch");
    console.error("  ! cannot start until CSS and layout are done. Remove the attribute.\n");
    for (const f of lazy) console.error(`      ${f}`);
  }
  if (nodim.length) {
    console.error("\n  ! These hero images have no width/height, so the box is not reserved");
    console.error("  ! and the page shifts when the image lands (CLS).\n");
    for (const f of nodim) console.error(`      ${f}`);
  }
  console.error("");
  process.exit(1);
}
