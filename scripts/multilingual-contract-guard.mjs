#!/usr/bin/env node
/**
 * MULTILINGUAL BUSINESS DATA CONTRACT — automatic enrolment guard.
 *
 * ONE BUSINESS RECORD → ONE ORIGINAL SOURCE → FIVE LANGUAGE VIEWS.
 *
 * This is the permanent protection that keeps every NEW form / table / module / report
 * inside the multilingual contract without anyone having to remember to ask. It is a
 * static check — it never touches the database.
 *
 * Runs as `prebuild` (after the UI five-language guard) and in the pre-commit hook.
 *
 * FAILS the build/commit when:
 *
 *   1. LANG-SOURCE   an API route reads the request language from `?lang=` only
 *      (`normalizeLanguage(request.nextUrl.searchParams…)`) instead of the shared
 *      `getRequestLanguage()` — which also honours the `x-erp-lang` header and the
 *      `erp_lang` cookie. The `?lang=`-only pattern silently returns English for every
 *      screen that uses the standard api client (it sends the header, not the param).
 *
 *   2. REGISTRY      a `localizeRecord*` / `localizeJoinedNames` / `searchRecordIdsByTranslation`
 *      call names a `record_table` that is NOT classified in
 *      `lib/i18n/translatable-fields.ts` (TRANSLATE / TRANSLITERATE). An unclassified
 *      user-facing text column has no multilingual policy.
 *
 *   3. UNLOCALIZED   a NEW `app/api/erp/**` route returns record rows (repository / service /
 *      raw SQL + apiOk) but never resolves the viewer language (no `getRequestLanguage`,
 *      no `localize*`, no `wantsRawRecord`). Existing offenders are grandfathered in
 *      `scripts/multilingual-contract-allowlist.json` → `unlocalizedRoutes` so only NEW
 *      ones fail; shrink that list, never grow it.
 *
 * Usage:
 *   node scripts/multilingual-contract-guard.mjs           # full check (CI / prebuild gate)
 *   node scripts/multilingual-contract-guard.mjs --json
 *   node scripts/multilingual-contract-guard.mjs --quiet
 */
import fs from "node:fs";
import path from "node:path";

const ARGS = process.argv.slice(2);
const JSON_OUT = ARGS.includes("--json");
const QUIET = ARGS.includes("--quiet");

const ROOT = process.cwd();
const REGISTRY_FILE = "lib/i18n/translatable-fields.ts";
const ALLOWLIST_FILE = "scripts/multilingual-contract-allowlist.json";

const log = (...a) => { if (!QUIET) console.log(...a); };
const failures = [];
const warnings = [];

// ── walk helper ─────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

// ── allowlist ───────────────────────────────────────────────────────────────
// `unlocalizedRoutes`  — the BACKLOG: routes that still owe localisation. Shrink it.
// `exemptRoutes`       — PERMANENT: routes that carry no translatable text (codes,
//                        numbers, dates, status enums, config, previews). Each needs
//                        a one-line reason. Reviewed, not a dumping ground.
let allow = { unlocalizedRoutes: [], exemptRoutes: {}, dynamicLocalizeTables: [] };
try {
  allow = { ...allow, ...JSON.parse(fs.readFileSync(path.join(ROOT, ALLOWLIST_FILE), "utf8")) };
} catch {
  /* no allowlist yet — everything is held to the contract */
}
const allowUnlocalized = new Set(allow.unlocalizedRoutes || []);
const exemptRoutes = new Set(Object.keys(allow.exemptRoutes || {}));
const allowDynamicTables = new Set(allow.dynamicLocalizeTables || []);

