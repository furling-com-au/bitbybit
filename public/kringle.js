/* Kris Kringle — builder page logic.

   A module so it can import the one copy of the name parser (including the
   comma fallback) and the board renderer, which used to live here. */
import { parseNames, findDuplicate, previewSummary, renderKringlePreview, esc }
  from "./preview/kringle.js";

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:kringle-made:v1";

  const lines = (el) => parseNames($(el).value);

  /* ---- the live preview -------------------------------------
     Redraws the tile grid from the names box on every keystroke. Paste a
     comma-separated line and the tiles still appear — which is the comma
     fallback explaining itself, a rule that had fifteen lines of source
     comment and no mention on the page at all.

     The board shows every tile unclaimed, because that is what it looks
     like the moment it is made. Who drew whom is the one thing this tool
     keeps secret, and it does not exist until the button is pressed.

     statusLine keeps only the warnings — too few, too many, a duplicate —
     because the count moved into the preview's own label. */
  function updatePreview() {
    const names = lines("names");
    const box = $("kringlePreview");
    const label = $("kringlePreviewLabel");
    if (box) box.innerHTML = names.length
      ? renderKringlePreview(names)
      : '<p class="live-preview-empty">Paste the names and the board appears here.</p>';
    /* textContent on a node that persists: aria-live only announces changes
       inside a region that was already there at load. */
    if (label) label.textContent = previewSummary(names);

    const el = $("statusLine");
    el.classList.remove("warn");
    const dup = findDuplicate(names);
    if (!names.length) { el.innerHTML = ""; return; }
    if (dup) {
      el.classList.add("warn");
      el.innerHTML = "Two people are both called “" + esc(dup) + "” — add a surname or an initial.";
    } else if (names.length < 3) {
      el.classList.add("warn");
      el.innerHTML = "Kris Kringle needs at least three names.";
    } else if (names.length > 100) {
      el.classList.add("warn");
      el.innerHTML = "The limit is 100 — split into two draws.";
    } else {
      el.innerHTML = "";
    }
  }

  /* ---- previous draws (this browser only) --------------------- */
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
    $("prevDraws").hidden = false;
    $("prevList").innerHTML = "";
    for (const d of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = d.editUrl;
      a.textContent = d.title || "Untitled Kris Kringle";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(d.at).toLocaleDateString("en-AU");
      li.append(a, when);
      $("prevList").appendChild(li);
    }
  }

  /* ---- submit ------------------------------------------------ */
  async function submit(e) {
    e.preventDefault();
    const btn = $("drawBtn");
    const err = $("formError");
    err.hidden = true;

    const names = lines("names");
    const title = $("title").value.trim();

    if (names.length < 3)
      return fail("Add at least three names — with two it's not a secret, it's a swap.");
    if (names.length > 100)
      return fail("That's more than 100 names — split it into two draws.");
    const dup = findDuplicate(names);
    if (dup)
      return fail(`"${dup}" is in the list twice — add a surname initial so the right one gets claimed.`);

    btn.disabled = true;
    btn.textContent = "Drawing…";

    try {
      const res = await fetch("/api/kringle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          names,
          budget: $("budget").value.trim(),
          exchangeDate: $("exchangeDate").value.trim(),
          note: $("note").value.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title, editUrl, at: new Date().toISOString() });
      if (window.bbbRemember) window.bbbRemember("kringle", title, editUrl);
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Draw the names →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("names").addEventListener("input", updatePreview);
  $("kringleForm").addEventListener("submit", submit);

  updatePreview();
  renderPrev();
})();
