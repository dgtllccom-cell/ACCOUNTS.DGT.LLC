import fs from "node:fs"; import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const sql = postgres(PROD,{max:1,prepare:false,ssl:{rejectUnauthorized:false},connect_timeout:30});
const one = async e => (await sql.unsafe(`SELECT (${e}) v`))[0].v;
console.log("STEP 5.3 — PRODUCTION schema + data baseline (immediately pre-migration)\n");
const s = {
  tables: await one("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"),
  indexes: await one("SELECT count(*) FROM pg_indexes WHERE schemaname='public'"),
  policies: await one("SELECT count(*) FROM pg_policies WHERE schemaname='public'"),
  fks: await one("SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'"),
  checks: await one("SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='c'"),
  triggers: await one("SELECT count(*) FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal"),
  views: await one("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'"),
  functions: await one("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"),
  columns: await one("SELECT count(*) FROM information_schema.columns WHERE table_schema='public'"),
  migrations: await one("SELECT count(*) FROM erp_schema_migrations WHERE status='applied'"),
};
console.log("schema:", JSON.stringify(s, null, 1));
const data = {};
for (const t of ["profiles","employees","customers","ledgers","roznamcha_entries","roznamcha_lines","purchase_orders","purchase_order_payments","permissions","user_role_assignments","user_permission_sets","banks","companies","countries","country_branches","city_branches","enterprise_accounts","daily_usd_rates","office_documents","office_leave_requests","office_attendance","goods","tax_codes"])
  data[t] = await one(`SELECT count(*) FROM ${t}`);
console.log("data:", JSON.stringify(data, null, 1));
console.log("\nfixed-fn check: post_purchase_order_payment FIXED =", await one("SELECT pg_get_functiondef(oid) LIKE '%v_base_currency%' FROM pg_proc WHERE proname='post_purchase_order_payment'"));
console.log("clearing_payment_bills exists =", await one("SELECT to_regclass('public.clearing_payment_bills') IS NOT NULL"));
console.log("hr_payroll_runs exists =", await one("SELECT to_regclass('public.hr_payroll_runs') IS NOT NULL"));
console.log("document_intake_jobs exists =", await one("SELECT to_regclass('public.document_intake_jobs') IS NOT NULL"));
fs.writeFileSync("scratch/step5-prod-baseline.json", JSON.stringify({ schema: s, data }, null, 1));
console.log("\n(expected: ~188 tables, 26 migrations, FIXED=false, all 3 new tables absent — matches rehearsal baseline)");
await sql.end();
