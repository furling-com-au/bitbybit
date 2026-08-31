# The visual layer — bitibybit.com

Written against `docs/review/01-evidence.md` (facts) and `02-diagnosis.md`
(settled positioning). Neither is re-derived. `03-ia.md` owns the homepage's
information architecture, `04-copy.md` owns its words, `05-tools.md` owns the
tool funnel, `06-roadmap.md` owns sequencing.

This document owns the part none of them do: **type, colour, weight, density,
edges and vertical rhythm.** It proposes no new tools, no new sections, no new
copy and no IA change. Where it touches something those documents settled, it
says so and defers.

Four rules held throughout:

- **Nothing claims observed behaviour.** `.stats-history.jsonl` still has one
  row. Where I reason from heuristic it says **HEURISTIC** and names the
  measurement that would settle it.
- **Every recommendation names a file**, and the constraint audit in §E checks
  it against the script that could reject it.
- **Contrast is computed, not eyeballed** — the same standard `styles.css:60-73`
  sets for itself.
- **Every prompt in §D carries a model and an effort**, and §C says why that one
  and not another.

---

# 0. What landed, what is in flight, and what this document got wrong

Added 31 August 2026, after §D was executed. The findings and prompts below are
left as they were written — this section records what happened to them, so that
nobody reads a prompt as outstanding when it has shipped, or as shipped when it
has not.

## 0.1 Status

| | Task | Model · effort | Status |
|---|---|---|---|
| D1 | `--gold-ink` | Haiku 4.5 · low | **Landed.** `#ab7613` → `#7c560e`, measured 5.51:1 / 5.03:1 |
| D2 | Promote the section headings | Sonnet 5 · medium | **Landed.** Base `h2` 1.3rem sentence case `--ink`; shelf 18.4px at 375px, 20.8px desktop |
| D3 | Retire the badge | Haiku 4.5 · low | **Landed.** 53 HTML files, `src/lib.js`, and the rule |
| D4 | Reclaim the fold | Opus 5 · high | **Pass 1 not achieved, correctly** (§0.4). **Pass 2 achieved** (§0.6) |
| D5 | Made-strip vs. builder button | Opus 5 · high | **Landed and independently verified.** The strip's cost to every submit button is now exactly zero |
| D6 | One meaning for a dashed border | Sonnet 5 · medium | **Landed.** 29 declarations → 9, all empty states |
| D7 | Tap targets to 44px | Haiku 4.5 · low | **Landed, then found incomplete.** Report lost (§0.5); scope gap found by the verifier and closed (§0.7) |
| D8 | Hue the shelf | Sonnet 5 · medium | **Landed.** Five hues on 22 cards, no new tokens; feature card left uncoloured |
| D9 | Zone the pixel grammar | Opus 5 · xhigh | **Decided and applied.** 12 fields off the third rung; elevation is now the lever |
| D10 | One fill language | Opus 5 · xhigh | **Landed.** `docs/review/08-fill.md`, 909 lines |
| D11 | The shared page as a poster | Opus 5 · xhigh | **Landed as a CSS pass.** `fillTrack()` exists in `src/lib.js`; no tool calls it yet (§0.8) |

All eleven have now run. Every number in §0.6 was re-measured by an independent
verifier that edited nothing, and matched to four significant figures.

## 0.2 Corrections to this document

Four things here were wrong, and the work found them:

1. **V3 undercounted, twice.** It was first written naming five dashed rules;
   the real count was 29. The corrected V3 below sorts those 29 into four jobs
   — and D6 found even that sort short by three. `.rg-part.taken` and
   `.rg-part-claimedby` are exactly the "taken" and "who-claimed-it" patterns
   V3 describes and were never listed, and `.live-preview` is not an empty
   state as V3 implied — that is `.live-preview-empty`, which was already plain
   unbordered text and needed no change. `.live-preview` was a notice panel
   drawn dashed for no recorded reason.

2. **§D3's file list was incomplete.** It named `public/index.html` and the tool
   pages. The badge also shipped from `src/lib.js`, which put it on every
   `/s/`, `/e/` and `/p/` render — so the participant surface carried a beta
   warning too. 53 HTML files plus `lib.js`, not 22 pages.

3. **§A.1 conflated two states.** The figures recorded there (first card 1153px,
   occasion row 589px) are the **populated** made-strip state. Empty measured
   979 / 400. The document never distinguished them, and that distinction turned
   out to decide D4 entirely — the page a stranger sees and the page a returning
   organiser sees are 189px apart.

4. **§D4 set a target that could not be met**, and did not know it. See §0.4.

## 0.3 New findings, from doing the work

Numbered on from §B. These were not visible from reading the stylesheet; each
came out of applying a change and measuring the result.

**V9. A descendant selector was shrinking the one thing the homepage promotes.**
The phone override was written `#tools h2`. `.feature-card` sits *inside*
`#tools`, so the ID beat `.feature-card h2`'s single class and the seasonal
card's title rendered at **11.84px at 375px** — the promotional slot, drawn as
an eyebrow. Pre-existing: the old `.74rem` override had the same bug and it was
never caught, because a heading that small on a card that loud reads as a
deliberate eyebrow rather than as broken. Both shelf rules are now scoped with a
child combinator (`#tools > h2`). **Do not loosen that combinator.**

**V10. Both bands above the shelf are far over their own design budgets.**
Measured: the occasion row is 161px against the ~90px `03-ia.md §E.2` budgeted,
and the seasonal card is 309px against ~200px in `§C.5`. The card's excess is a
**layout bug, not fat**: `grid-template-columns: 1fr auto` with the art at
`clamp(96px, 18vw, 150px)` leaves the text column ~183px wide at 375px, so the
blurb wraps to about seven lines and the title to two.

**V11. The fold target is unreachable for a returning organiser, at any price.**
D4 proved it arithmetically and then checked it empirically rather than resting
on the arithmetic — with `.feature-card` forced to `display: none` the first
card still sat 48px below the fold. Extending that proof with every lever since
authorised (both bands to budget, a three-line lede, the made-strip deleted
outright) reaches ~724px against a ≤693px requirement. **For the populated
state, the goal is not merely unmet; it is not available.** The empty state is
reachable and is being attempted.

**V12. Tap-target compliance and the router budget are in direct conflict.**
D7 raised `.occasion-pill` from 39.1px to 44px, which takes the occasion row
from 161px to **176px** — D7 grew the exact band V10 says is over budget.
Reaching ~90px needs one row; six pills at the settled `04-copy` labels need
~726px of width against 343px available, so one row exists only as a horizontal
scroller, which would hide two thirds of the router. **The ~90px budget in
`03-ia §E.2` is not achievable at 375px and should be revised rather than
chased.** Accessibility wins this one; the budget was written without it.

**V13. There is an undeclared third edge rung, and it is on every text field.**
Inputs and textareas carry `3px solid var(--line-firm)` — that is
`--edge-lead`'s *width* in `--edge-card`'s *colour*, in a file whose `:root`
comment argues for exactly two rungs. It is also **wider than the panel
containing it** (3px inside a 2px box). Measured painted edge area at 375px:
fields outpaint buttons **8.9:1** on `/gift-registry/`, 7.0:1 on `/meal-train/`,
5.1:1 on `/kris-kringle/`, 2.2:1 on `/bring-a-plate/`.

