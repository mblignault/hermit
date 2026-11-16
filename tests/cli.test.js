const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const HH = path.join(__dirname, "../skills/home-hunt/scripts/hh.js");
const run = (dir, ...a) => execFileSync("node", [HH, "--dir", dir, ...a], { encoding: "utf8" });

test("init → add → set → dupes → board → reset round trip", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hh-"));
  run(dir, "init");
  assert.ok(fs.existsSync(path.join(dir, "profile.json")));
  assert.equal(fs.readFileSync(path.join(dir, ".gitignore"), "utf8").trim().endsWith("*"), true);
  fs.copyFileSync(path.join(__dirname, "../skills/home-hunt/examples/demo/profile.json"), path.join(dir, "profile.json"));
  const demo = require("../skills/home-hunt/examples/demo/listings.json").listings;
  const f = path.join(dir, "in.json"); fs.writeFileSync(f, JSON.stringify(demo.slice(0, 2)));
  const out = JSON.parse(run(dir, "add", f));
  assert.equal(out.results.length, 2);
  assert.ok(out.possibleDuplicates.length >= 1, "cross-post should be suggested");
  run(dir, "set", "demo-1001", "price=2200", "facts.pets=permission");
  const st = JSON.parse(fs.readFileSync(path.join(dir, "listings.json"), "utf8"));
  const l = st.listings.find(x => x.id === "demo-1001");
  assert.equal(l.price, 2200); assert.equal(l.facts.pets, "permission"); assert.equal(l.priceHistory.length, 1);
  assert.match(run(dir, "validate"), /OK/);
  run(dir, "board");
  const html = fs.readFileSync(path.join(dir, "board.html"), "utf8");
  assert.ok(html.includes("demo-1001") && !html.includes('"__DATA__"') && !html.includes("/*__SCORER__*/"));
  assert.match(run(dir, "reset", "--yes", "--keep-profile"), /backed up/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "listings.json"), "utf8")).listings.length, 0);
  assert.ok(fs.existsSync(path.join(dir, "profile.json")));
});

test("check is a dry run; asks lists open questions; unknown commands fail", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hh-"));
  fs.copyFileSync(path.join(__dirname, "../skills/home-hunt/examples/demo/profile.json"), path.join(dir, "profile.json"));
  const f = path.join(dir, "in.json");
  fs.writeFileSync(f, JSON.stringify({ id: "x-1", area: "Riverside", price: 2200, beds: 3, baths: 2, facts: { pets: "small_only" } }));
  const out = JSON.parse(run(dir, "check", f));
  assert.equal(out.dryRun, true);
  assert.equal(out.scores[0].band, "no-fit");
  assert.equal(fs.existsSync(path.join(dir, "listings.json")), false, "check must not write");
  fs.writeFileSync(f, JSON.stringify({ id: "x-2", area: "Riverside", price: 2200, beds: 3, baths: 2 }));
  run(dir, "add", f);
  assert.match(run(dir, "asks"), /medium dogs/);
  assert.throws(() => run(dir, "frobnicate"), e => e.status === 1);
  assert.throws(() => run(path.join(dir, "missing"), "score"), e => /Run setup first/.test(e.stderr));
});
