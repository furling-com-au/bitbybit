# One fill language across 20 tools — bitibybit.com

This is the specification `07-visual.md §D10` asks for. It designs **one** way
to say *N of M* and specifies how each of the twenty server-side tool types in
`TOOLS` (`src/worker.js:39`) would use it. It contains no code meant to be
pasted anywhere; the CSS sketches exist to make the geometry checkable, not to
be applied.

**What this owns.** The visual language of progress — the mark, its two sizes,
its type, its colours, its behaviour in dark mode and in print — and a per-tool
decision about what each tool's numerator and denominator actually are.

**What it does not own.** The words in the sentence above the bar
(`04-copy.md`), where the bar sits in the page (`05-tools.md §G4` settles that
explanation goes *after* the action on the participant path; `07-visual.md §D11`
will settle the `/s/` layout), whether a tool ships at all (`06-roadmap.md`),
and every rule in `02-diagnosis.md §I`, which is read here as a constraint and
never as a trade-off. It also does not own the pixel art: nothing below touches
`scripts/gen-art.mjs`, any icon, any hero or any OG image, per
`07-visual.md §F.5`.

**What is deliberately not in it.** No new colour token, no third edge rung, no
new API endpoint, no new event row, no new column, and nothing that polls.

Four rules held throughout, the same four `07-visual.md` held:

- **Nothing claims observed behaviour.** `.stats-history.jsonl` still has one
  row. Where the reasoning is judgement it says **HEURISTIC** and names the
  measurement that would settle it.
- **Every recommendation names a file.**
- **Contrast and geometry are computed, not eyeballed** — §C and §D carry the
  numbers, taken off live elements.
- **The constraint audit in §I is checked against the scripts themselves**, read
  for this document, not assumed from their names.

---

# A. Measurement conditions

Measured **31 August 2026 against the working tree**, not against `0cec1dd`.
`public/` was served statically on an unused port and driven in a real browser
at **375×812** and **1280×800**, in both colour schemes. Computed styles and
bounding boxes were read off live elements. The proposed marks were injected
into a live page against the real `public/styles.css` rather than mocked in
isolation, so every number below is a number the shipped stylesheet produced.

Content column: **343px** at 375×812, **1020px** at 1280×800 (`.wrap`).

`07-visual.md §D4` and `§D5` were being worked in the same tree while this was
measured. Nothing in §C or §D depends on the homepage fold or on
`.prev-sweeps`, so their outcome cannot move these numbers.

---

# B. The rules the design has to satisfy

Read `docs/review/02-diagnosis.md §I` before reading §D. Four of its nine items
bear directly on a progress display, and one is the item most likely to sink a
naive version.

## B.1 The no-new-facts rule

> **A fill may only draw a number that a viewer of that same page could already
> obtain by counting what is rendered on it.**

That is the whole privacy design, and it is checkable by reading one render
function. A fill is a *rendering of published state*, never a *summary of
unpublished state*. Everything in §F is decided by applying it.

Why this rule rather than a comfortable one: `02-diagnosis.md §I.2` forbids the
organiser seeing who drew whom, and the obvious failure is not a bar that prints
an assignment — nobody would ship that. The failure is a bar that can be
**differenced**. Three examples, all of which the rule refuses:

- **Coffee Roulette.** `src/tools/coffee.js:253-266` publishes, by name, which
  people have claimed and which have not. `data.groups` — the pairings — is
  published nowhere except each person's own `/p/` page. A *per-pair* fill
  ("2 of 4 pairs are both in") sitting beside the per-name list is a solved
  system: watch one name flip from open to claimed, see which pair's fill moved,
  and you have learned who that person was paired with. A single undivided fill
  over the whole roster is safe because it is exactly the sum of what the page
  already shows. A per-pair fill is not safe at any granularity.
- **Secret Role Dealer.** `src/tools/roles.js:129-141` publishes a count and no
  names at all. A per-role fill ("the Doctor has been taken") is new
  information, and after two or three joins it is attributable.
- **Kris Kringle.** `src/tools/kringle.js:205-215` publishes each name's claimed
  state. A fill over that set adds nothing. A fill segmented by anything else —
  by giver, by receiver, by budget band — adds a fact.

The rule also settles a case that has nothing to do with secrecy: **Weekly
Pulse**. `src/tools/pulse.js:415-421` already carries the argument in prose —
"A figure that moves every time somebody answers tells you what they answered".
That is the differencing attack, written down by the person who built it, and it
is why the pulse publishes a closed week rather than a live one. §G.2 declines
to give it a fill for exactly the reason the file already gives.

## B.2 The link preview carries nothing

`src/lib.js:330-345` ends (cited as `:318-333` in `02-diagnosis.md §I.1`; the
file has moved since, and the comment is unchanged): *"If you are tempted to make a card more useful by
putting the state of the thing in it, don't."* A fill is precisely "the state of
the thing", which makes this the easiest rule in the repository to break while
believing you are improving something.

**The fill exists in `<body>` and nowhere else.** It never reaches `SHARE`
(`src/lib.js:348`), `shareTags()` (`:376`), the OG description, the Twitter
card, `cardPreview()` (`:410`), or any `og:image`. The `/s/` share images stay
static per-tool artwork from `scripts/gen-art.mjs`.

## B.3 Nothing is logged, and nothing is polled

`migrations/0001_init.sql:34-40`: *"Deliberately no per-view logging (noise, and
it burns D1 writes)."* `public/index.html:355-361` states the same position for
`/s/`, `/e/` and `/p/`.

**The fill is rendered server-side into the HTML of the request that asked for
it.** No endpoint, no beacon, no `fetch`, no interval, no `events` row. The one
tool on the site that already polls — Scrum Poker, every two seconds,
`src/tools/poker.js:178-199` — is also the one tool §F.20 leaves alone.

## B.4 "Opened" is not a countable state

`migrations/0004_first_opened_at.sql` gives every instance one nullable
timestamp, set from the generic handler at `src/worker.js:431-435`. Three
properties make it unusable as a fill numerator, and they compound:

1. **It is one bit, not a count.** It says *something fetched this once*. There
   is no denominator it could sit over.
2. **Rows created before the migration will never get one.** `scripts/stats.mjs`
   says so in its closing note and treats their zero as old data, not failure. A
   page that rendered NULL as "nobody has opened this" would tell an organiser
   whose August sweep thirty people opened that nobody opened it.
