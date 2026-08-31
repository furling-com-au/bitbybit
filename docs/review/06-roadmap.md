# Roadmap — bitibybit.com

Written against `01-evidence.md` (facts), `02-diagnosis.md` (positioning),
`03-ia.md` (homepage IA), `04-copy.md` (words) and `05-tools.md` (the 22 tools).
None of them is re-derived here. Repo at `0cec1dd`, 31 August 2026.

Two rules this document holds itself to, both borrowed from the codebase rather
than invented:

- **Every item traces to a finding.** Each row names the section that justifies
  it. If a section doesn't justify it, it isn't here — including things I would
  personally like to build.
- **Every decision rule is written before the data exists.** The model is the
  comment at `src/worker.js:404-410`: *"The decision rule, written down before
  the data exists so it cannot be rationalised later: DO NOT change either
  placement until one of them has 50 clicks."* §E matches that discipline, and
  where no honest instrument exists it says so rather than inventing one.

The calendar this is sequenced against: **65 days to the Melbourne Cup**
(4 Nov), **116 days to Christmas**. Those are the two highest-intent moments in
this product's year and both are downstream of `SEASONS`.

---

# A. Now — this week

Five items. Each is one person, each ships independently of the other four, and
none is blocked on data that doesn't exist yet. Ordered by what the mistake
costs, not by effort.

## A1. Delete the client-side seasonal array

**File:** `public/index.html:309-353` — 45 lines out, nothing in.

**Finding:** Diagnosis §A.3. Two independent seasonal implementations disagree
on **234 of 365 days**. The client array runs last and overwrites the server
render. Today they agree, which is why nothing looks wrong. From 1 Jan 2027 the
largest, highest-placed, only editorial element on the homepage reads *"Footy
finals · September"* for **226 consecutive days** — through the entire school
fete and canteen season the `SEASONS` server array was built to serve.

**Why now and not later:** it is the only item on this list that gets *harder*
to notice the longer it waits. It is currently invisible. It is also the
precondition for IA band 5 (`03-ia.md` §C.5): giving 200px above the shelf to a
card that will be wrong for eight months is not an editorial slot.

**Ships alone.** `check-seasons.mjs` reads `src/worker.js` only and is
unaffected; the static September markup underneath stays as the no-JS fallback.
IA §G's constraint audit confirms this is free against every build check.

## A2. `ownCta()` on the sixteen tools that don't have it

**Files:** `publicPage()` in `src/tools/kringle.js`, `registry.js`, `card.js`,
`roles.js`, `bracket.js`, `poll.js`, `fact.js`, `giftidea.js`, `hens.js`,
`baby.js`, `recipe.js`, `qotd.js`, `coffee.js`, `pulse.js`, `kudos.js`,
`poker.js`. Three lines each, copying the shape already in `sweep.js:160`,
`plate.js:222`, `roster.js:265`, `meal.js:598`.

**Finding:** Diagnosis §A.2. `src/lib.js:186-208` calls this "the loop's only
real recruiting moment." It ships on **4 of 20** server-side tools. The
measurement for all 22 is already built, deployed and dedupe-protected
(`VIA` at `src/worker.js:133-145`, the `/via/:tool/cta|foot` split at
`src/worker.js:411`, the reporting in `scripts/stats.mjs`). *The instrument
covers 22 tools; the thing it measures exists on 4.*

**Why now:** a Kris Kringle instance carries 3–100 named participants, every one
of whom lands on `/s/` in December having just watched a group-organising
problem resolve in two taps. Miss this window and the next one is 12 months
away. Extending coverage is explicitly **not** a change to either placement, so
it respects the 50-click rule rather than pre-empting it — it is the only way 50
clicks arrive before next Christmas.

**Prompt copy** is already drafted in Diagnosis §A.2 for four of the sixteen;
write the rest in the same shape — name *their* situation, never the product.
Print suppression is on the class (`styles.css:2500`), so every new placement
inherits the fridge rule for free.

## A3. Relabel the title field on eleven builders

**Files:** the eleven hint strings in `bring-a-plate`, `fact-matcher`,
`gift-ideas`, `grand-final-sweep`, `group-card`, `kris-kringle`,
`melbourne-cup-sweep`, `question-of-the-day`, `secret-role-dealer`,
`tournament-bracket`, `volunteer-roster`.

