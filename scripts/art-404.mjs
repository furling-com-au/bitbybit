/* ============================================================
   404 art: an empty shelf where a tool should be, plus a
   tumbleweed sprite the page rolls across it.
   Run: node scripts/art-404.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, P, mulberry } from "./pixel-lib.mjs";

mkdirSync("public/art", { recursive: true });

/* ---------- the shelf ----------
   A lone plank reads as "a horizontal bar", not a shelf. So this is a
   whole cabinet: uprights, a top, three compartments with actual
   things on two of them — and one conspicuously empty gap where the
   thing you came for should be. The gap only reads as a gap if the
   other shelves are full. */

function ball(g, x, base) {
  g.ellipse(x, base - 3, 5, 3, "#a63a2b");
  g.rect(x - 3, base - 3, x + 3, base - 3, "#f6f1e4");
  for (const dx of [-2, 0, 2]) g.rect(x + dx, base - 4, x + dx, base - 2, "#f6f1e4");
}
function gift(g, x, base) {
  g.rect(x - 4, base - 6, x + 4, base, P.terra);
  g.rect(x - 5, base - 8, x + 5, base - 6, P.terraDark);
  g.rect(x - 1, base - 8, x, base, P.gold);
  g.rect(x - 4, base - 10, x - 2, base - 8, P.gold);
  g.rect(x + 1, base - 10, x + 3, base - 8, P.gold);
}
function trophy(g, x, base) {
  g.rect(x - 3, base - 9, x + 3, base - 4, P.gold);
  g.rect(x - 5, base - 8, x - 4, base - 6, P.gold);
  g.rect(x + 4, base - 8, x + 5, base - 6, P.gold);
  g.rect(x - 1, base - 4, x, base - 2, "#b5852f");
  g.rect(x - 3, base - 2, x + 3, base, P.brownDark);
  g.px(x - 2, base - 8, P.white);
}
function pot(g, x, base) {
  g.rect(x - 5, base - 5, x + 5, base, P.terraDark);
  g.rect(x - 6, base - 7, x + 6, base - 5, P.terra);
  g.rect(x - 1, base - 9, x, base - 7, P.ink);
}
function envelope(g, x, base) {
  g.rect(x - 6, base - 7, x + 6, base, P.paper);
  g.rect(x - 6, base - 7, x + 6, base - 7, P.ink);
  g.rect(x - 6, base, x + 6, base, P.ink);
  g.rect(x - 6, base - 7, x - 6, base, P.ink);
  g.rect(x + 6, base - 7, x + 6, base, P.ink);
  for (let i = 0; i <= 5; i++) { g.px(x - 6 + i, base - 7 + i, P.inkSoft); g.px(x + 6 - i, base - 7 + i, P.inkSoft); }
}
function books(g, x, base) {
  g.rect(x - 5, base - 2, x + 5, base, P.sageDark);
  g.rect(x - 4, base - 5, x + 4, base - 3, P.plum);
  g.rect(x - 5, base - 8, x + 3, base - 6, P.sky);
}

function shelfScene(w, h) {
  const g = new Grid(w, h, P.paper);
  const rng = mulberry(11);

  const L = 14, R = w - 15;          // cabinet outer edges
  const TOP = 1, BOT = 38;
  const iL = L + 3, iR = R - 3;      // interior

  // back panel, so compartments read as recessed
  g.rect(L, TOP, R, BOT, P.paper2);

  // carcass: uprights, top rail, bottom rail
  g.rect(L, TOP, L + 2, BOT, "#8a6d4f");
  g.rect(R - 2, TOP, R, BOT, "#8a6d4f");
  g.rect(L, TOP, R, TOP + 2, "#8a6d4f");
  g.rect(L, BOT - 2, R, BOT, "#8a6d4f");
  g.rect(L, TOP, R, TOP, "#a98a68");                 // lit top edge
  g.rect(L, BOT, R, BOT, P.brownDark);               // shadow underneath

  // two shelf planks -> three compartments
  for (const y of [14, 25]) {
    g.rect(iL - 3, y, iR + 3, y + 1, "#8a6d4f");
    g.rect(iL - 3, y, iR + 3, y, "#a98a68");
    g.rect(iL - 3, y + 2, iR + 3, y + 2, P.brownDark);
  }

  // top shelf: full of things
  ball(g, iL + 12, 13);
  gift(g, iL + 34, 13);
  trophy(g, iL + 58, 13);

  // bottom shelf: also full
  pot(g, iL + 13, 35);
  envelope(g, iL + 36, 35);
  books(g, iL + 60, 35);

  // MIDDLE SHELF: the gap. A dust outline where something used to sit,
  // and the little blank label that says what should have been here.
  const gx = iL + 26, gy = 24;
  for (let x = gx - 11; x <= gx + 11; x += 2) { g.px(x, gy, P.line); g.px(x, gy - 8, P.line); }
  for (let y = gy - 8; y <= gy; y += 2) { g.px(gx - 11, y, P.line); g.px(gx + 11, y, P.line); }
  g.rect(gx - 5, gy - 4, gx + 5, gy, P.paper3);        // faint dust patch
  // cobweb, top-left inside corner
  for (let i = 1; i <= 6; i++) { g.px(iL + i - 3, TOP + 3, P.line); g.px(iL - 3, TOP + 2 + i, P.line); g.px(iL + i - 3, TOP + 9 - i, P.line); }

  // floor line + dust motes drifting
  g.rect(0, 40, w - 1, 40, P.line);
  for (let i = 0; i < 18; i++) g.px(Math.floor(rng() * w), 41 + Math.floor(rng() * 6), P.paper3);

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

shelfScene(112, 48).toPng("public/art/404-shelf.png", 10);
tumbleweed(21).toPng("public/art/404-tumbleweed.png", 10);
