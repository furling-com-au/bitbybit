# Evidence pass — bitibybit.com

Facts only. No recommendations, no opinions. Measured live against
`https://bitibybit.com` (Browser pane, real rendering) and the repo at the
current commit (`0cec1dd`) on 2026-08-30. Where a number came from a script
in the page rather than a human reading, that's noted.

---

## 1. Homepage

### 1.1 Word counts and document height

| Metric | 390×812 (mobile) | 1200×800 (desktop) |
|---|---|---|
| Words in `<main>` (all, incl. off-screen) | 508 | 796 |
| Words visible in first viewport, no scroll | 88 | 132 |
| Document height (`scrollHeight`) | 3909px | 4086px |
| Viewport height used | 812px | 800px |
| Tool cards above the fold (top edge < viewport height) | 2 of 22 | 4 of 22 |

The 288-word gap between mobile and desktop `<main>` totals is the
`.tool-desc` / `.tool-desc-short` swap (below), not different content
elsewhere on the page — the guide list, footer and hero are identical text
at both widths.

**Card blurb rendering** (`public/styles.css:379-406`, breakpoint `max-width: 34rem` = 544px):

| | ≤544px (mobile) | >544px (desktop) |
|---|---|---|
| `.tool-desc` (long blurb) | `display: none` | `display: block` |
| `.tool-desc-short` (short blurb) | `display: block` | `display: none` |
| `.tool-go` (arrow link text, e.g. "run one →") | `display: none` | `display: block` |

Both spans exist in the DOM on every card at every width; only one is ever
painted, so only one is ever read aloud or counted by the numbers above.
Confirmed live: `getComputedStyle` on `.tool-desc` returns `none` at 390px
and `block` at 1200px; `.tool-desc-short` is the exact inverse.

### 1.2 What's literally visible in the first viewport (390×812, no scroll)

In order, exact text nodes with any part inside `y < 812`:

1. "Small free tools" / "for groups" (`<h1>`)
2. "Sweeps, registries, rosters — the little organisational jobs that
   usually end in a spreadsheet and three reminder messages. Free to use,
   no accounts. Make a thing, share a link, done." (`.lede`)
3. "Footy finals · September" (seasonal feature-card tag)
4. "Grand Final Sweep" (feature-card `<h2>`)
5. "Run the office margin sweep in under a minute. Paste the names, hit
   draw, share the link. Fair, free, and printable for the fridge."
   (feature-card `<p>`)
6. "Sweeps & draws" (`<h2>`, first category heading)
7. "Grand Final Sweep" / "AFL or NRL margin sweep, drawn fair." (tool card 1,
   short blurb)
8. "Melbourne Cup Sweep" / "The 24-horse office draw, no scissors." (tool
   card 2, short blurb, partially clipped)

That's 88 words total, 2 of 22 tool cards, 1 of 6 category headings.

At 1200×800 the first viewport additionally fits Team Picker and
Tournament Bracket (full long-blurb text), for 132 words and 4 of 22 cards.

The seasonal feature card is date-driven (see §6). On the measurement date
(2026-08-30), the window `08-15`–`10-05` selects Grand Final Sweep — the
card a visitor sees for footy finals matches what's live right now.

### 1.3 Category heading positions (px from top, `scrollY`-adjusted)

| Category | 390×812 | 1200×800 |
|---|---|---|
| Sweeps & draws | 684 | 598 |
| Gifts & occasions | 1130 | 1130 |
| Food & parties | 1559 | 1663 |
| Care & kindness | 2005 | 2195 |
| Deciding & planning | 2177 | 2576 |
| Every day | 2349 | 2875 |

At 390px, reaching "Every day" (the last category) needs ~2349px of scroll
against an 812px viewport — about 2.9 screens down. At 1200px it's 2875px
against 800px — about 3.6 screens (the two-column mobile grid packs cards
denser per pixel of scroll than the wider desktop grid does, despite the
taller viewport).

---

## 2. The 5-second test

From the 390×812 first viewport only (text quoted above). What a
first-time visitor can and cannot learn without scrolling:

| Question | Present? | Literal text |
|---|---|---|
| What the site is | Yes | "Small free tools for groups" (h1); "Sweeps, registries, rosters" (lede, gives category examples) |
| Who it's for | Partial | "for groups" only — no named audience (no "offices", "schools", "families" in the visible slice; those examples exist lower on the page in category headings and guide links, not in the first screen) |
| What problems it solves | Yes | "the little organisational jobs that usually end in a spreadsheet and three reminder messages" |
| That it's free and account-free | Yes | "Free to use, no accounts." |
| How to start | Partial | "Make a thing, share a link, done." states the mechanism in three steps, but there is no button or link in the first viewport captioned as a start action — the only tappable element on screen is the feature card (linking straight to Grand Final Sweep) and the first two tool cards, not a generic "get started" prompt |

