/* Bring a Plate — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:plate-made:v1";
  const MAX_CATS = 12;

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
      if (!Number.isFinite(capacity)) capacity = 4; // no xN suffix given
      capacity = Math.min(20, Math.max(1, capacity)); // "x0" clamps to 1
      return { name: name.slice(0, 40), capacity };
    });
  }

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
    let msg = `<strong>${cats.length} ${cats.length === 1 ? "category" : "categories"}, ` +
      `${spots} ${spots === 1 ? "spot" : "spots"}</strong>`;

    const dupe = firstDupe(cats);
    if (catLines().length > MAX_CATS) {
      el.classList.add("warn");
      msg += " — twelve categories is the limit; only the first twelve count.";
    } else if (dupe) {
      el.classList.add("warn");
      msg += ` — "${escHtml(dupe)}" appears twice. Each category needs its own name.`;
    }
    el.innerHTML = msg;
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

    const cats = parseCategories();
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
  $("categories").addEventListener("input", updateStatus);
  $("plateForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
