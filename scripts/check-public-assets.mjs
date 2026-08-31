/* Fail the build if something that is not web content is sitting in public/.
 *
 * Wrangler serves every file under public/ as a static asset. It does NOT read
 * .gitignore, and this was not theoretical: a dev-server log left in public/
 * was deployed on 31 August 2026 and served at bitibybit.com/server.log until
 * it was noticed. Nothing failed, nothing warned - the deploy said "Success"
 * and uploaded it with the rest.
 *
 * The contents were harmless that time. The near miss was backups/, which held
 * 41 organiser edit_tokens and 128 participant names in plaintext; had it been
 * dropped one directory over, the same silent path would have published every
 * credential on the site.
 *
 * public/.assetsignore is the only thing that stops a deploy. This checks that
 * it is doing its job, because an ignore file is exactly the kind of thing that
 * gets a rule deleted during an unrelated change and is never missed.
 *
 * Deliberately an EXTENSION DENYLIST, not an allowlist of web types. An
 * allowlist fails the build every time someone adds a legitimate new file type
 * - a font, a video, a .well-known document with no extension at all - and a
 * check that cries wolf is one people learn to route around. These are the
 * extensions that are never a deliberate publish.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";

const PUB = "public";
const IGNORE_FILE = join(PUB, ".assetsignore");

/* Never a thing you meant to put on the internet. */
const NEVER_PUBLIC = [
  ".log", ".sql", ".sqlite", ".db", ".bak", ".swp", ".env",
  ".zip", ".tar", ".gz", ".tgz", ".pem", ".key", ".p12", ".jsonl",
];

/* .assetsignore is gitignore-flavoured. Only the two forms actually used here
   are supported - a bare name and a `*.ext` glob - and anything more elaborate
   is reported rather than silently treated as "covered", so a rule this script
   cannot read can never be mistaken for protection it is not giving. */
function readIgnore() {
  if (!existsSync(IGNORE_FILE)) return { globs: [], names: [], unreadable: [] };
  const globs = [], names = [], unreadable = [];
  for (const raw of readFileSync(IGNORE_FILE, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^\*\.[A-Za-z0-9]+$/.test(line)) globs.push(line.slice(1).toLowerCase());
    else if (!/[*?[\]!/]/.test(line)) names.push(line.toLowerCase());
    else unreadable.push(line);
  }
  return { globs, names, unreadable };
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const ignore = readIgnore();
const problems = [];
let scanned = 0, covered = 0;

for (const file of walk(PUB)) {
  scanned++;
  const name = basename(file).toLowerCase();
  const ext = NEVER_PUBLIC.find((e) => name.endsWith(e));
  if (!ext) continue;

  if (ignore.globs.includes(ext) || ignore.names.includes(name)) { covered++; continue; }
  problems.push(
    `${relative(".", file).replace(/\\/g, "/")} would be published at ` +
    `https://bitibybit.com/${relative(PUB, file).replace(/\\/g, "/")}`);
}

for (const line of ignore.unreadable) {
  problems.push(`.assetsignore rule "${line}" is more than this check can read — it may not be protecting what you think`);
}

console.log(`public assets: ${scanned} files scanned, ${covered} held back by .assetsignore, ${problems.length} exposed`);

if (problems.length) {
  console.error("\n  ! Something in public/ would be served to the internet.\n");
  for (const p of problems) console.error(`      ${p}`);
  console.error("\n  ! Move it out of public/, or add a rule to public/.assetsignore.");
  console.error("  ! .gitignore does NOT stop a deploy — only .assetsignore does.\n");
  process.exit(1);
}