This **falsifies a prediction the file makes in prose**: "Buttons are
deliberately untouched: they were already 3px, so they lead the moment the cards
stop shouting." They do not lead, and could not — they were outpainted two to
nine to one by the fields above them. Two call sites had already escaped the
third rung independently (`.count-field select`, `.panel`), which is the same
evidence pattern that condemned the base `h2`.

**V14. One bug found by applying V13's rule, and one claim that was wrong.**
Once secondaries go flat, `.btn.danger` becomes the only elevated button in the
organiser's last row: delete, raised above everything. Destructive actions
should be findable, never leading. Confirmed and fixed.

> **Correction.** This finding originally also claimed that the nine `-mini`
> rules beat `.btn.ghost` on source order, so "Never mind" was drawn as raised
> as "Lock it in". **That is false, and it is a specificity error on my part.**
> `.btn.ghost` is two classes, (0,2,0); `.meal-mini` is one, (0,1,0). The ghost
> rule wins regardless of order, so source position never mattered. The agent
> applying D9 checked it rather than trusting it, and reported it false instead
> of silently "fixing" a bug that did not exist. Recorded rather than deleted,
> because a wrong finding that was caught is evidence the checking worked.

**V15. The fill language already existed, twice, and its contrast is
load-bearing.** `08-fill.md` found `.rg-meter-bar` and `.poll-bar-track` to be
the same component written twice six hundred lines apart — same box, same
border, same ground, a character-for-character identical gradient. It also
measured the sage hatch at **2.01:1** against its ground (light) and 1.97:1
(dark), under WCAG 1.4.11's 3:1 — so the boundary is carried entirely by the
3px `--ink` frame at 8.27:1. **That frame is load-bearing and must be exempt
from D9's quietening.** Recorded here because it is a direct conflict between
two sections of this project, and D9 is the one that yields.

## 0.4 Why D4's first pass reports "not achieved", and why that was the right answer

The prompt in §D4 forbade moving the occasion row, on the correct grounds that
`03-ia §C.4` settles where a router belongs. But `03-ia` settles *where* the
router goes, not that it may be 176px tall — and I wrote the constraint tightly
enough that the agent read it as "do not touch", which made the target
unreachable before it started.

The agent did the in-scope work anyway (it is right on its own terms: −81px on
mobile populated, and the router now sits at an identical position for a
stranger and a returning organiser, where before per-browser state pushed it
from 400px to 589px), then proved the remainder impossible and said so. **That
report was the most useful single output of this project**, because it converted
a target into a decision: shrink the bands, revise the budget, or accept that on
a phone the seasonal card is the above-fold proof-of-product and the shelf
starts below it.

The lesson for the next document like this one: a prompt that names a numeric
target should also name what to do if the target proves unreachable, and should
say which of its own constraints is the one to bring back for renegotiation.

## 0.5 One process finding, recorded because it cost real work

D7 completed its edits correctly and then ended its turn **without emitting its
structured report**. In a sequential chain that threw, and **destroyed the two
tasks queued behind it** — D8 and D11 never started, though D6's and D7's edits
were already safely on disk. The measurements D7 was asked to report (including
whether taller small buttons break any row in the registry, Group Card or the
rosters) were lost and had to be re-taken by hand.

Two changes follow from it, both applied to the relaunch: every stage is
individually wrapped so a lost report cannot cancel unstarted work, and every
prompt now carries an explicit instruction to call the reporting tool before
ending its turn. The cheap-model tier in §C is not at fault — the orchestration
was. A chain that treats a missing report as a fatal error is a chain that
throws away completed work for a formatting failure. **The relaunched chain ran
all five stages with zero errors and zero empty results.**

## 0.6 The fold, reclaimed — final numbers

D4's second pass, with both bands shrunk and the lede shortened. Independently
re-measured by a verifier that edited nothing and matched every figure:

| | Before | After |
|---|---|---|
| First `.tool-card` top, 375×812, strip **empty** | 932px | **688.7px** (bottom 808px vs an 812px fold) |
| First `.tool-card` top, 375×812, strip populated | 1102px | 858.6px — 46.6px below, as predicted |
| First `.tool-card` top, 1280×800, empty | 787px | 725.3px |
| `.hero` | 267px | 167.8px |
| `.lede` | 163px (6 lines) | 81.6px (3 lines) |
| `.feature-card` | 309.2px | 204.0px |
| `.occasion-row` | 176.6px | 161.4px |
| `scrollHeight`, 375px empty | 4109px | 3866px |

**A full tool card is above the fold at 375×812 with four pixels to spare**, in
both colour schemes — for four of the five seasonal windows, 335 days a year.
The Melbourne Cup window (6 Oct – 4 Nov, 30 days) has a 242px title that still
wraps beside the art, putting its card at 233px and the first tool card at
717.7px. Buying that back needs the art under ~42px, which was judged not worth
it for 8% of the year. It is stated in the stylesheet comment, and it means
**the fold claim is conditional on season** — say so rather than rounding up.

The populated case is 46.6px short and always will be. V11 predicted that, the
pass measured it rather than chasing it, and the verifier confirmed it.

Two mechanism notes worth keeping. The feature card fix required flattening the
card to four children in **both** `public/index.html` and the `HTMLRewriter` at
`src/worker.js` — a float only affects what follows it, so the tag must precede
the art, and with the art first the inline-block tag was pushed below the float
whole, costing +78.4px on the two windows with long tags. And the lede's exact
size mattered more than it should: at 33.6px the h1 crossed a wrap threshold
that 32px does not, costing 41px of page for a 5% font change.

## 0.7 The gap the verifier found, which nobody else did

D7 raised `.btn.small`, `.card-mini` and `.occasion-pill` to 44px, and reported
— truthfully — that it had done so. **It was scoped too narrowly, and the fault
is in V4 above, which named only the three elements it had measured.**

The codebase has nine near-identical `-mini` classes doing one job — claim and
cancel — across nine tools. Only `.card-mini` was in scope. So Group Card's
button cleared the floor while the identical button on Bring a Plate, Baby Guess
Pool, the Volunteer Roster, Meal Train, Group Vote, Recipe Collection and the
Gift Idea Board sat at **35.3px**, on the participant surface, in a project that
had explicitly adopted 44px as its standard.

The verifier measured all nine directly rather than trusting the summary it was
given, and said so plainly: "the honest finding is *not achieved outside
`.card-mini`*, not *clear*." **Fixed** — the floor is now declared once for all
nine, with each tool's rule keeping only what is genuinely local to it. All nine
measure 44px; `.btn` (49px) and `.btn.big` (59.6px) are unchanged; the fold
number survived the change at 688.7px.

The lesson is about findings, not agents. **A finding that enumerates examples
will be implemented as if the enumeration were the scope.** V4 said "`.btn.small`
and `.card-mini`" when it meant "every small button on the site", and the work
did exactly what it was told.

