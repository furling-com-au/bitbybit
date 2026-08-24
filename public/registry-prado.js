/* ============================================================
   Pixel Gift Registry — the subject: THE PIXEL PRADO.

   A 68x34 cutaway drawn from declarative shapes. Every pixel
   belongs to one of the eight part groups, so as a group gets
   funded its pixels dither into existence and the car builds
   itself in front of the guests.

   This file also carries the client copy of the parts list.
   The server keeps its own copy in src/tools/registry.js —
   prices and slot ids MUST stay identical in both places
   (the server's copy is the one that sets what people pay).
   ============================================================ */
(function (global) {
  "use strict";

  var PRADO_W = 68;
  var PRADO_H = 34;
  var GROUND_Y = 31;

  /* Palette. Tones are per-group so each section reads distinctly. */
  var PALETTE = {
    engine: { base: "#d98f4a", dark: "#a8632c", light: "#f0b46e" },
    chassis: { base: "#6b6577", dark: "#464150", light: "#8d8699" },
    wheels: { tyre: "#3b3540", rim: "#c9bda9", hub: "#241f2a" },
    body: { base: "#7f9e78", dark: "#4b6647", glass: "#a9cdd8", grille: "#3f3a48" },
    interior: { base: "#b8735a", dark: "#8a4e3a", light: "#d69a80" },
    electrical: { base: "#f7d774", dark: "#dfa73a", red: "#e07a5f" },
    touring: {
      base: "#8a6d4f", dark: "#5d4832", light: "#a98a68",
      hot: "#e08a3c", canvas: "#cbb68e", lamp: "#f2d98a", steel: "#5f7a84",
    },
    luxuries: { base: "#c98fa8", dark: "#9d6880", mud: "#4a4048", plate: "#e8e0cc" },
  };

  /* Draw order: later shapes paint over earlier ones. That's what
     creates the cutaway — body first, then the guts on top of it. */
  var SHAPES = [
    /* --- chassis under everything ---------------------------- */
    { g: "chassis", t: "base", ops: [["rect", 10, 25, 58, 26]] },
    { g: "chassis", t: "dark", ops: [["rect", 23, 26, 25, 27], ["rect", 41, 26, 43, 27]] },

    /* --- body shell: long bonnet, boxy cabin ----------------- */
    { g: "body", t: "base", ops: [["rect", 8, 13, 61, 24]] },
    { g: "body", t: "base", ops: [
      ["span", 5, 10, 38], ["span", 6, 10, 39], ["span", 7, 10, 40], ["span", 8, 10, 41],
      ["span", 9, 10, 42], ["span", 10, 10, 43], ["span", 11, 10, 44], ["span", 12, 10, 45],
    ]},
    { g: "body", t: "base", ops: [["rect", 11, 4, 37, 4]] },

    /* --- glass ----------------------------------------------- */
    { g: "body", t: "glass", ops: [
      ["rect", 12, 6, 17, 11],   // rear quarter
      ["rect", 20, 6, 26, 11],   // rear door
      ["rect", 29, 6, 35, 11],   // front door
      ["span", 6, 37, 38], ["span", 7, 37, 39], ["span", 8, 38, 40],   // windscreen rake
      ["span", 9, 39, 41], ["span", 10, 40, 42], ["span", 11, 41, 43],
    ]},

    /* --- cabin cutaway --------------------------------------- */
    { g: "interior", t: "base", ops: [
      ["rect", 14, 7, 16, 13], ["rect", 12, 13, 17, 13],   // third row
      ["rect", 22, 7, 24, 13], ["rect", 20, 13, 25, 13],   // mid bench
      ["rect", 30, 7, 32, 13], ["rect", 28, 13, 33, 13],   // front seats
    ]},
    { g: "interior", t: "light", ops: [["rect", 34, 8, 35, 12]] },              // steering wheel
    { g: "interior", t: "dark", ops: [["rect", 36, 12, 43, 13], ["rect", 37, 14, 40, 16]] }, // dash + stereo
    { g: "interior", t: "base", ops: [["rect", 41, 14, 43, 16]] },              // air con

    /* --- cargo cutaway (above the rear arch, or the tyre eats it) */
    { g: "touring", t: "steel", ops: [["rect", 12, 14, 15, 17]] },  // 12V fridge
    { g: "luxuries", t: "base", ops: [["rect", 16, 14, 19, 17]] },  // esky + toolkit

    /* --- drivetrain cutaway ---------------------------------- */
    { g: "engine", t: "base", ops: [["rect", 48, 14, 54, 17]] },    // engine block
    { g: "engine", t: "light", ops: [["rect", 46, 15, 47, 17]] },   // turbo
    { g: "engine", t: "dark", ops: [["rect", 55, 14, 57, 17]] },    // radiator
    { g: "engine", t: "dark", ops: [["rect", 39, 20, 44, 23]] },    // gearbox
    { g: "engine", t: "base", ops: [["rect", 31, 22, 38, 23]] },    // tailshaft
    { g: "engine", t: "light", ops: [["rect", 25, 20, 30, 24]] },   // fuel tank

    /* --- wheels (these carve the arches out of the body) ------ */
    { g: "wheels", t: "tyre", ops: [["disc", 18, 24, 6], ["disc", 51, 24, 6], ["disc", 4, 18, 4]] },
    { g: "wheels", t: "rim", ops: [["disc", 18, 24, 3], ["disc", 51, 24, 3], ["disc", 4, 18, 2]] },
    { g: "chassis", t: "light", ops: [["disc", 18, 24, 2], ["disc", 51, 24, 2]] },  // brake discs
    { g: "wheels", t: "hub", ops: [["disc", 18, 24, 1], ["disc", 51, 24, 1]] },

    /* --- panel lines & arch lips ------------------------------ */
    { g: "body", t: "dark", ops: [
      ["rect", 11, 14, 11, 24], ["rect", 19, 14, 19, 24],
      ["rect", 28, 14, 28, 24], ["rect", 36, 14, 36, 19],
      ["arch", 18, 24, 7], ["arch", 51, 24, 7],
    ]},
    { g: "body", t: "grille", ops: [["rect", 58, 17, 61, 21]] },

    /* --- lights & electrical --------------------------------- */
    { g: "electrical", t: "base", ops: [["rect", 58, 13, 61, 16]] },   // headlight
    { g: "electrical", t: "dark", ops: [["rect", 58, 22, 61, 23]] },   // front indicator
    { g: "electrical", t: "red", ops: [["rect", 8, 14, 10, 17]] },     // tail light
    { g: "electrical", t: "dark", ops: [["rect", 8, 18, 10, 19]] },    // rear indicator
    { g: "electrical", t: "base", ops: [["rect", 46, 13, 47, 14]] },   // alternator
    { g: "electrical", t: "dark", ops: [["rect", 6, 13, 8, 14]] },     // reverse camera

    /* --- touring gear ---------------------------------------- */
    { g: "touring", t: "dark", ops: [["rect", 12, 2, 37, 3], ["rect", 9, 2, 12, 3]] },   // rack + awning
    { g: "touring", t: "canvas", ops: [["rect", 13, 0, 26, 1]] },                        // rooftop tent
    { g: "touring", t: "hot", ops: [["rect", 28, 1, 32, 1]] },                           // recovery tracks
    { g: "touring", t: "lamp", ops: [["rect", 34, 0, 37, 1]] },                          // driving lights
    { g: "touring", t: "dark", ops: [["rect", 46, 4, 47, 12], ["rect", 44, 3, 47, 4]] }, // snorkel
    { g: "touring", t: "dark", ops: [
      ["rect", 59, 11, 65, 12], ["rect", 62, 12, 65, 26], ["rect", 57, 25, 65, 27],      // bull bar
      ["rect", 2, 24, 10, 26],                                                           // rear bar
      ["rect", 60, 5, 60, 11],                                                           // UHF whip
    ]},
    { g: "touring", t: "light", ops: [["rect", 62, 18, 64, 21]] },                       // winch

    /* --- little luxuries ------------------------------------- */
    { g: "luxuries", t: "mud", ops: [["rect", 9, 26, 11, 29], ["rect", 42, 26, 44, 29]] },   // mud flaps
    { g: "luxuries", t: "plate", ops: [["rect", 62, 22, 65, 24]] },                          // number plate
    { g: "luxuries", t: "base", ops: [["rect", 5, 22, 8, 24]] },                             // jerry can
    { g: "luxuries", t: "mud", ops: [["rect", 40, 11, 44, 11], ["rect", 55, 12, 61, 12]] },  // wiper + bonnet protector
  ];

  /* --- rasteriser ------------------------------------------- */
  function rasterise() {
    var grid = new Array(PRADO_W * PRADO_H).fill(null);
    var put = function (x, y, cell) {
      if (x < 0 || y < 0 || x >= PRADO_W || y >= PRADO_H) return;
      grid[y * PRADO_W + x] = cell;
    };

    for (var s = 0; s < SHAPES.length; s++) {
      var shape = SHAPES[s];
      var cell = { g: shape.g, t: shape.t };
      for (var o = 0; o < shape.ops.length; o++) {
        var op = shape.ops[o];
        var kind = op[0];
        var x, y;
        if (kind === "rect") {
          for (y = op[2]; y <= op[4]; y++) for (x = op[1]; x <= op[3]; x++) put(x, y, cell);
        } else if (kind === "span") {
          for (x = op[2]; x <= op[3]; x++) put(x, op[1], cell);
        } else if (kind === "disc") {
          var cx = op[1], cy = op[2], r = op[3];
          for (y = cy - r; y <= cy + r; y++)
            for (x = cx - r; x <= cx + r; x++) {
              var dx = x - cx, dy = y - cy;
              if (dx * dx + dy * dy <= r * r + r * 0.35) put(x, y, cell);
            }
        } else if (kind === "arch") {
          // wheel arch lip: a ring, but only the top half (never below the sill)
          var ax = op[1], ay = op[2], ar = op[3];
          for (y = ay - ar; y <= 24; y++)
            for (x = ax - ar; x <= ax + ar; x++) {
              var d = Math.sqrt((x - ax) * (x - ax) + (y - ay) * (y - ay));
              if (d <= ar + 0.4 && d > ar - 0.9) put(x, y, cell);
            }
        }
      }
    }

    var cells = [];
    for (var yy = 0; yy < PRADO_H; yy++)
      for (var xx = 0; xx < PRADO_W; xx++) {
        var c = grid[yy * PRADO_W + xx];
        if (c) cells.push({ x: xx, y: yy, g: c.g, t: c.t });
      }
    return cells;
  }

  /* Bayer dither ordering, so a half-funded group appears as an
     even scatter condensing into a solid part rather than a
     hard wipe. */
  var BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  var PRADO_CELLS = rasterise();

  /* Pre-sort each group's cells into their reveal order once. */
  var REVEAL = (function () {
    var byGroup = {};
    PRADO_CELLS.forEach(function (c, i) {
      (byGroup[c.g] = byGroup[c.g] || []).push({
        x: c.x, y: c.y, g: c.g, t: c.t,
        o: BAYER[c.y % 4][c.x % 4] * 4096 + i,
      });
    });
    Object.keys(byGroup).forEach(function (g) {
      byGroup[g].sort(function (a, b) { return a.o - b.o; });
    });
    return byGroup;
  })();

  /**
   * Paint the Prado.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} progress  map of groupId -> 0..1 funded fraction
   * @param {Object} opts      { ghost: css colour for unfunded pixels }
   */
  function renderPrado(canvas, progress, opts) {
    opts = opts || {};
    var ghost = opts.ghost || "rgba(90,80,70,0.13)";
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var cssW = canvas.clientWidth || 680;
    var scale = Math.max(1, Math.floor((cssW * dpr) / PRADO_W));
    var w = PRADO_W * scale;
    var h = PRADO_H * scale;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    // ground shadow — always present, it's the stage the car sits on
    ctx.fillStyle = "rgba(90,80,70,0.10)";
    for (var x = 2; x < 64; x++) {
      var edge = Math.min(x - 2, 63 - x);
      if (edge < 3 && (x + GROUND_Y) % 2) continue;
      ctx.fillRect(x * scale, GROUND_Y * scale, scale, scale);
    }

    Object.keys(REVEAL).forEach(function (g) {
      var cells = REVEAL[g];
      var pct = Math.max(0, Math.min(1, progress[g] || 0));
      var lit = Math.round(pct * cells.length);
      var i, c;

      // unfunded first, as a faint blueprint
      ctx.fillStyle = ghost;
      for (i = lit; i < cells.length; i++) {
        c = cells[i];
        ctx.fillRect(c.x * scale, c.y * scale, scale, scale);
      }
      // then the funded pixels, in full colour
      for (i = 0; i < lit; i++) {
        c = cells[i];
        ctx.fillStyle = PALETTE[c.g][c.t];
        ctx.fillRect(c.x * scale, c.y * scale, scale, scale);
      }
    });
  }

  function groupPixelShare() {
    var counts = {};
    for (var i = 0; i < PRADO_CELLS.length; i++)
      counts[PRADO_CELLS[i].g] = (counts[PRADO_CELLS[i].g] || 0) + 1;
    return counts;
  }

  /* ============================================================
     THE PARTS LIST (client copy — see src/tools/registry.js).
     126 claimable slots. Totals to exactly $25,000.00 AUD.
     Prices are in CENTS (avoids floating point nonsense).
     ============================================================ */

  var GROUPS = [
    { id: "engine", name: "Engine & Drivetrain", blurb: "The bits that actually make it go." },
    { id: "chassis", name: "Chassis & Suspension", blurb: "Ladder frame, springs, and stopping power." },
    { id: "wheels", name: "Wheels & Tyres", blurb: "Five corners of grip. Yes, five — the spare counts." },
    { id: "body", name: "Body & Panels", blurb: "Doors, glass, and the shape of the thing." },
    { id: "interior", name: "Interior & Cabin", blurb: "Where the couple will actually be sitting for 4,000km." },
    { id: "electrical", name: "Lights & Electrical", blurb: "Seeing, being seen, and the honk." },
    { id: "touring", name: "Touring & 4WD Gear", blurb: "The reason it's a Prado and not a hatchback." },
    { id: "luxuries", name: "Little Luxuries", blurb: "Small, silly, and genuinely useful." },
  ];

  /* Price tiers — purely cosmetic, gives each claim a title. */
  var TIERS = [
    { max: 4999, name: "Nuts & Bolts" },
    { max: 14999, name: "Toolbox" },
    { max: 39999, name: "Spanner Crew" },
    { max: 79999, name: "Head Mechanic" },
    { max: Infinity, name: "Chief Engineer" },
  ];

  var PARTS = [
    /* --- ENGINE & DRIVETRAIN — $5,000 / 10 slots --------------- */
    { id: "engine-block", group: "engine", name: "Engine Block", cents: 120000, qty: 1, blurb: "The 1KD heart of the beast. Somebody has to." },
    { id: "gearbox", group: "engine", name: "Gearbox", cents: 90000, qty: 1, blurb: "Six speeds between them and the horizon." },
    { id: "turbo", group: "engine", name: "Turbocharger", cents: 65000, qty: 1, blurb: "For the overtaking lane and the sandhill." },
    { id: "transfer-case", group: "engine", name: "Transfer Case", cents: 50000, qty: 1, blurb: "The knob that turns two wheels into four." },
    { id: "front-diff", group: "engine", name: "Front Diff", cents: 40000, qty: 1, blurb: "Keeps the front wheels arguing politely." },
    { id: "rear-diff", group: "engine", name: "Rear Diff", cents: 40000, qty: 1, blurb: "With a locker, because they're optimists." },
    { id: "fuel-tank", group: "engine", name: "Fuel Tank", cents: 30000, qty: 1, blurb: "150 litres of range anxiety, cured." },
    { id: "radiator", group: "engine", name: "Radiator", cents: 25000, qty: 1, blurb: "Cool head in a hot country." },
    { id: "exhaust", group: "engine", name: "Exhaust System", cents: 22000, qty: 1, blurb: "The sensible noise." },
    { id: "battery", group: "engine", name: "Cranking Battery", cents: 18000, qty: 1, blurb: "First turn of the key is on you." },

    /* --- CHASSIS & SUSPENSION — $3,500 / 16 slots -------------- */
    { id: "chassis-rail", group: "chassis", name: "Chassis Rail", cents: 60000, qty: 2, blurb: "One rail each side. The spine of the whole thing." },
    { id: "shock", group: "chassis", name: "Shock Absorber", cents: 17500, qty: 4, blurb: "One per corner. Corrugations are the enemy." },
    { id: "steering-rack", group: "chassis", name: "Steering Rack", cents: 35000, qty: 1, blurb: "Turning is, on balance, worth paying for." },
    { id: "brake-caliper", group: "chassis", name: "Brake Caliper", cents: 12500, qty: 4, blurb: "Stopping is also nice." },
    { id: "front-coil", group: "chassis", name: "Front Coil Spring", cents: 15000, qty: 2, blurb: "Two inches of lift and no regrets." },
    { id: "rear-coil", group: "chassis", name: "Rear Coil Spring", cents: 15000, qty: 2, blurb: "For when the boot is full of camp chairs." },
    { id: "handbrake", group: "chassis", name: "Handbrake", cents: 15000, qty: 1, blurb: "Essential on a boat ramp. Trust us." },

    /* --- WHEELS & TYRES — $2,500 / 10 slots -------------------- */
    { id: "tyre", group: "wheels", name: "All-Terrain Tyre", cents: 32000, qty: 5, blurb: "Four on the ground, one on the tailgate." },
    { id: "wheel", group: "wheels", name: "Alloy Wheel", cents: 18000, qty: 5, blurb: "Round. Important that they're round." },

    /* --- BODY & PANELS — $3,500 / 16 slots --------------------- */
    { id: "roof-panel", group: "body", name: "Roof Panel", cents: 35000, qty: 1, blurb: "Keeps the weather where it belongs." },
    { id: "bonnet", group: "body", name: "Bonnet", cents: 40000, qty: 1, blurb: "For dramatic roadside inspections." },
    { id: "tailgate", group: "body", name: "Tailgate", cents: 38000, qty: 1, blurb: "Future kettle bench and sunset seat." },
    { id: "windscreen", group: "body", name: "Windscreen", cents: 35000, qty: 1, blurb: "It will get a stone chip. We accept this." },
    { id: "front-door", group: "body", name: "Front Door", cents: 30000, qty: 2, blurb: "One for the driver, one for the navigator." },
    { id: "rear-door", group: "body", name: "Rear Door", cents: 26000, qty: 2, blurb: "For everyone else and the dog." },
    { id: "guard", group: "body", name: "Front Guard", cents: 20000, qty: 2, blurb: "Wraps the wheel, hides the mud." },
    { id: "side-window", group: "body", name: "Side Window", cents: 7500, qty: 4, blurb: "Wind-in-the-hair, elbow-on-the-sill." },
    { id: "mirror", group: "body", name: "Side Mirror", cents: 10000, qty: 2, blurb: "Objects are closer than they appear." },

    /* --- INTERIOR & CABIN — $3,000 / 18 slots ------------------ */
    { id: "driver-seat", group: "interior", name: "Driver's Seat", cents: 45000, qty: 1, blurb: "Command position. Eight hours a day of it." },
    { id: "passenger-seat", group: "interior", name: "Passenger Seat", cents: 40000, qty: 1, blurb: "Chief snack officer sits here." },
    { id: "rear-bench", group: "interior", name: "Rear Bench Seat", cents: 35000, qty: 1, blurb: "Folds flat. That's the whole pitch." },
    { id: "third-row", group: "interior", name: "Third Row Seat", cents: 17500, qty: 2, blurb: "For the friends they haven't made yet." },
    { id: "steering-wheel", group: "interior", name: "Steering Wheel", cents: 30000, qty: 1, blurb: "The single most-touched part of the car." },
    { id: "aircon", group: "interior", name: "Air Con Unit", cents: 30000, qty: 1, blurb: "January. Bitumen. Enough said." },
    { id: "dashboard", group: "interior", name: "Dashboard", cents: 28000, qty: 1, blurb: "Dials, vents, and one mysterious button." },
    { id: "stereo", group: "interior", name: "Stereo & Speakers", cents: 22000, qty: 1, blurb: "Road trip playlist delivery system." },
    { id: "floor-mat", group: "interior", name: "Floor Mat", cents: 4000, qty: 4, blurb: "Rubber. Deep channels. Non-negotiable." },
    { id: "rear-mirror", group: "interior", name: "Rear View Mirror", cents: 5000, qty: 1, blurb: "For checking on everyone in the back." },
    { id: "gear-knob", group: "interior", name: "Gear Knob", cents: 4000, qty: 1, blurb: "Small, but they'll hold it constantly." },
    { id: "seatbelt", group: "interior", name: "Seatbelt Set", cents: 4000, qty: 1, blurb: "Click. Every time." },
    { id: "cup-holder", group: "interior", name: "Cup Holder", cents: 3000, qty: 2, blurb: "Arguably the most important interior part." },

    /* --- LIGHTS & ELECTRICAL — $1,500 / 12 slots --------------- */
    { id: "wiring-loom", group: "electrical", name: "Wiring Loom", cents: 30000, qty: 1, blurb: "Kilometres of spaghetti. Nobody sees it. Everything needs it." },
    { id: "alternator", group: "electrical", name: "Alternator", cents: 25000, qty: 1, blurb: "Makes the electricity while they drive." },
    { id: "reverse-camera", group: "electrical", name: "Reverse Camera", cents: 18000, qty: 1, blurb: "Saves marriages at the boat ramp." },
    { id: "headlight", group: "electrical", name: "Headlight", cents: 17500, qty: 2, blurb: "One each side. Roos come out at dusk." },
    { id: "tail-light", group: "electrical", name: "Tail Light", cents: 11000, qty: 2, blurb: "So the road train behind them knows." },
    { id: "horn", group: "electrical", name: "Horn", cents: 6000, qty: 1, blurb: "Used exclusively for saying hello to cattle." },
    { id: "indicator", group: "electrical", name: "Indicator", cents: 3500, qty: 4, blurb: "Radical concept. They intend to use them." },

    /* --- TOURING & 4WD GEAR — $4,500 / 14 slots ---------------- */
    { id: "rooftop-tent", group: "touring", name: "Rooftop Tent", cents: 70000, qty: 1, blurb: "The honeymoon accommodation, technically." },
    { id: "bull-bar", group: "touring", name: "Bull Bar", cents: 60000, qty: 1, blurb: "Steel, and quietly reassuring." },
    { id: "winch", group: "touring", name: "Winch", cents: 50000, qty: 1, blurb: "For the day the optimism runs out." },
    { id: "fridge", group: "touring", name: "12V Fridge", cents: 45000, qty: 1, blurb: "Cold drinks 700km from the nearest shop." },
    { id: "roof-rack", group: "touring", name: "Roof Rack", cents: 45000, qty: 1, blurb: "Holds the tent, the tracks, and the ambition." },
    { id: "dual-battery", group: "touring", name: "Dual Battery System", cents: 40000, qty: 1, blurb: "So the fridge doesn't strand them." },
    { id: "snorkel", group: "touring", name: "Snorkel", cents: 35000, qty: 1, blurb: "Mostly for dust. Occasionally for glory." },
    { id: "awning", group: "touring", name: "Awning", cents: 25000, qty: 1, blurb: "Instant shade. Instant campsite." },
    { id: "uhf", group: "touring", name: "UHF Radio", cents: 20000, qty: 1, blurb: "Channel 40 and the world's worst jokes." },
    { id: "driving-light", group: "touring", name: "Driving Light", cents: 15000, qty: 2, blurb: "Turns midnight into midday. One each." },
    { id: "recovery-track", group: "touring", name: "Recovery Track", cents: 12500, qty: 2, blurb: "Bright orange proof they got stuck." },
    { id: "snatch-strap", group: "touring", name: "Snatch Strap", cents: 5000, qty: 1, blurb: "Friendship, in webbing form." },

    /* --- LITTLE LUXURIES — $1,500 / 30 slots ------------------- */
    { id: "cargo-barrier", group: "luxuries", name: "Cargo Barrier", cents: 18000, qty: 1, blurb: "Stops the esky becoming a projectile." },
    { id: "dash-cam", group: "luxuries", name: "Dash Cam", cents: 16000, qty: 1, blurb: "Evidence, and accidental wildlife documentaries." },
    { id: "toolkit", group: "luxuries", name: "Toolkit", cents: 12000, qty: 1, blurb: "The one thing you regret not having." },
    { id: "bonnet-protector", group: "luxuries", name: "Bonnet Protector", cents: 9000, qty: 1, blurb: "Deflects stones and the occasional bug apocalypse." },
    { id: "esky", group: "luxuries", name: "Esky", cents: 8000, qty: 1, blurb: "The fridge's understudy." },
    { id: "roadside-kit", group: "luxuries", name: "Roadside Kit", cents: 7500, qty: 1, blurb: "Triangle, vest, and quiet dignity." },
    { id: "first-aid", group: "luxuries", name: "First Aid Kit", cents: 6000, qty: 1, blurb: "Band-aids and snake bandages." },
    { id: "extinguisher", group: "luxuries", name: "Fire Extinguisher", cents: 5000, qty: 1, blurb: "Hopefully the least-used gift here." },
    { id: "diesel", group: "luxuries", name: "Tank of Diesel", cents: 4000, qty: 4, blurb: "A quarter tank each. That's a whole tank of adventure." },
    { id: "car-wash", group: "luxuries", name: "Car Wash Kit", cents: 4500, qty: 1, blurb: "For the ten minutes a year it's clean." },
    { id: "jerry-can", group: "luxuries", name: "Jerry Can", cents: 4500, qty: 2, blurb: "20 litres of just-in-case." },
    { id: "number-plate", group: "luxuries", name: "Number Plate", cents: 4000, qty: 2, blurb: "Front and back. Make it official." },
    { id: "tyre-gauge", group: "luxuries", name: "Tyre Pressure Gauge", cents: 3500, qty: 1, blurb: "18 psi on the sand. Every time." },
    { id: "wiper", group: "luxuries", name: "Wiper Blade", cents: 3000, qty: 2, blurb: "One each. A matched pair, like the couple." },
    { id: "torch", group: "luxuries", name: "Torch", cents: 3000, qty: 1, blurb: "For finding the tent peg in the dark." },
    { id: "mud-flap", group: "luxuries", name: "Mud Flap", cents: 2500, qty: 4, blurb: "Four flaps, endless flicked gravel avoided." },
    { id: "sunshade", group: "luxuries", name: "Windscreen Sunshade", cents: 2500, qty: 1, blurb: "The difference between a seat and a hotplate." },
    { id: "air-freshener", group: "luxuries", name: "Air Freshener", cents: 1500, qty: 4, blurb: "The cheapest way onto this list. No shame at all." },
  ];

  /* Expand parts into individual claimable slots. */
  function buildSlots() {
    var slots = [];
    for (var p = 0; p < PARTS.length; p++) {
      var part = PARTS[p];
      for (var i = 1; i <= part.qty; i++) {
        slots.push({
          id: part.qty > 1 ? part.id + "-" + i : part.id,
          partId: part.id,
          index: i,
          of: part.qty,
          group: part.group,
          name: part.name,
          cents: part.cents,
          blurb: part.blurb,
        });
      }
    }
    return slots;
  }

  var SLOTS = buildSlots();

  var SLOT_BY_ID = {};
  SLOTS.forEach(function (s) { SLOT_BY_ID[s.id] = s; });

  var GROUP_TOTALS = (function () {
    var t = {};
    SLOTS.forEach(function (s) {
      t[s.group] = t[s.group] || { cents: 0, slots: 0 };
      t[s.group].cents += s.cents;
      t[s.group].slots += 1;
    });
    return t;
  })();

  var GRAND_TOTAL = SLOTS.reduce(function (n, s) { return n + s.cents; }, 0);

  function tierFor(cents) {
    for (var i = 0; i < TIERS.length; i++) if (cents <= TIERS[i].max) return TIERS[i];
    return TIERS[TIERS.length - 1];
  }

  global.RegistryPrado = {
    W: PRADO_W, H: PRADO_H,
    GROUPS: GROUPS, TIERS: TIERS, PARTS: PARTS, SLOTS: SLOTS,
    SLOT_BY_ID: SLOT_BY_ID, GROUP_TOTALS: GROUP_TOTALS, GRAND_TOTAL: GRAND_TOTAL,
    tierFor: tierFor, renderPrado: renderPrado, groupPixelShare: groupPixelShare,
  };
})(typeof window !== "undefined" ? window : globalThis);
