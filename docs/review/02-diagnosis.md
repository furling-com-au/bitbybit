# Diagnosis — bitibybit.com

Written against `docs/review/01-evidence.md`, which is the fact base and is not
re-derived here. Repo at `0cec1dd`, 31 August 2026.

Two rules I've held myself to:

- **Nothing here claims observed behaviour.** `.stats-history.jsonl` has one
  row, dated 2026-08-25, labelled a baseline by its own author, with both
  recorded failures flagged as the assistant's test traffic. Where I reason
  from heuristic it says **HEURISTIC**, and names the measurement that would
  settle it. Where a finding is arithmetic over files in the repo, it says so.
- **Every recommendation names a file.**

---

# A. Executive diagnosis

## 1. The homepage is a shelf when the job is a router

**What's wrong.** `public/index.html:76-257` lays out 22 tools under six
headings — *Sweeps & draws*, *Gifts & occasions*, *Food & parties*, *Care &
kindness*, *Deciding & planning*, *Every day*. Those are categories of **tool**.
A person arrives with a category of **situation**: the fete is in three weeks,
Dave's last day is Friday, Mum's had surgery, it's the December lunch. Only two
of the six headings name anything a person would say out loud about their own
week.

The tell is internal, not speculative. The best situation-led writing on this
site is in `public/llms.txt`, which only machines read — Meal Train there is
"a roster of who's cooking which night for a new parent, someone unwell, or a
family having a hard week." The homepage card for the same tool
(`public/index.html:200-201`) says something close on desktop and, at ≤544px,
collapses to "Meals by date when a family needs them." The site knows how to
speak in situations. It does it for crawlers and language models, and stops
doing it for humans on phones.

Two structural symptoms confirm this is taxonomy, not copy:

- **"Care & kindness" holds exactly one tool.** A shelf built for one item is a
  shelf built for the shelf's sake. Meal Train, Volunteer Roster and Bring a
  Plate are one situation — a group rallying round something — split across
  three categories.
- **The categories are wrong by the site's own URLs.** Fact Matcher sits under
  *Food & parties*; its three guide pages are `icebreaker-questions/`,
  `standup-games/` and `board-meeting-icebreakers/` — all work contexts.
  Secret Role Dealer sits there too, beside Bring a Plate and a volunteer
  roster, neither of which is a game.

**What it costs.** HEURISTIC: a visitor with an occasion must translate it into
your product vocabulary before they can find anything, and the only
occasion-shaped element on the page is the single seasonal feature card — which
is currently broken (§3). Per the evidence, that translation has to happen from
an 88-word slice showing 2 of 22 cards and 1 of 6 headings, with the last
heading ~2.9 screens down.

*What would confirm it:* Cloudflare Web Analytics → Pages. Compare entries to
`/` against direct entries to the 22 tool pages. If most sessions land on a tool
page from search and never touch `/`, the homepage is not the router and this
drops down the list. If `/` is a significant entry point, the click-through from
`/` into a tool page is the number to watch before and after.

**What I'd do**, in `public/index.html`:

- **Re-cut the six `<h2>`s into occasions.** Regrouping is free against the
  build: `scripts/sync-card-copy.mjs` keys `SHORT` by exact tool name and
  matches cards on the `tool-name`/`tool-desc` span pair. It has no idea which
  section a card sits in. Any card can move anywhere without touching a check.
- Cuts that pass the say-it-out-loud test: *Someone's leaving, or having a
  baby* (Group Card, Gift Idea Board, Baby Guess Pool, Pixel Gift Registry,
  Recipe Collection) · *Feeding or staffing a crowd* (Bring a Plate, Volunteer
  Roster, Meal Train, Hens & Shower Planner) · *The office sweep* (Grand Final,
  Melbourne Cup) · *Getting the group to decide* (Group Vote, Scrum Poker, Team
  Picker, Tournament Bracket) · *Christmas* (Kris Kringle) · *Every Monday*
  (Kudos Wall, Weekly Pulse, Coffee Roulette, Question of the Day, Fact
  Matcher). Secret Role Dealer is the one genuine orphan in that cut, and
  probably wants a *Party games* home once there's a second game tool to sit
  beside it.
- **Add one occasion row above `#tools`** — five or six plain links, each an
  anchor to a section: `fete · farewell · Christmas · someone's unwell · team
  offsite`. About fifteen lines of markup, no new page, and it puts situation
  vocabulary into the first viewport, where there currently is none.