**Finding:** Tools §H5, called there "the highest-leverage copy change in this
document." The organiser's title is the **only** instance-specific thing in a
link preview — description and artwork are fixed per tool by design and must
stay that way (Diagnosis §I.1). Eleven builders label the field that decides it
`(optional)`. `question-of-the-day` actively misdescribes it:
`Team name (optional — it just sits at the top)`, when it becomes `og:title`.

Leave it blank and thirty people in a WhatsApp thread see **"Volunteer roster ·
Pick a shift and put your name down"** — safe, clear, and indistinguishable from
every other roster ever made here.

**The change:** `Roster title (optional — this is what shows in the group
chat)`. Not required; adding a mandatory field to nine forms that currently need
none is the wrong trade (Tools §H5). No build check is engaged —
`sync-card-copy.mjs` reads homepage cards, not builder labels.

## A4. Grand Final Sweep: field order, and the print button it was promised

**Files:** `public/grand-final-sweep/index.html:80-87`; one print control in
`src/tools/sweep.js`.

**Finding:** Tools §H3 and §H9. `#drawBtn` sits at **963px**; `#names` —
required, minimum two names, no prefill — sits at **1071px**, *below its own
submit button*. Melbourne Cup runs the same module and doesn't have this; it is
a page-level slip in one file. The same file puts `Sweep title (optional)` above
`Team one` / `Team two`, so A3 lands here too.

Separately, `public/index.html:69` promises this tool is *"printable for the
fridge"*, `styles.css:554` carries the comment *"print — offices stick these on
the fridge"*, and `src/tools/sweep.js` renders no print control.

**Why now, and why this tool and not the other 21:** `SEASONS` is pointing the
homepage feature card at this page **today**, and has been since 15 August. Its
deadline was three weeks ago. The equivalent fixes on gift-registry and
meal-train (Tools §H2) are larger and go in Next; this one is a field move and a
button.

## A5. Write the second row — and the one dashboard visit

**Files:** `.stats-history.jsonl` (append), and one Cloudflare Web Analytics
page view.

**Finding:** Evidence §7 and Diagnosis §A.4. `.stats-history.jsonl` contains
**one row**, labelled a baseline by its own author, with both recorded failures
flagged as the assistant's test traffic. `npm run stats` already exists and
already prints `made / shared / reached / cold / edited` per tool plus the
`via:` split. *One row is a baseline; four is the first thing in this repo that
can contradict any of these documents.* Include `cold` — `stats.mjs:26-40` calls
it "the real number" and the existing row omits it.

The dashboard visit is IA §"How I would tell if I'm wrong", item 1: entries to
`/` against direct entries to the 22 tool roots and 26 guide pages. **It gates
the entire Next block** and it costs one page load. Do it before writing any
homepage HTML.

**Why this is Now and not infrastructure:** every judgement in all five
documents, including this one, is a heuristic because the instrument isn't
running. Four rows is four weeks away and the Cup is nine.

---

## What is deliberately *not* in Now

Named, because leaving them out is the actual decision:

- **The homepage IA re-cut** (`03-ia.md`, `04-copy.md`). The largest and
  best-specified body of work in the review, and it is gated on A5's dashboard
  visit by the IA document's own instruction: *"Run this before building
  anything."* If `/` isn't the router, that work is a low-stakes refactor.
- **Everything on gift-registry and meal-train.** Real (Tools §H2, §H6), large,
  and not on a calendar deadline.
- **`bbb:made:v1` and the "things you've made" strip.** Diagnosis §A.5 is right
  and it is a week of work touching 20+ client files, not a day.
- **Team Picker.** Tools §H4 gives a two-attribute fix, but the honest version is
  a positioning decision (§F), so the cheap fix goes in Next and the decision
  goes in Later.

---

# B. Next — the four weeks after

Ordered. Everything here is either gated on an A-item or larger than one day.

