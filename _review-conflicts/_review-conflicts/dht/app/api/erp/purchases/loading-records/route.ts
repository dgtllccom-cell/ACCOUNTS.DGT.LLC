export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { optionalUuidSchema, uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope, enforceScopeFilter } from "@/lib/api/scope-middleware";
import { requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePurchaseAmounts, resolveLoadingProportions } from "@/lib/services/purchase-calculation-service";

const loadingStatusSchema = z.enum(["draft", "pending", "loaded", "received", "cancelled"]);

const querySchema = z.object({
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  status: loadingStatusSchema.optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(100)
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
  reportPayload: z.record(z.string(), z.unknown()).default({})
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

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "purchases",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const supabase = createSupabaseAdminClient() as any;
    let recordsQuery = supabase
      .from("purchase_loading_records")
      .select(
        "id, loading_record_no, purchase_order_id, purchase_order_no, container_number, container_type, loading_status, loaded_at, loading_location, receiving_location, shipment_status, carrier_name, remarks, report_payload, country_id, country_branch_id, city_branch_id, loaded_quantity, total_quantity, loading_percentage, loaded_purchase_amount, loaded_advance_amount, purchase_currency, exchange_rate, loaded_purchase_local, loaded_advance_local, payment_made, remaining_loading_balance, local_currency, posted_to_journal, journal_entry_id, journal_posted_at, created_at, countries(name, iso2), country_branches(name, code), city_branches(name, code, city_name), purchase_orders(form_data, advance_paid, remaining_due, order_total, purchase_order_payments(amount, exchange_rate, reference_no, narration, source_reference_no))"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Use unified scope enforcement
    recordsQuery = enforceScopeFilter(recordsQuery, session, {
      countryId: query.countryId,
      countryBranchId: query.countryBranchId,
      cityBranchId: query.cityBranchId
    });

    if (query.status) recordsQuery = recordsQuery.eq("loading_status", query.status);
    if (query.q) {
      const term = query.q.replace(/[%_]/g, "");
      recordsQuery = recordsQuery.or(`loading_record_no.ilike."%${term}%",container_number.ilike."%${term}%",purchase_order_no.ilike."%${term}%",loading_location.ilike."%${term}%",receiving_location.ilike."%${term}%"`);
    }

    const { data, error } = await recordsQuery.limit(query.limit);
    if (error) {
      const message = error.message || "Purchase loading records are not available.";
      if (message.includes("purchase_loading_records") || message.includes("schema cache")) {
        return apiOk(emptyPayload(session, "Purchase Loading Records database table is not migrated yet."));
      }
      throw new Error(message);
    }

    const records = data ?? [];

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

      const { data: poList } = await poQuery.limit(100);
      const existingPoIds = new Set(records.map(r => r.purchase_order_id).filter(Boolean));
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

      const allRecords = [...records, ...syntheticRecords];
      return apiOk({ records: allRecords, setupRequired: false, setupMessage: null });
    } catch (_) {
      return apiOk({ records, setupRequired: false, setupMessage: null });
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
      const { data: po } = await supabase
        .from("purchase_orders")
        .select("id, order_total, advance_paid, remaining_due, remaining_paid, credit_amount, currency_code, exchange_rate, form_data, payment_status")
        .eq("id", body.purchaseOrderId)
        .single();

      if (po) {
        // Use unified calculation service
        const amounts = resolvePurchaseAmounts(po as any);
        const proportions = resolveLoadingProportions(amounts, loadedQuantity, amounts.totalQuantity);

        totalQuantity = proportions.totalQuantity;
        loadingPercentage = proportions.loadingPercentage;
        loadedPurchaseAmount = proportions.loadedPurchaseFC;
        loadedAdvanceAmount = proportions.loadedAdvanceFC;
        purchaseCurrency = amounts.purchaseCurrency;
        orderExchangeRate = amounts.exchangeRate;
        loadedPurchaseLocal = proportions.loadedPurchaseLC;
        loadedAdvanceLocal = proportions.loadedAdvanceLC;
        remainingLoadingBalance = proportions.remainingLoadingFC;
        localCurrency = amounts.localCurrency;

        // Update workflow on the purchase order
        const formData = po.form_data || {};
        const workflow = formData.workflow || {};

        const goodsEntries = Array.isArray(formData.goodsEntries) ? formData.goodsEntries : [];
        const goodsQuantity = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.qtyNo || item.quantity || 0), 0);
        const totalContainers = Number(workflow.totalContainers || formData.form?.containerCount || formData.totals?.totalContainers || 0);
        const totalQty = Number(workflow.totalQuantity || formData.totals?.totalQuantity || goodsQuantity || formData.form?.quantity || 0);

        const currentLoadedContainers = Number(workflow.loadedContainers || 0);
        const currentLoadedQuantity = Number(workflow.loadedQuantity || 0);

        const newLoadedContainers = currentLoadedContainers + body.loadedContainers;
        const newLoadedQuantity = currentLoadedQuantity + body.loadedQuantity;

        const remainingContainers = Math.max(0, totalContainers - newLoadedContainers);
        const remainingQuantity = Math.max(0, totalQty - newLoadedQuantity);

        workflow.totalContainers = totalContainers;
        workflow.loadedContainers = newLoadedContainers;
        workflow.remainingContainers = remainingContainers;

        workflow.totalQuantity = totalQty;
        workflow.loadedQuantity = newLoadedQuantity;
        workflow.remainingQuantity = remainingQuantity;

        if (remainingContainers > 0) {
           workflow.containerStatus = "Partially Loaded";
        } else {
           workflow.containerStatus = "Fully Loaded";
        }

        formData.workflow = workflow;
        
        const isPaid = po.payment_status === "completed" || po.remaining_due === 0;
        
        // Move to Finalized Purchase Orders automatically if paid and fully loaded
        if (isPaid && remainingContainers === 0) {
           workflow.lifecycleStatus = "Finalized Purchase Orders";
        }

        await supabase.from("purchase_orders").update({ 
           form_data: formData
        }).eq("id", body.purchaseOrderId);
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
      report_payload: body.reportPayload ?? {},
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
      created_by: session.userId
    };

    const inserted = await requireSupabaseData(
      supabase
        .from("purchase_loading_records")
        .insert(payload)
        .select("id, loading_record_no")
        .single()
    );

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
