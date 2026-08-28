import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Controlled Business → Shipping / Clearing handover (spec §13).
 *
 * A Business Purchase/Sales record crosses into the Shipping/Clearing system
 * ONLY through an explicit authorized action here. The link carries a
 * WHITELISTED logistics payload — supplier/customer identity, ports, containers,
 * vessel, cargo description/weights, incoterms. It NEVER carries order totals,
 * unit prices, advance/paid amounts, profit, payment terms tied to money,
 * accounts or ledger references. Shipping/clearing users read
 * `business_shipping_handover_shared_v` only.
 */

export type HandoverScope = {
  countryIds: string[] | null;
  countryBranchIds: string[] | null;
  cityBranchIds: string[] | null;
  clearingAgentIds: string[] | null;
  isSuperAdmin: boolean;
  isShippingScoped: boolean;
};

export type HandoverActionType =
  | "create_shipping_request"
  | "send_to_shipping_line"
  | "assign_clearing_agent"
  | "approve_shipping_handover";

// Only these keys may appear in shared_payload. Anything else is dropped.
const SHARED_WHITELIST = new Set([
  "shipperName", "consigneeName", "exporterName", "importerName", "notifyPartyName",
  "supplierName", "customerName",
  "portOfLoading", "portOfDischarge", "loadingCountry", "receivedCountry", "loadingPort", "receivedPort",
  "vesselName", "voyageNumber", "shippingLineName",
  "incoterms", "deliveryTerms", "shipmentType", "shippingMode", "transportMode",
  "containerSize", "containerCount", "cargoDescription", "marksAndNumbers",
  "expectedLoadingDate", "eta", "etd",
]);
const GOODS_WHITELIST = ["description", "goodsName", "hsCode", "brand", "origin", "packages", "grossWeight", "netWeight", "quantity", "unit"];

function pickShared(src: Record<string, any> | null | undefined): Record<string, any> {
  const out: Record<string, any> = {};
  if (!src) return out;
  for (const [k, v] of Object.entries(src)) {
    if (SHARED_WHITELIST.has(k) && v !== null && v !== undefined && v !== "") out[k] = v;
  }
  return out;
}
function pickGoods(entries: any[] | null | undefined): Array<Record<string, any>> {
  if (!Array.isArray(entries)) return [];
  return entries.map((g) => {
    const o: Record<string, any> = {};
    for (const k of GOODS_WHITELIST) if (g?.[k] !== undefined && g[k] !== null && g[k] !== "") o[k] = g[k];
    return o;
  }).filter((o) => Object.keys(o).length);
}

function scopeOk(scope: HandoverScope, row: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null; clearing_agent_id?: string | null }): boolean {
  if (scope.isSuperAdmin) return true;
  if (scope.isShippingScoped) {
    return !row.clearing_agent_id || !scope.clearingAgentIds || scope.clearingAgentIds.includes(row.clearing_agent_id);
  }
  if (scope.countryIds && row.country_id && !scope.countryIds.includes(row.country_id)) return false;
  if (scope.cityBranchIds && row.city_branch_id && !scope.cityBranchIds.includes(row.city_branch_id)) return false;
  return true;
}

export class BusinessShippingHandoverService {
  async create(
    input: {
      actionType: HandoverActionType;
      businessSourceModule: "purchase_orders" | "sales_orders";
      businessSourceId: string;
      clearingAgentId?: string | null;
      shippingLineId?: string | null;
      shippingCustomerId?: string | null;
      blReference?: string | null;
      containerNumbers?: string[];
      sourceIntakeJobId?: string | null;
      extraShared?: Record<string, any>;
    },
    scope: HandoverScope,
    actorId: string,
    actorName: string | null,
  ) {
    return withLocalPg(async (sql) => {
      const table = input.businessSourceModule;
      const biz = (await sql`SELECT id, country_id, country_branch_id, city_branch_id,
          ${sql(table === "purchase_orders" ? "purchase_order_no" : "sales_order_no")} AS reference_no,
          form_data
        FROM public.${sql(table)} WHERE id = ${input.businessSourceId} AND deleted_at IS NULL`)?.[0];
      if (!biz) throw new Error("Business record not found.");
      if (!scopeOk(scope, biz)) throw new Error("The business record is outside your authorized scope.");
      if (scope.isShippingScoped) throw new Error("A shipping-scoped user cannot originate a handover.");
      if (input.clearingAgentId && scope.clearingAgentIds && !scope.isSuperAdmin && !scope.clearingAgentIds.includes(input.clearingAgentId)) {
        // business users may assign any agent; this only blocks a shipping user — already blocked above
      }

      const form = biz.form_data?.form ?? biz.form_data ?? {};
      const goods = biz.form_data?.goodsEntries ?? form.goodsEntries ?? [];
      const shared = {
        ...pickShared(form),
        ...pickShared(input.extraShared),
        contractReference: form.purchaseContractNo || form.salesContractNo || null,
        goods: pickGoods(goods),
      };
      const containers = (input.containerNumbers && input.containerNumbers.length
        ? input.containerNumbers
        : String(form.containerNumbers || "").split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
      ).map((c) => c.toUpperCase());

      const n = (await sql`SELECT count(*)::int c FROM public.business_shipping_handovers`)?.[0]?.c ?? 0;
      const handoverNo = `HND-${new Date().getUTCFullYear()}-${String(n + 1).padStart(5, "0")}`;

      try {
        const row = (await sql`
          INSERT INTO public.business_shipping_handovers
            (handover_no, action_type, business_source_module, business_source_id, business_reference_no, contract_reference,
             country_id, country_branch_id, city_branch_id,
             clearing_agent_id, shipping_line_id, shipping_customer_id, bl_reference, container_numbers,
             shared_payload, status, created_by, created_by_name, source_intake_job_id)
          VALUES
            (${handoverNo}, ${input.actionType}, ${table}, ${biz.id}, ${biz.reference_no}, ${shared.contractReference ?? null},
             ${biz.country_id}, ${biz.country_branch_id}, ${biz.city_branch_id},
             ${input.clearingAgentId ?? null}, ${input.shippingLineId ?? null}, ${input.shippingCustomerId ?? null},
             ${input.blReference ?? null}, ${containers},
             ${sql.json(shared as never)}, 'submitted', ${actorId}, ${actorName}, ${input.sourceIntakeJobId ?? null})
          RETURNING *`)?.[0];
        if (input.sourceIntakeJobId) {
          await sql`INSERT INTO public.document_intake_events (job_id, action, detail, actor_id, actor_name)
            VALUES (${input.sourceIntakeJobId}, 'shipping_handover_created', ${sql.json({ handoverNo, actionType: input.actionType } as never)}, ${actorId}, ${actorName})`;
        }
        return { handover: row, handoverNo };
      } catch (e: any) {
        if (String(e?.message || "").includes("business_shipping_handovers_live_uidx")) {
          throw new Error("A live handover for this record, action and agent already exists.");
        }
        throw e;
      }
    });
  }