3. **A link unfurler sets it.** The route at `src/worker.js:431` accepts `GET`
   *and* `HEAD` and calls `markFirstOpened` for both. Slack, Teams and iMessage
   all fetch a pasted `/s/` URL to build the preview card, so the stamp fires
   when the link is **pasted**, not when a person opens it. `stats.mjs`'s
   `COLD_MINUTES` threshold discounts that case correctly, because the paste
   lands seconds after creation — a rendered page has no such threshold.

**Recommendation: `first_opened_at` stays out of every rendered page.** It is a
stats column and `scripts/stats.mjs` is the only thing that should read it. This
is also the answer to "degrade gracefully for instances with no signal": they
show no fill, which is honest, rather than a fill reading zero, which is a claim.

---

# C. The language already exists. It has shipped twice and has no name

This is the finding that decides the design. It is arithmetic, not judgement.

## C.1 Two components, identical geometry, no shared rule

| | `.rg-meter-bar` (`styles.css:1112-1120`) | `.poll-bar-track` (`styles.css:1768-1772`) |
|---|---|---|
| Height, computed at 375px | **22px** | **22px** |
| Border | `var(--edge-lead)` → 3px solid `--ink` | `3px solid var(--ink)` |
| Ground | `var(--paper-3)` | `var(--paper-3)` |
| Fill height | 16px | 16px |
| Fill | `repeating-linear-gradient(135deg, var(--sage) 0 8px, var(--sage-dark) 8px 16px)` | *the same declaration, character for character* |
| Transition | `width .7s steps(24, end)` | `width .6s steps(16, end)` |

Read back off the live page, both computed to a `rgb(226, 211, 182)` ground, a
`3px solid rgb(61, 52, 40)` border, a 22px box and the identical resolved
gradient. The same component was written twice, six hundred lines apart, and the
only thing the two versions disagree about is the step count in a transition.

There is a smaller rung too: `.rg-sect-bar` (`styles.css:1150-1151`) — 10px
tall, `2px solid var(--ink)`, ground `--paper`, same fill. And a third that does
not match: `.pulse-bar` (`styles.css:2351-2352`) — 14.39px computed, `2px solid
var(--line)`, ground `--paper-2`, and a **flat** `--sage` with no hatch. §J.9
argues for leaving that one exactly where it is.

**So the language is extracted, not invented.** Naming it costs one rule and
deletes two duplicates. That matters for the same reason `07-visual.md §V6`
mattered: the tokens, the mechanism and the precedent all already exist, so the
experiment is cheap and the risk of it looking foreign is nil.

## C.2 It has two rungs, and it should keep exactly two

`styles.css:87-110` argues that edges were cut to two rungs — `--edge-card` and
`--edge-lead` — because near-black at maximum weight on everything was the
loudest thing on the site. The fill language inherits that discipline, and the
two rungs are already drawn:

- **Lead rung** — 22px, 3px `--ink`, ground `--paper-3`. **One per page**, under
  the `<h1>`, in the slot `.page-sub` already occupies.
- **Section rung** — 10px, 2px `--ink`, ground `--paper`. Repeated, one per
  shift / category / day / group.

The registry already runs both at once: one `.rg-meter-bar` over all 126 slots
and eight `.rg-sect-bar`s, one per group (`src/tools/registry.js:43-52`,
`:161`). That is the shape every board-style tool should have. **Do not add a
third rung.**

## C.3 The frame is load-bearing. Measured

sRGB contrast, computed for this document, of the fill against the empty ground
it sits next to:

| Pair | Light | Dark |
|---|---|---|
| `--sage` vs `--paper-3` | **2.01:1** | **4.22:1** |
| `--sage-dark` vs `--paper-3` | **4.32:1** | **1.97:1** |
| `--ink` frame vs `--paper-3` | 8.27:1 | 9.98:1 |
| `--ink` frame vs `--sage` | 4.11:1 | 2.37:1 |
| `--ink` frame vs `--sage-dark` | 1.91:1 | 5.08:1 |

WCAG 1.4.11 asks 3:1 for a non-text graphic that carries meaning. **The hatch
does not clear it on its own in either theme** — light fails on the light
stripe, dark fails on the dark stripe. The boundary between *filled* and *not
filled* is carried by the **3px `--ink` frame**, which clears 8.27:1 and 9.98:1,
and in the notched form by the notches, which are the same ink.

Two consequences, which is why this is a section and not a footnote:

1. **The 3px frame on this component is not decoration and must not be
   quietened.** `07-visual.md §D9` asks whether 3px `--ink` should come off form
   chrome. Whatever it concludes, `.fill-track` is not form chrome, and it is
   the one place on the site where the loud edge is doing accessibility work.
   §I records this as a cross-document conflict so D9 does not have to
   rediscover it.
2. **This is a pre-existing property of `.poll-bar-track` and `.rg-meter-fill`,
   not something introduced here.** Naming the language neither creates the
   problem nor fixes it. Fixing it means moving a palette value, which belongs
   with the ink ladder at `styles.css:47-73` and its "if you lighten any of
   them, re-measure" rule — not inside a progress spec. Recorded, measured, and
   left. §J.10.

---

# D. The language

Three marks. A tool gets one of them, and which one is decided by a single
question: **is there a real M?**

## D.1 The line. Every tool has it already

The sentence is the primary carrier and the only mandatory part. Nineteen of
twenty tools already render one into `<p class="page-sub">`:

    src/tools/roster.js:246    12 of 20 spots filled · 6 shifts
    src/tools/plate.js:203     12 of 20 spots sorted · 5 categories
    src/tools/meal.js:424      9 of 21 meals covered · 7 days
    src/tools/hens.js:261      4 of 12 sorted · 3 lists
    src/tools/roles.js:140     4 of 8 roles dealt
    src/tools/coffee.js:390    5 of 8 have claimed their name
    src/tools/kringle.js:221   12 in the hat · 5 claimed so far
    src/tools/bracket.js:191   8 entrants · 4 of 7 games decided
    src/tools/fact.js:275      8 on the list · 6 joined · 4 facts in
    src/tools/giftidea.js:270  11 ideas · 3 being bought

Measured: `.page-sub` (`styles.css:318`) computes to **15.2px**, `--ink-soft`
(`#584a39`, 7.18:1 on paper), a 24.63px line box, the full 343px column at
375px.

**One change to the line, in `public/styles.css`:**

    .page-sub strong { color: var(--ink); font-variant-numeric: tabular-nums; }

