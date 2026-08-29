import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const j = await sql`SELECT count(*)::int n FROM public.document_intake_jobs WHERE deleted_at IS NULL`;
  const po = await sql`SELECT purchase_order_no FROM public.purchase_orders WHERE purchase_order_no LIKE 'PO-S18%' OR purchase_order_no LIKE 'PO-UAT%' OR purchase_contract_no LIKE 'CON-PDF%'`;
  const pr = await sql`SELECT run_no, status FROM public.hr_payroll_runs WHERE deleted_at IS NULL`;
  const h = await sql`SELECT count(*)::int n FROM public.business_shipping_handovers WHERE deleted_at IS NULL`;
  const cco = await sql`SELECT order_no FROM public.clearing_customer_orders WHERE remarks ILIKE '%handover%'`;
  console.log("DI jobs:", j[0].n, "| stray POs:", JSON.stringify(po.map(x=>x.purchase_order_no)), "| payroll runs:", JSON.stringify(pr), "| handovers:", h[0].n, "| CCOs from handover:", JSON.stringify(cco));
});
process.exit(0);
