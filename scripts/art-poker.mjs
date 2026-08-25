/* ============================================================
   Scrum Poker — OG image + shelf icon.

   A row of cards face down with one turned over showing an 8. The
   picture has to carry the mechanic, not the ceremony: the interesting
   thing about planning poker is that most of the table is still hidden
   at the moment one card lands, so the composition is mostly backs.
   Run:  node scripts/art-poker.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

mkdirSync("public/art", { recursive: true });
mkdirSync("public/icons", { recursive: true });

/* A face-down card: paper with a darker border and a small centred
   motif, so a row of them reads as patterned rather than blank. */
function back(g, x, y, w, h, tilt) {
  const t = tilt || 0;
  g.rect(x, y + t, x + w, y + h + t, P.paper3);
  g.rect(x, y + t, x + w, y + t, P.line);
  g.rect(x, y + h + t, x + w, y + h + t, P.line);
  g.rect(x, y + t, x, y + h + t, P.line);
  g.rect(x + w, y + t, x + w, y + h + t, P.line);
  // three dots down the middle: a back pattern, not a value
  const mx = x + Math.round(w / 2);
  const my = y + Math.round(h / 2) + t;
  g.px(mx, my - 3, P.line);
  g.px(mx, my, P.line);
  g.px(mx, my + 3, P.line);
}

/* The one that has been turned over. Sage, because that is the site's
   "this is decided" colour, and it is the only saturated block in the
   picture so the eye lands on it. */
function face(g, x, y, w, h, label) {
  g.rect(x, y, x + w, y + h, P.sageDark);
  g.rect(x, y, x + w, y, P.ink);
  g.rect(x, y + h, x + w, y + h, P.ink);
  g.rect(x, y, x, y + h, P.ink);
  g.rect(x + w, y, x + w, y + h, P.ink);
  const tw = textWidth(label, 1);
  drawText(g, x + Math.round((w - tw) / 2) + 1, y + Math.round(h / 2) - 2, label, P.white, 1);
}

function table(w, h) {
  const g = new Grid(w, h, null);
  const mid = Math.floor(w / 2);
  const cw = 13, ch = 19;
  const baseY = Math.round((h - ch) / 2);

  // four backs and one face, the face slightly raised so it reads as
  // just having been played
  back(g, mid - 38, baseY, cw, ch, 1);
  back(g, mid - 22, baseY, cw, ch, 0);
  face(g, mid - 6, baseY - 2, cw, ch, "8");
  back(g, mid + 10, baseY, cw, ch, 0);
  back(g, mid + 26, baseY, cw, ch, 1);

  // the table edge under them
  g.rect(mid - 44, baseY + ch + 4, mid + 44, baseY + ch + 4, P.line);
  return g;
}

/* ---------- og image ----------------------------------------- */
{
  const g = new Grid(120, 63, P.paper);
  g.rect(0, 0, 119, 0, P.line);
  g.rect(0, 62, 119, 62, P.line);

  const title = "SCRUM POKER";
  drawText(g, Math.round((120 - textWidth(title, 1)) / 2), 5, title, P.ink, 1);
  const sub = "EVERYONE REVEALS AT ONCE";
  drawText(g, Math.round((120 - textWidth(sub, 1)) / 2), 13, sub, P.inkSoft, 1);

  g.blit(table(120, 38), 0, 19, 1);

  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-poker.png", 10);
}

/* ---------- page hero ---------------------------------------- */
{
  const g = new Grid(140, 40, P.paper2);
  g.rect(0, 0, 139, 0, P.line);
  g.rect(0, 39, 139, 39, P.line);
  g.blit(table(140, 36), 0, 2, 1);
  g.toPng("public/art/poker-hero.png", 8);
}

/* ---------- shelf icon --------------------------------------- */
{
  const g = new Grid(28, 28, null);
  back(g, 2, 5, 9, 14, 1);
  back(g, 13, 4, 9, 14, 0);
  face(g, 8, 9, 11, 16, "8");
  g.toPng("public/icons/poker.png", 2);
}

console.log("done");
