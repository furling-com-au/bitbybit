/* Prove the scrum poker result summary works on BOTH decks.
 *
 * It did not. summarise() ranked votes with parseFloat(card), and the t-shirt
 * deck contains no numbers - parseFloat("M") is NaN. So every t-shirt vote was
 * filtered out as "unsure", nums came back empty, and verdict() fell through
 * to "Nobody put a number on it. That is usually a sign the story needs
 * splitting." A team could vote a unanimous M and be told they had not
 * answered. The deck was shipped, selectable from a radio button on the
 * builder, and broken for every round ever played on it.
 *
 * The fix ranks by position in the deck array instead, which is also what
 * ordering an estimate means: 8 is not "more" than 5 by arithmetic, it is one
 * step coarser. This checks both decks so the numeric one cannot regress
 * either.
 *
 * summarise() and its dependencies are READ OUT OF src/tools/poker.js at run
 * time rather than copied, so this cannot drift into testing a stale version.
 */
import { readFileSync } from "node:fs";

const src = readFileSync("src/tools/poker.js", "utf8");
const grab = (re, what) => {
  const m = src.match(re);
  if (!m) {
    console.error(`\n  ! ${what} not found in src/tools/poker.js — it was renamed`);
    console.error("  ! or restructured, and the deck summary is now untested.\n");
    process.exit(1);
  }
  return m[0];
};

const parts = [
  grab(/const DECKS = \{[\s\S]*?\n\};/, "DECKS"),
  grab(/const NON_NUMERIC = .*?;/, "NON_NUMERIC"),
  grab(/const deckOf = [\s\S]*?DECKS\.fib;/, "deckOf"),
  grab(/function summarise\(votes, deckName\) \{[\s\S]*?\n\}/, "summarise(votes, deckName)"),
];
const summarise = new Function(`${parts.join("\n")}; return summarise;`)();

const V = (...cards) => cards.map((c, i) => ({ name: "P" + i, card: c }));
const CASES = [
  // the deck that was broken
  ["tshirt", V("M", "M", "M"), { agreed: true, low: "M", high: "M", unsure: 0 }, "t-shirt unanimous"],
  ["tshirt", V("S", "M", "L"), { agreed: false, low: "S", high: "L", unsure: 0 }, "t-shirt spread"],
  ["tshirt", V("XXL", "XS"), { agreed: false, low: "XS", high: "XXL", unsure: 0 }, "t-shirt orders XS below XXL"],
  ["tshirt", V("M", "M", "?"), { agreed: false, low: "M", high: "M", unsure: 1 }, "t-shirt with one unsure"],
  ["tshirt", V("?", "☕"), { agreed: false, low: null, high: null, unsure: 2 }, "t-shirt all non-votes"],
  // the deck that already worked, so it cannot regress
  ["fib", V("5", "5", "5"), { agreed: true, low: "5", high: "5", unsure: 0 }, "fib unanimous"],
  ["fib", V("3", "13"), { agreed: false, low: "3", high: "13", unsure: 0 }, "fib spread"],
  ["fib", V("21", "2"), { agreed: false, low: "2", high: "21", unsure: 0 }, "fib orders 2 below 21"],
  ["fib", V("8", "8", "?"), { agreed: false, low: "8", high: "8", unsure: 1 }, "fib with one unsure"],
  ["fib", V("?"), { agreed: false, low: null, high: null, unsure: 1 }, "fib all non-votes"],
  // a card that is not in the chosen deck must not rank
  ["fib", V("M", "5"), { agreed: false, low: "5", high: "5", unsure: 1 }, "foreign card counts as unsure"],
];

let failed = 0;
for (const [deck, votes, want, label] of CASES) {
  const g = summarise(votes, deck);
  const got = {
    agreed: g.agreed,
    low: (g.low && g.low.card) || null,
    high: (g.high && g.high.card) || null,
    unsure: g.unsure,
  };
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error(`      ${deck} — ${label}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
  }
}

console.log(`poker summary: ${CASES.length} rounds checked across both decks, ${failed} wrong`);

if (failed) {
  console.error("\n  ! The result summary is wrong. If a t-shirt case failed, teams using");
  console.error("  ! that deck are being told they did not answer when they did.\n");
  process.exit(1);
}