which is `.rg-meter-stats strong` (`styles.css:1122`) applied one level up. The
numbers become `--ink` (10.24:1) inside an `--ink-soft` sentence, and tabular
figures stop the count jittering as it changes. `roster.js:246` and
`plate.js:203` are the first two `subLine()` functions to grow `<strong>` around
their numerals; the other eight follow the same edit.

**HEURISTIC:** that tabular numerals matter here. It is true typographically and
costs one declaration, but nobody has watched a roster count change on a phone.
The measurement that would settle it does not exist and is not worth building.

## D.2 The lead rung, notched

    <p class="page-sub"><strong>3</strong> of 7 shifts filled · 4 spots left</p>
    <div class="fill-track" style="--n:3;--m:7" aria-hidden="true"><i></i></div>

- The track is `.rg-meter-bar`'s geometry, unchanged: 22px, `3px solid --ink`,
  ground `--paper-3`.
- `<i>` is `.rg-meter-fill`'s gradient, unchanged, at
  `width: calc(var(--n) / var(--m) * 100%)`.
- The notches are an `::after` overlay: a 90° repeating gradient laying a **3px**
  `--ink` rule every `100% / var(--m)`. One element, two custom properties, no
  per-cell DOM, no JavaScript.
- `aria-hidden="true"`. The sentence directly above says the same thing, and
  `scripts/check-baked-previews.mjs:139-144` already establishes the house rule
  that the summary is the announced thing and the board is not. Announcing both
  makes a screen reader say it twice.

**Measured cell pitch at 375×812** (343px track, 6px of which is border):

| M | pitch | ink between notches |
|---|---|---|
| 6 | 56.17px | 53.17px |
| 7 | 48.14px | 45.14px |
| 12 | 28.08px | 25.08px |
| 20 | 16.85px | 13.85px |
| **24** | **14.04px** | **11.04px** |
| 40 | 8.43px | 5.43px |
| 64 | 5.27px | 2.27px |

At 1280×800 the track is 1020px and even M=64 gives a 15.84px pitch.

## D.3 The threshold: notched at M ≤ 24, smooth above it

Above 24 the `::after` is dropped and the bar becomes exactly what
`.rg-meter-bar` is today. Two reasons, one measured and one already written into
the stylesheet:

- **Measured.** At M=24 the ink between notches is 11.04px — the last M at which
  a cell is wider than the 8px hatch stripe it contains. At M=40 it is 5.43px,
  narrower than one stripe, so the notches stop reading as divisions and start
  reading as texture. Driven at 375px and screenshotted: M=64 renders as a
  barcode, and a barcode does not say "thirty-three".
- **Already decided.** `.rg-meter-fill`'s own transition is
  `width .7s steps(24, end)` (`styles.css:1119`). The file has already stated
  that twenty-four is the number of steps a bar of this width can resolve. The
  threshold is that number, not a new one.

The class is chosen from M on the server, and is the same at both widths for the
same instance. §J.6 says why it is not a media query.

## D.4 The section rung

    <h2 class="rost-shift-head">Saturday morning
      <span class="rost-count">— <strong>2</strong> of 4 filled</span></h2>
    <div class="fill-sect" style="--n:2;--m:4" aria-hidden="true"><i></i></div>

`.rg-sect-bar`'s geometry unchanged: 10px, `2px solid --ink`, ground `--paper`,
notch 2px. The per-section counts already exist as text — `.rost-count`
(`src/tools/roster.js:231`), `.plate-count` (`src/tools/plate.js:188`) — so this
adds a bar under a sentence that is already written.

Sections are per-shift, per-category, per-day, per-group. **A section is only
ever a partition the page already draws as a heading.** That is B.1 restated for
this rung, and it is why Coffee Roulette, Kris Kringle and Secret Roles get the
lead rung and no sections at all: their pages have no section headings to hang
one on, because the partition that exists is the secret.

## D.5 The full state

When N ≥ M the fill takes the gold hatch already defined for
`.poll-bar.is-leader` (`styles.css:1774-1776`):
`repeating-linear-gradient(135deg, var(--gold) 0 8px, #b5852f 8px 16px)`.

**Measured, and this is why gold is not enough on its own:** `--gold` on
`--paper-3` is **1.52:1**, `#b5852f` is **2.24:1**. The full state differs from
sage in *hue*, barely in *lightness*. A reader with deuteranopia gets very
little from it.

So **the full state must also be said in a mark or a word**, and three tools
already do exactly that:

    src/tools/roster.js:250   <span class="rost-tick" role="img" aria-label="fully staffed">✓</span>
    src/tools/meal.js:427     <span class="meal-tick" role="img" aria-label="fully covered">✓</span>
    public/styles.css:1156    .rg-sect.is-done .rg-sect-name::after { content: " ✓"; }

Adopt the `roster.js:250` form — a `✓` with `role="img"` and a real
`aria-label` — for every tool that reaches N = M, and do not rely on the gold.
Note that this `✓` is *not* `aria-hidden` and the bar *is*: the tick carries
meaning the sentence does not; the bar does not.

## D.6 The tally, for tools with no M

    <p class="page-sub"><strong>23</strong> messages so far</p>
    <div class="fill-tally" aria-hidden="true"><b></b>…×23</div>

A flex-wrapped run of 12px squares, 3px apart, in `--sage-dark`, with every
fifth square in `--sage` so a reader can count in fives. 12px is
`.rg-sect-swatch`'s size (`styles.css:1147`).

**The distinction is the whole point: a fill has a frame, so it ends. A tally
has no frame, so it does not.** A tally can never imply completion, which is
exactly what a bar with an invented denominator would do.

Measured at 375px: 15px pitch, 22 squares to a row, 12px row height — so
twenty-three messages is two rows. **Cap the tally at 40** (two rows at 375px,
one at 1280px) and let the number alone carry anything above that; past forty
squares it is a texture rather than a count, and the sentence is doing all the
work anyway.

**HEURISTIC**, and the weakest claim in this document: that a tally is worth
drawing at all. It cannot be wrong in a costly way — it adds no fact and asserts
no target — but nobody has shown that twenty-three squares moves anyone more
than the word "twenty-three". §F marks every tally as optional for that reason,
and §G.1 and §G.3 argue two tools out of it entirely.

## D.7 Dark mode: nothing to write

