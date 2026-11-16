# Scoring

`scripts/score.js` → `scoreListing(listing, profile)` returns `{score, band, parts, gates, flags, ask, info, confidence}`. The CLI, the board and your own checks all call this same function, so they always agree.

## How a score is built

1. Each **part** returns a fraction, 0–1, of its weight. Weights are normalised to 100 after parts that don't apply drop out: pets when there are no pets, criteria set to `ignore`, and `nearby` when it's empty.
2. **Unknown facts** get a neutral-low fraction (about 0.3–0.5) and add a question to `ask`. A listing with thin facts lands in maybe, never strong and never no-fit.
3. **Caps:** fewer bathrooms than the minimum caps the score at `bands.good − 8`, and an area's `valueMax` caps it at `bands.good − 1`. Override either with `profile.caps.bathsBelowMin` or `overValueMax`.
4. **Gates** (deal-breakers) cap the score at 39 and set the band to `no-fit`, whatever the points say.
5. **Bands:** strong ≥ 85, good ≥ 72, maybe ≥ 58, otherwise weak. These can be changed in `profile.bands`.
6. `confidence` is the share of weight backed by known facts. The board shows it, and a 90 at 50% confidence is mostly hope.

| Part | Default weight | Full marks when | Gate when |
|---|---|---|---|
| location | 20 | tier-1 area **and** close to every anchor (average of the two when coordinates exist) | area excluded; outside a zone; over an anchor's `hard` max |
| price | 18 | ≤ `budget.ideal`; falls linearly to 0.4 at `budget.max` | over `budget.max` |
| pets | 10 | `yes` | `no`; `small_only` with medium or large animals; `cats_only` with dogs |
| outdoor | 10 | `large` | `none` when outdoor is `must` |
| entertain | 5 | `covered_patio_bbq` | `none` when entertain is `must` |
| layout | 15 | beds = ideal, baths ≥ ideal, size ≥ ideal (size counts only if set) | beds below the minimum |
| type | 8 | first preferred type (each later preferred type gets −0.08) | type excluded |
| nearby | 6 | each nearby item within `idealKm` walking | none |
| timing | 5 | available between `earliest` and `latest` | after `hardLatest` |
| features | 3 | every `nice` feature present | a `must` feature confirmed absent |

Buy mode adds a repayment check to price: monthly repayment plus levies and rates, against `finance.maxShare` of income (`buying.md`).

## Profile schema (`profile.json`)

```jsonc
{
  "version": 1, "title": "Riverside Rental Hunt",   // title is the board's name: make it theirs
  "mode": "rent",                       // rent | buy
  "country": "US", "currency": "USD", "locale": "en-US",
  "units": "imperial",                  // metric | imperial: display only, data is always km and m²
  "household": { "people": [{ "id": "a", "name": "Alex" }, { "id": "s", "name": "Sam" }, { "id": "jo", "name": "Jo", "role": "helper" }], "pets": [{ "kind": "dog", "size": "medium", "count": 2 }] },   // role "helper": comments and moves cards, no star rating
  "budget": { "ideal": 2300, "max": 2600 },          // rent per period the portals use; buy = price
  "finance": { "monthlyNetIncome": null, "deposit": null, "ratePct": null, "termYears": 20, "maxShare": 0.3 },
  "moveIn": { "earliest": "2027-03-01", "latest": "2027-04-01", "hardLatest": "2027-04-30" },
  "areas": [
    { "name": "Riverside", "tier": 1, "aliases": ["Riverside East"] },
    { "name": "Hillcrest", "tier": 4, "valueMax": 2200,
      "zone": { "label": "the edge next to Parkside", "center": [45.535, 10.03], "radiusKm": 1.0 } }  // or "bbox": [s, w, n, e]
  ],
  "tiers": { "1": 1, "2": 0.8, "3": 0.6, "4": 0.5, "5": 0.3 },   // optional: fraction of location points per tier
  "excludeAreas": ["Northgate"],
  "outsideAreas": "score-zero",          // or "gate"
  "anchors": [{ "id": "work-a", "label": "Alex's office", "lat": 0, "lng": 0, "idealKm": 8, "maxKm": 20, "weight": 2, "hard": false }],
  "nearby": [{ "id": "park", "label": "a park", "idealKm": 1, "maxKm": 3 }],
  "requirements": {
    "types": { "preferred": ["house", "townhouse"], "acceptable": ["duplex"], "excluded": ["apartment"] },
    "beds": { "min": 2, "ideal": 3, "overOk": false }, "baths": { "min": 2, "ideal": 2 }, "sizeM2": { "min": 90, "ideal": 130 },
    "outdoor": "must", "entertain": "nice",       // must | nice | ignore
    "features": { "backupPower": "nice", "furnished": "avoid" }   // must | nice | avoid
  },
  "weights": { "location": 20, "price": 18, "pets": 10, "outdoor": 10, "entertain": 5, "layout": 15, "type": 8, "nearby": 6, "timing": 5, "features": 3 },
  "bands": { "strong": 85, "good": 72, "maybe": 58 },
  "caps": { "bathsBelowMin": 64, "overValueMax": 71 },
  "calibration": { "liked": ["id"], "disliked": ["id"], "notes": "" }
}
```

## Fact values

- `pets`: yes · permission · likely · unknown · small_only · cats_only · no
- `outdoor`: large · private · small · communal · none · unknown
- `entertain`: covered_patio_bbq · private_pool · covered_patio · open_patio · balcony · shared_pool · none · unknown
- `features.<key>`: true · false · (missing = unknown). Keys: backupPower, fibre, security, parking2, pool, study, furnished, aircon, lift, laundry, storage, ev, solar, schoolZone
- `nearby.<id>`: walking km
- `commuteKm.<anchorId>`: road km, which overrides the straight-line estimate
- `subArea`: near · far (overrides the zone test). `realArea`: the correct area name when the portal mislabels it
- `available`: ISO date, or "now"
- buy: `levies`, `rates` (monthly)
- rent: `utilitiesIncluded` (bool), `extraMonthly` (number)

## Tuning: `settings calibrate`

When the scores feel wrong, don't hand-edit numbers at random:
1. Ask which listing is scored wrong, and which way.
2. Run `hermit.js score <id> --explain` and find the part responsible.
3. Fix the cause: a missing gate, a wrong tier or zone, a weight, or a wrong fact on the listing (that's the most common cause).
4. Re-score all the calibration listings. The fix mustn't break the ones that were already right.
5. Report the before and after in one line each.
