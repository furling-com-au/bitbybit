/* ============================================================
   Volunteer roster — the live preview.

   A thin wrapper now: preview/slots.js owns the "Name xN" parsing and
   the board, because bring-a-plate and the hens planner are the same
   shape with different words. This file supplies the words.

   WHAT IT REPLACES.
   The builder used to explain its own syntax in prose, three hundred
   words below a textarea already prefilled with the answer: "Grill
   9-11am x3 means three spots on the grill for that slot." The example
   in the sentence was literally the second line of the box. A board
   that redraws as you type says it without a sentence, and cannot fall
   out of step with the parser the way the prose could.

   RELATIONSHIP TO THE REAL BOARD.
   board() in src/tools/roster.js renders the live /s/ page with its
   claim buttons and per-slot forms. This is the same shape with nothing
   interactive in it. The contract that has to hold is "what you type is
   what you get" — same labels, same spot counts, same order — and
   check-baked-previews.mjs asserts it.
   ============================================================ */
import { parseCapacityLines, countLines, capacitySummary, renderSlotBoard, firstDupe }
  from "./slots.js";

export { countLines, firstDupe };
export const MAX_SHIFTS = 20;
export const MAX_CAP = 30;

const CLASSES = {
  section: "rost-shift", head: "rost-shift-head", count: "rost-count",
  grid: "rost-grid", slot: "rost-slot", openLabel: "rost-open-label",
  verb: "filled", one: "shift", many: "shifts", show: 3,
};

export const parseShiftLines = (text) =>
  parseCapacityLines(text, { max: MAX_SHIFTS, maxCap: MAX_CAP });

export const countShiftLines = countLines;

export const previewSummary = (shifts) =>
  capacitySummary(shifts, { one: "shift", many: "shifts" });

export const renderRosterPreview = (shifts) => renderSlotBoard(shifts, CLASSES);

/* ---------- the build-time contract --------------------------
   What gen-live-preview.mjs and check-baked-previews.mjs need to bake and
   verify the first frame. Declared in the module that owns the rendering,
   so a new tool is a new file rather than a fork of the generator. */

export const PREVIEW_IDS = { label: "rosterPreviewLabel", board: "rosterPreview" };

/* Read out of the page rather than restated, so editing the defaults in the
   HTML cannot leave the baked frame describing the old ones. */
export const PAGE_INPUTS = {
  shifts: /<textarea id="shifts"[^>]*>([\s\S]*?)<\/textarea>/,
};

/* The roster ships prefilled, so it always has a frame to bake. */
export const REQUIRE_FIRST_FRAME = true;

export function firstFrame({ shifts }) {
  const parsed = parseShiftLines(shifts || "");
  return { summary: previewSummary(parsed), board: renderRosterPreview(parsed) };
}
