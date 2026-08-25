/* ============================================================
   Pixel Gift Registry — the flagship. A gift registry drawn as
   the thing itself: guests claim parts of a pixel-art Toyota
   Prado and the picture paints itself in as parts get claimed.

   The Worker stays thin: pages render a shell plus a JSON
   bootstrap, then /registry-prado.js (renderer + parts data)
   and /registry-view.js (all behaviour) do the work client-side.
   Claims ride the `claims` table: UNIQUE(instance_id, slot_id)
   is the race protection, same as Bring a Plate.

   The parts list below is the source of truth for PRICES — a
   claim is priced from this table, never from the client. The
   display copy is duplicated in public/registry-prado.js; the
   two lists must stay identical.
   ============================================================ */
import {
  esc, json, html, randomString, badInput, pageShell,
  getBySlug, getByToken, createInstance, deleteInstance, logEvent, shareNudge,
} from "../lib.js";

const MAX_COUPLE = 80;
const MAX_TAGLINE = 140;
const MAX_DATE = 60;
const MAX_NAME = 60;
const MAX_MESSAGE = 240;
const MAX_OVERFLOW_TITLE = 60;
const MIN_CONTRIB_CENTS = 500;     // $5
const MAX_CONTRIB_CENTS = 200000;  // $2,000

const DEFAULT_OVERFLOW_TITLE = "Fuel & rego for the first year";

const NOUNS = ["snorkel", "bullbar", "roofrack", "winch", "esky",
  "spotlight", "tyre", "corrugation", "dune", "campfire"];

const HOME = "/gift-registry/";

/* ---------- the parts list (subject: "prado") ----------------
   Ported from the prototype: 8 groups, 126 slots, exactly
   $25,000.00 AUD. Prices in cents. Creators can't edit parts
   in v1 — the parts list is the craft. */

const GROUPS = [
  { id: "engine", name: "Engine & Drivetrain" },
  { id: "chassis", name: "Chassis & Suspension" },
  { id: "wheels", name: "Wheels & Tyres" },
  { id: "body", name: "Body & Panels" },
  { id: "interior", name: "Interior & Cabin" },
  { id: "electrical", name: "Lights & Electrical" },
  { id: "touring", name: "Touring & 4WD Gear" },
  { id: "luxuries", name: "Little Luxuries" },
];

