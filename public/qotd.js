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
    const btn = $("makeBtn");
    const err = $("formError");
    err.hidden = true;

    const teamName = $("teamName").value.trim().replace(/\s+/g, " ").slice(0, 60);

    btn.disabled = true;
    btn.textContent = "Setting it up…";

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
      location.href = editUrl;
    } catch (ex) {
      err.textContent = ex.message || "Something went wrong — try again.";
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "Start today's question →";
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("qotdForm").addEventListener("submit", submit);
  $("previewNext").addEventListener("click", function () { showSample(shown + 1); });

  showSample(Math.floor(Math.random() * SAMPLES.length));
  renderPrev();
})();
