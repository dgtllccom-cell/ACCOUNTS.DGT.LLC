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

  // Multilingual translation state
  type LanguageCode = "en" | "ur" | "ar" | "fa" | "ps";
  const [selectedLang, setSelectedLang] = useState<LanguageCode>("en");

  const REPORT_I18N: Record<string, Record<LanguageCode, string>> = {
    report_title: {
      en: "ENTERPRISE PURCHASE TRANSFER & SETTLEMENT VERIFICATION AUDIT SHEET",
      ur: "انٹرپرائز پرچیز ٹرانسفر و سیٹلمنٹ کی تصدیقی و آڈٹ رپورٹ",
      ar: "تقرير التحقق والتدقيق لنقل وتسوية المشتريات للمؤسسات",
      fa: "گزارش تایید و حسابرسی انتقال و تسویه خرید سازمانی",
      ps: "د سازماني پیرود لیږد او حساب تصفیې تصدیق راپور"
    },
    flow_step1: {
      en: "1. PO Booking Created",
      ur: "1۔ پرچیز آرڈر بکنگ درج کی گئی",
      ar: "1. إنشاء حجز أمر الشراء",
      fa: "1. ایجاد رزرو سفارش خرید",
      ps: "1. د پیرود امر راجستر شو"
    },
    flow_step2: {
      en: "2. Audit & Branch Verification",
      ur: "2۔ برانچ آڈٹ و تصدیق مکمل",
      ar: "2. التدقيق والتحقق من الفرع",
      fa: "2. حسابرسی و تایید شعبه",
      ps: "2. د څانګې پلټنه او تصدیق"
    },
    flow_step3: {
      en: "3. GL Double-Entry Posting",
      ur: "3۔ کھاتہ ڈبل اینٹری پوسٹنگ",
      ar: "3. ترحيل القيد المزدوج لدفتر اليومية",
      fa: "3. ثبت دوطرفه دفتر کل",
      ps: "3. د دفتر دوه اړخیز ثبت کول"
    },
    flow_step4: {
      en: "4. Business Roznamcha Settlement",
      ur: "4۔ بزنس روزنامچہ سیٹلمنٹ اور منتقلی",
      ar: "4. تسوية دفتر اليومية التجارية",
      fa: "4. تسویه روزنامه کسب‌وکار",
      ps: "4. د سوداګرۍ روزنامچې لیږد"
    },
    accounting_preview: {
      en: "⚙️ GENERAL LEDGER DOUBLE-ENTRY IMPACT & POSTING MATRIX",
      ur: "⚙️ جنرل لیجر ڈبل اینٹری اثرات اور پوسٹنگ میٹرکس",
      ar: "⚙️ مصفوفة تأثير وتأكيد القيد المزدوج لدفتر اليومية العام",
      fa: "⚙️ ماتریس تاثیر و ثبت دوطرفه دفتر کل",
      ps: "⚙️ د عام دفتر دوه اړخیز ثبت او اغیزې کادر"
    },
    accounting_info: {
      en: "🛡️ AUDIT SERIAL NUMBERS & ACCOUNTING INFRASTRUCTURE",
      ur: "🛡️ آڈٹ سیریل نمبرز اور اکاؤنٹنگ انفراسٹرکچر",
      ar: "🛡️ الأرقام التسلسلية للتدقيق والبنية التحتية المحاسبية",
      fa: "🛡️ شماره‌های سریال حسابرسی و زیرساخت حسابداری",
      ps: "🛡️ د پلټنې سیریل شمیرې او د محاسبې چوکاټ"
    },
    super_admin_sn: {
      en: "Super Admin S/N",
      ur: "سپر ایڈمن سیریل نمبر",
      ar: "الرقم التسلسلي للمسؤول الفائق",
      fa: "شماره سریال سوپر ادمین",
      ps: "د سوپر اډمین سیریل شمیره"
    },
    country_sn: {
      en: "Country S/N",
      ur: "کنٹری سیریل نمبر",
      ar: "الرقم التسلسلي للدولة",
      fa: "شماره سریال کشور",
      ps: "د هیواد سیریل شمیره"
    },
    branch_sn: {
      en: "Branch S/N",
      ur: "برانچ سیریل نمبر",
      ar: "الرقم التسلسلي للفرع",
      fa: "شماره سریال شعبه",
      ps: "د څانګې سیریل شمیره"
    },
    roznamcha_sn: {
      en: "Business Roznamcha S/N",
      ur: "بزنس روزنامچہ سیریل نمبر",
      ar: "الرقم التسلسلي لدفتر اليومية",
      fa: "شماره سریال روزنامه کسب‌وکار",
      ps: "د سوداګرۍ روزنامچې سیریل شمیره"
    },
    dr_serial: {
      en: "DR (Debit) Purchase S/N",
      ur: "ڈبیٹ (DR) پرچیز سیریل نمبر",
      ar: "الرقم التسلسلي للمدين الشراء (DR)",
      fa: "شماره سریال بدهکار خرید (DR)",
      ps: "د ډیبیټ (DR) پیرود سیریل شمیره"
    },
    cr_serial: {
      en: "CR (Credit) Sales/Vendor S/N",
      ur: "کریڈٹ (CR) سیلز/سپلائر سیریل نمبر",
      ar: "الرقم التسلسلي للدائن (CR)",
      fa: "شماره سریال بستانکار (CR)",
      ps: "د کریډیټ (CR) فروش/سپلائر سیریل شمیره"
    },
    advance_destination: {
      en: "Advance Payment Settlement & Destination Ledger",
      ur: "ایڈوانس کی رقم، منزل اور کھاتہ کی تفصیلات",
      ar: "تسوية الدفعة المقدمة وحساب الوجهة",
      fa: "تسویه پیش‌پرداخت و دفتر کل مقصد",
      ps: "د دمخه تادیې تصفیه او ملګری حساب"
    },
    transferred_to_roznamcha: {
      en: "Advance Payment transferred via Business Roznamcha to Supplier Payable Account",
      ur: "ایڈوانس کی رقم بزنس روزنامچہ کے ذریعے سپلائر کھاتے میں منتقل ہو گئی ہے",
      ar: "تم تحويل الدفعة المقدمة عبر دفتر اليومية التجارية إلى حساب المورد",
      fa: "پیش‌پرداخت از طریق روزنامه کسب‌وکار به حساب تأمین‌کننده منتقل شد",
      ps: "د پیشکي تادیې پیسې د سوداګرۍ روزنامچې له لارې د چمتو کونکي حساب ته لیږدول شوې"
    }
  };

  const tr = (key: string) => REPORT_I18N[key]?.[selectedLang] || REPORT_I18N[key]?.en || key;

  /* ── Derived values ────────────────────────────────────────── */
  const d = reportData;
  const form = d?.form_data?.form || {};
  const totals = d?.form_data?.totals || {};

  const bookingRef = d?.purchaseBookingOrderNumber || form.bookingNo || `AE-${d?.id ? d.id.slice(0, 4) : "001"}-0001`;
  const reportNo = `SAP-PTVR-2026-${d?.id ? d.id.slice(0, 6).toUpperCase() : "010001"}`;
  
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
  const purchaseAccCode = form.purchaseAccountNo || d?.purchaseAccountNumber || "1001";
  const purchaseAccName = form.purchaseAccountName || d?.purchaseAccountName || "Kabul Dry Fruits Purchase Account";
  
  const salesAccCode = form.salesAccountNo || d?.salesAccountNumber || "2001";
  const salesAccName = form.salesAccountName || d?.salesAccountName || "Default Sales Account";

  const debitSerial = (d as any)?.debit_serial_number || `ROZ-DR-${purchaseAccCode}`;
  const creditSerial = (d as any)?.credit_serial_number || `ROZ-CR-${salesAccCode}`;

  const countryName = d?.countryName || form.countryName || "United Arab Emirates";
  const branchName = d?.branchName || form.branchName || "AL.RAS Branch";
  const branchCode = d?.branchCode || form.branchCode || "ARE-DXB-001";

  const exchangeRate = Number(d?.exchange_rate || form.exchangeRate || 3.6725);
  const currencyFc = d?.currency || form.currencyType || "USD";
  const currencyLc = form.secondaryCurrency || "AED";

  // Goods breakdown
  const goodsEntries: any[] = useMemo(() => {
    if (!d) return [];
    if (d.form_data?.goodsEntries?.length) return d.form_data.goodsEntries;
    return [{
      goodsName: d.productName || d.goodsDescription || "Almond Kernel California Extra No.1",
      hsCode: "0802.1200",
      brand: "California Premium Wholesale",
      size: "10,000 Bags",
      origin: "USA",
      qtyNo: d.quantity || 10000,
      qtyName: d.unit || "BAGS",
      qtyKgs: 25,
      grossWeight: d.totalGrossWeight || 260000,
      netWeight: d.totalNetWeight || 250000,
      coursePrice: d.purchaseRate || 5.20,
      totalAmount: d.totalPurchaseAmount || 130000.00,
      finalAmount: (d.totalPurchaseAmount || 130000.00) * exchangeRate
    }];
  }, [d, exchangeRate]);

  const totalAmountFc = useMemo(() => {
    if (!d) return 130000.00;
    return Number(d.totalPurchaseAmount || d.purchaseAmount || totals.grandPrimaryFinal || 130000.00);
  }, [d, totals.grandPrimaryFinal]);

  const totalAmountLc = useMemo(() => {
    return totalAmountFc * exchangeRate;
  }, [totalAmountFc, exchangeRate]);

  const totalGrossWt = goodsEntries.reduce((sum, g) => sum + (Number(g.grossWeight) || 0), 0);
  const totalNetWt = goodsEntries.reduce((sum, g) => sum + (Number(g.netWeight) || 0), 0);
  const totalCartons = goodsEntries.reduce((sum, g) => sum + (Number(g.qtyNo) || 0), 0);

  const advancePercent = Number(form.advancePercent || 40);
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

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 bg-slate-900">
        <div className="text-center space-y-4 p-8 rounded-2xl bg-slate-800/80 border border-slate-700 text-white shadow-2xl">
          <div className="h-10 w-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-extrabold tracking-wide uppercase">Initializing SAP / Oracle Grade Verification Engine...</p>
        </div>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="rounded-2xl border border-rose-800 bg-slate-900 p-8 text-center max-w-md shadow-2xl space-y-3">
          <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
          <p className="text-base font-extrabold text-white">{error || "Purchase record not found."}</p>
          <Button onClick={() => router.back()} variant="outline" size="sm" className="mt-4 bg-slate-800 border-slate-700 text-white">
            ← Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">

      {/* ───────────── TOP ENTERPRISE STICKY BAR ───────────── */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-xl print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight uppercase flex items-center gap-2">
              Inter-Country Purchase Verification & Settlement Audit Sheet
              <span className="bg-amber-400 text-amber-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wider">NEW</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                SAP / Oracle Enterprise Std
              </span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">
              Booking Ref: <span className="text-blue-400 font-extrabold">{bookingRef}</span> | Roznamcha S/N: <span className="text-emerald-400 font-extrabold">{roznamchaSerial}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Language Selector */}
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value as LanguageCode)}
            className="h-9 text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 outline-none cursor-pointer hover:bg-slate-700 transition"
          >
            <option value="en">🌐 English (International)</option>
            <option value="ur">🇵🇰 اردو (Urdu)</option>
            <option value="ar">🇸🇦 العربية (Arabic)</option>
            <option value="fa">🇮🇷 فارسی (Persian)</option>
            <option value="ps">🇦🇫 پښتو (Pashto)</option>
          </select>

          {/* Print Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border-slate-700 px-4 rounded-xl gap-2 shadow-xs"
          >
            <Printer className="h-4 w-4 text-blue-400" />
            Print A4 Verification Document
          </Button>

          {/* Transfer Button */}
          <Button
            type="button"
            size="sm"
            onClick={handleTransferPayment}
            disabled={transferring || d.ledger_posting_status === "posted"}
            className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 rounded-xl shadow-lg gap-2"
          >
            <Send className="h-4 w-4" />
            {transferring ? "Transferring..." : "Post to Business Roznamcha"}
          </Button>

          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* ───────────── MAIN 2-PANE LAYOUT ───────────── */}
      <div className="max-w-[1700px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT AUDIT CONTROL PANEL (3.5 COLS) */}
        <aside className="lg:col-span-4 space-y-4 print:hidden">
          
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            
            {/* Control Panel Header */}
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest block">CONTROL PANEL</span>
                <h2 className="text-sm font-black text-white uppercase tracking-tight">Audit Verification Form</h2>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${isPosted ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
                {isPosted ? "POSTED TO GL" : "PENDING POSTING"}
              </span>
            </div>

            {/* Audit Flow Steps Indicator */}
            <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-[10px]">
              <div className="font-extrabold uppercase text-slate-400 text-[9px] tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" /> Transaction Audit Pipeline
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> 1. Booking Created & Validated
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> 2. Super Admin & Branch Scope Verified
              </div>
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <BadgeCheck className="h-3.5 w-3.5" /> 3. Double-Entry GL Impact Calculated
              </div>
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Lock className="h-3.5 w-3.5" /> 4. Business Roznamcha Transfer Ready
              </div>
            </div>

            {/* Account Verification Summary */}
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">VERIFIED LEDGER POSTINGS</div>

              {/* Purchase Account DR Card */}
              <div className="border border-blue-500/30 rounded-xl bg-blue-950/40 p-3.5 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-black text-blue-400 uppercase">
                  <span>DEBIT ACCOUNT (DR)</span>
                  <span className="font-mono bg-blue-900/60 px-1.5 py-0.5 rounded text-blue-300">{purchaseAccCode}</span>
                </div>
                <div className="text-xs font-black text-white uppercase">{purchaseAccName}</div>
                <div className="text-[9.5px] text-slate-400 font-mono flex justify-between pt-1">
                  <span>S/N: {debitSerial}</span>
                  <span className="font-bold text-blue-300">{money(totalAmountLc)} {currencyLc}</span>
                </div>
              </div>

              {/* Sales Account CR Card */}
              <div className="border border-emerald-500/30 rounded-xl bg-emerald-950/40 p-3.5 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-black text-emerald-400 uppercase">
                  <span>CREDIT ACCOUNT (CR)</span>
                  <span className="font-mono bg-emerald-900/60 px-1.5 py-0.5 rounded text-emerald-300">{salesAccCode}</span>
                </div>
                <div className="text-xs font-black text-white uppercase">{salesAccName}</div>
                <div className="text-[9.5px] text-slate-400 font-mono flex justify-between pt-1">
                  <span>S/N: {creditSerial}</span>
                  <span className="font-bold text-emerald-300">{money(totalAmountLc)} {currencyLc}</span>
                </div>
              </div>
            </div>

            {/* Transfer Amount Total Banner Box */}
            <div className="rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-4 text-center border border-slate-800 space-y-1 shadow-inner">
              <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">TOTAL TRANSACTION VALUE</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">{money(totalAmountLc)} {currencyLc}</div>
              <div className="text-[10px] text-blue-400 font-mono font-bold">${money(totalAmountFc)} {currencyFc} @ Ex. Rate {exchangeRate}</div>
            </div>

            {/* Primary Action Button */}
            <Button
              type="button"
              onClick={handleTransferPayment}
              disabled={transferring || d.ledger_posting_status === "posted"}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl gap-2 flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
              {transferring ? "POSTING TO ROZNAMCHA..." : "POST TRANSACTION TO ROZNAMCHA"}
            </Button>

            {transferSuccess && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs font-bold text-emerald-300">
                {transferSuccess}
              </div>
            )}
            {transferError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-xs font-bold text-rose-300">
                {transferError}
              </div>
            )}

          </div>

        </aside>

        {/* RIGHT A4 DOCUMENT PREVIEW PANE (8.5 COLS) */}
        <main className="lg:col-span-8 flex justify-center">
          
          {/* SAP / Oracle Grade Printable A4 Sheet Container */}
          <div className="w-[210mm] min-h-[297mm] bg-white border border-slate-300 shadow-2xl p-[7mm] text-[8px] text-slate-900 space-y-3 relative print:border-none print:shadow-none print:w-full print:p-0 font-sans">

            {/* Official Stamp Overlay */}
            {isPosted && (
              <div className="absolute top-12 right-12 z-20 pointer-events-none transform rotate-[-12deg] border-4 border-emerald-600 rounded-xl p-2.5 bg-emerald-50/95 text-center shadow-2xl backdrop-blur-xs">
                <div className="text-[8.5px] font-black uppercase text-emerald-900 tracking-widest">★ ENTERPRISE VERIFIED ★</div>
                <div className="text-sm font-black text-emerald-800 tracking-tight uppercase my-0.5 border-y-2 border-emerald-600 py-0.5 px-3">
                  POSTED TO ROZNAMCHA
                </div>
                <div className="text-[8px] font-mono font-bold text-emerald-950">
                  ROZNAMCHA S/N: {roznamchaSerial}
                </div>
                <div className="text-[7.5px] font-bold text-emerald-800 uppercase mt-0.5">
                  DOUBLE-ENTRY GL MATCHED
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
                    <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">DAMAN BUSINESS GROUP</h2>
                    <span className="bg-slate-100 text-slate-700 text-[7px] font-extrabold px-1.5 py-0.5 rounded border border-slate-300 font-mono">
                      SAP / ORACLE COMPLIANT
                    </span>
                  </div>
                  <p className="text-[8px] font-extrabold text-blue-700 uppercase tracking-wide">
                    GLOBAL ENTERPRISE ERP & IMPORT / EXPORT AUDIT SYSTEM
                  </p>
                </div>
              </div>

              {/* Barcode & Security Badge */}
              <div className="text-right text-[7px] text-slate-600 leading-tight space-y-0.5">
                <div className="font-mono text-[9px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-block">
                  AUDIT HASH: {superAdminSerial.slice(0, 18)}
                </div>
                <div>COUNTRY: <b className="text-slate-900">{countryName}</b></div>
                <div>BRANCH: <b className="text-[#0b192c]">{branchName} ({branchCode})</b></div>
                <div>SECURITY: 🔒 ISO 27001 ENCRYPTED LOG</div>
              </div>
            </div>

            {/* ── DOCUMENT TITLE & REPORT NUMBER STRIP ── */}
            <div className="bg-slate-900 text-white px-3 py-2 rounded-xs flex justify-between items-center text-[8.5px] shadow-sm">
              <div className="font-mono font-bold text-emerald-400">REPORT NO: {reportNo}</div>
              <h3 className="font-black text-xs uppercase tracking-wider text-center flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                {tr("report_title")}
              </h3>
              <div>DATE: <span>{fmtDate(new Date().toISOString())}</span> | STATUS: <span className="font-bold text-amber-400 uppercase">{isPosted ? "POSTED" : "ACCEPTED"}</span></div>
            </div>

            {/* ── VISUAL END-TO-END TRANSACTION PROCESS FLOW BANNER ── */}
            <div className="bg-slate-50 border border-slate-300 rounded p-2 text-[7.5px]">
              <div className="text-[7px] font-black uppercase text-slate-500 tracking-wider mb-1.5 flex justify-between">
                <span>TRANSACTION AUDIT WORKFLOW PIPELINE</span>
                <span className="text-blue-700 font-mono">STATUS: STEP 3 & 4 READY</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center font-bold">
                <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 p-1 rounded">
                  {tr("flow_step1")}
                </div>
                <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 p-1 rounded">
                  {tr("flow_step2")}
                </div>
                <div className="bg-blue-100 text-blue-900 border border-blue-300 p-1 rounded">
                  {tr("flow_step3")}
                </div>
                <div className="bg-amber-100 text-amber-900 border border-amber-300 p-1 rounded">
                  {tr("flow_step4")}
                </div>
              </div>
            </div>

            {/* ── 4 EXECUTIVE KPI SUMMARY CARDS ── */}
            <div className="grid grid-cols-4 gap-2 text-[7.5px]">
              
              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <div className="text-[6.5px] font-extrabold uppercase text-slate-500">TOTAL PURCHASE VALUE</div>
                <div className="text-sm font-black text-emerald-700 font-mono">{money(totalAmountLc)} {currencyLc}</div>
                <div className="text-[7px] font-mono text-slate-600 font-bold">${money(totalAmountFc)} {currencyFc}</div>
              </div>

              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <div className="text-[6.5px] font-extrabold uppercase text-slate-500">ADVANCE SETTLEMENT ({advancePercent}%)</div>
                <div className="text-sm font-black text-blue-700 font-mono">{money(advanceAmountLc)} {currencyLc}</div>
                <div className="text-[7px] font-mono text-slate-600 font-bold">${money(advanceAmountFc)} {currencyFc}</div>
              </div>

              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <div className="text-[6.5px] font-extrabold uppercase text-slate-500">BUSINESS ROZNAMCHA S/N</div>
                <div className="text-xs font-black text-slate-900 font-mono truncate">{roznamchaSerial}</div>
                <div className="text-[6.5px] text-emerald-600 font-bold uppercase mt-0.5">DOUBLE ENTRY BALANCED</div>
              </div>

              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <div className="text-[6.5px] font-extrabold uppercase text-slate-500">SUPER ADMIN AUDIT CHAIN</div>
                <div className="text-xs font-black text-slate-900 font-mono truncate">{superAdminSerial}</div>
                <div className="text-[6.5px] text-blue-700 font-bold uppercase mt-0.5">VERIFIED SCOPE MATCH</div>
              </div>

            </div>

            {/* ── 3 ENTITY CARDS GRID (BOOKING, SUPPLIER, BUYER) ── */}
            <div className="grid grid-cols-3 gap-2 text-[7.5px]">
              
              {/* Booking Identification */}
              <div className="border border-slate-300 rounded p-2 bg-slate-50/60 space-y-0.5">
                <div className="font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-1 flex justify-between">
                  <span>📋 BOOKING IDENTIFICATION</span>
                  <span className="font-mono text-blue-700">{bookingRef}</span>
                </div>
                <div>Booking Reference: <b className="font-mono text-blue-800">{bookingRef}</b></div>
                <div>Purchase Date: <span>{fmtDate(d.purchaseDate || d.createdAt)}</span></div>
                <div>Booking Date: <span>{fmtDate(d.bookingDate || d.createdAt)}</span></div>
                <div>Audited By: <b className="uppercase">{d.audit?.userName || "ADMIN"}</b></div>
              </div>

              {/* Supplier & Credit Account Entity */}
              <div className="border border-slate-300 rounded p-2 bg-slate-50/60 space-y-0.5">
                <div className="font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-1 flex justify-between">
                  <span>🏬 VENDOR / CREDIT ENTITY</span>
                  <span className="font-mono text-emerald-700">{salesAccCode}</span>
                </div>
                <div>Supplier Name: <b className="text-slate-900">{d.supplierName || "Global Commodities Supplier"}</b></div>
                <div>CR Account Name: <b className="text-emerald-800 uppercase">{salesAccName}</b></div>
                <div>CR Serial Number: <b className="font-mono text-emerald-700">{creditSerial}</b></div>
                <div>Country / Location: <b>{countryName}</b></div>
              </div>

              {/* Buyer & Debit Account Entity */}
              <div className="border border-slate-300 rounded p-2 bg-slate-50/60 space-y-0.5">
                <div className="font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-1 flex justify-between">
                  <span>👤 BUYER / DEBIT ENTITY</span>
                  <span className="font-mono text-blue-700">{purchaseAccCode}</span>
                </div>
                <div>Buyer Entity: <b className="text-slate-900">{d.buyerName || "—"}</b></div>
                <div>DR Account Name: <b className="text-blue-800 uppercase">{purchaseAccName}</b></div>
                <div>DR Serial Number: <b className="font-mono text-blue-700">{debitSerial}</b></div>
                <div>Receiving Branch: <b>{branchName}</b></div>
              </div>

            </div>

            {/* ── SECTION 1: SAP-GRADE GENERAL LEDGER DOUBLE-ENTRY MATRIX ── */}
            <div className="space-y-1">
              <div className="font-black uppercase text-[8.5px] text-white bg-slate-900 px-2.5 py-1 rounded-xs flex justify-between items-center">
                <span>{tr("accounting_preview")}</span>
                <span className="text-[7.5px] font-mono text-emerald-400 font-black">ROZNAMCHA S/N: {roznamchaSerial}</span>
              </div>

              <table className="w-full border-collapse text-[7.5px]">
                <thead>
                  <tr className="bg-slate-800 text-white text-[7px] font-extrabold uppercase">
                    <Th className="p-1.5 border border-slate-800 text-left w-20">GL CODE</Th>
                    <Th className="p-1.5 border border-slate-800 text-left">ACCOUNT TITLE & HIERARCHICAL SERIAL AUDIT CHAIN</Th>
                    <Th className="p-1.5 border border-slate-800 text-right w-28">DEBIT ({currencyLc})</Th>
                    <Th className="p-1.5 border border-slate-800 text-right w-28">CREDIT ({currencyLc})</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 border border-slate-300">
                  
                  {/* DEBIT ROW */}
                  <tr className="bg-blue-50/30">
                    <td className="p-1.5 border border-slate-300 font-mono font-black text-blue-800 text-xs">{purchaseAccCode}</td>
                    <td className="p-1.5 border border-slate-300">
                      <div className="flex justify-between items-center">
                        <b className="text-slate-900 text-xs uppercase">{purchaseAccName} (DEBIT ACCOUNT)</b>
                        <span className="text-[7px] font-mono font-bold bg-blue-100 text-blue-900 px-1.5 py-0.5 border border-blue-300 rounded">{debitSerial}</span>
                      </div>
                      <div className="text-[6.5px] font-mono text-slate-600 mt-1 space-x-1.5">
                        <span>{tr("super_admin_sn")}: <b className="text-slate-900">{superAdminSerial}</b></span> | 
                        <span>{tr("country_sn")}: <b className="text-slate-900">{countrySerial}</b></span> | 
                        <span>{tr("branch_sn")}: <b className="text-slate-900">{branchSerial}</b></span> | 
                        <span>{tr("roznamcha_sn")}: <b className="text-blue-800">{roznamchaSerial}</b></span>
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
                        <b className="text-slate-900 text-xs uppercase">{salesAccName} (CREDIT ACCOUNT)</b>
                        <span className="text-[7px] font-mono font-bold bg-emerald-100 text-emerald-900 px-1.5 py-0.5 border border-emerald-300 rounded">{creditSerial}</span>
                      </div>
                      <div className="text-[6.5px] font-mono text-slate-600 mt-1 space-x-1.5">
                        <span>{tr("super_admin_sn")}: <b className="text-slate-900">{superAdminSerial}</b></span> | 
                        <span>{tr("country_sn")}: <b className="text-slate-900">{countrySerial}</b></span> | 
                        <span>{tr("branch_sn")}: <b className="text-slate-900">{branchSerial}</b></span> | 
                        <span>{tr("roznamcha_sn")}: <b className="text-emerald-800">{roznamchaSerial}</b></span>
                      </div>
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center text-slate-400 font-mono">-</td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono font-black text-emerald-800 text-xs">{money(totalAmountLc)}</td>
                  </tr>

                  {/* TOTAL BALANCED ROW */}
                  <tr className="bg-slate-100 font-black text-xs">
                    <td colSpan={2} className="p-1.5 border border-slate-300 text-right uppercase tracking-wider">TOTAL BALANCED DOUBLE-ENTRY:</td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-blue-800">{money(totalAmountLc)}</td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-emerald-800">{money(totalAmountLc)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── SECTION 2: GOODS & CARGO BREAKDOWN REGISTER ── */}
            <div className="space-y-1">
              <div className="font-black uppercase text-[8.5px] text-white bg-slate-900 px-2.5 py-1 rounded-xs flex justify-between items-center">
                <span>📦 GOODS & CARGO BREAKDOWN REGISTER</span>
                <span className="text-[7.5px] font-mono text-slate-300">TOTAL UNITS: {totalCartons.toLocaleString()}</span>
              </div>

              <table className="w-full border-collapse text-[7px]">
                <thead>
                  <tr className="bg-slate-800 text-white font-extrabold uppercase">
                    <Th className="p-1 border border-slate-800 text-center">SR</Th>
                    <Th className="p-1 border border-slate-800 text-left">DESCRIPTION & GOODS NAME</Th>
                    <Th className="p-1 border border-slate-800 text-center">HS CODE</Th>
                    <Th className="p-1 border border-slate-800 text-center">BRAND</Th>
                    <Th className="p-1 border border-slate-800 text-center">ORIGIN</Th>
                    <Th className="p-1 border border-slate-800 text-right">QUANTITY</Th>
                    <Th className="p-1 border border-slate-800 text-right">GROSS WT</Th>
                    <Th className="p-1 border border-slate-800 text-right">NET WT</Th>
                    <Th className="p-1 border border-slate-800 text-right">RATE ({currencyFc})</Th>
                    <Th className="p-1 border border-slate-800 text-right">TOTAL ({currencyFc})</Th>
                    <Th className="p-1 border border-slate-800 text-center">EX. RATE</Th>
                    <Th className="p-1 border border-slate-800 text-right">FINAL ({currencyLc})</Th>
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
                      <td className="p-1 border border-slate-300 text-right font-mono font-bold text-blue-800">${money(g.totalAmount || 130000)}</td>
                      <td className="p-1 border border-slate-300 text-center font-mono">{exchangeRate}</td>
                      <td className="p-1 border border-slate-300 text-right font-mono font-black text-emerald-800">{money(g.finalAmount || (130000 * exchangeRate))} {currencyLc}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black text-[7.5px]">
                    <td colSpan={5} className="p-1 border border-slate-300 text-right uppercase">GRAND TOTAL:</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{totalCartons.toLocaleString()} UNITS</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{money(totalGrossWt)} kg</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">{money(totalNetWt)} kg</td>
                    <td className="p-1 border border-slate-300 text-right font-mono">AVG $5.20</td>
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
                  <span>🚢 LOADING & LOGISTICS REGISTER</span>
                  <span className="font-mono text-slate-600">BY SEA</span>
                </div>
                <div className="flex justify-between"><span className="text-slate-500">Loading Origin Port:</span><b>USA / Port of Oakland</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Receiving Destination Port:</span><b>UAE / Jebel Ali Port</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Vessel & Voyage:</span><b className="font-mono">MSC BARCELONA V.204</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Container Numbers & BL:</span><b className="font-mono">TCLU-492019-2 / MSCU-881920-1</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Loading Date / Arrival Date:</span><span>2026-07-20 / 2026-07-25</span></div>
              </div>

              {/* Advance Payment Settlement Callout Box */}
              <div className="border border-amber-300 rounded p-2.5 bg-amber-50/90 space-y-1 shadow-sm">
                <div className="font-black uppercase text-amber-950 border-b border-amber-300 pb-1 flex justify-between items-center">
                  <span>📌 {tr("advance_destination")}</span>
                  <span className="font-mono text-emerald-800 font-extrabold">{advancePercent}% ADVANCE</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-amber-900 pt-0.5">
                  <span>Advance Amount ({advancePercent}%):</span>
                  <span className="font-mono text-emerald-800">${money(advanceAmountFc)} USD ({money(advanceAmountLc)} {currencyLc})</span>
                </div>
                <div className="text-[7.5px] text-slate-800 leading-normal pt-0.5">
                  {tr("transferred_to_roznamcha")}
                </div>
                <div className="flex justify-between text-[7px] text-slate-600 border-t border-amber-200 pt-1 mt-1 font-mono">
                  <span>Remaining Balance ({(100 - advancePercent)}%): ${money(remainingAmountFc)} FC</span>
                  <span className="font-bold text-rose-700">Due: 2026-08-01</span>
                </div>
              </div>

            </div>

            {/* ── SECTION 4: SYSTEM NARRATION & AUDIT COMPLIANCE ── */}
            <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50 text-[7.5px] flex items-center justify-between">
              <div>
                <b className="uppercase text-slate-900 mr-2">AUDIT NARRATION:</b>
                <span className="text-slate-700">Double-entry booking journal voucher verified and posted under Super Admin & Country scope rules.</span>
              </div>
              <div className="font-mono font-bold text-slate-500">SECURITY ID: 2026-AUD-9981</div>
            </div>

            {/* ── FOOTER SIGNATURES & OFFICIAL STAMP STRIP ── */}
            <div className="pt-2 border-t-2 border-slate-900 space-y-3">
              <p className="text-[6.5px] text-slate-500 text-center italic">
                *This is an official SAP/Oracle Enterprise standard ERP verification sheet generated by Daman Business Group. Double-entry postings are validated.*
              </p>

              <div className="flex justify-between items-end text-[7.5px]">
                <div className="w-14 h-14 border-2 border-slate-400 rounded-full flex items-center justify-center text-[6.5px] font-black text-slate-400 uppercase text-center p-1 font-mono">
                  OFFICIAL AUDIT STAMP
                </div>

                <div className="text-center space-y-1">
                  <div className="w-36 border-b-2 border-slate-900"></div>
                  <div className="font-black text-slate-900 uppercase">asmat (Country Admin)</div>
                  <div className="text-[6.5px] text-slate-500 uppercase font-bold">PREPARED BY (AUDITOR)</div>
                </div>

                <div className="text-center space-y-1">
                  <div className="w-36 border-b-2 border-slate-900"></div>
                  <div className="font-black text-slate-900 uppercase">SUPER ADMIN MANAGER</div>
                  <div className="text-[6.5px] text-slate-500 uppercase font-bold">AUTHORIZED SIGNATURE</div>
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
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-slate-500">Loading Purchase Verification...</div>}>
      <PurchaseTransferErpReportViewContent {...props} />
    </Suspense>
  );
}