Every value in D.2–D.6 is a token that already flips at `styles.css:149-163`.
Driven at 375px in dark: the frame and the notches become cream `--ink`
(`#f0e4d0`, 9.98:1 on the dark `--paper-3`), the ground becomes `#383044`, the
sage hatch is unchanged, and the mark reads correctly with **zero dark-mode
overrides**. That is a property of building it out of the ladder rather than out
of new values, and it is the main argument for adding no colour token.

The one honest caveat is §C.3: in dark, `--sage-dark` measures 1.97:1 against
the dark ground, so half the hatch period nearly vanishes and the frame is doing
the work. Pre-existing in `.poll-bar-track`. Not fixed here.

## D.8 Print: the bar is never the only carrier

Nineteen `@media print` blocks exist in `public/styles.css`, at lines 708, 932,
1005, 1068, 1350, 1445, 1531, 1607, 1717, 1807, 1884, 1989, 2051, 2165, 2209,
2254, 2319, 2396 and 2667. Every selector inside them was extracted and read.

**Which tools have print rules of their own**, beyond the global block at `:708`
that hides `.btn`, `.site-head`, `.share-box`, `.share-nudge`,
`.organiser-banner`, `.organiser-actions`, `.card-preview` and `.page-foot` on
every page:

| | tools |
|---|---|
| **Has its own print rules — 17 of 20** | baby, bracket, card, coffee, fact, giftidea, hens, kringle (`.kk-reveal` at `:712`), kudos, meal, plate, poll, qotd, recipe, registry (`.rg-garage` at `:713`), roster, sweep (`.draw-card` at `:714`) |
| **None at all — 3 of 20** | **roles**, **pulse**, **poker** |

Two things those blocks establish by example, both of which the fill inherits:

1. **Print rules restate colours literally.** `.poll-bar-track { border-color:
   #000 }` and `.poll-bar-track > i { background: #ddd }` (`:1809-1810`);
   `.bracket-side.is-winner { background: #ddd; color: #000 }` (`:1008`);
   `.plate-slot { border-color: #000 }` (`:933`). None of them trusts a token,
   and they are right not to: `@media print` does not reset
   `prefers-color-scheme`, so a reader whose OS is dark prints `--ink` as cream
   `#f0e4d0` and `--paper-3` as `#383044`. A cream notch on white paper is not
   there. **The fill's print rule must name `#000` and `#ddd` outright.**
2. **The page must still read with the background missing.** Browsers omit
   background images and colours from print by default. Everything the fill
   draws — the ground, the hatch, the notches — is a `background`. Only the
   border survives reliably.

