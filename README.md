# biti by bit

**Small free tools for getting a group of people to do something.**

### → [bitibybit.com](https://bitibybit.com)

Twenty-two tiny no-signup utilities — make a thing, share one link, done.
No accounts, no email addresses, no app, no ads, no cookies, and nothing
for an administrator to approve.

A Kris Kringle that needs no email addresses, a potluck board that stops
six pavlovas and no salad, a meal train, a school fete roster, an office
sweep you can print for the fridge, and planning poker where nobody sees
a number before they commit their own.

Australian, and free. The site never handles money.

Cosy pixel aesthetic throughout: every icon and scene is generated from
declarative shapes by `scripts/gen-art.mjs` — no image editor involved.

## How it's built

| Layer | Choice |
|---|---|
| Hosting | Cloudflare Workers + Static Assets |
| Data | Cloudflare D1 (SQLite) |
| Frontend | Plain HTML/CSS/JS — no framework, no build step |
| Accounts | None. A secret organiser URL is the only credential |

One Worker, one database, every tool is a path. The `instances` table is
tool-agnostic (`tool_type` discriminates), so each new tool is a template
plus a handler, not a new stack.

```
public/                 static pages (the shelf, tool pages)
src/worker.js           dynamic routes: create/redraw/delete + share pages
migrations/             D1 schema
scripts/gen-art.mjs     generates all pixel art (icons, hero, OG images)
```

## Run it locally

```bash
npm install
npx wrangler d1 migrations apply bitbybit --local
npx wrangler dev
```

Regenerate the art after editing shapes: `npm run art`.

## Deploy

```bash
npx wrangler d1 create bitbybit        # paste the id into wrangler.jsonc
npx wrangler d1 migrations apply bitbybit --remote
npm run deploy
```

`npm run deploy` also runs `npm run indexnow`, which tells Bing, Yandex,
DuckDuckGo and friends which pages actually changed. Ownership is proved by
`public/<key>.txt` — no account, no secret; the key is public by design.
Only pages whose HTML hash moved are submitted, so a rebuild that changes
nothing sends nothing. Preview it with `npm run indexnow -- --dry-run`.

## Principles

- Free, no accounts, no tracking, no ads.
- The tool page *is* the tool — it works above the fold.
- Participants never hit friction; organisers get the extras.
- Shared pages are `noindex` — names in a sweep are nobody's SEO.
- If a tool ever retires, there'll be an export and fair warning.

## Licence

MIT — see [LICENSE](LICENSE).
