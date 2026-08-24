/* Team Picker — split a list of names into fair random teams.
   Entirely client-side: the names never leave this page. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:teams:v1";
  const MAX_TEAMS = 12;
  const MAX_SIZE = 20;

  const TEAM_NAMES = [
    "The Boomers", "The Sherrins", "The Lamingtons", "The Snags",
    "The Galahs", "The Esky Lifters", "The Drop Bears", "The Trundlers",
    "The Pavlovas", "The Dingoes", "The Yabbies", "The Mulligans",
  ];

  /* ---- fair randomness (same recipe the sweeps use) ---------- */
  function rand(n) {
    // Rejection sampling — unbiased, unlike modulo.
    const max = Math.floor(0xffffffff / n) * n;
    const buf = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= max);
    return x % n;
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ---- inputs ------------------------------------------------ */
  const names = () =>
    $("names").value.split("\n").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);

  const mode = () => ($("modeSize").checked ? "size" : "count");

  function clampNum(el, lo, hi, fallback) {
    const v = parseInt(el.value, 10);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  }

  /* How many teams, given the mode and n names. */
  function teamCount(n) {
    if (mode() === "size") {
      const size = clampNum($("teamSize"), 2, MAX_SIZE, 5);
      return Math.max(1, Math.ceil(n / size));
    }
    return clampNum($("teamCount"), 2, MAX_TEAMS, 2);
  }

  /* Round-robin sizes: n into k, differing by at most one. */
  function sizesFor(n, k) {
    const base = Math.floor(n / k), extra = n % k;
    return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
  }

  function sizesLabel(sizes) {
    const k = sizes.length;
    const word = `${k} team${k === 1 ? "" : "s"}`;
    if (sizes.every((s) => s === sizes[0])) return `${word} of ${sizes[0]}`;
    if (k <= 12) return `${word} of ${sizes.join(", ")}`;
    return `${word} of ${sizes[0]} and ${sizes[k - 1]}`;
  }

  /* ---- live status ------------------------------------------- */
  function updateStatus() {
    const el = $("statusLine");
    const n = names().length;
    el.classList.remove("warn");
    $("shuffleBtn").disabled = !n;
    if (!n) { el.innerHTML = ""; return; }

    const k = teamCount(n);
    if (mode() === "count" && n < k) {
      el.classList.add("warn");
      el.innerHTML = `<strong>${n} name${n === 1 ? "" : "s"} → ${k} teams</strong>` +
        " — more teams than people. Someone's playing solo.";
      return;
    }
    const label = `<strong>${n} name${n === 1 ? "" : "s"} → ${sizesLabel(sizesFor(n, k))}</strong>`;
    if (k === 1) {
      el.classList.add("warn");
      el.innerHTML = label + " — that's not a split, that's the group. Try a smaller team size.";
    } else {
      el.innerHTML = label;
    }
  }

  /* ---- the deal ---------------------------------------------- */
  let lastTeams = null;

  function deal() {
    const list = shuffle(names());
    const k = teamCount(list.length);
    const teams = Array.from({ length: k }, () => []);
    list.forEach((name, i) => teams[i % k].push(name));

    let titles;
    if ($("funNames").checked) {
      const pool = shuffle(TEAM_NAMES.slice());
      titles = teams.map((_, i) => (i < pool.length ? pool[i] : `Team ${i + 1}`));
    } else {
      titles = teams.map((_, i) => `Team ${i + 1}`);
    }
    return teams.map((members, i) => ({ title: titles[i], members }));
  }

  /* ---- rendering (DOM building — user text goes in as text) -- */
  function render(teams) {
    const grid = $("teamGrid");
    grid.innerHTML = "";
    teams.forEach((team, i) => {
      const card = document.createElement("li");
      card.className = "team-card";
      card.style.animationDelay = (i * 70) + "ms";

      const head = document.createElement("header");
      head.className = "team-head";
      const title = document.createElement("span");
      title.className = "team-title";
      title.textContent = team.title;
      const count = document.createElement("span");
      count.className = "team-count";
      count.textContent = team.members.length === 0 ? "nobody"
        : team.members.length === 1 ? "1 person" : team.members.length + " people";
      head.append(title, count);

      const list = document.createElement("ul");
      list.className = "team-list";
      if (!team.members.length) {
        const li = document.createElement("li");
        li.className = "team-empty";
        li.textContent = "(empty — poach from next door)";
        list.appendChild(li);
      }
      for (const member of team.members) {
        const li = document.createElement("li");
        li.textContent = member;
        list.appendChild(li);
      }

      card.append(head, list);
      grid.appendChild(card);
    });
    $("results").hidden = false;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showResults() {
    const el = $("results");
    if (el.getBoundingClientRect().top > window.innerHeight - 120) {
      el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!names().length) return;
    lastTeams = deal();
    render(lastTeams);
    save();
    $("shuffleBtn").textContent = "Shuffle again →";
    showResults();
  }

  /* ---- copy to clipboard ------------------------------------- */
  function copyText() {
    return (lastTeams || []).map((t) =>
      t.title + ": " + (t.members.length ? t.members.join(", ") : "—")).join("\n");
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); }
    catch { alert("Couldn't reach the clipboard — select the teams and copy the old way."); }
    document.body.removeChild(ta);
  }
  function copyTeams() {
    if (!lastTeams) return;
    const text = copyText();
    const done = () => {
      const b = $("copyBtn");
      b.textContent = "Copied";
      setTimeout(() => { b.textContent = "Copy teams"; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  /* ---- persistence (this browser only) ----------------------- */
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        names: $("names").value,
        mode: mode(),
        teamCount: $("teamCount").value,
        teamSize: $("teamSize").value,
        funNames: $("funNames").checked,
      }));
    } catch { /* private mode */ }
  }
  function restore() {
    let s;
    try { s = JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
    catch { s = null; }
    if (!s || typeof s !== "object") return;
    if (typeof s.names === "string") $("names").value = s.names;
    if (s.mode === "size") $("modeSize").checked = true;
    if (s.teamCount) $("teamCount").value = s.teamCount;
    if (s.teamSize) $("teamSize").value = s.teamSize;
    $("funNames").checked = !!s.funNames;
  }

  /* ---- wire up ----------------------------------------------- */
  $("names").addEventListener("input", () => { updateStatus(); save(); });
  ["modeCount", "modeSize", "funNames"].forEach((id) =>
    $(id).addEventListener("change", () => { updateStatus(); save(); }));
  ["teamCount", "teamSize"].forEach((id) => {
    $(id).addEventListener("input", () => { updateStatus(); save(); });
    // Typing in a number field picks its mode — nobody sets "teams of 4"
    // and means the other radio.
    $(id).addEventListener("focus", () => {
      $(id === "teamCount" ? "modeCount" : "modeSize").checked = true;
      updateStatus();
      save();
    });
  });
  $("teamForm").addEventListener("submit", submit);
  $("againBtn").addEventListener("click", submit);
  $("copyBtn").addEventListener("click", copyTeams);

  restore();
  updateStatus();
})();
