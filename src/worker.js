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

import { json, getBySlug, getByToken, getParticipant, getInstanceById, notFoundPage } from "./lib.js";
import sweep from "./tools/sweep.js";
import kringle from "./tools/kringle.js";
import roles from "./tools/roles.js";
import plate from "./tools/plate.js";
import bracket from "./tools/bracket.js";
import card from "./tools/card.js";
import registry from "./tools/registry.js";

const TOOLS = [sweep, kringle, roles, plate, bracket, card, registry];
const BY_TYPE = Object.fromEntries(TOOLS.map((t) => [t.type, t]));


/* Best-effort per-IP throttle via the colo cache. Not airtight — a
   distributed attacker gets past it — but it turns "one curl loop
   drains the D1 write quota" into a non-event. Creates are the big
   write amplifiers (a kringle create is ~1 row per participant), so
   they get the tight budget. */
const CREATE_RE = /^\/api\/(sweeps|kringle|roles|plate|bracket|card|registry)$/;
async function overLimit(request, path) {
  // Local dev is exempt — the persisted miniflare cache otherwise
  // locks you out of your own test loop for an hour at a time.
  const devHost = new URL(request.url).hostname;
  if (devHost === "localhost" || devHost === "127.0.0.1") return false;
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
        if (request.method === "POST" && await overLimit(request, path))
          return json({ error: "Steady on — too many requests from this connection. Give it a few minutes." }, 429);
        for (const tool of TOOLS) {
          const res = await tool.api(request, env, url);
          if (res) return res;
        }
        return json({ error: "not found" }, 404);
      }

      let m;
      if ((m = path.match(/^\/s\/([a-z0-9-]+)\/?$/)) && request.method === "GET") {
        const row = await getBySlug(env, m[1]);
        const tool = row && BY_TYPE[row.tool_type];
        if (!tool) return notFoundPage(env);
        return tool.publicPage(row, env, url);
      }

      if ((m = path.match(/^\/e\/([a-z0-9]+)\/?$/)) && request.method === "GET") {
        const row = await getByToken(env, m[1]);
        const tool = row && BY_TYPE[row.tool_type];
        if (!tool) return notFoundPage(env);
        return tool.editPage(row, env, url);
      }

      if ((m = path.match(/^\/p\/([a-z0-9]+)\/?$/)) && request.method === "GET") {
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
