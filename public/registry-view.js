/* Pixel Gift Registry — instance page behaviour.
   Runs on both the shared page and the organiser page; the shell
   (rendered by the Worker) provides containers + window.RG_BOOT,
   /registry-prado.js provides the renderer and the parts list. */
(function () {
  "use strict";

  const BOOT = window.RG_BOOT || {};
  const RP = window.RegistryPrado;
  if (!RP || !BOOT.slug) return;

  const $ = (id) => document.getElementById(id);
  const slug = BOOT.slug;
  const LS_KEY = "bbb:registry:" + slug;
  const organiser = !!BOOT.editToken;
  const HOME = "/gift-registry/";

  const state = {
    claims: {},     // slotId -> claim, parts only
    overflow: [],   // overflow-patch contributions, newest first
    filterGroup: "all",
    filterPrice: "all",
    availableOnly: true,
  };

  /* ---- money (cents in, en-AU out) --------------------------- */
  const money = (cents) =>
    "$" + (cents / 100).toLocaleString("en-AU", {
      minimumFractionDigits: cents % 100 ? 2 : 0,
      maximumFractionDigits: 2,
    });

  /* ---- which claims are this browser's ----------------------- */
  function mine() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  }
  function rememberMine(slotId, ref) {
    const m = mine();
    if (!m.some((x) => x.slotId === slotId)) m.push({ slotId, ref });
    try { localStorage.setItem(LS_KEY, JSON.stringify(m)); } catch { /* private mode */ }
  }
  const mineIds = () => new Set(mine().map((x) => x.slotId));

  /* ---- data --------------------------------------------------- */
  async function refresh() {
    const res = await fetch("/api/registry/" + slug + "/claims");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Server said " + res.status + ".");
    const claims = {};
    const overflow = [];
    for (const c of data.claims || []) {
      if (RP.SLOT_BY_ID[c.slotId]) claims[c.slotId] = c;
      else if (/^overflow-/.test(c.slotId)) overflow.push(c);
    }
    state.claims = claims;
    // Prune "claimed by you" badges whose claim was released (or re-claimed
    // by someone else after a release).
    try {
      var live = new Set(state.claims.map(function (c) { return c.slotId; }));
      var pruned = mine().filter(function (id) { return live.has(id); });
      localStorage.setItem(MINE_KEY, JSON.stringify(pruned));
    } catch (e) { /* private mode */ }
    state.overflow = overflow; // API sorts newest first
  }

  /* ---- totals ------------------------------------------------- */
  function claimedCentsFor(groupId) {
    let n = 0;
    for (const s of RP.SLOTS) {
      if (groupId && s.group !== groupId) continue;
      if (state.claims[s.id]) n += s.cents;
    }
    return n;
  }
  const overflowCents = () =>
    state.overflow.reduce((n, c) => n + (c.cents || 0), 0);

  function groupProgress() {
    const p = {};
    for (const g of RP.GROUPS)
      p[g.id] = claimedCentsFor(g.id) / (RP.GROUP_TOTALS[g.id].cents || 1);
    return p;
  }

  /* ---- header + meter ----------------------------------------- */
  function renderHeader() {
    const partCents = claimedCentsFor(null);
    const raised = partCents + overflowCents();
    const claimed = RP.SLOTS.filter((s) => state.claims[s.id]).length;
    let pct = Math.floor((partCents / RP.GRAND_TOTAL) * 100);
    if (pct === 100 && claimed !== RP.SLOTS.length) pct = 99; // finished means finished

    $("rgMeterFill").style.width = pct + "%";
    // Numbers only — nothing user-typed goes through innerHTML.
    $("rgStats").innerHTML =
      "<strong>" + money(raised) + "</strong> of " + money(RP.GRAND_TOTAL) + "+" +
      ' <span class="rg-dot">·</span> <strong>' + claimed + "</strong> of " +
      RP.SLOTS.length + " parts" +
      ' <span class="rg-dot">·</span> <strong>' + pct + "%</strong> built";

    const cap = $("rgCaption");
    if (pct === 0) cap.textContent = "Nothing claimed yet — it's just a blueprint.";
    else if (pct < 100) cap.textContent = pct + "% built. Every claim paints another piece in.";
    else cap.textContent = "She's finished. Legends, the lot of you.";

    const tally = $("rgOverflowTally");
    tally.textContent = state.overflow.length
      ? state.overflow.length + (state.overflow.length === 1 ? " top-up" : " top-ups") +
        " so far · " + money(overflowCents()) + " in the tank"
      : "";
  }

  /* ---- the car ------------------------------------------------ */
  function ghostColour() {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue("--rg-ghost").trim();
    return v || "rgba(90,80,70,0.13)";
  }
  function renderCar() {
    RP.renderPrado($("rgCanvas"), groupProgress(), { ghost: ghostColour() });
  }

  /* ---- build sheet -------------------------------------------- */
  function renderSections() {
    const grid = $("rgSections");
    grid.innerHTML = "";
    const prog = groupProgress();

    for (const g of RP.GROUPS) {
      const total = RP.GROUP_TOTALS[g.id];
      const done = claimedCentsFor(g.id);
      const claimed = RP.SLOTS.filter((s) => s.group === g.id && state.claims[s.id]).length;
      const pct = Math.floor(prog[g.id] * 100);
      const colour = "var(--rg-g-" + g.id + ")";

      const el = document.createElement("button");
      el.type = "button";
      el.className = "rg-sect" +
        (state.filterGroup === g.id ? " is-on" : "") +
        (claimed === total.slots ? " is-done" : "");
      el.setAttribute("aria-pressed", String(state.filterGroup === g.id));
      el.innerHTML =
        '<span class="rg-sect-top">' +
        '<span class="rg-sect-swatch" style="background:' + colour + '"></span>' +
        '<span class="rg-sect-name"></span></span>' +
        '<span class="rg-sect-blurb"></span>' +
        '<span class="rg-sect-bar"><i style="background:' + colour + "; width:" + pct + '%"></i></span>' +
        '<span class="rg-sect-stats"><span>' + claimed + "/" + total.slots + " parts</span>" +
        "<span>" + money(done) + " / " + money(total.cents) + "</span></span>";
      el.querySelector(".rg-sect-name").textContent = g.name;
      el.querySelector(".rg-sect-blurb").textContent = g.blurb;
      el.addEventListener("click", () => {
        state.filterGroup = state.filterGroup === g.id ? "all" : g.id;
        syncChips();
        renderSections();
        renderParts();
        $("parts").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      grid.appendChild(el);
    }
  }

  /* ---- filters ------------------------------------------------ */
  const PRICES = [
    { value: "all", label: "Any price" },
    { value: "0-4999", label: "Under $50" },
    { value: "5000-14999", label: "$50–$149" },
    { value: "15000-39999", label: "$150–$399" },
    { value: "40000-999999", label: "$400+" },
  ];

  function buildChips() {
    const gRow = $("rgGroupChips");
    const all = document.createElement("button");
    all.type = "button";
    all.className = "rg-chip is-on";
    all.dataset.value = "all";
    all.textContent = "All sections";
    gRow.appendChild(all);
    for (const g of RP.GROUPS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rg-chip";
      b.dataset.value = g.id;
      b.textContent = g.name;
      gRow.appendChild(b);
    }
    gRow.addEventListener("click", (e) => {
      const chip = e.target.closest(".rg-chip");
      if (!chip) return;
      state.filterGroup = chip.dataset.value;
      syncChips();
      renderSections();
      renderParts();
    });

    const pRow = $("rgPriceChips");
    for (const p of PRICES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rg-chip" + (p.value === "all" ? " is-on" : "");
      b.dataset.value = p.value;
      b.textContent = p.label;
      pRow.appendChild(b);
    }
    pRow.addEventListener("click", (e) => {
      const chip = e.target.closest(".rg-chip");
      if (!chip) return;
      state.filterPrice = chip.dataset.value;
      syncChips();
      renderParts();
    });

    $("rgAvailableOnly").addEventListener("change", (e) => {
      state.availableOnly = e.target.checked;
      renderParts();
    });
  }

  function syncChips() {
    $("rgGroupChips").querySelectorAll(".rg-chip").forEach((c) =>
      c.classList.toggle("is-on", c.dataset.value === state.filterGroup));
    $("rgPriceChips").querySelectorAll(".rg-chip").forEach((c) =>
      c.classList.toggle("is-on", c.dataset.value === state.filterPrice));
  }

  function matchesFilters(slot) {
    if (state.filterGroup !== "all" && slot.group !== state.filterGroup) return false;
    if (state.filterPrice !== "all") {
      const parts = state.filterPrice.split("-").map(Number);
      if (slot.cents < parts[0] || slot.cents > parts[1]) return false;
    }
    if (state.availableOnly && state.claims[slot.id]) return false;
    return true;
  }

  /* ---- parts grid --------------------------------------------- */
  function renderParts() {
    const list = $("rgParts");
    const my = mineIds();
    const visible = RP.SLOTS.filter(matchesFilters)
      .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));

    list.innerHTML = "";
    for (const slot of visible) {
      const claim = state.claims[slot.id];
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rg-part" + (claim ? " taken" : "") + (my.has(slot.id) ? " is-mine" : "");
      if (claim) btn.disabled = true;

      const tier = RP.tierFor(slot.cents);
      btn.innerHTML =
        '<span class="rg-part-swatch" style="background:var(--rg-g-' + slot.group + ')"></span>' +
        '<span class="rg-part-tier"></span>' +
        '<span class="rg-part-name"></span>' +
        (slot.of > 1 ? '<span class="rg-part-of">no. ' + slot.index + " of " + slot.of + "</span>" : "") +
        '<span class="rg-part-blurb"></span>' +
        '<span class="rg-part-price">' + money(slot.cents) + "</span>";
      btn.querySelector(".rg-part-tier").textContent = tier.name;
      btn.querySelector(".rg-part-name").textContent = slot.name;
      btn.querySelector(".rg-part-blurb").textContent = slot.blurb;

      if (claim) {
        const by = document.createElement("span");
        by.className = "rg-part-claimedby";
        by.textContent = my.has(slot.id)
          ? "Claimed by you — thank you!"
          : "Claimed by " + claim.name;
        btn.appendChild(by);
      } else {
        btn.addEventListener("click", () => openClaim(slot));
      }

      li.appendChild(btn);
      list.appendChild(li);
    }

    $("rgEmpty").hidden = visible.length > 0;
    $("rgResultCount").textContent =
      visible.length + " part" + (visible.length === 1 ? "" : "s") + " shown";
  }

  /* ---- crew wall ---------------------------------------------- */
  function partLabel(slotId) {
    const s = RP.SLOT_BY_ID[slotId];
    if (s) return s.name + (s.of > 1 ? " (no. " + s.index + ")" : "");
    if (/^overflow-/.test(slotId)) return BOOT.overflowTitle || "Overflow patch";
    return slotId;
  }

  function renderCrew() {
    const list = $("rgCrew");
    const entries = Object.values(state.claims).concat(state.overflow)
      .sort((a, b) => new Date(b.at) - new Date(a.at));

    list.innerHTML = "";
    $("rgCrewEmpty").hidden = entries.length > 0;

    for (const c of entries) {
      const li = document.createElement("li");
      li.className = "rg-crew-item";
      const nm = document.createElement("div");
      nm.className = "rg-crew-name";
      nm.textContent = c.name;
      const pt = document.createElement("div");
      pt.className = "rg-crew-part";
      pt.textContent = /^overflow-/.test(c.slotId)
        ? partLabel(c.slotId) + " · " + money(c.cents || 0)
        : partLabel(c.slotId);
      li.append(nm, pt);
      if (c.message) {
        const m = document.createElement("div");
        m.className = "rg-crew-msg";
        m.textContent = "“" + c.message + "”";
        li.appendChild(m);
      }
      list.appendChild(li);
    }
  }

  /* ---- claim + contribute flow -------------------------------- */
  let pending = null; // { kind: "part", slot } | { kind: "overflow" }

  function openClaim(slot) {
    pending = { kind: "part", slot };
    $("rgClaimStep").hidden = false;
    $("rgDoneStep").hidden = true;
    $("rgClaimError").hidden = true;
    $("rgAmountField").hidden = true;
    $("rgClaimTier").textContent = RP.tierFor(slot.cents).name;
    $("rgClaimTitle").textContent =
      slot.of > 1 ? slot.name + " (no. " + slot.index + " of " + slot.of + ")" : slot.name;
    $("rgClaimBlurb").textContent = slot.blurb;
    $("rgClaimPrice").textContent = money(slot.cents);
    $("rgClaimPrice").hidden = false;
    $("rgClaimConfirm").disabled = false;
    $("rgClaimConfirm").textContent = "Claim this part";
    $("rgModal").showModal();
    setTimeout(() => $("rgName").focus(), 30);
  }

  function openOverflow() {
    pending = { kind: "overflow" };
    $("rgClaimStep").hidden = false;
    $("rgDoneStep").hidden = true;
    $("rgClaimError").hidden = true;
    $("rgAmountField").hidden = false;
    $("rgClaimTier").textContent = "The overflow patch";
    $("rgClaimTitle").textContent = BOOT.overflowTitle || "Overflow patch";
    $("rgClaimBlurb").textContent =
      "Pick any amount from $5 to $2,000. It doesn't paint pixels — it tops up the tank.";
    $("rgClaimPrice").hidden = true;
    $("rgClaimConfirm").disabled = false;
    $("rgClaimConfirm").textContent = "Chip it in";
    $("rgModal").showModal();
    setTimeout(() => $("rgAmount").focus(), 30);
  }

  async function confirmClaim() {
    if ($("rgClaimConfirm").disabled) return; // in-flight guard: Enter bypasses the button

    if (!pending) return;
    const btn = $("rgClaimConfirm");
    const err = $("rgClaimError");
    const name = $("rgName").value.trim();
    const message = $("rgMessage").value.trim();

    const fail = (msg) => {
      err.textContent = msg;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = pending && pending.kind === "overflow" ? "Chip it in" : "Claim this part";
    };

    if (!name) {
      fail("We need a name for the crew wall.");
      $("rgName").focus();
      return;
    }

    let url, payload;
    if (pending.kind === "overflow") {
      const dollars = Number($("rgAmount").value);
      if (!Number.isInteger(dollars) || dollars < 5 || dollars > 2000) {
        fail("Pick a whole-dollar amount between $5 and $2,000.");
        $("rgAmount").focus();
        return;
      }
      url = "/api/registry/contribute";
      payload = { slug, name, message, cents: dollars * 100 };
    } else {
      url = "/api/registry/claim";
      payload = { slug, slotId: pending.slot.id, name, message };
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    err.hidden = true;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        $("rgClaimConfirm").disabled = false;
        // The server's words, not ours — and the board repaints so
        // the part shows who got there first.
        err.textContent = data.error || "Someone beat you to that one by a whisker.";
        err.hidden = false;
        btn.textContent = "Claim this part";
        await refresh().catch(() => {});
        renderAll();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Server said " + res.status + ".");

      const slotId = pending.kind === "overflow" ? "overflow-local" : pending.slot.id;
      if (pending.kind === "part") rememberMine(slotId, data.ref);
      showDone(pending, data);
      await refresh().catch(() => {});
      renderAll();
    } catch (ex) {
      fail(ex.message || "Something went wrong. Try again?");
    }
  }

  function showDone(done, resp) {
    $("rgClaimStep").hidden = true;
    $("rgDoneStep").hidden = false;

    const cents = resp.cents;
    const tier = RP.tierFor(cents);
    $("rgDoneTitle").textContent = tier.name + " — nice one.";
    $("rgDoneLine").textContent = done.kind === "overflow"
      ? "That's " + money(cents) + " toward “" + (BOOT.overflowTitle || "the overflow patch") +
        "”. Straight in the tank."
      : "The " + done.slot.name.toLowerCase() + " is yours. It's already painted onto the Prado above.";

    const p = resp.payment || BOOT.payment || {};
    const rows = [
      ["Amount", money(cents)],
      ["Method", p.method],
      ["PayID", p.payId],
      ["Account name", p.accountName],
      ["BSB", p.bsb],
      ["Account", p.accountNumber],
    ].filter((r) => r[1]);

    const dl = $("rgPayDetails");
    dl.innerHTML = "";
    for (const r of rows) {
      const dt = document.createElement("dt");
      dt.textContent = r[0];
      const dd = document.createElement("dd");
      dd.textContent = r[1];
      dl.append(dt, dd);
    }

    const hasDetails = !!(p.payId || p.accountName || p.bsb || p.accountNumber);
    $("rgPayNote").textContent = hasDetails
      ? (p.note || "")
      : "The couple haven't added payment details here — sort the transfer out " +
        "with them directly, and quote the reference so they know it's you.";

    $("rgPayRef").textContent = resp.ref || "";
    const canvas = $("rgCanvas");
    canvas.classList.add("rg-pop");
    setTimeout(() => canvas.classList.remove("rg-pop"), 400);
  }

  function initModal() {
    $("rgClaimConfirm").addEventListener("click", confirmClaim);
    $("rgClaimCancel").addEventListener("click", () => $("rgModal").close());
    $("rgDoneClose").addEventListener("click", () => $("rgModal").close());
    $("rgClaimForm").addEventListener("submit", (e) => e.preventDefault());
    $("rgModalClose").addEventListener("click", () => $("rgModal").close());
    $("rgName").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); confirmClaim(); }
    });
    $("rgAmount").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); confirmClaim(); }
    });
    $("rgCopyRef").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($("rgPayRef").textContent);
        $("rgCopyRef").textContent = "copied";
        setTimeout(() => { $("rgCopyRef").textContent = "copy"; }, 1500);
      } catch { /* clipboard blocked — the code is right there to read */ }
    });
    $("rgOverflowBtn").addEventListener("click", openOverflow);
  }

  /* ---- organiser: admin table, CSV, delete -------------------- */
  let adminClaims = [];

  async function refreshAdmin() {
    if (!organiser) return;
    const res = await fetch("/api/registry/" + BOOT.editToken + "/admin");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Server said " + res.status + ".");
    adminClaims = data.claims || [];
    renderAdmin();
  }

  function renderAdmin() {
    if (!organiser) return;
    const body = $("rgAdminRows");
    body.innerHTML = "";
    let paidCents = 0;
    let pledged = 0;

    for (const c of adminClaims) {
      pledged += c.cents;
      if (c.paid) paidCents += c.cents;

      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td></td><td></td><td>" + money(c.cents) + "</td><td><code></code></td>" +
        '<td><input type="checkbox"' + (c.paid ? " checked" : "") + ' aria-label="Paid"></td>' +
        '<td class="rg-admin-act"><button class="btn small danger" type="button">Release</button></td>';
      tr.children[0].textContent = partLabel(c.slotId);
      tr.children[1].textContent = c.name + (c.message ? " — “" + c.message + "”" : "");
      tr.querySelector("code").textContent = c.ref || "";

      tr.querySelector('input[type="checkbox"]').addEventListener("change", (e) => {
        const box = e.target;
        post(BOOT.editToken + "/paid", { slotId: c.slotId, paid: box.checked }, null,
          () => refreshAdmin().catch(showErr),
          () => { box.checked = !box.checked; });
      });
      tr.querySelector("button").addEventListener("click", () => {
        post(BOOT.editToken + "/release", { slotId: c.slotId },
          "Release “" + partLabel(c.slotId) + "”? " + c.name +
          "'s claim is deleted and the part goes back to blueprint.",
          () => { refreshAdmin().catch(showErr); refreshAll(); });
      });
      body.appendChild(tr);
    }

    $("rgAdminSummary").textContent = adminClaims.length
      ? adminClaims.length + " claim" + (adminClaims.length === 1 ? "" : "s") +
        " · " + money(pledged) + " pledged · " + money(paidCents) + " marked paid"
      : "No claims yet.";
  }

  function exportCsv() {
    const rows = [["part", "slot_id", "name", "message", "amount_aud", "reference", "paid", "claimed_at"]];
    for (const c of adminClaims) {
      rows.push([
        partLabel(c.slotId), c.slotId, c.name, c.message || "",
        (c.cents / 100).toFixed(2), c.ref || "", c.paid ? "yes" : "no", c.at || "",
      ]);
    }
    const csv = rows
      .map((r) => r.map((v) => {
        // Formula-injection guard: Excel executes cells starting =+-@
        let t = String(v).replace(/"/g, '""');
        if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
        return '"' + t + '"';
      }).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "pixel-registry-claims.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function post(path, payload, confirmMsg, after, onFail) {
    if (confirmMsg && !confirm(confirmMsg)) { if (onFail) onFail(); return; }
    fetch("/api/registry/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    }).then((r) => {
      if (!r.ok) return r.json().catch(() => ({})).then((d) => {
        throw new Error(d.error || "That didn't work — try again.");
      });
      after();
    }).catch((e) => {
      if (onFail) onFail();
      alert((e && e.message) || "That didn't work — try again.");
    });
  }

  function showErr(e) { alert((e && e.message) || "That didn't work — try again."); }

  function initOrganiser() {
    if (!organiser) return;
    $("copyBtn").addEventListener("click", () => {
      const input = $("shareUrl");
      input.select();
      navigator.clipboard.writeText(input.value).then(() => {
        $("copyBtn").textContent = "Copied";
        setTimeout(() => { $("copyBtn").textContent = "Copy"; }, 1500);
      });
    });
    $("rgCsvBtn").addEventListener("click", exportCsv);
    $("rgAdminRefresh").addEventListener("click", () =>
      Promise.all([refreshAll(), refreshAdmin().catch(showErr)]));
    $("rgDeleteBtn").addEventListener("click", () => {
      post(BOOT.editToken + "/delete", null,
        "Delete this registry for good? Every link stops working immediately " +
        "and all claims go with it.",
        () => { location.href = HOME; });
    });
  }

  /* ---- wiring ------------------------------------------------- */
  function renderAll() {
    renderHeader();
    renderCar();
    renderSections();
    renderParts();
    renderCrew();
  }

  async function refreshAll() {
    const errEl = $("rgLoadError");
    try {
      await refresh();
      errEl.hidden = true;
    } catch (e) {
      errEl.textContent = "Couldn't load the claims (" + e.message +
        ") — showing what we have. Try refreshing in a moment.";
      errEl.hidden = false;
    }
    renderAll();
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCar, 120);
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderCar);

  (async function main() {
    buildChips();
    initModal();
    initOrganiser();
    await refreshAll();
    if (organiser) refreshAdmin().catch(showErr);
    setInterval(() => {
      if (document.hidden) return;
      refresh().then(renderAll).catch(() => {});
    }, 15000);
  })();
})();
