# Homepage copy — bitibybit.com

The words for the IA in `docs/review/03-ia.md`, band by band, in page order.
Paste-ready. Where copy is unchanged it says **unchanged** and names where it
already lives, rather than being reprinted as if it were new.

Every short blurb has its character count beside it. All 22 are unchanged, so
`scripts/sync-card-copy.mjs` needs no edit and cannot fail. Every new string is
run against all seven patterns in `scripts/check-claims.mjs` at the end of this
document; none of them hits.

---

## Band 0 · Head

`<title>` — **unchanged.** "biti by bit — small free tools for groups"

`<meta name="description">` — **unchanged.** It already names the objects and
the mechanism, and it is the line search results show.

JSON-LD `description` — **unchanged.**

`og:description` and `twitter:description` — **changed.** Currently "Small free
tools for getting a group of people to do something." That string renders when
someone pastes the homepage into a group chat, which is by definition a room
full of people about to be organised. Give them the participant promise:

> Sweeps, rosters, registries — you make a thing, you share one link, and
> nobody has to sign up. Not you, and not them.

`og:title` / `twitter:title` — **unchanged.** "biti by bit"

---

## Band 1 · Header

**Unchanged:** wordmark, `beta` badge, `tools`, `about`.

One markup change, no copy change: `<a href="#tools">tools</a>` becomes
`href="#organising"` so it lands on the occasion row, not the first shelf.

---

## Band 2 · Hero

`<h1>` — **unchanged.**

> Small free tools
> for groups

Lede — **rewritten twice.** What shipped first, three beats, strongest first:

> Sweeps, rosters, registries — the little organisational jobs that usually end
> in a spreadsheet and three reminder messages. Make a thing, share a link,
> done. Nobody signs up, installs anything, or gets added to anything. Not you,
> and not them.

Notes on what moved, first pass:

- Beat 1 keeps the "Sweeps, rosters, registries —" lead-in from the current
  lede. The h1 says *tools*; it never says which. Four concrete nouns before
  the best sentence on the site are worth the words.
- "Free to use, no accounts" is gone. "Free" is in the h1 and the count line;
  "no accounts" is beat 3's job and beat 3 says it better.
- Beat 3 is new to the page. It is the only sentence above the fold about the
  eight-to-thirty people who receive the link.

**Second pass — what is on the page now**, and this is the string
`public/index.html` carries:

> The little jobs that end in a spreadsheet and three reminders. Make a thing,
> share one link — nobody signs up, you included.

Notes on what moved, second pass:

- **Why it was reopened.** Measured at 375×812, that lede was 255 characters,
  six lines and **163px** — a fifth of an 812px phone screen, on the band whose
  own §C.2 in `03-ia.md` asks for one screen before any choosing starts. The
  D4 second pass in `07-visual.md` needed 239px to get a tool card fully above
  the fold and the lede was the largest single piece of it. 124 characters,
  three lines, **82px**. Measured, not estimated: the same paragraph at
  1.12rem would be four lines, which is why the phone size override at
  `public/styles.css` now earns its keep for a reason it did not have before.
- **All three beats survive**, in the same order. *The little jobs that end in
  a spreadsheet and three reminders* is beat 1, the problem in the reader's
  words. *Make a thing, share one link* is beat 2, the mechanism. *nobody signs
  up, you included* is beat 3, the participant promise — and it is the beat
  that gained, because "Not you, and not them" spent a whole sentence saying
  what "you included" says in two words, riding on the sentence before it.
- **"Sweeps, rosters, registries —" is the loss, and it is a real one.** Those
  four concrete nouns were defended above and the defence still stands; what
  changed is the price. Restoring them is 29 characters, which measures as a
  fourth line, which is 27px, which is the fold. They are not gone from the
  page — the shelf underneath is 22 of them, in words, 400px down, and the
  occasion row names six situations before that.
- "usually" and "organisational" went for length and neither was carrying
  anything. "reminder messages" became "reminders" for the same reason.
- Checked against all seven patterns in `scripts/check-claims.mjs` before it
  was written. The word "free" does not appear in it at all; it is in the h1
  and in the count line under the first section heading, where it describes
  what the site costs today rather than promising a future.