## 0.8 What is deliberately not finished

**~~`fillTrack()` exists and nothing calls it.~~ Wired, and audited.** D11
collapsed `.rg-meter-bar`, `.poll-bar-track` and `.rg-sect-bar` into one
`.fill-track` / `.fill-sect` component — deleting three duplicate blocks rather
than adding a fourth bar — and added `fillTrack({n, m})` to `src/lib.js` per
`08-fill.md §D.9`. The per-tool adoption then landed across five agents working
in parallel, one file each, with an independent leak audit behind it. See §0.9.

**One correction to `08-fill.md §C.1`, found by using it:** `.rg-sect-bar`'s
fill is *not* the sage hatch. `public/registry-view.js` writes an inline
per-group colour at render time, so only the box collapsed, never the fill.

**One asymmetry found and left alone**, because it is `05-tools.md`'s territory:
`h1.qotd-q` carries a smaller clamp with a comment about long custom questions
not pushing the page sideways on a phone. **Group Vote renders a user-written
question into a bare `<h1>` with no such guard**, and is the page most hurt by a
larger title. Two tools, identical content in an identical slot, one of them
protected. It will bite whoever touches the `h1` next.

## 0.9 The fill language, adopted

Five agents wired `08-fill.md §F` into the tools in parallel — safe because each
tool is its own file under `src/tools/`, with `src/lib.js` and
`public/styles.css` declared out of scope for all five. An independent auditor
then started the Worker, re-seeded all 21 demos and drove the real `/s/` pages.

**Ten tools draw a fill; nine correctly draw none.** 69 fill elements across 22
live pages. Every one carries `aria-hidden="true"`, and every lead bar's two
numbers appear as digits in the `.page-sub` immediately above it — checked
mechanically, 12 of 12.

**The leak audit came back clean**, which is what it existed to establish. The
three tools `§B.1` was written for came out right: coffee has one undivided bar
over the whole roster and **zero section rungs on `/s/`, `/e/` and `/p/`**, so
there is nothing for `data.groups` to be differenced against; roles has one bar
over a count and no per-role fill; kringle has one bar and no segmentation.
Not one bar is drawn against a `MAX_*` ceiling — every one of those constants
stays inside validation. No fill reaches a share card, a description or an
`og:image`; `first_opened_at` reaches no rendered page; nothing polls.

Three things the wiring found that the spec had not:

- **Coffee's `/s/` page had no claimed-count sentence at all.** `chips()` prints
  only "Round 3 · fortnightly · 8 people". Without adding one, the `aria-hidden`
  bar would have been the sole carrier of that number, which `§D.1` forbids. The
  agent added the sentence rather than shipping a silent bar.
- **`§D.5`'s gold full state was never implemented**, and `.fill-track` has no
  full-state variant. Combined with the next item, a completed board announced
  completion in no word.
- **Plate's and hens's lead lines had no ✓ at N = M.** Their per-category heads
  tick, but the board-level line did not — so a fully sorted board said
  "10 of 10 spots sorted", which is true and is not "you are done". **Fixed**:
  both now tick at capacity, same shape as `roles.js` and `roster.js`. Verified
  by rendering both tools at capacity and below it against a stubbed `env`.

Two known gaps left open, both deliberate:

1. **Registry and poll still emit `.rg-meter-bar`, `.rg-sect-bar` and
   `.poll-bar-track`.** The CSS aliases them onto the shared rules, so the
   substance of `§D.9` is met and the letter is not. A markup rename, not a
   behaviour change.
2. **Coffee's `/s/` now prints "8" twice** — `chips()` says "8 people", the new
   line says "of 8" — and giftidea's "3 ideas · 0 being bought" is not a
   fraction, so an empty 3-cell bar could be misread. Both are copy decisions
   owned by `04-copy.md`, and are left for that document rather than settled
   here.

**One correction to `08-fill.md §C.1`, found by using it:** `.rg-sect-bar`'s
fill is *not* the sage hatch. `public/registry-view.js` writes an inline
per-group colour at render time, so only the box was ever shared.

---

# A. Measurement conditions, and why they differ from `01-evidence.md`

Everything below was measured on **31 August 2026 against the working tree**,
not against `0cec1dd`. `public/` was served statically and driven in a real
browser at 375×812 and 1280×800, with computed styles read off live elements
rather than inferred from the stylesheet.

This matters. The working tree is ahead of the deploy the other five documents
measured, and **three of the findings below exist only because of changes those
documents recommended.** They are not arguments against those changes. They are
the visual bill for them, which nobody has paid yet.

## A.1 The homepage, both widths

| Metric | 375×812 | 1280×800 | Same metric at `0cec1dd` (`01-evidence.md §1.1`) |
|---|---|---|---|
| `scrollHeight` | 4303px | 4201px | 3909px / 4086px |
| Words in `<main>` | — | 920 | 796 |
| Tool cards above the fold | **0 of 22** | **0 of 22** | 2 of 22 / 4 of 22 |
| Top of first `.tool-card` | 1153px | 927px | — |
| Top of `.occasion-row` | 589px | — | did not exist |
| Top of `.feature-card` | 779px | — | — |
| `.tool-grid` columns | 2 | 4 | 2 / 4 |
| `.tool-card` height | 119px | 221px | — |
| Section `<h2>` in `#tools` | 5 | 5 | 6 |
| Occasion pills | 6 | 6 | 0 |
| Guide links | 24 | 24 | 24 |

## A.2 The type ladder as it actually computes

Root is 16px; `body` is 16.5px (`styles.css:167`), so `rem` resolves against 16
and every `.86rem`-style value below is smaller than it reads in source.

| Element | Source | Computed | Rank |
|---|---|---|---|
| `.lede` | 1.05rem | 16.8px | 1 |
| `body` | 16.5px | 16.5px | 2 |
| `.tool-card .tool-name` | 1.02rem | 14.4px\* | 3 |
| `.btn` | .92rem | 14.72px | 4 |
| `.fine` | .84rem | 13.44px | 5 |
| `.occasion-pill` | — | 13.76px | 6 |
| `.tool-desc-short` | — | 12.48px | 7 |
| Guides `<h2>` | — | 12.48px | 8 |
| **Section `<h2>`** | **.78rem** | **11.84px** | **9 — last** |
| `.btn.small` | .72rem | 11.52px | 10 |

\* under 34rem the mobile override at `styles.css:435` takes `.tool-name` to
`.9rem`.

## A.3 Contrast, every palette token, computed

sRGB relative luminance, against `--paper` `#f4ead8` and `--paper-2` `#ece0c9`
— the two grounds `styles.css:47-56` names as the only ones these land on.