So the print rule is:

    @media print {
      .fill-track, .fill-sect { border-color: #000; background: #fff; }
      .fill-track > i, .fill-sect > i { background: #ddd; }
      .fill-tally b { background: #ddd; outline: 1px solid #000; }
    }

and the doctrine around it is: **the sentence carries the state; the bar is
never the only thing that says it.** With backgrounds on, the notches print at
15.46:1 against the `#ddd` fill and stay countable — that was driven and
screenshotted. With backgrounds off, the bar prints as an empty outlined box and
"3 of 7 shifts filled" is still there in words. Both are acceptable outcomes. A
bar carrying the state alone would not be.

`.fill-tally b` gets an `outline` rather than a border because an outline does
not change the box size, so the wrap point is identical on screen and on paper.

## D.9 Where the rules and the markup live

- **`public/styles.css`** — one new section: `.fill-track`, `.fill-sect`,
  `.fill-tally`, plus the print block. `.rg-meter-bar` (`:1112`) and
  `.poll-bar-track` (`:1768`) collapse into `.fill-track`; `.rg-sect-bar`
  (`:1150`) into `.fill-sect`. Per the standing instruction in
  `07-visual.md §C`, the comment above the new section has to carry the
  reasoning currently spread across those three, in the same voice and with the
  measurements from §C.3 and §D.3 — and the `styles.css:87-110` two-rung
  argument has to be extended in prose to cover the fill, since D.2 and D.4 are
  a deliberate application of it.
- **`src/lib.js`** — one exported helper beside `ownCta` (`:214`), `shareNudge`
  (`:247`) and `cardPreview` (`:410`), which are the three existing
  shared-render helpers. It takes `{ n, m }`, returns the track or nothing, and
  picks notched or smooth from M. Returning nothing when `m` is falsy is what
  makes §H work.
- **Per tool** — each `subLine()` or its equivalent calls it. Nine tools already
  have a function with that exact name: `bracket.js:191`, `card.js:154`,
  `giftidea.js:270`, `hens.js:261`, `meal.js:424`, `plate.js:203`,
  `recipe.js:212`, `roster.js:246`, `sweep.js:148`.

---

# E. Three shapes, and the question that sorts them

`scripts/stats.mjs:10-25` sorts the twenty tools by **how participation is
stored**. That is the right sort for a stats query and the wrong one here. For a
fill the sorting question is different and simpler:

> **Did the organiser declare a total when they made the thing?**

| Shape | What it gets | Count |
|---|---|---|
| **Bounded** — M is declared at create and cannot be inferred from anything else | lead rung, plus section rungs where the page already has section headings | **11** |
| **Unbounded** — people add items; there is no total and never was | the line, plus an optional tally | **6** |
| **Finished at birth, or deliberately silent** | the line only | **3** |

The two sorts disagree, usefully. Bring a Plate and Kris Kringle sit in
different `stats.mjs` groups (claims vs. participants) and in the same group
here. Gift Ideas sits in *one* `stats.mjs` group and lands in *two* here,
because its two halves have different answers — §F.14.

**The trap this taxonomy exists to close.** Every unbounded tool has a storage
ceiling, and a ceiling is not a denominator:

    card     MAX_MESSAGES 400   (src/tools/card.js:23)
    recipe   MAX_RECIPES  200   (src/tools/recipe.js:35)
    baby     MAX_GUESSES  300   (src/tools/baby.js:26)
    giftidea MAX_IDEAS    200   (src/tools/giftidea.js:36)
    poll     MAX_VOTERS   2000  (src/tools/poll.js:36)
    qotd     MAX_VOTES    2000  (src/tools/qotd.js:59)
    kudos    MAX_ROWS     3000  (src/tools/kudos.js:33)
    poker    MAX_VOTERS   60    (src/tools/poker.js:41)

"23 of 400 messages" is a true sentence and a terrible one: it tells a group
signing a leaving card that they are 6% of the way to something. **A fill drawn
against a ceiling is the fake fill this document exists to prevent.** §J.3.

---

# F. All twenty, one at a time

Every entry names its file. `subLine` refers to the function of that name in
that file where one exists.

### F.1 sweep — `src/tools/sweep.js`

**No fill.** Finished at birth. The draw happens at create and `sweep.js:29-31`
records that *"the whole board is always sold"* — every outcome has a name
before the link is copied. N = M in the first second, so a bar would read 100%
forever and mean nothing. `subLine` (`:148`) already says "24 outcomes · 18 in
the draw", which is the whole truth about a sweep. This is also the tool with no
other signal at all (`stats.mjs`'s `UNMEASURABLE` set), and §B.4 declines to
draw `first_opened_at`. **Sweep gets the line, unchanged.**

### F.2 kringle — `src/tools/kringle.js`

**Bounded. Lead rung, no sections.** N = participants with `claimed_at`
(`:205`), M = `parts.length` (max 100, `MAX_NAMES` at `:17`). Notched below 25
names, which is the overwhelming majority of Kringles. The `/s/` page already
publishes every name's claimed state at `:207-215`, so B.1 is satisfied by
inspection. **Never segment.** On `/e/` the organiser table already shows
claimed and viewed per name — the FAQ promises exactly that — so a second lead
rung for "opened their page" is permitted there and nowhere else: it is a
rendering of the column beside it.

### F.3 roles — `src/tools/roles.js`

**Bounded. Lead rung, no sections.** N = `COUNT(*) WHERE claimed_at IS NOT NULL`
(`:130-132`), M = `data.total` (max 40, `MAX_ROLES` at `:14`). Always notched.
The sentence is at `:140`. **Never a per-role fill**: the page publishes no
names and no roles, so any partition is a new fact (B.1). When N = M the page
already hides the join form (`full` at `:133`); add the `✓`.

### F.4 plate — `src/tools/plate.js`

**Bounded. Lead rung + section rung per category.** N = `claims.length`,
M = `Σ capacity` (`subLine` at `:203`, max 12 × 20 = 240). Section counts
already render at `:188` inside `.plate-count`; the section rung goes under each
`.plate-cat-head`.

### F.5 bracket — `src/tools/bracket.js`

**Bounded. Lead rung.** N = matches with both entrants and a winner, M =
entrants − 1 — both already computed in `subLine` (`:191-199`), which also
excludes byes correctly. Max 63 games (`MAX_ENTRANTS` 64 at `:22`), so smooth
above 25 entrants. **The one tool whose fill the organiser moves rather than the
group**: results are recorded on `/e/` only (`publicPage(row)` at `:245` takes
no `env`). Per-round section rungs are available and **not recommended** —
`.bracket-col` already shows a round's state by drawing it, and a bar under each
column is a second copy of a picture that is already there.

### F.6 card — `src/tools/card.js`

**Unbounded. Line, tally optional.** `subLine` (`:154`) says "23 messages so
far". `MAX_MESSAGES` 400 is a ceiling (§E). If the tally ships anywhere, this is
its best case: a card fills up, and the visual of it filling up is the tool.

### F.7 registry — `src/tools/registry.js`

**Bounded. Lead rung (smooth) + 8 section rungs. Already built.** M = 126
(`SLOT_COUNT` at `:161`), 8 groups (`GROUPS` at `:43-52`). The meter at
`:480-482` is the lead rung; the eight `.rg-sect-bar`s are the section rungs.
**The change here is renaming, not redesigning** — `.rg-meter-bar` →
`.fill-track`, `.rg-sect-bar` → `.fill-sect`. The Prado canvas, the money line
and the "60% built" percentage all stay: money is genuinely continuous, which is
the one case where a percentage is honest (§J.2). This tool is the reference
implementation and `02-diagnosis.md` treats it as one of the strongest things on
the site; nothing here should make it worse.

### F.8 fact — `src/tools/fact.js`

**Bounded, two-stage. Lead rung on the final stage.** M = `parts.length`
(max 60, `MAX_NAMES` at `:29`). The page already publishes three numbers at
`:275` — on the list, joined, facts in — and each name's stage at `:262-269`.
**The bar counts facts in**, because that is what the reveal waits for; the
other two numbers stay in the sentence. Do **not** two-tone the bar to show
joined-but-not-submitted: it doubles the encoding for a distinction the sentence
already makes, and the two-tone would have to survive §C.3's contrast problem
twice.

### F.9 baby — `src/tools/baby.js`

**Unbounded. Line, tally optional.** `:286` — "7 guesses in". `MAX_GUESSES` 300
is a ceiling. There is a second state worth nothing to a bar: `data.result`, the
recorded arrival, which is binary and already said in words at `:464`.

### F.10 roster — `src/tools/roster.js`

**Bounded. Lead rung + section rung per shift.** N = `claims.length`,
M = `Σ capacity` (`subLine` at `:246`). Max 50 × 30 = 1500, so a large club
roster is smooth and a school fete roster is notched. Section counts already
render at `:231` inside `.rost-count`. `.rost-tick` at `:250` is the `✓`
precedent D.5 adopts.

### F.11 meal — `src/tools/meal.js`

**Bounded, two boards. Lead rung on meals; section rungs on both.**
`mealClaimCount` (`:113-114`) already separates day slots (`d…`) from job slots
(`t…`). M for meals is `dates.length × capacityPerDay` (`:425`, max 60 × 3 =
180); M for jobs is `Σ task.capacity` (max 12 × 20 = 240). **One lead rung, and
it counts meals** — the tool is a meal train, the jobs are the "other ways to
help" section, and two lead rungs would put the page in the position of asking
which number is the score. Jobs get section rungs under `.meal-section-h`.
`.meal-tick` at `:427` is already there for N = M.

### F.12 poll — `src/tools/poll.js`

**No lead fill. The section rung is already the whole tool.** Voters are
unbounded (`MAX_VOTERS` 2000 at `:36` is a ceiling). The per-option bars at
`.poll-bar-track` (`styles.css:1768`) are *shares of votes cast*, not progress
toward a target — a different denominator that happens to be drawn with the same
mark, which is correct and is where the mark came from. **Change nothing except
the class name.** A lead bar above them would put two bars with two different
denominators on one page, which is how a reader learns to distrust both.

### F.13 recipe — `src/tools/recipe.js`

**Unbounded. Line, tally optional.** `subLine` (`:212`) — "9 recipes in".
`MAX_RECIPES` 200 is a ceiling.

### F.14 giftidea — `src/tools/giftidea.js`

**Both shapes at once, and the interesting case.** `giftidea.js:1-21` describes
two mechanics on one board: suggest-and-vote (`participants`, unbounded) and
claim-to-buy (`claims`, bounded by the number of ideas).

- **Suggest half: no fill.** One of the three `stats.mjs` names with no
  `claimed_at`, and it has no M. See §G.3.
- **Claim half: lead rung.** N = `claims.length`, M = `ideas.length` — both
  already in `subLine` (`:270-273`), which reads "11 ideas · 3 being bought".
  Render the bar only when M ≥ 1; a bar of 0 of 0 on a fresh board is noise.

The board is shared with everyone except the recipient, so a bar over ideas adds
nothing the page does not already list idea by idea. B.1 holds.

### F.15 hens — `src/tools/hens.js`

**Bounded. Lead rung + section rung per list.** Mechanically identical to plate:
N = `claims.length`, M = `Σ capacity` (`subLine` at `:261`, max 12 × 20 = 240).
The kitty (`.hens-kitty`) and the agenda (`.hens-agenda`) are text, carry no
count, and get nothing.

### F.16 qotd — `src/tools/qotd.js`

**No lead fill. Per-option bars only, as poll.** Votes per day are unbounded,
and `MAX_VOTES` 2000 (`:59`) is a storage cap whose companions `PRUNE_AT` and
`PRUNE_TARGET` (`:61-62`) shed old rows — so even the raw count is not stable
over time, and a fill built on it could go *down*. The `.qotd-bar` family
already draws each day's answers. The sentence at `:1102` stays.

### F.17 coffee — `src/tools/coffee.js`

**Bounded. Lead rung, and nothing else, ever.** N = claimed names, M =
`data.names.length` (max 200, `MAX_NAMES` at `:31`), already stated in words at
`:390`. The `/s/` page publishes per-name claim state at `:253-266`, so the lead
rung is a rendering of the page. **This is the tool B.1 was written for.**
`data.groups` is the assignment; a per-pair fill sitting beside the per-name
list is differenceable in one page reload. No section rungs. No per-round bar.
No "3 of 4 pairs have met".

### F.18 pulse — `src/tools/pulse.js`

**No fill.** §G.2 — the argument is already in the file.

### F.19 kudos — `src/tools/kudos.js`

**No fill; tally not recommended.** §G.1.

### F.20 poker — `src/tools/poker.js`

**No fill. Change nothing.** `team` is a *name string* capped at 60 characters
(`:38`, `parseCreate` at `:107`), not a headcount, and `MAX_VOTERS` 60 (`:41`)
is a ceiling — so there is no denominator anywhere in the tool.
`<strong>N</strong> votes in` (`:332-334`, `:401`) is already the right sentence.

A tally would be *safe* — `state()` at `:186-199` already publishes the count
and the names of who has voted, so B.1 permits it — and it is still the wrong
idea. The page's entire discipline is that **the only fact published before a
reveal is how many** (`:8-12`), and a growing row of squares during a live
estimation invites reading a pattern into something that has none. It also
repaints every two seconds, which is the one animation on the site that would be
genuinely distracting.

*Not in `TOOLS`, and therefore not in this spec:* team-picker
(`public/team-picker.js`, client-only, no instance row) — noted only because it
has print rules at `styles.css:1350` and looks like a twenty-first tool when you
read the stylesheet.

---

# G. The three that record nothing, and what they do instead

`scripts/stats.mjs:10-25` names three tool types that write `participants` rows
with **no `claimed_at` stamp** — `giftidea` (suggest), `kudos`, `pulse` — which
is why the stats query needs a third branch for them. That is a statement about
the schema. The question here is different: what should the page draw?

For all three the answer has the same shape: **there is no M, there was never
going to be an M, and the honest thing is to draw no bar.** They differ in what
they get instead.

## G.1 kudos — the wall is the fill

`src/tools/kudos.js`. A note is written, it appears, and next week starts a new
group (`currentWeek()` at `:63`, the `<details>` per past week at `:264`).
`MAX_ROWS` 3000 is a ceiling.

**What it does instead: nothing new.** The wall of notes *is* the visual state —
more notes, more wall — and it does not need a second drawing of itself. A tally
is technically available and is **not recommended**: three squares under "3
notes" on a wall built to feel generous reads as a scoreboard with a low score
on it, and the failure mode of a kudos wall is people deciding it is not worth
adding to. `05-tools.md` owns whatever the invitation should say; this
document's contribution is the argument against putting a number-shaped graphic
next to it.

**HEURISTIC**, plainly. Nobody has watched anyone decide not to write a kudos
note. What is not heuristic: the tool has no denominator, so any bar would be
against a ceiling, and §E rules that out on grounds that need no data.

## G.2 pulse — the file already argued this, correctly

`src/tools/pulse.js:415-421` renders the live count inside `.pulse-hold` with
this text:

> "This week's numbers stay closed until Monday. A figure that moves every time
> somebody answers tells you what they answered — so the week is published once
> it is finished and can no longer be watched."

That is the differencing attack described precisely, in the product's own voice,
on the page. `public/index.html:237` promises "Genuinely anonymous", and
`02-diagnosis.md §I.2` records that `llms.txt` goes further and withholds weeks
with fewer than four responses — both claims about architecture, both already
indexed.

**What it does instead: nothing.** The response count stays where it is, as
text, in `.pulse-hold`. The published week already has `.pulse-bars`
(`styles.css:2348-2353`), which draw a *distribution of a closed week* — not
progress, not live, and deliberately a different mark. §J.9 leaves that mark
alone precisely so a closed distribution never looks like a completion.

There is no denominator anyway: a pulse has no roster. Even if it were safe, it
would be impossible.

## G.3 giftidea (suggest) — half a tool gets half a language

`src/tools/giftidea.js`. An idea is a `participants` row with `name` left blank
(`:7-10`), so ideas are unbounded and duplicates are allowed on purpose.
`MAX_IDEAS` 200 is a ceiling.

**What it does instead: the vote bars it already has.** `voteBar()` at `:283-291`
draws `.gi-votebar` per idea. Those are a *ranking*, which is what a suggestion
board is for — the useful question is "which idea is winning", not "how many
ideas are there". A tally of ideas answers a question nobody asked.

And then the *other* half of the same tool gets the full lead rung, because
claim-to-buy has a real M (§F.14). One tool, one page, one bar, drawn over the
half that has a total. That is the language working correctly rather than a
special case being carved out for it.

---

# H. Degrading when there is no signal

Four failure modes and what each renders. The helper in `src/lib.js` returns
nothing rather than a zero in every one of them, which makes this a property of
the design rather than twenty separate `if` statements.

| Condition | Renders |
|---|---|
| **M unknown, zero, or not applicable** (every unbounded and silent shape in §E) | the sentence, no track |
| **M known, N = 0** | the full empty track, notched if M ≤ 24. Driven at 375px, an empty notched bar reads as *"six spaces waiting"*, which is the correct message on a fresh board and the one case where drawing zero is right |
| **`first_opened_at` is NULL** — including every row created before migration 0004, which will never get one | nothing at all. Never "not opened yet". §B.4 |
| **A row whose stored `data` predates a shape change** (no `capacity`, no `total`) | `m` is falsy, the helper returns nothing, the page renders exactly as it does today |

The third row matters most and is the easiest to get wrong, because a NULL
meaning *"we did not have this column when this was made"* and a NULL meaning
*"nobody came"* are indistinguishable in the database and opposite in meaning.
`scripts/stats.mjs` handles it by saying so in its output footer. A page cannot
say so. So a page does not say anything.

---

# I. Constraint audit

Every constraint this design could break, checked against the thing that would
reject it. Each script was **read for this document**, not assumed from its
name. `docs/review/02-diagnosis.md §I` is the source of the first five rows and
is binding.

| Constraint | Source, read | Verdict |
|---|---|---|
| **`02-diagnosis.md §I.1` — link previews carry no state** | `src/lib.js:330-345`, `SHARE` at `:348`, `shareTags()` at `:376`, `cardPreview()` at `:410` | **HELD, and this is the row to re-check on every future change.** The fill renders in `<body>` only. It never enters `SHARE`, the OG description, the Twitter card or any `og:image`. The comment's own words — *"If you are tempted to make a card more useful by putting the state of the thing in it, don't"* — describe this feature exactly, which is why it is first. |
| **`02-diagnosis.md §I.2` — the organiser cannot see who drew whom** | `src/tools/kringle.js:205-215`, `coffee.js:253-266`, `roles.js:129-141`, all three read in full | **HELD by construction.** B.1 permits only numbers already countable on the same page. Kringle and Coffee publish per-name claim state, so their lead rung re-renders it; Roles publishes a count and no names, so it gets the same count. **No sub-fill on any of the three.** The specific attack refused: a per-pair Coffee fill differenced against the per-name list identifies a pairing in one reload. |
| **`02-diagnosis.md §I.3` — no analytics on `/s/`, `/e/`, `/p/`; no per-view logging** | `migrations/0001_init.sql:34-40`; `public/index.html:355-361` | **HELD.** Server-rendered into the response that asked for it. No endpoint, no beacon, no `fetch`, no interval, no `events` row, no new column. The only tool that polls (poker, `:178-199`) is the one §F.20 leaves untouched. |
| **`02-diagnosis.md §I.4` — `check-claims.mjs`** | `scripts/check-claims.mjs:34-42`, all seven patterns read | **Not engaged.** "12 of 20 spots filled" matches none of `no fee(s)`, `fee-free`, `free forever`, `always free`, `never charge`, `will never cost`, `100% free`. No sentence in this spec makes a promise about pricing. |
| **`02-diagnosis.md §I.7` — "See a finished X →" on 21 of 22 tool pages** | `class="see-example"` → `/s/demo-*` | **Improved, not touched.** A demo page with a fill on it is a better answer to *what do I actually get*. No link changes. |
| **`02-diagnosis.md §I.8` — the baked first frame of the live preview** | `scripts/check-baked-previews.mjs` read in full; `scripts/gen-live-preview.mjs`; `public/preview/slots.js:65` | **ENGAGED, and the design steps around it deliberately.** Six builders have live previews (`LIVE` at `:113-120`: roster, meal, plate, hens, kringle, bracket). The check enforces that the board must **not** be `aria-live`, the summary **must** be `aria-live="polite"`, the block may contain no form control and no heading, and the baked markup must equal `firstFrame()` from `public/preview/<tool>.js`. **Recommendation: the fill does not enter the live preview in this pass.** §J.1. |
| `scripts/check-line-endings.mjs` | read; `TEXT` includes `.md` at `:23-24`, `walk(".")` at `:39` covers `docs/` | **ENGAGED by this file.** `docs/review/08-fill.md` is itself in the build chain — `npm run eol`, first in `build`. Written LF. |
| `scripts/gen-markdown.mjs` | read; `SKIP_CLASSES` at `:33-41` | **Not engaged as specified.** It reads `public/**/*.html`; the fill lives in server-rendered `/s/` and `/e/` output, which it never sees. **If a future change puts a fill in a builder page**, `fill-track` must join `SKIP_CLASSES` or the Markdown twin gains an empty div. Recorded so it is not rediscovered. |
| `scripts/check-share-nudge.mjs` | read in full | **Not engaged.** No `shareNudge()` call gains or loses an argument. |
| `scripts/check-poker-summary.mjs` | read in full | **Not engaged, deliberately.** It reads `DECKS`, `NON_NUMERIC`, `deckOf` and `summarise` out of `src/tools/poker.js` by regex and fails loudly if any is renamed. §F.20 recommends changing nothing in that file, which is the only way to be certain of this row. |
| `scripts/builder-above-fold.mjs` | reordering happens inside `<form>` | **Not engaged.** No fill sits in a form, per the `§I.8` row above. |
| `scripts/gen-api-docs.mjs`, `scripts/check-mcp-routes.mjs` | `gen-api-docs.mjs:22-32` fails the build on a `TOOLS` entry missing from `scripts/api-tools.json` | **Not engaged**, because the design adds no endpoint. **It would be engaged** by any client-painted fill needing `/api/<tool>/:slug/state` — a second reason §B.3 renders server-side. |
| `scripts/check-hero-loading.mjs`, `check-seasons.mjs`, `check-qotd-preview.mjs`, `sync-card-copy.mjs`, `sync-example-links.mjs`, `sync-example-names.mjs` | headers read | **Not engaged.** None reads a bar, a count or a `subLine`. |
| `scripts/audit-hidden-features.mjs` | read; its own header at `:8-10` states it is **not** in the build chain | **Not engaged**, and would not fail if it were: a fill is a graphic, not capability described only inside form furniture. |
| `scripts/stats.mjs` | read in full | **Not engaged, and must stay that way.** `REACHED` and `COLD` are query predicates over `claims`, `participants` and `first_opened_at`. Nothing in this spec changes a write, so no number in `stats.mjs` moves. A fill that made a tool write a row in order to make itself drawable would corrupt the only measurement the site has. |
| **`07-visual.md §D9` — quieten form controls** | `styles.css:87-110`; §C.3 above | **CONFLICT, recorded here so D9 does not have to find it.** The 3px `--ink` frame is the only thing carrying the filled/empty boundary at ≥3:1 in either theme (§C.3: the hatch measures 2.01:1 light and 1.97:1 dark against its own ground). `.fill-track` is not form chrome and must be excluded from any quietening. |
| **`07-visual.md §D6` — one meaning for a dashed border** | §V3's four-way sort | **Compatible, and helpful.** The fill uses no dashed border, so the count of 29 is unchanged. It also gives D6's hardest row — *claimed* vs *empty* drawn identically — a second channel: inside a bar, taken and open differ by position, not only by the words inside them. |
| **`07-visual.md §F.5` — the pixel art is not in scope** | — | **HELD.** No icon, hero, OG image or `gen-art.mjs` output is touched. The registry's Prado canvas keeps every pixel. |

**One thing checked that is not a constraint but reads like one.**
`scripts/stats.mjs:10-25` enumerates the participation shapes tool by tool and
does not list `poker` in any of the three groups, although `src/tools/poker.js:157`
and `:171` both write `participants` rows with `claimed_at` set. The generic
`participants … claimed_at IS NOT NULL` branch of `REACHED` catches it, so the
query is right and only the comment is short a name. Nothing in this document
depends on it; recorded because it was found while reading, and a comment that
enumerates is a comment that can fall behind.

---

# J. What I deliberately did not recommend

1. **A fill in the six builders' live previews.** `roster`, `meal`, `plate`,
   `hens`, `kringle` and `bracket` all have one
   (`check-baked-previews.mjs:113-120`). A preview describes a board that does
   not exist yet, so N is structurally 0 and the bar would be empty on every
   builder on the site. It is also the one place the fill would cost build
   machinery — `public/preview/slots.js`, `gen-live-preview.mjs` and a re-bake —
   for the least return.

2. **A percentage anywhere except the registry.** "3 of 7" is not "43%". The
   registry earns its percentage (`public/registry-view.js:91-100`) because it
   measures *money*, which is continuous, and it already handles the honest edge
   case: `if (pct === 100 && claimed !== SLOTS.length) pct = 99;` — *finished
   means finished*. A roster spot is not divisible and a percentage of one is a
   false precision.

3. **A denominator taken from a storage ceiling.** Enumerated with line numbers
   in §E. This is the single most likely wrong implementation of this spec,
   because every one of those constants sits right there in the file and looks
   exactly like an M.

4. **Any per-group, per-pair or per-role fill on Coffee Roulette, Kris Kringle
   or Secret Roles.** §B.1, and the second row of §I. Not a tuning decision:
   there is no granularity at which it is safe.

5. **`first_opened_at` rendered anywhere.** §B.4. Three independent reasons — it
   is one bit, pre-0004 rows never get one, and a link unfurler's `GET` sets
   it — and any one of them is enough on its own.

6. **Notched on desktop, smooth on mobile.** Tempting: at 1280 the track is
   1020px and M=64 still gives a 15.84px pitch, so desktop could always notch.
   Rejected because the same instance would then be two different pictures to
   two people in one group chat, and these pages get screenshotted and pasted
   around. The class is chosen from M on the server and is the same everywhere.

7. **A new colour token.** `--sage`, `--sage-dark`, `--gold`, `--paper-3` and
   `--ink` already draw all three marks in both themes with zero overrides
   (§D.7). Adding a "progress green" would put a sixteenth value into a ladder
   whose comment at `styles.css:47-73` says *"if you lighten any of them,
   re-measure — do not eyeball it"*, to solve a problem that does not exist.

8. **Animating the fill on load.** The existing transitions
   (`steps(24, end)` at `styles.css:1119`, `steps(16, end)` at `:1772` and
   `:1151`) fire on *change*, which is right. A bar that animates from zero on
   every page load tells a returning organiser that something just happened when
   nothing did, and it re-enters the layout-shift territory
   `scripts/check-qotd-preview.mjs` was written about.
   `prefers-reduced-motion` at `styles.css:718-720` already kills all of it,
   which is the correct floor.

9. **Folding `.pulse-bar` into the language.** `styles.css:2351-2352` is a third
   bar — 14.39px, `2px solid --line`, ground `--paper-2`, flat `--sage`, no
   hatch — and it does not match the other two. It stays exactly as it is,
   because it draws the **distribution of a closed week**, not progress toward
   anything, and making it look like the completion mark would make an anonymous
   distribution read as a score. The inconsistency is the point.

10. **Fixing the hatch's contrast.** §C.3 measures `--sage` at 2.01:1 against
    `--paper-3` in light and `--sage-dark` at 1.97:1 in dark. Both sit below
    WCAG 1.4.11's 3:1 for a meaningful graphic, both are pre-existing in shipped
    components, and the frame carries the boundary at 8.27:1 and 9.98:1. Fixing
    it means moving a palette value, which belongs with the ink ladder and its
    re-measure rule, not inside a progress spec. Measured, recorded, left — the
    same treatment `07-visual.md §A.3` gave `--gold-ink` before D1 fixed it.

11. **Raising `--edge-card` to compensate anywhere.** The same reasoning
    `07-visual.md §E` gives at the end of its own audit: `styles.css:87-110`
    argues that dropping containers to two rungs was the correction, and putting
    weight back into containers re-makes that mistake at one remove.

12. **A third rung.** Two, and only two, for the same reason the edges have two.

---

*Measured 31 August 2026 against the working tree, at 375×812 and 1280×800, in
both colour schemes, with the proposed marks injected into a live page against
the real `public/styles.css`. Where this document says HEURISTIC, it means it.
Nothing here has been written to `public/styles.css`, `src/lib.js` or any tool.
This document ends in a specification, not a diff.*
