/* ============================================================
   Tournament Bracket — the live preview.

   Shows round one only, in TYPED order — never the random shuffle.
   "Random draw" is crypto randomness at submit time (src/tools/bracket.js),
   which cannot be baked deterministically and would be a different answer
   every rebuild if it tried. This demonstrates the SHAPE any list of this
   size produces instead: how many rounds, how many byes, who plays whom
   first if the typed order is kept — which is true regardless of which
   draw-order radio ends up checked.

   Reuses the exact classes renderBracket() renders on the real /s/ page —
   .bracket-match, .bracket-side, .bracket-side.is-null — minus every
   control (no buttons, no data-r/data-m, no aria-pressed): a preview
   offering a tap would be lying about what it is, same rule as the other
   modules in this directory.
   ============================================================ */

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const MIN_ENTRANTS = 2;
export const MAX_ENTRANTS = 64;
const SHOW_MATCHES = 4;

/* Same one-line-of-commas fallback as the other name-list builders. */
const listPieces = (v) => {
  const lines = v.split("\n").filter((s) => s.trim());
  return lines.length === 1 && lines[0].includes(",") ? lines[0].split(",") : v.split("\n");
};

export const parseEntrants = (text) =>
  listPieces(String(text || "")).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);

/* First name that appears twice (case-insensitive), or null. Two identical
   names would produce two matches nobody can tell apart. */
export function firstDupe(names) {
  const seen = new Set();
  for (const n of names) {
    const key = n.toLowerCase();
    if (seen.has(key)) return n;
    seen.add(key);
  }
  return null;
}

/* Standard bracket seeding order for `size` slots: seed 1 plays seed N,
   2 plays N-1, and so on, folded so byes spread across the draw instead
   of stacking in one half. Duplicated from src/tools/bracket.js rather
   than imported — that file is a Worker module with D1 imports a browser
   can't load, and this half of it is a few lines with no server access. */
function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const m = order.length * 2 + 1;
    const next = [];
    for (const s of order) next.push(s, m - s);
    order = next;
  }
  return order;
}

export function firstRound(entrants) {
  let size = 1;
  while (size < entrants.length) size *= 2;
  const bySeed = (s) => (s <= entrants.length ? entrants[s - 1] : null);
  const order = seedOrder(size);
  const matches = [];
  for (let i = 0; i < size; i += 2) matches.push({ a: bySeed(order[i]), b: bySeed(order[i + 1]) });
  const byes = matches.filter((m) => (m.a === null) !== (m.b === null)).length;
  return { size, matches, byes };
}

/* Spoken on every keystroke, so it stays one line. */
export function previewSummary(entrants) {
  if (entrants.length < MIN_ENTRANTS) return "";
  const { size, byes } = firstRound(entrants);
  return `${entrants.length} entrant${entrants.length === 1 ? "" : "s"} — bracket of ${size}` +
    (byes ? `, ${byes} bye${byes === 1 ? "" : "s"}` : "") +
    `, typed order shown here`;
}

export function renderBracketPreview(entrants) {
  if (entrants.length < MIN_ENTRANTS) return "";
  const { matches } = firstRound(entrants);
  const shown = matches.slice(0, SHOW_MATCHES);
  const rest = matches.length - shown.length;

  const side = (name) => name === null
    ? `<span class="bracket-side is-null">bye</span>`
    : `<span class="bracket-side">${esc(name)}</span>`;

  const cards = shown.map((m) => `
    <div class="bracket-match">
      ${side(m.a)}
      ${side(m.b)}
    </div>`).join("");

  const more = rest
    ? `
  <p class="live-preview-more">&hellip; and ${rest} more first-round match${rest === 1 ? "" : "es"}</p>`
    : "";

  return `<div class="bracket-preview-col">${cards}
  </div>${more}`;
}

/* ---------- the build-time contract -------------------------- */

export const PREVIEW_IDS = { label: "bracketPreviewLabel", board: "bracketPreview" };

export const PAGE_INPUTS = {
  entrants: /<textarea id="entrants"[^>]*>([\s\S]*?)<\/textarea>/,
};

export const REQUIRE_FIRST_FRAME = true;

const PLACEHOLDER =
  `<p class="live-preview-empty">Add the names and round one appears here.</p>`;

export function firstFrame({ entrants }) {
  const parsed = parseEntrants(entrants);
  return {
    summary: previewSummary(parsed),
    board: parsed.length >= MIN_ENTRANTS ? renderBracketPreview(parsed) : PLACEHOLDER,
  };
}
