#!/usr/bin/env node
// Blocks personal data from reaching a public repo.
// 1. Generic patterns (emails, phone numbers, national ID-like numbers, real-portal listing URLs, coordinates).
// 2. Your own denylist, kept OUTSIDE the repo so it can never be committed or zipped by accident:
//    one term per line in ~/.config/hermit/privacy-denylist (or the file in $PRIVACY_DENYLIST_FILE),
//    plus $PRIVACY_DENYLIST (comma-separated).
//    Put names, street names, suburbs, employers, pet names and listing numbers from your own hunt in it.
// Usage: node tools/privacy-scan.js [files...]   (default: every file git would commit)
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const ALLOW = [/noreply@/i, /@example\.(com|org|net)/i, /users\.noreply\.github\.com/i];
const PATTERNS = [
  ["email address", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ["phone number", /(?<![\w.])(?:\+\d{1,3}[\s-]?)?\(?0?\d{2,3}\)?[\s-]\d{3}[\s-]\d{3,4}(?![\w.])/g],
  ["13-digit ID number", /(?<!\d|"(?:at|createdAt|updatedAt)": )\d{13}(?!\d)/g],
  ["real portal listing URL", /(?:property24\.com|privateproperty\.co\.za|rightmove\.co\.uk|zoopla\.co\.uk|zillow\.com|realestate\.com\.au|domain\.com\.au|daft\.ie)\/[^\s"')]*\d{6,}/gi],
  ["personal artifact link", /claude\.ai\/(?:code\/)?artifact\/[\w-]+/gi],
];
let files = process.argv.slice(2);
if (!files.length) {
  try { files = execSync("git ls-files -co --exclude-standard", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean); }
  catch { console.error("not a git repo: pass files explicitly"); process.exit(2); }
}
files = files.filter(f => !/^tools\/privacy-scan\.js$|\.png$|\.jpe?g$|\.gif$|\.ico$|\.pdf$/i.test(f));
const deny = [
  ...[process.env.PRIVACY_DENYLIST_FILE || path.join(os.homedir(), ".config", "hermit", "privacy-denylist"), path.join(root, ".privacy-denylist")]
    .flatMap(f => fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n") : []),
  ...(process.env.PRIVACY_DENYLIST || "").split(","),
].map(s => s.trim()).filter(s => s && !s.startsWith("#"));
const hits = [];
for (const f of files) {
  const p = path.resolve(root, f); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) continue;
  const lines = fs.readFileSync(p, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const [label, re] of PATTERNS) for (const m of line.matchAll(re)) if (!ALLOW.some(a => a.test(m[0]))) hits.push(`${f}:${i + 1}  ${label}: ${m[0]}`);
    for (const term of deny) if (line.toLowerCase().includes(term.toLowerCase())) hits.push(`${f}:${i + 1}  denylisted term: ${term}`);
  });
}
if (hits.length) { console.error("✗ Possible personal data:\n" + hits.join("\n")); process.exit(1); }
console.log(`✓ privacy scan clean (${files.length} files, ${deny.length} denylisted terms)`);