| # | Item | Finding | Gate |
|---|---|---|---|
| B1 | **Cut five ledes to their first sentence** — `meal-train`, `hens-planner`, `bring-a-plate`, `volunteer-roster`, `kris-kringle`. Lifts the live preview above the fold on the five pages that have one. | Tools §H1: previews sit at 628–1057px against ~700px of real phone. "The best thing that shipped this week is invisible at the moment the visitor is deciding whether to bother." | None |
| B2 | **Move optional fields below the button** — `gift-registry` (nine, five of them bank details: 1761px → ~550px), `meal-train` (four defaulted: ~400px), `recipe-collection`, `secret-role-dealer`. | Tools §H2. The roster/plate ordering already ships and works: required field → preview → button → optional. | None |
| B3 | **`migrations/0004`: `first_opened_at` on `instances`** — one nullable timestamp, first-write-wins, same shape as `shared_at` (`src/lib.js:117-130`). Read as cold reach when it lands more than `COLD_MINUTES` after create. | Diagnosis §A.4. Gives sweep and bracket — the two tools promoted for 82 days — the only reach signal they can have. Explicitly **not** per-view logging; stays inside the §I.3 envelope. | After A5 has ≥2 rows, so the change is visible as a step |
| B4 | **The homepage IA and copy: bands 1, 2, 4, 6, 8** — occasion row, three-beat lede, five sections, 22 card ids, count line, seven long blurbs. | `03-ia.md` §C and §E; `04-copy.md`, which is paste-ready and pre-checked against `check-claims.mjs` and `sync-card-copy.mjs`. | **Gated on A5's entry-page number.** See §E.2 |
| B5 | **Participant-page diets** — `qotd.js` (410 words → ~90, name field below the buttons), `kringle.js` (46 words), `coffee.js` (52, keeping "you only claim your name once"), `meal.js` (35 of 315). `pulse.js` is the worked example to copy. | Tools §G4: "reassurance belongs after the tap, not before it." | None, but after A2 so the CTA lands on the trimmed page |
| B6 | **One print button per `/e/` page whose print block already exists** — 17 `@media print` blocks in `styles.css`, visible controls on 3 tools. | Tools §G5, §H9. Five lines per tool; `.own-cta` print suppression is automatic. | After A4 does the sweep |
| B7 | **Demote `#copyBtn` to `.btn`**, plus a **static card preview on `/e/`** — artwork, the title as it will render, the fixed description. | Tools §H8 and "Sharing" §3.1. The preview makes A3 self-teaching: leave the title blank and the page says "Volunteer roster" back at you. `markShared` listens by id, so the beacon is unaffected. | After A3 |
| B8 | **`bbb:made:v1` + the "things you've made" strip** (homepage band 3 and each tool hero). Not an account: written alongside the existing per-tool keys, class `prev-sweeps` so `gen-markdown.mjs` skips it. | Diagnosis §A.5; IA §C.3 — retrieval failure is worse than discovery failure. | After B4, since it occupies a homepage band |
| B9 | **Team Picker's cheap fix** — remove `disabled`, seed a real name list, move the split config above the button it configures. | Tools §H4. One `value`, one attribute removed. | None |

---

# C. Later — after the data, or after the season

- **The Team Picker decision.** It has no `tool_type`, no `/s/`, produces no
  link, and its `og-teams.png` sits unused (Evidence §6, Tools "weakest" §1). It
  either earns a link or its card stops implying one. A positioning call, not a
  fix — see §F.
- **The Gift Registry's subject.** `registry-prado.js:283` hard-codes a Prado
  parts list; the page title sells "a free wishing well alternative" (Tools §H6).
  That should be a decision, not a default.
- **Endings.** A "fully staffed ✓" at roster level; something that marks the last
  meal in a meal train (Tools "strongest" §1, §3). The organiser's page is
  currently the participant's page plus admin controls; it should be the
  participant's page plus an ending.
- **`og:image:alt`** (one line in `shareTags()`) and **`role="alert"` on every
  `form-error`** (one attribute each). Both real, both small, both correctly
  ranked below everything above.
- **Extend the baked live preview** to gift-registry, bracket, roles and baby —
  by the `gen-live-preview.mjs` pattern, never client-side (Diagnosis §I.8).
- **Search.** Not at 22 tools. IA §F pre-commits the three triggers: past ~35
  tools, or the blurb-synonym fix fails a five-person test, or `/` is a major
  entry point with poor click-through after B4. If it is ever built, no `?q=` in
  a URL.
- **New tools** — §D. Deliberately last. The shelf has 22; the leverage is in the
  link, not the count (§F).

---

# D. New tools — six, and four I rejected

Filter applied to every candidate, all conditions, no exceptions: a common
annoying **coordination** problem · currently done in a spreadsheet or a group
chat · fits a tiny interface · works through a shared link · needs no account ·
has an obvious aha. Anything that is a productivity feature rather than a group
coordination job is not here.

Each also names the occasion section it lands in (`03-ia.md` §E.1) and the tool
it stands beside, because a new tool that doesn't fit the shelf is a new shelf.

### 1. Who's In? — a headcount with a threshold and a cut-off

