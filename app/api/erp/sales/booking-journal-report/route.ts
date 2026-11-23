import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope, enforceScopeFilter, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { authorize, ErpPermissionError } from "@/lib/permissions/middleware";
import type { ErpSession } from "@/lib/auth/session";
import { billFxOperator } from "@/lib/purchases/fx-operator";
import { isSalesBookingEditLocked } from "@/lib/sales/booking-edit-state";

const querySchema = z.object({
  id: uuidSchema.optional(),
  salesOrderNo: z.string().trim().max(140).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(100),
  q: z.string().optional()
});

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function withTimeout<T>(query: PromiseLike<QueryResult<T>>, label: string, ms = 15000): Promise<QueryResult<T>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      Promise.resolve(query),
      new Promise<QueryResult<T>>((resolve) => {
        timeout = setTimeout(() => resolve({ data: [], error: { message: `${label} timed out` } }), ms);
      })
    ]);
  } catch (error) {
    return {
      data: [],
      error: { message: error instanceof Error ? error.message : `${label} failed` }
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function savedAmount(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function sumSavedAmounts(goods: any[], key: string) {
  const amounts = goods.map(item => savedAmount(item[key]));
  return amounts.length && amounts.every(amount => amount !== null)
    ? amounts.reduce<number>((total, amount) => total + (amount ?? 0), 0)
    : null;
}

function currencyCode(value: unknown) {
  const code = String(value ?? "").trim().split(/\s+/)[0].toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

function normalizeOrder(row: any, session: ErpSession, localPurchases: Map<string, any>) {
  const data = row.form_data ?? {};
  const form = data.form ?? {};
  const totals = data.totals ?? {};
  const goods: any[] = Array.isArray(data.goodsEntries) && data.goodsEntries.length ? data.goodsEntries : form.goodsName ? [form] : [];
  const salesBooking = data.salesBooking ?? {};
  const workflow = data.workflow ?? {};
  
  const quantity = goods.reduce((sum: number, item: any) => sum + Number(item.qtyNo ?? item.quantity ?? 0), 0);
  const totalWeight = goods.reduce((sum: number, item: any) => sum + Number(item.netWeight ?? item.grossWeight ?? 0), 0);
  
  const systemBillNumber = row.sales_order_no ?? form.salesOrderNo ?? "-";
  const manualBillNumber = form.manualBillNumber ?? form.billNo ?? row.sales_contract_no ?? "-";
  const displayBillNumber = [systemBillNumber, manualBillNumber].filter((val) => val && val !== "-").join(" / ") || "-";
  
  const totalGrossWeight = goods.reduce((sum: number, item: any) => sum + (Number(item.grossWeight) || (Number(item.qtyNo || 0) * Number(item.qtyKgs || 0))), 0) || Number(totals.totalGross ?? 0);
  const totalNetWeight = goods.reduce((sum: number, item: any) => sum + Number(item.netWeight ?? 0), 0) || Number(totals.totalNet ?? 0);
  const finalCur = currencyCode(form.secondaryCurrency) ?? currencyCode(row.countries?.currency_code)
    ?? currencyCode(row.currency_code);
  const salesCur = currencyCode(row.original_currency_code) ?? currencyCode(form.salesCurrency)
    ?? currencyCode(form.currencyType) ?? finalCur;
  const salesAmount = savedAmount(totals.grandPrimaryFinal) ?? sumSavedAmounts(goods, "totalAmount")
    ?? (savedAmount(row.total_goods_original) || null)
    ?? (salesCur && salesCur === finalCur ? savedAmount(row.order_total) : null);
  const finalAmount = savedAmount(row.order_total) ?? savedAmount(totals.grandFinal)
    ?? sumSavedAmounts(goods, "finalAmount");

  const purchase = row.linked_purchase;
  const purchaseForm = purchase?.form_data?.form;
  const purchaseCurrency = currencyCode(purchaseForm?.secondaryCurrency) ?? currencyCode(purchase?.currency_code);
  const purchaseAmount = purchaseCurrency ? savedAmount(purchase?.order_total) : null;
  const localPurchaseAccounts = [...new Map(goods.flatMap((item: any) => {
    const linked = localPurchases.get(item.lotPurchaseId);
    return linked?.purchase_account_no || linked?.supplier_name
      ? [[linked.id, { name: linked.supplier_name, code: linked.purchase_account_no }] as const] : [];
  })).values()];
  const lotTotals = new Map<string, number>();
  const hasCompleteLotCost = goods.length > 0 && goods.every((item: any) =>
    item.managedLotId && localPurchases.has(item.lotPurchaseId)
    && currencyCode(item.lotCostCurrency) && savedAmount(item.lotUnitCost) !== null && Number(item.qtyNo) > 0);
  if (hasCompleteLotCost) {
    for (const item of goods) {
      const code = currencyCode(item.lotCostCurrency)!;
      lotTotals.set(code, (lotTotals.get(code) ?? 0) + Number(item.lotUnitCost) * Number(item.qtyNo));
    }
  }
  const purchaseAmounts = Array.from(lotTotals, ([currency, amount]) => ({ currency, amount }));
  const branchSerialNo = row.branch_transaction_serial_number ?? null;
  const finalBranchName = row.city_branches?.name ?? row.country_branches?.name ?? form.branchName ?? "-";
  const finalBranchCode = row.city_branches?.code ?? row.country_branches?.code ?? form.branchCode ?? "-";
  let canEdit = !isSalesBookingEditLocked(row);
  if (canEdit) {
    try {
      authorize({ ...session }, { resource: "sales", action: "update", countryId: row.country_id,
        countryBranchId: row.country_branch_id, cityBranchId: row.city_branch_id });
    } catch (error) {
      if (!(error instanceof ErpPermissionError)) throw error;
      canEdit = false;
    }
  }

  return {
    id: row.id,
    sales_order_no: row.sales_order_no ?? "-",
    sales_contract_no: row.sales_contract_no ?? "-",
    salesBookingOrderNumber: systemBillNumber,
    systemBillNumber,
    manualBillNumber,
    billNumber: displayBillNumber,
    displayBillNumber,
    referenceNo: displayBillNumber,
    salesDate: form.purchaseDate ?? form.salesDate ?? row.order_date ?? row.created_at,
    bookingDate: row.created_at,
    salesAccountName: form.salesAccountName ?? "-",
    salesAccountNumber: form.salesAccountNo ?? "-",
    purchaseAccountName: purchaseForm?.purchaseAccountName || form.purchaseAccountName || "-",
    purchaseAccountNumber: purchaseForm?.purchaseAccountNo || form.purchaseAccountNo || "-",
    customerAccountNumber: row.account_number ?? form.customerAccountNo ?? "-",
    supplierName: form.supplierName ?? "-",
    customerName: row.customer_name ?? form.customerName ?? "-",
    productName: goods.map((item: any) => item.goodsName).filter(Boolean).join(", ") || "-",
    goodsDescription: goods
      .map((item: any) => [item.goodsName, item.size, item.brand, item.origin, item.hsCode ? `HS ${item.hsCode}` : ""].filter(Boolean).join(" / "))
      .filter(Boolean)
      .join("; ") || "-",
    quantity: goods.length ? quantity : savedAmount(row.quantity),
    unit: form.qtyName ?? goods[0]?.qtyName ?? "-",
    totalWeight,
    totalGrossWeight: goods.length ? totalGrossWeight : savedAmount(totals.totalGross),
    totalNetWeight: goods.length ? totalNetWeight : savedAmount(totals.totalNet ?? row.total_weight),
    salesAmount,
    finalAmount,
    purchaseAmount,
    purchaseCurrency,
    purchaseAmounts,
    localPurchaseAccounts,
    containerCount: Number(salesBooking.totalContainersBooked ?? form.bookedContainerCount ?? 0),
    salesRate: Number(goods[0]?.coursePrice ?? goods[0]?.rateOriginal ?? form.coursePrice ?? (quantity > 0 ? (salesAmount ?? 0) / quantity : 0)),
    totalSalesAmount: salesAmount,
    currency: salesCur,
    finalCurrency: finalCur,
    exchange_rate: savedAmount(row.exchange_rate ?? form.exchangeRate),
    canEdit,
    exchangeRateOperator: billFxOperator(data),
    status: row.sales_status ?? "Draft",
    isTransferred: ["transferred", "finalized", "completed", "posted"].includes(String(row.sales_status ?? "").toLowerCase())
      || ["transferred", "posted"].includes(String(row.ledger_posting_status ?? "").toLowerCase())
      || String(workflow.transferStatus ?? "").toLowerCase() === "transferred"
      || Boolean(form.isTransferred || workflow.isTransferred || row.workflow_state?.isTransferred || row.workflow_state?.transferredAt),
    paymentStatus: row.payment_status ?? "Pending",
    deliveryStatus: row.delivery_status ?? "Pending",
    workflowState: row.workflow_state ?? {},
    form_data: row.form_data ?? {},
    superAdminSerialNo: row.super_admin_serial_number ?? null,
    countrySerialNo: row.country_transaction_serial_number ?? null,
    branchSerialNo,
    countryMainBranchSerialNo: row.city_branch_id ? null : branchSerialNo,
    cityBranchSerialNo: row.city_branch_id ? branchSerialNo : null,
    paid_amount: Number(row.paid_amount || 0),
    remaining_amount: Number(row.remaining_amount || 0),
    branchName: finalBranchName,
    branchCode: finalBranchCode,
    countryName: row.countries?.name ?? "-",
    countryCode: row.countries?.iso2 ?? null,
    countryMainBranchName: row.country_branches?.name ?? null,
    countryMainBranchCode: row.country_branches?.code ?? null,
    cityBranchName: row.city_branches?.name ?? null,
    cityBranchCode: row.city_branches?.code ?? null,
    cityName: form.cityName ?? row.city_branches?.city_name ?? "-",
    cityBranchId: row.city_branch_id ?? null,
    countryBranchId: row.country_branch_id ?? null,
    createdByName: form.userName ?? "-",
    createdAt: row.created_at,
    audit: {
      userName: form.userName ?? "-",
      userId: form.userId ?? "-",
      branchCode: finalBranchCode
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      id: request.nextUrl.searchParams.get("id") ?? undefined,
      salesOrderNo: request.nextUrl.searchParams.get("salesOrderNo") ?? undefined,
      dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
      dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined
    });

    let purchaseSession: ErpSession | null = { ...session };
    try {
      authorizeApiScope(purchaseSession, { resource: "purchases", action: "read" });
    } catch (error) {
      if (!(error instanceof ErpPermissionError)) throw error;
      purchaseSession = null;
    }

    authorizeApiScope(session, {
      resource: "sales",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    // sales_orders has scoped RLS (sales_orders_scope_read) and this app's Supabase client
    // is not guaranteed to carry a real service-role key that bypasses RLS on its own — read
    // via a direct Postgres connection when available (same proven bypass as
    // banks-repository.ts/customers-repository.ts), falling back to the Supabase client.
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT so.id, so.country_id, so.country_branch_id, so.city_branch_id, so.customer_account_id,
          so.customer_ledger_id, so.purchase_order_id, so.sales_order_no, so.sales_contract_no, so.order_date,
          so.customer_name, so.account_number, so.manual_reference_number, so.customer_number,
          so.country_serial_number, so.branch_serial_number, so.product_summary, so.quantity, so.total_weight,
          so.currency_code, so.original_currency_code, so.total_goods_original, so.exchange_rate, so.order_total,
          so.paid_amount, so.remaining_amount, so.sales_status, so.ledger_posting_status,
          so.payment_status, so.delivery_status, so.workflow_state, so.form_data, so.super_admin_serial_number,
          so.country_transaction_serial_number, so.branch_transaction_serial_number, so.created_at,
          to_jsonb(c.*) as countries, to_jsonb(cb.*) as country_branches, to_jsonb(cib.*) as city_branches,
          case when po.id is not null then jsonb_build_object('order_total', po.order_total,
            'currency_code', po.currency_code, 'form_data', po.form_data) end as linked_purchase
        FROM public.sales_orders so
        LEFT JOIN public.countries c ON c.id = so.country_id
        LEFT JOIN public.country_branches cb ON cb.id = so.country_branch_id
        LEFT JOIN public.city_branches cib ON cib.id = so.city_branch_id
        LEFT JOIN public.purchase_orders po ON po.id = so.purchase_order_id AND po.deleted_at IS NULL
          AND ${purchaseSession ? sqlScopeCondition(sql, sessionSqlScope(purchaseSession), "po") : sql`false`}
        WHERE so.deleted_at IS NULL
          AND (${query.id ? sql`so.id = ${query.id}::uuid` : sql`true`})
          AND (${query.salesOrderNo ? sql`so.sales_order_no = ${query.salesOrderNo}` : sql`true`})
          AND ${sqlScopeCondition(sql, sessionSqlScope(session), "so")}
          AND (${query.countryId ? sql`so.country_id = ${query.countryId}::uuid` : sql`true`})
          AND (${query.countryBranchId ? sql`so.country_branch_id = ${query.countryBranchId}::uuid` : sql`true`})
          AND (${query.cityBranchId ? sql`so.city_branch_id = ${query.cityBranchId}::uuid` : sql`true`})
          AND (${query.dateFrom ? sql`so.order_date >= ${query.dateFrom}` : sql`true`})
          AND (${query.dateTo ? sql`so.order_date <= ${query.dateTo}` : sql`true`})
          AND (${query.q ? sql`(so.sales_order_no ILIKE ${"%" + query.q + "%"} OR so.customer_name ILIKE ${"%" + query.q + "%"} OR so.account_number ILIKE ${"%" + query.q + "%"} OR so.manual_reference_number ILIKE ${"%" + query.q + "%"})` : sql`true`})
        ORDER BY so.created_at DESC
        LIMIT ${query.limit}
      `;
      return rows;
    });

    let data: any[] | null;
    if (viaPg) {
      data = viaPg as any[];
    } else {
      const admin = createSupabaseAdminClient() as any;
      let recordsQuery = admin
        .from("sales_orders")
        .select(`
          id, country_id, country_branch_id, city_branch_id, customer_account_id, customer_ledger_id, purchase_order_id,
          sales_order_no, sales_contract_no, order_date, customer_name, account_number, manual_reference_number,
          customer_number, country_serial_number, branch_serial_number, product_summary, quantity, total_weight,
          currency_code, original_currency_code, total_goods_original, exchange_rate, order_total,
          paid_amount, remaining_amount, sales_status, ledger_posting_status, payment_status,
          delivery_status, workflow_state, form_data, super_admin_serial_number, country_transaction_serial_number,
          branch_transaction_serial_number, created_at,
          countries(id, name, iso2, currency_code),
          country_branches(id, name, code),
          city_branches(id, name, code, city_name)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (query.id) {
        recordsQuery = recordsQuery.eq("id", query.id);
      }
      if (query.salesOrderNo) {
        recordsQuery = recordsQuery.eq("sales_order_no", query.salesOrderNo);
      }
      // One scope rule: branch users → own branch, country roles → country (enforceScopeFilter).
      recordsQuery = enforceScopeFilter(recordsQuery, session);
      if (query.countryId) {
        recordsQuery = recordsQuery.eq("country_id", query.countryId);
      }
      if (query.countryBranchId) {
        recordsQuery = recordsQuery.eq("country_branch_id", query.countryBranchId);
      }
      if (query.cityBranchId) {
        recordsQuery = recordsQuery.eq("city_branch_id", query.cityBranchId);
      }
      if (query.dateFrom) {
        recordsQuery = recordsQuery.gte("order_date", query.dateFrom);
      }
      if (query.dateTo) {
        recordsQuery = recordsQuery.lte("order_date", query.dateTo);
      }
      if (query.q) {
        const term = `%${query.q}%`;
        recordsQuery = recordsQuery.or(`sales_order_no.ilike.${term},customer_name.ilike.${term},account_number.ilike.${term},manual_reference_number.ilike.${term}`);
      }

      const result = await withTimeout<any>(recordsQuery.limit(query.limit), "sales booking report query");
      if (result.error) {
        throw new Error(result.error.message);
      }
      data = result.data;
      const purchaseIds = [...new Set((data ?? []).map(row => row.purchase_order_id).filter(Boolean))];
      if (purchaseIds.length && purchaseSession) {
        const scoped = enforceScopeFilter(admin.from("purchase_orders")
          .select("id, order_total, currency_code, form_data").in("id", purchaseIds).is("deleted_at", null), purchaseSession);
        const linked = await withTimeout<any>(scoped, "linked purchase report query");
        if (linked.error) throw new Error(linked.error.message);
        const purchases = new Map((linked.data ?? []).map(purchase => [purchase.id, purchase]));
        data = (data ?? []).map(row => ({ ...row, linked_purchase: purchases.get(row.purchase_order_id) }));
      }
    }

    const localPurchaseIds = [...new Set((data ?? []).flatMap(row =>
      (Array.isArray(row.form_data?.goodsEntries) ? row.form_data.goodsEntries : [])
        .map((item: any) => item.lotPurchaseId)
        .filter((id: unknown): id is string => uuidSchema.safeParse(id).success)
    ))];
    let localPurchases = new Map<string, any>();
    if (purchaseSession && localPurchaseIds.length) {
      const scope = purchaseSession;
      const rows = await withLocalPg(sql => sql`
        SELECT lp.id, lp.purchase_account_no, lp.supplier_name FROM public.local_purchases lp
        WHERE lp.id = ANY(${localPurchaseIds}::uuid[]) AND lp.deleted_at IS NULL
          AND ${sqlScopeCondition(sql, sessionSqlScope(scope), "lp")}
      `);
      if (rows) {
        localPurchases = new Map(rows.map(row => [String(row.id), row]));
      } else {
        const admin = createSupabaseAdminClient() as any;
        const scoped = enforceScopeFilter(admin.from("local_purchases")
          .select("id, purchase_account_no, supplier_name").in("id", localPurchaseIds).is("deleted_at", null), scope);
        const result = await withTimeout<any>(scoped, "linked local purchase report query");
        if (result.error) throw new Error(result.error.message);
        localPurchases = new Map((result.data ?? []).map(row => [row.id, row]));
      }
    }
    let normalized = (data ?? []).map(row => normalizeOrder(row, session, localPurchases));

    // Resolve customerName into the active language — record_translations was written keyed
    // by the DB column name "customer_name" (see the POST handler), but normalizeOrder()
    // exposes it as the camelCase "customerName", so alias it across the localize call rather
    // than duplicating the lookup logic. Always resolve, even for lang === "en" — see
    // customers/[id]/route.ts for why skipping that would leak non-English source text.
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    if (normalized.length > 0) {
      const aliased = normalized.map((r: any) => ({ ...r, customer_name: r.customerName }));
      const resolved = await localizeRecordNames<any>(aliased, "sales_orders", "customer_name", lang);
      normalized = resolved.map((r: any) => ({ ...r, customerName: r.customer_name }));
    }

    // Aggregation summary
    const summary = {
      total: normalized.length,
      totalAmount: normalized.reduce((sum, r) => sum + Number(r.salesAmount || 0), 0),
      totalQuantity: normalized.reduce((sum, r) => sum + Number(r.quantity || 0), 0),
      totalContainers: normalized.reduce((sum, r) => sum + Number(r.containerCount || 0), 0)
    };

    return apiOk({
      reports: normalized,
      summary
    });
  } catch (error) {
    return handleApiError(error);
  }
}
