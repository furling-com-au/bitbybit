/* ============================================================
   Meal Train — OG image + hero art.
   A warm little scene: a cottage, a wall calendar with a day
   marked, and a steaming casserole dish ready to be dropped off.
   Run:  node scripts/art-meal.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

const WOOD_HI = "#a5876b";   // bench highlight
const BOWL_HI = "#a05f47";   // ceramic rim
const ROOF_HI = "#c98a72";   // sunlit roof
const GLASS = "#bfe0e8";     // window glint

/* ---------- a little cottage --------------------------------- */
function house() {
  const g = new Grid(18, 18);
  // roof — a filled triangle narrowing to an apex
  for (let r = 0; r <= 5; r++) {
    const y = 7 - r;
    g.rect(1 + r, y, 16 - r, y, r === 5 ? ROOF_HI : P.terra);
  }
  g.rect(1, 7, 16, 7, P.terraDark);          // eave shadow
  // chimney, poking through the right slope
  g.rect(12, 3, 13, 6, P.brownDark);
  g.px(12, 1, P.line); g.px(13, 2, P.line);  // a wisp of smoke
  // walls
  g.rect(3, 8, 14, 17, P.paper2);
  g.rect(3, 8, 3, 17, P.brown);              // left shade
  g.rect(14, 8, 14, 17, P.brownDark);        // right shade
  g.rect(3, 17, 14, 17, P.brownDark);        // base
  // windows
  g.rect(5, 10, 6, 12, GLASS); g.px(5, 10, P.white);
  g.rect(11, 10, 12, 12, GLASS); g.px(11, 10, P.white);
  // door
  g.rect(8, 12, 10, 17, P.brownDark);
  g.px(9, 15, P.gold);                       // knob
  return g;
}

/* ---------- a wall calendar with one day marked -------------- */
function calendar() {
  const g = new Grid(15, 16);
  g.px(3, 0, P.ink); g.px(11, 0, P.ink);     // hanging tabs
  g.rect(0, 2, 14, 15, P.ink);               // frame
  g.rect(1, 3, 13, 5, P.terra);              // header bar
  g.rect(1, 3, 13, 3, P.terraDark);
  g.rect(1, 6, 13, 14, P.white);             // page
  // grid of faint day dots
  [8, 10, 12].forEach((ry) => {
    [3, 5, 7, 9, 11].forEach((cx) => g.px(cx, ry, P.line));
  });
  g.rect(6, 9, 8, 11, P.gold);               // the marked day
  return g;
}

/* ---------- the casserole, lid on, steam rising -------------- */
function casserole() {
  const g = new Grid(22, 13);
  [6, 11, 16].forEach((sx) => {              // three steam wisps
    g.px(sx, 0, P.line); g.px(sx + 1, 1, P.line);
    g.px(sx, 2, P.line); g.px(sx + 1, 3, P.line);
  });
  g.px(11, 2, P.ink);                        // lid knob
  g.rect(10, 3, 12, 4, P.terra);             // knob base
  g.ellipse(11, 5, 9, 2, P.terra);           // lid dome
  g.rect(2, 5, 20, 5, P.terraDark);          // lid rim
  g.rect(2, 6, 20, 10, P.brown);             // dish body
  g.rect(2, 6, 20, 6, BOWL_HI);              // rim highlight
  g.rect(2, 10, 20, 11, P.brownDark);        // base shadow
  g.rect(0, 7, 1, 8, P.ink);                 // left handle
  g.rect(20, 7, 21, 8, P.ink);               // right handle
  return g;
}

/* ---------- compose the scene on a bench --------------------- */
function scene(w, h, surfY) {
  const g = new Grid(w, h, P.paper);
  g.rect(0, surfY, w - 1, surfY, WOOD_HI);           // bench top edge
  g.rect(0, surfY + 1, w - 1, surfY + 2, P.brown);   // bench face
  g.rect(0, surfY + 3, w - 1, h - 1, P.paper3);      // floor

  g.blit(house(), Math.round(w * 0.05), surfY - 18, 1);
  g.blit(calendar(), Math.round(w * 0.42), surfY - 16, 1);
  g.blit(casserole(), Math.round(w * 0.66), surfY - 12, 1);
  return g;
}

/* ---------- build -------------------------------------------- */
mkdirSync("public/art", { recursive: true });

/* hero: 112x32 @10 = 1120x320 */
scene(112, 32, 24).toPng("public/art/meal-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "MEAL TRAIN";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 3, t1, P.ink, 2);
  const t2a = "MEALS FOR SOMEONE";
  drawText(g, Math.floor((120 - textWidth(t2a, 1)) / 2), 14, t2a, P.terraDark, 1);
  const t2b = "WHO NEEDS ONE";
  drawText(g, Math.floor((120 - textWidth(t2b, 1)) / 2), 21, t2b, P.terraDark, 1);
  const t3 = "FREE - NO SIGNUP";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 28, t3, P.inkSoft, 1);

  g.blit(scene(120, 29, 18), 0, 34, 1);

  // wordmark blocks + text bottom-left, on the clear stretch of floor
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-meal.png", 10);
}

console.log("done");
