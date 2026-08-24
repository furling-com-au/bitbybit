/* Meal Train — builder page logic. Collects the household, the dietary
   needs, the drop-off details and the span of days, generates the date
   list client-side, and posts it. No framework, no build step. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:meal-made:v1";
  const MAX_DAYS = 60;

  const escHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---- date helpers (all in UTC, mirroring the server) -------- */
  function parseISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }
  function toISO(dt) {
    const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return dt.getUTCFullYear() + "-" + mo + "-" + d;
  }
  function fmtDay(iso) {
    const d = parseISO(iso);
    return d ? WD[d.getUTCDay()] + " " + d.getUTCDate() + " " + MO[d.getUTCMonth()] : iso;
  }

  /* Build the list of dates from the first day, the number of meals, and
     the spacing (1 = every day, 2 = every second day, 7 = weekly). */
  function buildDates() {
    const start = parseISO($("firstDate").value);
    if (!start) return [];
    let count = parseInt($("meals").value, 10);
    if (!Number.isFinite(count) || count < 1) count = 0;
    count = Math.min(count, MAX_DAYS);
    const step = parseInt($("spacing").value, 10) || 1;
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(toISO(new Date(Date.UTC(
        start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i * step))));
    }
    return out;
  }

  /* ---- live summary ------------------------------------------ */
  function updateStatus() {
    const el = $("statusLine");
    el.classList.remove("warn");
    const dates = buildDates();
    if (!dates.length) { el.innerHTML = ""; return; }

    const cap = parseInt($("capacity").value, 10) || 1;
    const meals = dates.length * cap;
    let msg = "<strong>" + meals + " " + (meals === 1 ? "meal" : "meals") + "</strong> over " +
      dates.length + " " + (dates.length === 1 ? "day" : "days") +
      " — " + escHtml(fmtDay(dates[0]));
    if (dates.length > 1) msg += " → " + escHtml(fmtDay(dates[dates.length - 1]));

    if (parseInt($("meals").value, 10) > MAX_DAYS) {
      el.classList.add("warn");
      msg += " — sixty days is the limit; only the first sixty count.";
    }
    el.innerHTML = msg;
  }

  /* ---- earlier rosters (this browser only) ------------------- */
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
      a.textContent = b.title || "Untitled roster";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(b.at).toLocaleDateString("en-AU");
      li.append(a, when);
      $("prevList").appendChild(li);
    }
  }

  /* ---- submit ------------------------------------------------ */
  /* "Other ways to help": one job per line. A trailing "x2" means two
     people are needed for it. The multiplier is stripped from the label,
     or the board would read "Walk Ruby x2 — 0 of 2". */
  function parseTasks(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean)
      .slice(0, 12)
      .map(function (line) {
        var m = /^(.*?)\s*[x×]\s*(\d{1,2})$/i.exec(line);
        if (m && m[1].trim()) {
          return { label: m[1].trim(), capacity: Math.min(parseInt(m[2], 10) || 1, 20) };
        }
        return { label: line, capacity: 1 };
      });
  }

  async function submit(e) {
    e.preventDefault();
    const btn = $("makeBtn");
    const err = $("formError");
    err.hidden = true;

    const forWhom = $("forWhom").value.trim();
    const allergies = $("allergies").value.trim();
    const note = $("note").value.trim();
    const dropoff = $("dropoff").value.trim();
    const dates = buildDates();
    const capacityPerDay = parseInt($("capacity").value, 10) || 1;
    const tasks = parseTasks($("tasks").value);

    if (!forWhom) return fail("Who are the meals for? Add a name.");
    if (!$("firstDate").value) return fail("Pick the first day.");
    if (!dates.length) return fail("How many days need a meal? Pick at least one.");

    btn.disabled = true;
    btn.textContent = "Setting it up…";

    try {
      const res = await fetch("/api/meal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ forWhom, allergies, note, dropoff, dates, capacityPerDay, tasks }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server said ${res.status}.`);

      const editUrl = `/e/${data.editToken}`;
      savePrev({ title: "Meals for " + forWhom, editUrl, at: new Date().toISOString() });
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Start the roster →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "Start the roster →";
      return false;
    }
  }

  /* ---- default the first day to tomorrow --------------------- */
  (function seedDate() {
    const el = $("firstDate");
    if (el && !el.value) {
      const t = new Date();
      const tomorrow = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate() + 1));
      el.value = tomorrow.toISOString().slice(0, 10);
    }
  })();

  /* ---- wire up ----------------------------------------------- */
  ["firstDate", "meals", "spacing", "capacity"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", updateStatus);
    if (el) el.addEventListener("change", updateStatus);
  });
  $("mealForm").addEventListener("submit", submit);

  updateStatus();
  renderPrev();
})();
