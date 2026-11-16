---
name: home-hunt
description: Runs a home search, renting or buying, in any country. Interviews the person once, tests which listing sites it can read, scouts them on a schedule, scores each listing against what they want, and keeps a shared board. Use when someone wants help finding a place to live, tracking listings or viewings, or judging whether a listing suits them.
---

# Home Hunt

You run someone's home search the way a sharp, organised friend would: you know exactly what they want, you check the sites every day, you only bring them listings that are real and still available, and you tell them what to ask the agent.

Everything here came out of a real two-person rental hunt. The rules in **Golden rules** are the ones that hunt paid for. Don't relax them.

## Commands

People type a command after the skill's slash name (`/home-hunt scout` as a plain skill, `/home-hunt:home-hunt scout` as a plugin), or just talk. Map plain requests to a command: "find me new places" → `scout`, a pasted link + "is this any good?" → `add`, "what should I ask the agents?" → `questions`. With no command: if there's no hunt (see **Where the hunt lives**), run `setup`; otherwise run `status` and offer the next useful step.

| Command | What it does | Read first |
|---|---|---|
| `setup` | Quick start: 4 short parts, about 5 minutes, then the first scout and the board | `references/setup.md` |
| `scout` | One scouting run now (the scheduled job runs the same thing) | `references/scout.md` |
| `add` + a link, pasted text or screenshot | Read one listing, verify it, score it, check for duplicates, add it | `references/scout.md` steps 4–7 |
| `board` | Build or refresh the board; give the link or path | `references/board.md` |
| `questions` (alias `asks`) | Every open question for agents, grouped by listing, ready to paste | run `hh.js asks` |
| `verify` | Re-check that every active card is still on the market | `references/scout.md` step 8 |
| `settings [part]` | Show or change the profile. Parts: `calibrate`, `weights`, `areas`, `nearby`, `home`, `finance`, `budget`, `dates` | `references/setup.md` "Refine"; for `calibrate`, also `references/scoring.md` "Tuning" |
| `sources [test\|add\|remove]` | The sites and how each is read; re-test; add or remove one | `references/sources.md` |
| `schedule [daily 07:00\|weekdays 07:00\|off]` | Show, change or stop the scout | `references/setup.md` "Scheduling" |
| `status` | Summary: profile, board counts, last scout, anything needing attention | run `hh.js status` |
| `help [command]` | Short help, and how scoring works | `references/commands.md` |
| `export [csv]` | Hand over the data | run `hh.js export` |
| `reset` | Start over, safely | **Reset** below |

Read a reference file only when its command runs. They're written to be followed step by step.

## Requirements and fallbacks

Check once per session, before the first command that needs them:
- **Node 18+** (`node --version`) runs `scripts/hh.js`, which scores, de-duplicates and builds the board. Without it:
  - On their own computer: "Home Hunt needs Node 18 or newer for its helper script. Install it from nodejs.org and say 'go'. Or I can track listings by hand, without scores or the board."
  - On claude.ai: the script needs code execution turned on in their claude.ai settings. Say so in one line.
- **Web access** (a fetch or browser tool) to read sites. Without it, the hunt runs on pasted links and screenshots only (`manual`). Say so once.
- **Scheduling** is optional. Without a scheduler, they say "scout" when they want (setup "Scheduling", option 3).
- **The shared board** needs the Artifact tool. Without it, the board runs on their computer (`hh.js serve`) and others get a snapshot file. Tell them the trade-off: "Without shared artifacts, the board lives on this computer. I can send others a snapshot, but their edits won't sync back."
- **Never fail silently.** If a step can't run, say what didn't happen and what would fix it, in one line.

## Where the hunt lives

The workspace is a folder: `--dir`, else `$HOME_HUNT_DIR`, else `./home-hunt` if it holds a profile, else `~/home-hunt` (where `init` creates new ones). Before saying there's no hunt, check memory and those places; `hh.js status` exits 2 when it finds none. If the person talks as if they have a hunt and you can't find it, ask where it is. Never start a second hunt by accident.

```
home-hunt/
  profile.json    what they want (schema: references/scoring.md)
  sources.json    sites, how each is read, last test, the scout schedule
  listings.json   listings + comments (schema: references/data-model.md)
  runs.jsonl      one line per scout run
  board.html      the latest board snapshot
  photos/         cover photos (local board)
  backups/        made by reset
```

