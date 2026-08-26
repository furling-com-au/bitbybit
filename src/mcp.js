/* An MCP server for Scrum Poker, at POST /mcp.
 *
 * Why this tool and not the other twenty-one: the people who configure MCP
 * servers are developers, and Scrum Poker is the one tool whose users are
 * developers. A P&C secretary organising a canteen roster is never going to
 * install an MCP server, so exposing the roster here would be surface area
 * with nobody behind it. If this earns its keep, the other team tools —
 * kudos wall, weekly pulse, coffee roulette — are the ones that follow.
 *
 * STATELESS, and therefore no Durable Object. createMcpHandler builds a fresh
 * server per request. McpAgent is the stateful alternative and is legacy; it
 * would also mean a DO binding and a migration for a tool whose entire state
 * already lives in D1 behind a capability URL. There is no session to keep.
 *
 * The factory is passed to createMcpHandler UNCALLED, deliberately. Handing it
 * a constructed server — or worse, one built once in module scope — is the
 * documented cross-client response leak: concurrent requests share the
 * transport and one client can receive another's response. On a server whose
 * responses contain capability URLs, that is somebody else's facilitator link
 * arriving in your agent.
 *
 * Every tool routes through the real poker module rather than reimplementing
 * anything, so validation, the round-staleness 409 and the vote limits behave
 * identically whether a request arrives from a browser or an agent.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import poker from "./tools/poker.js";
import { getByToken } from "./lib.js";

const ORIGIN = "https://bitibybit.com";

/* Agents will be holding URLs, because that is what the create tool handed
   back and what a person pastes. Accept either the whole URL or the bare
   token, so a model does not have to do string surgery to call the next
   tool — the commonest way an agent chain breaks. */
const lastSegment = (s) => String(s || "").trim().replace(/\/+$/, "").split("/").pop() || "";

/* Call the tool module in-process. Not a fetch to our own origin: that would
   be a real subrequest with real latency, and it would leave the Worker
   talking to itself for no reason. */
