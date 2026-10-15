import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { withLocalPg } from "@/lib/db/local-postgres";

const querySchema = z.object({
  purchaseOrderNo: z.string().trim().max(140).optional(),
  goodsName: z.string().trim().max(140).optional(),
  hsCode: z.string().trim().max(40).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  bookingType: z.enum(["all", "purchase_booking", "local_purchase"]).default("all"),
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
  const purchaseCountry = form.purchaseCountry ?? form.branchCountry ?? form.countryName ?? row.country_name ?? row.countries?.name ?? "-";
  const countryOfOrigin = form.countryOfOrigin ?? form.originCountry ?? form.purchaseCountry ?? purchaseCountry;
  const purchaseBranch = form.branchName ?? form.purchaseAccountBranch ?? row.branch_name ?? row.country_branches?.name ?? row.city_branches?.name ?? "-";
  const purchaseAccount = form.purchaseAccountName ?? form.purchaseAccount ?? "-";
  const purchaseAccountNo = form.purchaseAccountNo ?? "-";
  const salesAccount = form.salesAccountName ?? form.salesAccount ?? "-";
  const salesAccountNo = form.salesAccountNo ?? "-";
  const importExport = form.importExport ?? form.tradeType ?? "Import";
  const containerNo = form.containerNo ?? form.containerNumber ?? "-";
  const sealNo = form.sealNo ?? form.sealNumber ?? "-";
  const vesselName = form.vesselName ?? form.shipName ?? "-";

  const countryName = row.country_name ?? row.countries?.name ?? form.branchCountry ?? form.countryName ?? "-";
  const branchName = row.branch_name ?? row.country_branches?.name ?? row.city_branches?.name ?? form.branchName ?? "-";

  const totalOrderLoadedQty = Number(row.loaded_qty ?? data.workflow?.loadedQuantity ?? 0);
  const isFullyTransferred = row.ledger_posting_status === "posted" || data.workflow?.transferStatus === "transferred";
  const confirmationStatus = isFullyTransferred ? "Confirmed / Posted" : "Active Booking";

  if (goods.length === 0) {
    const bookedQty = Number(form.quantity ?? form.qtyNo ?? 0);
    const loadedQty = Math.min(bookedQty, totalOrderLoadedQty);
    const remainingQty = Math.max(0, bookedQty - loadedQty);

    return [{
      orderId: row.id,
      bookingType: "purchase_booking",
      sourceType: "Purchase Booking (Import)",
      billNumber: displayBillNumber,
      systemBillNumber,
      manualBillNumber: manualBillNumber ?? "-",
      receiptDate,
      goodsName: "-",
      hsCode: "-",
      brand: "-",
      size: "-",
      unit: "-",
      quantity: remainingQty,
      bookedQuantity: bookedQty,
      loadedQuantity: loadedQty,
      remainingQuantity: remainingQty,
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
      confirmationStatus,
      transferDestination: form.shippingMode || "Export / Warehouse",
      remarks: form.remarks ?? data.remarks ?? null
    }];
  }

  // If there are multiple goods lines, apportion loaded quantity proportionately
  const totalGoodsBooked = goods.reduce((sum, it) => sum + Number(it.qtyNo ?? it.quantity ?? 0), 0);

  return goods.map((item: any) => {
    const bookedQty = Number(item.qtyNo ?? item.quantity ?? 0);
    const itemRatio = totalGoodsBooked > 0 ? (bookedQty / totalGoodsBooked) : (1 / goods.length);
    const loadedQty = Math.min(bookedQty, Math.round(totalOrderLoadedQty * itemRatio * 100) / 100);
    const remainingQty = Math.max(0, bookedQty - loadedQty);

    return {
      orderId: row.id,
      bookingType: "purchase_booking",
      sourceType: "Purchase Booking (Import)",
      billNumber: displayBillNumber,
      systemBillNumber,
      manualBillNumber: manualBillNumber ?? "-",
      receiptDate,
      goodsName: item.goodsName ?? item.goods_name ?? "-",
      hsCode: item.hsCode ?? item.hs_code ?? "-",
      brand: item.brand ?? form.brand ?? "-",
      size: item.size ?? form.size ?? "-",
      unit: item.qtyName ?? item.unit ?? form.qtyName ?? "-",
      quantity: remainingQty,
      bookedQuantity: bookedQty,
      loadedQuantity: loadedQty,
      remainingQuantity: remainingQty,
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
      confirmationStatus,
      transferDestination: form.shippingMode || "Export / Warehouse",
      remarks: item.remarks ?? form.remarks ?? data.remarks ?? null
    };
  });
}

function expandLocalPurchaseToStockRow(lp: any): any {
  const contractNo = lp.contract_no ? String(lp.contract_no) : "";
  const systemBillNo = contractNo ? `LP-${contractNo}` : (lp.manual_bill_no || `LP-${String(lp.id).slice(0, 8)}`);
  const displayBillNumber = contractNo ? `LP-${contractNo}` : systemBillNo;
  const bookedQty = Number(lp.quantity_kgs ?? 0);
  const isLoaded = lp.warehouse_transfer_status === "transferred" || lp.status === "transferred";
  const loadedQty = isLoaded ? bookedQty : 0;
  const remainingQty = Math.max(0, bookedQty - loadedQty);
  const isPosted = lp.posting_status === "posted" || isLoaded;
  const confirmationStatus = isPosted ? "Confirmed / Posted" : "Active Booking";
  const transferDestination = lp.warehouse_name ? `Warehouse: ${lp.warehouse_name}` : (lp.shipping_mode || "Local Warehouse / Sales");

  return {
    orderId: lp.id,
    bookingType: "local_purchase",
    sourceType: "Local Purchase Booking",
    billNumber: displayBillNumber,
    systemBillNumber: systemBillNo,
    manualBillNumber: contractNo || lp.manual_bill_no || "-",
    receiptDate: lp.created_at,
    goodsName: lp.goods_name ?? "-",
    hsCode: "-",
    brand: lp.brand ?? "-",
    size: lp.size ?? "-",
    unit: lp.quantity_name ?? "KG",
    quantity: remainingQty,
    bookedQuantity: bookedQty,
    loadedQuantity: loadedQty,
    remainingQuantity: remainingQty,
    grossWeight: Number(lp.total_gross_weight ?? 0),
    netWeight: Number(lp.net_weight ?? 0),
    purchaseCountry: lp.country_name ?? "United Arab Emirates",
    countryOfOrigin: lp.origin_country_name ?? "Local Market",
    purchaseBranch: lp.branch_name ?? "Main Branch",
    purchaseAccount: lp.purchase_account_no ? `Purchase (${lp.purchase_account_no})` : "Purchase Account",
    purchaseAccountNo: lp.purchase_account_no ?? "-",
    salesAccount: lp.supplier_name ?? lp.sales_account_no ?? "Supplier Account",
    salesAccountNo: lp.sales_account_no ?? "-",
    importExport: "Local Purchase",
    containerNo: lp.truck_no ?? "-",
    sealNo: "-",
    vesselName: lp.driver_name ? `Truck: ${lp.truck_no || ""} (Driver: ${lp.driver_name})` : "-",
    countryName: lp.country_name ?? "United Arab Emirates",
    branchName: lp.branch_name ?? "Main Branch",
    confirmationStatus,
    transferDestination,
    remarks: lp.remarks ?? null
  };
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
      bookingType: (request.nextUrl.searchParams.get("bookingType") as any) ?? "all",
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

    let poRows: any[] = [];
    let lpRows: any[] = [];

    // Query 1: Purchase Orders (Import Bookings) - including active, accepted, and posted
    if (query.bookingType === "all" || query.bookingType === "purchase_booking") {
      const viaPgPo = await withLocalPg(async (sql) => {
        const rows = await sql`
          SELECT po.*,
                 c.name as country_name,
                 cb.name as branch_name,
                 cb.code as branch_code,
                 city.name as city_branch_name,
                 city.code as city_branch_code,
                 coalesce((
                   SELECT sum(plr.loaded_quantity) 
                   FROM public.purchase_loading_records plr 
                   WHERE plr.purchase_order_id = po.id AND plr.deleted_at IS NULL
                 ), 0) as loaded_qty
          FROM public.purchase_orders po
          LEFT JOIN public.countries c ON c.id = po.country_id
          LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
          LEFT JOIN public.city_branches city ON city.id = po.city_branch_id
          WHERE po.deleted_at IS NULL
            AND (${query.cityBranchId ? sql`po.city_branch_id = ${query.cityBranchId}::uuid` : sql`true`})
            AND (${!query.cityBranchId && query.countryBranchId ? sql`po.country_branch_id = ${query.countryBranchId}::uuid` : sql`true`})
            AND (${!query.cityBranchId && !query.countryBranchId && query.countryId ? sql`po.country_id = ${query.countryId}::uuid` : sql`true`})
            AND (${query.dateFrom ? sql`po.created_at >= ${query.dateFrom}::timestamptz` : sql`true`})
            AND (${query.dateTo ? sql`po.created_at <= ${query.dateTo + "T23:59:59.999Z"}::timestamptz` : sql`true`})
          ORDER BY po.created_at DESC
          LIMIT 1000;
        `;
        return rows;
      });

      if (viaPgPo) {
        poRows = viaPgPo;
      } else {
        const supabase = createSupabaseAdminClient() as any;
        let dbQuery = supabase
          .from("purchase_orders")
          .select(
            "id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, ledger_posting_status, payment_status, form_data, created_at, countries!purchase_orders_country_id_fkey(name, iso2), country_branches!purchase_orders_country_branch_id_fkey(name, code), city_branches!purchase_orders_city_branch_id_fkey(name, code, city_name)"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (query.cityBranchId) dbQuery = dbQuery.eq("city_branch_id", query.cityBranchId);
        else if (query.countryBranchId) dbQuery = dbQuery.eq("country_branch_id", query.countryBranchId);
        else if (query.countryId) dbQuery = dbQuery.eq("country_id", query.countryId);

        if (query.dateFrom) dbQuery = dbQuery.gte("created_at", `${query.dateFrom}T00:00:00.000Z`);
        if (query.dateTo) dbQuery = dbQuery.lte("created_at", `${query.dateTo}T23:59:59.999Z`);

        const { data } = await dbQuery.limit(1000);
        poRows = data ?? [];
      }
    }

    // Query 2: Local Purchases (Local Purchase Bookings)
    if (query.bookingType === "all" || query.bookingType === "local_purchase") {
      const viaPgLp = await withLocalPg(async (sql) => {
        const rows = await sql`
          SELECT lp.*,
                 c.name as country_name,
                 cb.name as branch_name,
                 cb.code as branch_code,
                 city.name as city_branch_name,
                 city.code as city_branch_code
          FROM public.local_purchases lp
          LEFT JOIN public.countries c ON c.id = lp.country_id
          LEFT JOIN public.country_branches cb ON cb.id = lp.country_branch_id
          LEFT JOIN public.city_branches city ON city.id = lp.city_branch_id
          WHERE lp.deleted_at IS NULL
            AND (${query.cityBranchId ? sql`lp.city_branch_id = ${query.cityBranchId}::uuid` : sql`true`})
            AND (${!query.cityBranchId && query.countryBranchId ? sql`lp.country_branch_id = ${query.countryBranchId}::uuid` : sql`true`})
            AND (${!query.cityBranchId && !query.countryBranchId && query.countryId ? sql`lp.country_id = ${query.countryId}::uuid` : sql`true`})
            AND (${query.dateFrom ? sql`lp.created_at >= ${query.dateFrom}::timestamptz` : sql`true`})
            AND (${query.dateTo ? sql`lp.created_at <= ${query.dateTo + "T23:59:59.999Z"}::timestamptz` : sql`true`})
          ORDER BY lp.created_at DESC
          LIMIT 1000;
        `;
        return rows;
      });

      if (viaPgLp) {
        lpRows = viaPgLp;
      } else {
        const supabase = createSupabaseAdminClient() as any;
        let lpQuery = supabase
          .from("local_purchases")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (query.cityBranchId) lpQuery = lpQuery.eq("city_branch_id", query.cityBranchId);
        else if (query.countryBranchId) lpQuery = lpQuery.eq("country_branch_id", query.countryBranchId);
        else if (query.countryId) lpQuery = lpQuery.eq("country_id", query.countryId);

        const { data } = await lpQuery.limit(1000);
        lpRows = data ?? [];
      }
    }

    // Expand orders into stock rows
    const poStockRows = poRows.flatMap(expandOrderToStockRows);
    const lpStockRows = lpRows.map(expandLocalPurchaseToStockRow);

    let allRows: any[] = [...poStockRows, ...lpStockRows];

    // Apply filters
    if (query.purchaseOrderNo) {
      const term = query.purchaseOrderNo.toLowerCase().replace(/[%_]/g, "");
      allRows = allRows.filter((r) =>
        String(r.billNumber || "").toLowerCase().includes(term) ||
        String(r.systemBillNumber || "").toLowerCase().includes(term) ||
        String(r.manualBillNumber || "").toLowerCase().includes(term)
      );
    }

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

    const totalBookedQuantity = allRows.reduce((s, r) => s + Number(r.bookedQuantity || 0), 0);
    const totalLoadedQuantity = allRows.reduce((s, r) => s + Number(r.loadedQuantity || 0), 0);
    const totalRemainingStock = allRows.reduce((s, r) => s + Number(r.remainingQuantity || 0), 0);

    const summary = {
      totalBills: uniqueBills.size,
      totalQuantity: totalRemainingStock,
      totalBookedQuantity,
      totalLoadedQuantity,
      totalRemainingStock,
      purchaseBookingCount: poStockRows.length,
      localPurchaseCount: lpStockRows.length,
      totalGrossWeight: allRows.reduce((s, r) => s + Number(r.grossWeight || 0), 0),
      totalNetWeight: allRows.reduce((s, r) => s + Number(r.netWeight || 0), 0),
      totalContainers: uniqueContainers.size,
      totalRemarks
    };

    // Branch summary from unique orders
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
        totalPages: Math.max(1, Math.ceil(totalRecords / query.limit))
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