- `og:description` (`public/index.html:10`) still carries the long form of
  beats 2 and 3 and is deliberately **not** shortened with this. It is what
  renders when the homepage is pasted into a group chat, it has no fold, and
  §C.2's note about it stands unchanged.

---

## Band 3 · Things you've made — conditional strip

Hidden entirely when `bbb:made:v1` is empty. Copy for when it isn't:

Heading:

> Things you've made in this browser

Each row, up to five — the organiser's own title, then the tool, then the date:

> Accounts team Kris Kringle · Kris Kringle · 12 Dec

Fine print, one line:

> Saved in this browser and nowhere else — there's no account to keep them in.
> Bookmark the ones you'll want in a year.

That second sentence is the useful half: it tells someone what to do about the
limitation instead of only disclosing it.

---

## Band 4 · The occasion row — the router

Label:

> I'm organising…

Six links, in this order, each pointing at one card:

| Link text | Anchor |
|---|---|
| Someone's leaving | `#group-card` |
| The school fete | `#volunteer-roster` |
| A new baby | `#baby-guess-pool` |
| Someone's unwell | `#meal-train` |
| A wedding | `#gift-registry` |
| Christmas | `#kris-kringle` |

Copy settled in IA §E.2 and kept verbatim. No "and more", no "browse all" — the
whole shelf is 400px below, and the row does not need to apologise for being
incomplete.

---

## Band 5 · Seasonal feature card

**Unchanged, all five windows.** `SEASONS` at `src/worker.js:179-195` owns the
tag, title and blurb for each; the static September markup in
`public/index.html` is the no-JS fallback and stays as written. No new copy.

The client-side `picks` array at `public/index.html:309-353` is deleted, so no
copy is needed for it either.

---

## Band 6 · The shelf

Count line — **above** the first heading (see `03-ia.md` §C.6; this was
specified as "directly under" and moved on 31 Aug 2026, when the promoted h2
started capturing it as a claim about section one). Copy unchanged:

> 22 tools. All free, none need an account.

### Section 1 — heading

> A farewell, a wedding, a new baby

---

**Group Card** · `id="group-card"` · target of "Someone's leaving"

- Long — **unchanged:** "One card, everyone signs. Farewells, new babies, big
  birthdays, retirements."
- Short — **unchanged:** "One card, everyone signs it." — **28/44**
- Action — **unchanged:** "start a card →"

**Gift Idea Board** · `id="gift-ideas"`

- Long — **unchanged:** "Everyone suggests and upvotes gift ideas, then claims
  one to buy — so nobody double-buys."
- Short — **unchanged:** "Suggest, upvote, claim. No double-buys." — **39/44**
- Action — **unchanged:** "gather ideas →"

**Baby Guess Pool** · `id="baby-guess-pool"` · target of "A new baby"

- Long — **unchanged:** "Everyone guesses the date and weight. Closest to the
  real arrival wins the bragging rights."
- Short — **unchanged:** "Guess the date and weight. Closest wins." — **40/44**
- Action — **unchanged:** "guess away →"

**Pixel Gift Registry** · `id="gift-registry"` · target of "A wedding"

- Long — **changed**, to carry "wedding registry" and "wishing well", which the
  site currently says only in `llms.txt`:

  > A wedding registry or wishing well, drawn as pixel art of the thing you're
  > saving for. Guests claim a part and the picture fills in. They pay you
  > directly — the site never touches the money.

- Short — **unchanged:** "A registry drawn as the thing itself." — **37/44**
- Action — **unchanged:** "build one →"

**Hens & Shower Planner** · `id="hens-planner"`

- Long — **unchanged:** "Hens do, bridal or baby shower — who's bringing what,
  the plan, and a no-money kitty note."
- Short — **unchanged:** "Who's bringing what, and the plan." — **34/44**
- Action — **unchanged:** "plan the do →"

**Recipe Collection** · `id="recipe-collection"`

- Long — **unchanged:** "Everyone adds a recipe through one link; you get a
  printable keepsake book."
- Short — **unchanged:** "Everyone adds one, you get a book." — **34/44**
- Action — **unchanged:** "start a book →"

---

### Section 2 — heading

