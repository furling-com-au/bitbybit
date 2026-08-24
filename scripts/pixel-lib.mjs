/* ============================================================
   Shared pixel-art toolkit: PNG encoder, grid canvas, 3x5 font,
   palette. Tool art scripts import from here.
   ============================================================ */
import { writeFileSync } from "node:fs";
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
export function writePng(path, w, h, rgba) {
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
export class Grid {
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
export const FONT = {
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
export function drawText(grid, x, y, text, colour, scale = 1) {
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
export const textWidth = (t, scale = 1) =>
  [...t.toUpperCase()].reduce((w, ch) => w + ((FONT[ch] || FONT[" "]).split(",")[0].length + 1) * scale, 0) - scale;

/* ---------- palette ----------------------------------------- */
export const P = {
  paper: "#f4ead8", paper2: "#ece0c9", paper3: "#e2d3b6",
  ink: "#3d3428", inkSoft: "#6b5c48", line: "#cbb894",
  sage: "#7f9e78", sageDark: "#4b6647",
  terra: "#b8735a", terraDark: "#8a4e3a",
  gold: "#d9a441", sky: "#a9cdd8", plum: "#9d6880",
  grass: "#6f9862", grassDark: "#55794b",
  red: "#a63a2b", redDark: "#7e2b20", white: "#f6f1e4",
  grey: "#8d8699", greyDark: "#565064", brown: "#8a6d4f", brownDark: "#5d4832",
};


export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
