/* Kris Kringle — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:kringle-made:v1";

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const lines = (el) =>
    $(el).value.split("\n").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);

  /* First name that appears twice (case-insensitive), or null. */
  function findDuplicate(names) {
    const seen = new Set();
    for (const n of names) {
      const key = n.toLowerCase();
      if (seen.has(key)) return n;
      seen.add(key);
    }
    return null;
  }

  /* ---- live status ------------------------------------------- */
  function updateStatus() {
    const names = lines("names");
    const el = $("statusLine");
    el.classList.remove("warn");

    if (!names.length) { el.innerHTML = ""; return; }

    const dup = findDuplicate(names);
    if (dup) {
      el.classList.add("warn");
      el.innerHTML = `<strong>${esc(dup)}</strong> is in there twice — add a surname initial so the right one gets claimed.`;
      return;
    }
    if (names.length < 3) {
      el.classList.add("warn");
      el.innerHTML = `<strong>${names.length} name${names.length === 1 ? "" : "s"}</strong> — Kris Kringle needs at least three.`;
    } else if (names.length > 100) {
      el.classList.add("warn");
      el.innerHTML = `<strong>${names.length} names</strong> — the limit is 100. Split into two draws.`;
    } else {
      el.innerHTML = `<strong>${names.length} names</strong> in the hat.`;
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
  $("names").addEventListener("input", updateStatus);
  $("kringleForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
