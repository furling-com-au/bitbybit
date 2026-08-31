/* Gift Idea Board — builder page logic. Makes the board, then hands
   the organiser their private link. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:giftidea-made:v1";

  /* ---- earlier boards (this browser only) -------------------- */
  function loadPrev() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  }
  function savePrev(entry) {
    const list = [entry, ...loadPrev()].slice(0, 10);
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* private mode */ }
  }
  function renderPrev() {
    const list = loadPrev();
    if (!list.length) return;
    $("prevBoards").hidden = false;
    $("prevList").innerHTML = "";
    for (const b of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = b.editUrl;
      a.textContent = b.title || "Untitled board";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(b.at).toLocaleDateString("en-AU");
      li.append(a, when);
      $("prevList").appendChild(li);
    }
  }

  /* ---- submit ------------------------------------------------ */
  async function submit(e) {
    e.preventDefault();
    const btn = $("makeBtn");
    const err = $("formError");
    err.hidden = true;

    const recipient = $("recipient").value.trim();
    const occasion = $("occasion").value.trim();
    const budget = $("budget").value.trim();
    const note = $("note").value.trim();

    if (!recipient) return fail("Who's the gift for? Add their name.");

    btn.disabled = true;
    btn.textContent = "Making the board…";

    try {
      const res = await fetch("/api/giftidea", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient, occasion, budget, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title: `Gift ideas for ${recipient}`, editUrl, at: new Date().toISOString() });
      if (window.bbbRemember) window.bbbRemember("giftidea", `Gift ideas for ${recipient}`, editUrl);
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Start the board →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("giftideaForm").addEventListener("submit", submit);
  renderPrev();
})();
