/* Put the field you actually have to fill in, and the button that submits it,
 * at the top of the builder on a phone.
 *
 * Measured before this ran, at 375x812 on /kris-kringle/: the only controls
 * reachable without scrolling were Title, Budget and Swap day — all three
 * optional. The names box sat at 932px and the button at 1165px against an
 * 812px viewport. Mobile is two thirds of traffic.
 *
 * WHY THE DOM AND NOT CSS `order`
 * `.builder-cols` collapses to one column at <=720px, so DOM order already
 * IS visual order there. Reordering with `order` would desync them, and on a
 * phone that is felt rather than theoretical: iOS Safari and Android Chrome's
 * next/previous-field arrows walk DOM order, so the visitor would tab from
 * the names box back up into the optional fields. It also cannot move the
 * submit button, which is a sibling of `.builder-cols`, not a child of it.
 *
 * The script only ever MOVES whole blocks. It never edits a line's content,
 * only its indentation, and it verifies afterwards that the set of element
 * ids in the form is unchanged.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUB = "public";

/* Which column holds the thing the visitor must actually deal with.
 * Determined by reading every builder: the column carrying the required
 * list field, or the first required input. 1 means it is already first
 * and only the button moves. */
const PRIMARY = {
  "bring-a-plate": 2,        // categories (prefilled)
  "coffee-roulette": 2,      // names
  "fact-matcher": 2,         // names
  "gift-ideas": 1,           // recipient is required and already first
  "grand-final-sweep": 1,    // teamA/teamB are the first thing you must type
  "group-card": 1,           // recipient
  "kris-kringle": 2,         // names
  "kudos-wall": 1,           // nothing required; one-tap button is already up top
  "melbourne-cup-sweep": 2,  // names
  /* Both of these were skipped until their columns were rearranged: folding
     the button up would have put it above a required field (meal.js:136
     needs #firstDate) or above the prefilled list that IS the tool (hens
     #categories). Column 1 now holds everything you must deal with, so the
     button belongs at the foot of it. */
  "meal-train": 1,
  "hens-planner": 1,
  /* Roles is the only thing you must type and it is already in column 1;
     column 2 holds one optional note. This was on the skip list for a
     reason that turned out to be about something else — applyPreset and
     redeal fix the ROLE COUNT at create time, which is an argument
     against prefilling the box, not against moving the button. */
  "secret-role-dealer": 1,
  "team-picker": 1,          // names already first
  "tournament-bracket": 2,   // entrants
  "volunteer-roster": 2,     // shifts (prefilled)
  "weekly-pulse": 1,         // nothing required
  "scrum-poker": 1,          // story + deck are column one; team is optional
};

/* Left alone on purpose, each for its own reason. */
const SKIP = {
  "gift-registry":
    "registry-make.js requires only #coupleNames, so lifting the button above " +
    "the payMethod/payId/account block would let someone publish a registry " +
    "with nowhere to send money. Worse than no registry.",
};

/** Leading-space count, or -1 for a blank line. */
const indentOf = (l) => (l.trim() === "" ? -1 : l.length - l.trimStart().length);

/** Index of the line closing a block opened at `open`, matched on indent. */
function closingLine(lines, open, indent) {
  for (let i = open + 1; i < lines.length; i++)
    if (indentOf(lines[i]) === indent && lines[i].trim() === "</div>") return i;
  return -1;
}

