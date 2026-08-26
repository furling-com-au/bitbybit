/* ============================================================
   bitbybit — the Worker.

   Static pages come from /public via the assets layer. This file
   routes the dynamic paths to tool modules:

     /api/...       each tool owns its API namespace
     /s/:slug       public page for an instance   (noindex)
     /e/:token      organiser page                (noindex)
     /p/:token      participant-private page      (noindex)

   Adding a tool = write src/tools/<tool>.js implementing the
   contract below, import it, add it to TOOLS.
   ============================================================ */

import { json, getBySlug, getByToken, getParticipant, getInstanceById, notFoundPage, logEvent, markViewed, markShared } from "./lib.js";
import sweep from "./tools/sweep.js";
import kringle from "./tools/kringle.js";
import roles from "./tools/roles.js";
import plate from "./tools/plate.js";
import bracket from "./tools/bracket.js";
import card from "./tools/card.js";
import registry from "./tools/registry.js";
import fact from "./tools/fact.js";
import baby from "./tools/baby.js";
import roster from "./tools/roster.js";
import meal from "./tools/meal.js";
import poll from "./tools/poll.js";
import recipe from "./tools/recipe.js";
import giftidea from "./tools/giftidea.js";
import hens from "./tools/hens.js";
import qotd from "./tools/qotd.js";
import coffee from "./tools/coffee.js";
import pulse from "./tools/pulse.js";
import kudos from "./tools/kudos.js";
import poker from "./tools/poker.js";

const TOOLS = [sweep, kringle, roles, plate, bracket, card, registry, fact, baby, roster, meal, poll, recipe, giftidea, hens, qotd, coffee, pulse, kudos, poker];
const BY_TYPE = Object.fromEntries(TOOLS.map((t) => [t.type, t]));


/* Best-effort per-IP throttle via the colo cache. Not airtight — a
   distributed attacker gets past it — but it turns "one curl loop
   drains the D1 write quota" into a non-event. Creates are the big
   write amplifiers (a kringle create is ~1 row per participant), so
   they get the tight budget. */
