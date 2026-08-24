/* ============================================================
   Pixel Gift Registry — OG image + hero art.
   The finished pixel Prado, rendered from the same declarative
   shape tables the live tool uses (duplicated here on purpose —
   art scripts are standalone).
   Run:  node scripts/art-registry.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

/* ---------- the Prado, 68x34, fully funded ------------------- */

const PAL = {
  engine: { base: "#d98f4a", dark: "#a8632c", light: "#f0b46e" },
  chassis: { base: "#6b6577", dark: "#464150", light: "#8d8699" },
  wheels: { tyre: "#3b3540", rim: "#c9bda9", hub: "#241f2a" },
  body: { base: "#7f9e78", dark: "#4b6647", glass: "#a9cdd8", grille: "#3f3a48" },
  interior: { base: "#b8735a", dark: "#8a4e3a", light: "#d69a80" },
  electrical: { base: "#f7d774", dark: "#dfa73a", red: "#e07a5f" },
  touring: {
    base: "#8a6d4f", dark: "#5d4832", light: "#a98a68",
    hot: "#e08a3c", canvas: "#cbb68e", lamp: "#f2d98a", steel: "#5f7a84",
  },
  luxuries: { base: "#c98fa8", dark: "#9d6880", mud: "#4a4048", plate: "#e8e0cc" },
};

const CAR_W = 68;
const CAR_H = 34;

/* Draw order matters: later shapes paint over earlier ones —
   that's what makes the cutaway. */
const SHAPES = [
  { g: "chassis", t: "base", ops: [["rect", 10, 25, 58, 26]] },
  { g: "chassis", t: "dark", ops: [["rect", 23, 26, 25, 27], ["rect", 41, 26, 43, 27]] },

  { g: "body", t: "base", ops: [["rect", 8, 13, 61, 24]] },
  { g: "body", t: "base", ops: [
    ["span", 5, 10, 38], ["span", 6, 10, 39], ["span", 7, 10, 40], ["span", 8, 10, 41],
    ["span", 9, 10, 42], ["span", 10, 10, 43], ["span", 11, 10, 44], ["span", 12, 10, 45],
  ]},
  { g: "body", t: "base", ops: [["rect", 11, 4, 37, 4]] },

  { g: "body", t: "glass", ops: [
    ["rect", 12, 6, 17, 11], ["rect", 20, 6, 26, 11], ["rect", 29, 6, 35, 11],
    ["span", 6, 37, 38], ["span", 7, 37, 39], ["span", 8, 38, 40],
    ["span", 9, 39, 41], ["span", 10, 40, 42], ["span", 11, 41, 43],
  ]},

  { g: "interior", t: "base", ops: [
    ["rect", 14, 7, 16, 13], ["rect", 12, 13, 17, 13],
    ["rect", 22, 7, 24, 13], ["rect", 20, 13, 25, 13],
    ["rect", 30, 7, 32, 13], ["rect", 28, 13, 33, 13],
  ]},
  { g: "interior", t: "light", ops: [["rect", 34, 8, 35, 12]] },
  { g: "interior", t: "dark", ops: [["rect", 36, 12, 43, 13], ["rect", 37, 14, 40, 16]] },
  { g: "interior", t: "base", ops: [["rect", 41, 14, 43, 16]] },

  { g: "touring", t: "steel", ops: [["rect", 12, 14, 15, 17]] },
  { g: "luxuries", t: "base", ops: [["rect", 16, 14, 19, 17]] },

  { g: "engine", t: "base", ops: [["rect", 48, 14, 54, 17]] },
  { g: "engine", t: "light", ops: [["rect", 46, 15, 47, 17]] },
  { g: "engine", t: "dark", ops: [["rect", 55, 14, 57, 17]] },
  { g: "engine", t: "dark", ops: [["rect", 39, 20, 44, 23]] },
  { g: "engine", t: "base", ops: [["rect", 31, 22, 38, 23]] },
  { g: "engine", t: "light", ops: [["rect", 25, 20, 30, 24]] },

  { g: "wheels", t: "tyre", ops: [["disc", 18, 24, 6], ["disc", 51, 24, 6], ["disc", 4, 18, 4]] },
  { g: "wheels", t: "rim", ops: [["disc", 18, 24, 3], ["disc", 51, 24, 3], ["disc", 4, 18, 2]] },
  { g: "chassis", t: "light", ops: [["disc", 18, 24, 2], ["disc", 51, 24, 2]] },
  { g: "wheels", t: "hub", ops: [["disc", 18, 24, 1], ["disc", 51, 24, 1]] },

  { g: "body", t: "dark", ops: [
    ["rect", 11, 14, 11, 24], ["rect", 19, 14, 19, 24],
    ["rect", 28, 14, 28, 24], ["rect", 36, 14, 36, 19],
    ["arch", 18, 24, 7], ["arch", 51, 24, 7],
  ]},
  { g: "body", t: "grille", ops: [["rect", 58, 17, 61, 21]] },

  { g: "electrical", t: "base", ops: [["rect", 58, 13, 61, 16]] },
  { g: "electrical", t: "dark", ops: [["rect", 58, 22, 61, 23]] },
  { g: "electrical", t: "red", ops: [["rect", 8, 14, 10, 17]] },
  { g: "electrical", t: "dark", ops: [["rect", 8, 18, 10, 19]] },
  { g: "electrical", t: "base", ops: [["rect", 46, 13, 47, 14]] },
  { g: "electrical", t: "dark", ops: [["rect", 6, 13, 8, 14]] },

  { g: "touring", t: "dark", ops: [["rect", 12, 2, 37, 3], ["rect", 9, 2, 12, 3]] },
  { g: "touring", t: "canvas", ops: [["rect", 13, 0, 26, 1]] },
  { g: "touring", t: "hot", ops: [["rect", 28, 1, 32, 1]] },
  { g: "touring", t: "lamp", ops: [["rect", 34, 0, 37, 1]] },
  { g: "touring", t: "dark", ops: [["rect", 46, 4, 47, 12], ["rect", 44, 3, 47, 4]] },
  { g: "touring", t: "dark", ops: [
    ["rect", 59, 11, 65, 12], ["rect", 62, 12, 65, 26], ["rect", 57, 25, 65, 27],
    ["rect", 2, 24, 10, 26],
    ["rect", 60, 5, 60, 11],
  ]},
  { g: "touring", t: "light", ops: [["rect", 62, 18, 64, 21]] },

  { g: "luxuries", t: "mud", ops: [["rect", 9, 26, 11, 29], ["rect", 42, 26, 44, 29]] },
  { g: "luxuries", t: "plate", ops: [["rect", 62, 22, 65, 24]] },
  { g: "luxuries", t: "base", ops: [["rect", 5, 22, 8, 24]] },
  { g: "luxuries", t: "mud", ops: [["rect", 40, 11, 44, 11], ["rect", 55, 12, 61, 12]] },
];

