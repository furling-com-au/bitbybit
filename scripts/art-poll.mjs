/* ============================================================
   Group Vote — OG image + hero art.
   A pixel ballot box with a slip going in the slot, standing next
   to a little results panel: three horizontal bars, the leader in
   gold with a star. Composed like the other og images — big 3x5
   title, subtitle, a scene on the floor band, and the wordmark
   bottom-left.
   Run:  node scripts/art-poll.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

const GOLD_DK = "#b5852f";
const BOX_HI = "#9db894";   // lighter sage top edge

/* A hollow box outline helper (draws the 4 edges of a rect). */
function outline(g, x0, y0, x1, y1, c) {
  g.rect(x0, y0, x1, y0, c);
  g.rect(x0, y1, x1, y1, c);
  g.rect(x0, y0, x0, y1, c);
  g.rect(x1, y0, x1, y1, c);
}

/* The ballot box: sage body, darker lid a touch wider, an ink slot,
   and a "✓" panel on the front. Bottom sits on baseY. */
function ballotBox(g, x, baseY) {
  const w = 20, h = 13;
  const top = baseY - h;
  // body
  g.rect(x, top + 3, x + w - 1, baseY - 1, P.sage);
  outline(g, x, top + 3, x + w - 1, baseY - 1, P.ink);
  // subtle top-edge highlight
  g.rect(x + 1, top + 3, x + w - 2, top + 3, BOX_HI);
  // lid, a little wider
  g.rect(x - 1, top + 1, x + w, top + 2, P.sageDark);
  outline(g, x - 1, top + 1, x + w, top + 2, P.ink);
  // the slot
  g.rect(x + 6, top + 1, x + w - 7, top + 1, P.ink);
  // front label panel with a tick
  const px0 = x + 4, py0 = top + 6, px1 = x + w - 5, py1 = baseY - 3;
  g.rect(px0, py0, px1, py1, P.paper);
  outline(g, px0, py0, px1, py1, P.ink);
  // tick mark in terracotta
  const tx = px0 + 3, ty = py0 + 3;
  g.px(tx, ty, P.terraDark);
  g.px(tx + 1, ty + 1, P.terraDark);
  g.px(tx + 2, ty, P.terraDark);
  g.px(tx + 3, ty - 1, P.terraDark);
  g.px(tx + 4, ty - 2, P.terraDark);
}

/* A ballot slip poking out of the slot, with a couple of scribble
   lines and a ticked box. Its lower edge sits at (sx, sy) — the
   slot mouth — and it rises up out of the box. */
function ballotSlip(g, sx, sy) {
  const w = 9, h = 9;
  g.rect(sx, sy - h, sx + w - 1, sy, P.white);
  outline(g, sx, sy - h, sx + w - 1, sy, P.ink);
  // scribbled option lines
  g.rect(sx + 2, sy - h + 2, sx + w - 3, sy - h + 2, P.inkSoft);
  g.rect(sx + 2, sy - h + 4, sx + w - 4, sy - h + 4, P.inkSoft);
  // a chosen box, ticked in red
  g.rect(sx + 2, sy - h + 6, sx + 3, sy - h + 7, P.paper2);
  outline(g, sx + 2, sy - h + 6, sx + 3, sy - h + 7, P.ink);
  g.px(sx + 2, sy - h + 7, P.red);
  g.px(sx + 3, sy - h + 6, P.red);
}

/* A results panel: paper2 card with three horizontal bars of
   different lengths; the top (longest) bar is gold with a star. */
function resultsPanel(g, x, baseY) {
  const w = 34, h = 18;
  const top = baseY - h;
  g.rect(x, top, x + w - 1, baseY - 1, P.paper2);
  outline(g, x, top, x + w - 1, baseY - 1, P.ink);

  const lens = [26, 17, 11];
  const fills = [
    [P.gold, GOLD_DK],
    [P.sage, P.sageDark],
    [P.terra, P.terraDark],
  ];
  for (let i = 0; i < 3; i++) {
    const by = top + 3 + i * 5;
    // track
    g.rect(x + 3, by, x + w - 4, by + 2, P.paper);
    outline(g, x + 3, by, x + w - 4, by + 2, P.line);
    // fill
    const [hi, dk] = fills[i];
    g.rect(x + 3, by, x + 3 + lens[i], by + 2, hi);
    g.rect(x + 3, by + 2, x + 3 + lens[i], by + 2, dk);
  }
  // a little star on the leader (top) bar
  const stx = x + 3 + lens[0] + 2, sty = top + 4;
  g.px(stx, sty - 1, P.gold);
  g.rect(stx - 1, sty, stx + 1, sty, P.gold);
  g.px(stx, sty + 1, P.gold);
}

/* ---------- the scene ---------------------------------------- */
/* floorY = top of the floor band; the box and panel stand on it and
   the band itself stays clear (the OG wordmark sits there). */
function pollScene(w, h, { bunting = false } = {}) {
  const g = new Grid(w, h, P.paper);
  const floorY = h - 8;

  // floor
  g.rect(0, floorY, w - 1, h - 1, P.paper3);
  g.rect(0, floorY, w - 1, floorY, P.line);

  // ballot box on the left-of-centre, slip poking out the slot
  const boxX = Math.round(w * 0.16);
  const boxTop = (floorY - 1) - 13;
  ballotBox(g, boxX, floorY - 1);
  ballotSlip(g, boxX + 6, boxTop + 2);

  // results panel on the right
  resultsPanel(g, Math.round(w * 0.56), floorY - 1);

  // a few confetti ticks between them
  g.px(Math.round(w * 0.47), floorY - 16, P.terra);
  g.px(Math.round(w * 0.505), floorY - 11, P.gold);
  g.px(Math.round(w * 0.44), floorY - 8, P.sage);

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
pollScene(112, 32, { bunting: true }).toPng("public/art/poll-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "GROUP VOTE";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 4, t1, P.ink, 2);
  const t2 = "EVERYONE GETS A VOTE";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 16, t2, P.terraDark, 1);
  const t3 = "FREE - NO SIGNUP";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 23, t3, P.inkSoft, 1);
  g.blit(pollScene(120, 34), 0, 29, 1);
  // wordmark blocks bottom-left, on the clear stretch of floor
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-poll.png", 10);
}

console.log("done");
