/* Kudos Wall — builder page logic. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:kudos-made:v1";

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
      a.textContent = d.title || "Untitled kudos wall";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(d.at).toLocaleDateString("en-AU");
      li.append(a, when);
      $("prevList").appendChild(li);
    }
  }

  $("kudosForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("makeBtn"), err = $("formError");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Putting it up…";
    try {
      const team = $("team").value.trim();
      const res = await fetch("/api/kudos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ team, intro: $("intro").value.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);
      const editUrl = `/e/${data.editToken}`;
      savePrev({ title: team ? team + " — kudos wall" : "Kudos wall", editUrl, at: new Date().toISOString() });
      location.href = editUrl;
    } catch (ex) {
      err.textContent = ex.message || "Something went wrong — try again.";
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "Start the wall →";
    }
  });

  renderPrev();
})();
