# The board

One page, `assets/board.html`, filled with the profile, listings and the scorer by `hermit.js board`. It has three views:
- **Board:** the lanes are Inbox (with sub-stages New, Deciding and To contact), Contacted, Viewing booked, Shortlist, Apply (Offer when buying) and No. Cards show the photo, live fit score and band, each person's stars, price, area, spec, the top deal-breaker or how many questions are open, the viewing time, cross-post count and price change. To link duplicates, drag a card and hold it over another for about a second, or hold Alt while you drop. Each lane scrolls on its own. On a phone, it's one lane per swipe with lane tabs.
- **Map:** an SVG plot of geocoded listings (pins carry their score), anchors and zone rings, plus a ranked list. It needs no map tiles, so it works under strict content policies.
- **Calendar:** a week of viewings, with viewings under 45 minutes apart marked as tight. Click an empty slot to book. On a phone it's an agenda.

Open a card to edit its facts (the score updates as you change them) and see the score breakdown, the "ask the agent" list, star ratings for each person, likely duplicates with one-tap linking, comments, notes and price history.

## Pick the backend for the host

| Host | Command | Where the data lives | Shared? |
|---|---|---|---|
| Claude Code or Cowork on their machine | `hermit.js serve` (http://127.0.0.1:4173) | `listings.json`; the page saves straight to it | Their machine only |
| Any, as a read-only look | `hermit.js board` → `board.html` | Embedded snapshot; edits stay in the browser until **Export changes**, then run `hermit.js import <file>` | No |
| claude.ai, or anywhere the Artifact tool exists | `hermit.js board --mode artifact --out <file>`, then publish | The artifact database | Yes: share the link and give the household **Editor** access |

**The shared artifact board is the default whenever the Artifact tool exists**, even for one person: a partner, family member or friend can be added later without moving anything. Use `serve` only when there's no Artifact tool, and tell them the trade-off: the board lives on this computer, and others can only get a snapshot whose edits don't sync back.

## Built for sharing

A home hunt is rarely one person's call. The board is designed so the household works from **one link that never changes**, instead of forwarding listings back and forth:
- **One permanent link.** Every scout writes new listings into the same board. Nobody needs a new link, a new file or a forwarded listing. Bookmark it once.
- **Who's looking.** The first time someone opens it, the board asks "Who are you?" (the people in `household.people`, plus "Someone helping" for a friend or parent). Stars, comments and moves carry their name. On the artifact board this is remembered per signed-in account in `meta/members`; locally, per browser.
- **What's new since you last looked.** Cards someone *else* added, moved, rated or commented on since your last visit get a **New** or **Updated** tag and a line like "Sam moved it to Shortlist · 2 h ago". A header chip filters to just those. Each person has their own "last looked", so it works however often each of you checks.
- **Activity.** Each card's detail keeps its last changes (who, what, when).
- **Helpers.** People with `role: "helper"` in `household.people` (a parent, a friend who knows the area) can comment and move cards, but don't get a star rating, so the household's ratings stay the household's.
- **Share panel.** The **Share** button explains how to invite someone and shows who has joined.

The scout's report always ends with the same board link, so the person can paste it once into the family chat and never again.

The board's header shows **Last scout** (time and how many were new, amber when it's over two days old), so people can see the scout is alive without asking.

## Artifact board

1. Build: `hermit.js board --mode artifact --out board.html`.
2. Publish with the Artifact tool, declaring `capabilities: {db: {}, user: {scopes: ["profile"]}, assets: {}}`. The `profile` scope lets the board show the names of helpers who join with their own account. Use icon `home` on the first publish.
3. Seed it: `hermit.js docs <dir>` writes one JSON file per document plus `writes.json`. Pass those entries to the artifact data tool as batch writes, up to 50 per batch. The documents are `meta/profile` (the profile), `meta/lastRun` (the latest scout run, shown as "Last scout"), `meta/share` (`{url}`, the board's own link, shown in the Share panel), `listings/<id>` and `comments/<id>`. Pass `--url <board url>` to fill `meta/share`; on the first publish, write `meta/share` once the URL is known.
4. The board writes these itself, so never overwrite them: `meta/members` (which signed-in account is which person) and `data/users/<uid>/seen` (each person's last visit).
5. From then on, change data with data-tool writes (read the row, merge, write it back), not by republishing. Republish only when the page itself changes, and always to the same URL, so the link people bookmarked keeps working. When the scout changes a listing, set `lastChange: {by: "scout", at, what}` so people see "Scout marked it taken".
6. Photos: upload them as assets to the artifact URL and set `photo: "/_blob/<assetId>"`.
7. Save the board URL in `sources.json.board` (and in memory, if the host has it) so later runs update the same artifact.
8. **Invite the household** (setup asks who): tell them, in one message they can follow, "Open the board → Share (top right) → add each person's email → set them to **Can edit** → send. They sign in once; after that it's the same link forever." Viewers can look but can't change anything, and the board tells them so.

Never put the profile or listings into a public page or a public repo. Sharing goes through the artifact's own share settings, which are theirs to choose. Anyone invited sees everything on the board, including the budget.

## Local board

- `hermit.js serve` and leave it running. The page polls every 15 seconds and saves on every change. Photos you paste or upload go to `photos/`.
- `hermit.js board` writes a snapshot you can open in any browser or attach to a message.
- Both read `profile.json` live, so a settings change shows up on the next refresh.
