/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Customer Order — live route report + per-leg cargo insurance (EXISTING order / leg model).
 *
 *  routeReport  — every leg in order with its countries, mode, border / port, customs action,
 *                 responsible branch / agent / external partner, handover, status; the route
 *                 check (lib/shipping/route-validation); insurance coverage per leg + gaps; and
 *                 the external partner's bills for that exact leg (billed / paid / remaining).
 *  insurance    — policies covering a leg range; the policy file is an erp_documents row
 *                 (entity_type 'clearing_order_insurance'). No accounting here.
 * Access: the same canAccessOrder rule as the order itself.
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { canAccessOrder } from "@/lib/services/clearing-customer-order-scope";
import { getCustomerOrderById, routeIssuesForLegs } from "@/lib/services/clearing-customer-order-service";

export type GapCode = "uncovered" | "dates_outside" | "policy_expired" | "document_missing";
const notFound = () => new ApiClientError("Customer order not found.", { status: 404, code: "NOT_FOUND" });
const bad = (m: string, code = "VALIDATION") => new ApiClientError(m, { status: 400, code });
const d10 = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);

async function loadOrder(session: ErpSession, orderId: string) {
  const order = await getCustomerOrderById(orderId);
  if (!order || !canAccessOrder(session, order)) throw notFound();
  return order as Record<string, any>;
}

/** Leg-by-leg insurance coverage (pure; unit-tested). */
export function coverage(
  legs: Array<{ leg_no: number; planned_departure?: unknown; planned_arrival?: unknown; actual_arrival?: unknown; status?: string | null }>,
  policies: Array<{ id: string; policy_no: string; insurer_name: string; from_leg_no: number; to_leg_no: number; coverage_from: unknown; coverage_to: unknown; status: string; document_count?: number }>,
  today: string
) {
  const active = policies.filter((p) => p.status === "active");
  const perLeg = legs.map((l) => {
    const cov = active.filter((p) => l.leg_no >= p.from_leg_no && l.leg_no <= p.to_leg_no);
    const gaps: GapCode[] = [];
    const dep = d10(l.planned_departure);
    const arr = d10(l.actual_arrival ?? l.planned_arrival);
    const delivered = ["arrived", "completed", "delivered", "closed"].includes(String(l.status ?? "").toLowerCase());
    if (!cov.length) gaps.push("uncovered");
    else {
      const inWindow = cov.some((p) => (!dep || d10(p.coverage_from)! <= dep) && (!arr || d10(p.coverage_to)! >= arr));
      if (!inWindow && (dep || arr)) gaps.push("dates_outside");
      if (!delivered && cov.every((p) => d10(p.coverage_to)! < today)) gaps.push("policy_expired");
      if (cov.every((p) => !p.document_count)) gaps.push("document_missing");
    }
    return { legNo: l.leg_no, policies: cov.map((p) => ({ id: p.id, policyNo: p.policy_no, insurer: p.insurer_name })), gaps };
  });
  return { perLeg, fullyCovered: perLeg.every((x) => !x.gaps.some((g) => g !== "document_missing")) && perLeg.length > 0 };
}

