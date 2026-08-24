/* Hens & Shower Planner — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:hens-made:v1";
  const MAX_CATS = 12;
  const MAX_ACTIVITIES = 20;
  const MAX_ACTIVITY = 100;

  const escHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---- categories: "Name xN" per line ------------------------ */
  const catLines = () =>
    $("categories").value.split("\n")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);

  function parseCategories() {
    return catLines().slice(0, MAX_CATS).map((line) => {
      const m = line.match(/^(.*?)\s*[xX]\s*(\d+)$/);
      let name = line;
      let capacity;
      if (m && m[1].trim()) {
        name = m[1].trim();
        capacity = parseInt(m[2], 10);
      }
      if (!Number.isFinite(capacity)) capacity = 2; // no xN suffix given
      capacity = Math.min(20, Math.max(1, capacity)); // "x0" clamps to 1
      return { name: name.slice(0, 40), capacity };
    });
  }

  /* ---- activities: one per line ------------------------------ */
  const parseActivities = () =>
    $("activities").value.split("\n")
      .map((s) => s.trim().replace(/\s+/g, " ").slice(0, MAX_ACTIVITY))
      .filter(Boolean)
      .slice(0, MAX_ACTIVITIES);

  function firstDupe(cats) {
    const seen = new Set();
    for (const c of cats) {
      const k = c.name.toLowerCase();
      if (seen.has(k)) return c.name;
      seen.add(k);
    }
    return null;
  }

  /* ---- live summary ------------------------------------------ */
  function updateStatus() {
    const el = $("statusLine");
    el.classList.remove("warn");
    const cats = parseCategories();
    if (!cats.length) { el.innerHTML = ""; return; }

    const spots = cats.reduce((s, c) => s + c.capacity, 0);
    const acts = parseActivities().length;
    let msg = `<strong>${cats.length} ${cats.length === 1 ? "list" : "lists"}, ` +
      `${spots} ${spots === 1 ? "spot" : "spots"}</strong>` +
      (acts ? ` · ${acts} ${acts === 1 ? "plan item" : "plan items"}` : "");

    const dupe = firstDupe(cats);
    if (catLines().length > MAX_CATS) {
      el.classList.add("warn");
      msg += " — twelve lists is the limit; only the first twelve count.";
    } else if (dupe) {
      el.classList.add("warn");
      msg += ` — "${escHtml(dupe)}" appears twice. Each list needs its own name.`;
    }
    el.innerHTML = msg;
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
    const cats = parseCategories();
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
  $("categories").addEventListener("input", updateStatus);
  $("activities").addEventListener("input", updateStatus);
  $("hensForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
