/* ============================================================
   Generates the three machine- and human-readable descriptions of
   the API from ONE source of truth (scripts/api-tools.json):

     public/.well-known/api-catalog   RFC 9727 linkset  (discovery)
     public/openapi.json              OpenAPI 3.1       (machines)
     public/api-docs/index.html       a real page       (humans)

   Run: node scripts/gen-api-docs.mjs

   They are generated together because a catalog that disagrees with
   the spec is worse than no catalog at all — an agent that follows a
   stale field name gets a 400 and no explanation.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ORIGIN = "https://bitibybit.com";
const TOOLS = JSON.parse(readFileSync("scripts/api-tools.json", "utf8")).tools;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 1. the RFC 9727 API catalog ----------------------
   Structure is RFC 9264 Section 4.2 and the traps are all cardinality:
   `linkset` MUST be an array even with one member; every relation key
   MUST be an ARRAY of objects even with one target; the URL key is
   `href` and nothing else; `type` MUST be a bare string, not an array.
   The object must contain `linkset` as its SOLE member — no version,
   no generated-at, no metadata. Those go in the Content-Type profile
   parameter, which is set in public/_headers.

   Note: RFC 9727 Section 5.1's own inline example is malformed (it
   writes "api-catalog" as a bare string) — that is Errata ID 9009.
   Appendix A.4 is the correct form and is what this follows. */
function apiCatalog() {
  const contexts = TOOLS.map((t) => ({
    anchor: `${ORIGIN}${t.createPath}`,
    "service-desc": [{ href: `${ORIGIN}/openapi.json`, type: "application/json" }],
    "service-doc": [{ href: `${ORIGIN}/api-docs/#${t.toolType}`, type: "text/html" }],
  }));

  // A catalog-level context listing every API as an `item` (RFC 6573),
  // which is the shape RFC 9727 Appendix A.2 shows.
  contexts.unshift({
    anchor: `${ORIGIN}/.well-known/api-catalog`,
    item: TOOLS.map((t) => ({ href: `${ORIGIN}${t.createPath}` })),
    "service-desc": [{ href: `${ORIGIN}/openapi.json`, type: "application/json" }],
    "service-doc": [{ href: `${ORIGIN}/api-docs/`, type: "text/html" }],
    "service-meta": [{ href: `${ORIGIN}/auth.md`, type: "text/markdown" }],
  });

  return { linkset: contexts };
}

/* ---------- 2. OpenAPI 3.1 ---------------------------------- */
function schemaFor(field) {
  const base = { description: field.description || field.constraints };
  if (field.type === "string[]") return { ...base, type: "array", items: { type: "string" } };
  if (field.type === "number") return { ...base, type: "number" };
  if (field.type === "boolean") return { ...base, type: "boolean" };
  if (field.type === "object") return { ...base, type: "object" };
  return { ...base, type: "string" };
}

