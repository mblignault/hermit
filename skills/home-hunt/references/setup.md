# Setup: first run

Goal: in about 10 minutes of their time, get a profile that scores listings the way their gut does, sources you've proven you can read, a scout on a schedule, and a board they like looking at.

Run `hh.js init` first. It creates the workspace without overwriting anything. If a profile already exists, ask whether to **edit** it (go to `settings`) or **start over** (`reset`, which backs up first).

Rules for the interview:
- **Batch the questions.** Ask 3–5 related questions per message, and offer defaults so they can answer "yes, defaults". Never ask one question per message.
- **Use the host's question UI** if it has one (multiple-choice cards). Otherwise use a short numbered list.
- **Reflect back** what you understood after each block, in one or two lines, and write it to `profile.json` straight away. A half-finished setup should still be usable.
- **Don't guess money, dates or deal-breakers.** Ask. Infer the rest (currency, units, locale) and tell them what you inferred.

## 1. Basics

Ask together:
1. Renting or buying? (`mode`)
2. Who's moving? Names or initials of the people who'll rate places. Any pets? Get kind, size and how many. Size matters: "small pets only" listings exclude medium dogs.
3. Where, roughly? A city or region. Use it for the country, currency, locale and units (read `countries/<code>.json`, the ISO 3166 alpha-2 code in lower case). Confirm in one line: "South Africa: prices in ZAR, sizes in m². Right?"
4. When? The earliest move-in date, the ideal latest, and a hard latest after which a place is useless (`moveIn.earliest`, `latest`, `hardLatest`).

Budget, same message or the next:
- **Rent:** the comfortable monthly figure (`budget.ideal`) and the absolute max (`budget.max`). Check the country pack's `rentPeriod`. In Australia and New Zealand rent is quoted **per week**, so store whatever the portals use and say so.
- **Buy:** the target price and max price, deposit, interest rate, loan term, and monthly take-home income (`finance.*`). Read `references/buying.md`.
- If they don't know what they can afford, offer a 2-minute affordability check. Use the pack's `affordability` rule of thumb, and for buying, the repayment formula in `buying.md`. Recommend an ideal and a max, and let them choose.

## 2. What matters: places and the home

**Places they travel to (anchors).** Work, school, family, gym. For each, get the address or place name, how often they go, and what distance or time is "fine" versus "too far". Geocode each one (see `sources.md` §5) to `lat`/`lng` and set `idealKm` and `maxKm` as road km. A daily trip gets `weight: 2`, a weekly one `weight: 1`. If a limit is truly hard ("never more than 25 km"), set `hard: true`.

**Areas.** Ask which neighbourhoods they like and which they'd never live in. Then tier them yourself from the anchors, and show the tiers for a quick yes:
- Tier 1: best for everyone's trips. Tier 2: good. Tier 3: fine. Tier 4: fringe. Tier 5: short trip but not loved.
- `excludeAreas` is a hard no. Ask why: the reason often reveals a whole side of town ("the traffic on that side"), so add its neighbours too.
- **Half-liked areas.** When they say "only the part near X", make a zone: `{label, center:[lat,lng], radiusKm}` or `bbox`. A listing geocoded outside the zone is gated. An ungeocoded one loses a little and gets a question for the agent.
- **"Only if it's great value".** Set `valueMax` on that area. Above it, location points drop and the score can't rise above the maybe band.
- Ask what they'd like within walking distance: a pub, a café, a park, a gym, the school gate (`nearby`, with `idealKm` and `maxKm` in walking km). Skip anything they don't care about.

**The home.** Ask together, offering checkbox-style answers:
- Property types they want, would accept, and won't consider (`requirements.types`). Use these keys: house, house_in_estate, cluster, townhouse, semi, cottage, duplex, apartment, studio, room.
- Bedrooms and bathrooms, minimum and ideal. Size in m², or sqft converted to m² (`sizeM2.min` and `ideal`).
- Outdoor space and entertaining: `must`, `nice` or `ignore`.
- Features, each `must`, `nice`, `avoid` or left out: backupPower, fibre, security, parking2, pool, study, furnished, aircon, lift, laundry, storage, ev, solar, schoolZone.

## 3. Weights and calibration

This step is what makes the scores feel right. Don't skip it.

1. **Rank.** Show the default weights as a short table (location 20, price 15, pets 10, outdoor 10, entertaining 10, layout 13, type 8, nearby 6, timing 5, features 3). Ask them to move points between what matters most and least. Parts that don't apply, such as pets with no pets, give their weight to the rest automatically.
2. **Calibrate.** Ask for 2–3 listings they **love** and 1–2 they'd **reject**, as links, pastes or screenshots. Read each (`scout.md` step 4), add them to the workspace with `status: "shortlist"` or `"no"`, and run `hh.js score --explain`.
   - Loved listings should land at 80 or more. Rejected ones should be gated or under 58.
   - If a loved one scores low, find which part pulled it down and ask why they love it anyway. That's usually a missing weight or a wrong tier.
   - If a rejected one scores high, ask what's wrong with it. That's usually a missing gate, which belongs in `excludeAreas`, a zone, `must` or `types.excluded`.
   - Change the profile, re-score and show the before and after in one line each. Stop when the order matches their gut. Save the ids in `profile.calibration`.
3. Tell them the bands: 85+ strong, 72–84 good, 58–71 maybe, under 58 weak, and a gate means no-fit.

## 4. Sources

Follow `references/sources.md` §1–3:
1. Load `countries/<code>.json`. Propose the primary portals and the main agencies for their areas, and ask for any site they already use.
2. Test each site live with a real search page for one of their areas. Classify it as `fetch`, `browser`, `alerts`, `manual` or `blocked`.
3. Show the result as a short table (site, what you can do, what you need from them). Get approval for any step that touches their machine or inbox.
4. Save to `sources.json` with the working search URL pattern for each area.

Never present an untested site as working.

## 5. Scout schedule

Ask: how often (daily is right for a hot rental market, 2–3 times a week for buying), what time, and whether to send a one-line summary on quiet days (recommend yes). Then set it up with the best mechanism the host offers, in this order:

1. **A scheduling tool in your tool list**, such as a routine, trigger or scheduled-task tool. Create a job whose prompt is exactly: `Run /home-hunt scout for the workspace at <absolute path>. Follow references/scout.md.` Include the workspace path and, in a project, where to post the summary.
2. **Claude Code on their own machine with nothing built in:** give them a cron (macOS/Linux) or Task Scheduler line to paste, and don't install it yourself:
   `0 7 * * * cd <workspace parent> && claude -p "/home-hunt scout" --allowedTools "WebFetch,WebSearch,Read,Write,Edit,Bash(node:*)" >> home-hunt/scout.log 2>&1`
3. **None of the above:** tell them to say "scout" whenever they like, and offer a calendar reminder.

Save the result to `sources.json.schedule` as `{cadence, time, timezone, mechanism, id}`, so `schedule off` can find and remove it.

## 6. Board

Build it (`references/board.md`) with the calibration listings already on it, so it's not empty, and give them the link or path. Show them how it works in three lines: drag cards between columns, open a card to edit facts (the score updates live), and star ratings are per person and separate from the fit score.

## 7. Wrap up

One message:
- What you set up: the profile in one line, the sites with their access, the schedule and the board link.
- The first scout: offer to run it now (recommended).
- Commands they'll use most: `add`, `scout`, `asks`, `settings`, `help`.

Then, if the host has memory, save the workspace path, board URL and schedule id so future sessions find the hunt without asking.
