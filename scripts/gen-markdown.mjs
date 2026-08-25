/* Build a clean Markdown twin of every public page, for Accept: text/markdown.
 *
 * Generated at build time rather than converted in the Worker, for the same
 * reason every other generator here runs at build time: the output lands in
 * git where it can be read and diffed, it costs nothing per request, and the
 * conversion is exact rather than a best-effort strip of whatever HTML the
 * page happened to render.
 *
 * The point is a clean READ, not a faithful transcription of the page. So the
 * interactive machinery is dropped entirely - the builder form, its presets
 * and status lines, the decorative pixel art, the site chrome - and what is
 * left is the prose an agent actually wants: what the tool is, how it works,
 * and the guide content underneath. A form serialised into Markdown is noise;
 * nobody can submit it.
 *
 * Capability URLs (/s/, /e/, /p/) deliberately get NO markdown twin. They are
 * Disallow-ed in robots.txt and the privacy page tells people those pages are
 * not indexed; adding a second representation would quietly widen the exposure
 * of content someone shared with their group, not with the web.
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const ORIGIN = "https://bitibybit.com";

/* Whole subtrees that never survive into the markdown. */
const SKIP_TAGS = new Set(["script", "style", "form", "button", "input",
  "textarea", "select", "option", "svg", "nav", "header", "footer", "img",
  "picture", "source", "iframe", "noscript"]);

/* Same, keyed on class. These hold interactive or decorative machinery whose
   tag alone does not give them away. */
const SKIP_CLASSES = new Set(["scanlines", "builder", "tool-hero-art",
  "prev-sweeps", "status-line", "form-error", "foot-links", "site-foot",
  "site-head", "beta-badge", "wordmark-blocks", "share-nudge", "one-tap"]);

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "source"]);

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", times: "×",
  rarr: "→", larr: "←", uarr: "↑", darr: "↓", harr: "↔",
  bull: "•", dagger: "†", pound: "£", euro: "€", cent: "¢",
  frac12: "½", frac14: "¼", frac34: "¾", plusmn: "±", ne: "≠",
  le: "≤", ge: "≥", trade: "™", reg: "®", sect: "§",
  laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", deg: "°", middot: "·",
  eacute: "é", egrave: "è", uuml: "ü", copy: "©",
};

function decode(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X"
        ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, e) ? ENTITIES[e] : m;
  });
}

/* Tolerant parser. It only has to cope with markup this repo generates, which
   is well formed - but it still tracks quotes inside attributes so a '>' in an
   alt or title cannot end the tag early. */
function parse(html) {
  const root = { tag: "#root", attrs: "", children: [] };
  const stack = [root];
  let i = 0;

  const pushText = (t) => {
    if (t) stack[stack.length - 1].children.push({ tag: "#text", text: t });
  };

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) { pushText(html.slice(i)); break; }
    if (lt > i) pushText(html.slice(i, lt));

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    // find the tag's closing '>', respecting quoted attribute values
    let j = lt + 1, quote = null;
    while (j < html.length) {
      const c = html[j];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
      j++;
    }
    const raw = html.slice(lt + 1, j);
    i = j + 1;

    if (raw[0] === "/") {
      const name = raw.slice(1).trim().toLowerCase();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === name) { stack.length = k; break; }
      }
      continue;
    }

    const sm = raw.match(/^([a-zA-Z][\w-]*)/);
    if (!sm) continue;
    const tag = sm[1].toLowerCase();
    const node = { tag, attrs: raw.slice(sm[1].length), children: [] };
    stack[stack.length - 1].children.push(node);

    /* script and style hold text that is not markup; skip straight to the
       close tag so an unescaped '<' inside them cannot corrupt the tree. */
    if (tag === "script" || tag === "style") {
      const close = html.toLowerCase().indexOf("</" + tag, i);
      i = close === -1 ? html.length : close;
      continue;
    }
    if (!VOID.has(tag) && !raw.trimEnd().endsWith("/")) stack.push(node);
  }
  return root;
}