export async function routeReport(session: ErpSession, orderId: string) {
  const order = await loadOrder(session, orderId);
  const legs = ((order.legs ?? []) as any[]).slice().sort((a, b) => (a.leg_no ?? 0) - (b.leg_no ?? 0));
  const today = new Date().toISOString().slice(0, 10);
  const data = await withReadPg(async (sql) => {
    const legIds = legs.map((l) => l.id);
    const [policies, bills, handovers, names, issues] = await Promise.all([
      sql`SELECT p.*, (SELECT count(*) FROM public.erp_documents d WHERE d.entity_type = 'clearing_order_insurance' AND d.entity_id = p.id AND d.deleted_at IS NULL)::int AS document_count
          FROM public.clearing_order_insurance_policies p WHERE p.order_id = ${orderId}::uuid AND p.deleted_at IS NULL ORDER BY p.from_leg_no, p.created_at`,
      (async (): Promise<any[]> => {
        if (!legIds.length || !(await tableExists(sql, "public.clearing_payment_bills"))) return [];
        return (await sql`SELECT leg_id, bill_no, currency_code, total_amount, paid_amount, remaining_balance, payment_status, posting_status, provider_account_id
              FROM public.clearing_payment_bills WHERE order_id = ${orderId}::uuid AND leg_id = ANY(${legIds}::uuid[]) AND deleted_at IS NULL ORDER BY created_at`) as any[];
      })(),
      legIds.length
        ? sql`SELECT l.id AS leg_id, t.status, t.transfer_type, t.created_at FROM public.clearing_customer_order_legs l
              JOIN public.inter_country_transfers t ON t.id = COALESCE(l.transfer_center_id, l.handover_id) WHERE l.id = ANY(${legIds}::uuid[])`.catch(() => [])
        : [],
      sql`SELECT 'cb' AS k, id, name FROM public.city_branches WHERE id = ANY(${legs.map((l) => l.responsible_city_branch_id).filter(Boolean)}::uuid[])
          UNION ALL SELECT 'mb', id, name FROM public.country_branches WHERE id = ANY(${legs.map((l) => l.responsible_country_branch_id).filter(Boolean)}::uuid[])
          UNION ALL SELECT 'ag', id, name FROM public.clearing_agents WHERE id = ANY(${legs.flatMap((l) => [l.responsible_clearing_agent_id, l.customs_clearing_agent_id]).filter(Boolean)}::uuid[])`,
      routeIssuesForLegs(sql, legs.map((l) => ({
        legNo: l.leg_no, fromCountryId: l.from_country_id, toCountryId: l.to_country_id, fromCountryName: l.from_country_name, toCountryName: l.to_country_name,
        transportMode: l.transport_mode, customsPointText: l.customs_point_text, portOfLoading: l.port_of_loading, portOfDischarge: l.port_of_discharge,
        fromLocationText: l.from_location_text, toLocationText: l.to_location_text, flightNumber: l.flight_number, airwayBillNo: l.airway_bill_no, status: l.status,
      }))),
    ]);
    return { policies: policies as any[], bills: bills as any[], handovers: handovers as any[], names: names as any[], issues };
  });
  const nm = new Map((data?.names ?? []).map((r: any) => [`${r.k}:${r.id}`, r.name as string]));
  const cov = coverage(legs, data?.policies ?? [], today);
  const legRows = legs.map((l) => {
    const bills = (data?.bills ?? []).filter((b) => b.leg_id === l.id);
    const ho = (data?.handovers ?? []).find((h) => h.leg_id === l.id) ?? null;
    return {
      id: l.id, legNo: l.leg_no, from: l.from_country_name, to: l.to_country_name, fromLocation: l.from_location_text, toLocation: l.to_location_text,
      mode: l.transport_mode, borderOrPort: l.customs_point_text || [l.port_of_loading, l.port_of_discharge].filter(Boolean).join(" → ") || [l.flight_number, l.airway_bill_no].filter(Boolean).join(" / ") || null,
      customs: { status: l.customs_status, clearanceType: l.clearance_type, point: l.customs_point_text, agent: nm.get(`ag:${l.customs_clearing_agent_id}`) ?? null, declaration: l.declaration_reference || l.bill_of_entry_no || l.pgm_number || null },
      responsible: l.handler_type === "external_partner" || l.partner_name
        ? { kind: "partner", name: l.partner_name, account: l.partner_account_number, country: l.partner_country_name }
        : { kind: "branch", name: nm.get(`cb:${l.responsible_city_branch_id}`) ?? nm.get(`mb:${l.responsible_country_branch_id}`) ?? nm.get(`ag:${l.responsible_clearing_agent_id}`) ?? null },
      handover: ho ? { status: ho.status, type: ho.transfer_type, at: ho.created_at } : null,
      status: l.status, stage: l.stage, plannedDeparture: d10(l.planned_departure), plannedArrival: d10(l.planned_arrival),
      insurance: cov.perLeg.find((c) => c.legNo === l.leg_no) ?? { policies: [], gaps: ["uncovered"] },
      partnerBills: bills.map((b) => ({ billNo: b.bill_no, currency: b.currency_code, total: Number(b.total_amount), paid: Number(b.paid_amount), remaining: Number(b.remaining_balance), paymentStatus: b.payment_status, postingStatus: b.posting_status })),
    };
  });
  return {
    order: { id: order.id, orderNo: order.order_no, customer: order.customer_name, status: order.status },
    routeLine: legs.map((l) => `${l.from_country_name ?? "?"} → ${l.to_country_name ?? "?"} (${l.transport_mode ?? "?"})`),
    routeIssues: data?.issues ?? [],
    legs: legRows,
    policies: (data?.policies ?? []).map((p) => ({ ...p, coverage_from: d10(p.coverage_from), coverage_to: d10(p.coverage_to) })),
    insurance: { fullyCovered: cov.fullyCovered, gaps: cov.perLeg.flatMap((x) => x.gaps.map((g) => ({ legNo: x.legNo, gap: g }))) },
    partnerTotals: Object.values(legRows.flatMap((l) => l.partnerBills).reduce<Record<string, { currency: string; total: number; paid: number; remaining: number }>>((acc, b) => {
      const k = b.currency || "—";
      acc[k] = acc[k] ?? { currency: k, total: 0, paid: 0, remaining: 0 };
      acc[k].total += b.total; acc[k].paid += b.paid; acc[k].remaining += b.remaining;
      return acc;
    }, {})),
  };
}

