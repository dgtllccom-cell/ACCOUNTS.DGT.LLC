"use client";

import React, { useMemo } from "react";
import { RemainingBookingTable } from "./remaining-booking-table";
import { remainingBookingRow } from "@/lib/journal/remaining-booking-table";
import { resolveAgreedDueDate } from "@/lib/services/payment-due-tracking";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";
type LanguageCode = string;
import { WalletCards, Eye, Printer, FileSpreadsheet, ChevronRight } from "lucide-react";

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
}: SourceFilteredTableProps) {
  // Format numbers helper
  const fmt = (n: any, decimals = 2) => {
    const val = Number(n || 0);
    return isNaN(val) ? "0" : val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fmtQty = (n: any) => {
    const val = Number(n || 0);
    return isNaN(val) ? "0" : val.toLocaleString();
  };

  const isLocalPurchase = (row: any) => row.is_local_purchase || row.order_type === "local_purchase" || row.source_type === "local_purchase" || Boolean(row.local_purchase_id);
  // A loading can appear more than once in the incoming list. General shows one financial
  // summary per saved bill; the Booking tab remains the per-loading movement register.
  const uniqueRows = [...new Map(rows.map(row => [`${isLocalPurchase(row) ? "local" : "booking"}:${String(row.id)}`, row])).values()];
  const dueByOrderId = new Map(dueBills.map(bill => [String(bill.id), bill]));
  const generalRows = uniqueRows.filter(row => {
    if (activeMode !== "remaining" || isLocalPurchase(row)) return true;
    const due = dueByOrderId.get(String(row.id));
    return Boolean(due?.loadings?.some((entry: any) => Number(entry.outstanding || 0) > 0.05));
  });
  const label = (value: string) => translateHeader(lang, value);
  const displayDate = (value: string | null) => value ? value.slice(0, 10) : "—";

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
        {/* VIEW 1: ALL SOURCES (JOURNAL)                                             */}
        {/* ========================================================================= */}
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
                const countryBranch = `${form.countryCode || "AE"} / ${form.branchCode || "AE-001"}`;
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

        {/* ========================================================================= */}
        {/* VIEW 2: PURCHASE BOOKING (SAME-ROW LOADING & RECEIVING)                  */}
        {/* ========================================================================= */}
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
                
                {/* ── Same-Row Grouped Loading & Receiving ── */}
                <th className="py-3 px-4 border-r border-amber-300 bg-amber-200/90 text-center min-w-[380px]">
                  Loading & Receiving
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
                const countryBranch = `${form.countryCode || "AE"} / ${form.branchCode || "AE-001"}`;
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

                // Quantities from real loading records or form data
                const loadedQty = Number(r.loaded_quantity || form.loadedQuantity || (r.loading_records?.[0]?.quantity ?? 100));
                const receivedQty = Number(r.received_quantity || form.receivedQuantity || 0);
                const damageQty = Number(r.damage_quantity || 0);
                const shortageQty = Number(r.shortage_quantity || 0);
                const outstandingQty = Math.max(0, qty - receivedQty);

                const loadCountry = form.loadingCountry || "CN";
                const loadPort = form.loadingPort || "Shanghai";
                const loadDate = form.loadingDate || "01 Nov 2026";
                const rcvCountry = form.destinationCountry || "AE";
                const rcvPort = form.destinationPort || "Jebel Ali";
                const rcvDate = form.arrivalDate || "Pending";

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

                    {/* ── Same-row Loading & Receiving Grouped Block ── */}
                    <td className="py-2.5 px-3 bg-slate-50/70 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800">
                      <div className="flex flex-col gap-1.5">
                        {/* 5 Quantities Strip */}
                        <div className="grid grid-cols-5 gap-1 text-center font-mono">
                          <div className="bg-blue-100 dark:bg-blue-950 p-1 rounded">
                            <span className="block text-[9px] uppercase font-bold text-slate-500">Loaded</span>
                            <span className="font-black text-blue-700 dark:text-blue-400 text-xs">{fmtQty(loadedQty)}</span>
                          </div>
                          <div className="bg-emerald-100 dark:bg-emerald-950 p-1 rounded">
                            <span className="block text-[9px] uppercase font-bold text-slate-500">Received</span>
                            <span className="font-black text-emerald-700 dark:text-emerald-400 text-xs">{fmtQty(receivedQty)}</span>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded">
                            <span className="block text-[9px] uppercase font-bold text-slate-500">Damage</span>
                            <span className="font-black text-slate-700 dark:text-slate-300 text-xs">{damageQty}</span>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded">
                            <span className="block text-[9px] uppercase font-bold text-slate-500">Shortage</span>
                            <span className="font-black text-slate-700 dark:text-slate-300 text-xs">{shortageQty}</span>
                          </div>
                          <div className="bg-rose-100 dark:bg-rose-950 p-1 rounded">
                            <span className="block text-[9px] uppercase font-bold text-slate-500">Outstanding</span>
                            <span className="font-black text-rose-700 dark:text-rose-400 text-xs">{fmtQty(outstandingQty)}</span>
                          </div>
                        </div>

                        {/* Ports & Dates Strip */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="font-bold text-slate-700 dark:text-slate-300">Loading: </span>
                            <span className="text-slate-600">{loadCountry} • {loadPort} ({loadDate})</span>
                          </div>
                          <div className="border-s border-slate-200 dark:border-slate-800 ps-2">
                            <span className="font-bold text-slate-700 dark:text-slate-300">Receiving: </span>
                            <span className="text-slate-600">{rcvCountry} • {rcvPort} ({rcvDate})</span>
                          </div>
                        </div>
                      </div>
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

        {/* ========================================================================= */}
        {/* VIEW 3: LOCAL PURCHASE                                                    */}
        {/* ========================================================================= */}
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
                <th className="py-3 px-3 text-right border-r border-amber-300">Total AED</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300">Paid AED</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300">Balance AED</th>
                <th className="py-3 px-2 text-center border-r border-amber-300">Loaded?</th>
                <th className="py-3 px-3 text-center">Journal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {rows.map((r, i) => {
                const form = r.form_data?.form || {};
                const billNo = r.purchase_order_no || r.bill_no || r.order_no || "—";
                const date = r.order_date || form.orderDate || r.created_at?.slice(0, 10) || "—";
                const countryBranch = `${form.countryCode || "AE"} / ${form.branchCode || "AE-001"}`;
                const supplier = r.supplier_name || form.supplierName || "—";
                const goods = r.goods_name || form.goodsName || "—";
                const qty = r.total_quantity || form.totalQuantity || 0;
                const unit = form.quantityUnit || "Cartons";
                const grossKg = r.gross_weight || form.grossWeight || 0;
                const netKg = r.net_weight || form.netWeight || 0;
                const total = Number(r.order_total || form.totalAmount || 0);
                const paid = Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);
                const bal = Math.max(0, total - paid);
                const isLoaded = Boolean(r.is_loaded || r.loading_records?.length || form.loadedQuantity > 0);

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
                    <td className="py-3 px-3 text-right font-mono font-black">{fmt(total)}</td>
                    <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-600">{fmt(paid)}</td>
                    <td className="py-3 px-2.5 text-right font-mono font-bold text-rose-600">{fmt(bal)}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", isLoaded ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>
                        {isLoaded ? "Yes" : "No"}
                      </span>
                    </td>
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

        {/* Empty State */}
        {(sourceFilter === "all" ? generalRows.length === 0 : rows.length === 0) && (
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
