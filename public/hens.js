/* Hens & Shower Planner — builder page logic.

   A module so it can import the one copy of the "Name xN" parser and the
   board renderer. Those used to live here, and in two other builders. */
import { parseCategoryLines, previewSummary, renderCategoryPreview,
         countLines, firstDupe, MAX_CATS } from "./preview/hens.js";

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:hens-made:v1";
  const MAX_ACTIVITIES = 20;
  const MAX_ACTIVITY = 100;




  /* ---- activities: one per line ------------------------------ */
  const parseActivities = () =>
    $("activities").value.split("\n")
      .map((s) => s.trim().replace(/\s+/g, " ").slice(0, MAX_ACTIVITY))
      .filter(Boolean)
      .slice(0, MAX_ACTIVITIES);


  /* ---- the live preview -------------------------------------
     Redraws the board from the lists box on every keystroke. The counts
     moved into the preview's own label; statusLine keeps only the warnings,
     because repeating the totals above a board that shows them is the
     redundancy this replaced.

     The first frame is baked by scripts/gen-live-preview.mjs, so nothing
     paints after load. Every redraw after that is attributed to typing,
     which costs nothing against CLS. */
  function updatePreview() {
    const cats = parseCategoryLines($("categories").value);
    const box = $("hensPreview");
    const label = $("hensPreviewLabel");
    if (box) box.innerHTML = renderCategoryPreview(cats);
    /* textContent on a node that persists: aria-live only announces changes
       inside a region that was already there at load. */
    if (label) label.textContent = previewSummary(cats);

    const el = $("statusLine");
    el.classList.remove("warn");
    const dupe = firstDupe(cats);
    if (countLines($("categories").value) > MAX_CATS) {
      el.classList.add("warn");
      el.innerHTML = "Twelve lists is the limit — only the first twelve count.";
    } else if (dupe) {
      el.classList.add("warn");
      el.innerHTML = "Two lists are both called “" + dupe + "” — give them different names.";
    } else {
      el.innerHTML = "";
    }
  }

  /* ---- earlier plans (this browser only) --------------------- */
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
      a.textContent = b.title || "Untitled plan";
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

    const title = $("title").value.trim();
    const forWhom = $("forWhom").value.trim();
    const when = $("when").value.trim();
    const where = $("where").value.trim();
    const kitty = $("kitty").value.trim();
    const note = $("note").value.trim();
    const cats = parseCategoryLines($("categories").value);
    const activities = parseActivities();

    if (!title) return fail("Give the do a name so everyone knows what it is.");
    if (!cats.length) return fail("Add at least one thing to bring or sort (one per line).");
    const dupe = firstDupe(cats);
    if (dupe) return fail(`"${dupe}" appears twice — each list needs its own name.`);

    btn.disabled = true;
    btn.textContent = "Starting…";

    try {
      const res = await fetch("/api/hens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, forWhom, when, where, kitty, note, categories: cats, activities }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title, editUrl, at: new Date().toISOString() });
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Start planning →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("categories").addEventListener("input", updatePreview);
  $("activities").addEventListener("input", updatePreview);
  $("hensForm").addEventListener("submit", submit);

  updatePreview();
  renderPrev();
})();