**Problem:** "Thursday drinks, minimum 8 or we cancel — thumbs up if you're
coming," and then someone counts thumbs-up reactions in a thread of 40 messages
and gets it wrong.
**Why link-share suits it:** the tally *is* the shared object, and the aha is the
line under it flipping from "3 short" to **"it's on"** — which everyone in the
chat sees on the same link at the same time without anyone having to announce it.
*Section 5. Neighbour: Group Vote — and distinct from it, because a vote picks
between options and this one crosses a line.*

### 2. Settle Up — who owes whom, after a group trip

**Problem:** the house was on Jen's card, the groceries on mine, someone got the
ferry tickets — and it ends as a spreadsheet nobody trusts or a chat thread of
receipt photos.
**Why link-share suits it:** everyone adds what they paid on the one link, and
the aha is eleven payments collapsing into **three transfers**. The site never
touches the money, which is already its stated position on the registry — it
holds the arithmetic, not the cash.
*Section 2. Neighbour: Bring a Plate — the same "everyone adds one thing to a
shared board" mechanic.*

### 3. The Whip-Round — the group gift kitty, without the reply-all

**Problem:** "$20 each for Dave's leaving present, PayID's in my bio" — and the
organiser ends up privately chasing six people and keeping a list in Notes.
**Why link-share suits it:** the board says **"$280 of $300 · 14 of 16 in"** and
does the chasing, so nobody has to be the person who asks twice. Payment stays
person-to-person exactly as it is now; the link only tracks who has said they're
in.
*Section 1, beside Group Card — they are the same afternoon, and a farewell needs
both.*

### 4. Carpool — seats offered, seats claimed

**Problem:** "Who's driving to the tournament, and has anyone got room for
Milla?" resolved across three chats and one parent who ends up driving twice.
**Why link-share suits it:** it is a roster whose rows are cars, and the aha is
seeing **every seat filled and no child unaccounted for** in one screen — the
thing a group chat structurally cannot show you.
*Section 2, beside Volunteer Roster. Same audience, same weekend.*

### 5. The Rota — whose turn it is, on the same link, forever

**Problem:** bins, the sharehouse kitchen, who brings the oranges to under-10s.
Currently a whiteboard, a fridge printout, or a spreadsheet nobody opens.
**Why link-share suits it:** the link never changes and the answer does — open it
and it says **"this week: Sam"**. It's the only retention mechanic this product
can have without an account, and Question of the Day already proves the pattern
works.
*Section 4 · Every Monday. Neighbour: Question of the Day.*

### 6. Address Book — collect thirty addresses without asking thirty times

**Problem:** Christmas cards or wedding invites, and the single worst job in a
group chat: "can you all DM me your postal address," then transcribing them into
a spreadsheet with typos.
**Why link-share suits it:** each person fills in only their own row through the
one link, nobody sees anybody else's, and the aha is the organiser getting a
**printable label sheet** at the end. Meal Train already establishes the pattern
of an address the board collects but does not display.
*Section 1. Neighbour: Group Card.*

---

### Rejected, and why — the discipline is in this list

- **A date poll ("who's free Saturday?").** Genuinely the most common group-chat
  failure there is, and it is **Group Vote with dates as the options**. Building
  a second tool for it lengthens the shelf without adding a mechanic. If dates
  deserve special handling, that's a feature of Group Vote.
- **Photo collection for the slideshow.** Requires file storage, moderation and a
  deletion policy — three things this architecture does not have and should not
  acquire for one tool.
- **A packing / bring list for a camp.** Bring a Plate with different category
  labels. Same board, same claims, same everything.
- **A shift-swap board.** Volunteer Roster already has the shifts and the names;
  a swap is a feature of that tool, not a tool.

**One ordering note.** Six new tools is a quarter, not a sprint, and §F argues
the count is not where the leverage is. If only two ever get built, build **Who's
In?** and **The Whip-Round** — the tiniest interface on the list, and the one
that plugs straight into an occasion the shelf already has.

---

# E. What to measure, and the rules written first

**The honest starting position:** roughly 7 lifetime creations, one row in
`.stats-history.jsonl`, both of its recorded failures flagged as test traffic by
its own author. **Nothing in any of these five documents is validated.** The job
of this section is not to prove the Now items worked — at this volume that is not
available — it is to make sure that in six weeks the answer is a number rather
than a memory of what we hoped.

## E.1 The smallest instrumentation that would tell you anything

