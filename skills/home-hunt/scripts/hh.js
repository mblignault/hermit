#!/usr/bin/env node
// home-hunt CLI. Node 18+, no dependencies.
// Workspace: --dir <path>, else $HOME_HUNT_DIR, else ./home-hunt
//
//   init                      create a workspace from templates (won't overwrite)
//   status                    one-screen summary: profile, sources, board counts, last scout
//   validate                  check profile.json and listings.json
//   score [id|--all] [--explain] [--json]
//   add <file.json|->         upsert one listing or an array (merges facts, tracks price changes, flags duplicates)
//   set <id> key=value ...    edit fields (dot paths: facts.pets=yes, verify.state=live)
//   dupes [--id <id>]         suggest likely duplicates across sites
//   list [--status s] [--band b] [--active]
//   board [--out f] [--mode snapshot|artifact]  build the board page (artifact = for claude.ai, data lives in the artifact db)
//   serve [--port 4173]       live local board backed by listings.json
//   probe <url>...            reachability check for listing sites (status, redirects, bot walls, listing signals)
//   geo <lat,lng> <lat,lng>   straight-line and estimated road km
//   import <changes.json>     merge edits exported from a static board
//   export [--csv]            print listings as JSON or CSV
//   docs [outdir]             write one file per artifact-db doc + writes.json, to seed a shared board
//   runlog <json>             append a scout run record
//   reset --yes [--keep-profile]  back up, then clear the workspace
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { scoreListing, haversineKm, dupLikelihood: dupScore } = require("./score.js");

const SKILL = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf("--" + name); if (i < 0) return def; const v = argv[i + 1]; argv.splice(i, v && !v.startsWith("--") ? 2 : 1); return v && !v.startsWith("--") ? v : true; };
const DIR = path.resolve(opt("dir") || process.env.HOME_HUNT_DIR || "home-hunt");
const F = {
  profile: path.join(DIR, "profile.json"), sources: path.join(DIR, "sources.json"),
  listings: path.join(DIR, "listings.json"), runs: path.join(DIR, "runs.jsonl"),
  board: path.join(DIR, "board.html"), photos: path.join(DIR, "photos"), backups: path.join(DIR, "backups"),
};
const die = m => { console.error("home-hunt: " + m); process.exit(1); };
const readJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { if (def !== undefined && e.code === "ENOENT") return def; die(`can't read ${f}: ${e.message}`); } };
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = f + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(v, null, 2) + "\n"); fs.renameSync(tmp, f); };
const norm = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const today = () => new Date().toISOString().slice(0, 10);
const loadStore = () => { const s = readJSON(F.listings, { listings: [], comments: [] }); s.listings ||= []; s.comments ||= []; return s; };
const profile = () => readJSON(F.profile);

function setPath(obj, dotted, value) {
  const keys = dotted.split("."); let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] = (o[k] && typeof o[k] === "object") ? o[k] : {};
  const k = keys.at(-1);
  if (value === "null" || value === "") delete o[k];
  else o[k] = value === "true" ? true : value === "false" ? false : /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
}

function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) deepMerge(a[k], v);
    else if (v !== undefined) a[k] = v;
  }
  return a;
}

function suggestDupes(store, only) {
  const L = store.listings.filter(l => !l.dupOf);
  const out = [];
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    if (only && L[i].id !== only && L[j].id !== only) continue;
    const s = dupScore(L[i], L[j]);
    if (s >= 0.5) out.push({ a: L[i].id, b: L[j].id, likelihood: Math.round(s * 100) / 100 });
  }
  return out.sort((x, y) => y.likelihood - x.likelihood);
}

function upsert(store, incoming) {
  const now = Date.now(), res = [];
  for (const raw of [].concat(incoming)) {
    if (!raw.id) die("every listing needs an id like <source>-<listing number>, e.g. p24-123456");
    const cur = store.listings.find(l => l.id === raw.id);
    if (cur) {
      if (raw.price && cur.price && raw.price !== cur.price) (cur.priceHistory ||= []).push({ at: today(), from: cur.price, to: raw.price });
      deepMerge(cur, raw); cur.updatedAt = now; res.push({ id: raw.id, action: "updated" });
    } else {
      const l = { status: "inbox", stage: "new", createdAt: now, updatedAt: now, ...raw };
      store.listings.push(l); res.push({ id: raw.id, action: "added" });
    }
  }
  const dupes = res.filter(r => r.action === "added").flatMap(r => suggestDupes(store, r.id));
  return { results: res, possibleDuplicates: dupes };
}

