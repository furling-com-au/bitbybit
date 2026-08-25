/* ============================================================
   Recipe Collection — everyone chips in a recipe, the organiser
   ends up with a keepsake book. Bridal showers, farewells, family
   milestones, a housewarming.

   Each recipe is a participants row, exactly like the group card:
   contributor names repeat (two Sams, two "Mum"s), so every row is
   inserted with name = '' and the contributor's name lives in the
   data JSON. The row token (22 chars) is the contributor's private
   edit key — the only way, short of the organiser link, to change or
   pull their own recipe. It is NEVER rendered on the public /s/ page;
   it appears only on the gated organiser /e/ page (for removal) and
   is handed back to the contributor's own browser at submit time.

   Everything a recipe holds — who's sharing it, the dish, the list,
   the method, the little story — is meant for the book, so the public
   page shows it all. The one capability that must not leak is the edit
   token; the page is built so it never touches the public HTML.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, getParticipant, getInstanceById,
  createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_TITLE = 80;
const MAX_FORWHOM = 80;
const MAX_NOTE = 300;
const MAX_COOK = 40;
const MAX_DISH = 80;
const MAX_INGREDIENTS = 1500;
const MAX_METHOD = 2500;
const MAX_SERVES = 40;
const MAX_STORY = 500;
const MAX_RECIPES = 200;

const NOUNS = ["pinch", "simmer", "ladle", "zest", "knead", "whisk",
  "batch", "morsel", "relish", "platter"];

const HOME = "/recipe-collection/";

/* ---------- data access ------------------------------------- */

const allRecipes = async (env, instanceId) =>
  (await env.DB.prepare(
    "SELECT * FROM participants WHERE instance_id = ? ORDER BY claimed_at, id"
  ).bind(instanceId).all()).results;

/* ---------- input ------------------------------------------- */

function parseCreate(body) {
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, MAX_TITLE);
  if (!title) throw badInput("Give the book a name — like “Grandma Rosa's Recipe Book”.");
  const forWhom = String(body.forWhom || "").trim().replace(/\s+/g, " ").slice(0, MAX_FORWHOM);
  const note = String(body.note || "").replace(/\r\n/g, "\n").trim().slice(0, MAX_NOTE);
  return { title, forWhom, note };
}

/* One recipe's fields. Multi-line fields (ingredients, method, story)
   keep their line breaks — only the single-line fields collapse
   whitespace. Empty optional fields are dropped so the stored JSON
   stays tidy. */
function parseRecipe(body) {
  const cook = String(body.cook || "").trim().replace(/\s+/g, " ").slice(0, MAX_COOK);
  const dish = String(body.dish || "").trim().replace(/\s+/g, " ").slice(0, MAX_DISH);
  const serves = String(body.serves || "").trim().replace(/\s+/g, " ").slice(0, MAX_SERVES);
  const ingredients = String(body.ingredients || "").replace(/\r\n/g, "\n").trim().slice(0, MAX_INGREDIENTS);
  const method = String(body.method || "").replace(/\r\n/g, "\n").trim().slice(0, MAX_METHOD);
  const story = String(body.story || "").replace(/\r\n/g, "\n").trim().slice(0, MAX_STORY);

  if (!cook) throw badInput("Pop your name on it — whose recipe is this?");
  if (!dish) throw badInput("Give the recipe a name.");
  if (!ingredients) throw badInput("Add the ingredients — that's half the recipe.");
  if (!method) throw badInput("Add the method — how's it actually made?");

  const r = { cook, dish, ingredients, method };
  if (serves) r.serves = serves;
  if (story) r.story = story;
  return r;
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const { title, forWhom, note } = parseCreate(await request.json().catch(() => ({})));
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "recipe", title,
    data: JSON.stringify({ forWhom, note }),
    nouns: NOUNS,
  });
  await logEvent(env, id, "recipe", "created");
  return json({ slug, editToken }, 201);
}