Three things. Two are already built. One is a single SQL count.

**(i) A weekly row in `.stats-history.jsonl`, including `cold`.** Zero new code:
`npm run stats` prints it. Same day each week, appended, never edited.

**(ii) One new column in `scripts/stats.mjs`: `titled` — the share of instances
created with a non-empty organiser title, per tool.** This is the only new
instrumentation in the entire roadmap. It is one `COUNT(*) WHERE title <> ''`
against a column that already exists, it is aggregate, it identifies nobody, and
it is the only way to know whether A3 did anything. It stays inside the envelope
Diagnosis §I.3 draws.

**(iii) One number from Cloudflare Web Analytics, written down once:** entries to
`/` as a share of all entries. Not a dashboard habit — one figure, recorded in
`.stats-history.jsonl`'s note field, before B4 is written.

**Explicitly not built, now or later** — this list is as load-bearing as the one
above, and Diagnosis §I.3 is the reason: no beacon on `/s/`, `/e/` or `/p/`; no
per-view logging (`migrations/0001_init.sql:34-40`); no per-respondent view on
Weekly Pulse; no who-drew-whom on the organiser page; no `?q=` corpus if search
is ever built. The homepage says why on line 356: *"What their friends do in a
sweep or a meal train is none of our business."*

## E.2 The rules, pre-committed

Written now, while the data does not exist, so they cannot be reverse-engineered
later into whatever the numbers happen to say.

**Floor, inherited rather than invented.** No claim about any Now item from fewer
than **20 events** of the relevant kind. No comparison between two variants from
fewer than **50**, which is the number `src/worker.js:404-410` already committed
to for exactly this reason.

**A1 (client array deleted): no metric, and that is the correct answer.** It is a
correctness fix, not an experiment. Its falsifier is `check-seasons.mjs` and the
homepage on 1 January. Inventing a KPI for a bug fix is the same mistake as
reading five clicks as a result.

**A2 (`ownCta()` on sixteen tools):**

- The existing rule stands unchanged: **do not change either placement until one
  of them has 50 clicks.** Extending coverage is not changing a placement.
- **Do not compare tool against tool** on `via:cta` until a single tool has 50.
  Twenty tools with two clicks each is not a leaderboard.
- If a `/p/` placement is added (Tools §G5), it ships as its own token
  `/via/:tool/p` and **never merges into the cta/foot comparison**. A new page
  type is not a third variant of an old test.
- **If the whole set has fewer than 20 `via:cta` clicks by 15 January** — after
  the Cup, Christmas and the summer BBQ window, the three peaks this product has
  — the recruiting loop does not work as designed, and the next move is not a
  better CTA. It is E.3.

**A3 (the `(optional)` relabel):**

- Baseline `titled` for the eleven builders **before** the strings change.
- **Decision rule:** if blank-title share on those eleven does not fall by at
  least a third within 4 weeks *or* 40 eligible instances, whichever is later,
  the label was not the constraint. Do not revert the copy — it is more accurate
  either way — but stop spending effort on card quality through wording, and put
  it into B7's `/e/` card preview instead, which shows rather than tells.

**A4 (Grand Final Sweep): no honest instrument exists, and I will not manufacture
one.** `stats.mjs:26-27` states it plainly: *"sweep and bracket write to neither
table. They are structurally unmeasurable here."* This item is justified by the
calendar and by the fact that a required field below its own submit button is
wrong on inspection. It becomes measurable only after B3 ships
`first_opened_at`, and it is not worth delaying to November for that.

**A5 (the second row):** the instrument, so its own rule is about honesty rather
than outcome — the row is appended even when the numbers are bad or flat, and the
note field records what shipped that week. The existing row is exemplary in
exactly this way: it names its own contamination.

**B4 (the IA re-cut), gated:**

- **Pre-committed threshold: if `/` is under 15% of entries, B4 drops from Next
  to Later** and its budget moves to guide-page → tool-page conversion, which is
  where the traffic actually is. IA §"How I would tell if I'm wrong" reaches the
  same conclusion — *"this entire document is a low-stakes refactor"* — and this
  number is what decides it.
- If B4 does ship, its falsifier is already written (IA item 3): the six tools
  the occasion row points at, against the sixteen it doesn't. **If the six do not
  move relative to the sixteen across four weekly rows, the occasion hypothesis
  is wrong** and the vocabulary problem is upstream at Google, not on the
  homepage.

## E.3 The rule that outranks all of the above

