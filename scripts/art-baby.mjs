/* ============================================================
   Baby Guess Pool — OG image + hero art.
   A gentle nursery scene: a bassinet pram beside an oversized
   rattle, under a string of paper bunting, with soft confetti
   dots drifting in the air.
   Run:  node scripts/art-baby.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P, mulberry } from "./pixel-lib.mjs";

const PRAM_BODY = P.sky;
const PRAM_BODY_DK = "#7fa9b6";
const PRAM_HOOD = P.plum;
const PRAM_HOOD_DK = "#7c4f63";
const RATTLE_HEAD_DK = "#b5852f";
const METAL = P.inkSoft;

/* ---------- the pram (side profile, ~30x20) ----------------- */
function pram() {
  const g = new Grid(30, 20);
  const RIM = P.white, WHEEL = P.ink, HUB = P.line;

  // bassinet: bottom half of an ellipse (cx 16, cy 9, rx 13, ry 6)
  for (let y = 9; y <= 15; y++)
    for (let x = 3; x <= 29; x++) {
      const dx = (x - 16) / 13, dy = (y - 9) / 6;
      if (dx * dx + dy * dy <= 1.04) g.px(x, y, PRAM_BODY);
    }
  // lower shading
  for (let x = 6; x <= 26; x++) g.px(x, 14, PRAM_BODY_DK);
  for (let x = 9; x <= 23; x++) g.px(x, 15, PRAM_BODY_DK);
  // rim
  g.rect(3, 9, 29, 9, RIM);
  g.rect(3, 8, 29, 8, PRAM_BODY_DK);

  // hood: a raised quarter dome on the left (cx 12, cy 9, r 8, keep x<=12, y<=9)
  for (let y = 1; y <= 9; y++)
    for (let x = 4; x <= 12; x++) {
      const dx = (x - 12) / 8, dy = (y - 9) / 8;
      if (dx * dx + dy * dy <= 1.02) g.px(x, y, PRAM_HOOD);
    }
  for (let y = 3; y <= 9; y++) g.px(12, y, PRAM_HOOD_DK);  // brim edge
  g.rect(4, 9, 12, 9, PRAM_HOOD_DK);
  g.px(7, 3, RIM); g.px(6, 4, RIM);                        // hood highlight

  // handle sweeping up from the right rim
  g.rect(27, 4, 28, 9, METAL);
  g.rect(24, 4, 28, 4, METAL);

  // undercarriage + wheels
  g.rect(9, 15, 10, 17, METAL);
  g.rect(20, 15, 21, 17, METAL);
  g.disc(9, 17, 2, WHEEL); g.disc(21, 17, 2, WHEEL);
  g.px(9, 17, HUB); g.px(21, 17, HUB);
  return g;
}

/* ---------- an oversized rattle (~15x21) -------------------- */
function rattleBig() {
  const g = new Grid(15, 21);
  const HEAD = P.gold, HANDLE = P.terra, HANDLE_DK = P.terraDark, SHINE = P.white;

  g.disc(7, 6, 5, HEAD);
  g.px(4, 3, SHINE); g.px(5, 3, SHINE); g.px(4, 4, SHINE);     // shine
  g.px(10, 4, RATTLE_HEAD_DK); g.px(11, 6, RATTLE_HEAD_DK);    // shade crescent
  g.px(10, 8, RATTLE_HEAD_DK); g.px(9, 9, RATTLE_HEAD_DK);
  g.px(7, 6, RATTLE_HEAD_DK);                                  // centre dot

  g.rect(6, 11, 8, 17, HANDLE);                               // handle
  g.px(6, 11, HANDLE_DK); g.px(8, 17, HANDLE_DK);
  g.disc(7, 19, 2, HANDLE);                                   // teething ring
  g.px(7, 19, P.paper2);                                       // ring hole hint
  return g;
}

/* ---------- the nursery scene ------------------------------- */
function babyScene(w, h, floorY, { bunting = false } = {}) {
  const g = new Grid(w, h, P.paper);

  // floor
  g.rect(0, floorY, w - 1, h - 1, P.paper3);
  g.rect(0, floorY, w - 1, floorY, P.line);

  // soft confetti dots drifting in the air
  const rng = mulberry(11);
  const dotCols = [P.sky, P.plum, P.sage, P.gold, P.terra, P.grass];
  for (let y = bunting ? 5 : 2; y < floorY - 1; y++)
    for (let x = 0; x < w; x++)
      if (rng() < 0.03) g.px(x, y, dotCols[Math.floor(rng() * dotCols.length)]);

  // the pram, left of centre; the rattle to its right
  g.blit(pram(), Math.floor(w * 0.30) - 15, floorY - 19, 1);
  g.blit(rattleBig(), Math.floor(w * 0.72), floorY - 19, 1);

  // paper bunting across the top (hero only)
  if (bunting) {
    g.rect(0, 1, w - 1, 1, P.line);
    const cols = [P.terra, P.gold, P.sage, P.sky, P.plum];
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
babyScene(112, 32, 22, { bunting: true }).toPng("public/art/baby-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "BABY GUESS POOL";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 4, t1, P.ink, 2);
  const t2 = "DATE AND WEIGHT";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 16, t2, P.terraDark, 1);
  const t3 = "CLOSEST GUESS WINS";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 23, t3, P.inkSoft, 1);
  g.blit(babyScene(120, 34, 24), 0, 29, 1);
  // wordmark blocks bottom-left, on the clear stretch of floor
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-baby.png", 10);
}

console.log("done");
