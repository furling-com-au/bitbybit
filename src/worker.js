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

import { json, getBySlug, getByToken, getParticipant, getInstanceById, notFoundPage, logEvent } from "./lib.js";
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

const TOOLS = [sweep, kringle, roles, plate, bracket, card, registry, fact, baby, roster];
const BY_TYPE = Object.fromEntries(TOOLS.map((t) => [t.type, t]));


/* Best-effort per-IP throttle via the colo cache. Not airtight — a
   distributed attacker gets past it — but it turns "one curl loop
   drains the D1 write quota" into a non-event. Creates are the big
   write amplifiers (a kringle create is ~1 row per participant), so
   they get the tight budget. */
const CREATE_RE = /^\/api\/(sweeps|kringle|roles|plate|bracket|card|registry|fact|baby|roster)$/;
async function overLimit(request, path, env) {
  // Local dev is exempt (.dev.vars sets DEV_MODE; it never exists in
  // production) — otherwise the persisted miniflare cache locks you
  // out of your own test loop for an hour at a time.
  if (env && env.DEV_MODE === "1") return false;
  const limit = CREATE_RE.test(path) ? 20 : 240; // per IP per hour
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const kind = CREATE_RE.test(path) ? "create" : "act";
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
};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // www → apex, once the custom domain is attached.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    try {
      if (path.startsWith("/api/")) {
        if (request.method === "POST" && await overLimit(request, path, env))
          return json({ error: "Steady on — too many requests from this connection. Give it a few minutes." }, 429);
        for (const tool of TOOLS) {
          const res = await tool.api(request, env, url);
          if (res) return res;
        }
        return json({ error: "not found" }, 404);
      }

      let m;
      if ((m = path.match(new RegExp("^/via/([a-z]+)/?$"))) && VIA[m[1]]) {
        if ((request.method === "GET" || request.method === "HEAD") && !(env && env.DEV_MODE === "1")) {
          // Log at most one event per IP per tool per hour (Cache API
          // dedupe) so a curl loop can't burn D1 writes through this route.
          try {
            const ip = request.headers.get("cf-connecting-ip") || "unknown";
            const hour = Math.floor(Date.now() / 3600000);
            const seenKey = new Request(`https://via.internal/${m[1]}/${ip}/${hour}`);
            if (!(await caches.default.match(seenKey))) {
              await caches.default.put(seenKey, new Response("1", {
                headers: { "cache-control": "max-age=3600" },
              }));
              await logEvent(env, null, m[1], "via");
            }
          } catch (e) { /* never block the redirect */ }
        }
        return Response.redirect(url.origin + VIA[m[1]], 302);
      }

      if ((m = path.match(/^\/s\/([a-z0-9-]+)\/?$/)) && (request.method === "GET" || request.method === "HEAD")) {
        const row = await getBySlug(env, m[1]);
        const tool = row && BY_TYPE[row.tool_type];
        if (!tool) return notFoundPage(env);
        return tool.publicPage(row, env, url);
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

      return notFoundPage(env);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      return json({ error: e.status ? e.message : "Something went wrong." }, status);
    }
  },
};
