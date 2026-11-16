# Setup: first run

Goal: listings on their board as fast as possible, scored well enough to trust, then sharpened over time. **Quick start is the default.** It takes about 5 minutes and two rounds of questions. Everything in "Refine" is optional and can happen any time with `settings`.

Before asking anything:
1. **Find an existing hunt.** Check memory, then `$HOME_HUNT_DIR`, then `./home-hunt` and `~/home-hunt` (`hh.js status` exits 2 when there's none). If one exists, ask whether to **edit** it (`settings`) or **start over** (`reset`). If none is found but they talk as if they have one, ask where it is before creating a new one.
2. **Check Node** with `node --version` (18+). Without it, follow SKILL.md "Requirements and fallbacks".
3. `hh.js init` creates the workspace (default `~/home-hunt`) without overwriting anything.

Open with one line that sets expectations:
> "Setup has 4 short parts: basics, what matters, sites, schedule. About 5 minutes. Say **skip** or **defaults** at any point."

Rules for the interview:
- **Batch the questions.** 3–5 per message, each with a default. Prefix each round with its part, e.g. "(2/4) What matters".
- **Use the host's question UI** if it has one (multiple-choice cards). Otherwise a short numbered list.
- **Everything is skippable.** "skip" takes the default and moves on. Never block on anything except mode, place and budget.
- **Reflect back** in one or two lines after each round, and write to `profile.json` straight away. A half-finished setup still works.
- **Don't guess money, dates or deal-breakers.** Ask. Infer the rest (country, currency, units, locale) and say what you inferred.
- **Plain words.** Say "places you travel to", "how much you like each area", "deal-breakers", "score level". The internal names (anchors, tiers, zones, gates, bands) are for the files, not the conversation.

## Quick start

### (1/4) Basics, one message

1. Renting or buying? (`mode`)
2. Where, roughly? A city or region. Infer the country (`countries/<code>.json`, ISO 3166 alpha-2 in lower case), currency, locale and units, and confirm in one line: "United Kingdom: rent per month in GBP, sizes in sq ft. Right?" Set `units: "imperial"` where people think in miles and square feet (US, UK for distance); data is always stored metric, so convert what they tell you. Name the board from the place and mode ("Bristol Rental Hunt") in `title`; they can rename it.
3. Budget.
   - **Rent:** a comfortable figure and an absolute max (`budget.ideal`, `budget.max`). Check the pack's `rentPeriod`: Australia and New Zealand quote rent **per week**. Store what the portals use and say so.
   - **Buy:** target and max price. The finance details (deposit, rate, term, income) can wait for Refine; see `buying.md`.
   - Not sure what they can afford? Offer a 2-minute check using the pack's `affordability` rule (and `buying.md` for buyers), then recommend an ideal and a max.
4. When could you move, and when must you be in by? Set `moveIn.earliest` and `hardLatest`, and infer `latest` (ideal) as a couple of weeks before the hard date.
5. Who's moving, and any pets? Names or initials of the people who'll rate places (`household.people`, ids are lower-case initials). Pets: kind, size and how many. Size matters: "small pets only" excludes medium dogs.

### (2/4) What matters, one message

1. **Places you travel to often:** work, school, family. Address or place name, and roughly how far is fine. Geocode each (`sources.md` §5) into `anchors` with `idealKm`, `maxKm` (road km), `weight: 2` for daily and `1` for weekly.
2. **Areas you like, and any you'd never live in.** Tier the liked ones yourself from the travel places (1 best … 5 short trip but not loved) and show the result for a quick yes. Never-areas go in `excludeAreas`; ask why, because the reason often rules out the neighbours too.
3. **Must-haves and deal-breakers, in their own words.** "3 bedrooms, a garden for the dogs, no apartments." Translate into `requirements` (beds, baths, types, outdoor, entertain, features as `must`/`nice`/`avoid`). Anything not mentioned keeps its default.

### (3/4) Sites

Follow `sources.md` §1–3: propose sites from the country pack plus anything they already use, test each live, and show a short table (site, what I can do, anything I need from you). Get approval for anything that touches their machine or inbox. Save to `sources.json`.

Never present an untested site as working. **If no site is readable**, say so plainly and don't schedule a scout that can't read anything:
> "I can't read any of these sites from here. Options: run me on your own computer, let me use your browser, forward me the portals' email alerts, or paste listings in and I'll do the rest."

### (4/4) Schedule and board

1. Ask how often (daily for a hot rental market, 2–3 times a week for buying) and what time. Set it up (see "Scheduling" below).
2. Run the **first scout now** (`scout.md`), so the board isn't empty.
3. Build the board (`board.md`) and give the link or path.

### Wrap up, one message

- What's set up: the profile in one line, the sites and how each is read, the schedule, and the board link.
- **What happens next:** "Every <cadence> at <time> I check the sites. New listings that pass your deal-breakers land in the board's Inbox, and you get a short summary <where: this chat / the project / scout.log>. Quiet days get one line, so you know it ran."
- Three things to try: open a card and fix a fact (the score updates), say `questions` for what to ask agents, say `settings calibrate` once you've starred a few.
- If the host has memory, save the workspace path, board URL and schedule id so later sessions find the hunt without asking.

## Refine (optional, any time)

Offer these after the first scout, one at a time, never all at once. Each is a `settings` sub-command.

- **`settings calibrate`:** the single best improvement. Ask them to pick 2 listings they like and 1 they don't **from the board** (or links they already have). Then follow `scoring.md` "Tuning": loved ones should land at 80+, rejected ones should be gated or under 58. Fix the cause, re-score, show before and after in one line each. Save ids in `profile.calibration`.
- **`settings weights`:** show the default weights as a short table (location 20, price 18, layout 15, pets 10, outdoor 10, type 8, nearby 6, entertaining 5, timing 5, features 3) and let them move points. Parts that don't apply (pets, with no pets) give their weight to the rest automatically. The defaults are a starting point, not a recommendation.
- **`settings areas`:** half-liked areas ("only the part near the park") become a zone: `{label, center:[lat,lng], radiusKm}` or `bbox`. A listing outside the zone is a deal-breaker; one with no address loses a little and gets a question. "Only if it's great value" becomes `valueMax` on the area.
- **`settings nearby`:** what they'd like within walking distance: a park, café, gym, school (`nearby`, walking km).
- **`settings home`:** the full list. Types (house, gated_house, cluster, townhouse, semi, cottage, duplex, apartment, studio, room), beds and baths min/ideal, size min/ideal (`sizeM2`; convert from sq ft), outdoor and entertaining (`must`/`nice`/`ignore`), and features (backupPower, fibre, security, parking2, pool, study, furnished, aircon, lift, laundry, storage, ev, solar, schoolZone).
- **`settings finance`** (buying): deposit, rate, term, monthly take-home, max share of income (`buying.md`).

## Scheduling

Use the best mechanism the host offers, in this order, and save the result as `sources.json.schedule` = `{cadence, time, timezone, mechanism, id, reportTo}`.

1. **A scheduling tool in your tool list** (a routine, trigger or scheduled-task tool). The job's prompt, exactly:
   `Run a Home Hunt scout for the workspace at <absolute path>: follow the home-hunt skill's references/scout.md and post the report to <where>.`
   Use a plain prompt, not a slash command, so it works however the skill is installed. Report to the chat, project or channel the user reads.
2. **Claude Code on their own machine, nothing built in:** give them a line to paste; don't install it yourself. macOS/Linux cron, daily at 07:00 (use `1-5` in the 5th field for weekdays):
   `0 7 * * * cd <workspace parent> && PATH=/usr/local/bin:/opt/homebrew/bin:$PATH HOME_HUNT_DIR=<workspace> claude -p "Run a Home Hunt scout for the workspace at <workspace>" --allowedTools "WebFetch,WebSearch,Read,Write,Edit,Bash(node *)" >> <workspace>/scout.log 2>&1`
   Tell them the summary lands in `scout.log`, new listings appear on the board, and `status` shows the last run. Windows: the equivalent Task Scheduler action.
3. **Nothing available:** they say "scout" when they like; offer a calendar reminder.

### Changing or stopping the schedule (`schedule …`)

- **Scheduling tool:** update or delete the job by its saved `id`. If the id is missing, list the jobs and match on the workspace path.
- **cron:** show the exact line to edit or remove (`crontab -e`). You can't remove it for them.
- **Manual:** nothing to stop.
- Always update `sources.json.schedule` (`mechanism: "off"` when stopped) and confirm in one line.
