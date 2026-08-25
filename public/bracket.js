/* Tournament Bracket — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  /* People type a list two ways: one per line, or comma-separated on a single
     line. The second used to be a dead end — splitting on newlines returned
     one item, and the tool refused it with "add at least three names", which
     reads as though the names were wrong rather than the separator.

     Falling back to commas ONLY when the whole input is a single line is what
     makes this safe: one line is already a useless input for this field, so
     the fallback can only turn a certain refusal into a likely success.
     Multi-line input is left alone, so an entry that legitimately contains a
     comma keeps it as long as it sits on its own line. Fields where a single
     item IS valid — bring-a-plate categories, volunteer-roster shifts,
     hens-planner categories and activities — deliberately do not do this. */
  const listPieces = (v) => {
    const lines = v.split("\n").filter((s) => s.trim());
    return lines.length === 1 && lines[0].includes(",") ? lines[0].split(",") : v.split("\n");
  };
  const LS_KEY = "bbb:bracket-made:v1";
  const MAX_ENTRANTS = 64;

  const escHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---- entrants: one per line -------------------------------- */
  const lines = () =>
    listPieces($("entrants").value)
      .map((s) => s.trim().replace(/\s+/g, " ").slice(0, 40))
      .filter(Boolean);

  function firstDupe(names) {
    const seen = new Set();
    for (const n of names) {
      const k = n.toLowerCase();
      if (seen.has(k)) return n;
      seen.add(k);
    }
    return null;
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
  $("entrants").addEventListener("input", updateStatus);
  $("bracketForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
