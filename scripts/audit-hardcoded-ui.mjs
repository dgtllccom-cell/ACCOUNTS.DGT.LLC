#!/usr/bin/env node
/**
 * Hard-coded UI string audit (source-code scan).
 *
 * The dictionary audit (audit-i18n.mjs) proves every KEY has 5 languages — but a
 * component can still hard-code English that never reaches the dictionary. This script
 * scans the actual component source for user-facing English strings that are NOT routed
 * through t() / <Th>, so "localization complete" can be gated on it reaching (near) zero.
 *
 * Heuristic — flags:
 *   - JSX text nodes:      >Some English Text<
 *   - UI attributes:       placeholder / title / aria-label / alt / label = "English"
 * Excludes wired strings automatically ({t(...)} and ={t(...)} never match these patterns),
 * plus obvious non-UI noise (className, code tokens, numbers, urls, icons).
 *
 * Usage:
 *   node scripts/audit-hardcoded-ui.mjs                 # summary + per-module totals
 *   node scripts/audit-hardcoded-ui.mjs --by-file       # per-file counts (worst first)
 *   node scripts/audit-hardcoded-ui.mjs --file <path>   # list each string in one file
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const byFile = args.includes("--by-file");
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;

const roots = ["features", "components", "app"];
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
    else if (/\.(tsx|jsx)$/.test(e.name) && !e.name.endsWith(".bak")) files.push(p);
  }
}
for (const r of roots) if (fs.existsSync(r)) walk(r);

// Words that, alone, are not worth flagging (icons/codes/units/technical).
const STOPWORDS = new Set(["px","rem","em","true","false","null","undefined","div","span","svg","http","https","www","id","ok","na","n/a","pdf","csv","xlsx","usd","pkr","aed","afn","inr","irr","cny"]);

function looksLikeUiText(s) {
  const t = s.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  // Reject code fragments (the biggest false-positive source: generics/JSX spans).
  if (/[;=`]/.test(t)) return false;
  if (/=>|\buseState\b|\buseEffect\b|\buseMemo\b|\bconst\b|\breturn\b|\bfunction\b|\.map\(|\.filter\(|\bimport\b|\bawait\b|\basync\b|=\s*\(/.test(t)) return false;
  if (/^[([,.\])]/.test(t)) return false;                 // starts with code punctuation
  if (/[)\]]$/.test(t)) return false;                     // ends with ) or ]
  if (/^[a-z0-9_-]+$/.test(t)) return false;              // css-ish / token
  if (/^[A-Z0-9_]+$/.test(t) && t.length < 4) return false; // short code
  if (/[{}$<>\\]/.test(t)) return false;                   // expressions/markup
  if (/^\d[\d.,%:/ -]*$/.test(t)) return false;            // numbers
  if (/^[#.][\w-]/.test(t)) return false;                  // selectors
  if (/^\/|\bhttps?:\/\//.test(t)) return false;           // paths/urls
  if (STOPWORDS.has(t.toLowerCase())) return false;
  if (!/[A-Za-z]{2,}/.test(t)) return false;
  // require it to read like words (has a space, or is a capitalized word 4+ chars)
  if (!/\s/.test(t) && !/^[A-Z][a-zA-Z]{3,}$/.test(t)) return false;
  return true;
}

// Strip comments and non-UI code lines so we don't flag developer-only text.
function preprocess(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, "");      // block comments
  s = s.replace(/^\s*\/\/.*$/gm, "");                // line comments
  // drop lines that are clearly technical (imports, logs, type-only)
  s = s.split("\n").filter((line) => {
    const l = line.trim();
    if (/^import\s|^export\s+type\b|^type\s|^\} from |from ["']/.test(l)) return false;
    if (/console\.(log|warn|error|debug|info)/.test(l)) return false;
    return true;
  }).join("\n");
  return s;
}

// Words/phrases that read like UI text but are sample/seed DATA or technical values.
const NON_UI = new Set([
  "dgt llc","pakistan / uae","aed / usd","karachi main","al.ras","main branch",
]);

function scan(src) {
  const clean = preprocess(src);
  const hits = [];
  // JSX text nodes between tags (no braces inside)
  for (const m of clean.matchAll(/>\s*([^<>{}\n]+?)\s*</g)) {
    const s = m[1].trim();
    if (looksLikeUiText(s) && !NON_UI.has(s.toLowerCase())) hits.push(s);
  }
  // UI-relevant attributes with literal string values
  for (const m of clean.matchAll(/\b(placeholder|title|aria-label|alt|label)\s*=\s*"([^"]+)"/g)) {
    const s = m[2].trim();
    if (looksLikeUiText(s) && !NON_UI.has(s.toLowerCase())) hits.push(s);
  }
  return hits;
}

if (fileArg) {
  const src = fs.readFileSync(fileArg, "utf8");
  const hits = scan(src);
  console.log(`${fileArg}: ${hits.length} hard-coded UI strings`);
  for (const h of [...new Set(hits)].sort()) console.log("  • " + h);
  process.exit(0);
}

const perFile = [];
const perModule = {};
let total = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (!/<[A-Za-z]/.test(src)) continue;
  const hits = scan(src);
  if (!hits.length) continue;
  perFile.push({ file: f, count: hits.length });
  total += hits.length;
  const mod = f.split(path.sep).slice(0, 2).join("/");
  perModule[mod] = (perModule[mod] || 0) + hits.length;
}

perFile.sort((a, b) => b.count - a.count);

console.log("═══ Hard-coded UI String Audit (source scan) ═══\n");
console.log(`Files with hard-coded UI strings: ${perFile.length}`);
console.log(`TOTAL hard-coded UI strings (approx): ${total}\n`);
console.log("By module (worst first):");
for (const [mod, c] of Object.entries(perModule).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(c).padStart(5)}  ${mod}`);
}
if (byFile) {
  console.log("\nBy file (worst first):");
  for (const { file, count } of perFile) console.log(`  ${String(count).padStart(4)}  ${file}`);
}
console.log(`\nRun \`node scripts/audit-hardcoded-ui.mjs --file <path>\` to list a file's strings.`);
console.log(total === 0 ? "\n✅ No hard-coded UI strings detected." : `\n❌ ${total} strings still hard-coded — localization not complete.`);
process.exitCode = total === 0 ? 0 : 1;
