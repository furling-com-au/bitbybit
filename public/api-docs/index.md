# The API

For agents and developers

Every tool on this site can be created in one HTTP request, with no account, no API key and no OAuth. You get back two links: one to share with the group, one for whoever is organising.

## How it works

POST to a tool's create endpoint. You get `201` and two strings:

```
{ "slug": "lucky-wombat-4kq2m9xrbt7vec",
  "editToken": "h3n8pquzr4wmd2fkjt6xayb95s" }
```

- `/s/{slug}` — the share link. This is the one that goes in the group chat.
- `/e/{editToken}` — organiser control: edit, reset, redraw, export, delete. Secret. Treat it like an API key.

Possession of a URL is the whole authorisation — there is nothing to log in to and no identity attached. If you are building against this, read [auth.md](https://bitibybit.com/auth.md) for the full model, including revocation.

Machine-readable: [openapi.json](https://bitibybit.com/openapi.json) · [API catalog](https://bitibybit.com/.well-known/api-catalog) (RFC 9727) · [llms.txt](https://bitibybit.com/llms.txt)

## Rate limits

Per IP, per clock hour: **20** creates and **240** other POSTs. Over the limit is a `429`. There is no key that raises this. Please don't create instances speculatively — each one is a real row in a real database.

## Errors

`400` validation failed (the `error` string is written for a human — show it to them), `404` unknown link or unknown resource, `409` someone took that slot first, `429` rate limited. There is no `401` or `403`, because there is no identity to reject.

## The tools

- Office Sweep (Grand Final / Melbourne Cup)
- Kris Kringle
- Secret Role Dealer
- Bring a Plate
- Tournament Bracket
- Group Card
- Pixel Gift Registry (Build the Prado)
- Fact Matcher
- Baby Guess Pool
- Volunteer Roster
- Meal Train
- Group Vote
- Recipe Collection
- Gift Idea Board
- Hens & Shower Planner
- Question of the Day
- Coffee Roulette
- Weekly Pulse
- Kudos Wall
- Scrum Poker

### Office Sweep (Grand Final / Melbourne Cup)

Creates a random sweep for an office or group. Every outcome — a margin bucket, a horse, a barrier number — is assigned to a name at the moment the sweep is created, and the organiser shares the finished result. — [human page](https://bitibybit.com/grand-final-sweep/ (kind="gf") or /melbourne-cup-sweep/ (kind="cup") — from the VIA map in worker.js and HOME in sweep.js)

POST `/api/sweeps`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | optional | Optional. Trimmed and truncated to 80 characters; anything longer is cut without an error. Internal runs of whitespace are left as they are. Never rejected — if it is absent or empty it is stored as an empty string and the pages fall back to a default heading ("The office sweep", or "Sweep"). |
| `kind` | `string` | optional | Optional. Only the exact lowercase string "cup" selects the Melbourne Cup version. Everything else — absent, "Cup", "GF", null, a number — gives the grand final version. Never returns an error. |
| `outcomes` | `string[]` | **required** | Required. Each entry is trimmed, internal whitespace is collapsed to single spaces, and the entry is truncated to 60 characters. Empty entries are dropped. The list is then silently capped at 64 entries — anything past the 64th is discarded without an error. What remains must hold at least 2 entries, and they must all be different ignoring case; either failure returns 400. A value that is not an array is treated as an empty list and fails the minimum. |
| `names` | `string[]` | **required** | Required. Each name is trimmed, internal whitespace is collapsed to single spaces, and the name is truncated to 40 characters. Empty entries are dropped. The list is silently capped at 300 names — extras are discarded without an error. At least 2 must remain, or the request returns 400. Duplicate names are accepted: unlike outcomes, names are not checked for repeats, and a name listed twice appears twice. The count does not have to match the number of outcomes. With fewer names than outcomes, the names come round again and some people are drawn more than once. With more names than outcomes, the surplus miss out and are listed separately. |

Example

```
{
  "title": "Level 3 Grand Final Sweep",
  "kind": "gf",
  "outcomes": [
    "1-6 points",
    "7-12 points",
    "13-24 points",
    "25-39 points",
    "40+ points"
  ],
  "names": [
    "Sharni",
    "Dave K",
    "Priya",
    "Tom H",
    "Bec"
  ]
}
```

Errors

- `400` — outcomes is absent, is not an array, or holds fewer than two usable entries once blanks are dropped. A request body that is not valid JSON lands here too, because it is read as an empty object. “Add at least two outcomes.”
- `400` — Two or more outcomes are the same once case is ignored, such as "Draw" and "draw". “Outcomes contain a duplicate — each one must be different.”
- `400` — names is absent, is not an array, or holds fewer than two usable entries once blanks are dropped. “Add at least two names.”
- `429` — More than 20 creation requests from the same connection within the current clock hour. The count is shared across every create endpoint on the site. The limit is not applied when the site is running in development mode. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** There is no participant step. The draw runs when the sweep is created and the result is fixed from that moment. The organiser shares the public page at /s/<slug>, where everyone reads the same grid of assignments; nobody claims anything and nobody needs a link of their own. The organiser keeps the page at /e/<editToken>, which can reshuffle the whole draw with POST /api/sweeps/<editToken>/redraw or remove it with POST /api/sweeps/<editToken>/delete. This tool has no private per-person page.

### Kris Kringle

Creates a Kris Kringle draw. Everyone is matched into a single loop, so nobody draws themselves and nobody is left out. Each person claims their own name from the shared link and gets a private page naming who they are buying for. The organiser never sees the pairings. — [human page](https://bitibybit.com/kris-kringle/)

POST `/api/kringle`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | optional | Optional. Trimmed and truncated to 80 characters. Internal whitespace is left as it is. Never rejected — an absent or empty title falls back to the default heading "Kris Kringle". |
| `names` | `string[]` | **required** | Required. Each name is trimmed, internal whitespace is collapsed to single spaces, and the name is truncated to 40 characters. Empty entries are dropped. The count is not silently capped here: after cleaning there must be at least 3 names and no more than 100, and anything outside that returns 400. Names must all be different ignoring case; the first repeat returns 400 and the message quotes it. A value that is not an array is treated as an empty list and fails the minimum. |
| `budget` | `string` | optional | Optional. Trimmed and truncated to 40 characters. Free text: never validated and never parsed as a number, so "$25" and "25 bucks, no more" are both accepted. Absent or empty means the chip is left off. |
| `exchangeDate` | `string` | optional | Optional. Trimmed and truncated to 60 characters. Free text: it is not parsed or checked as a date, so "Friday 19 December, 12pm" is fine. Absent or empty means the chip is left off. |
| `note` | `string` | optional | Optional. Trimmed at the ends and truncated to 300 characters. Internal whitespace and line breaks are kept. Never validated. Absent or empty means the note block is left off. |

Example

```
{
  "title": "Accounts Team Kris Kringle",
  "names": [
    "Sharni",
    "Dave K",
    "Priya",
    "Tom H",
    "Bec",
    "Jarrah"
  ],
  "budget": "$25",
  "exchangeDate": "Friday 19 December, 12pm",
  "note": "Drop your present under the tree in the Level 3 kitchen before the lunch."
}
```

Errors

- `400` — names is absent, is not an array, or holds fewer than three usable entries once blanks are dropped. A request body that is not valid JSON lands here too, because it is read as an empty object. “Add at least three names — with two it's not a secret, it's a swap.”
- `400` — More than 100 names remain once blanks are dropped. The count is not trimmed down for you; the request is refused. “That's more than 100 people — split it into two draws.”
- `400` — Two names match once case is ignored. The message quotes the offending name in its cleaned form. “"<name>" is in the list twice — add a surname initial so the right one gets claimed.”
- `429` — More than 20 creation requests from the same connection within the current clock hour. The count is shared across every create endpoint on the site. The limit is not applied when the site is running in development mode. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** Everyone opens the shared page at /s/<slug>, finds their own name in the grid and taps "That's me". That sends POST /api/kringle/claim with {slug, name}, where the name is trimmed, whitespace-collapsed and truncated to 40 characters. The first claim on a name wins and returns 200 {token}. A later claim on the same name returns 409 "That name's already been claimed. If it's yours, ask the organiser to reset you." A name that is not in the draw returns 404 "That name isn't in this draw." That token is the participant's only credential: the browser keeps it and opens the private page at /p/<token>, which reveals their giftee and lets them save a wishlist with POST /api/kringle/p/<token>/wishlist {text}, truncated to 500 characters. The organiser page at /e/<editToken> shows only who has claimed and who has opened their page — never who drew whom — and can reset one person with POST /api/kringle/<editToken>/reset {name}, redraw the whole thing, or delete it.

### Secret Role Dealer

Creates a pool of hidden party-game roles — Werewolf, Spy, and the like — behind one shared link. Players type their name, are dealt a random role from the ones still unclaimed, and read it on a private page nobody else can open, the organiser included. — [human page](https://bitibybit.com/secret-role-dealer/)

POST `/api/roles`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | optional | Optional. Trimmed and truncated to 80 characters. Internal whitespace is left as it is. Never rejected — an absent or empty title falls back to "Secret roles" on the shared and organiser pages, and to "The game" on a player's role page. |
| `note` | `string` | optional | Optional. Trimmed at the ends and truncated to 300 characters. Internal whitespace and line breaks are kept. Never validated. Absent or empty means both note blocks are left off. |
| `roles` | `string[]` | **required** | Required. The number of entries is the number of players, so three "Villager" entries create three villager slots. Each entry is trimmed, internal whitespace is collapsed to single spaces, and the entry is truncated to 80 characters. Empty entries are dropped. The count is not silently capped: after cleaning there must be at least 2 entries and no more than 40, and anything outside that returns 400. Duplicates are expected and are never rejected. A value that is not an array is treated as an empty list and fails the minimum. |

Example

```
{
  "title": "Werewolf at the Christmas Party",
  "note": "Keep your role to yourself until the first night. Phones face down at the table.",
  "roles": [
    "Werewolf",
    "Werewolf",
    "Seer",
    "Doctor",
    "Villager",
    "Villager",
    "Villager",
    "Villager"
  ]
}
```

Errors

- `400` — roles is absent, is not an array, or holds fewer than two usable entries once blanks are dropped. A request body that is not valid JSON lands here too, because it is read as an empty object. “Add at least two roles — one per line.”
- `400` — More than 40 roles remain once blanks are dropped. The message quotes the number that was received. “That's <n> roles — this tool tops out at 40.”
- `429` — More than 20 creation requests from the same connection within the current clock hour. The count is shared across every create endpoint on the site. The limit is not applied when the site is running in development mode. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** Players open the shared page at /s/<slug>, type their name into the join form and submit. That sends POST /api/roles/claim with {slug, name}, where the name is trimmed, whitespace-collapsed and truncated to 40 characters; an empty name returns 400 "Tell us your name first." The server picks one of the unclaimed slots at random and returns its token. If every role has gone, the response is 409 "All the roles are dealt." If that name has already joined, 409 "Someone already joined with that name — add a surname initial." If several people grab at the same instant and the chosen slot keeps being taken, the server retries up to three times and then returns 409 "Everyone grabbed at once — try again.", and the player can submit again. The token is the player's only credential: the browser keeps it and the role is shown at /p/<token>. The organiser page at /e/<editToken> lists who has joined and who has looked, but not which role each person holds, unless?reveal=1 is added to the address. From there the organiser can reset one player with POST /api/roles/<editToken>/reset {name}, redeal the whole pool, or delete the game.

### Bring a Plate

Creates a bring-a-plate signup board. You set up named categories, each with a fixed number of spots, and anyone with the link claims a spot with their name and what they are bringing. — [human page](https://bitibybit.com/bring-a-plate/)

POST `/api/plate`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | optional | Optional. Trimmed, internal whitespace collapsed to single spaces, truncated to 80 characters. Never rejected — absent or empty is stored as an empty string and the pages fall back to the default heading "Bring a plate". |
| `eventDate` | `string` | optional | Optional. Trimmed, internal whitespace collapsed to single spaces, truncated to 60 characters. Free text: never parsed or validated as a date. Absent or empty means the chip is left off. |
| `note` | `string` | optional | Optional. Trimmed at the ends and truncated to 300 characters. Internal whitespace is not collapsed, unlike title and eventDate, so line breaks survive. Never validated. |
| `categories` | `object[]` | **required** | Required. Between 1 and 12 entries. A missing value, or anything that is not an array, is treated as an empty list and returns 400; more than 12 entries also returns 400 rather than being trimmed down. Category names must all be different ignoring case. |
| `categories[].name` | `string` | **required** | Required. Trimmed, internal whitespace collapsed to single spaces, truncated to 40 characters. Must not be empty once trimmed. The name is checked before the capacity, so a category that is wrong on both reports the name error. Uniqueness across the whole array is case-insensitive. |
| `categories[].capacity` | `number` | **required** | Required. A whole number from 1 to 20. Numeric strings are converted, so "4" and 4 are the same. Missing, null, or a value with a fractional part such as 2.5 returns 400. Each spot gets its own id, numbered from 1 up to the capacity within that category. |

Example

```
{
  "title": "Friday Arvo Team Lunch",
  "eventDate": "Friday 12 September, 12:30pm",
  "note": "Level 3 kitchen from 12:30 — please label anything with nuts.",
  "categories": [
    {
      "name": "Mains",
      "capacity": 4
    },
    {
      "name": "Salads",
      "capacity": 3
    },
    {
      "name": "Desserts",
      "capacity": 2
    },
    {
      "name": "Drinks and ice",
      "capacity": 2
    }
  ]
}
```

Errors

- `400` — categories is absent, is not an array, or is an empty array. A request body that is not valid JSON lands here too, because it is read as an empty object. “Add at least one category.”
- `400` — categories holds more than 12 entries. “Twelve categories is the limit — combine a couple.”
- `400` — A category's name is empty or whitespace only once trimmed. “Every category needs a name.”
- `400` — A category's capacity is not a whole number, or is below 1 or above 20. “Spots per category must be a whole number from 1 to 20.”
- `400` — Two categories have the same name once case is ignored. “Two categories share a name — make each one different.”
- `429` — More than 20 creation requests from the same connection within the current clock hour. The count is shared across every create endpoint on the site. The limit is not applied when the site is running in development mode. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** Guests open the shared page at /s/<slug> and take an open spot with POST /api/plate/claim {slug, slotId, name, dish}. The slot id is positional and has the form "c<categoryIndex>-<n>", where categoryIndex is the position of the category in the list you supplied, counting from 0, and n runs from 1 to that category's capacity. Both name and dish are required: the name is trimmed, whitespace-collapsed and truncated to 40 characters, the dish to 80. A successful claim returns 201 with a 16-character secret. The guest's browser keeps that secret, and it is the only way to hand the spot back later, with POST /api/plate/unclaim {slug, slotId, secret}. If someone else takes the same spot first, the claim returns 409 "Someone snapped that spot up seconds ago — pick another." The organiser uses the edit token to free a spot with POST /api/plate/<editToken>/remove {slotId}, or to remove the board with POST /api/plate/<editToken>/delete.

### Tournament Bracket

Creates a single-elimination tournament bracket from a list of entrants. The field is padded out to the next power of two with byes, and the whole bracket is drawn at the moment you create it. — [human page](https://bitibybit.com/tournament-bracket/)

POST `/api/bracket`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | optional | Optional. Whitespace at the ends is trimmed and runs of internal whitespace collapse to single spaces. Anything past 80 characters is silently truncated, so a long title is never an error. Absent or empty is accepted, and the pages then show "Tournament bracket". |
| `entrants` | `string[]` | **required** | Required. Anything that is not an array is treated as an empty list and fails the minimum below. Entries that are not strings are converted to text before cleaning, so values such as null or false arrive as the literal words "null" and "false" and survive as names rather than being dropped. Each entry is trimmed, has internal whitespace collapsed to single spaces, and is silently truncated to 40 characters. Blank entries are dropped before the count is checked, so padding the list with empty strings does not raise the total. What is left must hold at least 2 and no more than 64 entrants; outside that range returns an error. All entrants must differ once case is ignored — a case-insensitive duplicate returns an error rather than being quietly dropped. |
| `seeding` | `string` | optional | Optional. The only value with an effect is the exact string "listed", which keeps the order you supplied as the seeding. Anything else — absent, null, "Listed", a typo — falls back to a random shuffle. It never returns an error, so a misspelling shows up as an unexpected draw rather than a rejected request. |

Example

```
{
  "title": "Office Table Tennis Cup",
  "entrants": [
    "Jess Nguyen",
    "Tom Baker",
    "Priya Sharma",
    "Liam O'Connor",
    "Chloe Watts",
    "Dave Mackenzie"
  ],
  "seeding": "random"
}
```

Errors

- `400` — Fewer than 2 usable entrants once blanks are dropped. This also covers entrants being absent or not an array, and a request body that is not valid JSON. “Add at least two names — one person is just practice.”
- `400` — More than 64 usable entrants once blanks are dropped. “64 is the limit — run two brackets and stage a grand final.”
- `400` — Two entrants match once case is ignored. The message quotes the offending name as it was cleaned — trimmed, collapsed and cut to 40 characters — not as you sent it. “"<name>" is in the list twice — add a surname initial to tell them apart.”
- `429` — More than 20 creation requests in the current clock hour from the same connection. The count is shared across the creation endpoints of every tool on the site. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** Creating a bracket returns two links: a public one to share and an organiser one to keep. There is no participant step. Everyone else reads the public page, which shows the state of the bracket as at each refresh. Only the organiser records results, by sending the round index, the match index within that round, and the winner. The winner must be exactly one of the two names in that match, or null to clear a result already recorded. Leaving the winner out is not the same as sending null, and is rejected with "The winner has to be one of the two names in that match." A first-round match with an empty side is a bye and is rejected with "That one's a bye — it sorted itself out." A later match still missing a name is rejected with "Both spots in that match need filling first — decide the earlier games." If two results land at once, one of them fails with 409 "Two results landed at once — refresh and tap again." The organiser can also delete the bracket.

### Group Card

Creates one shared digital card for a named recipient, which colleagues sign with their name and a message. — [human page](https://bitibybit.com/group-card/)

POST `/api/card`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `recipient` | `string` | **required** | Required, and the only required field. Trimmed, internal whitespace collapsed to single spaces, and silently truncated to 60 characters. Absent, empty or whitespace-only returns an error. |
| `title` | `string` | optional | Optional. Trimmed, internal whitespace collapsed to single spaces, silently truncated to 80 characters. Never rejected. If it is absent, empty or whitespace-only, the card falls back to "A card for <recipient>", itself cut to 80 characters. When the title you send matches that default, ignoring case, the sub-line drops it rather than repeat it. |
| `note` | `string` | optional | Optional. Trimmed at the ends only — internal whitespace is left alone, so line breaks survive. Silently truncated to 300 characters. Read but never validated, so it is never rejected; absent leaves it empty. |

Example

```
{
  "title": "Farewell to Marcus",
  "recipient": "Marcus Fielding",
  "note": "Marcus is off to the Perth office after nine years. We're handing this over at Friday drinks, so get your message in before then."
}
```

Errors

- `400` — recipient is absent, empty, or whitespace-only once trimmed. This also covers a request body that is not valid JSON. “Who's the card for? Add their name.”
- `429` — More than 20 creation requests in the current clock hour from the same connection. The count is shared across the creation endpoints of every tool on the site. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** Creating a card returns two links: a public one to share and an organiser one to keep. Signers open the public link and add a name and a message. Both are required. The name is trimmed, has internal whitespace collapsed, and is cut to 40 characters. The message is trimmed at the ends only, so line breaks survive, and is cut to 400 characters. A card holds 400 messages; a signer arriving after that gets 409 "This card is chockers — 400 messages is the limit." Two people with the same name can both sign. A successful signature returns a 22-character token, which is the signer's only handle on their own message and the only way to remove it. The browser keeps that token on the signer's device, so someone signing again from another device cannot remove the earlier message themselves. The organiser can remove any message and delete the card.

### Pixel Gift Registry (Build the Prado)

Creates a wedding gift registry drawn as a pixel-art Toyota Prado. It has 126 parts, and guests claim them one at a time instead of buying a toaster. — [human page](https://bitibybit.com/gift-registry/)

POST `/api/registry`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `coupleNames` | `string` | **required** | Required. Trimmed, internal whitespace collapsed to single spaces, silently truncated to 80 characters. Absent, empty or whitespace-only returns an error. Values that are not strings are converted to text, so anything with content in it passes. |
| `tagline` | `string` | optional | Optional. Trimmed, internal whitespace collapsed to single spaces, silently truncated to 140 characters. Absent or blank leaves it empty and the tagline is not rendered. No other checks. |
| `weddingDate` | `string` | optional | Optional. Trimmed, internal whitespace collapsed to single spaces, silently truncated to 60 characters. Absent or blank leaves it empty. It is free text and is never parsed or validated as a date, so "Saturday 14 March 2026" and "Some time in autumn" are equally acceptable. |
| `payment` | `object` | optional | Optional. Must be an object; anything else is treated as absent and silently becomes empty. The block is only kept when at least one of payId, accountName, bsb or accountNumber has content after trimming. If none of them do, the whole block is stored empty and any method or note you sent is discarded — method and note alone are not enough to keep it. Nothing here is format-checked. These details are kept off the public page: a guest sees them in the response when they claim a part, and the organiser sees them on the organiser page. |
| `payment.method` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, silently truncated to 40 characters. Only kept when the block also carries at least one of payId, accountName, bsb or accountNumber. Not checked against any list of methods. |
| `payment.payId` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, silently truncated to 80 characters. Supplying it is enough to keep the whole payment block. Never format-checked — any text is accepted, whether or not it looks like an email address or a mobile number. |
| `payment.accountName` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, silently truncated to 80 characters. Supplying it is enough to keep the whole payment block. No other validation. |
| `payment.bsb` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, silently truncated to 10 characters, which leaves room for the hyphenated form such as "083-004". Supplying it is enough to keep the whole payment block. Not checked for digits or for any particular format. |
| `payment.accountNumber` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, silently truncated to 20 characters. Supplying it is enough to keep the whole payment block. Not checked for digits. |
| `payment.note` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, silently truncated to 200 characters. Only kept when the block also carries at least one of payId, accountName, bsb or accountNumber. No other validation. |
| `overflowTitle` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, silently truncated to 60 characters. Absent or blank falls back to "Fuel & rego for the first year". |

Example

```
{
  "coupleNames": "Sam & Alex Nguyen",
  "tagline": "Skip the toaster — help us build the Prado for our honeymoon lap",
  "weddingDate": "Saturday 14 March 2026",
  "overflowTitle": "Fuel & rego for the first year",
  "payment": {
    "method": "PayID",
    "payId": "sam.nguyen@example.com",
    "accountName": "S & A Nguyen",
    "bsb": "083-004",
    "accountNumber": "123456789",
    "note": "Pop the reference in so we know who it's from."
  }
}
```

Errors

- `400` — coupleNames is absent, empty, or whitespace-only once trimmed. This also covers a request body that is not valid JSON. A non-string value with content in it is converted to text and passes. “Add your names — it's your registry.”
- `429` — More than 20 creation requests in the current clock hour from the same connection. That count is shared across the creation endpoints of every tool on the site. Requests to the other endpoints draw on a separate allowance of 240 an hour. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** Creating a registry returns two links: a public one to share and an organiser one to keep. There are no per-guest accounts or tokens — the public link is the only thing a guest needs. A guest picks a part and claims it with their name and an optional message cut to 240 characters. The name is required, is cleaned the same way as the creation fields and cut to 60 characters, and a missing one returns 400 "Add your name — it goes on the build crew wall." The part must be one of the 126 ids on the build sheet; anything else returns 400 "That part isn't on this build sheet." A part's price is fixed on the server and is never taken from the request. A successful claim returns a reference, the amount in cents, and the couple's payment details — that response is the only place a guest sees those details. If someone claimed the same part moments earlier, the second claim returns 409 "Someone beat you to that one by a whisker." Latecomers can chip into the overflow item instead, with a whole number of cents from 500 to 200000, that is $5 to $2,000, plus a name and an optional message; an amount outside that range returns 400 "Pick an amount between $5 and $2,000." The overflow holds 400 contributions, after which it returns 409 "The overflow patch is chockers — give your gift to the couple directly." An unknown public link returns 404 "not found". The public list of claims leaves out the references and whether a claim has been paid. The organiser link gives the full list, and lets the organiser mark a part paid, release a claim back to the board, or delete the registry.

### Fact Matcher

Creates an office icebreaker. Each person on a set list privately submits one fact about themselves, the room guesses who is who, and the organiser reveals the answer key when they are ready. — [human page](https://bitibybit.com/fact-matcher/)

POST `/api/fact`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | optional | Optional. Trimmed, internal whitespace collapsed to single spaces, silently truncated to 80 characters. Absent or blank is accepted and stored empty, and every page then shows "Fact Matcher". No other checks. |
| `prompt` | `string` | optional | Optional. Trimmed, internal whitespace collapsed to single spaces, silently truncated to 140 characters. Absent or blank falls back to "Share a fun fact about yourself". |
| `note` | `string` | optional | Optional. Trimmed at the ends only — unlike title and prompt, internal whitespace is left alone, so line breaks survive. Silently truncated to 300 characters. Absent or blank leaves it empty and the note block is not rendered. |
| `names` | `string[]` | **required** | Required. Supply an array of strings; anything that is not an array — a bare string, an object, null — is treated as an empty list and fails the minimum below. Entries that are not strings are converted to text before cleaning, so values such as null or false arrive as the literal words "null" and "false" and survive as names. Each name is trimmed, has internal whitespace collapsed to single spaces, and is silently truncated to 40 characters. Blank entries are dropped before the count is checked, so blanks in the list do not raise the total. What is left must hold at least 3 names and no more than 60; outside that range returns an error. All names must differ once case is ignored — a case-insensitive duplicate returns an error rather than being merged away, since each name has to be claimable by exactly one person. |

Example

```
{
  "title": "Friday arvo icebreaker — Ops team",
  "prompt": "Share a fun fact about yourself",
  "note": "We'll read these out over pizza in the boardroom at 4pm — keep it clean.",
  "names": [
    "Sam Nguyen",
    "Priya Sharma",
    "Jack O'Brien",
    "Chloe Tran",
    "Dave Katsoulis",
    "Mel Robertson"
  ]
}
```

Errors

- `400` — Fewer than 3 usable names once blanks are dropped. This also covers names being absent or not an array, and a request body that is not valid JSON. “Add at least three names — a guessing game needs a few people.”
- `400` — More than 60 usable names once blanks are dropped. “Sixty names is the limit — split a big group into two rounds.”
- `400` — Two names match once case is ignored, such as "Sam" and "sam". The message quotes the second of the pair as it was cleaned — trimmed, collapsed and cut to 40 characters. “"<name>" is on the list twice — add a surname initial so the right person claims it.”
- `429` — More than 20 creation requests in the current clock hour from the same connection. The count is shared across the creation endpoints of every tool on the site. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** Creating a game returns two links: a public one to share and an organiser one to keep. Every endpoint on this tool is POST-only. The public page shows a grid of the names supplied at creation. A person taps their own name and is handed a private link of their own. The name sent when claiming is cleaned the same way as at creation: trimmed, whitespace collapsed, cut to 40 characters. Claiming is one-shot — the first person to take a name gets the private link, and anyone tapping it afterwards gets 409 "That name's already been taken. If it's you, ask the organiser to reset it." A name that is not on the list, a blank name, or an unknown public link all return 404 "That name isn't on this list." On the private page a person writes their fact, up to 280 characters, and can save it again to change it. The organiser can reset one person, which issues them a fresh private link and wipes their fact; can turn the reveal on or off, which flips the shared page between the guessing grid and the answer key; and can delete the game. A reset for a name that is not on the list returns 404 "That name isn't on this list."

### Baby Guess Pool

Creates a baby-shower guessing pool: anyone with the link guesses the arrival date and birth weight, and once the organiser records the real birth the closest guess wins. — [human page](https://bitibybit.com/baby-guess-pool/)

POST `/api/baby`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `parents` | `string` | **required** | Required. Trimmed, runs of internal whitespace collapsed to single spaces, then truncated to 80 characters. A value that is missing, empty, or whitespace-only is rejected with 400, as is any falsy value such as null, false or 0. A truthy non-string value is converted to text and accepted. |
| `dueDate` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, truncated to 60 characters. Never rejected. Not parsed or checked as a date, so "Early September, all going well" is fine. Absent or blank means no chip is shown. |
| `note` | `string` | optional | Optional. Trimmed at both ends only — internal spacing and line breaks survive, unlike parents and dueDate. Truncated to 300 characters. Never rejected. Absent or blank means no note is shown. |

Example

```
{
  "parents": "Emma & Josh Whitfield",
  "dueDate": "Late September, all going well",
  "note": "Shower's at the Brunswick Bowls Club — get your guess in before the sausage rolls come out."
}
```

Errors

- `400` — parents is missing, empty, or whitespace-only once trimmed, or is any other falsy value such as null, false or 0. A request body that is not valid JSON is treated as an empty body, so it fails here too. “Whose bub is it? Add the parents' names.”
- `429` — More than 20 pools created in the current clock hour from the same connection. The budget is shared across every tool's create endpoint on the site, not counted per tool. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** There are no pre-seeded participants. Anyone with the public link /s/<slug> can enter. A guest POSTs /api/baby/guess with slug, guesser, date, weightGrams and an optional message. An unknown slug returns 404. guesser is required, trimmed and whitespace-collapsed to 40 characters, otherwise 400 "Add your name so we know whose guess it is.". date must be written as YYYY-MM-DD, must be a real calendar day, and must fall within 400 days before or 550 days after the time of the request: a blank date returns "Pick a date for your guess.", a malformed one "That date doesn't look right — use the date picker.", an impossible day "That date doesn't look right — check the day and month.", and one outside the window "Keep the date within a year or so — it's a guess, not a prophecy.". weightGrams is rounded to the nearest whole number and must be between 500 and 7000, otherwise 400 "Give a weight between 0.5 and 7 kg.". message is trimmed to 200 characters. A successful guess returns 201 with a token and an id. That token is the guest's only handle on their own guess and is what POST /api/baby/g/<token>/remove needs. Two guests may use the same name. A pool holds 300 guesses; past that, entries are refused with 409 "This pool's chockers — that's the limit on guesses.". Once a result has been recorded, guessing closes with 409 "Bub's already here — the guessing's closed.". The organiser works from /e/<editToken>: POST /api/baby/<editToken>/result with date, weightGrams and an optional free-text arrivedAt (max 40 characters) closes the pool and reveals the leaderboard, and posting a null result reopens it. The organiser can also remove a single guess and delete the pool. Every endpoint on this tool takes POST.

### Volunteer Roster

Creates a shareable sign-up roster of timed shifts, each with a fixed number of spots, for a school fete, canteen, working bee or sausage sizzle. — [human page](https://bitibybit.com/volunteer-roster/)

POST `/api/roster`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | optional | Optional. Trimmed, internal whitespace collapsed to single spaces, truncated to 80 characters. Never rejected. When absent or empty, the pages show "Volunteer roster". |
| `eventDate` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, truncated to 60 characters. Never rejected — any text is accepted. When absent or empty, no chip is shown. |
| `note` | `string` | optional | Optional. Trimmed at both ends only — internal spacing and line breaks survive, unlike title and eventDate. Truncated to 300 characters. Never rejected. Defaults to empty. |
| `shifts` | `object[]` | **required** | Required. An array of 1 to 20 entries, each an object with a label and a capacity. A missing value, a value that is not an array, and an empty array are all rejected with 400, as is an array of more than 20 entries — nothing is silently dropped. Labels are not deduplicated, so two shifts may share the same label. |
| `shifts[].label` | `string` | **required** | Required. Trimmed, internal whitespace collapsed, truncated to 50 characters. Must still have content after trimming, or the request is rejected with 400. The label is checked before the capacity, so a shift missing both reports the label error. |
| `shifts[].capacity` | `number` | **required** | Required, with no default. Must be a whole number from 1 to 30, inclusive. A numeric string such as "3" is accepted. Missing, fractional, non-numeric, or out-of-range values are rejected with 400. |

Example

```
{
  "title": "Warrnambool Primary Fete - Sausage Sizzle",
  "eventDate": "Saturday 14 March, 9am-2pm",
  "note": "Park behind the hall and check in with Deb at the canteen door.",
  "shifts": [
    {
      "label": "Grill 9:00-11:00am",
      "capacity": 3
    },
    {
      "label": "Drinks stall 11:00am-1:00pm",
      "capacity": 2
    },
    {
      "label": "Pack down 1:00-2:00pm",
      "capacity": 4
    }
  ]
}
```

Errors

- `400` — shifts is missing, is not an array, or is an empty array. A request body that is not valid JSON is treated as an empty body, so it fails here too. “Add at least one shift.”
- `400` — shifts contains more than 20 entries. “Twenty shifts is the limit — split the day if you need more.”
- `400` — A shift's label is missing, or is empty once trimmed. “Every shift needs a label — a job and a time.”
- `400` — A shift's capacity is missing, is not a whole number, or falls outside 1 to 30. “Spots per shift must be a whole number from 1 to 30.”
- `429` — More than 20 rosters created in the current clock hour from the same connection. The budget is shared across every tool's create endpoint on the site, not counted per tool. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** The creator lands on the coordinator page at /e/<editToken> and shares the public link /s/<slug>. Volunteers POST /api/roster/claim with slug, slotId, name and an optional message. slotId names one spot in one shift and takes the form s<shift position>-<n>, where n runs from 1 to that shift's capacity; anything else returns 400 "That shift spot doesn't exist on this roster.". name is required, whitespace-collapsed to 40 characters, otherwise 400 "Add your name so the coordinator knows who's on.". message is optional, whitespace-collapsed to 120 characters, and only the coordinator sees it. A successful claim returns 201 with a 16-character secret. That secret is the volunteer's only way back: POST /api/roster/unclaim with slug, slotId and secret hands the spot in. If someone takes the spot first, the claim returns 409 "Someone just grabbed that shift — pick another.". The edit token gates the coordinator's endpoints: POST /api/roster/<editToken>/remove, POST /api/roster/<editToken>/delete, and GET /api/roster/<editToken>/admin, which returns the roster as CSV and is served no-store and non-indexable.

### Meal Train

Creates a date-keyed meal roster for a new parent, someone home from surgery, or a grieving family, plus an optional board of other ways to help — the school run, the dog, the washing — and links to local places that could pitch in. — [human page](https://bitibybit.com/meal-train/)

POST `/api/meal`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `forWhom` | `string` | **required** | Required. Trimmed, internal whitespace collapsed to single spaces, truncated to 80 characters. A missing or whitespace-only value is rejected with 400. The stored title is "Meals for " followed by this value, truncated to 120 characters. |
| `note` | `string` | optional | Optional. Trimmed at both ends only — internal spacing and line breaks survive. Truncated to 400 characters. Never rejected. Defaults to empty, in which case the block is not shown. |
| `allergies` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, truncated to 200 characters. Never rejected. Defaults to empty, in which case the banner is not shown. |
| `dropoff` | `string` | optional | Optional. Trimmed, internal whitespace collapsed, truncated to 120 characters. Never rejected. When empty, the coordinator page says no drop-off address is saved. |
| `dates` | `string[]` | optional | Optional. Used only when supplied as a non-empty array, and supplying one makes startDate and days irrelevant. Only the first 61 entries are read; anything past that is ignored. Every entry read must be exactly YYYY-MM-DD and a real calendar day — 2026-02-30 is rejected with 400. Repeated days are silently de-duplicated and the list is sorted into ascending order. If more than 60 unique days remain, the request is rejected with 400. All days are interpreted in UTC. |
| `startDate` | `string` | optional | Read only when no non-empty dates array is supplied, and required in that case. Must be exactly YYYY-MM-DD and a real calendar day; surrounding whitespace is trimmed first. Anything else is rejected with 400. Interpreted in UTC. |
| `days` | `number` | optional | Read only when no non-empty dates array is supplied, and required in that case. Must be a whole number of at least 1; a numeric string is accepted. Missing, fractional, zero or negative values are rejected with 400. A value above 60 is silently reduced to 60 rather than rejected. |
| `capacityPerDay` | `number` | optional | Optional, and it never returns an error. Must be a whole number of at least 1; anything else — missing, zero, negative, fractional, or not a number — silently becomes 1. A value above 3 is silently reduced to 3. |
| `tasks` | `object` | optional | Optional. An array of up to 12 objects, each with a label and a capacity. Labels are trimmed, whitespace-collapsed and truncated to 70 characters; an entry with an empty label is dropped. Capacity is a whole number from 1 to 20, defaulting to 1 if missing or invalid. Each job is given a stable id, so removing one later never disturbs another job's sign-ups. Jobs can also be added and removed from the coordinator page after the roster exists. |
| `helpLinks` | `object` | optional | Optional. An array of up to 8 objects, each with a label and a url. Only http and https URLs are kept; anything else is silently dropped. URLs are truncated to 300 characters and labels to 70; a missing label falls back to the link's hostname. These are plain outbound links — the site brokers nothing and handles no money. |

Example

```
{
  "forWhom": "the Brennan family",
  "allergies": "No nuts — youngest is anaphylactic",
  "startDate": "2026-09-01",
  "days": 10,
  "capacityPerDay": 1,
  "tasks": [
    {
      "label": "Walk Ruby — weekday evenings",
      "capacity": 2
    },
    {
      "label": "School pickup, Tuesdays",
      "capacity": 1
    }
  ],
  "helpLinks": [
    {
      "label": "Sala Thai on High St — they deliver",
      "url": "https://example.com/menu"
    }
  ]
}
```

Errors

- `400` — forWhom is missing or empty once trimmed. A request body that is not valid JSON is treated as an empty body, so it fails here too. “Who are the meals for? Add a name — a family, a person, whoever.”
- `400` — An entry in the dates array is not exactly YYYY-MM-DD, or is not a real calendar day — "2026-02-30" or "1 Sep 2026", for instance. “One of those days isn't a real calendar date.”
- `400` — No non-empty dates array was supplied, and startDate is missing or is not a valid YYYY-MM-DD calendar day. “Pick a valid first day.”
- `400` — No non-empty dates array was supplied, and days is missing, is not a whole number, or is less than 1. “How many days need a meal? At least one.”
- `400` — No days at all came out of either route. This is a defensive guard only and is unreachable in practice: the dates route requires a non-empty array whose entries either throw or are kept, and the startDate route guarantees at least one day. “Add at least one day that needs a meal.”
- `400` — More than 60 unique valid days remain in the dates array. Because only the first 61 entries are read, this is reachable only when exactly 61 unique valid days are read. The startDate and days route cannot reach it — that route reduces to 60 silently instead. “Sixty days is the limit — start a second roster if it runs longer.”
- `429` — More than 20 rosters created in the current clock hour from the same connection. The budget is shared across every tool's create endpoint on the site, not counted per tool. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** The creator lands on the coordinator page at /e/<editToken> — the only place the drop-off details appear — and shares the public link /s/<slug>. Cooks POST /api/meal/claim with slug, slotId, name and an optional dish. slotId names one slot on one day and takes the form d<day position>-<n>, where n runs from 1 to capacityPerDay; anything else returns 400 "That day isn't on this roster.". name is required, whitespace-collapsed to 40 characters, otherwise 400 "Add your name so the family knows who's cooking.". dish is optional, whitespace-collapsed to 120 characters, and shows on both the public board and the coordinator page. A successful claim returns 201 with a 16-character secret, which is the cook's only way to hand the day back: POST /api/meal/uncook with slug, slotId and secret. If two people claim the same slot at once, the second gets 409 "Someone's already got that day — pick another.". The edit token gates POST /api/meal/<editToken>/remove, POST /api/meal/<editToken>/delete and GET /api/meal/<editToken>/admin, which returns the roster as CSV and is served no-store and non-indexable. Drop-off details are never published, so the coordinator passes them to each cook directly.

### Group Vote

Creates a group poll with no accounts and no sign-in: a question, a list of options, single or multiple choice, and optionally the ability for voters to add their own option. — [human page](https://bitibybit.com/group-vote/)

POST `/api/poll`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `question` | `string` | **required** | Required. Trimmed, internal whitespace collapsed to single spaces, truncated to 140 characters. A missing or whitespace-only value is rejected with 400. The cleaned value is used as the poll title as-is, with no further truncation. |
| `options` | `string[]` | **required** | Required. Only the first 200 elements are read; the rest are ignored. Each option is trimmed, whitespace-collapsed, and truncated to 80 characters. Entries that are empty after trimming are silently skipped, and an option matching an earlier one case-insensitively is silently dropped, first occurrence winning. After that cleaning, fewer than 2 options is rejected with 400, and more than 30 is rejected with 400. A poll therefore needs 2 to 30 distinct, non-empty options. |
| `mode` | `string` | optional | Optional, and it never returns an error. Defaults to "single". The only value with an effect is "multi", matched exactly; anything else — "Multi", "MULTI", true, or the field being absent — becomes "single". |
| `allowSuggestions` | `boolean` | optional | Optional, and it never returns an error. Defaults to false. Treated as a plain true/false test: any truthy value turns it on, any falsy value — including the field being absent — turns it off. |

Example

```
{
  "question": "Where should we do the team Christmas lunch this year?",
  "options": [
    "The Lord Nelson Brewery Hotel",
    "Chin Chin on Flinders Lane",
    "Bondi Icebergs Dining Room",
    "Backyard barbie at Sharon's"
  ],
  "mode": "single",
  "allowSuggestions": true
}
```

Errors

- `400` — question is missing or empty once trimmed. A request body that is not valid JSON is treated as an empty body, so it fails here too. “Add a question — what's the group deciding?”
- `400` — Fewer than 2 usable options remain after cleaning. That covers options being missing, not an array, all blank, or collapsing to a single option through the case-insensitive de-duplication. “Give people at least two options to choose between.”
- `400` — More than 30 usable options remain after cleaning and de-duplication. “Thirty options is the limit — trim the list a bit.”
- `429` — More than 20 polls created in the current clock hour from the same connection. The budget is shared across every tool's create endpoint on the site, not counted per tool. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** The creator lands on the organiser page at /e/<editToken> — the only view that shows who voted for what — and shares the public link /s/<slug>. Voters POST /api/poll/vote with slug, choices (an array of option ids), an optional voterName and an optional suggestion. Ids that do not match a real option are dropped, and repeats are ignored. voterName is optional, whitespace-collapsed to 40 characters. suggestion is whitespace-collapsed to 80 characters and only counts when the poll allows suggestions: if it matches an existing option case-insensitively it is treated as that option, otherwise it is added to the poll. On a single-choice poll a fresh suggestion becomes the whole ballot; otherwise only the first pick is kept. An empty ballot is refused with 400 "Pick an option before you vote.". A successful vote returns 201 with a 22-character token, the recorded choices, the id of any option that was added, and the current tally. That token lets the voter change their mind: POST /api/poll/v/<token> with a new choices array. Voting is refused with 409 once the organiser closes the poll, and once the poll has 2000 votes. The edit token gates POST /api/poll/<editToken>/close, /addOption, /removeOption and /delete. Nothing stops one person voting twice from another browser — it runs on the honour system.

### Recipe Collection

Creates a shared recipe book. The organiser sets it up, then anyone with the share link adds a recipe of their own. — [human page](https://bitibybit.com/recipe-collection/)

POST `/api/recipe`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | **required** | Required. The value is trimmed, runs of internal whitespace are collapsed to single spaces, and it is truncated to 80 characters. It must still be non-empty after that, or the request is rejected with 400. This is the first field checked — forWhom and note are not even read until the title passes. |
| `forWhom` | `string` | optional | Optional and never rejected — there is no error path for it. Trimmed, internal whitespace collapsed to single spaces, truncated to 80 characters, silently, with no error on overflow. Absent, null or empty gives an empty value and the line is simply left off the page. |
| `note` | `string` | optional | Optional and never rejected. Windows-style line endings are normalised to plain newlines, then the text is trimmed at the ends and truncated to 300 characters, silently. Internal whitespace is not collapsed and line breaks are kept, so a multi-line note stays multi-line. Absent or null gives an empty value. |

Example

```
{
  "title": "Sharon's Farewell Recipe Book",
  "forWhom": "Sharon from Accounts",
  "note": "Sharon is off to Byron after 14 years. Chuck in the dish you always bring to the office Christmas do."
}
```

Errors

- `400` — The title is missing, null, empty, or only whitespace once trimmed and collapsed. A body that is not valid JSON also lands here, because it is treated as an empty body. “Give the book a name — like “Grandma Rosa's Recipe Book”.”
- `429` — More than 20 creates from the same connection within one clock hour. The budget is shared across every tool's create endpoint on the site rather than counted per tool, so the 21st create in the hour is refused whichever tool it was for. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** A successful create returns 201 with {slug, editToken}. The organiser shares the public page at /s/<slug> and keeps the organiser page at /e/<editToken>. Anyone who opens the share page can add one recipe with POST /api/recipe/add and a body of {slug, cook, dish, ingredients, method, serves?, story?}. cook (max 40), dish (max 80), ingredients (max 1500) and method (max 2500) are all required. serves (max 40) and story (max 500) are optional and are dropped when empty. A successful add returns 201 with {token, id}. That 22-character token is the contributor's private key to their own recipe. It is held in their browser, deliberately never rendered on the public page (it appears only on the gated organiser page), and is used for POST /api/recipe/r/<token>/save and POST /api/recipe/r/<token>/remove. A book holds at most 200 recipes; past that, adds return 409 "This book's full — 200 recipes is the limit." The organiser works from /e/<editToken>: POST /api/recipe/<editToken>/remove with {rtoken} takes one recipe down, and POST /api/recipe/<editToken>/delete removes the whole book.

### Gift Idea Board

Creates a board for organising a group gift. Anyone with the link suggests ideas, upvotes them, and claims the one they will buy so nobody doubles up. — [human page](https://bitibybit.com/gift-ideas/)

POST `/api/giftidea`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `recipient` | `string` | **required** | Required. Trimmed, internal whitespace collapsed to single spaces, truncated to 80 characters. It must still be non-empty after that, or the request is rejected with 400. This is the first field checked — occasion, budget and note are not read until it passes. The board's title is built from this name as "Gift ideas for <recipient>"; there is no separate title field on this endpoint. |
| `occasion` | `string` | optional | Optional and never rejected — there is no error path for it. Trimmed, internal whitespace collapsed to single spaces, truncated to 80 characters, silently. Absent or empty leaves the chip off the board. |
| `budget` | `string` | optional | Optional and never rejected. Trimmed, internal whitespace collapsed to single spaces, truncated to 40 characters, silently. Free text — it is not parsed as an amount. Absent or empty leaves the chip off the board. |
| `note` | `string` | optional | Optional and never rejected. Trimmed at the ends and truncated to 300 characters, silently. Internal whitespace is not collapsed and line breaks are kept exactly as supplied — unlike the recipe book's note, Windows-style line endings are not converted either. Absent or null gives an empty value. |

Example

```
{
  "recipient": "Dave from the warehouse",
  "occasion": "His 50th and 20 years on the floor",
  "budget": "$25 a head, about $400 all up",
  "note": "Whip-round closes Friday arvo. Do not mention any of this to Dave."
}
```

Errors

- `400` — The recipient is missing, null, empty, or only whitespace once trimmed and collapsed. A body that is not valid JSON also lands here, because it is treated as an empty body. “Who's the gift for? Add their name.”
- `429` — More than 20 creates from the same connection within one clock hour. The budget is shared across every tool's create endpoint on the site rather than counted per tool, so the 21st create in the hour is refused whichever tool it was for. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** A successful create returns 201 with {slug, editToken}. The organiser shares /s/<slug> with everyone except the recipient — the board is meant to stay a surprise. Guests suggest an idea with POST /api/giftidea/suggest and a body of {slug, idea, link?, suggestedBy?}. idea is required and truncated to 120 characters, suggestedBy is optional and truncated to 40. link is optional but strictly checked: an address that cannot be parsed returns 400 "That link doesn't look right — paste the full web address, or leave it blank.", anything that is not http or https returns 400 "Links need to start with http:// or https://.", and the maximum length is 300 characters. A successful suggestion returns 201 with {token, id}; that 22-character token is held in the suggester's browser and lets them take their own idea down with POST /api/giftidea/i/<token>/remove, which also clears any claim on it. Upvotes are POST /api/giftidea/upvote with {slug, ideaId} and return {ok, votes}; the count is incremented atomically, but the vote itself is deliberately soft — deduplicated only in the voter's own browser, so a determined person can vote twice. Claiming an idea to buy is POST /api/giftidea/claim with {slug, ideaId, name}, which returns 201 with a 16-character {secret}. name is required, maximum 40 characters, and 400 "Add your name so nobody else buys it too." comes back without it. Only one person can claim a given idea; the second gets 409 "Someone's already getting that one." The claimer undoes it with POST /api/giftidea/unclaim and {slug, ideaId, secret}. A board holds at most 200 ideas; past that, suggestions return 409. The organiser works from /e/<editToken>: POST /api/giftidea/<editToken>/removeIdea with {itoken} removes one idea, and POST /api/giftidea/<editToken>/delete removes the board.

### Hens & Shower Planner

Creates a planning board for a hens, bridal shower or baby shower — the details, an optional running order, and a "who brings what" board of named lists with a fixed number of spots each. — [human page](https://bitibybit.com/hens-planner/)

POST `/api/hens`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | **required** | Required. Trimmed, internal whitespace collapsed to single spaces, truncated to 80 characters. It must still be non-empty after that, or the request is rejected with 400. This is checked before the categories. |
| `forWhom` | `string` | optional | Optional and never rejected — there is no error path for it. Trimmed, internal whitespace collapsed to single spaces, truncated to 80 characters, silently. Absent gives an empty value and the line is left off. |
| `when` | `string` | optional | Optional and never rejected. Trimmed, internal whitespace collapsed to single spaces, truncated to 80 characters, silently. Free text — it is never parsed or checked as a date, so "Saturday arvo, some time after 2" is fine. Absent leaves the chip off. |
| `where` | `string` | optional | Optional and never rejected. Trimmed, internal whitespace collapsed to single spaces, truncated to 120 characters, silently. Absent leaves the chip off. Treat it as semi-private: it appears on the share page, but never in link-preview metadata, and the share page is not indexed or cached by search engines. |
| `note` | `string` | optional | Optional and never rejected. Trimmed at the ends and truncated to 400 characters, silently. Internal whitespace is not collapsed and line breaks are kept exactly as supplied; Windows-style line endings are not converted. Absent gives an empty value. |
| `kitty` | `string` | optional | Optional and never rejected. Trimmed at the ends and truncated to 200 characters, silently. Internal whitespace is not collapsed. Absent gives an empty value. |
| `categories` | `object[]` | **required** | Required. Must be an array of 1 to 12 entries; anything that is not an array — a string, an object, null, or a missing value — is quietly treated as empty and then fails the first check. Each entry is an object of {name, capacity}; any other keys on an entry are silently dropped. Names must be unique ignoring case. Checks run in this order: the array is present and non-empty, then the count of 12, then each entry's name and capacity in turn, then the duplicate-name check. Name and capacity are checked together per entry, so an early entry's capacity error is reported before a later entry's name error. |
| `categories[].name` | `string` | **required** | Required. Trimmed, internal whitespace collapsed to single spaces, truncated to 40 characters. It must still be non-empty after that, or the request is rejected with 400; a null or non-object entry collapses to empty and fails here too. Compared in lower case against the other names for the duplicate check. |
| `categories[].capacity` | `number` | **required** | Required. Must be a whole number from 1 to 20. The value is converted to a number first, so a numeric string such as "4" is accepted (and a boolean true converts to 1). A missing capacity, null, an empty string, or a fraction such as 2.5 is rejected with 400 — null and an empty string both convert to 0 and fail the lower bound. |
| `activities` | `string[]` | optional | Optional and never rejected — there is no error path for this field at all. Anything that is not an array is treated as empty. Each entry is trimmed, has internal whitespace collapsed to single spaces, and is truncated to 100 characters. Entries that are empty or only whitespace are silently dropped, and anything past the first 20 entries is silently discarded rather than returning an error. |

Example

```
{
  "title": "Mia's Hens Weekend",
  "forWhom": "Mia",
  "when": "Saturday 18 October, from 2pm",
  "where": "The Boathouse, Balmoral Beach, Mosman",
  "note": "Wear something you can actually dance in. Mia's mum is joining us for the first hour only.",
  "kitty": "$60 each covers the boat and the grazing platters. Square up with Steph on the day, cash or transfer.",
  "categories": [
    {
      "name": "Grazing platters",
      "capacity": 3
    },
    {
      "name": "Bubbles and mixers",
      "capacity": 4
    },
    {
      "name": "Decorations and sashes",
      "capacity": 2
    }
  ],
  "activities": [
    "2pm - bubbles on the deck",
    "3pm - cocktail making class",
    "6pm - dinner at the pub",
    "8pm - karaoke, non-negotiable"
  ]
}
```

Errors

- `400` — The title is missing, empty, or only whitespace once trimmed and collapsed. A body that is not valid JSON also lands here, because it is treated as an empty body. “Give the do a name — even just "Mia's Hens".”
- `400` — categories is missing, is not an array, or is an empty array. “Add at least one thing to bring or sort.”
- `400` — More than 12 categories were supplied. “Twelve lists is the limit — combine a couple.”
- `400` — A category's name is missing, empty, or only whitespace once trimmed and collapsed to 40 characters. A null entry or an entry that is not an object fails the same way. “Every list needs a name.”
- `400` — A category's capacity is not a whole number once converted, or is below 1 or above 20. A missing capacity, null, and an empty string all fail this check. “Spots per list must be a whole number from 1 to 20.”
- `400` — Two categories have the same name ignoring case, for example "Drinks" and "drinks". “Two lists share a name — make each one different.”
- `429` — More than 20 creates from the same connection within one clock hour. The budget is shared across every tool's create endpoint on the site rather than counted per tool, so the 21st create in the hour is refused whichever tool it was for. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** A successful create returns 201 with {slug, editToken}. The organiser shares /s/<slug>. Guests claim a spot with POST /api/hens/claim and a body of {slug, slotId, name, message?}. slotId is a positional id of the form "c<categoryIndex>-<n>", where the category index starts at 0 and n runs from 1 to that category's capacity. An id that does not exist on the board returns 400 "That spot doesn't exist on this board." and a missing name returns 400 "Add your name so people know who's got it." name is limited to 40 characters and the optional message to 120; both are trimmed and have internal whitespace collapsed. A successful claim returns 201 with a 16-character {secret}. Each spot can only be claimed once, so a second person claiming the same spot gets 409 "Someone grabbed that spot seconds ago — pick another." The secret lives only in the claimant's browser and is what lets them let the spot go again with POST /api/hens/unclaim and {slug, slotId, secret}. The organiser works from /e/<editToken>: POST /api/hens/<editToken>/remove with {slotId} force-clears anyone's claim, and POST /api/hens/<editToken>/delete removes the board.

### Question of the Day

Creates a recurring question of the day for a team. One share link that never changes, with a two-option question that rotates on its own at midnight, Sydney time. — [human page](https://bitibybit.com/question-of-the-day/)

POST `/api/qotd`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `teamName` | `string` | optional | Optional and never rejected — there is no emptiness check, no character check, and no branch that can refuse it. Trimmed, internal whitespace collapsed to single spaces, then truncated to 60 characters; overflow is truncated silently rather than returning an error. Absent, null or empty stores an empty label and the board falls back to a generic title. Non-string values, including numbers and objects, are converted to text rather than rejected. A create with no teamName at all still returns 201. This is the only field the create endpoint reads; anything else in the body is ignored. |

Example

```
{
  "teamName": "Level 3 Finance"
}
```

Errors

- `429` — More than 20 creates from the same connection within one clock hour. The budget is shared across every tool's create endpoint on the site rather than counted per tool, so the 21st create in the hour is refused whichever tool it was for. Only POST requests are counted, and only creates draw on the 20-per-hour budget; every other endpoint shares a larger allowance of 240 per connection per hour. “Steady on — too many requests from this connection. Give it a few minutes.”

**How people take part:** There are no invitations and no per-person setup. The creator gets back {slug, editToken}: they bookmark the organiser page at /e/<editToken> and share the single public page at /s/<slug>. That link stays the same forever, because the question is worked out from the calendar. Anyone who opens the share page votes with POST /api/qotd/vote and a body of {slug, choice, day, qi, voterName}, where choice is "a" or "b" and qi identifies the question being answered. The slug is the only credential — no account or token is needed to vote. The response is 201 with {token, day, qi, choice, tally}. That vote token is kept in the voter's browser and lets them change their mind with POST /api/qotd/v/<token> and {choice, day, qi}. GET /api/qotd/<slug>/tally returns the current day's split; the page loads with its bars empty on purpose so early votes are not swayed. Organiser-only actions all use the edit token: POST /api/qotd/<editToken>/skip, /add, /remove and /delete.

### Coffee Roulette

Pairs a team up for a coffee, one round at a time. Each person claims their name once and keeps a private link that shows their new partner every round. — [human page](https://bitibybit.com/coffee-roulette/)

POST `/api/coffee`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `title` | `string` | optional | Optional. Trimmed and truncated to 80 characters. Falls back to "Coffee roulette". |
| `names` | `string[]` | **required** | Required. Each name is trimmed, whitespace-collapsed and truncated to 40 characters; empties are dropped. At least 3 and at most 200 must remain. Names must all be different ignoring case, or the request is rejected — two people with the same name cannot each claim their own. |
| `cadence` | `string` | optional | Optional. Trimmed and truncated to 40 characters. Free text, never parsed — "Every second Monday" is fine. |
| `note` | `string` | optional | Optional. Trimmed and truncated to 300 characters. |

Example

```
{
  "title": "Product team coffee",
  "names": [
    "Priya",
    "Tom H",
    "Meredith",
    "Jules",
    "Sam N",
    "Alex",
    "Bec"
  ],
  "cadence": "Every second Monday"
}
```

Errors

- `400` — Fewer than three usable names once blanks are dropped. “Add at least three names — with two there's only ever one pairing.”
- `400` — Two names match once case is ignored.
- `429` — More than 20 creation requests from the same connection within the current clock hour.

**How people take part:** Everyone opens the shared page, taps their own name once and lands on a private page at /p/{token}. That page is permanent — each new round it shows a different partner, so nobody claims their name more than once. The organiser draws the next round from /e/{editToken}; it re-pairs everyone without touching anyone's link. Odd numbers form one group of three. Recent pairings are avoided for a few rounds. The organiser can see who has claimed a name but never who is paired with whom.

### Weekly Pulse

An anonymous weekly team check-in on one standing link. Responses come back as an average, a trend and a word cloud, never as individuals. — [human page](https://bitibybit.com/weekly-pulse/)

POST `/api/pulse`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `team` | `string` | optional | Optional. Trimmed, whitespace-collapsed, truncated to 60 characters. |
| `question` | `string` | optional | Optional. Trimmed and truncated to 120 characters. Falls back to "How was your week?". |
| `askWords` | `boolean` | optional | Optional, defaults to true. Only an explicit false turns it off. |

Example

```
{
  "team": "Platform team",
  "question": "How was your week?",
  "askWords": true
}
```

Errors

- `400` — A response is submitted with a score outside 1 to 5. “Pick a number from 1 to 5.”
- `429` — More than 20 creation requests from the same connection within the current clock hour.

**How people take part:** Everyone opens the same shared link and taps 1 to 5, optionally adding a few words. Nothing identifies a respondent: no account, no email, no cookie beyond this browser remembering it already answered this week. Score and comment are stored as separate rows so a phrase can never be tied to the number beside it. A week with fewer than four responses shows a count and nothing else — to the team and to the organiser alike, because there is no organiser view of responses at all. About six months of weeks are kept, dropped whole weeks at a time.

### Kudos Wall

A standing wall of short, signed thank-yous for a team. Notes roll over weekly and older weeks fold into an archive. — [human page](https://bitibybit.com/kudos-wall/)

POST `/api/kudos`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `team` | `string` | optional | Optional. Trimmed, whitespace-collapsed, truncated to 60 characters. |
| `intro` | `string` | optional | Optional. Trimmed and truncated to 300 characters. |

Example

```
{
  "team": "Platform team",
  "intro": "We read these out on Monday."
}
```

Errors

- `400` — A note is posted without a recipient. “Who's it for?”
- `400` — A note is posted without a message. “Add a line about what they did.”
- `400` — A note is posted without a sender. Notes are signed by design. “Put your name on it — an anonymous thank-you isn't worth much.”
- `429` — More than 20 creation requests from the same connection within the current clock hour.

**How people take part:** Anyone with the link posts a note: who it is for, what they did, and who it is from. All three are required — a note cannot be anonymous, because the name is what gives it value. The poster's browser keeps a token so they can take their own note down; the organiser can remove any note. This week's notes sit at the top and the previous six weeks fold into an archive. Anything older than about three months is dropped automatically, whole weeks at a time.

### Scrum Poker

Planning poker for a sprint team. Everyone picks a card privately, the facilitator reveals them all at once, and the summary names the high and the low rather than an average. — [human page](https://bitibybit.com/scrum-poker/)

POST `/api/poker`

| Field | Type |  | Rules |
| --- | --- | --- | --- |
| `team` | `string` | optional | Optional. Trimmed, whitespace-collapsed, truncated to 60 characters. |
| `story` | `string` | optional | Optional. Trimmed, whitespace-collapsed, truncated to 120 characters. |
| `deck` | `string` | optional | Optional. One of "fib" (1, 2, 3, 5, 8, 13, 21,?, coffee) or "tshirt" (XS to XXL,?, coffee). Anything else falls back to "fib". |

Example

```
undefined
```

Errors

- `400` — A vote names a card that is not in this board's deck. “That card isn't in this deck.”
- `400` — A vote arrives after the facilitator has revealed the round. “The cards are already on the table — wait for the next story.”
- `400` — The facilitator reveals a round in which nobody has voted. “Nobody has voted yet — nothing to turn over.”
- `409` — A 61st voter joins one board. “Sixty voters is the limit for one game.”
- `429` — More than 20 boards are created from one connection in an hour. “Steady on — too many requests from this connection. Give it a few minutes.”
