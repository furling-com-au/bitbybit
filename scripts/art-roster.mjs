/* ============================================================
   Volunteer Roster — OG image + hero art.
   A canteen marquee: red-and-white striped awning on two poles,
   a trestle counter with a sign-up clipboard leaning on it, and a
   sausage-sizzle grill beside it with a couple of snags on the
   hotplate and a wisp of smoke going up.
   Run:  node scripts/art-roster.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

const WOOD_HI = "#a5876b";     // tabletop highlight
const STEEL_HI = "#b3adbb";    // grill body highlight
const STRIPE_LT = P.white;     // awning light stripe

/* ---------- objects (small transparent grids) ---------------- */

function clipboard() {
  const g = new Grid(10, 11);
  g.rect(0, 1, 9, 10, P.brown);           // board
  g.rect(1, 2, 8, 9, P.white);            // paper
  g.rect(0, 1, 9, 1, P.brownDark);        // top edge
  g.rect(3, 0, 6, 1, P.greyDark);         // clip
  g.px(4, 0, P.grey);
  // ruled lines, a couple ticked off
  for (let i = 0; i < 3; i++) {
    const yy = 3 + i * 2;
    g.rect(3, yy, 7, yy, P.line);
    if (i < 2) g.px(2, yy, P.grassDark);  // tick marks down the side
  }
  return g;
}

function snag(g, x, y) {
  g.rect(x, y, x + 6, y, P.terraDark);    // underside
  g.rect(x, y - 1, x + 6, y - 1, P.terra); // top
  g.px(x, y, P.terra); g.px(x + 6, y - 1, P.terraDark); // rounded ends
  g.px(x + 2, y - 1, P.gold);             // glaze glint
}

function grill() {
  const g = new Grid(22, 15);
  // legs + brace
  g.rect(3, 11, 4, 14, P.greyDark);
  g.rect(17, 11, 18, 14, P.greyDark);
  g.rect(3, 12, 18, 12, P.grey);
  // hotplate lip
  g.rect(1, 5, 20, 5, P.ink);
  // body
  g.rect(1, 6, 20, 10, P.grey);
  g.rect(1, 6, 20, 6, STEEL_HI);          // highlight
  g.rect(1, 10, 20, 10, P.greyDark);      // shadow
  // side handles
  g.px(0, 7, P.greyDark); g.px(21, 7, P.greyDark);
  // the snags
  snag(g, 4, 4);
  snag(g, 12, 4);
  return g;
}

/* ---------- the canteen scene -------------------------------- */

function canteenScene(w, h, { bunting = false, floorY = h - 3 } = {}) {
  const g = new Grid(w, h, P.paper);

  // floor
  g.rect(0, floorY, w - 1, h - 1, P.paper3);
  g.rect(0, floorY, w - 1, floorY, P.line);

  // ---- marquee awning ----
  const mL = 4, mR = w - 5;
  const awnY = 2;
  // poles
  g.rect(mL, awnY, mL + 1, floorY - 1, P.brown);
  g.rect(mR - 1, awnY, mR, floorY - 1, P.brown);
  g.px(mL, floorY - 1, P.brownDark); g.px(mR, floorY - 1, P.brownDark);
  // striped canopy band (red + white)
  for (let x = mL; x <= mR; x++) {
    const lt = Math.floor((x - mL) / 3) % 2 === 0;
    g.rect(x, awnY + 1, x, awnY + 3, lt ? STRIPE_LT : P.terra);
  }
  g.rect(mL, awnY, mR, awnY, P.terraDark);      // top trim
  // scalloped bottom edge
  for (let x = mL; x <= mR - 2; x += 3) {
    const lt = Math.floor((x - mL) / 3) % 2 === 0;
    const c = lt ? STRIPE_LT : P.terra;
    g.px(x, awnY + 4, c); g.px(x + 1, awnY + 4, c); g.px(x + 2, awnY + 4, c);
    g.px(x + 1, awnY + 5, c);
  }

  // ---- trestle counter (left) ----
  const ctY = floorY - 6;
  const ctL = mL + 3, ctR = Math.round(w * 0.44);
  g.rect(ctL, ctY, ctR, ctY, WOOD_HI);
  g.rect(ctL, ctY + 1, ctR, ctY + 1, P.brown);
  g.rect(ctL, ctY + 2, ctR, ctY + 2, P.brownDark);
  g.rect(ctL + 1, ctY + 3, ctL + 2, floorY - 1, P.brownDark);   // legs
  g.rect(ctR - 2, ctY + 3, ctR - 1, floorY - 1, P.brownDark);
  // clipboard standing on the counter
  const cb = clipboard();
  g.blit(cb, ctL + 4, ctY - cb.h, 1);

  // ---- grill (right) ----
  const gx = Math.round(w * 0.66);
  const gr = grill();
  const gy = floorY - gr.h + 1;
  g.blit(gr, gx, gy, 1);
  // smoke wisps rising off the snags
  g.px(gx + 7, gy - 1, P.line);
  g.px(gx + 8, gy - 3, P.line);
  g.px(gx + 10, gy - 2, P.paper3);
  g.px(gx + 9, gy - 5, P.line);
  g.px(gx + 12, gy - 4, P.paper3);

  // ---- bunting across the awning (hero only) ----
  if (bunting) {
    const cols = [P.gold, P.sage, P.plum, P.terra];
    let k = 0;
    for (let x = mL + 2; x + 2 < mR - 1; x += 6) {
      const c = cols[k++ % cols.length];
      g.rect(x, awnY + 6, x + 2, awnY + 6, c);
      g.px(x + 1, awnY + 7, c);
    }
  }

  return g;
}

/* ---------- build -------------------------------------------- */
mkdirSync("public/art", { recursive: true });

/* hero: 112x32 @10 = 1120x320 */
canteenScene(112, 32, { bunting: true }).toPng("public/art/roster-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "VOLUNTEER";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 3, t1, P.ink, 2);
  const t2 = "ROSTER";
  drawText(g, Math.floor((120 - textWidth(t2, 2)) / 2), 14, t2, P.terraDark, 2);
  const t3 = "SIGN UP - SHOW UP - SORTED";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 25, t3, P.inkSoft, 1);
  g.blit(canteenScene(120, 33, { floorY: 24 }), 0, 30, 1);
  // wordmark blocks bottom-left, on the clear stretch of floor
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-roster.png", 10);
}

console.log("done");
