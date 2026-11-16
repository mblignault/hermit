# Listing record

`listings.json` = `{ "listings": [Listing], "comments": [Comment] }`. The artifact board uses the same shapes, in `listings/<id>` and `comments/<id>`.

```jsonc
{
  "id": "ep-123456",                    // <source idPrefix>-<the site's own listing number>; stable, never reused
  "source": "ExamplePortal",
  "url": "https://…",             // the detail page you verified
  "links": [{ "url": "…", "label": "Agency site" }],
  "status": "inbox",              // inbox | contacted | viewing | shortlist | apply | no
  "stage": "new",                 // inbox only: new | deciding | tocontact
  "taken": false,                 // no longer available: greyed; moved to "no" only if still in the Inbox
  "dupOf": "",                    // id of the primary card when this is a cross-post
  "verify": { "state": "live", "at": "2027-02-01", "note": "" },   // live | unverified | delisted

  "price": 21500, "priceHistory": [{ "at": "2027-02-03", "from": 22500, "to": 21500 }],
  "area": "Riverside",            // as the portal states it
  "address": "12 Willow Lane", "complex": "Willow Mews",
  "lat": 45.505, "lng": 10.03,
  "type": "townhouse",            // house | gated_house | cluster | townhouse | semi | cottage | duplex | apartment | studio | room
  "beds": 3, "baths": 2, "parking": 2, "sizeM2": 140,

  "facts": {                      // what the score is built from; see scoring.md for values
    "pets": "yes", "outdoor": "private", "entertain": "covered_patio_bbq",
    "features": { "fibre": true }, "nearby": { "local": 0.7 }, "commuteKm": {},
    "available": "2027-03-01", "realArea": "", "subArea": "",
    "utilitiesIncluded": true, "levies": null, "rates": null
  },
  "factSource": { "pets": "description", "outdoor": "photo" },

  "agent": { "name": "", "phone": "", "email": "", "agency": "" },
  "viewingAt": "2027-02-20T10:00",   // local time, no zone
  "ratings": { "a": 4, "b": 3 },     // per household person id, 1-5; 0 = cleared
  "notes": "",
  "photo": "/photos/ep-123456.jpg",   // or "/_blob/<assetId>" on the artifact board
  "photoSrc": "https://…",               // remote image to backfill later
  "createdAt": 0, "updatedAt": 0,
  "addedBy": "scout",                    // person id, "u:<account>" for a helper, or "scout"
  "lastChange": { "by": "b", "at": 0, "what": "moved it to Shortlist" },  // drives "New / Updated since you last looked"
  "log": [{ "by": "b", "at": 0, "what": "moved it to Shortlist" }]          // last 20 changes; the board keeps it
}
```

Comment: `{ "id", "listingId", "by": "<person id or u:<account>>", "text", "at": <ms> }`

When the scout adds or changes a listing, set `addedBy: "scout"` or `lastChange: {by: "scout", at, what}` (for example "marked it taken", "dropped the price"), and append the same to `log`. The board does this itself for people's edits.

Never add `score` or `band` fields: they'd go stale.
