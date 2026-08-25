/* Secret Role Dealer — builder page logic. */
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
  const LS_KEY = "bbb:roles-made:v1";
  const MAX_ROLES = 40;

  const LOCATIONS = ["Casino", "Space Station", "Submarine", "Beach",
    "Cathedral", "Circus Tent", "Corporate Party", "Crusader Army",
    "Day Spa", "Embassy", "Hospital", "Hotel", "Military Base",
    "Movie Studio", "Passenger Train", "Pirate Ship"];

  let lastPreset = null;
  let spyLocation = null;

  const PRESETS = {
    werewolf: {
      def: 8, min: 4,
      build(n) {
        const wolves = n >= 12 ? 3 : 2;
        const roles = [];
        for (let i = 0; i < wolves; i++) roles.push("Werewolf");
        roles.push("Seer", "Doctor");
        while (roles.length < n) roles.push("Villager");
        return roles;
      },
    },
    spyfall: {
      def: 6, min: 3,
      build(n) {
        const roles = ["You are the SPY. Work out the location without giving yourself away."];
        for (let i = 1; i < n; i++) roles.push(`Location: ${spyLocation}. Find the spy.`);
        return roles;
      },
    },
    avalon: {
      def: 7, min: 5,
      build(n) {
        const roles = ["Merlin", "Assassin", "Morgana", "Percival"];
        for (let i = 0; i < n - 5; i++) roles.push("Loyal Servant of Arthur");
        roles.push("Minion of Mordred");
        return roles;
      },
    },
    traitor: {
      def: 10, min: 2,
      build(n) {
        const roles = ["The Traitor"];
        for (let i = 1; i < n; i++) roles.push("Faithful");
        return roles;
      },
    },
  };

  function applyPreset(name, reroll, writeBack = true) {
    const p = PRESETS[name];
    let n = parseInt($("playerCount").value, 10);
    if (!Number.isFinite(n)) n = p.def;
    n = Math.max(p.min, Math.min(MAX_ROLES, n));
    if (writeBack) $("playerCount").value = n; // never rewrite mid-typing
    if (name === "spyfall" && (reroll || !spyLocation))
      spyLocation = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    $("roles").value = p.build(n).join("\n");
    lastPreset = name;
    updateStatus();
  }

  /* ---- live status ------------------------------------------- */
  const lines = (el) =>
    listPieces($(el).value).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);

  function updateStatus() {
    const n = lines("roles").length;
    const el = $("statusLine");
    el.classList.remove("warn");
    if (!n) { el.innerHTML = ""; return; }
    if (n > MAX_ROLES) {
      el.classList.add("warn");
      el.innerHTML = `<strong>${n} roles</strong> — over the limit of ${MAX_ROLES}. Trim a few lines.`;
    } else if (n < 2) {
      el.innerHTML = `<strong>1 role</strong> — a game of one is just standing in a room.`;
    } else {
      el.innerHTML = `<strong>${n} roles</strong> — deals to exactly ${n} players.`;
    }
  }

  /* ---- previous deals (this browser only) -------------------- */
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
    $("prevMade").hidden = false;
    $("prevList").innerHTML = "";
    for (const s of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = s.editUrl;
      a.textContent = s.title || "Untitled game";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(s.at).toLocaleDateString("en-AU");
      li.append(a, when);
      $("prevList").appendChild(li);
    }
  }

  /* ---- submit ------------------------------------------------ */
  async function submit(e) {
    e.preventDefault();
    const btn = $("dealBtn");
    const err = $("formError");
    err.hidden = true;

    const roles = lines("roles");
    const title = $("title").value.trim();
    const note = $("note").value.trim();

    if (roles.length < 2) return fail("Add at least two roles — one per line.");
    if (roles.length > MAX_ROLES)
      return fail(`That's ${roles.length} roles — this tool tops out at ${MAX_ROLES} players.`);

    btn.disabled = true;
    btn.textContent = "Dealing…";

    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, roles, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title, editUrl, at: new Date().toISOString() });
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Deal the roles →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  const presetBtns = document.querySelectorAll("[data-preset]");
  for (const btn of presetBtns) {
    btn.addEventListener("click", () => applyPreset(btn.getAttribute("data-preset"), true));
  }
  $("playerCount").addEventListener("input", () => {
    // Rebuild live only once the number is usable; let people finish typing.
    const n = parseInt($("playerCount").value, 10);
    if (lastPreset && Number.isFinite(n) && n >= PRESETS[lastPreset].min) applyPreset(lastPreset, false, false);
  });
  $("playerCount").addEventListener("change", () => {
    if (lastPreset) applyPreset(lastPreset, false);
  });
  $("roles").addEventListener("input", () => { lastPreset = null; updateStatus(); });
  $("rolesForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
