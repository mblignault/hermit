# Contributing to Hermit

Thanks for helping. The most useful contributions are **tested country packs**, fixes to how a site is read, and bug reports from real hunts.

## Before you open a pull request

```
npm run check   # privacy scan + tests (Node 18+, no dependencies)
npm run demo    # look at the board with fictional data
```

CI runs the same checks on every push and pull request.

## Never commit personal data

This repo holds fictional examples only. No real names, addresses, phone numbers, emails, budgets, listing links or listing numbers, from your hunt or anyone else's.

`tools/privacy-scan.js` catches the obvious patterns. Add the words only you would know (your street, your suburb, your agent's name, your pets' names) to a personal word list kept **outside** the repo, one per line, at `~/.config/hermit/privacy-denylist`. The scan reads it on every run, so it can't be committed by accident.

## Country packs

Packs live in `skills/hermit/countries/<code>.json` (ISO 3166 alpha-2, lower case). See `skills/hermit/countries/README.md` for the fields. A good pack PR says:
- which portals you tested, and how (fetch, browser or email alerts);
- one example search URL per portal, with fictional criteria;
- the local terms for "let agreed", "under offer" and similar, so the scout can tell a dead listing.

Only South Africa has been used on a real hunt so far, so a pack you've actually hunted with is gold.

## Changes to the skill

- Keep the golden rules in `SKILL.md` intact unless you're fixing one with evidence.
- The scorer (`scripts/score.js`) is shared by the CLI and the board: change it in one place and add a test in `tests/`.
- Write for the person hunting: plain words, short sentences.
