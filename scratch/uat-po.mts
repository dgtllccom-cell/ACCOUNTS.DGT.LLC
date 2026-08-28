import { withLocalPg } from "../lib/db/local-postgres";
import { documentIntakeService } from "../lib/services/document-intake-service";
import type { IntakeScope } from "../lib/document-intelligence/scope";
const g: IntakeScope = { domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true };
const JOB = "d11b3e89-b384-4bb0-8021-3bf8ac89c496";
await withLocalPg(async (sql) => {
  // a scope
  const co = (await sql`SELECT id FROM public.countries WHERE deleted_at IS NULL LIMIT 1`)[0];
  // create a purchase_orders row with matching contract + total
  const [po] = await sql`INSERT INTO public.purchase_orders (country_id, purchase_order_no, purchase_contract_no, order_total, currency_code, form_data, status)
    VALUES (${co.id}, 'PO-UAT-8891', 'CON-UAT-501', 88500, 'AED', ${sql.json({form:{purchaseContractNo:'CON-UAT-501', supplierName:'Sunrise Global Trading LLC', purchaseCurrency:'AED', containerCount: 2}})}, 'approved')
    RETURNING id, purchase_order_no`;
  console.log("created PO", po.purchase_order_no, po.id);
  // point the job's country at that scope so it's in-scope, and re-process
  await sql`UPDATE public.document_intake_jobs SET country_id = ${co.id}, status = 'uploaded' WHERE id = ${JOB}`;
});
const r = await documentIntakeService.processJob(JOB, "00000000-0000-0000-0000-000000000000", "UAT", g);
const d = await documentIntakeService.get(JOB, g);
console.log("re-processed → status:", d?.job.status, "| match:", d?.job.match_status, "| matched:", d?.job.matched_source_module, d?.job.matched_source_id, "| score:", d?.job.matched_confidence);
console.log("candidates:", (d?.matches ?? []).map((m:any)=>({label:m.label, score:m.score, scope_ok:m.scope_ok, selected:m.is_selected})));
process.exit(0);
