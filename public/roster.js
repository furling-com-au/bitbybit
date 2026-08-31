/* Volunteer Roster — builder page logic.

   A module, not a classic script, so it can import the one renderer the
   baked preview also uses. roster-presets.js stays classic and still
   loads first: classic scripts run before module scripts, so the
   ROSTER_PRESETS global it defines is there by the time this runs. */
import { parseShiftLines, countShiftLines, previewSummary, renderRosterPreview, MAX_SHIFTS }
  from "./preview/roster.js";

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:roster-made:v1";

  /* ---- club templates ---------------------------------------
     Ten real match-day duty sheets, grouped so a secretary is not offered
     a netball roster in August (winter sport) or a junior AFL one (season
     finished 9 Aug). Choosing one replaces the box; the note underneath
     says who it is for, because every one of these needs rescaling to the
     club's own numbers and pretending otherwise is how it stops being
     credible. */
  (function presets() {
    const sel = $("rosterPreset");
    const note = $("presetNote");
    if (!sel || typeof ROSTER_PRESETS === "undefined") return;

    const groups = {};
    for (const [key, p] of Object.entries(ROSTER_PRESETS)) (groups[p.group] ||= []).push([key, p]);
    for (const [name, items] of Object.entries(groups)) {
      const og = document.createElement("optgroup");
      og.label = name;
      for (const [key, p] of items) {
        const o = document.createElement("option");
        o.value = key; o.textContent = p.label;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }

    sel.addEventListener("change", () => {
      const p = ROSTER_PRESETS[sel.value];
      if (!p) { note.hidden = true; return; }
      $("shifts").value = p.shifts.join("\n");
      note.textContent = p.note;
      note.hidden = false;
      $("shifts").dispatchEvent(new Event("input", { bubbles: true }));
    });
  })();

  /* ---- the live preview -------------------------------------
     Redraws the board from the shifts box on every keystroke. This is
     what replaced three hundred words explaining the "xN" suffix: type
     "Grill 9-11am x3" and three slots appear, which is a better
     explanation than the sentence was.

     The initial render is BAKED into the page by
     scripts/gen-live-preview.mjs, so there is no paint-after-load and
     nothing moves before the visitor touches anything. From then on
     every redraw is attributed to typing, and a shift the browser can
     blame on input does not count against CLS.

     statusLine keeps only the over-limit warning. The counts moved into
     the preview's own label, because saying "5 shifts, 18 spots" above a
     board showing five shifts and eighteen spots is the same redundancy
     this whole change is about. */
  function updatePreview() {
    const shifts = parseShiftLines($("shifts").value);
    const box = $("rosterPreview");
    const label = $("rosterPreviewLabel");
    if (box) box.innerHTML = renderRosterPreview(shifts);
    /* textContent on a node that persists, not innerHTML on a replaced one:
       aria-live only announces changes inside a region that was already
       there when the page loaded. */
    if (label) label.textContent = previewSummary(shifts);

    const el = $("statusLine");
    el.classList.remove("warn");
    if (countShiftLines($("shifts").value) > MAX_SHIFTS) {
      el.classList.add("warn");
      el.innerHTML = "Twenty shifts is the limit — only the first twenty count.";
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
    $("prevRosters").hidden = false;
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

    const shifts = parseShiftLines($("shifts").value);
    const title = $("title").value.trim();
    const eventDate = $("eventDate").value.trim();
    const note = $("note").value.trim();

    if (!shifts.length) return fail("Add at least one shift (one per line).");

    setBusy(true, "Building the roster…");

    try {
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, eventDate, note, shifts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title, editUrl, at: new Date().toISOString() });
      if (window.bbbRemember) window.bbbRemember("roster", title, editUrl);
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
  $("shifts").addEventListener("input", updatePreview);
  $("rosterForm").addEventListener("submit", submit);

  updatePreview();
  renderPrev();
})();
