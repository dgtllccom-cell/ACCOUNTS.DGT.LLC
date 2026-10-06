/**
 * i18n-autofill — the ERP's five-language autopilot for the UI dictionary.
 *
 * Closes PARITY and silent-English (FALLBACK) gaps in lib/i18n/ui.ts
 * automatically, so a new form / page / module / report / field / button only
 * ever needs its ENGLISH key — UR / AR / FA / PS are generated and stored
 * without anyone choosing a language.
 *
 * Engine: lib/i18n/auto-i18n.ts → the central translateErp() pipeline
 *   approved translation memory → curated ERP glossary → machine memory →
 *   local phrase engine → [AI tier if AI_TRANSLATE_* set] → [Google MT if --online]
 * Protected tokens (numbers, IDs, codes, currencies, {placeholders}, dates,
 * urls, emails) are masked and restored verbatim — never translated.
 * A target the engine cannot render CLEANLY is left in English and reported as
 * unresolved (the i18n guard still flags it — a human owes that one).
 *
 * Run:
 *   node_modules/.bin/vite-node --config vitest.config.mjs scripts/i18n-autofill.mts -- [flags]
 *   (npm run i18n:autofill -- [flags])
 *
 * Flags:
 *   --dry              report the gap matrix, write nothing
 *   --online           also allow the AI tier + Google MT (needs keys / network)
 *   --limit=N          process at most N distinct English strings this run
 *   --staged           only consider keys touched in the staged ui.ts diff
 *   --matrix=PATH      write the gap-matrix markdown here (default docs/i18n-gap-matrix.md)
 */
import fs from "node:fs";
import { execSync } from "node:child_process";
import { generateForMany, isNeutralValue, TARGET_LANGS } from "../lib/i18n/auto-i18n";

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes("--dry");
const ONLINE = ARGS.includes("--online");
const STAGED = ARGS.includes("--staged");
const LIMIT = Number((ARGS.find((a) => a.startsWith("--limit=")) || "").split("=")[1]) || Infinity;
const MATRIX_PATH = (ARGS.find((a) => a.startsWith("--matrix=")) || "").split("=")[1] || "docs/i18n-gap-matrix.md";
const PROV_PATH = "lib/i18n/ui.autofill-provenance.json";
const UI_FILE = "lib/i18n/ui.ts";
const LANGS = ["en", "ur", "ar", "fa", "ps"] as const;

const raw = fs.readFileSync(UI_FILE, "utf8");
const EOL = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);

// ── locate the five Dict blocks (same anchors the guard uses) ────────────────
const marks: Record<string, number> = {};
lines.forEach((l, i) => {
  const m = l.match(/^const (en|ur|ar|fa|ps): Dict/);
  if (m) marks[m[1]] = i;
  if (/^const dictionaries/.test(l)) marks.end = i;
});
const order = ["en", "ur", "ar", "fa", "ps", "end"] as const;
for (const k of LANGS) if (marks[k] == null) { console.error(`✗ could not find the '${k}' block in ${UI_FILE}`); process.exit(2); }

const KEY_RE = /"([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)":\s*"((?:[^"\\]|\\.)*)"/g;
const dict: Record<string, Record<string, string>> = { en: {}, ur: {}, ar: {}, fa: {}, ps: {} };
const lineOf: Record<string, Record<string, number>> = { en: {}, ur: {}, ar: {}, fa: {}, ps: {} };
const blockRange: Record<string, [number, number]> = {};
for (let k = 0; k < 5; k++) {
  const lang = order[k];
  const a = marks[lang];
  const b = marks[order[k + 1]] ?? marks.end;
  blockRange[lang] = [a, b];
  for (let i = a; i < b; i++) {
    let m: RegExpExecArray | null;
    const re = new RegExp(KEY_RE.source, "g");
    while ((m = re.exec(lines[i]))) { dict[lang][m[1]] = m[2]; lineOf[lang][m[1]] = i; }
  }
}

