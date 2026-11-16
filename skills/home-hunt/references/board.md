# The board

One page, `assets/board.html`, filled with the profile, listings and the scorer by `hh.js board`. It has three views:
- **Board:** the lanes are Inbox (with sub-stages New, Deciding and To contact), Contacted, Viewing booked, Shortlist, Apply (Offer when buying) and No. Cards show the photo, live fit score and band, each person's stars, price, area, spec, the top deal-breaker or how many questions are open, the viewing time, cross-post count and price change. To link duplicates, drag a card and hold it over another for about a second, or hold Alt while you drop. Each lane scrolls on its own. On a phone, it's one lane per swipe with lane tabs.
- **Map:** an SVG plot of geocoded listings (pins carry their score), anchors and zone rings, plus a ranked list. It needs no map tiles, so it works under strict content policies.
- **Calendar:** a week of viewings, with viewings under 45 minutes apart marked as tight. Click an empty slot to book. On a phone it's an agenda.

Open a card to edit its facts (the score updates as you change them) and see the score breakdown, the "ask the agent" list, star ratings for each person, likely duplicates with one-tap linking, comments, notes and price history.

## Pick the backend for the host

| Host | Command | Where the data lives | Shared? |
|---|---|---|---|
| Claude Code or Cowork on their machine | `hh.js serve` (http://127.0.0.1:4173) | `listings.json`; the page saves straight to it | Their machine only |
| Any, as a read-only look | `hh.js board` → `board.html` | Embedded snapshot; edits stay in the browser until **Export changes**, then run `hh.js import <file>` | No |
| claude.ai, or anywhere the Artifact tool exists | `hh.js board --mode artifact --out <file>`, then publish | The artifact database | Yes: share the link and give the household **Editor** access |

Recommend the artifact board when the Artifact tool is available and more than one person is hunting: that's the shared, live board. Otherwise use `serve`, and tell them the trade-off: the board lives on this computer, and others can only get a snapshot whose edits don't sync back.

The board's header shows **Last scout** (time and how many were new, amber when it's over two days old), so people can see the scout is alive without asking.

## Artifact board

1. Build: `hh.js board --mode artifact --out board.html`.
2. Publish with the Artifact tool, declaring `capabilities: {db: {}, user: {}, assets: {}}`. Use icon `home` on the first publish.
3. Seed it: `hh.js docs <dir>` writes one JSON file per document plus `writes.json`. Pass those entries to the artifact data tool as batch writes, up to 50 per batch. The documents are `meta/profile` (the profile), `meta/lastRun` (the latest scout run, shown as "Last scout" on the board), `listings/<id>` and `comments/<id>`.
4. From then on, change data with data-tool writes (read the row, merge, write it back), not by republishing. Republish only when the page itself changes, and always to the same URL.
5. Photos: upload them as assets to the artifact URL and set `photo: "/_blob/<assetId>"`.
6. Save the board URL in `sources.json.board` (and in memory, if the host has it) so later runs update the same artifact.
7. Tell them to share it with the household as Editors. Viewers can look but can't change anything.

Never put the profile or listings into a public page or a public repo. Sharing goes through the artifact's own share settings, which are theirs to choose.

## Local board

- `hh.js serve` and leave it running. The page polls every 15 seconds and saves on every change. Photos you paste or upload go to `photos/`.
- `hh.js board` writes a snapshot you can open in any browser or attach to a message.
- Both read `profile.json` live, so a settings change shows up on the next refresh.
