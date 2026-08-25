/* ============================================================
   Weekly Pulse — OG image + shelf icon.

   A row of bars, one per week, at slightly different heights with
   the current week picked out in gold. The shape everyone already
   reads as "a trend over time", which is what the tool is. No face,
   no smiley scale — the point of this one is that nobody is
   identifiable, and a row of anonymous bars says that better than a
   person does.
   Run:  node scripts/art-pulse.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P } from "./pixel-lib.mjs";

mkdirSync("public/art", { recursive: true });
mkdirSync("public/icons", { recursive: true });

/* Fixed heights rather than random ones: a trend should look like a
   trend, with a dip and a recovery, not like noise. */
const WEEKS = [9, 12, 8, 14, 11, 16, 13, 18];

function bars(g, x0, base, colW, gap, heights, highlightLast) {
  heights.forEach((h, i) => {
    const x = x0 + i * (colW + gap);
    const last = i === heights.length - 1;
    const body = last && highlightLast ? P.gold : P.paper2;
    g.rect(x, base - h, x + colW - 1, base, body);
    // outline, so the bars read at small sizes
    g.rect(x, base - h, x + colW - 1, base - h, P.ink);
    g.rect(x, base - h, x, base, P.ink);
    g.rect(x + colW - 1, base - h, x + colW - 1, base, P.ink);
    g.rect(x, base, x + colW - 1, base, P.ink);
  });
}

/* ---------- og image ----------------------------------------- */
{
  const g = new Grid(120, 63, P.paper);
  g.rect(0, 0, 119, 0, P.line);
  g.rect(0, 62, 119, 62, P.line);

  const title = "WEEKLY PULSE";
  drawText(g, Math.round((120 - textWidth(title, 1)) / 2), 5, title, P.ink, 1);
  const sub = "ONE TAP - NOBODY KNOWS WHO";
  drawText(g, Math.round((120 - textWidth(sub, 1)) / 2), 13, sub, P.inkSoft, 1);

  const colW = 8, gap = 4;
  const total = WEEKS.length * colW + (WEEKS.length - 1) * gap;
  bars(g, Math.round((120 - total) / 2), 48, colW, gap, WEEKS, true);
  // the baseline the bars sit on, running the width of the scene
  g.rect(10, 49, 109, 49, P.line);

  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-pulse.png", 10);
}

/* ---------- shelf icon --------------------------------------- */
{
  const g = new Grid(28, 28, null);
  bars(g, 3, 23, 4, 2, [8, 13, 10, 17], true);
  g.rect(2, 24, 25, 24, P.line);
  g.toPng("public/icons/pulse.png", 2);
}

console.log("done");
