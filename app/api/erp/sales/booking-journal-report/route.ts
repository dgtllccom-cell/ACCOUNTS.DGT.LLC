import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

function normalizeOrder(row: any) {
  const data = row.form_data ?? {};
  const form = data.form ?? {};
  const totals = data.totals ?? {};
  const goods = Array.isArray(data.goodsEntries) && data.goodsEntries.length ? data.goodsEntries : form.goodsName ? [form] : [];
  const salesBooking = data.salesBooking ?? {};
  const workflow = data.workflow ?? {};
  
  const quantity = goods.reduce((sum: number, item: any) => sum + Number(item.qtyNo ?? item.quantity ?? 0), 0);
  const totalWeight = goods.reduce((sum: number, item: any) => sum + Number(item.netWeight ?? item.grossWeight ?? 0), 0);
  const totalAmount = goods.reduce((sum: number, item: any) => sum + Number(item.totalAmount ?? 0), 0) || Number(row.order_total ?? 0);
  
  const systemBillNumber = row.sales_order_no ?? form.salesOrderNo ?? "-";
  const manualBillNumber = form.manualBillNumber ?? form.billNo ?? row.sales_contract_no ?? "-";
  const displayBillNumber = [systemBillNumber, manualBillNumber].filter((val) => val && val !== "-").join(" / ") || "-";
  
  const totalGrossWeight = goods.reduce((sum: number, item: any) => sum + (Number(item.grossWeight) || (Number(item.qtyNo || 0) * Number(item.qtyKgs || 0))), 0) || Number(totals.totalGross ?? 0);
  const totalNetWeight = goods.reduce((sum: number, item: any) => sum + Number(item.netWeight ?? 0), 0) || Number(totals.totalNet ?? 0);
  const salesAmount = goods.reduce((sum: number, item: any) => sum + Number(item.totalAmount ?? 0), 0) || Number(row.order_total ?? 0);
  const finalAmount = goods.reduce((sum: number, item: any) => sum + Number(item.finalAmount ?? 0), 0) || Number(row.order_total ?? 0);

  const countryIso = String(row.countries?.iso2 || "").toUpperCase();
  const countryName = String(row.countries?.name || form.countryName || "").toUpperCase();
  const baseCurrency = countryIso === "AE" || countryName.includes("EMIRATES") || countryName.includes("DUBAI")
    ? "AED"
    : countryIso === "PK" || countryName.includes("PAKISTAN")
      ? "PKR"
      : countryIso === "AF" || countryName.includes("AFGHANISTAN")
        ? "AFN"
        : countryIso === "IN" || countryName.includes("INDIA")
          ? "INR"
          : "USD";

  const salesCurRaw = form.currencyType ?? form.purchaseCurrency ?? row.currency_code ?? baseCurrency;
  const salesCur = String(salesCurRaw || baseCurrency).split(" ")[0].toUpperCase();
  const finalCurRaw = form.secondaryCurrency?.split(" ")[0] ?? form.baseCurrency ?? baseCurrency;
  const finalCur = String(finalCurRaw || baseCurrency).split(" ")[0].toUpperCase();

  const finalBranchName = form.branchName ?? row.country_branches?.name ?? row.city_branches?.name ?? "-";
  const finalBranchCode = form.branchCode ?? row.country_branches?.code ?? row.city_branches?.code ?? "-";
  const finalCountryName = form.branchCountry ?? form.countryName ?? row.countries?.name ?? "-";

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
    purchaseAccountName: form.purchaseAccountName ?? "-",
    purchaseAccountNumber: form.purchaseAccountNo ?? "-",
    supplierName: form.supplierName ?? "-",
    customerName: row.customer_name ?? form.customerName ?? "-",
    productName: goods.map((item: any) => item.goodsName).filter(Boolean).join(", ") || "-",
    goodsDescription: goods
      .map((item: any) => [item.goodsName, item.size, item.brand, item.origin, item.hsCode ? `HS ${item.hsCode}` : ""].filter(Boolean).join(" / "))
      .filter(Boolean)
      .join("; ") || "-",
    quantity,
    unit: form.qtyName ?? goods[0]?.qtyName ?? "-",
    totalWeight,
    totalGrossWeight,
    totalNetWeight,
    salesAmount,
    finalAmount,
    containerCount: Number(salesBooking.totalContainersBooked ?? form.bookedContainerCount ?? 0),
    salesRate: Number(goods[0]?.coursePrice ?? goods[0]?.rateOriginal ?? form.coursePrice ?? (quantity > 0 ? salesAmount / quantity : 0)),
    totalSalesAmount: salesAmount,
    currency: salesCur,
    finalCurrency: finalCur,
    exchange_rate: Number(row.exchange_rate ?? form.exchangeRate ?? 1),
    status: row.sales_status ?? "Draft",
    paymentStatus: row.payment_status ?? "Pending",
    deliveryStatus: row.delivery_status ?? "Pending",
    workflowState: row.workflow_state ?? {},
    form_data: row.form_data ?? {},
    superAdminSerialNo: row.super_admin_serial_number ?? null,
    countrySerialNo: row.country_transaction_serial_number ?? null,
    branchSerialNo: row.branch_transaction_serial_number ?? null,
    paid_amount: Number(row.paid_amount || 0),
    remaining_amount: Number(row.remaining_amount || 0),
    branchName: finalBranchName,
    branchCode: finalBranchCode,
    countryName: finalCountryName,
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
      salesOrderNo: request.nextUrl.searchParams.get("salesOrderNo") ?? undefined,
      dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
      dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "sales",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const admin = createSupabaseAdminClient() as any;
    let recordsQuery = admin
      .from("sales_orders")
      .select(`
        id, country_id, country_branch_id, city_branch_id, customer_account_id, customer_ledger_id, purchase_order_id,
        sales_order_no, sales_contract_no, order_date, customer_name, account_number, manual_reference_number,
        customer_number, country_serial_number, branch_serial_number, product_summary, quantity, total_weight,
        currency_code, exchange_rate, order_total, paid_amount, remaining_amount, sales_status, payment_status,
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
    if (query.countryId) {
      recordsQuery = recordsQuery.eq("country_id", query.countryId);
    } else if (!session.isSuperAdmin && session.countryIds.length) {
      recordsQuery = recordsQuery.in("country_id", session.countryIds);
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

    const { data, error } = await withTimeout<any>(recordsQuery.limit(query.limit), "sales booking report query");
    if (error) {
      throw new Error(error.message);
    }

    const normalized = (data ?? []).map(normalizeOrder);
    
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
