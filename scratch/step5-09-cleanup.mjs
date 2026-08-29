import fs from "node:fs"; import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const sql = postgres(PROD,{max:1,prepare:false,ssl:{rejectUnauthorized:false},connect_timeout:40});
const one = async e => (await sql.unsafe(`SELECT (${e}) v`))[0].v;

console.log("current state:");
for (const t of ["roznamcha_entries","roznamcha_lines","purchase_orders","purchase_order_payments","ledgers"])
  console.log(`  ${t}: ${await one(`SELECT count(*) FROM ${t}`)}`);

// tagged rows still present
const taggedEntries = await sql`SELECT id, voucher_no, status, reference_no FROM roznamcha_entries WHERE reference_no LIKE 'PRODVERIFY-%' OR narration LIKE '%PRODVERIFY-%'`;
console.log("\ntagged PRODVERIFY roznamcha entries:", taggedEntries.length);
for (const e of taggedEntries) console.log(`  ${e.voucher_no} [${e.status}] ${e.reference_no}`);
const taggedPOs = await sql`SELECT id, purchase_order_no FROM purchase_orders WHERE purchase_contract_no LIKE 'PRODVERIFY-%' OR purchase_order_no LIKE 'PRODVERIFY-%'`;
console.log("tagged POs:", taggedPOs.length);
const taggedLedgers = await sql`SELECT id, code, current_balance FROM ledgers WHERE code LIKE 'PRODVERIFY-%'`;
console.log("tagged ledgers:", taggedLedgers.map(l=>`${l.code}=${l.current_balance}`).join(", "));

// PURGE in FK-safe order
const ids = taggedEntries.map(e=>e.id);
if (ids.length) {
  await sql`DELETE FROM roznamcha_reversals WHERE original_roznamcha_entry_id = ANY(${ids}::uuid[]) OR reversal_roznamcha_entry_id = ANY(${ids}::uuid[])`.catch(e=>console.log(" reversals:",e.message.slice(0,80)));
  await sql`DELETE FROM roznamcha_lines WHERE roznamcha_entry_id = ANY(${ids}::uuid[])`.catch(e=>console.log(" lines:",e.message.slice(0,80)));
  await sql`DELETE FROM ledger_balances WHERE ledger_id IN (SELECT id FROM ledgers WHERE code LIKE 'PRODVERIFY-%')`.catch(()=>{});
  await sql`DELETE FROM purchase_order_payments WHERE roznamcha_entry_id = ANY(${ids}::uuid[])`.catch(e=>console.log(" pop:",e.message.slice(0,80)));
  await sql`DELETE FROM roznamcha_entries WHERE id = ANY(${ids}::uuid[])`.catch(e=>console.log(" entries:",e.message.slice(0,80)));
}
for (const po of taggedPOs) {
  await sql`DELETE FROM purchase_order_payments WHERE purchase_order_id=${po.id}::uuid`.catch(()=>{});
  await sql`DELETE FROM purchase_orders WHERE id=${po.id}::uuid`.catch(e=>console.log(" po:",e.message.slice(0,80)));
}
await sql`DELETE FROM ledgers WHERE code LIKE 'PRODVERIFY-%'`.catch(e=>console.log(" ledgers:",e.message.slice(0,80)));

console.log("\nafter purge:");
const after = {};
for (const t of ["roznamcha_entries","roznamcha_lines","purchase_orders","purchase_order_payments","ledgers"])
  after[t] = Number(await one(`SELECT count(*) FROM ${t}`));
console.log(JSON.stringify(after));
const base = JSON.parse(fs.readFileSync("scratch/step5-prod-baseline.json","utf8")).data;
const clean = after.roznamcha_entries===Number(base.roznamcha_entries) && after.roznamcha_lines===Number(base.roznamcha_lines) && after.purchase_orders===0 && after.purchase_order_payments===0 && after.ledgers===Number(base.ledgers);
console.log(clean ? "✅ PRODUCTION RESTORED TO EXACT PRE-VERIFICATION STATE" : "⚠️ mismatch vs baseline: "+JSON.stringify(base));
await sql.end();
