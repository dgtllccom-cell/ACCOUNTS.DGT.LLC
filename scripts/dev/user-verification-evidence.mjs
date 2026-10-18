/**
 * Collates the raw harness outputs into the evidence block of docs/user-verification-<date>.md.
 *
 *   node scripts/dev/user-verification-evidence.mjs <outDir-with-harness-outputs> <out.json>
 *
 * Expected files in <dir> (each is the stdout of the named harness): counts-before.txt, counts-after.txt, matrix_api.txt,
 * matrix_page_*.txt, leak*.txt, usercreate*.txt, acctapproval*.txt, bills*.txt, vitest.txt (summary line), cleanup.txt
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, out] = process.argv.slice(2);
const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
const lines = (txt) => txt.split(/\r?\n/).filter((l) => /^(PASS|FAIL)\s/.test(l));
const sum = (txt) => {
  const l = lines(txt);
  return { pass: l.filter((x) => x.startsWith("PASS")).length, fail: l.filter((x) => x.startsWith("FAIL")).length, fails: l.filter((x) => x.startsWith("FAIL")) };
};

const files = readdirSync(dir);
const group = (rx) => files.filter((f) => rx.test(f)).sort().map((f) => [f, sum(read(f))]);

const rowsMd = [];
const add = (label, harness, fs) => {
  const pass = fs.reduce((a, [, s]) => a + s.pass, 0);
  const fail = fs.reduce((a, [, s]) => a + s.fail, 0);
  if (!pass && !fail) return;
  rowsMd.push(`| ${label} | \`${harness}\` | ${pass} | ${fail} |`);
};
add("Direct URL (pasted /dashboard/… addresses) per persona", "direct-url-api-matrix.mjs … page", group(/^matrix_page_/));
add("API access per persona (403 for the wrong domain)", "direct-url-api-matrix.mjs … api", group(/^matrix_api/));
add("Data-leak scan (foreign-domain ids in 20 list/report endpoints)", "domain-leak-scan.mjs", group(/^leak/));
add("User-creation matrix (branch ↔ domain, country scope, duplicates)", "user-creation-domain-e2e.mjs", group(/^usercreate/));
add("Chaman Shipping account → 2-stage approval → Active", "shipping-account-approval-e2e.mjs", group(/^acctapproval/));
add("Chaman bills (Customer / Truck Expense / Truck Freight-Rent)", "shipping-bills-e2e.mjs", group(/^bills/));

const failLines = [...group(/^(matrix|leak|usercreate|acctapproval|bills)/)].flatMap(([f, s]) => s.fails.map((l) => `- \`${f}\`: ${l.replace(/^FAIL\s+/, "")}`));
const unit = read("vitest.txt").trim();

const evidence = `| Check | Harness | PASS | FAIL |
|---|---|---|---|
${rowsMd.join("\n")}
${unit ? `\n**Unit / policy tests:** ${unit}\n` : ""}
${failLines.length ? `\n**Failing checks that remain:**\n${failLines.join("\n")}\n` : "\nNo failing check remains in the final runs.\n"}`;

const separation = `Rows each persona RECEIVES from the list endpoints (\`scripts/dev/domain-counts.mjs\`). "Before" was measured on the same DEV data before the fix:

**Before**
\`\`\`
${read("counts-before.txt").trim() || "(not captured)"}
\`\`\`
**After**
\`\`\`
${read("counts-after.txt").trim() || "(not captured)"}
\`\`\`
`;

writeFileSync(out, JSON.stringify({ evidence, separation }, null, 2));
console.log("evidence written", out);
