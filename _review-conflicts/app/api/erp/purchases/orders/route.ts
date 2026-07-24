export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError, apiError } from "@/lib/api/response";
import { purchaseOrderCreateSchema, uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeInsertPurchaseOrderItems, safeInsertPurchaseOrderExpenses } from "@/lib/services/purchase-table-manager";
import { revalidatePath } from "next/cache";

const listQuerySchema = z.object({
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  q: z.string().optional()
});

function cleanSerialPrefix(val: string | null | undefined, fallback: string) {
  if (!val) return fallback;
  const clean = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean || fallback;
}

async function nextTransactionSerial(admin: any, scopeType: string, scopeKey: string, prefix: string) {
  const { data, error } = await admin.rpc("next_transaction_serial", {
    p_scope_type: scopeType,
    p_scope_key: scopeKey,
    p_prefix: prefix
  });
  if (error) throw new Error(error.message);
  return data;
}

async function resolveCountryCurrency(admin: any, countryId: string | null | undefined, fallback = "USD") {
  if (!countryId) return fallback;
  const { data } = await admin
    .from("countries")
    .select("currency_code")
    .eq("id", countryId)
    .maybeSingle();
  return data?.currency_code || fallback;
}

async function resolveEffectiveScope(req: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }) {
  const supabase = await createApiSupabaseClient();
  
  if (req.cityBranchId) {
    const { data: row } = await supabase
      .from("city_branches")
      .select("id, country_id, country_branch_id")
      .eq("id", req.cityBranchId)
      .maybeSingle();
    if (row) return { countryId: row.country_id, countryBranchId: row.country_branch_id, cityBranchId: req.cityBranchId };
  }

  if (req.countryBranchId) {
    const { data: row } = await supabase
      .from("country_branches")
      .select("id, country_id")
      .eq("id", req.countryBranchId)
      .maybeSingle();
    if (row) return { countryId: row.country_id, countryBranchId: req.countryBranchId, cityBranchId: null };
  }

  return { countryId: req.countryId ?? null, countryBranchId: null, cityBranchId: null };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = await requireErpSession();

    const query = listQuerySchema.parse({
      countryId: searchParams.get("countryId") || undefined,
      countryBranchId: searchParams.get("countryBranchId") || undefined,
      cityBranchId: searchParams.get("cityBranchId") || undefined,
      limit: searchParams.get("limit") || undefined,
      q: searchParams.get("q") || searchParams.get("search") || searchParams.get("purchaseOrderNo") || undefined
    });

    authorizeApiScope(session, {
      resource: "purchases",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const supabase = await createApiSupabaseClient();
    let q = supabase
      .from("purchase_orders")
      .select(`
        *,
        countries(name, currency_code),
        country_branches(name, code)
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Apply strict DB-level scoping based on user session BEFORE limit
    if (!session.isSuperAdmin) {
      if (session.cityBranchIds.length > 0) {
        q = q.or(`city_branch_id.in.(${session.cityBranchIds.join(",")}),city_branch_id.is.null`);
        if (session.countryIds.length > 0) {
          q = q.in("country_id", session.countryIds);
        }
      } else if (session.countryBranchIds.length > 0) {
        q = q.in("country_branch_id", session.countryBranchIds);
      } else if (session.countryIds.length > 0) {
        q = q.in("country_id", session.countryIds);
      } else {
        q = q.eq("id", "00000000-0000-0000-0000-000000000000"); // Fail-safe empty state
      }
    }

    if (query.cityBranchId) q = q.eq("city_branch_id", query.cityBranchId);
    else if (query.countryBranchId) q = q.eq("country_branch_id", query.countryBranchId);
    else if (query.countryId) q = q.eq("country_id", query.countryId);

    if (query.q) {
      const term = query.q.trim().replace(/[%_]/g, "");
      q = q.or(
        `purchase_order_no.ilike.%${term}%,` +
        `purchase_contract_no.ilike.%${term}%,` +
        `form_data->form->>manualBillNo.ilike.%${term}%,` +
        `form_data->form->>manual_bill_no.ilike.%${term}%,` +
        `form_data->form->>billNo.ilike.%${term}%,` +
        `form_data->form->>invoiceNo.ilike.%${term}%,` +
        `form_data->form->>purchaseContractNo.ilike.%${term}%,` +
        `form_data->form->>supplierName.ilike.%${term}%,` +
        `form_data->form->>customerName.ilike.%${term}%,` +
        `form_data->form->>goodsName.ilike.%${term}%,` +
        `form_data->form->>productName.ilike.%${term}%,` +
        `form_data->form->>purchaseAccountName.ilike.%${term}%,` +
        `form_data->form->>salesAccountName.ilike.%${term}%`
      );
    }

    let rawRows;
    try {
      rawRows = await requireSupabaseData(q.limit(query.limit));
    } catch (e: any) {
      const errMsg = String(e.message || e);
      if (errMsg.includes("column") || errMsg.includes("does not exist") || errMsg.includes("schema cache") || errMsg.includes("relation")) {
        await ensurePurchaseSchemaAndEnums();
        rawRows = await requireSupabaseData(q.limit(query.limit));
      } else {
        throw e;
      }
    }
    const seenPo = new Set<string>();
    const mappedRows = (rawRows ?? []).map((row: any) => ({
      ...row,
      countryName: row.countries?.name || null,
      branchName: row.country_branches?.name || null
    }));
    const rows = mappedRows.filter((row: any) => {
      const poNo = String(row.purchase_order_no || "").trim().toUpperCase();
      if (!poNo) return true;
      if (seenPo.has(poNo)) return false;
      seenPo.add(poNo);
      return true;
    });

    const filteredRows = rows.filter((row: any) => {
      if (session.isSuperAdmin) return true;
      const matchCity = !session.cityBranchIds.length || 
        (row.city_branch_id && session.cityBranchIds.includes(row.city_branch_id)) ||
        (!row.city_branch_id && row.country_branch_id && session.countryBranchIds.includes(row.country_branch_id));
      const matchBranch = !session.countryBranchIds.length || (row.country_branch_id && session.countryBranchIds.includes(row.country_branch_id));
      const matchCountry = !session.countryIds.length || (row.country_id && session.countryIds.includes(row.country_id));
      return matchCity && matchBranch && matchCountry;
    });

    return apiOk(filteredRows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const session = await requireErpSession();
    const body = purchaseOrderCreateSchema.parse(rawBody);

    const effective = await resolveEffectiveScope({
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

    const supabase = await createApiSupabaseClient();
    const adminSupabase = createSupabaseAdminClient() as any;

    let countryPrefix = "PK";
    if (effective.countryId) {
      const { data: countryRow } = await adminSupabase
        .from("countries")
        .select("iso2")
        .eq("id", effective.countryId)
        .maybeSingle();
      if (countryRow?.iso2) countryPrefix = countryRow.iso2.toUpperCase();
    }

    let branchPrefix = "QTA";
    let branchTransactionSerialNumber = null;
    let countryTransactionSerialNumber = null;
    let superAdminSerialNumber = null;

    if (effective.cityBranchId) {
      const { data: cityRow } = await adminSupabase
        .from("city_branches")
        .select("code")
        .eq("id", effective.cityBranchId)
        .maybeSingle();
      if (cityRow?.code) {
        const parts = cityRow.code.split("-");
        branchPrefix = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : cityRow.code.toUpperCase();
      }

      const { count: branchCount } = await adminSupabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("city_branch_id", effective.cityBranchId);
      const bSeq = (branchCount || 0) + 1;
      branchTransactionSerialNumber = `${countryPrefix}-${branchPrefix}-${String(bSeq).padStart(4, "0")}`;
    }

    if (effective.countryId) {
      const { count: countryCount } = await adminSupabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("country_id", effective.countryId);
      const cSeq = (countryCount || 0) + 1;
      countryTransactionSerialNumber = `${countryPrefix}-${String(cSeq).padStart(6, "0")}`;
    }

    const { count: totalCount } = await adminSupabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true });
    const sSeq = (totalCount || 0) + 1;
    superAdminSerialNumber = String(sSeq).padStart(8, "0");

    const purchaseOrderNo =
      !body.purchaseOrderNo || body.purchaseOrderNo === "AUTO"
        ? branchTransactionSerialNumber || `PO-${Date.now()}`
        : body.purchaseOrderNo.trim();

    const orderTotal = body.orderTotal ?? 0;
    const advanceAmount = body.advanceAmount ?? 0;
    const remainingDue = Math.max(0, orderTotal - advanceAmount);
    
    let paymentStatus = body.paymentStatus || "unpaid";
    if (advanceAmount > 0 && advanceAmount < orderTotal) paymentStatus = "partially_paid";
    else if (advanceAmount >= orderTotal && orderTotal > 0) paymentStatus = "paid";

    const ledgerPostingStatus = body.ledgerPostingStatus || "unposted";

    const purchaseCurrency = body.purchaseCurrency || "USD";
    const paymentCurrency = body.paymentCurrency || purchaseCurrency;

    const payload = {
      country_id: effective.countryId,
      country_branch_id: effective.countryBranchId,
      city_branch_id: effective.cityBranchId,
      purchase_order_no: purchaseOrderNo,
      purchase_contract_no: body.purchaseContractNo?.trim() || null,
      supplier_company_id: body.supplierCompanyId ?? null,
      
      purchase_currency: purchaseCurrency,
      payment_currency: paymentCurrency,
      currency_code: purchaseCurrency,
      exchange_rate: body.exchangeRate,
      order_total: body.orderTotal,
      
      total_goods_original: body.totalGoodsOriginal ?? 0,
      total_goods_local: body.totalGoodsLocal ?? 0,
      total_goods_usd: body.totalGoodsUsd ?? 0,
      total_expenses_original: body.totalExpensesOriginal ?? 0,
      total_expenses_local: body.totalExpensesLocal ?? 0,
      total_expenses_usd: body.totalExpensesUsd ?? 0,
      landed_cost_original: body.landedCostOriginal ?? 0,
      landed_cost_local: body.landedCostLocal ?? 0,
      landed_cost_usd: body.landedCostUsd ?? 0,

      form_data: {
        ...(body.formData || {}),
        form: {
          ...(body.formData?.form || {}),
          billNo: branchTransactionSerialNumber || body.formData?.form?.billNo || null
        }
      },
      payment_status: paymentStatus,
      ledger_posting_status: ledgerPostingStatus,
      advance_paid: advanceAmount,
      remaining_due: remainingDue,
      super_admin_serial_number: superAdminSerialNumber,
      country_transaction_serial_number: countryTransactionSerialNumber,
      branch_transaction_serial_number: branchTransactionSerialNumber
    };

    let inserted;
    try {
      inserted = await requireSupabaseData(
        supabase.from("purchase_orders").insert(payload).select("id, purchase_order_no").single()
      );
    } catch (e: any) {
      const errMsg = String(e.message || e);
      if (errMsg.includes("schema cache") || errMsg.includes("column") || errMsg.includes("relation") || errMsg.includes("landed_cost") || errMsg.includes("currency")) {
        await ensurePurchaseSchemaAndEnums();
        try {
          inserted = await requireSupabaseData(
            supabase.from("purchase_orders").insert(payload).select("id, purchase_order_no").single()
          );
        } catch (retryErr: any) {
          return apiError("INSERT_FAILED", retryErr.message || String(retryErr), 400);
        }
      } else {
        return apiError("INSERT_FAILED", errMsg, 400);
      }
    }

    const orderId = (inserted as any).id;

    if (body.items && body.items.length > 0) {
      const itemsPayload = body.items.map((it: any) => ({
        purchase_order_id: orderId,
        product_id: it.productId || null,
        goods_name: it.goodsName || "Unknown",
        hs_code: it.hsCode || null,
        size: it.size || null,
        brand: it.brand || null,
        origin: it.origin || null,
        quantity: it.quantity || 0,
        unit_name: it.unitName || "pcs",
        unit_weight: it.unitWeight || 0,
        gross_weight: it.grossWeight || 0,
        net_weight: it.netWeight || 0,
        // rate_original: it.rateOriginal || 0,
        // rate_local: it.rateLocal || 0,
        // rate_usd: it.rateUsd || 0,
        // total_original: it.totalOriginal || 0,
        // total_local: it.totalLocal || 0,
        // total_usd: it.totalUsd || 0
      }));
      try {
        await safeInsertPurchaseOrderItems(supabase, itemsPayload);
      } catch (e: any) {
        return apiError("ITEMS_INSERT_FAILED", e.message || String(e), 400);
      }
    }

    if (body.expenses && body.expenses.length > 0) {
      const expPayload = body.expenses.map((ex: any) => ({
        purchase_order_id: orderId,
        expense_type: ex.expenseType,
        ledger_id: ex.ledgerId || null,
        description: ex.description || null,
        // expense_currency: ex.expenseCurrency || "USD",
        exchange_rate: ex.exchangeRate || 1,
        // amount_original: ex.amountOriginal || 0,
        // amount_local: ex.amountLocal || 0,
        // amount_usd: ex.amountUsd || 0
      }));
      try {
        await safeInsertPurchaseOrderExpenses(supabase, expPayload);
      } catch (e: any) {
        return apiError("EXPENSES_INSERT_FAILED", e.message || String(e), 400);
      }
    }

    // Ledger posting has been removed from Purchase Booking.
    // Booking must remain only in the Purchase Booking Register until transferred and paid.

    await writeAuditLog({
      action: "create",
      entityTable: "purchase_orders",
      entityId: orderId ?? null,
      before: null,
      after: payload,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    // Requirement 9 & 11: Real-time Synchronization
    revalidatePath("/dashboard/purchases", "layout");
    revalidatePath("/dashboard/reports", "layout");

    return apiCreated({
      purchaseOrderId: orderId as string,
      purchaseOrderNo: (inserted as any).purchase_order_no as string
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}


