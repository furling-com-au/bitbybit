/* ============================================================
   Generates the base pixel-art assets (shelf icons, sweep hero,
   OG images). Per-tool extras live in scripts/art-<tool>.mjs.
   Run:  node scripts/gen-art.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P, mulberry } from "./pixel-lib.mjs";

/* ---------- icons (16×16) ----------------------------------- */
function iconFooty() {
  const g = new Grid(16, 16);
  g.ellipse(8, 8, 6, 4, P.red);
  g.ellipse(7, 7, 3, 2, "#b8503f");            // sheen
  g.rect(4, 8, 12, 8, P.white);                 // lace line
  for (const x of [5, 7, 9, 11]) g.rect(x, 7, x, 9, P.white); // stitches
  g.px(3, 8, P.redDark); g.px(13, 8, P.redDark);
  return g;
}
function iconHorse() {
  const g = new Grid(16, 16);
  g.rect(3, 8, 8, 15, "#9a6b42");               // neck
  g.rect(5, 4, 12, 9, "#9a6b42");               // head
  g.rect(11, 6, 14, 9, "#b5854f");              // muzzle
  g.rect(5, 2, 6, 4, "#9a6b42");                // ear
  g.rect(3, 4, 4, 15, P.brownDark);             // mane
  g.px(8, 6, P.ink);                            // eye
  g.px(13, 8, P.ink);                           // nostril
  return g;
}
function iconGift() {
  const g = new Grid(16, 16);
  g.rect(3, 7, 12, 14, P.terra);
  g.rect(2, 5, 13, 7, P.terraDark);
  g.rect(7, 5, 8, 14, P.gold);                  // ribbon
  g.rect(4, 2, 6, 4, P.gold); g.rect(9, 2, 11, 4, P.gold); // bow
  g.px(7, 3, P.terraDark); g.px(8, 3, P.terraDark);
  return g;
}
function iconCar() {
  const g = new Grid(16, 16);
  g.rect(1, 7, 14, 11, P.sage);
  g.rect(3, 4, 10, 7, P.sage);
  g.rect(4, 5, 6, 7, P.sky); g.rect(8, 5, 9, 7, P.sky);
  g.rect(1, 7, 14, 7, P.sageDark);
  g.disc(4, 12, 2, P.ink); g.disc(11, 12, 2, P.ink);
  g.px(4, 12, P.line); g.px(11, 12, P.line);
  g.rect(14, 8, 15, 9, P.gold);                 // headlight
  g.rect(2, 2, 9, 2, P.brownDark);              // roof rack
  return g;
}
function iconWolf() {
  const g = new Grid(16, 16);
  g.rect(3, 2, 5, 5, P.grey); g.rect(10, 2, 12, 5, P.grey);   // ears
  g.px(4, 3, P.plum); g.px(11, 3, P.plum);                    // inner ear
  g.rect(2, 5, 13, 12, P.grey);
  g.rect(5, 10, 10, 14, "#a49dae");                            // snout
  g.px(4, 7, P.gold); g.px(11, 7, P.gold);                     // eyes
  g.rect(7, 13, 8, 14, P.ink);                                 // nose
  g.rect(2, 5, 3, 8, P.greyDark); g.rect(12, 5, 13, 8, P.greyDark);
  return g;
}
function iconPot() {
  const g = new Grid(16, 16);
  g.rect(2, 8, 13, 14, P.terraDark);
  g.rect(3, 6, 12, 8, P.terra);
  g.rect(7, 4, 8, 5, P.ink);                    // knob
  g.rect(0, 9, 1, 10, P.terraDark); g.rect(14, 9, 15, 10, P.terraDark); // handles
  g.px(5, 2, P.line); g.px(6, 1, P.line); g.px(10, 2, P.line); g.px(9, 1, P.line); // steam
  return g;
}
function iconCard() {
  const g = new Grid(16, 16);
  g.rect(2, 4, 13, 12, P.paper2);
  g.rect(2, 4, 13, 4, P.ink); g.rect(2, 12, 13, 12, P.ink);
  g.rect(2, 4, 2, 12, P.ink); g.rect(13, 4, 13, 12, P.ink);
  for (let i = 0; i < 6; i++) { g.px(3 + i, 5 + i, P.inkSoft); g.px(12 - i, 5 + i, P.inkSoft); } // flap
  g.rect(7, 9, 8, 10, P.red);                   // heart seal
  g.px(6, 9, P.red); g.px(9, 9, P.red);
  return g;
}
function iconTrophy() {
  const g = new Grid(16, 16);
  g.rect(4, 2, 11, 8, P.gold);
  g.rect(2, 3, 3, 6, P.gold); g.rect(12, 3, 13, 6, P.gold);
  g.rect(3, 4, 3, 5, P.paper); g.rect(12, 4, 12, 5, P.paper);
  g.rect(6, 9, 9, 10, "#b5852f");
  g.rect(4, 11, 11, 13, P.brownDark);
  g.px(6, 4, P.white);                          // glint
  return g;
}


