/* ============================================================
   Hens & Shower Planner — OG image + hero art.
   A celebration table: a tiered cake in the middle, cocktails, a
   bottle of fizz and a wrapped gift, under a string of bunting
   with a couple of balloons drifting up. Same trestle-table build
   as Bring a Plate, dressed for a party.
   Run:  node scripts/art-hens.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

const FIZZ = "#5f7d58";       // bottle glass (deep sage)
const CANDLE_A = "#b8735a";   // terra candle
const CANDLE_B = "#7f9e78";   // sage candle
const WOOD_HI = "#a5876b";    // tabletop highlight

/* ---------- props (small transparent grids) ------------------ */

function propCake() {
  const g = new Grid(13, 12);
  // candles + flames
  g.px(4, 0, P.gold); g.px(8, 0, P.gold);              // flames
  g.rect(4, 1, 4, 2, CANDLE_A); g.rect(8, 1, 8, 2, CANDLE_B);
  // top tier
  g.rect(3, 3, 9, 6, P.white);
  g.rect(3, 3, 9, 3, P.terra);                         // icing
  g.px(4, 5, P.terra); g.px(6, 5, P.gold); g.px(8, 5, P.plum);
  // bottom tier
  g.rect(1, 7, 11, 10, P.white);
  g.rect(1, 7, 11, 7, P.plum);                         // icing
  g.px(2, 9, P.plum); g.px(5, 9, P.gold); g.px(8, 9, P.terra); g.px(10, 9, P.sage);
  // plate
  g.rect(0, 11, 12, 11, P.paper2);
  return g;
}

function propCocktail() {
  const g = new Grid(9, 11);
  // bowl of the glass, filled
  g.rect(0, 0, 8, 0, P.sky);                           // rim / glass
  g.rect(1, 1, 7, 1, P.plum);                          // drink
  g.rect(2, 2, 6, 2, P.plum);
  g.rect(3, 3, 5, 3, P.plum);
  g.px(4, 4, P.plum);
  g.px(6, 0, P.red);                                   // cherry on a pick
  // stem + base
  g.rect(4, 5, 4, 8, P.line);
  g.rect(2, 9, 6, 9, P.paper2);
  g.rect(1, 10, 7, 10, P.line);
  return g;
}

function propBottle() {
  const g = new Grid(6, 15);
  g.rect(2, 0, 3, 1, P.gold);                          // foil
  g.rect(2, 2, 3, 4, FIZZ);                            // neck
  g.rect(1, 5, 4, 14, FIZZ);                           // body
  g.rect(1, 8, 4, 11, P.paper2);                       // label
  g.px(2, 9, P.terra); g.px(3, 10, P.terra);           // label detail
  g.px(1, 6, P.white);                                 // glint
  return g;
}

function propGift() {
  const g = new Grid(10, 9);
  // bow
  g.px(3, 0, P.gold); g.px(6, 0, P.gold);
  g.px(4, 1, P.gold); g.px(5, 1, P.gold);
  // box
  g.rect(0, 2, 9, 8, P.terra);
  g.rect(0, 2, 9, 2, P.terraDark);                     // lid edge
  g.rect(4, 2, 5, 8, P.gold);                          // vertical ribbon
  g.rect(0, 4, 9, 4, P.gold);                          // horizontal ribbon
  return g;
}

/* ---------- the celebration table scene ---------------------- */
/* ty = tabletop surface row. Below it: legs then floor at ty+12.
   Props sit on the surface; bunting and balloons ride above. */
function tableScene(w, h, ty, { bunting = false, balloons = false } = {}) {
  const g = new Grid(w, h, P.paper);
  const floorY = ty + 12;

  // floor
  g.rect(0, floorY, w - 1, h - 1, P.paper3);
  g.rect(0, floorY, w - 1, floorY, P.line);

  // trestle legs
  const tx0 = 3, tx1 = w - 4;
  const legAt = (x) => {
    for (let i = 0; i < 9; i++) {
      g.px(x - Math.floor(i / 2), ty + 3 + i, P.brownDark);
      g.px(x + Math.floor(i / 2), ty + 3 + i, P.brownDark);
    }
  };
  legAt(tx0 + 8);
  legAt(tx1 - 8);

  // balloons drifting up from behind the ends
  if (balloons) {
    const bal = (cx, topY, c) => {
      g.disc(cx, topY, 3, c);
      g.px(cx, topY + 3, c);                            // knot
      for (let y = topY + 4; y < ty - 1; y++) g.px(cx, y, P.line); // string
    };
    bal(Math.floor(w * 0.09), 5, P.terra);
    bal(Math.floor(w * 0.94), 7, P.plum);
  }

  // tabletop (warm wood, three planks deep)
  g.rect(tx0, ty, tx1, ty, WOOD_HI);
  g.rect(tx0, ty + 1, tx1, ty + 1, P.brown);
  g.rect(tx0, ty + 2, tx1, ty + 2, P.brownDark);

  // dishes along the table, bottoms on the surface
  const put = (d, fx) => g.blit(d, Math.round(w * fx - d.w / 2), ty - d.h, 1);
  put(propGift(), 0.12);
  put(propCocktail(), 0.27);
  put(propCake(), 0.50);
  put(propCocktail(), 0.72);
  put(propBottle(), 0.88);

  // bunting along the very top
  if (bunting) {
    g.rect(0, 0, w - 1, 0, P.line);                    // string
    const cols = [P.terra, P.gold, P.sage, P.plum, P.sky];
    let k = 0;
    for (let x = 2; x + 3 < w; x += 7) {
      const c = cols[k++ % cols.length];
      g.rect(x, 1, x + 3, 1, c);
      g.rect(x + 1, 2, x + 2, 2, c);                   // flag tapers to a point
    }
  }

  return g;
}

/* ---------- build -------------------------------------------- */
mkdirSync("public/art", { recursive: true });

/* hero: 112x32 @10 = 1120x320 */
tableScene(112, 32, 15, { bunting: true, balloons: true }).toPng("public/art/hens-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "HENS - SHOWERS";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 4, t1, P.ink, 2);
  const t2 = "THE PARTY PLANNER";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 16, t2, P.plum, 1);
  const t3 = "FREE - NO SIGNUP";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 23, t3, P.inkSoft, 1);
  g.blit(tableScene(120, 34, 16, { balloons: true }), 0, 29, 1);
  // wordmark blocks bottom-left, on the clear stretch of floor
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-hens.png", 10);
}

console.log("done");