| Token | Value | on `--paper` | on `--paper-2` | AA (4.5:1) as text |
|---|---|---|---|---|
| `--ink` | `#3d3428` | 10.24 | 9.34 | pass |
| `--ink-soft` | `#584a39` | 7.18 | 6.55 | pass |
| `--ink-faint` | `#726149` | 5.00 | 4.56 | pass |
| `--accent` | `#8a4e3a` | 5.45 | 4.97 | pass |
| `--sage-dark` | `#4b6647` | 5.35 | 4.88 | pass |
| `--grass-dark` | `#496d3f` | 4.97 | 4.54 | pass |
| **`--gold-ink`** | **`#ab7613`** | **3.30** | **3.01** | **FAIL** |
| `--plum` | `#9d6880` | 3.73 | 3.40 | ground only |
| `--terra` | `#b8735a` | 3.12 | 2.85 | ground only |
| `--grass` | `#6f9862` | 2.78 | 2.53 | ground only |
| `--sage` | `#7f9e78` | 2.49 | 2.28 | ground only |
| `--gold` | `#d9a441` | 1.89 | 1.72 | ground only |
| `--line` | `#cbb894` | 1.63 | 1.48 | rules only |
| `--sky` | `#a9cdd8` | 1.42 | 1.29 | ground only |
| `--shade` | `#d8c6a3` | 1.41 | 1.28 | shadow only |

Every value the file documents in prose measures as documented — the ladder at
`styles.css:47-73`, the `--accent` note at `:75-85`, the `--edge-card` note at
`:87-110`. One token does not. See V5.

## A.4 One tool page, driven

`/kris-kringle/` at 375×812, with two entries in the browser's made-list (i.e. a
returning organiser, not a first visit):

| Element | Top | Height |
|---|---|---|
| `.tool-hero` | 44px | 255px |
| `#names` (the required field) | 558px | 176px |
| `#kringlePreview` | 757px | 72px |
| **`#drawBtn` (submit)** | **882px** | 60px |
| `#title` | 1012px | 51px |
| `.tool-hero-art` | 1515px | 102px |

Fold is 812px. See V8.

---

# B. Findings

*Written before any of the work was done. What happened to each is in §0.1;
findings discovered while doing it are in §0.3. Nothing below has been
back-edited to look more correct than it was.*

## V1. Zero of 22 tool cards are above the fold, at both widths

**Measured.** First `.tool-card` starts at 1153px on mobile and 927px on
desktop; `01-evidence.md §1.1` recorded 2 and 4 respectively at `0cec1dd`. The
page also grew 394px on mobile and 115px on desktop.

The occasion row is the router `03-ia.md §C.4` argued for and it is correctly
placed — a router belongs above the shelf. But it landed on top of a hero that
was already sized for a page with nothing above the shelf, and `.prev-sweeps`
sits between them. Three full-width bands now precede the first product on the
page: hero (255px of it on mobile), the made-strip, the pill row.

**What this costs, HEURISTIC:** a visitor arriving from search on a phone sees a
headline, a 50-word lede, a list of things they made before, and six occasion
chips — no tool, no icon, no proof there are 22 of anything. The lede runs eight
lines at 375px.

**Settled by:** measuring first-card position after any hero change, at both
widths, with the made-strip both empty and populated. There is precedent for
enforcing this in the build — `scripts/builder-above-fold.mjs` does exactly it
for builders.

**Not a reason to remove the router.** The fix is upstream of it: the hero and
the made-strip are what should give the pixels back.

## V2. The section headings are the smallest type on the page

**Measured.** The five `#tools > h2` compute to 11.84px, uppercase, weight 700,
`--ink-faint`. That is rank 9 of 10 in §A.2 — smaller than the short blurbs
inside the cards they label, smaller than the fine print, smaller than the
guides' own `<h2>`.

Contrast is fine (5.00:1). Rank is not. On a page whose entire job is putting 22
things in front of someone, the five labels that make the shelf scannable are
the least visible text on it. The dashed rule at `styles.css:245-249` reads as a
divider, which further demotes the words to a caption on a line.

The uppercase micro-eyebrow is right where `styles.css:236-240` says it is —
`.kicker`, `.feature-tag`, editorial standfirst grammar. A section heading over
five cards is not that; it is a signpost, and it should be readable at a glance
by the audience `styles.css:31-34` names.

## V3. A dashed border appears 29 times and does four jobs — two of them opposites

**Arithmetic over `public/styles.css`.** `grep -c dashed` returns **29**. Read
in full, they sort into four unrelated jobs:

| Job | Count | Examples |
|---|---|---|
| **Nothing here yet** | 8 | `.card-empty` (`:950`), `.fact-empty` (`:1330`), `.bb-empty` (`:1379`), `.poll-empty` (`:1669`), `.recipe-empty` (`:1753`), `.gi-empty` (`:1866`), `.qotd-empty` (`:2017`), `.live-preview-empty` (`:2346`) |
| **Already taken — do not touch** | 5 | `.kk-name.is-claimed` (`:648`), `.fact-name.is-claimed` (`:1290`), `.gi-card.claimed` (`:1814`), `.claim-name.taken` (`:2172`), `.tool-card.soon` (`:439`) |
| **A divider rule** | ~5 | `.recipe-head` (`:1711`), `.recipe-edit` (`:1757`), `.qotd-archive-item` (`:2008`), `.gi-claimed` (`:1850`) |
| **A notice block** | 5 | `.rg-payblock` (`:1157`), `.pulse-hold` (`:2238`), `.qotd-preview` (`:2040`), `.see-example` (`:2418`), `.nudge-text` (`:1251`) |

The second row is the finding. **"Nobody has filled this in" and "somebody
already has" are opposite states, and they are drawn identically** — dashed
border, `--line-firm`, shadow removed, opacity dropped. On a Kris Kringle claim
board, a Fact Matcher name list and a Gift Ideas card, the visual difference
between *available to you* and *gone* is carried entirely by the text inside.

Three of the four jobs also stack within the first 900px of `/kris-kringle/` at
375px, so the cumulative reading is "provisional" — which on a site whose header
already says BETA is the wrong message twice over.

**Dashed should mean one thing.** My reading: it should mean *not filled in yet*
— row one, and only that. Row two needs its own treatment and needs it most,
because it is the row where the ambiguity has a cost. Rows three and four are
decoration and should come off the dash entirely.

> **Correction, after D6 executed this.** The sort above is short by three, and
> miscategorises one. `.rg-part.taken` and `.rg-part-claimedby` belong in row
> two and row three respectively and were never listed, despite being exactly
> the patterns this finding describes. And `.live-preview` is not an empty state
> — that is `.live-preview-empty`, which was already plain unbordered text and
> needed no change; `.live-preview` itself is a notice panel that had been drawn
> dashed for no recorded reason, and belongs in row four. The 29 sort into 26
> real declarations plus 3 comment mentions. After D6: 9 real declarations
> remain, all genuine empty states.

## V4. The router and the secondary actions are under-size tap targets

**Measured.** `.btn.small` (`styles.css:696`) computes to **34.9px tall** with
11.52px text. `.occasion-pill` computes to **39.1px**.

`.btn` (49px) and `.btn.big` (59.6px) are fine. It is the small tier that fails,
and it fails on: the occasion row, which is the homepage's primary navigation
after `03-ia.md`; and `.card-mini` / `.btn.small`, which carry the per-item
actions inside Group Card, the registry and the rosters.

