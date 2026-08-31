/* The example names in every tool's placeholder.
 *
 * They were all the same five — Sam, Priya, Jordan, Alex, Mia — which is
 * nobody's actual group. These are researched Australian names, arranged as
 * CLUB PROFILES: each tool gets one coherent group rather than a sample of
 * everybody.
 *
 * That arrangement is the whole point. Diversity in example data has to live
 * across the site and never be crammed into any one five-person list; one of
 * each background lined up like a poster is the tokenism failure mode, and it
 * reads as a checkbox most clearly to the people most likely to notice. A
 * Bendigo footy club really is all Anglo-Celtic names. A Springvale basketball
 * club really is Vietnamese, Chinese and South Sudanese. Both are honest; a
 * blend of the two is neither.
 *
 * Also load-bearing: most Aboriginal and Torres Strait Islander Australians
 * have English given names, so an all-Anglo list is NOT an all-non-Indigenous
 * list, and Aboriginal-language-origin names are used by Aboriginal and
 * non-Aboriginal families alike. Where one appears it does an ordinary job.
 * Nothing in the UI ever labels a name's origin or prints its meaning —
 * reference sources contradict each other, and the moment example data
 * explains itself it stops being example data and becomes a statement.
 */
import { readFileSync, writeFileSync } from "node:fs";

/* Never generate these. First-name-plus-initial can reconstruct a real,
   identifiable person, and these pairs point at one. Checked, not trusted. */
const BLOCKED = new Set([
  "Kirra D", "Marlee S", "Tarni W", "Tarni B", "Tarni E",
  "Allira T", "Jarrah M", "Nathan B", "Hazem E",
]);

/* Removed during review and staying removed: Lowanna (a dictionary word for
   'girl', not an attested personal name), Kyah (attestation rests on one
   prominent living athlete — in sports demo data), Karen (the meme makes it a
   coin flip whether readers think it was deliberate), Wei (a bare romanised
   syllable that is also a surname). Never as given names: sacred and ancestral
   beings, skin and subsection names such as Napaljarri or Tjapaltjarri — those
   are kinship classifications, not names to assign — dictionary-word filler,
   and Torres Strait family surnames belonging to identifiable families. */
const RETIRED = ["Lowanna", "Kyah", "Karen", "Wei"];

const PROFILES = {
  "grand-final-sweep": {
    who: "A Bendigo footy club. Regional Victoria, so all Anglo-Celtic — and the shortenings are how the names are actually said.",
    names: ["Dave K", "Shaz", "Macca", "Bec T", "Trev", "Lachie"],
  },
  "melbourne-cup-sweep": {
    who: "A Melbourne office on Cup day. Mostly Anglo with a couple of others, which is what a metro workplace looks like.",
    names: ["Michelle W", "Con S", "Dave K", "Priya S", "Trent B", "Sharon M"],
  },
  "kris-kringle": {
    who: "An accounts team. Two people share an initial because that is how a real list goes.",
    names: ["Sharon M", "Dave K", "Linh T", "Michelle W", "Matt R", "Con S"],
  },
  "team-picker": {
    who: "A Springvale basketball club. Vietnamese, Chinese and South Sudanese families, which is genuinely that club.",
    names: ["Minh N", "Vy T", "Kevin C", "Deng A", "Grace S", "Tuan L"],
  },
  "tournament-bracket": {
    who: "An office table tennis ladder.",
    names: ["Raj P", "Dave K", "Mei L", "Bec T", "Arjun S", "Craig P"],
  },
  "fact-matcher": {
    who: "A workplace icebreaker. Michelle W and Josh W are mother and son on the same club list elsewhere; here they are colleagues.",
    names: ["Michelle W", "Josh W", "Kirra B", "Dave S", "Nic P", "Tony H"],
  },
};

const problems = [];
for (const [dir, p] of Object.entries(PROFILES)) {
  for (const n of p.names) {
    if (BLOCKED.has(n)) problems.push(`${dir}: "${n}" is on the do-not-generate list`);
    if (RETIRED.some((r) => n.split(" ")[0] === r)) problems.push(`${dir}: "${n}" uses a retired given name`);
  }
  if (new Set(p.names).size !== p.names.length) problems.push(`${dir}: duplicate name in the list`);
}
if (problems.length) {
  for (const x of problems) console.error("  ! " + x);
  process.exit(1);
}

/* team-picker is one-tap (B9): the names list is seeded as real textarea
   content, not a placeholder, so the shuffle button works on first tap
   instead of sitting disabled with nothing typed. Every other tool here
   still asks the visitor to type their own list, so a placeholder is right
   for them. */
const SEEDED_VALUE = new Set(["team-picker"]);

let changed = 0, already = 0;
for (const [dir, p] of Object.entries(PROFILES)) {
  const file = `public/${dir}/index.html`;
  const html = readFileSync(file, "utf8");
  const want = p.names.join("\n");

  const re = SEEDED_VALUE.has(dir)
    ? /(<textarea id="names"[^>]*>)([^<]*)(<\/textarea>)/
    : /placeholder="([^"]*\n[^"]*)"/;
  const m = html.match(re);
  if (!m) {
    console.error(`  ! ${dir}: no ${SEEDED_VALUE.has(dir) ? "#names textarea" : "multi-line placeholder"} to replace`);
    process.exit(1);
  }
  const current = SEEDED_VALUE.has(dir) ? m[2] : m[1];
  if (current === want) { already++; continue; }
  const replacement = SEEDED_VALUE.has(dir) ? `$1${want}$3` : `placeholder="${want}"`;
  writeFileSync(file, html.replace(re, replacement));
  changed++;
}

console.log(`example names: ${changed} written, ${already} already current, ${Object.keys(PROFILES).length} tools`);
