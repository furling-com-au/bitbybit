/* Pixel Gift Registry — builder page logic. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_KEY = "bbb:registry-made:v1";

  /* ---- earlier registries (this browser only) ---------------- */
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
    $("prevRegistries").hidden = false;
    $("prevList").innerHTML = "";
    for (const r of list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = r.editUrl;
      a.textContent = r.coupleNames || "Untitled registry";
      const when = document.createElement("span");
      when.className = "fine";
      when.textContent = " — " + new Date(r.at).toLocaleDateString("en-AU");
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

    const coupleNames = $("coupleNames").value.trim();
    if (!coupleNames) return fail("Add your names — it's your registry.");

    btn.disabled = true;
    btn.textContent = "Rolling it into the garage…";

    try {
      const res = await fetch("/api/registry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          coupleNames,
          tagline: $("tagline").value.trim(),
          weddingDate: $("weddingDate").value.trim(),
          overflowTitle: $("overflowTitle").value.trim(),
          payment: {
            method: $("payMethod").value.trim(),
            payId: $("payId").value.trim(),
            accountName: $("accountName").value.trim(),
            bsb: $("bsb").value.trim(),
            accountNumber: $("accountNumber").value.trim(),
            note: $("payNote").value.trim(),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Server said " + res.status + ".");

      const editUrl = "/e/" + data.editToken;
      savePrev({ coupleNames, editUrl, at: new Date().toISOString() });
      location.href = editUrl;
    } catch (ex) {
      fail(ex.message || "Something went wrong — try again.");
      btn.disabled = false;
      btn.textContent = "Open the garage →";
    }

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      return false;
    }
  }

  /* ---- wire up ----------------------------------------------- */
  $("registryForm").addEventListener("submit", submit);
  renderPrev();
})();
