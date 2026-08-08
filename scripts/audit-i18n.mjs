#!/usr/bin/env node
/**
 * i18n coverage audit.
 *
 * Detects, across the centralized UI dictionary (lib/i18n/ui.ts) and the table-header
 * dictionary (lib/i18n/table-headers.ts):
 *   - keys present in English but MISSING in ur / ar / fa / ps
 *   - keys whose translation is identical to English (likely untranslated placeholder)
 *
 * Exit code is non-zero when gaps are found, so it can gate CI.
 *
 * Usage:  node scripts/audit-i18n.mjs            (summary)
 *         node scripts/audit-i18n.mjs --list     (list every offending key)
 */
import fs from "node:fs";

const LANGS = ["en", "ur", "ar", "fa", "ps"];
const listMode = process.argv.includes("--list");

/** Parse a `const <lang>: Dict = { "k": "v", ... }` block into a Map. */
function parseDictBlock(src, lang) {
  const start = src.search(new RegExp(`const ${lang}\\s*:\\s*Dict\\s*=\\s*\\{`));
  if (start === -1) return null;
  const braceStart = src.indexOf("{", start);
  let depth = 0, i = braceStart, end = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = src.slice(braceStart + 1, end);
  const map = new Map();
  // match "key": "value"  (values may contain escaped quotes)
  for (const m of body.matchAll(/"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    map.set(m[1], m[2]);
  }
  return map;
}

function auditUi() {
  const src = fs.readFileSync("lib/i18n/ui.ts", "utf8");
  const dicts = {};
  for (const l of LANGS) dicts[l] = parseDictBlock(src, l);
  if (!dicts.en) { console.error("Could not parse en dict from ui.ts"); process.exit(2); }

  const missing = { ur: [], ar: [], fa: [], ps: [] };
  const untranslated = { ur: [], ar: [], fa: [], ps: [] };
  for (const [key, enVal] of dicts.en) {
    for (const l of ["ur", "ar", "fa", "ps"]) {
      const d = dicts[l];
      if (!d || !d.has(key)) missing[l].push(key);
      else if (d.get(key) === enVal && /[A-Za-z]/.test(enVal)) untranslated[l].push(key);
    }
  }
  return { total: dicts.en.size, missing, untranslated };
}

function auditTableHeaders() {
  const src = fs.readFileSync("lib/i18n/table-headers.ts", "utf8");
  const entries = [...src.matchAll(/"((?:[^"\\]|\\.)*)"\s*:\s*\{([^}]*)\}/g)];
  const incomplete = [];
  for (const m of entries) {
    const key = m[1], body = m[2];
    const langsPresent = ["ur", "ar", "fa", "ps"].filter((l) => new RegExp(`\\b${l}\\s*:\\s*"`).test(body));
    if (langsPresent.length < 4) incomplete.push({ key, has: langsPresent });
  }
  return { total: entries.length, incomplete };
}

// Guard: in ur/ar/fa/ps dicts, no translation key may appear BEFORE the `...en` spread —
// anything before it is silently overridden by English at runtime.
function auditSpreadOrder() {
  const src = fs.readFileSync("lib/i18n/ui.ts", "utf8");
  const lines = src.split("\n");
  const bad = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^const (ur|ar|fa|ps): Dict = \{/);
    if (!m) continue;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*\.\.\.en,\s*$/.test(lines[j])) break;
      if (/^\s*"[^"]+"\s*:/.test(lines[j])) { bad.push(`${m[1]}: line ${j + 1} — key before ...en spread (dead override)`); }
      if (/^\};/.test(lines[j])) break;
    }
  }
  return bad;
}

const ui = auditUi();
const th = auditTableHeaders();
const spreadIssues = auditSpreadOrder();

console.log("═══ i18n Coverage Audit ═══\n");
console.log(`UI dictionary (lib/i18n/ui.ts): ${ui.total} keys (English baseline)`);
let uiGap = 0;
for (const l of ["ur", "ar", "fa", "ps"]) {
  const miss = ui.missing[l].length, unt = ui.untranslated[l].length;
  uiGap += miss + unt;
  console.log(`  ${l}: ${miss} missing, ${unt} identical-to-English (likely untranslated)`);
  if (listMode) {
    if (miss) console.log(`     MISSING: ${ui.missing[l].join(", ")}`);
    if (unt) console.log(`     UNTRANSLATED: ${ui.untranslated[l].join(", ")}`);
  }
}
console.log(`\nTable-header dictionary (lib/i18n/table-headers.ts): ${th.total} entries`);
console.log(`  ${th.incomplete.length} entries missing one or more of ur/ar/fa/ps`);
if (listMode && th.incomplete.length) {
  for (const e of th.incomplete) console.log(`     ${e.key}  (has: ${e.has.join(",") || "none"})`);
}

if (spreadIssues.length) {
  console.log(`\n⚠️ SPREAD-ORDER ISSUES (keys silently overridden by English):`);
  for (const s of spreadIssues) console.log("   " + s);
}

console.log(`\nTOTAL UI GAPS: ${uiGap} | TABLE-HEADER GAPS: ${th.incomplete.length} | SPREAD ISSUES: ${spreadIssues.length}`);
if (uiGap > 0 || th.incomplete.length > 0 || spreadIssues.length > 0) {
  console.log("\n❌ Localization incomplete — fill the gaps above.");
  process.exitCode = 1;
} else {
  console.log("\n✅ All keys have all 5 languages.");
}
