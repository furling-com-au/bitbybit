/* ============================================================
   Recipe Collection — OG image + hero art.
   A kitchen bench, side-on: a little recipe book open in the
   middle, a handwritten recipe card propped beside it, a whisk,
   a wooden spoon, and a mixing bowl with batter — the makings of
   a keepsake cookbook.
   Run:  node scripts/art-recipe.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

const BLUE = "#6f97a6";      // bowl trim
const METAL = P.grey;        // whisk wire
const METAL_DK = P.greyDark;
const WOOD_HI = "#a5876b";   // bench lip highlight

/* thin rectangle outline */
function outline(g, x0, y0, x1, y1, c) {
  g.rect(x0, y0, x1, y0, c);
  g.rect(x0, y1, x1, y1, c);
  g.rect(x0, y0, x0, y1, c);
  g.rect(x1, y0, x1, y1, c);
}

/* ---------- objects (small transparent grids) ---------------- */

/* The compiled book, open flat — two cream pages either side of a
   centre gutter, a terracotta hardcover underneath, a few ruled
   lines and a recipe heading, a gold bookmark peeking up. */
function bookOpen() {
  const g = new Grid(28, 14);
  // hardcover
  g.rect(0, 4, 27, 13, P.terraDark);
  g.rect(1, 3, 26, 3, P.terra);            // cover bevel
  g.px(0, 3, P.terraDark); g.px(27, 3, P.terraDark);
  // pages
  g.rect(2, 4, 12, 12, P.white);           // left leaf
  g.rect(15, 4, 25, 12, P.white);          // right leaf
  g.rect(13, 4, 14, 12, P.paper2);         // centre gutter
  g.rect(2, 12, 25, 12, P.paper2);         // page bottom shade
  // left leaf: ruled recipe lines
  g.rect(4, 6, 11, 6, P.line);
  g.rect(4, 8, 10, 8, P.line);
  g.rect(4, 10, 11, 10, P.line);
  // right leaf: a heading then lines
  g.rect(16, 6, 22, 6, P.terraDark);       // heading
  g.rect(16, 8, 23, 8, P.line);
  g.rect(16, 10, 20, 10, P.line);
  // gold bookmark peeking from the top
  g.rect(20, 0, 21, 4, P.gold);
  g.px(20, 4, P.gold); g.px(21, 4, P.gold);
  return g;
}

/* A handwritten recipe card: cream, a terracotta title band, a
   couple of sage ingredient ticks, ruled lines. */
function recipeCard() {
  const g = new Grid(16, 18);
  g.rect(0, 0, 15, 17, P.white);
  outline(g, 0, 0, 15, 17, P.ink);
  // title band
  g.rect(1, 1, 14, 3, P.terra);
  g.rect(3, 2, 11, 2, P.white);            // title text
  // ingredient ticks + lines
  const rows = [6, 8, 10, 12, 14];
  rows.forEach((ry, i) => {
    if (i < 4) g.px(2, ry, P.sageDark);    // a tick
    g.rect(4, ry, i % 2 ? 12 : 13, ry, P.line);
  });
  return g;
}

/* A balloon whisk: wooden handle, metal collar, looped wires. */
function whisk() {
  const g = new Grid(9, 16);
  // handle
  g.rect(3, 0, 4, 7, P.brownDark);
  g.px(4, 0, P.brown); g.px(4, 3, P.brown); g.px(4, 5, P.brown);
  // collar
  g.rect(2, 7, 5, 8, METAL_DK);
  // balloon wires
  g.px(2, 9, METAL_DK); g.px(5, 9, METAL_DK);
  g.px(1, 11, METAL); g.px(6, 11, METAL);
  g.px(1, 13, METAL); g.px(6, 13, METAL);
  g.px(2, 15, METAL_DK); g.px(5, 15, METAL_DK);
  g.rect(3, 15, 4, 15, METAL_DK);          // bottom of the loop
  g.rect(3, 9, 4, 14, METAL);              // inner wire
  return g;
}

/* A wooden spoon, bowl-end down. */
function spoon() {
  const g = new Grid(8, 18);
  g.rect(3, 0, 4, 10, P.brown);            // handle
  g.px(4, 0, P.brownDark); g.px(4, 4, P.brownDark);
  g.ellipse(3, 13, 3, 4, P.brownDark);     // bowl
  g.ellipse(3, 13, 2, 3, P.brown);         // bowl highlight
  return g;
}

/* A ceramic mixing bowl with a dollop of batter. */
function bowl() {
  const g = new Grid(15, 10);
  g.rect(1, 4, 13, 8, BLUE);               // bowl body
  g.rect(2, 9, 12, 9, BLUE);
  g.rect(1, 4, 13, 4, P.sky);              // rim
  g.rect(2, 3, 12, 3, P.white);            // rim highlight
  g.rect(4, 2, 10, 3, P.gold);             // batter mound
  g.px(6, 1, P.gold); g.px(8, 1, P.gold);
  g.px(5, 2, P.white); g.px(9, 2, P.white);// flour flecks
  return g;
}

/* ---------- the bench scene ---------------------------------- */
function benchScene(w, h, { bunting = false } = {}) {
  const g = new Grid(w, h, P.paper);
  const floorY = h - 8;

  // bench front / floor band, with a wood lip
  g.rect(0, floorY, w - 1, h - 1, P.paper3);
  g.rect(0, floorY, w - 1, floorY, P.line);
  g.rect(0, floorY - 1, w - 1, floorY - 1, WOOD_HI);

  // objects, bottoms on the bench
  const put = (grid, fx) => g.blit(grid, Math.round(w * fx - grid.w / 2), floorY - grid.h, 1);
  put(whisk(), 0.11);
  put(bowl(), 0.25);
  put(bookOpen(), 0.46);
  put(recipeCard(), 0.69);
  put(spoon(), 0.86);

  // a little steam / flour drifting up
  g.px(Math.round(w * 0.25), floorY - 13, P.white);
  g.px(Math.round(w * 0.27), floorY - 15, P.line);
  g.px(Math.round(w * 0.46), floorY - 17, P.gold);
  g.px(Math.round(w * 0.71), floorY - 20, P.terra);

  // bunting for the hero
  if (bunting) {
    g.rect(0, 1, w - 1, 1, P.line);
    const cols = [P.terra, P.gold, P.sage, P.plum];
    let k = 0;
    for (let x = 3; x + 2 < w - 2; x += 8) {
      const c = cols[k++ % cols.length];
      g.rect(x, 2, x + 2, 2, c);
      g.px(x + 1, 3, c);
    }
  }

  return g;
}

/* ---------- build -------------------------------------------- */
mkdirSync("public/art", { recursive: true });

/* hero: 112x32 @10 = 1120x320 */
benchScene(112, 32, { bunting: true }).toPng("public/art/recipe-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "RECIPE";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 2, t1, P.ink, 2);
  const t2 = "COLLECTION";
  drawText(g, Math.floor((120 - textWidth(t2, 2)) / 2), 12, t2, P.sageDark, 2);
  const t3 = "EVERYONE ADDS A RECIPE";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 23, t3, P.terraDark, 1);
  const t4 = "YOU GET A BOOK";
  drawText(g, Math.floor((120 - textWidth(t4, 1)) / 2), 29, t4, P.inkSoft, 1);
  g.blit(benchScene(120, 29), 0, 34, 1);
  // wordmark blocks bottom-left, on the clear stretch of bench
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-recipe.png", 10);
}

console.log("done");
