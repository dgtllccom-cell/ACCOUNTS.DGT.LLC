export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { optionalUuidSchema, uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope, enforceScopeFilter } from "@/lib/api/scope-middleware";
import { requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { resolvePurchaseAmounts, resolvePurchaseLoadingSummary, validatePurchaseLoadingEntries } from "@/lib/services/purchase-calculation-service";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";

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
const transportModeSchema = z.enum(["By Road", "By Sea", "By Air"]);

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
  vehicleNo: z.string().trim().max(80).nullable().optional(),
  truckId: optionalUuidSchema,
  driverName: z.string().trim().max(160).nullable().optional(),
  driverMobile: z.string().trim().max(40).nullable().optional(),
  shippingLine: z.string().trim().max(160).nullable().optional(),
  transportReference: z.string().trim().max(160).nullable().optional(),
  departureDate: z.string().trim().max(10).nullable().optional(),
  expectedArrivalDate: z.string().trim().max(10).nullable().optional(),
  transportExpenseAmount: z.coerce.number().min(0).default(0),
  transportExpenseCurrency: z.string().trim().length(3).default("USD"),
  transportRemarks: z.string().trim().max(1000).nullable().optional()
});

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

    authorizeApiScope(session, {
      resource: "purchases",
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
          plr.transport_mode, plr.transport_company, plr.vehicle_no, plr.truck_id, plr.driver_name,
          plr.driver_mobile, plr.shipping_line, plr.transport_reference, plr.departure_date,
          plr.expected_arrival_date, plr.actual_arrival_date, plr.transport_expense_amount,
          plr.transport_expense_currency, plr.transport_remarks, plr.received_quantity, plr.received_at,
          plr.received_by, plr.receiving_warehouse_id, plr.receiving_goods_id, plr.receiving_remarks,
          case when c.id is not null then jsonb_build_object('name', c.name, 'iso2', c.iso2) else null end as countries,
          case when cb.id is not null then jsonb_build_object('name', cb.name, 'code', cb.code) else null end as country_branches,
          case when cib.id is not null then jsonb_build_object('name', cib.name, 'code', cib.code, 'city_name', cib.city_name) else null end as city_branches,
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

    // ── 2. Fetch approved purchase orders with advance paid to ensure all approved bookings show automatically in loading queue ──
    try {
      let poQuery = supabase
        .from("purchase_orders")
        .select("id, purchase_order_no, country_id, country_branch_id, city_branch_id, form_data, advance_paid, remaining_due, order_total, payment_status, created_at, countries(name, iso2), country_branches(name, code), city_branches(name, code, city_name), purchase_order_payments(amount, exchange_rate, reference_no, narration, source_reference_no)")
        .is("deleted_at", null)
        .or("advance_paid.gt.0,payment_status.in.(partially_paid,paid)");

      poQuery = enforceScopeFilter(poQuery, session, {
        countryId: query.countryId,
        countryBranchId: query.countryBranchId,
        cityBranchId: query.cityBranchId
      });
      if (hasDirectCityScope && !query.cityBranchId && session.cityBranchIds.length > 0) {
        poQuery = poQuery.in("city_branch_id", session.cityBranchIds);
      }

      const { data: poList } = await poQuery.limit(100);
      const existingPoIds = new Set(records.map((r: any) => r.purchase_order_id).filter(Boolean));
      const syntheticRecords: any[] = [];

      if (poList && poList.length > 0) {
        for (const po of poList) {
          if (!existingPoIds.has(po.id)) {
            const form = po.form_data?.form || {};
            syntheticRecords.push({
              id: `synthetic-${po.id}`,
              loading_record_no: `PLR-PENDING`,
              purchase_order_id: po.id,
              purchase_order_no: po.purchase_order_no,
              container_number: "-",
              container_type: "20ft Standard",
              loading_status: "pending",
              loaded_at: po.created_at,
              loading_location: form.loadingPort || form.originCountry || "-",
              receiving_location: form.receivedPort || form.destinationCountry || "-",
              shipmentStatus: "Pending Loading",
              carrier_name: "-",
              remarks: "Automatic loading queue entry from approved Purchase Booking.",
              report_payload: {
                loadedQuantity: 0,
                loadingQuantity: 0,
                pending: true
              },
              country_id: po.country_id,
              country_branch_id: po.country_branch_id,
              city_branch_id: po.city_branch_id,
              loaded_quantity: 0,
              total_quantity: Number(po.form_data?.totals?.totalQuantity || form.quantity || 0),
              loading_percentage: 0,
              loaded_purchase_amount: 0,
              loaded_advance_amount: 0,
              purchase_currency: po.currency_code || form.currencyType || "USD",
              exchange_rate: Number(po.exchange_rate || form.exchangeRate || 1),
              loaded_purchase_local: 0,
              loaded_advance_local: 0,
              payment_made: 0,
              remaining_loading_balance: Number(po.order_total || 0),
              local_currency: po.countries?.currency || form.branchCurrency || "PKR",
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
      return apiOk({ records: allRecords, summary: summarize(allRecords), setupRequired: false, setupMessage: null, ...scopePayload });
    } catch (_) {
      const localizedRecords = await localizeLoadingRecords(records, lang);
      return apiOk({ records: localizedRecords, summary: summarize(localizedRecords), setupRequired: false, setupMessage: null, ...scopePayload });
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

    authorizeApiScope(session, {
      resource: "purchases",
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

    if (body.purchaseOrderId) {
      // Mutating reads/writes go through withLocalPg, not the RLS-gated Supabase admin
      // client: in this environment SUPABASE_SERVICE_ROLE_KEY resolves to the same value
      // as the anon key (no real service-role secret configured), so RLS blocks writes
      // here even for a super-admin session — same root cause as the purchase-orders
      // DELETE bug fixed earlier, same fix. Row-locks the PO for the duration so two
      // concurrent loading-record creates can't both under-count persistedLoadedQuantity
      // and jointly over-load the order.
      const purchaseOrderId = body.purchaseOrderId;
      const poResult = await withLocalPg(async (sql) => {
        return sql.begin(async (tx) => {
          const poRows = await tx`
            select id, order_total, advance_paid, remaining_due, remaining_paid, credit_amount,
                   currency_code, exchange_rate, form_data, payment_status
            from purchase_orders where id = ${purchaseOrderId}::uuid
            for update
          `;
          const po = poRows[0];
          if (!po) return null;

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
            select loaded_quantity, report_payload from purchase_loading_records
            where purchase_order_id = ${purchaseOrderId}::uuid and deleted_at is null
          `;
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

          return {
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
        });
      });

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
      }
    }

    const payload = {
      country_id: effective.countryId,
      country_branch_id: effective.countryBranchId,
      city_branch_id: effective.cityBranchId,
      purchase_order_id: body.purchaseOrderId ?? null,
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
      vehicle_no: body.vehicleNo ?? null,
      truck_id: body.truckId ?? null,
      driver_name: body.driverName ?? null,
      driver_mobile: body.driverMobile ?? null,
      shipping_line: body.shippingLine ?? null,
      transport_reference: body.transportReference ?? null,
      departure_date: body.departureDate || null,
      expected_arrival_date: body.expectedArrivalDate || null,
      transport_expense_amount: body.transportExpenseAmount,
      transport_expense_currency: body.transportExpenseCurrency,
      transport_remarks: body.transportRemarks ?? null,
      created_by: session.userId
    };

    // Same RLS root cause as above — insert (and the transport-expense insert that reuses
    // the existing purchase expense trail) via withLocalPg in one connection.
    const insertResult = await withLocalPg(async (sql) => {
      const rows = await sql`insert into purchase_loading_records ${sql(payload as any)} returning id, loading_record_no`;
      if (body.transportExpenseAmount > 0 && body.purchaseOrderId) {
        await sql`insert into purchase_order_expenses ${sql({
          purchase_order_id: body.purchaseOrderId,
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
      originalLanguage: "en",
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
