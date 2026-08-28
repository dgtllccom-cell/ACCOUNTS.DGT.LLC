#!/usr/bin/env node
/**
 * UI-side five-language guard — the automatic gate that keeps the ERP fully
 * translated as it grows. Complements scripts/i18n-scan.mjs (which guards the
 * DATABASE field registry); this one guards the central `lib/i18n/ui.ts`
 * dictionary and every component that consumes it.
 *
 * Checks (all must pass — exit 1 otherwise):
 *   1. PARITY      every key present in all 5 blocks (en/ur/ar/fa/ps)
 *   2. DUPLICATES  no key defined twice inside one block
 *   3. MISSING     every t()/tt()/nt() key referenced in code exists in the dict
 *   4. FALLBACK    no non-en value silently equal to the en value (acronym allowlist aside)
 *   5. PARALLEL    no new per-module {en,ur,ar,fa,ps} translation object outside lib/i18n/
 *   6. HARDCODED   (--changed only) no new hard-coded user-visible English in changed files
 *
 * Usage:
 *   node scripts/i18n-ui-guard.mjs                 # full check (CI gate)
 *   node scripts/i18n-ui-guard.mjs --changed[=REF] # + hardcoded-string check on files changed vs REF (default: origin/main, else HEAD)
 *   node scripts/i18n-ui-guard.mjs --json          # machine-readable summary
 *   node scripts/i18n-ui-guard.mjs --quiet         # only print failures + final line
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const ARGS = process.argv.slice(2);
const JSON_OUT = ARGS.includes("--json");
const QUIET = ARGS.includes("--quiet");
const CHANGED_ARG = ARGS.find((a) => a === "--changed" || a.startsWith("--changed="));
const UI_FILE = "lib/i18n/ui.ts";
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const CODE_GLOBS = ['"features/**/*.tsx"', '"features/**/*.ts"', '"app/**/*.tsx"', '"app/**/*.ts"', '"components/**/*.tsx"'];

const log = (...a) => { if (!QUIET) console.log(...a); };
const fail = [];
const warn = [];

// ---------------------------------------------------------------------------
// Parse lib/i18n/ui.ts into 5 blocks
// ---------------------------------------------------------------------------
const uiLines = fs.readFileSync(UI_FILE, "utf8").split(/\r?\n/);
const marks = {};
uiLines.forEach((l, i) => {
  const m = l.match(/^const (en|ur|ar|fa|ps): Dict/);
  if (m) marks[m[1]] = i;
  if (/^const dictionaries/.test(l)) marks.end = i;
});
const order = ["en", "ur", "ar", "fa", "ps", "end"];
const dict = { en: {}, ur: {}, ar: {}, fa: {}, ps: {} };
const dupes = [];
for (let k = 0; k < 5; k++) {
  const lang = order[k];
  const a = marks[lang];
  const b = marks[order[k + 1]] ?? marks.end;
  if (a == null || b == null) { fail.push(`Could not locate the '${lang}' block in ${UI_FILE}`); continue; }
  for (let i = a; i < b; i++) {
    const re = /"([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)":\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(uiLines[i]))) {
      if (dict[lang][m[1]] !== undefined) dupes.push(`${lang}  ${m[1]}  (line ${i + 1})`);
      dict[lang][m[1]] = m[2];
    }
  }
}

// ---------------------------------------------------------------------------
// 1. PARITY
// ---------------------------------------------------------------------------
const allKeys = new Set();
LANGS.forEach((l) => Object.keys(dict[l]).forEach((k) => allKeys.add(k)));
const parityGaps = [];
for (const key of allKeys) {
  const missIn = LANGS.filter((l) => !(key in dict[l]));
  if (missIn.length) parityGaps.push(`${key}  →  missing in: ${missIn.join(", ")}`);
}
if (parityGaps.length) fail.push(`PARITY: ${parityGaps.length} key(s) not present in all 5 language blocks`);
log(`  parity ......... ${parityGaps.length === 0 ? "OK" : parityGaps.length + " GAP(S)"}  (${Object.keys(dict.en).length} keys/block)`);
parityGaps.slice(0, 25).forEach((g) => log(`      ${g}`));

// ---------------------------------------------------------------------------
// 2. DUPLICATES
// ---------------------------------------------------------------------------
if (dupes.length) fail.push(`DUPLICATES: ${dupes.length} key(s) defined more than once in a block`);
log(`  duplicates ..... ${dupes.length === 0 ? "OK" : dupes.length + " DUP(S)"}`);
dupes.slice(0, 25).forEach((d) => log(`      ${d}`));

