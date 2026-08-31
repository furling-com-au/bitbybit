/* Tell IndexNow which pages changed, after a deploy.
 *
 * Run:  npm run indexnow            (chained onto npm run deploy)
 *       npm run indexnow -- --dry-run
 *       npm run indexnow -- --all
 *
 * IndexNow is one POST to api.indexnow.org that Bing, Yandex, Seznam, Naver
 * and DuckDuckGo all read from. Ownership is proved by hosting a file named
 * after the key at the site root — public/<key>.txt — so there is no account,
 * no token to store and nothing in .dev.vars. The key is public by design;
 * that is the whole mechanism.
 *
 * The key is NOT written down here. This finds it by looking for the one file
 * in public/ whose name is its own contents, which is exactly what makes a key
 * file a key file. Two copies of a key is how a rotation half-happens.
 *
 * WHICH URLS. The protocol asks for pages that CHANGED, not the catalogue.
 * Neither obvious source is the right key:
 *
 *   - the sitemap's own lastmod looks like the answer and used to be a
 *     trap: it was a file mtime, and npm run build rewrites most of public/
 *     whether or not the bytes moved, so it said "all 54 pages changed" on
 *     every deploy. gen-sitemap now derives lastmod from the same hash this
 *     script does, so the two finally agree — but this still keys off its own
 *     state file, because "changed" and "already accepted by the endpoint"
 *     are different facts and only the second one belongs to this machine.
 *   - "everything, every time" is the same lie with fewer steps, and 429 is
 *     a documented response to it.
 *
 * So this hashes the HTML each sitemap URL actually serves and submits the
 * ones whose hash moved since the last accepted submission. Rewriting a file
 * with identical content — which most generators do — submits nothing.
 *
 * .indexnow-state.json holds those hashes. It is local operational data, same
 * as .stats-history.jsonl, and is gitignored: on a fresh clone there is no
 * state, so the first run submits the whole sitemap. That is the correct
 * activation submission, and it only happens once per machine.
 *
 * FAILURE. A missing or inconsistent key file is a build error and exits 1 —
 * silently submitting against a key the site does not serve would just collect
 * 403s. An HTTP failure only warns: this runs AFTER wrangler deploy, the site
 * is already live, and reporting a successful deploy as failed because Bing
 * had a bad minute helps nobody. State is written only for URLs that were
 * actually accepted, so a failed run simply resubmits next time.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { pageHash } from "./page-hash.mjs";
import { join } from "node:path";

const PUB = "public";
const ORIGIN = "https://bitibybit.com";
const HOST = "bitibybit.com";
const ENDPOINT = "https://api.indexnow.org/IndexNow";
const STATE = ".indexnow-state.json";
const BATCH = 10000; /* protocol maximum per request */

const ALL = process.argv.includes("--all");
const DRY = process.argv.includes("--dry-run");

/* The key file, found by the property that defines it: a root-level file whose
   name (minus .txt) is its own contents. robots.txt and llms.txt are excluded
   by that test rather than by name, so a future .txt at the root cannot be
   mistaken for a key and a key cannot be missed for being unlisted. */
function findKey() {
  const found = [];
  for (const name of readdirSync(PUB)) {
    const m = /^([A-Za-z0-9-]{8,128})\.txt$/.exec(name);
    if (!m) continue;
    let body;
    try { body = readFileSync(join(PUB, name), "utf8"); } catch { continue; }
    if (body.trim() === m[1]) found.push(m[1]);
  }
  if (found.length === 1) return found[0];
  if (found.length === 0) {
    console.error("\n  ! No IndexNow key file in public/.");
    console.error("  ! It is a file named <key>.txt containing exactly <key>, e.g.");
    console.error("  !   node -e \"const k=require('crypto').randomBytes(16).toString('hex');\"");
    console.error("  !     + writeFileSync('public/'+k+'.txt', k)\n");
  } else {
    console.error(`\n  ! ${found.length} key files in public/: ${found.join(", ")}`);
    console.error("  ! Search engines will validate against whichever one they fetch.");
    console.error("  ! Keep exactly one.\n");
  }
  process.exit(1);
}

/* Every URL the sitemap advertises, paired with the file that serves it. The
   sitemap is the right input because it has already dropped the noindex pages:
   a capability URL under /s/ must never be handed to a search engine, and not
   restating that rule here means it cannot drift out of step with it. */
function sitemapPages() {
  const xml = readFileSync(join(PUB, "sitemap.xml"), "utf8");
  const out = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = m[1];
    const route = url.slice(ORIGIN.length);
    const file = join(PUB, route.replace(/^\//, ""), "index.html");
    if (!existsSync(file)) {
      console.error(`  ! ${url} is in the sitemap but ${file} does not exist`);
      process.exit(1);
    }
    out.push({ url, hash: pageHash(file) });
  }
  return out;
}

const key = findKey();
const pages = sitemapPages();

const prev = !ALL && existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")).pages || {} : {};
const first = !ALL && !existsSync(STATE);
const changed = pages.filter((p) => prev[p.url] !== p.hash);

const why = ALL ? "forced with --all" : first ? "first run — activation submission" : "changed since last submission";
console.log(`indexnow: ${changed.length} of ${pages.length} urls to submit (${why})`);
for (const p of changed.slice(0, 10)) console.log(`    ${p.url}`);
if (changed.length > 10) console.log(`    …and ${changed.length - 10} more`);

if (!changed.length) process.exit(0);
if (DRY) { console.log("  (dry run — nothing sent)"); process.exit(0); }

/* Only what the endpoint accepted goes into the state file. Recording a URL as
   submitted when it was not is the one failure this script could cause that
   nobody would ever see: the page would be permanently skipped from then on. */
const accepted = { ...prev };
let failed = 0;

for (let i = 0; i < changed.length; i += BATCH) {
  const batch = changed.slice(i, i + BATCH);
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `${ORIGIN}/${key}.txt`,
        urlList: batch.map((p) => p.url),
      }),
    });
  } catch (e) {
    console.error(`  ! IndexNow unreachable: ${e.message}`);
    failed += batch.length;
    continue;
  }

  /* 200 accepted, 202 accepted-but-key-still-being-validated. Everything else
     is documented and worth printing in full, because 403 (key not served) and
     422 (url does not match host) are configuration mistakes that would
     otherwise look like an ordinary network blip and repeat forever. */
  if (res.status === 200 || res.status === 202) {
    for (const p of batch) accepted[p.url] = p.hash;
    console.log(`  ${res.status} — ${batch.length} urls accepted`);
  } else {
    failed += batch.length;
    const detail = {
      400: "invalid request format",
      403: `key not valid — is ${ORIGIN}/${key}.txt live?`,
      422: "urls do not belong to the host, or the key does not match the schema",
      429: "too many requests — submitting too often",
    }[res.status] || (await res.text()).slice(0, 200);
    console.error(`  ! ${res.status} — ${detail}`);
  }
}

if (Object.keys(accepted).length) {
  writeFileSync(STATE, JSON.stringify({ submittedAt: new Date().toISOString(), pages: accepted }, null, 2) + "\n");
}

/* Deliberately exit 0. See FAILURE at the top: the deploy already succeeded. */
if (failed) console.error(`  ! ${failed} urls were not accepted; they will be retried on the next run.`);
