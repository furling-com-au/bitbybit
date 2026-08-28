/* ============================================================
   Bake the FIRST frame of a live preview into the page.
   Run: node scripts/gen-live-preview.mjs

   The preview redraws as you type, and a shift the browser can
   attribute to typing costs nothing — layout shifts within 500ms
   of user input are excluded from CLS. The dangerous frame is the
   first one: a preview that renders itself on load moves the form
   underneath it after first paint, with no user action to excuse
   it. check-qotd-preview.mjs is the write-up of the last time that
   happened here, 12% of CLS samples rated poor with Cloudflare
   naming the element.

   So the initial frame is rendered here, at build time, from the
   values the form actually ships with, by the same module the
   browser will use for every frame after it. The page arrives
   complete and the first keystroke is the first change.

   Source of truth is the PAGE: the prefilled textarea is read out
   of the HTML rather than restated here, so editing the defaults
   cannot leave the baked frame describing the old ones.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { parseShiftLines, previewSummary, renderRosterPreview } from "../public/preview/roster.js";

/* dir -> how to find the input, and what to render it with. One entry so
   far; the shape is here so the second one is an entry and not a fork. */
const LIVE = {
  "volunteer-roster": {
    field: /<textarea id="shifts"[^>]*>([\s\S]*?)<\/textarea>/,
    render: (raw) => {
      const shifts = parseShiftLines(decode(raw));
      return { summary: previewSummary(shifts), board: renderRosterPreview(shifts) };
    },
  },
};

const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const decode = (s) => s.replace(/&[a-z]+;|&#\d+;/gi, (e) => ENT[e] ?? e);

const FENCE = /([ \t]*)<!-- live-preview:start -->[\s\S]*?<!-- live-preview:end -->/;

const problems = [];
let changed = 0, already = 0;

for (const [dir, cfg] of Object.entries(LIVE)) {
  const file = `public/${dir}/index.html`;
  const html = readFileSync(file, "utf8");

  const fence = html.match(FENCE);
  if (!fence) { problems.push(`${dir}/ has no <!-- live-preview --> fence`); continue; }

  const input = html.match(cfg.field);
  if (!input) { problems.push(`${dir}/ has no prefilled field matching ${cfg.field}`); continue; }

  const { summary, board } = cfg.render(input[1]);
  if (!board) { problems.push(`${dir}/ prefilled field renders an empty preview`); continue; }

  const indent = fence[1];
  /* Re-indented so the file stays readable, and trimmed per line so the
     output is a pure function of the input — otherwise the generator
     would rewrite the page on every run over whitespace alone. */
  const inner = board.trim().split("\n").map((l) => `${indent}  ${l.trim()}`).join("\n");
  /* The summary is its own node, outside the board and NOT rewritten
     wholesale by the client — aria-live only announces changes inside a
     region that already existed at load. The board carries no live region
     at all: reading sixteen slots out on every keystroke is not help. */
  const block =
    `${indent}<!-- live-preview:start -->\n` +
    `${indent}<p class="live-preview-label" id="rosterPreviewLabel" aria-live="polite">${summary}</p>\n` +
    `${indent}<div class="live-preview" id="rosterPreview">\n` +
    `${inner}\n` +
    `${indent}</div>\n` +
    `${indent}<!-- live-preview:end -->`;

  const next = html.replace(FENCE, block);
  if (next === html) { already++; continue; }
  writeFileSync(file, next);
  changed++;
}

console.log(`live previews: ${changed} written, ${already} already current, ${Object.keys(LIVE).length} page(s)`);
if (problems.length) {
  for (const p of problems) console.error("  ! " + p);
  process.exit(1);
}
