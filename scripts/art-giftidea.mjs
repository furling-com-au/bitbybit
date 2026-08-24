/* ============================================================
   Gift Idea Board — OG image + hero art.
   The mechanic in three objects: a bright idea (lightbulb), the
   gift it turns into (wrapped present), and the tick that means
   "sorted — someone's getting it". Composed like the other og
   images: big title, subtitle, a little scene, and the wordmark
   bottom-left.
   Run:  node scripts/art-giftidea.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

const SCREW = "#9a8b74";  // lightbulb metal base

/* ---------- the three objects (transparent grids) ------------ */

function bulb() {
  const g = new Grid(12, 15);
  g.disc(5, 5, 5, P.gold);              // glass
  g.px(3, 2, P.white); g.px(2, 3, P.white); g.px(3, 3, P.white);  // shine
  // filament
  g.px(5, 5, P.terraDark); g.px(4, 6, P.terraDark);
  g.px(6, 6, P.terraDark); g.px(5, 7, P.terraDark);
  // neck + screw base
  g.rect(3, 10, 7, 10, P.paper3);
  g.rect(3, 11, 7, 11, SCREW);
  g.rect(3, 12, 7, 12, P.line);
  g.rect(4, 13, 6, 13, SCREW);
  g.rect(4, 14, 6, 14, P.line);
  return g;
}

function gift() {
  const g = new Grid(14, 13);
  // bow
  g.rect(5, 0, 6, 1, P.terra);
  g.px(4, 0, P.terra); g.px(7, 0, P.terra);
  g.px(3, 1, P.terra); g.px(8, 1, P.terra);
  // lid
  g.rect(1, 2, 12, 4, P.terra);
  g.rect(1, 2, 12, 2, P.terraDark);     // top edge shade
  // body
  g.rect(2, 5, 11, 12, P.sage);
  g.rect(2, 12, 11, 12, P.sageDark);    // base shade
  // ribbon
  g.rect(6, 2, 7, 12, P.gold);
  return g;
}

function tick() {
  const g = new Grid(11, 11);
  g.disc(5, 5, 5, P.grassDark);
  // the check
  g.px(3, 5, P.white); g.px(3, 6, P.white);
  g.px(4, 6, P.white); g.px(4, 7, P.white);
  g.px(5, 7, P.white);
  g.px(6, 5, P.white); g.px(6, 6, P.white);
  g.px(7, 4, P.white); g.px(7, 5, P.white);
  g.px(8, 3, P.white); g.px(8, 4, P.white);
  return g;
}

/* ---------- the scene ---------------------------------------- */
/* A ground strip with the gift, the bulb (raised, the hero), and
   the tick sitting on it, plus a couple of "bright idea" sparks. */
function ideaScene(w, h, { bunting = false } = {}) {
  const g = new Grid(w, h, P.paper);
  const floorY = h - 5;
  g.rect(0, floorY, w - 1, h - 1, P.paper3);
  g.rect(0, floorY, w - 1, floorY, P.line);

  const put = (d, fx, lift = 0) =>
    g.blit(d, Math.round(w * fx - d.w / 2), floorY - d.h - lift, 1);
  put(gift(), 0.30);
  put(bulb(), 0.52, 2);
  put(tick(), 0.73);

  // sparks around the bulb
  const bx = Math.round(w * 0.52);
  g.px(bx - 7, floorY - 17, P.gold);
  g.px(bx + 6, floorY - 18, P.gold);
  g.px(bx - 9, floorY - 12, P.terra);
  g.px(bx + 9, floorY - 13, P.terra);

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
ideaScene(112, 32, { bunting: true }).toPng("public/art/giftidea-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "GIFT IDEAS";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 4, t1, P.ink, 2);
  const t2 = "SUGGEST - VOTE - CLAIM";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 17, t2, P.terraDark, 1);
  const t3 = "NO DOUBLE-UPS";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 24, t3, P.inkSoft, 1);

  g.blit(ideaScene(120, 27), 0, 29, 1);

  // wordmark blocks + text, bottom-left on the clear paper strip
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-giftidea.png", 10);
}

console.log("done");