const CREATE_RE = /^\/api\/(sweeps|kringle|roles|plate|bracket|card|registry|fact|baby|roster|meal|poll|recipe|giftidea|hens|qotd|coffee|pulse|kudos|poker)$/;
const POKER_VOTE_RE = /^\/api\/poker\/vote$/;
async function overLimit(request, path, env) {
  // Local dev is exempt (.dev.vars sets DEV_MODE; it never exists in
  // production) — otherwise the persisted miniflare cache locks you
  // out of your own test loop for an hour at a time.
  if (env && env.DEV_MODE === "1") return false;
  /* Scrum poker gets its own, much larger bucket. Every other tool is
     "act occasionally over days": claim a shift, sign a card, add a guess.
     Poker is a whole team tapping cards for half an hour, and a co-located
     team is ONE IP behind the office NAT — ten people sizing fifteen stories
     works out at roughly 255 POSTs in an hour, which quietly exceeded the
     shared 240 and cut the meeting off with "Steady on". A vote is a single
     tiny row, so the ceiling here is about stopping a runaway script, not
     about metering real use. */
  const kind = CREATE_RE.test(path) ? "create" : POKER_VOTE_RE.test(path) ? "poker" : "act";
  const limit = kind === "create" ? 20 : kind === "poker" ? 900 : 240; // per IP per hour
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const hour = Math.floor(Date.now() / 3600000);
  const key = new Request(`https://ratelimit.internal/${kind}/${ip}/${hour}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  const n = hit ? parseInt(await hit.text(), 10) || 0 : 0;
  if (n >= limit) return true;
  await cache.put(key, new Response(String(n + 1), {
    headers: { "cache-control": "max-age=3600" },
  }));
  return false;
}


/* ---------- example instances --------------------------------
   Every tool page links to a worked example so a curious visitor can
   see what the thing produces before typing anything. Before this,
   all 21 builders demanded a list of names before they showed you
   anything at all, which is a poor trade for someone who arrived out
   of curiosity.

   An example is a REAL instance rendered by the real tool code, so it
   can never drift from what the tool actually does. It lives at a
   predictable slug — demo-<tool> — which is what lets both guards
   below work without a lookup or a generated manifest.

   Writes to it are refused, because otherwise the shared demo becomes
   a public writeable surface: a rude note on the demo kudos wall
   would be visible to everyone who came to see an example. */
const DEMO_RE = /^demo-[a-z0-9-]+$/;

/* The banner and the neutralised controls. Injected here rather than
   threaded through 19 tool modules — pageShell always closes with
   </body>, so the insertion point is exact. */
/* Demo slugs are exactly "demo-" + the tool's page directory — asserted
   both ways by scripts/sync-example-links.mjs — so the way back is the
   builder they were just looking at, not a shelf of twenty-one tools. */
const demoChrome = (slug) => `
<div class="demo-bar" role="note">
  <strong>This is an example.</strong> Nothing you tap changes it.
  <a href="/${slug.slice(5)}/">Make a real one →</a>
</div>
<script>
(function () {
  document.body.classList.add("is-demo");
  // Every control that would write. Neutralised in the page as well as
  // on the server, so the demo never looks broken — it explains itself.
  document.querySelectorAll("main form").forEach(function (f) {
    f.addEventListener("submit", function (e) { e.preventDefault(); nudge(); }, true);
  });
  document.querySelectorAll("main button").forEach(function (b) {
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); nudge(); }, true);
  });
  var t = null;
  function nudge() {
    var bar = document.querySelector(".demo-bar");
    if (!bar) return;
    bar.classList.add("nudged");
    clearTimeout(t);
    t = setTimeout(function () { bar.classList.remove("nudged"); }, 1600);
  }
})();
</script>
</body>`;

/* Counted referral redirects: the "made with" credit on shared pages
   routes through here so the loop is measurable. One event row per
   click, no cookies, then a plain redirect. */
const VIA = {
  gf: "/grand-final-sweep/", cup: "/melbourne-cup-sweep/",
  kringle: "/kris-kringle/", roles: "/secret-role-dealer/",
  plate: "/bring-a-plate/", bracket: "/tournament-bracket/",
  card: "/group-card/", registry: "/gift-registry/", teams: "/team-picker/",
  fact: "/fact-matcher/",
  baby: "/baby-guess-pool/", roster: "/volunteer-roster/",
  meal: "/meal-train/", poll: "/group-vote/", recipe: "/recipe-collection/", giftidea: "/gift-ideas/", hens: "/hens-planner/",
  qotd: "/question-of-the-day/",
  coffee: "/coffee-roulette/",
  pulse: "/weekly-pulse/",
  kudos: "/kudos-wall/",
  poker: "/scrum-poker/",
};
/* ---------- markdown for agents ------------------------------
   Content negotiation: an agent asking for text/markdown gets the clean
   Markdown twin gen-markdown.mjs builds; everyone else gets HTML, which
   stays the default.

   Cloudflare sells this as a zone feature needing no code, but it starts at
   the Pro plan and works by converting whatever HTML the origin returned.
   Building the Markdown ourselves is both free and better: the builder form,
   the presets and the site chrome never enter it.

   Only whole-page paths negotiate. /s/, /e/ and /p/ are handled and returned
   long before this point and have no Markdown twin by design — they are
   Disallow-ed in robots.txt, and a second representation of a page someone
   shared with their group rather than with the web would quietly widen it. */
const PAGE_RE = /^\/(?:[a-z0-9-]+\/)*$/;


/* ---------- the seasonal card on the homepage ----------------
   Rewritten per request rather than generated at build time, and that is the
   whole point. The card used to be hard-coded in public/index.html reading
   "Footy finals · September". Nothing rotated it, so it was wrong for ten
   months of the year and would have gone on being wrong for as long as
   nobody deployed. A build-time generator brings that failure straight back
   the moment deploys stop; computing it from the clock cannot go stale.

   Dates are read in Australia/Sydney, not UTC. The audience is Australian and
   these windows turn on a particular day — a UTC boundary would flip the card
   the evening before, mid-afternoon Sydney time.

   The windows must tile the whole year exactly once with no gap and no
   overlap; check-seasons.mjs walks all 366 days and fails the build if they
   do not. */
const SEASONS = [
  { from: "08-15", to: "10-05", href: "/grand-final-sweep", icon: "footy.png",
    tag: "Footy finals · September", title: "Grand Final Sweep",
    blurb: "Run the office margin sweep in under a minute. Paste the names, hit draw, share the link. Fair, free, and printable for the fridge." },
  { from: "10-06", to: "11-04", href: "/melbourne-cup-sweep", icon: "horse.png",
    tag: "The Cup · first Tuesday in November", title: "Melbourne Cup Sweep",
    blurb: "The classic 24-horse office sweep, drawn fairly in a minute. Everyone gets a runner, nobody has to chase coins. Printable for the tearoom wall." },
  { from: "11-05", to: "12-24", href: "/kris-kringle", icon: "gift.png",
    tag: "Kris Kringle · December", title: "Kris Kringle",
    blurb: "A Secret Santa draw with no email addresses at all. Share one link, everyone claims their name and privately sees who they drew." },
  { from: "12-25", to: "02-14", href: "/bring-a-plate", icon: "pot.png",
    tag: "Summer · street parties and BBQs", title: "Bring a Plate",
    blurb: "The potluck board that stops you getting six pavlovas and no salad. Set the categories, share one link, everyone claims what they are bringing." },
  { from: "02-15", to: "08-14", href: "/volunteer-roster", icon: "clipboard.png",
    tag: "School and club season", title: "Volunteer Roster",
    blurb: "Canteen, BBQ, gate and ground duty, already filled in for ten sports. Set the shifts, share one link, and volunteers put their own name down." },
];

/* "MM-DD" in Australia/Sydney. */
function todayInSydney(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (t) => p.find((x) => x.type === t).value;
  return `${get("month")}-${get("day")}`;
}

function pickSeason(md) {
  for (const s of SEASONS) {
    // A window that wraps the new year (12-25 -> 02-14) is two ranges.
    const wraps = s.from > s.to;
    if (wraps ? (md >= s.from || md <= s.to) : (md >= s.from && md <= s.to)) return s;
  }
  return SEASONS[SEASONS.length - 1];   // unreachable while the tiling holds
}

/* One setInnerContent on the card itself, so the tag, heading, blurb and art
   can never disagree. The previous version of this card was edited a piece at
   a time and a selector drifted off its heading — a half-swapped card that
   says "Melbourne Cup Sweep" under "Footy finals" is worse than a stale one,
   because it looks deliberate. */
function seasonalHomepage(res, now) {
  const s = pickSeason(todayInSydney(now));
  return new HTMLRewriter()
    .on("a.feature-card", {
      element(el) {
        el.setAttribute("href", s.href);
        el.setInnerContent(
          `<div>` +
            `<span class="feature-tag">${s.tag}</span>` +
            `<h2>${s.title}</h2>` +
            `<p>${s.blurb}</p>` +
          `</div>` +
          `<div class="feature-art">` +
            `<img class="pixel" src="/icons/${s.icon}" alt="" width="150" height="150">` +
          `</div>`,
          { html: true }
        );
      },
    })
    .transform(res);
}

/* True only when text/markdown is named EXPLICITLY and wanted at least as
   much as HTML. The wildcard case is the whole difficulty: every browser
   sends "*\/*;q=0.8" somewhere in its Accept, so any implementation that
   asks "does this accept markdown?" answers yes for Chrome and serves a .md
   to a person. A wildcard is a fallback, never a request. */
function acceptsMarkdown(header) {
  if (!header) return false;
  let md = -1, html = -1;
  for (const part of header.split(",")) {
    const bits = part.trim().split(";");
    const type = bits[0].trim().toLowerCase();
    let q = 1;
    for (const param of bits.slice(1)) {
      const m = param.trim().match(/^q=([0-9.]+)$/i);
      if (m) { const v = parseFloat(m[1]); q = Number.isFinite(v) ? v : 0; }
    }
    if (type === "text/markdown") md = Math.max(md, q);
    else if (type === "text/html") html = Math.max(html, q);
  }
  return md > 0 && md >= html;
}

/* Vary: Accept is load-bearing, not decoration. Without it Cloudflare may
   cache whichever representation it saw first and hand that to everyone
   after — a Markdown file to a browser, or HTML to an agent. Any dimension
   the assets layer already declared is preserved. */
function withVary(res, path) {
  const out = new Response(res.body, res);
  const prev = out.headers.get("vary");
  if (!prev) out.headers.set("vary", "Accept");
  else if (!/(^|,)\s*accept\s*(,|$)/i.test(prev)) out.headers.set("vary", prev + ", Accept");

  /* Advertise the twin. Negotiation only helps a caller that already knows to
     ask; this tells one that does not, and hands anything that cannot set
     request headers at all a plain URL to fetch instead. Relative on purpose
     — RFC 8288 resolves the target against the request, so it stays correct
     on the www host as well as the apex. Only on a 200: a 404 has no twin. */
  if (res.ok && path) {
    out.headers.append("link", `<${path}index.md>; rel="alternate"; type="text/markdown"`);
  }
  return out;
}

async function markdownResponse(request, env, path) {
  if (!PAGE_RE.test(path)) return null;
  if (!acceptsMarkdown(request.headers.get("accept"))) return null;

  const mdUrl = new URL(request.url);
  mdUrl.pathname = path + "index.md";
  const res = await env.ASSETS.fetch(new Request(mdUrl.toString(), { method: "GET" }));
  if (!res.ok) return null;                  // no twin here: fall through to HTML

  const text = await res.text();
  /* Same approximation as the generator: words plus punctuation runs. A
     budgeting hint for the caller, not a tokeniser's output. */
  const tokens = (text.match(/[A-Za-z0-9']+|[^\sA-Za-z0-9']/g) || []).length;

  return new Response(request.method === "HEAD" ? null : text, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "vary": "Accept",
      "x-markdown-tokens": String(tokens),
      "cache-control": "public, max-age=3600",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* www -> apex. Never for /api/, and that exception is the whole point:
       HTML pages are served by the assets layer, so this Worker never runs
       for them and cannot redirect them (that needs a zone Redirect Rule).
       But /api/ IS in run_worker_first, so redirecting it turned a builder's
       same-origin POST into a cross-origin one. With no CORS headers the
       browser refused the redirected request outright — fetch threw
       "TypeError: Failed to fetch" — which made every tool on
       www.bitibybit.com impossible to create, silently, for 24% of visits.
       Leaving /api/ on whichever host asked keeps it same-origin. */
    if (url.hostname.startsWith("www.") && !path.startsWith("/api/")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    /* The failure half of the create ledger. A create that fails is a person
       who pressed the button and got nothing back, and until now that left no
       trace at all — which is why "nobody created anything" could not be told
       apart from "everybody tried and the request died". Recorded server-side
       so it does not depend on the page that just failed, and never awaited:
       if D1 is the reason the create died then this insert dies too, and it
       must not mask the original error. Read these as ATTEMPTS, not people —
       there is no dedupe, only the 20/IP/hr create limiter above. */
    const noteFailure = (toolSeg, kind) => {
      if (!ctx || !toolSeg) return;
      ctx.waitUntil(
        logEvent(env, null, toolSeg === "sweeps" ? "sweep" : toolSeg, kind).catch(() => {})
      );
    };

    try {
      if (path.startsWith("/api/")) {
        if (request.method === "POST" && await overLimit(request, path, env)) {
          const rl = CREATE_RE.exec(path);
          if (rl) noteFailure(rl[1], "fail:429");
          return json({ error: "Steady on — too many requests from this connection. Give it a few minutes." }, 429);
        }

        /* A demo is shared and guessable, so it must not be writeable.
           The body is cloned rather than consumed — the tool modules
           read it again downstream. */
        if (request.method === "POST") {
          try {
            const peek = await request.clone().json();
            if (peek && typeof peek.slug === "string" && DEMO_RE.test(peek.slug)) {
              const seg = path.split("/")[2] || "";
              if (BY_TYPE[seg === "sweeps" ? "sweep" : seg]) noteFailure(seg, "demo-write");
              return json({ error: "That's the example — make your own and it'll be yours to change." }, 403);
            }
          } catch (e) { /* not JSON, or no body: nothing to guard */ }
        }

        /* Shared by every tool that shows a "viewed" tick. Kept off the
           GET of /p/:token, where link-preview fetchers would trigger
           it the moment someone pastes their own private link into a
           chat. See markViewed in lib.js. */
        let mv;
        if (request.method === "POST" && (mv = path.match(/^\/api\/viewed\/([a-z0-9]+)$/)))
          return markViewed(env, mv[1]);

        /* The organiser pressed Copy or Share. This is the only observable
           moment between making a thing and someone else opening it, and
           without it "nothing was ever opened by a second person" cannot be
           told apart from "nothing was ever handed over". Idempotent and
           tokenless-safe — see markShared. */
        let ms;
        if (request.method === "POST" && (ms = path.match(/^\/api\/shared\/([a-z0-9]+)$/)))
          return markShared(env, ms[1]);

        for (const tool of TOOLS) {
          const res = await tool.api(request, env, url);
          if (res) return res;
        }
        return json({ error: "not found" }, 404);
      }

      let m;
      /* /via/:tool and /via/:tool/:placement. The optional second segment
         distinguishes the quiet footer credit from the completion CTA, so
         it is possible to tell which of the two actually recruits anybody.
         Attribution only — both go to the same page.

         The decision rule, written down before the data exists so it
         cannot be rationalised later: DO NOT change either placement
         until one of them has 50 clicks. At five lifetime clicks, reading
         noise as a result and shipping the losing version into December
         is worse than having no data at all. */
      if ((m = path.match(new RegExp("^/via/([a-z]+)(?:/(cta|foot))?/?$"))) && VIA[m[1]]) {
        if ((request.method === "GET" || request.method === "HEAD") && !(env && env.DEV_MODE === "1")) {
          // Log at most one event per IP per tool per placement per hour
          // (Cache API dedupe) so a curl loop can't burn D1 writes here.
          try {
            const placement = m[2] || "foot";
            const ip = request.headers.get("cf-connecting-ip") || "unknown";
            const hour = Math.floor(Date.now() / 3600000);
            const seenKey = new Request(`https://via.internal/${m[1]}/${placement}/${ip}/${hour}`);
            if (!(await caches.default.match(seenKey))) {
              await caches.default.put(seenKey, new Response("1", {
                headers: { "cache-control": "max-age=3600" },
              }));
              await logEvent(env, null, m[1], `via:${placement}`);
            }
          } catch (e) { /* never block the redirect */ }
        }
        return Response.redirect(url.origin + VIA[m[1]], 302);
      }

      if ((m = path.match(/^\/s\/([a-z0-9-]+)\/?$/)) && (request.method === "GET" || request.method === "HEAD")) {
        const row = await getBySlug(env, m[1]);
        const tool = row && BY_TYPE[row.tool_type];
        if (!tool) return notFoundPage(env);
        const res = await tool.publicPage(row, env, url);
        if (!DEMO_RE.test(m[1])) return res;
        const body = await res.text();
        return new Response(body.replace("</body>", demoChrome(m[1])), {
          status: res.status,
          headers: res.headers,
        });
      }

      if ((m = path.match(/^\/e\/([a-z0-9]+)\/?$/)) && (request.method === "GET" || request.method === "HEAD")) {
        const row = await getByToken(env, m[1]);
        const tool = row && BY_TYPE[row.tool_type];
        if (!tool) return notFoundPage(env);
        return tool.editPage(row, env, url);
      }

      if ((m = path.match(/^\/p\/([a-z0-9]+)\/?$/)) && (request.method === "GET" || request.method === "HEAD")) {
        const prow = await getParticipant(env, m[1]);
        const row = prow && await getInstanceById(env, prow.instance_id);
        const tool = row && BY_TYPE[row.tool_type];
        if (!tool || !tool.participantPage) return notFoundPage(env);
        return tool.participantPage(prow, row, env, url);
      }

      /* Everything else is a static page. run_worker_first is true, so the
         www -> apex redirect above sees HTML requests too; from here the
         assets layer takes over — pages, _headers, and its own 404 page.

         Markdown negotiation happens here and nowhere else, so it can only
         ever apply to public pages: every capability URL has already
         returned above. Vary is added to the HTML too — a cache told that
         one representation varies and the other does not still mixes them
         up — but only for page paths, so a CSS or image request is not
         needlessly fragmented across every Accept header a browser sends. */
      if (request.method === "GET" || request.method === "HEAD") {
        const md = await markdownResponse(request, env, path);
        if (md) return md;
      }
      const assetRes = await env.ASSETS.fetch(request);
      if (!PAGE_RE.test(path)) return assetRes;

      /* The homepage's feature card is swapped for whatever is in season.
         Capped at an hour so a cache cannot pin the wrong season for long —
         at a boundary the worst case is sixty minutes of yesterday's card. */
      if (path === "/" && assetRes.ok && request.method !== "HEAD") {
        const out = withVary(seasonalHomepage(assetRes, new Date()), path);
        out.headers.set("cache-control", "public, max-age=3600");
        return out;
      }
      return withVary(assetRes, path);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      const cm = request.method === "POST" ? CREATE_RE.exec(path) : null;
      if (cm) noteFailure(cm[1], "fail:" + status);
      return json({ error: e.status ? e.message : "Something went wrong." }, status);
    }
  },
};