async function tableExists(sql: any, name: string): Promise<boolean> {
  const r = (await sql`SELECT to_regclass(${name}) IS NOT NULL AS ok`) as any[];
  return !!r?.[0]?.ok;
}

// ── insurance policies ──────────────────────────────────────────────────────

export type PolicyInput = {
  insurerName: string; insurerAccountId?: string | null; policyNo: string; coveredCargo: string; insuredValue: number; currency: string;
  coverageFrom: string; coverageTo: string; territory?: string | null; fromLegNo: number; toLegNo: number;
  premiumAmount?: number | null; premiumCurrency?: string | null; remarks?: string | null;
};

function checkPolicy(p: PolicyInput, legNos: number[]) {
  if (!p.insurerName?.trim() || !p.policyNo?.trim() || !p.coveredCargo?.trim()) throw bad("Insurer, policy / certificate number and covered cargo are required.", "POLICY_FIELDS");
  if (!(Number(p.insuredValue) > 0)) throw bad("Insured value must be more than zero.", "POLICY_VALUE");
  if (!/^[A-Z]{3}$/.test(String(p.currency || "").toUpperCase())) throw bad("Choose the insured-value currency (3-letter code).", "POLICY_CURRENCY");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.coverageFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(p.coverageTo) || p.coverageTo < p.coverageFrom) throw bad("Coverage dates are invalid (end before start).", "POLICY_DATES");
  if (!legNos.length) throw bad("Save the route legs before adding insurance.", "NO_LEGS");
  if (!legNos.includes(p.fromLegNo) || !legNos.includes(p.toLegNo) || p.toLegNo < p.fromLegNo) throw bad(`Covered legs must be between leg ${Math.min(...legNos)} and leg ${Math.max(...legNos)}.`, "POLICY_LEGS");
}