## 2. The one recruiting moment in the product ships on 4 of 20 tools

`src/lib.js:186-208` defines `ownCta()` and describes it in its own comment as
"The loop's only real recruiting moment… Every shared page is seen by five to
thirty people who are, by definition, in a group that organises things — and
until now the only thing offered to them was a footer credit."

It is called in four files, all inside `publicPage()` (the `/s/` page):
`src/tools/sweep.js:160`, `src/tools/plate.js:222`, `src/tools/roster.js:265`,
`src/tools/meal.js:598`.

It is absent from the other sixteen server-side tools — including
`src/tools/kringle.js`, the December flagship — along with `registry.js`,
`card.js`, `roles.js`, `bracket.js`, `poll.js`, `fact.js`, `giftidea.js`,
`hens.js`, `baby.js`, `recipe.js`, `qotd.js`, `coffee.js`, `pulse.js`,
`kudos.js` and `poker.js`. All of those render only the grey footer credit,
`<a class="quiet-link" href="/via/<tool>">made with biti by bit →</a>`.

**The instrumentation for the missing thing is already built and deployed.**
`VIA` at `src/worker.js:133-145` maps all 22 tools. The route at
`src/worker.js:411` distinguishes `/via/:tool/cta` from `/via/:tool/foot` and
logs `via:cta` / `via:foot` events with per-IP-per-hour dedupe.
`scripts/stats.mjs` prints the split. The measurement covers 22 tools; the thing
it measures exists on 4.

**What it costs.** A Kris Kringle instance carries 3 to 100 named participants
(`public/kringle.js:49`), every one of whom lands on `/s/` or `/p/` in December,
at the precise moment they have just watched a group-organising problem resolve
in two taps and no typing. What they are offered is a footer credit. None of
this is inferred about behaviour — the code is simply not there.

**What I'd do.** Add the three-line `ownCta()` call to `publicPage()` in the
sixteen missing tools, before the Cup (4 Nov) and Christmas. Write each prompt
in the shape the existing four already use — name *their* situation, never the
product:

| Tool | Prompt | Button |
|---|---|---|
| Kris Kringle | "Another group, another Christmas?" | Draw your own names |
| Group Card | "Someone else leaving, or turning 40?" | Start a card |
| Tournament Bracket | "Got an office ping pong ladder?" | Make your own bracket |
| Secret Role Dealer | "Playing again next week?" | Deal your own roles |

Two things make this cheap and safe. The print suppression is on the class, not
the call site — `public/styles.css:2500` is
`@media print { .own-cta { display: none; } }` — so every new placement inherits
the "an ad on a fridge is somebody else's brand" rule for free. And the rollout
respects the author's own decision rule at `src/worker.js:404-410`: *do not
change either placement until one has 50 clicks.* Extending coverage is not
changing a placement; it is the only way 50 clicks arrive before next Christmas.
Keep the `/cta` vs `/foot` split intact so the comparison stays readable when
they do.

## 3. The homepage's one editorial slot is wrong for 234 days of the year

There are two independent implementations of the seasonal feature card:

- **Server:** `SEASONS` at `src/worker.js:179-195`, re-rendered per request from
  the Sydney-local date via HTMLRewriter, with `scripts/check-seasons.mjs`
  walking all 366 days of a leap year to prove no gap and no overlap.
- **Client:** `public/index.html:309-353`, a four-entry `picks` array with
  different boundary dates and a different final entry, validated by nothing in
  `scripts/`.

The client script sits at the end of `<body>` and overwrites whatever the server
rendered. Running both across 2026 day by day, they disagree on **234 of 365
days**. This is arithmetic over two arrays in the repo, not a heuristic.

Right now they agree, which is why nothing looks wrong. The fuse is dated:

| Window | Server intends | Client actually shows |
|---|---|---|
| now → 5 Oct 2026 | Grand Final Sweep | Grand Final Sweep ✓ |
| 6 Oct → 4 Nov | Melbourne Cup | Melbourne Cup ✓ |
| 5 Nov → 24 Dec | Kris Kringle | Kris Kringle ✓ |
| 25–26 Dec | Bring a Plate | Kris Kringle |
| 27–31 Dec | Bring a Plate | Pixel Gift Registry |
| **1 Jan → 14 Aug 2027** | Bring a Plate, then Volunteer Roster | **Grand Final Sweep** |