// ── registry: which record_tables are classified ────────────────────────────
const registrySrc = fs.readFileSync(path.join(ROOT, REGISTRY_FILE), "utf8");
const registeredTables = new Set();
// keys of TRANSLATABLE_FIELDS: `  some_table: [` (2-space indent, inside the object)
for (const m of registrySrc.matchAll(/^\s{2}([a-z][a-z0-9_]*):\s*\[/gm)) registeredTables.add(m[1]);
// also anything the DB-side registry migrations enrol dynamically (transaction text)
for (const m of registrySrc.matchAll(/["'`]([a-z][a-z0-9_]+)["'`]/g)) {
  /* not authoritative — only the object keys are; ignore */ void m;
}

// ── scan all source files ───────────────────────────────────────────────────
const allFiles = walk(path.join(ROOT, "app"))
  .concat(walk(path.join(ROOT, "lib")))
  .concat(walk(path.join(ROOT, "features")))
  .concat(fs.existsSync(path.join(ROOT, "components")) ? walk(path.join(ROOT, "components")) : []);

// `searchRecordIdsByTranslation("<table>", [...], term)` — table is the FIRST arg.
const SEARCH_CALL_RE = /\bsearchRecordIdsByTranslation\s*\(\s*["'`]([a-z][a-z0-9_]+)["'`]/g;
// `localizeRecord(Names|Fields)(records, "<table>", …)` — table is the arg after `records`.
const LOCALIZE_CALL_RE =
  /\b(localizeRecordNames|localizeRecordFields)\s*(?:<[^>]*>)?\s*\(\s*[^,]+,\s*["'`]([a-z][a-z0-9_]+)["'`]/g;
// `localizeJoinedNames(rows, lang, [{ table: "<t>" … }])` and
// `localizeRecordGroups([{ records, table: "<t>" … }], lang)` — every `table:` literal.
const JOINED_CALL_RE = /\b(localizeJoinedNames|localizeRecordGroups)\s*(?:<[^>]*>)?\s*\(([\s\S]{0,2000}?)\)\s*;/g;

for (const file of allFiles) {
  const src = fs.readFileSync(file, "utf8");
  const r = rel(file);

  // 1. LANG-SOURCE anti-pattern -------------------------------------------------
  if (/normalizeLanguage\(\s*\w+\.nextUrl\.searchParams/.test(src) || /normalizeLanguage\(\s*searchParams\b/.test(src)) {
    failures.push({
      rule: "LANG-SOURCE",
      file: r,
      msg: "reads request language from ?lang= only — use `await getRequestLanguage(request.nextUrl.searchParams.get(\"lang\"))` so the x-erp-lang header and erp_lang cookie are honoured",
    });
  }

  // 2. REGISTRY — localize* / search calls name a classified table -------------
  const flagTable = (table, how) => {
    if (!table) return;
    if (registeredTables.has(table) || allowDynamicTables.has(table) || table === "system_dictionary") return;
    failures.push({
      rule: "REGISTRY",
      file: r,
      msg: `${how} — record_table "${table}" is not classified in ${REGISTRY_FILE}. Add it (mode "translate" or "transliterate") or allowlist it in ${ALLOWLIST_FILE}.`,
    });
  };
  for (const m of src.matchAll(SEARCH_CALL_RE)) flagTable(m[1], `searchRecordIdsByTranslation("${m[1]}", …)`);
  for (const m of src.matchAll(LOCALIZE_CALL_RE)) flagTable(m[2], `${m[1]}(…, "${m[2]}", …)`);
  for (const m of src.matchAll(JOINED_CALL_RE)) {
    for (const t of m[2].matchAll(/table:\s*["'`]([a-z][a-z0-9_]+)["'`]/g)) flagTable(t[1], `${m[1]}(… { table: "${t[1]}" })`);
  }
}

// 3. UNLOCALIZED — API routes that return records without resolving language ---
const apiRoutes = walk(path.join(ROOT, "app/api/erp")).filter((f) => /[/\\]route\.ts$/.test(f));
for (const file of apiRoutes) {
  const src = fs.readFileSync(file, "utf8");
  const r = rel(file);
  if (allowUnlocalized.has(r) || exemptRoutes.has(r)) continue;

  const hasGet = /export\s+async\s+function\s+GET\b/.test(src);
  if (!hasGet) continue;

  const returnsRecords =
    /apiOk\(/.test(src) &&
    (/Repository\b/.test(src) ||
      /Service\b/.test(src) ||
      /\.from\(["'`]/.test(src) ||
      /sql`/.test(src) ||
      /withLocalPg\b/.test(src));
  if (!returnsRecords) continue;

  const resolvesLanguage =
    /getRequestLanguage\b/.test(src) ||
    /\blocalize(RecordNames|RecordFields|RecordGroups|JoinedNames)\b/.test(src) ||
    /wantsRawRecord\b/.test(src) ||
    /getPhraseTranslator\b/.test(src) ||
    /localizeRecord\b/.test(src);

  if (!resolvesLanguage) {
    failures.push({
      rule: "UNLOCALIZED",
      file: r,
      msg: "GET returns record rows but never resolves the viewer language (no getRequestLanguage / localize* / wantsRawRecord). Localise the human-readable columns, or grandfather it in " + ALLOWLIST_FILE,
    });
  }
}

// ── report ──────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({ ok: failures.length === 0, failures, warnings }, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
}

log("• Multilingual business-data contract guard");
log(`  registry ......... ${registeredTables.size} record_tables classified`);
log(`  api routes ....... ${apiRoutes.length} scanned`);
log(`  backlog .......... ${allowUnlocalized.size} routes still owe localisation (shrink, never grow)`);
log(`  exempt ........... ${exemptRoutes.size} routes carry no translatable text (reviewed)`);

if (warnings.length) {
  log("");
  for (const w of warnings) log(`  ⚠ ${w.rule}  ${w.file}\n      ${w.msg}`);
}

if (failures.length) {
  console.log("");
  const byRule = {};
  for (const f of failures) (byRule[f.rule] ||= []).push(f);
  for (const [rule, list] of Object.entries(byRule)) {
    console.log(`✗ ${rule} — ${list.length} violation(s):`);
    for (const f of list) console.log(`    ${f.file}\n      ${f.msg}`);
  }
  console.log("");
  console.log("MULTILINGUAL CONTRACT FAILURE: new user-facing data path has no multilingual policy.");
  console.log("See docs/multilingual-architecture.md and lib/i18n/translatable-fields.ts.");
  process.exit(1);
}

log("");
log(`✓ multilingual-contract-guard passed — ${registeredTables.size} tables classified, no un-enrolled data path.`);