  async approve(id: string, scope: HandoverScope, actorId: string, actorName: string | null) {
    return withLocalPg(async (sql) => {
      const h = (await sql`SELECT * FROM public.business_shipping_handovers WHERE id = ${id} AND deleted_at IS NULL`)?.[0];
      if (!h) throw new Error("Handover not found.");
      if (!scopeOk(scope, h)) throw new Error("Handover is outside your authorized scope.");
      if (!["submitted", "draft"].includes(h.status)) throw new Error(`Handover is ${h.status}.`);
      await sql`UPDATE public.business_shipping_handovers SET status = 'accepted', approved_by = ${actorId}, approved_by_name = ${actorName}, approved_at = now(), updated_at = now() WHERE id = ${id}`;
      if (h.source_intake_job_id) {
        await sql`INSERT INTO public.document_intake_events (job_id, action, detail, actor_id, actor_name)
          VALUES (${h.source_intake_job_id}, 'shipping_handover_accepted', ${sql.json({ handoverNo: h.handover_no } as never)}, ${actorId}, ${actorName})`;
      }
      return { id, status: "accepted" };
    });
  }

  async reject(id: string, reason: string, scope: HandoverScope, actorId: string, actorName: string | null) {
    return withLocalPg(async (sql) => {
      const h = (await sql`SELECT * FROM public.business_shipping_handovers WHERE id = ${id} AND deleted_at IS NULL`)?.[0];
      if (!h) throw new Error("Handover not found.");
      if (!scopeOk(scope, h)) throw new Error("Handover is outside your authorized scope.");
      await sql`UPDATE public.business_shipping_handovers SET status = 'rejected', rejected_reason = ${reason}, updated_at = now() WHERE id = ${id}`;
      return { id, status: "rejected" };
    });
  }

  async cancel(id: string, scope: HandoverScope, actorId: string) {
    return withLocalPg(async (sql) => {
      const h = (await sql`SELECT * FROM public.business_shipping_handovers WHERE id = ${id} AND deleted_at IS NULL`)?.[0];
      if (!h) throw new Error("Handover not found.");
      if (!scopeOk(scope, h)) throw new Error("Handover is outside your authorized scope.");
      if (scope.isShippingScoped) throw new Error("A shipping-scoped user cannot cancel a handover.");
      if (h.status === "accepted") throw new Error("An accepted handover cannot be cancelled — reject it from the shipping side or reverse the shipping request.");
      await sql`UPDATE public.business_shipping_handovers SET status = 'cancelled', updated_at = now() WHERE id = ${id}`;
      return { id, status: "cancelled" };
    });
  }

  /** Business-side view — full row, own scope. */
  async listForBusiness(scope: HandoverScope, filters: { businessSourceId?: string; status?: string } = {}) {
    return withLocalPg(async (sql) => {
      const where: any[] = [sql`h.deleted_at IS NULL`];
      if (filters.businessSourceId) where.push(sql`h.business_source_id = ${filters.businessSourceId}`);
      if (filters.status) where.push(sql`h.status = ${filters.status}`);
      if (!scope.isSuperAdmin && scope.countryIds) where.push(sql`(h.country_id IS NULL OR h.country_id = ANY(${scope.countryIds}))`);
      if (!scope.isSuperAdmin && scope.cityBranchIds) where.push(sql`(h.city_branch_id IS NULL OR h.city_branch_id = ANY(${scope.cityBranchIds}))`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return (await sql`SELECT h.* FROM public.business_shipping_handovers h WHERE ${w} ORDER BY h.created_at DESC LIMIT 200`) ?? [];
    });
  }

  /** Shipping / clearing agent view — RESTRICTED projection, only own agent. */
  async listForAgent(scope: HandoverScope, filters: { status?: string } = {}) {
    return withLocalPg(async (sql) => {
      const where: any[] = [];
      if (filters.status) where.push(sql`h.status = ${filters.status}`);
      if (!scope.isSuperAdmin) {
        const agents = scope.clearingAgentIds ?? [];
        where.push(sql`h.clearing_agent_id = ANY(${agents})`);
      }
      const w = where.length ? where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`)) : sql`true`;
      return (await sql`SELECT h.* FROM public.business_shipping_handover_shared_v h WHERE ${w} ORDER BY h.created_at DESC LIMIT 200`) ?? [];
    });
  }
}

export const businessShippingHandoverService = new BusinessShippingHandoverService();
