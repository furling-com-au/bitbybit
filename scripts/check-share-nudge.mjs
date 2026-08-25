/* Fail the build if a tool calls shareNudge() without an edit token.
 *
 * Copy/Share is the ONLY observable moment between "someone made a thing"
 * and "someone else opened it". Without it, a cold-reach reading of zero has
 * three explanations that cannot be told apart - nobody created, or they
 * created and never handed the link over, or they handed it over and nobody
 * bit - and those need three different responses.
 *
 * A tool that forgets the second argument still renders and still works, and
 * the only symptom is a permanently silent funnel step. That is precisely the
 * kind of drift that goes unnoticed for months, so it is a build error.
 *
 * Also checks that the enclosing source actually has `row` in scope, because
 * the token is passed as row.edit_token and a typo there is a runtime
 * ReferenceError on the organiser page - the one page whose failure the
 * organiser cannot route around.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "src/tools";

/* Split a call's argument list on top-level commas only, so a comma inside
   a string, a template literal or a nested call does not read as a new
   argument. Every message in these calls is a template with commas in it. */
function topLevelArgs(src) {
  const args = [];
  let depth = 0, instr = null, start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (instr) {
      if (c === "\\") { i++; continue; }
      if (c === instr) instr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { instr = c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) { args.push(src.slice(start, i)); start = i + 1; }
  }
  args.push(src.slice(start));
  return args.map((a) => a.trim()).filter((a) => a.length);
}

const bad = [];
let calls = 0;

for (const name of readdirSync(DIR)) {
  if (!name.endsWith(".js")) continue;
  const src = readFileSync(join(DIR, name), "utf8");
  let i = 0;
  while ((i = src.indexOf("shareNudge(", i)) !== -1) {
    const open = i + "shareNudge(".length;
    let j = open, depth = 1, instr = null;
    while (j < src.length && depth) {
      const c = src[j];
      if (instr) {
        if (c === "\\") { j += 2; continue; }
        if (c === instr) instr = null;
      } else if (c === '"' || c === "'" || c === "`") instr = c;
      else if (c === "(") depth++;
      else if (c === ")") depth--;
      j++;
    }
    calls++;
    const args = topLevelArgs(src.slice(open, j - 1));
    const line = src.slice(0, i).split("\n").length;
    if (args.length < 2) bad.push(`${name}:${line}  no edit token passed`);
    else if (!/\bedit_token\b/.test(args[1])) bad.push(`${name}:${line}  second argument is not an edit token: ${args[1].slice(0, 40)}`);
    else if (/\brow\b/.test(args[1]) && !/\brow\b/.test(src.slice(0, i))) bad.push(`${name}:${line}  passes row.edit_token but 'row' is not in scope`);
    i = j;
  }
}

/* The bare-link Copy button is instrumented by a delegated listener that
   shareNudge injects, so a tool rendering id="copyBtn" WITHOUT also calling
   shareNudge would have a share button that silently records nothing. */
for (const name of readdirSync(DIR)) {
  if (!name.endsWith(".js")) continue;
  const src = readFileSync(join(DIR, name), "utf8");
  if (/id="copyBtn"/.test(src) && !src.includes("shareNudge("))
    bad.push(`${name}  renders id="copyBtn" but never calls shareNudge, so the copy is never recorded`);
}

console.log(`share nudge: ${calls} calls checked, ${bad.length} missing an edit token`);

if (bad.length) {
  console.error("\n  ! shareNudge() needs the instance's edit token as its second");
  console.error("  ! argument. Without it the Copy/Share beacon never fires and the");
  console.error("  ! share step of the funnel is silently unmeasurable.\n");
  for (const b of bad) console.error(`      ${b}`);
  console.error("");
  process.exit(1);
}
