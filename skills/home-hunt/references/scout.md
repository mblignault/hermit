# Scout: one run

The scheduled job and the `scout` command both run this. It's also the procedure for `add`, steps 4–7. Work in order, keep a tally for the report, and stay inside the fetch budget (`sources.md` §7).

Post a short progress checklist if the host shows one: load, inputs, sweep, verify, score and add, delistings, report.

## 1. Load

`hh.js status` and `hh.js list --active`. Note the current board ids, every `url` and `links[].url`, and the cross-post fingerprints (complex, address, price, beds) so you can recognise listings you've already seen.

## 2. Extra inputs (if connected)

- **Email alerts and enquiry receipts** since the last run (`runs.jsonl` has the last `at`). Alerts give you candidate links. Receipts tell you a listing the user enquired about, so set it to `contacted`, adding it first if it's missing.
- Anything the user dropped in chat since the last run.

## 3. Sweep

If no source is readable (every one is `blocked`, or needs a browser or inbox you can't reach this run), stop here and report it in one line with what would fix it. Don't log it as a quiet day.

For each enabled source with `access: fetch` (or `browser`, if approved and reachable), and each area in tiers 1–4, read the search pages for their mode, plus page 2 if page 1 was full of new stock. Collect candidates: link, price, area, beds and type from the card.

Throw out a candidate straight away, and don't spend a fetch on it, if it is:
- already on the board, by id, URL or an obvious cross-post
- over `budget.max` by more than 5% (keep near-misses: prices drop)
- in `excludeAreas`, or a property type in `types.excluded`
- fewer beds than `beds.min`

## 4. Read each candidate

Open the **detail page**. That's golden rule 1. Extract:
- `price`, `area` (as the portal states it), `address`, `complex`, `lat`/`lng` (geocode, `sources.md` §5), `type`, `beds`, `baths`, `parking`, `sizeM2`, `available`
- `agent {name, phone, agency}`, `url`, `source`, `photo` or `photoSrc`
- **facts:** `pets`, `outdoor`, `entertain`, `features`, `nearby` (walking km to their nearby items, when you can tell), `realArea` if the portal's suburb is wrong, `subArea` if they have a zone there and the address settles it, `utilitiesIncluded`, and `levies`/`rates` for buying

Fact extraction rules:
- **Tags first, then the description, then photos.** Write where each fact came from in `factSource` (`tag`, `description`, `photo`, `agent`, `inferred`).
- **Pets.** "Pet friendly" means `yes`. "Pets on application" or "by arrangement" means `permission`. "Small pets", "small dog" or "cats only" means `small_only` or `cats_only`. "No pets" means `no`. Garden photos plus a freestanding house, with nothing said, mean `likely`. Otherwise `unknown`.
- **Outdoor.** "Private garden" or a garden visible in a photo of this unit means `private`. "Large" or "big garden" means `large`. "Courtyard" or a small patch means `small`. "Complex gardens" means `communal`. An upper-floor unit with no garden mentioned means `none`.
- **Entertain.** A covered patio with a barbecue or built-in grill (braai, asado, BBQ) means `covered_patio_bbq`. A private pool means `private_pool`, and so on (`scoring.md`).
- **Don't upgrade an unknown to a yes.** It's better to ask than to invent.

Now verify it's live (`sources.md` §4). A **new** candidate that isn't confirmed live doesn't go on the board: delisted ones are dropped, and ones that errored are listed in the report and retried next run.

## 5. Check, then add

Write the candidate to a temp file and run `hh.js check <file>`. It returns the score, deal-breakers and `possibleDuplicates` **without writing anything**.
- **Deal-breaker (band `no-fit`):** don't add it. Mention it in the report only if the deal-breaker is the user's call to make (an otherwise perfect place that says "small pets only").
- **Possible duplicate ≥ 0.7** against a board card: compare the photos, complex, street, size and agent (below).
- Otherwise `hh.js add <file>`.

For a likely duplicate:
- **Same property:** keep the better listing as the primary. Prefer the one already being discussed, otherwise the cheaper or the one with more detail. Set `dupOf` on the new one before `add` (or `hh.js set <id> dupOf=<primary>` if it's the existing card that should step back). If the cross-post is cheaper, note it on the primary.
- **Different unit in the same complex:** leave both, and say so in the notes.

## 6. Score

`hh.js score <id> --explain` for each new card, for the report. The board computes the same scores live, so never write the score into the listing. New cards land in `status: inbox, stage: new`.

## 7. Photos

Attach a cover photo for every new card (`sources.md` §6). If that's not possible now, say how many are pending.

## 8. Delistings and changes (also the `verify` command)

With the budget that's left, re-open the detail pages of active cards, oldest `verify.at` first. One rule for existing cards:
- **Delisted** (positive evidence: 404/410, "no longer available", archive redirect): set `taken: true` and `verify.state: delisted`. Move it to `no` only if it's still in the Inbox; anywhere further along, leave it where it is and flag it in the report.
- **Errored or timed out:** `verify.state: unverified`. It stays where it is. Retry next run, and don't call it taken.
- **Live:** `verify.state: live` and update `verify.at`.
- Price changed: `hh.js set <id> price=<new>` records `priceHistory`. Report drops especially.
- A listing marked taken that's still live: tell them. It may be worth a nudge to the agent.

## 9. Refresh the board

Local: `hh.js board`, or nothing if `serve` is running, since it reads live. Artifact: the rows are already written; republish only if the page template changed.

## 10. Log and report

Report to wherever `sources.json.schedule.reportTo` says (the chat, a project, or `scout.log` for cron). New listings are already on the board.

Artifact board: also write the same record to `meta/lastRun` with the data tool, so the board shows it.

`hh.js runlog '{"added":N,"updated":N,"checked":N,"delisted":N,"unverified":N,"sources":[...],"budgetUsed":N}'`

Then post the report. On a **quiet day**, one line: "Scout ran, nothing new: 3 sites, 7 areas, 42 listings checked, nothing delisted. [Board]".

Otherwise:
- "N new on the board" + link
- One line per new card, best first: **price · area · score (band):** the 2–3 facts that matter, plus the top open question
- Price drops, delistings that affect cards in progress, and live listings marked taken
- Skipped near-misses worth a look, each with the one reason ("perfect but only small pets")
- Unverified, carried over or photo-pending listings, in one line

No preamble, and no list of everything checked.

**Dry spells:** after 3 runs in a row with no new candidates (`runs.jsonl`), add one line suggesting what to widen: the area list, the budget max, the types, or another site.
