/* ============================================================
   Coffee Roulette — OG image + shelf icon.

   Two mugs facing each other across a small table, steam rising
   and crossing between them. The whole idea of the tool is two
   people who did not choose each other ending up at the same
   table, so the composition is deliberately symmetrical — same
   mug, same size, neither one in front.
   Run:  node scripts/art-coffee.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P, mulberry } from "./pixel-lib.mjs";

mkdirSync("public/art", { recursive: true });
mkdirSync("public/icons", { recursive: true });

const CREMA = "#c08a5a";      // the coffee surface
const CREMA_DK = "#8a5f37";
const RIM_HI = "#f6f1e4";

/* A mug: body, handle, rim highlight and the coffee inside. */
function mug(g, cx, base, body, dark, flip) {
  const w = 5;                                  // half-width
  g.rect(cx - w, base - 7, cx + w, base, body); // body
  g.rect(cx - w, base - 7, cx + w, base - 6, RIM_HI); // rim
  g.rect(cx - w + 1, base - 6, cx + w - 1, base - 5, CREMA);
  g.rect(cx - w + 1, base - 5, cx + w - 1, base - 5, CREMA_DK);
  g.rect(cx - w, base, cx + w, base, dark);     // shadowed foot
  /* Handle, on the outward side so the two mugs mirror each other.
     A handle only reads as a handle if the hole is visible, so this
     is an explicit C over three columns rather than a thick stub:
         XXX      top bar
         ..X      outer edge, hole to its left
         ..X
         XXX      bottom bar                                        */
  const d = flip ? -1 : 1;
  const c1 = cx + d * (w + 1);
  const c3 = cx + d * (w + 3);
  const [lo, hi] = c1 < c3 ? [c1, c3] : [c3, c1];
  g.rect(lo, base - 6, hi, base - 6, body);   // top bar
  g.rect(lo, base - 2, hi, base - 2, body);   // bottom bar
  g.rect(c3, base - 5, c3, base - 3, body);   // outer edge
  g.px(c3, base - 6, dark);                   // corners, so it turns
  g.px(c3, base - 2, dark);
}

/* Steam: two wavering columns that lean toward each other and meet. */
function steam(g, x, top, height, lean, c) {
  for (let i = 0; i < height; i++) {
    const y = top - i;
    const wob = Math.round(Math.sin(i * 0.9) * 1.2);
    g.px(x + wob + Math.round((i * lean) / 3), y, c);
  }
}

function scene(w, h) {
  const g = new Grid(w, h, null);
  const rng = mulberry(7);
  const base = h - 9;
  const midx = Math.floor(w / 2);

  // table: a plain slab with a lit top edge, no legs — it reads as a
  // surface rather than furniture at this size
  g.rect(midx - 26, base + 1, midx + 26, base + 4, P.brown);
  g.rect(midx - 26, base + 1, midx + 26, base + 1, "#a98a68");
  g.rect(midx - 26, base + 5, midx + 26, base + 5, P.brownDark);

  mug(g, midx - 12, base, P.sage, P.sageDark, true);
  mug(g, midx + 12, base, P.terra, P.terraDark, false);

  steam(g, midx - 12, base - 9, 9, 1.6, P.line);
  steam(g, midx + 12, base - 9, 9, -1.6, P.line);
  // where the two columns meet
  g.px(midx, base - 17, P.paper3);
  g.px(midx - 1, base - 16, P.paper3);
  g.px(midx + 1, base - 16, P.paper3);

  // a few crumbs on the table, because nobody has a clean desk
  for (let i = 0; i < 5; i++)
    g.px(midx - 20 + Math.floor(rng() * 40), base + 2 + Math.floor(rng() * 2), P.paper3);

  return g;
}

/* ---------- og image ----------------------------------------- */
{
  const g = new Grid(120, 63, P.paper);
  g.rect(0, 0, 119, 0, P.line);
  g.rect(0, 62, 119, 62, P.line);

  const title = "COFFEE ROULETTE";
  drawText(g, Math.round((120 - textWidth(title, 1)) / 2), 5, title, P.ink, 1);
  const sub = "A NEW PAIRING EVERY ROUND";
  drawText(g, Math.round((120 - textWidth(sub, 1)) / 2), 13, sub, P.inkSoft, 1);

  g.blit(scene(120, 32), 0, 21, 1);

  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-coffee.png", 10);
}

/* ---------- shelf icon --------------------------------------- */
{
  const g = new Grid(28, 28, null);
  const base = 20;
  mug(g, 9, base, P.sage, P.sageDark, true);
  mug(g, 19, base, P.terra, P.terraDark, false);
  g.rect(1, base + 1, 26, base + 3, P.brown);
  g.rect(1, base + 1, 26, base + 1, "#a98a68");
  steam(g, 9, base - 9, 6, 1.4, P.line);
  steam(g, 19, base - 9, 6, -1.4, P.line);
  g.toPng("public/icons/coffee.png", 2);
}

console.log("done");