function openapi() {
  const paths = {};
  for (const t of TOOLS) {
    const props = {};
    const required = [];
    for (const f of t.fields) {
      props[f.name] = schemaFor(f);
      if (f.required) required.push(f.name);
    }
    const body = { type: "object", properties: props };
    if (required.length) body.required = required;

    let example;
    try { example = JSON.parse(t.exampleRequestBody); } catch { example = undefined; }

    paths[t.createPath] = {
      post: {
        operationId: `create${t.toolType[0].toUpperCase()}${t.toolType.slice(1)}`,
        summary: `Create a ${t.displayName}`,
        description:
          `${t.summary}\n\n` +
          `No authentication. The response returns the two capability URLs for the ` +
          `thing you just created: share \`/s/{slug}\` with the group, and keep ` +
          `\`/e/{editToken}\` for whoever is organising.\n\n` +
          (t.participantFlow ? `**How people take part:** ${t.participantFlow}\n\n` : "") +
          `Human page: ${ORIGIN}${t.landingPath}`,
        tags: [t.displayName],
        requestBody: {
          required: true,
          content: { "application/json": { schema: body, ...(example ? { example } : {}) } },
        },
        responses: {
          201: { $ref: "#/components/responses/Created" },
          400: { $ref: "#/components/responses/BadRequest" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "biti by bit",
      version: "1.0.0",
      summary: "Create small group-organising tools — sweeps, gift registries, meal trains — with no account.",
      description:
        `Small free tools for organising groups of people. An agent can create any of ` +
        `them on a person's behalf in a single unauthenticated POST.\n\n` +
        `## No accounts\n\n` +
        `There is no login, no API key and no OAuth. Creating a resource is the only ` +
        `registration step there is, and it hands you back two unguessable URLs:\n\n` +
        `- \`/s/{slug}\` — the public link. Give this to the group.\n` +
        `- \`/e/{editToken}\` — organiser control. Give this to the person organising, and to nobody else.\n\n` +
        `Possession of a URL is the entire authorisation. Full detail: ${ORIGIN}/auth.md\n\n` +
        `## Scope of this document\n\n` +
        `This describes the **create** endpoints — the ones an agent acting for a user ` +
        `actually needs. Each tool also exposes participation and organiser endpoints ` +
        `behind its slug or edit token (claim, vote, sign, reset, delete); those are ` +
        `linked from the pages the create call returns, and are described at ${ORIGIN}/auth.md\n\n` +
        `## Rate limits\n\n` +
        `Per IP, per clock hour: **20** creates, **240** other POSTs. Over the limit is a ` +
        `\`429\`. Back off rather than retrying.\n\n` +
        `## Please don't\n\n` +
        `Create instances speculatively — each one is a real row in a real database. ` +
        `Create when a person actually asks for one.`,
      license: { name: "MIT", url: "https://github.com/furling-com-au/bitbybit/blob/main/LICENSE" },
      contact: { name: "Source on GitHub", url: "https://github.com/furling-com-au/bitbybit" },
    },
    servers: [{ url: ORIGIN }],
    externalDocs: { description: "Human documentation", url: `${ORIGIN}/api-docs/` },
    tags: TOOLS.map((t) => ({
      name: t.displayName,
      description: t.summary,
      externalDocs: { url: `${ORIGIN}${t.landingPath}` },
    })),
    paths,
    components: {
      responses: {
        Created: {
          description: "Created. Both capability URLs for the new instance.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["slug", "editToken"],
                properties: {
                  slug: {
                    type: "string",
                    description: "Public share link is /s/{slug}. Safe to give to the whole group.",
                    example: "lucky-wombat-4kq2m9xrbt7vec",
                  },
                  editToken: {
                    type: "string",
                    description: "Organiser link is /e/{editToken}. Secret — treat it like an API key.",
                    example: "h3n8pquzr4wmd2fkjt6xayb95s",
                  },
                },
              },
            },
          },
        },
        BadRequest: {
          description: "Validation failed. The `error` string is written for humans — show it to the user.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { error: { type: "string" } },
              },
              example: { error: "Add at least two names." },
            },
          },
        },
        RateLimited: {
          description: "Too many requests from this IP this hour.",
          content: {
            "application/json": {
              schema: { type: "object", properties: { error: { type: "string" } } },
            },
          },
        },
      },
    },
  };
}

