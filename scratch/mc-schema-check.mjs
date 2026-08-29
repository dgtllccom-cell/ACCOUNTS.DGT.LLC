import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  for (const t of ['countries','country_branches','city_branches','ledgers','purchase_orders']) {
    const c = (await sql`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`);
    console.log(`\n### ${t}`);
    for (const x of c) console.log(`  ${x.column_name} ${x.is_nullable==='NO'?'NOT NULL':''} ${x.column_default?('DEF '+x.column_default):''}`);
  }
  console.log("\nledger_scope enum:", (await sql`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ledger_scope'`).map(r=>r.enumlabel).join(","));
  console.log("normal_balance enum:", (await sql`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ledger_normal_balance'`).map(r=>r.enumlabel).join(",") || "(check)");
  console.log("purchase_order_payment_kind:", (await sql`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='purchase_order_payment_kind'`).map(r=>r.enumlabel).join(","));
});
