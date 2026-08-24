/* ============================================================
   Art for the Secret Role Dealer: OG image + hero.
   Run:  node scripts/art-roles.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P, mulberry } from "./pixel-lib.mjs";

const N = {
  skyHi: "#171322", sky: "#241f2b", skyLo: "#302940",
  roof: "#141019", star: "#cbb894", starDim: "#6b5f7a",
  moon: "#d9a441", crater: "#b5852f", window: "#e8b95a", windowWarm: "#d9a441",
};

/* Wolf silhouette, howling up-right; (x, y) = left edge, feet row. */
function wolf(g, x, y, c) {
  g.px(x + 1, y, c); g.px(x + 5, y, c);          // legs
  g.rect(x, y - 2, x + 6, y - 1, c);             // body
  g.px(x - 1, y - 2, c); g.px(x - 2, y - 3, c);  // tail, curling up
  g.rect(x + 5, y - 4, x + 6, y - 3, c);         // chest and neck
  g.rect(x + 6, y - 5, x + 7, y - 4, c);         // head, tipped back
  g.px(x + 8, y - 6, c);                         // snout, mid-howl
  g.px(x + 5, y - 5, c);                         // ear
}

/* Night village: banded sky, stars, gold moon with craters, dark
   rooftops with a few warm windows, one wolf on a flat roof in
   front of the moon. */
function nightScene(w, h) {
  const g = new Grid(w, h, N.sky);
  const rng = mulberry(23);

  // banded sky
  g.rect(0, 0, w - 1, Math.floor(h * 0.3), N.skyHi);
  g.rect(0, Math.floor(h * 0.72), w - 1, h - 1, N.skyLo);

  // stars, kept clear of the village at the bottom
  for (let i = 0; i < Math.floor((w * h) / 34); i++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h * 0.62);
    g.px(x, y, rng() < 0.3 ? N.star : N.starDim);
  }

  // the moon
  const mr = Math.max(6, Math.round(h * 0.27));
  const mx = Math.floor(w * 0.73), my = Math.round(h * 0.34);
  g.disc(mx, my, mr, N.moon);
  g.disc(mx - Math.round(mr * 0.35), my - Math.round(mr * 0.3), Math.max(1, Math.round(mr * 0.22)), N.crater);
  g.disc(mx + Math.round(mr * 0.4), my + Math.round(mr * 0.35), Math.max(1, Math.round(mr * 0.16)), N.crater);
  g.px(mx + 2, my - mr + 2, N.crater);

  // rooftop silhouettes along the bottom (gap left for the wolf's roof)
  const roofTop = my + mr + 1;
  let x = 0, windows = 0;
  while (x < w) {
    if (x > mx - 12 && x < mx + 11) { x = mx + 11; continue; }
    const bw = 7 + Math.floor(rng() * 9);
    const bh = 5 + Math.floor(rng() * Math.max(4, Math.floor(h * 0.22)));
    const top = h - bh;
    const x1 = Math.min(x + bw - 1, w - 1);
    g.rect(x, top, x1, h - 1, N.roof);
    if (rng() < 0.55) {                            // gable
      const cx = Math.floor((x + x1) / 2);
      g.rect(Math.max(x + 1, cx - 2), top - 1, Math.min(x1 - 1, cx + 2), top - 1, N.roof);
      g.rect(cx - 1, top - 2, cx + 1, top - 2, N.roof);
      g.px(cx, top - 3, N.roof);
    }
    if (rng() < 0.4) g.rect(x + 2, top - 3, x + 3, top - 1, N.roof); // chimney
    if (windows < 5 && bh > 6 && rng() < 0.55) {   // a warm lit window
      const wx = x + 2 + Math.floor(rng() * Math.max(1, bw - 5));
      g.rect(wx, top + 2, wx + 1, top + 3, rng() < 0.5 ? N.window : N.windowWarm);
      windows++;
    }
    x += bw + 1 + Math.floor(rng() * 2);
  }

  // the wolf's flat rooftop, under the moon, with one lit window
  g.rect(mx - 10, roofTop, mx + 10, h - 1, N.roof);
  g.rect(mx + 7, roofTop - 3, mx + 8, roofTop - 1, N.roof);   // chimney
  g.rect(mx - 6, roofTop + 3, mx - 5, roofTop + 4, N.window);
  wolf(g, mx - 4, roofTop - 1, N.roof);

  return g;
}

mkdirSync("public/art", { recursive: true });

/* hero: wide, shallow night scene (1120x320) */
nightScene(112, 32).toPng("public/art/roles-hero.png", 10);

/* og-roles: 1200x630 = 120x63 grid @ 10 */
{
  const g = new Grid(120, 63, P.paper);
  g.blit(nightScene(120, 32), 0, 31, 1);
  drawText(g, Math.floor((120 - textWidth("SECRET ROLE", 2)) / 2), 4, "SECRET ROLE", P.ink, 2);
  drawText(g, Math.floor((120 - textWidth("DEALER", 2)) / 2), 15, "DEALER", P.terraDark, 2);
  const t2 = "ONE LINK - EVERY ROLE PRIVATE";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 26, t2, P.inkSoft, 1);
  // wordmark blocks bottom-left, over the night scene
  g.rect(3, 57, 4, 58, P.sage); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.line, 1);
  g.toPng("public/art/og-roles.png", 10);
}

console.log("done");
