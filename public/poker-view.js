/* The voting page. Picks a card, keeps a token so you can change your
   mind, and polls so the reveal lands for everyone at roughly the same
   moment without anybody refreshing.

   The page never learns another player's card until the facilitator
   reveals — the server does not send them. So there is nothing here
   that hides a value the browser already has. */
(function () {
  const $ = (id) => document.getElementById(id);
  const main = document.querySelector("main.wrap");
  if (!main) return;

  const slug = main.dataset.slug;
  const KEY = "bbb-poker-" + slug;      // this browser's voter token
  const NAME_KEY = "bbb-poker-name";    // remembered across boards

  let round = parseInt(main.dataset.round, 10) || 1;
  let revealed = main.dataset.revealed === "1";
  let myCard = null;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* see below */ } },
  };

  /* The in-memory copy is the source of truth and localStorage is only a
     cache, because setItem throws outright in the in-app webviews these links
     get pasted into (Slack, Teams, "block all cookies" Safari). When it threw,
     get() returned null forever, the server never matched a token, and every
     change of mind inserted ANOTHER voter — one person could manufacture a
     spread. In memory it survives the whole meeting, which is all it needs to. */
  let myToken = store.get(KEY) || "";

  /* Your own pick, so a reload or a phone waking up does not show an
     unvoted deck while the server counts you as in. Stamped with the round
     so it is dropped the moment the facilitator moves on. This is your own
     card in your own browser — it leaks nothing. */
  const CARD_KEY = KEY + "-card";
  (function restoreCard() {
    try {
      const saved = JSON.parse(store.get(CARD_KEY) || "null");
      if (saved && saved.round === round) myCard = saved.card;
    } catch { /* nothing worth recovering */ }
  })();

  /* ---- name ---------------------------------------------------- */
  const nameEl = $("pkName");
  if (nameEl) {
    const saved = store.get(NAME_KEY);
    if (saved) nameEl.value = saved;
    nameEl.addEventListener("change", () => {
      store.set(NAME_KEY, nameEl.value.trim());
      // Re-send so the facilitator's "who is still to vote" list is right.
      if (myCard) send(myCard);
    });
  }

  /* ---- voting -------------------------------------------------- */
  const err = $("pkError");
  function fail(msg) {
    if (!err) return;
    err.textContent = msg;
    err.hidden = false;
  }

  function paintChoice() {
    document.querySelectorAll(".pk-card").forEach((b) => {
      const on = b.dataset.card === myCard;
      b.classList.toggle("is-picked", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  let inFlight = false;
  async function send(card) {
    if (inFlight) return;
    inFlight = true;
    if (err) err.hidden = true;
    try {
      const res = await fetch("/api/poker/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug, card, round,
          name: nameEl ? nameEl.value.trim() : "",
          token: myToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      // The board moved on while this page was showing the old story. Not an
      // error the voter caused, so refresh rather than shout at them.
      if (res.status === 409 && data.stale) { await refresh(); return; }
      if (!res.ok) throw new Error(data.error || "Vote didn't go through — try again.");
      if (data.token) { myToken = data.token; store.set(KEY, myToken); }
      myCard = card;
      store.set(CARD_KEY, JSON.stringify({ round, card }));
      paintChoice();
      refresh();
    } catch (e) {
      fail(e.message || "Vote didn't go through — try again.");
    } finally {
      inFlight = false;
    }
  }

  document.querySelectorAll(".pk-card").forEach((b) => {
    b.addEventListener("click", () => send(b.dataset.card));
  });

  /* ---- polling ------------------------------------------------- */
  const table = document.querySelector(".pk-result");
  const voteBox = $("pkVote");

  let storyShown = null;
  let lastSig = null;

  function render(s) {
    /* A new round means the facilitator moved on: drop this browser's
       choice so the deck reads as unvoted rather than showing a pick
       that belongs to the previous story. */
    if (s.round !== round) {
      round = s.round;
      myCard = null;
      paintChoice();
      const kicker = document.querySelector(".kicker");
      if (kicker) kicker.textContent = kicker.textContent.replace(/Round \d+/, "Round " + s.round);
    }

    /* The story is painted on EVERY tick, not just when the round changes.
       It used to live inside the branch above, which broke the main loop:
       "Next story" always posts an empty title along with the round bump,
       so the one tick a voter read the story was precisely the tick it was
       blank. The real title arrives afterwards through setStory, which does
       not touch the round — so from round two onwards every already-open
       page sat on "Waiting for the facilitator…" for the rest of the
       meeting, while the facilitator's own page showed the title and gave
       them no clue. Guarded on a change so the 2s poll is not rewriting
       the DOM for nothing. */
    if (s.story !== storyShown) {
      storyShown = s.story;
      const story = document.querySelector(".pk-story");
      if (story) {
        story.textContent = s.story || "Waiting for the facilitator to name the story…";
        story.classList.toggle("pk-story-empty", !s.story);
      }
    }

    /* Rewrite only on a real change. The 2s poll used to replace the results
       table every tick, which wiped any text selection and made role="status"
       announce the same thing over and over. */
    const sig = JSON.stringify([s.revealed, s.count, s.who, s.cards || null]);
    if (sig === lastSig) return;
    const firstReveal = s.revealed && !revealed;
    lastSig = sig;

    if (voteBox) voteBox.hidden = s.revealed;

    if (!s.revealed) {
      table.innerHTML =
        '<ul class="pk-table">' +
        s.who.map((n) => '<li class="pk-slot pk-hidden"><span class="pk-slot-card">&bull;</span>' +
          '<span class="pk-slot-name">' + escape_(n) + "</span></li>").join("") +
        // voters who gave no name still occupy a seat
        Array.from({ length: Math.max(0, s.count - s.who.length) }, () =>
          '<li class="pk-slot pk-hidden"><span class="pk-slot-card">&bull;</span>' +
          '<span class="pk-slot-name">&mdash;</span></li>').join("") +
        "</ul>" +
        '<p class="pk-count">' + (s.count === 0
          ? "Nobody has voted yet."
          : "<strong>" + s.count + "</strong> " + (s.count === 1 ? "vote" : "votes") +
            " in. Cards stay face down until the facilitator turns them over.") + "</p>";
      revealed = false;
      return;
    }

    // Revealed: the server has now sent the actual cards.
    table.innerHTML =
      '<ul class="pk-table">' +
      s.cards.map((c) => '<li class="pk-slot pk-shown"><span class="pk-slot-card">' +
        escape_(c.card) + '</span><span class="pk-slot-name">' +
        (c.name ? escape_(c.name) : "&mdash;") + "</span></li>").join("") +
      "</ul>" + verdict(s);
    /* The deck the voter was focused on has just been hidden, and hiding a
       focused element drops focus to <body> — so a keyboard or screen-reader
       user would tab from the wordmark again. Move them to the result. */
    if (firstReveal) { const r = $("pkResult"); if (r) r.focus({ preventScroll: true }); }
    revealed = true;
  }

  function verdict(s) {
    if (s.agreed) return '<p class="pk-verdict pk-agreed">Everyone said <strong>' +
      escape_(s.low.card) + "</strong>. Write it down and move on.</p>";
    if (!s.low) return '<p class="pk-verdict">Nobody put a number on it. That is usually a sign ' +
      "the story needs splitting or a question answered first.</p>";
    if (s.low.card === s.high.card) return '<p class="pk-verdict">Everyone with a number said <strong>' +
      escape_(s.low.card) + "</strong>" + (s.unsure
        ? ", and " + s.unsure + (s.unsure === 1 ? " person is" : " people are") + " not sure"
        : "") + ".</p>";
    return '<p class="pk-verdict">Spread is <strong>' + escape_(s.low.card) + "</strong> to <strong>" +
      escape_(s.high.card) + "</strong>" + (s.unsure ? ", with " + s.unsure + " unsure" : "") +
      ". Ask those two what they are each seeing — that conversation is the point of the exercise.</p>";
  }

  function escape_(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let failures = 0;
  async function refresh() {
    try {
      const res = await fetch("/api/poker/" + encodeURIComponent(slug) + "/state");
      if (!res.ok) throw new Error("state " + res.status);
      render(await res.json());
      failures = 0;
    } catch (e) {
      // A flaky moment should not spam the server or blank the page;
      // back off and let the next tick try again.
      failures++;
    }
  }

  /* Two seconds is fast enough that a reveal feels shared and slow
     enough that a ten-person game is ~5 requests a second across the
     whole team. Backs right off when the tab is hidden, and after
     repeated failures, so a forgotten tab is not a background load. */
  setInterval(() => {
    if (document.hidden) return;
    if (failures > 5 && failures % 10 !== 0) { failures++; return; }
    refresh();
  }, 2000);

  paintChoice();
})();