**If, after four weekly rows, `cold` is still 0 across every tool** — nobody has
ever acted on a shared link more than five minutes after it was made — then no
item in Now, Next or Later is answering the real question. The failure is not
discovery, not copy, not field order, and not the shelf. It is that these links
are not reaching a second person at all.

**Pre-committed response, so it cannot be argued away when the row prints:** stop
shipping page changes. Do IA §"How I would tell", item 4 — five people who have
organised a group thing, given a situation out loud, on a phone, timed. n=5 is
not statistics and this document does not pretend otherwise. It is the only
instrument available that measures *finding* rather than *arriving*, it needs no
code and no traffic, and at 7 lifetime creations it will tell you more in an
afternoon than four weeks of rows.

---

# F. The framing decision

**Collection of tools, platform, or tiny coordination layers for group chats?**

**Answer: tiny coordination layers for group chats.** Not a platform — the
architecture forbids it. Not a collection either, though that is how the site
currently describes itself; "collection" is accurate about the inventory and
wrong about the mechanism, and that error has a cost in what gets built next.

The evidence is in the products, not in preference.

**1. The runtime is somebody else's group chat, and the code says so.**
`src/lib.js:334-388` exists for one purpose: to make a link unfurl correctly in
WhatsApp and Slack. The withholding rule at `src/lib.js:318-333` is reasoned
entirely in terms of what a chat channel does — *"rendered to everyone in
whatever channel it lands in, then cached on someone else's servers (Slack keeps
it ~30 minutes)"*. `robots.txt` disallows `/s/`, `/e/`, `/p/` for 30+ named
agents and `src/lib.js:404` sets `noindex` on every `pageShell()` render. The
product's live surface is deliberately outside the web, inside private group
threads. That is not a distribution channel a collection happens to use — it is
where the software runs.

**2. There is no membership, so there is nothing to be a platform of.**
Participants sign up for nothing, install nothing, are emailed nothing, and are
added to nothing. Kris Kringle is two taps and zero typing (Evidence §4). Weekly
Pulse's anonymity is a claim about architecture, not policy — *"there's no
account, so there's nothing to identify anyone with"*. A platform needs an
identity spine; every one of this product's strongest guarantees is a consequence
of not having one.

**3. There is no cross-tool state, and the review's own fix is deliberately not a
spine.** Twenty-plus separate `localStorage` keys; the homepage contains zero
references to `localStorage` and does not know you have ever made anything
(Diagnosis §A.5). The proposed fix is *one browser key* — explicitly "not an
account", nothing syncs, clearing your browser clears it. When the sharpest
retention problem in the product is correctly solved with a `localStorage` key,
the thing is not a platform, and the review already knew it.

**4. The strongest and weakest tools sort exactly along this axis.** The three
strongest — Volunteer Roster, Kris Kringle, Meal Train — are the three where the
chat is the distribution and the board is the entire interface. The weakest, Team
Picker, is *the only one of 22 that produces no link* (Evidence §3, Tools
"weakest" §1). It is not weakest because it is badly built; it is weakest because
it is the one tool that is not a coordination layer for a group chat. That is the
clearest evidence in the whole review, and it also settles §C's Team Picker
question: it earns a link, or it leaves the shelf.

**5. The clock already agrees.** `SEASONS` is not a bet on a feature. It is a bet
on *when a group chat has a particular job* — footy finals, the Cup, December,
summer BBQs, school term. Five occasions tiling a year, checked across all 366
days. The site's one editorial mechanism is already organised around group-chat
occasions rather than around products.

**Why the distinction is practical rather than semantic.** Framing decides the
next move. Read as a **collection**, the obvious next move is more tools — and §D
would be the top of this roadmap instead of the bottom. Read as **coordination
layers for group chats**, the next move is making each link land better in the
chat it gets pasted into: the title that decides the card (A3), the recruiting
moment on the page thirty people actually see (A2), the participant pages that
explain before they let you act (B5), the preview that shows an organiser what
the group will see (B7). Those are the top of this roadmap, and they are top
because of the framing, not despite it. **Twenty-two tools is enough. The
leverage is in the link, not the count.**

**What would change my mind**, pre-committed like everything else: if A5's
entry-page number shows `/` is a major entry point and people are arriving at the
shelf and browsing it, then "collection" has more truth in it than I am allowing,
B4 becomes the most important item in the document, and §D moves up. The same
single number settles both questions — which is the best argument for looking at
it this week.
