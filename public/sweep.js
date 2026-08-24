/* Grand Final sweep — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const BANDS = ["1–9", "10–19", "20–29", "30–39", "40–59", "60+"];
  const LS_KEY = "bbb:sweeps:v1";

  let outcomesDirty = false;

  /* ---- default outcomes follow the team names ---------------- */
  function teamName(input, fallback) {
    return $(input).value.trim() || fallback;
  }
  function defaultOutcomes() {
    const a = teamName("teamA", "Team one");
    const b = teamName("teamB", "Team two");
    return [
      ...BANDS.map((band) => `${a} by ${band}`),
      ...BANDS.map((band) => `${b} by ${band}`),
    ];
  }
  function regenOutcomes() {
    if (outcomesDirty) return;
    $("outcomes").value = defaultOutcomes().join("\n");
    updateStatus();
  }

  /* ---- live status ------------------------------------------- */
  const lines = (el) =>
    $(el).value.split("\n").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);

  function updateStatus() {
    const o = lines("outcomes").length;
    const n = lines("names").length;
    const el = $("statusLine");
    el.classList.remove("warn");

    if (!n) { el.innerHTML = ""; return; }
    if (n === o) {
      el.innerHTML = `<strong>${n} names, ${o} outcomes</strong> — one each. Tidy.`;
    } else if (n < o) {
      el.innerHTML = `<strong>${n} names, ${o} outcomes</strong> — ${o - n} extra draw${o - n === 1 ? "" : "s"} will go to random people.`;
    } else {
      el.classList.add("warn");
      el.innerHTML = `<strong>${n} names, ${o} outcomes</strong> — ${n - o} ${n - o === 1 ? "person" : "people"} will miss out. Add more outcomes (finer margin bands) to fit everyone.`;
    }
  }

  /* ---- previous sweeps (this browser only) ------------------- */
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
    $("prevSweeps").hidden = false;
    $("prevList").innerHTML = "";
    for (const s of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = s.editUrl;
      a.textContent = s.title || "Untitled sweep";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(s.at).toLocaleDateString("en-AU");
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

    const outcomes = lines("outcomes");
    const names = lines("names");
    const title = $("title").value.trim();

    if (outcomes.length < 2) return fail("Add at least two outcomes (one per line).");
    if (names.length < 2) return fail("Add at least two names — a sweep of one is just a bloke with a footy.");

    btn.disabled = true;
    btn.textContent = "Drawing…";

    try {
      const res = await fetch("/api/sweeps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, outcomes, names }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title, editUrl, at: new Date().toISOString() });
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Draw the sweep →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("teamA").addEventListener("input", regenOutcomes);
  $("teamB").addEventListener("input", regenOutcomes);
  $("outcomes").addEventListener("input", () => { outcomesDirty = true; updateStatus(); });
  $("names").addEventListener("input", updateStatus);
  $("sweepForm").addEventListener("submit", submit);

  regenOutcomes();
  renderPrev();
})();
