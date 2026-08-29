import postgres from "postgres";
const sql = postgres("postgresql://postgres:scratchpwd@127.0.0.1:5433/prod_replica", { max: 1, prepare: false });
const one = async e => (await sql.unsafe(`SELECT (${e}) v`))[0].v;

console.log("=== 1. FK INTEGRITY (orphan check on all FKs with data) ===");
const fks = await sql`
  SELECT con.conname, cl.relname AS child, att.attname AS col,
         pcl.relname AS parent, patt.attname AS pcol
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid=con.conrelid
  JOIN pg_class pcl ON pcl.oid=con.confrelid JOIN pg_namespace pn ON pn.oid=pcl.relnamespace
  JOIN pg_namespace n ON n.oid=cl.relnamespace
  JOIN unnest(con.conkey) WITH ORDINALITY ck(attnum,ord) ON true
  JOIN unnest(con.confkey) WITH ORDINALITY cfk(attnum,ord) ON cfk.ord=ck.ord
  JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=ck.attnum
  JOIN pg_attribute patt ON patt.attrelid=con.confrelid AND patt.attnum=cfk.attnum
  WHERE con.contype='f' AND n.nspname='public' AND pn.nspname='public'`;
let orphans = 0, tested = 0;
for (const f of fks) {
  const cnt = Number(await one(`SELECT count(*) FROM public."${f.child}"`));
  if (cnt === 0) continue;
  tested++;
  const bad = Number(await one(`
    SELECT count(*) FROM public."${f.child}" c
    WHERE c."${f.col}" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public."${f.parent}" p WHERE p."${f.pcol}" = c."${f.col}")`));
  if (bad > 0) { orphans++; console.log(`  ✗ ${f.child}.${f.col} -> ${f.parent}.${f.pcol}: ${bad} orphans`); }
}
console.log(`  FKs with data tested: ${tested} | orphan violations: ${orphans}`);

console.log("\n=== 2. RLS ENABLED on key tables ===");
for (const t of ["purchase_orders","purchase_order_payments","roznamcha_entries","roznamcha_lines","ledgers","employees","hr_payroll_runs","document_intake_jobs","office_documents","clearing_payment_bills"]) {
  const on = await one(`SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='${t}'`);
  console.log(`  ${t}: RLS ${on ? "ON" : "OFF"}`);
}

console.log("\n=== 3. DUPLICATE-PREVENTION / IDEMPOTENCY constraints ===");
for (const [t,d] of [["roznamcha_entries","voucher_no unique idx"],["idempotency_keys","key uniqueness"],["purchase_order_payments","booking uniqueness"],["document_intake_jobs","sha/idempotency"]]) {
  const idxs = (await sql`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=${t} AND (indexdef ILIKE '%unique%')`).map(r=>r.indexname);
  console.log(`  ${t} (${d}): ${idxs.join(", ") || "—"}`);
}

console.log("\n=== 4. multi-currency functions present + FIXED ===");
console.log("  post_purchase_order_payment:", await one("SELECT CASE WHEN pg_get_functiondef(oid) LIKE '%v_base_currency%' THEN 'FIXED' ELSE 'OLD' END FROM pg_proc WHERE proname='post_purchase_order_payment'"));
console.log("  recalc_purchase_order_payment_totals:", await one("SELECT CASE WHEN pg_get_functiondef(oid) LIKE '%v_order_rate_to_base%' THEN 'FIXED' ELSE 'OLD' END FROM pg_proc WHERE proname='recalc_purchase_order_payment_totals'"));
console.log("  post_purchase_booking_transfer:", await one("SELECT count(*) FROM pg_proc WHERE proname='post_purchase_booking_transfer'"));
console.log("  post_roznamcha_entry:", await one("SELECT count(*) FROM pg_proc WHERE proname='post_roznamcha_entry'"));

console.log("\n=== 5. pre-existing data row counts (must equal prod) ===");
for (const t of ["profiles","employees","customers","ledgers","roznamcha_entries","roznamcha_lines","purchase_orders","user_role_assignments","permissions","user_permission_sets","banks","companies"])
  console.log(`  ${t}: ${await one(`SELECT count(*) FROM ${t}`)}`);
await sql.end();
