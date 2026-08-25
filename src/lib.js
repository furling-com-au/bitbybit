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

/* Slugs are capability URLs: whoever holds /s/:slug is treated as an
   invited guest (the gift registry reveals payment details to anyone
   with the slug, by design — the couple shares it). So the random
   part MUST be long enough that the whole space can't be enumerated.
   The two readable words are for humans; the 14-char random tail is
   the security boundary — 31^14 ≈ 2^69, far past brute force even
   with the read endpoints unthrottled. Do NOT shorten it. */
const SLUG_ADJ = ["swift", "lucky", "plucky", "rowdy", "tidy", "bold", "spare",
  "handy", "keen", "solid", "bright", "cheeky", "quiet", "rapid", "wily"];

export function newSlug(nouns) {
  return `${SLUG_ADJ[rand(SLUG_ADJ.length)]}-${nouns[rand(nouns.length)]}-${randomString(14)}`;
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

/* "Has this person actually looked at their draw yet?" — shown as a
   tick on the organiser page so they know who still needs chasing.

   This deliberately does NOT run on the GET of /p/:token. Link-preview
   fetchers request any URL the moment it is pasted into a chat, and
   Slack states outright that it ignores robots.txt, so a participant
   who pasted their own private link into a DM would mark themselves as
   viewed without ever reading it. The organiser sees a tick, stops
   chasing, and someone turns up to the gift exchange empty-handed.

   So the tick is set by a small call from the page instead. No preview
   fetcher runs JavaScript, which makes this robust against all of them
   rather than only the ones we thought to name in a blocklist.

   Unknown tokens get the same {ok:true} as real ones — this must not
   become an oracle for testing whether a token exists. */
export async function markViewed(env, token) {
  if (token) {
    await env.DB.prepare(
      "UPDATE participants SET viewed_at = ? WHERE token = ? AND viewed_at IS NULL"
    ).bind(new Date().toISOString(), token).run();
  }
  return json({ ok: true });
}

/* Drop this into any participant page that tracks a viewed tick. */
export const viewedBeacon = (token) => `
<script>
fetch("/api/viewed/${token}", { method: "POST", keepalive: true }).catch(function () {});
</script>`;

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


/* A paste-ready group-chat message on organiser pages. The share
   link is the product's whole distribution channel; this writes the
   message so the organiser doesn't have to. */
export function shareNudge(message) {
  return `
  <div class="share-nudge">
    <span class="share-label">Paste-ready for the group chat</span>
    <div class="share-row">
      <textarea id="nudgeText" class="nudge-text" rows="2" readonly>${esc(message)}</textarea>
      <button class="btn" id="nudgeCopy" type="button">Copy</button>
    </div>
  </div>
  <script>
  document.getElementById("nudgeCopy").addEventListener("click", function () {
    var t = document.getElementById("nudgeText");
    t.select();
    navigator.clipboard.writeText(t.value).then(function () {
      var b = document.getElementById("nudgeCopy");
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy"; }, 1500);
    });
  });
  </script>`;
}

/* ---------- share cards ------------------------------------- */

/* Pasting the link into a group chat IS the distribution model, so the
   preview card is the product's front door. Slack, Teams, Discord,
   WhatsApp, Signal and iMessage all read the same Open Graph tags —
   one set of tags lands on every one of them.

   THE RULE FOR EVERY LINE BELOW: a /s/ link is a capability URL, and
   the card is rendered to everyone in whatever channel it lands in,
   then cached on someone else's servers (Slack keeps it ~30 minutes).
   So a card may carry the tool and the organiser's own title, and
   nothing else. No participant names, no tallies, no results, no
   drawn names, no payment details, no addresses. If you are tempted
   to make a card more useful by putting the state of the thing in it,
   don't.

   Slack fetches with a Range header and reads only the start of the
   document, so these tags go high in <head> — before the stylesheet. */
const SITE = "https://bitibybit.com";

const SHARE = {
  sweep:    ["og-sweep",    "The office sweep",   "Everyone's been drawn. Tap to see what you got."],
  kringle:  ["og-kringle",  "Kris Kringle",       "Find your name to see who you're buying for. Only you see your draw."],
  roles:    ["og-roles",    "Secret roles",       "Tap to get your secret role. Nobody else sees it."],
  plate:    ["og-plate",    "Bring a plate",      "Claim what you're bringing, so there aren't six pavlovas."],
  bracket:  ["og-bracket",  "The bracket",        "Follow the bracket as the results come in."],
  card:     ["og-card",     "A card to sign",     "Add your message before the card gets handed over."],
  registry: ["og-registry", "The registry",       "Claim a piece of the gift. The picture fills in as people chip in."],
  fact:     ["og-fact",     "Fact matcher",       "Add a fact about yourself, then guess who's who."],
  baby:     ["og-baby",     "Baby guess pool",    "Put your guess in for the date, the time and the weight."],
  roster:   ["og-roster",   "Volunteer roster",   "Pick a shift and put your name down."],
  meal:     ["og-meal",     "A meal roster",      "Pick a day you can cook. Dietary needs are on the board."],
  poll:     ["og-poll",     "A group vote",       "Cast your vote and see where everyone's landed."],
  recipe:   ["og-recipe",   "Recipe collection",  "Add a recipe to the collection."],
  giftidea: ["og-giftidea", "Gift ideas",         "Suggest a gift, or back one that's already up there."],
  hens:     ["og-hens",     "Hens planner",       "Claim what you're bringing or helping with."],
  qotd:     ["og-qotd",     "Question of the day","Today's question is up. Pick a side, then see the split."],
  coffee:   ["og-coffee",   "Coffee roulette",    "Tap your name once. You'll get a private link showing who you're paired with."],
};

/**
 * Build the card from the page's own title, so the two can never drift
 * apart. Returns "" for an unknown tool — no card beats a wrong one.
 * `img` overrides the artwork (one module serves both sweep flavours).
 */
function shareTags(shareType, title, slug, img) {
  const s = SHARE[shareType];
  if (!s || !slug) return "";
  const share = {
    title: title || s[1],
    description: s[2],
    image: `${SITE}/art/${img || s[0]}.png`,
    url: `${SITE}/s/${slug}`,
  };
  const t = esc(share.title), d = esc(share.description);
  return `
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="biti by bit">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${esc(share.image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(share.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${esc(share.image)}">`;
}

/* ---------- page shell -------------------------------------- */

/* `shareType` + `shareSlug` are passed ONLY by publicPage (/s/). The
   organiser page at /e/ and the private participant page at /p/ must
   never render a card — a preview fetcher would hand their contents to
   whatever channel the link was pasted into. Leaving the fields off is
   what keeps them silent. */
export function pageShell({ title, body, shareType, shareSlug, shareImg }) {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — biti by bit</title>${shareTags(shareType, title, shareSlug, shareImg)}
<meta name="robots" content="noindex">
<!-- Organiser links are capability URLs. Without this, following any
     link off an /e/:token page hands the token to the destination in
     the Referer header. Same-origin only, everywhere. -->
<meta name="referrer" content="same-origin">
<meta name="theme-color" content="#f4ead8">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="scanlines" aria-hidden="true"></div>
<header class="site-head wrap">
  <a class="wordmark" href="/" aria-label="biti by bit — home">
    <span class="wordmark-blocks" aria-hidden="true"><i></i><i></i><i></i></span>
    biti by bit
    <span class="beta-badge">beta</span>
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
