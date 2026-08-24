/* ============================================================
   Question of the Day — OG image + hero art.
   A fork in the road: one signpost, two arrow boards pointing
   opposite ways (sage left, terracotta right), and two tally bars
   beside it showing the room splitting. A few "?" marks float
   above. Composed like the other og images — big 3x5 title,
   subtitle, a scene on the floor band, wordmark bottom-left.
   Run:  node scripts/art-qotd.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P, mulberry } from "./pixel-lib.mjs";

const SAGE_HI = "#9db894";    // lighter sage top edge
const TERRA_HI = "#cf8f76";   // lighter terracotta top edge
const POST_HI = "#a5876b";    // sunlit side of the post

/* A hollow box outline helper (draws the 4 edges of a rect). */
function outline(g, x0, y0, x1, y1, c) {
  g.rect(x0, y0, x1, y0, c);
  g.rect(x0, y1, x1, y1, c);
  g.rect(x0, y0, x0, y1, c);
  g.rect(x1, y0, x1, y1, c);
}

/* ---------- text helpers ------------------------------------- */
/* The font's space glyph leaves five blank columns between words,
   which pushes the subtitle one pixel past the 120-wide canvas.
   Measure per word so the gap can be tightened to four when a line
   would otherwise run off the edge. */
function lineWidth(text, scale, gap) {
  const words = text.split(" ");
  return words.reduce((n, w) => n + textWidth(w, scale), 0) + gap * (words.length - 1);
}
function centreLine(g, y, text, colour, scale) {
  let gap = 5 * scale;
  if (lineWidth(text, scale, gap) > g.w - 4) gap = 4 * scale;
  let cx = Math.floor((g.w - lineWidth(text, scale, gap)) / 2);
  for (const word of text.split(" ")) {
    drawText(g, cx, y, word, colour, scale);
    cx += textWidth(word, scale) + gap;
  }
}

/* The 3x5 font has no "?", so here is one cut to the same 3x5 cell. */
const QMARK = ["110", "001", "010", "000", "010"];
function qmark(g, x, y, colour, scale = 1) {
  QMARK.forEach((row, ry) => {
    [...row].forEach((bit, rx) => {
      if (bit === "1")
        g.rect(x + rx * scale, y + ry * scale,
               x + (rx + 1) * scale - 1, y + (ry + 1) * scale - 1, colour);
    });
  });
}

/* ---------- scene pieces ------------------------------------- */

/* The post: three columns of timber with a sunlit left edge, a cap
   on top and a shadow puddled at the base. */
function signpost(g, x, topY, baseY) {
  g.rect(x, topY, x + 2, baseY, P.brown);
  g.rect(x, topY, x, baseY, POST_HI);
  g.rect(x + 2, topY, x + 2, baseY, P.brownDark);
  g.rect(x - 1, topY, x + 3, topY, P.brownDark);       // cap
  g.rect(x - 3, baseY, x + 5, baseY, P.brownDark);     // ground shadow
}

/* One arrow board, seven rows tall, spanning columns x0..x1 with the
   point at the left (dir -1) or the right (dir +1) end. The ink
   silhouette goes down first and the fill is inset by one column, so
   the outline survives along the diagonals as well as the flats. */
function arrowBoard(g, x0, x1, y, dir, fill, dark) {
  const mid = y + 3, point = 3;
  const fromTip = (x) => (dir < 0 ? x - x0 : x1 - x);

  for (let x = x0; x <= x1; x++) {
    const e = Math.min(fromTip(x), point);
    g.rect(x, mid - e, x, mid + e, P.ink);
  }
  for (let x = x0 + 1; x <= x1 - 1; x++) {
    const e = Math.min(fromTip(x) - 1, point - 1);
    if (e < 0) continue;
    g.rect(x, mid - e, x, mid + e, fill);
    g.px(x, mid + e, dark);                            // shaded lower edge
  }
  // two dashes standing in for the lettering on the board
  const bx0 = dir < 0 ? x0 + 5 : x0 + 2;
  const bx1 = dir < 0 ? x1 - 2 : x1 - 4;
  g.rect(bx0, mid - 1, bx1, mid - 1, P.paper);
  g.rect(bx0, mid + 1, bx1 - 3, mid + 1, P.paper);
}

/* A tally bar standing on baseY: filled column, lighter top edge,
   darker footing, ink outline, and a light rule per vote inside. */
function tallyBar(g, x0, x1, baseY, height, fill, dark, hi) {
  const top = baseY - height + 1;
  g.rect(x0, top, x1, baseY, fill);
  g.rect(x0, top, x1, top, hi);
  g.rect(x0, baseY, x1, baseY, dark);
  outline(g, x0, top, x1, baseY, P.ink);
  for (let y = baseY - 3; y > top + 1; y -= 3) g.rect(x0 + 1, y, x1 - 1, y, P.paper2);
}

/* ---------- the scene ---------------------------------------- */
/* floorY = top of the floor band; everything stands above it so the
   band itself stays clear (the OG wordmark sits there). */
function signScene(w, h, { bunting = false } = {}) {
  const g = new Grid(w, h, P.paper);
  const floorY = h - 8;
  const baseY = floorY - 1;

  // floor
  g.rect(0, floorY, w - 1, h - 1, P.paper3);
  g.rect(0, floorY, w - 1, floorY, P.line);

  // grass tufts along the verge — seeded, so the art never shifts
  const rnd = mulberry(0x51ff);
  for (let i = 0; i < 8; i++) {
    const x = 2 + Math.round(rnd() * (w - 6));
    const c = rnd() < 0.5 ? P.grass : P.grassDark;
    g.px(x, baseY, c); g.px(x + 1, baseY - 1, c); g.px(x + 2, baseY, c);
  }

  // the signpost, left of centre, an arrow board each way
  const px = Math.round(w * 0.30);
  signpost(g, px, 5, baseY);
  arrowBoard(g, px - 15, px + 1, 6, -1, P.sage, P.sageDark);
  arrowBoard(g, px + 1, px + 16, 14, 1, P.terra, P.terraDark);

  // the split, tallied to the right of the post
  const bx = Math.round(w * 0.64);
  tallyBar(g, bx, bx + 7, baseY, 14, P.sage, P.sageDark, SAGE_HI);
  tallyBar(g, bx + 11, bx + 18, baseY, 9, P.terra, P.terraDark, TERRA_HI);

  // floating question marks
  qmark(g, Math.round(w * 0.50), 5, P.gold, 2);
  qmark(g, Math.round(w * 0.57), 17, P.terraDark, 1);
  qmark(g, Math.round(w * 0.90), 6, P.sageDark, 1);

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
signScene(112, 32, { bunting: true }).toPng("public/art/qotd-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  centreLine(g, 2, "QUESTION OF", P.ink, 2);
  centreLine(g, 13, "THE DAY", P.ink, 2);
  centreLine(g, 25, "ONE LINK - A NEW ONE EVERY DAY", P.terraDark, 1);
  g.blit(signScene(120, 32), 0, 31, 1);
  // wordmark blocks bottom-left, on the clear stretch of floor
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-qotd.png", 10);
}

console.log("done");
