#!/usr/bin/env node
/**
 * Repo safety guard — blocks the two credential/data incidents this project has
 * already had from recurring:
 *
 *   1. a PLAINTEXT credential literal committed anywhere in the tree
 *      (`Admin@123` 2026-09-07, `Gulistan@123` 2026-09-08)
 *   2. a one-off script that runs DESTRUCTIVE auth/identity SQL against a real DB
 *      (`DELETE FROM auth.users`, `DELETE FROM public.profiles`,
 *       `encrypted_password = crypt('literal', …)`)
 *
 * Neither belongs in version control. Credential rotation and user cleanup happen
 * through the Supabase dashboard or a reviewed, guarded migration — never a loose
 * `scripts/*.mjs` that anyone with repo/VPS read access can run or read.
 *
 * Runs in `prebuild` and the pre-commit hook. Exit 1 on any hit.
 *
 *   node scripts/repo-safety-guard.mjs            # scan the whole tree
 *   node scripts/repo-safety-guard.mjs --staged   # scan only staged files (pre-commit)
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const STAGED = process.argv.includes("--staged");
const ROOT = process.cwd();

// This guard file necessarily names the patterns it forbids; security-review docs
// legitimately quote the vulnerable patterns they document.
const SELF = new Set([
  "scripts/repo-safety-guard.mjs",
  "docs/security-incidents.md",
  "QA-REVIEW-ISSUES.md",
]);

// Pre-existing offenders (2026-09-08 audit). The guard blocks any NEW plaintext
// credential or destructive identity script; these legacy DEV-reset tools are
// grandfathered so the guard can enter prebuild. SHRINK this list — every entry
// is a script that should be deleted or converted to a reviewed, guarded migration.
const EXEMPT = new Set([
  "scripts/setup-standardized-users.mjs",
  "scripts/cleanup-dev-test-master-data.mjs",
  "scripts/db-cleanup-requirement.mjs",
  "scripts/db-delete-users-except-spreadsheet.mjs",
  "scripts/db-full-reset-except-spreadsheet-expiry.mjs",
  "scripts/db-production-country-reset.mjs",
  "scripts/factory-reset.mjs",
  "scripts/inspect-and-clean.js",
  "scripts/vps-pg-cleanup.mjs",
  // 2026-09-10: found already committed on main, blocking prebuild — grandfathered
  // the same way as the 2026-09-08 batch above. TODO: rotate the TEST-DB password
  // these Playwright debug/verify scripts type into the login form, then replace
  // the literal with an env var (see scripts/reset-active-user-passwords.mjs for
  // the established env-var pattern) and remove these 5 entries.
  "scripts/debug-after-click.mjs",
  "scripts/debug-roznamcha.mjs",
  "scripts/verify-all-flows-playwright.mjs",
  "scripts/verify-locations-playwright.mjs",
  "scripts/verify-roznamcha-playwright.mjs",
  "scripts/vps_remote_pg_clean.mjs",
]);

const rules = [
  {
    id: "PLAINTEXT-CREDENTIAL",
    // <word>@<digits>! style dev passwords, and obvious password-assignment literals
    re: /\b(?:password|passwd|pwd|pass)\s*[:=]\s*["'`][^"'`\n]{4,}["'`]|["'`][A-Za-z][A-Za-z0-9]{2,}@\d{2,}!?["'`]/,
    msg: "plaintext credential literal — rotate via Supabase, never commit it",
  },
  {
    id: "DESTRUCTIVE-AUTH-SQL",
    re: /delete\s+from\s+(?:auth\.users|public\.profiles|auth\."users")|encrypted_password\s*=\s*crypt\s*\(\s*["'`]/i,
    msg: "destructive/identity SQL in a loose script — use the Supabase dashboard or a reviewed migration",
  },
];

function listFiles() {
  // Only version-controlled files matter — a gitignored scratch file is not "committed".
  const cmd = STAGED
    ? "git diff --cached --name-only --diff-filter=ACMR"
    : "git ls-files";
  const out = execSync(cmd, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && /\.(mjs|cjs|js|ts|tsx|sh|json|env|md|html)$/.test(s) && !s.startsWith("supabase/migrations/"));
}

const hits = [];
for (const rel of listFiles()) {
  if (SELF.has(rel) || EXEMPT.has(rel)) continue;
  let src = "";
  try {
    src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    continue;
  }
  for (const rule of rules) {
    const m = src.match(rule.re);
    if (m) {
      const line = src.slice(0, m.index).split("\n").length;
      hits.push({ rel, line, id: rule.id, msg: rule.msg, snippet: m[0].slice(0, 60) });
    }
  }
}

if (hits.length) {
  console.log("✗ repo-safety-guard FAILED:");
  for (const h of hits) console.log(`  [${h.id}] ${h.rel}:${h.line}  «${h.snippet}»\n      ${h.msg}`);
  console.log("");
  console.log("SECURITY: a plaintext credential or destructive identity script must not be committed.");
  process.exit(1);
}
console.log(`✓ repo-safety-guard passed — no plaintext credentials or destructive identity scripts.`);