WCAG 2.5.8 (AA) sets a 24×24 floor, which these clear. WCAG 2.5.5 (AAA) and
every platform HIG set 44. For a site that is two-thirds mobile serving an
audience the stylesheet itself describes as skewing older, 44 is the number to
hold, not 24.

## V5. `--gold-ink` fails AA, in a file whose doctrine is "re-measure, do not eyeball it"

**Computed, §A.3.** `--gold-ink: #ab7613` measures **3.30:1 on `--paper`** and
**3.01:1 on `--paper-2`**. The comment introducing it (`styles.css:110-116`)
says it is "the same hue taken down to a legible weight". It was taken down, but
not far enough: `#d9a441`'s 1.89:1 became 3.30:1, and 4.5 was the target.

It is used as a text colour at `styles.css:534` (`.draw-arrow`) and as a border
at `:1100` (`.rg-part.is-mine` — the marker for *your own* claim in the
registry, where the border also carries an `rgba(217,164,65,.28)` ring).

Dark mode is unaffected: `:143` puts the bright `#d9a441` back as light text on
a dark ground at a documented 6.34:1.

This is one token out of fifteen. Every other value in the file measures exactly
as its comment claims. It is worth fixing precisely *because* the rest of the
ladder is trustworthy — one unmeasured rung is what makes a reader stop trusting
the other fourteen.

## V6. Colour does no wayfinding, and the mechanism to fix that already exists

**Arithmetic over the repo.** All 22 `.tool-card`s render identically: same
`--paper-2` ground, same `--edge-card`, same 56px icon slot, same three text
tiers. The only colour that varies between them is inside the pixel art.

Meanwhile `styles.css:924-928` already defines a five-hue system —
`.card-hue-sage`, `-terra`, `-gold`, `-sky`, `-plum`, applied as a 9px
`border-top-color`. It is used by exactly one tool: `src/tools/card.js:135`, for
the sticky notes on a Group Card.

There are five shelf sections and five hues. Extending the existing grammar to
the shelf costs one class per card and no new tokens, and it gives a returning
organiser something to navigate by other than re-reading — position plus colour
rather than position alone.

**HEURISTIC**, and honestly so: I cannot show that anyone navigates this shelf
by colour, because there is one row of stats. What is not heuristic is that the
mechanism, the tokens and the precedent all already exist, so the experiment is
cheap.

## V7. `beta` is drawn with the same emphasis as the one promoted thing on the site

**Measured and read.** `.beta-badge` (`styles.css:1495-1500`) is cream on
`--terra-dark` with a 2px `--ink` border. `.feature-tag` — the label on the
seasonal card, the single promotional slot on the homepage — is the same
treatment, and the comment at `:1497` says so outright. In dark mode at 375px it
is the brightest object above the hero.

So the header's third element, sitting immediately after the wordmark on the
homepage and all 22 tool pages, is a warning label rendered at promotional
weight.

The audience is a P&C secretary deciding whether to put the fete roster
somewhere other than a spreadsheet. "Beta" is an argument for the spreadsheet,
and it buys nothing back: there is no beta programme, no waitlist, and no
feedback loop attached to it.

**This is a visual-weight finding, not a copy one.** If the word stays for
honesty's sake, it does not need `--terra-dark` and a 2px `--ink` border to say
it.

## V8. The made-strip re-buries the button that `builder-above-fold.mjs` lifted

**Measured, §A.4.** On `/kris-kringle/` at 375×812 with two saved entries,
`#drawBtn` sits at **882px — 70px below the fold.** With an empty made-strip
(`hidden`, first visit) it clears.

`scripts/builder-above-fold.mjs` exists specifically to prevent this, and its
header comment records the measurement that motivated it. It moves DOM blocks
*inside* `<form>`. `.prev-sweeps` is a sibling of the builder, injected by
`made.js` outside the form, so the script neither sees nor checks it.

The result is the wrong way round: **the builder works above the fold for a
stranger and below it for a regular.** The people the strip serves are exactly
the people it penalises.

**HEURISTIC on impact**, measured on cause. The cause is certain — I measured
both states. What a returning organiser does about it is not.

---

# C. Model and effort, and why they are labelled at all

Every prompt in §D carries a model and an effort. The tiers:

| Tier | Model | Effort | Applies when |
|---|---|---|---|
| **Mechanical** | Haiku 4.5 | low | The diff is fully dictated by this document — a token value, a deleted span, a padding number. No judgement, no measurement, and correctness is arithmetic or a build script. |
| **Bounded** | Sonnet 5 | medium | One rule applied across an enumerable set of files, where a script or a grep proves the set is complete. Judgement is limited to choosing between two options this document already names. |
| **Doctrinal** | Opus 5 | high | The change trades against a rule `styles.css` argues for in prose. The agent has to read the argument, decide whether it still holds, and write the new reasoning into the file in the same voice. |
| **Inventive** | Opus 5 | xhigh | A visual language that does not exist yet and has to hold across 20 tools at once. Wrong here is expensive — it ships into every tool, and the next tool copies it. |

**Why not run everything at Opus · max.** Because in this repository a larger
model on a mechanical task is a *liability*, not insurance. Nearly every
declaration in `styles.css` has a paragraph above it explaining a decision that
was already argued and measured. A capable model asked to change a padding value
will notice the neighbouring `--edge-card` reasoning and improve it. That is a
silent overwrite of a settled decision, and it is the single most likely way
this work goes wrong. Small, cheap and literal, for the literal jobs.

**Why effort and not model is the lever on the middle tier.** V1, V3 and V8 are
not hard to *write* — they are hard to *verify*, because verification means
re-measuring in a browser at two widths and two states. That is more turns, not
more reasoning per turn.

**One standing instruction for every prompt below**, whatever the tier:

> `public/styles.css` documents its decisions in prose above the rules. If you
> change a declaration that has a comment explaining it, update the comment in
> the same voice and with the same measurements. Do not delete reasoning you did
> not replace, and do not "improve" a rule you were not asked to touch.

**A second standing instruction, added after §0.5.** Every prompt must end by
emitting its structured report, and every chain must survive one that does not:

> Finish by calling the reporting tool. Do not end your turn without it.

The tier table above survived contact with the work — the Haiku tasks produced
correct diffs and the Opus tasks produced the arguments they were asked for. The
one thing that failed was orchestration, not model selection. Do not read §0.5
as an argument for running everything at a higher tier; read it as an argument
for wrapping each stage so a lost report cannot cancel unstarted work.

**And a third, learned from D4.** A prompt that names a numeric target must also
say what to do when the target proves unreachable, and name which of its own
constraints is the one to bring back for renegotiation. §D4 named a target and
no fallback, and the agent had to invent the escape hatch itself.

---

# D. The work, as prompts

Sequenced the way `06-roadmap.md` sequences: Now, Next, Later. Within Now, D1 and
D2 are independent; D3 depends on nothing but should follow D2 so the headings
are settled before hues land under them.

---

## NOW

### D1 · Fix `--gold-ink`

**File:** `public/styles.css:117`
**Model: Haiku 4.5 · Effort: low** (Mechanical)

