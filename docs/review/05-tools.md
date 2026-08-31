# The tool experience — bitibybit.com

Written against `docs/review/01-evidence.md` (facts) and
`docs/review/02-diagnosis.md` (settled positioning). Neither is re-derived.
This document is about the 22 tools, not the homepage — `03-ia.md` owns that.

Everything below was measured live at 375×812 against `https://bitibybit.com`
on 31 August 2026, or read out of the repo at `0cec1dd`. Where I reason from
heuristic rather than measurement it says **HEURISTIC** and names what would
settle it. Every recommendation names a file.

Pages opened and driven, not just read: `/volunteer-roster/`, `/kris-kringle/`,
`/meal-train/`, `/bring-a-plate/`, `/hens-planner/`, `/gift-registry/`,
`/team-picker/`, plus all 21 `/s/demo-*` pages fetched and parsed, and every
builder instrumented in a 375px frame to get real layout positions rather than
guessed ones.

---

## 0. What landed this week, confirmed, and therefore not re-proposed

I checked these before writing anything, because a review that asks for work
already done is worse than no review.

**Proportional type — done.** `getComputedStyle(document.body).fontFamily` on
every page opened returns the system UI stack (`-apple-system`,
`Segoe UI Variable Text`, `Roboto`, …). No monospace in body copy anywhere I
looked. What remains monospaced is the wordmark and the small-caps chips,
which is deliberate.

**Contrast — done, and comfortably.** Sampled across `/volunteer-roster/`:
h1 5.35:1, lede 7.18:1, field labels 9.34:1, primary button 5.66:1,
`See a finished roster →` 9.34:1. The floor is the parenthetical `(optional)`
hint text at **4.56:1** — passing AA at 14px with about 0.06 of margin. That's
the number to leave alone rather than shave.

**Live previews — done, and they work.** All five are real. I typed twelve
names into `/kris-kringle/` in a 375px frame: the label went to
"12 in the hat — this is what people will tap" and the board rendered
"Sharon M … and 6 more". The baked-first-frame trick in
`scripts/gen-live-preview.mjs` does what its comment says.

**The tall-textarea cap — done, and correctly reasoned.** `styles.css:447-468`
caps `rows="9|11|12|14"` at 11rem under 720px, with the arithmetic written out.
I re-derived it: `#names` on Kris Kringle renders 176px and shows about 6 lines
of a 12-name list. That is a considered trade with the live preview as the
mitigation, and the preview does mitigate it. Leave it.

**Error scroll on the one-tap builders — done.** Six builders carry a top
`one-tap` submit (`bring-a-plate`, `kudos-wall`, `question-of-the-day`,
`scrum-poker`, `volunteer-roster`, `weekly-pulse`) and all six client files
carry `if (window.scrollY < 200) err.scrollIntoView({ block: "center" })`.
I went looking for the "tap the hero button, nothing visibly happens" bug and
it isn't there.

So the rest of this document is about placement, ordering, and the two stages
either side of the builder — Share and Participate — which the rebuild did not
touch.

---

# G. The ideal tool template

Five stages. For each: what's on screen, the primary action, the minimum
input, what must **not** be there, and the BBQ test.

**The BBQ test, stated once so each stage can be scored against it.** One
thumb. The other hand holds a drink. Roughly 700px of usable screen once
browser chrome is counted, in sunlight, with people talking. A stage passes
if: the primary action is visible without scrolling; its target is ≥44px;
nothing must be read before acting; typing is a name or nothing; and a
misfire is recoverable in one tap.

---

## G1. Landing — `/tool-name/`

**On screen, in order, and nothing else above the form:**

1. Kicker: three promises, five words. `Free · no signup · one shareable link`.
   Already consistent across the set, and two pages vary it honestly
   (`Free · no emails · …` on Kris Kringle, `Free · money goes straight to you`
   on the registry). Right as it is.
2. Tool name.
3. **One sentence** of what it is, in a situation, not a category.
4. The example link.
5. The form.

**Primary action:** the submit button — or, where every field has an honest
default, the one-tap button above the form.

**Minimum input:** on the six one-tap builders, none. Elsewhere, exactly one
required field before the button.