> Feeding or staffing a crowd

---

**Bring a Plate** · `id="bring-a-plate"`

- Long — **unchanged:** "The potluck board that prevents six pavlovas and no
  salad."
- Short — **unchanged:** "Stops six pavlovas and no salad." — **32/44**
- Action — **unchanged:** "set the table →"

**Volunteer Roster** · `id="volunteer-roster"` · target of "The school fete"

- Long — **changed**, to carry "sign-up sheet" and "working bee":

  > The sign-up sheet for canteen, fete, sausage sizzle or a working bee. Post
  > the shifts, share one link, and people put their own name down.

- Short — **unchanged:** "Post the shifts, watch them fill." — **33/44**
- Action — **unchanged:** "build a roster →"

**Meal Train** · `id="meal-train"` · target of "Someone's unwell"

- Long — **changed.** The current one runs 220 characters through a sub-clause
  about the dog and the school run. This is `llms.txt`'s own sentence, brought
  to humans, on the one card where the reader may be having a rough week:

  > Who's cooking which night for a new parent, someone unwell, or a family
  > having a hard week. Dietary needs up front, address kept private.

- Short — **unchanged:** "Meals by date when a family needs them." — **39/44**
- Action — **unchanged:** "start a roster →"

---

### Section 3 — heading

> Christmas and the office sweep

---

**Kris Kringle** · `id="kris-kringle"` · target of "Christmas"

- Long — **changed**, to carry "Secret Santa", the words people actually type:

  > Secret Santa without the hat or the reply-all. Everyone claims their name
  > from one link and privately sees who they drew. Wishlists included, no
  > email addresses anywhere.

- Short — **unchanged:** "Draw names, private reveals, no emails." — **39/44**
- Action — **unchanged:** "draw names →"

**Grand Final Sweep** · `id="grand-final-sweep"`

- Long — **unchanged:** "AFL or NRL margin sweep. Everyone draws an outcome,
  winner takes the glory."
- Short — **unchanged:** "AFL or NRL margin sweep, drawn fair." — **36/44**
- Action — **unchanged:** "run one →"

**Melbourne Cup Sweep** · `id="melbourne-cup-sweep"`

- Long — **unchanged:** "The classic 24-horse office draw. Everyone gets a horse
  (or three), no scissors required."
- Short — **unchanged:** "The 24-horse office draw, no scissors." — **38/44**
- Action — **unchanged:** "run one →"

---

### Section 4 — heading

> Every Monday

---

**Kudos Wall** · `id="kudos-wall"`

- Long — **unchanged:** "A standing wall of short thank-yous. Anyone posts, it
  rolls over weekly, and the names stay on because that's the point."
- Short — **unchanged:** "Short thank-yous, and the names stay on." — **40/44**
- Action — **unchanged:** "start a wall →"

**Weekly Pulse** · `id="weekly-pulse"`

- Long — **unchanged:** "One tap a week for how it's going, plus a word cloud.
  Genuinely anonymous — there's no account, so there's nothing to identify
  anyone with."
- Short — **unchanged:** "One tap a week, genuinely anonymous." — **36/44**
- Action — **unchanged:** "start a pulse →"

**Question of the Day** · `id="question-of-the-day"`

- Long — **unchanged:** "A daft would-you-rather for the team, with a live vote.
  New question every morning, same link."
- Short — **unchanged:** "A daft one every morning, with a vote." — **38/44**
- Action — **unchanged:** "start today's →"

**Coffee Roulette** · `id="coffee-roulette"`

- Long — **changed**, to open with "random coffee" — what this is called
  everywhere else, and a phrase the site has never written down:

  > Random coffee pairings for the team, a round at a time. One link, and each
  > person privately sees who they got. Odd numbers make a three.

- Short — **unchanged:** "Pairs the team for a coffee, each round." — **40/44**
- Action — **unchanged:** "pair them up →"

**Fact Matcher** · `id="fact-matcher"`

- Long — **changed.** The card is moving to a Monday-morning shelf and the old
  ending ("Icebreakers, fixed.") names no situation. Its own guide pages are
  `standup-games/`, `icebreaker-questions/` and `board-meeting-icebreakers/`:

  > Everyone submits a secret fact, the team guesses who's who. Stand-ups,
  > onboarding, and the meeting that needs an opener.

