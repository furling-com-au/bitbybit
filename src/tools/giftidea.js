/* ============================================================
   Gift Idea Board — "what should we get Mum for her 60th?"
   Everyone suggests gift ideas and upvotes them, and can claim
   "I'll get this one" so nobody double-buys. It marries the two
   older mechanics:

     - suggest + vote  → each idea is a `participants` row (like
       Group Card: name stays '' so duplicate ideas are fine; the
       display text lives in the data JSON). Votes are a soft,
       localStorage-deduped counter kept as an integer on the row.
     - claim to buy    → a `claims` row per idea, with slot_id set
       to the idea's stable row id. The UNIQUE(instance_id, slot_id)
       constraint is the race protection: two people going for the
       same idea resolve at the database, not in JS, so exactly one
       ends up buying it.

   It is a SURPRISE board: the shared /s/ link goes to everyone
   EXCEPT the person the gift is for. The copy hammers that home.
   No money changes hands here — it sorts out who buys what; the
   dollars stay between the group, same as always.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, getParticipant, getInstanceById,
  createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_RECIPIENT = 80;
const MAX_OCCASION = 80;
const MAX_BUDGET = 40;
const MAX_NOTE = 300;
const MAX_IDEA = 120;
const MAX_LINK = 300;
const MAX_BY = 40;
const MAX_NAME = 40;
const MAX_IDEAS = 200;

const NOUNS = ["wrap", "ribbon", "token", "surprise", "haul", "unbox",
  "trinket", "keepsake", "splurge", "wishlist"];

const HOME = "/gift-ideas/";

const clean = (v, max) => String(v || "").trim().replace(/\s+/g, " ").slice(0, max);

/* A product link, only if it's a real http/https URL. Anything else
   (javascript:, data:, a bare word) is refused rather than stored —
   the public page renders it as a clickable link, so it must not be
   able to smuggle a scheme past us. */
function cleanLink(raw) {
  const s = String(raw || "").trim().slice(0, MAX_LINK);
  if (!s) return "";
  let u;
  try { u = new URL(s); } catch {
    throw badInput("That link doesn't look right — paste the full web address, or leave it blank.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw badInput("Links need to start with http:// or https://.");
  return u.toString().slice(0, MAX_LINK);
}

/* ---------- data access ------------------------------------- */

const allIdeas = async (env, instanceId) =>
  (await env.DB.prepare("SELECT * FROM participants WHERE instance_id = ? ORDER BY id")
    .bind(instanceId).all()).results;

const allClaims = async (env, instanceId) =>
  (await env.DB.prepare("SELECT * FROM claims WHERE instance_id = ?")
    .bind(instanceId).all()).results;

/* Parse an idea row's data JSON into a tidy shape. */
function ideaOf(p) {
  let d = {};
  try { d = JSON.parse(p.data); } catch { /* fine */ }
  const v = Number(d.votes);
  return {
    id: p.id,
    token: p.token,
    idea: String(d.idea || ""),
    link: String(d.link || ""),
    by: String(d.suggestedBy || ""),
    votes: Number.isFinite(v) && v > 0 ? Math.floor(v) : 0,
  };
}

/* Most-wanted first; ties break by insertion order (earliest id). */
function sortedIdeas(parts) {
  return parts.map(ideaOf).sort((a, b) => (b.votes - a.votes) || (a.id - b.id));
}

/* ---------- input ------------------------------------------- */

function parseCreate(body) {
  const recipient = clean(body.recipient, MAX_RECIPIENT);
  if (!recipient) throw badInput("Who's the gift for? Add their name.");
  const occasion = clean(body.occasion, MAX_OCCASION);
  const budget = clean(body.budget, MAX_BUDGET);
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);
  return { recipient, occasion, budget, note };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { recipient, occasion, budget, note } =
    parseCreate(await request.json().catch(() => ({})));
  const title = `Gift ideas for ${recipient}`;
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "giftidea", title,
    data: JSON.stringify({ recipient, occasion, budget, note }),
    nouns: NOUNS,
  });
  await logEvent(env, id, "giftidea", "created");
  return json({ slug, editToken }, 201);
}