**Must NOT be there: the second and third sentences of the lede.** Ledes
currently run 30–52 words. Measured: meal-train 52, weekly-pulse 51,
gift-ideas 50, hens-planner 49, gift-registry 46. Sentence two is always the
mechanism ("Set the shifts, share one link, and volunteers put their own name
down"), sentence three the payoff ("You watch it fill in — and print or export
the lot"). Both are true, both are good writing, and both are answered by the
form and the preview sitting directly underneath. On a phone they are 150–250px
of prose between the reader and the thing itself.

Also must not be there: any optional field above the button (§H2), and any
second explanation of what the tool costs.

**BBQ test:** currently **6 of 22 pass**. The six one-tap builders put a
working button at 380–434px. The other sixteen sit at 590–1761px. Table in §H2.

---

## G2. Create

**On screen:** the one required field, prefilled where a default is honest;
the live preview of what participants will see; the button. Optional fields
below the button.

`volunteer-roster` and `bring-a-plate` already *are* this template:

```
Shifts (one per line)        [prefilled, five real shifts]
5 shifts, 16 spots — this is what people will see
[baked preview board]
        Build the roster →
Roster title (optional)
When is it? (optional)
Note for volunteers (optional)
```

**Primary action:** the submit button. One rank per screen. The two rebuilt
pages have two buttons — the hero one-tap and the in-form one — and that is
fine, because the top one is captioned differently ("Build the roster **now**")
and paired with "or change them below". Two buttons with the same label would
not be.

**Minimum input:** zero keystrokes where the tool's data is structural (shifts,
categories, a card deck, a 1–5 scale); one field where it is personal (a
family's name, a recipient, a question). Never more.

**Must NOT be there:**

- Optional fields between the required one and the button. Nine of them on
  `/gift-registry/`, five of which ask for bank details.
- A required field *after* the button. This exists exactly once, and it is on
  the tool the seasonal card is promoting today — §H3.
- A disabled primary button on load. Exists once: `/team-picker/`.
- A preview that can't render. Exists once: `/kris-kringle/`, where the names
  ship as a `placeholder` rather than a value, so the preview reads
  "Paste the names and the board appears here." That is the correct call for
  Kringle — a prefilled list of fake colleagues is worse than an empty one —
  but it means the December flagship is the one tool whose preview shows
  nothing on arrival. §Strongest has the fix that keeps both properties.

**BBQ test:** the six one-tap builders pass outright. Roster and plate pass
even without their hero button, because the required field is prefilled and
the preview is real. Anything with two or more required free-text fields fails:
you cannot type a question, five options and a title one-handed holding a beer,
and no layout change fixes that. That isn't a defect — it's the tool's nature.
It's an argument for G3 carrying more weight.

---

## G3. Share

The stage that decides whether the product exists. It is the best-built and
the most cluttered stage in the set.

**On screen now** (every `/e/` page — `src/lib.js:239-252` plus each tool's
`editPage`):

1. Organiser banner — "Bookmark it — the link is the only way back in."
2. Kicker, title, status line, meta chips.
3. `share-box`: the bare URL in a readonly input + **Copy** (`btn primary`).
4. `shareNudge`: an editable paste-ready message + **Share…** (`btn primary`,
   mobile only) + **Copy**.
5. Tool actions (CSV, Print) where they exist.
6. The board.
7. Open the shared page · Delete · Make another.

**What should be on screen:** one share control, and a picture of what the
group is about to see.

**Primary action:** `navigator.share()` on mobile, the paste-ready message on
desktop. The library code is right — a single `text` member, called
synchronously, `AbortError` swallowed, `sendBeacon` for the shared tick, and
`#copyBtn` delegated so the bare-link copy counts too. The comment explaining
each of those is worth keeping.

**Minimum input:** none. The default message is already built from what they
typed, and making it editable was correct.

**Must NOT be there:** two primary buttons. Demote `#copyBtn` in `share-box`
to `.btn` and let Share…/Copy in the nudge be the pair. The bare URL still
needs to be copyable — plenty of people paste links into email — but on a phone
it is the secondary path and it currently looks like the main one. That's the
only thing wrong with this stage's content; the rest is rank.

**What's missing:** the organiser never sees the card. They are one tap from
pasting into a group of thirty and they have no idea it will render as
"Volunteer roster / Pick a shift and put your name down." with generic art if
they left the title blank — which the label told them was optional. See the
sharing section at the end.

**BBQ test:** passes on mobile the moment `navigator.share()` exists, which is
the majority case. One tap, native sheet, done. The clutter costs a beat of
"which button?", not a failure.

---

## G4. Participate — `/s/:slug`

The strongest stage on the site, and the one to protect.

**On screen:**

1. Kicker naming the mechanic in five words — "Who's on which shift".
2. The organiser's own title.
3. A count that is also a status — "3 of 12 spots filled · 4 shifts".
4. Any chip that is genuinely safety-critical (dietary needs on Meal Train).
5. **The board.** Immediately.

**Primary action:** one big button per row. `/s/demo-volunteer-roster` renders
"Put me down" at **313×49px**, the first at y=390. Correct target, correct
position; I'd change neither.

**Minimum input:** zero where the tool already knows who you are (Kris Kringle,
Coffee Roulette, Fact Matcher — tap your own name); a first name where it
can't (roster, plate, meal). Never an email, and there isn't one anywhere.

**Must NOT be there: the explanatory paragraph.** Measured `<main>` word counts
across all 21 demos:

| Words | Page |
|---|---|
| 59 | secret-role-dealer |
| 74 | tournament-bracket |
| 90 | grand-final-sweep |
| 91 | scrum-poker |
| 114 | kris-kringle |
| 115 | fact-matcher, group-card |
| 118 | hens-planner |
| 137 | coffee-roulette |
| 141 | gift-registry |
| 145 | kudos-wall |
| 150 | group-vote |
| 174 | bring-a-plate |
| 176 | gift-ideas |
| 177 | melbourne-cup-sweep |
| 179 | baby-guess-pool |
| **190** | **volunteer-roster** |
| 234 | weekly-pulse |
| 255 | recipe-collection |
| 315 | meal-train |
| **410** | **question-of-the-day** |

Volunteer Roster is 190 words and **none** of them explain what to do. Kris
Kringle is 114 and 46 of them are an instruction paragraph sitting between the
chips and a grid of names, each of which says "That's me" underneath it.
Coffee Roulette is 137 with a 52-word paragraph doing the same job. The grid
has already said it.

The rule: **reassurance belongs after the tap, not before it.** Weekly Pulse
gets this exactly right — nine words of scale ("1 is a rough week, 5 is a good
one"), then the five buttons, and only then the paragraph about why this
week's number stays closed. Question of the Day gets it backwards: an optional
name field above the A/B buttons, then 33 words about vote-hiding that nobody
needed before deciding whether a puddle is a lake.

**BBQ test:** the strongest stage passes emphatically — roster, plate, hens,
pulse, poker, kringle, sweep. It fails on `question-of-the-day` (410 words and
a text field above the primary action) and drags on `meal-train` (315, though
most of it is load-bearing).

---

## G5. Result

Two different results, and the template has to name both.

### The participant's result — `/p/:token`

`src/tools/kringle.js:301-380` is the model: the kicker
"Ssh — this page is just for Alex", the reveal in its own block, the giftee's
wishlist, then your own. It is the highest-attention screen the product
produces and it is well made.

**Must NOT be there:** anything. It's clean.

**What is missing:** it is the only page type carrying no recruiting element
at all — not even on the four tools that have `ownCta()`. The diagnosis (§A.2)
covers the sixteen missing `/s/` placements and I won't restate it; the `/p/`
observation is additional. A person who has just been told who they're buying
for is the most receptive audience this product has, and they get a grey
footer credit. **HEURISTIC** on the size of that. *What would settle it:* the
`via:cta` / `via:foot` split by page type, once `/via/:tool/cta` exists on more
than four tools.

### The organiser's result

The thing is full. What now?

`Print` and `Download CSV` exist as visible buttons on **three** tools —
`meal.js`, `roster.js`, `recipe.js`. `public/styles.css` contains **17**
separate `@media print` blocks, so the print stylesheets exist for nearly
everything. The work is done and the button isn't there.

The sharpest case: `public/index.html:69` promises the Grand Final Sweep is
"printable for the fridge", and `src/tools/sweep.js` renders no print control.
`styles.css:554` even carries the comment "print — offices stick these on the
fridge".

**What should be there:** one `Print this <thing>` button on every `/e/` page
whose print block already exists. Five lines per tool, and it completes a
promise the CSS already keeps.

**BBQ test:** not applicable — nobody prints at a BBQ. But "stick it on the
fridge" is the moment the tool stops being a link and becomes a thing in the
house, and on most tools it is one button away.

---

# H. The top ten

Ranked by what the mistake costs, not by how easy it is to fix.

## 1. The live preview is below the fold on all five pages that have it

Measured, 375×812, top of `.live-preview` on load:

| Page | Preview top | Visible on landing? |
|---|---|---|
| `/meal-train/` | **1057px** | No — 245px below the fold |
| `/hens-planner/` | 865px | No |
| `/bring-a-plate/` | 839px | No |
| `/volunteer-roster/` | 835px | No |
| `/kris-kringle/` | 628px | Yes — and empty |

Against 812px of frame, and more like 700px of real phone once the URL bar is
counted. The best thing that shipped this week — the answer to "what will
people actually see" — is invisible at the moment the visitor is deciding
whether to bother.

This is not a request to redo it. The preview is correct, baked, build-checked
and cheap. It is 220–280px tall and it is sitting 300–500px too far down
because of what's above it: a 42–52 word lede, an example box, and (on meal and
hens) four to six fields.

**Files:** `public/meal-train/index.html:92`, `hens-planner/index.html:72`,
`bring-a-plate/index.html:70`, `volunteer-roster/index.html:78`,
`kris-kringle/index.html:68`.

**What I'd do:** cut each lede to its first sentence — the situation sentence,
which is the good one in all five cases — and move the mechanism sentence into
the body prose that already exists further down the page. That's 100–160px per
page and it costs nothing the reader needed at that moment. On meal-train, also
move the four defaulted fields below the button (§H2); that's the other 400px.

## 2. Seven builders hide the primary button below the fold; only six put it above 500px

First submit control, y at 375×812:

| Button y | Page |
|---|---|
| 380 | kudos-wall, scrum-poker |
| 426–434 | weekly-pulse, volunteer-roster, question-of-the-day, bring-a-plate |
| 590 | team-picker *(and it's disabled — §H4)* |
| 622–635 | group-card, coffee-roulette |
| 694–775 | melbourne-cup-sweep, tournament-bracket, fact-matcher, gift-ideas, kris-kringle, baby-guess-pool |
| 829–963 | recipe-collection, secret-role-dealer, group-vote, grand-final-sweep |
| **1145** | hens-planner |
| **1351** | meal-train |
| **1761** | gift-registry |

The six at 380–434 are the `one-tap` builders and they prove the pattern. The
694–775 band clears an 812px frame but not a real phone's ~700px.

None of the seven worst can become one-tap — I checked each client file and all
seven have a genuinely required free-text field (`registry-make.js:43`,
`meal.js:110`, `hens.js:102`, `poll.js:110`, `roles.js:142`, `recipe.js:46`,
`sweep.js:105`). You cannot default a family's name.

**What you can do is the roster/plate ordering**, which already ships: required
field → preview → **button** → optional fields. Where each page stands:

| Page | Fields above the button | Of which required |
|---|---|---|
| volunteer-roster | 1 | 1 |
| bring-a-plate | 1 | 1 |
| hens-planner | 2 | 2 |
| secret-role-dealer | 2 | 1 |
| recipe-collection | 3 | 1 |
| meal-train | 6 | 2 |
| **gift-registry** | **10** | **1** |

`gift-registry` puts nine optional fields — including PayID, account name, BSB
and account number — between "Your names" and "Open the garage →". Moving them
below the button takes that page from 1761px to roughly 550px. `meal-train`'s
four defaulted fields (`meals`, `spacing`, `capacity`, and the `allergies`
box) are the same move, worth about 400px.

**Files:** `public/gift-registry/index.html:61-118`,
`public/meal-train/index.html:61-100`,
`public/recipe-collection/index.html:59-72`,
`public/secret-role-dealer/index.html:61-84`.

## 3. Grand Final Sweep has a required field *below* its submit button

At 375×812: `#drawBtn` at **963px**; `#names` — required, minimum two, no
prefill — at **1071px**. It's a two-column form and column 2 stacks after
column 1 on a phone.

Melbourne Cup, same module, doesn't have this: `#names` at 457, button at 694.
It is a page-level slip in one file: `public/grand-final-sweep/index.html:80-87`.
The same file also puts `Sweep title (optional)` first, above `Team one` /
`Team two` — §H2 in miniature.

This matters more than its size because of the calendar. `SEASONS`
(`src/worker.js:179-195`) points the homepage feature card at this tool from
15 August to 5 October. It is doing so today.

`public/sweep.js` also lacks the `err.scrollIntoView` guard the six one-tap
builders have — though here the error renders directly above the button, so it
is visible. The scroll isn't the bug; the field order is.

## 4. Team Picker's first screen is a greyed-out button

`/team-picker/` at 375×812: `Shuffle into teams →` at y=590, `disabled: true`,
`#statusLine` empty. The names box above it is placeholder-only, so on arrival
the primary action is a dead grey rectangle with nothing explaining why.

It is also the only tool with no `See a finished X →`, the only one with no
`form-error` element at all, and the only one that produces no link —
`og-teams.png` sits unused in `public/art/` because there is no `/s/` page to
attach it to.

Its kicker is honest about that: `Free · no signup · nothing leaves your
browser`, where every other tool says `one shareable link`. But a tool on a
shelf whose promise is "make a thing, share a link" that makes no link, and
whose landing screen is a disabled button, is the weakest first impression in
the set.

**Minimum fix, no architecture change:** enable the button and seed the names
box with a real value the way roster and plate do, so the first tap shuffles
six sample names and shows what the output looks like. **Files:**
`public/team-picker/index.html:88`, `public/team-picker.js`.

## 5. The field that decides your link preview is labelled "(optional)"

`shareTags()` (`src/lib.js:359-388`) builds the card title from the organiser's
own title, falling back to the tool's generic name. That title is the **only**
instance-specific thing in the card — the description and artwork are fixed per
tool by design, and correctly so (`02-diagnosis.md` §I.1).

Eleven builders label that field `(optional)`: bring-a-plate, fact-matcher,
gift-ideas, grand-final-sweep, group-card, kris-kringle, melbourne-cup-sweep,
question-of-the-day, secret-role-dealer, tournament-bracket, volunteer-roster.

Leave it blank and the WhatsApp card reads:

> **Volunteer roster**
> Pick a shift and put your name down.
> bitibybit.com

— identical to every other roster ever made with this site.

`question-of-the-day` is worse than optional; it is misdescribed:
`Team name (optional — it just sits at the top)`
(`public/question-of-the-day/index.html`). It does not just sit at the top. It
becomes `og:title` — verified live, `/s/demo-question-of-the-day` returns
`og:title = "Level 3 Finance — question of the day"`.

**What I'd do:** don't make it required — that adds a mandatory field to nine
forms that currently need none. Change the hint to say what the field does:
`Roster title (optional — this is what shows in the group chat)`. Eleven
strings, no build check affected (`sync-card-copy.mjs` reads homepage cards,
not builder labels).

## 6. Gift Registry: the most previewable output on the site has no preview

The tool draws a pixel Toyota Prado that paints itself in as parts get claimed.
`/s/demo-gift-registry` renders it beautifully — the vehicle, a progress bar,
"**$1,650** of $25,000+ · **1** of 126 parts · **4%** built", then a build
sheet by category. It is the most distinctive result the site produces.

The builder shows none of it: ten fields, no live preview, button at 1761px —
2.2 screens on a phone — and a primary CTA reading `Open the garage →`, which
is charming and does not say what the tap does.

Two structural things a designer has to say out loud:

- The registry has exactly one subject. `public/registry-prado.js:283` is a
  hard-coded `PARTS` list for a Prado. The homepage card says "Pixel Gift
  Registry"; the product is "help us buy a 4WD". A couple arriving from
  "a free wishing well alternative" — the page's own `<title>` — gets a Prado.
  That is a positioning decision rather than a bug, but it should be a
  decision, not a default.
- 126 claimable parts is a lot of choices for someone who opened a link in a
  group chat.

And the form asks for BSB and account number with no adjacent line about who
sees them. The answer exists — `gift-registry/index.html:175`, "Payments happen
directly between your guests and your bank account" — five screens below the
field that needs it.

**Files:** `public/gift-registry/index.html`, `public/registry-prado.js`,
`src/tools/registry.js`.

## 7. Explanation sits before the action on four participant pages

Covered in §G4 with the word-count table. Concretely:

- `src/tools/kringle.js` — 46 words between the chips and the name grid, on a
  page whose grid says "Alex / THAT'S ME".
- `src/tools/coffee.js` — 52 words above an identical grid. (Its one genuinely
  useful clause — "You only claim your name once, not every round" — should
  survive; the other 40 words shouldn't.)
- `src/tools/qotd.js` — an optional `Your name` text input above the two big
  A/B buttons, then 33 words on vote-hiding.
- `src/tools/meal.js` — 315 words. The dietary block genuinely must come first,
  but "No account, no fuss — just a warm meal turning up when it's needed most"
  is marketing copy on a page whose reader has already decided to help.

Move each below the first action. `src/tools/pulse.js` is the worked example of
the right order and can be copied wholesale.

## 8. Three share controls, two of them `btn primary`, one job

Every `/e/` page: `share-box` Copy (`btn primary`) immediately above
`shareNudge`'s Share… (`btn primary`) and Copy. Same screen, same purpose,
competing ranks, at the exact moment the organiser wants one thing.

The `shareNudge` implementation is genuinely good and its comment explains why
each detail is load-bearing. The fix is one class:
`src/lib.js:421` and the equivalent line in each tool's `editPage` —
`class="btn primary" id="copyBtn"` → `class="btn" id="copyBtn"`. The
`markShared` delegation listens for `#copyBtn` by id, not by class, so the
beacon is unaffected and the `/cta` vs `/foot` measurement stays readable.

## 9. Print buttons exist on 3 tools; print stylesheets exist for about 20

17 `@media print` blocks in `public/styles.css`. Visible print controls in
`meal.js`, `roster.js`, `recipe.js`. `public/index.html:69` promises the sweep
is "printable for the fridge" and `src/tools/sweep.js` has no print button — on
a phone, "print" is three levels into the browser share sheet.

Add one `Print this <thing>` button to each `/e/` page whose print block
already exists. The `.own-cta` print suppression at `styles.css:2500` keeps the
recruiting block off the fridge automatically, so every new placement inherits
that rule for free.

## 10. Two smaller ones of the same class

**Scrum Poker's shared page leads with the product name.**
`/s/demo-scrum-poker` renders `<h1>Scrum poker</h1>` with the story
("Search results pagination") demoted to the sub-line — while its `og:title` is
"Platform team — scrum poker". Every other tool puts the organiser's own words
in the h1. `src/tools/poker.js`.

**Mixed prefill conventions inside one form.** On `/gift-registry/`,
`#tagline`, `#overflowTitle`, `#payMethod` and `#payNote` ship as real `value`s
while `#coupleNames`, `#weddingDate`, `#payId`, `#bsb` and `#accountNumber`
ship as `placeholder`s. The only difference on screen is text colour. A visitor
can publish "Help us build the Prado, one part at a time" having never typed it
— fine — and can equally believe they filled in a PayID they didn't. Pick one
convention per form.

**Not on this list, deliberately:** `form-error` carries no `role="alert"` or
`aria-live` on any builder. It's real, and it's a one-attribute fix on each
`<p class="form-error">`, but every error renders directly above the button
that was just pressed and the six one-tap builders scroll it into view. It
costs screen-reader users and almost nobody else, so it ranks below everything
above — and should still be done.

---

# Strongest and weakest as product experiences

## The three strongest

### 1. Volunteer Roster

**What the user is trying to do.** Fill twelve slots across four shifts for the
fete without sending thirty messages.

**Immediately understandable?** Yes, at both ends. The builder ships five real
shifts, shows the board that will result, and has a working button at 434px.
The shared page is the cleanest screen on the site: kicker, title, "3 of 12
spots filled · 4 shifts", then the board — 190 words and not one of them tells
you what to do, because "Set up 8:00–9:00am — 1 of 3 filled" above a 313×49px
button reading "Put me down" cannot be misread.

**What the first screen should show.** What it already shows, minus sentences
two and three of the lede, which would lift the preview above the fold.

**What could be removed.** 1,064 words sit below the form (`docH` 6172px, the
tallest builder on the site). That's the SEO surface and I'm not touching it,
but the FAQ answers "Do volunteers need an account?" against a kicker four
screens up that already says `no signup`.

**What would make the result more satisfying.** It already has Print and CSV,
which is most of why it's here. The missing beat is the ending: when the last
spot fills, nothing marks it. A "fully staffed ✓" already exists per shift
(`src/tools/roster.js:232`); the same tick at roster level on the coordinator
page would be the moment the job is visibly done.

### 2. Kris Kringle

**What the user is trying to do.** Draw eight names without anyone seeing the
list, and without collecting eight email addresses.

**Immediately understandable?** Yes, and the participant path is the best in
the product: two taps, zero typing, and a `confirm()` reading
`Claim "Alex"? One claim per name — only take your own.` The `/p/` page
(`kringle.js:301`) is the single best screen on the site — "Ssh — this page is
just for Alex", the reveal, their wishlist, then yours.

**What the first screen should show.** What it does, with one change. Its
preview is the only one above the fold (628px) and the only one that renders
nothing, because `#names` is a `placeholder`
(`public/kris-kringle/index.html:61`). Keeping the names unfilled is right —
you must not ship a draw of fake colleagues. Rendering the placeholder list
into the preview as a visibly greyed **sample** board, labelled "this is the
shape of it", keeps both properties and lets the December flagship demonstrate
itself before the first keystroke.

**What could be removed.** The 46-word instruction paragraph on `/s/`.

**What would make the result more satisfying.** It already is. The organiser
genuinely cannot see who drew whom and the FAQ says so out loud — protect that
above everything (`02-diagnosis.md` §I.2).

### 3. Meal Train

**What the user is trying to do.** Get eight hot dinners to a family in the
worst month of their life without becoming a switchboard.

**Immediately understandable?** Yes, and it is the one tool where the copy
earns its length. `/s/demo-meal-train` puts **dietary needs and allergies**
above everything — "No nuts — youngest is anaphylactic" — before the day list.
That ordering is a safety decision and it is correct. "Other ways to help"
(walk the dog, school pickup, a load of washing) is the most humane feature on
the site: it lets someone who can't cook still show up.

**What the first screen should show.** Fewer fields. Six sit above the button,
of which two are required and four have working defaults (`meals`, `spacing`,
`capacity` seeded in markup; `firstDate` seeded to tomorrow at
`public/meal.js:146`). Move those four below the button and cut the 52-word
lede to one sentence, and both the preview and the button come above the fold.

**What could be removed.** On `/s/`, the 35 words of reassurance inside the 315.
Not the dietary block, not the drop-off note.

**What would make the result more satisfying.** It has CSV and Print already.
The genuinely missing thing is an ending — the roster runs out and nobody is
told. **HEURISTIC**, but a family that has been fed for eight days and the
person who organised it are the two people most likely to make another one.

## The three weakest

### 1. Team Picker

**What the user is trying to do.** Split fourteen people into two fair sides,
right now, standing on grass.

**Immediately understandable?** The lede is — "Split any list of names into
fair random teams… nobody gets picked last" is one of the better sentences on
the site. The screen isn't: the primary button is disabled and grey, the config
(`SPLIT INTO 2 TEAMS` / `TEAMS OF 5`) sits *below* the button it configures,
and there is no example link to show what you get.

**What the first screen should show.** A real prefilled list of names, an
enabled button, and the split config above it. Tap once, see two teams, then
replace the names with your own. That is the roster pattern, and here it costs
one `value` attribute and one `disabled` removal.

**What could be removed.** The disabled state. A Shuffle that shuffles sample
names teaches the tool; a grey rectangle teaches nothing.

**What would make the result more satisfying.** A result you can hand to
someone. `Copy teams` exists and works. `og-teams.png` already sits unused in
`public/art/`. Giving Team Picker a `/s/` page is a larger decision than this
review should make — but the shelf it stands on promises a link, and it is the
only one of 22 that doesn't produce one. Either it earns the link, or its card
should stop implying one.

### 2. Pixel Gift Registry

**What the user is trying to do.** Ask 80 wedding guests for money without
saying "we'd like money".

**Immediately understandable?** The output is — see §H6; it is genuinely
delightful and nothing else on the site looks like it. The input is the worst
Create stage in the set: ten fields, five of them bank details, no preview, the
button 1761px down, and a CTA that doesn't say what the tap does.

**What the first screen should show.** "Your names", the pixel vehicle at 0%
built, and the button. Everything else — tagline, date, payment, overflow patch
— below it. And the "money goes straight to you, we never touch it" line next
to the BSB field rather than five screens under it.

**What could be removed.** Nine fields from above the button. None from the
tool.

**What would make the result more satisfying.** The result is already the most
satisfying on the site. It's the create stage that doesn't deserve it — and the
single fixed subject that decides who the tool is for before they've typed
anything.

### 3. Question of the Day

**What the user is trying to do.** Give a team something daft to argue about
each morning without having to remember to post anything.

**Immediately understandable?** The premise is excellent and the mechanism —
same link, new question every morning, no reminders to send — is the best
retention idea in the product. The execution is the heaviest participant page
on the site: **410 words** for a two-button decision. More than double the
roster, nearly four times Secret Role Dealer.

Above the A and B buttons: a kicker, an h1, a day counter, "Tap your side.",
and an **optional text input**. Below them: 33 words on why the split is hidden,
yesterday's answer, an "Earlier questions (7)" list, a bookmark instruction and
a privacy line.

**What the first screen should show.** The question and the two buttons.
Nothing above them but the question.

**What could be removed.** The name field goes below the buttons — it's optional
and it's the only text input standing between a reader and a tap. The
vote-hiding paragraph moves to after the vote, where it is a reward rather than
a toll. Yesterday's answer and the archive collapse behind a summary. That is
roughly 410 words down to about 90 without deleting one feature.

**What would make the result more satisfying.** The reveal. Voting currently
shows you a split. The tool's whole charm is the argument, and the moment after
the tap is where an argument starts — that screen deserves more than a
percentage. And fix the label: `Team name (optional — it just sits at the top)`
is the string that decides the WhatsApp card (§H5).

---

# Sharing, judged specifically

## What the card actually looks like

Verified against live responses, `src/lib.js:334-388`, and the files in
`public/art/`.

Every `/s/` card is 1200×630, declares `og:image:width` / `og:image:height`,
and weighs 12–24KB (largest: `og-sweep.png`, 23KB). The tags sit above the
stylesheet in `<head>`, with a comment naming why — Slack fetches with a
`Range` header and reads only the start of the document. That is correct and
thoroughly done; there is no distribution bug here.

**In WhatsApp** the recipient sees a large image card: the tool's static pixel
art, the organiser's title in bold, one line of description clipped to about
two lines, and `bitibybit.com`. WhatsApp only renders the large format when the
image is reachable, wide-ish and small; 16KB at 1200×630 clears every threshold
with room to spare. The paste-ready message puts the URL at the end of a
sentence, which WhatsApp handles — it previews the first URL wherever it sits.

**In Slack** the unfurl shows the site name, the title as a link, the
description, and the image as a `summary_large_image` block. Slack caches it
for roughly half an hour, which is precisely why the withholding rule exists.

**The good version**, Meal Train:

> **Meals for the Brennan family**
> Pick a day you can cook. Dietary needs are on the board.
> bitibybit.com

Two lines, and someone who has never heard of this site knows what is being
asked of them.

**The bad version** — the same tool with the title left blank, which eleven
builders invite:

> **Volunteer roster**
> Pick a shift and put your name down.
> bitibybit.com

Still safe, still clear about the mechanic, and completely anonymous. Nothing
tells the group *which* roster, and a person scrolling a busy WhatsApp thread
has no reason to think it concerns them. This is §H5, and it is the
highest-leverage copy change in this document, because the title is the only
lever on card quality the product still holds.

**Two small gaps, both real:**

- No `og:image:alt`. Slack reads it out; WhatsApp doesn't. A small
  accessibility item, not a distribution one. One line in `shareTags()`.
- Both sweeps, the bracket and Team Picker have no meaningful card variation,
  for structural reasons documented elsewhere. Nothing to do here.

**What I would not touch:** the withholding rule at `src/lib.js:318-333`. A
richer card — "8 in the hat · 1 claimed" — would lift click-through and would
leak a private group's state into a third party's cache. The comment ends
"If you are tempted to make a card more useful by putting the state of the
thing in it, don't", and it is right.

## Does a participant need any explanation?

**On thirteen of twenty-one demos, no.** The board explains itself: roster,
plate, hens, meal, gift-ideas, recipe, baby, card, vote, pulse, poker, kudos,
registry. Someone who has never seen this site taps the obvious thing. The
proof is Volunteer Roster — 190 words, zero instructions, and the most obvious
page in the product.

**On four, the explanation exists and shouldn't** — Kris Kringle (46 words
above a grid that says "That's me"), Coffee Roulette (52 above the same),
Question of the Day (a name field and a paragraph above two buttons), Meal
Train (35 words of marketing inside 315 of otherwise useful copy).

**On two, it's genuinely needed and it's there** — Fact Matcher (claim your
name, add a fact, come back later to guess: a two-phase game that does need a
sentence) and Coffee Roulette's one useful clause, "You only claim your name
once, not every round," which is the thing a person would otherwise get wrong.

The test I'd apply: **if the buttons on the board are labelled with verbs the
reader would use out loud, delete the paragraph.** "Put me down", "I'll cook
this day", "That's me", "I've got this", "Sign the card", "Good idea", "Lock
it in" — this site is unusually good at that, which is exactly why the
paragraphs above them are redundant.

## Should creator and participant experiences differ more?

**They already differ correctly in the two ways that matter most**, and both
are structural rather than cosmetic. `/e/` and `/p/` render no `og:` tags at
all — not blanked, simply never passed (`src/lib.js:392-396`) — so neither can
be unfurled by a preview fetcher. And the organiser cannot see who drew whom.
Don't touch either.

**Where they should differ more — three places:**

**1. The organiser should see the card before they send it.** They are one tap
from pasting a link into a group of thirty and have never seen what will
render. A small static preview on the `/e/` page — artwork thumbnail, the title
as it will appear, the fixed description — turns "(optional)" into a decision
whose consequence is visible. It also makes §H5 self-teaching: leave the title
blank and the preview says "Volunteer roster" back at you.

**2. The participant page should carry the recruiting moment; the organiser
page should not.** `ownCta()` already encodes half of that rule in its own
comment — never on `/e/`, because inviting someone to make one when they just
made one "reads as a machine talking". The other half is missing: `/p/` carries
no recruiting element on any tool, and `/p/` is where the reveal happens.

**3. They should diverge on what "done" means.** For the participant, done is
the tap, and it is handled well — a "yours" badge and an undo held in
`localStorage` (`src/tools/roster.js:290`). For the organiser, done is a full
board, a print-out, and a decision about next year. Only Print/CSV exists, on
three tools, and only if they think to look. The organiser's page is currently
the participant's page plus admin controls; it should be the participant's page
plus **an ending**.

**Where they should not diverge:** the board itself. A coordinator looking at a
different rendering of the roster than their volunteers is how "wait, which
shift did you put me on?" starts. Rendering both from one `board()` function
with an `organiser` boolean (`src/tools/roster.js:192`) is exactly right.
