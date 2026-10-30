export const dynamic = "force-dynamic";
import { parseJsonish } from "@/lib/stock-journal/model";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { optionalUuidSchema, uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope, authorizeLogistics, enforceScopeFilter } from "@/lib/api/scope-middleware";
import { redactLoadingRecords } from "@/lib/purchases/loading-redaction";
import { requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { resolvePurchaseAmounts, resolvePurchaseLoadingSummary, validatePurchaseLoadingEntries, resolveLoadingEligibility, resolvePaymentCondition } from "@/lib/services/purchase-calculation-service";
import { paidForLoadingGate, verifiedPaid } from "@/lib/purchases/loaded-payable";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { ensureLaneFromLoadingRecord } from "@/lib/services/purchase-lane-service";

const LOCALIZED_TEXT_FIELDS = ["carrier_name", "transport_company", "driver_name", "shipping_line", "transport_remarks", "receiving_remarks"] as const;

/** Localize every registered free-text field on a list of loading records for the given language. */
async function localizeLoadingRecords<T extends { id: string }>(records: T[], lang: Parameters<typeof localizeRecordNames>[3]): Promise<T[]> {
  // Synthetic (not-yet-loaded) rows have no real id to key translations by — skip those.
  const real = records.filter((r) => typeof r.id === "string" && !r.id.startsWith("synthetic-"));
  if (real.length === 0) return records;
  let working: any[] = real;
  for (const field of LOCALIZED_TEXT_FIELDS) {
    working = await localizeRecordNames(working, "purchase_loading_records", field as never, lang);
  }
  const byId = new Map(working.map((r: any) => [r.id, r]));
  return records.map((r) => byId.get(r.id) ?? r);
}

const loadingStatusSchema = z.enum([
  "draft", "pending", "loaded", "dispatched", "in_transit",
  "partially_received", "received", "cancelled"
]);
const transportModeSchema = z.enum(["By Road", "By Sea", "By Air", "By Rail"]);

const querySchema = z.object({
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  status: loadingStatusSchema.optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(100),
  lang: z.string().trim().max(5).optional()
});

const createSchema = z.object({
  countryId: optionalUuidSchema,
  countryBranchId: optionalUuidSchema,
  cityBranchId: optionalUuidSchema,
  purchaseOrderId: optionalUuidSchema,
  purchaseOrderNo: z.string().trim().max(120).nullable().optional(),
  containerNumber: z.string().trim().min(1).max(160),
  containerType: z.string().trim().max(120).nullable().optional(),
  loadingStatus: loadingStatusSchema.default("pending"),
  loadedAt: z.string().datetime().nullable().optional(),
  loadingLocation: z.string().trim().max(240).nullable().optional(),
  receivingLocation: z.string().trim().max(240).nullable().optional(),
  shipmentStatus: z.string().trim().max(120).nullable().optional(),
  carrierName: z.string().trim().max(180).nullable().optional(),
  remarks: z.string().trim().max(1000).nullable().optional(),
  loadedContainers: z.coerce.number().min(1).default(1),
  loadedQuantity: z.coerce.number().min(0).default(0),
  reportPayload: z.record(z.string(), z.unknown()).default({}),
  // Phase 3 — Transportation.
  transportMode: transportModeSchema.nullable().optional(),
  transportCompany: z.string().trim().max(200).nullable().optional(),
  transportCompanyId: optionalUuidSchema,
  vehicleNo: z.string().trim().max(80).nullable().optional(),
  truckId: optionalUuidSchema,
  driverName: z.string().trim().max(160).nullable().optional(),
  driverMobile: z.string().trim().max(40).nullable().optional(),
  shippingLine: z.string().trim().max(160).nullable().optional(),
  shippingLineId: optionalUuidSchema,
  transportReference: z.string().trim().max(160).nullable().optional(),
  departureDate: z.string().trim().max(10).nullable().optional(),
  expectedArrivalDate: z.string().trim().max(10).nullable().optional(),
  transportExpenseAmount: z.coerce.number().min(0).default(0),
  transportExpenseCurrency: z.string().trim().length(3).default("USD"),
  transportRemarks: z.string().trim().max(1000).nullable().optional(),
  // Operational cargo fields. Loading never asks for a currency, rate or amount: those belong to the Purchase Booking.
  blNumber: z.string().trim().max(120).nullable().optional(),
  grossWeight: z.coerce.number().min(0).nullable().optional(),
  tareWeight: z.coerce.number().min(0).nullable().optional(),
  netWeight: z.coerce.number().min(0).nullable().optional(),
  sealNumber: z.string().trim().max(120).nullable().optional(),
  vesselName: z.string().trim().max(160).nullable().optional(),
  voyageNo: z.string().trim().max(80).nullable().optional(),
  awbNumber: z.string().trim().max(80).nullable().optional(),
  flightDetails: z.string().trim().max(200).nullable().optional(),
  railReference: z.string().trim().max(120).nullable().optional(),
  originText: z.string().trim().max(240).nullable().optional(),
  destinationText: z.string().trim().max(240).nullable().optional(),
  lotName: z.string().trim().max(120).nullable().optional()
});

async function allotmentsForOrder(sql: any, purchaseOrderId: string | null, purchaseOrderNo: string | null): Promise<string | null> {
  if (!purchaseOrderId && !purchaseOrderNo) return null;
  const rows = purchaseOrderId
    ? await sql`select form_data from purchase_orders where id = ${purchaseOrderId}::uuid`
    : await sql`select form_data from purchase_orders where purchase_order_no = ${purchaseOrderNo} limit 1`;
  const raw = rows[0]?.form_data;
  const formData = typeof raw === "string" ? JSON.parse(raw) : raw;
  const allots = [...new Set((formData?.goodsEntries ?? []).map((g: any) => String(g?.allotName ?? "").trim()).filter(Boolean))];
  return allots.length ? allots.join(", ") : null;
}

type Session = Awaited<ReturnType<typeof requireErpSession>>;

async function resolveEffectiveScope(session: Session, requested: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }) {
  const effectiveCityBranchId = requested.cityBranchId || session.cityBranchIds[0] || null;
  
  if (effectiveCityBranchId) {
    const supabase = createSupabaseAdminClient() as any;
    const row = await requireSupabaseData(
      supabase
        .from("city_branches")
        .select("id, country_id, country_branch_id")
        .eq("id", effectiveCityBranchId)
        .is("deleted_at", null)
        .maybeSingle()
    );
    return {
      countryId: (row as any)?.country_id ?? requested.countryId ?? session.countryIds[0] ?? null,
      countryBranchId: (row as any)?.country_branch_id ?? requested.countryBranchId ?? session.countryBranchIds[0] ?? null,
      cityBranchId: effectiveCityBranchId
    };
  }

  const effectiveCountryBranchId = requested.countryBranchId || session.countryBranchIds[0] || null;
  if (effectiveCountryBranchId) {
    const supabase = createSupabaseAdminClient() as any;
    const row = await requireSupabaseData(
      supabase
        .from("country_branches")
        .select("id, country_id")
        .eq("id", effectiveCountryBranchId)
        .is("deleted_at", null)
        .maybeSingle()
    );
    return {
      countryId: (row as any)?.country_id ?? requested.countryId ?? session.countryIds[0] ?? null,
      countryBranchId: effectiveCountryBranchId,
      cityBranchId: null
    };
  }

  return {
    countryId: requested.countryId || session.countryIds[0] || null,
    countryBranchId: null,
    cityBranchId: null
  };
}

