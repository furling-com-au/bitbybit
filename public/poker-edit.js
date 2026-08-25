/* The facilitator page. Names the story, turns the cards over, moves
   to the next one — and polls the same state endpoint the voters use,
   so the count updates without refreshing.

   Note it polls the PUBLIC state endpoint, not a privileged one. The
   facilitator has no more visibility than a player before the reveal,
   which is deliberate: an estimate you can peek at is not an estimate. */
(function () {
  const $ = (id) => document.getElementById(id);
  const main = document.querySelector("main.wrap");
  if (!main) return;

  const token = main.dataset.token;
  const slug = main.dataset.slug;
  const err = $("pkError");

  function fail(msg) {
    if (!err) return;
    err.textContent = msg;
    err.hidden = false;
    if (window.scrollY < 200) err.scrollIntoView({ block: "center" });
  }

  async function post(path, body) {
    if (err) err.hidden = true;
    const res = await fetch("/api/poker/" + token + "/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Server said " + res.status + ".");
    return data;
  }

  /* ---- copy the share link ------------------------------------- */
  const copyBtn = $("copyBtn");
  if (copyBtn) {
    /* Captured once. Reading it inside the handler meant a second tap during
       the 1.4s window captured "Copied" as the resting label, and the button
       said "Copied" for the rest of the meeting. */
    const copyRest = copyBtn.textContent;
    let copyTimer;
    copyBtn.addEventListener("click", async () => {
      const url = $("shareUrl");
      try {
        await navigator.clipboard.writeText(url.value);
      } catch {
        url.select();
        try { document.execCommand("copy"); } catch { /* nothing else to try */ }
      }
      copyBtn.textContent = "Copied";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { copyBtn.textContent = copyRest; }, 1400);
    });
  }

  /* ---- the story ----------------------------------------------- */
  const storyEl = $("story");
  let storySaved = storyEl ? storyEl.value : "";
  let storyTimer;
  if (storyEl) {
    const save = async () => {
      const v = storyEl.value.trim();
      if (v === storySaved) return;
      try { await post("story", { story: v }); storySaved = v; }
      catch (e) { fail(e.message); }
    };
    // Save as they stop typing, so the team sees the story appear
    // without the facilitator hunting for a save button mid-meeting.
    storyEl.addEventListener("input", () => {
      clearTimeout(storyTimer);
      storyTimer = setTimeout(save, 600);
    });
    storyEl.addEventListener("blur", save);
  }

  /* ---- reveal / next ------------------------------------------- */
  const revealBtn = $("revealBtn");
  const nextBtn = $("nextBtn");

  if (revealBtn) revealBtn.addEventListener("click", async () => {
    revealBtn.disabled = true;
    try { await post("reveal"); await refresh(); }
    catch (e) { fail(e.message); }
    finally { revealBtn.disabled = false; }
  });

  if (nextBtn) nextBtn.addEventListener("click", async () => {
    nextBtn.disabled = true;
    try {
      // Clearing the box first means the next story starts blank
      // rather than inheriting the last one's title.
      if (storyEl) { storyEl.value = ""; storySaved = ""; }
      await post("next", { story: "" });
      if (storyEl) storyEl.focus();
      await refresh();
    } catch (e) { fail(e.message); }
    finally { nextBtn.disabled = false; }
  });

  const delBtn = $("deleteBtn");
  if (delBtn) delBtn.addEventListener("click", async () => {
    if (!confirm("Delete this board and every vote on it? The link stops working for everyone.")) return;
    delBtn.disabled = true;
    try { await post("delete"); location.href = "/scrum-poker/"; }
    catch (e) { fail(e.message); delBtn.disabled = false; }
  });

  /* ---- polling ------------------------------------------------- */
  function escape_(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function verdict(s) {
    if (s.agreed) return '<p class="pk-verdict pk-agreed">Everyone said <strong>' +
      escape_(s.low.card) + "</strong>. Write it down and move on.</p>";
    if (!s.low) return '<p class="pk-verdict">Nobody put a number on it. That is usually a sign ' +
      "the story needs splitting or a question answered first.</p>";
    if (s.low.card === s.high.card) return '<p class="pk-verdict">Everyone with a number said <strong>' +
      escape_(s.low.card) + "</strong>" + (s.unsure ? ", and " + s.unsure + " not sure" : "") + ".</p>";
    return '<p class="pk-verdict">Spread is <strong>' + escape_(s.low.card) + "</strong> to <strong>" +
      escape_(s.high.card) + "</strong>" + (s.unsure ? ", with " + s.unsure + " unsure" : "") +
      ". Ask those two what they are each seeing — that conversation is the point of the exercise.</p>";
  }

  const table = $("pkTable");
  const count = $("pkCount");
  let lastVerdict = document.querySelector(".pk-verdict");

  function render(s) {
    if (count) count.innerHTML = "<strong>" + s.count + "</strong> " +
      (s.count === 1 ? "vote" : "votes") + " in";

    // The round number is rendered server-side, so without this it stays
    // on whatever it was when the page loaded and quietly disagrees with
    // the board for the rest of the session.
    const kicker = document.querySelector(".kicker");
    if (kicker) kicker.textContent = kicker.textContent.replace(/round \d+/, "round " + s.round);

    if (table) {
      const named = s.revealed
        ? s.cards.map((c) => ({ card: escape_(c.card), name: c.name ? escape_(c.name) : "&mdash;" }))
        : s.who.map((n) => ({ card: "&bull;", name: escape_(n) }))
            .concat(Array.from({ length: Math.max(0, s.count - s.who.length) },
              () => ({ card: "&bull;", name: "&mdash;" })));
      table.innerHTML = named.map((r) =>
        '<li class="pk-slot ' + (s.revealed ? "pk-shown" : "pk-hidden") + '">' +
        '<span class="pk-slot-card">' + r.card + "</span>" +
        '<span class="pk-slot-name">' + r.name + "</span></li>").join("");
    }

    if (revealBtn) revealBtn.hidden = s.revealed;
    if (nextBtn) nextBtn.hidden = !s.revealed;

    if (lastVerdict) { lastVerdict.remove(); lastVerdict = null; }
    if (s.revealed && table) {
      table.insertAdjacentHTML("afterend", verdict(s));
      lastVerdict = table.nextElementSibling;
    }

    // Don't fight the facilitator's cursor: only adopt the server's
    // story text when they are not the one typing it.
    if (storyEl && document.activeElement !== storyEl && s.story !== storySaved) {
      storyEl.value = s.story;
      storySaved = s.story;
    }
  }

  let failures = 0;
  async function refresh() {
    try {
      const res = await fetch("/api/poker/" + encodeURIComponent(slug) + "/state");
      if (!res.ok) throw new Error("state " + res.status);
      render(await res.json());
      failures = 0;
    } catch (e) {
      failures++;
    }
  }

  setInterval(() => {
    if (document.hidden) return;
    if (failures > 5 && failures % 10 !== 0) { failures++; return; }
    refresh();
  }, 2000);
})();
