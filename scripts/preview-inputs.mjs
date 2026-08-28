/* Read a preview module's declared PAGE_INPUTS out of a page.

   Its own file because both gen-live-preview.mjs and
   check-baked-previews.mjs need it, and a check script that imports the
   generator would RUN the generator — a verification step that rewrites
   the files it is meant to be verifying is not a verification step.
*/
const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
export const decode = (s) => s.replace(/&[a-z]+;|&#\d+;/gi, (e) => ENT[e] ?? e);

/* A pattern that does not match, or matches with nothing captured, yields ""
   — which is how a field the page ships empty (the meal train's start date)
   reaches firstFrame() as an empty string rather than undefined. */
export function readInputs(html, patterns) {
  const out = {};
  for (const [name, re] of Object.entries(patterns)) {
    const m = html.match(re);
    out[name] = m && m[1] != null ? decode(m[1]) : "";
  }
  return out;
}