function explain(l, r) {
  const lines = [`${l.id}  ${l.area || "?"}  ${l.price ?? "?"}  →  ${r.score} ${r.band}  (facts known: ${Math.round(r.confidence * 100)}%)`];
  for (const [k, p] of Object.entries(r.parts)) lines.push(`  ${k.padEnd(10)} ${String(p.pts).padStart(5)} / ${String(p.max).padEnd(5)} ${p.known ? "" : "(unknown)"}`);
  if (r.gates.length) lines.push("  GATES: " + r.gates.join("; "));
  if (r.flags.length) lines.push("  flags: " + r.flags.join("; "));
  if (r.ask.length) lines.push("  ask:   " + r.ask.join("; "));
  if (r.info.length) lines.push("  info:  " + r.info.join("; "));
  return lines.join("\n");
}

function buildBoard({ title, mode = "snapshot" } = {}) {
  const tpl = fs.readFileSync(path.join(SKILL, "assets", "board.html"), "utf8");
  const scorer = fs.readFileSync(path.join(__dirname, "score.js"), "utf8").replace(/^if \(typeof module.*$/m, "");
  const p = profile(), store = loadStore();
  const data = { mode, profile: p, listings: store.listings, comments: store.comments, builtAt: new Date().toISOString() };
  const safe = JSON.stringify(data).replace(/</g, "\\u003c");
  return tpl
    .replace("/*__SCORER__*/", () => "(function(){\n" + scorer + "\n})();")
    .replace('"__DATA__"', () => safe)
    .replace("<!--__VIEWPORT__-->", mode === "artifact" ? "" : '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">')
    .replace("<title>Home Hunt</title>", () => `<title>${String(title || p.title || "Home Hunt").replace(/[<&]/g, "")}</title>`);
}

async function probe(url) {
  const t0 = Date.now(), out = { url };
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(url, { redirect: "follow", signal: ctl.signal, headers: { "accept": "text/html,application/xhtml+xml" } });
    clearTimeout(timer);
    const html = await r.text();
    Object.assign(out, { status: r.status, finalUrl: r.url, redirected: r.url !== url, ms: Date.now() - t0, bytes: html.length });
    const title = (html.match(/<title[^>]*>([^<]*)/i) || [])[1]; out.title = title && title.trim().slice(0, 120);
    const low = html.toLowerCase();
    const walls = ["captcha", "cf-chl", "just a moment", "access denied", "are you a robot", "px-captcha", "datadome", "incapsula", "enable javascript", "unusual traffic"];
    out.botWall = walls.filter(w => low.includes(w));
    out.priceSignals = (html.match(/(?:R|£|\$|€|A\$|NZ\$|AED|₹)\s?\d[\d\s,.]{2,}/g) || []).length;
    out.listingLinks = (html.match(/href="[^"]*(?:to-rent|for-sale|property|listing|details|homedetails|\/rent\/|\/buy\/)[^"]*\d{5,}[^"]*"/gi) || []).length;
    out.archived = /archiveid=|no longer available|off the market|has been (?:let|sold|removed)/i.test(r.url + " " + html.slice(0, 200000));
    out.verdict = r.status >= 400 ? (r.status === 404 || r.status === 410 ? "not-found" : "blocked") :
      out.botWall.length && out.priceSignals < 3 ? "blocked" :
      out.priceSignals >= 3 || out.listingLinks >= 3 ? "readable" : "loads-but-empty (likely JS-rendered: try the browser)";
  } catch (e) { Object.assign(out, { error: String(e.cause?.code || e.name || e.message), verdict: "unreachable" }); }
  return out;
}

function serve(port) {
  const server = http.createServer((req, res) => {
    const send = (code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
    if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/?"))) return send(200, buildBoard({ mode: "server" }), "text/html; charset=utf-8");
    if (req.method === "GET" && req.url === "/api/state") return send(200, JSON.stringify({ profile: profile(), ...loadStore() }));
    if (req.method === "GET" && req.url.startsWith("/photos/")) {
      const f = path.join(F.photos, path.basename(decodeURIComponent(req.url.slice(8))));
      if (!fs.existsSync(f)) return send(404, "{}");
      return send(200, fs.readFileSync(f), /\.png$/i.test(f) ? "image/png" : "image/jpeg");
    }
    if (req.method === "POST" && req.url === "/api/op") {
      let body = ""; req.on("data", c => { body += c; if (body.length > 25e6) req.destroy(); });
      req.on("end", () => {
        try {
          const op = JSON.parse(body), store = loadStore();
          if (op.type === "put") { const i = store.listings.findIndex(l => l.id === op.listing.id); op.listing.updatedAt = Date.now(); if (i < 0) store.listings.push(op.listing); else store.listings[i] = op.listing; }
          else if (op.type === "delete") store.listings = store.listings.filter(l => l.id !== op.id);
          else if (op.type === "comment") store.comments.push({ ...op.comment, at: Date.now() });
          else if (op.type === "uncomment") store.comments = store.comments.filter(c => c.id !== op.id);
          else if (op.type === "photo") {
            const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(op.dataUrl || ""); if (!m) throw new Error("bad image");
            fs.mkdirSync(F.photos, { recursive: true });
            const name = op.id.replace(/[^\w.-]/g, "_") + (m[1] === "png" ? ".png" : ".jpg");
            fs.writeFileSync(path.join(F.photos, name), Buffer.from(m[2], "base64"));
            const l = store.listings.find(x => x.id === op.id); if (l) { l.photo = "/photos/" + name; l.updatedAt = Date.now(); }
          } else throw new Error("unknown op");
          writeJSON(F.listings, { listings: store.listings, comments: store.comments });
          send(200, JSON.stringify({ ok: true, ...loadStore() }));
        } catch (e) { send(400, JSON.stringify({ ok: false, error: e.message })); }
      });
      return;
    }
    send(404, "{}");
  });
  server.listen(port, "127.0.0.1", () => console.log(`Board: http://127.0.0.1:${port}  (Ctrl+C to stop; edits save to ${F.listings})`));
}

function toCSV(rows) {
  const cols = ["id", "status", "area", "price", "beds", "baths", "sizeM2", "type", "score", "band", "url", "agentName", "agentPhone", "viewingAt", "taken"];
  const q = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map(r => cols.map(c => q(r[c])).join(","))].join("\n");
}

async function main() {
  const cmd = argv.shift();
  switch (cmd) {
    case "init": {
      fs.mkdirSync(DIR, { recursive: true });
      for (const [src, dst] of [["profile.template.json", F.profile], ["sources.template.json", F.sources]]) {
        if (!fs.existsSync(dst)) fs.copyFileSync(path.join(SKILL, "templates", src), dst);
      }
      if (!fs.existsSync(F.listings)) writeJSON(F.listings, { listings: [], comments: [] });
      const gi = path.join(DIR, ".gitignore"); if (!fs.existsSync(gi)) fs.writeFileSync(gi, "# Your hunt is personal. Keep it out of any public repo.\n*\n");
      console.log(`Workspace ready at ${DIR}`); break;
    }
    case "status": {
      const p = readJSON(F.profile, null), s = readJSON(F.sources, { sources: [] }), st = loadStore();
      if (!p) { console.log(`No workspace at ${DIR}. Run setup first.`); break; }
      const by = {}; for (const l of st.listings.filter(l => !l.dupOf)) by[l.status] = (by[l.status] || 0) + 1;
      const runs = fs.existsSync(F.runs) ? fs.readFileSync(F.runs, "utf8").trim().split("\n").filter(Boolean) : [];
      const last = runs.length ? JSON.parse(runs.at(-1)) : null;
      console.log(JSON.stringify({
        dir: DIR, mode: p.mode, country: p.country, budget: p.budget, areas: (p.areas || []).map(a => a.name),
        sources: (s.sources || []).map(x => `${x.name}: ${x.enabled === false ? "off" : x.access || "untested"}`),
        board: by, total: st.listings.length, lastScout: last && { at: last.at, added: last.added, checked: last.checked },
        scout: s.schedule || null,
      }, null, 2)); break;
    }
    case "validate": {
      const p = profile(), st = loadStore(), errs = [];
      if (!["rent", "buy"].includes(p.mode)) errs.push("profile.mode must be rent or buy");
      if (!p.budget?.max) errs.push("profile.budget.max is required");
      if (!p.currency) errs.push("profile.currency is required (ISO code, e.g. ZAR, GBP, USD)");
      for (const a of p.areas || []) if (![1, 2, 3, 4, 5].includes(a.tier)) errs.push(`area ${a.name}: tier must be 1-5`);
      for (const a of p.anchors || []) if (a.lat == null || a.lng == null) errs.push(`anchor ${a.label}: needs lat/lng (geocode it)`);
      const ids = new Set(); for (const l of st.listings) { if (ids.has(l.id)) errs.push(`duplicate id ${l.id}`); ids.add(l.id); if (l.dupOf && !st.listings.some(x => x.id === l.dupOf)) errs.push(`${l.id}: dupOf points at missing ${l.dupOf}`); }
      const w = { ...require("./score.js").DEFAULT_WEIGHTS, ...(p.weights || {}) }; const tot = Object.values(w).reduce((a, b) => a + b, 0);
      console.log(errs.length ? errs.map(e => "✗ " + e).join("\n") : `✓ profile and ${st.listings.length} listings OK (weights total ${tot}, normalised to 100)`);
      process.exitCode = errs.length ? 1 : 0; break;
    }
    case "score": {
      const p = profile(), st = loadStore(), id = argv.find(a => !a.startsWith("--")), json = opt("json"), ex = opt("explain");
      const rows = st.listings.filter(l => (id ? l.id === id : !l.dupOf));
      if (id && !rows.length) die(`no listing ${id}`);
      const out = rows.map(l => ({ l, r: scoreListing(l, p) })).sort((a, b) => b.r.score - a.r.score);
      if (json) console.log(JSON.stringify(out.map(({ l, r }) => ({ id: l.id, ...r })), null, 2));
      else for (const { l, r } of out) console.log(ex || id ? explain(l, r) + "\n" : `${String(r.score).padStart(3)} ${r.band.padEnd(7)} ${l.id.padEnd(22)} ${l.area || ""} ${l.price ?? ""}${r.gates.length ? "  ✗ " + r.gates[0] : ""}`);
      break;
    }
    case "add": {
      const src = argv[0]; if (!src) die("add <file.json|->");
      const data = JSON.parse(src === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(src, "utf8"));
      const st = loadStore(), r = upsert(st, data); writeJSON(F.listings, st);
      const p = readJSON(F.profile, null);
      if (p) r.scores = r.results.map(x => { const l = st.listings.find(y => y.id === x.id); const s = scoreListing(l, p); return { id: x.id, score: s.score, band: s.band, gates: s.gates, ask: s.ask }; });
      console.log(JSON.stringify(r, null, 2)); break;
    }
    case "set": {
      const id = argv.shift(); const st = loadStore(); const l = st.listings.find(x => x.id === id); if (!l) die(`no listing ${id}`);
      for (const kv of argv) { const i = kv.indexOf("="); if (i < 1) die(`bad key=value: ${kv}`); const k = kv.slice(0, i), v = kv.slice(i + 1); if (k === "price" && l.price && Number(v) !== l.price) (l.priceHistory ||= []).push({ at: today(), from: l.price, to: Number(v) }); setPath(l, k, v); }
      l.updatedAt = Date.now(); writeJSON(F.listings, st); console.log(`✓ ${id} updated`); break;
    }
    case "dupes": console.log(JSON.stringify(suggestDupes(loadStore(), opt("id")), null, 2)); break;
    case "list": {
      const p = readJSON(F.profile, {}), st = loadStore(), s = opt("status"), b = opt("band"), active = opt("active");
      for (const l of st.listings) {
        if (l.dupOf || (s && l.status !== s) || (active && (l.taken || l.status === "no"))) continue;
        const r = scoreListing(l, p); if (b && r.band !== b) continue;
        console.log(`${l.id.padEnd(22)} ${String(l.status).padEnd(10)} ${String(r.score).padStart(3)} ${r.band.padEnd(7)} ${l.area || ""} ${l.price ?? ""} ${l.verify?.state || ""} ${l.url || ""}`);
      } break;
    }
    case "board": {
      const out = path.resolve(opt("out") || F.board); const mode = opt("mode") || "snapshot"; if (!["snapshot", "artifact"].includes(mode)) die("--mode snapshot|artifact"); fs.writeFileSync(out, buildBoard({ title: opt("title"), mode }));
      console.log(`✓ board written to ${out}`); break;
    }
    case "serve": serve(Number(opt("port") || 4173)); break;
    case "probe": {
      if (!argv.length) die("probe <url>...");
      for (const u of argv) console.log(JSON.stringify(await probe(u)));
      break;
    }
    case "geo": {
      const [a, b] = argv.map(s => s.split(",").map(Number)); if (!b || b.some(isNaN)) die("geo <lat,lng> <lat,lng>");
      const km = haversineKm(a, b); console.log(JSON.stringify({ straightKm: +km.toFixed(2), roadKmEst: +(km * 1.3).toFixed(1) })); break;
    }
    case "import": {
      const ch = readJSON(argv[0]); const st = loadStore();
      for (const l of ch.listings || []) { const i = st.listings.findIndex(x => x.id === l.id); if (i < 0) st.listings.push(l); else if ((l.updatedAt || 0) >= (st.listings[i].updatedAt || 0)) st.listings[i] = l; }
      for (const id of ch.deleted || []) st.listings = st.listings.filter(x => x.id !== id);
      for (const c of ch.comments || []) if (!st.comments.some(x => x.id === c.id)) st.comments.push(c);
      writeJSON(F.listings, st); console.log(`✓ merged ${(ch.listings || []).length} listings, ${(ch.comments || []).length} comments`); break;
    }
    case "export": {
      const p = readJSON(F.profile, {}), st = loadStore();
      if (opt("csv")) console.log(toCSV(st.listings.filter(l => !l.dupOf).map(l => { const r = scoreListing(l, p); return { ...l, score: r.score, band: r.band, agentName: l.agent?.name, agentPhone: l.agent?.phone }; })));
      else console.log(JSON.stringify(st, null, 2));
      break;
    }
    case "docs": { // one JSON file per artifact-db document, for seeding the shared board with the artifact data tool
      const out = path.resolve(argv[0] || path.join(DIR, "docs")), st = loadStore(), w = [];
      const put = (col, id, v) => { const f = path.join(out, col, id.replace(/[^\w.~:@+-]/g, "_") + ".json"); writeJSON(f, v); w.push({ op: "set", collection: col, doc_id: path.basename(f, ".json"), file_path: f }); };
      put("meta", "profile", profile());
      for (const l of st.listings) put("listings", l.id, l);
      for (const c of st.comments) put("comments", c.id, c);
      writeJSON(path.join(out, "writes.json"), w);
      console.log(`✓ ${w.length} documents in ${out}; batch writes (max 50 per batch) listed in writes.json`); break;
    }
    case "runlog": { const rec = JSON.parse(argv[0]); rec.at ||= new Date().toISOString(); fs.appendFileSync(F.runs, JSON.stringify(rec) + "\n"); console.log("✓ logged"); break; }
    case "reset": {
      if (!opt("yes")) die("reset needs --yes (it backs up first, then clears listings" + " and, without --keep-profile, the profile and sources)");
      const keep = opt("keep-profile"), stamp = new Date().toISOString().replace(/[:.]/g, "-"), dst = path.join(F.backups, stamp);
      fs.mkdirSync(dst, { recursive: true });
      for (const f of [F.profile, F.sources, F.listings, F.runs]) if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dst, path.basename(f)));
      writeJSON(F.listings, { listings: [], comments: [] }); if (fs.existsSync(F.runs)) fs.unlinkSync(F.runs);
      if (!keep) for (const f of [F.profile, F.sources]) if (fs.existsSync(f)) fs.unlinkSync(f);
      console.log(`✓ backed up to ${dst} and reset${keep ? " (profile kept)" : ""}`); break;
    }
    default:
      console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 22).map(l => l.replace(/^\/\/ ?/, "")).join("\n"));
  }
}
main();
