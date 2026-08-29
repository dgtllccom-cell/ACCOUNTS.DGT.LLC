import fs from "node:fs"; import postgres from "postgres";
const target = process.env.TARGET_DB || "postgresql://postgres:scratchpwd@127.0.0.1:5433/prod_replica";
const sql = postgres(target, { max: 1, prepare: false, ssl: target.includes("supabase") ? { rejectUnauthorized: false } : undefined });

const DEFER = new Set(["20260901_uae_tax_einvoicing_foundation","20260902_uae_tax_ingestion","20260903_uae_tax_documents","20260904_uae_vat_return","20260905_uae_tax_ledger_reconciliation","20260906_uae_import_export_einvoicing","20260907_uae_tax_reports_audit","20260908_uae_tax_finalize_fixes","20260909_uae_tax_view_hardening","20260910_uae_tax_rules_dedupe","20260911_uae_tax_order_item_triggers","20260912_uae_tax_sync_fn_dedupe"]);
// migrations that are non-idempotent AND already satisfied on prod (verified in rehearsal)
const PRESATISFIED = new Set(["20260821_purchase_orders_destination_scope"]);

const files = fs.readdirSync("supabase/migrations").filter(f => /^\d{8}_/.test(f) && f >= "20260818" && f <= "20261099" && f.endsWith(".sql")).sort();
await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;
const applied = new Set((await sql`select name from erp_schema_migrations where status='applied'`).map(r => r.name));

const log = [];
for (const f of files) {
  const name = f.replace(/\.sql$/, "");
  if (applied.has(name)) { log.push([name, "skip-recorded"]); continue; }
  if (DEFER.has(name)) { log.push([name, "DEFER-uae-tax"]); continue; }
  if (PRESATISFIED.has(name)) {
    await sql`insert into erp_schema_migrations (name,status) values (${name},'applied') on conflict do nothing`;
    log.push([name, "pre-satisfied-on-prod (recorded, not run)"]); continue;
  }
  try {
    await sql.unsafe(fs.readFileSync(`supabase/migrations/${f}`, "utf8"));
    await sql`insert into erp_schema_migrations (name,status) values (${name},'applied') on conflict (name) do update set status='applied', applied_at=now()`;
    log.push([name, "APPLIED"]); console.log("  ✓", name);
  } catch (e) {
    log.push([name, "FAILED: " + (e.message||"").replace(/\s+/g," ").slice(0,180)]);
    console.log("  ✗", name, "—", (e.message||"").slice(0,160));
  }
}
fs.writeFileSync("scratch/corrective-apply-log.json", JSON.stringify(log, null, 1));
const c = k => log.filter(x => x[1].startsWith(k)).length;
console.log(`\nAPPLIED ${c("APPLIED")} | pre-satisfied ${c("pre-satisfied")} | skip-recorded ${c("skip-recorded")} | DEFER ${c("DEFER")} | FAILED ${c("FAILED")}`);
if (c("FAILED")) { console.log("\nFAILURES:"); log.filter(x=>x[1].startsWith("FAILED")).forEach(x=>console.log("  "+x[0]+"\n    "+x[1])); }
await sql.end();
