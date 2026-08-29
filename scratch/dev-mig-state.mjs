import fs from "node:fs"; import postgres from "postgres";
const DEV = { ...Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,"")]})) };
const runnerSrc = fs.readFileSync("scripts/db-apply-all-migrations.mjs","utf8");
const migs = [...runnerSrc.matchAll(/name:\s*"([^"]+)"/g)].map(m=>m[1]);
const sql = postgres(DEV.DATABASE_URL,{max:1,prepare:false});
const applied = new Set((await sql`select name from erp_schema_migrations where status='applied'`).map(r=>r.name));
const missing = migs.filter(m=>!applied.has(m));
console.log(`DEV: ${migs.length} in runner, ${missing.length} missing on DEV:`, missing.join(", ") || "none");
// verify a few key files exist + are additive-looking
for (const n of ["20260901_uae_tax_einvoicing_foundation","20260913_goods_master_category","20260914_contract_control_center","20261001_multicurrency_purchase_payment_fix"]) {
  const p = `supabase/migrations/${n}.sql`;
  const s = fs.existsSync(p) ? fs.readFileSync(p,"utf8") : "";
  const destructive = /\b(DROP TABLE(?! IF EXISTS)|TRUNCATE|DELETE FROM (?!.*WHERE)|DROP COLUMN(?! IF EXISTS))\b/i.test(s);
  console.log(`  ${n}: exists=${!!s} bytes=${s.length} destructive-pattern=${destructive}`);
}
await sql.end();