// ── acronym / brand allowlist — kept byte-identical to scripts/i18n-ui-guard.mjs
//    so autofill never "fills" a value the guard itself treats as neutral. ──────
const NEUTRAL_EN = /^(PDF|CSV|XLSX|JSON|HTML|SMTP|IMAP|WhatsApp|Excel|B\/L|BL|QR|ETA|ETD|HS Code|WABA ID|WABA|ID|ISO|ISO2|ISO3|DR|CR|DR \/ CR|USD|AED|PKR|EUR|AFN|INR|CRM|API|SMS|Email|OK|N\/A|#|R#|IBAN|SWIFT|IFSC|TRN|VAT|VAT %|CC|BCC|TRN \/ VAT|IFSC:|HS:|TRN 100293848)$/i;
const BRAND = /DAMAAN|BUSINESS GROUP|DIGITAL DOCK|DGT ERP|DGT LLC|ACCOUNTS\.DGT/i;
const guardNeutral = (v: string) =>
  !v || NEUTRAL_EN.test(v) || BRAND.test(v) || /^[\d\s.,:%/+()–-]+$/.test(v) || /^\W+$/.test(v) || isNeutralValue(v);

// ── compute the gap set ─────────────────────────────────────────────────────
let stagedKeys: Set<string> | null = null;
if (STAGED) {
  try {
    const diff = execSync(`git diff --cached -U0 -- ${UI_FILE}`, { encoding: "utf8" });
    stagedKeys = new Set();
    for (const m of diff.matchAll(/^\+.*?"([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)":/gm)) stagedKeys.add(m[1]);
  } catch { stagedKeys = new Set(); }
}

type Gap = { key: string; en: string; langs: string[] };
const gaps: Gap[] = [];
for (const key of Object.keys(dict.en)) {
  if (stagedKeys && !stagedKeys.has(key)) continue;
  const en = dict.en[key];
  const need: string[] = [];
  for (const l of TARGET_LANGS) {
    const has = key in dict[l];
    const silent = has && dict[l][key] === en && !guardNeutral(en);
    if (!has || silent) need.push(l);
  }
  if (need.length) gaps.push({ key, en, langs: need });
}

const beforeCounts = Object.fromEntries(TARGET_LANGS.map((l) => [l, gaps.filter((g) => g.langs.includes(l)).length]));
const distinctEn = [...new Set(gaps.map((g) => g.en))];
console.log(`i18n-autofill — ${gaps.length} key(s) with gaps across ${distinctEn.length} distinct English string(s)`);
console.log(`  gaps by language:`, beforeCounts);
if (ONLINE) console.log(`  online tiers ENABLED (AI + Google MT)`);
if (DRY) console.log(`  --dry: no files will be written`);

// ── translate (batched / de-duplicated) ─────────────────────────────────────
const workEn = distinctEn.slice(0, LIMIT === Infinity ? undefined : LIMIT);
const t0 = Date.now();
const results = await generateForMany(workEn, {
  allowExternal: ONLINE,
  allowAI: ONLINE,
  learn: !DRY,
  minConfidence: 0.55,
});
console.log(`  translated ${workEn.length} string(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ── apply to ui.ts ─────────────────────────────────────────────────────────
const provenance: any[] = fs.existsSync(PROV_PATH) ? JSON.parse(fs.readFileSync(PROV_PATH, "utf8")) : [];
const nowIso = new Date().toISOString();
const engineTally: Record<string, number> = {};
const filled: Record<string, number> = { ur: 0, ar: 0, fa: 0, ps: 0 };
const unresolved: Gap[] = [];
const appendByBlock: Record<string, string[]> = { ur: [], ar: [], fa: [], ps: [] };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

for (const g of gaps) {
  const res = results.get(g.en);
  if (!res) { unresolved.push(g); continue; }
  const stillMissing: string[] = [];
  for (const l of g.langs) {
    const prov = res.provenance[l as keyof typeof res.provenance];
    if (!prov) { stillMissing.push(l); continue; }
    const value = prov.value;
    engineTally[prov.engine] = (engineTally[prov.engine] || 0) + 1;
    filled[l]++;
    provenance.push({ key: g.key, lang: l, value, engine: prov.engine, confidence: prov.confidence, at: nowIso });
    if (l in dict && g.key in dict[l]) {
      // silent-English line already present → edit it in place
      const ln = lineOf[l][g.key];
      lines[ln] = lines[ln].replace(
        new RegExp(`("${g.key.replace(/[.]/g, "\\.")}":\\s*)"(?:[^"\\\\]|\\\\.)*"`),
        `$1"${esc(value)}"`,
      );
    } else {
      appendByBlock[l].push(`  "${esc(g.key)}": "${esc(value)}",`);
    }
  }
  if (stillMissing.length) unresolved.push({ ...g, langs: stillMissing });
}

