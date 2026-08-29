import fs from "node:fs";
import postgres from "postgres";
const sql = postgres("postgresql://postgres:scratchpwd@127.0.0.1:5433/prod_replica", { max: 1, prepare: false });

const DEFER = new Set([
  "20260901_uae_tax_einvoicing_foundation","20260902_uae_tax_ingestion","20260903_uae_tax_documents",
  "20260904_uae_vat_return","20260905_uae_tax_ledger_reconciliation","20260906_uae_import_export_einvoicing",
  "20260907_uae_tax_reports_audit","20260908_uae_tax_finalize_fixes","20260909_uae_tax_view_hardening",
  "20260910_uae_tax_rules_dedupe","20260911_uae_tax_order_item_triggers","20260912_uae_tax_sync_fn_dedupe",
]);

// candidate window: everything from 20260818 onward (the modern era) not already on prod, excl UAE tax
const files = fs.readdirSync("supabase/migrations").filter(f => /^\d{8}_/.test(f) && f >= "20260818" && f.endsWith(".sql")).sort();
const applied = new Set((await sql`select name from erp_schema_migrations where status='applied'`).map(r => r.name));

const results = [];
for (const f of files) {
  const name = f.replace(/\.sql$/, "");
  if (applied.has(name)) { results.push([name, "SKIP-recorded"]); continue; }
  if (DEFER.has(name)) { results.push([name, "DEFER-uae-tax"]); continue; }
  const text = fs.readFileSync(`supabase/migrations/${f}`, "utf8");
  try {
    await sql.unsafe(text);
    await sql`insert into erp_schema_migrations (name,status) values (${name},'applied') on conflict (name) do update set status='applied', applied_at=now()`;
    results.push([name, "APPLIED"]); console.log(`  ✓ ${name}`);
  } catch (e) {
    const msg = (e.message || "").replace(/\s+/g, " ").slice(0, 200);
    results.push([name, "FAILED: " + msg]); console.log(`  ✗ ${name}  —  ${msg}`);
  }
}
fs.writeFileSync("scratch/reconcile-progress.json", JSON.stringify(results, null, 1));
const c = k => results.filter(r => r[1] === k || r[1].startsWith(k)).length;
console.log(`\nAPPLIED ${c("APPLIED")} | SKIP-recorded ${c("SKIP-recorded")} | DEFER ${c("DEFER")} | FAILED ${c("FAILED")}`);
console.log("\nFAILURES:");
for (const [n, s] of results) if (s.startsWith("FAILED")) console.log(`  ${n}\n    ${s.slice(8)}`);
await sql.end();
