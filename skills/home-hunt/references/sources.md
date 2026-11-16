# Sources: finding, testing and reading listing sites

## 1. Access methods, best first

| Method | What it means | When |
|---|---|---|
| `fetch` | Your web-fetch tool (or `hh.js probe`) reads search and detail pages | The site serves listing HTML to normal requests |
| `browser` | Read pages through the user's own browser, with a browser or computer-use tool on their device, or a remote session on their machine | The site renders listings with JavaScript or blocks cloud machines but works for a person. **Ask the user first, every time it's new.** |
| `alerts` | Read the portal's email alerts and enquiry receipts in their inbox (with a mail connector) | The site can't be read directly. Treat alerts as an extra input, not the source. |
| `manual` | They paste a link, text or screenshot, and you do the rest | Logged-in or private sources such as Facebook groups and Marketplace, WhatsApp groups and closed portals |
| `blocked` | Nothing works | Say so and move on |

Same site, different places: a site blocked from a cloud sandbox often works from the user's own machine, through `hh.js probe` in a local Claude Code session or through their browser. Record which path works in `sources.json` (`access`, `via`).

## 2. Proposing sites

1. Load `countries/<code>.json`. Use `portals` with `role: primary` first, then `agency` sites for their areas, then `classifieds`. If there's no pack for their country, search the web for "<city> houses to rent" (or "for sale") and list the top portals and agencies that appear repeatedly.
2. Ask what they already use. Locals know the one site everybody checks.
3. Prefer **coverage over count.** Two primary portals plus the 2–3 agencies that dominate their areas beat ten mirrors of the same feed. Private-landlord and agency-only listings are where listings nobody else sees come from.

## 3. Reachability test (setup and `sources test`)

For each site:
1. Find a real search URL for one of their areas and their mode (rent or buy). Use the pack's `searchUrl` hint, or open the homepage and follow the navigation. Don't invent URL patterns.
2. Read it with your fetch tool. In a local session also run `hh.js probe <url>`, which reports status, final URL, bot-wall markers, price and listing-link counts, archive markers and a verdict.
3. Classify it:
   - **readable:** you can see listing cards with prices and links, so open one detail page too. If both work, set `access: fetch`.
   - **loads but empty:** the page is probably built by JavaScript. Try the site's mobile domain or a mirror the pack lists. Otherwise set `access: browser`, with their approval.
   - **blocked:** a 403, a captcha or a "verify you are human" page. Don't retry with tricks. Set `access: browser`, `alerts`, `manual` or `blocked`.
   - **errors:** some portals throw server errors at automated readers on some pages and not others. Try 2–3 different pages before deciding, and note it as a quirk.
4. Record, for each source: `{name, domain, role, access, via, searchUrls: {<area>: url}, detailPattern, idPattern, idPrefix, quirks: [], lastTest: {at, verdict}}`. `idPrefix` makes listing ids, such as `p24-117000000` or `rm-123456`.
5. Paging: note how page 2 is addressed (`?page=2` and so on). Many portals ignore price filters in the URL, so filter by hand after reading.

## 4. Verifying a listing is live (golden rules 1–2)

Open the listing's **own** page. It's live only when all of these hold:
- It shows a price and the description.
- There's no "Let", "Rented", "Sold", "Under offer", "Let agreed", "SSTC" or "no longer available" badge.
- The final URL still contains the listing id. Some portals redirect archived listings to a search page with an `archiveId`-style parameter and return HTTP 200.
- The availability date isn't months in the past. "Available now (since June)" in November usually means stale stock.

Record `verify: {state: "live" | "unverified" | "delisted", at, note}`:
- `delisted` takes positive evidence: a 404 or 410, "no longer available", or an archive redirect. Mark the listing `taken: true` and move it to `no` only if the user hasn't started a conversation about it. If they have, flag it to them instead.
- `unverified`: the page errored or timed out. Keep it off the board, list it in the report, and retry next run.
- In `verify` sweeps, a fast route in the user's browser is to run `fetch()` on each same-site path from an open tab of that site and read `status` plus the final `url`.

## 5. Geocoding and distances

- Geocode addresses and anchors with the ArcGIS World Geocoder, which is readable from most sandboxes without a key:
  `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=<address>&f=json&maxLocations=1`
  Take `candidates[0].location.y` as lat and `.x` as lng. Nominatim, Photon and Overpass usually refuse automated use.
- If a listing has no street address, use the complex or estate name plus the suburb. If that fails, leave lat and lng empty: the scorer then uses the area tier only and asks for the address.
- `hh.js geo a b` gives straight-line km and an estimated road km (×1.3). If you can get a real travel time or distance, store it in `facts.commuteKm[anchorId]`, which overrides the estimate.

## 6. Photos

Boards look and work better with a cover photo on every card.
- **Local board (`serve`):** download the listing's main image (the og:image or the first gallery image) and post it to the board, or save it to `photos/<id>.jpg` and set `photo`.
- **Artifact board:** artifact pages can't load images from other sites, so the photo has to be uploaded as an artifact asset and the asset path stored in `photo`. If your sandbox can't download from the image CDN, try the user's browser (draw the image on a canvas, export a JPEG data URL, and upload that). Otherwise leave `photoSrc` on the row for a later backfill, and tell them they can paste a photo into the card.
- Crop to fill the frame. Some portals serve small letterboxed images, so check before uploading.

## 7. Budget and politeness

- `sources.json.fetchBudgetPerRun` caps reads per scout (default 60). Spend it in this order: new search pages, then detail pages of plausible candidates, then delisting checks on active cards, oldest-verified first. Carry anything left over to the next run and say so.
- One request at a time per site. Never run several agents against the same site at once.
- Never log in on their behalf, solve captchas, rotate identities or ignore a site's terms. If a source needs any of that, it's `manual`.
