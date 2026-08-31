/* Question of the Day — builder page logic.
   The preview samples below are hardcoded on purpose: the real bank
   lives on the server and there's no reason to ship it to a browser
   just to show someone what the thing looks like. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:qotd-made:v1";

  /* ---- preview ----------------------------------------------- */
  const SAMPLES = [
    { text: "Is a hot dog a sandwich?", a: "Sandwich", b: "Not a sandwich" },
    { text: "Would you rather every meeting ran fifteen minutes longer, or started fifteen minutes earlier?", a: "Fifteen longer", b: "Fifteen earlier" },
    { text: "Reply-all to the whole company: bold move, or a crime?", a: "Bold move", b: "A crime" },
    { text: "Would you rather lose the office Wi-Fi for a week, or the office kettle forever?", a: "Wi-Fi for a week", b: "Kettle forever" },
  ];

  let shown = -1;
  function showSample(i) {
    shown = ((i % SAMPLES.length) + SAMPLES.length) % SAMPLES.length;
    const s = SAMPLES[shown];
    $("previewQ").textContent = s.text;
    $("previewA").textContent = s.a;
    $("previewB").textContent = s.b;
  }

  /* ---- earlier ones (this browser only) ---------------------- */
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
    $("prevQotd").hidden = false;
    $("prevList").innerHTML = "";
    for (const b of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = b.editUrl;
      a.textContent = b.teamName || "Question of the day";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — started " + new Date(b.at).toLocaleDateString("en-AU");
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

    const teamName = $("teamName").value.trim().replace(/\s+/g, " ").slice(0, 60);

    setBusy(true, "Setting it up…");

    try {
      const res = await fetch("/api/qotd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ teamName, editUrl, at: new Date().toISOString() });
      if (window.bbbRemember) window.bbbRemember("qotd", teamName, editUrl);
      location.href = editUrl;
    } catch (ex) {
      err.textContent = ex.message || "Something went wrong — try again.";
      err.hidden = false;
      // The error banner lives beside the button inside the form. Someone who
      // tapped the button above the fold is ~1,000px away from it, so a silent
      // failure would look like nothing happened at all.
      if (window.scrollY < 200) err.scrollIntoView({ block: "center" });
      setBusy(false);
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("qotdForm").addEventListener("submit", submit);
  $("previewNext").addEventListener("click", function () { showSample(shown + 1); });

  /* Deliberately NOT random, and deliberately no DOM write at all: the page
     ships with SAMPLES[0] already rendered in the HTML, so the preview is
     correct before this script runs.

     It used to pick at random here. Three of the four samples render at a
     different height from the shipped one — 242px, 307px, 237px, 307px on a
     375px viewport — so most loads moved the form and everything under it by
     up to 70px, after first paint and with no user input to excuse it. That
     is a pure Cumulative Layout Shift, and Cloudflare was reporting 12% of
     samples as poor with this page's preview span named as the element.

     Variety still exists: "Show me another" cycles, and a shift from a click
     does not count against CLS because the browser attributes it to the user.
     check-qotd-preview.mjs keeps the HTML and SAMPLES[0] in step. */
  shown = 0;
  renderPrev();
})();
