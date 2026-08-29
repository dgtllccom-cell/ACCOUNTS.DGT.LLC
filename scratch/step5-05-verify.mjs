import fs from "node:fs"; import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const sql = postgres(PROD,{max:1,prepare:false,ssl:{rejectUnauthorized:false},connect_timeout:40});
const one = async e => (await sql.unsafe(`SELECT (${e}) v`))[0].v;
const base = JSON.parse(fs.readFileSync("scratch/step5-prod-baseline.json","utf8"));

console.log("=== STEP 5.5/6 — POST-MIGRATION VERIFICATION (live production) ===\n");

console.log("--- schema growth ---");
for (const k of Object.keys(base.schema)) {
  const now = await one({
    tables:"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    indexes:"SELECT count(*) FROM pg_indexes WHERE schemaname='public'",
    policies:"SELECT count(*) FROM pg_policies WHERE schemaname='public'",
    fks:"SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'",
    checks:"SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='c'",
    triggers:"SELECT count(*) FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal",
    views:"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'",
    functions:"SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'",
    columns:"SELECT count(*) FROM information_schema.columns WHERE table_schema='public'",
    migrations:"SELECT count(*) FROM erp_schema_migrations WHERE status='applied'",
  }[k]);
  console.log(`  ${k}: ${base.schema[k]} → ${now}`);
}

console.log("\n--- PRE-EXISTING DATA INTEGRITY (must be UNCHANGED) ---");
let dataOk = true;
for (const [t, was] of Object.entries(base.data)) {
  const now = await one(`SELECT count(*) FROM ${t}`);
  const same = String(was) === String(now);
  if (!same) dataOk = false;
  console.log(`  ${same ? "✓" : "✗ CHANGED"} ${t}: ${was} → ${now}`);
}
console.log(dataOk ? "\n  ✅ ALL PRE-EXISTING ROW COUNTS UNCHANGED" : "\n  ❌ DATA CHANGED — INVESTIGATE");

console.log("\n--- FK INTEGRITY (orphan scan on FKs with data) ---");
const fks = await sql`
  SELECT con.conname, cl.relname child, att.attname col, pcl.relname parent, patt.attname pcol
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid=con.conrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
  JOIN pg_class pcl ON pcl.oid=con.confrelid JOIN pg_namespace pn ON pn.oid=pcl.relnamespace
  JOIN unnest(con.conkey) WITH ORDINALITY ck(a,o) ON true
  JOIN unnest(con.confkey) WITH ORDINALITY cfk(a,o) ON cfk.o=ck.o
  JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=ck.a
  JOIN pg_attribute patt ON patt.attrelid=con.confrelid AND patt.attnum=cfk.a
  WHERE con.contype='f' AND n.nspname='public' AND pn.nspname='public'`;
let orphans=0, tested=0;
for (const f of fks) {
  if (Number(await one(`SELECT count(*) FROM public."${f.child}"`)) === 0) continue;
  tested++;
  const bad = Number(await one(`SELECT count(*) FROM public."${f.child}" c WHERE c."${f.col}" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."${f.parent}" p WHERE p."${f.pcol}"=c."${f.col}")`));
  if (bad>0){orphans++;console.log(`  ✗ ${f.child}.${f.col} → ${f.parent}: ${bad}`);}
}
console.log(`  FKs with data tested: ${tested} | orphan violations: ${orphans} ${orphans===0?"✅":"❌"}`);

console.log("\n--- FUNCTIONS / RLS / registry ---");
console.log("  post_purchase_order_payment FIXED:", await one("SELECT pg_get_functiondef(oid) LIKE '%v_base_currency%' FROM pg_proc WHERE proname='post_purchase_order_payment'"));
console.log("  recalc_purchase_order_payment_totals FIXED:", await one("SELECT pg_get_functiondef(oid) LIKE '%v_order_rate_to_base%' FROM pg_proc WHERE proname='recalc_purchase_order_payment_totals'"));
console.log("  post_roznamcha_entry overloads:", await one("SELECT count(*) FROM pg_proc WHERE proname='post_roznamcha_entry'"));
console.log("  HR-payroll RPCs present:", await one("SELECT count(*) FROM pg_proc WHERE proname IN ('list_employees_with_relations','insert_salary_due','finalize_salary_due_payment','apply_advance_loan_recovery','get_employee_with_relations')"));
for (const t of ["clearing_payment_bills","hr_payroll_runs","hr_payroll_run_lines","document_intake_jobs","business_shipping_handovers","purchase_loading_batches","contract_control_center","hr_shifts","crm_action_items","sales_order_items","enterprise_audit_events"])
  process.stdout.write(`  ${t}=${await one(`SELECT to_regclass('public.${t}') IS NOT NULL`)}  `);
console.log("");
console.log("  RLS on release tables:", await one("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relname = ANY(ARRAY['employees','hr_payroll_runs','document_intake_jobs','clearing_payment_bills','business_shipping_handovers','crm_action_items','office_leave_requests','office_attendance'])") + "/8");
console.log("  migrations registered:", await one("SELECT count(*) FROM erp_schema_migrations WHERE status='applied'"));
console.log("  permissions:", await one("SELECT count(*) FROM permissions"), "| user_role_assignments:", await one("SELECT count(*) FROM user_role_assignments"), "(unchanged = grants intact)");

await sql`NOTIFY pgrst, 'reload schema'`;
await sql.end();