const classOf = (n) => (n.attrs ? (n.attrs.match(/class="([^"]*)"/) || ["", ""])[1] : "");
const attrOf = (n, name) =>
  (n.attrs ? (n.attrs.match(new RegExp(name + '="([^"]*)"')) || ["", ""])[1] : "");

function skipped(n) {
  if (SKIP_TAGS.has(n.tag)) return true;
  return classOf(n).split(/\s+/).some((c) => SKIP_CLASSES.has(c));
}

/* Inline rendering: everything that lives inside a paragraph or a cell. */
function inline(node) {
  if (node.tag === "#text") return decode(node.text).replace(/\s+/g, " ");
  if (skipped(node)) return "";
  const kids = () => node.children.map(inline).join("");
  switch (node.tag) {
    case "br": return "  \n";
    case "strong": case "b": {
      const t = kids().trim();
      return t ? "**" + t + "**" : "";
    }
    case "em": case "i": {
      const t = kids().trim();
      return t ? "*" + t + "*" : "";
    }
    case "code": {
      const t = kids().trim();
      return t ? "`" + t + "`" : "";
    }
    case "a": {
      const t = kids().trim();
      if (!t) return "";
      let href = decode(attrOf(node, "href"));
      if (!href) return t;
      if (href.startsWith("#")) return t;            // in-page jump: no value here
      if (href.startsWith("/")) href = ORIGIN + href;
      return "[" + t + "](" + href + ")";
    }
    default: return kids();
  }
}

const clean = (s) => s.replace(/[ \t]+/g, " ").replace(/ +([.,;:!?])/g, "$1").trim();

function textOf(n) {
  if (n.tag === "#text") return n.text;
  if (skipped(n)) return "";
  return n.children.map(textOf).join("");
}

function collectRows(node, rows) {
  if (!node.children) return;                        // text nodes have none
  for (const c of node.children) {
    if (c.tag === "#text" || skipped(c)) continue;
    if (c.tag === "tr") {
      const cells = c.children
        .filter((x) => x.tag === "td" || x.tag === "th")
        .map((x) => clean(x.children.map(inline).join("")).replace(/\|/g, "\\|"));
      if (cells.length) rows.push(cells);
    } else collectRows(c, rows);
  }
}

/* Block rendering. Pushes finished markdown blocks onto `out`. */
function block(node, out) {
  if (node.tag === "#text") {
    const t = clean(decode(node.text));
    if (t) out.push(t);
    return;
  }
  if (skipped(node)) return;

  switch (node.tag) {
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
      const t = clean(node.children.map(inline).join(""));
      if (t) out.push("#".repeat(Number(node.tag[1])) + " " + t);
      return;
    }
    case "p": {
      const t = clean(node.children.map(inline).join(""));
      if (t) out.push(t);
      return;
    }
    case "ul": case "ol": {
      const lines = [];
      let n = 0;
      for (const li of node.children.filter((c) => c.tag === "li")) {
        const own = li.children.filter((c) => c.tag !== "ul" && c.tag !== "ol");
        const t = clean(own.map(inline).join(""));
        if (t) lines.push((node.tag === "ol" ? ++n + ". " : "- ") + t);
        for (const sub of li.children.filter((c) => c.tag === "ul" || c.tag === "ol")) {
          const nested = [];
          block(sub, nested);
          for (const b of nested) for (const l of b.split("\n")) lines.push("  " + l);
        }
      }
      if (lines.length) out.push(lines.join("\n"));
      return;
    }
    case "pre": {
      const t = decode(node.children.map(textOf).join("")).replace(/^\n+|\n+$/g, "");
      if (t) out.push("```\n" + t + "\n```");
      return;
    }
    case "table": {
      const rows = [];
      collectRows(node, rows);
      if (!rows.length) return;
      const width = Math.max(...rows.map((r) => r.length));
      const pad = (r) => { const c = r.slice(); while (c.length < width) c.push(""); return c; };
      const lines = ["| " + pad(rows[0]).join(" | ") + " |",
                     "| " + Array(width).fill("---").join(" | ") + " |"];
      for (const r of rows.slice(1)) lines.push("| " + pad(r).join(" | ") + " |");
      out.push(lines.join("\n"));
      return;
    }
    default:
      for (const c of node.children) block(c, out);
  }
}

