import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ExcelJS from "exceljs";
import { ApiClientError, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { ErpPermissionError } from "@/lib/permissions/middleware";
import { loadBalance, permissionsOf } from "@/lib/services/stock-balance-report-service";
import { billSummaries, paymentRows, saleRows, stockRows, treatmentRows } from "@/lib/stock-balance/views";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  kind: z.enum(["journal", "bill", "bills", "sales", "stock", "payments", "treatments"]).default("journal"),
  type: z.enum(["booking", "local"]).optional(),
  id: uuidSchema.optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  companyId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  billNo: z.string().trim().max(140).optional(),
  salesBillNo: z.string().trim().max(140).optional(),
  lotNo: z.string().trim().max(140).optional(),
  goodsName: z.string().trim().max(140).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(["available", "in_transit", "not_loaded", "sold_out", "over_sold"]).optional(),
});

/**
 * Excel export of the Stock Balance Report. Server side, so the SAME scope rule and the export permission are enforced here (not just a
 * hidden button): the rows are exactly the ones the report shows for this user, in the viewer's language, RTL sheets for UR / AR / FA / PS.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const perms = permissionsOf(session);
    if (!perms.export) throw new ErpPermissionError("Missing permission: export");
    const sp = request.nextUrl.searchParams;
    const q = querySchema.parse(Object.fromEntries([...sp.entries()].map(([k, v]) => [k, v === "" ? undefined : v])));
    const lang = await getRequestLanguage(sp.get("lang"));
    const L = (key: string, en: string) => t(lang, `sbr.${key}` as never, en);
    const { kind, id, ...filters } = q;
    const one = kind === "bill";
    if (one && (!q.type || !id)) throw new ApiClientError("A bill type and id are required for a single-bill export.", { status: 400, code: "BAD_REQUEST" });
    const { bills, unlinkedSales } = await loadBalance(session, one ? { ...filters, billId: id, lang } : { ...filters, lang });
    if (one && bills.length === 0) throw new ApiClientError("Purchase bill not found or outside your authorized scope.", { status: 404, code: "NOT_FOUND" });

    const wb = new ExcelJS.Workbook();
    wb.creator = session.fullName || "DGT ERP";
    wb.created = new Date();
    const rtl = ["ur", "ar", "fa", "ps"].includes(lang);
    const sheet = (name: string, cols: Array<{ header: string; key: string; width?: number; numeric?: boolean }>, rows: Record<string, unknown>[]) => {
      const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ rightToLeft: rtl, state: "frozen", ySplit: 1 }] });
      ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B4A8F" } };
      ws.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      rows.forEach((r) => ws.addRow(r));
      cols.forEach((c, i) => { if (c.numeric) ws.getColumn(i + 1).numFmt = "#,##0.00"; });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
      return ws;
    };
    const money = perms.money;
    const typeText = (v: string) => (v === "booking" ? L("type_booking", "Booking") : L("type_local", "Local"));
    const NL = L("not_loaded_lot", "Not loaded");
    const lotText = (lot: string) => (lot === "—" ? NL : lot);

    const addBills = () => sheet(L("tab_bills", "Purchase Bill Journal"), [
      { header: L("col_purchase_bill", "Purchase Bill"), key: "bill", width: 20 }, { header: L("col_date", "Date"), key: "date" }, { header: L("col_type", "Type"), key: "type" }, { header: L("col_account", "Purchase Account"), key: "acct", width: 28 },
      { header: L("company", "Company"), key: "company", width: 22 }, { header: L("col_country", "Country"), key: "country" }, { header: L("col_branch", "Branch"), key: "branch" }, { header: L("col_origin", "Origin Country"), key: "origin" },
      { header: L("col_lots", "Lots"), key: "lots", numeric: true }, { header: L("col_entries", "Entries"), key: "entries", numeric: true },
      { header: `${L("grp_purchased", "Purchased")} ${L("col_qty_short", "Qty")}`, key: "pq", numeric: true }, { header: `${L("grp_purchased", "Purchased")} ${L("col_gross_short", "Gross")} KG`, key: "pg", numeric: true }, { header: `${L("grp_purchased", "Purchased")} ${L("col_net_short", "Net")} KG`, key: "pn", numeric: true },
      { header: `${L("grp_sold", "Sold")} ${L("col_qty_short", "Qty")}`, key: "sq", numeric: true }, { header: `${L("grp_remaining", "Remaining")} ${L("col_qty_short", "Qty")}`, key: "rq", numeric: true }, { header: `${L("grp_remaining", "Remaining")} ${L("col_net_short", "Net")} KG`, key: "rn", numeric: true },
      ...(money ? [{ header: L("col_purchase_amount", "Purchase Amount"), key: "amount", numeric: true }, { header: L("col_currency", "Currency"), key: "cur" }, { header: L("col_paid", "Paid Amount"), key: "paid", numeric: true }, { header: L("col_remaining_payable", "Remaining Payable"), key: "pending", numeric: true }] : []),
    ], billSummaries(bills).map((b) => ({ bill: b.billNo, date: b.date, type: typeText(b.type), acct: b.purchaseAccountName, company: b.companyName, country: b.countryName, branch: b.branchName, origin: b.originCountry, lots: b.totals.lots, entries: b.totals.entries, pq: b.totals.purchased.qty, pg: b.totals.purchased.gross, pn: b.totals.purchased.net, sq: b.totals.sold.qty, rq: b.totals.remaining.qty, rn: b.totals.remaining.net, amount: b.amount, cur: b.currency, paid: b.paid, pending: b.pending })));
    const addStock = (rows = stockRows(bills)) => sheet(L("tab_stock", "Stock Summary"), [
      { header: L("col_purchase_bill", "Purchase Bill"), key: "bill", width: 20 }, { header: L("col_lot_entry", "Lot & Entry No"), key: "lot", width: 24 }, { header: L("col_goods", "Goods Name"), key: "goods", width: 24 }, { header: L("col_brand", "Brand"), key: "brand" }, { header: L("col_size", "Size"), key: "size" }, { header: L("col_origin", "Origin Country"), key: "origin" }, { header: L("col_unit", "Unit"), key: "unit" },
      { header: `${L("grp_purchased", "Purchased")} ${L("col_qty_short", "Qty")}`, key: "pq", numeric: true }, { header: `${L("grp_purchased", "Purchased")} ${L("col_gross_short", "Gross")} KG`, key: "pg", numeric: true }, { header: `${L("grp_purchased", "Purchased")} ${L("col_net_short", "Net")} KG`, key: "pn", numeric: true },
      { header: `${L("grp_sold", "Sold")} ${L("col_qty_short", "Qty")}`, key: "sq", numeric: true }, { header: `${L("grp_sold", "Sold")} ${L("col_gross_short", "Gross")} KG`, key: "sg", numeric: true }, { header: `${L("grp_sold", "Sold")} ${L("col_net_short", "Net")} KG`, key: "sn", numeric: true },
      { header: L("col_adjusted", "Adjusted / Transferred"), key: "adj", numeric: true }, { header: L("reserved", "Reserved"), key: "res", numeric: true }, { header: L("st_in_transit", "In transit"), key: "tr", numeric: true },
      { header: `${L("grp_remaining", "Remaining")} ${L("col_qty_short", "Qty")}`, key: "rq", numeric: true }, { header: `${L("grp_remaining", "Remaining")} ${L("col_gross_short", "Gross")} KG`, key: "rg", numeric: true }, { header: `${L("grp_remaining", "Remaining")} ${L("col_net_short", "Net")} KG`, key: "rn", numeric: true },
      { header: L("col_warehouse", "Warehouse"), key: "wh", width: 22 }, { header: L("col_country", "Country"), key: "country" }, { header: L("col_branch", "Branch"), key: "branch" }, { header: L("col_status", "Status"), key: "status" },
    ], rows.map((e) => ({ bill: e.billNo, lot: `${lotText(e.lotNo)} / ${L("entry", "Entry")} ${e.entryNo}`, goods: e.goodsName, brand: e.brand, size: e.size, origin: e.origin, unit: e.unit, pq: e.purchased.qty, pg: e.purchased.gross, pn: e.purchased.net, sq: e.sold.qty, sg: e.sold.gross, sn: e.sold.net, adj: e.adjusted.qty + e.transferred.qty, res: e.reservedQty, tr: e.inTransitQty, rq: e.remaining.qty, rg: e.remaining.gross, rn: e.remaining.net, wh: e.warehouseName, country: e.countryName, branch: e.branchName, status: e.status })));
    const addSales = (rows = saleRows(bills, unlinkedSales, filters)) => sheet(L("tab_sales", "Sales Details"), [
      { header: L("col_sales_bill", "Sales Bill No"), key: "no", width: 20 }, { header: L("col_sales_date", "Sales Date"), key: "date" }, { header: L("col_sales_type", "Sales Type"), key: "type" }, { header: L("col_seller", "Seller Sales Account"), key: "seller", width: 24 }, { header: L("col_buyer", "Buyer / Customer Account"), key: "buyer", width: 26 }, { header: L("col_truck", "Truck Bill No"), key: "truck" },
      { header: L("col_purchase_bill", "Purchase Bill"), key: "bill", width: 20 }, { header: L("col_lot_entry", "Lot & Entry No"), key: "lot", width: 24 }, { header: L("col_sold_qty", "Sold Quantity"), key: "q", numeric: true }, { header: L("col_gross", "Gross Weight (KG)"), key: "g", numeric: true }, { header: L("col_net", "Net Weight (KG)"), key: "n", numeric: true },
      ...(money ? [{ header: L("col_amount", "Amount"), key: "amt", numeric: true }, { header: L("col_currency", "Currency"), key: "cur" }] : []), { header: L("col_status", "Status"), key: "status" },
    ], rows.map((r) => ({ no: r.salesBillNo, date: r.date, type: r.saleType, seller: r.sellerAccount, buyer: r.buyerAccount, truck: r.truckBillNo, bill: r.billNo ?? L("not_linked", "Not linked to a lot"), lot: r.linked ? r.lotEntryLabel : L("not_linked", "Not linked to a lot"), q: r.qty, g: r.gross, n: r.net, amt: r.amount, cur: r.currency, status: r.status })));
    const addPayments = () => sheet(L("tab_payments", "Payment Report"), [
      { header: L("col_purchase_bill_no", "Purchase Bill Number"), key: "bill", width: 20 }, { header: L("col_supplier", "Supplier Account"), key: "sup", width: 26 }, { header: L("col_purchase_amount", "Purchase Amount"), key: "amt", numeric: true }, { header: L("col_currency", "Currency"), key: "cur" }, { header: L("col_exchange", "Exchange Rate"), key: "fx", numeric: true },
      { header: L("col_paid", "Paid Amount"), key: "paid", numeric: true }, { header: L("col_remaining_payable", "Remaining Payable"), key: "rem", numeric: true }, { header: L("col_pay_date", "Payment Date"), key: "date" }, { header: L("col_pay_method", "Payment Method"), key: "method", width: 24 }, { header: L("col_pay_amount", "Payment"), key: "pay", numeric: true }, { header: L("col_pay_status", "Payment Status"), key: "status" },
    ], paymentRows(bills).map((r) => ({ bill: r.billNo, sup: r.supplierAccount, amt: money ? r.purchaseAmount : null, cur: r.billCurrency, fx: r.billExchangeRate, paid: money ? r.paidTotal : null, rem: money ? r.remainingPayable : null, date: r.date, method: [r.kind, r.method].filter(Boolean).join(" · "), pay: money && r.status !== "none" ? r.amount : null, status: r.status === "none" ? r.billPaymentStatus : r.status })));
    const addTreatments = () => sheet(L("tab_treatments", "Treatment Report"), [
      { header: L("col_goods", "Goods Name"), key: "goods", width: 24 }, { header: L("col_lot", "Lot Number"), key: "lot", width: 20 }, { header: L("col_purchase_bill", "Purchase Bill"), key: "bill", width: 20 }, { header: L("col_treatment_type", "Treatment Type"), key: "type" }, { header: L("col_treatment_date", "Treatment Date"), key: "date" },
      { header: L("col_tr_received", "Qty Received for Treatment"), key: "rec", numeric: true }, { header: L("col_tr_treated", "Qty Treated"), key: "tre", numeric: true }, { header: L("col_tr_pending", "Qty Pending"), key: "pen", numeric: true }, { header: L("col_tr_loss", "Treatment Loss / Adjustment"), key: "loss", numeric: true }, { header: L("col_tr_final", "Final Quantity"), key: "fin", numeric: true },
      { header: L("col_wh_branch", "Warehouse / Branch"), key: "wh", width: 26 }, { header: L("col_tr_status", "Treatment Status"), key: "status" },
    ], treatmentRows(bills).map((r) => ({ goods: r.goodsName, lot: lotText(r.lotNo), bill: r.billNo, type: r.treatmentType, date: r.treatmentDate, rec: r.received, tre: r.treated, pen: r.pending, loss: r.loss, fin: r.finalQty, wh: [r.warehouseName, r.branchName].filter(Boolean).join(" · "), status: r.status })));

    let name = "stock-journal";
    if (kind === "journal" || kind === "bills") { addBills(); addStock(); addSales(); if (money) addPayments(); addTreatments(); }
    else if (kind === "stock") { addStock(); name = "stock-balance"; }
    else if (kind === "sales") { addSales(); name = "sales-details"; }
    else if (kind === "payments") { if (!money) throw new ErpPermissionError("The payment report needs permission to view financial amounts."); addPayments(); name = "payment-report"; }
    else if (kind === "treatments") { addTreatments(); name = "treatment-report"; }
    else { addStock(); addSales(saleRows(bills)); if (money) addPayments(); addTreatments(); name = `purchase-bill-${bills[0].billNo.replace(/[^a-z0-9]+/gi, "-")}`; }

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
