/* Marks the long-form pages so styles.css can give them a reading setting:
 * a longer measure and a size up on running text.
 *
 * This used to swap those pages from monospace to a proportional face, back
 * when <body> was monospace and mono cost about eight characters a line —
 * measured on /fact-matcher/board-meeting-icebreakers/ at 375x812, 43
 * characters per line against 51, and the page 15% taller. The whole site is
 * proportional now, so that job is gone. What remains is the part that was
 * always true underneath it: these are the only pages anyone READS a thousand
 * words of, and they deserve a more generous setting than a shelf of blurbs
 * and a form full of labels.
 *
 * The work list comes from the filesystem rather than a hand-kept array, so
 * a guide page added later is picked up without anyone remembering to.
 * Idempotent: adds the class if missing, removes it if a page stops
 * qualifying, and reports both.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUB = "public";

/* Wordy pages that should NOT get the reading setting, each for its reason. */
const KEEP_COMPACT = {
  "/": "The homepage is a shelf, not an article — short blurbs, scanned rather than read.",
  "/api-docs/": "A code reference. Its code and pre elements are already monospace; the prose around them is lookup, not reading.",
  "/melbourne-cup-sweep/printable/": "A fill-in sheet to write on, sized to fit one page of paper.",
};

const MIN_WORDS = 300;

/** Every directory under public/ holding an index.html. */
function pages(dir = PUB, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (existsSync(join(full, "index.html"))) out.push(full);
    pages(full, out);
  }
  return out;
}

const all = [PUB, ...pages()].filter((d) => existsSync(join(d, "index.html")));

let added = 0, removed = 0, already = 0, skipped = 0;
const problems = [];

for (const dir of all.sort()) {
  const file = join(dir, "index.html");
  const html = readFileSync(file, "utf8");
  const route = (dir.replace(/\\/g, "/").replace(/^public/, "") || "/") + (dir === PUB ? "" : "/");

  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  const words = main.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const qualifies =
    !KEEP_COMPACT[route] &&
    !html.includes("<form") &&          // builders are forms, not reading
    html.includes('class="content"') && // has a prose section to restyle
    words >= MIN_WORDS;

  const has = /<body[^>]*\bclass="[^"]*\barticle\b/.test(html);
  if (KEEP_COMPACT[route]) { skipped++; continue; }

  if (qualifies && has) { already++; continue; }
  if (!qualifies && !has) continue;

  let next;
  if (qualifies) {
    if (!/<body>/.test(html)) {
      problems.push(`${route} has a <body> with attributes already — add the class by hand`);
      continue;
    }
    next = html.replace("<body>", '<body class="article">');
    added++;
  } else {
    next = html.replace('<body class="article">', "<body>");
    removed++;
  }
  writeFileSync(file, next);
}

console.log(
  `article face: ${added} added, ${removed} removed, ${already} already marked, ` +
  `${skipped} kept compact on purpose`
);
if (problems.length) {
  for (const p of problems) console.error("  ! " + p);
  process.exit(1);
}