/* An approximate token count, so an agent can decide whether to spend the
   fetch. Words plus punctuation runs, which tracks real tokenisers far better
   than chars/4 on prose like this. Approximate is the honest word: this is not
   a BPE tokeniser and the header must not be read as one. */
function approxTokens(md) {
  const m = md.match(/[A-Za-z0-9']+|[^\sA-Za-z0-9']/g);
  return m ? m.length : 0;
}

function toMarkdown(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const body = main
    ? main[1]
    : (html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i) || ["", html])[1];
  const out = [];
  block(parse(body), out);

  /* Pages open with a kicker line above the <h1> ("Free · no signup · …").
     It is real content, but a document whose first line is not its title
     reads as broken markdown, so the title is promoted above it. */
  const h1 = out.findIndex((b) => b.startsWith("# "));
  if (h1 > 0 && !out.slice(0, h1).some((b) => b.startsWith("#"))) {
    out.unshift(...out.splice(h1, 1));
  }

  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".wrangler"]);
function walkDir(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { walkDir(full, out); continue; }
    if (name === "index.html") out.push(full);
  }
  return out;
}

let written = 0, tokens = 0;
const pages = walkDir("public");
for (const file of pages) {
  const md = toMarkdown(readFileSync(file, "utf8"));
  const target = join(dirname(file), "index.md");
  let prev = null;
  try { prev = readFileSync(target, "utf8"); } catch { /* first run */ }
  if (prev !== md) { writeFileSync(target, md, { encoding: "utf8" }); written++; }
  tokens += approxTokens(md);
}
console.log(`markdown: ${pages.length} pages, ${written} rewritten, ~${tokens.toLocaleString()} tokens total`);

/* An entity the decoder does not know survives as literal "&rarr;" in text a
   model will read back as those six characters. Enumerating every entity in
   HTML5 is not the answer; failing loudly the first time an unknown one is
   used is, because then the map only ever needs the entities this site
   actually writes. */
const stray = new Map();
for (const file of pages) {
  const md = readFileSync(join(dirname(file), "index.md"), "utf8");
  for (const e of md.match(/&[a-zA-Z][a-zA-Z0-9]*;/g) || []) {
    const where = relative("public", dirname(file)).replace(/\\/g, "/") || "(home)";
    if (!stray.has(e)) stray.set(e, new Set());
    stray.get(e).add(where);
  }
}
if (stray.size) {
  console.error("\n  ! Undecoded HTML entities reached the markdown. Add them to");
  console.error("  ! ENTITIES in this script - a reader sees the raw '&name;'.\n");
  for (const [e, where] of stray) {
    console.error(`      ${e}  in ${[...where].slice(0, 4).join(", ")}${where.size > 4 ? ` and ${where.size - 4} more` : ""}`);
  }
  console.error("");
  process.exit(1);
}

/* A page that converts to almost nothing means the skip rules ate the real
   content - far more likely than the conversion throwing, and invisible
   unless something checks. */
const thin = pages
  .map((f) => [relative("public", dirname(f)).replace(/\\/g, "/") || "(home)",
               readFileSync(join(dirname(f), "index.md"), "utf8")])
  .filter((pair) => pair[1].trim().length < 200);
if (thin.length) {
  console.error("\n  ! These pages produced almost no markdown, which usually means a");
  console.error("  ! skip rule matched real content rather than page furniture.\n");
  for (const pair of thin) console.error(`      ${pair[0]}  (${pair[1].trim().length} chars)`);
  console.error("");
  process.exit(1);
}
