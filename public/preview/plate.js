/* ============================================================
   Bring a plate — the live preview.

   Same shape as the volunteer roster, different words: categories
   rather than shifts, "sorted" rather than "filled". preview/slots.js
   owns the parsing and the board; this file is the vocabulary.

   The class names are plate-* because that is what src/tools/plate.js
   renders on the real /s/ page. The hens planner reuses the same ones,
   which is why its preview module points at the same set.
   ============================================================ */
import { parseCapacityLines, countLines, capacitySummary, renderSlotBoard, firstDupe }
  from "./slots.js";

export { countLines, firstDupe };
export const MAX_CATS = 12;

const CLASSES = {
  section: "plate-cat", head: "plate-cat-head", count: "plate-count",
  grid: "plate-grid", slot: "plate-slot", openLabel: "plate-open-label",
  verb: "sorted", one: "category", many: "categories", show: 3,
};

export const parseCategoryLines = (text) =>
  parseCapacityLines(text, { max: MAX_CATS });

export const previewSummary = (cats) =>
  capacitySummary(cats, { one: "category", many: "categories" });

export const renderCategoryPreview = (cats) => renderSlotBoard(cats, CLASSES);

/* ---------- the build-time contract -------------------------- */

export const PREVIEW_IDS = { label: "platePreviewLabel", board: "platePreview" };

export const PAGE_INPUTS = {
  categories: /<textarea id="categories"[^>]*>([\s\S]*?)<\/textarea>/,
};

export const REQUIRE_FIRST_FRAME = true;

export function firstFrame({ categories }) {
  const parsed = parseCategoryLines(categories || "");
  return { summary: previewSummary(parsed), board: renderCategoryPreview(parsed) };
}
