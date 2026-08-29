/* Scrum Poker — builder page logic. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:poker-made:v1";

  function loadPrev() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
  }
  function savePrev(entry) {
    try { localStorage.setItem(LS_KEY, JSON.stringify([entry, ...loadPrev()].slice(0, 10))); } catch { /* private mode */ }
  }
  function renderPrev() {
    const list = loadPrev();
    if (!list.length) return;
    $("prevBoards").hidden = false;
    $("prevList").innerHTML = "";
    for (const d of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = d.editUrl;
      a.textContent = d.title || "Untitled board";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(d.at).toLocaleDateString("en-AU");
      li.append(a, when);
      $("prevList").appendChild(li);
    }
  }

  /* Show what the chosen deck actually contains, so nobody has to
     create a board to find out whether it has a "?" card. */
  const DECKS = {
    fib: ["1", "2", "3", "5", "8", "13", "21", "?", "☕"],
    tshirt: ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"],
  };
  /* Read out as one sentence by role="img", so the deck is described rather
     than announced as nine loose glyphs. Kept beside DECKS so the two cannot
     drift; check-baked-previews.mjs asserts the page agrees with both. */
  const DECK_LABEL = {
    fib: "Fibonacci deck: 1, 2, 3, 5, 8, 13, 21, a question mark for “not enough information”, and a coffee cup for “I need a break”",
    tshirt: "T-shirt deck: XS, S, M, L, XL, XXL, a question mark for “not enough information”, and a coffee cup for “I need a break”",
  };
  function paintDeck() {
    const chosen = document.querySelector('input[name="deck"]:checked');
    const which = chosen ? chosen.value : "fib";
    const el = $("deckPreview");
    if (el.dataset.deck === which) return;      // already correct - do not touch the DOM
    el.innerHTML = DECKS[which]
      .map((c) => '<span class="pk-card pk-card-sample">' + c + "</span>").join("");
    el.setAttribute("aria-label", DECK_LABEL[which]);
    el.dataset.deck = which;
  }
  document.querySelectorAll('input[name="deck"]').forEach((r) =>
    r.addEventListener("change", paintDeck));
  /* NOT an unconditional repaint on load. The fib deck is baked into the HTML,
     so painting it again after first paint is the shift check-qotd-preview.mjs
     was written to stop. This call is a no-op in the normal case and only does
     work when a browser restores "tshirt" on reload (Firefox does), where the
     baked markup would otherwise contradict the checked radio. */
  paintDeck();

  $("pokerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    /* Both buttons submit this form: the one inside it and the one the
       example strip puts above the fold. Both must show the same busy
       state, or a tap up top looks like nothing happened and invites a
       second board. Each keeps its own resting label. */
    const btns = ["makeBtn", "makeBtnTop"].map($).filter(Boolean);
    btns.forEach((b) => { if (b.dataset.rest === undefined) b.dataset.rest = b.textContent; });
    const setBusy = (on, label) => btns.forEach((b) => {
      b.disabled = on;
      b.textContent = on ? label : b.dataset.rest;
    });
    const err = $("formError");
    err.hidden = true;
    setBusy(true, "Dealing…");
    try {
      const team = $("team").value.trim();
      const chosen = document.querySelector('input[name="deck"]:checked');
      const res = await fetch("/api/poker", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          team,
          story: $("story").value.trim(),
          deck: chosen ? chosen.value : "fib",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);
      const editUrl = `/e/${data.editToken}`;
      savePrev({ title: team ? team + " — scrum poker" : "Scrum poker", editUrl, at: new Date().toISOString() });
      location.href = editUrl;
    } catch (ex) {
      err.textContent = ex.message || "Something went wrong — try again.";
      err.hidden = false;
      // The error sits beside the button inside the form; someone who
      // tapped the button above the fold is a long way from it.
      if (window.scrollY < 200) err.scrollIntoView({ block: "center" });
      setBusy(false);
    }
  });

  renderPrev();
})();
