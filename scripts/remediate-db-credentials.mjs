/**
 * Codemod: replace hard-coded DB connection strings with resolveDbUrl(...).
 *
 * Dry-run by default (prints what it would change). Pass --write to apply.
 *
 *   node scripts/remediate-db-credentials.mjs           # preview
 *   node scripts/remediate-db-credentials.mjs --write    # apply
 *
 * After --write:  git diff, then  `node --check` each touched .mjs.
 * See docs/security-remediation-db-credentials.md.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const WRITE = process.argv.includes("--write");

// Match a pooler URL by project ref + structure. The password segment is [^@]+ —
// this file never contains the secret itself.
const PROD_REF = "inmayhrxucimxqhgseqi";
const DEV_REFS = ["csesvyxxjivnkkozgopt", "csesvyxqjivnkkozgopt"];
const urlRe = (ref) =>
  new RegExp(`postgres(?:ql)?://postgres\\.${ref}:[^@\\s"'\`]+@[^\\s"'\`]+/postgres[^\\s"'\`]*`, "g");

const files = execSync(
  `git grep -l -E "postgres\\.(${[PROD_REF, ...DEV_REFS].join("|")}):" -- "*.mjs" "*.ts" "*.md"`,
  { encoding: "utf8" },
).split(/\r?\n/).filter(Boolean);

let changed = 0;
for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  const isDoc = file.endsWith(".md");

  if (isDoc) {
    src = src.replace(urlRe(PROD_REF), "postgresql://USER:PASSWORD@PROD_HOST:5432/postgres");
    for (const r of DEV_REFS) src = src.replace(urlRe(r), "postgresql://USER:PASSWORD@DEV_HOST:6543/postgres");
  } else {
    let needsImport = false;
    if (urlRe(PROD_REF).test(src)) { src = src.replace(urlRe(PROD_REF), '${resolveDbUrl("prod")}'); needsImport = true; }
    for (const r of DEV_REFS) if (urlRe(r).test(src)) { src = src.replace(urlRe(r), '${resolveDbUrl("dev")}'); needsImport = true; }
    // the literals were inside quotes: '...${resolveDbUrl("prod")}...' -> turn that
    // single-quoted string into a call. Simplify: replace  '"?${resolveDbUrl("x")}"?'  with the bare call.
    src = src.replace(/["'`]\$\{resolveDbUrl\((["'])(prod|dev)\1\)\}["'`]/g, 'resolveDbUrl($1$2$1)');
    if (needsImport && !src.includes("lib/prod-db-url.mjs")) {
      const rel = path.relative(path.dirname(file), "scripts/lib").split(path.sep).join("/") || ".";
      const imp = `import { resolveDbUrl } from "${rel.startsWith(".") ? rel : "./" + rel}/prod-db-url.mjs";\n`;
      src = src.replace(/^((?:import .*\n|\/\/.*\n|\s*\n)*)/, `$1${imp}`);
    }
  }

  if (src !== before) {
    changed++;
    console.log(`${WRITE ? "WROTE" : "would change"}: ${file}`);
    if (WRITE) fs.writeFileSync(file, src);
  }
}
console.log(`\n${changed} file(s) ${WRITE ? "changed" : "to change"}. ${WRITE ? "Run: node --check on each .mjs, then git diff." : "Re-run with --write to apply."}`);