function iconRattle() {
  const g = new Grid(16, 16);
  g.disc(8, 5, 4, P.gold);                       // rattle head
  g.px(6, 4, P.paper); g.px(10, 6, "#b5852f");   // shine + shade
  g.rect(7, 9, 8, 13, P.terra);                  // handle
  g.disc(8, 14, 1, P.terraDark);                 // ring
  g.px(4, 2, P.sky); g.px(12, 2, P.plum); g.px(13, 9, P.sage); // confetti
  return g;
}
function iconClipboard() {
  const g = new Grid(16, 16);
  g.rect(3, 2, 12, 14, P.ink);                   // board
  g.rect(4, 3, 11, 13, P.paper2);                // paper
  g.rect(6, 1, 9, 3, P.grey);                    // clip
  g.rect(5, 5, 10, 5, P.inkSoft); g.rect(5, 8, 10, 8, P.inkSoft); g.rect(5, 11, 8, 11, P.inkSoft);
  g.px(11, 10, P.sageDark); g.px(12, 9, P.sageDark); g.px(10, 11, P.sageDark); // tick
  return g;
}
function iconBubbles() {
  const g = new Grid(16, 16);
  g.rect(1, 2, 9, 7, P.sage);                    // first speech bubble
  g.px(3, 8, P.sage); g.px(3, 9, P.sage);        // tail
  g.rect(6, 8, 14, 13, P.terra);                 // second bubble
  g.px(12, 14, P.terra);                         // tail
  g.rect(3, 4, 7, 4, P.paper); g.rect(8, 10, 12, 10, P.paper); // text hints
  return g;
}

/* ---------- footy field scene ------------------------------- */
function fieldScene(w, h) {
  const g = new Grid(w, h, P.paper);
  const crowdTop = Math.floor(h * 0.18), grassTop = Math.floor(h * 0.42);

  // crowd: banded dark strip with random head-dots
  g.rect(0, crowdTop, w - 1, grassTop - 1, "#4a4048");
  const rng = mulberry(7);
  for (let y = crowdTop + 1; y < grassTop; y += 1)
    for (let x = 0; x < w; x++)
      if (rng() < 0.28) g.px(x, y, ["#6b5c48", "#9d8c74", "#8a4e3a", "#7f9e78", "#d9a441"][Math.floor(rng() * 5)]);

  // grass with mow stripes
  for (let x = 0; x < w; x++) {
    const band = Math.floor(x / 8) % 2;
    g.rect(x, grassTop, x, h - 1, band ? P.grass : P.grassDark);
  }
  // boundary line
  g.rect(0, grassTop + 2, w - 1, grassTop + 2, P.paper2);

  // goal posts (AFL: two tall, two short) at each end
  const posts = (x0) => {
    g.rect(x0, crowdTop - 6, x0, grassTop + 4, P.paper2);        // short behind
    g.rect(x0 + 3, crowdTop - 12, x0 + 3, grassTop + 4, P.white); // tall goal
    g.rect(x0 + 6, crowdTop - 12, x0 + 6, grassTop + 4, P.white);
    g.rect(x0 + 9, crowdTop - 6, x0 + 9, grassTop + 4, P.paper2);
  };
  posts(4); posts(w - 14);

  // the ball, mid-air, sailing toward the left goal
  const bx = Math.floor(w * 0.135), by = Math.max(2, crowdTop - 8);
  g.ellipse(bx, by, 4, 2, P.red);
  g.rect(bx - 2, by, bx + 2, by, P.white);
  g.px(bx - 1, by - 1, P.white); g.px(bx + 1, by + 1, P.white);

  return g;
}

/* ---------- build everything -------------------------------- */
mkdirSync("public/icons", { recursive: true });
mkdirSync("public/art", { recursive: true });

const icons = {
  footy: iconFooty(), horse: iconHorse(), gift: iconGift(), car: iconCar(),
  wolf: iconWolf(), pot: iconPot(), card: iconCard(), trophy: iconTrophy(),
  rattle: iconRattle(), clipboard: iconClipboard(), bubbles: iconBubbles(),
};
for (const [name, g] of Object.entries(icons)) g.toPng(`public/icons/${name}.png`, 8);

/* hero: wide field scene */
fieldScene(112, 32).toPng("public/art/sweep-hero.png", 10);

/* og-sweep: 1200×630 = 120×63 grid @ 10 */
{
  const g = new Grid(120, 63, P.paper);
  g.blit(fieldScene(120, 34), 0, 29, 1);
  drawText(g, Math.floor((120 - textWidth("GRAND FINAL", 2)) / 2), 4, "GRAND FINAL", P.ink, 2);
  drawText(g, Math.floor((120 - textWidth("SWEEP", 2)) / 2), 15, "SWEEP", P.terraDark, 2);
  const t2 = "FREE - NO SIGNUP";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 26, t2, P.inkSoft, 1);
  // wordmark blocks bottom-left
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-sweep.png", 10);
}

/* og-home: wordmark + icon row */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "BITIBYBIT.COM";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 9, t1, P.ink, 2);
  const t2 = "SMALL FREE TOOLS FOR GROUPS";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 26, t2, P.inkSoft, 1);
  const row = ["footy", "gift", "car", "wolf", "pot", "card"];
  const iw = 16, gap = 2, total = row.length * (iw + gap) - gap;
  let x = Math.floor((120 - total) / 2);
  for (const name of row) { g.blit(icons[name], x, 38, 1); x += iw + gap; }
  g.toPng("public/art/og-home.png", 10);
}

console.log("done");
