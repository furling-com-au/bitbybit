/* Build one real roster per club, ready to paste into one email each.
 *
 * Run:  node scripts/prebuild-rosters.mjs clubs.json [--remote]
 *
 * The whole approach rests on one thing: never send the site, send them
 * THEIR thing, already built, for a date already on their calendar. Their
 * job becomes "share a link", not "evaluate a tool, then build a roster on
 * a Tuesday night". This makes fifteen of those in about a minute.
 *
 * The hard rule this script CANNOT enforce, so read it here: the create tap
 * has to be theirs in the end. What you are sending is a draft they own and
 * can edit or delete — the owner link is in every email for exactly that
 * reason. If you run their club for them, you are the organiser and they are
 * a participant, which manufactures the participants-not-organisers outcome
 * that is already the measured problem.
 *
 * clubs.json is a list of:
 *   {
 *     "club":   "Yarraville Cricket Club",
 *     "preset": "cricket-junior",         // key from public/roster-presets.js
 *     "title":  "Round 1 duty roster",
 *     "date":   "Saturday 11 October",    // free text, shown at the top
 *     "note":   ""                        // optional, shown to volunteers
 *   }
 *
 * Prints a table of club, share link and owner link. Nothing is emailed and
 * nothing is sent anywhere — this only creates the drafts.
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const REMOTE = args.includes("--remote");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: node scripts/prebuild-rosters.mjs clubs.json [--remote]");
  process.exit(1);
}
const BASE = REMOTE ? "https://bitibybit.com" : "http://127.0.0.1:8787";

/* The presets are a browser file (a bare const, no export), so read and
   evaluate rather than import — one source of truth beats a second copy
   that drifts. */
const presetSrc = readFileSync("public/roster-presets.js", "utf8");
const ROSTER_PRESETS = new Function(`${presetSrc}; return ROSTER_PRESETS;`)();

const clubs = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(clubs) || !clubs.length) {
  console.error("clubs.json must be a non-empty array");
  process.exit(1);
}

/* Fail before creating anything, so a typo in one row does not leave you
   with eleven rosters and no idea which four are missing. */
const problems = [];
clubs.forEach((c, i) => {
  if (!c.club) problems.push(`row ${i + 1}: no club name`);
  if (!ROSTER_PRESETS[c.preset])
    problems.push(`row ${i + 1} (${c.club || "?"}): preset "${c.preset}" is not one of ${Object.keys(ROSTER_PRESETS).join(", ")}`);
  if (!c.date) problems.push(`row ${i + 1} (${c.club || "?"}): no date — the date on their calendar is the entire hook`);
});
if (problems.length) {
  for (const p of problems) console.error("  ! " + p);
  process.exit(1);
}

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 140)}`);
  return JSON.parse(text);
}

/* "Job time xN" -> { label, capacity }, the shape /api/roster wants. */
function parseShift(line) {
  const m = line.match(/^(.*?)\s*[xX]\s*(\d+)$/);
  return m && m[1].trim()
    ? { label: m[1].trim(), capacity: Math.max(1, parseInt(m[2], 10)) }
    : { label: line.trim(), capacity: 1 };
}

console.log(`\nbuilding ${clubs.length} rosters against ${BASE}\n`);
const made = [];
for (const c of clubs) {
  const preset = ROSTER_PRESETS[c.preset];
  try {
    const res = await post("/api/roster", {
      title: `${c.club} — ${c.title || preset.label}`,
      eventDate: c.date,
      note: c.note || "",
      shifts: preset.shifts.map(parseShift),
    });
    made.push({ club: c.club, ...res });
    console.log(`  ok   ${c.club}`);
  } catch (e) {
    console.log(`  FAIL ${c.club}: ${e.message}`);
  }
}

if (!made.length) process.exit(1);

console.log(`\n${made.length}/${clubs.length} built.\n`);
console.log("  Paste the SHARE link into the email. The OWNER link is theirs —");
console.log("  it lets them edit every shift or delete the whole thing, and saying");
console.log("  so in the email is what makes this a draft rather than a liberty.\n");
for (const m of made) {
  console.log(`  ${m.club}`);
  console.log(`    share: ${BASE}/s/${m.slug}`);
  console.log(`    owner: ${BASE}/e/${m.editToken}\n`);
}
console.log("  Create limit is 20 per hour from one connection — 15 fits, 25 does not.\n");
