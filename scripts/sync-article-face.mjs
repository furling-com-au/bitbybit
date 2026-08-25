/* Marks the long-form pages so styles.css can give their running text a
 * proportional face. Everything else — the homepage, the 21 builders, the
 * share pages — stays monospace, because that is the site's face.
 *
 * Measured on /fact-matcher/board-meeting-icebreakers/ at 375x812 before
 * this existed: 43 characters per line in mono against 51 proportional, and
 * the page 15% taller. 43 is below the comfortable range for running prose,
 * and these are the only pages anyone reads a thousand words of.
 *
 * The work list comes from the filesystem rather than a hand-kept array, so
 * a guide page added later is picked up without anyone remembering to.
 * Idempotent: adds the class if missing, removes it if a page stops
 * qualifying, and reports both.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUB = "public";

/* Long-form pages that should NOT get it, each for its own reason. */
const KEEP_MONO = {
  "/": "The homepage is a shelf, not an article — short blurbs, and it is the first impression of the site's face.",
  "/api-docs/": "A code reference with 245 code and pre elements. Monospace is correct here, not a compromise.",
  "/melbourne-cup-sweep/printable/": "A fill-in sheet whose columns need to line up on paper.",
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
    !KEEP_MONO[route] &&
    !html.includes("<form") &&          // builders keep mono
    html.includes('class="content"') && // has a prose section to restyle
    words >= MIN_WORDS;

  const has = /<body[^>]*\bclass="[^"]*\barticle\b/.test(html);
  if (KEEP_MONO[route]) { skipped++; continue; }

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
  `${skipped} kept monospace on purpose`
);
if (problems.length) {
  for (const p of problems) console.error("  ! " + p);
  process.exit(1);
}