Absent from the first viewport entirely: any mention of price (beyond
"free"), any testimonial or usage/social-proof number, any indication of
how many tools exist (22) or how many categories (6), and any explicit
instruction to scroll or explore further.

---

## 3. Categories

Six `<h2>` sections under `#tools` in `public/index.html`, 22 `<a class="tool-card">` total, confirmed by live DOM count.

| Category | Tools (href) | Count |
|---|---|---|
| Sweeps & draws | Grand Final Sweep, Melbourne Cup Sweep, Team Picker, Tournament Bracket, Baby Guess Pool | 5 |
| Gifts & occasions | Pixel Gift Registry, Kris Kringle, Group Card, Recipe Collection, Gift Idea Board | 5 |
| Food & parties | Bring a Plate, Secret Role Dealer, Volunteer Roster, Fact Matcher, Hens & Shower Planner | 5 |
| Care & kindness | Meal Train | 1 |
| Deciding & planning | Group Vote, Scrum Poker | 2 |
| Every day | Kudos Wall, Weekly Pulse, Coffee Roulette, Question of the Day | 4 |
| **Total** | | **22** |

**Placements that are arguable, and why:**

- **Care & kindness holds exactly one tool** (Meal Train). It's the only
  single-item category on the page; every other category has 2–5.
- **Secret Role Dealer** sits under "Food & parties." Its own copy
  ("Werewolf, Spyfall, Avalon — everyone taps one link, sees only their
  role") and its guide page (`/secret-role-dealer/werewolf-rules/`) are
  about party games generally, not food or catering specifically — it
  shares the category with Bring a Plate, Volunteer Roster and Hens
  Planner, none of which are games.
- **Fact Matcher** also sits under "Food & parties," but its three guide
  pages are `icebreaker-questions/`, `standup-games/` and
  `board-meeting-icebreakers/` — all work/meeting contexts, not food or
  party contexts.
- **Baby Guess Pool** sits under "Sweeps & draws" alongside two literal
  sports sweeps and a team-splitting tool. A guess-the-date-and-weight
  pool is a different mechanic (individual prediction against an unknown
  future outcome) from a sweep (random assignment of a fixed set of
  outcomes) — the grouping is by "everyone puts something in and one
  person wins," not by mechanism.
- **Team Picker** sits under "Sweeps & draws" but, unlike every other tool
  in every category, has no backend `tool_type`, no `/s/`, `/e/` or `/p/`
  page, and is served entirely by `public/team-picker.js` client-side (see
  §6) — it is not a "draw" that produces a shareable link the way the
  other four tools in its category are.

---

## 4. The participant path

Both opened live at 390×812.

### `/s/demo-kris-kringle`

- **Title:** "Accounts team Kris Kringle — biti by bit"
- **Document height:** 946px (viewport 812px) — everything is on-screen or
  one short scroll (~134px) away; no shift-by-shift or page-by-page
  navigation.
- **First thing seen:** kicker "Kris Kringle — the names are drawn," title
  "Accounts team Kris Kringle," status line "8 in the hat · 1 claimed so
  far," then budget/date chips, then the instruction paragraph: "Find your
  name and claim it. You'll get a private page showing who you're buying
  for — nobody else sees it, including the organiser."
- **What they must understand:** which of 8 names on the grid is theirs.
  Unclaimed names show a button labelled "That's me"; the one already
  claimed (Priya) shows "claimed ✓" as static text, not a button.
- **Taps to participate:** tap "That's me" (1) → browser `confirm()`
  dialog reading `Claim "<name>"? One claim per name — only take your
  own.` requiring OK (1) → page navigates to `/p/:token` showing the
  reveal automatically. **2 taps**, no typing required (source:
  `src/tools/kringle.js:263-296`).

### `/s/demo-volunteer-roster`

- **Title:** "Warrnambool Primary fete — sausage sizzle — biti by bit"
- **Document height:** 1954px (viewport 812px) — about 2.4 screens to see
  everything.
- **First thing seen:** kicker "Who's on which shift," title, status line
  "3 of 12 spots filled · 4 shifts," then the first two of four shift
  sections (Set up 8:00–9:00am, Grill 9:00–11:00am) with their slots.
  The other two shifts (Grill 11:00am–1:00pm, Pack down 1:00–2:00pm) are
  below the fold — a visitor must scroll to see roughly half the roster.
- **What they must understand:** which shift and time slot they can fill;
  slots already taken show a name, open slots show a "Put me down" button.
- **Taps to participate:** tap "Put me down" (1) reveals an inline form
  (name field, required; optional note field) → fill in name → tap "Put
  me down" submit (1). **2 taps + typing a name** (source:
  `src/tools/roster.js:212-225`).

