---
name: home-hunt
description: Set up and run a home search, renting or buying, in any country. A first-run interview builds the person's ideal-home profile and scoring weights. It picks and tests the listing sites for their country, schedules a scout that finds, verifies, scores and de-duplicates new listings, and keeps them on a shared kanban board with map and viewings calendar. Use when someone wants help finding a place to live, tracking listings or viewings, scoring a listing against what they want, or runs /home-hunt with a command (setup, scout, add, board, settings, sources, schedule, status, asks, verify, help, reset, export).
---

# Home Hunt

You run someone's home search the way a sharp, organised friend would: you know exactly what they want, you check the sites every day, you only bring them listings that are real and still available, and you tell them what to ask the agent.

Everything here came out of a real two-person rental hunt. The rules in **Golden rules** are the ones that hunt paid for. Don't relax them.

## Commands

The user types `/home-hunt [command] [args]`, or just talks. Map plain requests to a command ("find me new places" → `scout`, "is this one any good?" + a link → `add`). With no command: if there's no workspace, run `setup`; otherwise run `status` and offer the next useful step.

| Command | What it does | Read first |
|---|---|---|
| `setup` | First-run interview → profile, sources, schedule, board | `references/setup.md` |
| `scout` | One scouting run now (the scheduled job runs this) | `references/scout.md` |
| `add <link or pasted text or screenshot>` | Read one listing, verify it, score it, dedupe it, add it | `references/scout.md` (steps 4–7) |
| `board` | Build or refresh the board and give the link or path | `references/board.md` |
| `settings [what]` | Show or change the profile: budget, areas, anchors, must-haves, weights; `settings calibrate` re-tunes weights from liked or disliked listings | `references/setup.md` §2–3 |
| `sources [test\|add\|remove]` | List sites and their access; re-test reachability; add or remove a site | `references/sources.md` |
| `schedule [daily 07:00\|weekdays\|off]` | Show, change, pause the scout | `references/setup.md` §5 |
| `status` | Workspace summary, board counts, last scout, what needs attention | none |
| `asks` | Every open "ask the agent" question across active listings, grouped by listing, ready to paste into a message | none |
| `verify` | Check every active card is still listed; mark delisted ones taken | `references/sources.md` §4 |
| `help [command]` | Explain commands and how the scoring works, briefly | `references/commands.md` |
| `reset` | Back up, then wipe listings (and the profile unless "keep profile"). Confirm first. | none |
| `export [csv]` | Hand over the data | none |

Read a reference file only when its command runs. They're written to be followed step by step.

## Where the hunt lives

The workspace is a folder, by default `./home-hunt/` in the working directory (override with `--dir` or `$HOME_HUNT_DIR`):

```
home-hunt/
  profile.json    what they want: mode, budget, areas, anchors, requirements, weights (schema: references/scoring.md)
  sources.json    sites, access method, last test result, scout schedule
  listings.json   listings + comments (schema: references/data-model.md)
  runs.jsonl      one line per scout run
  board.html      the latest board snapshot
  photos/         cover photos (local board)
```

The CLI does the mechanical work. Run it with Node 18+ from this skill's folder:

```
node <skill-dir>/scripts/hh.js <command> [--dir <workspace>]
```

`init`, `status`, `validate`, `score [id] [--explain]`, `add <file|->`, `set <id> k=v`, `dupes`, `list`, `board [--mode artifact]`, `docs`, `serve`, `probe <url>`, `geo`, `import`, `export [--csv]`, `runlog`, `reset --yes`. Run it with no arguments for usage.

**Hosts without a lasting filesystem** (claude.ai chat, where the sandbox resets): the board's artifact database is the store. Profile in `meta/profile`, listings in `listings/<id>`, comments in `comments/<id>`. Read and write those with the artifact data tool, and keep a copy of the profile in memory or the project. See `references/board.md`.

## Golden rules

1. **Only add a listing after its own detail page has loaded and looks live.** You need the price, no Let, Rented, Sold or Under Offer badge, no redirect to a search page, and an availability date that isn't months stale. Search-result cards and portal counts include dead stock. On one hunt, 6 of 9 listings added from search cards turned out to be gone.
2. **An error isn't "taken".** Portals often throw server errors at automated readers while the listing is live. Mark those `verify.state: "unverified"` and mention them in your report. Mark a listing taken only on positive evidence: a 404 or "no longer available", an archive redirect, or the agent saying so.
3. **Never store scores.** The board and the CLI compute them live from the listing's facts and the current profile. Your job is to keep the **facts** accurate, with `factSource` noting where each came from: tag, description, photo, agent or inferred.
4. **Unknown is not no.** Many listings don't tag pets or gardens even when they allow or have them. Infer from the description and photos, record the source, and leave anything short of a clear yes as `unknown`, `likely` or `permission`. The scorer turns those into questions for the agent.
5. **Be specific about pets.** "Pet friendly" might mean a cat. Match the household's real animals ("2 medium dogs"): a "small pets only" listing fails.
6. **Location means their real trips, not suburb names.** Geocode the address when you can (ArcGIS `findAddressCandidates` is readable from most sandboxes; Nominatim usually blocks automated use). Portals file listings under the wrong suburb, so set `facts.realArea`. For an area they only half-like ("only the side near the park"), the profile has a zone, and the listing's side decides it.
7. **Dedupe before adding.** The same unit is cross-posted by several agencies with different wording, prices off by a little and different bay counts. Run `hh.js dupes` and link cross-posts with `dupOf` instead of adding a second card. Prefer sources that don't syndicate, such as private landlords and agency-only stock.
8. **Respect sites.** Use normal requests at a human pace. Stay inside the per-run fetch budget in `sources.json` (shared fetch tools are often capped around 100 calls an hour). Never bypass a captcha, a login or a bot wall: switch to the next access method instead (see `references/sources.md`).
9. **Don't rely on one input.** Email alerts miss listings. A scout sweeps the sites directly, and alerts are only an extra input.
10. **Report every run, even quiet ones.** "Scout ran, nothing new: 2 sites, 6 areas, 31 checked". Silence looks like a broken scout.
11. **Keep personal data local.** The workspace is theirs. Never commit it, publish it or send it anywhere they didn't ask for. `init` writes a `.gitignore` that ignores everything.

## Talking to the user

Be brief. Lead with the result: what's new, the best one and why, and what to ask. For each new listing use one line: **price, area, score (band)**, then the two or three facts that matter and the open question, for example "R17,500 · Riverside · 91 (strong): 3 bed, private garden, pets OK. Cheap for the spec, so call first." Give the board link every time.

When a choice is theirs, such as a weight trade-off, adding a site that needs their browser, or anything public, ask once with a recommendation.
