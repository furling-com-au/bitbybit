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

     2. Every example-preview block written by
        sync-example-links.mjs. Must match what the tool module's
        examplePreview() renders right now. The whole claim of that
        strip is "this is what the tool really produces"; a stale
        copy makes it a screenshot with extra steps.

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

/* ---------- 2. the example previews ------------------------- */

/* Same map sync-example-links.mjs uses. Kept in step by the check below,
   which fails if a page carries a preview this file does not know about. */
const PREVIEW_MODULES = {
  "scrum-poker": "../src/tools/poker.js",
  "kris-kringle": "../src/tools/kringle.js",
};

/* The strip is written with each line trimmed and re-indented, so compare on
   collapsed whitespace — this is checking that the CONTENT still matches, not
   that the pretty-printing does. */
const flat = (s) => s.replace(/\s+/g, " ").trim();

for (const [dir, mod] of Object.entries(PREVIEW_MODULES)) {
  const file = `public/${dir}/index.html`;
  const html = readFileSync(file, "utf8");

  const block = html.match(
    /<!-- example-preview:start -->([\s\S]*?)<!-- example-preview:end -->/
  );
  if (!block) {
    problems.push(`/${dir}/: no example-preview block — run sync-example-links.mjs`);
    continue;
  }

  const m = await import(mod);
  const fn = m.default && m.default.examplePreview;
  if (typeof fn !== "function") {
    problems.push(`${mod}: no examplePreview() export`);
    continue;
  }

  if (!flat(block[1]).includes(flat(fn())))
    problems.push(
      `/${dir}/: baked preview has drifted from ${mod} examplePreview() — re-run sync-example-links.mjs`
    );

  /* The strip must not offer anything to press. A control in there is either a
     dead end or, worse, one that works and creates something. */
  if (/<button|<input|<form|<select|<textarea/.test(block[1]))
    problems.push(`/${dir}/: example-preview contains a form control — it must be inert`);
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

/* A preview on a page this script does not know about would go unchecked
   forever, which is the failure mode that makes a guard worse than none. */
for (const d of readdirSync("public", { withFileTypes: true })) {
  if (!d.isDirectory() || PREVIEW_MODULES[d.name]) continue;
  const f = `public/${d.name}/index.html`;
  if (!existsSync(f)) continue;
  if (readFileSync(f, "utf8").includes("<!-- example-preview:start -->"))
    problems.push(`/${d.name}/: carries a preview but is not in PREVIEW_MODULES — it would never be checked`);
}

const n = Object.keys(PREVIEW_MODULES).length;
console.log(`baked previews: 1 deck + ${n} example strips + ${Object.keys(LIVE).length} live first-frame(s) checked, ${problems.length} wrong`);
if (problems.length) {
  for (const p of problems) console.error("  ! " + p);
  process.exit(1);
}
