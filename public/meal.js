/* Meal Train — builder page logic. Collects the household, the dietary
   needs, the drop-off details and the span of days, generates the date
   list client-side, and posts it. No framework, no build step.

   A module so it can import the one copy of the date helpers and the
   board renderer. They used to live here too, under a comment saying
   they mirrored the server by hand. */
import { parseISO, fmtDay, buildDates as buildDateList, previewSummary,
         renderMealPreview, MAX_DAYS } from "./preview/meal.js";

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:meal-made:v1";

  const buildDates = () =>
    buildDateList($("firstDate").value, $("meals").value, $("spacing").value);

  /* ---- the live preview -------------------------------------
     Redraws the dated board from the four fields that decide it. The
     counts and the span moved into the preview's own label; statusLine
     keeps only the over-limit warning, because "10 meals over 10 days"
     above a board showing ten days is the redundancy this replaced.

     #mealPreview has a FIXED height in styles.css. seedDate() below sets
     the first day to tomorrow AFTER paint, so the placeholder is swapped
     for a ten-day board with no user action to blame the shift on — and a
     box that is the same size either way cannot shift at all. */
  function updatePreview() {
    const dates = buildDates();
    const box = $("mealPreview");
    const label = $("mealPreviewLabel");
    if (box) box.innerHTML = dates.length
      ? renderMealPreview(dates, $("capacity").value, $("allergies").value)
      : '<p class="live-preview-empty">Pick a first day and the roster lays itself out here.</p>';
    /* textContent on a node that persists: aria-live only announces changes
       inside a region that was already there at load. */
    if (label) label.textContent = previewSummary(dates, $("capacity").value);

    const el = $("statusLine");
    el.classList.remove("warn");
    if (parseInt($("meals").value, 10) > MAX_DAYS) {
      el.classList.add("warn");
      el.innerHTML = "Sixty days is the limit — only the first sixty count.";
    } else {
      el.innerHTML = "";
    }
  }

  /* ---- earlier rosters (this browser only) ------------------- */
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
      a.textContent = b.title || "Untitled roster";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(b.at).toLocaleDateString("en-AU");
      li.append(a, when);
      $("prevList").appendChild(li);
    }
  }

  /* ---- submit ------------------------------------------------ */
  /* "Other ways to help": one job per line. A trailing "x2" means two
     people are needed for it. The multiplier is stripped from the label,
     or the board would read "Walk Ruby x2 — 0 of 2". */
  function parseTasks(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean)
      .slice(0, 12)
      .map(function (line) {
        var m = /^(.*?)\s*[x×]\s*(\d{1,2})$/i.exec(line);
        if (m && m[1].trim()) {
          return { label: m[1].trim(), capacity: Math.min(parseInt(m[2], 10) || 1, 20) };
        }
        return { label: line, capacity: 1 };
      });
  }

  async function submit(e) {
    e.preventDefault();
    const btn = $("makeBtn");
    const err = $("formError");
    err.hidden = true;

    const forWhom = $("forWhom").value.trim();
    const allergies = $("allergies").value.trim();
    const note = $("note").value.trim();
    const dropoff = $("dropoff").value.trim();
    const dates = buildDates();
    const capacityPerDay = parseInt($("capacity").value, 10) || 1;
    const tasks = parseTasks($("tasks").value);

    if (!forWhom) return fail("Who are the meals for? Add a name.");
    if (!$("firstDate").value) return fail("Pick the first day.");
    if (!dates.length) return fail("How many days need a meal? Pick at least one.");

    btn.disabled = true;
    btn.textContent = "Setting it up…";

    try {
      const res = await fetch("/api/meal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ forWhom, allergies, note, dropoff, dates, capacityPerDay, tasks }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title: "Meals for " + forWhom, editUrl, at: new Date().toISOString() });
      if (window.bbbRemember) window.bbbRemember("meal", "Meals for " + forWhom, editUrl);
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Start the roster →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "Start the roster →";
      return false;
    }
  }

  /* ---- default the first day to tomorrow --------------------- */
  (function seedDate() {
    const el = $("firstDate");
    if (el && !el.value) {
      const t = new Date();
      const tomorrow = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate() + 1));
      el.value = tomorrow.toISOString().slice(0, 10);
    }
  })();

  /* ---- wire up ----------------------------------------------- */
  ["firstDate", "meals", "spacing", "capacity", "allergies"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", updatePreview);
    if (el) el.addEventListener("change", updatePreview);
  });
  $("mealForm").addEventListener("submit", submit);

  updatePreview();
  renderPrev();
})();