For 226 consecutive days the largest, highest-placed, only editorial element on
the homepage will be badged "Footy finals · September" and point at a footy
sweep. That is precisely the school-fete and canteen-roster season — the reason
Volunteer Roster has four guide pages, prebuilt templates for ten sports
(`scripts/prebuild-rosters.mjs`), and a six-month seasonal window no visitor
will ever see.

**What I'd do.** Delete `public/index.html:309-353`. The server render is
authoritative, per-request and build-checked; the static markup beneath it is
already the correct no-JS fallback. If that script must survive for a reason I
can't see from here, then `check-seasons.mjs` has to parse both arrays and fail
the build on divergence. Deletion is 45 fewer lines and one fewer source of
truth.

## 4. The two tools you're about to promote for 82 days are the two you can't measure

`scripts/stats.mjs:26-27` states it plainly: "sweep and bracket write to neither
table. They are structurally unmeasurable here and are labelled as such rather
than reported as zero." The `sweep` type serves both Grand Final Sweep and
Melbourne Cup Sweep from one module (`src/worker.js:39`).

The seasonal card points at a sweep from 15 August to 4 November — 82 days
covering the AFL/NRL finals and the Cup. Those are the two highest-intent
moments in this product's year. The database can record that instances were
created, and that the organiser pressed Copy or Share
(`instances.shared_at`), and nothing after that. Whether a single sweep link was
ever opened by anyone other than its maker is not recorded and cannot be
derived.

Meanwhile `stats.mjs` computes a `cold` column it calls "the real number" — a
claim landing more than five minutes after creation, so plausibly not the maker
testing their own link — notes that it "reads 0 today", and that column does not
appear in the one row of `.stats-history.jsonl` at all.

**What it costs.** Every judgement in this document, and every one after it, is
made on heuristics because the instrument that would settle them isn't running.
You are 65 days from the Cup and 116 from Christmas.

**What I'd do**, in order, all cheap:

1. **Write a second row.** `npm run stats` already exists and already prints
   `made / shared / reached / cold / edited` per tool plus the `via:` split. Run
   it weekly and append to `.stats-history.jsonl`, including `cold`. One row is
   a baseline; four is the first thing in this repo that can contradict me.
2. **Give sweep and bracket a reach signal that doesn't break the privacy
   stance.** Add `first_opened_at` to `instances` (a `migrations/0004_*.sql`),
   set by the same first-write-wins beacon pattern as `markShared`
   (`src/lib.js:117-130`), and read it as cold reach when it lands more than
   `COLD_MINUTES` after `created_at`. This is *not* per-view logging: it is one
   nullable timestamp per instance, structurally identical to `shared_at`,
   saying nothing about who or how many. It gives every tool a "the link
   actually landed" number, not just these two.
3. **Nothing else.** Do not put a beacon on `/s/`, `/e/` or `/p/` — see §I.3.

## 5. Nothing brings you back to the thing you made

Every builder saves what you made to `localStorage`, across twenty-plus separate
keys: `bbb:kringle-made:v1`, `bbb:roster-made:v1`, `bbb:sweeps:v1`,
`bbb:plate-made:v1` and so on through `public/*.js`. Each is rendered only on
its own tool page, inside a `<div class="prev-sweeps" … hidden>` block that sits
*below* the builder form (`public/kris-kringle/index.html:102-105` is the
pattern).

`public/index.html` contains zero references to `localStorage`. The homepage
does not know you have ever made anything.

So: run a Kris Kringle in December and in January the only way back is the `/e/`
link in your bookmarks or your December history — and the only place the site
will remind you it exists is if you happen to navigate to `/kris-kringle/` and
scroll past the form. Run a Volunteer Roster for the fete, and the site will
never mention it on the Bring a Plate page you open a week later for the same
fete.

**Why this matters for the actual job.** "I need to organise a bunch of people"
is not one-shot. It is recurring — the office does a sweep in September, a Cup
in November, a Kringle in December — and multi-tool: a school fete needs a
roster, a plate list and a raffle. The product is built for a single use and
forgets you between tools.

HEURISTIC on the cost: returning organisers are the cheapest growth available,
and the only channel besides the shared link. *What would confirm it:* `made`
per tool in `stats.mjs` across consecutive weeks, plus the returning-visitor
share on tool pages in Cloudflare Web Analytics. Both are weak instruments,
which is itself an argument for §4.

**What I'd do.** One shared key, `bbb:made:v1`, holding
`{tool, title, editUrl, at}`, written *alongside* the existing per-tool keys so
nothing breaks. Render it in two places:

