/* Builds public/sitemap.xml from the filesystem.
 *
 * It was hand-maintained, and it drifted the moment a tool was added: Scrum
 * Poker shipped with a landing page, a canonical, an FAQ and an entry in
 * llms.txt, and was the one thing missing from the file that tells search
 * engines the page exists. Same failure as the API catalog, same fix — derive
 * it from what is actually on disk rather than from someone remembering.
 *
 * lastmod comes from each file's own mtime, not from today's date. Stamping
 * every URL with "now" on every build tells crawlers the whole site changed
 * whenever anything did, which is both untrue and a good way to be ignored.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUB = "public";
const ORIGIN = "https://bitibybit.com";

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

const iso = (t) => new Date(t).toISOString().slice(0, 10);

const entries = [PUB, ...pages()]
  .filter((d) => existsSync(join(d, "index.html")))
  .map((d) => {
    const file = join(d, "index.html");
    const html = readFileSync(file, "utf8");
    const route = (d.replace(/\\/g, "/").replace(/^public/, "") || "") + "/";
    return { route, html, lastmod: iso(statSync(file).mtimeMs) };
  })
  /* A page that tells crawlers not to index it has no business being
     advertised in a sitemap — the two would be giving opposite instructions
     about the same URL. */
  .filter((e) => !/<meta[^>]+name="robots"[^>]+noindex/i.test(e.html))
  .sort((a, b) => (a.route === "/" ? -1 : b.route === "/" ? 1 : a.route.localeCompare(b.route)));

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries.map((e) => `  <url><loc>${ORIGIN}${e.route}</loc><lastmod>${e.lastmod}</lastmod></url>`).join("\n") +
  `\n</urlset>\n`;

writeFileSync(join(PUB, "sitemap.xml"), xml);

/* Loud check: every builder page must be advertised. A tool nobody can find
   in the sitemap is a tool that took the SEO work and got none of the value. */
const builders = readdirSync(PUB, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(PUB, d.name, "index.html")))
  .filter((d) => readFileSync(join(PUB, d.name, "index.html"), "utf8").includes("<form"))
  .map((d) => `/${d.name}/`);
const listed = new Set(entries.map((e) => e.route));
const missing = builders.filter((b) => !listed.has(b));

console.log(`sitemap: ${entries.length} urls (${builders.length} tool pages)`);
if (missing.length) {
  console.error(`  ! builder pages missing from the sitemap: ${missing.join(", ")}`);
  process.exit(1);
}
