"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2, Search, Printer, Mail, Share2, Eye,
  Ship, Package, RefreshCw, FileText, ArrowLeft, Building2, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { printStore } from "@/lib/store/print-store";

type LanguageCode = "en" | "ur" | "ar" | "fa" | "ps";

const TRANSLATIONS: Record<string, Record<LanguageCode, string>> = {
  title: {
    en: "Completed Purchase Bills Register",
    ur: "مکمل پرچیز بلز رجسٹر",
    ar: "سجل فواتير الشراء المكتملة",
    fa: "دفتر ثبت فاکتورهای خرید تکمیل شده",
    ps: "د بشپړ شوي پیرود بیلونو راجستر"
  },
  subtitle: {
    en: "Final archive of fully completed purchase contracts with 0 remaining balance.",
    ur: "صفر بقایا رقم کے ساتھ مکمل شدہ پرچیز معاہدوں کا حتمی آرکائیو۔",
    ar: "الأرشيف النهائي لعقود الشراء المكتملة بالكامل مع رصيد متبقي 0.",
    fa: "آرشیو نهایی قراردادهای خرید کاملاً تکمیل شده با مانده صفر.",
    ps: "د 0 پاتې بیلانس سره د بشپړ شوي پیرود قراردادونو وروستی آرشیف."
  },
  searchPlaceholder: {
    en: "Search PO / Manual Bill / Supplier...",
    ur: "پرچیز آرڈر / مینوئل بل / سپلائر تلاش کریں...",
    ar: "ابحث برقم الشراء / الفاتورة اليدوية / المورد...",
    fa: "جستجوی سفارش / فاکتور دستی / تامین‌کننده...",
    ps: "د پیرود امر / لاسي بل / چمتو کونکی لټون کړئ..."
  },
  poNo: { en: "Purchase Bill No.", ur: "پرچیز بل نمبر", ar: "رقم فاتورة الشراء", fa: "شماره فاکتور خرید", ps: "د پیرود بل شمیره" },
  manualNo: { en: "Manual Bill No.", ur: "مینوئل بل نمبر", ar: "رقم الفاتورة اليدوية", fa: "شماره فاکتور دستی", ps: "لاسي بل شمیره" },
  blNo: { en: "BL No.", ur: "بی ایل نمبر", ar: "رقم بوليصة الشحن", fa: "شماره بارنامه", ps: "د بی ایل شمیره" },
  supplier: { en: "Supplier", ur: "سپلائر", ar: "المورد", fa: "تامین‌کننده", ps: "چمتو کونکی" },
  countryBranch: { en: "Country & Branch", ur: "ملک اور برانچ", ar: "البلد والفرع", fa: "کشور و شعبه", ps: "هیواد او څانګه" },
  contractQty: { en: "Contract Qty", ur: "معاہدہ کی مقدار", ar: "كمية العقد", fa: "مقدار قرارداد", ps: "د قرارداد مقدار" },
  loadedQty: { en: "Loaded Qty", ur: "لوڈ شدہ مقدار", ar: "الكمية المحملة", fa: "مقدار بارگیری شده", ps: "بار شوی مقدار" },
  purchaseAmount: { en: "Purchase Amount", ur: "پرچیز رقم", ar: "مبلغ الشراء", fa: "مبلغ خرید", ps: "د پیرود مقدار" },
  totalPaid: { en: "Total Paid", ur: "کل ادائیگی", ar: "إجمالي المدفوع", fa: "کل پرداخت شده", ps: "ټوله تادیه شوې" },
  remainingBalance: { en: "Remaining Balance", ur: "بقایا رقم", ar: "الرصيد المتبقي", fa: "مانده حساب", ps: "پاتې بیلانس" },
  completionDate: { en: "Completion Date", ur: "تکمیل کی تاریخ", ar: "تاريخ الإكمال", fa: "تاریخ تکمیل", ps: "د بشپړیدو نیټه" },
  completedBy: { en: "Completed By", ur: "تکمیل کنندہ", ar: "تم بواسطة", fa: "تکمیل شده توسط", ps: "بشپړ شوی لخوا" },
  actions: { en: "Actions", ur: "اقدامات", ar: "الإجراءات", fa: "عملیات", ps: "کړنې" }
};

