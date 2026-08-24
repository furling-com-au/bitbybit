/* ============================================================
   Rebuild every FAQPage JSON-LD block from the FAQ that is
   actually visible on the page.
   Run: node scripts/sync-faq-schema.mjs

   Google requires FAQPage structured data to match content the
   visitor can see. Hand-maintaining the markup alongside the copy
   guarantees drift: the markup drifts toward keywords ("Can wedding
   guests pay by card?") while the page keeps the human phrasing
   ("Can guests pay by card?"), and one of them ends up describing a
   question the page never asks.

   So the page is the source of truth and the markup is generated
   from it. Re-run this after editing any FAQ copy.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";
// node:fs globSync is available from Node 22; fall back if absent

const ENT = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
  "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…",
};
const decode = (s) =>
  s.replace(/&[a-z]+;|&#\d+;/gi, (e) =>
    ENT[e] ?? (e.startsWith("&#") ? String.fromCharCode(+e.slice(2, -1)) : e));

/* Strip inline markup and collapse whitespace — what a reader sees. */
const text = (html) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/* Pull visible question/answer pairs: an <h3> followed by its <p>s,
   up to the next heading. Only inside the FAQ section, so unrelated
   h3/p pairs elsewhere on the page are ignored. */
function visibleFaq(html) {
  const start = html.search(/<h2[^>]*>\s*(FAQ|Common questions|Questions)\s*<\/h2>/i);
  if (start === -1) return [];
  // The FAQ runs to the end of its section, or to the footer.
  const rest = html.slice(start);
  const endRel = rest.search(/<\/section>|<footer/i);
  const block = endRel === -1 ? rest : rest.slice(0, endRel);

  const out = [];
  const re = /<h3[^>]*>(.*?)<\/h3>([\s\S]*?)(?=<h3|<h2|$)/gi;
  let m;
  while ((m = re.exec(block))) {
    const q = text(m[1]);
    const paras = [...m[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((p) => text(p[1]))
      .filter(Boolean);
    if (q && paras.length) out.push({ q, a: paras.join(" ") });
  }
  return out;
}

const faqBlock = (pairs) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }, null, 2);

const files = globSync("public/**/*.html");
let changed = 0, checked = 0, skipped = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const scriptRe = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
  let out = src, hit = false, m;

  while ((m = scriptRe.exec(src))) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch { continue; }
    if (parsed["@type"] !== "FAQPage") continue;
    checked++;

    const pairs = visibleFaq(src);
    if (!pairs.length) { skipped.push(`${file} — FAQPage markup but no visible FAQ found`); continue; }

    const rebuilt = `<script type="application/ld+json">\n${faqBlock(pairs)}\n</script>`;
    if (m[0] !== rebuilt) { out = out.replace(m[0], rebuilt); hit = true; }
  }

  if (hit) { writeFileSync(file, out, "utf8"); changed++; }
}

console.log(`FAQPage blocks checked: ${checked}`);
console.log(`files rewritten:        ${changed}`);
if (skipped.length) {
  console.log(`\nNEEDS A HUMAN (${skipped.length}):`);
  for (const s of skipped) console.log("  " + s);
}