function emptyPayload(session: Session, message?: string) {
  return {
    records: [],
    summary: {
      total: 0,
      loaded: 0,
      pending: 0,
      received: 0
    },
    setupRequired: Boolean(message),
    setupMessage: message,
    session: {
      isSuperAdmin: session.isSuperAdmin,
      userId: session.userId,
      fullName: session.fullName,
      roles: session.roles
    }
  };
}

function summarize(rows: any[]) {
  return {
    total: rows.length,
    loaded: rows.filter((row) => row.loading_status === "loaded").length,
    pending: rows.filter((row) => row.loading_status === "pending").length,
    received: rows.filter((row) => row.loading_status === "received").length
  };
}

async function buildScopePayload(supabase: any, session: Session) {
  const hasDirectCityScope = session.assignments.some((assignment) => Boolean(assignment.cityBranchId));
  const hasDirectCountryBranchScope = session.assignments.some((assignment) => Boolean(assignment.countryBranchId) && !assignment.cityBranchId);
  const scopeType = session.isSuperAdmin
    ? "global"
    : hasDirectCityScope
      ? "city_branch"
      : hasDirectCountryBranchScope
        ? "country_branch"
        : "country";

  const payload: any = {
    session: {
      isSuperAdmin: session.isSuperAdmin,
      userId: session.userId,
      fullName: session.fullName,
      email: session.email,
      roles: session.roles,
      countryIds: session.countryIds,
      countryBranchIds: session.countryBranchIds,
      cityBranchIds: session.cityBranchIds
    },
    scope: {
      type: scopeType,
      countries: [],
      countryBranches: [],
      cityBranches: []
    }
  };

  try {
    if (!session.isSuperAdmin && session.countryIds.length > 0) {
      const { data } = await supabase
        .from("countries")
        .select("id, name, iso2")
        .in("id", session.countryIds)
        .is("deleted_at", null);
      payload.scope.countries = data ?? [];
    }

    if (!session.isSuperAdmin && session.countryBranchIds.length > 0) {
      const { data } = await supabase
        .from("country_branches")
        .select("id, name, code, country_id")
        .in("id", session.countryBranchIds)
        .is("deleted_at", null);
      payload.scope.countryBranches = data ?? [];
    }

    if (!session.isSuperAdmin && session.cityBranchIds.length > 0) {
      const { data } = await supabase
        .from("city_branches")
        .select("id, name, code, city_name, country_id, country_branch_id")
        .in("id", session.cityBranchIds)
        .is("deleted_at", null);
      payload.scope.cityBranches = data ?? [];
    }
  } catch {
    // Scope labels are display metadata only; filtering remains enforced by session.
  }

  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      lang: request.nextUrl.searchParams.get("lang") ?? undefined
    });
    const lang = normalizeLanguage(query.lang, "en");

    authorizeLogistics(session, {
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const supabase = createSupabaseAdminClient() as any;
    const scopePayload = await buildScopePayload(supabase, session);
    const hasDirectCityScope = !session.isSuperAdmin && session.assignments.some((assignment) => Boolean(assignment.cityBranchId));

    // Reads go through withLocalPg, not the RLS-gated Supabase admin client: in this
    // environment SUPABASE_SERVICE_ROLE_KEY resolves to the same value as the anon key (no
    // real service-role secret configured), so RLS silently filters purchase_loading_records
    // SELECTs down to zero rows even for a super-admin session — same root cause as the
    // purchase-orders DELETE bug fixed earlier, same fix. enforceScopeFilter's logic is
    // replicated by hand below (explicit query-param scope first, else session scope for
    // non-super-admins, else unrestricted for super admins).
    const term = query.q ? query.q.replace(/[%_]/g, "") : null;
    const records: any[] = (await withLocalPg(async (sql) => {
      return sql`
        select
          plr.id, plr.loading_record_no, plr.purchase_order_id, plr.purchase_order_no,
          plr.container_number, plr.container_type, plr.loading_status, plr.loaded_at,
          plr.loading_location, plr.receiving_location, plr.shipment_status, plr.carrier_name,
          plr.remarks, plr.report_payload, plr.country_id, plr.country_branch_id, plr.city_branch_id,
          plr.loaded_quantity, plr.total_quantity, plr.loading_percentage, plr.loaded_purchase_amount,
          plr.loaded_advance_amount, plr.purchase_currency, plr.exchange_rate, plr.loaded_purchase_local,
          plr.loaded_advance_local, plr.payment_made, plr.remaining_loading_balance, plr.local_currency,
          plr.posted_to_journal, plr.journal_entry_id, plr.journal_posted_at, plr.created_at,
          plr.transport_mode, plr.transport_company, plr.transport_company_id, plr.vehicle_no, plr.truck_id, plr.driver_name,
          plr.driver_mobile, plr.shipping_line, plr.shipping_line_id, plr.transport_reference, plr.departure_date,
          plr.expected_arrival_date, plr.actual_arrival_date, plr.transport_expense_amount,
          plr.transport_expense_currency, plr.transport_remarks, plr.received_quantity, plr.received_at,
          plr.received_by, plr.receiving_warehouse_id, plr.receiving_goods_id, plr.receiving_remarks,
          plr.bl_number, plr.gross_weight, plr.tare_weight, plr.net_weight, plr.seal_number, plr.vessel_name, plr.voyage_no,
          plr.awb_number, plr.flight_details, plr.rail_reference, plr.origin_text, plr.destination_text, plr.lot_name,
          case when c.id is not null then jsonb_build_object('name', c.name, 'iso2', c.iso2) else null end as countries,
          case when cb.id is not null then jsonb_build_object(
            'name', cb.name, 'code', cb.code,
            'branding_company_name', cb.branding_company_name, 'branding_logo_url', cb.branding_logo_url,
            'branding_address', cb.branding_address, 'branding_phone', cb.branding_phone, 'branding_email', cb.branding_email
          ) else null end as country_branches,
          case when cib.id is not null then jsonb_build_object(
            'name', cib.name, 'code', cib.code, 'city_name', cib.city_name,
            'branding_company_name', cib.branding_company_name, 'branding_logo_url', cib.branding_logo_url,
            'branding_address', cib.branding_address, 'branding_phone', cib.branding_phone, 'branding_email', cib.branding_email
          ) else null end as city_branches,
          case when po.id is not null then jsonb_build_object(
            'form_data', po.form_data, 'advance_paid', po.advance_paid, 'remaining_due', po.remaining_due,
            'order_total', po.order_total, 'dest_country_id', po.dest_country_id,
            'dest_country_branch_id', po.dest_country_branch_id, 'dest_city_branch_id', po.dest_city_branch_id,
            'purchase_order_payments', coalesce(
              (select jsonb_agg(jsonb_build_object('amount', pop.amount, 'exchange_rate', pop.exchange_rate, 'reference_no', pop.reference_no, 'narration', pop.narration, 'source_reference_no', pop.source_reference_no))
               from purchase_order_payments pop where pop.purchase_order_id = po.id and pop.deleted_at is null),
              '[]'::jsonb
            )
          ) else null end as purchase_orders
        from purchase_loading_records plr
        left join countries c on c.id = plr.country_id
        left join country_branches cb on cb.id = plr.country_branch_id
        left join city_branches cib on cib.id = plr.city_branch_id
        left join purchase_orders po on po.id = plr.purchase_order_id
        where plr.deleted_at is null
          ${query.cityBranchId ? sql`and plr.city_branch_id = ${query.cityBranchId}::uuid`
            : query.countryBranchId ? sql`and plr.country_branch_id = ${query.countryBranchId}::uuid`
            : query.countryId ? sql`and plr.country_id = ${query.countryId}::uuid`
            : sql``}
          ${!session.isSuperAdmin && session.cityBranchIds.length > 0
            ? sql`and (plr.city_branch_id = ANY(${session.cityBranchIds}::uuid[]) or plr.city_branch_id is null) ${session.countryIds.length > 0 ? sql`and plr.country_id = ANY(${session.countryIds}::uuid[])` : sql``}`
            : !session.isSuperAdmin && session.countryBranchIds.length > 0
            ? sql`and plr.country_branch_id = ANY(${session.countryBranchIds}::uuid[])`
            : !session.isSuperAdmin && session.countryIds.length > 0
            ? sql`and plr.country_id = ANY(${session.countryIds}::uuid[])`
            : !session.isSuperAdmin
            ? sql`and false`
            : sql``}
          ${query.status ? sql`and plr.loading_status = ${query.status}` : sql``}
          ${term ? sql`and (plr.loading_record_no ilike ${"%" + term + "%"} or plr.container_number ilike ${"%" + term + "%"} or plr.purchase_order_no ilike ${"%" + term + "%"} or plr.loading_location ilike ${"%" + term + "%"} or plr.receiving_location ilike ${"%" + term + "%"})` : sql``}
        order by plr.created_at desc
        limit ${query.limit}
      `;
    })) ?? [];

    // ── 2. Fetch purchase orders via withLocalPg (bypassing RLS) and check loading eligibility per payment condition ──
    try {
      const existingPoIds = new Set(records.map((r: any) => r.purchase_order_id).filter(Boolean));
      const includePending = !query.status || query.status === "pending";
      const syntheticRecords: any[] = [];

      if (includePending) {
        const poList: any[] = (await withLocalPg(async (sql) => {
          return sql`
            select
              po.id, po.purchase_order_no, po.country_id, po.country_branch_id, po.city_branch_id,
              po.form_data, po.advance_paid, po.remaining_due, po.order_total, po.payment_status,
              po.currency_code, po.exchange_rate, po.remaining_paid, po.credit_amount, po.created_at,
              case when c.id is not null then jsonb_build_object('name', c.name, 'iso2', c.iso2, 'currency', c.currency_code) else null end as countries,
              case when cb.id is not null then jsonb_build_object('name', cb.name, 'code', cb.code) else null end as country_branches,
              case when ci.id is not null then jsonb_build_object('name', ci.name, 'code', ci.code, 'city_name', ci.city_name) else null end as city_branches,
              coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'amount', pop.amount,
                      'exchange_rate', pop.exchange_rate,
                      'reference_no', pop.reference_no,
                      'narration', pop.narration,
                      'source_reference_no', pop.source_reference_no,
                      -- what the Loading gate needs to count a payment honestly (see lib/purchases/loaded-payable.ts)
                      'kind', pop.kind::text,
                      'status', pop.status::text,
                      'currency_code', pop.currency_code,
                      'base_currency_amount', pop.base_currency_amount,
                      'posted_to_journal', pop.posted_to_journal,
                      'roznamcha_entry_id', pop.roznamcha_entry_id,
                      'debit_ledger_id', pop.debit_ledger_id,
                      'credit_ledger_id', pop.credit_ledger_id
                    )
                  )
                  from purchase_order_payments pop
                  where pop.purchase_order_id = po.id and pop.deleted_at is null
                ),
                '[]'::jsonb
              ) as purchase_order_payments
            from purchase_orders po
            left join countries c on c.id = po.country_id
            left join country_branches cb on cb.id = po.country_branch_id
            left join city_branches ci on ci.id = po.city_branch_id
            where po.deleted_at is null
              and (po.status = 'transferred' or po.ledger_posting_status = 'posted' or coalesce(po.form_data->'workflow'->>'transferStatus', '') = 'transferred')
              ${query.cityBranchId ? sql`and po.city_branch_id = ${query.cityBranchId}::uuid`
                : query.countryBranchId ? sql`and po.country_branch_id = ${query.countryBranchId}::uuid`
                : query.countryId ? sql`and po.country_id = ${query.countryId}::uuid`
                : sql``}
              ${!session.isSuperAdmin && session.cityBranchIds.length > 0
                ? sql`and (po.city_branch_id = ANY(${session.cityBranchIds}::uuid[]) or po.city_branch_id is null) ${session.countryIds.length > 0 ? sql`and po.country_id = ANY(${session.countryIds}::uuid[])` : sql``}`
                : !session.isSuperAdmin && session.countryBranchIds.length > 0
                ? sql`and po.country_branch_id = ANY(${session.countryBranchIds}::uuid[])`
                : !session.isSuperAdmin && session.countryIds.length > 0
                ? sql`and po.country_id = ANY(${session.countryIds}::uuid[])`
                : !session.isSuperAdmin
                ? sql`and false`
                : sql``}
              ${term ? sql`and (po.purchase_order_no ilike ${"%" + term + "%"} or po.purchase_contract_no ilike ${"%" + term + "%"})` : sql``}
            order by po.created_at desc
            limit 200
          `;
        })) ?? [];

        if (poList && poList.length > 0) {
          for (const po of poList) {
            if (existingPoIds.has(po.id)) continue;

            // the payment condition is read from form_data, which many bookings hold as a JSON string — parse it before the gate
            po.form_data = parseJsonish(po.form_data);
            const payments = Array.isArray(po.purchase_order_payments) ? po.purchase_order_payments : [];
            // Only posted, ledger-verified payments count, converted into the order's purchase currency (never the raw sum of `amount`,
            // which is in the payment currency and includes booking / unposted rows).
            const orderCcy = String(po.currency_code || "USD").toUpperCase();
            const baseCcy = String(po.countries?.currency || orderCcy).toUpperCase();
            const rateToBase = orderCcy === baseCcy ? 1 : Number(po.exchange_rate) > 0 ? Number(po.exchange_rate) : 1;
            const totalPaidFC = paidForLoadingGate(resolvePaymentCondition(po as any), verifiedPaid(payments, orderCcy, rateToBase));

            // ── Loading Eligibility Gate ──
            // Use resolveLoadingEligibility to check if the payment condition is satisfied
            const eligibility = resolveLoadingEligibility(po as any, totalPaidFC);
            if (!eligibility.eligible) continue; // Payment condition not yet satisfied → do NOT show in loading queue

            const form = po.form_data?.form || {};
            const totals = po.form_data?.totals || {};
            const workflow = po.form_data?.workflow || {};
            const goodsEntries = Array.isArray(po.form_data?.goodsEntries) ? po.form_data.goodsEntries : [];
            const goodsQuantity = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.qtyNo || item.quantity || 0), 0);
            const totalQty = Number(workflow.totalQuantity || totals.totalQuantity || goodsQuantity || form.quantity || 0);

            syntheticRecords.push({
              id: `synthetic-${po.id}`,
              loading_record_no: `PLR-PENDING`,
              purchase_order_id: po.id,
              purchase_order_no: po.purchase_order_no,
              container_number: "-",
              container_type: form.containerType || null,
              loading_status: "pending",
              loaded_at: po.created_at,
              loading_location: form.loadingPort || form.originCountry || "-",
              receiving_location: form.receivedPort || form.destinationCountry || "-",
              shipmentStatus: "Pending Loading",
              carrier_name: "-",
              remarks: `Loading eligible: ${eligibility.reason}`,
              report_payload: {
                loadedQuantity: 0,
                loadingQuantity: 0,
                pending: true,
                loadingEligibility: eligibility,
                goodsEntries: goodsEntries
              },
              country_id: po.country_id,
              country_branch_id: po.country_branch_id,
              city_branch_id: po.city_branch_id,
              loaded_quantity: 0,
              total_quantity: totalQty,
              loading_percentage: 0,
              loaded_purchase_amount: 0,
              loaded_advance_amount: 0,
              purchase_currency: po.currency_code || form.currencyType || "USD",
              exchange_rate: Number(po.exchange_rate || form.exchangeRate || 1),
              loaded_purchase_local: 0,
              loaded_advance_local: 0,
              payment_made: 0,
              remaining_loading_balance: Number(po.order_total || 0),
              local_currency: (po as any).countries?.currency || (po as any).countries?.currency_code || form.branchCurrency || "PKR",
              posted_to_journal: false,
              created_at: po.created_at,
              countries: po.countries,
              country_branches: po.country_branches,
              city_branches: po.city_branches,
              purchase_orders: [po]
            });
          }
        }
      }

      const allRecords = await localizeLoadingRecords([...records, ...syntheticRecords], lang);
      return apiOk({ records: redactLoadingRecords(allRecords, session.canViewFinancials), summary: summarize(allRecords), setupRequired: false, setupMessage: null, ...scopePayload });
    } catch (err: any) {
      console.error("[loading-records GET] Error fetching purchase orders for loading queue:", err);
      const localizedRecords = await localizeLoadingRecords(records, lang);
      return apiOk({ records: redactLoadingRecords(localizedRecords, session.canViewFinancials), summary: summarize(localizedRecords), setupRequired: false, setupMessage: null, ...scopePayload });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = createSchema.parse(await request.json());
    const effective = await resolveEffectiveScope(session, {
      countryId: body.countryId ?? null,
      countryBranchId: body.countryBranchId ?? null,
      cityBranchId: body.cityBranchId ?? null
    });

    authorizeLogistics(session, {
      action: "create",
      countryId: effective.countryId,
      countryBranchId: effective.countryBranchId,
      cityBranchId: effective.cityBranchId
    });

    const supabase = createSupabaseAdminClient() as any;

    // ── Generate deterministic serial number via atomic RPC ──
    let loadingRecordNo = "PLR-" + Date.now();
    try {
      const scopeKey = effective.cityBranchId || effective.countryBranchId || effective.countryId || "global";
      const scopeType = effective.cityBranchId ? "city_branch" : effective.countryBranchId ? "main_branch" : effective.countryId ? "country" : "global";
      
      // Get prefix from branch/country code
      let prefix = "PLR";
      if (effective.cityBranchId) {
        const { data: cityRow } = await supabase.from("city_branches").select("code").eq("id", effective.cityBranchId).maybeSingle();
        if (cityRow?.code) {
          const parts = cityRow.code.split("-");
          prefix = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : cityRow.code.toUpperCase();
          prefix = "PLR-" + prefix;
        }
      } else if (effective.countryId) {
        const { data: countryRow } = await supabase.from("countries").select("iso2").eq("id", effective.countryId).maybeSingle();
        if (countryRow?.iso2) prefix = "PLR-" + countryRow.iso2.toUpperCase();
      }

      const { data: serialResult, error: serialError } = await supabase.rpc("next_entity_serial", {
        p_scope_type: scopeType,
        p_scope_key: scopeKey,
        p_entity_type: "loading",
        p_prefix: prefix
      });
      if (!serialError && serialResult) {
        loadingRecordNo = serialResult;
      }
    } catch (_) {
      // Fallback to timestamp-based code if serial RPC not yet available
    }

    // ── Compute proportional financial amounts if linked to a PO ──
    let loadedQuantity = body.loadedQuantity;
    let totalQuantity = 0;
    let loadingPercentage = 0;
    let loadedPurchaseAmount = 0;
    let loadedAdvanceAmount = 0;
    let purchaseCurrency = "USD";
    let orderExchangeRate = 1;
    let loadedPurchaseLocal = 0;
    let loadedAdvanceLocal = 0;
    let remainingLoadingBalance = 0;
    let localCurrency = "AED";

    // A load that names its booking by number only must meet the same gate as one that names it by id (it used to skip the gate).
    let gatedPurchaseOrderId: string | null = body.purchaseOrderId ?? null;
    if (!gatedPurchaseOrderId && body.purchaseOrderNo?.trim()) {
      const orderNo = body.purchaseOrderNo.trim();
      gatedPurchaseOrderId = ((await withLocalPg(async (sql) => {
        const [order] = await sql`select id from purchase_orders where purchase_order_no = ${orderNo} and deleted_at is null limit 1`;
        return order?.id ?? null;
      })) ?? null) as string | null;
    }
    // When the load belongs to a booking, the row is inserted INSIDE the transaction that holds the booking's row lock and checks the
    // remaining quantity — otherwise two requests could both pass the check before either row existed, and a failed insert would
    // leave the booking's loaded quantity counted without a loading.
    let insertedInLock: { id: string; loading_record_no: string } | null = null;
    let lockedPayload: Record<string, any> | null = null;

    if (gatedPurchaseOrderId) {
      // Mutating reads/writes go through withLocalPg, not the RLS-gated Supabase admin
      // client: in this environment SUPABASE_SERVICE_ROLE_KEY resolves to the same value
      // as the anon key (no real service-role secret configured), so RLS blocks writes
      // here even for a super-admin session — same root cause as the purchase-orders
      // DELETE bug fixed earlier, same fix. Row-locks the PO for the duration so two
      // concurrent loading-record creates can't both under-count persistedLoadedQuantity
      // and jointly over-load the order.
      const purchaseOrderId = gatedPurchaseOrderId;
      const poResult = await (async () => { try { return await withLocalPg(async (sql) => {
        return sql.begin(async (tx) => {
          const poRows = await tx`
            select po.id, po.purchase_order_no, po.order_total, po.advance_paid, po.remaining_due, po.remaining_paid, po.credit_amount,
                   po.currency_code, po.exchange_rate, po.form_data, po.payment_status, po.status, po.ledger_posting_status,
                   po.country_id, po.country_branch_id, po.city_branch_id,
                   (select upper(c.currency_code) from countries c where c.id = po.country_id) as base_currency
            from purchase_orders po where po.id = ${purchaseOrderId}::uuid and po.deleted_at is null
            for update of po
          `;
          const po = poRows[0];
          if (!po) return null;
          // the booking's own branch must be inside the caller's scope (the request's scope fields alone are not enough — a user must not be
          // able to load another branch's booking by naming its id)
          authorizeLogistics(session, {
            action: "create",
            countryId: po.country_id ?? null,
            countryBranchId: po.country_branch_id ?? null,
            cityBranchId: po.city_branch_id ?? null
          });
          // many bookings hold form_data as a JSON string inside the jsonb column; read it as an object so the quantity gate sees the real goods
          po.form_data = parseJsonish(po.form_data);

          // Posted, ledger-verified payments only, in the order's purchase currency (see lib/purchases/loaded-payable.ts)
          const payRows = await tx`
            select kind::text as kind, status::text as status, amount, currency_code, exchange_rate, base_currency_amount,
                   posted_to_journal, roznamcha_entry_id, debit_ledger_id, credit_ledger_id
            from purchase_order_payments
            where purchase_order_id = ${purchaseOrderId}::uuid and deleted_at is null
          `;
          const gateCcy = String(po.currency_code || "USD").toUpperCase();
          const gateBase = String(po.base_currency || gateCcy).toUpperCase();
          const gateRateToBase = gateCcy === gateBase ? 1 : Number(po.exchange_rate) > 0 ? Number(po.exchange_rate) : 1;
          const verified = verifiedPaid(payRows as any, gateCcy, gateRateToBase);
          const totalPaidFC = paidForLoadingGate(resolvePaymentCondition(po as any), verified);

          // ── Approval gate: a booking is loadable only once it has been approved / transferred ──
          const approved =
            po.status === "transferred" || po.ledger_posting_status === "posted" ||
            String(po.form_data?.workflow?.transferStatus ?? "") === "transferred";
          if (!approved) {
            throw new Error("Loading blocked: the Purchase Booking has not been approved (transferred) yet.");
          }

          // ── Loading Eligibility Gate (POST) ──
          // Enforce payment condition before allowing loading record creation
          const eligibility = resolveLoadingEligibility(po as any, totalPaidFC);
          if (!eligibility.eligible) {
            const gapNote = verified.ledgerGaps > 0
              ? ` ${verified.ledgerGaps} posted payment entr${verified.ledgerGaps === 1 ? "y is" : "ies are"} not fully posted to the ledger and ${verified.ledgerGaps === 1 ? "is" : "are"} not counted.`
              : "";
            throw new Error(`Loading blocked: ${eligibility.reason}${gapNote}`);
          }

          const amounts = resolvePurchaseAmounts(po as any);
          const formData = po.form_data || {};
          const workflow = formData.workflow || {};

          const goodsEntries = Array.isArray(formData.goodsEntries) ? formData.goodsEntries : [];
          const goodsQuantity = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.qtyNo || item.quantity || 0), 0);
          const totalContainers = Number(workflow.totalContainers || formData.form?.containerCount || formData.totals?.totalContainers || 0);
          const totalQty = Number(workflow.totalQuantity || formData.totals?.totalQuantity || goodsQuantity || formData.form?.quantity || 0);
          const reportGoodsEntries = Array.isArray((body.reportPayload as any)?.goodsEntries) ? (body.reportPayload as any).goodsEntries : [];
          const normalizedReportEntryCount = Number((body.reportPayload as any)?.entryCount ?? body.loadedContainers ?? reportGoodsEntries.length ?? 1);
          const currentLoadedQuantity = Number(body.loadedQuantity || reportGoodsEntries.reduce((sum: number, item: any) => sum + Number(item.quantityNo || item.loadedQuantity || item.loadingQuantity || item.quantity || 0), 0));

          const existingLoadingRows = await tx`
            select loaded_quantity, report_payload, container_number, created_at from purchase_loading_records
            where purchase_order_id = ${purchaseOrderId}::uuid and deleted_at is null
          `;
          // The identical load submitted again within minutes (double-click, retry, replay) is a repeat, not a new loading.
          const repeatContainer = String(body.containerNumber || "").trim().toLowerCase();
          const repeatQty = Number(body.loadedQuantity || (body.reportPayload as any)?.loadedQuantity || 0);
          if (repeatContainer && existingLoadingRows.some((row: any) =>
            Number(row?.loaded_quantity || 0) > 0 &&
            Number(row?.loaded_quantity || 0) === repeatQty &&
            String(row?.container_number || "").trim().toLowerCase() === repeatContainer &&
            Date.now() - new Date(row?.created_at).getTime() < 15 * 60 * 1000
          )) {
            throw new Error(`Loading blocked: container ${body.containerNumber} with this quantity was just loaded on this purchase order (repeated submission).`);
          }
          const persistedLoadedQuantity = existingLoadingRows.reduce((sum: number, row: any) => {
            return sum + Number(row?.loaded_quantity || row?.report_payload?.loadedQuantity || row?.report_payload?.loadingQuantity || 0);
          }, 0);

          const validatedBundle = reportGoodsEntries.length > 0
            ? validatePurchaseLoadingEntries({
                entryCount: normalizedReportEntryCount,
                entries: reportGoodsEntries,
                totalQuantity: totalQty,
                previousLoadedQuantity: persistedLoadedQuantity
              })
            : null;

          const entryLoadedQuantity = validatedBundle?.loadedQuantity ?? currentLoadedQuantity;
          const newLoadedQuantity = persistedLoadedQuantity + entryLoadedQuantity;

          if (newLoadedQuantity > totalQty) {
            throw new Error("Loaded quantity exceeds the remaining purchase quantity.");
          }

          const remainingContainers = Math.max(0, totalContainers - Number(body.loadedContainers || 1));
          const remainingQuantity = Math.max(0, totalQty - newLoadedQuantity);
          const summary = resolvePurchaseLoadingSummary(po as any, persistedLoadedQuantity, entryLoadedQuantity);

          workflow.totalContainers = totalContainers;
          workflow.loadedContainers = Number(body.loadedContainers || 1) + Number(workflow.loadedContainers || 0);
          workflow.remainingContainers = remainingContainers;

          workflow.totalQuantity = totalQty;
          workflow.loadedQuantity = newLoadedQuantity;
          workflow.remainingQuantity = remainingQuantity;
          workflow.stockStage = "remaining";
          workflow.inventoryStatus = "Remaining Stock";
          workflow.nextDestination = "Land Stock";
          workflow.stockStatus = "RED";
          workflow.containerStatus = remainingContainers > 0 ? "Partially Loaded" : "Fully Loaded";

          formData.workflow = workflow;

          const isPaid = po.payment_status === "completed" || Number(po.remaining_due) === 0;
          if (isPaid && remainingContainers === 0) {
            workflow.lifecycleStatus = "Finalized Purchase Orders";
          }

          await tx`update purchase_orders set form_data = ${tx.json(formData)} where id = ${purchaseOrderId}::uuid`;

          const computed = {
            totalQuantity: summary.totalQuantity,
            loadingPercentage: Math.min(100, summary.totalQuantity > 0 ? (newLoadedQuantity / summary.totalQuantity) * 100 : 0),
            loadedPurchaseAmount: summary.loadedPurchaseFC,
            loadedAdvanceAmount: summary.loadedAdvanceFC,
            purchaseCurrency: amounts.purchaseCurrency,
            orderExchangeRate: amounts.exchangeRate,
            loadedPurchaseLocal: summary.loadedPurchaseLC,
            loadedAdvanceLocal: summary.loadedAdvanceLC,
            remainingLoadingBalance: summary.remainingLoadingFC,
            localCurrency: amounts.localCurrency,
            loadedQuantity: validatedBundle ? validatedBundle.loadedQuantity : loadedQuantity
          };
          // insert the loading under the SAME row lock that just validated the quantity and the payment gate
          const row = buildPayload({ ...computed, purchaseOrderId });
          const lotName = row.lot_name ?? (await allotmentsForOrder(tx, purchaseOrderId, po.purchase_order_no));
          const lockedRow = { ...row, lot_name: lotName };
          const [ins] = await tx`insert into purchase_loading_records ${tx(lockedRow as any)} returning id, loading_record_no`;
          return { ...computed, inserted: ins as { id: string; loading_record_no: string }, row: lockedRow as Record<string, any> };
        });
      }); } catch (e) {
        // a blocked / over-quantity loading is a business-rule refusal (422), not a server fault
        if (e instanceof Error && !(e instanceof ApiClientError) && /^(Loading blocked|Loaded quantity|Loading quantity|Provide exactly|Entry count)/.test(e.message)) {
          throw new ApiClientError(e.message, { status: 422, code: "LOADING_REFUSED" });
        }
        throw e;
      } })();

      if (poResult) {
        totalQuantity = poResult.totalQuantity;
        loadingPercentage = poResult.loadingPercentage;
        loadedPurchaseAmount = poResult.loadedPurchaseAmount;
        loadedAdvanceAmount = poResult.loadedAdvanceAmount;
        purchaseCurrency = poResult.purchaseCurrency;
        orderExchangeRate = poResult.orderExchangeRate;
        loadedPurchaseLocal = poResult.loadedPurchaseLocal;
        loadedAdvanceLocal = poResult.loadedAdvanceLocal;
        remainingLoadingBalance = poResult.remainingLoadingBalance;
        localCurrency = poResult.localCurrency;
        loadedQuantity = poResult.loadedQuantity;
        insertedInLock = poResult.inserted;
        lockedPayload = poResult.row;
      }
    }

    // The row written for a load: hoisted, so the booking transaction above can insert it while it still holds the lock.
    function buildPayload(f: {
      loadedQuantity: number; totalQuantity: number; loadingPercentage: number; loadedPurchaseAmount: number; loadedAdvanceAmount: number;
      purchaseCurrency: string; orderExchangeRate: number; loadedPurchaseLocal: number; loadedAdvanceLocal: number; remainingLoadingBalance: number;
      localCurrency: string; purchaseOrderId: string | null;
    }) {
      const {
        loadedQuantity, totalQuantity, loadingPercentage, loadedPurchaseAmount, loadedAdvanceAmount, purchaseCurrency, orderExchangeRate,
        loadedPurchaseLocal, loadedAdvanceLocal, remainingLoadingBalance, localCurrency
      } = f;
      return {
      country_id: effective.countryId,
      country_branch_id: effective.countryBranchId,
      city_branch_id: effective.cityBranchId,
      purchase_order_id: f.purchaseOrderId,
      purchase_order_no: body.purchaseOrderNo?.trim() || null,
      loading_record_no: loadingRecordNo,
      container_number: body.containerNumber,
      container_type: body.containerType ?? null,
      loading_status: body.loadingStatus,
      loaded_at: body.loadedAt ?? null,
      loading_location: body.loadingLocation ?? null,
      receiving_location: body.receivingLocation ?? null,
      shipment_status: body.shipmentStatus ?? null,
      carrier_name: body.carrierName ?? null,
      remarks: body.remarks ?? null,
      report_payload: {
        ...(body.reportPayload ?? {}),
        goodsEntries: Array.isArray((body.reportPayload as any)?.goodsEntries) ? (body.reportPayload as any).goodsEntries : []
      },
      // Proportional financial columns
      loaded_quantity: loadedQuantity,
      total_quantity: totalQuantity,
      loading_percentage: loadingPercentage,
      loaded_purchase_amount: loadedPurchaseAmount,
      loaded_advance_amount: loadedAdvanceAmount,
      purchase_currency: purchaseCurrency,
      exchange_rate: orderExchangeRate,
      loaded_purchase_local: loadedPurchaseLocal,
      loaded_advance_local: loadedAdvanceLocal,
      remaining_loading_balance: remainingLoadingBalance,
      local_currency: localCurrency,
      // Phase 3 — Transportation.
      transport_mode: body.transportMode ?? null,
      transport_company: body.transportCompany ?? null,
      transport_company_id: body.transportCompanyId ?? null,
      vehicle_no: body.vehicleNo ?? null,
      truck_id: body.truckId ?? null,
      driver_name: body.driverName ?? null,
      driver_mobile: body.driverMobile ?? null,
      shipping_line: body.shippingLine ?? null,
      shipping_line_id: body.shippingLineId ?? null,
      transport_reference: body.transportReference ?? null,
      departure_date: body.departureDate || null,
      expected_arrival_date: body.expectedArrivalDate || null,
      transport_expense_amount: body.transportExpenseAmount,
      transport_expense_currency: body.transportExpenseCurrency,
      transport_remarks: body.transportRemarks ?? null,
      bl_number: body.blNumber ?? ((body.reportPayload as any)?.blNumber || null),
      gross_weight: body.grossWeight ?? null,
      tare_weight: body.tareWeight ?? null,
      net_weight: body.netWeight ?? null,
      seal_number: body.sealNumber ?? ((body.reportPayload as any)?.sealNumber || null),
      vessel_name: body.vesselName ?? ((body.reportPayload as any)?.vesselName || null),
      voyage_no: body.voyageNo ?? null,
      awb_number: body.awbNumber ?? null,
      flight_details: body.flightDetails ?? null,
      rail_reference: body.railReference ?? null,
      origin_text: body.originText ?? null,
      destination_text: body.destinationText ?? null,
      lot_name: body.lotName ?? ((body.reportPayload as any)?.allotName || null),
      created_by: session.userId
      };
    }

    // A load of a booking was already inserted under the booking's lock; any other load (no booking) is inserted here.
    const payload: Record<string, any> = lockedPayload ?? buildPayload({
      loadedQuantity, totalQuantity, loadingPercentage, loadedPurchaseAmount, loadedAdvanceAmount, purchaseCurrency, orderExchangeRate,
      loadedPurchaseLocal, loadedAdvanceLocal, remainingLoadingBalance, localCurrency, purchaseOrderId: body.purchaseOrderId ?? null
    });

    // Same RLS root cause as above — insert (and the transport-expense insert that reuses
    // the existing purchase expense trail) via withLocalPg in one connection.
    const insertResult = await withLocalPg(async (sql) => {
      let rows: Array<{ id: string; loading_record_no: string }>;
      if (insertedInLock) {
        rows = [insertedInLock];
      } else {
        const lotName = payload.lot_name ?? (await allotmentsForOrder(sql, payload.purchase_order_id, payload.purchase_order_no));
        rows = (await sql`insert into purchase_loading_records ${sql({ ...payload, lot_name: lotName } as any)} returning id, loading_record_no`) as any;
      }
      // After Loading the load enters the General Purchase Lane (idempotent: one lane row per loading record).
      if (rows[0]?.id) await ensureLaneFromLoadingRecord(sql, rows[0].id, session);
      if (body.transportExpenseAmount > 0 && payload.purchase_order_id) {
        await sql`insert into purchase_order_expenses ${sql({
          purchase_order_id: payload.purchase_order_id,
          expense_type: "transport",
          description: `Transport (${body.transportMode || "unspecified mode"}) for loading ${loadingRecordNo}`,
          expense_currency: body.transportExpenseCurrency,
          exchange_rate: orderExchangeRate || 1,
          amount_original: body.transportExpenseAmount,
          amount_local: body.transportExpenseAmount * (orderExchangeRate || 1),
          amount_usd: body.transportExpenseCurrency === "USD" ? body.transportExpenseAmount : 0
        } as any)}`;
      }
      return rows[0];
    });
    if (!insertResult) {
      throw new Error("Database connection is not configured for loading-record creation.");
    }
    const inserted = insertResult;

    void syncRecordTranslations({
      table: "purchase_loading_records",
      recordId: (inserted as any).id,
      record: payload,
      originalLanguage: session.preferredLanguage ?? "en",
      actorId: session.userId
    });

    await writeAuditLog({
      action: "create",
      entityTable: "purchase_loading_records",
      entityId: (inserted as any).id ?? null,
      before: null,
      after: payload,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiCreated({ loadingRecordId: (inserted as any).id, loadingRecordNo: (inserted as any).loading_record_no });
  } catch (error) {
    return handleApiError(error);
  }
}