const PARTS = [
  /* --- ENGINE & DRIVETRAIN — $5,000 / 10 slots --------------- */
  { id: "engine-block", group: "engine", name: "Engine Block", cents: 120000, qty: 1 },
  { id: "gearbox", group: "engine", name: "Gearbox", cents: 90000, qty: 1 },
  { id: "turbo", group: "engine", name: "Turbocharger", cents: 65000, qty: 1 },
  { id: "transfer-case", group: "engine", name: "Transfer Case", cents: 50000, qty: 1 },
  { id: "front-diff", group: "engine", name: "Front Diff", cents: 40000, qty: 1 },
  { id: "rear-diff", group: "engine", name: "Rear Diff", cents: 40000, qty: 1 },
  { id: "fuel-tank", group: "engine", name: "Fuel Tank", cents: 30000, qty: 1 },
  { id: "radiator", group: "engine", name: "Radiator", cents: 25000, qty: 1 },
  { id: "exhaust", group: "engine", name: "Exhaust System", cents: 22000, qty: 1 },
  { id: "battery", group: "engine", name: "Cranking Battery", cents: 18000, qty: 1 },

  /* --- CHASSIS & SUSPENSION — $3,500 / 16 slots -------------- */
  { id: "chassis-rail", group: "chassis", name: "Chassis Rail", cents: 60000, qty: 2 },
  { id: "shock", group: "chassis", name: "Shock Absorber", cents: 17500, qty: 4 },
  { id: "steering-rack", group: "chassis", name: "Steering Rack", cents: 35000, qty: 1 },
  { id: "brake-caliper", group: "chassis", name: "Brake Caliper", cents: 12500, qty: 4 },
  { id: "front-coil", group: "chassis", name: "Front Coil Spring", cents: 15000, qty: 2 },
  { id: "rear-coil", group: "chassis", name: "Rear Coil Spring", cents: 15000, qty: 2 },
  { id: "handbrake", group: "chassis", name: "Handbrake", cents: 15000, qty: 1 },

  /* --- WHEELS & TYRES — $2,500 / 10 slots -------------------- */
  { id: "tyre", group: "wheels", name: "All-Terrain Tyre", cents: 32000, qty: 5 },
  { id: "wheel", group: "wheels", name: "Alloy Wheel", cents: 18000, qty: 5 },

  /* --- BODY & PANELS — $3,500 / 16 slots --------------------- */
  { id: "roof-panel", group: "body", name: "Roof Panel", cents: 35000, qty: 1 },
  { id: "bonnet", group: "body", name: "Bonnet", cents: 40000, qty: 1 },
  { id: "tailgate", group: "body", name: "Tailgate", cents: 38000, qty: 1 },
  { id: "windscreen", group: "body", name: "Windscreen", cents: 35000, qty: 1 },
  { id: "front-door", group: "body", name: "Front Door", cents: 30000, qty: 2 },
  { id: "rear-door", group: "body", name: "Rear Door", cents: 26000, qty: 2 },
  { id: "guard", group: "body", name: "Front Guard", cents: 20000, qty: 2 },
  { id: "side-window", group: "body", name: "Side Window", cents: 7500, qty: 4 },
  { id: "mirror", group: "body", name: "Side Mirror", cents: 10000, qty: 2 },

  /* --- INTERIOR & CABIN — $3,000 / 18 slots ------------------ */
  { id: "driver-seat", group: "interior", name: "Driver's Seat", cents: 45000, qty: 1 },
  { id: "passenger-seat", group: "interior", name: "Passenger Seat", cents: 40000, qty: 1 },
  { id: "rear-bench", group: "interior", name: "Rear Bench Seat", cents: 35000, qty: 1 },
  { id: "third-row", group: "interior", name: "Third Row Seat", cents: 17500, qty: 2 },
  { id: "steering-wheel", group: "interior", name: "Steering Wheel", cents: 30000, qty: 1 },
  { id: "aircon", group: "interior", name: "Air Con Unit", cents: 30000, qty: 1 },
  { id: "dashboard", group: "interior", name: "Dashboard", cents: 28000, qty: 1 },
  { id: "stereo", group: "interior", name: "Stereo & Speakers", cents: 22000, qty: 1 },
  { id: "floor-mat", group: "interior", name: "Floor Mat", cents: 4000, qty: 4 },
  { id: "rear-mirror", group: "interior", name: "Rear View Mirror", cents: 5000, qty: 1 },
  { id: "gear-knob", group: "interior", name: "Gear Knob", cents: 4000, qty: 1 },
  { id: "seatbelt", group: "interior", name: "Seatbelt Set", cents: 4000, qty: 1 },
  { id: "cup-holder", group: "interior", name: "Cup Holder", cents: 3000, qty: 2 },

  /* --- LIGHTS & ELECTRICAL — $1,500 / 12 slots --------------- */
  { id: "wiring-loom", group: "electrical", name: "Wiring Loom", cents: 30000, qty: 1 },
  { id: "alternator", group: "electrical", name: "Alternator", cents: 25000, qty: 1 },
  { id: "reverse-camera", group: "electrical", name: "Reverse Camera", cents: 18000, qty: 1 },
  { id: "headlight", group: "electrical", name: "Headlight", cents: 17500, qty: 2 },
  { id: "tail-light", group: "electrical", name: "Tail Light", cents: 11000, qty: 2 },
  { id: "horn", group: "electrical", name: "Horn", cents: 6000, qty: 1 },
  { id: "indicator", group: "electrical", name: "Indicator", cents: 3500, qty: 4 },

  /* --- TOURING & 4WD GEAR — $4,500 / 14 slots ---------------- */
  { id: "rooftop-tent", group: "touring", name: "Rooftop Tent", cents: 70000, qty: 1 },
  { id: "bull-bar", group: "touring", name: "Bull Bar", cents: 60000, qty: 1 },
  { id: "winch", group: "touring", name: "Winch", cents: 50000, qty: 1 },
  { id: "fridge", group: "touring", name: "12V Fridge", cents: 45000, qty: 1 },
  { id: "roof-rack", group: "touring", name: "Roof Rack", cents: 45000, qty: 1 },
  { id: "dual-battery", group: "touring", name: "Dual Battery System", cents: 40000, qty: 1 },
  { id: "snorkel", group: "touring", name: "Snorkel", cents: 35000, qty: 1 },
  { id: "awning", group: "touring", name: "Awning", cents: 25000, qty: 1 },
  { id: "uhf", group: "touring", name: "UHF Radio", cents: 20000, qty: 1 },
  { id: "driving-light", group: "touring", name: "Driving Light", cents: 15000, qty: 2 },
  { id: "recovery-track", group: "touring", name: "Recovery Track", cents: 12500, qty: 2 },
  { id: "snatch-strap", group: "touring", name: "Snatch Strap", cents: 5000, qty: 1 },

  /* --- LITTLE LUXURIES — $1,500 / 30 slots ------------------- */
  { id: "cargo-barrier", group: "luxuries", name: "Cargo Barrier", cents: 18000, qty: 1 },
  { id: "dash-cam", group: "luxuries", name: "Dash Cam", cents: 16000, qty: 1 },
  { id: "toolkit", group: "luxuries", name: "Toolkit", cents: 12000, qty: 1 },
  { id: "bonnet-protector", group: "luxuries", name: "Bonnet Protector", cents: 9000, qty: 1 },
  { id: "esky", group: "luxuries", name: "Esky", cents: 8000, qty: 1 },
  { id: "roadside-kit", group: "luxuries", name: "Roadside Kit", cents: 7500, qty: 1 },
  { id: "first-aid", group: "luxuries", name: "First Aid Kit", cents: 6000, qty: 1 },
  { id: "extinguisher", group: "luxuries", name: "Fire Extinguisher", cents: 5000, qty: 1 },
  { id: "diesel", group: "luxuries", name: "Tank of Diesel", cents: 4000, qty: 4 },
  { id: "car-wash", group: "luxuries", name: "Car Wash Kit", cents: 4500, qty: 1 },
  { id: "jerry-can", group: "luxuries", name: "Jerry Can", cents: 4500, qty: 2 },
  { id: "number-plate", group: "luxuries", name: "Number Plate", cents: 4000, qty: 2 },
  { id: "tyre-gauge", group: "luxuries", name: "Tyre Pressure Gauge", cents: 3500, qty: 1 },
  { id: "wiper", group: "luxuries", name: "Wiper Blade", cents: 3000, qty: 2 },
  { id: "torch", group: "luxuries", name: "Torch", cents: 3000, qty: 1 },
  { id: "mud-flap", group: "luxuries", name: "Mud Flap", cents: 2500, qty: 4 },
  { id: "sunshade", group: "luxuries", name: "Windscreen Sunshade", cents: 2500, qty: 1 },
  { id: "air-freshener", group: "luxuries", name: "Air Freshener", cents: 1500, qty: 4 },
];

