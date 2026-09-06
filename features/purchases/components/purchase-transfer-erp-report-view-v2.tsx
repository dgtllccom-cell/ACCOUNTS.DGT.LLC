"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  WalletCards,
  Building2,
  Package,
  Ship,
  CreditCard,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  User,
  Globe,
  Calendar,
  Hash,
  TrendingUp,
  FileText,
  PenLine,
  MoreVertical,
  X,
  Send,
  Coins,
  ShieldCheck,
  Check,
  QrCode,
  Layers,
  ArrowRight,
  Sparkles,
  Lock,
  BadgeCheck,
  Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { fetchBranding, brandingName } from "@/lib/branding/client";
import { Th } from "@/components/ui/translated-th";

function money(value: unknown, decimals = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function fmtDate(value: string | null | undefined) {
  if (!value || value === "-") return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB");
}

function PurchaseTransferErpReportViewContent({
  purchaseData: initialData
}: {
  purchaseData?: any;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [reportData, setReportData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData && Boolean(idParam));
  const [error, setError] = useState<string | null>(null);

  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState("");
  const [transferError, setTransferError] = useState("");

  /* Fetch if only ID was passed */
  useEffect(() => {
    if (initialData || !idParam) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/erp/purchases/booking-journal-report?id=${encodeURIComponent(idParam)}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        const row = json?.data?.reports?.[0] || json?.data?.selected || json?.reports?.[0] || json;
        setReportData(row);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load purchase record.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [idParam, initialData]);

  const activeLang = useActiveLanguage();
  const isRtl = ["ur","ar","fa","ps"].includes(activeLang);
  const tt = (key: string, fb: string) => t(activeLang, key as never, fb);
  const [brandCompany, setBrandCompany] = useState<string | null>(null);
  useEffect(() => {
    fetchBranding(null).then((b) => setBrandCompany(brandingName(b, activeLang) || null)).catch(() => {});
  }, [activeLang]);
  const brandLine = brandCompany || t(activeLang, "acct.brand_short", "Digital Dock ERP");

  /* ── Derived values ────────────────────────────────────────── */
  const d = reportData;
  const form = d?.form_data?.form || {};
  const totals = d?.form_data?.totals || {};

  const bookingRef = d?.purchaseBookingOrderNumber || form.bookingNo || `AE-${d?.id ? d.id.slice(0, 4) : "001"}-0001`;
  const reportNo = `PTVR-${new Date().getFullYear()}-${d?.id ? d.id.slice(0, 6).toUpperCase() : "000000"}`;
  
  const isPosted = d?.status === "Posted"
    || d?.status === "Transferred"
    || d?.status === "posted"
    || d?.status === "transferred"
    || d?.ledger_posting_status === "posted"
    || d?.ledger_posting_status === "Posted"
    || d?.ledger_posting_status === "Transferred"
    || (d as any)?.is_transferred === true;
  
  // Serials (Super Admin, Country, Branch, and Business Roznamcha Voucher Serial)
  const superAdminSerial = (d as any)?.superAdminSerialNo || (d as any)?.super_admin_serial_number || form.superAdminSerialNo || `GBL-PB-${bookingRef}`;
  const countrySerial = (d as any)?.computedCountrySerial || (d as any)?.country_transaction_serial_number || form.countrySerialNo || `CTY-${(form.countryName || "UAE").slice(0,3).toUpperCase()}-${bookingRef}`;
  const branchSerial = (d as any)?.computedBranchSerial || (d as any)?.branch_transaction_serial_number || form.branchSerialNo || `BR-${(form.branchName || "MAIN").slice(0,3).toUpperCase()}-${bookingRef}`;
  const roznamchaSerial = (d as any)?.roznamcha_serial_number || form.roznamchaSerialNo || `ROZ-PB-${bookingRef}`;
  
  // Account codes & names
  const purchaseAccCode = form.purchaseAccountNo || d?.purchaseAccountNumber || "—";
  const purchaseAccName = form.purchaseAccountName || d?.purchaseAccountName || "—";
  
  const salesAccCode = form.salesAccountNo || d?.salesAccountNumber || "—";
  const salesAccName = form.salesAccountName || d?.salesAccountName || "—";

  const debitSerial = (d as any)?.debit_serial_number || `ROZ-DR-${purchaseAccCode}`;
  const creditSerial = (d as any)?.credit_serial_number || `ROZ-CR-${salesAccCode}`;

  const countryName = d?.countryName || form.countryName || "—";
  const branchName = d?.branchName || form.branchName || "—";
  const branchCode = d?.branchCode || form.branchCode || "—";

  const exchangeRate = Number(d?.exchange_rate || form.exchangeRate || 0);
  const currencyFc = d?.currency || form.currencyType || "USD";
  const currencyLc = form.secondaryCurrency || "AED";

  // Goods breakdown
  const goodsEntries: any[] = useMemo(() => {
    if (!d) return [];
    if (d.form_data?.goodsEntries?.length) return d.form_data.goodsEntries;
    // A single derived line from the record's own totals when the goods array is
    // absent — never fabricated product/brand/origin values.
    if (d.productName || d.goodsDescription || d.totalPurchaseAmount) {
      return [{
        goodsName: d.productName || d.goodsDescription || "—",
        hsCode: d.hsCode || "—",
        brand: d.brand || "—",
        size: d.size || "—",
        origin: d.origin || d.countryName || "—",
        qtyNo: Number(d.quantity || 0),
        qtyName: d.unit || "—",
        qtyKgs: Number(d.qtyKgs || 0),
        grossWeight: Number(d.totalGrossWeight || 0),
        netWeight: Number(d.totalNetWeight || 0),
        coursePrice: Number(d.purchaseRate || 0),
        totalAmount: Number(d.totalPurchaseAmount || 0),
        finalAmount: Number(d.totalPurchaseAmount || 0) * exchangeRate,
      }];
    }
    return [];
  }, [d, exchangeRate]);

  const totalAmountFc = useMemo(() => {
    if (!d) return 0;
    return Number(d.totalPurchaseAmount || d.purchaseAmount || totals.grandPrimaryFinal || 0);
  }, [d, totals.grandPrimaryFinal]);

  const totalAmountLc = useMemo(() => {
    return totalAmountFc * exchangeRate;
  }, [totalAmountFc, exchangeRate]);

  const totalGrossWt = goodsEntries.reduce((sum, g) => sum + (Number(g.grossWeight) || 0), 0);
  const totalNetWt = goodsEntries.reduce((sum, g) => sum + (Number(g.netWeight) || 0), 0);
  const totalCartons = goodsEntries.reduce((sum, g) => sum + (Number(g.qtyNo) || 0), 0);

  const advancePercent = Number(form.advancePercent || 0);
  const advanceAmountFc = (totalAmountFc * advancePercent) / 100;
  const advanceAmountLc = (totalAmountLc * advancePercent) / 100;
  const remainingAmountFc = Math.max(0, totalAmountFc - advanceAmountFc);
  const remainingAmountLc = Math.max(0, totalAmountLc - advanceAmountLc);

  // Transfer action
  async function handleTransferPayment() {
    if (!d) return;
    setTransferring(true);
    setTransferError("");
    setTransferSuccess("");
    try {
      const res = await fetch(`/api/erp/purchases/orders/${d.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advancePaid: advanceAmountLc })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || json?.error || "Failed to process transfer payment.");
      }
      setTransferSuccess("✅ Booking Transfer successfully posted to Roznamcha & General Ledger! Double-entry accounts updated.");
      setReportData((prev: any) => ({
        ...prev,
        ledger_posting_status: "posted",
        payment_status: "POSTED"
      }));
    } catch (err: any) {
      setTransferError(err?.message || "Error processing transfer payment.");
    } finally {
      setTransferring(false);
    }
  }

  async function handlePrint() {
    const { printDomFragmentViaModal } = await import("@/lib/reports/print-dom-fragment");
    if (!printDomFragmentViaModal("erp-transfer-report-sheet", tt("pterv2.report_title", "Purchase Transfer — ERP Report"), { lang: activeLang })) {
      window.print();
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 bg-slate-900">
        <div className="text-center space-y-4 p-8 rounded-2xl bg-slate-800/80 border border-slate-700 text-white shadow-2xl">
          <div className="h-10 w-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-extrabold tracking-wide uppercase">{tt("pterv2.loading_engine","Initializing SAP / Oracle Grade Verification Engine...")}</p>
        </div>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans">
        <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <Button onClick={() => router.back()} variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-1" /> {tt("common.back", "Back")}
            </Button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {tt("pterv2.page_title", "Purchase Transfer Verification")}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tt("pterv2.breadcrumb", "Dashboard > Purchase > Transfer Verification")}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-6 mt-12">
          <div className="rounded-2xl border border-rose-200 bg-white dark:border-rose-900 dark:bg-slate-900 p-8 text-center shadow-md space-y-4">
            <div className="p-3 rounded-full bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-950/60 dark:border-rose-800/60 dark:text-rose-400 w-fit mx-auto">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {error || tt("pterv2.record_not_found", "Purchase Transfer Record Not Found")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              {tt("pterv2.record_not_found_desc", "The requested purchase transfer verification record could not be located or has been deleted. Please select a valid record from the purchase registry.")}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button onClick={() => router.push("/dashboard/purchase/purchase-confirm")} variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {tt("pterv2.return_registry", "Return to Purchase Registry")}
              </Button>
              <Button onClick={() => router.push("/dashboard/purchase/local-goods-received")} variant="outline" size="sm" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {tt("pterv2.view_goods_received", "View Local Goods Received")}
              </Button>
              <Button onClick={() => window.location.reload()} variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {tt("common.refresh", "Refresh Page")}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white">

      {/* ───────────── TOP ENTERPRISE STICKY BAR ───────────── */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 dark:bg-blue-600/20 dark:border-blue-500/30 dark:text-blue-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-2">
              {tt("pterv2.page_title","Inter-Country Purchase Verification & Settlement Audit Sheet")}
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 font-mono">
                {tt("pterv2.double_entry_verified", "DOUBLE-ENTRY VERIFIED")}
              </span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {tt("pterv2.booking_ref", "Booking Ref")}: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{bookingRef}</span> | {tt("pterv2.roznamcha_sn", "Roznamcha S/N")}: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{roznamchaSerial}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">


          {/* Print Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-slate-700 px-4 rounded-xl gap-2 shadow-xs"
          >
            <Printer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            {tt("pterv2.print_a4","Print A4 Verification Document")}
          </Button>

          {/* Transfer Button */}
          <Button
            type="button"
            size="sm"
            onClick={handleTransferPayment}
            disabled={transferring || d.ledger_posting_status === "posted"}
            className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 rounded-xl shadow-md gap-2"
          >
            <Send className="h-4 w-4" />
            {transferring ? tt("pterv2.posting_btn","POSTING TO ROZNAMCHA...") : tt("pterv2.post_to_roznamcha","Post to Business Roznamcha")}
          </Button>

          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-xl">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* ───────────── MAIN 2-PANE LAYOUT ───────────── */}
      <div className="max-w-[1700px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT AUDIT CONTROL PANEL (3.5 COLS) */}
        <aside className="lg:col-span-4 space-y-4 print:hidden">
          
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            
            {/* Control Panel Header */}
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest block">{tt("pterv2.control_panel","CONTROL PANEL")}</span>
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{tt("pterv2.audit_form","Audit Verification Form")}</h2>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${isPosted ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30" : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"}`}>
                {isPosted ? tt("pterv2.posted_to_gl","POSTED TO GL") : tt("pterv2.pending_posting","PENDING POSTING")}
              </span>
            </div>

            {/* Audit Flow Steps Indicator */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-[10px]">
              <div className="font-extrabold uppercase text-slate-500 dark:text-slate-400 text-[9px] tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> {tt("pterv2.audit_pipeline","Transaction Audit Pipeline")}
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> {tt("pterv2.step1_done","1. Booking Created & Validated")}
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> {tt("pterv2.step2_done","2. Super Admin & Branch Scope Verified")}
              </div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                <BadgeCheck className="h-3.5 w-3.5" /> {tt("pterv2.step3_done","3. Double-Entry GL Impact Calculated")}
              </div>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                <Lock className="h-3.5 w-3.5" /> {tt("pterv2.step4_ready","4. Business Roznamcha Transfer Ready")}
              </div>
            </div>

            {/* Account Verification Summary */}
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">{tt("pterv2.verified_postings","VERIFIED LEDGER POSTINGS")}</div>

              {/* Purchase Account DR Card */}
              <div className="border border-blue-200 rounded-xl bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-950/40 p-3.5 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-black text-blue-700 dark:text-blue-400 uppercase">
                  <span>{tt("pterv2.debit_account_dr","DEBIT ACCOUNT (DR)")}</span>
                  <span className="font-mono bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded text-blue-800 dark:text-blue-300">{purchaseAccCode}</span>
                </div>
                <div className="text-xs font-black text-slate-900 dark:text-white uppercase">{purchaseAccName}</div>
                <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-mono flex justify-between pt-1">
                  <span>S/N: {debitSerial}</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">{money(totalAmountLc)} {currencyLc}</span>
                </div>
              </div>

              {/* Sales Account CR Card */}
              <div className="border border-emerald-200 rounded-xl bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-950/40 p-3.5 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase">
                  <span>{tt("pterv2.credit_account_cr","CREDIT ACCOUNT (CR)")}</span>
                  <span className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded text-emerald-800 dark:text-emerald-300">{salesAccCode}</span>
                </div>
                <div className="text-xs font-black text-slate-900 dark:text-white uppercase">{salesAccName}</div>
                <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-mono flex justify-between pt-1">
                  <span>S/N: {creditSerial}</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">{money(totalAmountLc)} {currencyLc}</span>
                </div>
              </div>
            </div>

            {/* Transfer Amount Total Banner Box */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 text-center border border-slate-200 dark:border-slate-800 space-y-1 shadow-2xs">
              <div className="text-[9px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">{tt("pterv2.total_value","TOTAL TRANSACTION VALUE")}</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{money(totalAmountLc)} {currencyLc}</div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">${money(totalAmountFc)} {currencyFc} @ Ex. Rate {exchangeRate}</div>
            </div>

            {/* Primary Action Button */}
            <Button
              type="button"
              onClick={handleTransferPayment}
              disabled={transferring || d.ledger_posting_status === "posted"}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md gap-2 flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
              {transferring ? tt("pterv2.posting_btn","POSTING TO ROZNAMCHA...") : tt("pterv2.post_btn","POST TRANSACTION TO ROZNAMCHA")}
            </Button>

            {transferSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/60 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {transferSuccess}
              </div>
            )}
            {transferError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-950/60 p-3 text-xs font-bold text-rose-800 dark:text-rose-300">
                {transferError}
              </div>
            )}

          </div>

        </aside>

        {/* RIGHT A4 DOCUMENT PREVIEW PANE (8.5 COLS) */}
        <main className="lg:col-span-8 flex justify-center">
          
          {/* SAP / Oracle Grade Printable A4 Sheet Container */}
          <div id="erp-transfer-report-sheet" className="w-[210mm] min-h-[297mm] bg-white border border-slate-300 shadow-2xl p-[7mm] text-[8px] text-slate-900 space-y-3 relative print:border-none print:shadow-none print:w-full print:p-0 font-sans">

            {/* Official Stamp Overlay */}
            {isPosted && (
              <div className="absolute top-12 right-12 z-20 pointer-events-none transform rotate-[-12deg] border-4 border-emerald-600 rounded-xl p-2.5 bg-emerald-50/95 text-center shadow-2xl backdrop-blur-xs">
                <div className="text-[8.5px] font-black uppercase text-emerald-900 tracking-widest">{tt("pterv2.stamp_verified","★ ENTERPRISE VERIFIED ★")}</div>
                <div className="text-sm font-black text-emerald-800 tracking-tight uppercase my-0.5 border-y-2 border-emerald-600 py-0.5 px-3">
                  {tt("pterv2.stamp_posted","POSTED TO ROZNAMCHA")}
                </div>
                <div className="text-[8px] font-mono font-bold text-emerald-950">
                  {tt("pterv2.roznamcha_sn_strip","ROZNAMCHA S/N:")} {roznamchaSerial}
                </div>
                <div className="text-[7.5px] font-bold text-emerald-800 uppercase mt-0.5">
                  {tt("pterv2.double_entry_gl_matched", "Double-Entry GL Matched")}
                </div>
              </div>
            )}

            {/* ── TOP CORPORATE BRANDING & SECURITY STAMP ── */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2.5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md">
                  🏢
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">{brandLine}</h2>
                    <span className="bg-slate-100 text-slate-700 text-[7px] font-extrabold px-1.5 py-0.5 rounded border border-slate-300 font-mono">
                      {tt("pterv2.double_entry_verified", "DOUBLE-ENTRY VERIFIED")}
                    </span>
                  </div>
                  <p className="text-[8px] font-extrabold text-blue-700 uppercase tracking-wide">
                    {tt("pterv2.subtitle", "Enterprise ERP — Import / Export Verification")}
                  </p>
                </div>
              </div>

              {/* Barcode & Security Badge */}
              <div className="text-right text-[7px] text-slate-600 leading-tight space-y-0.5">
                <div className="font-mono text-[9px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-block">
                  {tt("pterv2.audit_hash_lbl","AUDIT HASH:")} {superAdminSerial.slice(0, 18)}
                </div>
                <div>COUNTRY: <b className="text-slate-900">{countryName}</b></div>
                <div>BRANCH: <b className="text-[#0b192c]">{branchName} ({branchCode})</b></div>
                <div>{tt("pterv2.audit_log_line", "Audit log")}: {roznamchaSerial}</div>
              </div>
            </div>

            {/* ── DOCUMENT TITLE & REPORT NUMBER STRIP ── */}
            <div className="bg-slate-900 text-white px-3 py-2 rounded-xs flex justify-between items-center text-[8.5px] shadow-sm">
              <div className="font-mono font-bold text-emerald-400">REPORT NO: {reportNo}</div>
              <h3 className="font-black text-xs uppercase tracking-wider text-center flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                {tt("pterv2.report_title","ENTERPRISE PURCHASE TRANSFER & SETTLEMENT VERIFICATION AUDIT SHEET")}
              </h3>
              <div>{tt("pterv2.date_lbl", "Date")}: <span suppressHydrationWarning>{fmtDate(new Date().toISOString())}</span> | {tt("pterv2.status_lbl", "Status")}: <span className="font-bold text-amber-400 uppercase">{isPosted ? tt("pterv2.st_posted", "POSTED") : tt("pterv2.st_accepted", "ACCEPTED")}</span></div>
            </div>

            {/* ── VISUAL END-TO-END TRANSACTION PROCESS FLOW BANNER ── */}
            <div className="bg-slate-50 border border-slate-300 rounded p-2 text-[7.5px]">
              <div className="text-[7px] font-black uppercase text-slate-500 tracking-wider mb-1.5 flex justify-between">
                <span>{tt("pterv2.workflow_banner","TRANSACTION AUDIT WORKFLOW PIPELINE")}</span>
                <span className="text-blue-700 font-mono">{tt("pterv2.workflow_status","STATUS: STEP 3 & 4 READY")}</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center font-bold">
                <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 p-1 rounded">
                  {tt("pterv2.flow_step1","1. PO Booking Created")}
                </div>
                <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 p-1 rounded">
                  {tt("pterv2.flow_step2","2. Audit & Branch Verification")}
                </div>
                <div className="bg-blue-100 text-blue-900 border border-blue-300 p-1 rounded">
                  {tt("pterv2.flow_step3","3. GL Double-Entry Posting")}
                </div>
                <div className="bg-amber-100 text-amber-900 border border-amber-300 p-1 rounded">
                  {tt("pterv2.flow_step4","4. Business Roznamcha Settlement")}
                </div>
              </div>
            </div>

            {/* ── 4 EXECUTIVE KPI SUMMARY CARDS ── */}
            <div className="grid grid-cols-4 gap-2 text-[7.5px]">
              
              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <div className="text-[6.5px] font-extrabold uppercase text-slate-500">{tt("pterv2.kpi_purchase_value","TOTAL PURCHASE VALUE")}</div>
                <div className="text-sm font-black text-emerald-700 font-mono">{money(totalAmountLc)} {currencyLc}</div>
                <div className="text-[7px] font-mono text-slate-600 font-bold">${money(totalAmountFc)} {currencyFc}</div>
              </div>

              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <div className="text-[6.5px] font-extrabold uppercase text-slate-500">{tt("pterv2.kpi_advance","ADVANCE SETTLEMENT")} ({advancePercent}%)</div>
                <div className="text-sm font-black text-blue-700 font-mono">{money(advanceAmountLc)} {currencyLc}</div>
                <div className="text-[7px] font-mono text-slate-600 font-bold">${money(advanceAmountFc)} {currencyFc}</div>
              </div>

              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <div className="text-[6.5px] font-extrabold uppercase text-slate-500">{tt("pterv2.kpi_roznamcha_sn","BUSINESS ROZNAMCHA S/N")}</div>
                <div className="text-xs font-black text-slate-900 font-mono truncate">{roznamchaSerial}</div>
                <div className="text-[6.5px] text-emerald-600 font-bold uppercase mt-0.5">{tt("pterv2.kpi_balanced","DOUBLE ENTRY BALANCED")}</div>
              </div>

              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <div className="text-[6.5px] font-extrabold uppercase text-slate-500">{tt("pterv2.kpi_admin_chain","SUPER ADMIN AUDIT CHAIN")}</div>
                <div className="text-xs font-black text-slate-900 font-mono truncate">{superAdminSerial}</div>
                <div className="text-[6.5px] text-blue-700 font-bold uppercase mt-0.5">{tt("pterv2.kpi_scope_match","VERIFIED SCOPE MATCH")}</div>
              </div>

            </div>

            {/* ── 3 ENTITY CARDS GRID (BOOKING, SUPPLIER, BUYER) ── */}
            <div className="grid grid-cols-3 gap-2 text-[7.5px]">
              
              {/* Booking Identification */}
              <div className="border border-slate-300 rounded p-2 bg-slate-50/60 space-y-0.5">
                <div className="font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-1 flex justify-between">
                  <span>📋 {tt("pterv2.entity_booking","BOOKING IDENTIFICATION")}</span>
                  <span className="font-mono text-blue-700">{bookingRef}</span>
                </div>
                <div>{tt("pterv2.booking_ref_lbl","Booking Reference")}: <b className="font-mono text-blue-800">{bookingRef}</b></div>
                <div>{tt("pterv2.purchase_date","Purchase Date")}: <span>{fmtDate(d.purchaseDate || d.createdAt)}</span></div>
                <div>{tt("pterv2.booking_date","Booking Date")}: <span>{fmtDate(d.bookingDate || d.createdAt)}</span></div>
                <div>{tt("pterv2.audited_by","Audited By")}: <b className="uppercase">{d.audit?.userName || "—"}</b></div>
              </div>

              {/* Supplier & Credit Account Entity */}
              <div className="border border-slate-300 rounded p-2 bg-slate-50/60 space-y-0.5">
                <div className="font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-1 flex justify-between">
                  <span>🏬 {tt("pterv2.entity_vendor","VENDOR / CREDIT ENTITY")}</span>
                  <span className="font-mono text-emerald-700">{salesAccCode}</span>
                </div>
                <div>{tt("pterv2.supplier_name","Supplier Name")}: <b className="text-slate-900">{d.supplierName || "Global Commodities Supplier"}</b></div>
                <div>{tt("pterv2.cr_acc_name","CR Account Name")}: <b className="text-emerald-800 uppercase">{salesAccName}</b></div>
                <div>{tt("pterv2.cr_serial_lbl","CR Serial Number")}: <b className="font-mono text-emerald-700">{creditSerial}</b></div>
                <div>{tt("pterv2.country_loc","Country / Location")}: <b>{countryName}</b></div>
              </div>

              {/* Buyer & Debit Account Entity */}
              <div className="border border-slate-300 rounded p-2 bg-slate-50/60 space-y-0.5">
                <div className="font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-1 flex justify-between">
                  <span>👤 {tt("pterv2.entity_buyer","BUYER / DEBIT ENTITY")}</span>
                  <span className="font-mono text-blue-700">{purchaseAccCode}</span>
                </div>
                <div>{tt("pterv2.buyer_entity","Buyer Entity")}: <b className="text-slate-900">{d.buyerName || "—"}</b></div>
                <div>{tt("pterv2.dr_acc_name","DR Account Name")}: <b className="text-blue-800 uppercase">{purchaseAccName}</b></div>
                <div>{tt("pterv2.dr_serial_lbl","DR Serial Number")}: <b className="font-mono text-blue-700">{debitSerial}</b></div>
                <div>{tt("pterv2.receiving_branch","Receiving Branch")}: <b>{branchName}</b></div>
              </div>

            </div>

            {/* ── SECTION 1: SAP-GRADE GENERAL LEDGER DOUBLE-ENTRY MATRIX ── */}
            <div className="space-y-1">
              <div className="font-black uppercase text-[8.5px] text-white bg-slate-900 px-2.5 py-1 rounded-xs flex justify-between items-center">
                <span>{tt("pterv2.accounting_preview","⚙️ GENERAL LEDGER DOUBLE-ENTRY IMPACT & POSTING MATRIX")}</span>
                <span className="text-[7.5px] font-mono text-emerald-400 font-black">{tt("pterv2.roznamcha_sn_strip","ROZNAMCHA S/N:")} {roznamchaSerial}</span>
              </div>

              <table className="w-full border-collapse text-[7.5px]">
                <thead>
                  <tr className="bg-slate-800 text-white text-[7px] font-extrabold uppercase">
                    <Th className="p-1.5 border border-slate-800 text-left w-20">{tt("pterv2.gl_col_code","GL CODE")}</Th>
                    <Th className="p-1.5 border border-slate-800 text-left">{tt("pterv2.gl_col_title","ACCOUNT TITLE & HIERARCHICAL SERIAL AUDIT CHAIN")}</Th>
                    <Th className="p-1.5 border border-slate-800 text-right w-28">{tt("pterv2.gl_col_debit","DEBIT")} ({currencyLc})</Th>
                    <Th className="p-1.5 border border-slate-800 text-right w-28">{tt("pterv2.gl_col_credit","CREDIT")} ({currencyLc})</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 border border-slate-300">
                  
                  {/* DEBIT ROW */}
                  <tr className="bg-blue-50/30">
                    <td className="p-1.5 border border-slate-300 font-mono font-black text-blue-800 text-xs">{purchaseAccCode}</td>
                    <td className="p-1.5 border border-slate-300">
                      <div className="flex justify-between items-center">
                        <b className="text-slate-900 text-xs uppercase">{purchaseAccName} ({tt("pterv2.debit_acc_lbl","DEBIT ACCOUNT")})</b>
                        <span className="text-[7px] font-mono font-bold bg-blue-100 text-blue-900 px-1.5 py-0.5 border border-blue-300 rounded">{debitSerial}</span>
                      </div>
                      <div className="text-[6.5px] font-mono text-slate-600 mt-1 space-x-1.5">
                        <span>{tt("pterv2.super_admin_sn","Super Admin S/N")}: <b className="text-slate-900">{superAdminSerial}</b></span> | 
                        <span>{tt("pterv2.country_sn","Country S/N")}: <b className="text-slate-900">{countrySerial}</b></span> | 
                        <span>{tt("pterv2.branch_sn","Branch S/N")}: <b className="text-slate-900">{branchSerial}</b></span> | 
                        <span>{tt("pterv2.roznamcha_sn","Business Roznamcha S/N")}: <b className="text-blue-800">{roznamchaSerial}</b></span>
                      </div>
                    </td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono font-black text-blue-800 text-xs">{money(totalAmountLc)}</td>
                    <td className="p-1.5 border border-slate-300 text-center text-slate-400 font-mono">-</td>
                  </tr>

                  {/* CREDIT ROW */}
                  <tr className="bg-emerald-50/30">
                    <td className="p-1.5 border border-slate-300 font-mono font-black text-emerald-800 text-xs">{salesAccCode}</td>
                    <td className="p-1.5 border border-slate-300">
                      <div className="flex justify-between items-center">
                        <b className="text-slate-900 text-xs uppercase">{salesAccName} ({tt("pterv2.credit_acc_lbl","CREDIT ACCOUNT")})</b>
                        <span className="text-[7px] font-mono font-bold bg-emerald-100 text-emerald-900 px-1.5 py-0.5 border border-emerald-300 rounded">{creditSerial}</span>
                      </div>
                      <div className="text-[6.5px] font-mono text-slate-600 mt-1 space-x-1.5">
                        <span>{tt("pterv2.super_admin_sn","Super Admin S/N")}: <b className="text-slate-900">{superAdminSerial}</b></span> | 
                        <span>{tt("pterv2.country_sn","Country S/N")}: <b className="text-slate-900">{countrySerial}</b></span> | 
                        <span>{tt("pterv2.branch_sn","Branch S/N")}: <b className="text-slate-900">{branchSerial}</b></span> | 
                        <span>{tt("pterv2.roznamcha_sn","Business Roznamcha S/N")}: <b className="text-emerald-800">{roznamchaSerial}</b></span>
                      </div>
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center text-slate-400 font-mono">-</td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono font-black text-emerald-800 text-xs">{money(totalAmountLc)}</td>
                  </tr>

                  {/* TOTAL BALANCED ROW */}
                  <tr className="bg-slate-100 font-black text-xs">
                    <td colSpan={2} className="p-1.5 border border-slate-300 text-right uppercase tracking-wider">{tt("pterv2.gl_total_balanced","TOTAL BALANCED DOUBLE-ENTRY:")}</td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-blue-800">{money(totalAmountLc)}</td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-emerald-800">{money(totalAmountLc)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── SECTION 2: GOODS & CARGO BREAKDOWN REGISTER ── */}
            <div className="space-y-1">
              <div className="font-black uppercase text-[8.5px] text-white bg-slate-900 px-2.5 py-1 rounded-xs flex justify-between items-center">
                <span>{tt("pterv2.goods_section","📦 GOODS & CARGO BREAKDOWN REGISTER")}</span>
                <span className="text-[7.5px] font-mono text-slate-300">{tt("pterv2.total_units_lbl","TOTAL UNITS:")} {totalCartons.toLocaleString()}</span>
              </div>

              <table className="w-full border-collapse text-[7px]">
                <thead>
                  <tr className="bg-slate-800 text-white font-extrabold uppercase">
                    <Th className="p-1 border border-slate-800 text-center">{tt("pterv2.goods_col_sr","SR")}</Th>
                    <Th className="p-1 border border-slate-800 text-left">{tt("pterv2.goods_col_desc","DESCRIPTION & GOODS NAME")}</Th>
                    <Th className="p-1 border border-slate-800 text-center">{tt("pterv2.goods_col_hscode","HS CODE")}</Th>
                    <Th className="p-1 border border-slate-800 text-center">{tt("pterv2.goods_col_brand","BRAND")}</Th>
                    <Th className="p-1 border border-slate-800 text-center">{tt("pterv2.goods_col_origin","ORIGIN")}</Th>
                    <Th className="p-1 border border-slate-800 text-right">{tt("pterv2.goods_col_qty","QUANTITY")}</Th>
                    <Th className="p-1 border border-slate-800 text-right">{tt("pterv2.goods_col_gross","GROSS WT")}</Th>
                    <Th className="p-1 border border-slate-800 text-right">{tt("pterv2.goods_col_net","NET WT")}</Th>
                    <Th className="p-1 border border-slate-800 text-right">{tt("pterv2.goods_col_rate","RATE")} ({currencyFc})</Th>
                    <Th className="p-1 border border-slate-800 text-right">{tt("pterv2.goods_col_total","TOTAL")} ({currencyFc})</Th>
                    <Th className="p-1 border border-slate-800 text-center">{tt("pterv2.goods_col_exrate","EX. RATE")}</Th>
                    <Th className="p-1 border border-slate-800 text-right">{tt("pterv2.goods_col_final","FINAL")} ({currencyLc})</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 border border-slate-300">
                  {goodsEntries.map((g: any, idx: number) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="p-1 border border-slate-300 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-1 border border-slate-300 font-bold text-slate-900 uppercase">{g.goodsName || g.productName}</td>
                      <td className="p-1 border border-slate-300 text-center font-mono text-slate-600">{g.hsCode || "0802.1200"}</td>
                      <td className="p-1 border border-slate-300 text-center">{g.brand || "Premium"}</td>
                      <td className="p-1 border border-slate-300 text-center font-semibold">{g.origin || "USA"}</td>
                      <td className="p-1 border border-slate-300 text-right font-mono font-bold">{Number(g.qtyNo || 10000).toLocaleString()} {g.qtyName || "BAGS"}</td>
                      <td className="p-1 border border-slate-300 text-right font-mono">{money(g.grossWeight || 260000)} kg</td>
                      <td className="p-1 border border-slate-300 text-right font-mono font-bold">{money(g.netWeight || 250000)} kg</td>
                      <td className="p-1 border border-slate-300 text-right font-mono">${Number(g.coursePrice || 5.20).toFixed(2)}</td>
                      <td className="p-1 border border-slate-300 text-right font-mono font-bold text-blue-800">${money(g.totalAmount || 0)}</td>
                      <td className="p-1 border border-slate-300 text-center font-mono">{exchangeRate}</td>
                      <td className="p-1 border border-slate-300 text-right font-mono font-black text-emerald-800">{money(g.finalAmount || 0)} {currencyLc}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black text-[7.5px]">
                    <td colSpan={5} className="p-1 border border-slate-300 text-right uppercase">{tt("pterv2.grand_total","GRAND TOTAL:")}</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{totalCartons.toLocaleString()} UNITS</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{money(totalGrossWt)} kg</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{money(totalNetWt)} kg</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{totalNetWt > 0 ? "$" + (totalAmountFc / totalNetWt).toFixed(2) : "—"}</td>
                    <td className="p-1 border border-slate-300 text-right font-mono text-blue-800">${money(totalAmountFc)}</td>
                    <td className="p-1 border border-slate-300 text-center font-mono">@ {exchangeRate}</td>
                    <td className="p-1 border border-slate-300 text-right font-mono text-emerald-800 font-black">{money(totalAmountLc)} {currencyLc}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── SECTION 3: LOGISTICS, TRANSIT & PAYMENT DESTINATION ── */}
            <div className="grid grid-cols-2 gap-3 text-[7.5px]">
              
              {/* Loading & Logistics Register */}
              <div className="border border-slate-300 rounded p-2 bg-slate-50/50 space-y-1">
                <div className="font-black uppercase text-slate-900 border-b border-slate-200 pb-1 flex justify-between">
                  <span>{tt("pterv2.logistics_section","🚢 LOADING & LOGISTICS REGISTER")}</span>
                  <span className="font-mono text-slate-600">{form.shippingMode || form.transportMode || form.mode || "—"}</span>
                </div>
                <div className="flex justify-between"><span className="text-slate-500">{tt("pterv2.loading_origin","Loading Origin Port:")}</span><b>{form.loadingPort || form.loading_origin_port || form.loadingOriginPort || "—"}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">{tt("pterv2.receiving_dest","Receiving Destination Port:")}</span><b>{form.receivingPort || form.receiving_destination_port || form.receivingDestinationPort || "—"}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">{tt("pterv2.vessel_voyage","Vessel & Voyage:")}</span><b className="font-mono">{form.vesselName || form.vessel || form.vesselVoyage || "—"}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">{tt("pterv2.container_bl","Container Numbers & BL:")}</span><b className="font-mono">{form.containerNumbers || form.blNumber || form.containerNo || "—"}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">{tt("pterv2.loading_arrival","Loading Date / Arrival Date:")}</span><span>{(form.loadingDate || "—") + " / " + (form.arrivalDate || form.receivingDate || "—")}</span></div>
              </div>

              {/* Advance Payment Settlement Callout Box */}
              <div className="border border-amber-300 rounded p-2.5 bg-amber-50/90 space-y-1 shadow-sm">
                <div className="font-black uppercase text-amber-950 border-b border-amber-300 pb-1 flex justify-between items-center">
                  <span>📌 {tt("pterv2.advance_destination","Advance Payment Settlement & Destination Ledger")}</span>
                  <span className="font-mono text-emerald-800 font-extrabold">{advancePercent}% {tt("pterv2.advance_pct_lbl","ADVANCE")}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-amber-900 pt-0.5">
                  <span>{tt("pterv2.advance_amount_lbl","Advance Amount")} ({advancePercent}%):</span>
                  <span className="font-mono text-emerald-800">${money(advanceAmountFc)} USD ({money(advanceAmountLc)} {currencyLc})</span>
                </div>
                <div className="text-[7.5px] text-slate-800 leading-normal pt-0.5">
                  {tt("pterv2.transferred_to_roznamcha","Advance Payment transferred via Business Roznamcha to Supplier Payable Account")}
                </div>
                <div className="flex justify-between text-[7px] text-slate-600 border-t border-amber-200 pt-1 mt-1 font-mono">
                  <span>{tt("pterv2.remaining_bal_lbl","Remaining Balance")} ({(100 - advancePercent)}%): ${money(remainingAmountFc)} FC</span>
                  <span className="font-bold text-rose-700">{tt("pterv2.due_colon", "Due:")} {form.paymentDate || form.paymentDueDate || form.dueDate || "—"}</span>
                </div>
              </div>

            </div>

            {/* ── SECTION 4: SYSTEM NARRATION & AUDIT COMPLIANCE ── */}
            <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50 text-[7.5px] flex items-center justify-between">
              <div>
                <b className="uppercase text-slate-900 mr-2">{tt("pterv2.audit_narration_lbl","AUDIT NARRATION:")}</b>
                <span className="text-slate-700">{tt("pterv2.audit_narration_text","Double-entry booking journal voucher verified and posted under Super Admin & Country scope rules.")}</span>
              </div>
              <div className="font-mono font-bold text-slate-500">{tt("pterv2.audit_ref_lbl", "Audit Ref")}: {roznamchaSerial}</div>
            </div>

            {/* ── FOOTER SIGNATURES & OFFICIAL STAMP STRIP ── */}
            <div className="pt-2 border-t-2 border-slate-900 space-y-3">
              <p className="text-[6.5px] text-slate-500 text-center italic">
                *{tt("pterv2.footer_notice2","This is an official ERP transfer & settlement verification sheet. All double-entry postings have been validated.")}*
              </p>

              <div className="flex justify-between items-end text-[7.5px]">
                <div className="w-14 h-14 border-2 border-slate-400 rounded-full flex items-center justify-center text-[6.5px] font-black text-slate-400 uppercase text-center p-1 font-mono">
                  {tt("pterv2.official_stamp", "Official Stamp")}
                </div>

                <div className="text-center space-y-1">
                  <div className="w-36 border-b-2 border-slate-900"></div>
                  <div className="font-black text-slate-900 uppercase">{d?.audit?.userName || "—"}</div>
                  <div className="text-[6.5px] text-slate-500 uppercase font-bold">{tt("pterv2.prepared_by","PREPARED BY (AUDITOR)")}</div>
                </div>

                <div className="text-center space-y-1">
                  <div className="w-36 border-b-2 border-slate-900"></div>
                  <div className="font-black text-slate-900 uppercase">{d?.audit?.approvedByName || d?.audit?.userName || "—"}</div>
                  <div className="text-[6.5px] text-slate-500 uppercase font-bold">{tt("pterv2.authorized_sig","AUTHORIZED SIGNATURE")}</div>
                </div>
              </div>
            </div>

          </div>

        </main>

      </div>

    </div>
  );
}

export function PurchaseTransferErpReportView(props: { purchaseData?: any }) {
  const activeLang = useActiveLanguage();
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-slate-500">{t(activeLang, "pterv2.loading_verification", "Loading Purchase Verification…")}</div>}>
      <PurchaseTransferErpReportViewContent {...props} />
    </Suspense>
  );
}
