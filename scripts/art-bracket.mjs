/* ============================================================
   Tournament Bracket — OG image + hero art.
   An abstract single-elim bracket: coloured player chips down
   the left, lines folding together left-to-right, and the gold
   cup waiting at the end of them.
   Run:  node scripts/art-bracket.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

const GOLD_DK = "#b5852f";

/* The shelf trophy, redrawn transparent so it sits on the scene. */
function trophy(g, ox, oy) {
  g.rect(ox + 4, oy + 2, ox + 11, oy + 8, P.gold);         // cup
  g.rect(ox + 2, oy + 3, ox + 3, oy + 6, P.gold);          // handles
  g.rect(ox + 12, oy + 3, ox + 13, oy + 6, P.gold);
  g.rect(ox + 3, oy + 4, ox + 3, oy + 5, P.paper);         // handle holes
  g.rect(ox + 12, oy + 4, ox + 12, oy + 5, P.paper);
  g.rect(ox + 6, oy + 9, ox + 9, oy + 10, GOLD_DK);        // stem
  g.rect(ox + 4, oy + 11, ox + 11, oy + 13, P.brownDark);  // base
  g.px(ox + 6, oy + 4, P.white);                           // glint
}

/* Eight leaves fold 8 -> 4 -> 2 -> 1, then a final stub runs into
   the trophy. chipH sets how chunky the player chips are. */
function bracketScene(w, h, { chipH = 1, confetti = false } = {}) {
  const g = new Grid(w, h, P.paper);
  const chipCols = [P.sage, P.terra, P.sky, P.plum, P.grass, P.gold, P.terraDark, P.sageDark];
  const hc = Math.floor(chipH / 2);
  const top = 1 + hc, bottom = h - 2 - hc;

  let cur = [];
  for (let i = 0; i < 8; i++)
    cur.push(Math.round(top + (i * (bottom - top)) / 7));
  cur.forEach((y, i) => g.rect(2, y - hc, 4, y + hc, chipCols[i]));

  const troX = w - 17;
  const cols = [0, 1, 2, 3].map((i) => Math.round(6 + ((troX - 12) * i) / 3));
  for (let r = 0; r < 3; r++) {
    const x0 = cols[r], x1 = cols[r + 1];
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      const ya = cur[i], yb = cur[i + 1];
      g.rect(x0, ya, x1, ya, P.inkSoft);     // the pair's horizontals
      g.rect(x0, yb, x1, yb, P.inkSoft);
      g.rect(x1, ya, x1, yb, P.inkSoft);     // joined at the fold
      next.push(Math.round((ya + yb) / 2));
    }
    cur = next;
  }

  const yF = cur[0];
  g.rect(cols[3], yF, troX - 1, yF, P.sageDark);           // the last walk
  trophy(g, troX, Math.max(0, yF - 7));

  if (confetti) {
    const bits = [[-5, -9, P.terra], [1, -12, P.plum], [7, -13, P.sky],
      [12, -11, P.gold], [16, -8, P.terra], [-3, -4, P.sage]];
    for (const [dx, dy, c] of bits) g.px(troX + dx, yF + dy, c);
  }
  return g;
}

/* ---------- build -------------------------------------------- */
mkdirSync("public/art", { recursive: true });

/* hero: 112x32 @10 = 1120x320 */
bracketScene(112, 32, { chipH: 3, confetti: true }).toPng("public/art/bracket-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "TOURNAMENT";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 3, t1, P.ink, 2);
  const t2 = "BRACKET";
  drawText(g, Math.floor((120 - textWidth(t2, 2)) / 2), 14, t2, P.terraDark, 2);
  const t3 = "FILL THE BRACKET";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 25, t3, P.inkSoft, 1);
  const t4 = "CROWN A CHAMP";
  drawText(g, Math.floor((120 - textWidth(t4, 1)) / 2), 31, t4, P.inkSoft, 1);
  g.blit(bracketScene(120, 18, { chipH: 1 }), 0, 38, 1);
  // wordmark blocks bottom-left
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-bracket.png", 10);
}

console.log("done");
