/* Builds public/sitemap.xml from the filesystem.
 *
 * It was hand-maintained, and it drifted the moment a tool was added: Scrum
 * Poker shipped with a landing page, a canonical, an FAQ and an entry in
 * llms.txt, and was the one thing missing from the file that tells search
 * engines the page exists. Same failure as the API catalog, same fix — derive
 * it from what is actually on disk rather than from someone remembering.
 *
 * LASTMOD. It used to come from each file's own mtime, on the reasoning that
 * mtime is when the page changed. It is not. npm run build rewrites nearly
 * every index.html on every run, so mtime is when the BUILD ran, and all 54
 * URLs came out carrying one identical date — precisely the "the whole site
 * changed" claim this comment used to say it was avoiding. A one-line
 * analytics tweak to a shared snippet (38a9f77) restamped every page on the
 * site. On a fresh clone it is worse still: mtime is checkout time, so every
 * URL would read as modified today no matter what its history was.
 *
 * git log per file is no better here, for the same reason — that analytics
 * tweak is one commit touching all 54 files, so git also says they all
 * changed together.
 *
 * So lastmod is remembered, not measured. scripts/sitemap-lastmod.json holds
 * a content hash and a date per route; the date advances only when the hash
 * moves. Rewriting a page with identical bytes changes nothing. indexnow.mjs
 * already worked this way and imports the same hash function, so the two
 * cannot come to disagree about which pages changed.
 *
 * That manifest is COMMITTED, unlike .indexnow-state.json. It is the site's
 * only record of when each page really changed; regenerating it from scratch
 * is exactly the loss of history this is here to prevent.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, sep } from "node:path";
import { pageHash, today } from "./page-hash.mjs";

const PUB = "public";
const ORIGIN = "https://bitibybit.com";
const MANIFEST = "scripts/sitemap-lastmod.json";

/* Directories holding an index.html, recursively — guide pages live one
   level down (e.g. /fact-matcher/standup-games/). */
function pages(dir = PUB, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (existsSync(join(full, "index.html"))) out.push(full);
    pages(full, out);
  }
  return out;
}

/* join() builds these with the platform separator, so undo it with the same
   one rather than a hardcoded backslash. A URL path is always forward slashes
   and this ran on Windows. */
const route = (d) => (d.split(sep).join("/").replace(/^public/, "") || "") + "/";

const entries = [PUB, ...pages()]
  .filter((d) => existsSync(join(d, "index.html")))
  .map((d) => {
    const file = join(d, "index.html");
    return { route: route(d), html: readFileSync(file, "utf8"), hash: pageHash(file) };
  })
  /* A page that tells crawlers not to index it has no business being
     advertised in a sitemap — the two would be giving opposite instructions
     about the same URL. */
  .filter((e) => !/<meta[^>]+name="robots"[^>]+noindex/i.test(e.html))
  .sort((a, b) => (a.route === "/" ? -1 : b.route === "/" ? 1 : a.route.localeCompare(b.route)));

/* A route with no record, or one whose bytes have moved, changed today.
   Everything else keeps the date it was last genuinely modified. A brand new
   page and a just-edited page are the same case and want the same answer. */
const known = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")).pages || {} : {};
const now = today();
const manifest = {};
const changed = [];

for (const e of entries) {
  const prev = known[e.route];
  if (!prev || prev.hash !== e.hash) changed.push(e.route);
  e.lastmod = prev && prev.hash === e.hash ? prev.lastmod : now;
  manifest[e.route] = { hash: e.hash, lastmod: e.lastmod };
}

/* Routes that no longer exist are dropped rather than carried forever. If one
   ever comes back it is a new page, and today is the honest answer for it. */
const dropped = Object.keys(known).filter((r) => !(r in manifest));

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries.map((e) => `  <url><loc>${ORIGIN}${e.route}</loc><lastmod>${e.lastmod}</lastmod></url>`).join("\n") +
  `\n</urlset>\n`;

writeFileSync(join(PUB, "sitemap.xml"), xml, { encoding: "utf8" });
writeFileSync(MANIFEST, JSON.stringify({ pages: manifest }, null, 2) + "\n", { encoding: "utf8" });

/* Loud check: every builder page must be advertised. A tool nobody can find
   in the sitemap is a tool that took the SEO work and got none of the value. */
const builders = readdirSync(PUB, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(PUB, d.name, "index.html")))
  .filter((d) => readFileSync(join(PUB, d.name, "index.html"), "utf8").includes("<form"))
  .map((d) => `/${d.name}/`);
const listed = new Set(entries.map((e) => e.route));
const missing = builders.filter((b) => !listed.has(b));

console.log(`sitemap: ${entries.length} urls (${builders.length} tool pages), ${changed.length} dated ${now}`);
for (const r of changed.slice(0, 10)) console.log(`    ${r}`);
if (changed.length > 10) console.log(`    …and ${changed.length - 10} more`);
if (dropped.length) console.log(`  dropped from the manifest: ${dropped.join(", ")}`);
if (missing.length) {
  console.error(`  ! builder pages missing from the sitemap: ${missing.join(", ")}`);
  process.exit(1);
}
