# Privacy

What is stored, and what isn't

Short version: there are no accounts, no email addresses are collected from anyone, there are no ads, and nothing is sold or shared. The longer version is below, including the parts that are a trade-off rather than a win.

## There are no accounts

Not for the person who makes something, and not for anyone who uses it. Nobody signs up, nobody sets a password, and no email address is asked for or stored anywhere in any of the tools. This is the whole design, not a setting — there is no user table to leak because there are no users.

## What gets stored when you make something

Whatever you type in. If you make a volunteer roster, that is the shift labels, the times and the number of spots. If people then claim a slot, it is the name they typed. A meal train stores the dates and the dietary note you wrote. A Kris Kringle stores the list of names and who drew whom.

That sits in a database on Cloudflare's network. It is not sent anywhere else, not sold, not used to train anything, and not looked at except when something is broken and needs fixing.

## Who can see it — this is the trade-off

Anyone with the link. There are no accounts, so there is nothing to log in to and no permissions to set. The link *is* the credential, and it is a long random one that will not be guessed, but if it is forwarded on then whoever receives it can see the page.

That is the same exposure as a roster pinned to a clubhouse noticeboard, and it is worth thinking about before you put anything sensitive on one. The organiser's link — the one with `/e/` in it — is the more powerful of the two, because it can edit and delete. Treat that one as yours.

Some tools deliberately keep things private within a shared page: a Kris Kringle draw is only visible to the person who claimed that name, and a weekly pulse response cannot be traced back to the person who left it. Where that applies, the tool's own page says so.

## Cookies and tracking

**Shared pages set no cookies and make no third-party requests at all.** That is every `/s/`, `/e/` and `/p/` page — the ones an ordinary participant actually opens. Nothing is loaded from any other company, so nobody else learns you were there.

The public pages — this one, the homepage, the tool descriptions — load one script: Cloudflare Web Analytics. It counts page views in aggregate. It sets no cookies, does not fingerprint the browser, and does not follow anyone between sites. It is there so it is possible to tell whether anything is being used at all.

There are no advertising trackers, no Google Analytics, no Meta pixel, no session recording and no A/B testing scripts.

## What your browser remembers

Some tools keep a small note in your own browser's local storage — a list of things you have made, so you can find them again, and which slots on a board are yours, so you can change your mind. That never leaves your device and is not readable by this site's server. Clearing your browser data clears it, and the only thing you lose is the convenience.

## How long it stays

Honestly: mostly until someone deletes it. There is no scheduled cleanup that removes old boards, so a sweep from last September is probably still sitting there.

A few tools prune themselves because they are designed to roll over — a kudos wall drops notes older than about three months, and a scrum poker board only keeps the last few rounds of votes. Those are stated on the tool's own page. Everything else stays until it is deleted.

## Deleting something

Open the organiser link — the `/e/` one you got when you made it — and there is a delete button at the bottom. It removes the board and everything on it, and the shared link stops working for everyone immediately. It is not recoverable, which is the point.

If you have lost the organiser link and want something removed, email [hello@bitibybit.com](mailto:hello@bitibybit.com) with the shared link and it will be dealt with.

## Money

The site never handles money. Where a tool involves money at all — the gift registry, a kitty note on a hens planner — it shows the organiser's own payment details so people can pay them directly. Nothing goes through here, and no payment details are stored.

The tools are free. Some may later carry a one-off charge of a few dollars; if that happens, anything already made keeps working.

## Changes, and who to ask

If any of this changes it will change on this page, and the site is open source at [GitHub](https://github.com/furling-com-au/bitbybit), so the claims above can be checked against the code rather than taken on trust.

Questions: [hello@bitibybit.com](mailto:hello@bitibybit.com).
