import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { parseJsonish } from "@/lib/stock-journal/model";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type ConfirmPurchaseBillItem = {
  id: string;
  confirmBillNo: string;
  originalBillNo: string;
  originalBillId: string;
  purchaseType: "booking" | "local";
  purchaseTypeLabel: string;
  paymentType: "Cash" | "Credit" | "Advance" | string;
  supplierName: string;
  supplierAccountNo?: string | null;
  loadingEntryNo: string;
  loadingDate: string;
  loadingAgency: string;
  truckNo: string;
  driverName: string;
  goodsName: string;
  lotNo: string;
  quantityUnit: string;
  loadedQuantity: number;
  grossWeightKg: number;
  netWeightKg: number;
  totalPurchaseQuantity: number;
  totalLoadedQuantity: number;
  remainingLoadingQuantity: number;
  currency: string;
  billTotal: number;
  advancePaid: number;
  remainingPaid: number;
  paymentStatus: string;
  countryName: string;
  branchName: string;
  userName: string;
  containerNo?: string | null;
  blNo?: string | null;
  transferHistory: Array<{
    stage: string;
    date: string;
    reference?: string;
    details?: string;
  }>;
  createdAt: string;
};

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "read" });
    const { searchParams } = new URL(request.url);
    const sourceFilter = searchParams.get("source") || "all"; // all | booking | local
    const query = (searchParams.get("query") || "").toLowerCase().trim();
    const lang = await getRequestLanguage(searchParams.get("lang"));

    const scopedCountryIds = !session.isSuperAdmin && session.countryIds.length > 0 ? session.countryIds : null;
    const scopedCountryBranchIds = !session.isSuperAdmin && session.countryBranchIds.length > 0 ? session.countryBranchIds : null;
    const scopedCityBranchIds = !session.isSuperAdmin && session.cityBranchIds.length > 0 ? session.cityBranchIds : null;

    const data = await withLocalPg(async (sql) => {
      // 1. Fetch Purchase Booking orders with loadings
      let bookingBills: any[] = [];
      if (sourceFilter === "all" || sourceFilter === "booking") {
        const poRows = await sql`
          select
            po.id::text as id,
            po.purchase_order_no,
            po.purchase_contract_no,
            po.currency_code,
            po.order_total,
            po.total_quantity,
            po.gross_weight,
            po.net_weight,
            po.advance_paid,
            po.remaining_paid,
            po.credit_amount,
            po.payment_status,
            po.form_data,
            po.created_at,
            po.country_id::text as country_id,
            po.city_branch_id::text as city_branch_id,
            c.name as country_name,
            cib.city_name as branch_name
          from public.purchase_orders po
          left join public.countries c on c.id = po.country_id
          left join public.city_branches cib on cib.id = po.city_branch_id
          where po.deleted_at is null
            and exists (
              select 1 from public.purchase_loading_records l
              where l.purchase_order_id = po.id and l.deleted_at is null and coalesce(l.loaded_quantity, 0) > 0
            )
            and (${scopedCityBranchIds ? sql`po.city_branch_id = any(${scopedCityBranchIds}::uuid[])` : sql`true`})
            and (${!scopedCityBranchIds && scopedCountryBranchIds ? sql`po.country_branch_id = any(${scopedCountryBranchIds}::uuid[])` : sql`true`})
            and (${!scopedCityBranchIds && !scopedCountryBranchIds && scopedCountryIds ? sql`po.country_id = any(${scopedCountryIds}::uuid[])` : sql`true`})
          order by po.created_at desc
          limit 300;
        `;

        if (poRows.length > 0) {
          const poIds = poRows.map((p: any) => p.id as string);
          const loadings = await sql`
            select
              id::text as id,
              purchase_order_id::text as purchase_order_id,
              loading_record_no,
              container_number,
              truck_number,
              driver_name,
              transporter_name,
              loaded_quantity,
              net_weight,
              gross_weight,
              loading_status,
              report_payload,
              loaded_at,
              created_at
            from public.purchase_loading_records
            where purchase_order_id = any(${poIds}::uuid[])
              and deleted_at is null
              and coalesce(loaded_quantity, 0) > 0
            order by created_at asc, id asc;
          `;

          const loadingsByPo = new Map<string, any[]>();
          for (const l of loadings) {
            const list = loadingsByPo.get(l.purchase_order_id) || [];
            list.push(l);
            loadingsByPo.set(l.purchase_order_id, list);
          }

          for (const po of poRows) {
            const myLoadings = loadingsByPo.get(po.id) || [];
            const fd = parseJsonish(po.form_data) || {};
            const form = fd.form || {};
            const goodsEntries = Array.isArray(fd.goodsEntries) ? fd.goodsEntries : [];
            const goodsName = goodsEntries.map((g: any) => g.goodsName).filter(Boolean).join(", ") || form.goodsName || form.productName || "—";
            const lotNo = goodsEntries.map((g: any) => g.lotNo).filter(Boolean).join(", ") || form.lotNo || form.lotNumber || "—";
            const unit = form.quantityUnit || "Cartons";
            const totalBooked = Number(po.total_quantity || form.totalQuantity || 0);
            const totalLoadedForPo = myLoadings.reduce((sum, l) => sum + Number(l.loaded_quantity || 0), 0);
            const paymentType = form.paymentType || form.paymentCondition || "Advance";
            const supplier = form.supplierName || form.salesAccountName || "—";
            const supplierAcc = form.supplierAccountNo || form.salesAccountNo || null;

            myLoadings.forEach((load, idx) => {
              const loadedQty = Number(load.loaded_quantity || 0);
              const remainingQty = Math.max(0, totalBooked - totalLoadedForPo);
              const p = (typeof load.report_payload === "object" && load.report_payload !== null)
                ? load.report_payload
                : (parseJsonish(load.report_payload) || {});
              const pForm = p.form || {};

              const confirmSeq = String(idx + 1).padStart(2, "0");
              const billRef = po.purchase_order_no || po.id.slice(0, 8);
              const confirmBillNo = `CP-${billRef}-${confirmSeq}`;

              const loadNo = load.loading_record_no || `LD-${confirmSeq}`;
              const loadDate = load.loaded_at?.slice(0, 10) || load.created_at?.slice(0, 10) || "—";
              const truck = load.truck_number || p.truckNo || pForm.truckNo || load.container_number || "—";
              const driver = load.driver_name || p.driverName || pForm.driverName || "—";
              const agency = load.transporter_name || p.transporterName || pForm.shippingLine || form.transporterName || "—";
              const container = load.container_number || p.containerNumber || null;
              const bl = p.blNo || form.blNumber || null;

              const gross = Number(load.gross_weight ?? (totalBooked > 0 ? (loadedQty / totalBooked) * Number(po.gross_weight || form.grossWeight || 0) : 0));
              const net = Number(load.net_weight ?? (totalBooked > 0 ? (loadedQty / totalBooked) * Number(po.net_weight || form.netWeight || 0) : 0));

              bookingBills.push({
                id: `${po.id}-${load.id}`,
                confirmBillNo,
                originalBillNo: po.purchase_order_no || "—",
                originalBillId: po.id,
                purchaseType: "booking" as const,
                purchaseTypeLabel: "Purchase Booking",
                paymentType,
                supplierName: supplier,
                supplierAccountNo: supplierAcc,
                loadingEntryNo: loadNo,
                loadingDate: loadDate,
                loadingAgency: agency,
                truckNo: truck,
                driverName: driver,
                goodsName,
                lotNo,
                quantityUnit: unit,
                loadedQuantity: loadedQty,
                grossWeightKg: Math.round(gross * 100) / 100,
                netWeightKg: Math.round(net * 100) / 100,
                totalPurchaseQuantity: totalBooked,
                totalLoadedQuantity: totalLoadedForPo,
                remainingLoadingQuantity: remainingQty,
                currency: po.currency_code || "USD",
                billTotal: Number(po.order_total || 0),
                advancePaid: Number(po.advance_paid || 0),
                remainingPaid: Number(po.remaining_paid || 0),
                paymentStatus: po.payment_status || "Pending",
                countryName: po.country_name || form.countryName || "—",
                branchName: po.branch_name || form.branchName || "—",
                userName: form.userName || "Admin",
                containerNo: container,
                blNo: bl,
                transferHistory: [
                  { stage: "Booking Registered", date: po.created_at?.slice(0, 10) || "—", reference: po.purchase_order_no },
                  { stage: "Loading Sealed", date: loadDate, reference: loadNo, details: `${loadedQty} ${unit} | Truck: ${truck}` },
                  { stage: "Confirmed Stock Available", date: loadDate, reference: confirmBillNo }
                ],
                createdAt: load.created_at || po.created_at
              });
            });
          }
        }
      }

      // 2. Fetch Local Purchase orders with loadings or completed transfers
      let localBills: any[] = [];
      if (sourceFilter === "all" || sourceFilter === "local") {
        const lpRows = await sql`
          select
            lp.id::text as id,
            lp.manual_bill_no,
            lp.contract_no,
            lp.journal_serial_no,
            lp.purchase_currency,
            lp.local_currency,
            lp.numbers,
            lp.quantity_kgs,
            lp.total_gross_weight,
            lp.net_weight,
            lp.paid_amount,
            lp.advance_amount,
            lp.remaining_balance,
            lp.payment_mode,
            lp.posting_status,
            lp.status,
            lp.loading_status,
            lp.warehouse_transfer_status,
            lp.export_status,
            lp.party_name,
            lp.supplier_name,
            lp.goods_name,
            lp.truck_no,
            lp.driver_name,
            lp.loading_details,
            lp.created_at,
            lp.transfer_date,
            lp.country_id::text as country_id,
            lp.city_branch_id::text as city_branch_id,
            c.name as country_name,
            cib.city_name as branch_name
          from public.local_purchases lp
          left join public.countries c on c.id = lp.country_id
          left join public.city_branches cib on cib.id = lp.city_branch_id
          where lp.deleted_at is null
            and lp.status = 'posted'
            and (${scopedCityBranchIds ? sql`lp.city_branch_id = any(${scopedCityBranchIds}::uuid[])` : sql`true`})
            and (${!scopedCityBranchIds && scopedCountryBranchIds ? sql`lp.country_branch_id = any(${scopedCountryBranchIds}::uuid[])` : sql`true`})
            and (${!scopedCityBranchIds && !scopedCountryBranchIds && scopedCountryIds ? sql`lp.country_id = any(${scopedCountryIds}::uuid[])` : sql`true`})
          order by lp.created_at desc
          limit 300;
        `;

        for (const lp of lpRows) {
          const lDetails = (typeof lp.loading_details === "object" && lp.loading_details !== null)
            ? lp.loading_details
            : (parseJsonish(lp.loading_details) || {});
          const entries: any[] = Array.isArray(lDetails.entries) ? lDetails.entries : [];

          const totalBooked = Number(lp.numbers || lp.quantity_kgs || 0);
          const billNo = lp.manual_bill_no || (lp.contract_no ? `LP-${lp.contract_no}` : (lp.journal_serial_no || `LP-${lp.id.slice(0, 6)}`));
          const currency = lp.purchase_currency || lp.local_currency || "AED";
          const supplier = lp.party_name || lp.supplier_name || "Local Supplier";
          const paymentType = lp.payment_mode || "Cash";
          const paid = Number(lp.paid_amount || 0);
          const adv = Number(lp.advance_amount || 0);
          const payStatus = paid >= totalBooked && totalBooked > 0 ? "Paid" : paid > 0 ? "Partial" : "Pending";

          if (entries.length > 0) {
            // Process each discrete loading entry
            const totalLoadedForLp = entries.reduce((s, e) => s + Number(e.loadedQuantity || 0), 0);
            entries.forEach((entry, idx) => {
              const loadedQty = Number(entry.loadedQuantity || 0);
              const remainingQty = Math.max(0, totalBooked - totalLoadedForLp);
              const confirmSeq = String(idx + 1).padStart(2, "0");
              const confirmBillNo = `CP-${billNo}-${confirmSeq}`;
              const loadNo = entry.loadingNumber || `LD-${confirmSeq}`;
              const loadDate = entry.loadingDate || entry.loadedAt?.slice(0, 10) || lp.transfer_date || lp.created_at?.slice(0, 10) || "—";
              const truck = entry.truckNo || lp.truck_no || "—";
              const driver = entry.driverName || lp.driver_name || "—";
              const agency = entry.transportDetails || "Local Transport";

              const gross = Number(entry.grossWeight ?? (totalBooked > 0 ? (loadedQty / totalBooked) * Number(lp.total_gross_weight || lp.quantity_kgs || 0) : 0));
              const net = Number(entry.netWeight ?? (totalBooked > 0 ? (loadedQty / totalBooked) * Number(lp.net_weight || gross) : 0));

              localBills.push({
                id: `${lp.id}-${entry.id || idx}`,
                confirmBillNo,
                originalBillNo: billNo,
                originalBillId: lp.id,
                purchaseType: "local" as const,
                purchaseTypeLabel: "Local Purchase",
                paymentType,
                supplierName: supplier,
                supplierAccountNo: null,
                loadingEntryNo: loadNo,
                loadingDate: loadDate,
                loadingAgency: agency,
                truckNo: truck,
                driverName: driver,
                goodsName: lp.goods_name || "—",
                lotNo: "—",
                quantityUnit: "Cartons",
                loadedQuantity: loadedQty,
                grossWeightKg: Math.round(gross * 100) / 100,
                netWeightKg: Math.round(net * 100) / 100,
                totalPurchaseQuantity: totalBooked,
                totalLoadedQuantity: totalLoadedForLp,
                remainingLoadingQuantity: remainingQty,
                currency,
                billTotal: Number(lp.total_amount || 0),
                advancePaid: adv,
                remainingPaid: paid,
                paymentStatus: payStatus,
                countryName: lp.country_name || "United Arab Emirates",
                branchName: lp.branch_name || "Main Branch",
                userName: "Local Admin",
                containerNo: entry.blOrContainerNo || null,
                blNo: null,
                transferHistory: [
                  { stage: "Local Bill Posted", date: lp.created_at?.slice(0, 10) || "—", reference: billNo },
                  { stage: "Local Loading Recorded", date: loadDate, reference: loadNo, details: `${loadedQty} Cartons | Truck: ${truck}` },
                  { stage: "Confirmed Stock Available", date: loadDate, reference: confirmBillNo }
                ],
                createdAt: entry.loadedAt || lp.created_at
              });
            });
          } else if (lp.warehouse_transfer_status === "completed" || lp.loading_status === "completed") {
            // Direct transfer or loading without discrete partials
            const loadedQty = totalBooked;
            const confirmBillNo = `CP-${billNo}-01`;
            const loadDate = lp.transfer_date || lp.created_at?.slice(0, 10) || "—";
            const truck = lp.truck_no || "—";
            const driver = lp.driver_name || "—";
            const gross = Number(lp.total_gross_weight || lp.quantity_kgs || 0);
            const net = Number(lp.net_weight || gross);

            localBills.push({
              id: `${lp.id}-direct`,
              confirmBillNo,
              originalBillNo: billNo,
              originalBillId: lp.id,
              purchaseType: "local" as const,
              purchaseTypeLabel: "Local Purchase",
              paymentType,
              supplierName: supplier,
              supplierAccountNo: null,
              loadingEntryNo: `LD-${billNo}-01`,
              loadingDate: loadDate,
              loadingAgency: "Local Transport",
              truckNo: truck,
              driverName: driver,
              goodsName: lp.goods_name || "—",
              lotNo: "—",
              quantityUnit: "Cartons",
              loadedQuantity: loadedQty,
              grossWeightKg: Math.round(gross * 100) / 100,
              netWeightKg: Math.round(net * 100) / 100,
              totalPurchaseQuantity: totalBooked,
              totalLoadedQuantity: loadedQty,
              remainingLoadingQuantity: 0,
              currency,
              billTotal: Number(lp.total_amount || 0),
              advancePaid: adv,
              remainingPaid: paid,
              paymentStatus: payStatus,
              countryName: lp.country_name || "United Arab Emirates",
              branchName: lp.branch_name || "Main Branch",
              userName: "Local Admin",
              containerNo: null,
              blNo: null,
              transferHistory: [
                { stage: "Local Bill Posted", date: lp.created_at?.slice(0, 10) || "—", reference: billNo },
                { stage: "Confirmed Stock Available", date: loadDate, reference: confirmBillNo }
              ],
              createdAt: lp.created_at
            });
          }
        }
      }

      return [...bookingBills, ...localBills];
    });

    let bills: ConfirmPurchaseBillItem[] = data || [];

    // Filter by query if provided
    if (query) {
      bills = bills.filter((b) =>
        b.confirmBillNo.toLowerCase().includes(query) ||
        b.originalBillNo.toLowerCase().includes(query) ||
        b.supplierName.toLowerCase().includes(query) ||
        b.truckNo.toLowerCase().includes(query) ||
        b.driverName.toLowerCase().includes(query) ||
        b.goodsName.toLowerCase().includes(query) ||
        b.loadingEntryNo.toLowerCase().includes(query) ||
        b.countryName.toLowerCase().includes(query)
      );
    }

    // Sort by createdAt descending
    bills.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    // Summary counts
    const summary = {
      totalBills: bills.length,
      bookingBills: bills.filter((b) => b.purchaseType === "booking").length,
      localBills: bills.filter((b) => b.purchaseType === "local").length,
      totalLoadedQuantity: bills.reduce((sum, b) => sum + b.loadedQuantity, 0),
      totalGrossWeightKg: bills.reduce((sum, b) => sum + b.grossWeightKg, 0),
      totalNetWeightKg: bills.reduce((sum, b) => sum + b.netWeightKg, 0),
    };

    return apiOk({
      bills,
      summary
    });
  } catch (error) {
    return handleApiError(error);
  }
}
