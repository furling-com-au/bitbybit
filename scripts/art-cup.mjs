/* ============================================================
   Melbourne Cup sweep art: OG image + hero scene.
   Run:  node scripts/art-cup.mjs
   Technique follows gen-art.mjs (fieldScene) — racetrack flavour:
   sky, grandstand crowd band, white running rail, turf, three
   horses at full gallop, red-and-white finish post.
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P, mulberry } from "./pixel-lib.mjs";

/* ---------- one galloping horse + jockey (14×10) ------------ */
function horse(g, x, y, body, dark, silk) {
  const skin = "#e2b184";
  // barrel, neck, head — facing right
  g.rect(x + 2, y + 4, x + 9, y + 6, body);
  g.rect(x + 8, y + 3, x + 10, y + 4, body);
  g.rect(x + 10, y + 2, x + 12, y + 3, body);
  g.px(x + 13, y + 3, body);                          // muzzle
  g.px(x + 11, y + 1, dark);                          // ear
  g.px(x + 12, y + 2, P.ink);                         // eye
  g.px(x + 10, y + 2, dark); g.px(x + 9, y + 3, dark); // mane
  // tail, streaming
  g.px(x, y + 4, dark); g.px(x, y + 5, dark); g.px(x + 1, y + 5, dark);
  // legs — full gallop stretch
  g.px(x + 2, y + 7, dark); g.px(x + 1, y + 8, dark); g.px(x, y + 9, dark);      // hind, swept back
  g.px(x + 3, y + 7, dark); g.px(x + 3, y + 8, dark);                             // hind, under
  g.px(x + 8, y + 7, dark); g.px(x + 8, y + 8, dark);                             // fore, under
  g.px(x + 9, y + 7, dark); g.px(x + 10, y + 8, dark); g.px(x + 11, y + 9, dark); // fore, reaching
  // jockey — crouched low over the shoulders
  g.rect(x + 4, y + 1, x + 5, y + 3, silk);           // torso
  g.px(x + 6, y + 2, silk); g.px(x + 7, y + 2, silk); // arms to the reins
  g.px(x + 6, y + 1, skin);                           // face
  g.rect(x + 4, y, x + 6, y, silk);                   // cap
}

/* ---------- racetrack scene --------------------------------- */
function cupScene(w, h) {
  const g = new Grid(w, h, P.sky);
  const standTop = Math.floor(h * 0.16);
  const trackTop = Math.floor(h * 0.42);

  // grandstand: white roofline, then the crowd band
  g.rect(0, standTop, w - 1, standTop + 1, P.white);
  g.rect(0, standTop + 2, w - 1, trackTop - 2, "#4a4048");
  const rng = mulberry(11);
  for (let y = standTop + 3; y <= trackTop - 2; y++)
    for (let x = 0; x < w; x++)
      if (rng() < 0.28) g.px(x, y, ["#6b5c48", "#9d8c74", "#8a4e3a", "#7f9e78", "#d9a441"][Math.floor(rng() * 5)]);

  // white running rail along the top of the track
  g.rect(0, trackTop - 1, w - 1, trackTop - 1, P.white);

  // turf with mow stripes
  for (let x = 0; x < w; x++) {
    const band = Math.floor(x / 8) % 2;
    g.rect(x, trackTop, x, h - 1, band ? P.grass : P.grassDark);
  }
  for (let x = 4; x < w; x += 9) g.px(x, trackTop, P.white); // rail post feet

  // finish post, red and white, on the right
  const fx = w - Math.max(10, Math.floor(w * 0.09));
  const top = trackTop - 5, bot = h - 3;
  for (let yy = top; yy <= bot; yy++) {
    const c = Math.floor((yy - top) / 2) % 2 ? P.white : P.red;
    g.rect(fx, yy, fx + 1, yy, c);
  }
  g.disc(fx, top - 2, 2, P.red);

  // the field, at full stretch toward the post
  horse(g, Math.floor(w * 0.26), trackTop + 1, "#8d8699", "#565064", P.plum); // grey, plum silks
  horse(g, Math.floor(w * 0.44), trackTop + 4, "#9a6b42", "#6f4a2f", P.red);  // bay, red silks
  horse(g, Math.floor(w * 0.62), trackTop + 7, "#8a6d4f", "#5d4832", P.gold); // brown, gold silks — leading
  return g;
}

/* ---------- build ------------------------------------------- */
mkdirSync("public/art", { recursive: true });

/* hero: wide track scene */
cupScene(112, 32).toPng("public/art/cup-hero.png", 10);

/* og-cup: 1200×630 = 120×63 grid @ 10 */
{
  const g = new Grid(120, 63, P.paper);
  g.blit(cupScene(120, 30), 0, 33, 1);
  drawText(g, Math.floor((120 - textWidth("MELBOURNE CUP", 2)) / 2), 4, "MELBOURNE CUP", P.ink, 2);
  drawText(g, Math.floor((120 - textWidth("SWEEP", 2)) / 2), 15, "SWEEP", P.terraDark, 2);
  const t2 = "FREE - NO SIGNUP";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 26, t2, P.inkSoft, 1);
  // wordmark blocks bottom-left
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BIT BY BIT", P.inkSoft, 1);
  g.toPng("public/art/og-cup.png", 10);
}

console.log("done");