- A quiet strip on `public/index.html`, above the feature card, shown only when
  the key is non-empty: "Things you've made in this browser", up to five links,
  and one line of fine print saying they live here and nowhere else.
- The same strip in each tool page's hero, replacing the below-the-form
  `prev-sweeps` block, so it's visible *before* you start typing rather than
  after.

This is explicitly **not an account**. Nothing goes to the server, nothing
syncs, nothing identifies anyone, and clearing your browser clears it — the same
deal the site already offers twenty times over in fine print, said once, in the
place it's useful.

---

# B. Positioning

## 1. What it currently is, quoted

- `<h1>` — **"Small free tools for groups"** (`public/index.html:58`)
- `<title>` — "biti by bit — small free tools for groups"
- Lede (`public/index.html:59`) — "Sweeps, registries, rosters — the little
  organisational jobs that usually end in a spreadsheet and three reminder
  messages. Free to use, no accounts. Make a thing, share a link, done."
- Footer / `#about` — "Little tools for organising a group of people — free, no
  accounts, no fuss. You make a thing, you share a link, everyone's sorted. Made
  in Australia, with new tools added often."
- `<meta name="description">` — "Small free tools for getting a group of people
  to do something. Office sweeps, gift registries, rosters. No accounts, free to
  use — just a link you share."
- `og:description` — "Small free tools for getting a group of people to do
  something."
- `public/llms.txt` — "Small free tools for organising groups of people, made in
  Australia… One person makes a thing, shares a single link, and everyone else
  just taps it. The site never handles money."

## 2. What it should be, and why

**Keep the h1. Change what sits under it.**

The foundation is sound and I won't pretend otherwise, but here is precisely
what it costs, so the trade is explicit rather than assumed.

"Small free tools for groups" spends three of its four content words describing
the product — *small*, *free*, *tools* — and one describing the audience:
*groups*. That is the widest available word. It excludes nobody, and therefore
recruits nobody; the evidence's own five-second test scores "who it's for" as
**Partial** for exactly this reason. It also leans on price in a codebase that
maintains a build check specifically to stop price becoming a promise
(`scripts/check-claims.mjs` bans "free forever", "always free", "no fees"). So
the headline competes on the one attribute the repo has already decided it must
not over-claim.

That is a real cost. It is still not enough to justify replacing the line. The
h1's job here is to name the shelf, and it names it accurately in five words a
stranger can repeat back. Swap it and you trade a plain, honest, memorable label
for a slogan.

**The gap isn't the h1. It's that every line of positioning on this site is
addressed to the organiser, while the product's actual differentiator lives on
the participant's side.**

"*You* make a thing, *you* share a link, everyone's sorted." Every sentence is
about the maker. But the reason to choose this over a spreadsheet, a group chat
thread, or any account-first competitor is what happens to the *other* eight to
thirty people. Per the evidence: a Kris Kringle participant is two taps and zero
typing from done. They install nothing, sign up for nothing, are added to
nothing, and are never emailed. `src/lib.js:318-333` guarantees the link preview
in the group chat carries no names, no tallies and no results.
`src/tools/kringle.js` guarantees the organiser cannot see who drew whom, and
the FAQ says so out loud: "We can't spoil it, and neither can they."

None of that appears above the fold. The strongest, most defensible,
hardest-to-copy thing about this product currently lives in a privacy page and a
code comment.

So: **the same shelf, described from both ends of the link.** Keep the h1.
Rewrite the lede as three beats:

1. **The problem, in the reader's words.** The
   spreadsheet-and-three-reminder-messages line is the best sentence on the site
   and should be beat one, not a subordinate clause halfway through.
2. **The mechanism.** "Make a thing, share a link, done." Already written,
   already the differentiator, currently the fourth sentence.
3. **The participant promise**, which does not exist anywhere in the hero today:
   nobody has to sign up, install anything, or be added to anything — not you,
   and not them.

One change follows structurally: put beat 3 into `og:description` too. That
string is currently "Small free tools for getting a group of people to do
something", and it is what renders when someone pastes the *homepage* into a
group chat — the one place where the audience is, by definition, a group of
people about to be organised.

## 3. Three alternative one-line propositions

### (a) "Make a thing, share a link, done."

- **Wins:** the mechanism *is* the differentiator. Three beats, proven copy,
  already in the lede, and it separates the site in one line from every
  login-first competitor. It survives `check-claims.mjs` because it promises
  nothing about the future.
