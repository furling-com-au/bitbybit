/* ============================================================
   Build the long-tail roster guide pages from one data file.
   Run: node scripts/gen-roster-pages.mjs

   Each page targets a specific search ("canteen roster template",
   "school fete roster", "sausage sizzle roster") and offers the
   matching download, because the search intent is a file.

   The FAQ is rendered VISIBLY here and the JSON-LD is generated
   from the page afterwards by sync-faq-schema.mjs — never written
   by hand, so the markup cannot drift from the page again.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SITE = "https://bitibybit.com";
const OUT = "public/volunteer-roster";
const { pages } = JSON.parse(readFileSync("scripts/roster-pages.json", "utf8"));

/* Which download belongs on which page. */
const DOWNLOAD = {
  "canteen-roster-template": ["school-canteen-roster", "School canteen roster — a week"],
  "school-fete-roster": ["school-fete-roster", "School fete roster — one day"],
  "sausage-sizzle-roster": ["sausage-sizzle-roster", "Sausage sizzle roster — one day"],
};

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* The body arrives as HTML from the writing step; entities in it are
   already correct, so it is inserted as-is. Only attribute values and
   FAQ text get escaped here. */
function page(p) {
  const [file, label] = DOWNLOAD[p.slug] || [];
  const dl = file ? `
    <div class="dl-panel">
      <p class="dl-label">${esc(label)}</p>
      <p class="dl-row">
        <a class="dl" href="/volunteer-roster/templates/${file}.xlsx" download>Excel (.xlsx)</a>
        <a class="dl" href="/volunteer-roster/templates/${file}.csv" download>CSV</a>
      </p>
      <p class="fine">Shifts and jobs already filled in — you add the names. Free,
      no sign-up. Or <a href="/volunteer-roster/">run it online</a> and let people
      claim their own shift.</p>
    </div>` : "";

  const faq = p.faq.map((f) => `
    <h3 class="faq-q">${esc(f.q)}</h3>
    <p>${esc(f.a)}</p>`).join("");

  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.metaDescription)}">
<link rel="canonical" href="${SITE}/volunteer-roster/${p.slug}/">
<meta property="og:title" content="${esc(p.h1)}">
<meta property="og:description" content="${esc(p.metaDescription)}">
<meta property="og:image" content="${SITE}/art/og-roster.png">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/volunteer-roster/${p.slug}/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.h1)}">
<meta name="twitter:description" content="${esc(p.metaDescription)}">
<meta name="twitter:image" content="${SITE}/art/og-roster.png">
<meta name="theme-color" content="#f4ead8">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="scanlines" aria-hidden="true"></div>
<header class="site-head wrap">
  <a class="wordmark" href="/" aria-label="biti by bit — home">
    <span class="wordmark-blocks" aria-hidden="true"><i></i><i></i><i></i></span>
    biti by bit
    <span class="beta-badge">beta</span>
  </a>
  <nav class="site-nav"><a href="/volunteer-roster/">the roster tool</a></nav>
</header>

<main class="wrap page">
  <p class="kicker">Volunteer rosters</p>
  <h1>${esc(p.h1)}</h1>
  <p class="lede">${esc(p.lede || "")}</p>
${dl}
  <section class="content">
${p.bodyHtml}

    <h2>Common questions</h2>
${faq}

    <h2>Or let people claim their own shift</h2>
    <p>The spreadsheet is the easy part. Chasing the names is the hard part.
    <a href="/volunteer-roster/">The volunteer roster tool</a> is free and takes a
    minute: you set the shifts, share one link, and people put their own name down.
    No accounts, and you can still print it or export it to a spreadsheet at the end.
    There is also an <a href="/volunteer-roster/templates/">overview of all five
    roster shapes</a> if you want to compare them.</p>
  </section>

  <footer class="site-foot">
    <p class="fine">Part of <a class="quiet-link" href="/">biti by bit</a> —
    small free tools for groups. No ads, no accounts.</p>
    <p class="foot-links">
      <a class="foot-link" href="https://buy.stripe.com/00wbJ1bri8J2c0yf8mbsc02" target="_blank" rel="noopener">☕ Buy me a coffee</a>
      <a class="foot-link" href="https://github.com/furling-com-au/bitbybit" target="_blank" rel="noopener">◆ Source on GitHub</a>
    </p>
  </footer>
</main>
<!-- Cloudflare Web Analytics: public pages only, never on /s/, /e/ or /p/. -->
<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "7df4259a0571411390aec9252ecc4f3e"}'></script>
</body>
</html>
`;
}

for (const p of pages) {
  mkdirSync(`${OUT}/${p.slug}`, { recursive: true });
  writeFileSync(`${OUT}/${p.slug}/index.html`, page(p), "utf8");
  const words = p.bodyHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  console.log(`  /volunteer-roster/${p.slug}/  title ${p.title.length}  desc ${p.metaDescription.length}  ~${words} words  ${p.faq.length} FAQ`);
}
console.log(`\n${pages.length} pages written. Run sync-faq-schema.mjs next to generate their FAQ markup.`);
