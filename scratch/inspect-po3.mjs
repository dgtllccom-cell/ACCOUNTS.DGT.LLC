import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const r = await sql`SELECT form_data->'form' AS f FROM purchase_orders WHERE form_data->'form' IS NOT NULL AND form_data->'form'->>'containerCount' IS NOT NULL LIMIT 2`;
  for (const row of r) {
    const f = row.f;
    console.log("containerCount:", f.containerCount, "containerSize:", f.containerSize, "containerNumbers:", f.containerNumbers, "loadingType:", f.loadingType);
  }
  // distribution
  const d = await sql`SELECT form_data->'form'->>'containerCount' cc, count(*)::int n FROM purchase_orders WHERE form_data->'form'->>'containerCount' IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 8`;
  console.log(JSON.stringify(d));
  // loading records linkage
  const lr = await sql`SELECT count(*)::int n, count(DISTINCT purchase_order_id)::int po FROM purchase_loading_records WHERE deleted_at IS NULL`;
  console.log("loading records:", JSON.stringify(lr[0]));
});
process.exit(0);