> In `public/styles.css`, `--gold-ink: #ab7613` measures 3.30:1 against
> `--paper` (`#f4ead8`) and 3.01:1 against `--paper-2` (`#ece0c9`). It is used as
> a text colour at `.draw-arrow` (line 534). It must clear 4.5:1 against both
> grounds.
>
> Darken it along the same hue until it clears 4.5:1 on `--paper-2` (the harder
> of the two), then state both measured ratios in the comment block at lines
> 110-116, replacing the "taken down to a legible weight" phrasing with the
> numbers. Do not touch `--gold` (`#d9a441`) — it is a ground, and it is correct
> as one. Do not touch the dark-mode override at line 143; it measures 6.34:1 and
> is documented.
>
> Show me the computed ratios for the new value against both grounds before you
> write the file.

**Done when:** the new value measures ≥4.5:1 against `#f4ead8` and `#ece0c9`, and
the comment states both numbers.

### D2 · Promote the section headings

**File:** `public/styles.css:243-249`
**Model: Sonnet 5 · Effort: medium** (Bounded)

> The five section `<h2>` on the homepage compute to 11.84px, uppercase,
> `--ink-faint`, weight 700 — the smallest type on a page carrying 22 tool cards,
> smaller than the blurbs inside the cards they label.
>
> Re-rank them: sentence case, `--ink`, and a size that sits clearly above
> `.tool-name` (currently 14.4px, or `.9rem` under the 34rem breakpoint). Around
> `1.15rem` is the target; verify against the real cards rather than trusting the
> number. Keep the dashed rule at lines 245-249 only if the heading still
> dominates it — if the rule competes, drop it.
>
> Constraint: this rule is `h2`, not `#tools h2`, so it also styles the guides
> section and every `<h2>` on the 26 guide pages and the tool pages. Check what
> else moves before you commit to a selector. If the shelf headings need to
> diverge from the article headings, scope them — but say why in the comment,
> because `styles.css:236-240` currently argues that all-caps here is editorial
> grammar, and you are partly overturning that argument.
>
> Measure at 375×812 and 1280×800 and report the computed size, colour and
> contrast ratio of the new heading against `--paper`.

**Done when:** section headings rank above `.tool-name` in computed size at both
widths, and the `styles.css:236-240` comment reflects the narrower claim.

### D3 · Retire the badge, or de-emphasise it

**Files:** `public/index.html:47` and the same span on all 22 tool pages;
`public/styles.css:1495-1500`
**Model: Haiku 4.5 · Effort: low** (Mechanical)

> `.beta-badge` is drawn with the same treatment as `.feature-tag` — cream on
> `--terra-dark`, 2px `--ink` border — which is the emphasis reserved for the one
> promoted thing on the homepage. It appears in the header of every page.
>
> Remove the `<span class="beta-badge">beta</span>` from every page that carries
> it, and delete the rule at `styles.css:1495-1500`. Find every instance with a
> grep across `public/**/*.html` rather than a hand-kept list, and report the
> count you changed.
>
> `beta-badge` is already in `SKIP_CLASSES` in `scripts/gen-markdown.mjs` (line
> 34), so the Markdown twins do not change. Run `npm run markdown` and confirm no
> `.md` file changes. If any does, stop and report it.

**Done when:** no `.html` in `public/` contains `beta-badge`, the CSS rule is
gone, and `npm run build` passes with no diff to any `.md` twin.

*If the word stays for honesty, this becomes* **Sonnet 5 · medium** *instead:
keep the text, drop it to `--ink-faint` on the page ground with no border, and
justify the new weight in the comment.*

---

## NEXT

### D4 · Reclaim the fold

**Files:** `public/index.html` (hero, `.prev-sweeps` placement),
`public/styles.css` (`.hero`, `.lede`, `.prev-sweeps`)
**Model: Opus 5 · Effort: high** (Doctrinal)

> No tool card is above the fold on the homepage, at either width. Measured on
> the working tree: first `.tool-card` at 1153px against an 812px viewport
> (375×812), and at 927px against 800px (1280×800). At `0cec1dd` it was 2 of 22
> and 4 of 22. The page grew 394px on mobile.
>
> Three full-width bands now precede the shelf: the hero, `.prev-sweeps`, and the
> occasion row. **The occasion row is not the problem and must not move** —
> `docs/review/03-ia.md §C.4` settles that a router belongs above the shelf, and
> that document is not being reopened. The hero and the made-strip are what
> should give the pixels back.
>
> Read `docs/review/03-ia.md §C.2` and `§C.3` first — they specify the hero's
> three-beat lede and the made-strip's conditional behaviour, and both are
> settled *content* decisions. Your latitude is over size, spacing and stacking
> order, not over what the bands say.
>
> Get at least one full tool card above the fold at 375×812, with the made-strip
> both empty and populated with two entries. Measure both states. Report
> before/after for: first-card top, `scrollHeight`, and top of `.occasion-row`,
> at both widths.
>
> Consider, and tell me which you chose and why: reducing `.lede` size or
> `max-width` on mobile only (it runs eight lines at 375px); tightening
> `.hero`/`.tool-hero` padding; moving `.prev-sweeps` below the occasion row so
> the router is never displaced by per-browser state.

**Done when:** ≥1 tool card is above the fold at 375×812 in both made-strip
states, with before/after numbers reported at both widths.

### D5 · The made-strip vs. the builder button

**Files:** `public/made.js` (injection point), `public/styles.css`
(`.prev-sweeps`), possibly `scripts/builder-above-fold.mjs`
**Model: Opus 5 · Effort: high** (Doctrinal)

> `scripts/builder-above-fold.mjs` exists to keep the required field and the
> submit button above the fold on a phone; its header comment records the
> measurement that motivated it. It reorders blocks *inside* `<form>`.
>
> `.prev-sweeps` is injected by `made.js` as a sibling of the builder, outside
> the form, so the script neither sees nor checks it. Measured on
> `/kris-kringle/` at 375×812 with two saved entries: `#names` at 558px,
> `#drawBtn` at **882px** — 70px below the fold. With the strip empty it clears.
> The builder therefore works above the fold for a stranger and below it for a
> returning organiser.
>
> Fix it so the populated state also clears 812px. Then decide whether
> `builder-above-fold.mjs` should grow a check for this — it currently proves a
> property that `made.js` can silently break at runtime, which is the actual
> defect. If you add the check, it must measure the populated state, not the
> empty one.
>
> Verify on at least four builders with different column layouts — pick from the
> `PRIMARY` map in `builder-above-fold.mjs`, including at least one `1` and one
> `2` — with two entries in the browser's made-list. Report `#drawBtn` top for
> each, populated and empty.

**Done when:** the primary submit clears 812px on the four sampled builders in
the populated state, and `npm run fold` passes.

### D6 · One meaning for a dashed border

**File:** `public/styles.css` — 29 declarations, enumerated in V3 above
**Model: Sonnet 5 · Effort: medium** (Bounded)

