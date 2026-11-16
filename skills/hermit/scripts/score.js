// hermit scorer. Pure function, no dependencies, runs in Node and in the board page.
//
// scoreListing(listing, profile) -> {
//   score 0-100, band, parts{key:{pts,max,frac,note}}, gates[], flags[], ask[], confidence 0-1, rubric
// }
//
// Design rules (learned the hard way on a real hunt):
// - Scores are computed live from facts and never stored, so they can't go stale when facts or weights change.
// - Unknown facts score neutral-low, never zero and never full, and raise a question to ask the agent.
//   A sparse listing lands in "maybe", not "strong" and not "no-fit".
// - A gate (deal-breaker) caps the score below the weak band, whatever the points say.
// - Location is about the people's real destinations, not suburb names. Suburb tiers are a proxy;
//   coordinates plus anchors are the truth when we have them. Portals mislabel suburbs, so facts.realArea wins.
// - Partial areas ("only the side near the park") are zones. A listing on the wrong side is a gate.
// - Pets are matched by size: "small pets only" fails a household with medium dogs.

const RUBRIC_VERSION = "1.0";

const DEFAULT_WEIGHTS = {
  location: 20, price: 18, pets: 10, outdoor: 10, entertain: 5,
  layout: 15, type: 8, nearby: 6, timing: 5, features: 3,
};
const DEFAULT_BANDS = { strong: 85, good: 72, maybe: 58 };
const GATED_MAX = 39;
const ROAD_FACTOR = 1.3; // straight-line km to rough road km
// Data is always metric (km, m²). profile.units = "imperial" only changes what people read.
const imperial = p => p?.units === "imperial";
const fmtDist = (km, p, dp = 1) => imperial(p) ? `${(km / 1.609344).toFixed(dp)} mi` : `${km.toFixed(dp)} km`;
const fmtSize = (m2, p) => imperial(p) ? `${Math.round(m2 * 10.7639).toLocaleString("en-US")} sq ft` : `${m2} m²`;

const LEVELS = {
  pets: { yes: 1, permission: 0.8, likely: 0.5, unknown: 0.3, small_only: 0, cats_only: 0, no: 0 },
  outdoor: { large: 1, private: 0.8, small: 0.4, communal: 0.2, unknown: 0.3, none: 0 },
  entertain: {
    covered_patio_bbq: 1, private_pool: 0.9, covered_patio: 0.8, open_patio: 0.5,
    balcony: 0.5, shared_pool: 0.3, unknown: 0.2, none: 0,
  },
};

const norm = s => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const num = v => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (x, x0, x1, y0, y1) => (x1 === x0 ? y1 : y0 + (clamp01((x - x0) / (x1 - x0))) * (y1 - y0));

