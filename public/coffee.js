/* Coffee Roulette — builder page logic. */
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
  const LS_KEY = "bbb:coffee-made:v1";

  const lines = (el) =>
    listPieces($(el).value).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);

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
  /* Shows the pairing shape before they commit, because "will
     someone be left out?" is the first thing people ask about an
     odd-numbered team. Answer it on the form rather than in a FAQ. */
  function updateStatus() {
    const el = $("statusLine");
    const names = lines("names");
    el.classList.remove("warn");
    if (!names.length) { el.innerHTML = ""; return; }

    const dup = findDuplicate(names);
    if (dup) {
      el.classList.add("warn");
      el.innerHTML = `<strong>"${dup}"</strong> is in the list twice — add a surname initial.`;
      return;
    }
    if (names.length < 3) {
      el.classList.add("warn");
      el.innerHTML = `<strong>${names.length} name${names.length === 1 ? "" : "s"}</strong> — needs at least three.`;
      return;
    }
    if (names.length > 200) {
      el.classList.add("warn");
      el.innerHTML = `<strong>${names.length} names</strong> — the limit is 200.`;
      return;
    }
    const odd = names.length % 2 === 1;
    const pairs = odd ? (names.length - 3) / 2 : names.length / 2;
    // A team of three is all trio and no pairs, so "0 pairs and one
    // three" needs its own wording rather than a plural check.
    const shape = !odd
      ? `${pairs} pair${pairs === 1 ? "" : "s"}`
      : pairs === 0
        ? "one group of three"
        : `${pairs} pair${pairs === 1 ? "" : "s"} and one three`;
    el.innerHTML = `<strong>${names.length} people</strong> — ${shape}. Nobody sits out.`;
  }

  /* ---- previously made --------------------------------------- */
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
    for (const d of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = d.editUrl;
      a.textContent = d.title || "Untitled coffee roulette";
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
    const btn = $("makeBtn");
    const err = $("formError");
    err.hidden = true;

    const names = lines("names");
    const title = $("title").value.trim();

    if (names.length < 3)
      return fail("Add at least three names — with two there's only ever one pairing.");
    if (names.length > 200)
      return fail("That's more than 200 people — the limit is 200.");
    const dup = findDuplicate(names);
    if (dup)
      return fail(`"${dup}" is in the list twice — add a surname initial so the right one gets claimed.`);

    btn.disabled = true;
    btn.textContent = "Pairing…";

    try {
      const res = await fetch("/api/coffee", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          names,
          cadence: $("cadence").value.trim(),
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
      btn.textContent = "Pair them up →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  $("names").addEventListener("input", updateStatus);
  $("coffeeForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
