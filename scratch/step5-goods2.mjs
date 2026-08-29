import fs from "node:fs"; import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const sql = postgres(PROD,{max:1,prepare:false,ssl:{rejectUnauthorized:false}});
const cols = (await sql`SELECT column_name FROM information_schema.columns WHERE table_name='goods' AND table_schema='public'`).map(r=>r.column_name);
const nameCol = cols.includes('goods_name') ? 'goods_name' : (cols.includes('name') ? 'name' : cols.find(c=>/name/.test(c)));
console.log("goods name column:", nameCol);
const g = await sql.unsafe(`SELECT id, ${nameCol} nm, chs_code, category, created_at FROM goods ORDER BY created_at`);
for (const r of g) console.log("  ", JSON.stringify(r));
const backupDir = fs.readFileSync("scratch/step5-backup-path.txt","utf8").trim();
const backedUp = JSON.parse(fs.readFileSync(`${backupDir}/goods.json`,"utf8"));
const bIds = new Set(backedUp.map(r=>r.id));
console.log("\noriginal 2 goods rows still present + unchanged:");
for (const b of backedUp) {
  const now = g.find(x=>x.id===b.id);
  console.log(`  ${now ? "✓" : "✗ MISSING"} ${b.id}  ${b[nameCol]||b.name}  (was: ${JSON.stringify({name:b[nameCol]||b.name,chs:b.chs_code})})`);
}
console.log("\nnew rows (from 20261002 Almond Kernel seed):");
for (const x of g) if (!bIds.has(x.id)) console.log(`  + ${x.nm}  chs=${x.chs_code}  cat=${x.category}`);
console.log("\ngoods_variations:", (await sql`SELECT count(*) c FROM goods_variations`)[0].c, "(backup had:", (JSON.parse(fs.readFileSync(`${backupDir}/goods_variations.json`,"utf8"))).length, ")");

// contract control center — what tables did 20260914 actually create?
console.log("\n20260914 tables on prod:");
for (const t of ["contract_register","contract_control_center","contract_followups","contract_register_audit","crm_action_items","crm_followup_notes"])
  console.log(`  ${t}: ${(await sql`SELECT to_regclass('public.'||${t}) r`)[0].r ? "EXISTS" : "—"}`);
await sql.end();