/* Expand parts into individual claimable slots — slot ids match
   the client exactly: "front-door-1", "front-door-2", "bonnet". */
const SLOT_CENTS = (() => {
  const map = new Map();
  for (const part of PARTS) {
    for (let i = 1; i <= part.qty; i++)
      map.set(part.qty > 1 ? `${part.id}-${i}` : part.id, part.cents);
  }
  return map;
})();

const SLOT_COUNT = SLOT_CENTS.size;       // 126
const GRAND_TOTAL = [...SLOT_CENTS.values()].reduce((n, c) => n + c, 0); // 2500000

/* ---------- the reference code -------------------------------
   A short payment reference someone can type into a banking app.
   Strictly A-Z0-9 and one hyphen — banks reject a lot of
   punctuation, and "Sam & Alex" must not leak an ampersand into
   the reference. */

/* The builder prefills a method string; without any actual details it
   would render a lonely "Method: PayID / Bank transfer" row above the
   "no payment details" note. Store nothing unless something real was given. */
function hasRealDetails(p) {
  return !!(String(p.payId || "").trim() || String(p.accountName || "").trim() ||
    String(p.bsb || "").trim() || String(p.accountNumber || "").trim());
}

function reference(slotId, name) {
  // A random tail so a reference can't be reconstructed from the
  // public claims listing — the base stays human-readable.
  return referenceBase(slotId, name) + randomString(3, "abcdefghjkmnpqrstuvwxyz23456789").toUpperCase();
}
function referenceBase(slotId, name) {
  const initials =
    String(name || "")
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("") || "XX";

  // Keep the head and the tail so "front-door-1" and "front-door-2"
  // stay distinguishable after truncation.
  let tag = slotId.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (tag.length > 8) tag = tag.slice(0, 6) + tag.slice(-2);

  return `${tag}-${initials}`;
}

