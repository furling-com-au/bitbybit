/* ============================================================
   Volunteer roster — the live preview, shared by both sides.

   THE POINT OF THIS FILE BEING WHERE IT IS.
   It lives under public/ so the browser can fetch it, and it is
   plain ESM so the Worker can import it at bundle time. One file,
   two consumers, no copy.

   That matters because the alternative is already in this repo and
   says so out loud. public/registry-prado.js carries a hand-copied
   parts list with a comment insisting it and src/tools/registry.js
   "MUST stay identical in both places". Doing that once per tool is
   a dozen copies held together by shouting.

   WHAT IT REPLACES.
   The builder used to explain its own syntax in prose, three hundred
   words below a textarea that was already prefilled with the answer:
   "Grill 9-11am x3 means three spots on the grill for that slot." The
   example in the sentence was literally the second line of the box.
   A board that redraws as you type says the same thing without a
   sentence, and cannot fall out of step with the parser the way the
   prose could.

   RELATIONSHIP TO THE REAL BOARD.
   board() in src/tools/roster.js renders the live /s/ page, with its
   claim buttons and per-slot forms. This renders the same shape with
   nothing interactive in it — a preview that offered a "Put me down"
   button would be lying about what it is. The contract that has to
   hold is "what you type is what you get": same labels, same spot
   counts, same order. check-baked-previews.mjs asserts it.
   ============================================================ */

/* Same escape as everywhere else. Kept local rather than imported so
   this module has no dependencies at all and the browser fetches one
   file — it is three lines of well-known behaviour, not a policy that
   can drift. */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const MAX_SHIFTS = 20;
export const MAX_CAP = 30;

/* "Job time xN", one per line. The trailing xN is optional and a line
   without one gets two spots, which is the rule the prose used to state
   and the preview now demonstrates: type a line, watch two slots appear.

   This is the ONLY parser on the builder side. public/roster.js used to
   carry its own copy for the status line. */
export function parseShiftLines(text) {
  return String(text)
    .split("\n")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, MAX_SHIFTS)
    .map((line) => {
      const m = line.match(/^(.*?)\s*[xX]\s*(\d+)$/);
      let label = line;
      let capacity;
      if (m && m[1].trim()) {
        label = m[1].trim();
        capacity = parseInt(m[2], 10);
      }
      if (!Number.isFinite(capacity)) capacity = 2;   // no xN suffix given
      capacity = Math.min(MAX_CAP, Math.max(1, capacity));  // "x0" clamps to 1
      return { label: label.slice(0, 50), capacity };
    });
}

/* How many lines were offered, so the caller can say when some were
   dropped. Counted before the slice, which is the whole reason it is
   a separate export. */
export const countShiftLines = (text) =>
  String(text).split("\n").map((s) => s.trim()).filter(Boolean).length;

/* The one-line summary. Split out from the board because it is the only
   part that should be SPOKEN on every keystroke.

   The board carries aria-live nowhere: a polite region wrapping sixteen
   slots would read the whole roster out again on every character typed,
   which is not assistance, it is punishment. The summary sits in its own
   stable node whose text changes — a live region that gets replaced
   wholesale often is not announced at all — so a screen reader user hears
   "5 shifts, 16 spots" and nothing more. */
export function previewSummary(shifts) {
  if (!shifts.length) return "";
  const spots = shifts.reduce((n, s) => n + s.capacity, 0);
  return `${shifts.length} ${shifts.length === 1 ? "shift" : "shifts"}, ` +
    `${spots} ${spots === 1 ? "spot" : "spots"} — this is what people will see`;
}

/* A <p> heading, not an <h2>: this sits inside the builder form, and
   injecting five headings into the outline for a preview would put them in
   the document's heading order ahead of the real ones. */
export const SHOW_SHIFTS = 3;

export function renderRosterPreview(shifts) {
  if (!shifts.length) return "";
  const shown = shifts.slice(0, SHOW_SHIFTS);
  const rest = shifts.slice(SHOW_SHIFTS);

  const sections = shown.map((shift) => {
    const slots = Array.from({ length: shift.capacity }, () =>
      `\n    <li class="rost-slot open"><span class="rost-open-label">Open</span></li>`
    ).join("");
    return `
  <section class="rost-shift">
    <p class="rost-shift-head">${esc(shift.label)} <span class="rost-count">&mdash; 0 of ${shift.capacity} filled</span></p>
    <ul class="rost-grid">${slots}
    </ul>
  </section>`;
  }).join("");

  /* Only the first few are drawn, and the rest are counted rather than
     rendered. A box that scrolls inside a form traps a thumb on a phone,
     and fifty shifts drawn in full would push the submit button off the
     page — which is the thing this preview is supposed to help with, not
     make worse. */
  if (!rest.length) return sections;
  const spots = rest.reduce((n, x) => n + x.capacity, 0);
  return sections + `
  <p class="live-preview-more">&hellip; and ${rest.length} more ${rest.length === 1 ? "shift" : "shifts"}, ${spots} more ${spots === 1 ? "spot" : "spots"}</p>`;
}

/* ---------- the build-time contract --------------------------
   What gen-live-preview.mjs and check-baked-previews.mjs need to bake and
   verify the first frame. Declared HERE, in the module that owns the
   rendering, so adding a second tool is a new file rather than a fork of
   the generator. */

export const PREVIEW_IDS = { label: "rosterPreviewLabel", board: "rosterPreview" };

/* Pulled out of the page rather than restated, so editing the defaults in
   the HTML cannot leave the baked frame describing the old ones. */
export const PAGE_INPUTS = {
  shifts: /<textarea id="shifts"[^>]*>([\s\S]*?)<\/textarea>/,
};

/* The roster ships prefilled, so it always has a frame to bake. */
export const REQUIRE_FIRST_FRAME = true;

export function firstFrame({ shifts }) {
  const parsed = parseShiftLines(shifts || "");
  return { summary: previewSummary(parsed), board: renderRosterPreview(parsed) };
}