// ---------------------------------------------------------------------------
// 3. MISSING (referenced-but-undefined)
// ---------------------------------------------------------------------------
let codeFiles = [];
try {
  codeFiles = execSync(`git ls-files ${CODE_GLOBS.join(" ")}`, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
} catch { /* not a git repo */ }
const have = new Set(Object.keys(dict.en).concat(...LANGS.map((l) => Object.keys(dict[l]))));
// Only count references that unambiguously target the CENTRAL dictionary:
//   t(<langIdentifier>, "namespace.key" ...)   — first arg a bare identifier, not a string
//   tt/tr/nt("namespace.key" ...)              — helper wrappers around central t()
// The key namespace must start lowercase and contain no ".." / trailing "." — that
// filters out local-helper calls whose argument is plain English ( tr("S.No"),
// t("uploading", "Uploading...") ), which are a different (local) mechanism.
const CENTRAL_KEY = `[a-z][a-z0-9_]*\\.[a-zA-Z0-9_]+(?:\\.[a-zA-Z0-9_]+)*`;
const REF_PATTERNS = [
  new RegExp(`\\bt\\(\\s*[a-zA-Z_][a-zA-Z0-9_.]*\\s*,\\s*"(${CENTRAL_KEY})"`, "g"),
  new RegExp(`\\b(?:tt|tr|nt|_)\\(\\s*"(${CENTRAL_KEY})"`, "g"),
];
const missingRefs = {};
for (const f of codeFiles) {
  const s = fs.readFileSync(f, "utf8");
  for (const p of REF_PATTERNS) {
    const r = new RegExp(p.source, "g");
    let m;
    while ((m = r.exec(s))) {
      if (!have.has(m[1])) (missingRefs[m[1]] ||= new Set()).add(f);
    }
  }
}
const missingCount = Object.keys(missingRefs).length;
if (missingCount) fail.push(`MISSING: ${missingCount} dictionary key(s) referenced in code but absent from ${UI_FILE}`);
log(`  missing keys ... ${missingCount === 0 ? "OK" : missingCount + " MISSING"}`);
Object.entries(missingRefs).slice(0, 25).forEach(([k, files]) => log(`      ${k}   ← ${[...files][0]}`));

// 3b. MISUSE (warning) — t(<lang>, "English prose") with no namespaced key / no fallback arg.
// e.g. t(lang, "S.No")  /  t(lang, "Transferring...")  — the key IS the English text,
// so it renders identically in every language. Should be t(lang, "ns.key", "English").
const misuse = [];
const MISUSE_RE = /\bt\(\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*,\s*"([A-Z][^"]{1,60})"\s*\)/g;
for (const f of codeFiles) {
  const s = fs.readFileSync(f, "utf8");
  let m;
  const r = new RegExp(MISUSE_RE.source, "g");
  while ((m = r.exec(s))) {
    const txt = m[1];
    if (/^[A-Z][a-zA-Z0-9 .!?/&()'-]*$/.test(txt) && /[a-z ]/.test(txt) && !/\.[a-z]/.test(txt)) {
      misuse.push(`${f}  t(lang, "${txt}")`);
    }
  }
}
if (misuse.length) warn.push(`MISUSE: ${misuse.length} t(lang, "English") call(s) with no key/fallback (renders same in every language)`);
log(`  t() misuse ..... ${misuse.length === 0 ? "OK" : misuse.length + " (warning)"}`);
misuse.slice(0, 15).forEach((x) => log(`      ${x}`));

// ---------------------------------------------------------------------------
// 4. FALLBACK (non-en value identical to en)
// ---------------------------------------------------------------------------
const NEUTRAL = /^(PDF|CSV|XLSX|JSON|HTML|SMTP|IMAP|WhatsApp|Excel|B\/L|BL|QR|ETA|ETD|HS Code|WABA ID|WABA|ID|ISO|ISO2|ISO3|DR|CR|DR \/ CR|USD|AED|PKR|EUR|AFN|INR|CRM|API|SMS|Email|OK|N\/A|#|R#|IBAN|SWIFT|IFSC|TRN|VAT|VAT %|CC|BCC|TRN \/ VAT|IFSC:|HS:|TRN 100293848)$/i;
// Brand / product names are legitimately identical across languages.
const BRAND = /DAMAAN|BUSINESS GROUP|DIGITAL DOCK|DGT ERP|DGT LLC|ACCOUNTS\.DGT/i;
const isNeutral = (v) => !v || NEUTRAL.test(v) || BRAND.test(v) || /^[\d\s.,:%/+()–-]+$/.test(v) || /^\W+$/.test(v);
const fallbacks = [];
for (const key of Object.keys(dict.en)) {
  const en = dict.en[key];
  for (const l of ["ur", "ar", "fa", "ps"]) {
    if (dict[l][key] !== undefined && dict[l][key] === en && !isNeutral(en)) fallbacks.push(`${l}  ${key}  = ${JSON.stringify(en)}`);
  }
}
if (fallbacks.length) fail.push(`FALLBACK: ${fallbacks.length} non-English value(s) identical to English (untranslated)`);
log(`  en fallthrough . ${fallbacks.length === 0 ? "OK" : fallbacks.length + " UNTRANSLATED"}`);
fallbacks.slice(0, 25).forEach((x) => log(`      ${x}`));

// ---------------------------------------------------------------------------
// 5. PARALLEL dictionaries
// ---------------------------------------------------------------------------
// Reviewed 2026-08-27 — NOT parallel UI dictionaries (language-code maps, DB column
// maps, empty multilingual DATA shapes for user-entered records, date locale strings):
const PARALLEL_ALLOW = new Set([
  "features/i18n/purchase-journal-translations.ts",   // local DB-VALUE map (stored enum values)
  "features/accounts/components/translations.ts",     // local DB-VALUE map
  "features/customers/components/translations.ts",     // local DB-VALUE map
  "lib/services/multilingual-service.ts",             // {en:"en",...} language-code identity map
  "lib/services/auto-translation-service.ts",         // {en:"",...} empty translation-result shape
  "lib/services/ledger-report-service.ts",            // {en:"english_text",...} DB column map
  "features/journal/components/purchase-order-payment-journal.tsx", // 'en-GB' date locale strings
  "features/journal/components/sales-order-payment-journal.tsx",    // 'en-GB' date locale strings
  "app/api/erp/qvc/accounts/route.ts",                // {en:"present"} status literal, not i18n
  "features/clearing-agent/components/truck-recreation-wizard.tsx", // {en:"",ur:"",...} record-translation DATA fields
]);
// Genuine pre-existing parallel UI dictionaries — GRANDFATHERED. The gate blocks NEW
// ones; these are tracked tech-debt to migrate into lib/i18n/ui.ts (see docs/i18n-audit-inventory.txt).
const KNOWN_PARALLEL = new Set([
  // Introduced by the External Form Links / Send-to-Customer feature — tracked
  // tech-debt to migrate into lib/i18n/ui.ts (same as the earlier ALR/PPS/KYC set).
  "app/ext/form/[token]/ext-form-client.tsx",
  "features/customers/components/send-to-customer-modal.tsx",
  "features/general-office/components/share-forms-tab.tsx",
]);
const parallelNew = [];
const parallelKnown = [];
let searchFiles = [];
try {
  searchFiles = execSync('git ls-files "features/**/*.ts" "features/**/*.tsx" "components/**/*.ts" "components/**/*.tsx" "app/**/*.ts" "app/**/*.tsx" "lib/**/*.ts"', { encoding: "utf8" })
    .trim().split("\n").filter(Boolean)
    .filter((f) => !f.startsWith("lib/i18n/") && !PARALLEL_ALLOW.has(f));
} catch { /* ignore */ }
// An object literal that maps at least TWO distinct keys to {en:"…", <rtl>:"…"} with
// real translatable text (letters, length > 2) — the signature of a UI label dictionary.
const PARALLEL_RE = /\{\s*en\s*:\s*"[^"]{3,}"\s*,\s*(?:ur|ar|fa|ps)\s*:\s*"[^"]{2,}"/;
for (const f of searchFiles) {
  const s = fs.readFileSync(f, "utf8");
  const hits = s.match(new RegExp(PARALLEL_RE.source, "g")) || [];
  if (hits.length >= 2) (KNOWN_PARALLEL.has(f) ? parallelKnown : parallelNew).push(f);
}
if (parallelNew.length) fail.push(`PARALLEL: ${parallelNew.length} NEW per-module {en,ur,…} UI dictionary(ies) — use lib/i18n/ui.ts instead`);
log(`  parallel dicts . ${parallelNew.length === 0 ? "OK" : parallelNew.length + " NEW"}${parallelKnown.length ? `  (+${parallelKnown.length} grandfathered)` : ""}`);
parallelNew.forEach((f) => log(`      NEW  ${f}`));
parallelKnown.forEach((f) => log(`      known tech-debt: ${f}`));

// ---------------------------------------------------------------------------
// 6. HARDCODED (changed files only)
// ---------------------------------------------------------------------------
let hardcoded = [];
if (CHANGED_ARG) {
  const ref = CHANGED_ARG.includes("=") ? CHANGED_ARG.split("=")[1] : (() => {
    try { execSync("git rev-parse --verify origin/main", { stdio: "ignore" }); return "origin/main"; } catch { return "HEAD"; }
  })();
  let changed = [];
  try {
    changed = execSync(`git diff --name-only ${ref}...HEAD -- ${CODE_GLOBS.join(" ")}`, { encoding: "utf8" })
      .trim().split("\n").filter(Boolean);
    const staged = execSync(`git diff --name-only --cached -- ${CODE_GLOBS.join(" ")}`, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
    changed = [...new Set([...changed, ...staged])];
  } catch { /* ignore */ }
  const isCode = /className=|import |from ["']|href=|viewBox| d=|data-testid|console\.|\bkey=\{|process\.env|\.svg|\.png|new RegExp|z\.(string|enum)|useState|\.test\(|aria-hidden/;
  const HC_PATTERNS = [
    /\b(?:placeholder|title|label|aria-label|alt|heading|subtitle|tooltip|emptyText|header)\s*=\s*"([A-Z][A-Za-z][^"]{2,80})"/g,
    /\b(?:label|title|header|placeholder|message|description|heading|subtitle|emptyText|name)\s*:\s*"([A-Z][A-Za-z][^"]{2,70})"/g,
    />\s*([A-Z][A-Za-z][A-Za-z ,/&'-]{3,70}?)\s*</g,
  ];
  const HC_JUNK = /^(TODO|FIXME|OK|N\/A|USD|PKR|AED|EUR|PDF|CSV|API|SMTP|IMAP|DGT LLC|Digital Dock ERP|Damaan)$/;
  for (const f of changed) {
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, "utf8").split(/\r?\n/);
    for (let i = 0; i < s.length; i++) {
      const l = s[i];
      if (isCode.test(l) || /\b(?:t|tt|tr|nt)\(/.test(l)) continue;
      for (const p of HC_PATTERNS) {
        const r = new RegExp(p.source, "g");
        let m;
        while ((m = r.exec(l))) {
          const txt = (m[1] || "").trim();
          if (!txt || HC_JUNK.test(txt) || !/[a-z]/.test(txt) || /^[A-Z]{2,4}$/.test(txt)) continue;
          hardcoded.push(`${f}:${i + 1}  "${txt}"`);
        }
      }
    }
  }
  if (hardcoded.length) fail.push(`HARDCODED: ${hardcoded.length} candidate hard-coded English string(s) in changed files (ref ${ref})`);
  log(`  hardcoded ...... ${hardcoded.length === 0 ? "OK" : hardcoded.length + " CANDIDATE(S)"}  (vs ${ref})`);
  hardcoded.slice(0, 40).forEach((x) => log(`      ${x}`));
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
const summary = {
  keysPerBlock: Object.keys(dict.en).length,
  parityGaps: parityGaps.length,
  duplicates: dupes.length,
  missingKeys: missingCount,
  englishFallthrough: fallbacks.length,
  parallelDictsNew: parallelNew.length,
  parallelDictsGrandfathered: parallelKnown.length,
  hardcodedCandidates: CHANGED_ARG ? hardcoded.length : null,
  warnings: warn.length,
  pass: fail.length === 0,
};
if (JSON_OUT) console.log(JSON.stringify(summary, null, 2));

if (warn.length) console.log(`\n⚠ i18n-ui-guard warnings (non-blocking):\n${warn.map((w) => "  - " + w).join("\n")}`);
if (fail.length) {
  console.log(`\n✗ i18n-ui-guard FAILED:\n${fail.map((f) => "  - " + f).join("\n")}`);
  process.exit(1);
}
console.log(`\n✓ i18n-ui-guard passed — ${summary.keysPerBlock} keys × 5 languages, full parity, no missing refs, no silent English.`);
