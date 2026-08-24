/* Group Vote — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:poll-made:v1";
  const MIN_OPTIONS = 2;
  const MAX_OPTIONS = 30;

  const escHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---- options: one per line, deduped ------------------------ */
  const rawLines = () =>
    $("options").value.split("\n").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);

  function uniqueOptions() {
    const seen = new Set();
    const out = [];
    for (const line of rawLines()) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line.slice(0, 80));
    }
    return out;
  }

  /* ---- live summary ------------------------------------------ */
  function updateStatus() {
    const el = $("statusLine");
    el.classList.remove("warn");
    const opts = uniqueOptions();
    const multi = $("multi").checked;

    if (!opts.length) { el.innerHTML = ""; return; }

    let msg = `<strong>${opts.length} ${opts.length === 1 ? "option" : "options"}</strong>` +
      ` · ${multi ? "pick any" : "pick one"}`;

    if (opts.length < MIN_OPTIONS) {
      el.classList.add("warn");
      msg += " — add at least two so there's something to choose between.";
    } else if (rawLines().length > MAX_OPTIONS) {
      el.classList.add("warn");
      msg += " — thirty options is the limit; trim the list a bit.";
    } else if (rawLines().length !== opts.length) {
      el.classList.add("warn");
      msg += " — duplicate lines were merged.";
    }
    el.innerHTML = msg;
  }

  /* ---- earlier polls (this browser only) --------------------- */
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
    $("prevPolls").hidden = false;
    $("prevList").innerHTML = "";
    for (const b of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = b.editUrl;
      a.textContent = b.question || "Untitled poll";
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

    const question = $("question").value.trim().replace(/\s+/g, " ");
    const options = uniqueOptions();
    const mode = $("multi").checked ? "multi" : "single";
    const allowSuggestions = $("allowSuggestions").checked;

    if (!question) return fail("Add a question — what's the group deciding?");
    if (options.length < MIN_OPTIONS) return fail("Give people at least two options to choose between.");
    if (options.length > MAX_OPTIONS) return fail("Thirty options is the limit — trim the list a bit.");

    btn.disabled = true;
    btn.textContent = "Starting the vote…";

    try {
      const res = await fetch("/api/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, options, mode, allowSuggestions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ question, editUrl, at: new Date().toISOString() });
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Start the vote →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("options").addEventListener("input", updateStatus);
  $("multi").addEventListener("change", updateStatus);
  $("pollForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
