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

/* Always `throw badInput(...)`, never `return json({error}, 400)`.
   The worker's outer catch is the only place a refused create is
   recorded (see noteFailure in worker.js), so a create path that
   returns a 4xx instead of throwing drops silently out of the
   failure ledger and makes "nobody tried" indistinguishable from
   "everybody was refused".

   `reason` is a short kebab-case tag that rides on the error and ends
   up in the events row as `fail:400:<reason>`. It exists because the
   ledger without it was unreadable at the volumes that matter: two
   kringle 400s in August could equally have been two people refused
   at the form or two empty POSTs from a scanner walking /api-docs/,
   and telling those apart took a code read instead of a query. It
   changes NOTHING a caller sees - same status, same message, and the
   published error table in scripts/api-tools.json stays true. Omit it
   and the label degrades to the old bare `fail:400`. */
export function badInput(message, reason) {
  const e = new Error(message);
  e.status = 400;
  if (reason) e.reason = reason;
  return e;
}

/* Every create reads its body as `readJson(request)`, never
   `request.json().catch(() => ({}))`.

   Both hand a create the same empty object, and that is deliberate:
   an unparseable body SHOULD fall through to the ordinary "you need
   three names" refusal, because that is what the API docs promise and
   because a human never sees it - the builder page only ever sends
   valid JSON. What the bare catch could not do is say so afterwards.
   The marker below is a Symbol, so it cannot collide with a field
   name, does not serialise, and does not survive into stored data -
   it exists purely so a parse function can tag its refusal
   `unparseable` on the way past. */
export const UNPARSEABLE = Symbol("unparseable body");

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return { [UNPARSEABLE]: true };
  }
}

/* The site's calendar runs on Australian local time, not the Worker's UTC.
   Every seasonal decision - the homepage feature card, and the "what's next"
   banner on a settled sweep - has to agree about what day it is, or they
   disagree for the eleven hours a day where Sydney and UTC are on different
   dates. Sydney is 11 hours ahead in November, so a UTC-midnight boundary
   fires at 11am Sydney the same day - half a day early, and on 4 November
   that put a settled Cup sweep and the homepage card on opposite sides of
   the season while both looked correct in isolation.

   Returns "MM-DD", which is all any caller needs: the seasonal windows are
   year-agnostic and compare as strings. */