function fold(dir, html) {
  const lines = html.split("\n");

  // The OUTER builder-cols only: nested ones (kris-kringle puts Budget and
  // Swap day side by side inside column 1) sit at a deeper indent.
  let colsAt = -1, colsIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('<div class="builder-cols">')) {
      colsAt = i; colsIndent = indentOf(lines[i]); break;
    }
  }
  if (colsAt === -1) return { html, why: "no builder-cols" };
  const colsEnd = closingLine(lines, colsAt, colsIndent);
  if (colsEnd === -1) throw new Error(`${dir}: unclosed builder-cols`);

  // The two column divs, one indent level in.
  const childIndent = colsIndent + 2;
  const cols = [];
  for (let i = colsAt + 1; i < colsEnd; i++) {
    if (indentOf(lines[i]) === childIndent && lines[i].trim() === "<div>") {
      const end = closingLine(lines, i, childIndent);
      if (end === -1 || end > colsEnd) throw new Error(`${dir}: unclosed column div`);
      cols.push([i, end]);
      i = end;
    }
  }
  if (cols.length !== 2) throw new Error(`${dir}: expected 2 columns, found ${cols.length}`);

  /* Already folded? Decide by POSITION, never by comparing text: the button
     gets re-indented when it moves, so a text comparison flips state on every
     other run and the built output would depend on the parity of build runs. */
  let tailStart = -1, tailEnd = -1;
  for (let i = colsEnd + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("</form>")) break;
    if (t.startsWith('<p class="form-error"') && tailStart === -1) tailStart = i;
    if (t.startsWith("<button type=\"submit\"")) {
      if (tailStart === -1) tailStart = i;
      tailEnd = i;
      while (tailEnd < lines.length && !lines[tailEnd].includes("</button>")) tailEnd++;
      break;
    }
  }
  if (tailEnd === -1) return { html, why: "already folded (no submit after the columns)" };

  const tail = lines.slice(tailStart, tailEnd + 1);
  const rest = lines.slice(0, tailStart).concat(lines.slice(tailEnd + 1));

  // Indices shift only after tailStart, and every block we touch is before it.
  const [aStart, aEnd] = cols[0];
  const [bStart, bEnd] = cols[1];
  const colA = rest.slice(aStart, aEnd + 1);
  const colB = rest.slice(bStart, bEnd + 1);
  const primary = PRIMARY[dir] === 2 ? colB : colA;
  const secondary = PRIMARY[dir] === 2 ? colA : colB;

  // Re-indent the tail into the column: from the form's own level to the
  // column's content level.
  const shift = childIndent + 2 - indentOf(tail[tail.length - 1] === "" ? tail[0] : tail[0]);
  const movedTail = tail.map((l) => (l.trim() === "" ? l : " ".repeat(Math.max(0, indentOf(l) + shift)) + l.trim()));

  const withTail = primary.slice(0, -1).concat(movedTail, primary[primary.length - 1]);
  const rebuilt = rest
    .slice(0, aStart)
    .concat(withTail, secondary, rest.slice(bEnd + 1));

  return { html: rebuilt.join("\n"), why: null };
}

/** Every id in the form, so a move can be proven not to have lost anything. */
function formIds(html) {
  const s = html.indexOf("<form"), e = html.indexOf("</form>");
  if (s === -1) return [];
  return (html.slice(s, e).match(/id="[a-zA-Z]+"/g) || []).sort();
}

const dirs = readdirSync(PUB, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(PUB, d.name, "index.html")))
  .map((d) => d.name)
  .filter((d) => readFileSync(join(PUB, d, "index.html"), "utf8").includes('class="builder-cols"'))
  .sort();

let written = 0, skipped = 0, already = 0;
for (const dir of dirs) {
  if (SKIP[dir]) { skipped++; console.log(`  --  ${dir} — ${SKIP[dir].slice(0, 60)}…`); continue; }
  if (!(dir in PRIMARY)) {
    console.error(`  !!  ${dir} has a two-column builder but no PRIMARY entry`);
    process.exit(1);
  }
  const file = join(PUB, dir, "index.html");
  const before = readFileSync(file, "utf8");
  const { html, why } = fold(dir, before);
  if (why) { already++; console.log(`  ok  ${dir} (${why})`); continue; }

  const a = formIds(before).join(","), b = formIds(html).join(",");
  if (a !== b) { console.error(`  !!  ${dir}: ids changed — refusing to write`); process.exit(1); }
  if (before.split("\n").length !== html.split("\n").length) {
    console.error(`  !!  ${dir}: line count changed — this must be a pure move`); process.exit(1);
  }
  writeFileSync(file, html);
  written++;
  console.log(`  ->  ${dir}${PRIMARY[dir] === 2 ? " (columns swapped)" : ""}`);
}
console.log(`\n${written} written, ${already} already folded, ${skipped} skipped (${dirs.length} two-column builders)`);
