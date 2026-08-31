/* Bring a Plate — builder page logic.

   A module so it can import the one copy of the "Name xN" parser and the
   board renderer. Those used to live here, and in two other builders. */
import { parseCategoryLines, previewSummary, renderCategoryPreview,
         countLines, firstDupe, MAX_CATS } from "./preview/plate.js";

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:plate-made:v1";





  /* ---- the live preview -------------------------------------
     Redraws the board from the categories box on every keystroke. The counts
     moved into the preview's own label; statusLine keeps only the warnings,
     because repeating the totals above a board that shows them is the
     redundancy this replaced.

     The first frame is baked by scripts/gen-live-preview.mjs, so nothing
     paints after load. Every redraw after that is attributed to typing,
     which costs nothing against CLS. */
  function updatePreview() {
    const cats = parseCategoryLines($("categories").value);
    const box = $("platePreview");
    const label = $("platePreviewLabel");
    if (box) box.innerHTML = renderCategoryPreview(cats);
    /* textContent on a node that persists: aria-live only announces changes
       inside a region that was already there at load. */
    if (label) label.textContent = previewSummary(cats);

    const el = $("statusLine");
    el.classList.remove("warn");
    const dupe = firstDupe(cats);
    if (countLines($("categories").value) > MAX_CATS) {
      el.classList.add("warn");
      el.innerHTML = "Twelve categories is the limit — only the first twelve count.";
    } else if (dupe) {
      el.classList.add("warn");
      el.innerHTML = "Two categories are both called “" + dupe + "” — give them different names.";
    } else {
      el.innerHTML = "";
    }
  }

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

    const cats = parseCategoryLines($("categories").value);
    const title = $("title").value.trim();
    const eventDate = $("eventDate").value.trim();
    const note = $("note").value.trim();

    if (!cats.length) return fail("Add at least one category (one per line).");
    const dupe = firstDupe(cats);
    if (dupe) return fail(`"${dupe}" appears twice — each category needs its own name.`);

    setBusy(true, "Setting the table…");

    try {
      const res = await fetch("/api/plate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, eventDate, note, categories: cats }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title, editUrl, at: new Date().toISOString() });
      if (window.bbbRemember) window.bbbRemember("plate", title, editUrl);
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      setBusy(false);
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      // The error banner lives beside the button inside the form. Someone who
      // tapped the button above the fold is ~1,000px away from it, so a silent
      // failure would look like nothing happened at all.
      if (window.scrollY < 200) err.scrollIntoView({ block: "center" });
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("categories").addEventListener("input", updatePreview);
  $("plateForm").addEventListener("submit", submit);

  updatePreview();
  renderPrev();
})();