// insert appended keys just before each block's closing `};`
if (!DRY) {
  for (let k = 4; k >= 1; k--) {
    const lang = order[k];
    const add = appendByBlock[lang];
    if (!add.length) continue;
    const [a, b] = blockRange[lang];
    let close = -1;
    for (let i = b - 1; i > a; i--) if (/^\};?\s*$/.test(lines[i])) { close = i; break; }
    if (close === -1) { console.error(`✗ no closing brace for '${lang}' block`); process.exit(2); }
    lines.splice(close, 0, ...add);
  }
  fs.writeFileSync(UI_FILE, lines.join(EOL), "utf8");
  fs.writeFileSync(PROV_PATH, JSON.stringify(provenance, null, 2) + EOL, "utf8");
  console.log(`  wrote ${UI_FILE} (+${Object.values(appendByBlock).flat().length} new lines) and ${PROV_PATH}`);
}

// ── gap matrix ─────────────────────────────────────────────────────────────
const afterCounts = Object.fromEntries(TARGET_LANGS.map((l) => {
  const remaining = beforeCounts[l] - filled[l];
  return [l, DRY ? beforeCounts[l] : remaining];
}));
const unresolvedDistinct = [...new Set(unresolved.flatMap((g) => g.langs.map((l) => `${g.key}·${l}`)))];

const md = [
  `# i18n gap matrix — UI dictionary (\`lib/i18n/ui.ts\`)`,
  ``,
  `_Generated ${nowIso} by \`scripts/i18n-autofill.mts\`${ONLINE ? " (--online)" : ""}${DRY ? " (--dry)" : ""}._`,
  ``,
  `Keys per language block: **${Object.keys(dict.en).length}**`,
  ``,
  `| Language | Gaps before | Auto-filled | Gaps remaining |`,
  `|---|--:|--:|--:|`,
  ...TARGET_LANGS.map((l) => `| ${l.toUpperCase()} | ${beforeCounts[l]} | ${DRY ? 0 : filled[l]} | ${afterCounts[l]} |`),
  ``,
  `### Engine breakdown (this run)`,
  ``,
  `| Tier | Count |`,
  `|---|--:|`,
  ...Object.entries(engineTally).sort((a, b) => b[1] - a[1]).map(([e, n]) => `| ${e} | ${n} |`),
  ``,
  `### Unresolved — left in English, a human owes a translation (${unresolvedDistinct.length})`,
  ``,
  ONLINE
    ? `_Even with the online tiers these could not be rendered cleanly._`
    : `_Re-run with \`--online\` (AI tier + Google MT) to close most of these automatically._`,
  ``,
  ...unresolved.slice(0, 60).map((g) => `- \`${g.key}\` → ${g.langs.join(", ")}  ·  "${g.en.slice(0, 70)}"`),
  unresolved.length > 60 ? `- …and ${unresolved.length - 60} more` : ``,
].join("\n");

fs.mkdirSync("docs", { recursive: true });
if (!DRY || !fs.existsSync(MATRIX_PATH)) fs.writeFileSync(MATRIX_PATH, md + "\n", "utf8");

console.log(`\n${"─".repeat(60)}`);
console.log(`GAP MATRIX  (${MATRIX_PATH})`);
for (const l of TARGET_LANGS) console.log(`  ${l.toUpperCase()}  before ${beforeCounts[l]}  filled ${DRY ? 0 : filled[l]}  remaining ${afterCounts[l]}`);
console.log(`  engines:`, engineTally);
console.log(`  unresolved (key·lang): ${unresolvedDistinct.length}`);
console.log(`${"─".repeat(60)}`);

if (!DRY && unresolvedDistinct.length === 0) console.log(`✓ every UI gap closed automatically`);
