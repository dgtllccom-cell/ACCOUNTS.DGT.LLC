"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Printer, Download, FileSpreadsheet, Eye,
  RefreshCcw, Search,
  ClipboardList, Ship, Coins, Wallet, FileText, CheckCircle2,
  BookOpen, MoreVertical, LayoutGrid, Table as TableIcon,
  Activity, TrendingUp, BarChart3, Building2, Globe2,
  Receipt, CreditCard, Truck, ArrowRightLeft, Users,
  FileBarChart, FileBadge, ScrollText, Scale, FileCheck,
  Landmark, Timer, ShieldCheck, Clock, UserCheck, Plus, Minus, ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Import all Report Handlers
import { openCustomerLedgerPrintReport, type CustomerLedgerReportData } from "@/lib/reports/open-customer-ledger-print-report";
import { openLoadingRecordsPrintReport, type PurchaseLoadingReportRow } from "@/lib/reports/open-loading-records-print-report";
import { openFinalizedPOPrintReport, type FinalizedPORow } from "@/lib/reports/open-finalized-po-print-report";
import { openTransferPaymentPrintReport } from "@/lib/reports/open-transfer-payment-print-report";
import { openRecentCashEntriesPrintReport, type CashEntryLine } from "@/lib/reports/open-cash-entries-print-report";
import { openEntryTypePrintReport, type EntryLine } from "@/lib/reports/open-entry-type-print-report";
import { openPurchaseBookingOrderPrintReport } from "@/lib/reports/open-purchase-booking-print-report";
import { openRoznamchaVoucherPrintReport } from "@/lib/reports/open-roznamcha-voucher-print-report";
import { openSalesA4ReportWindow } from "@/lib/reports/open-sales-a4-report-window";
import { openAccountA4ReportWindow } from "@/lib/reports/open-account-a4-report-window";
import { openTradeDocument } from "@/lib/reports/trade-documents/open-trade-document";
import { purchaseOrderToTradeInput } from "@/lib/reports/trade-documents/from-transaction";
import { resolveDocumentBranding } from "@/lib/reports/resolve-document-branding";
import type { TradeDocType } from "@/lib/reports/trade-documents/types";
import { openPurchaseA4ReportWindow } from "@/lib/reports/open-purchase-a4-report-window";
import { openUserA4ReportWindow } from "@/lib/reports/open-user-a4-report-window";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

/* ──────────────────────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────────────────────── */
type BranchStat = {
  branchId: string;
  branchName: string;
  branchCode: string;
  countryId: string;
  countryName: string;
  purchases: number;
  sales: number;
  accounts: number;
  cashEntries: number;
  payments: number;
  journalEntries: number;
  ledgerEntries: number;
  loadingRecords: number;
  transfers: number;
  shippingRecords: number;
  lastActivity: string | null;
  isActive: boolean;
};

type CountryTotal = {
  countryId: string;
  countryName: string;
  purchases: number;
  sales: number;
  accounts: number;
  cashEntries: number;
  payments: number;
  journalEntries: number;
  ledgerEntries: number;
  loadingRecords: number;
  transfers: number;
  shippingRecords: number;
  lastActivity: string | null;
  branchCount: number;
};

type GrandTotal = {
  purchases: number;
  sales: number;
  accounts: number;
  cashEntries: number;
  payments: number;
  journalEntries: number;
  ledgerEntries: number;
  loadingRecords: number;
  transfers: number;
  shippingRecords: number;
  lastActivity: string | null;
  totalBranches: number;
  activeBranches: number;
};

type ActivityData = {
  branches: BranchStat[];
  countryTotals: CountryTotal[];
  grandTotal: GrandTotal;
  generatedAt: string;
};

type RoleScope = "super_admin" | "country_admin" | "branch_admin";