async function suggest(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "giftidea") return json({ error: "not found" }, 404);

  const idea = clean(body.idea, MAX_IDEA);
  if (!idea) throw badInput("Add the idea itself — a few words is plenty.");
  const link = cleanLink(body.link);
  const by = clean(body.suggestedBy, MAX_BY);

  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM participants WHERE instance_id = ?"
  ).bind(row.id).first();
  if (((count && count.n) || 0) >= MAX_IDEAS)
    return json({ error: "That's a heap of ideas — the board's full at 200. Clear a few out first." }, 409);

  // name stays '' so two identical ideas are allowed (the partial
  // unique index only bites on non-empty names). Votes start at 0.
  const token = randomString(22);
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, created_at)
     VALUES (?, ?, '', ?, ?)`
  ).bind(row.id, token, JSON.stringify({ idea, link, suggestedBy: by, votes: 0 }), now).run();
  return json({ token, id: res.meta.last_row_id }, 201);
}

/* Suggester removes their own idea, via the token they were handed
   when they added it. Takes the matching claim with it (an idea
   nobody can see anymore shouldn't leave an orphan "getting this"). */
async function suggesterRemove(itoken, env) {
  const prow = await getParticipant(env, itoken);
  const row = prow && await getInstanceById(env, prow.instance_id);
  if (!row || row.tool_type !== "giftidea")
    return json({ error: "That idea wasn't found — it may already be gone." }, 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM claims WHERE instance_id = ? AND slot_id = ?").bind(row.id, String(prow.id)),
    env.DB.prepare("DELETE FROM participants WHERE id = ?").bind(prow.id),
  ]);
  return json({ ok: true });
}

/* A soft upvote. Deduped per-voter client-side via localStorage —
   honest, not enforced. The increment is done in one atomic UPDATE
   with json_set so simultaneous votes don't lose each other. */
async function upvote(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "giftidea") return json({ error: "not found" }, 404);

  const ideaId = parseInt(body.ideaId, 10);
  if (!Number.isInteger(ideaId)) return json({ error: "That idea wasn't found." }, 404);

  const hit = await env.DB.prepare(
    `UPDATE participants
        SET data = json_set(data, '$.votes', COALESCE(json_extract(data, '$.votes'), 0) + 1)
      WHERE id = ? AND instance_id = ?
      RETURNING json_extract(data, '$.votes') AS votes`
  ).bind(ideaId, row.id).first();
  if (!hit) return json({ error: "That idea wasn't found." }, 404);
  return json({ ok: true, votes: hit.votes });
}

async function claim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "giftidea") return json({ error: "not found" }, 404);

  const ideaId = parseInt(body.ideaId, 10);
  if (!Number.isInteger(ideaId)) return json({ error: "That idea wasn't found." }, 404);
  const name = clean(body.name, MAX_NAME);
  if (!name) throw badInput("Add your name so nobody else buys it too.");

  // The idea must live on THIS board — never let one instance's id
  // reach into another's claims.
  const idea = await env.DB.prepare(
    "SELECT id FROM participants WHERE id = ? AND instance_id = ?"
  ).bind(ideaId, row.id).first();
  if (!idea) return json({ error: "That idea wasn't found." }, 404);

  const secret = randomString(16);
  try {
    // UNIQUE(instance_id, slot_id) makes this atomic: whoever inserts
    // first is the buyer, the other gets a constraint violation.
    await env.DB.prepare(
      `INSERT INTO claims (instance_id, slot_id, name, message, cents, ref, paid, created_at)
       VALUES (?, ?, ?, '', 0, ?, 0, ?)`
    ).bind(row.id, String(ideaId), name, secret, new Date().toISOString()).run();
  } catch (e) {
    if (/UNIQUE/.test(String(e)))
      return json({ error: "Someone's already getting that one." }, 409);
    throw e;
  }
  return json({ secret }, 201);
}

async function unclaim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "giftidea") return json({ error: "not found" }, 404);

  const ideaId = parseInt(body.ideaId, 10);
  const secret = String(body.secret || "");
  if (!Number.isInteger(ideaId) || !secret) return json({ error: "That claim wasn't found." }, 404);

  const res = await env.DB.prepare(
    "DELETE FROM claims WHERE instance_id = ? AND slot_id = ? AND ref = ?"
  ).bind(row.id, String(ideaId), secret).run();
  if (!res.meta.changes) return json({ error: "That claim wasn't found." }, 404);
  return json({ ok: true });
}

/* Organiser removes any idea (by that idea's suggester token, which
   the organiser page renders in its own private markup). */
async function orgRemoveIdea(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "giftidea") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const itoken = String(body.itoken || "");
  if (!itoken) return json({ error: "That idea wasn't found." }, 404);

  const p = await env.DB.prepare(
    "SELECT id FROM participants WHERE instance_id = ? AND token = ?"
  ).bind(row.id, itoken).first();
  if (!p) return json({ error: "That idea wasn't found." }, 404);

  await env.DB.batch([
    env.DB.prepare("DELETE FROM claims WHERE instance_id = ? AND slot_id = ?").bind(row.id, String(p.id)),
    env.DB.prepare("DELETE FROM participants WHERE id = ?").bind(p.id),
  ]);
  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "giftidea") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "giftidea", "deleted");
  return json({ ok: true });
}

/* ---------- rendering helpers ------------------------------- */

function metaBlock(data) {
  const chips = [];
  if (data.occasion) chips.push(`<span class="gi-chip"><strong>Occasion:</strong> ${esc(data.occasion)}</span>`);
  if (data.budget) chips.push(`<span class="gi-chip"><strong>Budget:</strong> ${esc(data.budget)}</span>`);
  const chipRow = chips.length ? `<div class="gi-meta">${chips.join("")}</div>` : "";
  const note = data.note ? `<p class="gi-note">${esc(data.note)}</p>` : "";
  return chipRow + note;
}

function subLine(ideas, claimed) {
  const n = ideas.length;
  return `${n} ${n === 1 ? "idea" : "ideas"} · ${claimed} being bought`;
}

function linkHtml(link) {
  return link
    ? `<a class="gi-link" href="${esc(link)}" target="_blank" rel="nofollow noopener">see it →</a>`
    : "";
}

function voteBar(e, withButton) {
  const word = e.votes === 1 ? "vote" : "votes";
  const btn = withButton
    ? `<button class="btn gi-vote" type="button" data-id="${e.id}">Good idea</button>`
    : "";
  return `<div class="gi-votebar">
        <span class="gi-vote-count" data-id="${e.id}">${e.votes}</span>
        <span class="gi-vote-word" data-id="${e.id}">${word}</span>
        ${btn}
      </div>`;
}

/* Public idea card. The claim's buyer name is shown to everyone on
   the shared board (that's the whole point — so nobody doubles up).
   The buyer's SECRET is never rendered; it lives only in the buyer's
   own localStorage and gates their self-unclaim. */
function ideaCardPublic(e, claim) {
  const by = e.by ? `<span class="gi-by">suggested by ${esc(e.by)}</span>` : "";
  const claimBlock = claim
    ? `<div class="gi-claimed" data-id="${e.id}">
        <span class="gi-claimed-label">Sorted</span>
        <strong>${esc(claim.name)}</strong> is getting this
      </div>`
    : `<div class="gi-claimrow">
        <button class="btn gi-claim-btn" type="button" data-id="${e.id}">I'll get this</button>
        <form class="gi-claim-form" hidden>
          <input type="text" name="buyer" maxlength="${MAX_NAME}" placeholder="Your name" aria-label="Your name" autocomplete="name">
          <div class="gi-claim-formrow">
            <button class="btn primary gi-mini" type="submit">I'll get it</button>
            <button class="btn ghost gi-mini gi-claim-cancel" type="button">Never mind</button>
          </div>
          <p class="gi-claim-err" hidden></p>
        </form>
      </div>`;
  return `
    <li class="gi-card${claim ? " claimed" : ""}" data-id="${e.id}">
      <p class="gi-idea">${esc(e.idea)}</p>
      ${linkHtml(e.link)}
      ${voteBar(e, true)}
      ${by}
      ${claimBlock}
    </li>`;
}

/* Organiser idea card — read-only, plus a Remove button carrying the
   idea's own token. This markup is only ever served on the /e/ page. */
function ideaCardOrg(e, claim) {
  const by = e.by ? `<span class="gi-by">suggested by ${esc(e.by)}</span>` : "";
  const claimBlock = claim
    ? `<div class="gi-claimed" data-id="${e.id}">
        <span class="gi-claimed-label">Sorted</span>
        <strong>${esc(claim.name)}</strong> is getting this
      </div>`
    : `<div class="gi-claimed gi-open"><span class="gi-claimed-label">Up for grabs</span> nobody's on it yet</div>`;
  return `
    <li class="gi-card${claim ? " claimed" : ""}" data-id="${e.id}">
      <p class="gi-idea">${esc(e.idea)}</p>
      ${linkHtml(e.link)}
      ${voteBar(e, false)}
      ${by}
      ${claimBlock}
      <button class="btn ghost gi-mini gi-remove" type="button" data-token="${esc(e.token)}">Remove idea</button>
    </li>`;
}

