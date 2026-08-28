import { withLocalPg } from "../lib/db/local-postgres";
import { businessShippingHandoverService, type HandoverScope } from "../lib/services/business-shipping-handover-service";
const A = "00000000-0000-0000-0000-000000000000";
const bizScope: HandoverScope = { countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: [], isSuperAdmin: true, isShippingScoped: false };
const { po, agent } = await withLocalPg(async (sql) => {
  const po = (await sql`SELECT id, purchase_order_no FROM public.purchase_orders WHERE deleted_at IS NULL AND form_data IS NOT NULL LIMIT 1`)[0];
  const agent = (await sql`SELECT id FROM public.clearing_agents WHERE deleted_at IS NULL LIMIT 1`)[0];
  await sql`UPDATE public.purchase_orders SET form_data = jsonb_set(COALESCE(form_data,'{}'::jsonb),'{form}', COALESCE(form_data->'form','{}'::jsonb) || ${sql.json({supplierName:'CCO Exports LLC', portOfLoading:'Jebel Ali', portOfDischarge:'Karachi', deliveryTerms:'CIF'})}) WHERE id = ${po.id}`;
  return { po, agent };
});
const h = await businessShippingHandoverService.create({
  actionType: "create_shipping_request", businessSourceModule: "purchase_orders", businessSourceId: po.id,
  clearingAgentId: agent.id, containerNumbers: ["ABCU1112223"],
}, bizScope, A, "CCO E2E");
console.log("created", h.handoverNo);
const agentScope: HandoverScope = { countryIds: [], countryBranchIds: [], cityBranchIds: [], clearingAgentIds: [agent.id], isSuperAdmin: false, isShippingScoped: true };
const ap = await businessShippingHandoverService.approve(h.handover.id, agentScope, A, "Agent");
console.log("approved:", JSON.stringify(ap));
const after = await withLocalPg(async (sql) => (await sql`SELECT h.shipping_request_id, o.order_no, o.status, o.route_name, o.cargo_details FROM public.business_shipping_handovers h LEFT JOIN public.clearing_customer_orders o ON o.id = h.shipping_request_id WHERE h.id = ${h.handover.id}`)[0]);
console.log("clearing_customer_order:", JSON.stringify(after));
await withLocalPg(async (sql) => {
  if (after.shipping_request_id) await sql`DELETE FROM public.clearing_customer_orders WHERE id = ${after.shipping_request_id}`;
  await sql`DELETE FROM public.business_shipping_handovers WHERE id = ${h.handover.id}`;
});
console.log("cleaned");
process.exit(0);
