const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { scoreListing, dupLikelihood, monthlyRepayment } = require("../skills/home-hunt/scripts/score.js");
const profile = require("../examples/demo/profile.json");
const { listings } = require("../examples/demo/listings.json");
const TODAY = { today: "2027-02-01" };
const byId = id => listings.find(l => l.id === id);
const s = (l, p = profile) => scoreListing(l, p, TODAY);

test("weights normalise to 100 and a perfect listing scores at the top", () => {
  const r = s(byId("demo-1001"));
  const max = Object.values(r.parts).reduce((a, p) => a + p.max, 0);
  assert.ok(Math.abs(max - 100) < 0.5, `max ${max}`);
  assert.equal(r.band, "strong");
  assert.equal(r.gates.length, 0);
});

test("gates cap the score at 39 whatever the points", () => {
  for (const id of ["demo-1003", "demo-1005", "demo-1006"]) {
    const r = s(byId(id));
    assert.equal(r.band, "no-fit", id);
    assert.ok(r.score <= 39, id);
  }
});

test("small-pets-only fails a household with medium dogs but not one with a cat", () => {
  const l = byId("demo-1005");
  assert.match(s(l).gates.join(), /Small pets only/);
  const catHome = { ...profile, household: { ...profile.household, pets: [{ kind: "cat", size: "small", count: 1 }] } };
  assert.ok(!s(l, catHome).gates.some(g => /pets/i.test(g)));
});

test("no pets in the household drops the pets part and redistributes its weight", () => {
  const noPets = { ...profile, household: { ...profile.household, pets: [] } };
  const r = s(byId("demo-1001"), noPets);
  assert.equal(r.parts.pets, undefined);
  const max = Object.values(r.parts).reduce((a, p) => a + p.max, 0);
  assert.ok(Math.abs(max - 100) < 0.5);
});

test("unknown facts are neutral: never strong, never gated, and they create questions", () => {
  const bare = { id: "x", area: "Riverside", price: 2200 };
  const r = s(bare);
  assert.equal(r.gates.length, 0);
  assert.ok(r.score >= 40 && r.score < 85, `score ${r.score}`);
  assert.ok(r.ask.length >= 3);
  assert.ok(r.confidence < 0.6);
});

test("zones: outside is a gate, unconfirmed costs a little and asks, inside is full", () => {
  const base = { id: "z", area: "Oakridge", price: 2200, beds: 3, baths: 2, type: "cluster", facts: { pets: "yes", outdoor: "private" } };
  const far = s({ ...base, lat: 45.54, lng: 10.06 });
  const near = s({ ...base, lat: 45.512, lng: 10.018 });
  const unknown = s(base);
  assert.match(far.gates.join(), /Wrong side of Oakridge/);
  assert.equal(near.gates.length, 0);
  assert.ok(unknown.ask.some(a => /Which part of Oakridge/.test(a)));
  assert.ok(unknown.parts.location.pts < s({ ...base, facts: { ...base.facts, subArea: "near" } }).parts.location.pts);
});

test("valueMax caps fringe areas at maybe", () => {
  const l = { id: "v", area: "Hillcrest", price: 2300, beds: 3, baths: 2, type: "house_in_estate", facts: { pets: "yes", outdoor: "large", entertain: "covered_patio_bbq", subArea: "near", available: "2027-03-01", nearby: { local: 0.5 }, features: { backupPower: true, fibre: true, security: true } } };
  const r = s(l);
  assert.ok(r.score <= profile.bands.good - 1, `score ${r.score}`);
});

test("realArea overrides a mislabelled suburb", () => {
  const l = byId("demo-1002");
  assert.equal(s({ ...l, facts: { ...l.facts, realArea: undefined } }).parts.location.frac < s(l).parts.location.frac, true);
});

test("over max price is a gate; between ideal and max scales down", () => {
  const base = byId("demo-1001");
  assert.match(s({ ...base, price: 2700 }).gates.join(), /Over your max/);
  assert.ok(s({ ...base, price: 2500 }).parts.price.frac < 1);
});

test("timing: after hardLatest gates, stale availability is flagged", () => {
  const base = byId("demo-1001");
  assert.match(s({ ...base, facts: { ...base.facts, available: "2027-06-01" } }).gates.join(), /Only available/);
  assert.ok(s({ ...base, facts: { ...base.facts, available: "2026-09-01" } }).flags.some(f => /stale/.test(f)));
});

test("cross-posts are detected; different places are not", () => {
  assert.ok(dupLikelihood(byId("demo-1001"), byId("demo-1002")) >= 0.7);
  assert.ok(dupLikelihood(byId("demo-1001"), byId("demo-1007")) < 0.5);
});

test("buy mode: repayment maths and affordability flag", () => {
  const r = monthlyRepayment(1_000_000, 10, 20);
  assert.ok(Math.abs(r - 9650.22) < 1, String(r));
  const buy = { ...profile, mode: "buy", budget: { ideal: 400000, max: 450000 }, finance: { monthlyNetIncome: 6000, deposit: 40000, ratePct: 6.5, termYears: 30, maxShare: 0.3 } };
  const l = { id: "b", area: "Riverside", price: 440000, beds: 3, baths: 2, facts: { levies: 300, rates: 250 } };
  const res = s(l, buy);
  assert.ok(res.flags.some(f => /of income/.test(f)), res.flags.join("|"));
  assert.ok(res.info.some(i => /Repayment/.test(i)));
});

test("scores are deterministic for the same inputs", () => {
  assert.deepEqual(s(byId("demo-1004")), s(byId("demo-1004")));
});