async function add(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "recipe") return json({ error: "not found" }, 404);

  const r = parseRecipe(body);

  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM participants WHERE instance_id = ?"
  ).bind(row.id).first();
  if (((count && count.n) || 0) >= MAX_RECIPES)
    return json({ error: "This book's full — 200 recipes is the limit." }, 409);

  // name stays '' so two "Mum"s can both contribute — the partial
  // unique index only bites on non-empty names.
  const token = randomString(22);
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO participants (instance_id, token, name, data, claimed_at, created_at)
     VALUES (?, ?, '', ?, ?, ?)`
  ).bind(row.id, token, JSON.stringify(r), now, now).run();
  return json({ token, id: res.meta.last_row_id }, 201);
}

/* Contributor edits their own recipe. The token is the whole key:
   only the row it belongs to is touched, and it can't reach across
   to another instance (we still confirm the tool type). */
async function saveRecipe(rtoken, request, env) {
  const prow = await getParticipant(env, rtoken);
  const row = prow && await getInstanceById(env, prow.instance_id);
  if (!row || row.tool_type !== "recipe")
    return json({ error: "That recipe wasn't found — it may already be gone." }, 404);

  const r = parseRecipe(await request.json().catch(() => ({})));
  await env.DB.prepare("UPDATE participants SET data = ? WHERE id = ?")
    .bind(JSON.stringify(r), prow.id).run();
  return json({ ok: true });
}

async function removeOwn(rtoken, env) {
  const prow = await getParticipant(env, rtoken);
  const row = prow && await getInstanceById(env, prow.instance_id);
  if (!row || row.tool_type !== "recipe")
    return json({ error: "That recipe wasn't found — it may already be gone." }, 404);
  await env.DB.prepare("DELETE FROM participants WHERE id = ?").bind(prow.id).run();
  return json({ ok: true });
}

async function orgRemove(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "recipe") return json({ error: "not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const rtoken = String(body.rtoken || "");
  if (!rtoken) return json({ error: "That recipe wasn't found." }, 404);
  // Scoped to this instance: an organiser link can only remove recipes
  // from its own book, never reach another instance's rows.
  const res = await env.DB.prepare(
    "DELETE FROM participants WHERE instance_id = ? AND token = ?"
  ).bind(row.id, rtoken).run();
  if (!res.meta.changes) return json({ error: "That recipe wasn't found." }, 404);
  return json({ ok: true });
}

async function orgDelete(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "recipe") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "recipe", "deleted");
  return json({ ok: true });
}

/* ---------- rendering --------------------------------------- */

/* One typeset recipe. `mode` is "public" or "org". The token is
   emitted ONLY in org mode (as data-rtoken, for removal) — never on
   the public page, where it would hand every visitor the edit key.
   Each raw value sits in its own clean element so the contributor's
   edit form can read it straight back off the DOM. */
function recipeCard(p, mode) {
  let d = {};
  try { d = JSON.parse(p.data); } catch { /* fine */ }
  const serves = String(d.serves || "").trim();
  const story = String(d.story || "").trim();

  return `
    <article class="recipe" data-id="${p.id}">
      <div class="recipe-head">
        <h3 class="recipe-dish"><span class="r-dish">${esc(d.dish || "Untitled")}</span></h3>
        <p class="recipe-by">shared by <span class="r-cook">${esc(d.cook || "someone")}</span>${
          serves ? ` <span class="recipe-serves">· serves <span class="r-serves">${esc(serves)}</span></span>` : ""}</p>
      </div>
      <div class="recipe-cols">
        <div class="recipe-ing-wrap">
          <p class="recipe-label">Ingredients</p>
          <div class="recipe-ingredients r-ingredients">${esc(d.ingredients || "")}</div>
        </div>
        <div class="recipe-method-wrap">
          <p class="recipe-label">Method</p>
          <div class="recipe-method r-method">${esc(d.method || "")}</div>
        </div>
      </div>${story ? `
      <p class="recipe-story"><span class="r-story">${esc(story)}</span></p>` : ""}${mode === "org" ? `
      <div class="recipe-actions">
        <button class="btn ghost recipe-mini recipe-org-remove" type="button" data-rtoken="${esc(p.token)}">Remove</button>
      </div>` : ""}
    </article>`;
}

const book = (parts, mode) => parts.length
  ? `<div class="recipe-book">${parts.map((p) => recipeCard(p, mode)).join("")}
  </div>`
  : `<p class="recipe-empty">No recipes yet — add the first and get the book started.</p>`;

const noteBlock = (data) =>
  data.note ? `<div class="pixel-note recipe-note">${esc(data.note)}</div>` : "";

function subLine(data, n, extra = "") {
  const count = `${n} ${n === 1 ? "recipe" : "recipes"}${n ? " in" : " yet"}`;
  const forWhom = data.forWhom
    ? `For <strong>${esc(data.forWhom)}</strong> · ` : "";
  return `${forWhom}${count}${extra}`;
}

/* ---------- public page (/s/:slug) -------------------------- */

async function publicPage(row, env) {
  const data = JSON.parse(row.data);
  const parts = await allRecipes(env, row.id);

  const body = `
