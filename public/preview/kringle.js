/* ============================================================
   Kris Kringle — the live preview.

   Not the slots.js shape: there is no "xN" here, just names, one
   person one tile. So this module owns its own parsing — but it is
   the ONLY copy of it now. public/kringle.js used to hold it.

   WHAT IT DEMONSTRATES THAT PROSE WAS DOING.
   The comma fallback below has a fifteen-line comment in the source
   explaining why pasting "Ann, Bob, Cara" on one line works. Nobody
   reads source comments, and the page never said it at all. Paste a
   comma-separated line into the box now and three tiles appear. That
   is the explanation, and it cannot be wrong.

   WHAT IT DOES NOT SHOW.
   The draw. Every tile renders unclaimed, which is exactly what the
   board looks like the moment it is made — before anybody has tapped
   their name. Previewing who drew whom would be the one thing this
   tool exists to keep secret, and there is nothing to preview anyway:
   the assignment does not exist until the button is pressed.

   The names box ships EMPTY, so the first frame is a placeholder and
   the board only ever appears in response to typing. Unlike the meal
   train, nothing seeds this field after load, so there is no
   post-paint fill to absorb and the box needs no reserved height.
   ============================================================ */

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const MIN_NAMES = 3;
export const MAX_NAMES = 100;
export const SHOW_NAMES = 6;

/* People type a list two ways: one per line, or comma-separated on a single
   line. The second used to be a dead end — splitting on newlines returned one
   item and the tool refused it with "add at least three names", which reads as
   though the names were wrong rather than the separator.

   Falling back to commas ONLY when the whole input is a single line is what
   makes it safe: one line is already a useless input for this field, so the
   fallback can only turn a certain refusal into a likely success. Multi-line
   input is left alone, so an entry that legitimately contains a comma keeps it
   as long as it sits on its own line. Fields where a single item IS valid —
   plate categories, roster shifts, hens categories — deliberately do not. */
const listPieces = (v) => {
  const lines = v.split("\n").filter((s) => s.trim());
  return lines.length === 1 && lines[0].includes(",") ? lines[0].split(",") : v.split("\n");
};

export const parseNames = (text) =>
  listPieces(String(text || "")).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);

/* First name that appears twice (case-insensitive), or null. Two identical
   tiles are two people who cannot tell which one is theirs. */
export function findDuplicate(names) {
  const seen = new Set();
  for (const n of names) {
    const key = n.toLowerCase();
    if (seen.has(key)) return n;
    seen.add(key);
  }
  return null;
}

/* Spoken on every keystroke, so it stays one line. The board is never a live
   region — see the note in preview/roster.js. */
export function previewSummary(names) {
  if (!names.length) return "";
  return `${names.length} in the hat — this is what people will tap`;
}

/* The same .kk-grid / .kk-name markup publicPage renders, minus the button:
   every tile is the non-interactive <div>, so the preview offers nothing to
   press and gen-markdown.mjs has no control to strip.

   And minus the "That's me" line the real tile carries. On the live board
   that is a call to action on a button aimed at ONE person — the one whose
   name it is. Repeated down a preview nobody can press, it stops reading as
   an invitation and starts reading as a state, as though all three of them
   had already said it. The label above already says what these are for.

   The open slots in the roster, plate, hens and meal previews keep their
   "Open" for the opposite reason: that is a state, and an empty slot really
   is open. */
export function renderKringlePreview(names) {
  if (!names.length) return "";
  const shown = names.slice(0, SHOW_NAMES);
  const rest = names.length - shown.length;

  const tiles = shown.map((n) => `
    <li><div class="kk-name">
      <span class="kk-person">${esc(n)}</span>
    </div></li>`).join("");

  /* Counted, not drawn. A hundred names is legal and rendering them all
     would push the draw button most of a phone off the page. */
  const more = rest
    ? `
  <p class="live-preview-more">&hellip; and ${rest} more</p>`
    : "";

  return `<ul class="kk-grid">${tiles}
  </ul>${more}`;
}

/* ---------- the build-time contract -------------------------- */

export const PREVIEW_IDS = { label: "kringlePreviewLabel", board: "kringlePreview" };

/* The names box carries a placeholder, not a value, so this captures "" and
   firstFrame falls through to the placeholder below. */
export const PAGE_INPUTS = {
  names: /<textarea id="names"[^>]*>([\s\S]*?)<\/textarea>/,
};

export const REQUIRE_FIRST_FRAME = true;

const PLACEHOLDER =
  `<p class="live-preview-empty">Paste the names and the board appears here.</p>`;

export function firstFrame({ names }) {
  const parsed = parseNames(names);
  return {
    summary: previewSummary(parsed),
    board: parsed.length ? renderKringlePreview(parsed) : PLACEHOLDER,
  };
}
