"use client";

import React, { useEffect, useMemo, useState } from "react";
import { 
  X, Printer, Eye, ArrowUpRight, ArrowDownLeft, 
  Calendar, Building2, User, Wallet, DollarSign, FileText, CheckCircle2, AlertCircle, 
  ChevronRight, Shield, Layers, Scale, Truck, Anchor, Package
} from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader, LanguageCode } from "@/lib/i18n/table-headers";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";
import { openPurchaseBookingOrderPrintReport } from "@/lib/reports/open-purchase-booking-print-report";
import { cn } from "@/lib/utils";

export interface OpenFullBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  payments?: any[];
  onPaymentAdded?: () => void;
  lang?: LanguageCode;
}

export function OpenFullBillModal({
  isOpen,
  onClose,
  order,
  payments: initialPayments,
  onPaymentAdded,
  lang: propLang
}: OpenFullBillModalProps) {
  const activeLang = (propLang || useActiveLanguage() || "en") as LanguageCode;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);

  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [payments, setPayments] = useState<any[]>(initialPayments || []);
  const [loadingPayments, setLoadingPayments] = useState<boolean>(false);
  const [session, setSession] = useState<any>(null);

  // Helper translations
  const t = (text: string) => {
    if (!text || text === "-") return text;
    try {
      const translated = translateHeader(activeLang, text);
      if (translated && translated !== text) return translated;
      const auto = autoTranslate5Languages(text);
      return auto[activeLang as keyof typeof auto] || text;
    } catch {
      return text;
    }
  };

  // Fetch session
  useEffect(() => {
    let cancelled = false;
    async function fetchSession() {
      try {
        const res = await fetch("/api/erp/auth/session", { credentials: "include" });
        const body = await res.json();
        if (body?.ok && !cancelled) setSession(body.data);
      } catch (err) {
        console.error("Failed to load session:", err);
      }
    }
    void fetchSession();
    return () => { cancelled = true; };
  }, []);

  // Fetch live payments for this order
  useEffect(() => {
    if (!order?.id || !isOpen) return;
    let cancelled = false;
    async function loadPayments() {
      setLoadingPayments(true);
      try {
        const res = await fetch(`/api/erp/purchases/orders/${order.id}/payments?lang=${activeLang}`, { credentials: "include" });
        const body = await res.json();
        if (body?.ok && body.data?.payments && !cancelled) {
          setPayments(body.data.payments);
        } else if (Array.isArray(initialPayments) && !cancelled) {
          setPayments(initialPayments);
        }
      } catch (err) {
        console.error("Failed to load payments for full bill:", err);
        if (Array.isArray(initialPayments) && !cancelled) {
          setPayments(initialPayments);
        }
      } finally {
        if (!cancelled) setLoadingPayments(false);
      }
    }
    void loadPayments();
    return () => { cancelled = true; };
  }, [order?.id, isOpen, activeLang, initialPayments]);

  if (!isOpen || !order) return null;

  // Extract form and data
  const form = order.form_data?.form || {};
  const goodsEntries = (Array.isArray(order.form_data?.goodsEntries) && order.form_data.goodsEntries.length > 0)
    ? order.form_data.goodsEntries
    : [
        {
          goodsName: order.productName || order.goodsDescription || form.goodsName || "Cargo Item",
          spec: form.specLot || form.origin || "Standard Quality",
          qtyNo: Number(order.quantity || form.qtyNo || 1),
          grossWeight: Number(order.totalGrossWeight || order.totalWeight || form.grossWeight || 0),
          netWeight: Number(order.totalNetWeight || order.totalWeight || form.netWeight || 0),
          coursePrice: Number(order.purchaseRate || form.coursePrice || form.unitPrice || 0),
          totalAmount: Number(order.totalPurchaseAmount || order.purchaseAmount || form.totalAmount || order.order_total || 0)
        }
      ];

  const poNumber = order.purchase_order_no || order.purchaseBookingOrderNumber || `PO-${order.id?.slice(0, 8) || "001"}`;
  const billNumber = form.manualBillNumber || form.billNo || order.purchase_contract_no || "BILL-2026-0001";
  const purchaseDate = form.purchaseDate || order.purchaseDate || order.bookingDate || order.created_at || new Date().toISOString();
  const dateFormatted = new Date(purchaseDate).toLocaleDateString("en-GB");

  const countryName = String(order.countryName || order.countries?.name || form.countryName || form.originCountry || "United Arab Emirates");
  const branchName = String(order.branchName || order.country_branches?.name || form.branchName || "Main Branch");
  const branchCode = String(order.country_branches?.code || form.branchCode || "AEG-ALMIN-001");
  
  const currency = String(order.currency_code || order.currency || form.currencyType || "USD").toUpperCase();
  const localCurrency = String(form.secondaryCurrency?.split(" ")[0] || "AED").toUpperCase();
  const exchangeRate = Number(order.exchange_rate || form.exchangeRate || 3.6725) || 1;

  // Seller & Buyer
  const supplierName = String(order.supplierName || form.purchaseAccountName || form.supplierName || form.partyName || "M/S ARYAN GLOBAL COMMODITIES FZE");
  const purchaseAccountNo = String(order.purchaseAccountNumber || form.purchaseAccountNo || "AEG-ALMIN-001");
  const buyerName = String(order.buyerName || form.salesAccountName || form.customerName || "DAMAAN GENERAL TRADING LLC");
  const salesAccountNo = String(order.salesAccountNumber || form.salesAccountNo || "AEG-ALMIN-001");

  // Totals
  const totalPurchaseFC = goodsEntries.reduce((sum: number, g: any) => sum + Number(g.totalAmount || g.finalAmount || (Number(g.qtyNo || 0) * Number(g.coursePrice || 0)) || 0), 0) || Number(order.totalPurchaseAmount || order.order_total || 0);
  const totalPurchaseLC = totalPurchaseFC * exchangeRate;

  // Filter out any non-payment / duplicate rows
  const paymentList = [...payments].filter((p: any) => !String(p.narration || "").toLowerCase().includes("initial booking transfer"));

  // Total Paid
  const totalPaidFC = paymentList.reduce((sum: number, p: any) => {
    const rawAmt = Math.abs(Number(p.amount || p.payment_amount || p.base_currency_amount || 0));
    const pCur = String(p.currency_code || currency).toUpperCase();
    const rate = Number(p.exchange_rate || exchangeRate) || 1;
    return sum + (pCur === localCurrency ? rawAmt / rate : rawAmt);
  }, 0);

  const totalPaidLC = totalPaidFC * exchangeRate;
  const remainingFC = Math.max(0, totalPurchaseFC - totalPaidFC);
  const remainingLC = Math.max(0, totalPurchaseLC - totalPaidLC);

  const isCompleted = remainingFC <= 0.01 && totalPaidFC > 0;
  const isPartiallyPaid = totalPaidFC > 0 && remainingFC > 0.01;
  const statusBadge = isCompleted ? "Completed" : isPartiallyPaid ? "Partially Paid" : "Pending";

  // Goods totals
  const sumQty = goodsEntries.reduce((sum: number, g: any) => sum + Number(g.qtyNo || g.quantity || 0), 0);
  const sumGrossWt = goodsEntries.reduce((sum: number, g: any) => sum + Number(g.grossWeight || 0), 0);
  const sumNetWt = goodsEntries.reduce((sum: number, g: any) => sum + Number(g.netWeight || 0), 0);
  const sumTotalAmt = totalPurchaseFC;
  const sumFinalAmt = totalPurchaseLC;

  // DEBIT ENTRIES (DR) - Only Liability / Bill Amount Booking side
  const debitEntries = [
    {
      srNo: 1,
      date: dateFormatted,
      voucherNo: billNumber,
      narration: `Purchase Bill (${poNumber})`,
      amountFC: totalPurchaseFC,
      amountLC: totalPurchaseLC
    }
  ];

  // CREDIT ENTRIES (CR) - Only Payments made to supplier
  const creditEntries = paymentList.map((p: any, index: number) => {
    const rawAmt = Math.abs(Number(p.amount || p.payment_amount || p.base_currency_amount || 0));
    const pCur = String(p.currency_code || currency).toUpperCase();
    const rate = Number(p.exchange_rate || exchangeRate) || 1;
    const amountFC = pCur === localCurrency ? rawAmt / rate : rawAmt;
    const amountLC = pCur === localCurrency ? rawAmt : rawAmt * rate;
    const pDate = p.entry_date || p.payment_date || p.created_at || purchaseDate;
    const refNo = p.reference_no || p.source_reference_no || `PAY-2026-${String(index + 1).padStart(4, "0")}`;
    const narration = p.narration || (index === 0 ? "Advance Payment" : index === 1 ? "Second Payment" : index === 2 ? "Third Payment" : "Final Payment");

    return {
      srNo: index + 1,
      date: new Date(pDate).toLocaleDateString("en-GB"),
      voucherNo: refNo,
      narration,
      amountFC,
      amountLC,
      exchangeRate: rate,
      raw: p
    };
  });

  const totalDebitFC = debitEntries.reduce((sum, d) => sum + d.amountFC, 0);
  const totalDebitLC = debitEntries.reduce((sum, d) => sum + d.amountLC, 0);

  const totalCreditFC = creditEntries.reduce((sum, c) => sum + c.amountFC, 0);
  const totalCreditLC = creditEntries.reduce((sum, c) => sum + c.amountLC, 0);

  // ROZNAMCHA CASH ENTRIES
  let runningRoznamchaBal = totalPurchaseFC;
  const roznamchaRows = creditEntries.map((c: any) => {
    runningRoznamchaBal = runningRoznamchaBal - c.amountFC;
    const rznNo = c.raw.roznamcha_entries?.branch_transaction_serial_number || c.raw.roznamcha_entry_id || `RZN-2026-${String(c.srNo).padStart(4, "0")}`;
    const userName = c.raw.roznamcha_entries?.profiles?.full_name || session?.fullName || session?.email || "Admin";

    return {
      srNo: c.srNo,
      date: c.date,
      userName,
      roznamchaNo: rznNo,
      narration: c.narration,
      drAccount: supplierName,
      drAmount: c.amountFC,
      crAccount: "Bank - Dubai",
      crAmount: c.amountFC,
      exchangeRate: c.exchangeRate,
      finalAmount: c.amountLC,
      balanceAfter: runningRoznamchaBal
    };
  });

  // ENDORSEMENT / PAYMENT HISTORY
  let runningEndorsementBal = totalPurchaseFC;
  const endorsementRows = creditEntries.map((c: any) => {
    runningEndorsementBal = runningEndorsementBal - c.amountFC;
    return {
      srNo: c.srNo,
      date: c.date,
      voucherNo: c.voucherNo,
      type: "Payment / Endorsement",
      drAccount: supplierName,
      crAccount: buyerName,
      drAmount: c.amountFC,
      crAmount: c.amountFC,
      exchangeRate: c.exchangeRate,
      finalAmount: c.amountLC,
      remainingBalance: runningEndorsementBal,
      status: "POSTED"
    };
  });

  const tabs = [
    "Overview",
    "Goods & Weights",
    "Credit Entries (CR)",
    "Debit Entries (DR)",
    "Roznamcha (Cash)",
    "Endorsement / Payment",
    "Invoices",
    "Documents",
    "History"
  ];

  const handlePrint = () => {
    openPurchaseBookingOrderPrintReport({
      order: {
        id: order.id,
        systemBillNo: poNumber,
        manualBillNo: billNumber,
        superAdminSerialNo: order.super_admin_serial_number || form.superAdminSerialNo,
        countrySerialNo: order.country_transaction_serial_number || form.countrySerialNo,
        branchSerialNo: order.branch_transaction_serial_number || form.branchSerialNo,
        bookingDate: purchaseDate,
        supplierName,
        buyerName,
        purchaseAccountNo,
        purchaseAccountName: supplierName,
        salesAccountNo,
        salesAccountName: buyerName,
        countryName,
        branchName,
        shippingMode: form.shippingMode || "By Sea",
        totalPurchaseAmount: totalPurchaseFC,
        currency,
        exchangeRate,
        finalAmount: totalPurchaseLC,
        advancePercent: Number(form.advancePercent || 0),
        advanceAmountFc: totalPaidFC,
        advanceAmountLc: totalPaidLC,
        remainingAmountFc: remainingFC,
        remainingAmountLc: remainingLC,
        status: statusBadge,
        goodsItems: goodsEntries.map((g: any, i: number) => ({
          srNo: i + 1,
          goodsName: g.goodsName || "Cargo Item",
          origin: form.originCountry || countryName,
          quantity: Number(g.qtyNo || 0),
          unit: g.qtyName || form.qtyName || "KG",
          grossWeight: Number(g.grossWeight || 0),
          netWeight: Number(g.netWeight || 0),
          unitPrice: Number(g.coursePrice || 0),
          totalAmount: Number(g.totalAmount || 0)
        }))
      },
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        branch: branchName
      },
      lang: activeLang
    });
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[1780px] p-0 overflow-hidden bg-slate-100 dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-800"
    >
      <div className={cn("flex flex-col h-full overflow-y-auto text-slate-800 dark:text-slate-200 font-sans", isRtl && "text-right")}>
        
        {/* ── TOP HEADER BAR ────────────────────────────────────── */}
        <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                    Open Full Bill - <span className="font-mono text-blue-600 dark:text-blue-400">{poNumber}</span>
                  </h2>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm",
                    isCompleted 
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                      : isPartiallyPaid
                      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300"
                  )}>
                    {statusBadge}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{t("Print Full Bill Invoice (PDF)")}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition"
              >
                <X className="h-4 w-4" />
                <span>{t("CLOSE X")}</span>
              </button>
            </div>
          </div>

          {/* Meta bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{t("PO NUMBER")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{poNumber}</span>
            </div>
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{t("BILL NUMBER")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{billNumber}</span>
            </div>
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{t("PURCHASE DATE")}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{dateFormatted}</span>
            </div>
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{t("BRANCH")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{branchCode}</span>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT CONTAINER ────────────────────────────── */}
        <div className="p-6 space-y-5">
          
          {/* Dark summary banner */}
          <div className="rounded-2xl bg-slate-950 dark:bg-slate-900 p-5 text-white shadow-md border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t("SELLER NAME")}: {supplierName}
                </div>
                <div className="mt-1 text-2xl font-black tracking-tight font-mono text-white">
                  {poNumber}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {countryName} / {branchName} / {currency}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-slate-800/80 px-3.5 py-2 text-center border border-slate-700 min-w-[75px]">
                  <div className="text-[9px] font-bold uppercase text-slate-400">{t("GOODS")}</div>
                  <div className="text-sm font-black text-white">{goodsEntries.length}</div>
                </div>
                <div className="rounded-xl bg-slate-800/80 px-3.5 py-2 text-center border border-slate-700 min-w-[75px]">
                  <div className="text-[9px] font-bold uppercase text-slate-400">{t("SYMBOL")}</div>
                  <div className="text-sm font-black text-emerald-400">{statusBadge}</div>
                </div>
                <div className="rounded-xl bg-slate-800/80 px-3.5 py-2 text-center border border-slate-700 min-w-[75px]">
                  <div className="text-[9px] font-bold uppercase text-slate-400">{t("RATE")}</div>
                  <div className="text-sm font-mono font-black text-white">{exchangeRate.toFixed(4)}</div>
                </div>
                <div className="rounded-xl bg-slate-800/80 px-3.5 py-2 text-center border border-slate-700 min-w-[75px]">
                  <div className="text-[9px] font-bold uppercase text-slate-400">{t("LOCAL")}</div>
                  <div className="text-sm font-black text-white">{currency}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 4 TOP KPI CARDS ─────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: DEBIT ACCOUNT (DR) */}
            <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900/40 dark:bg-slate-900">
              <div className="absolute right-3 bottom-2 text-6xl font-black text-blue-50 dark:text-blue-950/40 select-none pointer-events-none">
                DR
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {t("DEBIT ACCOUNT (DR)")}
              </div>
              <div className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100 line-clamp-1">
                {supplierName}
              </div>
              <div className="mt-0.5 text-[10px] font-bold text-slate-400">
                LAST ACT: {dateFormatted}
              </div>
              <div className="mt-3 space-y-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-2">
                <div>{t("All Raw")} ({branchCode})</div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{currency}</div>
              </div>
            </div>

            {/* Card 2: CREDIT ACCOUNT (CR) */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900">
              <div className="absolute right-3 bottom-2 text-6xl font-black text-emerald-50 dark:text-emerald-950/40 select-none pointer-events-none">
                CR
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                {t("CREDIT ACCOUNT (CR)")}
              </div>
              <div className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100 line-clamp-1">
                {buyerName}
              </div>
              <div className="mt-0.5 text-[10px] font-bold text-slate-400">
                LAST ACT: {dateFormatted}
              </div>
              <div className="mt-3 space-y-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-2">
                <div>{t("All Raw")} ({branchCode})</div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{currency}</div>
              </div>
            </div>

            {/* Card 3: BILL SUMMARY */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("BILL SUMMARY")}
              </div>
              <div className="mt-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("Total Purchase (FC)")}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {totalPurchaseFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("Exchange Rate")}</span>
                  <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                    1 {currency} = {exchangeRate.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5 font-bold">
                  <span className="text-slate-700 dark:text-slate-300">{t("Final Converted")} ({currency})</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {totalPurchaseFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: REMAINING BALANCE */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("REMAINING BALANCE")}
              </div>
              <div className="mt-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("Total Payable")}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {totalPurchaseFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("Total Paid")}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {totalPaidFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">{t("Remaining")}</span>
                  <span className="font-mono font-black text-red-600 dark:text-red-400">
                    {remainingFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5 text-[11px]">
                  <span className="text-slate-400">{t("Local Balance")}</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {remainingLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── TABS NAVIGATION ROW ─────────────────────────────── */}
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1 text-xs">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3.5 py-2 font-bold whitespace-nowrap rounded-t-lg transition border-b-2",
                  activeTab === tab
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                {t(tab)}
              </button>
            ))}
          </div>

          {/* ── TAB 1: PURCHASE INVOICE DETAILS ─────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t("PURCHASE INVOICE DETAILS")}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-2.5">{t("INVOICE NO.")}</th>
                    <th className="px-4 py-2.5">{t("INVOICE DATE")}</th>
                    <th className="px-4 py-2.5">{t("ENDORSED TO")}</th>
                    <th className="px-4 py-2.5 text-right">{t("INVOICE AMOUNT")} ({currency})</th>
                    <th className="px-4 py-2.5 text-right">{t("PAID AMOUNT")} ({currency})</th>
                    <th className="px-4 py-2.5 text-right">{t("REMAINING")} ({currency})</th>
                    <th className="px-4 py-2.5 text-center">{t("STATUS")}</th>
                    <th className="px-4 py-2.5 text-center">{t("DUE DATE")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b last:border-b-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{billNumber}</td>
                    <td className="px-4 py-3 font-semibold">{dateFormatted}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{buyerName}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{totalPurchaseFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{totalPaidFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-mono font-black text-red-600 dark:text-red-400">{remainingFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase",
                        isCompleted ? "bg-emerald-100 text-emerald-800" : isPartiallyPaid ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                      )}>
                        {statusBadge}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-500">{dateFormatted}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── TAB 2: GOODS & WEIGHTS DETAILS ──────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t("GOODS & WEIGHTS DETAILS")}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="px-3 py-2.5 text-center w-10">#</th>
                    <th className="px-4 py-2.5">{t("GOODS NAME")}</th>
                    <th className="px-4 py-2.5 text-right">{t("QTY")}</th>
                    <th className="px-4 py-2.5 text-right">{t("GROSS WT")}</th>
                    <th className="px-4 py-2.5 text-right">{t("NET WT")}</th>
                    <th className="px-4 py-2.5 text-right">{t("UNIT PRICE")} ({currency})</th>
                    <th className="px-4 py-2.5 text-right">{t("TOTAL")} ({currency})</th>
                    <th className="px-4 py-2.5 text-right">{t("FINAL AMOUNT")} ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {goodsEntries.map((g: any, index: number) => {
                    const qty = Number(g.qtyNo || g.quantity || 0);
                    const gross = Number(g.grossWeight || 0);
                    const net = Number(g.netWeight || 0);
                    const price = Number(g.coursePrice || g.unitPrice || 0);
                    const total = Number(g.totalAmount || (qty * price) || 0);
                    const finalAmt = Number(g.finalAmount || (total * exchangeRate) || total);

                    return (
                      <tr key={index} className="border-b last:border-b-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="px-3 py-2 text-center font-bold text-slate-400">{index + 1}</td>
                        <td className="px-4 py-2 font-bold text-slate-800 dark:text-slate-200">
                          {g.goodsName || g.productName || "Cargo Item"}
                          {g.spec && <span className="block text-[10px] font-normal text-slate-400">({g.spec})</span>}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{qty.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{gross.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{net.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 font-black border-t border-slate-200 dark:border-slate-800 text-xs">
                    <td colSpan={2} className="px-4 py-2.5 uppercase text-slate-700 dark:text-slate-300">{t("TOTAL")}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{sumQty.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{sumGrossWt.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{sumNetWt.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right"></td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{sumTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{sumTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── CORE FEATURE: 2 SEPARATE LANES (DR vs CR) ───────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* ── LANE 1: DEBIT ENTRIES (DR) - LIABILITY / BILL AMOUNT ── */}
            <div className="rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden dark:border-blue-900/40 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="bg-blue-50 dark:bg-blue-950/60 px-4 py-2.5 border-b border-blue-200 dark:border-blue-900/40 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <ArrowDownLeft className="h-4 w-4" />
                    {t("DEBIT ENTRIES (DR) - LIABILITY / BILL AMOUNT")}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                    {debitEntries.length} {t("Records")}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200 dark:border-slate-800">
                        <th className="px-3 py-2 text-center w-10">{t("SR#")}</th>
                        <th className="px-3 py-2">{t("DATE")}</th>
                        <th className="px-3 py-2">{t("VOUCHER / REF NO.")}</th>
                        <th className="px-3 py-2">{t("NARRATION")}</th>
                        <th className="px-3 py-2 text-right">{t("AMOUNT")} ({currency})</th>
                        <th className="px-3 py-2 text-right">{t("FINAL AMOUNT")} ({localCurrency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debitEntries.map((d) => (
                        <tr key={d.srNo} className="border-b last:border-b-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="px-3 py-2 text-center font-mono font-bold text-slate-400">{d.srNo}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">{d.date}</td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">{d.voucherNo}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{d.narration}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {d.amountFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {d.amountLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-blue-50/60 dark:bg-blue-950/40 p-3 border-t border-blue-200 dark:border-blue-900/40 flex items-center justify-between text-xs font-black">
                <span className="text-red-600 dark:text-red-400 uppercase tracking-wider">{t("TOTAL DEBIT")}</span>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-red-600 dark:text-red-400">
                    {totalDebitFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                  <span className="font-mono text-red-600 dark:text-red-400">
                    {totalDebitLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrency}
                  </span>
                </div>
              </div>
            </div>

            {/* ── LANE 2: CREDIT ENTRIES (CR) - PAYMENTS MADE TO SUPPLIER ── */}
            <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden dark:border-emerald-900/40 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="bg-emerald-50 dark:bg-emerald-950/60 px-4 py-2.5 border-b border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <ArrowUpRight className="h-4 w-4" />
                    {t("CREDIT ENTRIES (CR) - PAYMENTS MADE TO SUPPLIER")}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                    {creditEntries.length} {t("Payments")}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200 dark:border-slate-800">
                        <th className="px-3 py-2 text-center w-10">{t("SR#")}</th>
                        <th className="px-3 py-2">{t("DATE")}</th>
                        <th className="px-3 py-2">{t("VOUCHER / REF NO.")}</th>
                        <th className="px-3 py-2">{t("NARRATION")}</th>
                        <th className="px-3 py-2 text-right">{t("AMOUNT")} ({currency})</th>
                        <th className="px-3 py-2 text-right">{t("FINAL AMOUNT")} ({localCurrency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditEntries.length > 0 ? (
                        creditEntries.map((c) => (
                          <tr key={c.srNo} className="border-b last:border-b-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                            <td className="px-3 py-2 text-center font-mono font-bold text-slate-400">{c.srNo}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">{c.date}</td>
                            <td className="px-3 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">{c.voucherNo}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{c.narration}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              {c.amountFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              {c.amountLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-semibold italic">
                            {t("No payments recorded yet.")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-3 border-t border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between text-xs font-black">
                <span className="text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">{t("TOTAL CREDIT")}</span>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-emerald-700 dark:text-emerald-300">
                    {totalCreditFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-300">
                    {totalCreditLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrency}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* ── ROZNAMCHA (CASH) ENTRIES AGAINST THIS PURCHASE ──── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t("ROZNAMCHA (CASH) ENTRIES AGAINST THIS PURCHASE")}
              </span>
              <button
                type="button"
                className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-black uppercase transition border border-blue-200 dark:border-blue-800"
              >
                {t("VIEW ROZNAMCHA SUMMARY")}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200 dark:border-slate-800">
                    <th className="px-3 py-2 text-center w-10">{t("SR#")}</th>
                    <th className="px-3 py-2">{t("DATE")}</th>
                    <th className="px-3 py-2">{t("USER NAME")}</th>
                    <th className="px-3 py-2">{t("ROZNAMCHA NO.")}</th>
                    <th className="px-3 py-2">{t("DETAILS / NARRATION")}</th>
                    <th className="px-3 py-2">{t("DR ACCOUNT (SUPPLIER)")}</th>
                    <th className="px-3 py-2 text-right">{t("DR AMOUNT")} ({currency})</th>
                    <th className="px-3 py-2">{t("CR ACCOUNT (PAID FROM)")}</th>
                    <th className="px-3 py-2 text-right">{t("CR AMOUNT")} ({currency})</th>
                    <th className="px-3 py-2 text-center">{t("EXCHANGE RATE")}</th>
                    <th className="px-3 py-2 text-right">{t("FINAL AMOUNT")} ({localCurrency})</th>
                    <th className="px-3 py-2 text-right">{t("BALANCE AFTER")} ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {roznamchaRows.length > 0 ? (
                    roznamchaRows.map((r) => (
                      <tr key={r.srNo} className="border-b last:border-b-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="px-3 py-2 text-center font-mono font-bold text-slate-400">{r.srNo}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-2 font-semibold">{r.userName}</td>
                        <td className="px-3 py-2 font-mono font-bold text-purple-600 dark:text-purple-400">{r.roznamchaNo}</td>
                        <td className="px-3 py-2 font-semibold">{r.narration}</td>
                        <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">{r.drAccount}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{r.drAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{r.crAccount}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{r.crAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-center font-mono">{r.exchangeRate.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{r.finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={cn("px-3 py-2 text-right font-mono font-black", r.balanceAfter < 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-200")}>
                          {r.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-slate-400 font-semibold italic">
                        {t("No Roznamcha cash entries posted for this purchase.")}
                      </td>
                    </tr>
                  )}
                </tbody>
                {roznamchaRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 font-black border-t border-slate-200 dark:border-slate-800 text-xs">
                      <td colSpan={6} className="px-4 py-2 uppercase">{t("TOTAL")}</td>
                      <td className="px-3 py-2 text-right font-mono">{totalCreditFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td></td>
                      <td className="px-3 py-2 text-right font-mono">{totalCreditFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td></td>
                      <td className="px-3 py-2 text-right font-mono">{totalCreditLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── ENDORSEMENT / PAYMENT HISTORY ───────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t("ENDORSEMENT / PAYMENT HISTORY")}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200 dark:border-slate-800">
                    <th className="px-3 py-2 text-center w-10">{t("SR#")}</th>
                    <th className="px-3 py-2">{t("DATE")}</th>
                    <th className="px-3 py-2">{t("VOUCHER / REF NO.")}</th>
                    <th className="px-3 py-2">{t("TYPE")}</th>
                    <th className="px-3 py-2">{t("DR ACCOUNT (SUPPLIER)")}</th>
                    <th className="px-3 py-2">{t("CR ACCOUNT")}</th>
                    <th className="px-3 py-2 text-right">{t("DR AMOUNT")} ({currency})</th>
                    <th className="px-3 py-2 text-right">{t("CR AMOUNT")} ({currency})</th>
                    <th className="px-3 py-2 text-center">{t("EXCHANGE RATE")}</th>
                    <th className="px-3 py-2 text-right">{t("FINAL AMOUNT")} ({localCurrency})</th>
                    <th className="px-3 py-2 text-right">{t("REMAINING BALANCE")} ({currency})</th>
                    <th className="px-3 py-2 text-center">{t("STATUS")}</th>
                  </tr>
                </thead>
                <tbody>
                  {endorsementRows.length > 0 ? (
                    endorsementRows.map((e) => (
                      <tr key={e.srNo} className="border-b last:border-b-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="px-3 py-2 text-center font-mono font-bold text-slate-400">{e.srNo}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{e.date}</td>
                        <td className="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">{e.voucherNo}</td>
                        <td className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-400">{e.type}</td>
                        <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">{e.drAccount}</td>
                        <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{e.crAccount}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{e.drAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{e.crAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-center font-mono">{e.exchangeRate.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{e.finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={cn("px-3 py-2 text-right font-mono font-black", e.remainingBalance < 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-200")}>
                          {e.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-slate-400 font-semibold italic">
                        {t("No endorsement history recorded yet.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── BOTTOM 4 KPI SUMMARY BAR ────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{t("TOTAL PURCHASE (BILL AMOUNT)")}</span>
              <div className="mt-1 text-lg font-black font-mono text-slate-900 dark:text-slate-100">
                {totalPurchaseFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {localCurrency} {totalPurchaseLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{t("TOTAL PAID")}</span>
              <div className="mt-1 text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                {totalPaidFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </div>
              <div className="text-[11px] font-mono text-emerald-600/70">
                {localCurrency} {totalPaidLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{t("TOTAL REMAINING")}</span>
              <div className="mt-1 text-lg font-black font-mono text-red-600 dark:text-red-400">
                {remainingFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </div>
              <div className="text-[11px] font-mono text-red-600/70">
                {localCurrency} {remainingLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{t("STATUS")}</span>
              <div className="mt-1">
                <span className={cn(
                  "inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm",
                  isCompleted 
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                    : isPartiallyPaid
                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300"
                )}>
                  {statusBadge}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {dateFormatted}
              </div>
            </div>
          </div>

          {/* ── TRANSPORT & LOGISTICS DETAILS ───────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
              {t("TRANSPORT & LOGISTICS DETAILS")}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="block text-[9px] font-bold text-slate-400">{t("Loading Country")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{form.loadingCountry || form.originCountry || countryName}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400">{t("Loading Date")}</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{form.loadingDate || dateFormatted}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400">{t("Receiving Country")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{form.receivedCountry || form.destinationCountry || countryName}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400">{t("Received Date")}</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{form.receivedDate || dateFormatted}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400">{t("Payment / Insurance Condition")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{form.paymentType || "Advance Payment"}</span>
              </div>
            </div>
          </div>

          {/* ── BOTTOM ACTIONS ─────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 pb-4">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition"
            >
              <Printer className="h-4 w-4" />
              <span>{t("PRINT FULL BILL INVOICE (PDF)")}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs transition"
            >
              <span>{t("CLOSE DETAILS")}</span>
            </button>
          </div>

        </div>
      </div>
    </SimpleModal>
  );
}
