import { withLocalPg } from "../lib/db/local-postgres";
import { businessShippingHandoverService, type HandoverScope } from "../lib/services/business-shipping-handover-service";

const ACTOR = "00000000-0000-0000-0000-000000000000";
const bizScope: HandoverScope = { countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: [], isSuperAdmin: true, isShippingScoped: false };

async function main() {
  const { po, agent } = await withLocalPg(async (sql) => {
    const po = (await sql`SELECT id, purchase_order_no, country_id FROM public.purchase_orders WHERE deleted_at IS NULL AND form_data IS NOT NULL ORDER BY created_at DESC LIMIT 1`)?.[0];
    const agent = (await sql`SELECT id, name FROM public.clearing_agents WHERE deleted_at IS NULL LIMIT 1`)?.[0];
    // give the PO some logistics + money fields to prove money is stripped
    await sql`UPDATE public.purchase_orders SET form_data = jsonb_set(
      COALESCE(form_data, '{}'::jsonb), '{form}',
      COALESCE(form_data->'form','{}'::jsonb) || ${sql.json({
        purchaseContractNo: "PC-HND-9", supplierName: "Falcon Exports LLC", portOfLoading: "Jebel Ali",
        portOfDischarge: "Karachi", vesselName: "MV TEST", containerNumbers: "ABCU1234567, ABCU7654321",
        orderTotal: 999999, advanceAmount: 50000, coursePrice: 12.5, purchaseCurrency: "AED",
        deliveryTerms: "CIF",
      })}
    ) WHERE id = ${po.id}`;
    return { po, agent };
  });
  console.log("PO", po.purchase_order_no, "| agent", agent?.name);

  console.log("\n1) create handover (assign_clearing_agent)…");
  const h = await businessShippingHandoverService.create({
    actionType: "assign_clearing_agent",
    businessSourceModule: "purchase_orders",
    businessSourceId: po.id,
    clearingAgentId: agent.id,
  }, bizScope, ACTOR, "Handover E2E");
  console.log("   ", h.handoverNo);
  const sp = h.handover.shared_payload;
  console.log("   shared_payload keys:", Object.keys(sp).join(", "));
  const leaked = Object.keys(sp).filter((k) => /total|price|amount|advance|currency|profit|ledger|account/i.test(k));
  console.log("   MONEY LEAK CHECK:", leaked.length ? `!!! LEAKED ${leaked}` : "clean");
  console.log("   goods:", JSON.stringify(sp.goods)?.slice(0, 200));

  console.log("2) agent restricted view…");
  const agentScope: HandoverScope = { countryIds: [], countryBranchIds: [], cityBranchIds: [], clearingAgentIds: [agent.id], isSuperAdmin: false, isShippingScoped: true };
  const agentRows = await businessShippingHandoverService.listForAgent(agentScope);
  const mine = agentRows.find((r: any) => r.handover_no === h.handoverNo);
  console.log("   agent sees:", Object.keys(mine ?? {}).join(", "));
  console.log("   has business_source_id?", "business_source_id" in (mine ?? {}) ? "!!! YES" : "no (correct)");

  console.log("3) dup create (same record+action+agent) → should reject…");
  try { await businessShippingHandoverService.create({ actionType: "assign_clearing_agent", businessSourceModule: "purchase_orders", businessSourceId: po.id, clearingAgentId: agent.id }, bizScope, ACTOR, "x"); console.log("   !!! not rejected"); }
  catch (e) { console.log("   rejected:", (e as Error).message); }

  console.log("4) agent approves…");
  const ap = await businessShippingHandoverService.approve(h.handover.id, agentScope, ACTOR, "Agent User");
  console.log("   ", JSON.stringify(ap));

  console.log("5) business cancel after accept → should reject…");
  try { await businessShippingHandoverService.cancel(h.handover.id, bizScope, ACTOR); console.log("   !!! cancelled an accepted handover"); }
  catch (e) { console.log("   rejected:", (e as Error).message); }

  console.log("\n6) cleanup…");
  await withLocalPg(async (sql) => { await sql`DELETE FROM public.business_shipping_handovers WHERE id = ${h.handover.id}`; });
  console.log("   done.");
  process.exit(0);
}
main().catch((e) => { console.error("HANDOVER E2E FAILED:", e); process.exit(1); });
