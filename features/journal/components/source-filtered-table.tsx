"use client";

import React, { useMemo } from "react";
import { RemainingBookingTable } from "./remaining-booking-table";
import { remainingBookingRow } from "@/lib/journal/remaining-booking-table";
import { resolveAgreedDueDate } from "@/lib/services/payment-due-tracking";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";
import { LoadingReceivingCell } from "./loading-receiving-cell";
type LanguageCode = string;
import { FileSpreadsheet } from "lucide-react";

export interface SourceFilteredTableProps {
  sourceFilter: "all" | "purchase_booking" | "local_purchase";
  onSourceChange: (source: "all" | "purchase_booking" | "local_purchase") => void;
  rows: any[];
  counts: { all: number; booking: number; local: number };
  lang: LanguageCode;
  onSelectOrder: (orderId: string) => void;
  onOpenFullBill: (row: any) => void;
  onPrintStatement: (row: any) => void;
  tGlobal: (lang: LanguageCode, key: string, fallback: string) => string;
  activeMode: string;
  loadingRecords?: any[];
  dueBills?: any[];
  onSelectLoading?: (orderId: string, loadingId: string) => void;
  session?: any;
}

export function SourceFilteredTable({
  sourceFilter,
  onSourceChange,
  rows,
  counts,
  lang,
  onSelectOrder,
  onOpenFullBill,
  onPrintStatement,
  tGlobal,
  activeMode,
  loadingRecords = [],
  dueBills = [],
  onSelectLoading,
  session,
}: SourceFilteredTableProps) {
  // Format numbers helper
  const fmt = (n: any, decimals = 2) => {
    const val = Number(n || 0);
    return isNaN(val) ? "0.00" : val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fmtQty = (n: any) => {
    const val = Number(n || 0);
    return isNaN(val) ? "0" : val.toLocaleString();
  };

  const isLocalPurchase = (row: any) => row.is_local_purchase || row.order_type === "local_purchase" || row.source_type === "local_purchase" || Boolean(row.local_purchase_id);
  // A loading can appear more than once in the incoming list. General shows one financial
  // summary per saved bill; the Booking tab remains the per-loading movement register.
  const uniqueRows = useMemo(() => {
    return [...new Map(rows.map(row => [`${isLocalPurchase(row) ? "local" : "booking"}:${String(row.id)}`, row])).values()];
  }, [rows]);

  const dueByOrderId = useMemo(() => new Map(dueBills.map(bill => [String(bill.id), bill])), [dueBills]);
  const generalRows = useMemo(() => {
    return uniqueRows.filter(row => {
      if (activeMode !== "remaining" || isLocalPurchase(row)) return true;
      const due = dueByOrderId.get(String(row.id));
      return Boolean(due?.loadings?.some((entry: any) => Number(entry.outstanding || 0) > 0.05));
    });
  }, [uniqueRows, activeMode, dueByOrderId]);

  const label = (value: string) => translateHeader(lang, value);
  const displayDate = (value: string | null | undefined) => value ? String(value).slice(0, 10) : "—";

  // Role-based visibility
  const isSuperAdmin = Boolean(session?.isSuperAdmin || session?.roles?.includes("super_admin"));
  const isCountryAdmin = !isSuperAdmin && Boolean(session?.roles?.some((role: string) => role === "country_admin" || role === "country_user") || session?.countryId || (session?.countryIds && session.countryIds.length > 0));
  const isBranchUser = !isSuperAdmin && !isCountryAdmin;

  // Filter rows for Advance mode based on active source tab
  const advanceRowsToRender = useMemo(() => {
    if (sourceFilter === "purchase_booking") {
      return uniqueRows.filter((r) => !isLocalPurchase(r));
    }
    if (sourceFilter === "local_purchase") {
      return uniqueRows.filter((r) => isLocalPurchase(r));
    }
    return uniqueRows;
  }, [sourceFilter, uniqueRows]);

  // Invoice-based calculation logic for Advance Payment Journal
  const getAdvanceInvoiceFinancials = (r: any) => {
    const form = r.form_data?.form || {};
    const isLocal = isLocalPurchase(r);

    // Exchange rate
    const exRate = Number(r.exchange_rate || form.exchangeRate || 1) || 1;

    // Currencies
    const purchCurr = String(r.currency_code || form.currency || form.purchaseCurrency || (isLocal ? "AED" : "USD")).toUpperCase().trim();
    const finalCurr = String(form.branchCurrency || form.finalCurrency || r.dest_countries?.currency_code || r.countries?.currency_code || (isLocal ? "AED" : "AED")).toUpperCase().trim();

    // Full Purchase Bill in Purchase Currency
    let fullBillFC = 0;
    if (isLocal) {
      fullBillFC = Number(r.final_cost || r.order_total || r.purchase_cost || form.totalAmount || 0);
    } else {
      const goods = r.form_data?.goodsEntries || [];
      if (Array.isArray(goods) && goods.length > 0) {
        fullBillFC = goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || g.amount || 0), 0);
      } else {
        fullBillFC = Number(r.form_data?.totals?.grandPrimaryFinal || form.subTotal || form.totalAmount || r.order_total || 0);
      }
    }

    // Invoice Percentage (%)
    let invoicePercent = 0;
    if (isLocal) {
      invoicePercent = Number(r.advance_percentage || form.advancePercent || 0);
    } else {
      invoicePercent = Number(form.advancePercent || 0);
    }

    // Invoice Amount in Purchase Currency (actual invoice amount applicable to the selected payment percentage)
    let invoiceAmountFC = 0;
    if (invoicePercent > 0) {
      invoiceAmountFC = (fullBillFC * invoicePercent) / 100;
    } else if (Number(r.advance_paid || form.advanceAmount || 0) > 0) {
      const rawAdv = Number(r.advance_paid || form.advanceAmount || 0);
      invoiceAmountFC = (exRate > 1 && rawAdv > fullBillFC * 1.05) ? rawAdv / exRate : rawAdv;
      if (fullBillFC > 0) {
        invoicePercent = Math.min(100, Math.round((invoiceAmountFC / fullBillFC) * 100));
      }
    } else {
      const pType = String(form.paymentType || form.paymentCondition || r.payment_mode || "").toLowerCase();
      if (pType.includes("advance") || pType.includes("endorsement")) {
        invoiceAmountFC = fullBillFC;
        invoicePercent = 100;
      } else {
        invoiceAmountFC = 0;
        invoicePercent = 0;
      }
    }

    // Invoice Amount in Final Currency
    const invoiceAmountLC = invoiceAmountFC * exRate;

    // Paid Amount in Purchase Currency
    let paidAmountFC = 0;
    const rawPaid = Number(r.advance_paid || form.advancePaidAmount || 0);
    if (rawPaid > 0) {
      paidAmountFC = (exRate > 1 && rawPaid > invoiceAmountFC * 1.05 && fullBillFC > 0 && rawPaid > fullBillFC * 1.05)
        ? rawPaid / exRate
        : rawPaid;
    }
    paidAmountFC = Math.min(invoiceAmountFC, paidAmountFC);
    const paidAmountLC = paidAmountFC * exRate;

    // Remaining Balance
    const remainingFC = Math.max(0, invoiceAmountFC - paidAmountFC);
    const remainingLC = Math.max(0, invoiceAmountLC - paidAmountLC);

    // Payment Status
    let status = "Open";
    if (invoiceAmountFC > 0 && remainingFC <= 0.05) {
      status = "Fully Paid";
    } else if (paidAmountFC > 0) {
      status = "Partially Paid";
    } else {
      status = "Pending";
    }

    return {
      exRate,
      purchCurr,
      finalCurr,
      fullBillFC,
      invoicePercent,
      invoiceAmountFC,
      invoiceAmountLC,
      paidAmountFC,
      paidAmountLC,
      remainingFC,
      remainingLC,
      status
    };
  };

  const isEmpty = activeMode === "advance"
    ? advanceRowsToRender.length === 0
    : (sourceFilter === "all" ? generalRows.length === 0 : rows.length === 0);

  return (
    <div className="mx-6 mb-6 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      {/* ── Blue Selector Bar Matching Design (❶ All Sources, ❷ Purchase Booking, ❸ Local Purchase) ── */}
      <div className="bg-[#1e40af] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#1e40af] font-black text-sm shadow-xs">
            {sourceFilter === "all" ? "1" : sourceFilter === "purchase_booking" ? "2" : "3"}
          </span>
          <span className="text-sm font-black tracking-wide">
            {sourceFilter === "all" && "Journal / All Sources selected"}
            {sourceFilter === "purchase_booking" && "Purchase Booking selected"}
            {sourceFilter === "local_purchase" && "Local Purchase selected"}
          </span>
        </div>

        {/* Source Segmented Pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-100">Source:</span>
          <div className="inline-flex rounded-lg bg-blue-900/60 p-1 border border-blue-400/30">
            <button
              type="button"
              onClick={() => onSourceChange("all")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer",
                sourceFilter === "all"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-blue-100 hover:text-white hover:bg-blue-800/50"
              )}
            >
              All Sources ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => onSourceChange("purchase_booking")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer",
                sourceFilter === "purchase_booking"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-blue-100 hover:text-white hover:bg-blue-800/50"
              )}
            >
              Purchase Booking ({counts.booking})
            </button>
            <button
              type="button"
              onClick={() => onSourceChange("local_purchase")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer",
                sourceFilter === "local_purchase"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-blue-100 hover:text-white hover:bg-blue-800/50"
              )}
            >
              Local Purchase ({counts.local})
            </button>
          </div>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="overflow-x-auto">
        {/* ========================================================================= */}
        {/* ADVANCE PAYMENT JOURNAL — EXACT 23-COLUMN INVOICE-BASED FINANCIAL REPORT  */}
        {/* ========================================================================= */}
        {activeMode === "advance" ? (
          <table className="w-full min-w-[2100px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300">
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">{label("BILL / INVOICE NO")}</th>
                <th className="py-3 px-2 border-r border-amber-300 text-center whitespace-nowrap">{label("SOURCE")}</th>
                <th className="py-3 px-2.5 border-r border-amber-300 whitespace-nowrap">{label("DATE")}</th>
                <th className="py-3 px-2.5 border-r border-amber-300 whitespace-nowrap">
                  {isSuperAdmin ? label("COUNTRY / BRANCH") : label("BRANCH")}
                </th>
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">{label("SUPPLIER / PURCHASE ACCOUNT")}</th>
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">{label("GOODS NAME")}</th>
                <th className="py-3 px-2 text-right border-r border-amber-300 whitespace-nowrap">{label("QUANTITY")}</th>
                <th className="py-3 px-2 text-center border-r border-amber-300 whitespace-nowrap">{label("UNIT")}</th>
                <th className="py-3 px-2 text-right border-r border-amber-300 whitespace-nowrap">{label("GROSS WT (KG)")}</th>
                <th className="py-3 px-2 text-right border-r border-amber-300 whitespace-nowrap">{label("NET WT (KG)")}</th>
                <th className="py-3 px-2.5 border-r border-amber-300 whitespace-nowrap">{label("ORIGIN COUNTRY")}</th>
                <th className="py-3 px-2 text-center border-r border-amber-300 whitespace-nowrap">{label("PURCHASE CURRENCY")}</th>
                <th className="py-3 px-2 text-center border-r border-amber-300 whitespace-nowrap">{label("FINAL CURRENCY")}</th>
                <th className="py-3 px-2 text-center border-r border-amber-300 whitespace-nowrap">{label("INVOICE %")}</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">{label("INVOICE AMOUNT (PC)")}</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">{label("INVOICE AMOUNT (FC)")}</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">{label("PAID AMOUNT (PC)")}</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">{label("PAID AMOUNT (FC)")}</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">{label("REMAINING BALANCE (PC)")}</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">{label("REMAINING BALANCE (FC)")}</th>
                <th className="py-3 px-2.5 text-center border-r border-amber-300 whitespace-nowrap">{label("DUE DATE")}</th>
                <th className="py-3 px-2.5 text-center border-r border-amber-300 whitespace-nowrap">{label("PAYMENT STATUS")}</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">{label("JOURNAL")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {advanceRowsToRender.map((r, i) => {
                const form = r.form_data?.form || {};
                const billNo = r.purchase_order_no || r.bill_no || r.order_no || form.billNo || form.invoiceNo || "—";
                const isLocal = isLocalPurchase(r);
                const date = r.order_date || form.orderDate || form.billDate || r.created_at?.slice(0, 10) || "—";
                const countryName = form.countryName || r.country_name || form.countryCode || r.country_code || "—";
                const branchName = form.branchName || r.branch_name || form.branchCode || r.branch_code || "—";
                const supplier = r.supplier_name || form.supplierName || r.party_name || "—";
                const purchaseAccount = form.purchaseAccountNo || form.purchaseAccountName || r.purchase_account_no || r.purchase_account_name || "—";
                const goods = r.goods_name || form.goodsName || r.product_name || (Array.isArray(form.goodsEntries) && form.goodsEntries.map((g: any) => g.itemName || g.goodsName).filter(Boolean).join(", ")) || "—";
                const qty = Number(r.total_quantity ?? form.totalQuantity ?? form.quantity ?? r.pkg_count ?? 0);
                const unit = form.quantityUnit || form.unit || r.quantity_name || "Cartons";
                const grossKg = Number(r.gross_weight ?? form.grossWeight ?? r.gross_weight_kg ?? 0);
                const netKg = Number(r.net_weight ?? form.netWeight ?? r.net_weight_kg ?? 0);
                const originCountry = form.originCountry || form.originCountryName || form.countryOfOrigin || r.origin_country_name || form.loadingCountry || (r.countries?.name) || (isLocal ? "Local" : "—");
                const dueDate = form.advancePaymentDate || form.advanceDueDate || form.dueDate || resolveAgreedDueDate(r, "advance");
                const fin = getAdvanceInvoiceFinancials(r);

                return (
                  <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {/* 1. Bill / Invoice Number */}
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{billNo}</td>

                    {/* 2. Source */}
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        isLocal ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                      )}>
                        {isLocal ? "Local Purchase" : "Purchase Booking"}
                      </span>
                    </td>

                    {/* 3. Bill / Invoice Date */}
                    <td className="py-3 px-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{displayDate(date)}</td>

                    {/* 4. Country / Branch */}
                    <td className="py-3 px-2.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {isSuperAdmin ? (
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{countryName}</span>
                          <span className="text-slate-300 dark:text-slate-600">/</span>
                          <span className="truncate max-w-[120px]" title={branchName}>{branchName}</span>
                        </div>
                      ) : isCountryAdmin ? (
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{branchName}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* 5. Supplier / Purchase Account */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={supplier}>{supplier}</div>
                      <div className="font-mono text-[10px] text-blue-600 dark:text-blue-400 truncate max-w-[150px]" title={purchaseAccount}>{purchaseAccount}</div>
                    </td>

                    {/* 6. Goods Name */}
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[140px] truncate" title={goods}>{goods}</td>

                    {/* 7. Quantity */}
                    <td className="py-3 px-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{fmtQty(qty)}</td>

                    {/* 8. Unit */}
                    <td className="py-3 px-2 text-center text-slate-500 whitespace-nowrap">{unit}</td>

                    {/* 9. Gross Weight (KG) */}
                    <td className="py-3 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtQty(grossKg)}</td>

                    {/* 10. Net Weight (KG) */}
                    <td className="py-3 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtQty(netKg)}</td>

                    {/* 11. Origin Country */}
                    <td className="py-3 px-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{originCountry}</td>

                    {/* 12. Purchase Currency */}
                    <td className="py-3 px-2 text-center font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{fin.purchCurr}</td>

                    {/* 13. Final Currency */}
                    <td className="py-3 px-2 text-center font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{fin.finalCurr}</td>

                    {/* 14. Invoice Percentage (%) */}
                    <td className="py-3 px-2 text-center font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">{fin.invoicePercent}%</td>

                    {/* 15. Invoice Amount – Purchase Currency */}
                    <td className="py-3 px-2.5 text-right font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">{fmt(fin.invoiceAmountFC)}</td>

                    {/* 16. Invoice Amount – Final Currency */}
                    <td className="py-3 px-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmt(fin.invoiceAmountLC)}</td>

                    {/* 17. Paid Amount – Purchase Currency */}
                    <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{fmt(fin.paidAmountFC)}</td>

                    {/* 18. Paid Amount – Final Currency */}
                    <td className="py-3 px-2.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{fmt(fin.paidAmountLC)}</td>

                    {/* 19. Remaining Balance – Purchase Currency */}
                    <td className="py-3 px-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">{fmt(fin.remainingFC)}</td>

                    {/* 20. Remaining Balance – Final Currency */}
                    <td className="py-3 px-2.5 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">{fmt(fin.remainingLC)}</td>

                    {/* 21. Due Date */}
                    <td className="py-3 px-2.5 text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{displayDate(dueDate)}</td>

                    {/* 22. Payment Status */}
                    <td className="py-3 px-2.5 text-center whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        fin.status === "Fully Paid"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : fin.status === "Partially Paid"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      )}>
                        {label(fin.status.toUpperCase())}
                      </span>
                    </td>

                    {/* 23. Journal Action */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectOrder(r.id)}
                        className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                      >
                        {label("JOURNAL")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* ========================================================================= */
          /* OTHER PAYMENT MODES (REMAINING, CREDIT, ETC.)                              */
          /* ========================================================================= */
          <>
            {/* VIEW 1: ALL SOURCES (JOURNAL) */}
            {sourceFilter === "all" && (
              <table className="w-full min-w-[1350px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300">
                    <th className="py-3 px-3 border-r border-amber-300">Bill No</th>
                    <th className="py-3 px-2 border-r border-amber-300 text-center">Source</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">{label("Date")}</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">Country / Branch</th>
                    <th className="py-3 px-3 border-r border-amber-300">Supplier</th>
                    <th className="py-3 px-3 border-r border-amber-300">Goods Name</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Qty</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Unit</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Gross kg</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Net kg</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Currency</th>
                    <th className="py-3 px-2.5 text-right border-r border-amber-300">Bill Total</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Paid</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Balance</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300 font-mono">DR Account</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300 font-mono">CR Account</th>
                    <th className="py-3 px-2.5 text-center border-r border-amber-300">{activeMode === "remaining" ? label("REMAINING DUE DATE") : label("DUE DATE")} / {label("Status")}</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Exchange Rate</th>
                    <th className="py-3 px-3 text-center">Journal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {generalRows.map((r, i) => {
                    const form = r.form_data?.form || {};
                    const billNo = r.purchase_order_no || r.bill_no || r.order_no || "—";
                    const isLocal = isLocalPurchase(r);
                    const booking = !isLocal && activeMode === "remaining" ? remainingBookingRow(r, loadingRecords, dueByOrderId.get(String(r.id))) : null;
                    const sourceLabel = isLocal ? "Local" : "Booking";
                    const date = booking?.date || r.order_date || form.orderDate || r.created_at?.slice(0, 10) || "—";
                    const countryBranch = [form.countryCode || r.country_code || r.country_name, form.branchCode || r.branch_code || r.branch_name].filter(Boolean).join(" / ") || "—";
                    const supplier = booking?.supplier || r.supplier_name || form.supplierName || "—";
                    const goods = booking?.goods || r.goods_name || form.goodsName || "—";
                    const qty = booking ? booking.quantity : (r.total_quantity ?? form.totalQuantity ?? 0);
                    const unit = booking?.unit || form.quantityUnit || "—";
                    const grossKg = booking ? booking.grossKg : (r.gross_weight ?? form.grossWeight ?? 0);
                    const netKg = booking ? booking.netKg : (r.net_weight ?? form.netWeight ?? 0);
                    const ccy = booking?.currency || r.currency_code || form.currency || "—";
                    const total = booking ? booking.total : Number(r.order_total ?? form.totalAmount ?? 0);
                    const paid = booking ? booking.paid : Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);
                    const bal = booking ? booking.balance : Math.max(0, Number(r.remaining_due ?? (total - paid)));
                    const dr = form.purchaseAccountNo || r.purchase_account_no || "—";
                    const cr = form.salesAccountNo || form.supplierAccountNo || r.sales_account_no || "—";
                    const dueDate = resolveAgreedDueDate(r, activeMode === "remaining" ? "remaining" : undefined);
                    const status = bal <= 0.05 ? "Fully Paid" : paid > 0 ? "Partially Paid" : "Open";
                    const exRate = Number(booking?.exchangeRate ?? r.exchange_rate ?? form.exchangeRate ?? 1).toFixed(4);

                    return (
                      <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{billNo}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", isLocal ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800")}>
                            {sourceLabel}
                          </span>
                        </td>
                        <td className="py-3 px-2.5 font-mono">{date}</td>
                        <td className="py-3 px-2.5 font-mono text-slate-600 dark:text-slate-400">{countryBranch}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{supplier}</td>
                        <td className="py-3 px-3 font-semibold">{goods}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold">{fmtQty(qty)}</td>
                        <td className="py-3 px-2 text-center text-slate-500">{unit}</td>
                        <td className="py-3 px-2 text-right font-mono">{grossKg == null ? "—" : fmtQty(grossKg)}</td>
                        <td className="py-3 px-2 text-right font-mono">{netKg == null ? "—" : fmtQty(netKg)}</td>
                        <td className="py-3 px-2 text-center font-bold text-indigo-600">{ccy}</td>
                        <td className="py-3 px-2.5 text-right font-mono font-black">{fmt(total)}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-emerald-600">{fmt(paid)}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-rose-600">{fmt(bal)}</td>
                        <td className="py-3 px-2 text-center font-mono text-slate-500">{dr}</td>
                        <td className="py-3 px-2 text-center font-mono text-slate-500">{cr}</td>
                        <td className="py-3 px-2.5 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-[11px] text-slate-600">{displayDate(dueDate)}</span>
                            <span className={cn("px-1.5 py-0.2 rounded text-[10px] font-bold", bal <= 0 ? "bg-emerald-100 text-emerald-700" : paid > 0 ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700")}>
                              {status}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center font-mono">{exRate}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectOrder(r.id)}
                            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                          >
                            Journal
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* VIEW 2: PURCHASE BOOKING */}
            {sourceFilter === "purchase_booking" && activeMode === "remaining" && (
              <RemainingBookingTable rows={rows} loadingRecords={loadingRecords} dueBills={dueBills} lang={lang} onSelectOrder={onSelectOrder} onSelectLoading={onSelectLoading} />
            )}
            {sourceFilter === "purchase_booking" && activeMode !== "remaining" && (
              <table className="w-full min-w-[1700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300">
                    <th className="py-3 px-3 border-r border-amber-300">Bill No</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">Date</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">Country / Branch</th>
                    <th className="py-3 px-3 border-r border-amber-300">Supplier</th>
                    <th className="py-3 px-3 border-r border-amber-300">Goods Name</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Qty</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Unit</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Gross kg</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Net kg</th>
                    <th className="py-3 px-4 border-r border-amber-300 bg-amber-200/90 text-center min-w-[340px]">
                      {label("Loading & Receiving")}
                    </th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Currency</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Exchange Rate</th>
                    <th className="py-3 px-2.5 text-right border-r border-amber-300">Bill Total</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Paid</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Balance</th>
                    <th className="py-3 px-3 text-center">Journal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {rows.map((r, i) => {
                    const form = r.form_data?.form || {};
                    const billNo = r.purchase_order_no || r.bill_no || r.order_no || "—";
                    const date = r.order_date || form.orderDate || r.created_at?.slice(0, 10) || "—";
                    const countryBranch = [form.countryCode || r.country_code || r.country_name, form.branchCode || r.branch_code || r.branch_name].filter(Boolean).join(" / ") || "—";
                    const supplier = r.supplier_name || form.supplierName || "—";
                    const goods = r.goods_name || form.goodsName || "—";
                    const qty = r.total_quantity || form.totalQuantity || 0;
                    const unit = form.quantityUnit || "Cartons";
                    const grossKg = r.gross_weight || form.grossWeight || 0;
                    const netKg = r.net_weight || form.netWeight || 0;
                    const ccy = r.currency_code || form.currency || "USD";
                    const total = Number(r.order_total || form.totalAmount || 0);
                    const paid = Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);
                    const bal = Math.max(0, total - paid);
                    const exRate = Number(form.exchangeRate || 1).toFixed(4);

                    return (
                      <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{billNo}</td>
                        <td className="py-3 px-2.5 font-mono">{date}</td>
                        <td className="py-3 px-2.5 font-mono text-slate-600 dark:text-slate-400">{countryBranch}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{supplier}</td>
                        <td className="py-3 px-3 font-semibold">{goods}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold">{fmtQty(qty)}</td>
                        <td className="py-3 px-2 text-center text-slate-500">{unit}</td>
                        <td className="py-3 px-2 text-right font-mono">{fmtQty(grossKg)}</td>
                        <td className="py-3 px-2 text-right font-mono">{fmtQty(netKg)}</td>
                        <td className="py-2.5 px-3 bg-slate-50/70 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800 align-top">
                          <LoadingReceivingCell row={r} loadingRecords={loadingRecords} lang={lang} />
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-indigo-600">{ccy}</td>
                        <td className="py-3 px-2 text-center font-mono">{exRate}</td>
                        <td className="py-3 px-2.5 text-right font-mono font-black">{fmt(total)}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-emerald-600">{fmt(paid)}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-rose-600">{fmt(bal)}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectOrder(r.id)}
                            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                          >
                            Journal
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* VIEW 3: LOCAL PURCHASE */}
            {sourceFilter === "local_purchase" && (
              <table className="w-full min-w-[1300px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300">
                    <th className="py-3 px-3 border-r border-amber-300">Bill No</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">Date</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">Country / Branch</th>
                    <th className="py-3 px-3 border-r border-amber-300">Supplier</th>
                    <th className="py-3 px-3 border-r border-amber-300">Goods Name</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Qty</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Unit</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Gross kg</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Net kg</th>
                    <th className="py-3 px-4 border-r border-amber-300 bg-amber-200/90 text-center min-w-[340px]">{label("Loading & Receiving")}</th>
                    <th className="py-3 px-3 text-right border-r border-amber-300">Bill Total</th>
                    <th className="py-3 px-2.5 text-right border-r border-amber-300">Paid</th>
                    <th className="py-3 px-2.5 text-right border-r border-amber-300">Balance</th>
                    <th className="py-3 px-3 text-center">Journal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {rows.map((r, i) => {
                    const form = r.form_data?.form || {};
                    const billNo = r.purchase_order_no || r.bill_no || r.order_no || "—";
                    const date = r.order_date || form.orderDate || r.created_at?.slice(0, 10) || "—";
                    const countryBranch = [form.countryCode || r.country_code || r.country_name, form.branchCode || r.branch_code || r.branch_name].filter(Boolean).join(" / ") || "—";
                    const supplier = r.supplier_name || form.supplierName || "—";
                    const goods = r.goods_name || form.goodsName || "—";
                    const qty = r.total_quantity || form.totalQuantity || 0;
                    const unit = form.quantityUnit || "Cartons";
                    const grossKg = r.gross_weight || form.grossWeight || 0;
                    const netKg = r.net_weight || form.netWeight || 0;
                    const total = Number(r.order_total || form.totalAmount || 0);
                    const paid = Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);
                    const bal = Math.max(0, Number(r.remaining_due ?? (total - paid)));
                    const ccy = r.currency_code || form.currency || "—";

                    return (
                      <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{billNo}</td>
                        <td className="py-3 px-2.5 font-mono">{date}</td>
                        <td className="py-3 px-2.5 font-mono text-slate-600 dark:text-slate-400">{countryBranch}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{supplier}</td>
                        <td className="py-3 px-3 font-semibold">{goods}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold">{fmtQty(qty)}</td>
                        <td className="py-3 px-2 text-center text-slate-500">{unit}</td>
                        <td className="py-3 px-2 text-right font-mono">{fmtQty(grossKg)}</td>
                        <td className="py-3 px-2 text-right font-mono">{fmtQty(netKg)}</td>
                        <td className="py-2.5 px-3 bg-slate-50/70 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800 align-top">
                          <LoadingReceivingCell row={r} loadingRecords={loadingRecords} lang={lang} />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black">{fmt(total)} {ccy}</td>
                        <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-600">{fmt(paid)} {ccy}</td>
                        <td className="py-3 px-2.5 text-right font-mono font-bold text-rose-600">{fmt(bal)} {ccy}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectOrder(r.id)}
                            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                          >
                            Journal
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Empty State */}
        {isEmpty && (
          <div className="py-16 text-center text-slate-400">
            <FileSpreadsheet className="h-10 w-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-semibold">No records found for this view.</p>
          </div>
        )}
      </div>

      {/* ── Footer Guidance Strip Matching Screenshot ── */}
      <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11.5px] font-medium text-slate-500 flex items-center justify-between">
        <div>
          <span className="font-bold text-blue-600">ⓘ Journal button</span> opens the selected bill details and Print on demand. | Alternative tab states — app shows one selected table at a time.
        </div>
      </div>
    </div>
  );
}
