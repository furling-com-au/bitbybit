/* ============================================================
   Generates every pixel-art asset from declarative shapes:
     public/icons/*.png       shelf icons (16×16 grid @ 8×)
     public/art/sweep-hero.png  footy field scene
     public/art/og-sweep.png    1200×630 link preview
     public/art/og-home.png     1200×630 link preview
   Run:  node scripts/gen-art.mjs
   ============================================================ */
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

/* ---------- tiny PNG encoder -------------------------------- */
function crc32(buf) {
  let c, t = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(path, w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]));
  console.log("wrote", path, `${w}x${h}`);
}

/* ---------- pixel canvas ------------------------------------ */
const hex = (s) => {
  const h = s.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
};
class Grid {
  constructor(w, h, bg = null) {
    this.w = w; this.h = h;
    this.cells = new Array(w * h).fill(bg); // null = transparent
  }
  px(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cells[y * this.w + x] = c;
  }
  rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, c); }
  disc(cx, cy, r, c) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.35) this.px(x, y, c);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++)
      if ((x - cx) ** 2 / (rx * rx) + (y - cy) ** 2 / (ry * ry) <= 1.15) this.px(x, y, c);
  }
  blit(g, ox, oy, scale = 1) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const c = g.cells[y * g.w + x];
      if (c) this.rect(ox + x * scale, oy + y * scale, ox + (x + 1) * scale - 1, oy + (y + 1) * scale - 1, c);
    }
  }
  toPng(path, scale) {
    const W = this.w * scale, H = this.h * scale;
    const buf = Buffer.alloc(W * H * 4, 0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = this.cells[Math.floor(y / scale) * this.w + Math.floor(x / scale)];
      if (!c) continue;
      const rgba = hex(c);
      const o = (y * W + x) * 4;
      buf[o] = rgba[0]; buf[o + 1] = rgba[1]; buf[o + 2] = rgba[2]; buf[o + 3] = 255;
    }
    writePng(path, W, H, buf);
  }
}

/* ---------- 3×5 pixel font ---------------------------------- */
const FONT = {
  A:"010,101,111,101,101", B:"110,101,110,101,110", C:"011,100,100,100,011",
  D:"110,101,101,101,110", E:"111,100,110,100,111", F:"111,100,110,100,100",
  G:"011,100,101,101,011", H:"101,101,111,101,101", I:"111,010,010,010,111",
  J:"001,001,001,101,010", K:"101,110,100,110,101", L:"100,100,100,100,111",
  M:"10001,11011,10101,10001,10001", N:"110,101,101,101,101", O:"010,101,101,101,010",
  P:"110,101,110,100,100", Q:"010,101,101,011,001", R:"110,101,110,110,101",
  S:"011,100,010,001,110", T:"111,010,010,010,010", U:"101,101,101,101,111",
  V:"101,101,101,101,010", W:"10001,10001,10101,10101,01010", X:"101,101,010,101,101",
  Y:"101,101,010,010,010", Z:"111,001,010,100,111",
  "0":"010,101,101,101,010","1":"010,110,010,010,111","2":"110,001,010,100,111",
  "3":"110,001,010,001,110","4":"101,101,111,001,001","5":"111,100,110,001,110",
  "6":"011,100,110,101,010","7":"111,001,010,010,010","8":"010,101,010,101,010",
  "9":"010,101,011,001,110",
  "-":"000,000,111,000,000", ".":"000,000,000,000,010", " ":"000,000,000,000,000",
};
function drawText(grid, x, y, text, colour, scale = 1) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const rows = (FONT[ch] || FONT[" "]).split(",");
    rows.forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit === "1")
          grid.rect(cx + rx * scale, y + ry * scale, cx + (rx + 1) * scale - 1, y + (ry + 1) * scale - 1, colour);
      });
    });
    cx += (rows[0].length + 1) * scale;
  }
  return cx - x - scale; // width drawn
}
const textWidth = (t, scale = 1) =>
  [...t.toUpperCase()].reduce((w, ch) => w + ((FONT[ch] || FONT[" "]).split(",")[0].length + 1) * scale, 0) - scale;

/* ---------- palette ----------------------------------------- */
const P = {
  paper: "#f4ead8", paper2: "#ece0c9", paper3: "#e2d3b6",
  ink: "#3d3428", inkSoft: "#6b5c48", line: "#cbb894",
  sage: "#7f9e78", sageDark: "#4b6647",
  terra: "#b8735a", terraDark: "#8a4e3a",
  gold: "#d9a441", sky: "#a9cdd8", plum: "#9d6880",
  grass: "#6f9862", grassDark: "#55794b",
  red: "#a63a2b", redDark: "#7e2b20", white: "#f6f1e4",
  grey: "#8d8699", greyDark: "#565064", brown: "#8a6d4f", brownDark: "#5d4832",
};

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
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- build everything -------------------------------- */
mkdirSync("public/icons", { recursive: true });
mkdirSync("public/art", { recursive: true });

const icons = {
  footy: iconFooty(), horse: iconHorse(), gift: iconGift(), car: iconCar(),
  wolf: iconWolf(), pot: iconPot(), card: iconCard(), trophy: iconTrophy(),
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
  drawText(g, 10, 57, "BIT BY BIT", P.inkSoft, 1);
  g.toPng("public/art/og-sweep.png", 10);
}

/* og-home: wordmark + icon row */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "BIT BY BIT";
  drawText(g, Math.floor((120 - textWidth(t1, 3)) / 2), 8, t1, P.ink, 3);
  const t2 = "SMALL FREE TOOLS FOR GROUPS";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 26, t2, P.inkSoft, 1);
  const row = ["footy", "gift", "car", "wolf", "pot", "card"];
  const iw = 16, gap = 2, total = row.length * (iw + gap) - gap;
  let x = Math.floor((120 - total) / 2);
  for (const name of row) { g.blit(icons[name], x, 38, 1); x += iw + gap; }
  g.toPng("public/art/og-home.png", 10);
}

console.log("done");
