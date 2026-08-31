/* Fact Matcher — builder page logic. */
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
  const LS_KEY = "bbb:fact-made:v1";
  const MIN_NAMES = 3;
  const MAX_NAMES = 60;

  const escHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---- names: one per line ----------------------------------- */
  const nameLines = () =>
    listPieces($("names").value)
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

  /* ---- live summary ------------------------------------------ */
  function updateStatus() {
    const el = $("statusLine");
    el.classList.remove("warn");
    const names = nameLines();
    if (!names.length) { el.innerHTML = ""; return; }

    let msg = `<strong>${names.length} ${names.length === 1 ? "name" : "names"}</strong>`;

    const dupe = firstDupe(names);
    if (dupe) {
      el.classList.add("warn");
      msg += ` — "${escHtml(dupe)}" appears twice. Add a surname initial so the right person claims it.`;
    } else if (names.length < MIN_NAMES) {
      el.classList.add("warn");
      msg += ` — add ${MIN_NAMES - names.length} more; a guessing game needs at least three.`;
    } else if (names.length > MAX_NAMES) {
      el.classList.add("warn");
      msg += ` — that's over ${MAX_NAMES}. Split a big group into two rounds.`;
    } else {
      msg += " — ready when you are.";
    }
    el.innerHTML = msg;
  }

  /* ---- earlier games (this browser only) --------------------- */
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
    $("prevGames").hidden = false;
    $("prevList").innerHTML = "";
    for (const g of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = g.editUrl;
      a.textContent = g.title || "Untitled game";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(g.at).toLocaleDateString("en-AU");
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

    const names = nameLines();
    const title = $("title").value.trim();
    const prompt = $("prompt").value.trim();
    const note = $("note").value.trim();

    const dupe = firstDupe(names);
    if (dupe) return fail(`"${dupe}" appears twice — add a surname initial so the right person claims it.`);
    if (names.length < MIN_NAMES) return fail("Add at least three names — a guessing game needs a few people.");
    if (names.length > MAX_NAMES) return fail(`Sixty names is the limit — split a big group into two rounds.`);

    btn.disabled = true;
    btn.textContent = "Setting it up…";

    try {
      const res = await fetch("/api/fact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, prompt, note, names }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title, editUrl, at: new Date().toISOString() });
      if (window.bbbRemember) window.bbbRemember("fact", title, editUrl);
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Collect the facts →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("names").addEventListener("input", updateStatus);
  $("factForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