/* ---------- 3. the human page ------------------------------- */
function docsPage() {
  const rows = TOOLS.map((t) => {
    const fields = t.fields.map((f) => `
        <tr>
          <td><code>${esc(f.name)}</code></td>
          <td><code>${esc(f.type)}</code></td>
          <td>${f.required ? "<strong>required</strong>" : "optional"}</td>
          <td>${esc(f.constraints)}</td>
        </tr>`).join("");

    const errs = (t.errorResponses || []).map((e) =>
      `<li><code>${e.status}</code> — ${esc(e.when)}${e.message ? ` <span class="msg">“${esc(e.message)}”</span>` : ""}</li>`
    ).join("");

    let pretty = t.exampleRequestBody;
    try { pretty = JSON.stringify(JSON.parse(t.exampleRequestBody), null, 2); } catch { /* leave as-is */ }

    return `
  <section class="api-tool" id="${esc(t.toolType)}">
    <h3>${esc(t.displayName)}</h3>
    <p>${esc(t.summary)} — <a href="${esc(t.landingPath)}">human page</a></p>
    <p class="endpoint"><span class="verb">POST</span> <code>${esc(t.createPath)}</code></p>
    <div class="table-scroll">
      <table class="api-table">
        <thead><tr><th>Field</th><th>Type</th><th></th><th>Rules</th></tr></thead>
        <tbody>${fields}</tbody>
      </table>
    </div>
    <p class="eg-label">Example</p>
    <pre class="eg"><code>${esc(pretty)}</code></pre>
    ${errs ? `<p class="eg-label">Errors</p><ul class="errs">${errs}</ul>` : ""}
    ${t.participantFlow ? `<p class="flow"><strong>How people take part:</strong> ${esc(t.participantFlow)}</p>` : ""}
  </section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API — create any tool in one request | biti by bit</title>
<meta name="description" content="A free, no-account API for creating group tools — sweeps, registries, meal trains, polls. One POST returns a share link and an organiser link.">
<link rel="canonical" href="${ORIGIN}/api-docs/">
<meta property="og:title" content="biti by bit API — no account, one request">
<meta property="og:description" content="Create a sweep, a registry, a meal train or a poll with a single unauthenticated POST. No API key, no OAuth.">
<meta property="og:image" content="${ORIGIN}/art/og-home.png">
<meta property="og:type" content="article">
<meta property="og:url" content="${ORIGIN}/api-docs/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="biti by bit API — no account, one request">
<meta name="twitter:description" content="Create a sweep, a registry, a meal train or a poll with a single unauthenticated POST.">
<meta name="twitter:image" content="${ORIGIN}/art/og-home.png">
<meta name="theme-color" content="#f4ead8">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/styles.css">
<style>
  .api-tool { margin: 2.4rem 0; padding-top: 1.4rem; border-top: 3px solid var(--line); }
  .api-tool h3 { margin: 0 0 .3rem; }
  .endpoint { margin: .8rem 0; font-size: .85rem; }
  .verb { display: inline-block; background: var(--ink); color: var(--paper);
    padding: .12rem .5rem; font-size: .7rem; letter-spacing: .1em; margin-right: .4rem; }
  .table-scroll { overflow-x: auto; }
  .api-table { width: 100%; border-collapse: collapse; font-size: .78rem; margin: .6rem 0 1rem; }
  .api-table th { text-align: left; font-size: .68rem; letter-spacing: .1em;
    text-transform: uppercase; color: var(--ink-faint); padding: .3rem .6rem .3rem 0; }
  .api-table td { padding: .4rem .6rem .4rem 0; border-top: 1px solid var(--line);
    vertical-align: top; color: var(--ink-soft); }
  .api-table code { font-size: .76rem; color: var(--ink); }
  .eg-label { font-size: .68rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-faint); margin: 1rem 0 .3rem; }
  pre.eg { background: var(--paper-2); border-left: 5px solid var(--gold);
    padding: .7rem .9rem; overflow-x: auto; font-size: .78rem; line-height: 1.5; margin: 0 0 .6rem; }
  .errs { font-size: .8rem; color: var(--ink-soft); margin: .2rem 0 1rem; }
  .errs .msg { color: var(--ink-faint); }
  .flow { font-size: .82rem; color: var(--ink-soft); }
  .toc { columns: 2; column-gap: 2rem; font-size: .82rem; margin: 1rem 0 2rem; padding: 0; list-style: none; }
  .toc li { margin: 0 0 .25rem; break-inside: avoid; }
</style>
</head>
<body>
<div class="scanlines" aria-hidden="true"></div>
<header class="site-head wrap">
  <a class="wordmark" href="/" aria-label="biti by bit — home">
    <span class="wordmark-blocks" aria-hidden="true"><i></i><i></i><i></i></span>
    biti by bit
    <span class="beta-badge">beta</span>
  </a>
  <nav class="site-nav"><a href="/#tools">the tools</a></nav>
</header>

<main class="wrap page">
  <p class="kicker">For agents and developers</p>
  <h1>The API</h1>
  <p class="lede">Every tool on this site can be created in one HTTP request,
  with no account, no API key and no OAuth. You get back two links: one to share
  with the group, one for whoever is organising.</p>

  <section class="content">
    <h2>How it works</h2>
    <p>POST to a tool's create endpoint. You get <code>201</code> and two
    strings:</p>
    <pre class="eg"><code>{ "slug": "lucky-wombat-4kq2m9xrbt7vec",
  "editToken": "h3n8pquzr4wmd2fkjt6xayb95s" }</code></pre>
    <ul>
      <li><code>/s/{slug}</code> — the share link. This is the one that goes in
      the group chat.</li>
      <li><code>/e/{editToken}</code> — organiser control: edit, reset, redraw,
      export, delete. Secret. Treat it like an API key.</li>
    </ul>
    <p>Possession of a URL is the whole authorisation — there is nothing to log
    in to and no identity attached. If you are building against this, read
    <a href="/auth.md">auth.md</a> for the full model, including revocation.</p>
    <p>Machine-readable: <a href="/openapi.json">openapi.json</a> ·
    <a href="/.well-known/api-catalog">API catalog</a> (RFC 9727) ·
    <a href="/llms.txt">llms.txt</a></p>

    <h2>Rate limits</h2>
    <p>Per IP, per clock hour: <strong>20</strong> creates and
    <strong>240</strong> other POSTs. Over the limit is a <code>429</code>.
    There is no key that raises this. Please don't create instances
    speculatively — each one is a real row in a real database.</p>

    <h2>Errors</h2>
    <p><code>400</code> validation failed (the <code>error</code> string is
    written for a human — show it to them), <code>404</code> unknown link or
    unknown resource, <code>409</code> someone took that slot first,
    <code>429</code> rate limited. There is no <code>401</code> or
    <code>403</code>, because there is no identity to reject.</p>

    <h2>The tools</h2>
    <ul class="toc">
${TOOLS.map((t) => `      <li><a href="#${esc(t.toolType)}">${esc(t.displayName)}</a></li>`).join("\n")}
    </ul>
${rows}
  </section>

  <footer class="site-foot">
    <p class="fine">Part of <a class="quiet-link" href="/">biti by bit</a> —
    small free tools for groups. No ads, no accounts.</p>
    <p class="foot-links">
      <a class="foot-link" href="https://buy.stripe.com/00wbJ1bri8J2c0yf8mbsc02" target="_blank" rel="noopener">☕ Buy me a coffee</a>
      <a class="foot-link" href="https://github.com/furling-com-au/bitbybit" target="_blank" rel="noopener">◆ Source on GitHub</a>
    </p>
  </footer>
</main>
<!-- Cloudflare Web Analytics: no cookies, no fingerprinting, aggregate only.
     Public pages ONLY — never on /s/, /e/ or /p/. -->
<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "7df4259a0571411390aec9252ecc4f3e"}'></script>
</body>
</html>
`;
}

/* ---------- write ------------------------------------------- */
mkdirSync("public/.well-known", { recursive: true });
mkdirSync("public/api-docs", { recursive: true });

writeFileSync("public/.well-known/api-catalog", JSON.stringify(apiCatalog(), null, 1) + "\n", "utf8");
writeFileSync("public/openapi.json", JSON.stringify(openapi(), null, 2) + "\n", "utf8");
writeFileSync("public/api-docs/index.html", docsPage(), "utf8");

console.log(`api-catalog : ${TOOLS.length + 1} link contexts`);
console.log(`openapi.json: ${TOOLS.length} paths`);
console.log(`api-docs    : ${TOOLS.length} tools documented`);
