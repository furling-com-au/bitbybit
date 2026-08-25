/* ============================================================
   Seed one worked example per tool.
   Run:  node scripts/seed-demos.mjs [--remote]

   Every tool page links to an example so somebody can see what the
   thing produces before typing anything. The examples are REAL
   instances driven through the REAL API — created, then claimed and
   voted on exactly as a person would — so an example can never show
   something the tool no longer does.

   Each one is then moved to a predictable slug, demo-<tool>, which is
   what the worker matches on to refuse writes and to add the "this is
   an example" banner.

   Idempotent: existing demos are deleted and rebuilt, so re-running
   this refreshes them. Worth doing after changing a tool's output.
   ============================================================ */
import { execSync } from "node:child_process";

const REMOTE = process.argv.includes("--remote");
/* --only=demo-a,demo-b rebuilds just those. Creates are rate limited to
   20 per IP per hour, so a full re-run to repair one demo is not free. */
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7)
  .split(",").map((x) => x.trim()).filter(Boolean);
const BASE = REMOTE ? "https://bitibybit.com" : "http://localhost:8787";

/* The SQL below only ever uses single quotes for literals, so wrapping
   the whole --command value in double quotes is safe and sidesteps the
   argument mangling that shell-quoting on Windows otherwise causes. */
function sql(statement) {
  // The whole statement is passed as one double-quoted --command argument,
  // so it must contain neither double quotes nor newlines: a newline is
  // silently truncated by the shell rather than reported, which once cost
  // two rounds of debugging a seed that reported success.
  if (statement.includes('"')) throw new Error("seed SQL must not contain double quotes");
  if (/[\r\n]/.test(statement)) throw new Error("seed SQL must be a single line: " + statement.slice(0, 60));
  const cmd = `npx wrangler d1 execute bitbybit ${REMOTE ? "--remote" : "--local"} --command "${statement}" --json`;
  // Called in a tight loop, wrangler intermittently dies inside libuv
  // ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"). That is a
  // transient failure of the CLI, not of the statement, so retry it.
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return JSON.parse(out)[0].results;
    } catch (e) {
      last = String(e.stderr || e.message);
      if (!/UV_HANDLE_CLOSING|Assertion failed/.test(last)) break;
    }
  }
  throw new Error(`SQL failed: ${statement.slice(0, 70)} :: ${last.slice(0, 160)}`);
}

/** Read an instance's stored data — poll option ids are generated, so
    a vote has to be cast against the ids the tool actually made. */
function dataOf(slug) {
  const rows = sql(`SELECT data FROM instances WHERE slug = '${slug}'`);
  try { return JSON.parse(rows[0].data); } catch { return null; }
}

/* Remove an instance and everything hanging off it. Used to clean up after a
   half-finished seed: a create that succeeded followed by a step that did not
   leaves a real-looking instance behind, which then shows up in the "has anyone
   actually used this?" count and is indistinguishable from a genuine user. */