<main class="wrap page">
  <p class="kicker">A recipe from everyone — one keepsake book</p>
  <h1>${esc(row.title)}</h1>
  <p class="page-sub">${subLine(data, parts.length, ' · <a href="#recipeAdd">add yours ↓</a>')}</p>
  ${noteBlock(data)}

  <div class="recipe-toolbar">
    <button class="btn" id="printBtn" type="button">Print the book</button>
    <a class="btn ghost" href="#recipeAdd">Add your recipe ↓</a>
  </div>

  ${book(parts, "public")}

  <section class="recipe-add" id="recipeAdd">
    <h2>Add your recipe</h2>
    <div class="panel">
      <form id="addForm" novalidate>
        <div class="recipe-form-row">
          <label class="field">
            <span>Who's sharing it</span>
            <input type="text" id="rCook" maxlength="${MAX_COOK}" placeholder="Your name" autocomplete="name">
          </label>
          <label class="field">
            <span>Recipe name</span>
            <input type="text" id="rDish" maxlength="${MAX_DISH}" placeholder="Nan's lemon slice">
          </label>
          <label class="field recipe-serves-field">
            <span>Serves <em>(optional)</em></span>
            <input type="text" id="rServes" maxlength="${MAX_SERVES}" placeholder="8, or a hungry four">
          </label>
        </div>
        <label class="field">
          <span>Ingredients <em>(one per line)</em></span>
          <textarea id="rIngredients" rows="6" maxlength="${MAX_INGREDIENTS}"
            placeholder="2 cups plain flour&#10;1 tsp bicarb&#10;200g butter, softened&#10;¾ cup caster sugar"></textarea>
        </label>
        <label class="field">
          <span>Method</span>
          <textarea id="rMethod" rows="8" maxlength="${MAX_METHOD}"
            placeholder="Step by step — how it actually comes together. Oven temps, the bit everyone gets wrong, all of it."></textarea>
        </label>
        <label class="field">
          <span>The story <em>(optional — a memory, or why this one)</em></span>
          <textarea id="rStory" rows="3" maxlength="${MAX_STORY}"
            placeholder="Made every Christmas Eve since 1994. The secret is not skipping the resting time."></textarea>
        </label>
        <p class="form-error" id="addErr" hidden></p>
        <button class="btn primary big" id="addBtn" type="submit">Add my recipe →</button>
      </form>
    </div>
    <p class="fine">No account — just your name and the recipe. This browser
    remembers which recipes are yours, so you can tweak or pull them back later.</p>
  </section>

  <footer class="page-foot">
    <p><a class="quiet-link" href="/via/recipe">made with biti by bit →</a></p>
  </footer>
</main>

