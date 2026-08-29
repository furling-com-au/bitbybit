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
import { readInputs } from "./preview-inputs.mjs";

/* dir -> the module under public/preview/ that owns its rendering. The
   module declares its own PAGE_INPUTS, PREVIEW_IDS and firstFrame(), so a
   new tool is a new file plus a line here — this driver knows nothing about
   shifts or dates. */
const LIVE = {
  "volunteer-roster": "roster",
  "meal-train": "meal",
  "bring-a-plate": "plate",
  "hens-planner": "hens",
  "kris-kringle": "kringle",
};

const FENCE = /([ 	]*)<!-- live-preview:start -->[\s\S]*?<!-- live-preview:end -->/;

const problems = [];
let changed = 0, already = 0, empty = 0;

for (const [dir, modName] of Object.entries(LIVE)) {
  const file = `public/${dir}/index.html`;
  const html = readFileSync(file, "utf8");
  const mod = await import(`../public/preview/${modName}.js`);

  const fence = html.match(FENCE);
  if (!fence) { problems.push(`${dir}/ has no <!-- live-preview --> fence`); continue; }

  const { summary, board } = mod.firstFrame(readInputs(html, mod.PAGE_INPUTS));

  if (!board && mod.REQUIRE_FIRST_FRAME) {
    problems.push(`${dir}/ declares REQUIRE_FIRST_FRAME but its defaults render nothing`);
    continue;
  }

  const indent = fence[1];
  const { label: labelId, board: boardId } = mod.PREVIEW_IDS;

  /* Trimmed per line so the output is a pure function of the input and the
     generator does not rewrite the page over whitespace alone. */
  const inner = board
    ? "\n" + board.trim().split("\n").map((l) => `${indent}  ${l.trim()}`).join("\n") + "\n" + indent
    : "";

  /* The summary is its own node and is NOT replaced wholesale by the client
     — aria-live only announces changes inside a region that already existed
     at load. The board carries no live region at all: reading a whole
     roster out on every keystroke is not help. */
  const block =
    `${indent}<!-- live-preview:start -->\n` +
    `${indent}<p class="live-preview-label" id="${labelId}" aria-live="polite">${summary}</p>\n` +
    `${indent}<div class="live-preview" id="${boardId}">${inner}</div>\n` +
    `${indent}<!-- live-preview:end -->`;

  if (!board) empty++;
  const next = html.replace(FENCE, block);
  if (next === html) { already++; continue; }
  writeFileSync(file, next);
  changed++;
}

console.log(
  `live previews: ${changed} written, ${already} already current, ` +
  `${Object.keys(LIVE).length} page(s)` +
  (empty ? `, ${empty} with no default frame (nothing typed yet)` : "")
);
if (problems.length) {
  for (const p of problems) console.error("  ! " + p);
  process.exit(1);
}
