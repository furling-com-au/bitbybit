/* ============================================================
   404 art: an empty shelf where a tool should be, plus a
   tumbleweed sprite the page rolls across it.
   Run: node scripts/art-404.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, P, mulberry } from "./pixel-lib.mjs";

mkdirSync("public/art", { recursive: true });

/* ---------- the empty shelf ---------- */
function shelfScene(w, h) {
  const g = new Grid(w, h, P.paper);
  const rng = mulberry(11);
  const shelfY = h - 10;

  // dust motes drifting in the empty space
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * (shelfY - 2));
    g.px(x, y, P.line);
  }

  // the plank
  g.rect(3, shelfY, w - 4, shelfY + 2, "#8a6d4f");
  g.rect(3, shelfY, w - 4, shelfY, "#a98a68");     // lit top edge
  g.rect(3, shelfY + 3, w - 4, shelfY + 3, P.brownDark); // shadow lip

  // brackets
  for (const bx of [7, w - 10]) {
    g.rect(bx, shelfY + 4, bx + 2, shelfY + 8, P.brownDark);
    g.rect(bx, shelfY + 4, bx, shelfY + 8, "#6b5c48");
  }

  // cobweb, top-left corner — nobody's been here for a while
  for (let i = 1; i <= 7; i++) {
    g.px(i, 0, P.line);
    g.px(0, i, P.line);
    g.px(i, 7 - i, P.line);
  }
  g.px(2, 2, P.line); g.px(4, 4, P.line);

  // one lonely bolt left behind on the shelf
  const bx = Math.floor(w * 0.62);
  g.rect(bx, shelfY - 2, bx + 3, shelfY - 1, "#9a9086");
  g.rect(bx + 1, shelfY - 3, bx + 2, shelfY - 3, "#7d746b");
  g.px(bx + 1, shelfY - 2, "#c9bda9");

  // an empty price-tag label hanging off the front
  const lx = Math.floor(w * 0.22);
  g.rect(lx, shelfY + 4, lx + 8, shelfY + 8, P.paper2);
  g.rect(lx, shelfY + 4, lx + 8, shelfY + 4, P.ink);
  g.rect(lx, shelfY + 8, lx + 8, shelfY + 8, P.ink);
  g.rect(lx, shelfY + 4, lx, shelfY + 8, P.ink);
  g.rect(lx + 8, shelfY + 4, lx + 8, shelfY + 8, P.ink);
  g.px(lx + 4, shelfY + 3, P.inkSoft);           // string
  g.rect(lx + 2, shelfY + 6, lx + 6, shelfY + 6, P.line); // blank line

  return g;
}

/* ---------- the tumbleweed ----------
   The trick is airiness: a real tumbleweed is mostly gaps. So this
   draws thin, broken strands — an irregular outer ring with holes in
   it, a smaller inner ring, a few chords straight through, and some
   sprigs poking past the silhouette. Density is kept deliberately
   low; fill it in and it just reads as a brown donut. */
function tumbleweed(size) {
  const g = new Grid(size, size);
  const c = (size - 1) / 2;
  const rng = mulberry(31);
  const LIGHT = "#b39468", MID = "#8a6d4f", DARK = "#5d4832";
  const tone = () => (rng() < 0.34 ? DARK : rng() < 0.6 ? MID : LIGHT);

  // broken strands: ring-ish, but with real gaps
  function strand(radius, from, to, keep) {
    const steps = Math.ceil((to - from) * radius * 1.4);
    for (let i = 0; i <= steps; i++) {
      if (rng() > keep) continue;                 // the gaps do the work
      const ang = from + ((to - from) * i) / steps;
      const rr = radius * (0.9 + rng() * 0.2);    // wobble so it isn't a compass circle
      g.px(Math.round(c + Math.cos(ang) * rr), Math.round(c + Math.sin(ang) * rr), tone());
    }
  }
  const TAU = Math.PI * 2;
  strand(c * 0.95, 0, TAU, 0.62);                 // outer snarl
  strand(c * 0.62, 0.9, 0.9 + TAU * 0.8, 0.5);    // inner strand, not a full circle
  strand(c * 0.78, 3.4, 3.4 + TAU * 0.45, 0.5);

  // chords straight through the middle — reads as twigs, keeps it open
  for (let k = 0; k < 4; k++) {
    const ang = rng() * Math.PI;
    const len = c * (0.6 + rng() * 0.45);
    const col = rng() > 0.5 ? MID : DARK;
    for (let t = -len; t <= len; t += 0.55) {
      if (rng() > 0.75) continue;
      g.px(Math.round(c + Math.cos(ang) * t), Math.round(c + Math.sin(ang) * t), col);
    }
  }

  // stray sprigs breaking the outline so the silhouette isn't a circle
  for (let k = 0; k < 5; k++) {
    const ang = rng() * TAU;
    for (let t = c * 0.8; t <= c + 1.2; t += 0.7) {
      g.px(Math.round(c + Math.cos(ang) * t), Math.round(c + Math.sin(ang) * t), DARK);
    }
  }

  return g;
}

shelfScene(112, 34).toPng("public/art/404-shelf.png", 10);
tumbleweed(21).toPng("public/art/404-tumbleweed.png", 10);