/* ---------- public page (/s/:slug) -------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const parts = await allIdeas(env, row.id);
  const claims = await allClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;

  const ideas = sortedIdeas(parts);
  const listHtml = ideas.length
    ? `<ul class="gi-list">${ideas.map((e) => ideaCardPublic(e, bySlot[String(e.id)])).join("")}
      </ul>`
    : `<p class="gi-empty">No ideas yet — get the ball rolling below.</p>`;

  const body = `
<main class="wrap page">
  <p class="kicker">Group gift — ideas &amp; who's buying</p>
  <h1>Gift ideas for ${esc(data.recipient)}</h1>
  <p class="page-sub">${subLine(ideas, claims.length)}</p>

  <div class="gi-surprise">
    <strong>Keep it a surprise.</strong> This board is for everyone
    <em>except ${esc(data.recipient)}</em> — don't share the link with them.
  </div>

  ${metaBlock(data)}

  <p class="lede">Add ideas, upvote the good ones, and when you'll buy
  something tap <strong>I'll get this</strong> so nobody doubles up.</p>

  ${listHtml}

  <section class="gi-add" id="giAdd">
    <h2>Add an idea</h2>
    <div class="panel">
      <form id="ideaForm" novalidate>
        <label class="field">
          <span>The idea</span>
          <input type="text" id="ideaText" maxlength="${MAX_IDEA}"
            placeholder="A good frying pan / weekend away / concert tickets">
        </label>
        <label class="field">
          <span>Link <em>(optional — a product page)</em></span>
          <input type="text" id="ideaLink" maxlength="${MAX_LINK}" inputmode="url"
            placeholder="https://…">
        </label>
        <label class="field">
          <span>Your name <em>(optional)</em></span>
          <input type="text" id="ideaBy" maxlength="${MAX_BY}"
            placeholder="So people know whose idea it was" autocomplete="name">
        </label>
        <p class="form-error" id="ideaErr" hidden></p>
        <button class="btn primary" id="ideaBtn" type="submit">Add the idea →</button>
      </form>
    </div>
    <p class="fine">No account — just an idea. This browser remembers the
    ideas you added and the ones you're buying, so you can take them back.</p>
  </section>

  <footer class="page-foot">
    <p><a class="quiet-link" href="/via/giftidea">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var K_SUG = "bbb:giftidea:sug:" + slug;
  var K_CLAIM = "bbb:giftidea:claim:" + slug;
  var K_VOTE = "bbb:giftidea:vote:" + slug;

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (e) { return []; }
  }
  function write(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function cardFor(id) {
    if (!/^\\d+$/.test(String(id))) return null;
    return document.querySelector('.gi-card[data-id="' + id + '"]');
  }
  function errText(d, fallback) { return (d && d.error) || fallback; }

  /* ---- your own suggestions: badge + remove ---- */
  var sug = read(K_SUG).filter(function (s) { return cardFor(s.id); });
  write(K_SUG, sug);
  sug.forEach(function (s) {
    var card = cardFor(s.id);
    if (!card) return;
    var badge = document.createElement("span");
    badge.className = "gi-you";
    badge.textContent = "your idea";
    var idea = card.querySelector(".gi-idea");
    idea.parentNode.insertBefore(badge, idea);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost gi-mini";
    btn.textContent = "Remove my idea";
    btn.addEventListener("click", function () {
      if (!confirm("Remove your idea? Any claim on it is cleared too.")) return;
      fetch("/api/giftidea/i/" + s.token + "/remove", { method: "POST" })
        .then(function (r) {
          if (!r.ok && r.status !== 404)
            return r.json().catch(function () { return {}; }).then(function (d) {
              throw new Error(errText(d, "That didn't work — try again."));
            });
          write(K_SUG, read(K_SUG).filter(function (x) { return x.id !== s.id; }));
          location.reload();
        }).catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
    card.appendChild(btn);
  });

  /* ---- voting (soft, deduped in this browser) ---- */
  var voted = read(K_VOTE);
  document.querySelectorAll(".gi-vote").forEach(function (btn) {
    var id = Number(btn.getAttribute("data-id"));
    if (voted.indexOf(id) !== -1) markVoted(btn);
    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      btn.disabled = true;
      fetch("/api/giftidea/upvote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug, ideaId: id }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(errText(d, "Server said " + r.status + "."));
          var v = read(K_VOTE);
          if (v.indexOf(id) === -1) { v.push(id); write(K_VOTE, v); }
          var n = Number(d.votes);
          if (isFinite(n)) {
            var count = document.querySelector('.gi-vote-count[data-id="' + id + '"]');
            var word = document.querySelector('.gi-vote-word[data-id="' + id + '"]');
            if (count) count.textContent = n;
            if (word) word.textContent = n === 1 ? "vote" : "votes";
          }
          markVoted(btn);
        });
      }).catch(function (e) {
        btn.disabled = false;
        alert((e && e.message) || "That didn't work — try again.");
      });
    });
  });
  function markVoted(btn) {
    btn.disabled = true;
    btn.textContent = "Voted";
    btn.classList.add("is-voted");
  }

  /* ---- claiming: reveal the name form, then buy ---- */
  document.querySelectorAll(".gi-claimrow").forEach(function (row2) {
    var open = row2.querySelector(".gi-claim-btn");
    var form = row2.querySelector(".gi-claim-form");
    if (!open || !form) return;
    var input = form.querySelector('input[name="buyer"]');
    var submit = form.querySelector('button[type="submit"]');
    var err = form.querySelector(".gi-claim-err");
    var card = row2.closest(".gi-card");
    var id = Number(card.getAttribute("data-id"));

    open.addEventListener("click", function () {
      open.hidden = true;
      form.hidden = false;
      input.focus();
    });
    form.querySelector(".gi-claim-cancel").addEventListener("click", function () {
      form.hidden = true;
      err.hidden = true;
      open.hidden = false;
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var name = input.value.trim();
      if (!name) return fail("Add your name so nobody else buys it too.");
      submit.disabled = true;
      submit.textContent = "Saving…";
      fetch("/api/giftidea/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug, ideaId: id, name: name }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 409) {
            fail(errText(d, "Someone's already getting that one."));
            setTimeout(function () { location.reload(); }, 1800);
            return;
          }
          if (!r.ok) throw new Error(errText(d, "Server said " + r.status + "."));
          var list = read(K_CLAIM);
          list.push({ ideaId: id, secret: d.secret });
          write(K_CLAIM, list);
          location.reload();
        });
      }).catch(function (ex) { fail((ex && ex.message) || "That didn't work — try again."); });

      function fail(msg) {
        err.textContent = msg;
        err.hidden = false;
        submit.disabled = false;
        submit.textContent = "I'll get it";
        return false;
      }
    });
  });

  /* ---- your own claims: badge + undo ---- */
  var claims = read(K_CLAIM).filter(function (c) {
    var card = cardFor(c.ideaId);
    return card && card.classList.contains("claimed");
  });
  write(K_CLAIM, claims);
  claims.forEach(function (c) {
    var card = cardFor(c.ideaId);
    if (!card) return;
    var badge = document.createElement("span");
    badge.className = "gi-you";
    badge.textContent = "you're buying this";
    var claimed = card.querySelector(".gi-claimed");
    if (claimed) claimed.appendChild(badge);

    var undo = document.createElement("button");
    undo.type = "button";
    undo.className = "btn ghost gi-mini";
    undo.textContent = "Actually, I can't";
    undo.addEventListener("click", function () {
      if (!confirm("Let this idea go? It opens back up for someone else to buy.")) return;
      fetch("/api/giftidea/unclaim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug, ideaId: c.ideaId, secret: c.secret }),
      }).then(function (r) {
        if (!r.ok && r.status !== 404)
          return r.json().catch(function () { return {}; }).then(function (d) {
            throw new Error(errText(d, "That didn't work — try again."));
          });
        write(K_CLAIM, read(K_CLAIM).filter(function (x) { return x.ideaId !== c.ideaId; }));
        location.reload();
      }).catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
    card.appendChild(undo);
  });

  /* ---- add an idea ---- */
  var form = document.getElementById("ideaForm");
  var btn = document.getElementById("ideaBtn");
  var err = document.getElementById("ideaErr");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.hidden = true;
    var idea = document.getElementById("ideaText").value.trim();
    var link = document.getElementById("ideaLink").value.trim();
    var by = document.getElementById("ideaBy").value.trim();
    if (!idea) return fail("Add the idea itself — a few words is plenty.");

    btn.disabled = true;
    btn.textContent = "Adding…";
    fetch("/api/giftidea/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: slug, idea: idea, link: link, suggestedBy: by }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(errText(d, "Server said " + r.status + "."));
        var list = read(K_SUG);
        list.push({ id: d.id, token: d.token });
        write(K_SUG, list);
        location.reload();
      });
    }).catch(function (ex) {
      fail((ex && ex.message) || "That didn't work — try again.");
    });

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "Add the idea →";
      return false;
    }
  });
})();
</script>`;
  return html(pageShell({ title: `Gift ideas for ${data.recipient}`, body, shareType: "giftidea", shareSlug: row.slug }));
}

/* ---------- organiser page (/e/:token) ---------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const parts = await allIdeas(env, row.id);
  const claims = await allClaims(env, row.id);
  const bySlot = {};
  for (const c of claims) bySlot[c.slot_id] = c;

  const ideas = sortedIdeas(parts);
  const shareUrl = `${origin}/s/${row.slug}`;

  const listHtml = ideas.length
    ? `<ul class="gi-list">${ideas.map((e) => ideaCardOrg(e, bySlot[String(e.id)])).join("")}
      </ul>`
    : `<p class="gi-empty">No ideas yet — share the link and they'll roll in.</p>`;

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with everyone else.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>Gift ideas for ${esc(data.recipient)}</h1>
  <p class="page-sub">${subLine(ideas, claims.length)}</p>

  <div class="gi-surprise">
    <strong>Keep it a surprise.</strong> Share the link with
    <em>everyone but ${esc(data.recipient)}</em> — that's the one person who
    shouldn't see this board.
  </div>

  ${metaBlock(data)}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with the group (not the recipient)</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🎁 Chipping in for " + data.recipient + "? Add gift ideas, vote, and tap “I’ll get this” on whatever you’ll buy so we don’t double up (don’t show " + data.recipient + "): " + shareUrl, row.edit_token)}

  ${listHtml}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared board</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this board</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">Removing an idea clears any claim on it too, so give the
    buyer a heads-up first. To add ideas, vote or claim one yourself, use the
    shared link like everyone else. Deleting is permanent — the shared link
    stops working immediately.</p>
  </footer>
