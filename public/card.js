/* Group Card — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:card-made:v1";

  /* ---- title placeholder follows the recipient --------------- */
  function updatePlaceholder() {
    const who = $("recipient").value.trim();
    $("title").placeholder = who ? `A card for ${who}` : "A card for…";
  }

  /* ---- earlier cards (this browser only) --------------------- */
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
    $("prevCards").hidden = false;
    $("prevList").innerHTML = "";
    for (const c of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = c.editUrl;
      a.textContent = c.title || "Untitled card";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(c.at).toLocaleDateString("en-AU");
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
    const note = $("note").value.trim();
    let title = $("title").value.trim();

    if (!recipient) return fail("Who's the card for? That's the one thing we need.");
    if (!title) title = `A card for ${recipient}`;

    btn.disabled = true;
    btn.textContent = "Starting the card…";

    try {
      const res = await fetch("/api/card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, recipient, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title, editUrl, at: new Date().toISOString() });
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Start the card →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("recipient").addEventListener("input", updatePlaceholder);
  $("cardForm").addEventListener("submit", submit);

  updatePlaceholder();
  renderPrev();
})();
