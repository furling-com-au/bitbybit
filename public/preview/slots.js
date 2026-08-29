/* ============================================================
   "Name xN", one per line — the shape three builders share.

   The volunteer roster calls them shifts, bring-a-plate calls them
   categories and the hens planner calls them lists, but underneath
   they are the same thing: a label, a number of spots, and a board
   of open slots. Each of those pages carried its OWN copy of this
   parser — same regex, same "no xN means two", same clamp — plus its
   own copy of the duplicate-name check. Four copies of one rule.

   One copy now. The tool modules beside this file supply the words
   and the class names; nothing here knows what a shift is.

   Plain ESM under public/ so the browser fetches it and the Worker
   can import it, same as the rest of this directory.
   ============================================================ */

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Lines offered, before any cap is applied — so a caller can say that some
   were dropped rather than silently dropping them. */
export const countLines = (text) =>
  String(text).split("\n").map((s) => s.trim()).filter(Boolean).length;

/* The trailing xN is optional. A line without one gets `fallback` spots,
   which is the rule these pages used to state in prose and now demonstrate:
   type a bare line, watch two slots appear. */
export function parseCapacityLines(text, { max, maxCap = 30, fallback = 2, maxLabel = 50 }) {
  return String(text)
    .split("\n")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, max)
    .map((line) => {
      const m = line.match(/^(.*?)\s*[xX]\s*(\d+)$/);
      let label = line;
      let capacity;
      if (m && m[1].trim()) {
        label = m[1].trim();
        capacity = parseInt(m[2], 10);
      }
      if (!Number.isFinite(capacity)) capacity = fallback;
      capacity = Math.min(maxCap, Math.max(1, capacity));   // "x0" clamps to 1
      return { label: label.slice(0, maxLabel), capacity };
    });
}

/* Two lists with the same name would produce two boards nobody can tell
   apart. Case-insensitive, because "Salads" and "salads" are the same
   request to everyone except a computer. */
export function firstDupe(items) {
  const seen = new Set();
  for (const it of items) {
    const k = it.label.toLowerCase();
    if (seen.has(k)) return it.label;
    seen.add(k);
  }
  return null;
}

/* The line that gets SPOKEN on every keystroke, so it stays one line. The
   board itself is never a live region — see the note in preview/roster.js. */
export function capacitySummary(items, { one, many, tail = "this is what people will see" }) {
  if (!items.length) return "";
  const spots = items.reduce((n, s) => n + s.capacity, 0);
  return `${items.length} ${items.length === 1 ? one : many}, ` +
    `${spots} ${spots === 1 ? "spot" : "spots"} — ${tail}`;
}

/* The board, in whatever class vocabulary the tool's real /s/ page uses,
   minus every control — a preview offering "I've got this" would be lying
   about what it is.

   Only the first `show` are drawn and the rest are COUNTED. A box that
   scrolls inside a form traps a thumb on a phone, and fifty rows drawn in
   full would push the submit button off the page, which is the problem
   this is meant to help with rather than deepen. The summary above already
   carries the real totals, so nothing is hidden — only undrawn.

   Headings are <p>, not <h2>: this sits inside a builder, and injecting
   headings for a preview would land them in the page outline ahead of the
   real ones. */
export function renderSlotBoard(items, cls) {
  if (!items.length) return "";
  const show = cls.show ?? 3;
  const shown = items.slice(0, show);
  const rest = items.slice(show);

  const sections = shown.map((it) => {
    const slots = Array.from({ length: it.capacity }, () =>
      `\n    <li class="${cls.slot} open"><span class="${cls.openLabel}">Open</span></li>`
    ).join("");
    return `
  <section class="${cls.section}">
    <p class="${cls.head}">${esc(it.label)} <span class="${cls.count}">&mdash; 0 of ${it.capacity} ${cls.verb}</span></p>
    <ul class="${cls.grid}">${slots}
    </ul>
  </section>`;
  }).join("");

  if (!rest.length) return sections;
  const spots = rest.reduce((n, x) => n + x.capacity, 0);
  return sections + `
  <p class="live-preview-more">&hellip; and ${rest.length} more ${rest.length === 1 ? cls.one : cls.many}, ${spots} more ${spots === 1 ? "spot" : "spots"}</p>`;
}
