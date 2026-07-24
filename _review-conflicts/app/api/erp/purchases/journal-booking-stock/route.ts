import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  purchaseOrderNo: z.string().trim().max(140).optional(),
  goodsName: z.string().trim().max(140).optional(),
  hsCode: z.string().trim().max(40).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50)
});

// Expand a purchase_order row into individual goods-line rows for the stock register
function expandOrderToStockRows(row: any): any[] {
  const data = row.form_data ?? {};
  const form = data.form ?? {};
  const goods: any[] = Array.isArray(data.goodsEntries) && data.goodsEntries.length
    ? data.goodsEntries
    : form.goodsName
      ? [form]
      : [];

  const systemBillNumber = row.purchase_order_no ?? form.purchaseOrderNo ?? "-";
  const manualBillNumber =
    form.manualBillNumber ??
    form.manual_bill_number ??
    form.billNo ??
    form.purchaseContractNo ??
    row.purchase_contract_no ??
    null;
  const displayBillNumber =
    [systemBillNumber, manualBillNumber].filter((v) => v && v !== "-").join(" / ") || systemBillNumber || "-";

  const receiptDate = form.purchaseDate ?? form.receiptDate ?? row.created_at;
  const purchaseCountry = form.purchaseCountry ?? form.branchCountry ?? form.countryName ?? row.countries?.name ?? "-";
  const countryOfOrigin = form.countryOfOrigin ?? form.originCountry ?? form.purchaseCountry ?? purchaseCountry;
  const purchaseBranch = form.branchName ?? form.purchaseAccountBranch ?? row.country_branches?.name ?? row.city_branches?.name ?? "-";
  const purchaseAccount = form.purchaseAccountName ?? form.purchaseAccount ?? "-";
  const purchaseAccountNo = form.purchaseAccountNo ?? "-";
  const salesAccount = form.salesAccountName ?? form.salesAccount ?? "-";
  const salesAccountNo = form.salesAccountNo ?? "-";
  const importExport = form.importExport ?? form.tradeType ?? "Import";
  const containerNo = form.containerNo ?? form.containerNumber ?? "-";
  const sealNo = form.sealNo ?? form.sealNumber ?? "-";
  const vesselName = form.vesselName ?? form.shipName ?? "-";

  const countryName = row.countries?.name ?? form.branchCountry ?? form.countryName ?? "-";
  const branchName = row.country_branches?.name ?? row.city_branches?.name ?? form.branchName ?? "-";

  if (goods.length === 0) {
    return [{
      orderId: row.id,
      billNumber: displayBillNumber,
      systemBillNumber,
      manualBillNumber: manualBillNumber ?? "-",
      receiptDate,
      goodsName: "-",
      hsCode: "-",
      unit: "-",
      quantity: 0,
      grossWeight: 0,
      netWeight: 0,
      purchaseCountry,
      countryOfOrigin,
      purchaseBranch,
      purchaseAccount,
      purchaseAccountNo,
      salesAccount,
      salesAccountNo,
      importExport,
      containerNo,
      sealNo,
      vesselName,
      countryName,
      branchName,
      remarks: form.remarks ?? data.remarks ?? null
    }];
  }

  return goods.map((item: any) => ({
    orderId: row.id,
    billNumber: displayBillNumber,
    systemBillNumber,
    manualBillNumber: manualBillNumber ?? "-",
    receiptDate,
    goodsName: item.goodsName ?? item.goods_name ?? "-",
    hsCode: item.hsCode ?? item.hs_code ?? "-",
    unit: item.qtyName ?? item.unit ?? form.qtyName ?? "-",
    quantity: Number(item.qtyNo ?? item.quantity ?? 0),
    grossWeight: Number(item.grossWeight ?? item.gross_weight ?? 0),
    netWeight: Number(item.netWeight ?? item.net_weight ?? 0),
    purchaseCountry,
    countryOfOrigin,
    purchaseBranch,
    purchaseAccount,
    purchaseAccountNo,
    salesAccount,
    salesAccountNo,
    importExport,
    containerNo,
    sealNo,
    vesselName,
    countryName,
    branchName,
    remarks: item.remarks ?? form.remarks ?? data.remarks ?? null
  }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      purchaseOrderNo: request.nextUrl.searchParams.get("purchaseOrderNo") ?? undefined,
      goodsName: request.nextUrl.searchParams.get("goodsName") ?? undefined,
      hsCode: request.nextUrl.searchParams.get("hsCode") ?? undefined,
      dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
      dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      page: request.nextUrl.searchParams.get("page") ?? undefined,
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

    // Only fetch purchase orders that have been fully posted (transferred)
    let dbQuery = supabase
      .from("purchase_orders")
      .select(
        "id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, ledger_posting_status, payment_status, form_data, created_at, countries(name, iso2), country_branches(name, code), city_branches(name, code, city_name)"
      )
      .eq("ledger_posting_status", "posted")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Scope filtering
    if (query.cityBranchId) {
      dbQuery = dbQuery.eq("city_branch_id", query.cityBranchId);
    } else if (!session.isSuperAdmin && session.cityBranchIds.length) {
      dbQuery = dbQuery.in("city_branch_id", session.cityBranchIds);
    } else if (query.countryBranchId) {
      dbQuery = dbQuery.eq("country_branch_id", query.countryBranchId);
    } else if (!session.isSuperAdmin && session.countryBranchIds.length) {
      dbQuery = dbQuery.in("country_branch_id", session.countryBranchIds);
    } else if (query.countryId) {
      dbQuery = dbQuery.eq("country_id", query.countryId);
    } else if (!session.isSuperAdmin) {
      dbQuery = dbQuery.in(
        "country_id",
        session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]
      );
    }

    // Date range
    if (query.dateFrom) {
      dbQuery = dbQuery.gte("created_at", `${query.dateFrom}T00:00:00.000Z`);
    }
    if (query.dateTo) {
      const toDate = new Date(query.dateTo);
      toDate.setDate(toDate.getDate() + 1);
      dbQuery = dbQuery.lte("created_at", toDate.toISOString());
    }

    // Purchase order number filter
    if (query.purchaseOrderNo) {
      const term = query.purchaseOrderNo.replace(/[%_]/g, "");
      dbQuery = dbQuery.or(`purchase_order_no.ilike.%${term}%,purchase_contract_no.ilike.%${term}%`);
    }

    const { data, error } = await dbQuery.limit(1000);

    if (error) {
      return handleApiError(new Error(error.message));
    }

    // Expand all orders into individual goods-line rows
    let allRows: any[] = (data ?? []).flatMap(expandOrderToStockRows);

    // Apply goods-level filters
    if (query.goodsName) {
      const term = query.goodsName.toLowerCase();
      allRows = allRows.filter((r) => String(r.goodsName).toLowerCase().includes(term));
    }
    if (query.hsCode) {
      const term = query.hsCode.toLowerCase();
      allRows = allRows.filter((r) => String(r.hsCode).toLowerCase().includes(term));
    }

    // Compute summary from ALL matching rows (before pagination)
    const uniqueBills = new Set(allRows.map((r) => r.billNumber));
    const uniqueContainers = new Set(allRows.map((r) => r.containerNo).filter((c) => c && c !== "-"));
    const totalRemarks = allRows.filter((r) => r.remarks).length;

    const summary = {
      totalBills: uniqueBills.size,
      totalQuantity: allRows.reduce((s, r) => s + Number(r.quantity || 0), 0),
      totalGrossWeight: allRows.reduce((s, r) => s + Number(r.grossWeight || 0), 0),
      totalNetWeight: allRows.reduce((s, r) => s + Number(r.netWeight || 0), 0),
      totalContainers: uniqueContainers.size,
      totalRemarks
    };

    // Branch summary from unique orders (not rows)
    const uniqueOrders = Array.from(
      new Map(allRows.map((r) => [r.orderId, r])).values()
    );
    const branchSummary = {
      countries: [...new Set(uniqueOrders.map((r) => r.countryName).filter(Boolean))],
      branches: [...new Set(uniqueOrders.map((r) => r.branchName).filter(Boolean))],
      purchaseCountries: [...new Set(uniqueOrders.map((r) => r.purchaseCountry).filter(Boolean))],
      countriesOfOrigin: [...new Set(uniqueOrders.map((r) => r.countryOfOrigin).filter(Boolean))],
      purchaseBranches: [...new Set(uniqueOrders.map((r) => r.purchaseBranch).filter(Boolean))]
    };

    // Paginate
    const totalRecords = allRows.length;
    const offset = (query.page - 1) * query.limit;
    const pageRows = allRows.slice(offset, offset + query.limit);

    return apiOk({
      rows: pageRows,
      summary,
      branchSummary,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / query.limit)
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
