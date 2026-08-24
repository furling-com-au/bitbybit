/* Melbourne Cup sweep — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:sweeps:v1";
  const FIELD = 24;

  /* ---- default outcomes: the full field, by number ----------- */
  function defaultOutcomes() {
    const out = [];
    for (let i = 1; i <= FIELD; i++) out.push("Horse " + i);
    return out;
  }
  // The textarea is prefilled in the HTML; this is belt and braces.
  if (!$("outcomes").value.trim()) $("outcomes").value = defaultOutcomes().join("\n");

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
      el.innerHTML = `<strong>${n} names, ${o} horses</strong> — one each. Tidy.`;
    } else if (n < o) {
      const lo = Math.floor(o / n), hi = Math.ceil(o / n);
      const share = lo === hi ? `${lo} horses each` : `${lo} or ${hi} horses each`;
      el.innerHTML = `<strong>${n} names, ${o} horses</strong> — ${share}. Exactly how a Cup sweep should look.`;
    } else {
      el.classList.add("warn");
      el.innerHTML = `<strong>${n} names, ${o} horses</strong> — ${n - o} ${n - o === 1 ? "person" : "people"} will miss out. Run a second sweep so everyone gets a horse.`;
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

    if (outcomes.length < 2) return fail("Add at least two horses (one per line).");
    if (names.length < 2) return fail("Add at least two names — a sweep of one is just a quiet flutter.");

    btn.disabled = true;
    btn.textContent = "Drawing…";

    try {
      const res = await fetch("/api/sweeps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, kind: "cup", outcomes, names }),
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
  $("outcomes").addEventListener("input", updateStatus);
  $("names").addEventListener("input", updateStatus);
  $("cupForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
