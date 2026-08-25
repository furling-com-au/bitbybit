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

import { json, getBySlug, getByToken, getParticipant, getInstanceById, notFoundPage, logEvent, markViewed } from "./lib.js";
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
         assets layer takes over — pages, _headers, and its own 404 page. */
      return env.ASSETS.fetch(request);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      const cm = request.method === "POST" ? CREATE_RE.exec(path) : null;
      if (cm) noteFailure(cm[1], "fail:" + status);
      return json({ error: e.status ? e.message : "Something went wrong." }, status);
    }
  },
};