async function pokerApi(env, method, path, body) {
  const url = new URL(ORIGIN + path);
  const req = new Request(url.toString(), {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await poker.api(req, env, url);
  if (!res) return { ok: false, status: 404, data: { error: "no such endpoint" } };
  let data = null;
  try { data = await res.json(); } catch { /* delete returns no body */ }
  return { ok: res.ok, status: res.status, data };
}

/* MCP wants content back, and the text is what a model reads out. Errors are
   returned as isError rather than thrown so the model sees the reason and can
   tell the person, instead of a generic tool failure. */
const say = (text) => ({ content: [{ type: "text", text }] });
const fail = (text) => ({ content: [{ type: "text", text }], isError: true });

function describeState(d) {
  if (!d || typeof d.count !== "number") return "The room is there, but its state could not be read.";
  if (!d.revealed) {
    const who = (d.who || []).length ? ` — ${d.who.join(", ")}` : "";
    return `Not revealed yet. ${d.count} ${d.count === 1 ? "vote" : "votes"} in${who}.`
      + (d.story ? `\nStory: ${d.story}` : "");
  }
  const cards = (d.cards || []).map((c) => `${c.name || "someone"}: ${c.card}`).join(", ");
  let verdict;
  if (d.agreed) verdict = `Everyone said ${d.low.card}.`;
  else if (!d.low) verdict = "Nobody put a card on it that counts — usually a sign the story needs splitting.";
  else if (d.low.card === d.high.card) verdict = `Everyone with a card said ${d.low.card}${d.unsure ? `, ${d.unsure} unsure` : ""}.`;
  else verdict = `Spread is ${d.low.card} (${d.low.name || "someone"}) to ${d.high.card} (${d.high.name || "someone"})${d.unsure ? `, ${d.unsure} unsure` : ""}. Ask those two what they are each seeing.`;
  return `${d.story ? `Story: ${d.story}\n` : ""}Revealed. ${cards}\n${verdict}`;
}

function createServer(env) {
  const server = new McpServer({ name: "biti-by-bit-scrum-poker", version: "1.0.0" });

  server.registerTool(
    "create_scrum_poker_room",
    {
      description:
        "Create a Scrum Poker (planning poker) room for estimating a story. "
        + "Returns two links: one to share with the team, and a private facilitator link "
        + "that can reveal the round. No account is needed by anyone.",
      inputSchema: {
        story: z.string().max(200).optional()
          .describe("What is being estimated, e.g. 'Search results pagination'."),
        deck: z.enum(["fib", "tshirt"]).optional()
          .describe("fib = 1,2,3,5,8,13,21 (default). tshirt = XS..XXL for rougher sizing."),
      },
    },
    async ({ story, deck }) => {
      const r = await pokerApi(env, "POST", "/api/poker", { story: story || "", deck: deck || "fib" });
      if (!r.ok) return fail(`Could not create the room: ${r.data?.error || r.status}`);
      return say(
        `Room created.\n\n`
        + `Share with the team: ${ORIGIN}/s/${r.data.slug}\n`
        + `Facilitator link (keep this one): ${ORIGIN}/e/${r.data.editToken}\n\n`
        + `Everyone opens the share link, picks a card, and no card is visible to anyone — `
        + `including the facilitator — until the round is revealed.`
      );
    }
  );

  server.registerTool(
    "get_scrum_poker_state",
    {
      description:
        "Check how a Scrum Poker round is going: how many have voted and who, and — only "
        + "once revealed — the cards and where the disagreement is.",
      inputSchema: {
        shareLink: z.string().describe("The share link, or just its slug."),
      },
    },
    async ({ shareLink }) => {
      const slug = lastSegment(shareLink);
      const r = await pokerApi(env, "GET", `/api/poker/${encodeURIComponent(slug)}/state`);
      if (!r.ok) return fail(`Could not read that room: ${r.data?.error || r.status}`);
      return say(describeState(r.data));
    }
  );

  server.registerTool(
    "reveal_scrum_poker_round",
    {
      description:
        "Turn all the cards over at once and return the result. Needs the facilitator link. "
        + "Do this when everyone has voted — revealing early is the one thing that breaks the exercise.",
      inputSchema: {
        facilitatorLink: z.string().describe("The facilitator link, or just its token."),
      },
    },
    async ({ facilitatorLink }) => {
      const token = lastSegment(facilitatorLink);
      const r = await pokerApi(env, "POST", `/api/poker/${encodeURIComponent(token)}/reveal`, {});
      if (!r.ok) return fail(`Could not reveal: ${r.data?.error || r.status}`);

      /* reveal returns {ok:true} and nothing else — the browser page polls
         state separately, so it never needed more. An agent has nothing to
         poll, and a bare "done" is useless to read out, so the result is
         fetched here. The slug comes from the row rather than being asked
         for: the facilitator link is all anyone should need to hold. */
      const row = await getByToken(env, token);
      if (!row) return say("Revealed.");
      const st = await pokerApi(env, "GET", `/api/poker/${encodeURIComponent(row.slug)}/state`);
      return say(st.ok ? describeState(st.data) : "Revealed.");
    }
  );

  server.registerTool(
    "start_next_scrum_poker_round",
    {
      description:
        "Clear the votes and start a fresh round on the same room, optionally naming the next "
        + "story. The share link stays the same, so nobody has to be sent anything again.",
      inputSchema: {
        facilitatorLink: z.string().describe("The facilitator link, or just its token."),
        story: z.string().max(200).optional().describe("The next story to estimate."),
      },
    },
    async ({ facilitatorLink, story }) => {
      const token = lastSegment(facilitatorLink);
      const r = await pokerApi(env, "POST", `/api/poker/${encodeURIComponent(token)}/next`,
        story === undefined ? {} : { story });
      if (!r.ok) return fail(`Could not start the next round: ${r.data?.error || r.status}`);
      return say(`New round open${story ? ` on "${story}"` : ""}. Same share link; everyone votes again.`);
    }
  );

  /* Voting is deliberately NOT a tool. An estimate is the one thing in this
     exercise that has to come from the person holding the opinion — the whole
     point of simultaneous reveal is to catch genuine disagreement, and an
     agent voting on someone's behalf launders exactly the signal the meeting
     exists to surface. People vote on their own phones. */

  return server;
}

/* The factory closes over THIS request's env, and the handler is built inside
   the request rather than once at module scope. No mutable module state: two
   concurrent MCP requests cannot see each other's env, and there is nothing
   for a second request to overwrite while the first is still awaiting D1. */
export function handleMcp(request, env, ctx) {
  return createMcpHandler(() => createServer(env))(request, env, ctx);
}