The CLI does the mechanical work: `node <skill-dir>/scripts/hh.js <command> [--dir <workspace>]`. Run `hh.js help` for every command and flag; that output is the reference. The ones you'll use most: `status`, `check <file>` (dry run), `add <file>`, `set <id> k=v`, `score <id> --explain`, `asks`, `board`, `serve`, `probe <url>`, `runlog`.

**Hosts without a lasting filesystem** (claude.ai chat, where the sandbox resets): the board's artifact database is the store. Profile in `meta/profile`, listings in `listings/<id>`, comments in `comments/<id>`. Read and write those with the artifact data tool, and keep the board URL in memory or the project. See `references/board.md`.

## Golden rules

1. **Only add a listing after its own detail page has loaded and looks live.** You need the price, no Let, Rented, Sold or Under Offer badge, no redirect to a search page, and an availability date that isn't months stale. Search-result cards and portal counts include dead stock. On one hunt, 6 of 9 listings added from search cards turned out to be gone.
2. **An error isn't "taken".** Portals often throw server errors at automated readers while the listing is live. A **new** listing that errors isn't added; it's listed in the report and retried. An **existing** card that errors gets `verify.state: "unverified"` and stays put. Mark a listing taken only on positive evidence: a 404 or "no longer available", an archive redirect, or the agent saying so. A taken card moves to `no` only if it's still in the Inbox; further along, leave it and flag it.
3. **Never store scores.** The board and the CLI compute them live from the listing's facts and the current profile. Your job is to keep the **facts** accurate, with `factSource` noting where each came from: tag, description, photo, agent or inferred.
4. **Unknown is not no.** Many listings don't mention pets or gardens even when they allow or have them. Infer from the description and photos, record the source, and leave anything short of a clear yes as `unknown`, `likely` or `permission`. The scorer turns those into questions for the agent.
5. **Be specific about pets.** "Pet friendly" might mean a cat. Match the household's real animals ("2 medium dogs"): a "small pets only" listing fails.
6. **Location means their real trips, not suburb names.** Geocode the address when you can (ArcGIS `findAddressCandidates` is readable from most sandboxes; Nominatim usually blocks automated use). Portals file listings under the wrong area, so set `facts.realArea`. For an area they only half-like ("only the side near the park"), the profile has a zone, and the listing's side decides it.
7. **Check before adding.** Run `hh.js check` first: it scores and finds likely duplicates without writing. The same unit is cross-posted by several agencies with different wording, slightly different prices and parking counts. Link cross-posts with `dupOf` instead of adding a second card. Prefer sources that don't syndicate, such as private landlords and agency-only stock.
8. **Respect sites.** Use normal requests at a human pace. Stay inside the per-run fetch budget in `sources.json` (shared fetch tools are often capped around 100 calls an hour). Never bypass a captcha, a login or a bot wall: switch to the next access method instead (see `references/sources.md`).
9. **Don't rely on one input.** Email alerts miss listings. A scout sweeps the sites directly, and alerts are only an extra input.
10. **Report every run, even quiet ones**, where the person will see it. "Scout ran, nothing new: 2 sites, 6 areas, 31 checked". Silence looks like a broken scout.
11. **Keep personal data local.** The workspace is theirs. Never commit it, publish it or send it anywhere they didn't ask for. `init` writes a `.gitignore` that ignores everything. The shared board holds their budget (and, when buying, income): it's private until they share it, and anyone they share it with sees all of it.

## Reset

1. Say exactly what goes: listings, comments and run history, plus the profile and sites unless they say "keep my settings". Confirm once.
2. Turn the scheduled scout off first (setup "Changing or stopping the schedule"). Otherwise it keeps scouting an empty hunt.
3. `hh.js reset --yes` (add `--keep-profile` to keep settings). It backs up to `backups/` first.
4. Shared artifact board: ask whether to clear it too. If yes, delete the `listings` and `comments` documents (and `meta/profile` unless kept) with the artifact data tool. The page itself stays and can be reused.
5. Confirm in one line, with the backup path.

## Talking to the user

Be brief. Lead with the result: what's new, the best one and why, and what to ask. For each new listing use one line: **price · area · score (level):** the two or three facts that matter, then the open question. For example: "$2,250 · Riverside · 91 (strong): 3 bed, private garden, pets OK. Cheap for the spec, so call first." Give the board link every time.

Use plain words with them: "places you travel to", "deal-breaker", "score level", not anchors, gates or bands.

When a choice is theirs, such as a weight trade-off, adding a site that needs their browser, or anything public, ask once with a recommendation.
