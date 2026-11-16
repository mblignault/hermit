# Country packs

One JSON file per country (ISO 3166 alpha-2, lower case). Setup reads the user's pack to propose sites, currency, units, rent period, affordability rules of thumb and local vocabulary.

- `access` is what we last saw from a cloud sandbox: `fetch`, `browser`, `manual` or `untested`. Setup re-tests every site live, so a pack can't make a dead site look alive.
- Only `za.json` has been used on a real hunt so far. The others are portal lists waiting for a field test. Pull requests with tested `searchUrl` patterns and quirks are very welcome.
- No pack for your country? Setup falls back to a web search for the main portals and agencies.