- **Gives up:** it never says *what* thing, so it is inert cold and only works
  with the grid directly beneath it. It drops the word "free", which currently
  carries the meta description and the JSON-LD `offers.price: 0`. And it isn't
  quite true of all 22: **Team Picker makes no link at all** —
  `public/team-picker.js` runs entirely client-side, has no `tool_type`, no
  `/s/` page, and its `og-teams.png` sits unused in `public/art/`. Promote this
  line and Team Picker either earns a shareable result or moves off the shelf
  whose promise it contradicts.

### (b) "The little jobs that end in a spreadsheet and three reminder messages."

- **Wins:** names the problem in the reader's vocabulary instead of the
  product's. Highest recognition of any line on the site, carries the voice, and
  is the one sentence most likely to be repeated by someone describing this to a
  colleague. It solves the "who's it for" gap by implication — it's for whoever
  has been that person.
- **Gives up:** it's a problem statement, so it needs a solution sentence
  immediately after and can't stand alone in a `<title>` or an OG card. At 70
  characters it's long for an h1. And it is office-coded: exactly right for the
  Cup sweep and the canteen roster, slightly wrong for a meal train for a family
  in the worst week of their life — a tool this site takes seriously enough to
  give two guide pages, a dietary-needs field and a kept-private address.

### (c) "Nobody has to sign up. Not even them."

- **Wins:** it's the actual differentiator, it's the only one of the three that
  speaks to the participant, and it's structurally true rather than promised —
  there is no account system to compromise, which is a stronger claim than a
  policy. It's the line that wins the head-to-head against everything else in
  the category.
- **Gives up:** it is defined by an absence, so it says nothing about what the
  site *does* — it can only ever be beat two or three, never the h1. It presumes
  the reader has been burned by a sign-up wall, which is an assumption about the
  visitor rather than a fact about them. And "free, no accounts" is already in
  the lede: the novelty is entirely in "not even them", which is also the half
  most easily sanded off in a later edit.

**Which I'd run:** none of them as a replacement h1. Keep "Small free tools for
groups", and use (b) → (a) → (c) as the three beats of the lede, in that order.
That is close to what already exists, reordered so the strongest sentence goes
first and the missing participant promise finally gets a slot.

---

# I. What not to change

Ranked by how expensive the mistake would be.

## 1. The link-preview withholding rule

`src/lib.js:318-333` and the `SHARE` map. A card carries the tool and the
organiser's own title. Nothing else — no participant names, no tallies, no
results, no drawn names, no addresses. The comment ends: "If you are tempted to
make a card more useful by putting the state of the thing in it, don't."

**Load-bearing because** pasting a `/s/` link into a group chat *is* the
distribution model, and a `/s/` URL is a capability URL. The card renders to
everyone in the channel and is cached on someone else's servers (Slack keeps it
~30 minutes). "8 in the hat · 1 claimed" in the preview is exactly what a
growth-minded redesign proposes, because a richer card genuinely does lift
click-through — and it leaks a private group's state to every onlooker and to a
third party's cache. This rule is why a meal train for a family in crisis is
safe to paste into a WhatsApp group.

## 2. The organiser cannot see who drew whom

`src/tools/kringle.js`, the organiser page, and the FAQ that says it in public:
"The organiser's page shows who's claimed their name and who's opened their page
— never who drew whom. We can't spoil it, and neither can they."

**Load-bearing because** "admin can see everything" is the default instinct of
every dashboard redesign, and it would be trivial to add — the assignments are
right there in the row. Adding it destroys the only structural reason to trust a
link-based Kris Kringle over a hat. The same applies to Weekly Pulse, where
`public/index.html:237` promises "Genuinely anonymous — there's no account, so
there's nothing to identify anyone with", and `llms.txt` goes further: weeks with
fewer than four responses are withheld. Both are claims about architecture, not
policy. Any per-respondent view falsifies text that is already indexed and
already scraped into models.

## 3. No analytics on `/s/`, `/e/`, `/p/`, and no per-view logging

`public/index.html:355-361` states the position: the beacon is "Deliberately
loaded on these public pages ONLY — never on /s/, /e/ or /p/… What their friends
do in a sweep or a meal train is none of our business."
`migrations/0001_init.sql:34-40`: "Deliberately no per-view logging."

