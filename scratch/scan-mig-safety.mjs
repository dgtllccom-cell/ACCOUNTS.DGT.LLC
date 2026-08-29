import fs from "node:fs";
const runnerSrc = fs.readFileSync("scripts/db-apply-all-migrations.mjs","utf8");
const migs = [...runnerSrc.matchAll(/\{\s*name:\s*"([^"]+)",\s*path:\s*"([^"]+)"\s*\}/g)].map(m=>({name:m[1],path:m[2]}));
let flagged = 0;
for (const m of migs) {
  const s = fs.existsSync(m.path) ? fs.readFileSync(m.path,"utf8") : null;
  if (!s) { console.log(`  MISSING FILE: ${m.path}`); flagged++; continue; }
  const issues = [];
  if (/\bDROP\s+TABLE\s+(?!IF\s+EXISTS)/i.test(s)) issues.push("DROP TABLE w/o IF EXISTS");
  if (/\bTRUNCATE\b/i.test(s)) issues.push("TRUNCATE");
  if (/\bDROP\s+COLUMN\s+(?!IF\s+EXISTS)/i.test(s)) issues.push("DROP COLUMN w/o IF EXISTS");
  if (/\bDELETE\s+FROM\s+(?:public\.)?(?!.*\bWHERE\b)[a-z_]+\s*;/i.test(s)) issues.push("unqualified DELETE");
  if (/\bALTER\s+TABLE\s+\S+\s+DROP\s+CONSTRAINT\s+(?!IF\s+EXISTS)/i.test(s)) issues.push("DROP CONSTRAINT w/o IF EXISTS");
  const hasBegin = /\bBEGIN\s*;/i.test(s) && /\bCOMMIT\s*;/i.test(s);
  if (issues.length) { console.log(`  ⚠ ${m.name}: ${issues.join(", ")}`); flagged++; }
  else console.log(`  ✓ ${m.name}  (txn=${hasBegin})`);
}
console.log(`\n${flagged} flagged of ${migs.length}`);