<script>
(function () {
  var slug = ${JSON.stringify(row.slug)};
  var KEY = "bbb:recipe:" + slug;

  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });

  function mine() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveMine(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function cardFor(id) {
    if (!/^\\d+$/.test(String(id))) return null;
    return document.querySelector('.recipe[data-id="' + id + '"]');
  }
  function txt(card, sel) {
    var el = card.querySelector(sel);
    return el ? el.textContent : "";
  }
  function makeField(labelText, tag, value, attrs) {
    var wrap = document.createElement("label");
    wrap.className = "field";
    var span = document.createElement("span");
    span.textContent = labelText;
    var input = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { input.setAttribute(k, attrs[k]); });
    input.value = value;
    wrap.append(span, input);
    return { wrap: wrap, input: input };
  }

  /* ---- your own recipes: badge, edit, remove ---- */
  var list = mine().filter(function (m) { return cardFor(m.id); }); // prune removed ones
  saveMine(list);
  list.forEach(function (m) { enhance(cardFor(m.id), m); });

  function enhance(card, m) {
    var head = card.querySelector(".recipe-head");
    var you = document.createElement("span");
    you.className = "recipe-you";
    you.textContent = "yours";
    head.appendChild(you);

    var actions = document.createElement("div");
    actions.className = "recipe-actions";
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn ghost recipe-mini";
    editBtn.textContent = "Edit";
    var rmBtn = document.createElement("button");
    rmBtn.type = "button";
    rmBtn.className = "btn ghost recipe-mini";
    rmBtn.textContent = "Remove";
    actions.append(editBtn, rmBtn);
    card.appendChild(actions);

    rmBtn.addEventListener("click", function () {
      if (!confirm("Take your recipe out of the book? This can't be undone.")) return;
      fetch("/api/recipe/r/" + m.token + "/remove", { method: "POST" })
        .then(function (r) {
          if (!r.ok && r.status !== 404)
            return r.json().catch(function () { return {}; }).then(function (d) {
              throw new Error(d.error || "That didn't work — try again.");
            });
          saveMine(mine().filter(function (x) { return x.id !== m.id; }));
          location.reload();
        }).catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });

    editBtn.addEventListener("click", function () {
      if (card.querySelector(".recipe-edit")) return; // already open
      openEdit(card, m, actions);
    });
  }

  function openEdit(card, m, actions) {
    var form = document.createElement("form");
    form.className = "recipe-edit";
    form.setAttribute("novalidate", "");

    var row1 = document.createElement("div");
    row1.className = "recipe-form-row";
    var cook = makeField("Who's sharing it", "input", txt(card, ".r-cook"),
      { type: "text", maxlength: "${MAX_COOK}", autocomplete: "name" });
    var dish = makeField("Recipe name", "input", txt(card, ".r-dish"),
      { type: "text", maxlength: "${MAX_DISH}" });
    var serves = makeField("Serves (optional)", "input", txt(card, ".r-serves"),
      { type: "text", maxlength: "${MAX_SERVES}" });
    row1.append(cook.wrap, dish.wrap, serves.wrap);

    var ing = makeField("Ingredients (one per line)", "textarea", txt(card, ".r-ingredients"),
      { rows: "6", maxlength: "${MAX_INGREDIENTS}" });
    var method = makeField("Method", "textarea", txt(card, ".r-method"),
      { rows: "8", maxlength: "${MAX_METHOD}" });
    var story = makeField("The story (optional)", "textarea", txt(card, ".r-story"),
      { rows: "3", maxlength: "${MAX_STORY}" });

    var err = document.createElement("p");
    err.className = "form-error";
    err.hidden = true;

    var btnRow = document.createElement("div");
    btnRow.className = "recipe-form-row recipe-edit-actions";
    var save = document.createElement("button");
    save.type = "submit";
    save.className = "btn primary recipe-mini";
    save.textContent = "Save changes";
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn ghost recipe-mini";
    cancel.textContent = "Cancel";
    btnRow.append(save, cancel);

    form.append(row1, ing.wrap, method.wrap, story.wrap, err, btnRow);
    card.insertBefore(form, actions);

    cancel.addEventListener("click", function () { form.remove(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var payload = {
        cook: cook.input.value.trim(),
        dish: dish.input.value.trim(),
        serves: serves.input.value.trim(),
        ingredients: ing.input.value.trim(),
        method: method.input.value.trim(),
        story: story.input.value.trim(),
      };
      if (!payload.cook) return fail("Whose recipe is this? Add a name.");
      if (!payload.dish) return fail("Give the recipe a name.");
      if (!payload.ingredients) return fail("Add the ingredients.");
      if (!payload.method) return fail("Add the method.");

      save.disabled = true;
      save.textContent = "Saving…";
      fetch("/api/recipe/r/" + m.token + "/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(d.error || "Server said " + r.status + ".");
          location.reload();
        });
      }).catch(function (ex) {
        fail((ex && ex.message) || "That didn't work — try again.");
        save.disabled = false;
        save.textContent = "Save changes";
      });

      function fail(msg) { err.textContent = msg; err.hidden = false; return false; }
    });
  }

  /* ---- add a recipe ---- */
  var addForm = document.getElementById("addForm");
  var addBtn = document.getElementById("addBtn");
  var addErr = document.getElementById("addErr");
  addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    addErr.hidden = true;
    var payload = {
      slug: slug,
      cook: document.getElementById("rCook").value.trim(),
      dish: document.getElementById("rDish").value.trim(),
      serves: document.getElementById("rServes").value.trim(),
      ingredients: document.getElementById("rIngredients").value.trim(),
      method: document.getElementById("rMethod").value.trim(),
      story: document.getElementById("rStory").value.trim(),
    };
    if (!payload.cook) return fail("Whose recipe is this? Add a name.");
    if (!payload.dish) return fail("Give the recipe a name.");
    if (!payload.ingredients) return fail("Add the ingredients — that's half the recipe.");
    if (!payload.method) return fail("Add the method — how's it actually made?");

    addBtn.disabled = true;
    addBtn.textContent = "Adding…";
    fetch("/api/recipe/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "Server said " + r.status + ".");
        var l = mine();
        l.push({ id: d.id, token: d.token });
        saveMine(l);
        location.reload();
      });
    }).catch(function (ex) {
      fail((ex && ex.message) || "That didn't work — try again.");
    });

    function fail(msg) {
      addErr.textContent = msg;
      addErr.hidden = false;
      addBtn.disabled = false;
      addBtn.textContent = "Add my recipe →";
      return false;
    }
  });
})();
</script>`;
  return html(pageShell({ title: row.title || "Recipe Collection", body, shareType: "recipe", shareSlug: row.slug }));
}

/* ---------- organiser page (/e/:token) ---------------------- */

async function editPage(row, env, origin) {
  const data = JSON.parse(row.data);
  const parts = await allRecipes(env, row.id);
  const shareUrl = `${origin}/s/${row.slug}`;

  const body = `
