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
  function paintDeck() {
    const chosen = document.querySelector('input[name="deck"]:checked');
    const which = chosen ? chosen.value : "fib";
    $("deckPreview").innerHTML = DECKS[which]
      .map((c) => '<span class="pk-card pk-card-sample">' + c + "</span>").join("");
  }
  document.querySelectorAll('input[name="deck"]').forEach((r) =>
    r.addEventListener("change", paintDeck));
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
