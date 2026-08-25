/* ============================================================
   Scrum Poker — the team estimates a story. Everyone picks a card
   privately, the facilitator reveals, and the spread is the thing
   worth talking about.

   The integrity of the whole exercise is that nobody sees a number
   before they commit their own, so two rules run through this file:

     1. No unrevealed card ever leaves the server. Not in the HTML,
        not in the polling payload, not to the facilitator. Before a
        reveal the only fact published is HOW MANY have voted.
     2. A voter can change their mind freely until the reveal, and
        cannot change it after. The round is stamped on the vote, so
        a late POST against a round that has already moved on is
        ignored rather than silently applied to the new story.

   ROUNDS WITHOUT CLEARING
   Each participant row holds that browser's vote for one round:
   { round, card, name }. "Next story" just increments round on the
   instance — every existing vote is stale by definition, so nothing
   has to be wiped and a fresh round costs one write instead of one
   per player. Re-voting overwrites the row in place.

   IDENTITY
   Nobody signs in. A browser gets a participant token on its first
   vote and keeps it in localStorage, which is what lets it change
   its mind and what stops one person voting twice. Putting a name on
   it is optional: the kudos wall requires names on purpose and the
   weekly pulse forbids them on purpose, and poker genuinely sits in
   between — a facilitator wants to know who is still to vote, but
   nobody should have to type anything to estimate a story.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken,
  createInstance, deleteInstance, logEvent, shareNudge } from "../lib.js";

const MAX_TEAM = 60;
const MAX_STORY = 120;
const MAX_NAME = 24;
const MAX_VOTERS = 60;
const MAX_ROUNDS = 500;

/* The two decks worth shipping. "?" means "I cannot size this yet",
   which is a real answer and the one most likely to start the useful
   conversation. The coffee cup is the standard "I need a break" card
   and teams expect to find it. */
const DECKS = {
  fib:    ["1", "2", "3", "5", "8", "13", "21", "?", "☕"],
  tshirt: ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"],
};
const NON_NUMERIC = new Set(["?", "☕"]);

/* Never index DECKS bare. parseCreate guards the input, but a row written
   before that guard existed would otherwise throw inside .map/.includes and
   500 the public page for good. */
const deckOf = (name) =>
  (Object.prototype.hasOwnProperty.call(DECKS, name) && DECKS[name]) || DECKS.fib;

const NOUNS = ["estimate", "sprint", "backlog", "pointer", "standup",
  "story", "velocity", "refine", "planning", "fibonacci"];

const HOME = "/scrum-poker/";

/* ---------- data access ------------------------------------- */

const allVotes = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT id, token, data FROM participants WHERE instance_id = ? ORDER BY id"
  ).bind(instanceId).all()).results;

function pdata(p) {
  try { return JSON.parse(p.data) || {}; }
  catch { return {}; }
}

/** Votes belonging to the round currently in play. */
const forRound = (parts, round) =>
  parts.map(pdata).filter((v) => v.round === round && v.card);

/* Optimistic read-modify-write on instances.data, the same helper the other
   blob-mutating tools use. It matters more here than in most of them: this
   blob holds `round` and `revealed`, so a lost update does not merely drop an
   edit, it moves the board BACKWARDS — a "next story" landing at the same
   moment as a "reveal" can resurrect the previous round with its votes
   already on the table. */
async function mutateData(env, id, mutate) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await env.DB.prepare(
      "SELECT data, updated_at FROM instances WHERE id = ?"
    ).bind(id).first();
    if (!cur) { const e = new Error("not found"); e.status = 404; throw e; }
    const next = mutate(JSON.parse(cur.data));
    const res = await env.DB.prepare(
      "UPDATE instances SET data = ?, updated_at = ? WHERE id = ? AND updated_at = ?"
    ).bind(JSON.stringify(next), new Date().toISOString(), id, cur.updated_at).run();
    if (res.meta.changes) return next;
  }
  const e = new Error("Two people are driving this board at once — try that again.");
  e.status = 409;
  throw e;
}

/* ---------- input ------------------------------------------- */

function parseCreate(body) {
  const team = String(body.team || "").trim().replace(/\s+/g, " ").slice(0, MAX_TEAM);
  const story = String(body.story || "").trim().replace(/\s+/g, " ").slice(0, MAX_STORY);
  const deck = Object.prototype.hasOwnProperty.call(DECKS, body.deck) ? String(body.deck) : "fib";
  return { team, story, deck };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { team, story, deck } = parseCreate(await request.json().catch(() => ({})));
  const data = JSON.stringify({ team, deck, story, round: 1, revealed: false });
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "poker", title: team, data, nouns: NOUNS,
  });
  await logEvent(env, id, "poker", "created");
  return json({ slug, editToken }, 201);
}