Net difference: Kris Kringle requires zero typing (name is pre-drawn, just
confirmed) and shows all 8 people in one viewport-and-a-bit; Volunteer
Roster requires typing a name and showing all 4 shifts needs scrolling
through roughly 2.4 screens first.

---

## 5. Link preview

Source: `SHARE` map and `shareTags()` in `src/lib.js:334-388`, verified
against the live response headers of `/s/demo-kris-kringle`.

**What renders in a group chat**, live-fetched for the Kris Kringle demo:

| Tag | Value |
|---|---|
| `og:title` / `twitter:title` | "Accounts team Kris Kringle" (the organiser's own title — falls back to the tool's generic name, `s[1]`, only if the organiser left it blank) |
| `og:description` / `twitter:description` | "Find your name to see who you're buying for. Only you see your draw." (fixed per-tool copy from `SHARE`, identical for every Kris Kringle link regardless of who made it) |
| `og:image` / `twitter:image` | `https://bitibybit.com/art/og-kringle.png` — one static piece of art per tool type, not a render of this instance |
| `og:url` | `https://bitibybit.com/s/demo-kris-kringle` |
| `og:type` | `website` |
| `og:site_name` | `biti by bit` |
| `twitter:card` | `summary_large_image` |

**Deliberately withheld**, per the comment at `src/lib.js:318-333`:
> "a card may carry the tool and the organiser's own title, and nothing
> else. No participant names, no tallies, no results, no drawn names, no
> payment details, no addresses. If you are tempted to make a card more
> useful by putting the state of the thing in it, don't."

So a Kris Kringle link pasted into a group chat never reveals: how many
people are in the draw, how many have claimed, who's in it, or who drew
whom. Confirmed live — the fetched `<head>` for `/s/demo-kris-kringle`
contains none of "8 in the hat," "1 claimed," or any participant name,
even though all of that is on the page itself one click later.

**Why**, per the same file: a `/s/` link is a capability URL rendered to
"everyone in whatever channel it lands in, then cached on someone else's
servers (Slack keeps it ~30 minutes)" — so the card can't safely carry
anything that would leak the instance's private state to onlookers who
haven't opened the link.

`/e/` (organiser) and `/p/` (participant) pages never call `shareTags()`
at all — `pageShell()` only receives `shareType`/`shareSlug` from
`publicPage` call sites (`src/lib.js:392-396`), so those two page types
render no `og:`/`twitter:` tags and are invisible to a link-preview
fetcher by construction, not by a value being blanked at render time.

Separately, `og-teams.png` exists in `public/art/` but has no entry in
`SHARE` — Team Picker has no `/s/` page to attach a card to (see §6).

---

## 6. Constraints that bind any redesign

