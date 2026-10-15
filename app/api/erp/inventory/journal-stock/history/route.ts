import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const historyQuerySchema = z.object({
  sourceType: z.enum(["purchase_booking", "local_purchase"]),
  sourceId: uuidSchema,
  loadingRecordId: uuidSchema.optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang") || request.nextUrl.searchParams.get("language"));
    const query = historyQuerySchema.parse({
      sourceType: request.nextUrl.searchParams.get("sourceType") as any,
      sourceId: request.nextUrl.searchParams.get("sourceId"),
      loadingRecordId: request.nextUrl.searchParams.get("loadingRecordId") || undefined
    });

    const history = await withLocalPg(async (sql) => {
      let purchaseInfo: any = null;
      let loadingEvents: any[] = [];
      let transferEvents: any[] = [];

      if (query.sourceType === "purchase_booking") {
        // 1. Fetch Purchase Order Info
        const poRows = await sql`
          SELECT 
            po.id, po.purchase_order_no, po.purchase_contract_no, po.created_at, po.form_data,
            c.name as country_name,
            cb.name as country_branch_name,
            cib.city_name as city_branch_name
          FROM public.purchase_orders po
          LEFT JOIN public.countries c ON c.id = po.country_id
          LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
          LEFT JOIN public.city_branches cib ON cib.id = po.city_branch_id
          WHERE po.id = ${query.sourceId}::uuid AND po.deleted_at IS NULL
          LIMIT 1;
        `;

        if (poRows.length > 0) {
          const po = poRows[0];
          const form = po.form_data?.form || {};
          purchaseInfo = {
            id: po.id,
            sourceType: "purchase_booking",
            billNo: po.purchase_order_no || form.purchaseOrderNo || "-",
            contractNo: po.purchase_contract_no || form.purchaseContractNo || "-",
            date: form.purchaseDate || po.created_at,
            country: po.country_name || form.purchaseCountry || "-",
            branch: po.city_branch_name ? `${po.city_branch_name} Branch` : (po.country_branch_name || "-"),
            supplier: form.salesAccountName || form.supplierName || "Import Supplier",
            goodsName: form.goodsName || form.goods_name || "General Commodity",
            bookedQuantity: Number(form.quantity || form.qtyNo || 0),
            unit: form.unit || form.qtyName || "KG"
          };
        }

        // 2. Fetch Loading Records
        const lrRows = await sql`
          SELECT 
            plr.id, plr.loading_record_no, plr.container_number, plr.container_type,
            plr.vehicle_no, plr.truck_id, plr.driver_name, plr.loaded_quantity,
            plr.loaded_at, plr.created_at, plr.shipment_status,
            w.warehouse_name as receiving_warehouse_name
          FROM public.purchase_loading_records plr
          LEFT JOIN public.warehouses w ON w.id = plr.receiving_warehouse_id
          WHERE plr.purchase_order_id = ${query.sourceId}::uuid
            AND plr.deleted_at IS NULL
          ORDER BY plr.created_at ASC;
        `;

        loadingEvents = lrRows.map((lr: any) => ({
          id: lr.id,
          loadingRecordNo: lr.loading_record_no || "-",
          containerTruck: lr.container_number || lr.vehicle_no || lr.truck_id || "-",
          driverName: lr.driver_name || "-",
          loadedQuantity: Number(lr.loaded_quantity || 0),
          loadingDate: lr.loaded_at || lr.created_at,
          receivingWarehouse: lr.receiving_warehouse_name || null,
          status: lr.shipment_status || "Loaded"
        }));

        // 3. Fetch Stock Transfers
        const trRows = await sql`
          SELECT 
            jst.*,
            w.warehouse_name,
            p.full_name as created_by_name
          FROM public.journal_stock_transfers jst
          LEFT JOIN public.warehouses w ON w.id = jst.warehouse_id
          LEFT JOIN public.profiles p ON p.id = jst.created_by
          WHERE jst.purchase_order_id = ${query.sourceId}::uuid
            AND jst.deleted_at IS NULL
          ORDER BY jst.transfer_date ASC, jst.created_at ASC;
        `;

        transferEvents = trRows.map((t: any) => ({
          id: t.id,
          transferNo: t.transfer_no,
          loadingRecordId: t.loading_record_id,
          destinationType: t.destination_type,
          destinationLabel: t.destination_type === "warehouse"
            ? `Warehouse Stock (${t.warehouse_name || "Main Warehouse"})`
            : t.destination_type === "export"
              ? "Export Stock"
              : "Local Sales Stock",
          quantity: Number(t.quantity || 0),
          unit: t.unit || "KG",
          transferDate: t.transfer_date || t.created_at,
          referenceNo: t.reference_no || "-",
          remarks: t.remarks || "-",
          transferredBy: t.created_by_name || "Authorized Staff"
        }));
      } else {
        // Local Purchase
        const lpRows = await sql`
          SELECT 
            lp.*,
            c.name as country_name,
            cb.name as country_branch_name,
            cib.city_name as city_branch_name
          FROM public.local_purchases lp
          LEFT JOIN public.countries c ON c.id = lp.country_id
          LEFT JOIN public.country_branches cb ON cb.id = lp.country_branch_id
          LEFT JOIN public.city_branches cib ON cib.id = lp.city_branch_id
          WHERE lp.id = ${query.sourceId}::uuid AND lp.deleted_at IS NULL
          LIMIT 1;
        `;

        if (lpRows.length > 0) {
          const lp = lpRows[0];
          purchaseInfo = {
            id: lp.id,
            sourceType: "local_purchase",
            billNo: lp.manual_bill_no || `LP-${lp.contract_no || lp.id.slice(0, 8)}`,
            contractNo: lp.contract_no ? String(lp.contract_no) : "-",
            date: lp.created_at,
            country: lp.country_name || "-",
            branch: lp.city_branch_name ? `${lp.city_branch_name} Branch` : (lp.country_branch_name || "-"),
            supplier: lp.supplier_name || lp.sales_account_no || "Local Supplier",
            goodsName: lp.goods_name || "Local Commodity",
            bookedQuantity: Number(lp.quantity_kgs || lp.total_quantity || 0),
            unit: lp.quantity_name || "KG"
          };
        }

        // Local purchase transfers
        const trRows = await sql`
          SELECT 
            jst.*,
            w.warehouse_name,
            p.full_name as created_by_name
          FROM public.journal_stock_transfers jst
          LEFT JOIN public.warehouses w ON w.id = jst.warehouse_id
          LEFT JOIN public.profiles p ON p.id = jst.created_by
          WHERE jst.local_purchase_id = ${query.sourceId}::uuid
            AND jst.deleted_at IS NULL
          ORDER BY jst.transfer_date ASC, jst.created_at ASC;
        `;

        transferEvents = trRows.map((t: any) => ({
          id: t.id,
          transferNo: t.transfer_no,
          loadingRecordId: t.loading_record_id,
          destinationType: t.destination_type,
          destinationLabel: t.destination_type === "warehouse"
            ? `Warehouse Stock (${t.warehouse_name || "Warehouse"})`
            : t.destination_type === "export"
              ? "Export Stock"
              : "Local Sales Stock",
          quantity: Number(t.quantity || 0),
          unit: t.unit || "KG",
          transferDate: t.transfer_date || t.created_at,
          referenceNo: t.reference_no || "-",
          remarks: t.remarks || "-",
          transferredBy: t.created_by_name || "Authorized Staff"
        }));
      }

      // Compute pipeline status
      const totalBooked = Number(purchaseInfo?.bookedQuantity || 0);
      const totalLoaded = loadingEvents.reduce((s, lr) => s + lr.loadedQuantity, 0);
      const totalTransferred = transferEvents.reduce((s, t) => s + t.quantity, 0);

      const journalRemaining = Math.max(0, totalBooked - totalLoaded);
      const loadingRemaining = Math.max(0, totalLoaded - totalTransferred);
      const warehouseTotal = transferEvents.filter(t => t.destinationType === "warehouse").reduce((s, t) => s + t.quantity, 0);
      const exportTotal = transferEvents.filter(t => t.destinationType === "export").reduce((s, t) => s + t.quantity, 0);
      const localSalesTotal = transferEvents.filter(t => t.destinationType === "local_sales").reduce((s, t) => s + t.quantity, 0);

      return {
        purchaseInfo,
        loadingEvents,
        transferEvents,
        summary: {
          totalBooked,
          totalLoaded,
          journalRemaining,
          loadingRemaining,
          warehouseTotal,
          exportTotal,
          localSalesTotal
        }
      };
    });

    return apiOk(history);
  } catch (error) {
    return handleApiError(error);
  }
}
