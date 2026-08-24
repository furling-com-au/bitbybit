/* ============================================================
   Group Card — OG image + hero art.
   A big greeting card standing open with a heart on the front,
   an envelope waiting beside it, and colourful sticky-note
   messages scattered around — a few still fluttering in.
   Run:  node scripts/art-card.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

const GOLD_DK = "#b5852f";
const SKY_DK = "#6f97a6";
const PLUM_DK = "#7a4e63";

/* Sticky-note colour pairs — the same five hues the tool rotates
   through on the live card. */
const NOTE_HUES = [
  [P.sage, P.sageDark],
  [P.terra, P.terraDark],
  [P.gold, GOLD_DK],
  [P.sky, SKY_DK],
  [P.plum, PLUM_DK],
];

/* ---------- pieces ------------------------------------------- */

function outline(g, x0, y0, x1, y1, c) {
  g.rect(x0, y0, x1, y0, c);
  g.rect(x0, y1, x1, y1, c);
  g.rect(x0, y0, x0, y1, c);
  g.rect(x1, y0, x1, y1, c);
}

/* A sticky note: coloured square, scribbled lines, curled corner. */
function sticky(g, x, y, s, [hue, dark]) {
  g.rect(x, y, x + s - 1, y + s - 1, hue);
  g.px(x + s - 1, y + s - 1, dark);                       // curled corner
  g.rect(x + 1, y + 2, x + s - 3, y + 2, dark);           // scribble
  if (s >= 6) g.rect(x + 1, y + 4, x + s - 4, y + 4, dark);
}

/* The big card: back leaf peeking up behind, white front with an
   ink border, a heart, and squiggle lines of message. */
function bigCard(g, cx, cy, cw, ch) {
  // back leaf, offset up-right
  g.rect(cx + 2, cy - 2, cx + cw + 1, cy + ch - 3, P.paper2);
  outline(g, cx + 2, cy - 2, cx + cw + 1, cy + ch - 3, P.ink);
  // front leaf
  g.rect(cx, cy, cx + cw - 1, cy + ch - 1, P.white);
  outline(g, cx, cy, cx + cw - 1, cy + ch - 1, P.ink);
  // heart, centred near the top
  const hx = cx + Math.floor(cw / 2) - 3, hy = cy + 3;
  g.rect(hx + 1, hy, hx + 2, hy, P.red); g.rect(hx + 4, hy, hx + 5, hy, P.red);
  g.rect(hx, hy + 1, hx + 6, hy + 2, P.red);
  g.rect(hx + 1, hy + 3, hx + 5, hy + 3, P.red);
  g.rect(hx + 2, hy + 4, hx + 4, hy + 4, P.red);
  g.px(hx + 3, hy + 5, P.red);
  // message squiggles + a short signature in terracotta
  const mx = cx + 3, my = cy + ch - 7;
  g.rect(mx, my, cx + cw - 4, my, P.inkSoft);
  g.rect(mx, my + 2, cx + cw - 6, my + 2, P.inkSoft);
  g.rect(mx, my + 4, cx + cw - 9, my + 4, P.inkSoft);
  g.rect(cx + cw - 9, my + 4, cx + cw - 5, my + 4, P.terra);
}

/* The envelope it'll be handed over in, propped beside the card. */
function envelope(g, x, y, w, h) {
  g.rect(x, y, x + w - 1, y + h - 1, P.paper2);
  outline(g, x, y, x + w - 1, y + h - 1, P.ink);
  const mid = x + Math.floor(w / 2), depth = 4;
  for (let cxx = x + 1; cxx <= mid; cxx++) {              // V of the flap
    const t = (cxx - x - 1) / (mid - x - 1);
    const yy = y + 1 + Math.round(t * (depth - 1));
    g.px(cxx, yy, P.inkSoft);
    g.px(x + w - 1 - (cxx - x), yy, P.inkSoft);
  }
  g.px(mid, y + depth, P.gold);                           // wax-ish seal
}

/* ---------- the scene ---------------------------------------- */
/* floorY = top of the floor band; everything stands on it and the
   band itself stays clear (the OG wordmark sits there). */
function cardScene(w, h, { bunting = false } = {}) {
  const g = new Grid(w, h, P.paper);
  const floorY = h - 8;

  // floor
  g.rect(0, floorY, w - 1, h - 1, P.paper3);
  g.rect(0, floorY, w - 1, floorY, P.line);

  // the big card, centre stage
  const cw = 26, ch = 17;
  const cx = Math.round(w / 2 - cw / 2), cy = floorY - ch;
  bigCard(g, cx, cy, cw, ch);

  // envelope on the left
  envelope(g, Math.round(w * 0.13), floorY - 10, 18, 10);

  // sticky notes: some landed, some still fluttering in
  sticky(g, Math.round(w * 0.30), floorY - 6, 6, NOTE_HUES[0]);   // sage, by the envelope
  sticky(g, Math.round(w * 0.075), floorY - 16, 5, NOTE_HUES[2]); // gold, drifting
  sticky(g, cx + cw - 4, floorY - 8, 6, NOTE_HUES[1]);            // terra, stuck on the card
  sticky(g, Math.round(w * 0.72), floorY - 6, 6, NOTE_HUES[3]);   // sky, landed right
  sticky(g, Math.round(w * 0.81), floorY - 14, 5, NOTE_HUES[4]);  // plum, mid-air
  sticky(g, Math.round(w * 0.90), floorY - 20, 5, NOTE_HUES[0]);  // sage, high flutter

  // confetti
  g.px(Math.round(w * 0.24), floorY - 19, P.terra);
  g.px(Math.round(w * 0.36), floorY - 22, P.gold);
  g.px(Math.round(w * 0.68), floorY - 21, P.plum);
  g.px(Math.round(w * 0.77), floorY - 18, P.sage);
  g.px(Math.round(w * 0.86), floorY - 9, P.gold);
  g.px(Math.round(w * 0.055), floorY - 8, P.plum);

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
cardScene(112, 32, { bunting: true }).toPng("public/art/card-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "GROUP CARD";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 4, t1, P.ink, 2);
  const t2 = "ONE CARD - EVERYONE SIGNS";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 16, t2, P.terraDark, 1);
  const t3 = "FREE - NO SIGNUP";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 23, t3, P.inkSoft, 1);
  g.blit(cardScene(120, 34), 0, 29, 1);
  // wordmark blocks bottom-left, on the clear stretch of floor
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-card.png", 10);
}

console.log("done");
