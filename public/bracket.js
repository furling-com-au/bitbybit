/* Tournament Bracket — builder page logic.

   A module so it can import the one copy of the name parser (including the
   comma fallback), the dupe check and the round-one preview, which used to
   be duplicated here. */
import { parseEntrants, firstDupe, previewSummary, renderBracketPreview, esc as escHtml }
  from "./preview/bracket.js";

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:bracket-made:v1";
  const MAX_ENTRANTS = 64;

  /* ---- entrants: one per line -------------------------------- */
  const lines = () =>
    parseEntrants($("entrants").value).map((s) => s.slice(0, 40));

  /* ---- the live preview ---------------------------------------
     Redraws round one from the names box on every keystroke. Always in
     typed order, regardless of the seeding radio — see preview/bracket.js
     for why a random draw can't be the thing shown here. */
  function updatePreview() {
    const names = lines();
    const box = $("bracketPreview");
    box.innerHTML = names.length >= 2
      ? renderBracketPreview(names)
      : '<p class="live-preview-empty">Add the names and round one appears here.</p>';
    const label = $("bracketPreviewLabel");
    if (label) label.textContent = previewSummary(names);
  }

  const nextPow2 = (n) => {
    let size = 1;
    while (size < n) size *= 2;
    return size;
  };

  /* ---- live status ------------------------------------------- */
  function updateStatus() {
    const el = $("statusLine");
    el.classList.remove("warn");
    const names = lines();
    const n = names.length;
    if (!n) { el.innerHTML = ""; return; }

    if (n === 1) {
      el.classList.add("warn");
      el.innerHTML = "<strong>1 player</strong> — needs at least one opponent.";
      return;
    }
    if (n > MAX_ENTRANTS) {
      el.classList.add("warn");
      el.innerHTML = `<strong>${n} players</strong> — 64 is the limit. Run two brackets and stage a grand final.`;
      return;
    }

    const size = nextPow2(n);
    const byes = size - n;
    let msg = `<strong>${n} players — bracket of ${size}</strong>`;
    msg += byes ? `, ${byes} bye${byes === 1 ? "" : "s"}.` : ", no byes. Tidy.";

    const dupe = firstDupe(names);
    if (dupe) {
      el.classList.add("warn");
      msg += ` "${escHtml(dupe)}" is in twice — add a surname initial to tell them apart.`;
    }
    el.innerHTML = msg;
  }

  /* ---- earlier brackets (this browser only) ------------------ */
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
    $("prevBrackets").hidden = false;
    $("prevList").innerHTML = "";
    for (const b of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = b.editUrl;
      a.textContent = b.title || "Untitled bracket";
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
    const btn = $("buildBtn");
    const err = $("formError");
    err.hidden = true;

    const entrants = lines();
    const title = $("title").value.trim();
    const seeding = document.querySelector('input[name="seeding"]:checked').value;

    if (entrants.length < 2) return fail("Add at least two names — one person is just practice.");
    if (entrants.length > MAX_ENTRANTS) return fail("64 is the limit — run two brackets and stage a grand final.");
    const dupe = firstDupe(entrants);
    if (dupe) return fail(`"${dupe}" is in the list twice — add a surname initial to tell them apart.`);

    btn.disabled = true;
    btn.textContent = "Building…";

    try {
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, entrants, seeding }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title, editUrl, at: new Date().toISOString() });
      if (window.bbbRemember) window.bbbRemember("bracket", title, editUrl);
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Build the bracket →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("entrants").addEventListener("input", () => { updateStatus(); updatePreview(); });
  $("bracketForm").addEventListener("submit", submit);

  updateStatus();
  updatePreview();
  renderPrev();
})();
