/* ============================================================
   Bring a Plate — OG image + hero art.
   A long trestle table, side-on, laden with the classics:
   glazed ham, salad, a jug of cordial, a pavlova, tomato sauce,
   lamingtons — and the esky underneath where it belongs.
   Run:  node scripts/art-plate.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

const BLUE = "#6f97a6";      // esky trim / jug rim
const WOOD_HI = "#a5876b";   // tabletop highlight
const BOWL_HI = "#a05f47";   // ceramic rim
const BOWL_DK = "#6e3b2b";
const MERINGUE_SHADE = "#ded5c0";

/* ---------- dishes (small transparent grids) ----------------- */

function dishPavlova() {
  const g = new Grid(12, 9);
  g.rect(0, 8, 11, 8, P.paper2);                       // plate
  g.rect(2, 3, 9, 7, P.white);                         // meringue
  g.rect(3, 2, 8, 2, P.white);
  g.rect(9, 4, 9, 7, MERINGUE_SHADE);                  // shaded side
  g.px(4, 1, P.red); g.px(6, 1, P.grass); g.px(8, 1, P.red);  // berries + kiwi
  g.px(5, 2, P.red); g.px(7, 2, P.red);
  return g;
}

function dishHam() {
  const g = new Grid(13, 8);
  g.rect(0, 7, 12, 7, P.paper2);                       // platter
  g.ellipse(6, 4, 5, 3, P.terra);                      // the ham
  g.rect(3, 6, 9, 6, P.terraDark);                     // underside shade
  g.rect(4, 1, 8, 1, P.gold);                          // glaze
  g.px(3, 2, P.gold); g.px(9, 2, P.gold);
  g.px(5, 3, P.terraDark); g.px(7, 4, P.terraDark);    // score marks
  g.rect(11, 2, 12, 3, P.white);                       // bone end
  return g;
}

function dishSalad() {
  const g = new Grid(12, 8);
  g.rect(1, 4, 10, 5, P.terraDark);                    // bowl
  g.rect(2, 6, 9, 6, P.terraDark);
  g.rect(3, 7, 8, 7, BOWL_DK);
  g.rect(1, 4, 10, 4, BOWL_HI);                        // rim highlight
  g.px(2, 3, P.grass); g.px(3, 2, P.grassDark); g.px(4, 3, P.grass);
  g.px(5, 1, P.grass); g.px(5, 2, P.grassDark); g.px(6, 2, P.grass);
  g.px(7, 1, P.grassDark); g.px(7, 3, P.grass); g.px(8, 2, P.grass);
  g.px(9, 3, P.grassDark);
  g.px(4, 2, P.red); g.px(8, 1, P.red);                // tomato
  return g;
}

function dishJug() {
  const g = new Grid(8, 10);
  g.rect(1, 2, 5, 2, BLUE);                            // rim
  g.px(0, 2, BLUE);                                    // spout
  g.rect(1, 3, 5, 8, P.sky);                           // body
  g.rect(2, 5, 4, 8, P.gold);                          // cordial
  g.rect(1, 9, 5, 9, BLUE);                            // base
  g.px(6, 3, BLUE); g.px(7, 4, BLUE); g.px(7, 5, BLUE); g.px(6, 6, BLUE); // handle
  g.px(2, 3, P.white);                                 // glint
  return g;
}

function dishSauce() {
  const g = new Grid(5, 9);
  g.px(2, 0, P.ink);                                   // cap
  g.rect(2, 1, 2, 2, P.red);                           // neck
  g.rect(1, 3, 3, 8, P.red);                           // bottle
  g.rect(1, 5, 3, 6, P.white);                         // label
  g.px(2, 6, P.red);                                   // tomato mark
  return g;
}

function dishLamingtons() {
  const g = new Grid(11, 7);
  g.rect(0, 6, 10, 6, P.paper2);                       // plate
  g.rect(1, 4, 3, 5, P.brownDark);                     // bottom row of cubes
  g.rect(4, 4, 6, 5, P.brownDark);
  g.rect(7, 4, 9, 5, P.brownDark);
  g.rect(2, 2, 4, 3, P.brownDark);                     // top row
  g.rect(6, 2, 8, 3, P.brownDark);
  g.px(2, 4, P.white); g.px(5, 4, P.white); g.px(8, 4, P.white);  // coconut,
  g.px(3, 2, P.white); g.px(7, 2, P.white);            // one speck per cube
  return g;
}

function esky() {
  const g = new Grid(14, 9);
  g.rect(0, 0, 13, 1, P.white);                        // lid
  g.rect(0, 2, 13, 2, BLUE);                           // lid seam
  g.rect(0, 3, 13, 8, P.sky);                          // body
  g.rect(0, 8, 13, 8, BLUE);                           // base trim
  g.rect(6, 3, 7, 4, P.white);                         // latch
  g.px(0, 4, BLUE); g.px(13, 4, BLUE);                 // side handles
  return g;
}

/* ---------- the trestle table scene -------------------------- */
/* ty = tabletop surface row. Below it: 3-row slab, 9-row legs,
   then floor from ty+12 down. Dishes sit on the surface. */
function tableScene(w, h, ty, { bunting = false } = {}) {
  const g = new Grid(w, h, P.paper);
  const floorY = ty + 12;

  // floor
  g.rect(0, floorY, w - 1, h - 1, P.paper3);
  g.rect(0, floorY, w - 1, floorY, P.line);

  // trestle legs (A-frames, behind the esky)
  const tx0 = 3, tx1 = w - 4;
  const legAt = (x) => {
    for (let i = 0; i < 9; i++) {
      g.px(x - Math.floor(i / 2), ty + 3 + i, P.brownDark);
      g.px(x + Math.floor(i / 2), ty + 3 + i, P.brownDark);
    }
  };
  legAt(tx0 + 8);
  legAt(tx1 - 8);

  // the esky, underneath where it belongs
  g.blit(esky(), Math.floor(w * 0.32), floorY - 9, 1);

  // tabletop (warm wood, three planks deep)
  g.rect(tx0, ty, tx1, ty, WOOD_HI);
  g.rect(tx0, ty + 1, tx1, ty + 1, P.brown);
  g.rect(tx0, ty + 2, tx1, ty + 2, P.brownDark);

  // dishes along the table, bottoms on the surface
  const put = (d, fx) => g.blit(d, Math.round(w * fx - d.w / 2), ty - d.h, 1);
  put(dishHam(), 0.14);
  put(dishSalad(), 0.30);
  put(dishJug(), 0.42);
  put(dishPavlova(), 0.56);
  put(dishSauce(), 0.68);
  put(dishLamingtons(), 0.82);

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
tableScene(112, 32, 15, { bunting: true }).toPng("public/art/plate-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "BRING A PLATE";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 4, t1, P.ink, 2);
  const t2 = "THE POTLUCK BOARD";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 16, t2, P.terraDark, 1);
  const t3 = "FREE - NO SIGNUP";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 23, t3, P.inkSoft, 1);
  g.blit(tableScene(120, 34, 14), 0, 29, 1);
  // wordmark blocks bottom-left, on the clear stretch of floor
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-plate.png", 10);
}

console.log("done");