/* ---------- validation -------------------------------------- */

const clean = (v, max) =>
  String(v || "").trim().replace(/\s+/g, " ").slice(0, max);

function parseCreate(body) {
  const coupleNames = clean(body.coupleNames, MAX_COUPLE);
  if (!coupleNames) throw badInput("Add your names — it's your registry.");

  const p = body.payment && typeof body.payment === "object" ? body.payment : {};
  return {
    coupleNames,
    tagline: clean(body.tagline, MAX_TAGLINE),
    weddingDate: clean(body.weddingDate, MAX_DATE),
    subject: "prado",
    payment: hasRealDetails(p) ? {
      method: clean(p.method, 40),
      payId: clean(p.payId, 80),
      accountName: clean(p.accountName, 80),
      bsb: clean(p.bsb, 10),
      accountNumber: clean(p.accountNumber, 20),
      note: clean(p.note, 200),
    } : { method: "", payId: "", accountName: "", bsb: "", accountNumber: "", note: "" },
    overflowTitle: clean(body.overflowTitle, MAX_OVERFLOW_TITLE) || DEFAULT_OVERFLOW_TITLE,
  };
}

/* ---------- api --------------------------------------------- */

async function create(request, env) {
  const data = parseCreate(await request.json().catch(() => ({})));
  const { id, slug, editToken } = await createInstance(env, {
    toolType: "registry",
    title: data.coupleNames,
    data: JSON.stringify(data),
    nouns: NOUNS,
  });
  await logEvent(env, id, "registry", "created");
  return json({ slug, editToken }, 201);
}

/* Public read: no refs, no paid flags — references stay
   semi-private between the couple and each guest. */
async function listClaims(slug, env) {
  const row = await getBySlug(env, slug);
  if (!row || row.tool_type !== "registry") return json({ error: "not found" }, 404);
  const rows = (await env.DB.prepare(
    `SELECT slot_id, name, message, cents, created_at FROM claims
     WHERE instance_id = ? ORDER BY created_at DESC, rowid DESC`
  ).bind(row.id).all()).results;
  return json({
    claims: rows.map((r) => ({
      slotId: r.slot_id, name: r.name, message: r.message,
      cents: r.cents, at: r.created_at,
    })),
  });
}