> `grep -c dashed public/styles.css` returns 29. Read in full they do four
> unrelated jobs, listed with line numbers in `docs/review/07-visual.md §V3`.
>
> The one that matters: **"nothing here yet" and "somebody already claimed this"
> are drawn identically** — dashed border, `--line-firm`, shadow removed,
> opacity dropped. Compare `.card-empty` (`:950`) against `.kk-name.is-claimed`
> (`:648`), `.fact-name.is-claimed` (`:1290`), `.gi-card.claimed` (`:1814`) and
> `.claim-name.taken` (`:2172`). On a claim board those are opposite states and
> the only thing separating them is the text inside.
>
> Make dashed mean exactly one thing: **not filled in yet** — the eight empty
> states in V3 row one, and nothing else.
>
> Then give row two (claimed/taken/soon) a treatment of its own that reads as
> *settled*, not as *provisional*. Draw it from what the file already has — the
> two edge rungs at lines 87-110, `.btn.ghost`, `.pixel-note`, the existing
> opacity drop — and do not invent a third edge rung. Rows three and four
> (dividers, notice blocks) come off the dash entirely.
>
> Re-run the grep yourself before you start and report the full 29 with their
> selectors; my four-way sort is a reading, not a build artefact, and you may
> sort one differently. If you do, say which and why.
>
> Screenshot before and after at 375px, in both themes: `/kris-kringle/`, the
> homepage, and one `/s/demo-*` claim board where taken and available names sit
> side by side.

**Done when:** every remaining `dashed` in the file is an empty state, claimed
items are visually distinct from empty ones on a live claim board, and the
before/after captures are attached.

### D7 · Tap targets to 44px

**File:** `public/styles.css:696-703` (`.btn.small`), `:351-357`
(`.occasion-pill`), `:946` (`.card-mini`)
**Model: Haiku 4.5 · Effort: low** (Mechanical)

> Measured at 375×812: `.btn.small` is 34.9px tall with 11.52px text;
> `.occasion-pill` is 39.1px. `.btn` (49px) and `.btn.big` (59.6px) are fine and
> must not change.
>
> Give `.btn.small`, `.card-mini` and `.occasion-pill` a `min-height: 44px` with
> vertical centring, and raise `.btn.small`'s font-size to at least `.8rem`. Keep
> the 2px offset shadow and the border weight exactly as they are — this is a
> size change, not a restyle.
>
> Then re-measure and report the computed height of all five button tiers and the
> pill, at 375×812. Check the registry, Group Card and the rosters for rows where
> a taller small button breaks a layout, and report any you find rather than
> fixing them.

**Done when:** all three compute ≥44px tall at 375px, `.btn` and `.btn.big` are
unchanged, and any broken row is reported.

---

## LATER

### D8 · Hue the shelf

**Files:** `public/index.html` (22 cards), `public/styles.css:384-407`
**Model: Sonnet 5 · Effort: medium** (Bounded)

> All 22 tool cards render identically. `styles.css:924-928` already defines a
> five-hue system (`.card-hue-sage|terra|gold|sky|plum`) used by exactly one
> tool, `src/tools/card.js:135`. There are five shelf sections.
>
> Extend the existing grammar to the shelf: one hue per section, applied to the
> `<a class="tool-card">`. Reuse the existing class names and tokens — add no new
> colour tokens.
>
> `scripts/sync-card-copy.mjs`'s `CARD` regex (line 51) begins at
> `<span class="tool-name">`, so attributes on the `<a>` are outside the match
> and adding a class is free. This was already verified in
> `docs/review/03-ia.md §G`; re-run `npm run cardcopy` and confirm a clean pass
> anyway.
>
> Two things to get right: the hue must not compete with the pixel icon inside
> the card (the icons already carry saturated colour), and it must survive dark
> mode, where `--sky` and `--gold` were chosen as light-on-dark values. Check
> both themes at both widths.
>
> Do the seasonal `.feature-card` last, and consider leaving it uncoloured so it
> stays the one thing that stands out.

**Done when:** `npm run build` passes, and screenshots at 375px show five
distinguishable sections in both themes.

### D9 · Zone the pixel grammar

**Files:** `public/styles.css` — `.btn` (279-299), `body` background (167-177),
form controls (301-320)
**Model: Opus 5 · Effort: xhigh** (Inventive)

> `styles.css:87-110` already argues that near-black 4px borders with hard offset
> shadows on every container were "the visual grammar of itch.io and game jams",
> and cut cards down to two rungs. That argument was applied to containers and
> stopped there. Buttons kept 3px `--ink` with a 3px offset shadow — the comment
> says so explicitly, and says they were left loud deliberately so they would
> lead once the cards quietened.
>
> The question this prompt asks is whether that is still right **for form
> controls specifically**, given the audience the file names at lines 31-34. The
> pixel art is the identity and is not in scope — icons, heroes, share images and
> result states keep every bit of their weight. In scope: the chrome a person
> types into. Buttons, inputs, textareas, and the dot-grid body texture at lines
> 174-176.
>
> This is a doctrinal change to a file that argues its doctrine in prose. You
> must either extend the lines 87-110 argument to controls, or write down why
> controls are the exception. Whichever you conclude, the comment has to carry
> the reasoning in the same voice, with measurements.
>
> Do not soften with blur — `styles.css:104-107` bans blur radius outright and
> that ban is correct. Soften by removing, as the cards did.
>
> Produce two versions and show me both at 375px, light and dark, on
> `/kris-kringle/` and one organiser page, before changing anything: (a) controls
> quietened, art untouched; (b) current. Argue for one.

**Done when:** two screenshot sets exist, a recommendation is argued, and nothing
has been written to `styles.css` yet. **This prompt ends in a decision, not a
diff.**

### D10 · One fill language across 20 tools

**Files:** `src/lib.js`, `public/styles.css`, then per-tool in `src/tools/`
**Model: Opus 5 · Effort: xhigh** (Inventive)

> Every tool on this site has an X-of-Y state: roster shifts claimed, plate slots
> filled, Kringle names drawn, meal nights covered, registry parts bought, sweep
> spots allocated. Only the registry expresses it visually — guests claim a part
> and a pixel picture fills in — and `docs/review/02-diagnosis.md` treats the
> registry as one of the strongest experiences on the site.
>
> Design **one** progress language, from the existing pixel vocabulary and
> palette, that every tool can use to say "N of M". Then specify — do not yet
> implement — how each of the 20 server-side tool types in `TOOLS`
> (`src/worker.js:39`) would express its own state in it.
>
> Constraints that are not negotiable, from `02-diagnosis.md §I`: the organiser
> cannot see who drew whom (Kris Kringle, Coffee Roulette, Secret Roles), so a
> fill state must never leak an assignment; there is no per-view logging, so
> "opened" is not a countable state except via `first_opened_at`; and `/s/`,
> `/e/` and `/p/` carry no analytics. Read that section before designing.
>
> Three tools have no countable state at all (`kudos`, `pulse`,
> `giftidea`-suggest — see `scripts/stats.mjs` lines 10-25). Say what they do
> instead of a fill. "Nothing" is an acceptable answer if you argue it.
>
> Deliver a spec document at `docs/review/08-fill.md` in the house style of this
> directory: measured where measurable, every recommendation naming a file, a
> constraint audit at the end. No code in this pass.

