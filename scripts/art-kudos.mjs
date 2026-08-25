/* ============================================================
   Kudos Wall — OG image + shelf icon.

   Notes pinned to a board, slightly askew, one of them gold. Not a
   trophy and not a star: this is for ordinary work noticed by a
   colleague, and a sticky note says that where a medal does not.
   Run:  node scripts/art-kudos.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

mkdirSync("public/art", { recursive: true });
mkdirSync("public/icons", { recursive: true });

/* A note: paper square, a couple of ruled lines, and a pin. */
function note(g, x, y, w, h, body, dark, lean) {
  g.rect(x, y, x + w, y + h, body);
  g.rect(x, y, x + w, y, dark);              // top edge in shadow
  g.rect(x, y + h, x + w, y + h, dark);      // bottom edge
  // two short ruled lines standing in for writing
  g.rect(x + 2, y + 3 + lean, x + w - 3, y + 3 + lean, dark);
  g.rect(x + 2, y + 6 + lean, x + w - 5, y + 6 + lean, dark);
  g.px(x + Math.round(w / 2), y - 1, P.red);  // the pin
}

function board(w, h) {
  const g = new Grid(w, h, null);
  const mid = Math.floor(w / 2);
  // the board itself: a plain panel with a lit top edge
  g.rect(mid - 44, 2, mid + 44, h - 3, P.paper2);
  g.rect(mid - 44, 2, mid + 44, 2, P.line);
  g.rect(mid - 44, h - 3, mid + 44, h - 3, P.line);
  g.rect(mid - 44, 2, mid - 44, h - 3, P.line);
  g.rect(mid + 44, 2, mid + 44, h - 3, P.line);

  note(g, mid - 36, 6, 20, 12, P.paper, P.line, 0);
  note(g, mid - 11, 8, 20, 12, P.gold, "#b5852f", 1);
  note(g, mid + 15, 5, 20, 12, P.paper, P.line, 0);
  note(g, mid - 24, 22, 20, 12, P.sage, P.sageDark, 1);
  note(g, mid + 3, 23, 20, 12, P.paper, P.line, 0);
  return g;
}

/* ---------- og image ----------------------------------------- */
{
  const g = new Grid(120, 63, P.paper);
  g.rect(0, 0, 119, 0, P.line);
  g.rect(0, 62, 119, 62, P.line);

  const title = "KUDOS WALL";
  drawText(g, Math.round((120 - textWidth(title, 1)) / 2), 5, title, P.ink, 1);
  const sub = "WORTH SAYING OUT LOUD";
  drawText(g, Math.round((120 - textWidth(sub, 1)) / 2), 13, sub, P.inkSoft, 1);

  g.blit(board(120, 40), 0, 19, 1);

  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-kudos.png", 10);
}

/* ---------- shelf icon --------------------------------------- */
{
  const g = new Grid(28, 28, null);
  note(g, 2, 4, 11, 9, P.paper, P.line, 0);
  note(g, 15, 6, 11, 9, P.gold, "#b5852f", 0);
  note(g, 8, 17, 11, 9, P.sage, P.sageDark, 0);
  g.toPng("public/icons/kudos.png", 2);
}

console.log("done");
