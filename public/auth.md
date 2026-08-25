# auth.md

How an AI agent registers with `bitibybit.com` and obtains a credential, on
behalf of a user.

**Short version: registration is anonymous and takes one request.** There are no
user accounts, no API keys, no OAuth, no client registration and no bearer
headers. Registering a resource *is* the provisioning step: you POST to a
registration endpoint, and the response hands you the credentials for the thing
you just created.

There is no authorization server, so `/.well-known/oauth-protected-resource` and
`/.well-known/oauth-authorization-server` do not exist and return 404. That is
deliberate, not an omission. This document is self-contained and describes the
complete auth model.

| | |
|---|---|
| Identity types supported | `anonymous` |
| Credential types supported | `capability_url` (an opaque token carried in the URL path) |
| Registration | Unauthenticated POST to any registration endpoint below |
| Claim ceremony | Not required. Optional handover is described in Step 3. |
| Revocation | Supported — see Step 4 |

---

## Step 1 — Register (provision an instance)

Pick the endpoint for the kind of thing the user asked for and POST a JSON body.
No authentication, no headers beyond `Content-Type`. Every one of these is a
registration endpoint:

```
POST /api/sweeps
POST /api/kringle
POST /api/roles
POST /api/plate
POST /api/bracket
POST /api/card
POST /api/registry
POST /api/fact
POST /api/baby
POST /api/roster
POST /api/meal
POST /api/poll
POST /api/recipe
POST /api/giftidea
POST /api/hens
POST /api/qotd
POST /api/coffee
POST /api/pulse
POST /api/kudos
POST /api/poker
```

The request body differs per endpoint. The full field list, limits and a working
example for each are in the OpenAPI description:

- **OpenAPI:** <https://bitibybit.com/openapi.json>
- **API catalog:** <https://bitibybit.com/.well-known/api-catalog> (RFC 9727)
- **Human docs:** <https://bitibybit.com/api-docs/>

Example registration:

```
POST /api/kringle
Content-Type: application/json

{"names": ["Priya", "Tom", "Meredith", "Jules"], "budget": "$30"}
```

The response is your credential:

```json
{
  "slug": "lucky-wombat-4kq2m9xrbt7vec",
  "editToken": "h3n8pquzr4wmd2fkjt6xayb95s"
}
```

Both values are opaque random strings from a 31-character alphabet, generated
with a cryptographic RNG. `editToken` is 26 characters (~129 bits of entropy);
`slug` carries a 14-character random tail (~69 bits). Neither encodes anything
and neither can be derived from the other.

## Step 2 — Use the credential

Put the credential in the URL path. There is no `Authorization` header and no
bearer scheme, because there is no identity to assert.

```
GET /e/h3n8pquzr4wmd2fkjt6xayb95s
POST /api/kringle/h3n8pquzr4wmd2fkjt6xayb95s/redraw
```

Possession of the URL is the entire authorisation. The two credentials grant
different things:

| Credential | URL | Grants |
|---|---|---|
| `editToken` | `/e/{editToken}` | Full organiser control: edit, reset, redraw, export, delete |
| `slug` | `/s/{slug}` | Read the shared page and take part |

A third credential type exists for tools where each person gets a private view —
a drawn name, a secret role. Those participant tokens are 22 characters and live
at `/p/{token}`. They are issued by the tool's own claim endpoint when a person
claims their place, not at registration.

Treat `editToken` the way you would treat an API key. Never put it anywhere an
unrelated party can read it. These pages are served `noindex` with
`Referrer-Policy: same-origin`, so the token cannot leak through a `Referer`
header when someone follows a link off the page.

## Step 3 — Handover (optional)

There is no claim ceremony, because there is no account to bind a credential to.
To hand control to a human, give them the `/e/{editToken}` URL — that is the
entire transfer. To let people take part without giving them control, give them
`/s/{slug}` instead.

An agent registering something on a person's behalf should return **both** URLs
to that person, and should retain neither.

## Step 4 — Revocation

Deletion is the revocation primitive. It is immediate, unconditional and
permanent: the instance and every claim and participant attached to it are
removed, and every credential pointing at them stops resolving.

```
POST /api/{tool}/{editToken}/delete
```

There is no soft delete, no archive and no recovery. Anyone holding the
`editToken` can do this, so an agent must not do it unless the user explicitly
asks.

Individual participant credentials can be rotated without destroying the
instance. For example:

```
POST /api/kringle/{editToken}/reset
```

with `{"name": "..."}` issues that one person a fresh token and invalidates
their old one.

## Errors

| Status | Meaning |
|---|---|
| `400` | Validation failed. The `error` string is written for humans — surface it to the user. |
| `404` | Unknown credential, or unknown resource. Also returned when a valid credential is used against the wrong tool. |
| `409` | Someone else took that slot first. Re-read the current state before retrying. |
| `429` | Rate limited. |

There is no `401` and no `403`. A missing credential and an invalid credential
are deliberately indistinguishable — both are `404`.

## Rate limits

Enforced per client IP, per clock hour:

- **20** requests/hour to registration endpoints
- **900** requests/hour to `POST /api/poker/vote`
- **240** requests/hour to every other `POST /api/` endpoint

Scrum poker has its own budget because a whole team sizing stories for half an
hour is a burst, and a co-located team is one IP behind the office NAT — ten
people on fifteen stories comes to roughly 255 requests in an hour, which the
shared 240 used to cut off mid-meeting.

Over the limit returns `429` with a JSON `error`. There is no key that raises
these and no way to request an exemption. Back off rather than retrying hard.

## What agents should not do

- **Do not crawl or enumerate `/s/`, `/e/` or `/p/`.** These are private links
  someone shared with their own group. `robots.txt` disallows all three for every
  user-agent.
- **Do not guess credentials.** The keyspace makes it futile, and traffic that
  looks like it is trying will be treated as abuse.
- **Do not publish an `editToken`** anywhere the user did not ask you to put it.
- **Do not register speculatively.** Each registration is a real row in a real
  database. Register when a person actually asks for something.

## Audience and related documents

This file is for software agents acting on behalf of a person — "set up a Kris
Kringle for my team", "start a meal train for my neighbour". It is not for
crawlers. Crawling rules are in [`/robots.txt`](https://bitibybit.com/robots.txt);
a plain-language index of the site is at
[`/llms.txt`](https://bitibybit.com/llms.txt).

Source: <https://github.com/furling-com-au/bitbybit>