**Done when:** `docs/review/08-fill.md` exists, covers all 20 tool types plus the
three uncountable ones, and its constraint audit cites `02-diagnosis.md §I`.

### D11 · The shared page as a poster

**Files:** `src/lib.js` (`pageShell`, share card), `public/styles.css`
**Model: Opus 5 · Effort: xhigh** (Inventive)

> `src/lib.js:199-208` records that every shared page is seen by five to thirty
> people. It is the only surface most visitors ever meet, and the only place the
> product is seen by someone who did not choose it. It is currently drawn with
> the same `.panel` grammar as a builder form.
>
> Redesign the `/s/` render as a poster: the organiser's own title dominant, one
> unmistakable state (what is filled, what is left), one action, explanation
> below it. `docs/review/05-tools.md §G4` and `§H.7` already settle that
> explanation sits *after* the action on the participant path — implement that
> ordering, do not re-argue it.
>
> Hard constraints, all from `02-diagnosis.md §I` — read it first: the
> link-preview withholding rule stays; no analytics on `/s/`; the organiser still
> cannot see private assignments; `pageShell` sets `noindex` on every one of
> these pages (`src/lib.js:439`, plus the `x-robots-tag` at `:20` and `:465`) and that stays.
>
> Depends on D10 if the fill language lands first — if it has, use it rather than
> inventing a second one; if it has not, design the poster so a fill can drop
> into it later without a re-layout.
>
> Drive at least six live `/s/demo-*` pages across different tool shapes before
> designing, at 375×812, and report what the first viewport actually contains on
> each today.

**Done when:** six before/after captures exist at 375×812, and every constraint
in `02-diagnosis.md §I` is explicitly checked off in the write-up.

---

# E. Constraint audit

Every change above, checked against the script that could reject it. I read each
script rather than assuming.

| Change | Script | Verdict |
|---|---|---|
| D1 `--gold-ink` value | none | **Free.** No script reads palette tokens. Correctness is the measurement, which is why the prompt demands it be reported. |
| D2 `h2` restyle | `gen-markdown.mjs` | **Free, but wide.** The twins take heading *text*, not style. The risk is not the build, it is that `h2` is unscoped and also styles 26 guide pages — which is why the prompt makes the agent check before choosing a selector. |
| D3 remove `beta-badge` | `gen-markdown.mjs` | **Free, verified.** `beta-badge` is in `SKIP_CLASSES` (line 34), as are `site-head` and `wordmark-blocks`. No `.md` twin can change. The prompt makes the agent prove it. |
| D4 hero / made-strip | `gen-markdown.mjs` 200-char floor | **Safe.** `prev-sweeps` and `site-head` are both in `SKIP_CLASSES`; the homepage twin is far above the floor. Moving the strip cannot change the twin at all. |
| D4 occasion row | `gen-markdown.mjs` `SKIP_TAGS` | **Do not wrap it in `<nav>`.** Already recorded in `03-ia.md §G` — `nav` is skipped and the row would vanish from the twin. The prompt forbids moving it regardless. |
| D5 made-strip vs builder | `builder-above-fold.mjs` | **Engaged, deliberately.** The script moves blocks inside `<form>` and verifies the set of element ids is unchanged afterwards. Anything D5 does outside the form is invisible to it — which is the finding. |
| D6 dashed borders | none | **Free.** No script reads border styles. |
| D7 tap targets | none | **Free**, but layout-adjacent: taller small buttons sit in flex rows in the registry, Group Card and the rosters. The prompt asks for breakage to be reported, not silently fixed. |
| D8 hue classes on cards | `sync-card-copy.mjs` | **Free.** `CARD` (line 51) matches from `<span class="tool-name">`; attributes on the `<a>` are outside the match. Verified independently in `03-ia.md §G`. |
| D8 hue classes | `gen-markdown.mjs` | **Free.** `card-hue-*` is not in `SKIP_CLASSES`, and the cards are meant to appear in the twin. |
| D9 control restyle | `check-hero-loading.mjs` | **Not engaged.** That script checks `loading` attributes on `.tool-hero-art img`, which D9 explicitly leaves alone. |
| D9 body background | none | **Free.** |
| D10 / D11 | `check-share-nudge.mjs`, `check-baked-previews.mjs`, `check-accept.mjs` | **All engaged, none read in detail for this pass.** Both prompts end in specification, not code, so the audit belongs in `08-fill.md`. Recorded here so it is not forgotten. |
| Any copy change | `check-claims.mjs` | **Not engaged.** No prompt above changes a sentence. D3 deletes one word, "beta", which matches none of the seven banned patterns. |

**One thing I checked and am not recommending.** `--edge-card` could be raised
from 2px to 3px to compensate for quieter buttons under D9. It is build-safe and
it is wrong: `styles.css:87-110` argues at length that dropping to two rungs was
the correction, and putting weight back into containers to justify taking it out
of controls re-makes the mistake at one remove. Recorded so nobody re-derives it.

---

# F. What not to change

Everything in `02-diagnosis.md §I` still holds and this document adds nothing to
it. Specific to the visual layer:

1. **The measured ink ladder** (`styles.css:47-73`). Fourteen of fifteen tokens
   measure exactly as documented. Only `--gold-ink` moves, and only because it
   does not.

2. **The system font stack** (`styles.css:126-131`). The argument — no cookies,
   no third-party requests, for a face nobody came to look at — is correct, and a
   webfont would break two stated principles to fix nothing.

3. **The blur ban** (`styles.css:104-107`). Soften by removing, never by
   blurring. D6 and D9 both inherit this.

4. **`.btn` and `.btn.big` sizing.** 49px and 59.6px at 375px. They are the two
   things on the site that are already right for the audience.

5. **The pixel art itself.** Not one prompt above touches `scripts/gen-art.mjs`,
   any icon, any hero, or any OG image. The art is the only reason this site
   looks like nothing else on the internet, and the whole visual argument here is
   that the *chrome* should get quieter so the *art* reads louder. If a change
   makes the art less prominent, it has been misapplied.

6. **The mono/proportional split** (`styles.css:179-183`). Monospace only where
   fixed width does a job. The reasoning at the top of the file is the best
   paragraph in it.

*Added after the work, and binding on anything that comes next:*

7. **The `#tools > h2` child combinator.** Not a stylistic preference — a
   descendant selector there lets the ID beat `.feature-card h2` and silently
   shrinks the seasonal card's title to 11.84px on phones. See V9. This bug
   shipped once already and was reintroduced within one edit of being fixed.

8. **The 44px minimum on `.btn.small`, `.card-mini` and `.occasion-pill`.** D7
   landed these and V12 records that they are in tension with the router's
   height budget. The budget yields, not the tap target.

9. **The 3px `--ink` frame on the fill bars.** `08-fill.md` measures the sage
   hatch at 2.01:1 against its ground, so that frame is the only thing carrying
   the boundary. It is not chrome and must survive any control-quietening pass.
   See V15.

---

*Measured 31 August 2026 against the working tree, at 375×812 and 1280×800, in
both colour schemes. Where this document says HEURISTIC, it means it.*