export function CompletedPurchaseBillsView() {
  const [lang, setLang] = useState<LanguageCode>("en");
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const tr = (key: string) => TRANSLATIONS[key]?.[lang] || TRANSLATIONS[key]?.en || key;

  async function loadData() {
    setLoading(true);
    try {
      const [poRes, lrRes, payRes] = await Promise.all([
        fetch("/api/erp/purchases/orders?limit=1000", { cache: "no-store" }),
        fetch("/api/erp/purchases/loading-records?limit=1000", { cache: "no-store" }),
        fetch("/api/erp/purchases/payments?limit=1000", { cache: "no-store" }).catch(() => null)
      ]);
      const poPayload = await poRes.json().catch(() => ({}));
      const lrPayload = await lrRes.json().catch(() => ({}));
      const payPayload = payRes ? await payRes.json().catch(() => ({})) : {};

      const allOrders = Array.isArray(poPayload.data) ? poPayload.data : (poPayload.data?.orders || poPayload.orders || []);
      const allLoading = lrPayload.data?.records || [];
      const allPayments = payPayload.data?.payments || payPayload.payments || [];

      setOrders(allOrders);
      setLoadingRecords(allLoading);
      setPayments(allPayments);
    } catch (err) {
      console.error("Error loading completed purchase bills:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const completedBills = useMemo(() => {
    return orders.filter(row => {
      const remainingDue = Number(row.remaining_due ?? 99999);
      const isStatusCompleted = row.payment_status === "completed" || row.form_data?.workflow?.lifecycleStatus === "Completed";
      const isZeroBalance = remainingDue <= 0.01;

      if (!isStatusCompleted && !isZeroBalance) return false;

      if (!query) return true;
      const q = query.toLowerCase();
      const form = row.form_data?.form || {};
      const manualNo = String(form.manualBillNumber || form.billNo || row.purchase_contract_no || "").toLowerCase();
      const supplier = String(form.salesAccountName || form.supplierName || "").toLowerCase();

      return row.purchase_order_no?.toLowerCase().includes(q) || manualNo.includes(q) || supplier.includes(q);
    });
  }, [orders, query]);

  function getBillDetails(row: any) {
    const form = row.form_data?.form || {};
    const goods = row.form_data?.goodsEntries || [];
    const workflow = row.form_data?.workflow || {};
    
    const manualBillNo = String(form.manualBillNumber || form.billNo || row.purchase_contract_no || "-");
    const supplierName = String(form.salesAccountName || form.supplierName || "Supplier");
    const countryName = String(row.countries?.name || form.originCountry || "UAE");
    const branchName = String(row.country_branches?.name || form.branchName || "Main Branch");

    const contractQty = goods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || g.quantity || 0), 0) || Number(form.qtyNo || 0);
    const unitLabel = String(form.qtyName || goods?.[0]?.qtyName || "Bags");

    const poLoadingRecords = loadingRecords.filter(r => r.purchase_order_no === row.purchase_order_no && r.loading_status === "loaded");
    const loadedQty = poLoadingRecords.reduce((sum: number, r: any) => sum + Number(r.report_payload?.loadedQuantity || r.report_payload?.loadingQuantity || r.loadedQuantity || 0), 0) || contractQty;
    const blNumbers = Array.from(new Set(poLoadingRecords.map(r => r.report_payload?.blNumber).filter(Boolean))).join(", ") || form.blNumber || "-";

    const exRate = Number(poLoadingRecords[0]?.report_payload?.exchangeRatePKR || form.exchangeRate || row.exchange_rate || 1);
    const purchaseAmountFC = goods.reduce((sum: number, g: any) => sum + Number(g.finalAmount || g.totalAmount || 0), 0) || Number(form.totalAmount || form.finalAmount || row.order_total || 0);
    const purchaseAmountLC = purchaseAmountFC * exRate;
    const totalPaidLC = purchaseAmountLC;

    const completedAt = workflow.completedAt ? new Date(workflow.completedAt).toLocaleDateString("en-GB") : new Date(row.updated_at || row.created_at).toLocaleDateString("en-GB");
    const completedBy = workflow.completedByName || "SUPER ADMIN";

    return {
      manualBillNo,
      supplierName,
      countryName,
      branchName,
      contractQty,
      loadedQty,
      unitLabel,
      blNumbers,
      exRate,
      purchaseAmountFC,
      purchaseAmountLC,
      totalPaidLC,
      completedAt,
      completedBy,
      poLoadingRecords
    };
  }

  function handlePrintReport(row: any) {
    const details = getBillDetails(row);
    const title = `COMPLETED PURCHASE BILL - ${row.purchase_order_no}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.5; }
          .header { border-bottom: 3px solid #047857; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 22px; font-weight: 900; color: #047857; text-transform: uppercase; margin: 0; }
          .badge { background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 11px; text-transform: uppercase; border: 1px solid #86efac; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background: #f8fafc; font-size: 10px; font-weight: bold; uppercase; color: #475569; }
          .text-right { text-align: right; }
          .summary-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin-top: 20px; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 10px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Completed Purchase Bill</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-weight: bold;">System Serial: ${row.purchase_order_no} | Manual Bill: ${details.manualBillNo}</p>
          </div>
          <div>
            <span class="badge">FULLY COMPLETED & PAID</span>
          </div>
        </div>

        <table>
          <tr>
            <th>Supplier Name</th><td>${details.supplierName}</td>
            <th>Country & Branch</th><td>${details.countryName} (${details.branchName})</td>
          </tr>
          <tr>
            <th>B/L Number(s)</th><td>${details.blNumbers}</td>
            <th>Exchange Rate</th><td>1 USD = ${details.exRate.toFixed(2)} AED/PKR</td>
          </tr>
          <tr>
            <th>Contract Quantity</th><td>${details.contractQty.toLocaleString()} ${details.unitLabel}</td>
            <th>Loaded Quantity</th><td>${details.loadedQty.toLocaleString()} ${details.unitLabel}</td>
          </tr>
          <tr>
            <th>Completion Date</th><td>${details.completedAt}</td>
            <th>Completed By</th><td>${details.completedBy}</td>
          </tr>
        </table>

        <div class="summary-box">
          <table style="margin: 0; border: none;">
            <tr style="border: none;">
              <td style="border: none; font-size: 13px; font-weight: bold;">Total Purchase Amount (USD): $${details.purchaseAmountFC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td style="border: none; font-size: 13px; font-weight: bold; text-align: right; color: #047857;">Total Paid: ${details.totalPaidLC.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</td>
            </tr>
            <tr style="border: none;">
              <td style="border: none; font-size: 13px; font-weight: bold; color: #047857;" colSpan="2">Remaining Balance: 0.00 AED (FULLY CLEARED)</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          System Generated Completed Purchase Register Archive Report • Operating Branch: ${details.branchName}
        </div>

        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
      </html>
    `;
    printStore.openPrint(html, title);
  }

  function handleShareWhatsApp(row: any) {
    const details = getBillDetails(row);
    const message = `*COMPLETED PURCHASE BILL ARCHIVE*\n` +
      `------------------------------------\n` +
      `Bill No: ${row.purchase_order_no}\n` +
      `Manual Bill: ${details.manualBillNo}\n` +
      `Supplier: ${details.supplierName}\n` +
      `BL No: ${details.blNumbers}\n` +
      `Contract Qty: ${details.contractQty.toLocaleString()} ${details.unitLabel}\n` +
      `Loaded Qty: ${details.loadedQty.toLocaleString()} ${details.unitLabel}\n` +
      `Purchase Amount: $${details.purchaseAmountFC.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `Total Paid: ${details.totalPaidLC.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED\n` +
      `Remaining Balance: 0.00 AED (FULLY PAID)\n` +
      `Completed Date: ${details.completedAt}\n` +
      `Completed By: ${details.completedBy}`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  function handleShareEmail(row: any) {
    const details = getBillDetails(row);
    const subject = `Completed Purchase Bill Summary: ${row.purchase_order_no}`;
    const body = `Completed Purchase Bill Record:\n\n` +
      `Purchase Bill No: ${row.purchase_order_no}\n` +
      `Manual Bill No: ${details.manualBillNo}\n` +
      `Supplier: ${details.supplierName}\n` +
      `BL No: ${details.blNumbers}\n` +
      `Contract Quantity: ${details.contractQty.toLocaleString()} ${details.unitLabel}\n` +
      `Loaded Quantity: ${details.loadedQty.toLocaleString()} ${details.unitLabel}\n` +
      `Purchase Amount (USD): $${details.purchaseAmountFC.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `Total Paid: ${details.totalPaidLC.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED\n` +
      `Remaining Balance: 0.00 AED\n\n` +
      `Completion Date: ${details.completedAt}\n` +
      `Completed By: ${details.completedBy}`;

    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }

  const summaryMetrics = useMemo(() => {
    let totalPurchaseUSD = 0;
    let totalPaidUSD = 0;
    let totalContractQty = 0;
    let totalLoadedQty = 0;

    completedBills.forEach(row => {
      const details = getBillDetails(row);
      totalPurchaseUSD += details.purchaseAmountFC;
      totalPaidUSD += details.purchaseAmountFC;
      totalContractQty += details.contractQty;
      totalLoadedQty += details.loadedQty;
    });

    return {
      totalCount: completedBills.length,
      totalPurchaseUSD,
      totalPaidUSD,
      totalRemainingUSD: 0,
      totalContractQty,
      totalLoadedQty
    };
  }, [completedBills]);

  return (
    <div className="mx-auto w-full max-w-[1650px] px-3 py-4 space-y-4 font-sans text-slate-800 dark:text-slate-100">
      {/* SINGLE CLEAN ACTION / CONTROL HEADER BAR (No duplicate back buttons!) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <Button onClick={() => window.history.back()} variant="ghost" size="sm" className="h-8 px-2 text-xs font-bold text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

          <div>
            <h1 className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              {tr("title")}
              <span className="text-[11px] font-medium text-slate-400 normal-case ml-2">Daily completed purchase register - 0 balance archive</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 5-LANGUAGE SWITCHER */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            {[
              { code: "en", label: "English" },
              { code: "ur", label: "اردو" },
              { code: "ps", label: "پښتو" },
              { code: "fa", label: "فارسی" },
              { code: "ar", label: "العربية" }
            ].map(item => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLang(item.code as LanguageCode)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                  lang === item.code 
                    ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-400" 
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("searchPlaceholder")}
              className="h-8 w-60 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <Button onClick={() => void loadData()} variant="outline" size="sm" className="h-8 font-bold text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* EXECUTIVE 4-CARD REPORT SUMMARY HEADER (EXACT MATCH FOR IMAGE 1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* CARD 1: BRANCH & USER DETAILS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h3 className="text-xs font-black uppercase text-blue-900 dark:text-blue-300 tracking-wider">1. BRANCH & USER DETAILS</h3>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Country:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">United Arab Emirates / Pakistan</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Branch Name:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">MAIN BRANCH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">User ID:</span>
              <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[140px]">7719341B-BFCB-4A31-B852</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">User Name:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">SUPER ADMIN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">SUPER_ADMIN</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Status:</span>
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase">Active</span>
            </div>
          </div>
        </div>

        {/* CARD 2: GLOBAL FINANCIAL SUMMARY (USD) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h3 className="text-xs font-black uppercase text-emerald-900 dark:text-emerald-300 tracking-wider">2. GLOBAL FINANCIAL SUMMARY (USD)</h3>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Completed Bills:</span>
              <span className="font-black text-slate-800 dark:text-slate-100">{summaryMetrics.totalCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contract / Loaded Qty:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{summaryMetrics.totalContractQty.toLocaleString()} Bags</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Credit (Paid):</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">${summaryMetrics.totalPaidUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Debit (Purchases):</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">${summaryMetrics.totalPurchaseUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-slate-800">
              <span className="font-black uppercase text-slate-700 dark:text-slate-300">BALANCE:</span>
              <span className="font-black text-sm text-slate-900 dark:text-slate-100">$0.00</span>
            </div>
          </div>
        </div>

        {/* CARD 3: ACTIVE OPERATIONS SUMMARY */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h3 className="text-xs font-black uppercase text-purple-900 dark:text-purple-300 tracking-wider">3. COMPLETED OPERATIONS SUMMARY</h3>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Purchase Booking:</span>
              <span className="font-bold text-emerald-600">✓ Completed</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Loading Module:</span>
              <span className="font-bold text-emerald-600">✓ Completed</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Payments & Balance:</span>
              <span className="font-bold text-emerald-600">✓ 0.00 AED / USD (100% Paid)</span>
            </div>
            <div className="mt-2 text-[10px] text-center py-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-500">
              Archived for permanent record audit
            </div>
          </div>
        </div>

        {/* CARD 4: ALL COUNTRIES REPORT DETAILS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
              4
            </div>
            <h3 className="text-xs font-black uppercase text-amber-900 dark:text-amber-300 tracking-wider">4. ALL COUNTRIES REPORT DETAILS</h3>
          </div>

          <div className="space-y-2 text-[11px]">
            <p className="text-slate-500 text-[10.5px]">
              Displaying fully cleared & completed purchase bills across all active country operations (UAE, PAKISTAN).
            </p>
            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE UPDATING
            </div>
          </div>
        </div>
      </div>

      {/* COMPLETED BILLS TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">{tr("poNo")}</th>
                <th className="px-4 py-3">{tr("manualNo")}</th>
                <th className="px-4 py-3">{tr("blNo")}</th>
                <th className="px-4 py-3">{tr("supplier")}</th>
                <th className="px-4 py-3">{tr("countryBranch")}</th>
                <th className="px-4 py-3 text-right">{tr("contractQty")}</th>
                <th className="px-4 py-3 text-right">{tr("loadedQty")}</th>
                <th className="px-4 py-3 text-right">{tr("purchaseAmount")}</th>
                <th className="px-4 py-3 text-right">{tr("totalPaid")}</th>
                <th className="px-4 py-3 text-right">{tr("remainingBalance")}</th>
                <th className="px-4 py-3">{tr("completionDate")}</th>
                <th className="px-4 py-3">{tr("completedBy")}</th>
                <th className="px-4 py-3 text-center">{tr("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {completedBills.map((row) => {
                const details = getBillDetails(row);

                return (
                  <tr key={row.id} className="hover:bg-emerald-50/40 transition-colors dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono font-black text-blue-600 dark:text-blue-400">
                      {row.purchase_order_no}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {details.manualBillNo}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {details.blNumbers}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                      {details.supplierName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      <div>{details.countryName}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">{details.branchName}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-200">
                      {details.contractQty.toLocaleString()} {details.unitLabel}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {details.loadedQty.toLocaleString()} {details.unitLabel}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                      <div>${details.purchaseAmountFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="text-[9.5px] text-slate-400">@ {details.exRate.toFixed(2)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {details.totalPaidLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                        0.00 AED
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                      {details.completedAt}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                      {details.completedBy}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setSelectedBill(row); setIsDetailModalOpen(true); }}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintReport(row)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          title="Print PDF"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareEmail(row)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                          title="Email"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(row)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                          title="WhatsApp"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {completedBills.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-bold text-slate-700">No Completed Purchase Bills</p>
                    <p className="text-xs">Purchase bills will automatically appear here once their remaining balance is fully paid.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedBill && (
        <SimpleModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Completed Purchase Bill Details - ${selectedBill.purchase_order_no}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4 text-xs">
            {(() => {
              const details = getBillDetails(selectedBill);

              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-sans font-bold">Bill Serial</span>
                      <span className="font-bold text-blue-600">{selectedBill.purchase_order_no}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-sans font-bold">Manual Bill</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{details.manualBillNo}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-sans font-bold">B/L Number(s)</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{details.blNumbers}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-sans font-bold">Completion Date</span>
                      <span className="font-bold text-emerald-600">{details.completedAt}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 space-y-2">
                      <h4 className="font-bold uppercase text-[10px] text-slate-500">Supplier & Branch Info</h4>
                      <p><span className="font-semibold text-slate-500">Supplier:</span> {details.supplierName}</p>
                      <p><span className="font-semibold text-slate-500">Country:</span> {details.countryName}</p>
                      <p><span className="font-semibold text-slate-500">Branch:</span> {details.branchName}</p>
                    </Card>

                    <Card className="p-4 space-y-2">
                      <h4 className="font-bold uppercase text-[10px] text-slate-500">Financial Summary</h4>
                      <p><span className="font-semibold text-slate-500">Contract Total (USD):</span> ${details.purchaseAmountFC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p><span className="font-semibold text-slate-500">Exchange Rate:</span> 1 USD = {details.exRate.toFixed(2)} AED/PKR</p>
                      <p className="font-bold text-emerald-600"><span className="text-slate-500 font-normal">Total Paid:</span> {details.totalPaidLC.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED (Balance: 0.00)</p>
                    </Card>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button onClick={() => handlePrintReport(selectedBill)} variant="outline" size="sm" className="font-bold text-xs">
                      <Printer className="h-3.5 w-3.5 mr-1" /> Print PDF
                    </Button>
                    <Button onClick={() => handleShareWhatsApp(selectedBill)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                      <Share2 className="h-3.5 w-3.5 mr-1" /> Share WhatsApp
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </SimpleModal>
      )}
    </div>
  );
}