/* ──────────────────────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────────────────────── */
function fmtDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/* ──────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────────────────────── */
export default function PrintReportsHubPage() {
  const lang = useActiveLanguage();
  const tp = useCallback((key: string, fallback: string) => t(lang, key as never, fallback), [lang]);
  const [roleScope, setRoleScope] = useState<RoleScope>("super_admin");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");
  const [selectedBranch, setSelectedBranch] = useState("All Branches");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set(["customer-ledger"]));
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [showActivityDashboard, setShowActivityDashboard] = useState(true);

  // Live data from APIs
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [roznamchaEntries, setRoznamchaEntries] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [ledgersList, setLedgersList] = useState<any[]>([]);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  useEffect(() => {
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSessionInfo(j))
      .catch(() => setSessionInfo(null));
  }, []);

  const toggleRowExpand = (id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Close dropdown on click outside
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Live Activity Summary
  const fetchActivitySummary = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const res = await fetch("/api/erp/reports/activity-summary");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: ActivityData = (json && typeof json === "object" && "data" in json) ? json.data : json;
      setActivityData(data);
    } catch (e: any) {
      setActivityError(e.message || "Failed to load activity summary");
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // Fetch Live ERP data from APIs
  const fetchLiveData = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, loadRes, salesRes, rozRes, accRes, ledgRes] = await Promise.allSettled([
        fetch("/api/erp/purchases/orders?limit=100").then(r => r.ok ? r.json() : { orders: [] }),
        fetch("/api/erp/purchases/loading-records?limit=100").then(r => r.ok ? r.json() : { records: [] }),
        fetch("/api/erp/sales/orders?limit=100").then(r => r.ok ? r.json() : { orders: [] }),
        fetch("/api/erp/roznamcha?limit=100").then(r => r.ok ? r.json() : { entries: [] }),
        fetch("/api/erp/accounts?limit=100").then(r => r.ok ? r.json() : { accounts: [] }),
        fetch("/api/erp/ledgers?limit=100").then(r => r.ok ? r.json() : { ledgers: [] }),
      ]);

      if (poRes.status === "fulfilled") {
        const val = poRes.value;
        setOrders(val.orders || val.data || (Array.isArray(val) ? val : []));
      }
      if (loadRes.status === "fulfilled") {
        const val = loadRes.value;
        setLoadingRecords(val.records || val.data || (Array.isArray(val) ? val : []));
      }
      if (salesRes.status === "fulfilled") {
        const val = salesRes.value;
        setSalesOrders(val.orders || val.data || (Array.isArray(val) ? val : []));
      }
      if (rozRes.status === "fulfilled") {
        const val = rozRes.value;
        setRoznamchaEntries(val.entries || val.data || (Array.isArray(val) ? val : []));
      }
      if (accRes.status === "fulfilled") {
        const val = accRes.value;
        setAccountsList(val.accounts || val.data || (Array.isArray(val) ? val : []));
      }
      if (ledgRes.status === "fulfilled") {
        const val = ledgRes.value;
        setLedgersList(val.ledgers || val.data || (Array.isArray(val) ? val : []));
      }
    } catch (err) {
      console.error("Error fetching live report data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActivitySummary();
    void fetchLiveData();
  }, [fetchActivitySummary, fetchLiveData]);

  /* ──────────────────────────────────────────────────────────────
     REPORT PRINT HANDLERS
     ────────────────────────────────────────────────────────────── */
  
  const scopeCountry = selectedCountry === "All Countries" ? "" : selectedCountry;
  const scopeBranch = selectedBranch === "All Branches" ? "" : selectedBranch;
  const noData = (label: string) => alert(`No ${label} records available for this report.`);

  // 1. Customer Ledger Report — real roznamcha lines only
  const handlePrintCustomerLedger = useCallback(() => {
    if (!roznamchaEntries.length) return noData("customer ledger");
    let running = 0;
    const rows = roznamchaEntries.slice(0, 25).map((r, i) => {
      const debit = Number(r.total_debit || 0);
      const credit = Number(r.total_credit || 0);
      running += debit - credit;
      return {
        srNo: i + 1,
        date: r.entry_date || "",
        branchEntryNo: r.super_admin_serial_number || r.voucher_no || "—",
        userName: r.created_by_name || "—",
        branchName: r.branch_name || scopeBranch || "—",
        roznamachaNameAndNo: r.voucher_no ? `Roznamcha / ${r.voucher_no}` : "—",
        remarks: r.narration || "",
        debit,
        credit,
        balance: running,
        dcType: (running >= 0 ? "Dr" : "Cr") as "Dr" | "Cr",
      };
    });
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    openCustomerLedgerPrintReport({
      report: {
        customerName: "",
        customerCode: "",
        openingBalance: 0,
        openingDcType: "Dr",
        totalDebit,
        totalCredit,
        closingBalance: totalDebit - totalCredit,
        closingDcType: totalDebit - totalCredit >= 0 ? "Dr" : "Cr",
        country: scopeCountry,
        branch: scopeBranch,
        currency: roznamchaEntries[0]?.currency || "",
        salesAccount: "",
        customerAccount: "",
        roznamachaName: "",
        roznamachaNo: "",
        rows,
      },
      companyInfo: {},
    });
  }, [roznamchaEntries, scopeBranch, scopeCountry]);

  // 2. Loading Records Report — real records only
  const handlePrintLoadingRecords = useCallback(() => {
    if (!loadingRecords.length) return noData("loading");
    const rows: PurchaseLoadingReportRow[] = loadingRecords.slice(0, 50).map((lr, i) => {
      const payload = lr.report_payload || {};
      const contractQty = Number(lr.contract_qty || payload.contractQty || 0);
      const loadedQty = Number(lr.loaded_qty || payload.loadedQty || 0);
      const fcAmount = Number(lr.fc_amount || payload.fcAmount || 0);
      const lcAmount = Number(lr.lc_amount || payload.lcAmount || 0);
      return {
        id: lr.id || `LR-${i + 1}`,
        country: lr.country_name || scopeCountry || "—",
        branch: lr.branch_name || scopeBranch || "—",
        purchaseBookingNo: lr.po_no || payload.poNo || "—",
        salesAccount: lr.sales_account_no || "",
        purchaseAccount: lr.purchase_account_no || "",
        goods: lr.goods_name || payload.goodsName || "—",
        contractQty,
        grossWeight: Number(lr.gross_weight || payload.grossWeight || 0),
        tareWeight: Number(lr.tare_weight || payload.tareWeight || 0),
        netWeight: Number(lr.net_weight || payload.netWeight || 0),
        purchasePriceRate: Number(lr.fc_rate || payload.fcRate || 0),
        totalPurchaseFc: fcAmount,
        advanceFc: 0,
        remainingFc: fcAmount,
        currencyFc: lr.currency || payload.currency || "",
        exchangeRate: Number(lr.lc_rate || payload.lcRate || 0),
        finalAmountLc: lcAmount,
        finalAdvanceLc: 0,
        finalRemainingLc: lcAmount,
        currencyLc: lr.local_currency || "",
        loadedQty,
        remainingToLoad: Math.max(0, contractQty - loadedQty),
        loadingStatus: lr.status || payload.status || "—",
      };
    });

    openLoadingRecordsPrintReport({
      rows,
      companyInfo: { country: scopeCountry, branch: scopeBranch },
    });
  }, [loadingRecords, scopeBranch, scopeCountry]);

  // 3. Finalized PO Report — real purchase orders only
  const handlePrintFinalizedPO = useCallback(() => {
    if (!orders.length) return noData("purchase order");
    const rows: FinalizedPORow[] = orders.slice(0, 50).map((o, i) => {
      const form = o.form_data?.form || {};
      const rate = Number(o.exchange_rate || form.exchangeRate || 0);
      const totalFc = Number(o.order_total || form.totalAmount || 0);
      return {
        id: o.id || `PO-${i + 1}`,
        poNumber: o.purchase_order_no || "—",
        country: o.countryName || scopeCountry || "—",
        branch: o.branchName || scopeBranch || "—",
        supplier: form.supplierName || "—",
        goods: form.goodsName || form.productName || "—",
        contractQty: Number(form.quantity || 0),
        grossWeight: Number(form.totalWeight || 0),
        netWeight: Number(form.totalWeight || 0),
        purchaseRate: Number(form.purchaseRate || 0),
        totalPurchaseFc: totalFc,
        advanceFc: Number(o.advance_paid || 0),
        remainingFc: Number(o.remaining_due || totalFc),
        currencyFc: o.currency_code || form.currencyType || "",
        exchangeRate: rate,
        finalAmountLc: rate ? totalFc * rate : 0,
        finalAdvanceLc: 0,
        finalRemainingLc: rate ? totalFc * rate : 0,
        currencyLc: "",
        status: o.status || o.order_status || "—",
        createdAt: o.order_date || o.created_at?.slice(0, 10) || "",
      };
    });

    openFinalizedPOPrintReport({
      rows,
      companyInfo: { country: scopeCountry, branch: scopeBranch },
    });
  }, [orders, scopeBranch, scopeCountry]);

  // 4. Transfer Payment Voucher — from a real posted purchase order
  const handlePrintTransferPayment = useCallback(() => {
    const o = orders.find((x) => Number(x.advance_paid || x.remaining_paid || 0) > 0) || orders[0];
    if (!o) return noData("payment / transfer");
    const form = o.form_data?.form || {};
    const rate = Number(o.exchange_rate || form.exchangeRate || 0);
    const amountFc = Number(o.advance_paid || o.remaining_paid || o.order_total || 0);
    openTransferPaymentPrintReport({
      record: {
        id: o.id,
        voucherNo: o.purchase_order_no || "—",
        billNo: o.purchase_contract_no || form.manualBillNumber || "—",
        transferDate: o.order_date || o.created_at?.slice(0, 10) || "",
        supplierName: form.supplierName || "—",
        branchName: o.branchName || scopeBranch || "—",
        countryName: o.countryName || scopeCountry || "—",
        goodsName: form.goodsName || "—",
        paymentMode: form.paymentMode || "—",
        bankOrCashAccount: form.bankAccountName || form.cashAccountName || "—",
        amountFc,
        currencyFc: o.currency_code || form.currencyType || "",
        exchangeRate: rate,
        amountLc: rate ? amountFc * rate : 0,
        currencyLc: "",
        amountInWords: "",
        purchaseAccountNo: form.purchaseAccountName || "—",
        narration: form.narration || "",
      },
      companyInfo: {},
    });
  }, [orders, scopeBranch, scopeCountry]);

  // 5. Recent Cash Entries — real roznamcha entries only
  const handlePrintCashEntries = useCallback(() => {
    if (!roznamchaEntries.length) return noData("cash entry");
    const lines: CashEntryLine[] = roznamchaEntries.slice(0, 25).map((r, i) => ({
      id: r.id || `CASH-${i + 1}`,
      voucherNo: r.voucher_no || "—",
      entryDate: r.entry_date || "",
      accountCode: r.account_code || r.debit_account_code || "—",
      accountTitle: r.account_title || r.narration || "—",
      narration: r.narration || "",
      user: r.created_by_name || "—",
      branch: r.branch_name || scopeBranch || "—",
      debit: Number(r.total_debit || 0),
      credit: Number(r.total_credit || 0),
      currency: r.currency || "",
    }));

    openRecentCashEntriesPrintReport({ entries: lines, companyInfo: {} });
  }, [roznamchaEntries, scopeBranch]);

  // 5b. Entry-type prints (Bank / Business Roznamcha / Invoice) — shared branded builder.
  const buildEntryLines = useCallback((): EntryLine[] => {
    return roznamchaEntries.slice(0, 25).map((r: any, i: number) => ({
      id: r.id || `E-${i}`,
      voucherNo: r.voucher_no || "—",
      entryDate: r.entry_date || "",
      accountCode: r.account_code || r.debit_account_code || "—",
      accountTitle: r.account_title || r.narration || "—",
      debit: Number(r.total_debit || 0),
      credit: Number(r.total_credit || 0),
      currency: r.currency || "",
      narration: r.narration || "",
      user: r.created_by_name || "—",
      branch: r.branch_name || scopeBranch || "—",
      entryType: r.entry_type || r.category || undefined,
      bankName: r.bank_name || undefined,
      instrumentNo: r.instrument_no || r.cheque_no || undefined,
      invoiceNo: r.invoice_no || undefined,
      party: r.party_name || r.counterparty || undefined,
    }));
  }, [roznamchaEntries, scopeBranch]);

  const companyInfoForPrint = useCallback(() => ({
    country: scopeCountry,
    branch: scopeBranch,
  }), [scopeCountry, scopeBranch]);

  const handlePrintBankEntries = useCallback(() => {
    if (!roznamchaEntries.length) return noData("bank entry");
    openEntryTypePrintReport({ mode: "bank", entries: buildEntryLines(), companyInfo: companyInfoForPrint(), filterByType: false });
  }, [roznamchaEntries, buildEntryLines, companyInfoForPrint]);

  const handlePrintBusinessRoznamcha = useCallback(() => {
    if (!roznamchaEntries.length) return noData("roznamcha");
    openEntryTypePrintReport({ mode: "business", entries: buildEntryLines(), companyInfo: companyInfoForPrint(), filterByType: false });
  }, [roznamchaEntries, buildEntryLines, companyInfoForPrint]);

  const handlePrintInvoiceEntries = useCallback(() => {
    if (!roznamchaEntries.length) return noData("invoice entry");
    openEntryTypePrintReport({ mode: "invoice", entries: buildEntryLines(), companyInfo: companyInfoForPrint(), filterByType: false });
  }, [roznamchaEntries, buildEntryLines, companyInfoForPrint]);

  // 6. Purchase Booking Order — from a real purchase order
  const handlePrintPurchaseBooking = useCallback(() => {
    const po = orders[0];
    if (!po) return noData("purchase order");
    const form = po.form_data?.form || {};
    const rate = Number(po.exchange_rate || form.exchangeRate || 0);
    const totalFc = Number(po.order_total || form.totalAmount || 0);
    openPurchaseBookingOrderPrintReport({
      order: {
        id: po.id,
        systemBillNo: po.purchase_order_no || "—",
        bookingDate: po.order_date || po.created_at || "",
        supplierName: form.supplierName || "—",
        purchaseAccountNo: form.purchaseAccountNo || "",
        purchaseAccountName: form.purchaseAccountName || "—",
        salesAccountNo: form.salesAccountNo || "",
        salesAccountName: form.salesAccountName || "—",
        countryName: po.countryName || scopeCountry || "—",
        branchName: po.branchName || scopeBranch || "—",
        goodsItems: [
          {
            srNo: 1,
            goodsName: form.goodsName || form.productName || "—",
            quantity: Number(form.quantity || 0),
            grossWeight: Number(form.totalWeight || 0),
            netWeight: Number(form.totalWeight || 0),
            rateKg: Number(form.purchaseRate || 0),
            amountFc: totalFc,
            currencyFc: po.currency_code || form.currencyType || "",
            exchangeRate: rate,
            amountLc: rate ? totalFc * rate : 0,
            currencyLc: "",
          },
        ],
        totalPurchaseFc: totalFc,
        currencyFc: po.currency_code || form.currencyType || "",
        totalPurchaseLc: rate ? totalFc * rate : 0,
        currencyLc: "",
        status: po.status || po.order_status || "—",
      },
      companyInfo: {},
    });
  }, [orders, scopeBranch, scopeCountry]);

  // 7. Roznamcha Voucher — from a real roznamcha entry
  const handlePrintRoznamchaVoucher = useCallback(() => {
    const r = roznamchaEntries[0];
    if (!r) return noData("roznamcha voucher");
    openRoznamchaVoucherPrintReport({
      data: {
        receiptNo: r.voucher_no || "—",
        voucherNo: r.voucher_no || "—",
        date: r.entry_date || "",
        accountNo: r.account_code || "",
        accountName: r.account_title || "—",
        amount: Number(r.total_debit || r.total_credit || 0),
        currency: r.currency || "",
        narration: r.narration || "",
        type: "receipt",
        branchName: r.branch_name || scopeBranch || "—",
        countryName: r.country_name || scopeCountry || "—",
        createdByName: r.created_by_name || "—",
      },
      companyInfo: {},
    });
  }, [roznamchaEntries, scopeBranch, scopeCountry]);

  // 8. Sales Order Report
  const handlePrintSalesOrder = useCallback(() => {
    const so = salesOrders[0] || orders[0];
    if (!so) return noData("sales order");
    const form = so.form_data?.form || {};
    openSalesA4ReportWindow({
      title: tp("prep.sales_order_title", "Sales Order Report"),
      salesData: {
        id: so.id,
        salesBookingOrderNumber: so.sales_order_no || so.purchase_order_no || "—",
        salesDate: so.order_date || form.purchaseDate || "—",
        bookingDate: so.created_at || "—",
        salesAccountName: form.salesAccountName || so.salesAccountName || "—",
        salesAccountNumber: form.salesAccountNumber || "—",
        purchaseAccountName: form.purchaseAccountName || "—",
        purchaseAccountNumber: form.purchaseAccountNumber || "—",
        supplierName: form.supplierName || "—",
        customerName: form.customerName || so.customer_name || "—",
        productName: form.goodsName || form.productName || so.product_summary || "—",
        goodsDescription: form.goodsName || "—",
        quantity: Number(form.quantity || so.quantity || 0),
        unit: form.unit || "",
        totalWeight: Number(form.totalWeight || so.total_weight || 0),
        containerCount: Number(form.containerCount || 0),
        salesRate: Number(form.salesRate || form.purchaseRate || 0),
        totalSalesAmount: Number(so.order_total || 0),
        currency: form.currencyType || so.currency_code || so.original_currency_code || "",
        status: so.sales_status || so.status || so.order_status || "—",
        paymentStatus: so.payment_status || "—",
        branchName: so.branchName || form.branchName || "—",
        countryName: so.countryName || form.countryName || "—",
        createdAt: so.created_at || "",
        form_data: so.form_data,
        audit: { userName: so.created_by_name || "—", userId: so.created_by || "", branchCode: so.branchCode || "—" },
      },
    });
  }, [salesOrders, orders]);

  // 9. Account Statement
  const handlePrintAccountStatement = useCallback(() => {
    const acc = accountsList[0];
    if (!acc) return noData("account");
    openAccountA4ReportWindow({
      title: tp("prep.account_statement_title", "Account Statement Report"),
      accountData: {
        accountName: acc.contacts?.accountTitle || acc.account_number || "—",
        accountCode: acc.account_number || "—",
        accountTitle: acc.contacts?.accountTitle || "—",
        subType: acc.sub_type || "—",
        category: acc.category || acc.kind || "—",
        currency: acc.currency_code || "",
        status: acc.status || "—",
        selectedCountryName: acc.country_name || scopeCountry || "—",
        selectedBranchName: acc.branch_name || scopeBranch || "—",
        createdBy: acc.created_by_name || "—",
      },
    });
  }, [accountsList, scopeCountry, scopeBranch]);

  // 10. Proforma Invoice / 12. Trade Document — via the unified engine
  const openTradeDoc = useCallback(async (docType: TradeDocType) => {
    const o = orders[0];
    if (!o) return noData("purchase order (trade document)");
    const scope = {
      countryId: o.country_id || o.countryId || null,
      countryBranchId: o.country_branch_id || null,
      cityBranchId: o.city_branch_id || null,
      countryName: o.countryName || null,
      branchName: o.branchName || null,
    };
    const branding = await resolveDocumentBranding(scope, lang);
    const input = purchaseOrderToTradeInput(o, { docType, lang, branding });
    openTradeDocument(input);
  }, [orders, lang]);
  const handlePrintProformaInvoice = useCallback(() => { void openTradeDoc("proforma_invoice"); }, [openTradeDoc]);

  // 11. Expenses Bill
  const handlePrintExpenses = useCallback(() => {
    alert("Expenses Bill Report — Opens when expense data is available in the system.");
  }, []);

  // 12. Trade Document (Purchase Contract)
  const handlePrintTradeDocument = useCallback(() => { void openTradeDoc("contract"); }, [openTradeDoc]);

  // 13. Purchase A4 Full Report — from a real purchase order
  const handlePrintPurchaseA4 = useCallback(() => {
    const o = orders[0];
    if (!o) return noData("purchase");
    const form = o.form_data?.form || {};
    openPurchaseA4ReportWindow({
      title: tp("prep.purchase_booking_title", "Purchase Booking Order Report"),
      purchaseData: {
        id: o.id,
        purchaseBookingOrderNumber: o.purchase_order_no || "—",
        purchaseDate: form.purchaseDate || o.order_date || "",
        bookingDate: o.created_at || "",
        purchaseAccountName: form.purchaseAccountName || "—",
        purchaseAccountNumber: form.purchaseAccountNumber || "",
        salesAccountName: form.salesAccountName || "—",
        salesAccountNumber: form.salesAccountNumber || "",
        supplierName: form.supplierName || "—",
        buyerName: form.buyerName || "—",
        productName: form.goodsName || form.productName || "—",
        goodsDescription: form.goodsName || "—",
        quantity: Number(form.quantity || 0),
        unit: form.unit || "",
        totalWeight: Number(form.totalWeight || 0),
        containerCount: Number(form.containerCount || 0),
        purchaseRate: Number(form.purchaseRate || 0),
        totalPurchaseAmount: Number(o.order_total || 0),
        currency: o.currency_code || form.currencyType || "",
        status: o.status || o.order_status || "—",
        paymentStatus: o.payment_status || "—",
        branchName: o.branchName || "—",
        countryName: o.countryName || "—",
        createdAt: o.created_at || "",
        form_data: o.form_data,
        audit: { userName: o.created_by_name || "—", userId: o.created_by || "", branchCode: o.branchCode || "—" },
      },
    });
  }, [orders]);

  // 14. User Activity Report — the logged-in user's real audit counts from live data
  const handlePrintUserActivity = useCallback(() => {
    const u = sessionInfo?.user;
    if (!u?.id) return noData("user session");
    openUserA4ReportWindow({
      title: tp("prep.user_activity_title", "User Activity Report"),
      subtitle: tp("prep.user_activity_sub", "ERP User Audit Trail"),
      userData: {
        userId: u.id,
        userCode: u.userCode || u.user_code || "—",
        fullName: u.fullName || u.email || "—",
        countryName: scopeCountry || (sessionInfo?.scopes?.summary?.countryName ?? "—"),
        branchName: scopeBranch || (sessionInfo?.scopes?.summary?.branchDisplayName ?? "—"),
        branchType: sessionInfo?.roles?.[0] || "—",
        role: (sessionInfo?.roles?.[0] || "—").replace(/_/g, " "),
        registrationDate: "",
        status: sessionInfo?.authenticated ? "Active" : "—",
        permissions: [],
        lastActivity: new Date().toISOString(),
        lastActivityAction: "Viewed Print Reports",
        activityCounts: {
          logins: 0,
          transactions: roznamchaEntries.length,
          purchases: orders.length,
          payments: 0,
          accounts: accountsList.length,
          edits: 0,
        },
      },
    });
  }, [sessionInfo, roznamchaEntries, orders, accountsList, scopeCountry, scopeBranch]);

  // 15. Daily Roznamcha Summary
  const handlePrintDailyRoznamcha = useCallback(() => {
    handlePrintCashEntries();
  }, [handlePrintCashEntries]);

  // 16. Ledger Balance Report
  const handlePrintLedgerBalance = useCallback(() => {
    if (ledgersList.length === 0 && accountsList.length === 0) {
      alert(tp("prep.no_ledger_data", "No ledger data available."));
      return;
    }
    const acc = accountsList[0] || { account_number: "—", contacts: {} };
    openAccountA4ReportWindow({
      title: tp("prep.ledger_balance_title", "Ledger Balance Report"),
      subtitle: tp("prep.ledger_balance_sub2", "Complete Ledger Balance Summary"),
      accountData: {
        accountName: acc.contacts?.accountTitle || acc.account_number || "—",
        accountCode: acc.account_number || "—",
        accountTitle: acc.contacts?.accountTitle || "—",
        subType: "Ledger",
        category: "Financial",
        currency: acc.currency_code || "",
        status: acc.status || "—",
        selectedCountryName: acc.country_name || scopeCountry || "—",
        selectedBranchName: acc.branch_name || scopeBranch || "—",
        createdBy: acc.created_by_name || "—",
      },
    });
  }, [ledgersList, accountsList, scopeCountry, scopeBranch]);

  // 17. Purchase Transfer Verification
  const handlePrintTransferVerification = useCallback(() => {
    handlePrintTransferPayment();
  }, [handlePrintTransferPayment]);

  /* Real operational metadata shared by every card — derived from the live
     activity-summary API + the logged-in session's own scope. No demo values. */
  const cardMeta = useMemo(() => {
    const gt = activityData?.grandTotal;
    const summary = sessionInfo?.scopes?.summary;
    const branches = (activityData?.branches || []).filter((b) => b.isActive);
    return {
      countryName: scopeCountry || summary?.countryName || "—",
      branchName: scopeBranch || summary?.branchDisplayName || summary?.branchName || "—",
      branchCode: summary?.branchCode || "—",
      periodFrom: "",
      periodTo: "",
      lastActiveTime: fmtDateTime(gt?.lastActivity ?? activityData?.generatedAt ?? null),
      activeUsersCount: gt?.activeBranches ?? branches.length,
      processPercent: null as number | null,
      processTimeRemaining: "",
      subBranches: branches.slice(0, 8).map((b) => ({
        name: b.branchName,
        code: b.branchCode || "—",
        status: b.isActive ? "Active" : "Inactive",
        users: 0,
        lastTime: fmtDateTime(b.lastActivity),
        progress: 0,
      })),
    };
  }, [activityData, sessionInfo, scopeCountry, scopeBranch]);

  /* ── REPORT CARDS REGISTRY ── */
  const reportCards = useMemo(() => [
    {
      id: "customer-ledger",
      title: tp("prep.customer_ledger_title", "Customer Ledger Report & Account Statement"),
      subtitle: tp("prep.customer_ledger_sub", "Roznamacha / Account Statement"),
      description: tp("prep.customer_ledger_desc", "Complete customer financial statement with opening balance, debit/credit transactions, closing balance, and Dr/Cr status."),
      format: "A4 Landscape",
      icon: BookOpen,
      color: "from-blue-600 to-indigo-700",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
      onPrint: handlePrintCustomerLedger,
      category: "Accounting",
      dataCount: roznamchaEntries.length,
      ...cardMeta
    },
    {
      id: "loading-records",
      title: tp("prep.loading_records_title", "Purchase Loading Records Report"),
      subtitle: tp("prep.loading_records_sub", "Container Loading & Status Register"),
      description: tp("prep.loading_records_desc", "23-column landscape report for tracking loading status, contract qty, gross/tare/net weights, rates, FC & LC amounts."),
      format: "A4 Landscape",
      icon: Ship,
      color: "from-emerald-600 to-teal-700",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      onPrint: handlePrintLoadingRecords,
      category: "Purchase",
      dataCount: loadingRecords.length || orders.length,
      ...cardMeta
    },
    {
      id: "finalized-po",
      title: tp("prep.finalized_po_title", "Finalized Purchase Orders Report"),
      subtitle: tp("prep.finalized_po_sub", "Completed Purchase Contracts"),
      description: tp("prep.finalized_po_desc", "Comprehensive summary of finalized purchase orders with DR/CR account breakdown, currency conversions, and completion status."),
      format: "A4 Landscape",
      icon: ClipboardList,
      color: "from-purple-600 to-violet-700",
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
      onPrint: handlePrintFinalizedPO,
      category: "Purchase",
      dataCount: orders.length,
      ...cardMeta
    },
    {
      id: "transfer-payment",
      title: tp("prep.transfer_payment_title", "Purchase Transfer Payment Voucher"),
      subtitle: tp("prep.transfer_payment_sub", "Official GL Settlement Voucher"),
      description: tp("prep.transfer_payment_desc", "Official voucher document with amount in digits and words, GL posting double-entry table, and cashier/manager signatures."),
      format: "A4 Portrait",
      icon: Coins,
      color: "from-amber-600 to-orange-700",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      onPrint: handlePrintTransferPayment,
      category: "Payment",
      dataCount: orders.length,
      ...cardMeta
    },
    {
      id: "cash-entries",
      title: tp("prep.cash_entries_title", "Recent Cash Entries (Roznamacha) Report"),
      subtitle: tp("prep.cash_entries_sub", "Daily Cash Journal Sheet"),
      description: tp("prep.cash_entries_desc", "Daily cash debit & credit transactions sheet featuring balanced status check, branch code postings, and narration log."),
      format: "A4 Portrait",
      icon: Wallet,
      color: "from-cyan-600 to-blue-700",
      badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
      onPrint: handlePrintCashEntries,
      category: "Cash",
      dataCount: roznamchaEntries.length,
      ...cardMeta
    },
    {
      id: "bank-entries",
      title: tp("prep.bank_entries_title", "Bank Entry Print"),
      subtitle: tp("prep.bank_entries_sub", "Bank Transactions Only"),
      description: tp("prep.bank_entries_desc", "Bank debit & credit transactions with bank name, instrument/cheque number, balanced status, branded letterhead and QR verification."),
      format: "A4 Landscape",
      icon: Wallet,
      color: "from-indigo-600 to-blue-700",
      badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
      onPrint: handlePrintBankEntries,
      category: "Bank",
      dataCount: roznamchaEntries.length,
      ...cardMeta
    },
    {
      id: "roznamcha-voucher",
      title: tp("prep.roznamcha_voucher_title", "Roznamcha Payment / Receipt Voucher"),
      subtitle: tp("prep.roznamcha_voucher_sub", "Cash Payment & Receipt Voucher"),
      description: tp("prep.roznamcha_voucher_desc", "Dual-copy (Office + Customer) voucher for cash payments and receipts with letterhead, amount in words, and signatures."),
      format: "A4 Portrait",
      icon: Receipt,
      color: "from-teal-600 to-cyan-700",
      badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
      onPrint: handlePrintRoznamchaVoucher,
      category: "Cash",
      dataCount: roznamchaEntries.length,
      ...cardMeta
    },
    {
      id: "sales-order",
      title: tp("prep.sales_order_title", "Sales Order Report"),
      subtitle: tp("prep.sales_order_sub", "Sales Booking Confirmation"),
      description: tp("prep.sales_order_desc", "Full sales order report with customer details, goods specification, pricing, payment status, and delivery tracking."),
      format: "A4 Portrait",
      icon: CreditCard,
      color: "from-indigo-600 to-blue-700",
      badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
      onPrint: handlePrintSalesOrder,
      category: "Sales",
      dataCount: salesOrders.length,
      ...cardMeta
    },
    {
      id: "account-statement",
      title: tp("prep.account_statement_title", "Account Statement Report"),
      subtitle: tp("prep.account_statement_sub", "Enterprise Account Detail Sheet"),
      description: tp("prep.account_statement_desc", "Detailed account master report showing account code, category, sub-type, currency, and connected customer/company/bank details."),
      format: "A4 Portrait",
      icon: Landmark,
      color: "from-sky-600 to-blue-700",
      badgeColor: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
      onPrint: handlePrintAccountStatement,
      category: "Accounting",
      dataCount: accountsList.length,
      ...cardMeta
    },
    {
      id: "proforma-invoice",
      title: tp("prep.proforma_invoice_title", "Proforma Invoice"),
      subtitle: tp("prep.proforma_invoice_sub", "Pre-Shipment Commercial Invoice"),
      description: tp("prep.proforma_invoice_desc", "Proforma invoice for international trade with goods breakdown, HS codes, shipping terms, and payment schedule."),
      format: "A4 Portrait",
      icon: FileBadge,
      color: "from-orange-500 to-amber-700",
      badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
      onPrint: handlePrintProformaInvoice,
      category: "Trade",
      dataCount: orders.length,
      ...cardMeta
    },
    {
      id: "expenses-bill",
      title: tp("prep.expenses_bill_title", "Expenses Bill Report"),
      subtitle: tp("prep.expenses_bill_sub", "Expense Voucher & Breakdown"),
      description: tp("prep.expenses_bill_desc", "Detailed expense bill report with line items, tax calculations, exchange rates, and GL double-entry postings."),
      format: "A4 Portrait",
      icon: ScrollText,
      color: "from-red-500 to-rose-700",
      badgeColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
      onPrint: handlePrintExpenses,
      category: "Expenses",
      dataCount: 0,
      ...cardMeta
    },
    {
      id: "trade-document",
      title: tp("prep.trade_document_title", "Trade Contract Document"),
      subtitle: tp("prep.trade_document_sub", "International Trade Agreement"),
      description: tp("prep.trade_document_desc", "Official trade contract document with shipping details, container numbers, port information, and terms of delivery."),
      format: "A4 Portrait",
      icon: FileBarChart,
      color: "from-violet-600 to-purple-700",
      badgeColor: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
      onPrint: handlePrintTradeDocument,
      category: "Trade",
      dataCount: orders.length,
      ...cardMeta
    },
    {
      id: "purchase-a4",
      title: tp("prep.purchase_a4_title", "Purchase A4 Full Report"),
      subtitle: tp("prep.purchase_a4_sub", "Complete Purchase Detail Sheet"),
      description: tp("prep.purchase_a4_desc", "Full A4 portrait purchase report with all booking details, goods specification, payment history, and workflow journey."),
      format: "A4 Portrait",
      icon: FileCheck,
      color: "from-green-600 to-emerald-700",
      badgeColor: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
      onPrint: handlePrintPurchaseA4,
      category: "Purchase",
      dataCount: orders.length,
      ...cardMeta
    },
    {
      id: "user-activity",
      title: tp("prep.user_activity_title", "User Activity Report"),
      subtitle: tp("prep.user_activity_sub", "ERP User Audit Trail"),
      description: tp("prep.user_activity_desc", "User activity summary showing login count, transaction count, and module usage statistics."),
      format: "A4 Portrait",
      icon: Users,
      color: "from-slate-600 to-gray-700",
      badgeColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
      onPrint: handlePrintUserActivity,
      category: "Audit",
      dataCount: roznamchaEntries.length + orders.length + accountsList.length,
      ...cardMeta
    },
    {
      id: "daily-roznamcha",
      title: tp("prep.daily_roznamcha_title", "Daily Roznamcha Summary"),
      subtitle: tp("prep.daily_roznamcha_sub", "Day-End Cash Journal Report"),
      description: tp("prep.daily_roznamcha_desc", "End-of-day summary of all cash entries, receipts, and payments for a specific branch."),
      format: "A4 Portrait",
      icon: Scale,
      color: "from-yellow-600 to-amber-700",
      badgeColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
      onPrint: handlePrintDailyRoznamcha,
      category: "Cash",
      dataCount: roznamchaEntries.length,
      ...cardMeta
    },
    {
      id: "ledger-balance",
      title: tp("prep.ledger_balance_title", "Ledger Balance Report"),
      subtitle: tp("prep.ledger_balance_sub", "GL Ledger Balance Sheet"),
      description: tp("prep.ledger_balance_desc", "Complete ledger balance report showing debit totals, credit totals, and current balance for each ledger account."),
      format: "A4 Portrait",
      icon: BarChart3,
      color: "from-fuchsia-600 to-pink-700",
      badgeColor: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
      onPrint: handlePrintLedgerBalance,
      category: "Accounting",
      dataCount: ledgersList.length,
      ...cardMeta
    },
    {
      id: "transfer-verification",
      title: tp("prep.transfer_verification_title", "Purchase Transfer Verification Sheet"),
      subtitle: tp("prep.transfer_verification_sub", "SAP/Oracle Grade Audit Sheet"),
      description: tp("prep.transfer_verification_desc", "Enterprise-grade transfer verification with workflow pipeline, KPI cards, GL double-entry matrix, and 5-language support."),
      format: "A4 Portrait",
      icon: ArrowRightLeft,
      color: "from-emerald-700 to-green-800",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      onPrint: handlePrintTransferVerification,
      category: "Purchase",
      dataCount: orders.length,
      ...cardMeta
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [lang, handlePrintCustomerLedger, handlePrintLoadingRecords, handlePrintFinalizedPO, handlePrintTransferPayment, handlePrintCashEntries, handlePrintPurchaseBooking, handlePrintRoznamchaVoucher, handlePrintSalesOrder, handlePrintAccountStatement, handlePrintProformaInvoice, handlePrintExpenses, handlePrintTradeDocument, handlePrintPurchaseA4, handlePrintUserActivity, handlePrintDailyRoznamcha, handlePrintLedgerBalance, handlePrintTransferVerification, roznamchaEntries, loadingRecords, orders, salesOrders, accountsList, ledgersList, selectedCountry, selectedBranch]);

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return reportCards;
    const q = searchQuery.toLowerCase();
    return reportCards.filter(c => c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [searchQuery, reportCards]);

  /* ── UNIQUE COUNTRIES/BRANCHES FOR FILTERS ── */
  const countries = useMemo(() => {
    if (!activityData) return ["All Countries"];
    const names = [...new Set(activityData.branches.map(b => b.countryName))].sort();
    return ["All Countries", ...names];
  }, [activityData]);

  const branchNames = useMemo(() => {
    if (!activityData) return ["All Branches"];
    let branches = activityData.branches;
    if (selectedCountry !== "All Countries") {
      branches = branches.filter(b => b.countryName === selectedCountry);
    }
    return ["All Branches", ...branches.map(b => b.branchName).sort()];
  }, [activityData, selectedCountry]);

  /* ────────────────────────────────────────────────────────────
     RENDER
     ──────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 p-4 sm:p-6 text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-950 min-h-screen">

      {/* ═══════ TOP BANNER BAR WITH ROLE SCOPE SWITCHER ═══════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            <span>{tp("nav.dashboard", "Dashboard")}</span><span>›</span><span>{tp("prep.reports_hub", "Reports Hub")}</span><span>›</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">{tp("prep.hub_crumb", "All Super Admin Journal Reporting")}</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Printer className="h-7 w-7 text-blue-600" />
            {tp("prep.hub_title", "All Super Admin Journal Reporting & Print Hub")}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {tp("prep.hub_desc_1", "Control ERP reporting hub with")} {reportCards.length} {tp("prep.hub_desc_2", "reports connected to live database • Auto-refresh every 60s")}
          </p>
        </div>

        {/* Role Scope & Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Role Scope Switcher Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setRoleScope("super_admin")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                roleScope === "super_admin"
                  ? "bg-slate-900 text-white shadow-xs dark:bg-slate-950"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {tp("prep.scope_super_admin", "Super Admin Scope")}
            </button>
            <button
              type="button"
              onClick={() => setRoleScope("country_admin")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                roleScope === "country_admin"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {tp("prep.scope_country_admin", "Country Admin Scope")}
            </button>
            <button
              type="button"
              onClick={() => setRoleScope("branch_admin")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                roleScope === "branch_admin"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {tp("prep.scope_branch_admin", "Branch Admin Scope")}
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <Button type="button" variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className={`h-8 text-xs font-bold gap-1.5 px-3 rounded-lg ${viewMode === "table" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"}`}>
              <TableIcon className="h-3.5 w-3.5" /> Table View
            </Button>
            <Button type="button" variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className={`h-8 text-xs font-bold gap-1.5 px-3 rounded-lg ${viewMode === "grid" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Grid Cards
            </Button>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => { void fetchActivitySummary(); void fetchLiveData(); }} className="h-9 text-xs font-semibold">
            <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 text-slate-600 ${loading || activityLoading ? "animate-spin" : ""}`} /> Refresh All
          </Button>
        </div>
      </div>

      {/* ═══════ ERP ACTIVITY SUMMARY DASHBOARD ═══════ */}
      {showActivityDashboard && (
        <div className="space-y-4">
          {/* KPI Summary Strip */}
          {activityData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: tp("prep.kpi_purchases", "Purchases"), value: activityData.grandTotal.purchases, icon: ClipboardList, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40" },
                { label: tp("prep.kpi_sales", "Sales"), value: activityData.grandTotal.sales, icon: CreditCard, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
                { label: tp("prep.kpi_journal", "Journal"), value: activityData.grandTotal.journalEntries, icon: BookOpen, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
                { label: tp("prep.kpi_cash", "Cash"), value: activityData.grandTotal.cashEntries, icon: Wallet, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
                { label: tp("prep.kpi_payments", "Payments"), value: activityData.grandTotal.payments, icon: Coins, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
                { label: tp("prep.kpi_ledgers", "Ledgers"), value: activityData.grandTotal.ledgerEntries, icon: BarChart3, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
                { label: tp("prep.kpi_accounts", "Accounts"), value: activityData.grandTotal.accounts, icon: Landmark, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/40" },
                { label: tp("prep.kpi_active", "Active"), value: `${activityData.grandTotal.activeBranches}/${activityData.grandTotal.totalBranches}`, icon: Building2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
              ].map((kpi) => {
                const KpiIcon = kpi.icon;
                return (
                  <Card key={kpi.label} className={`${kpi.bg} border-0 shadow-xs`}>
                    <CardContent className="p-3 flex items-center gap-2.5">
                      <KpiIcon className={`h-5 w-5 ${kpi.color} shrink-0`} />
                      <div>
                        <div className="text-lg font-black text-slate-900 dark:text-white leading-none">{kpi.value}</div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">{kpi.label}</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════ FILTER CONTROL STRIP ═══════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search report name, category, or description..." className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition" />
          </div>

          <select value={selectedCountry} onChange={(e) => { setSelectedCountry(e.target.value); setSelectedBranch("All Branches"); }} className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            {branchNames.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="text-[11px] font-bold text-slate-500">
          Showing <span className="text-slate-900 dark:text-white font-extrabold">{filteredCards.length}</span> of {reportCards.length} Reports
          <span className="mx-2 text-slate-300">|</span>
          <span className="text-emerald-600 font-extrabold">{orders.length + salesOrders.length + roznamchaEntries.length}</span> live records loaded
        </div>
      </div>

      {/* ═══════ TABLE VIEW WITH EXPANDABLE TREE & PROCESS TIME BAR ═══════ */}
      {viewMode === "table" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900" ref={menuRef}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 dark:bg-slate-950 text-white font-extrabold uppercase text-[10px] border-b border-slate-700">
                  <Th className="px-3 py-3 text-center w-12">+ / -</Th>
                  <Th className="px-4 py-3 min-w-[200px]">Report / Form Name</Th>
                  <Th className="px-3 py-3">Assigned Country</Th>
                  <Th className="px-3 py-3 min-w-[140px]">Branch Name & Code</Th>
                  <Th className="px-3 py-3 min-w-[140px]">Records in Scope</Th>
                  <Th className="px-3 py-3 min-w-[130px]">Last Active Time</Th>
                  <Th className="px-3 py-3 text-center">Active Users</Th>
                  <Th className="px-3 py-3 text-center w-12">Actions (•••)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCards.map((card, index) => {
                  const Icon = card.icon;
                  const isMenuOpen = activeMenuId === card.id;
                  const isExpanded = expandedRowIds.has(card.id);

                  return (
                    <React.Fragment key={card.id}>
                      {/* Main Level Row */}
                      <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                        {/* Plus / Minus Expand Toggle Button */}
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRowExpand(card.id)}
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-lg font-black text-xs transition-all shadow-xs",
                              isExpanded
                                ? "bg-rose-500 text-white hover:bg-rose-600"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            )}
                            title={isExpanded ? "Collapse Country Branch Table" : "Expand Country Branch Table"}
                          >
                            {isExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        
                        {/* Form / Report Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl bg-gradient-to-r ${card.color} text-white shrink-0 shadow-xs`}><Icon className="h-4 w-4" /></div>
                            <div>
                              <span className="font-extrabold text-slate-900 dark:text-white block text-xs group-hover:text-blue-600 transition-colors">{card.title}</span>
                              <span className="text-[10px] text-slate-500 font-medium">{card.subtitle}</span>
                            </div>
                          </div>
                        </td>

                        {/* Country */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <Globe2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{card.countryName}</span>
                          </div>
                        </td>

                        {/* Branch Name & Code */}
                        <td className="px-3 py-3">
                          <div className="font-extrabold text-slate-900 dark:text-white text-xs">{card.branchName}</div>
                          <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold">{card.branchCode}</div>
                        </td>

                        {/* Records in scope */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{card.dataCount > 0 ? `${card.dataCount} record${card.dataCount === 1 ? "" : "s"}` : "No data"}</span>
                          </div>
                        </td>

                        {/* Last Active Time */}
                        <td className="px-3 py-3">
                          <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 font-mono">{card.lastActiveTime}</div>
                        </td>

                        {/* Active Users Count */}
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold border border-emerald-200 dark:border-emerald-800">
                            <UserCheck className="h-3 w-3" /> {card.activeUsersCount} Active
                          </span>
                        </td>

                        {/* 3-Dots Action Dropdown */}
                        <td className="px-3 py-3 text-center relative">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setActiveMenuId(isMenuOpen ? null : card.id)}
                            className="h-8 w-8 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                          {isMenuOpen && (
                            <div className="absolute right-4 top-12 z-[120] w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 text-left animate-in fade-in zoom-in-95 duration-100">
                              <div className="px-2.5 py-1 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">{tp("prep.report_actions", "Report Actions")}</div>
                              <button
                                type="button"
                                onClick={() => { card.onPrint(); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 transition-colors"
                              >
                                <Printer className="h-3.5 w-3.5 text-blue-600" /> Open & Print A4 (PDF)
                              </button>
                              <button
                                type="button"
                                onClick={() => { card.onPrint(); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 transition-colors"
                              >
                                <Download className="h-3.5 w-3.5 text-emerald-600" /> Save PDF Document
                              </button>
                              <button
                                type="button"
                                onClick={() => { card.onPrint(); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950 hover:text-teal-600 transition-colors"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" /> Export to Excel
                              </button>
                              <button
                                type="button"
                                onClick={() => { card.onPrint(); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 transition-colors border-t border-slate-100 dark:border-slate-800 mt-1 pt-1.5"
                              >
                                <Eye className="h-3.5 w-3.5 text-indigo-600" /> View Table Details
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* EXPANDED INNER BRANCHES & PROCESS TIME PROGRESS BAR */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                          <td colSpan={8} className="p-4">
                            <div className="rounded-xl border border-blue-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">

                              {/* Live report status */}
                              <div className="flex items-center gap-2.5 bg-blue-50/60 dark:bg-blue-950/40 p-3 rounded-lg border border-blue-100 dark:border-blue-900/40">
                                <div className="p-1.5 rounded-lg bg-blue-600 text-white"><Timer className="h-4 w-4" /></div>
                                <div>
                                  <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                                    {card.dataCount > 0 ? `${card.dataCount} live record${card.dataCount === 1 ? "" : "s"} ready for this report` : "Waiting for data — this report will populate once records exist in scope"}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-semibold">
                                    Last activity: {card.lastActiveTime}
                                  </span>
                                </div>
                              </div>

                              {/* Active branches in scope (from the live activity summary) */}
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                                  <Building2 className="h-3 w-3 text-blue-500" /> {tp("prep.active_branches", "Active Branches")} {card.countryName !== "—" ? `— ${card.countryName}` : ""}
                                </div>
                                {card.subBranches.length === 0 && (
                                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 px-3 py-4 text-center text-[11px] text-slate-400">
                                    {tp("prep.no_branch_activity", "No active branch activity in the current scope.")}
                                  </div>
                                )}
                                {card.subBranches.length > 0 && (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-[9.5px] font-black uppercase">
                                        <Th className="px-3 py-2">Branch Name</Th>
                                        <Th className="px-3 py-2">Branch Code</Th>
                                        <Th className="px-3 py-2 text-center">Status</Th>
                                        <Th className="px-3 py-2 text-center">Active Staff Users</Th>
                                        <Th className="px-3 py-2 text-center">Last Active Time</Th>
                                        <Th className="px-3 py-2 text-center">Progress %</Th>
                                        <Th className="px-3 py-2 text-center">Form Actions</Th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {card.subBranches.map((sub, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                          <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{sub.name}</td>
                                          <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400 font-bold">{sub.code}</td>
                                          <td className="px-3 py-2 text-center">
                                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                              {sub.status}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-300">{sub.users} {tp("prep.staff_users", "Staff Users")}</td>
                                          <td className="px-3 py-2 text-center font-mono text-slate-500">{sub.lastTime}</td>
                                          <td className="px-3 py-2 text-center font-bold text-indigo-600 dark:text-indigo-400">{sub.progress}%</td>
                                          <td className="px-3 py-2 text-center">
                                            <button
                                              type="button"
                                              onClick={card.onPrint}
                                              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition-all shadow-xs"
                                            >
                                              {tp("prep.open_form_report", "Open Form / Report")}
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ GRID VIEW ═══════ */}
      {viewMode === "grid" && (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className={`p-4 bg-gradient-to-r ${card.color} text-white flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs"><Icon className="h-6 w-6 text-white" /></div>
                      <div>
                        <h3 className="text-sm font-black tracking-tight leading-snug">{card.title}</h3>
                        <p className="text-[10px] text-white/80 font-medium">{card.subtitle}</p>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${card.badgeColor}`}>{card.format}</span>
                      <span className={`font-bold flex items-center gap-1 ${card.dataCount > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {card.dataCount > 0 ? <><CheckCircle2 className="h-3 w-3" /> {card.dataCount} rows</> : "Awaiting data"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-normal">{card.description}</p>
                    <div className="text-[10px] font-bold text-slate-500">
                      Country: <span className="text-slate-900 dark:text-white font-extrabold">{card.countryName}</span> • Branch: <span className="text-blue-600 font-mono font-bold">{card.branchCode}</span>
                    </div>
                  </CardContent>
                </div>
                <div className="p-4 pt-0 gap-2 flex flex-col border-t border-slate-100 dark:border-slate-800/60 mt-2">
                  <Button type="button" onClick={card.onPrint} className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2">
                    <Printer className="h-4 w-4" /> Open Preview & Print Report
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════ SYSTEM NOTE BANNER ═══════ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 font-bold">💡</div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white">How Print & PDF Downloads Work:</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Clicking the <strong>&quot;+&quot;</strong> icon expands the Country & Branch structure and live processing timer. Clicking <strong>&quot;Open Preview & Print Report&quot;</strong> or <strong>&quot;Save PDF&quot;</strong> inside the <strong>••• (More Actions)</strong> menu opens an A4 formatted window complete with your official company letterhead and signature strips.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
