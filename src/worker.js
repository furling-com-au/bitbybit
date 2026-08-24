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

const TOOLS = [sweep];
const BY_TYPE = Object.fromEntries(TOOLS.map((t) => [t.type, t]));

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
