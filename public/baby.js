/* Baby Guess Pool — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:baby-made:v1";

  /* ---- earlier pools (this browser only) --------------------- */
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
    $("prevPools").hidden = false;
    $("prevList").innerHTML = "";
    for (const b of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = b.editUrl;
      a.textContent = b.parents || "Untitled pool";
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

    const parents = $("parents").value.trim();
    const dueDate = $("dueDate").value.trim();
    const note = $("note").value.trim();

    if (!parents) return fail("Add the parents' names — they head up the pool.");

    btn.disabled = true;
    btn.textContent = "Starting the pool…";

    try {
      const res = await fetch("/api/baby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parents, dueDate, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ parents, editUrl, at: new Date().toISOString() });
      if (window.bbbRemember) window.bbbRemember("baby", parents, editUrl);
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Start the pool →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("babyForm").addEventListener("submit", submit);
  renderPrev();
})();