function rasterise() {
  const grid = new Array(CAR_W * CAR_H).fill(null);
  const put = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < CAR_W && y < CAR_H) grid[y * CAR_W + x] = c;
  };
  for (const shape of SHAPES) {
    const colour = PAL[shape.g][shape.t];
    for (const op of shape.ops) {
      const kind = op[0];
      if (kind === "rect") {
        for (let y = op[2]; y <= op[4]; y++) for (let x = op[1]; x <= op[3]; x++) put(x, y, colour);
      } else if (kind === "span") {
        for (let x = op[2]; x <= op[3]; x++) put(x, op[1], colour);
      } else if (kind === "disc") {
        const [, cx, cy, r] = op;
        for (let y = cy - r; y <= cy + r; y++)
          for (let x = cx - r; x <= cx + r; x++)
            if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.35) put(x, y, colour);
      } else if (kind === "arch") {
        const [, cx, cy, r] = op;
        for (let y = cy - r; y <= 24; y++)
          for (let x = cx - r; x <= cx + r; x++) {
            const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            if (d <= r + 0.4 && d > r - 0.9) put(x, y, colour);
          }
      }
    }
  }
  return grid;
}

const CAR = rasterise();

function blitPrado(g, ox, oy) {
  for (let y = 0; y < CAR_H; y++)
    for (let x = 0; x < CAR_W; x++) {
      const c = CAR[y * CAR_W + x];
      if (c) g.px(ox + x, oy + y, c);
    }
}

/* ---------- build -------------------------------------------- */
mkdirSync("public/art", { recursive: true });

/* hero: 112x36 @10 = 1120x360 — the Prado wide, on its floor */
{
  const g = new Grid(112, 36, P.paper);
  const floorY = 33;

  // floor + edge line
  g.rect(0, floorY, 111, 35, P.paper3);
  g.rect(0, floorY, 111, floorY, P.line);

  // a low afternoon sun and a couple of distant birds
  g.disc(101, 7, 4, P.gold);
  g.px(12, 8, P.inkSoft); g.px(13, 7, P.inkSoft); g.px(14, 8, P.inkSoft);
  g.px(22, 12, P.inkSoft); g.px(23, 11, P.inkSoft); g.px(24, 12, P.inkSoft);

  // the car, wheels on the floor line
  blitPrado(g, 22, 2);

  // a bit of ground shadow, dashed, just under the sills
  for (let x = 24; x <= 85; x++) {
    const edge = Math.min(x - 24, 85 - x);
    if (edge < 3 && x % 2) continue;
    g.px(x, 34, P.line);
  }

  g.toPng("public/art/registry-hero.png", 10);
}

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "PIXEL REGISTRY";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 4, t1, P.ink, 2);
  const t2 = "CLAIM A PART - BUILD THE GIFT";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 17, t2, P.terraDark, 1);

  // floor
  g.rect(0, 55, 119, 62, P.paper3);
  g.rect(0, 55, 119, 55, P.line);

  // the finished car, centred, wheels on the line
  blitPrado(g, 26, 24);

  // wordmark blocks bottom-left, on the clear stretch of floor
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-registry.png", 10);
}

console.log("done");
