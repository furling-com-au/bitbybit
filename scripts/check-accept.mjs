/* Prove the Accept parser never serves Markdown to a browser.
 *
 * This is the one part of markdown negotiation that fails in public. Every
 * browser sends a wildcard somewhere in its Accept header - Chrome's ends
 * with "*\/*;q=0.8" - so the obvious implementation, "does this Accept
 * include something markdown-shaped?", answers YES for Chrome and serves a
 * raw .md file to a person instead of the page. A wildcard is a fallback,
 * never a request.
 *
 * The function is READ OUT OF src/worker.js at run time rather than copied
 * here, so this cannot quietly drift into testing a stale copy of the logic
 * while the deployed parser does something else.
 */
import { readFileSync } from "node:fs";

const src = readFileSync("src/worker.js", "utf8");
const m = src.match(/function acceptsMarkdown\(header\) \{[\s\S]*?\n\}/);
if (!m) {
  console.error("\n  ! acceptsMarkdown() not found in src/worker.js — it was renamed or");
  console.error("  ! removed, and markdown negotiation is now untested.\n");
  process.exit(1);
}
const acceptsMarkdown = new Function(`${m[0]}; return acceptsMarkdown;`)();

/* Real headers, copied from real clients. */
const CASES = [
  // must NOT get markdown — these are people
  ["text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7", false, "Chrome document"],
  ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false, "Safari"],
  ["text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", false, "Firefox"],
  ["*/*", false, "curl default"],
  ["text/*", false, "text wildcard only"],
  [null, false, "no Accept header"],
  ["", false, "empty Accept header"],
  ["text/html,text/markdown;q=0.5", false, "html preferred"],
  ["text/markdown;q=0,text/html", false, "markdown explicitly refused"],

  // must get markdown — these are agents
  ["text/markdown", true, "plain agent"],
  ["text/markdown; charset=utf-8", true, "agent with charset"],
  ["text/markdown,text/html;q=0.9", true, "agent prefers markdown"],
  ["text/markdown, */*;q=0.1", true, "markdown over wildcard"],
  ["text/html;q=0.9,text/markdown;q=0.9", true, "equal q favours markdown"],
  ["TEXT/MARKDOWN", true, "case insensitive"],
  ["  text/markdown ;  q=1.0 ", true, "tolerates whitespace"],
];

let failed = 0;
for (const [header, expected, label] of CASES) {
  const got = acceptsMarkdown(header);
  if (got !== expected) {
    failed++;
    console.error(`      ${label}: got ${got}, want ${expected}\n        ${JSON.stringify(header)}`);
  }
}

console.log(`accept parser: ${CASES.length} headers checked, ${failed} wrong`);

if (failed) {
  console.error("\n  ! The Accept parser is wrong. If a browser case failed, real people");
  console.error("  ! are being served raw Markdown instead of the page.\n");
  process.exit(1);
}