</main>

<script>
(function () {
  var token = ${JSON.stringify(row.edit_token)};
  document.getElementById("copyBtn").addEventListener("click", function () {
    var input = document.getElementById("shareUrl");
    input.select();
    navigator.clipboard.writeText(input.value).then(function () {
      var b = document.getElementById("copyBtn");
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy"; }, 1500);
    });
  });
  document.querySelectorAll(".gi-remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!confirm("Remove this idea? Any claim on it is cleared too.")) return;
      fetch("/api/giftidea/" + token + "/removeIdea", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itoken: btn.getAttribute("data-token") }),
      }).then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error((d && d.error) || "That didn't work — try again."); });
        location.reload();
      }).catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this board for good? Every idea and claim goes with it, and the shared link stops working.")) return;
    fetch("/api/giftidea/" + token + "/delete", { method: "POST" })
      .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error((d && d.error) || "That didn't work — try again."); }); location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  });
})();
</script>`;
  return html(pageShell({ title: `Gift ideas for ${data.recipient} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "giftidea",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/giftidea")) return null;
    if (p === "/api/giftidea") return create(request, env);
    if (p === "/api/giftidea/suggest") return suggest(request, env);
    if (p === "/api/giftidea/upvote") return upvote(request, env);
    if (p === "/api/giftidea/claim") return claim(request, env);
    if (p === "/api/giftidea/unclaim") return unclaim(request, env);
    let m;
    if ((m = p.match(/^\/api\/giftidea\/i\/([a-z0-9]+)\/remove$/)))
      return suggesterRemove(m[1], env);
    if ((m = p.match(/^\/api\/giftidea\/([a-z0-9]+)\/(removeIdea|delete)$/)))
      return m[2] === "removeIdea" ? orgRemoveIdea(m[1], request, env) : orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