<main class="wrap page">
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with everyone else.
  </div>

  <p class="kicker">Organiser view</p>
  <h1>${esc(row.title)}</h1>
  <p class="page-sub">${subLine(data, parts.length)}</p>
  ${noteBlock(data)}

  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link — everyone adds a recipe</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("📖 We’re putting together a recipe book — add one of yours before it gets bound: " + shareUrl, row.edit_token)}

  <p class="pixel-note">Every recipe below came in through the share link.
  Removing one is permanent, so maybe check with the cook first. When the
  book's full, hit <strong>Print the book</strong> for a paper copy — the
  print view is just the recipes, no buttons.</p>

  <div class="recipe-toolbar">
    <button class="btn" id="printBtn" type="button">Print the book</button>
    <a class="btn ghost" href="/s/${esc(row.slug)}">Open the shared book</a>
  </div>

  ${book(parts, "org")}

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared book</a>
    <button class="btn danger" id="deleteBtn" type="button">Delete this book</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>

  <footer class="page-foot">
    <p class="fine">To add a recipe of your own, use the shared link like everyone
    else. Removing a recipe is permanent — there's no undo. Deleting the whole
    book is permanent too: both links stop working immediately.</p>
  </footer>
</main>

<script>
(function () {
  var token = ${JSON.stringify(row.edit_token)};
  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
  document.getElementById("copyBtn").addEventListener("click", function () {
    var input = document.getElementById("shareUrl");
    input.select();
    navigator.clipboard.writeText(input.value).then(function () {
      var b = document.getElementById("copyBtn");
      b.textContent = "Copied";
      setTimeout(function () { b.textContent = "Copy"; }, 1500);
    });
  });
  document.querySelectorAll(".recipe-org-remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!confirm("Remove this recipe from the book? This can't be undone.")) return;
      fetch("/api/recipe/" + token + "/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rtoken: btn.getAttribute("data-rtoken") }),
      }).then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.reload(); })
        .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
    });
  });
  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (!confirm("Delete this recipe book for good? Every recipe goes with it and both links stop working.")) return;
    fetch("/api/recipe/" + token + "/delete", { method: "POST" })
      .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || "That didn't work — try again."); }); location.href = ${JSON.stringify(HOME)}; })
      .catch(function (e) { alert((e && e.message) || "That didn't work — try again."); });
  });
})();
</script>`;
  return html(pageShell({ title: `${row.title || "Recipe Collection"} (organiser)`, body }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "recipe",

  async api(request, env, url) {
    const p = url.pathname;
    if (request.method !== "POST" || !p.startsWith("/api/recipe")) return null;
    if (p === "/api/recipe") return create(request, env);
    if (p === "/api/recipe/add") return add(request, env);
    let m;
    if ((m = p.match(/^\/api\/recipe\/r\/([a-z0-9]+)\/(save|remove)$/)))
      return m[2] === "save" ? saveRecipe(m[1], request, env) : removeOwn(m[1], env);
    if ((m = p.match(/^\/api\/recipe\/([a-z0-9]+)\/(remove|delete)$/)))
      return m[2] === "remove" ? orgRemove(m[1], request, env) : orgDelete(m[1], env);
    return null;
  },

  publicPage: (row, env) => publicPage(row, env),
  editPage: (row, env, url) => editPage(row, env, url.origin),
};
