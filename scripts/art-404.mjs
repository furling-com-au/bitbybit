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

/* ---------- the tumbleweed ---------- */
function tumbleweed(size) {
  const g = new Grid(size, size);
  const c = (size - 1) / 2;
  const rng = mulberry(5);
  // a scruffy ring of twigs
  for (let a = 0; a < 60; a++) {
    const ang = (a / 60) * Math.PI * 2;
    const r = c * (0.55 + rng() * 0.45);
    g.px(Math.round(c + Math.cos(ang) * r), Math.round(c + Math.sin(ang) * r),
      rng() > 0.5 ? "#8a6d4f" : "#a98a68");
  }
  // a few spokes so it reads as a tangle, not a donut
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2 + 0.4;
    for (let t = 1; t < c; t++) {
      if (rng() > 0.45) continue;
      g.px(Math.round(c + Math.cos(ang) * t), Math.round(c + Math.sin(ang) * t), "#6b5c48");
    }
  }
  return g;
}

shelfScene(112, 34).toPng("public/art/404-shelf.png", 10);
tumbleweed(15).toPng("public/art/404-tumbleweed.png", 10);