- Short — **unchanged:** "Secret facts, guess who's who." — **30/44**
- Action — **unchanged:** "collect facts →"

---

### Section 5 — heading

> Teams, brackets, votes and games

---

**Team Picker** · `id="team-picker"`

- Long — **unchanged:** "Fair random teams from any list of names. Nothing
  stored, ever."
- Short — **unchanged:** "Fair random teams. Nothing stored, ever." — **40/44**
- Action — **unchanged:** "split a list →"

**Tournament Bracket** · `id="tournament-bracket"`

- Long — **unchanged:** "Ping pong, FIFA, backyard cricket. Tap the winners,
  crown a champion."
- Short — **unchanged:** "Tap the winners, crown a champion." — **34/44**
- Action — **unchanged:** "start one →"

**Group Vote** · `id="group-vote"`

- Long — **unchanged:** "A dead-simple poll for a group call. Ask a question,
  share a link, watch the tally fill in."
- Short — **unchanged:** "A dead-simple poll for a group call." — **36/44**
- Action — **unchanged:** "start a vote →"

**Scrum Poker** · `id="scrum-poker"`

- Long — **changed**, to open with "planning poker", which is what the rest of
  the industry calls it and what somebody types:

  > Planning poker for a sprint team. Everyone picks a card at once, so nobody
  > anchors on the first number said out loud. Fibonacci or t-shirts, no room
  > codes.

- Short — **unchanged:** "Estimate together, reveal at once." — **34/44**
- Action — **unchanged:** "run one →"

**Secret Role Dealer** · `id="secret-role-dealer"`

- Long — **unchanged:** "Werewolf, Spyfall, Avalon — everyone taps one link,
  sees only their role."
- Short — **unchanged:** "Werewolf and Spyfall, dealt by link." — **36/44**
- Action — **unchanged:** "deal roles →"

---

**Card copy summary:** 22 short blurbs, all unchanged, all between 28 and 40 of
the 44 characters `sync-card-copy.mjs` allows. Seven long blurbs changed —
Pixel Gift Registry, Volunteer Roster, Meal Train, Kris Kringle, Coffee
Roulette, Fact Matcher, Scrum Poker. Fifteen unchanged. No tool renamed:
`SHORT` is keyed by exact name and a rename fails the build both ways.

---

## Band 7 · Guides & how-tos

**Unchanged.** Heading, section note and all 24 links exactly as they are. This
is the internal-link surface for the only 49 pages on the site that can rank,
and it is the only place on the homepage where "canteen", "sausage sizzle" and
"board meeting" appear at all.

---

## Band 8 · Footer / about

First paragraph — **trimmed.** After the lede rewrite, its first two sentences
restate beats 1 and 2 a page-length later. What's left is the provenance and
the mechanism:

> **What is this?** Made in Australia. You make a thing, you share a link,
> everyone's sorted. New tools added often.

Fine print — **unchanged.** "No cookies, no ads, no personal data — just an
anonymous count of page views on these public pages, never on the ones you
share with your group." plus the GitHub link.

Footer links — **unchanged.** Buy me a coffee · Source on GitHub · Privacy ·
API for agents · Press kit.

---

## Claims check

Every new string above, run against the seven patterns in
`scripts/check-claims.mjs`:

| Line | Verdict |
|---|---|
| "22 tools. All free, none need an account." | Passes. Present tense; "all free" is not a banned pattern. |
| "Nobody signs up, installs anything, or gets added to anything." | Passes. Describes how the thing is built, promises nothing about the future. |
| "Make a thing, share one link — nobody signs up, you included." | Passes. The second-pass lede. Same mechanism claim, shorter; the word "free" is not in it. |
| "the site never touches the money" | Passes. Explicitly permitted as a mechanism statement, and already live on the gift registry. |
| "no email addresses anywhere" | Passes. A fact about the product, not a pricing promise. |
| "there's no account to keep them in" | Passes. |
| og:description — "nobody has to sign up. Not you, and not them." | Passes. |

Every line above describes what a visitor gets today. None of them promises
what the site will do next year, which is the whole point of the check.
