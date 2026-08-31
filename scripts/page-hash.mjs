/* What "this page changed" means, in one place.
 *
 * Two scripts need to answer it and they must answer it identically:
 * gen-sitemap decides whether to advance a URL's <lastmod>, and indexnow
 * decides whether to submit that URL. If they disagreed, the sitemap would
 * advertise a change nobody was told about, or IndexNow would announce a
 * change the sitemap denies. Same question, one implementation.
 *
 * It hashes the bytes served. That is the point: npm run build rewrites most
 * of public/ on every run, so "the file was written" says nothing, but "the
 * bytes moved" is exactly the fact both callers want. Rewriting a file with
 * identical content — which every generator here does — hashes the same and
 * therefore counts as no change.
 *
 * Truncated to 16 hex chars. This is a change detector, not a security
 * boundary; the input is our own build output and nobody is attacking it.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export function pageHash(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);
}

/* Today, in the site's own local time.
 *
 * NOT toISOString().slice(0,10). That converts to UTC first, so a build run
 * at 08:00 in Adelaide (+09:30) stamps every page with YESTERDAY's date —
 * which is how a whole sitemap comes to look one day stale and nobody
 * notices, because "yesterday's build" is a perfectly believable thing to
 * see. lastmod is a date, and the date is the one on the wall here. */
export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
