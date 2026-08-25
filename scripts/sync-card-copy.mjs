/* Short card blurbs for phones.
 *
 * The two-column shelf below 34rem gives each card about 22 characters a
 * line in monospace. Clamped to two lines that is ~44 characters, and the
 * written blurbs average 92 — measured on the live page, 0 of 21 showed in
 * full and the mean was 48% visible, so every card ended mid-sentence.
 *
 * A shorter font would not have fixed it (still 0 of 21), and cutting the
 * long copy would make desktop worse, where it fits and reads well. So both
 * exist and the media query picks: only one is ever displayed, so only one
 * is in the accessibility tree and the link's name stays clean.
 *
 * Idempotent: rewrites the short span in place if the text changes here.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "public/index.html";

/* Keep the voice: specific, dry, and the joke intact where there is one.
   Budget is ~44 characters; these all sit under 42. */
const SHORT = {
  "Grand Final Sweep":     "AFL or NRL margin sweep, drawn fair.",
  "Melbourne Cup Sweep":   "The 24-horse office draw, no scissors.",
  "Team Picker":           "Fair random teams. Nothing stored, ever.",
  "Tournament Bracket":    "Tap the winners, crown a champion.",
  "Baby Guess Pool":       "Guess the date and weight. Closest wins.",
  "Pixel Gift Registry":   "A registry drawn as the thing itself.",
  "Kris Kringle":          "Draw names, private reveals, no emails.",
  "Group Card":            "One card, everyone signs it.",
  "Recipe Collection":     "Everyone adds one, you get a book.",
  "Gift Idea Board":       "Suggest, upvote, claim. No double-buys.",
  "Bring a Plate":         "Stops six pavlovas and no salad.",
  "Secret Role Dealer":    "Werewolf and Spyfall, dealt by link.",
  "Volunteer Roster":      "Post the shifts, watch them fill.",
  "Fact Matcher":          "Secret facts, guess who's who.",
  "Hens &amp; Shower Planner": "Who's bringing what, and the plan.",
  "Meal Train":            "Meals by date when a family needs them.",
  "Group Vote":            "A dead-simple poll for a group call.",
  "Scrum Poker":           "Estimate together, reveal at once.",
  "Kudos Wall":            "Short thank-yous, and the names stay on.",
  "Weekly Pulse":          "One tap a week, genuinely anonymous.",
  "Coffee Roulette":       "Pairs the team for a coffee, each round.",
  "Question of the Day":   "A daft one every morning, with a vote.",
};

const MAX = 44;
for (const [name, text] of Object.entries(SHORT))
  if (text.length > MAX) throw new Error(`"${name}" short blurb is ${text.length} chars, over the ${MAX} the card fits`);

let html = readFileSync(FILE, "utf8");
const CARD = /<span class="tool-name">([^<]*)<\/span>\s*\n(\s*)<span class="tool-desc">([\s\S]*?)<\/span>(\s*\n\s*<span class="tool-desc-short">[\s\S]*?<\/span>)?/g;

const seen = new Set();
const problems = [];
let changed = 0, already = 0;

html = html.replace(CARD, (whole, name, indent, longText, existingShort) => {
  seen.add(name);
  const short = SHORT[name];
  if (!short) { problems.push(`no short blurb for "${name}" — add one to SHORT`); return whole; }
  const rebuilt =
    `<span class="tool-name">${name}</span>\n` +
    `${indent}<span class="tool-desc">${longText}</span>\n` +
    `${indent}<span class="tool-desc-short">${short}</span>`;
  if (rebuilt === whole) { already++; return whole; }
  changed++;
  return rebuilt;
});

for (const name of Object.keys(SHORT))
  if (!seen.has(name)) problems.push(`SHORT has "${name}" but no card on the homepage uses it`);

if (!problems.length) writeFileSync(FILE, html);
console.log(`card copy: ${changed} written, ${already} already current, ${seen.size} cards`);
if (problems.length) {
  for (const p of problems) console.error("  ! " + p);
  process.exit(1);
}
