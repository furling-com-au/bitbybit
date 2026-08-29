/* ============================================================
   Build long-tail guide pages from a data file.
   Run: node scripts/gen-guide-pages.mjs

   Three families — roster guides under /volunteer-roster/, icebreaker
   guides under /fact-matcher/ and the planning-poker explainer under
   /scrum-poker/ — sharing one shell so each new one does not become
   another copy of the same HTML.

   FAQs are rendered VISIBLY here and their JSON-LD is generated
   afterwards by sync-faq-schema.mjs, never written by hand.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SITE = "https://bitibybit.com";

const FAMILIES = [
  {
    data: "scripts/roster-pages.json",
    out: "public/volunteer-roster",
    kicker: "Volunteer rosters",
    navLabel: "the roster tool",
    navHref: "/volunteer-roster/",
    ogImage: "og-roster",
    /* Roster guides open with the matching spreadsheet, because the
       search that brings people here is asking for a file. */
    downloads: {
      "canteen-roster-template": ["school-canteen-roster", "School canteen roster — a week"],
      "school-fete-roster": ["school-fete-roster", "School fete roster — one day"],
      "sausage-sizzle-roster": ["sausage-sizzle-roster", "Sausage sizzle roster — one day"],
    },
    closing: `    <h2>Or let people claim their own shift</h2>
    <p>The spreadsheet is the easy part. Chasing the names is the hard part.
    <a href="/volunteer-roster/">The volunteer roster tool</a> is free and takes a
    minute: you set the shifts, share one link, and people put their own name down.
    No accounts, and you can still print it or export it at the end. There is also
    an <a href="/volunteer-roster/templates/">overview of all five roster shapes</a>
    if you want to compare them.</p>`,
  },
  {
    data: "scripts/icebreaker-pages.json",
    out: "public/fact-matcher",
    kicker: "Icebreakers",
    navLabel: "the icebreaker game",
    navHref: "/fact-matcher/",
    ogImage: "og-fact",
    downloads: {},
    closing: `    <h2>The version where nobody has to think on the spot</h2>
    <p>If the problem is that the same three people answer and everyone else waits
    it out, a written round fixes it. <a href="/fact-matcher/">Fact Matcher</a> is
    free and takes a minute: everyone submits one fact about themselves privately
    from a shared link, then the group guesses who is who. Everybody has already
    answered before anyone has to speak. There is also a longer list of
    <a href="/fact-matcher/icebreaker-questions/">icebreaker questions sorted by
    situation and by time</a>, and a
    <a href="/question-of-the-day/">daily question</a> if you want one that runs
    itself every morning.</p>`,
  },
  {
    data: "scripts/poker-pages.json",
    out: "public/scrum-poker",
    kicker: "Planning poker",
    navLabel: "the poker tool",
    navHref: "/scrum-poker/",
    ogImage: "og-poker",
    downloads: {},
    /* This page exists because the tool page used to carry it. The deck
       is now shown on the builder itself, so the argument for WHY the
       reveal is simultaneous is the part that still needs words. */
    closing: `    <h2>Run a round</h2>
    <p><a href="/scrum-poker/">Scrum poker</a> is free and needs no account from
    anyone: you get one link for the team and a facilitator link for yourself, and
    the same link works for every story this sprint and every sprint after. No
    card is visible to anybody — including you — until the round is turned over.</p>`,
  },
];

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function render(p, fam) {
  const [file, label] = fam.downloads[p.slug] || [];
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
<link rel="canonical" href="${SITE}${fam.out.replace("public", "")}/${p.slug}/">
<meta property="og:title" content="${esc(p.h1)}">
<meta property="og:description" content="${esc(p.metaDescription)}">
<meta property="og:image" content="${SITE}/art/${fam.ogImage}.png">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}${fam.out.replace("public", "")}/${p.slug}/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.h1)}">
<meta name="twitter:description" content="${esc(p.metaDescription)}">
<meta name="twitter:image" content="${SITE}/art/${fam.ogImage}.png">
<meta name="theme-color" content="#f4ead8">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="site-head wrap">
  <a class="wordmark" href="/" aria-label="biti by bit — home">
    <span class="wordmark-blocks" aria-hidden="true"><i></i><i></i><i></i></span>
    biti by bit
    <span class="beta-badge">beta</span>
  </a>
  <nav class="site-nav"><a href="${fam.navHref}">${fam.navLabel}</a></nav>
</header>

<main class="wrap page">
  <p class="kicker">${esc(fam.kicker)}</p>
  <h1>${esc(p.h1)}</h1>
  <p class="lede">${esc(p.lede || "")}</p>
${dl}
  <section class="content">
${p.bodyHtml}

    <h2>Common questions</h2>
${faq}

${fam.closing}
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

let total = 0;
for (const fam of FAMILIES) {
  let pages;
  try { pages = JSON.parse(readFileSync(fam.data, "utf8")).pages; }
  catch { console.log(`  (${fam.data} not present, skipping)`); continue; }
  for (const p of pages) {
    mkdirSync(`${fam.out}/${p.slug}`, { recursive: true });
    writeFileSync(`${fam.out}/${p.slug}/index.html`, render(p, fam), "utf8");
    const words = p.bodyHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    console.log(`  ${fam.out.replace("public", "")}/${p.slug}/  title ${p.title.length}  desc ${p.metaDescription.length}  ~${words} words`);
    total++;
  }
}
console.log(`\n${total} guide pages written. Run sync-faq-schema.mjs to generate their FAQ markup.`);