async function claim(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "registry") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);

  const slotId = String(body.slotId || "");
  if (!SLOT_CENTS.has(slotId))
    throw badInput("That part isn't on this build sheet.");
  const cents = SLOT_CENTS.get(slotId); // priced server-side, never from the client

  const name = clean(body.name, MAX_NAME);
  const message = String(body.message || "").trim().slice(0, MAX_MESSAGE);
  if (!name) throw badInput("Add your name — it goes on the build crew wall.");

  const ref = reference(slotId, name);
  try {
    // UNIQUE(instance_id, slot_id) makes this atomic: whoever inserts
    // first wins, the other gets a constraint violation.
    await env.DB.prepare(
      `INSERT INTO claims (instance_id, slot_id, name, message, cents, ref, paid, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    ).bind(row.id, slotId, name, message, cents, ref, new Date().toISOString()).run();
  } catch (e) {
    if (/UNIQUE/.test(String(e)))
      return json({ error: "Someone beat you to that one by a whisker." }, 409);
    throw e;
  }
  return json({ ref, cents, payment: data.payment }, 201);
}

/* The overflow patch: an uncapped extra item so latecomers are
   never turned away. Each contribution is its own claims row with
   a random slot id, so the UNIQUE constraint never blocks it. */
async function contribute(request, env) {
  const body = await request.json().catch(() => ({}));
  const row = await getBySlug(env, String(body.slug || ""));
  if (!row || row.tool_type !== "registry") return json({ error: "not found" }, 404);
  const data = JSON.parse(row.data);

  const name = clean(body.name, MAX_NAME);
  const message = String(body.message || "").trim().slice(0, MAX_MESSAGE);
  if (!name) throw badInput("Add your name — it goes on the build crew wall.");

  const cents = body.cents;
  if (!Number.isInteger(cents) || cents < MIN_CONTRIB_CENTS || cents > MAX_CONTRIB_CENTS)
    throw badInput("Pick an amount between $5 and $2,000.");

  // Bounded, like the group card: without a cap this is the one
  // storage-abuse path the rate limiter can't see.
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM claims WHERE instance_id = ? AND slot_id LIKE 'overflow-%'"
  ).bind(row.id).first();
  if (count && count.n >= 400)
    return json({ error: "The overflow patch is chockers — give your gift to the couple directly." }, 409);

  for (let attempt = 0; attempt < 3; attempt++) {
    const slotId = "overflow-" + randomString(6);
    try {
      await env.DB.prepare(
        `INSERT INTO claims (instance_id, slot_id, name, message, cents, ref, paid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
      ).bind(row.id, slotId, name, message, cents,
        reference(slotId, name), new Date().toISOString()).run();
      return json({ ref: reference(slotId, name), cents, payment: data.payment }, 201);
    } catch (e) {
      if (!/UNIQUE/.test(String(e))) throw e; // astronomically unlikely; try a fresh id
    }
  }
  throw new Error("Could not save that one — try again.");
}

async function setPaid(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "registry") return json({ error: "not found" }, 404);
  const body = await request.json().catch(() => ({}));
  const res = await env.DB.prepare(
    "UPDATE claims SET paid = ? WHERE instance_id = ? AND slot_id = ?"
  ).bind(body.paid ? 1 : 0, row.id, String(body.slotId || "")).run();
  if (!res.meta.changes) return json({ error: "That claim wasn't found." }, 404);
  return json({ ok: true });
}

async function release(token, request, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "registry") return json({ error: "not found" }, 404);
  const body = await request.json().catch(() => ({}));
  const res = await env.DB.prepare(
    "DELETE FROM claims WHERE instance_id = ? AND slot_id = ?"
  ).bind(row.id, String(body.slotId || "")).run();
  if (!res.meta.changes) return json({ error: "That claim wasn't found." }, 404);
  return json({ ok: true });
}