export function sydneyMonthDay(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (t) => p.find((x) => x.type === t).value;
  return `${get("month")}-${get("day")}`;
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

/* The organiser handed the link over. Sibling of markViewed above, and the
   same three rules apply: first write wins (so a second Copy does not reset
   the timestamp and no dedupe cache is needed), unknown tokens get the same
   204 as real ones so this cannot be used to test whether a token exists,
   and it never throws into the page.

   Called only from the organiser page. shareNudge is rendered behind an
   `organiser` check in every tool, so the edit token in the beacon URL is
   never on a page a participant can reach. */
export async function markShared(env, editToken) {
  if (editToken) {
    await env.DB.prepare(
      "UPDATE instances SET shared_at = ? WHERE edit_token = ? AND shared_at IS NULL"
    ).bind(new Date().toISOString(), editToken).run();
  }
  return new Response(null, { status: 204 });
}

/* Someone opened the shared /s/ page — anyone, not necessarily a second
   person, which is why stats.mjs only trusts this past COLD_MINUTES. Same
   three rules as markShared: first write wins, it never throws into the
   page (called via ctx.waitUntil from the /s/ handler, and swallowed
   there too), and it is the only reach signal sweep and bracket have,
   since they write to neither claims nor participants. */
export async function markFirstOpened(env, id) {
  await env.DB.prepare(
    "UPDATE instances SET first_opened_at = ? WHERE id = ? AND first_opened_at IS NULL"
  ).bind(new Date().toISOString(), id).run();
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
/* The loop's only real recruiting moment.
 *
 * Every shared page is seen by five to thirty people who are, by
 * definition, in a group that organises things — and until now the only
 * thing offered to them was a footer credit. This is the ask, placed
 * where they have just watched the thing work.
 *
 * Three rules, each learned the expensive way:
 *   - it names THEIR group, not the product. What makes someone create
 *     is recognising a situation of their own ("another game", "a team
 *     lunch"), not curiosity about a tool.
 *   - it never appears on an organiser's own /e/ page. They already made
 *     one; inviting them to make one reads as a machine talking.
 *   - it is hidden in print. Half these pages get printed for a fridge or
 *     a noticeboard, and an ad on a fridge is somebody else's brand.
 * It links to the tool being read, never the homepage, because a homepage
 * is one more decision at the exact moment intent is highest. */
export function ownCta(tool, prompt, cta) {
  return `
  <aside class="own-cta">
    <p class="own-cta-line">${esc(prompt)}</p>
    <a class="btn primary" href="/via/${esc(tool)}/cta">${esc(cta)} &rarr;</a>
    <p class="fine own-cta-fine">Free, about a minute, and no email addresses &mdash; same as this one.</p>
  </aside>`;
}

/* The organiser's share step. Two things matter here.
 *
 * EDITABLE. It used to be readonly, which quietly told the organiser this
 * sentence was ours rather than theirs. They know their group; let them
 * change it. The default is built from what they already typed.
 *
 * navigator.share() WHERE IT EXISTS. 67% of visits are mobile, and on a
 * phone the native sheet is the difference between "copy, leave, open
 * WhatsApp, find the group, paste" and one tap. Three details are
 * load-bearing:
 *   - a single `text` member, with the URL inside it. NOT `url`, NOT
 *     `title`. Android concatenates the members inconsistently and can
 *     silently drop `text` when `url` is present — which would send the
 *     bare link and strip the instruction, the exact thing this exists to
 *     prevent.
 *   - called synchronously inside the click handler, or the browser
 *     rejects it as not user-activated.
 *   - AbortError is someone changing their mind, not a failure. Swallow it.
 * The copy button stays visible everywhere as a peer, not a fallback:
 * desktop has no share sheet and plenty of people prefer the clipboard. */
/* editToken is required: copying or sharing is the only observable moment
   between "made a thing" and "someone else opened it", and without it that
   step of the funnel is invisible. check-share-nudge.mjs fails the build if
   a tool forgets it. */
export function shareNudge(message, editToken) {
  return `
  <div class="share-nudge">
    <span class="share-label">Paste-ready for the group chat &mdash; edit it however you like</span>
    <div class="share-row">
      <textarea id="nudgeText" class="nudge-text" rows="3">${esc(message)}</textarea>
      <div class="nudge-actions">
        <button class="btn primary" id="nudgeShare" type="button" hidden>Share&hellip;</button>
        <button class="btn" id="nudgeCopy" type="button">Copy</button>
      </div>
    </div>
  </div>
  <script>
  (function () {
    var TOKEN = ${JSON.stringify(String(editToken || ""))};
    var t = document.getElementById("nudgeText");
    var copy = document.getElementById("nudgeCopy");
    var share = document.getElementById("nudgeShare");

    function flash(btn, word) {
      var was = btn.dataset.rest || btn.textContent;
      btn.dataset.rest = was;
      btn.textContent = word;
      clearTimeout(btn._t);
      btn._t = setTimeout(function () { btn.textContent = was; }, 1500);
    }

    /* Fires on the first Copy or Share only. sendBeacon rather than fetch:
       the whole point of the button is that the next thing they do is leave
       for the group chat, and an in-flight fetch dies with the tab.
       Best-effort by design — a failed beacon must never cost them the copy. */
    var marked = false;
    function markShared() {
      if (marked || !TOKEN) return;
      marked = true;
      try {
        if (navigator.sendBeacon) navigator.sendBeacon("/api/shared/" + TOKEN);
        else fetch("/api/shared/" + TOKEN, { method: "POST", keepalive: true }).catch(function () {});
      } catch (e) {}
    }

    /* Every tool also renders its own id="copyBtn" for the bare link, above
       this block and more prominent than it. An organiser who presses that
       one and leaves has shared just as truly as one who used the nudge, and
       counting only the nudge would under-report the step - which is worse
       than not measuring it, because it looks like data. Delegated on
       document rather than bound directly so it does not matter whether that
       button is rendered before or after this script. */
    document.addEventListener("click", function (e) {
      var el = e.target;
      while (el && el !== document) {
        if (el.id === "copyBtn") { markShared(); return; }
        el = el.parentNode;
      }
    }, true);

    copy.addEventListener("click", function () {
      markShared();
      t.select();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(t.value).then(function () { flash(copy, "Copied"); },
          function () { try { document.execCommand("copy"); flash(copy, "Copied"); } catch (e) {} });
      } else {
        try { document.execCommand("copy"); flash(copy, "Copied"); } catch (e) {}
      }
    });

    if (navigator.share) {
      share.hidden = false;
      share.addEventListener("click", function () {
        markShared();
        navigator.share({ text: t.value }).catch(function (e) {
          if (e && e.name === "AbortError") return;   // they closed the sheet
          flash(share, "Couldn't share");
        });
      });
    }
  })();
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
  pulse:    ["og-pulse",    "Weekly pulse",       "One tap for how the week went. Nobody can tell it was you."],
  kudos:    ["og-kudos",    "Kudos wall",         "Someone did something worth saying out loud. Put it up here."],
  poker:    ["og-poker",    "Scrum poker",        "Pick your card. Nobody sees a number until everyone has committed."],
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
<meta property="og:image:alt" content="${d}">
<meta property="og:url" content="${esc(share.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${esc(share.image)}">`;
}

/* The organiser is one tap from pasting this into a group of thirty and has
 * never seen what unfurls — the title field they may have left blank is the
 * only lever they have on it. Same data shareTags() uses, rendered as
 * visible HTML on the organiser's own /e/ page instead of meta tags nobody
 * reads. Leaving the title blank now has a visible consequence: the preview
 * says the tool's generic name back at them, in the exact spot their own
 * words would have gone. */
export function cardPreview(shareType, title, img) {
  const s = SHARE[shareType];
  if (!s) return "";
  const t = esc(title || s[1]), d = esc(s[2]);
  return `
  <div class="card-preview">
    <img class="card-preview-img" src="/art/${esc(img || s[0])}.png" alt="" width="120" height="63">
    <div class="card-preview-text">
      <p class="card-preview-title">${t}</p>
      <p class="card-preview-desc">${d}</p>
      <p class="card-preview-domain">bitibybit.com</p>
    </div>
  </div>`;
}

/* ---------- the fill ---------------------------------------- */

/* One mark for "N of M", specified in docs/review/08-fill.md and drawn
 * by .fill-track in public/styles.css. The rule that decides whether a
 * tool may call this at all is in that document and is short enough to
 * repeat here:
 *
 *   A FILL MAY ONLY DRAW A NUMBER THAT A VIEWER OF THAT SAME PAGE COULD
 *   ALREADY OBTAIN BY COUNTING WHAT IS RENDERED ON IT.
 *
 * So a roster's bar is the roster, counted; a Coffee Roulette bar over
 * the whole name list is the list, counted — and a bar over the PAIRS is
 * a new fact, because watching one name flip from open to claimed and
 * seeing which pair moved identifies a pairing in one reload. There is
 * no granularity at which that is safe. Same for a per-role bar on
 * Secret Roles, which publishes a count and no names.
 *
 * Returning "" when there is no real denominator is the whole safety
 * design and is why this is a helper rather than twenty `if`s: a storage
 * ceiling (MAX_MESSAGES, MAX_GUESSES, MAX_VOTERS) is not an M, and a row
 * whose stored shape predates a capacity field renders exactly as it
 * does today. A tool with no total gets its sentence and no bar.
 *
 * Notched at M <= 24 and smooth above it — the reasoning, and the
 * 11.04px it comes from, is with the CSS. aria-hidden because the
 * sentence immediately above says the same thing in words, and a screen
 * reader announcing both says it twice.
 *
 * This renders into <body>. It must never reach a share card: see the
 * rule above SHARE. */
export function fillTrack({ n, m } = {}) {
  const total = Number(m);
  if (!Number.isFinite(total) || total <= 0) return "";
  const done = Math.min(total, Math.max(0, Number(n) || 0));
  return `
  <div class="fill-track${total <= 24 ? " notched" : ""}" style="--n:${done};--m:${total}" aria-hidden="true"><i></i></div>`;
}

/* ---------- counter ----------------------------------------- */

/* GoatCounter on /s/ only — never /e/ or /p/, which are the two page
   types whose URL IS the secret.
 *
 * Everything identifying is pinned to a constant before count.js can
 * read the page, because every default it has would leak something:
 *
 *   path      the /s/ slug is the capability. Anyone holding it can
 *             open the board. So the tool name is all that is sent —
 *             "bitibybit.com/s/sweep" for every sweep in existence.
 *             The host prefix matches what the public pages send.
 *   title     <title> here is the organiser's own words: "Sarah's baby
 *             shower", "Q3 offsite". Their text, not ours to forward.
 *   referrer  an organiser arriving from their own /e/:token page
 *             would otherwise hand that token over in document.referrer
 *             — a working edit link, to a third party, on page load.
 *
 * A plain "" is the way to say "send nothing": count.js only falls back
 * to its own defaults when a value is null, undefined, or a function
 * (its is_empty), so an empty string survives to the request intact.
 *
 * The one field it does not let you set is q, which is always
 * location.search. That is safe here only because no /s/ page takes a
 * query parameter. Before you add the first one, come back and read
 * this — a ?name= on a shared page would be sent offsite. */
function counter(shareType) {
  const settings = JSON.stringify({
    path: `bitibybit.com/s/${shareType}`,
    title: "",
    referrer: "",
  });
  return `
<script data-goatcounter="https://furling.goatcounter.com/count"
        data-goatcounter-settings='${settings}'
        async src="//gc.zgo.at/count.js"></script>`;
}

/* ---------- page shell -------------------------------------- */

/* `shareType` + `shareSlug` are passed ONLY by publicPage (/s/). The
   organiser page at /e/ and the private participant page at /p/ must
   never render a card — a preview fetcher would hand their contents to
   whatever channel the link was pasted into. Leaving the fields off is
   what keeps them silent.

   That same pair is the only reliable way to know, from in here, which
   of the three page types is being rendered, so it also sets
   class="shared" on <body>. /s/ is the one page a stranger sees — five
   to thirty of them per link — and public/styles.css draws it as a
   poster rather than as a form: the organiser's title at the homepage's
   scale, the status line a rung above body text, the board sooner. /e/
   and /p/ pass neither field and are untouched by every one of those
   rules. Nothing about the class reaches <head>, so it cannot change
   what a preview fetcher reads. */
export function pageShell({ title, body, shareType, shareSlug, shareImg }) {
  const shared = Boolean(shareType && shareSlug);
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
<body${shared ? ` class="shared"` : ""}>
<header class="site-head wrap">
  <a class="wordmark" href="/" aria-label="biti by bit — home">
    <span class="wordmark-blocks" aria-hidden="true"><i></i><i></i><i></i></span>
    biti by bit
  </a>
</header>
${body}${shared ? counter(shareType) : ""}
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