function purge(slug) {
  const rows = sql(`SELECT id FROM instances WHERE slug = '${slug}'`);
  if (!rows.length) return;
  const id = rows[0].id;
  for (const t of ["claims", "participants", "events"])
    sql(`DELETE FROM ${t} WHERE instance_id = ${id}`);
  sql(`DELETE FROM instances WHERE id = ${id}`);
}

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const text = await r.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* non-JSON error page */ }
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${text.slice(0, 120)}`);
  return data;
}

/* Realistic content. A demo full of "Person 1, Person 2" teaches
   nobody anything — these read like a real office so the example
   does the explaining. */
const TEAM = ["Priya", "Tom H", "Meredith", "Jules", "Sam N", "Alex", "Bec", "Dev"];

const DEMOS = [
  {
    tool: "sweeps", slug: "demo-grand-final-sweep",
    body: { title: "Level 3 Grand Final sweep", kind: "gf", names: TEAM,
      outcomes: ["1–6 points", "7–12 points", "13–24 points", "25–39 points", "40+ points", "Draw", "Under 1 point", "Golden point"] },
  },
  {
    // The page itself ships "Horse 1..24" prefilled — the real field is not
    // known until the barrier draw, so the example says the same thing.
    tool: "sweeps", slug: "demo-melbourne-cup-sweep",
    body: { title: "Melbourne Cup sweep — the office", kind: "cup",
      names: TEAM, outcomes: ["Horse 1", "Horse 2", "Horse 3", "Horse 4", "Horse 5", "Horse 6", "Horse 7", "Horse 8", "Horse 9", "Horse 10", "Horse 11", "Horse 12", "Horse 13", "Horse 14", "Horse 15", "Horse 16", "Horse 17", "Horse 18", "Horse 19", "Horse 20", "Horse 21", "Horse 22", "Horse 23", "Horse 24"] },
  },
  {
    tool: "kringle", slug: "demo-kris-kringle",
    body: { title: "Accounts team Kris Kringle", names: TEAM, budget: "$30", exchangeDate: "Friday 19 December" },
    after: async (d) => { await post("/api/kringle/claim", { slug: d.slug, name: "Priya" }); },
  },
  {
    tool: "roles", slug: "demo-secret-role-dealer",
    body: { title: "Werewolf at the Christmas party", roles: ["Werewolf", "Werewolf", "Seer", "Doctor", "Villager", "Villager", "Villager", "Villager"] },
    after: async (d) => { await post("/api/roles/claim", { slug: d.slug, name: "Tom H" }); },
  },
  {
    tool: "plate", slug: "demo-bring-a-plate",
    body: { title: "Friday arvo team lunch", eventDate: "Friday 12 September, 12:30pm",
      categories: [{ name: "Mains", capacity: 3 }, { name: "Salads", capacity: 3 }, { name: "Desserts", capacity: 2 }, { name: "Drinks", capacity: 2 }] },
    after: async (d) => {
      await post("/api/plate/claim", { slug: d.slug, slotId: "c0-1", name: "Meredith", dish: "Lasagne, feeds ten" });
      await post("/api/plate/claim", { slug: d.slug, slotId: "c1-1", name: "Jules", dish: "Greek salad" });
      await post("/api/plate/claim", { slug: d.slug, slotId: "c2-1", name: "Priya", dish: "Pav, obviously" });
    },
  },
  {
    tool: "bracket", slug: "demo-tournament-bracket",
    body: { title: "Office table tennis cup", entrants: ["Priya", "Tom H", "Meredith", "Jules", "Sam N", "Alex", "Bec"] },
  },
  {
    tool: "card", slug: "demo-group-card",
    body: { recipient: "Marcus", occasion: "farewell", note: "Marcus is off to Perth after nine years. Sign before Thursday." },
    after: async (d) => {
      await post("/api/card/sign", { slug: d.slug, name: "Priya", message: "Nine years and you never once took the last coffee without making a fresh pot. Legend." });
      await post("/api/card/sign", { slug: d.slug, name: "Tom H", message: "Perth's lucky to have you. Don't forget us when you're on the beach." });
      await post("/api/card/sign", { slug: d.slug, name: "Bec", message: "Thanks for teaching me the reconciliation properly instead of just fixing it for me." });
    },
  },
  {
    tool: "meal", slug: "demo-meal-train",
    body: { forWhom: "the Brennan family", allergies: "No nuts — youngest is anaphylactic",
      note: "Something freezable is a godsend. Esky on the porch, no need to knock.",
      dropoff: "12 Wattle St", startDate: "2026-09-01", days: 8, capacityPerDay: 1,
      tasks: [{ label: "Walk Ruby — weekday evenings", capacity: 2 }, { label: "School pickup, Tuesdays", capacity: 1 }] },
    after: async (d) => {
      await post("/api/meal/claim", { slug: d.slug, slotId: "d0-1", name: "Meredith", dish: "Lamb curry, freezable" });
      await post("/api/meal/claim", { slug: d.slug, slotId: "d2-1", name: "Alex", dish: "Shepherd's pie" });
      await post("/api/meal/claim", { slug: d.slug, slotId: "t1-1", name: "Priya", dish: "Happy to do Mon and Wed" });
    },
  },
  {
    tool: "roster", slug: "demo-volunteer-roster",
    body: { title: "Warrnambool Primary fete — sausage sizzle", eventDate: "Saturday 14 March",
      shifts: [{ label: "Set up 8:00–9:00am", capacity: 3 }, { label: "Grill 9:00–11:00am", capacity: 3 }, { label: "Grill 11:00am–1:00pm", capacity: 3 }, { label: "Pack down 1:00–2:00pm", capacity: 3 }] },
    after: async (d) => {
      await post("/api/roster/claim", { slug: d.slug, slotId: "s0-1", name: "Tom H" });
      await post("/api/roster/claim", { slug: d.slug, slotId: "s1-1", name: "Priya" });
      await post("/api/roster/claim", { slug: d.slug, slotId: "s1-2", name: "Bec" });
    },
  },
  {
    tool: "poll", slug: "demo-group-vote",
    body: { question: "Where should we do the team Christmas lunch?",
      options: ["The Italian place on Rundle", "Thai, like last year", "Pub schnitzel", "Somebody's backyard"] },
    after: async (d) => {
      const ids = (dataOf(d.slug) || { options: [] }).options.map((o) => o.id);
      for (const i of [0, 0, 0, 1, 1, 2, 3, 0, 1])
        if (ids[i]) await post("/api/poll/vote", { slug: d.slug, choices: [ids[i]] });
    },
  },
  {
    tool: "qotd", slug: "demo-question-of-the-day",
    body: { teamName: "Level 3 Finance" },
    /* A question-of-the-day on day one shows nothing, and the archive is
       the point of the tool. The day number comes from data.createdDay
       (which wins over the created_at column — see createdDayOf), so
       walking that back one day at a time and voting after each shift
       builds a real week: every vote goes through the live code path and
       picks up whichever question the tool itself chose for that day. */
    after: async (d) => {
      const week = [["a","a","b","a","a"], ["b","b","a","b"], ["a","b","b","a","b","b"],
                    ["a","a","a","b"], ["b","a","b","b","a"], ["a","a","b","a","a","a"],
                    ["b","a","a"]];
      for (let i = 0; i < week.length; i++) {
        for (const c of week[i]) await post("/api/qotd/vote", { slug: d.slug, choice: c });
        if (i < week.length - 1)
          sql(`UPDATE instances SET data = json_set(data, '$.createdDay', date(json_extract(data, '$.createdDay'), '-1 day')) WHERE slug = '${d.slug}'`);
      }
    },
  },
  {
    tool: "coffee", slug: "demo-coffee-roulette",
    body: { title: "Product team coffee", names: TEAM, cadence: "Every second Monday",
      note: "Twenty minutes, on you, anywhere you like. A walk counts." },
    after: async (d) => { await post("/api/coffee/claim", { slug: d.slug, name: "Priya" }); },
  },
  {
    tool: "kudos", slug: "demo-kudos-wall",
    body: { team: "Platform team", intro: "Anything worth noticing. We read them out on Monday." },
    after: async (d) => {
      await post("/api/kudos/post", { slug: d.slug, to: "Meredith", from: "Tom H", message: "Stayed back to get the release out and never mentioned it." });
      await post("/api/kudos/post", { slug: d.slug, to: "Jules", from: "Priya", message: "Explained the deploy pipeline for the fourth time without sighing once." });
      await post("/api/kudos/post", { slug: d.slug, to: "Sam N", from: "Bec", message: "Covered my on-call at zero notice so I could get to the school concert." });
    },
  },
  {
    tool: "fact", slug: "demo-fact-matcher",
    body: { title: "New starters icebreaker", names: ["Priya", "Tom H", "Meredith", "Jules", "Sam N", "Alex"] },
    after: async (d) => {
      await post("/api/fact/submit", { slug: d.slug, name: "Priya", fact: "I once played bass in a wedding band for a whole summer." });
      await post("/api/fact/submit", { slug: d.slug, name: "Tom H", fact: "I have read the entire Wikipedia article on shipping containers. Twice." });
      await post("/api/fact/submit", { slug: d.slug, name: "Meredith", fact: "I can name every Melbourne Cup winner since 1990." });
    },
  },
  {
    tool: "baby", slug: "demo-baby-guess-pool",
    body: { parents: "Emma & Josh", dueDate: "2026-11-14" },
    after: async (d) => {
      await post("/api/baby/guess", { slug: d.slug, guesser: "Priya", date: "2026-11-12", weightGrams: 3400, message: "Early and impatient, like her mum." });
      await post("/api/baby/guess", { slug: d.slug, guesser: "Tom H", date: "2026-11-18", weightGrams: 3750, message: "Overdue. They always are." });
      await post("/api/baby/guess", { slug: d.slug, guesser: "Bec", date: "2026-11-14", weightGrams: 3200, message: "Bang on the due date, watch." });
    },
  },
  {
    tool: "giftidea", slug: "demo-gift-ideas",
    body: { recipient: "Dave from the warehouse", occasion: "retirement", budget: "$20 each" },
    after: async (d) => {
      await post("/api/giftidea/suggest", { slug: d.slug, name: "Priya", idea: "Decent esky — he's talked about the fishing trip for a year" });
      await post("/api/giftidea/suggest", { slug: d.slug, name: "Tom H", idea: "Framed photo of the old loading dock crew" });
      await post("/api/giftidea/suggest", { slug: d.slug, name: "Bec", idea: "Bunnings voucher, unromantic but he'd actually use it" });
    },
  },
  {
    tool: "recipe", slug: "demo-recipe-collection",
    body: { title: "Sharon's farewell recipe book", note: "One recipe each. The ones you actually cook, not the ones you mean to." },
    after: async (d) => {
      await post("/api/recipe/add", { slug: d.slug, cook: "Meredith", dish: "Nan's ANZAC biscuits", serves: "Makes about 24",
        ingredients: "1 cup rolled oats\n1 cup plain flour\n1 cup brown sugar\n125g butter\n2 tbsp golden syrup\n1 tsp bicarb",
        method: "Heat the oven to 160C.\nMelt the butter and golden syrup.\nStir the bicarb into a tablespoon of boiling water and add it.\nMix through the dry ingredients.\nRoll into balls, flatten, bake 15 minutes.",
        story: "Take them out while they still look underdone. They set as they cool and Nan was very firm about this." });
      await post("/api/recipe/add", { slug: d.slug, cook: "Alex", dish: "Weeknight dhal", serves: "Serves 4",
        ingredients: "1 cup red lentils\n1 tin chopped tomatoes\n1 onion\n3 cloves garlic\n2 tsp cumin\n1 tsp turmeric",
        method: "Fry the onion and garlic.\nAdd the spices and cook a minute.\nAdd lentils and tomatoes, plus two cups of water.\nSimmer 25 minutes until it collapses.",
        story: "More cumin than feels sensible is the whole trick." });
    },
  },
  {
    tool: "hens", slug: "demo-hens-planner",
    body: { title: "Mia's hens weekend", eventDate: "Saturday 8 November",
      categories: [{ name: "Decorations", capacity: 2 }, { name: "Cake", capacity: 1 }, { name: "Drinks", capacity: 2 }, { name: "Games", capacity: 2 }] },
    after: async (d) => {
      await post("/api/hens/claim", { slug: d.slug, slotId: "c0-1", name: "Priya", note: "Bunting and balloons" });
      await post("/api/hens/claim", { slug: d.slug, slotId: "c1-1", name: "Bec", note: "Doing the cake myself" });
    },
  },
  {
    tool: "registry", slug: "demo-gift-registry",
    body: { coupleNames: "Sam & Alex", payId: "sam.nguyen@example.com", accountName: "S & A Nguyen",
      bsb: "083-004", accountNumber: "123456789", note: "No boxed gifts — we're saving for the Prado." },
    after: async (d) => {
      await post("/api/registry/claim", { slug: d.slug, slotId: "engine-block", name: "Meredith", message: "Congratulations both!" });
      // Without these the build-crew wall reads "No one on the tools yet",
      // which is the one part of this tool people ask how it looks.
      await post("/api/registry/contribute", { slug: d.slug, name: "Tom H", cents: 15000, message: "For the roof rack. Have a good one." });
      await post("/api/registry/contribute", { slug: d.slug, name: "Priya & Dev", cents: 25000, message: "Congratulations you two!" });
      await post("/api/registry/contribute", { slug: d.slug, name: "The Wilsons", cents: 5000, message: "" });
    },
  },
  {
    /* Seeded mid-round and REVEALED, because a face-down table teaches
       nobody anything — the example has to show the spread and the
       verdict, which is the whole point of the tool. */
    tool: "poker", slug: "demo-scrum-poker",
    body: { team: "Platform team", story: "Search results pagination", deck: "fib" },
    after: async (d) => {
      const cards = [["Priya","3"],["Tom H","5"],["Meredith","13"],["Jules","5"],["Sam N","5"],["Alex","?"]];
      for (const [name, card] of cards)
        await post("/api/poker/vote", { slug: d.slug, card, name });
      const tok = sql(`SELECT edit_token FROM instances WHERE slug = '${d.slug}'`)[0].edit_token;
      await post(`/api/poker/${tok}/reveal`, {});
    },
  },
  {
    tool: "pulse", slug: "demo-weekly-pulse",
    body: { team: "Platform team", question: "How was your week?", askWords: true },
    after: async (d) => {
      const rs = [[4, "busy but good"], [5, "good week"], [3, "busy and steady"], [4, "steady and good"], [2, "flat out"], [5, "good one"]];
      for (const [score, comment] of rs) await post("/api/pulse/respond", { slug: d.slug, score, comment });
    },
  },
];

/* ---------- run ---------------------------------------------- */

const wanted = ONLY.length ? DEMOS.filter((d) => ONLY.includes(d.slug)) : DEMOS;
if (ONLY.length && wanted.length !== ONLY.length)
  throw new Error("--only names a slug that is not in DEMOS: " +
    ONLY.filter((x) => !DEMOS.some((d) => d.slug === x)).join(", "));

console.log(`seeding ${wanted.length} examples against ${BASE}\n`);

// Clear out previous demos so this is safe to re-run. With --only, clear
// only the named ones — the rest are still good and re-creating them
// would spend the hourly create budget for nothing.
const filter = ONLY.length
  ? `slug IN (${ONLY.map((x) => `'${x}'`).join(",")})`
  : "slug LIKE 'demo-%'";
const existing = sql(`SELECT id, slug FROM instances WHERE ${filter}`);
if (existing.length) {
  const ids = existing.map((r) => r.id).join(",");
  sql(`DELETE FROM claims WHERE instance_id IN (${ids})`);
  sql(`DELETE FROM participants WHERE instance_id IN (${ids})`);
  sql(`DELETE FROM events WHERE instance_id IN (${ids})`);
  sql(`DELETE FROM instances WHERE id IN (${ids})`);
  console.log(`  cleared ${existing.length} previous examples\n`);
}

let ok = 0;
for (const d of wanted) {
  let made = null;
  try {
    made = await post(`/api/${d.tool}`, d.body);
    // Populate through the real API, while it still has its random slug.
    if (d.after) await d.after({ slug: made.slug, editToken: made.editToken });
    // Then move it to the predictable slug the worker recognises.
    sql(`UPDATE instances SET slug = '${d.slug}' WHERE slug = '${made.slug}'`);
    made = null; // adopted — no longer an orphan
    console.log(`  ${d.slug}`);
    ok++;
  } catch (e) {
    console.log(`  FAILED ${d.slug}: ${e.message}`);
    if (made && made.slug) {
      try {
        purge(made.slug);
        console.log(`         cleaned up the half-made instance`);
      } catch (e2) {
        console.log(`         !! ORPHAN LEFT IN THE TABLE: ${made.slug} (${e2.message})`);
        console.log(`         !! it will look like a real user's instance — remove it`);
      }
    }
  }
}
console.log(`\n${ok}/${wanted.length} examples seeded.`);