/* Organiser read: the full picture, refs and paid flags included. */
async function adminList(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "registry") return json({ error: "not found" }, 404);
  const rows = (await env.DB.prepare(
    `SELECT slot_id, name, message, cents, ref, paid, created_at FROM claims
     WHERE instance_id = ? ORDER BY created_at DESC, rowid DESC`
  ).bind(row.id).all()).results;
  return json({
    claims: rows.map((r) => ({
      slotId: r.slot_id, name: r.name, message: r.message, cents: r.cents,
      ref: r.ref, paid: !!r.paid, at: r.created_at,
    })),
  });
}

async function remove(token, env) {
  const row = await getByToken(env, token);
  if (!row || row.tool_type !== "registry") return json({ error: "not found" }, 404);
  await deleteInstance(env, row.id);
  await logEvent(env, row.id, "registry", "deleted");
  return json({ ok: true });
}

/* ---------- rendering ----------------------------------------
   The shell only: hero, canvas, empty containers, the claim
   dialog skeleton, and a JSON bootstrap. /registry-view.js
   fetches the claims and renders everything that moves. */

/* JSON destined for an inline <script>: "</script>" inside a
   string must not end the script element. */
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

function shellBody(row, data, { organiser, origin }) {
  const kicker = data.weddingDate
    ? `${esc(data.coupleNames)} · ${esc(data.weddingDate)}`
    : `${esc(data.coupleNames)} — gift registry`;

  const hasPayment = !!(data.payment.payId || data.payment.accountName ||
    data.payment.bsb || data.payment.accountNumber);

  const boot = {
    slug: row.slug,
    coupleNames: data.coupleNames,
    tagline: data.tagline,
    weddingDate: data.weddingDate,
    // Payment details deliberately stay OUT of the public page source.
    // Guests receive them in the claim/contribute response — you see
    // how to pay at the moment you've claimed something, not before.
    hasPayment,
    overflowTitle: data.overflowTitle,
  };
  if (organiser) { boot.editToken = row.edit_token; boot.payment = data.payment; }

  const organiserTop = organiser ? `
  <div class="organiser-banner pixel-note">
    <strong>This is your organiser page.</strong> Bookmark it — the link is the
    only way back in. Share the other link below with your guests.
  </div>` : "";

  const shareUrl = `${origin}/s/${row.slug}`;
  const shareBox = organiser ? `
  <div class="share-box">
    <label class="share-label" for="shareUrl">Share this link with your guests</label>
    <div class="share-row">
      <input id="shareUrl" class="share-input" type="text" readonly value="${esc(shareUrl)}">
      <button class="btn primary" id="copyBtn" type="button">Copy</button>
    </div>
  </div>
  ${shareNudge("🚙 Our gift registry is live — claim a part and watch the picture build: " + shareUrl, row.edit_token)}` : "";

  const paymentNudge = organiser && !hasPayment ? `
  <div class="pixel-note rg-nudge">
    <strong>Add how guests pay you</strong> — right now claimers see no payment
    details. Editing after create lands soon; for now, delete this registry and
    remake it with the details filled in.
  </div>` : "";

  const adminSection = organiser ? `
  <h2>Claims &amp; payments</h2>
  <div class="rg-admin-tools">
    <button class="btn" id="rgCsvBtn" type="button">Export CSV</button>
    <button class="btn ghost" id="rgAdminRefresh" type="button">Refresh</button>
    <span class="fine" id="rgAdminSummary"></span>
  </div>
  <div class="rg-admin-wrap">
    <table class="rg-admin-table">
      <thead><tr><th>Part</th><th>Claimed by</th><th>Amount</th><th>Ref</th><th>Paid</th><th></th></tr></thead>
      <tbody id="rgAdminRows"></tbody>
    </table>
  </div>
  <p class="fine">"Paid" is your own bookkeeping — tick it off as transfers land;
  guests never see it. Releasing a claim deletes it and repaints that part back
  to blueprint, so maybe give the person a heads-up first. References only live
  here and on each guest's own claim screen.</p>

  <div class="organiser-actions">
    <a class="btn" href="/s/${esc(row.slug)}">Open the shared registry</a>
    <button class="btn danger" id="rgDeleteBtn" type="button">Delete this registry</button>
    <a class="btn ghost" href="${HOME}">Make another</a>
  </div>
  <p class="fine">There's no edit-after-create yet — if the payment details or
  wording change, delete and remake. Deleting is permanent: every link stops
  working immediately and all claims go with it.</p>` : "";

  return `
<main class="wrap page">
  ${organiserTop}
  <p class="kicker">${kicker}</p>
  <h1>Build the Prado</h1>
  ${data.tagline ? `<p class="lede rg-tagline">${esc(data.tagline)}</p>` : ""}
  ${shareBox}
  ${paymentNudge}

  <div class="rg-garage">
    <canvas id="rgCanvas" class="rg-canvas"
      aria-label="Pixel art cutaway of a Toyota Prado that fills in as parts are claimed"></canvas>
    <p class="rg-caption" id="rgCaption">Every part someone claims paints itself in.</p>
  </div>

  <div class="rg-meter" role="group" aria-label="Overall build progress">
    <div class="rg-meter-bar"><div class="rg-meter-fill" id="rgMeterFill"></div></div>
    <p class="rg-meter-stats" id="rgStats">Loading the build sheet…</p>
  </div>
  <p class="form-error" id="rgLoadError" hidden></p>

  <h2 id="buildsheet">The build sheet</h2>
  <div class="rg-sections" id="rgSections"></div>

  <h2 id="parts">Pick your part</h2>
  <div class="rg-filters">
    <div class="rg-filter-row" id="rgGroupChips" role="group" aria-label="Filter by section"></div>
    <div class="rg-filter-row" id="rgPriceChips" role="group" aria-label="Filter by price"></div>
    <div class="rg-filter-row">
      <label class="rg-toggle">
        <input type="checkbox" id="rgAvailableOnly" checked>
        <span>Hide parts already claimed</span>
      </label>
      <span class="rg-count" id="rgResultCount"></span>
    </div>
  </div>
  <ul class="rg-parts" id="rgParts"></ul>
  <p class="rg-empty" id="rgEmpty" hidden>Nothing left in that filter — try widening it.</p>

  <h2>The overflow patch</h2>
  <div class="rg-overflow">
    <div class="rg-overflow-text">
      <p class="rg-overflow-name">${esc(data.overflowTitle)}</p>
      <p class="rg-overflow-blurb">The part of the build that never fills up.
      Favourite part already claimed, or none of them feel right? Chip in any
      amount from $5 to $2,000 — nobody gets turned away.</p>
      <p class="rg-overflow-tally" id="rgOverflowTally"></p>
    </div>
    <button class="btn primary" id="rgOverflowBtn" type="button">Chip in any amount</button>
  </div>
  <p class="fine rg-overflow-note">Top-ups don't paint any pixels on the Prado —
  extras top up the tank.</p>

  <h2>The build crew</h2>
  <ul class="rg-crew" id="rgCrew"></ul>
  <p class="rg-empty" id="rgCrewEmpty">No one on the tools yet. Be the first.</p>

  ${adminSection}

  <footer class="page-foot">
    <p class="fine">No accounts — this browser remembers which parts are yours.
    Payments happen directly between you and the couple; this site never
    touches the money.</p>
    <p><a class="quiet-link" href="/via/registry">made with biti by bit →</a></p>
  </footer>
</main>

<dialog class="rg-modal" id="rgModal" aria-labelledby="rgClaimTitle">
  <form method="dialog" class="rg-modal-inner" id="rgClaimForm">
    <button class="rg-modal-close" type="button" id="rgModalClose" aria-label="Close">×</button>

    <div id="rgClaimStep">
      <p class="rg-modal-tier" id="rgClaimTier"></p>
      <h3 class="rg-modal-title" id="rgClaimTitle">Part</h3>
      <p class="rg-modal-blurb" id="rgClaimBlurb"></p>
      <p class="rg-modal-price" id="rgClaimPrice"></p>

      <label class="field" id="rgAmountField" hidden>
        <span>Amount in dollars <em>($5 – $2,000, whole dollars)</em></span>
        <input type="number" id="rgAmount" min="5" max="2000" step="1" inputmode="numeric" placeholder="50">
      </label>
      <label class="field">
        <span>Your name <em>(shown on the build crew wall)</em></span>
        <input type="text" id="rgName" maxlength="${MAX_NAME}" autocomplete="name" placeholder="Sam &amp; Alex Nguyen">
      </label>
      <label class="field">
        <span>A note for the couple <em>(optional)</em></span>
        <textarea id="rgMessage" maxlength="${MAX_MESSAGE}" rows="2" placeholder="Enjoy the corrugations."></textarea>
      </label>

      <p class="rg-modal-error" id="rgClaimError" hidden></p>

      <div class="rg-modal-actions">
        <button type="button" class="btn ghost" id="rgClaimCancel">Back</button>
        <button type="button" class="btn primary" id="rgClaimConfirm">Claim this part</button>
      </div>
    </div>

    <div id="rgDoneStep" hidden>
      <p class="rg-done-badge">✓ Claimed</p>
      <h3 class="rg-modal-title" id="rgDoneTitle">Nice one.</h3>
      <p class="rg-modal-blurb" id="rgDoneLine"></p>

      <div class="rg-payblock">
        <h4>How to send it</h4>
        <dl id="rgPayDetails"></dl>
        <p class="rg-payref">Reference: <code id="rgPayRef"></code>
          <button type="button" class="btn small" id="rgCopyRef">copy</button></p>
        <p class="fine" id="rgPayNote"></p>
      </div>

      <div class="rg-modal-actions">
        <button type="button" class="btn primary" id="rgDoneClose">Back to the build</button>
      </div>
    </div>
  </form>
</dialog>

<script>window.RG_BOOT = ${safeJson(boot)};</script>
<script src="/registry-prado.js"></script>
<script src="/registry-view.js"></script>`;
}

