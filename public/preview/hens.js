/* ============================================================
   Hens & shower planner — the live preview.

   The same "Name xN" board as bring-a-plate, and deliberately the same
   plate-* classes, because src/tools/hens.js renders the real board with
   them too. Only the noun differs: this page calls them lists.

   The itinerary textarea is NOT previewed. It is a plain list of lines
   with no capacity behind it, so a preview of it would be the textarea
   again in a dashed box — showing nothing the field does not already
   show. Previewing everything is not the point; previewing what the
   input turns INTO is.
   ============================================================ */
import { parseCapacityLines, countLines, capacitySummary, renderSlotBoard, firstDupe }
  from "./slots.js";

export { countLines, firstDupe };
export const MAX_CATS = 12;

const CLASSES = {
  section: "plate-cat", head: "plate-cat-head", count: "plate-count",
  grid: "plate-grid", slot: "plate-slot", openLabel: "plate-open-label",
  verb: "sorted", one: "list", many: "lists", show: 3,
};

export const parseCategoryLines = (text) =>
  parseCapacityLines(text, { max: MAX_CATS });

export const previewSummary = (cats) =>
  capacitySummary(cats, { one: "list", many: "lists" });

export const renderCategoryPreview = (cats) => renderSlotBoard(cats, CLASSES);

/* ---------- the build-time contract -------------------------- */

export const PREVIEW_IDS = { label: "hensPreviewLabel", board: "hensPreview" };

export const PAGE_INPUTS = {
  categories: /<textarea id="categories"[^>]*>([\s\S]*?)<\/textarea>/,
};

export const REQUIRE_FIRST_FRAME = true;

export function firstFrame({ categories }) {
  const parsed = parseCategoryLines(categories || "");
  return { summary: previewSummary(parsed), board: renderCategoryPreview(parsed) };
}
