import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  search: z.string().trim().max(140).optional(),
  purchaseOrderNo: z.string().trim().max(140).optional(),
  goodsName: z.string().trim().max(140).optional(),
  stage: z.enum(["all", "journal", "loading", "confirmed", "warehouse", "export", "local_sales", "transfer"]).default("all"),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  containerNo: z.string().trim().max(140).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50)
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const lang = getRequestLanguage(request);
    const query = querySchema.parse({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      purchaseOrderNo: request.nextUrl.searchParams.get("purchaseOrderNo") ?? undefined,
      goodsName: request.nextUrl.searchParams.get("goodsName") ?? undefined,
      stage: (request.nextUrl.searchParams.get("stage") as any) ?? "all",
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      warehouseId: request.nextUrl.searchParams.get("warehouseId") ?? undefined,
      containerNo: request.nextUrl.searchParams.get("containerNo") ?? undefined,
      dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
      dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
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

    const reportData = await withLocalPg(async (sql) => {
      // 1. Fetch Purchase Orders (Import Bookings)
      const poRows = await sql`
        SELECT 
          po.id, po.purchase_order_no, po.purchase_contract_no, po.country_id, po.country_branch_id, po.city_branch_id,
          po.ledger_posting_status, po.payment_status, po.form_data, po.created_at,
          c.name as country_name, c.iso2 as country_code,
          cb.name as country_branch_name, cb.code as country_branch_code,
          cib.city_name as city_branch_name, cib.code as city_branch_code
        FROM public.purchase_orders po
        LEFT JOIN public.countries c ON c.id = po.country_id
        LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
        LEFT JOIN public.city_branches cib ON cib.id = po.city_branch_id
        WHERE po.deleted_at IS NULL
          AND (${query.cityBranchId ? sql`po.city_branch_id = ${query.cityBranchId}::uuid` : sql`true`})
          AND (${!query.cityBranchId && query.countryBranchId ? sql`po.country_branch_id = ${query.countryBranchId}::uuid` : sql`true`})
          AND (${!query.cityBranchId && !query.countryBranchId && query.countryId ? sql`po.country_id = ${query.countryId}::uuid` : sql`true`})
          AND (${query.dateFrom ? sql`po.created_at >= ${query.dateFrom}::timestamptz` : sql`true`})
          AND (${query.dateTo ? sql`po.created_at <= ${query.dateTo + "T23:59:59.999Z"}::timestamptz` : sql`true`})
        ORDER BY po.created_at DESC
        LIMIT 1000;
      `;

      // 2. Fetch Local Purchases
      const lpRows = await sql`
        SELECT 
          lp.*,
          c.name as country_name, c.iso2 as country_code,
          cb.name as country_branch_name, cb.code as country_branch_code,
          cib.city_name as city_branch_name, cib.code as city_branch_code
        FROM public.local_purchases lp
        LEFT JOIN public.countries c ON c.id = lp.country_id
        LEFT JOIN public.country_branches cb ON cb.id = lp.country_branch_id
        LEFT JOIN public.city_branches cib ON cib.id = lp.city_branch_id
        WHERE lp.deleted_at IS NULL
          AND (${query.cityBranchId ? sql`lp.city_branch_id = ${query.cityBranchId}::uuid` : sql`true`})
          AND (${!query.cityBranchId && query.countryBranchId ? sql`lp.country_branch_id = ${query.countryBranchId}::uuid` : sql`true`})
          AND (${!query.cityBranchId && !query.countryBranchId && query.countryId ? sql`lp.country_id = ${query.countryId}::uuid` : sql`true`})
          AND (${query.dateFrom ? sql`lp.created_at >= ${query.dateFrom}::timestamptz` : sql`true`})
          AND (${query.dateTo ? sql`lp.created_at <= ${query.dateTo + "T23:59:59.999Z"}::timestamptz` : sql`true`})
        ORDER BY lp.created_at DESC
        LIMIT 1000;
      `;

      // 3. Fetch Loading Records
      const poIds = poRows.map((r: any) => r.id);
      const loadingRecords = poIds.length > 0
        ? await sql`
            SELECT 
              plr.id, plr.purchase_order_id, plr.loading_record_no, plr.container_number, plr.container_type,
              plr.loading_status, plr.shipment_status, plr.loaded_at, plr.created_at,
              plr.loaded_quantity, plr.vehicle_no, plr.truck_id, plr.driver_name, plr.driver_mobile,
              plr.carrier_name, plr.transport_mode, plr.receiving_warehouse_id, plr.report_payload,
              w.warehouse_name as receiving_warehouse_name, w.warehouse_code as receiving_warehouse_code
            FROM public.purchase_loading_records plr
            LEFT JOIN public.warehouses w ON w.id = plr.receiving_warehouse_id
            WHERE plr.deleted_at IS NULL
              AND plr.purchase_order_id = ANY(${poIds}::uuid[])
            ORDER BY plr.created_at ASC;
          `
        : [];

      // 4. Fetch Stock Transfers
      const allTransfers = await sql`
        SELECT 
          jst.*,
          w.warehouse_name, w.warehouse_code,
          p.full_name as created_by_name
        FROM public.journal_stock_transfers jst
        LEFT JOIN public.warehouses w ON w.id = jst.warehouse_id
        LEFT JOIN public.profiles p ON p.id = jst.created_by
        WHERE jst.deleted_at IS NULL
        ORDER BY jst.created_at ASC;
      `;

      // 5. Fetch Warehouses for dropdown / lookup
      const warehouseList = await sql`
        SELECT id, warehouse_name, warehouse_code, country_id, warehouse_type
        FROM public.warehouses
        WHERE deleted_at IS NULL AND is_active = true
        ORDER BY warehouse_name ASC;
      `;

      return {
        poRows,
        lpRows,
        loadingRecords,
        transfers: allTransfers,
        warehouses: warehouseList
      };
    });

    if (!reportData) {
      throw new Error("Unable to load stock database.");
    }

    const { poRows, lpRows, loadingRecords, transfers, warehouses } = reportData;

    // Index loading records by purchase_order_id
    const loadingsByPo = new Map<string, any[]>();
    for (const lr of loadingRecords) {
      if (!loadingsByPo.has(lr.purchase_order_id)) {
        loadingsByPo.set(lr.purchase_order_id, []);
      }
      loadingsByPo.get(lr.purchase_order_id)!.push(lr);
    }

    // Index transfers by loading_record_id and by purchase_order_id / local_purchase_id
    const transfersByLoadingId = new Map<string, any[]>();
    const transfersByPoId = new Map<string, any[]>();
    const transfersByLpId = new Map<string, any[]>();

    for (const tr of transfers) {
      if (tr.loading_record_id) {
        if (!transfersByLoadingId.has(tr.loading_record_id)) transfersByLoadingId.set(tr.loading_record_id, []);
        transfersByLoadingId.get(tr.loading_record_id)!.push(tr);
      }
      if (tr.purchase_order_id) {
        if (!transfersByPoId.has(tr.purchase_order_id)) transfersByPoId.set(tr.purchase_order_id, []);
        transfersByPoId.get(tr.purchase_order_id)!.push(tr);
      }
      if (tr.local_purchase_id) {
        if (!transfersByLpId.has(tr.local_purchase_id)) transfersByLpId.set(tr.local_purchase_id, []);
        transfersByLpId.get(tr.local_purchase_id)!.push(tr);
      }
    }

    // Assemble unified stock items
    const unifiedRows: any[] = [];

    // Process Purchase Orders (Import Bookings)
    for (const po of poRows) {
      const data = po.form_data ?? {};
      const form = data.form ?? {};
      const goods: any[] = Array.isArray(data.goodsEntries) && data.goodsEntries.length
        ? data.goodsEntries
        : form.goodsName
          ? [form]
          : [{ goodsName: form.goods_name || "General Commodity", quantity: form.quantity || form.qtyNo || 0, unit: form.unit || form.qtyName || "KG" }];

      const poLoadings = loadingsByPo.get(po.id) || [];
      const poTransfers = transfersByPoId.get(po.id) || [];

      const totalLoadedForOrder = poLoadings.reduce((sum, lr) => sum + Number(lr.loaded_quantity || 0), 0);
      const totalTransferredForOrder = poTransfers.reduce((sum, t) => sum + Number(t.quantity || 0), 0);

      const billNo = po.purchase_order_no || form.purchaseOrderNo || "-";
      const manualBillNo = form.manualBillNumber || form.billNo || form.purchaseContractNo || po.purchase_contract_no || null;
      const displayBillNo = [billNo, manualBillNo].filter(v => v && v !== "-").join(" / ") || billNo;
      const purchaseDate = form.purchaseDate || form.receiptDate || po.created_at;

      const supplierName = form.salesAccountName || form.salesAccount || form.supplierName || "Import Supplier";
      const purchaseAccount = form.purchaseAccountName || form.purchaseAccount || "Purchase Account";
      const countryName = po.country_name || form.purchaseCountry || form.countryName || "United Arab Emirates";
      const countryCode = po.country_code || "AE";
      const branchName = po.city_branch_name ? `${po.city_branch_name} Branch` : (po.country_branch_name || "Main Branch");
      const branchCode = po.city_branch_code || po.country_branch_code || "MAIN";

      for (const item of goods) {
        const goodsName = item.goodsName || item.goods_name || form.goodsName || "General Commodity";
        const bookedQty = Number(item.qtyNo || item.quantity || form.quantity || 0);
        const unit = item.qtyName || item.unit || form.qtyName || "KG";

        // Loading for this goods item
        const itemLoadings = poLoadings.filter(lr => !lr.receiving_goods_id || lr.receiving_goods_id === item.goodsId);
        const itemLoadedQty = itemLoadings.length > 0
          ? itemLoadings.reduce((sum, lr) => sum + Number(lr.loaded_quantity || 0), 0)
          : Math.min(bookedQty, totalLoadedForOrder);

        const journalStockBalance = Math.max(0, bookedQty - itemLoadedQty);

        // 1. If there is remaining Journal Stock, emit a Journal Stock row
        if (journalStockBalance > 0) {
          unifiedRows.push({
            id: `JS-PO-${po.id}-${goodsName}`,
            sourceId: po.id,
            sourceType: "purchase_booking",
            sourceLabel: "Purchase Booking (Import)",
            billNumber: displayBillNo,
            systemBillNumber: billNo,
            manualBillNumber: manualBillNo || "-",
            date: purchaseDate,
            countryName,
            countryCode,
            branchName,
            branchCode,
            countryId: po.country_id,
            countryBranchId: po.country_branch_id,
            cityBranchId: po.city_branch_id,
            supplierName,
            purchaseAccount,
            productName: goodsName,
            brand: item.brand || form.brand || "-",
            size: item.size || form.size || "-",
            unit,
            bookedQuantity: bookedQty,
            loadedQuantity: 0,
            transferredQuantity: 0,
            availableQuantity: journalStockBalance,
            currentStage: "journal",
            stageLabel: "Journal Stock (Purchase Entry)",
            currentLocation: "Purchase Order Pending Loading",
            truckOrContainer: form.containerNo || form.containerNumber || "-",
            loadingRecordId: null,
            loadingRecordNo: null,
            loadingDate: null,
            destinationType: null,
            warehouseId: null,
            warehouseName: null,
            remarks: form.remarks || null,
            canTransfer: false // Transfers happen from Loading Stock
          });
        }

        // 2. For each confirmed loading record, emit Loading Stock row or Destination rows
        for (const lr of itemLoadings) {
          const lrTransfers = transfersByLoadingId.get(lr.id) || [];
          const lrLoadedQty = Number(lr.loaded_quantity || 0);
          const lrTransferredQty = lrTransfers.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
          const lrAvailableQty = Math.max(0, lrLoadedQty - lrTransferredQty);

          const truckOrContainer = lr.container_number || lr.vehicle_no || lr.truck_id || form.containerNo || "-";
          const loadingDate = lr.loaded_at || lr.created_at;

          // If there is still loading stock available (not yet transferred to warehouse/export/local-sales)
          if (lrAvailableQty > 0 || lrTransfers.length === 0) {
            unifiedRows.push({
              id: `LS-${lr.id}-${goodsName}`,
              sourceId: po.id,
              sourceType: "purchase_booking",
              sourceLabel: "Purchase Loading (In Transit / Truck)",
              billNumber: displayBillNo,
              systemBillNumber: billNo,
              manualBillNumber: manualBillNo || "-",
              date: purchaseDate,
              countryName,
              countryCode,
              branchName,
              branchCode,
              countryId: po.country_id,
              countryBranchId: po.country_branch_id,
              cityBranchId: po.city_branch_id,
              supplierName,
              purchaseAccount,
              productName: goodsName,
              brand: item.brand || form.brand || "-",
              size: item.size || form.size || "-",
              unit,
              bookedQuantity: bookedQty,
              loadedQuantity: lrLoadedQty,
              transferredQuantity: lrTransferredQty,
              availableQuantity: lrAvailableQty,
              currentStage: "loading",
              stageLabel: "Loading Stock (Truck / Container)",
              currentLocation: `Loaded in: ${truckOrContainer}`,
              truckOrContainer,
              loadingRecordId: lr.id,
              loadingRecordNo: lr.loading_record_no,
              loadingDate,
              destinationType: lr.shipment_status || null,
              warehouseId: lr.receiving_warehouse_id || null,
              warehouseName: lr.receiving_warehouse_name || null,
              remarks: lr.remarks || form.remarks || null,
              canTransfer: lrAvailableQty > 0,
              confirmationStatus: lr.loading_status === "received" || lr.loading_status === "confirmed" || lr.loading_status === "verified"
                ? "Confirmed & Verified"
                : "Loading Confirmed (Gate Ready)",
              isConfirmed: true,
              verifiedAt: lr.loaded_at || lr.created_at,
              verifiedBy: lr.driver_name || lr.carrier_name || "Logistics Gate Incharge"
            });
          }

          // Emit rows for completed transfers from this loading record
          for (const tr of lrTransfers) {
            const destStage = tr.destination_type === "warehouse"
              ? "warehouse"
              : tr.destination_type === "export"
                ? "export"
                : "local_sales";

            const destLabel = tr.destination_type === "warehouse"
              ? `Warehouse Stock (${tr.warehouse_name || "Main Warehouse"})`
              : tr.destination_type === "export"
                ? "Export Stock (International Shipment)"
                : "Local Sales Stock (Allocated for Sales)";

            const destLocation = tr.destination_type === "warehouse"
              ? `Warehouse: ${tr.warehouse_name || "Warehouse"}`
              : tr.destination_type === "export"
                ? "Export Dispatch Dock"
                : "Local Branch Sales Floor";

            unifiedRows.push({
              id: `TRF-${tr.id}`,
              sourceId: po.id,
              sourceType: "purchase_booking",
              sourceLabel: "Stock Transfer Destination",
              billNumber: displayBillNo,
              systemBillNumber: billNo,
              manualBillNumber: manualBillNumberFormat(manualBillNo, tr.transfer_no),
              date: tr.transfer_date || tr.created_at,
              countryName,
              countryCode,
              branchName,
              branchCode,
              countryId: po.country_id,
              countryBranchId: po.country_branch_id,
              cityBranchId: po.city_branch_id,
              supplierName,
              purchaseAccount,
              productName: goodsName,
              brand: item.brand || form.brand || "-",
              size: item.size || form.size || "-",
              unit,
              bookedQuantity: bookedQty,
              loadedQuantity: lrLoadedQty,
              transferredQuantity: Number(tr.quantity || 0),
              availableQuantity: Number(tr.quantity || 0), // available in destination
              currentStage: destStage,
              stageLabel: destLabel,
              currentLocation: destLocation,
              truckOrContainer,
              loadingRecordId: lr.id,
              loadingRecordNo: lr.loading_record_no,
              loadingDate,
              destinationType: tr.destination_type,
              warehouseId: tr.warehouse_id || null,
              warehouseName: tr.warehouse_name || null,
              transferNo: tr.transfer_no,
              transferDate: tr.transfer_date,
              referenceNo: tr.reference_no,
              remarks: tr.remarks || null,
              canTransfer: false
            });
          }
        }
      }
    }

    // Process Local Purchases
    for (const lp of lpRows) {
      const contractNo = lp.contract_no ? String(lp.contract_no) : "";
      const systemBillNo = contractNo ? `LP-${contractNo}` : (lp.manual_bill_no || `LP-${String(lp.id).slice(0, 8)}`);
      const displayBillNo = contractNo ? `LP-${contractNo}` : systemBillNo;
      const bookedQty = Number(lp.quantity_kgs || lp.total_quantity || 0);
      const unit = lp.quantity_name || "KG";
      const goodsName = lp.goods_name || "Local Goods";

      const lpTransfers = transfersByLpId.get(lp.id) || [];
      const totalTransferred = lpTransfers.reduce((sum, t) => sum + Number(t.quantity || 0), 0);

      const isLoaded = lp.warehouse_transfer_status === "transferred" || lp.status === "transferred" || totalTransferred > 0;
      const loadedQty = isLoaded ? bookedQty : 0;
      const journalAvailableQty = Math.max(0, bookedQty - loadedQty);
      const loadingAvailableQty = Math.max(0, loadedQty - totalTransferred);

      const countryName = lp.country_name || "United Arab Emirates";
      const countryCode = lp.country_code || "AE";
      const branchName = lp.city_branch_name ? `${lp.city_branch_name} Branch` : (lp.country_branch_name || "Main Branch");
      const branchCode = lp.city_branch_code || lp.country_branch_code || "MAIN";
      const supplierName = lp.supplier_name || lp.sales_account_no || "Local Supplier";
      const purchaseAccount = lp.purchase_account_no ? `Purchase (${lp.purchase_account_no})` : "Local Purchase Account";
      const truckOrContainer = lp.truck_no || (lp.driver_name ? `Truck (Driver: ${lp.driver_name})` : "-");

      // 1. If not fully loaded, emit Journal Stock
      if (journalAvailableQty > 0) {
        unifiedRows.push({
          id: `JS-LP-${lp.id}`,
          sourceId: lp.id,
          sourceType: "local_purchase",
          sourceLabel: "Local Purchase Booking",
          billNumber: displayBillNo,
          systemBillNumber: systemBillNo,
          manualBillNumber: lp.manual_bill_no || contractNo || "-",
          date: lp.created_at,
          countryName,
          countryCode,
          branchName,
          branchCode,
          countryId: lp.country_id,
          countryBranchId: lp.country_branch_id,
          cityBranchId: lp.city_branch_id,
          supplierName,
          purchaseAccount,
          productName: goodsName,
          brand: lp.brand || "-",
          size: lp.size || "-",
          unit,
          bookedQuantity: bookedQty,
          loadedQuantity: 0,
          transferredQuantity: 0,
          availableQuantity: journalAvailableQty,
          currentStage: "journal",
          stageLabel: "Journal Stock (Local Purchase Entry)",
          currentLocation: "Local Purchase Intake Pending Dispatch",
          truckOrContainer,
          loadingRecordId: null,
          loadingRecordNo: null,
          loadingDate: null,
          destinationType: null,
          warehouseId: null,
          warehouseName: null,
          remarks: lp.remarks || null,
          canTransfer: false
        });
      }

      // 2. If loaded and available for destination transfer
      if (loadingAvailableQty > 0 || (isLoaded && lpTransfers.length === 0)) {
        unifiedRows.push({
          id: `LS-LP-${lp.id}`,
          sourceId: lp.id,
          sourceType: "local_purchase",
          sourceLabel: "Local Purchase Loading Stock",
          billNumber: displayBillNo,
          systemBillNumber: systemBillNo,
          manualBillNumber: lp.manual_bill_no || contractNo || "-",
          date: lp.created_at,
          countryName,
          countryCode,
          branchName,
          branchCode,
          countryId: lp.country_id,
          countryBranchId: lp.country_branch_id,
          cityBranchId: lp.city_branch_id,
          supplierName,
          purchaseAccount,
          productName: goodsName,
          brand: lp.brand || "-",
          size: lp.size || "-",
          unit,
          bookedQuantity: bookedQty,
          loadedQuantity: loadedQty,
          transferredQuantity: totalTransferred,
          availableQuantity: loadingAvailableQty,
          currentStage: "loading",
          stageLabel: "Loading Stock (Local Transit / Truck)",
          currentLocation: `Loaded in: ${truckOrContainer}`,
          truckOrContainer,
          loadingRecordId: null,
          loadingRecordNo: displayBillNo,
          loadingDate: lp.created_at,
          destinationType: null,
          warehouseId: null,
          warehouseName: null,
          remarks: lp.remarks || null,
          canTransfer: loadingAvailableQty > 0
        });
      }

      // 3. Emit Destination Rows for Local Purchase transfers
      for (const tr of lpTransfers) {
        const destStage = tr.destination_type === "warehouse"
          ? "warehouse"
          : tr.destination_type === "export"
            ? "export"
            : "local_sales";

        const destLabel = tr.destination_type === "warehouse"
          ? `Warehouse Stock (${tr.warehouse_name || "Warehouse"})`
          : tr.destination_type === "export"
            ? "Export Stock"
            : "Local Sales Stock";

        unifiedRows.push({
          id: `TRF-${tr.id}`,
          sourceId: lp.id,
          sourceType: "local_purchase",
          sourceLabel: "Stock Transfer Destination",
          billNumber: displayBillNo,
          systemBillNumber: systemBillNo,
          manualBillNumber: manualBillNumberFormat(contractNo, tr.transfer_no),
          date: tr.transfer_date || tr.created_at,
          countryName,
          countryCode,
          branchName,
          branchCode,
          countryId: lp.country_id,
          countryBranchId: lp.country_branch_id,
          cityBranchId: lp.city_branch_id,
          supplierName,
          purchaseAccount,
          productName: goodsName,
          brand: lp.brand || "-",
          size: lp.size || "-",
          unit,
          bookedQuantity: bookedQty,
          loadedQuantity: loadedQty,
          transferredQuantity: Number(tr.quantity || 0),
          availableQuantity: Number(tr.quantity || 0),
          currentStage: destStage,
          stageLabel: destLabel,
          currentLocation: tr.destination_type === "warehouse" ? `Warehouse: ${tr.warehouse_name || "Warehouse"}` : destLabel,
          truckOrContainer,
          loadingRecordId: null,
          loadingRecordNo: null,
          loadingDate: null,
          destinationType: tr.destination_type,
          warehouseId: tr.warehouse_id || null,
          warehouseName: tr.warehouse_name || null,
          transferNo: tr.transfer_no,
          transferDate: tr.transfer_date,
          referenceNo: tr.reference_no,
          remarks: tr.remarks || null,
          canTransfer: false
        });
      }
    }

    // Filter unifiedRows based on stage and query parameters
    let filteredRows = unifiedRows;

    // Filter by Stage Tab
    if (query.stage !== "all") {
      if (query.stage === "confirmed") {
        // Confirmed Stock is a verification stage of loading stock ready for destination transfer
        filteredRows = filteredRows.filter(r => r.currentStage === "loading" && r.canTransfer);
      } else if (query.stage === "transfer") {
        // Stock Transfer: items ready to be transferred to destinations
        filteredRows = filteredRows.filter(r => r.canTransfer && r.availableQuantity > 0);
      } else {
        filteredRows = filteredRows.filter(r => r.currentStage === query.stage);
      }
    }

    // Filter by Search Query
    if (query.search) {
      const q = query.search.toLowerCase().trim();
      filteredRows = filteredRows.filter(r =>
        (r.billNumber && r.billNumber.toLowerCase().includes(q)) ||
        (r.productName && r.productName.toLowerCase().includes(q)) ||
        (r.supplierName && r.supplierName.toLowerCase().includes(q)) ||
        (r.truckOrContainer && r.truckOrContainer.toLowerCase().includes(q)) ||
        (r.loadingRecordNo && r.loadingRecordNo.toLowerCase().includes(q)) ||
        (r.currentLocation && r.currentLocation.toLowerCase().includes(q))
      );
    }

    if (query.goodsName) {
      const q = query.goodsName.toLowerCase().trim();
      filteredRows = filteredRows.filter(r => r.productName && r.productName.toLowerCase().includes(q));
    }

    if (query.purchaseOrderNo) {
      const q = query.purchaseOrderNo.toLowerCase().trim();
      filteredRows = filteredRows.filter(r => r.billNumber && r.billNumber.toLowerCase().includes(q));
    }

    if (query.containerNo) {
      const q = query.containerNo.toLowerCase().trim();
      filteredRows = filteredRows.filter(r => r.truckOrContainer && r.truckOrContainer.toLowerCase().includes(q));
    }

    if (query.warehouseId) {
      filteredRows = filteredRows.filter(r => r.warehouseId === query.warehouseId);
    }

    // Compute Summary across ALL stock
    const summary = {
      totalBookedStock: unifiedRows.reduce((sum, r) => sum + (r.currentStage === "journal" ? r.bookedQuantity : 0), 0) +
                        unifiedRows.reduce((sum, r) => sum + (r.currentStage === "loading" ? r.loadedQuantity : 0), 0),
      journalStock: unifiedRows.filter(r => r.currentStage === "journal").reduce((sum, r) => sum + r.availableQuantity, 0),
      loadingStock: unifiedRows.filter(r => r.currentStage === "loading").reduce((sum, r) => sum + r.availableQuantity, 0),
      confirmedStock: unifiedRows.filter(r => r.currentStage === "loading" && r.canTransfer).reduce((sum, r) => sum + r.availableQuantity, 0),
      warehouseStock: unifiedRows.filter(r => r.currentStage === "warehouse").reduce((sum, r) => sum + r.availableQuantity, 0),
      exportStock: unifiedRows.filter(r => r.currentStage === "export").reduce((sum, r) => sum + r.availableQuantity, 0),
      localSalesStock: unifiedRows.filter(r => r.currentStage === "local_sales").reduce((sum, r) => sum + r.availableQuantity, 0),
      totalActivePipeline: unifiedRows.reduce((sum, r) => sum + r.availableQuantity, 0),
      totalBills: new Set(unifiedRows.map(r => r.billNumber)).size,
      totalWarehouses: warehouses.length
    };

    // Paginate
    const totalRecords = filteredRows.length;
    const offset = (query.page - 1) * query.limit;
    const paginatedRows = filteredRows.slice(offset, offset + query.limit);

    return apiOk({
      rows: paginatedRows,
      summary,
      warehouses,
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

function manualBillNumberFormat(manualNo: string | null, transferNo?: string | null) {
  if (transferNo) return `Transfer: ${transferNo}`;
  return manualNo || "-";
}