**Load-bearing, and the most likely thing to be traded away** — because §A.4 of
this document just spent a section complaining about the absence of data. That
trade is not on offer. What *is* on offer, and already built, is aggregate and
identity-free: `events` rows by tool type and kind, `instances.shared_at`,
`participants.viewed_at`, `via:cta` / `via:foot` clicks, and the `cold` column in
`stats.mjs`. The §A.4 recommendation lives entirely inside that envelope by
design — one nullable timestamp per instance, the same shape as `shared_at`. If
a future proposal needs a beacon on a shared page, the answer is no, and the
reason is written on line 356 of the homepage.

## 4. `scripts/check-claims.mjs`

Seven banned patterns — "no fees", "fee-free", "free forever", "always free",
"never charge", "will never cost", "100% free" — each with its reasoning written
out. Those read as permanent promises about the business, and what you get when
the pricing changes is "a screenshot with a date on it, sitting in a search
index and in every model that scraped llms.txt."

**Load-bearing because** a marketing pass will reach for "100% free forever" and
this is what stops it. The check is deliberately small, explicitly permits
mechanism statements ("the site never touches the money"), and even documents
why "never takes a cut" is *not* on the list — it's a business promise in the
site's own voice and ordinary advice in a guide's voice, and a pattern broad
enough to catch the first would fail the build on the second. Don't widen it,
don't narrow it, and don't add a per-file exception.

## 5. The two-blurb card system

`scripts/sync-card-copy.mjs` plus the `max-width: 34rem` swap at
`public/styles.css:379-406`. Long blurb on desktop, ≤44-character blurb on
mobile, both in the DOM, exactly one ever painted (so exactly one is ever in the
accessibility tree), build fails if a short blurb is over budget or a card has no
entry.

**Load-bearing because** "why do we keep two descriptions per card, let's
simplify" is a completely reasonable-sounding refactor, and it has already been
tested: with one blurb, 0 of 21 cards showed in full on a phone and the mean was
48% visible — every card ended mid-sentence. The 44-character cap is also what
forces the good writing. "Stops six pavlovas and no salad." is 32 characters and
the joke survives intact.

## 6. The jokes. They *are* the use cases

"the potluck board that prevents six pavlovas and no salad" · "The classic
24-horse office draw… no scissors required" · "The name-drawing hat, minus the
hat and the reply-all" · "the race that stops the nation. Draw it now, argue
about it at 3pm" · "A daft would-you-rather".

**Load-bearing because** each one is a situation description wearing a joke. Six
pavlovas and no salad is the complete specification of the problem Bring a Plate
solves, and the reader recognises their own last Christmas in it inside four
words. Replace it with "Coordinate potluck contributions by category" and you
have not made it more professional — you have deleted the recognition and kept
the word count. A brand refresh will read this voice as decoration. It is the
clearest functional writing on the site.

## 7. "See a finished X →" on 21 of 22 tool pages

`class="see-example"`, pointing at `/s/demo-*`.

**Load-bearing because** it answers the one question standing between a visitor
and typing twelve real colleagues' names into a textarea: *what do I actually
get.* It sits in the hero, which means it looks like clutter to anyone tidying
the hero. Team Picker is the only page without one — that's a symptom of the
Team Picker anomaly in §B.3, not a precedent to copy.

## 8. The baked first frame of the live preview

`scripts/gen-live-preview.mjs` renders the preview's initial frame at build time,
from the values the form actually ships with, using the same module the browser
uses for every frame after it — because a layout shift within 500ms of a
keystroke is excused by CLS and one on load is not.

**Load-bearing because** the obvious implementation — render the preview on load
— has already shipped here once and cost 12% of CLS samples rated poor, with
Cloudflare naming the element (`scripts/check-qotd-preview.mjs` is the
write-up). It currently covers 5 of 22 builders (roster, meal, plate, hens,
kringle). Extending it is worth doing — gift-registry, bracket, roles and baby
are the ones where the output shape is least guessable — but extend it *by this
pattern*. Do not reimplement it client-side.

## 9. The server-side seasonal render

§A.3 deletes the *client* array at `public/index.html:309-353`. The server-side
machinery stays exactly as it is: `SEASONS`, the per-request HTMLRewriter, and
`check-seasons.mjs` walking all 366 days. Its own comment explains why it isn't
baked at build time — a build-time card "goes stale the moment deploys stop;
computing it from the clock cannot go stale." The static September markup
beneath it is the no-JS fallback, and stays too.
