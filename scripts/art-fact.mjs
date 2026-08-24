/* ============================================================
   Fact Matcher — OG image + hero art.
   A little line-up of pixel people (heads and shoulders), speech
   bubbles full of question marks floating above, and a disguise
   mask — "secret facts, guess who". Composed like the other og
   images: big 3x5-font title, subtitle, a scene, and the wordmark
   bottom-left.
   Run:  node scripts/art-fact.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

/* skin + hair tones for a varied line-up */
const SKINS = ["#e8c9a5", "#c99e78", "#a6784f", "#e3b98f", "#8a5e3c"];
const HAIRS = [P.brownDark, P.ink, "#6b4a2f", P.terraDark, "#3a3038"];
const SHIRTS = [P.sageDark, P.terra, P.plum, P.sky, P.gold, P.grassDark];

/* The '?' glyph the shared 3x5 font doesn't carry. 3 wide, 5 tall. */
const QMARK = ["111", "001", "011", "000", "010"];
function drawQ(g, x, y, c) {
  QMARK.forEach((row, ry) => {
    [...row].forEach((bit, rx) => { if (bit === "1") g.px(x + rx, y + ry, c); });
  });
}

/* A speech bubble with a question mark, drawn straight onto the
   scene grid (which is scaled up later). ~13 wide, ~13 tall incl.
   the little tail. */
function drawBubble(g, ox, oy, qColour = P.terraDark) {
  const edge = P.ink, fill = P.white;
  // rounded-rect outline, x 0..12, y 0..9 (corners knocked off)
  g.rect(ox + 2, oy, ox + 10, oy, edge);            // top
  g.rect(ox + 2, oy + 9, ox + 10, oy + 9, edge);    // bottom
  g.rect(ox, oy + 2, ox, oy + 7, edge);             // left
  g.rect(ox + 12, oy + 2, ox + 12, oy + 7, edge);   // right
  g.px(ox + 1, oy + 1, edge); g.px(ox + 11, oy + 1, edge);
  g.px(ox + 1, oy + 8, edge); g.px(ox + 11, oy + 8, edge);
  // fill the interior
  g.rect(ox + 1, oy + 2, ox + 11, oy + 7, fill);
  g.rect(ox + 2, oy + 1, ox + 10, oy + 8, fill);
  // tail, lower-left
  g.px(ox + 3, oy + 10, edge); g.px(ox + 3, oy + 11, edge); g.px(ox + 4, oy + 10, edge);
  g.px(ox + 4, oy + 9, fill);
  // the '?'
  drawQ(g, ox + 5, oy + 2, qColour);
}

/* A head-and-shoulders figure standing with feet on groundY.
   Roughly 11 wide. `mask` draws a domino mask across the eyes. */
function drawFigure(g, cx, groundY, skin, hair, shirt, mask = false) {
  const headTop = groundY - 15;
  // shoulders / shirt (a little trapezoid)
  g.rect(cx - 5, groundY - 4, cx + 5, groundY, shirt);
  g.rect(cx - 4, groundY - 6, cx + 4, groundY - 5, shirt);
  // neck
  g.rect(cx - 1, groundY - 7, cx + 1, groundY - 6, skin);
  // head
  g.rect(cx - 3, headTop + 1, cx + 3, groundY - 7, skin);
  g.rect(cx - 2, headTop, cx + 2, headTop, skin);
  // hair
  g.rect(cx - 3, headTop, cx + 3, headTop + 1, hair);
  g.rect(cx - 4, headTop + 1, cx - 3, headTop + 3, hair);
  g.rect(cx + 3, headTop + 1, cx + 4, headTop + 3, hair);
  // ears
  g.px(cx - 4, headTop + 4, skin); g.px(cx + 4, headTop + 4, skin);

  if (mask) {
    // domino mask band across the eyes
    g.rect(cx - 4, headTop + 4, cx + 4, headTop + 5, P.ink);
    g.px(cx - 2, headTop + 4, P.gold); g.px(cx + 2, headTop + 4, P.gold); // eye holes
  } else {
    // eyes + smile
    g.px(cx - 2, headTop + 4, P.ink); g.px(cx + 2, headTop + 4, P.ink);
    g.px(cx - 1, headTop + 6, P.terraDark); g.px(cx, headTop + 6, P.terraDark); g.px(cx + 1, headTop + 6, P.terraDark);
  }
}

/* ---------- the scene ---------------------------------------- */
/* A row of figures on the floor, with speech bubbles above two of
   them. `variant` shifts spacing between the wide (hero) and the
   squarer (og) layouts. */
function scene(w, h, { bubbles = true } = {}) {
  const g = new Grid(w, h, P.paper);
  const floorY = h - 2;

  // floor line
  g.rect(0, floorY, w - 1, floorY, P.line);
  g.rect(0, floorY + 1, w - 1, h - 1, P.paper3);

  // figures, evenly spread; the middle one wears the mask
  const n = w >= 100 ? 5 : 4;
  const groundY = floorY - 1;
  const positions = [];
  for (let i = 0; i < n; i++) {
    positions.push(Math.round(w * (i + 1) / (n + 1)));
  }
  positions.forEach((cx, i) => {
    drawFigure(g, cx, groundY,
      SKINS[i % SKINS.length], HAIRS[i % HAIRS.length], SHIRTS[i % SHIRTS.length],
      i === Math.floor(n / 2));
  });

  // speech bubbles above the outer two figures
  if (bubbles) {
    drawBubble(g, positions[0] - 6, 1, P.terraDark);
    drawBubble(g, positions[n - 1] - 6, 3, P.sageDark);
    if (n >= 5) drawBubble(g, positions[2] - 6, 0, P.plum);
  }

  return g;
}

/* ---------- build -------------------------------------------- */
mkdirSync("public/art", { recursive: true });

/* hero: 112x32 @10 = 1120x320 */
scene(112, 32, { bubbles: true }).toPng("public/art/fact-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);

  const t1 = "FACT MATCHER";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 5, t1, P.ink, 2);
  const t2 = "SECRET FACTS - GUESS WHO";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 18, t2, P.terraDark, 1);

  // the scene sits in the lower band
  g.blit(scene(120, 33, { bubbles: true }), 0, 27, 1);

  // wordmark blocks + text, bottom-left on the floor strip
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);

  g.toPng("public/art/og-fact.png", 10);
}

console.log("done");
