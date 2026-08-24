/* ============================================================
   Shared helpers for every tool module.
   ============================================================ */

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const html = (markup, status = 200, extra = {}) =>
  new Response(markup, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "no-store",
      ...extra,
    },
  });

export function randomString(len, alphabet = "abcdefghjkmnpqrstuvwxyz23456789") {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function rand(n) {
  // Rejection sampling — unbiased, unlike modulo.
  const max = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= max);
  return x % n;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* Readable slugs: friendly to paste in a group chat, random enough
   not to be guessable in bulk. Tools pass their own noun list. */
const SLUG_ADJ = ["swift", "lucky", "plucky", "rowdy", "tidy", "bold", "spare",
  "handy", "keen", "solid", "bright", "cheeky", "quiet", "rapid", "wily"];

export function newSlug(nouns) {
  return `${SLUG_ADJ[rand(SLUG_ADJ.length)]}-${nouns[rand(nouns.length)]}-${randomString(4)}`;
}

export function badInput(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

/* ---------- data access ------------------------------------- */

export const getBySlug = (env, slug) =>
  env.DB.prepare("SELECT * FROM instances WHERE slug = ?").bind(slug).first();

export const getByToken = (env, token) =>
  env.DB.prepare("SELECT * FROM instances WHERE edit_token = ?").bind(token).first();

export const getParticipant = (env, token) =>
  env.DB.prepare("SELECT * FROM participants WHERE token = ?").bind(token).first();

export const getInstanceById = (env, id) =>
  env.DB.prepare("SELECT * FROM instances WHERE id = ?").bind(id).first();

export async function logEvent(env, instanceId, toolType, kind) {
  await env.DB.prepare(
    "INSERT INTO events (instance_id, tool_type, kind, created_at) VALUES (?, ?, ?, ?)"
  ).bind(instanceId, toolType, kind, new Date().toISOString()).run();
}

/**
 * Insert an instance with a fresh slug + edit token, retrying slug
 * collisions. Returns { id, slug, editToken }.
 */
export async function createInstance(env, { toolType, title, data, nouns }) {
  const editToken = randomString(26);
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = newSlug(nouns);
    try {
      const res = await env.DB.prepare(
        `INSERT INTO instances (slug, edit_token, tool_type, title, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(slug, editToken, toolType, title, data, now, now).run();
      return { id: res.meta.last_row_id, slug, editToken };
    } catch (e) {
      if (!/UNIQUE/.test(String(e))) throw e;
    }
  }
  throw new Error("Could not allocate a link — try again.");
}

export async function updateInstanceData(env, id, data) {
  await env.DB.prepare("UPDATE instances SET data = ?, updated_at = ? WHERE id = ?")
    .bind(data, new Date().toISOString(), id).run();
}

/** Delete an instance and everything hanging off it. */
export async function deleteInstance(env, id) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM claims WHERE instance_id = ?").bind(id),
    env.DB.prepare("DELETE FROM participants WHERE instance_id = ?").bind(id),
    env.DB.prepare("DELETE FROM instances WHERE id = ?").bind(id),
  ]);
}

/* ---------- page shell -------------------------------------- */

export function pageShell({ title, body }) {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — bitibybit.com</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f4ead8">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="scanlines" aria-hidden="true"></div>
<header class="site-head wrap">
  <a class="wordmark" href="/" aria-label="bitibybit.com — home">
    <span class="wordmark-blocks" aria-hidden="true"><i></i><i></i><i></i></span>
    bitibybit.com
  </a>
</header>
${body}
</body>
</html>`;
}

export async function notFoundPage(env) {
  const asset = await env.ASSETS.fetch(new Request("https://assets.local/404.html"));
  return new Response(asset.body, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
  });
}

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