| File | What it owns | Enforcement |
|---|---|---|
| `scripts/sync-card-copy.mjs` | The 22 short mobile blurbs (`.tool-desc-short`), hard-coded in a `SHORT` map keyed by exact tool name, 44-char cap | `throw`s at build time if any `SHORT` entry exceeds 44 chars; also fails if a homepage card has no matching entry, or if `SHORT` has an entry no card uses |
| `SEASONS` (`src/worker.js:179-195`) + `scripts/check-seasons.mjs` | The homepage feature card, re-rendered **per request** from the Sydney-local date via `HTMLRewriter` — not baked at build time. Five windows (Grand Final Sweep, Melbourne Cup Sweep, Kris Kringle, Bring a Plate, Volunteer Roster) must tile all 366 days of a leap year with no gap, no overlap | `check-seasons.mjs` walks all 366 day-of-year values and fails the build on any gap or overlap; also checks every season's `href` and `icon` resolve to a real file |
| `scripts/check-claims.mjs` | Bans absolute future-tense pricing claims across every `.html`/`.txt`/`.json`/`.md` in `public/` — "no fees," "fee-free," "free forever," "always free," "never charge," "will never cost," "100% free" | Regex scan, fails build on any hit; explicitly permits "free to use," "the tools are free," and mechanism statements like "the site never touches the money" |
| `scripts/gen-markdown.mjs` | A hand-written HTML→Markdown converter that gives every public page (everything under `public/**/index.html`) a `.md` twin for `Accept: text/markdown`, stripping forms/scripts/nav/decorative art (see `SKIP_TAGS`/`SKIP_CLASSES`) | Fails the build on: an unrecognised HTML entity surviving into the Markdown, or any page converting to under 200 chars (signals a skip rule ate real content) |
| `scripts/sync-faq-schema.mjs` | Regenerates every page's `FAQPage` JSON-LD block from the **visible** `<h3>`/`<p>` FAQ pairs on that same page — the visible copy is the source of truth, the schema is derived | Rewrites files in place; a page with FAQ schema but no matching visible FAQ is reported under "NEEDS A HUMAN" rather than silently left stale |
| The 26 guide pages, `robots.txt`, `sitemap.xml` | The SEO surface: `sitemap.xml` lists 52 URLs total — home, 22 tool root pages, 26 guide/sub-pages, plus `/api-docs/`, `/press/`, `/privacy/`. `robots.txt` explicitly `Disallow`s `/s/`, `/e/`, `/p/`, `/api/`, `/mcp` for every crawler it names (30+ named agents, each repeating the same disallow list per RFC 9309 since named groups don't inherit `User-agent: *`) | `robots.txt` is generated by `scripts/gen-robots.mjs` ("edit that, not this file") |
| `/s/`, `/e/`, `/p/` are noindex | Confirmed: `robots.txt` disallows all three; `src/lib.js:404` sets `<meta name="robots" content="noindex">` on every `pageShell()` page (which includes `/s/`/`/e/`/`/p/` renders); `gen-markdown.mjs`'s own comment states plainly these three prefixes get no Markdown twin "by design." So no demo, organiser, or participant page can rank in search or be cited by an AI assistant crawling the sitemap — only the 22 tool root pages, the 26 guide pages, and home carry SEO weight. | — |

**Two additional constraints found while reading, not in the requested list:**

- **The homepage seasonal card has a second, independent implementation.**
  Besides the server-side `SEASONS` array in `src/worker.js` (checked by
  `check-seasons.mjs`), `public/index.html:309-353` carries its own
  client-side JS array of 4 entries (`picks`) with different boundary
  dates and a different last entry (falls back to Pixel Gift Registry
  as "The flagship" for Dec 27 – Sep 1, where the server-side array
  instead rotates through Bring a Plate then Volunteer Roster for that
  same span). `check-seasons.mjs` only reads and validates
  `src/worker.js`; the client-side copy in `index.html` is unchecked by
  any script in `scripts/`.
- **22 homepage tool cards are backed by only 20 server-side tool types
  plus one client-only tool.** `TOOLS` in `src/worker.js:39` lists 20
  entries; the `sweep` type alone serves both the Grand Final Sweep and
  Melbourne Cup Sweep homepage cards (one shared module, an `img`
  override picks the art — see `src/lib.js:363`). Team Picker
  (`public/team-picker.js`) makes no `/api/` calls at all and has no
  `tool_type`, so it has no `/s/`, `/e/`, or `/p/` page and cannot appear
  in a link preview.

---

## 7. Evidence base

**`.stats-history.jsonl`: 1 line.**

```json
{"date": "2026-08-25", "made": 7, "reached": 4, "fails": {"kringle fail:400": 2}, "note": "baseline — day the mobile fixes, one-tap buttons, comma fallback and www redirect shipped; BOTH kringle fail:400 rows are test artifacts of the assistant, not real users"}
```

That is the entire file — one row, dated 2026-08-25 (5 days before this
measurement), explicitly labelled a "baseline," and the note states
outright that both recorded failures were the assistant's own testing,
not real visitors. There is no second row to compare against and no
trend to read.

**`migrations/`: three files**, defining the schema `events` is read from:
`0001_init.sql` (creates `instances`, `claims`, `events`), `0002_participants.sql`
(adds `participants` for the private-link mechanic), `0003_shared_at.sql`
(not read in full here, but named for the share-nudge tracking described
in `src/lib.js:124-131`). The `events` table
(`0001_init.sql:34-40`) has columns `instance_id, tool_type, kind,
created_at` and an explicit comment: "Deliberately no per-view logging
(noise, and it burns D1 writes)." So the schema can record creates,
redraws, deletes, shares and failures per tool type, but not page views
or visitor counts — those come only from the separate Cloudflare Web
Analytics beacon on public pages (`public/index.html:355-361`), which
this evidence pass did not have dashboard access to query.

**What this does and does not support:** there is exactly one day of
aggregate creation/failure counts on record, generated the same day
several other mobile changes shipped, and flagged by its own author as a
baseline containing test noise rather than a clean sample. No claim about
conversion rate, drop-off, category popularity, which tools get used,
device mix, or trend direction can be drawn from `.stats-history.jsonl`
as it stands — there is one number pair (7 made, 4 reached) and no second
point to compare it to.
