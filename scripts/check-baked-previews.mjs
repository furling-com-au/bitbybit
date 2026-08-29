/* ============================================================
   Two previews are baked into HTML at build time rather than
   painted by JavaScript after the page loads. Baking is what keeps
   them out of the layout-shift trap check-qotd-preview.mjs was
   written for — but baked markup is a copy, and a copy drifts.

   This is the guard for both:

     1. The scrum poker deck strip on /scrum-poker/. Must match
        DECKS.fib and DECK_LABEL.fib in public/poker.js, because
        that is what repaints it the moment somebody picks the
        other deck. If those disagree, choosing t-shirt and
        choosing back again silently changes the page.

     2. The first frame of every live preview. Must match what the
        shared module renders from the fields the page ships with,
        or the visitor sees one board until their first keystroke
        and a different one after it.

   Run: node scripts/check-baked-previews.mjs
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from "node:fs";

const problems = [];

/* ---------- 1. the deck strip ------------------------------- */

const pokerJs = readFileSync("public/poker.js", "utf8");
const pokerHtml = readFileSync("public/scrum-poker/index.html", "utf8");

/* Pulled out of the source rather than duplicated here, so this file can
   never become a third place the deck is written down. */
const fibSrc = pokerJs.match(/fib:\s*\[([^\]]*)\]/);
if (!fibSrc) problems.push("public/poker.js: no DECKS.fib array found");

const labelSrc = pokerJs.match(/fib:\s*"((?:[^"\\]|\\.)*)"/);
if (!labelSrc) problems.push("public/poker.js: no DECK_LABEL.fib string found");

if (fibSrc && labelSrc) {
  const cards = fibSrc[1]
    .split(",")
    .map((c) => c.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

  const want = cards
    .map((c) => `<span class="pk-card pk-card-sample">${c}</span>`)
    .join("");

  const div = pokerHtml.match(
    /<div class="pk-deck pk-deck-preview"[^>]*id="deckPreview"[\s\S]*?>([\s\S]*?)<\/div>/
  );
  if (!div) {
    problems.push("/scrum-poker/: no #deckPreview div found");
  } else {
    if (div[1].trim() !== want)
      problems.push(
        `/scrum-poker/: baked deck does not match DECKS.fib\n      page: ${div[1].trim().slice(0, 90)}…\n      want: ${want.slice(0, 90)}…`
      );

    const openTag = pokerHtml.match(/<div class="pk-deck pk-deck-preview"[\s\S]*?>/)[0];
    if (/aria-hidden/.test(openTag))
      problems.push(
        "/scrum-poker/: #deckPreview is aria-hidden again — it is the only " +
          "description of the deck now that the prose moved to the guide page"
      );
    if (!/data-deck="fib"/.test(openTag))
      problems.push('/scrum-poker/: #deckPreview needs data-deck="fib" or poker.js will repaint on load');

    /* The label is escaped for a JS string literal; the HTML carries the
       real characters. Compare on the decoded form. */
    const wantLabel = labelSrc[1].replace(/\\u([0-9a-f]{4})/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
    const gotLabel = (openTag.match(/aria-label="([^"]*)"/) || [])[1];
    if (gotLabel !== wantLabel)
      problems.push(
        `/scrum-poker/: #deckPreview aria-label does not match DECK_LABEL.fib\n      page: ${gotLabel}\n      want: ${wantLabel}`
      );
  }
}

/* Collapsed whitespace: the baked block is re-indented by the generator, so
   this checks that the CONTENT still matches, not the pretty-printing. */
const flat = (str) => str.replace(/\s+/g, " ").trim();

/* ---------- 2. no stale static strips ----------------------- */

/* The static "A finished one, for instance" strip is gone from every builder —
   once a page shows the board you are actually making, a second board showing
   somebody else's is just another thing on it. This fails if one comes back
   without the machinery that used to maintain it, which would leave a frozen
   copy of a tool's output that nothing keeps in step. */
for (const d of readdirSync("public", { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const f = `public/${d.name}/index.html`;
  if (!existsSync(f)) continue;
  if (readFileSync(f, "utf8").includes("<!-- example-preview:start -->"))
    problems.push(`/${d.name}/: carries an example-preview block, but nothing generates or checks those any more`);
}

/* ---------- 3. the live previews ---------------------------- */

/* The baked first frame must equal what the shared module renders from the
   fields the page actually ships with. If they disagree, the visitor sees one
   board until their first keystroke and a different one after it — a flicker
   with no cause they can see, which is worse than no preview.

   Generic: each module under public/preview/ declares its own PAGE_INPUTS,
   PREVIEW_IDS and firstFrame(), so this loop knows nothing about shifts or
   dates and a third tool is a line in LIVE. */
const { readInputs } = await import("./preview-inputs.mjs");

const LIVE = {
  "volunteer-roster": "roster",
  "meal-train": "meal",
  "bring-a-plate": "plate",
  "hens-planner": "hens",
  "kris-kringle": "kringle",
};

for (const [dir, modName] of Object.entries(LIVE)) {
  const html = readFileSync(`public/${dir}/index.html`, "utf8");
  const mod = await import(`../public/preview/${modName}.js`);
  const { label: labelId, board: boardId } = mod.PREVIEW_IDS;

  const block = html.match(/<!-- live-preview:start -->([\s\S]*?)<!-- live-preview:end -->/);
  if (!block) { problems.push(`/${dir}/: no live-preview fence — run gen-live-preview.mjs`); continue; }

  const want = mod.firstFrame(readInputs(html, mod.PAGE_INPUTS));

  if (mod.REQUIRE_FIRST_FRAME && !want.board)
    problems.push(`/${dir}/: declares REQUIRE_FIRST_FRAME but its own defaults render nothing`);
  if (want.board && !flat(block[1]).includes(flat(want.board)))
    problems.push(`/${dir}/: baked board does not match what the module renders from the page's own defaults — re-run gen-live-preview.mjs`);
  if (want.summary && !flat(block[1]).includes(flat(want.summary)))
    problems.push(`/${dir}/: baked summary does not match the module — re-run gen-live-preview.mjs`);

  /* The board must NOT be a live region and the summary MUST be. Backwards,
     this reads a whole roster aloud on every keystroke. */
  if (new RegExp(`id="${boardId}"[^>]*aria-live`).test(block[1]))
    problems.push(`/${dir}/: the board carries aria-live — it would be announced in full on every keystroke`);
  if (!new RegExp(`id="${labelId}"[^>]*aria-live="polite"`).test(block[1]))
    problems.push(`/${dir}/: the summary is not a polite live region, so nothing is announced as it changes`);

  if (/<button|<input|<form|<select|<textarea/.test(block[1]))
    problems.push(`/${dir}/: live-preview contains a form control — it sits inside the builder and must not be pressable`);

  if (/<h[1-6][\s>]/.test(block[1]))
    problems.push(`/${dir}/: live-preview contains a heading — it would land in the page outline ahead of the real ones`);
}

console.log(`baked previews: 1 deck + ${Object.keys(LIVE).length} live first-frame(s) checked, ${problems.length} wrong`);
if (problems.length) {
  for (const p of problems) console.error("  ! " + p);
  process.exit(1);
}