function haversineKm(a, b) {
  const R = 6371, rad = d => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function money(n, p) {
  if (n == null) return "?";
  const cur = p.currency || "";
  try {
    return new Intl.NumberFormat(p.locale || "en", { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format(n);
  } catch { return `${cur} ${Math.round(n)}`; }
}

function petPhrase(p) {
  const pets = p.household?.pets || [];
  if (!pets.length) return "";
  return pets.map(x => `${x.count || 1} ${x.size ? x.size + " " : ""}${x.kind}${(x.count || 1) > 1 ? "s" : ""}`).join(" and ");
}

function findArea(name, profile) {
  const n = norm(name);
  if (!n) return null;
  return (profile.areas || []).find(a => norm(a.name) === n || (a.aliases || []).some(x => norm(x) === n)) || null;
}

function inZone(zone, ll) {
  if (!zone || !ll) return null;
  if (zone.center && zone.radiusKm) return haversineKm(zone.center, ll) <= zone.radiusKm;
  if (zone.bbox) { // [south, west, north, east]
    const [s, w, n, e] = zone.bbox;
    return ll[0] >= s && ll[0] <= n && ll[1] >= w && ll[1] <= e;
  }
  return null;
}

function coords(l) {
  const lat = num(l.lat), lng = num(l.lng);
  return lat != null && lng != null ? [lat, lng] : null;
}

// Each part returns { frac 0-1, note?, known bool }. Gates, flags and questions go to ctx.
function partLocation(l, p, ctx) {
  const f = l.facts || {};
  const label = f.realArea || l.area || "";
  const ll = coords(l);
  if ((p.excludeAreas || []).some(x => norm(x) === norm(label))) {
    ctx.gate(`${label} is on your excluded list`);
    return { frac: 0, known: true };
  }
  let tierFrac = null, note;
  const area = findArea(label, p);
  if (p.areas?.length) {
    if (!area) {
      if (p.outsideAreas === "gate") ctx.gate(label ? `${label} is outside your areas` : "Area unknown");
      note = label ? `${label} is outside your areas` : "Area unknown";
      tierFrac = 0;
    } else {
      tierFrac = (p.tiers || {})[area.tier] ?? ({ 1: 1, 2: 0.8, 3: 0.6, 4: 0.5, 5: 0.3 })[area.tier] ?? 0.5;
      if (area.zone) {
        const side = f.subArea || (inZone(area.zone, ll) === true ? "near" : inZone(area.zone, ll) === false ? "far" : null);
        const want = area.zone.label || "the right part";
        if (side === "far") ctx.gate(`Wrong side of ${area.name} (you want ${want})`);
        else if (side !== "near") { tierFrac = Math.max(0, tierFrac - 0.15); ctx.ask(`Which part of ${area.name} is it in? You only want ${want}.`); }
      }
      if (area.valueMax && num(l.price) > area.valueMax) {
        tierFrac = Math.min(tierFrac, 0.2);
        ctx.cap(p.caps?.overValueMax ?? (p.bands?.good ?? DEFAULT_BANDS.good) - 1,
          `${area.name} is only worth it under ${money(area.valueMax, p)}`);
      }
    }
  }
  // Commute: distance from the listing to each anchor the household travels to.
  const anchors = (p.anchors || []).filter(a => num(a.lat) != null && num(a.lng) != null);
  let commuteFrac = null;
  if (anchors.length && ll) {
    let wsum = 0, acc = 0;
    for (const a of anchors) {
      const given = num(f.commuteKm?.[a.id]);
      const km = given ?? haversineKm(ll, [Number(a.lat), Number(a.lng)]) * ROAD_FACTOR;
      const ideal = num(a.idealKm) ?? 5, max = num(a.maxKm) ?? ideal * 3;
      const fr = km <= ideal ? 1 : km >= max ? 0 : lerp(km, ideal, max, 1, 0);
      if (km > max && a.hard) ctx.gate(`${a.label}: about ${fmtDist(km, p, 0)}, over your ${fmtDist(max, p, 0)} limit`);
      const w = num(a.weight) ?? 1;
      acc += fr * w; wsum += w;
      ctx.info(`${a.label} ~${fmtDist(km, p)}${given == null ? " (est.)" : ""}`);
    }
    commuteFrac = wsum ? acc / wsum : null;
  } else if (anchors.length && !ll) {
    ctx.flag("Add the address to check the commute");
  }
  if (tierFrac == null && commuteFrac == null) return { frac: 0.5, known: false, note: "No areas or anchors set" };
  const frac = tierFrac == null ? commuteFrac : commuteFrac == null ? tierFrac : 0.5 * tierFrac + 0.5 * commuteFrac;
  return { frac, known: !!(area || commuteFrac != null), note };
}

function monthlyRepayment(principal, annualRatePct, years) {
  const r = annualRatePct / 100 / 12, n = years * 12;
  if (!principal || principal <= 0) return 0;
  return r ? (principal * r) / (1 - (1 + r) ** -n) : principal / n;
}

function partPrice(l, p, ctx) {
  const price = num(l.price);
  const b = p.budget || {};
  const ideal = num(b.ideal), max = num(b.max) ?? ideal;
  if (price == null) { ctx.ask("What is the price?"); return { frac: 0.5, known: false, note: "Price unknown" }; }
  if (max != null && price > max) ctx.gate(`Over your max of ${money(max, p)}`);
  let frac = 1;
  if (ideal != null && max != null && price > ideal) frac = lerp(price, ideal, max, 1, 0.4);
  if (max != null && price > max) frac = 0;

  const f = l.facts || {};
  if (p.mode === "buy") {
    const fin = p.finance || {};
    const rate = num(fin.ratePct), years = num(fin.termYears) ?? 20, deposit = num(fin.deposit) ?? 0;
    const income = num(fin.monthlyNetIncome) ?? num(fin.monthlyGrossIncome);
    const running = (num(f.levies) ?? 0) + (num(f.rates) ?? 0);
    if (rate != null) {
      const rep = monthlyRepayment(price - deposit, rate, years);
      const total = rep + running;
      ctx.info(`Repayment ~${money(rep, p)}/mo${running ? ` + ${money(running, p)} levies/rates` : ""}`);
      if (income) {
        const share = total / income, limit = num(fin.maxShare) ?? 0.3;
        if (share > limit) {
          ctx.flag(`Monthly cost ~${Math.round(share * 100)}% of income (your limit ${Math.round(limit * 100)}%)`);
          frac = Math.min(frac, 0.3);
        }
      }
    }
    if (num(f.levies) == null) ctx.ask("What are the monthly levies / HOA fees?");
    if (num(f.rates) == null) ctx.ask("What are the monthly rates / property taxes?");
  } else {
    if (f.utilitiesIncluded === false) ctx.flag("Utilities are extra");
    if (num(f.extraMonthly)) {
      ctx.info(`Plus ~${money(num(f.extraMonthly), p)}/mo extras`);
      if (max != null && price + num(f.extraMonthly) > max) ctx.flag(`With extras it's over your max`);
    }
  }
  return { frac, known: true };
}

function partPets(l, p, ctx) {
  const pets = p.household?.pets || [];
  if (!pets.length) return { frac: 1, known: true, skip: true };
  const v = (l.facts || {}).pets || "unknown";
  const hasDog = pets.some(x => norm(x.kind) === "dog");
  const hasBig = pets.some(x => ["medium", "large", "big"].includes(norm(x.size)));
  const phrase = petPhrase(p);
  if (v === "no") ctx.gate("No pets allowed");
  if (v === "small_only" && (hasBig || !pets.every(x => norm(x.size) === "small"))) ctx.gate(`Small pets only (you have ${phrase})`);
  if (v === "cats_only" && hasDog) ctx.gate(`Cats only (you have ${phrase})`);
  if (["unknown", "likely", "permission"].includes(v)) ctx.ask(`Confirm ${phrase} are OK`);
  let frac = LEVELS.pets[v] ?? 0.3;
  if ((v === "small_only" || v === "cats_only") && !ctx.gated()) frac = 0.8;
  return { frac, known: v !== "unknown" };
}

function partLevel(kind, l, p, ctx) {
  const want = p.requirements?.[kind] || "nice";
  if (want === "ignore") return { frac: 1, known: true, skip: true };
  const v = (l.facts || {})[kind] || "unknown";
  if (want === "must" && v === "none") ctx.gate(kind === "outdoor" ? "No garden or outdoor space" : "No entertaining space");
  if (v === "unknown") ctx.ask(kind === "outdoor" ? "Is there a private garden?" : "Is there a patio or entertainment area?");
  return { frac: LEVELS[kind][v] ?? 0.3, known: v !== "unknown" };
}

function partLayout(l, p, ctx) {
  const r = p.requirements || {};
  const beds = num(l.beds), baths = num(l.baths), size = num(l.sizeM2);
  const bMin = num(r.beds?.min), bIdeal = num(r.beds?.ideal) ?? bMin;
  const tMin = num(r.baths?.min), tIdeal = num(r.baths?.ideal) ?? tMin;
  const sIdeal = num(r.sizeM2?.ideal), sMin = num(r.sizeM2?.min);
  const fit = (v, min, ideal, overFrac) => {
    if (v == null) return 0.45;
    if (min != null && v < min) return 0;
    if (ideal == null || v === ideal) return 1;
    if (v > ideal) return overFrac;
    return min != null && ideal > min ? lerp(v, min, ideal, 0.7, 1) : 0.7;
  };
  if (beds != null && bMin != null && beds < bMin) ctx.gate(`Under ${bMin} bedrooms`);
  if (baths != null && tMin != null && baths < tMin) {
    ctx.flag(`Only ${baths} bathroom${baths === 1 ? "" : "s"}`);
    ctx.cap(p.caps?.bathsBelowMin ?? (p.bands?.good ?? DEFAULT_BANDS.good) - 8, `Fewer bathrooms than you need`);
  }
  if (size != null && sMin != null && size < sMin) ctx.flag(`Small: ${fmtSize(size, p)} (you want ${fmtSize(sMin, p)}+)`);
  if (beds == null) ctx.ask("How many bedrooms?");
  // A bigger place than needed scores a little lower (it usually costs more for space you don't use);
  // set requirements.beds.overOk to score it full.
  const bFrac = fit(beds, bMin, bIdeal, r.beds?.overOk ? 1 : 0.6);
  const tFrac = baths == null ? 0.45 : tMin != null && baths < tMin ? 0 : tIdeal != null && baths >= tIdeal ? 1 : tMin != null && tIdeal > tMin ? lerp(baths, tMin, tIdeal, 0.5, 1) : 1;
  if (sIdeal != null) {
    const sFrac = size == null ? 0.45 : size >= sIdeal ? 1 : sMin != null ? lerp(size, sMin, sIdeal, 0.3, 1) : clamp01(size / sIdeal);
    return { frac: 0.45 * bFrac + 0.35 * tFrac + 0.2 * sFrac, known: beds != null && baths != null };
  }
  return { frac: 0.54 * bFrac + 0.46 * tFrac, known: beds != null && baths != null };
}

function partType(l, p, ctx) {
  const t = p.requirements?.types || {};
  const raw = norm(l.type), v = ({ house_in_estate: "gated_house", "house in estate": "gated_house" })[raw] || raw; // old name
  if (!v || v === "unknown") return { frac: 0.5, known: false };
  if ((t.excluded || []).map(norm).includes(v)) ctx.gate(`${l.type} is excluded`);
  const pref = (t.preferred || []).map(norm), acc = (t.acceptable || []).map(norm);
  if (pref.includes(v)) return { frac: Math.max(0.7, 1 - 0.08 * pref.indexOf(v)), known: true };
  if (acc.includes(v)) return { frac: 0.6, known: true };
  return { frac: (t.excluded || []).map(norm).includes(v) ? 0 : 0.4, known: true };
}

function partNearby(l, p, ctx) {
  const list = p.nearby || [];
  if (!list.length) return { frac: 1, known: true, skip: true };
  const got = (l.facts || {}).nearby || {};
  let acc = 0, known = 0;
  for (const n of list) {
    const km = num(got[n.id]);
    const ideal = num(n.idealKm) ?? 1, max = num(n.maxKm) ?? ideal * 3;
    if (km == null) { acc += 0.33; ctx.flag(`Check for ${n.label} nearby`); continue; }
    known++;
    if (km > max) ctx.flag(`No ${n.label} within ${fmtDist(max, p)}`);
    else ctx.info(`${n.label}: ${fmtDist(km, p)}`);
    acc += km <= ideal ? 1 : km >= max ? 0 : lerp(km, ideal, max, 1, 0.33);
  }
  return { frac: acc / list.length, known: known === list.length };
}

function partTiming(l, p, ctx) {
  const m = p.moveIn || {};
  const raw = (l.facts || {}).available ?? l.available;
  if (!raw) { ctx.ask("When is it available?"); return { frac: 0.6, known: false }; }
  const now = String(raw).toLowerCase() === "now" || String(raw).toLowerCase() === "immediately";
  const d = now ? new Date(ctx.today) : new Date(raw);
  if (isNaN(d)) { ctx.ask("Confirm the move-in date"); return { frac: 0.6, known: false }; }
  const ymd = d.toISOString().slice(0, 10);
  if (!now && m.earliest && ymd < ctx.today && (new Date(ctx.today) - d) / 864e5 > 60) {
    ctx.flag("Availability date is months old: the listing may be stale");
  }
  if (m.hardLatest && ymd > m.hardLatest) ctx.gate(`Only available from ${ymd}`);
  if (m.earliest && ymd < m.earliest) {
    if (p.mode !== "buy") ctx.flag(`Available before ${m.earliest}: negotiate the start date`);
    return { frac: 0.6, known: true };
  }
  if (!m.latest || ymd <= m.latest) return { frac: 1, known: true };
  return { frac: 0.4, known: true };
}

function partFeatures(l, p, ctx) {
  const want = p.requirements?.features || {};
  const have = (l.facts || {}).features || {};
  const nice = Object.keys(want).filter(k => want[k] === "nice");
  for (const k of Object.keys(want)) {
    const label = FEATURE_LABELS[k] || k;
    if (want[k] === "must" && have[k] === false) ctx.gate(`No ${label}`);
    if (want[k] === "must" && have[k] == null) ctx.ask(`Is there ${label}?`);
    if (want[k] === "avoid" && have[k] === true) ctx.flag(`Has ${label} (you'd rather not)`);
  }
  if (!nice.length) return { frac: 1, known: true, skip: !Object.keys(want).length };
  const n = nice.filter(k => have[k] === true).length;
  return { frac: n / nice.length, known: nice.every(k => have[k] != null) };
}

const FEATURE_LABELS = {
  backupPower: "backup power", fibre: "fibre internet", security: "24h security / access control",
  parking2: "2+ covered parking", pool: "a pool", study: "a study", furnished: "furniture",
  aircon: "air conditioning", lift: "a lift", laundry: "a laundry", storage: "storage",
  ev: "EV charging", solar: "solar", schoolZone: "the school zone",
};

const PARTS = {
  location: partLocation, price: partPrice, pets: partPets,
  outdoor: (l, p, c) => partLevel("outdoor", l, p, c), entertain: (l, p, c) => partLevel("entertain", l, p, c),
  layout: partLayout, type: partType, nearby: partNearby, timing: partTiming, features: partFeatures,
};

function scoreListing(listing, profile, opts = {}) {
  const p = profile || {};
  const l = listing || {};
  const gates = [], flags = [], ask = [], info = [], caps = [];
  const ctx = {
    today: opts.today || new Date().toISOString().slice(0, 10),
    gate: m => gates.includes(m) || gates.push(m),
    flag: m => flags.includes(m) || flags.push(m),
    ask: m => ask.includes(m) || ask.push(m),
    info: m => info.includes(m) || info.push(m),
    cap: (v, why) => caps.push({ v, why }),
    gated: () => gates.length > 0,
  };
  const weights = { ...DEFAULT_WEIGHTS, ...(p.weights || {}) };
  const raw = {};
  for (const [k, fn] of Object.entries(PARTS)) raw[k] = weights[k] > 0 ? fn(l, p, ctx) : { frac: 0, skip: true, known: true };
  // Parts that don't apply (no pets, ignored criteria) hand their weight to the rest, so the total stays 100.
  const live = Object.keys(raw).filter(k => !raw[k].skip && weights[k] > 0);
  const total = live.reduce((a, k) => a + weights[k], 0) || 1;
  const parts = {};
  let score = 0, knownW = 0;
  for (const k of live) {
    const max = (weights[k] / total) * 100;
    const pts = raw[k].frac * max;
    parts[k] = { pts: Math.round(pts * 10) / 10, max: Math.round(max * 10) / 10, frac: Math.round(raw[k].frac * 100) / 100, known: raw[k].known };
    if (raw[k].note) { parts[k].note = raw[k].note; ctx.flag(raw[k].note); }
    if (raw[k].known) knownW += max;
    score += pts;
  }
  score = Math.round(score);
  for (const c of caps) if (score > c.v) { score = c.v; ctx.flag(c.why); }
  if (l.taken) ctx.flag("Marked taken");
  if (l.verify?.state === "unverified") ctx.flag("Couldn't re-check the listing page (site error); it may still be available");
  if (gates.length) score = Math.min(score, GATED_MAX);
  const bands = { ...DEFAULT_BANDS, ...(p.bands || {}) };
  const band = gates.length ? "no-fit" : score >= bands.strong ? "strong" : score >= bands.good ? "good" : score >= bands.maybe ? "maybe" : "weak";
  return { score, band, parts, gates, flags, ask, info, confidence: Math.round(knownW) / 100, rubric: RUBRIC_VERSION };
}

const normWords = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Duplicate likelihood 0-1. Cross-posts rarely share an id or URL: agencies reword the address,
// round the price and miscount bays. Weigh what survives syndication.
function dupLikelihood(a, b) {
  if (a.id === b.id) return 0;
  let s = 0;
  const tok = x => new Set(normWords(x).split(" ").filter(w => w.length > 2 && !/^(the|and|for|rent|sale|unit|road|street|avenue|drive|close|lane|estate|complex)$/.test(w)));
  const overlap = (x, y) => { const A = tok(x), B = tok(y); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size); };
  const areaA = normWords(a.facts?.realArea || a.area), areaB = normWords(b.facts?.realArea || b.area);
  if (areaA && areaB && areaA !== areaB) return 0;
  if (a.complex && b.complex && normWords(a.complex) === normWords(b.complex)) s += 0.45;
  s += 0.35 * overlap(a.address, b.address);
  if (a.lat && b.lat && haversineKm([a.lat, a.lng], [b.lat, b.lng]) < 0.08) s += 0.3;
  if (a.price && b.price && Math.abs(a.price - b.price) / Math.max(a.price, b.price) <= 0.06) s += 0.15;
  if (a.beds && a.beds === b.beds) s += 0.1;
  if (a.baths && a.baths === b.baths) s += 0.05;
  if (a.sizeM2 && b.sizeM2 && Math.abs(a.sizeM2 - b.sizeM2) / Math.max(a.sizeM2, b.sizeM2) <= 0.05) s += 0.2;
  if (a.agent?.phone && b.agent?.phone && normWords(a.agent.phone) === normWords(b.agent.phone)) s += 0.15;
  if (a.photo && b.photo && a.photo === b.photo) s += 0.5;
  return Math.min(1, s);
}

const API = { dupLikelihood, scoreListing, haversineKm, fmtDist, fmtSize, monthlyRepayment, RUBRIC_VERSION, DEFAULT_WEIGHTS, DEFAULT_BANDS, LEVELS, FEATURE_LABELS };
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (typeof window !== "undefined") window.HomeHuntScore = API;
