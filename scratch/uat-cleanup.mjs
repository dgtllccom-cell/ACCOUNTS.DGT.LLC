import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const j = 'd11b3e89-b384-4bb0-8021-3bf8ac89c496';
  await sql`DELETE FROM public.document_intake_drafts WHERE job_id = ${j}`;
  await sql`DELETE FROM public.document_intake_jobs WHERE id = ${j}`;
  await sql`DELETE FROM public.purchase_orders WHERE purchase_order_no = 'PO-UAT-8891'`;
  await sql`DELETE FROM public.business_shipping_handovers WHERE handover_no LIKE 'HND-2026-%'`;
  // reset serial counters implicitly fine (they are count-based)
  const r = await sql`SELECT
    (SELECT count(*)::int FROM public.document_intake_jobs) jobs,
    (SELECT count(*)::int FROM public.business_shipping_handovers) handovers,
    (SELECT count(*)::int FROM public.document_intake_drafts) drafts`;
  console.log("after cleanup:", JSON.stringify(r[0]));
});
process.exit(0);