/* One vote. Returns the voter's token so the browser can keep it and
   change its mind; never returns anybody else's card. */
async function vote(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "poker") return json({ error: "not found" }, 404);

  const data = JSON.parse(row.data);
  if (data.revealed)
    throw badInput("The cards are already on the table — wait for the next story.");

  const card = String(body.card || "");
  if (!deckOf(data.deck).includes(card))
    throw badInput("That card isn't in this deck.");

  /* The round the voter's page was SHOWING when they tapped. Without this a
     card chosen for the story that just ended is applied to the new one —
     and the window is not bounded by the 2s poll, because polling stops
     while the tab is hidden, so a phone that slept mid-round wakes up still
     displaying the old story. Same shape as qotd.js staleBallot(). */
  if (Number.isInteger(body.round) && body.round !== data.round)
    return json({ error: "That was the previous story — here's the new one.", stale: true, round: data.round }, 409);

  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  const token = String(body.token || "");
  const now = new Date().toISOString();

  // Changing your mind: the browser already holds a token for this
  // instance. Scoped to instance_id so a token from another game
  // cannot be replayed here.
  if (token) {
    const hit = await env.DB.prepare(
      `UPDATE participants SET data = ?, claimed_at = ?
       WHERE instance_id = ? AND token = ? RETURNING id`
    ).bind(JSON.stringify({ round: data.round, card, name }), now, row.id, token).first();
    if (hit) return json({ ok: true, token });
  }

  const c = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM participants WHERE instance_id = ?"
  ).bind(row.id).first();
  if (((c && c.n) || 0) >= MAX_VOTERS)
    return json({ error: "Sixty voters is the limit for one game." }, 409);

  const fresh = randomString(22);
  await env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, claimed_at, created_at)
     VALUES (?, ?, '', ?, ?, ?)`
  ).bind(row.id, fresh, JSON.stringify({ round: data.round, card, name }), now, now).run();

  return json({ ok: true, token: fresh }, 201);
}

/* The polling endpoint. This is the one place a leak would be
   invisible, so it is written to make leaking hard: before the
   reveal it builds a list of NAMES ONLY and never touches `card`. */
async function state(slug, env) {
  const row = await getBySlug(env, slug);
  if (!row || row.tool_type !== "poker") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);
  const parts = await allVotes(env, row.id);
  const votes = forRound(parts, data.round);

  const base = {
    round: data.round,
    story: data.story || "",
    revealed: !!data.revealed,
    count: votes.length,
    // Who has voted is safe to publish and is what a facilitator
    // actually needs; WHAT they voted is not.
    who: votes.map((v) => v.name || "").filter(Boolean),
  };
  if (!data.revealed) return json(base);

  return json({ ...base, cards: votes.map((v) => ({ name: v.name || "", card: v.card })), ...summarise(votes) });
}

async function reveal(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "poker") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);
  const parts = await allVotes(env, row.id);
  if (!forRound(parts, data.round).length)
    throw badInput("Nobody has voted yet — nothing to turn over.");
  await mutateData(env, row.id, (d) => ({ ...d, revealed: true }));
  await logEvent(env, row.id, "poker", "revealed");
  return json({ ok: true });
}

/* Next story. Bumping the round is what retires every existing vote,
   so no rows are touched and a 60-person game costs one write. */
async function next(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "poker") return json({ error: "not found" }, 404);
  const body = await request.json().catch(() => ({}));
  const story = String(body.story || "").trim().replace(/\s+/g, " ").slice(0, MAX_STORY);

  /* Through CAS, and the limit is checked INSIDE the mutator against the
     freshly-read row: checking it against a copy read before the update
     would let two quick taps both pass and advance twice. */
  const nextData = await mutateData(env, row.id, (d) => {
    if (d.round >= MAX_ROUNDS)
      throw badInput("Five hundred stories in one game is the limit — start a fresh board.");
    return { ...d, story, round: d.round + 1, revealed: false };
  });

  /* Rows from rounds that will never be shown again. Kept for a few
     rounds so a mis-tapped "next story" can be reasoned about, then
     pruned so a long refinement session does not accumulate a row per
     player per story forever. */
  await env.DB.prepare(
    `DELETE FROM participants WHERE instance_id = ?
     AND CAST(json_extract(data, '$.round') AS INTEGER) < ?`
  ).bind(row.id, nextData.round - 3).run();

  return json({ ok: true, round: nextData.round });
}

async function setStory(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "poker") return json({ error: "not found" }, 404);
  const body = await request.json().catch(() => ({}));
  const story = String(body.story || "").trim().replace(/\s+/g, " ").slice(0, MAX_STORY);
  await mutateData(env, row.id, (d) => ({ ...d, story }));
  return json({ ok: true, story });
}

async function remove(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "poker") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "poker", "deleted");
  return json({ ok: true });
}

/* ---------- the bit worth reading out ----------------------- */

/* Planning poker's value is the disagreement, not the average. So the
   summary names the high and the low and says whether the group is
   actually together — it deliberately does not compute a mean, which
   would invite treating an estimate as arithmetic. */
function summarise(votes) {
  const nums = votes
    .filter((v) => !NON_NUMERIC.has(v.card))
    .map((v) => ({ ...v, n: parseFloat(v.card) }))
    .filter((v) => Number.isFinite(v.n));
  const unsure = votes.length - nums.length;
  if (!nums.length) return { agreed: false, low: null, high: null, unsure };

  const sorted = [...nums].sort((a, b) => a.n - b.n);
  const low = sorted[0], high = sorted[sorted.length - 1];
  return {
    agreed: low.card === high.card && !unsure,
    low: { name: low.name || "", card: low.card },
    high: { name: high.name || "", card: high.card },
    unsure,
  };
}

function verdict(votes) {
  const s = summarise(votes);
  if (s.agreed) return `<p class="pk-verdict pk-agreed">Everyone said <strong>${esc(s.low.card)}</strong>. Write it down and move on.</p>`;
  if (!s.low) return `<p class="pk-verdict">Nobody put a number on it. That is usually a sign the story needs splitting or a question answered first.</p>`;
  if (s.low.card === s.high.card)
    return `<p class="pk-verdict">Everyone with a number said <strong>${esc(s.low.card)}</strong>${s.unsure ? `, and ${s.unsure} ${s.unsure === 1 ? "person is" : "people are"} not sure` : ""}.</p>`;
  return `<p class="pk-verdict">Spread is <strong>${esc(s.low.card)}</strong> to <strong>${esc(s.high.card)}</strong>${s.unsure ? `, with ${s.unsure} unsure` : ""}.
    Ask those two what they are each seeing — that conversation is the point of the exercise.</p>`;
}

/* ---------- pages ------------------------------------------- */

const storyLine = (data) => data.story
  ? `<p class="pk-story">${esc(data.story)}</p>`
  : `<p class="pk-story pk-story-empty">Waiting for the facilitator to name the story…</p>`;

function deckHtml(deck) {
  return `<div class="pk-deck" id="pkDeck">${deckOf(deck).map((c) =>
    `<button type="button" class="pk-card" data-card="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;
}

async function publicPage(row, env, url) {
  const data = JSON.parse(row.data);
  const parts = await allVotes(env, row.id);
  const votes = forRound(parts, data.round);

  /* Note what is NOT here: no card values in the markup unless the
     facilitator has revealed. "View source" is the first thing a
     curious engineer does, and this is a room full of engineers. */
  const table = data.revealed
    ? `<ul class="pk-table">${votes.map((v) => `
        <li class="pk-slot pk-shown">
          <span class="pk-slot-card">${esc(v.card)}</span>
          <span class="pk-slot-name">${v.name ? esc(v.name) : "&mdash;"}</span>
        </li>`).join("")}</ul>
       ${verdict(votes)}`
    : `<ul class="pk-table">${votes.map((v) => `
        <li class="pk-slot pk-hidden"><span class="pk-slot-card">&bull;</span>
        <span class="pk-slot-name">${v.name ? esc(v.name) : "&mdash;"}</span></li>`).join("")}</ul>
       <p class="pk-count" id="pkCount">${votes.length === 0
         ? "Nobody has voted yet."
         : `<strong>${votes.length}</strong> ${votes.length === 1 ? "vote" : "votes"} in. Cards stay face down until the facilitator turns them over.`}</p>`;

  const body = `
<main class="wrap page" data-slug="${esc(row.slug)}" data-round="${data.round}" data-revealed="${data.revealed ? "1" : "0"}">
  <p class="kicker">Round ${data.round}${data.team ? ` &middot; ${esc(data.team)}` : ""}</p>
  <h1>Scrum poker</h1>
  ${storyLine(data)}

  <section class="pk-vote" id="pkVote"${data.revealed ? " hidden" : ""}>
    <p class="lede">Pick your card. You can change it until the cards are turned over — nobody sees it before then, including the facilitator.</p>
    ${deckHtml(data.deck)}
    <label class="field pk-name-field">
      <span>Your name <em>(optional — so the team knows who is still to vote)</em></span>
      <input type="text" id="pkName" maxlength="${MAX_NAME}" placeholder="Priya" autocomplete="off">
    </label>
    <p class="form-error" id="pkError" role="alert" hidden></p>
  </section>

  <!-- role="status" so the reveal is announced rather than silently swapped
       in; tabindex="-1" so focus can be moved here when the deck is hidden,
       which otherwise dumps a keyboard user back at the top of the page. -->
  <section class="pk-result" id="pkResult" role="status" tabindex="-1">${table}</section>

  <footer class="page-foot">
    <p><a class="quiet-link" href="/via/poker">made with biti by bit &rarr;</a></p>
  </footer>
</main>
<script src="/poker-view.js"></script>`;

  return html(pageShell({
    title: data.team ? `${data.team} — scrum poker` : "Scrum poker",
    body, shareType: "poker", shareSlug: row.slug,
  }));
}

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const parts = await allVotes(env, row.id);
  const votes = forRound(parts, data.round);
  const shareUrl = `${origin}/s/${row.slug}`;

  const body = `
<main class="wrap page" data-token="${esc(row.edit_token)}" data-slug="${esc(row.slug)}">
  <p class="kicker">Facilitator &middot; round ${data.round}</p>
  <h1>${esc(data.team || "Scrum poker")}</h1>

  <div class="share-box">
    <label class="share-label" for="shareUrl">The team opens this link — same one every story, every sprint</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🃏 Sizing a few stories — pick a card and we'll turn them over together. No signup: " + shareUrl)}

  <label class="field">
    <span>What are we sizing?</span>
    <input type="text" id="story" maxlength="${MAX_STORY}" value="${esc(data.story || "")}"
           placeholder="Search results pagination" autocomplete="off">
  </label>

  <p class="pk-count" id="pkCount"><strong>${votes.length}</strong> ${votes.length === 1 ? "vote" : "votes"} in</p>
  <ul class="pk-table" id="pkTable">${votes.map((v) => `
    <li class="pk-slot ${data.revealed ? "pk-shown" : "pk-hidden"}">
      <span class="pk-slot-card">${data.revealed ? esc(v.card) : "&bull;"}</span>
      <span class="pk-slot-name">${v.name ? esc(v.name) : "&mdash;"}</span>
    </li>`).join("")}</ul>
  ${data.revealed ? verdict(votes) : ""}

  <p class="form-error" id="pkError" role="alert" hidden></p>
  <div class="pk-controls">
    <button class="btn primary big" type="button" id="revealBtn"${data.revealed ? " hidden" : ""}>Turn the cards over &rarr;</button>
    <button class="btn primary big" type="button" id="nextBtn"${data.revealed ? "" : " hidden"}>Next story &rarr;</button>
  </div>

  <section class="content">
    <h2>How to run it</h2>
    <p>Name the story, let everyone pick, then turn the cards over. If the
    numbers match, write it down and move on. If they do not, ask the highest
    and the lowest what they are each seeing — that disagreement is the whole
    reason to estimate as a group, and it usually surfaces a requirement
    nobody had said out loud.</p>
    <p>Nobody needs an account and nobody needs to install anything. The same
    link works for every story and every sprint after this one.</p>

    <h2>Close it down</h2>
    <p class="fine">Deleting removes the board and every vote on it. The link
    stops working for everyone.</p>
    <button class="btn danger" type="button" id="deleteBtn">Delete this board</button>
  </section>

  <footer class="page-foot"><p><a class="quiet-link" href="${HOME}">biti by bit &rarr;</a></p></footer>
</main>
<script src="/poker-edit.js"></script>`;

  return html(pageShell({ title: `${data.team || "Scrum poker"} (facilitator)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "poker",

  async api(request, env, url) {
    const p = url.pathname;
    if (!p.startsWith("/api/poker")) return null;
    let m;

    if (request.method === "GET") {
      if ((m = p.match(/^\/api\/poker\/([a-z0-9-]+)\/state$/))) return state(m[1], env);
      return null;
    }

    if (request.method !== "POST") return null;
    if (p === "/api/poker") return create(request, env);
    if (p === "/api/poker/vote") return vote(request, env);
    if ((m = p.match(/^\/api\/poker\/([a-z0-9]+)\/(reveal|next|story|delete)$/)))
      return m[2] === "reveal" ? reveal(m[1], request, env)
        : m[2] === "next" ? next(m[1], request, env)
        : m[2] === "story" ? setStory(m[1], request, env)
        : remove(m[1], env);
    return null;
  },

  publicPage: (row, env, url) => publicPage(row, env, url),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
