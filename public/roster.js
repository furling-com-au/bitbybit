/* Volunteer Roster — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:roster-made:v1";
  const MAX_SHIFTS = 20;

  const escHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---- shifts: "Job time xN" per line ------------------------ */
  const shiftLines = () =>
    $("shifts").value.split("\n")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);

  function parseShifts() {
    return shiftLines().slice(0, MAX_SHIFTS).map((line) => {
      const m = line.match(/^(.*?)\s*[xX]\s*(\d+)$/);
      let label = line;
      let capacity;
      if (m && m[1].trim()) {
        label = m[1].trim();
        capacity = parseInt(m[2], 10);
      }
      if (!Number.isFinite(capacity)) capacity = 2; // no xN suffix given
      capacity = Math.min(30, Math.max(1, capacity)); // "x0" clamps to 1
      return { label: label.slice(0, 50), capacity };
    });
  }

  /* ---- live summary ------------------------------------------ */
  function updateStatus() {
    const el = $("statusLine");
    el.classList.remove("warn");
    const shifts = parseShifts();
    if (!shifts.length) { el.innerHTML = ""; return; }

    const spots = shifts.reduce((s, c) => s + c.capacity, 0);
    let msg = `<strong>${shifts.length} ${shifts.length === 1 ? "shift" : "shifts"}, ` +
      `${spots} ${spots === 1 ? "spot" : "spots"}</strong>`;

    if (shiftLines().length > MAX_SHIFTS) {
      el.classList.add("warn");
      msg += " — twenty shifts is the limit; only the first twenty count.";
    }
    el.innerHTML = msg;
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
    const btn = $("makeBtn");
    const err = $("formError");
    err.hidden = true;

    const shifts = parseShifts();
    const title = $("title").value.trim();
    const eventDate = $("eventDate").value.trim();
    const note = $("note").value.trim();

    if (!shifts.length) return fail("Add at least one shift (one per line).");

    btn.disabled = true;
    btn.textContent = "Building the roster…";

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
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Build the roster →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("shifts").addEventListener("input", updateStatus);
  $("rosterForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
