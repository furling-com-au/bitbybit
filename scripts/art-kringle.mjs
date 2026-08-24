/* ============================================================
   Kris Kringle art: OG image + hero strip.
   Scene: deep evening sky, stars, a sagging string of fairy
   lights, and a row of wrapped presents along the bottom.
   Run:  node scripts/art-kringle.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P, mulberry } from "./pixel-lib.mjs";

const NIGHT = "#2b2d4a";   // deep evening sky
const WIRE = "#6b6e93";    // fairy-light wire, just visible against the sky

/* One wrapped present, sitting on baseY. */
function gift(g, x, baseY, w, h, box, lid, ribbon) {
  const top = baseY - h + 1;
  g.rect(x, top + 2, x + w - 1, baseY, box);            // the box
  g.rect(x - 1, top + 2, x + w, top + 3, lid);          // lid band, a touch wider
  const rx = x + (w >> 1);
  g.rect(rx, top + 2, rx, baseY, ribbon);               // ribbon
  g.rect(rx - 2, top, rx - 1, top + 1, ribbon);         // bow, left loop
  g.rect(rx + 1, top, rx + 2, top + 1, ribbon);         // bow, right loop
  g.px(rx, top + 1, lid);                               // knot
}

const GIFTS = [
  { w: 9, h: 8, box: P.terra, lid: P.terraDark, ribbon: P.gold },
  { w: 7, h: 6, box: P.sage, lid: P.sageDark, ribbon: P.red },
  { w: 10, h: 7, box: P.gold, lid: "#b5852f", ribbon: P.terraDark },
  { w: 6, h: 7, box: P.plum, lid: "#7d4e63", ribbon: P.gold },
  { w: 8, h: 6, box: P.red, lid: P.redDark, ribbon: P.gold },
  { w: 7, h: 8, box: P.sky, lid: "#7fa8b5", ribbon: P.terraDark },
];

function kringleScene(w, h, seed, giftStartX = 3) {
  const g = new Grid(w, h, NIGHT);
  const rng = mulberry(seed);
  const groundTop = h - 9;

  // stars — sparse, mostly white with the odd warm one
  for (let y = 0; y < groundTop - 2; y++)
    for (let x = 0; x < w; x++)
      if (rng() < 0.014)
        g.px(x, y, rng() < 0.7 ? P.white : (rng() < 0.5 ? P.gold : P.sky));

  // fairy lights — a wire sagging in scallops, bulbs alternating colour
  const span = 24, top = 3, depth = 5;
  const bulbs = [P.red, P.gold, P.sage, P.sky, P.terra, P.plum];
  let bulb = 0;
  for (let x = 0; x < w; x++) {
    const t = (x % span) / span;
    const y = top + Math.round(depth * Math.sin(Math.PI * t));
    g.px(x, y, WIRE);
    if (x % 4 === 2) g.px(x, y + 1, bulbs[bulb++ % bulbs.length]);
  }

  // ground — a pale strip (call it the tablecloth)
  g.rect(0, groundTop, w - 1, h - 1, P.paper2);
  g.rect(0, groundTop, w - 1, groundTop, P.paper);

  // the presents
  let x = giftStartX, i = 0;
  while (true) {
    const d = GIFTS[i % GIFTS.length];
    if (x + d.w > w - 3) break;
    gift(g, x, h - 3, d.w, d.h, d.box, d.lid, d.ribbon);
    x += d.w + 4 + Math.floor(rng() * 4);
    i++;
  }
  return g;
}

mkdirSync("public/art", { recursive: true });

/* og-kringle: 1200×630 = 120×63 grid @ 10 */
{
  const g = new Grid(120, 63, P.paper);
  // gifts start at x=48, leaving the bottom-left clear for the wordmark
  g.blit(kringleScene(120, 36, 12, 48), 0, 27, 1);
  const t1 = "KRIS KRINGLE";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 6, t1, P.red, 2);
  const t2 = "DRAW NAMES - NO EMAILS";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 19, t2, P.inkSoft, 1);
  // wordmark blocks bottom-left, on the pale strip
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-kringle.png", 10);
}

/* hero: wide, shallow variant of the same evening */
kringleScene(112, 32, 5).toPng("public/art/kringle-hero.png", 10);

console.log("done");