function publicPage(row, env, url) {
  const data = JSON.parse(row.data);
  return html(pageShell({
    title: `${data.coupleNames} — build the Prado`,
    body: shellBody(row, data, { organiser: false, origin: url.origin }),
    shareType: "registry", shareSlug: row.slug,
  }));
}

function editPage(row, env, url) {
  const data = JSON.parse(row.data);
  return html(pageShell({
    title: `${data.coupleNames} — registry (organiser)`,
    body: shellBody(row, data, { organiser: true, origin: url.origin }),
  }));
}

/* ---------- module contract --------------------------------- */

export default {
  type: "registry",

  async api(request, env, url) {
    const p = url.pathname;
    if (!p.startsWith("/api/registry")) return null;
    let m;

    if (request.method === "GET") {
      if ((m = p.match(/^\/api\/registry\/([a-z0-9-]+)\/claims$/)))
        return listClaims(m[1], env);
      if ((m = p.match(/^\/api\/registry\/([a-z0-9]+)\/admin$/)))
        return adminList(m[1], env);
      return null;
    }

    if (request.method !== "POST") return null;
    if (p === "/api/registry") return create(request, env);
    if (p === "/api/registry/claim") return claim(request, env);
    if (p === "/api/registry/contribute") return contribute(request, env);
    if ((m = p.match(/^\/api\/registry\/([a-z0-9]+)\/(paid|release|delete)$/)))
      return m[2] === "paid" ? setPaid(m[1], request, env)
        : m[2] === "release" ? release(m[1], request, env)
        : remove(m[1], env);
    return null;
  },

  publicPage: (row, env, url) => publicPage(row, env, url),
  editPage: (row, env, url) => editPage(row, env, url),
};
