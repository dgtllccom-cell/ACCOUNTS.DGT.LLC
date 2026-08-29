import fs from "node:fs"; import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const DRY = process.argv[2] === "dry";
const sql = postgres(PROD, { max: 1, prepare: false, ssl: { rejectUnauthorized: false }, connect_timeout: 60 });

const DEFER = new Set(["20260901_uae_tax_einvoicing_foundation","20260902_uae_tax_ingestion","20260903_uae_tax_documents","20260904_uae_vat_return","20260905_uae_tax_ledger_reconciliation","20260906_uae_import_export_einvoicing","20260907_uae_tax_reports_audit","20260908_uae_tax_finalize_fixes","20260909_uae_tax_view_hardening","20260910_uae_tax_rules_dedupe","20260911_uae_tax_order_item_triggers","20260912_uae_tax_sync_fn_dedupe"]);
const PRESATISFIED = new Set(["20260821_purchase_orders_destination_scope"]);

const files = fs.readdirSync("supabase/migrations").filter(f => /^\d{8}_/.test(f) && f >= "20260818" && f <= "20261099" && f.endsWith(".sql")).sort();
await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;
const applied = new Set((await sql`select name from erp_schema_migrations where status='applied'`).map(r => r.name));

const plan = [];
for (const f of files) {
  const name = f.replace(/\.sql$/, "");
  if (applied.has(name)) { plan.push([name, "skip-recorded"]); continue; }
  if (DEFER.has(name)) { plan.push([name, "DEFER-uae-tax"]); continue; }
  if (PRESATISFIED.has(name)) { plan.push([name, "pre-satisfied"]); continue; }
  plan.push([name, "APPLY"]);
}
const toApply = plan.filter(p => p[1] === "APPLY");
console.log(`STEP 5.4 — corrective set: ${toApply.length} to APPLY, ${plan.filter(p=>p[1]==="pre-satisfied").length} pre-satisfied, ${plan.filter(p=>p[1]==="skip-recorded").length} skip-recorded, ${plan.filter(p=>p[1]==="DEFER-uae-tax").length} deferred`);
if (DRY) { console.log("\n[DRY RUN] would apply:\n" + toApply.map((p,i)=>`  ${i+1}. ${p[0]}`).join("\n")); await sql.end(); process.exit(0); }

let done = 0;
for (const [name, action] of plan) {
  if (action === "pre-satisfied") {
    await sql`insert into erp_schema_migrations (name,status) values (${name},'applied') on conflict do nothing`;
    console.log(`  · ${name}  (pre-satisfied — recorded, not run)`); continue;
  }
  if (action !== "APPLY") continue;
  const text = fs.readFileSync(`supabase/migrations/${name}.sql`, "utf8");
  const selfTxn = /^\s*BEGIN\s*;/im.test(text);
  process.stdout.write(`  [${++done}/${toApply.length}] ${name} ... `);
  try {
    if (selfTxn) {
      await sql.unsafe(text);
    } else {
      await sql.unsafe("BEGIN;\n" + text + "\nCOMMIT;");
    }
    await sql`insert into erp_schema_migrations (name,status) values (${name},'applied') on conflict (name) do update set status='applied', applied_at=now()`;
    console.log("OK");
  } catch (e) {
    console.log("FAILED");
    console.error(`\n  ✗ ${name}\n  ${(e.message||"").slice(0,300)}`);
    console.error("\n  [STOP] Per instruction — halting on first failure. This file's BEGIN/COMMIT rolled back; production is unchanged past the last OK migration.");
    try { await sql.unsafe("ROLLBACK;"); } catch {}
    await sql.end();
    process.exit(1);
  }
}
await sql`NOTIFY pgrst, 'reload schema'`;
console.log(`\n✅ STEP 5.4 COMPLETE — ${done} migrations applied, 0 failures. PostgREST reload signalled.`);
await sql.end();
