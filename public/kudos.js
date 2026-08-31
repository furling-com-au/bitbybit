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
    /* Two buttons submit this form: the one inside it, and the one above
       the fold that the example strip emits. Both must show the same busy
       state — a top button that stays idle while a request is in flight
       looks broken, because its only feedback sits ~1,400px below the
       finger, and the natural response is a second tap and a second
       instance. Each keeps its own resting label ("... now" up top). */
    const btns = ["makeBtn", "makeBtnTop"].map($).filter(Boolean);
    btns.forEach((b) => { if (b.dataset.rest === undefined) b.dataset.rest = b.textContent; });
    const setBusy = (on, label) => btns.forEach((b) => {
      b.disabled = on;
      b.textContent = on ? label : b.dataset.rest;
    });
    const err = $("formError");
    err.hidden = true;
    setBusy(true, "Putting it up…");
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
      if (window.bbbRemember) window.bbbRemember("kudos", team ? team + " — kudos wall" : "", editUrl);
      location.href = editUrl;
    } catch (ex) {
      err.textContent = ex.message || "Something went wrong — try again.";
      err.hidden = false;
      // The error banner lives beside the button inside the form. Someone who
      // tapped the button above the fold is ~1,000px away from it, so a silent
      // failure would look like nothing happened at all.
      if (window.scrollY < 200) err.scrollIntoView({ block: "center" });
      setBusy(false);
    }
  });

  renderPrev();
})();