export async function addPolicy(session: ErpSession, orderId: string, p: PolicyInput) {
  const order = await loadOrder(session, orderId);
  checkPolicy(p, ((order.legs ?? []) as any[]).map((l) => l.leg_no));
  try {
    const row = ((await withReadPg((sql) => sql`
      INSERT INTO public.clearing_order_insurance_policies (order_id, insurer_name, insurer_account_id, policy_no, covered_cargo, insured_value, currency, coverage_from, coverage_to,
        territory, from_leg_no, to_leg_no, premium_amount, premium_currency, remarks, country_id, country_branch_id, city_branch_id, created_by)
      VALUES (${orderId}::uuid, ${p.insurerName.trim()}, ${p.insurerAccountId ?? null}::uuid, ${p.policyNo.trim()}, ${p.coveredCargo.trim()}, ${Number(p.insuredValue)}, ${p.currency.toUpperCase()},
        ${p.coverageFrom}::date, ${p.coverageTo}::date, ${p.territory ?? null}, ${p.fromLegNo}, ${p.toLegNo}, ${p.premiumAmount ?? null}, ${p.premiumCurrency ?? null}, ${p.remarks ?? null},
        ${order.country_id ?? null}::uuid, ${order.country_branch_id ?? null}::uuid, ${order.city_branch_id ?? null}::uuid, ${session.userId}::uuid)
      RETURNING id`)) as any[] | null)?.[0];
    return { id: row?.id as string };
  } catch (e: any) {
    if (String(e?.code) === "23505") throw new ApiClientError("This insurer / policy number is already on the order.", { status: 409, code: "POLICY_EXISTS" });
    throw e;
  }
}

export async function updatePolicy(session: ErpSession, orderId: string, policyId: string, p: Partial<PolicyInput> & { status?: "active" | "cancelled" }) {
  const order = await loadOrder(session, orderId);
  const cur = ((await withReadPg((sql) => sql`SELECT * FROM public.clearing_order_insurance_policies WHERE id = ${policyId}::uuid AND order_id = ${orderId}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!cur) throw new ApiClientError("Policy not found.", { status: 404, code: "NOT_FOUND" });
  const merged: PolicyInput = {
    insurerName: p.insurerName ?? cur.insurer_name, insurerAccountId: p.insurerAccountId ?? cur.insurer_account_id, policyNo: p.policyNo ?? cur.policy_no,
    coveredCargo: p.coveredCargo ?? cur.covered_cargo, insuredValue: p.insuredValue ?? Number(cur.insured_value), currency: p.currency ?? cur.currency,
    coverageFrom: p.coverageFrom ?? d10(cur.coverage_from)!, coverageTo: p.coverageTo ?? d10(cur.coverage_to)!, territory: p.territory ?? cur.territory,
    fromLegNo: p.fromLegNo ?? cur.from_leg_no, toLegNo: p.toLegNo ?? cur.to_leg_no, premiumAmount: p.premiumAmount ?? cur.premium_amount,
    premiumCurrency: p.premiumCurrency ?? cur.premium_currency, remarks: p.remarks ?? cur.remarks,
  };
  if (p.status !== "cancelled") checkPolicy(merged, ((order.legs ?? []) as any[]).map((l) => l.leg_no));
  await withLocalPg((sql) => sql`
    UPDATE public.clearing_order_insurance_policies SET insurer_name = ${merged.insurerName}, insurer_account_id = ${merged.insurerAccountId ?? null}::uuid, policy_no = ${merged.policyNo},
      covered_cargo = ${merged.coveredCargo}, insured_value = ${merged.insuredValue}, currency = ${String(merged.currency).toUpperCase()}, coverage_from = ${merged.coverageFrom}::date,
      coverage_to = ${merged.coverageTo}::date, territory = ${merged.territory ?? null}, from_leg_no = ${merged.fromLegNo}, to_leg_no = ${merged.toLegNo},
      premium_amount = ${merged.premiumAmount ?? null}, premium_currency = ${merged.premiumCurrency ?? null}, remarks = ${merged.remarks ?? null},
      status = ${p.status ?? cur.status}, updated_at = now()
    WHERE id = ${policyId}::uuid`);
  return { id: policyId };
}

/** Route check for legs that are not saved yet (the form's live view). */
export async function checkRoute(legs: Array<Record<string, any>>) {
  return (await withReadPg((sql) => routeIssuesForLegs(sql, legs))) ?? [];
}
