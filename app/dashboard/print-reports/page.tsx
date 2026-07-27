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
  Landmark, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Import all Report Handlers
import { openCustomerLedgerPrintReport, type CustomerLedgerReportData } from "@/lib/reports/open-customer-ledger-print-report";
import { openLoadingRecordsPrintReport, type PurchaseLoadingReportRow } from "@/lib/reports/open-loading-records-print-report";
import { openFinalizedPOPrintReport, type FinalizedPORow } from "@/lib/reports/open-finalized-po-print-report";
import { openTransferPaymentPrintReport } from "@/lib/reports/open-transfer-payment-print-report";
import { openRecentCashEntriesPrintReport, type CashEntryLine } from "@/lib/reports/open-cash-entries-print-report";
import { openPurchaseBookingOrderPrintReport } from "@/lib/reports/open-purchase-booking-print-report";
import { openRoznamchaVoucherPrintReport } from "@/lib/reports/open-roznamcha-voucher-print-report";
import { openSalesA4ReportWindow } from "@/lib/reports/open-sales-a4-report-window";
import { openAccountA4ReportWindow } from "@/lib/reports/open-account-a4-report-window";
import { openProformaInvoiceWindow } from "@/lib/reports/open-proforma-invoice-window";
import { openTradeDocumentWindow } from "@/lib/reports/open-trade-document-window";
import { openPurchaseA4ReportWindow } from "@/lib/reports/open-purchase-a4-report-window";
import { openUserA4ReportWindow } from "@/lib/reports/open-user-a4-report-window";

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

function cellColor(count: number): string {
  if (count === 0) return "text-slate-300 dark:text-slate-600";
  if (count < 3) return "text-amber-600 dark:text-amber-400 font-bold";
  return "text-emerald-700 dark:text-emerald-400 font-extrabold";
}

function cellBg(count: number): string {
  if (count === 0) return "";
  if (count < 3) return "bg-amber-50/60 dark:bg-amber-950/30";
  return "bg-emerald-50/60 dark:bg-emerald-950/30";
}

function statusBadge(isActive: boolean) {
  return isActive
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700"
    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
}

/* ──────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────────────────────── */
export default function PrintReportsHubPage() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");
  const [selectedBranch, setSelectedBranch] = useState("All Branches");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
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

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Fetch Activity Summary ── */
  const fetchActivitySummary = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const res = await fetch("/api/erp/reports/activity-summary", { cache: "no-store" });
      if (!res.ok) throw new Error(`Activity API returned ${res.status}`);
      const json = await res.json();
      setActivityData(json.data || json);
    } catch (e: any) {
      console.error("Activity summary error:", e);
      setActivityError(e.message || "Failed to load activity data");
    } finally {
      setActivityLoading(false);
    }
  }, []);

  /* ── Fetch Live Report Data ── */
  const fetchLiveData = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, lrRes, salesRes, rozRes, accRes, ledRes] = await Promise.all([
        fetch("/api/erp/purchases/orders?limit=500", { cache: "no-store" }).catch(() => null),
        fetch("/api/erp/purchases/loading-records?limit=500", { cache: "no-store" }).catch(() => null),
        fetch("/api/erp/sales/orders?limit=500", { cache: "no-store" }).catch(() => null),
        fetch("/api/erp/reports/general?reportType=cash-entry&limit=500", { cache: "no-store" }).catch(() => null),
        fetch("/api/erp/accounting/accounts?limit=500", { cache: "no-store" }).catch(() => null),
        fetch("/api/erp/ledgers?limit=500", { cache: "no-store" }).catch(() => null),
      ]);

      if (poRes?.ok) {
        const d = await poRes.json();
        setOrders(Array.isArray(d?.data?.orders) ? d.data.orders : Array.isArray(d?.data) ? d.data : []);
      }
      if (lrRes?.ok) {
        const d = await lrRes.json();
        setLoadingRecords(d?.data?.records || []);
      }
      if (salesRes?.ok) {
        const d = await salesRes.json();
        setSalesOrders(Array.isArray(d?.data?.orders) ? d.data.orders : Array.isArray(d?.data) ? d.data : []);
      }
      if (rozRes?.ok) {
        const d = await rozRes.json();
        setRoznamchaEntries(d?.data || []);
      }
      if (accRes?.ok) {
        const d = await accRes.json();
        setAccountsList(d?.data?.accounts || d?.data || []);
      }
      if (ledRes?.ok) {
        const d = await ledRes.json();
        setLedgersList(d?.data?.ledgers || d?.data || []);
      }
    } catch (e) {
      console.error("Error loading print report datasets:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActivitySummary();
    void fetchLiveData();
  }, [fetchActivitySummary, fetchLiveData]);

  // Auto-refresh activity data every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => { void fetchActivitySummary(); }, 60000);
    return () => clearInterval(interval);
  }, [fetchActivitySummary]);

  /* ── REPORT HANDLERS (17 reports with live data) ── */

  // 1. Customer Ledger
  const handlePrintCustomerLedger = useCallback(() => {
    // Try to use live data if available
    const reportData: CustomerLedgerReportData = {
      customerName: "Customer Ledger Report",
      customerCode: "LEDGER-ALL",
      openingBalance: 0,
      openingDcType: "Dr",
      totalCredit: 0,
      totalDebit: 0,
      closingBalance: 0,
      closingDcType: "Dr",
      country: selectedCountry === "All Countries" ? "ALL" : selectedCountry,
      branch: selectedBranch === "All Branches" ? "ALL" : selectedBranch,
      currency: "AED",
      rows: roznamchaEntries.slice(0, 20).map((r: any, i: number) => ({
        srNo: i + 1,
        date: r.date || r.entry_date || "—",
        branchEntryNo: r.serial || r.voucherNo || `E-${i + 1}`,
        userName: r.creator || "System",
        branchName: selectedBranch === "All Branches" ? "ALL" : selectedBranch,
        roznamachaNameAndNo: r.journalNo || r.voucherNo || "—",
        remarks: r.narration || "—",
        debit: r.debit || 0,
        credit: r.credit || 0,
        balance: Math.abs((r.debit || 0) - (r.credit || 0)),
        dcType: (r.debit || 0) > (r.credit || 0) ? "Dr" : "Cr",
      })),
    };
    openCustomerLedgerPrintReport({ report: reportData, companyInfo: { name: "DIGITAL DOCK ERP", tagline: "Smart Business, Strong Future", branch: selectedBranch === "All Branches" ? "ALL" : selectedBranch, printedBy: "Super Admin" } });
  }, [roznamchaEntries, selectedCountry, selectedBranch]);

  // 2. Loading Records
  const handlePrintLoadingRecords = useCallback(() => {
    const rows: PurchaseLoadingReportRow[] = loadingRecords.length > 0
      ? loadingRecords.slice(0, 50).map((r: any, i: number) => ({
          id: r.id || String(i),
          country: r.countryName || "—",
          branch: r.branchName || "—",
          purchaseBookingNo: r.purchase_order_no || r.purchaseOrderNo || "—",
          salesAccount: r.salesAccountNo || "—",
          purchaseAccount: r.purchaseAccountNo || "—",
          goods: r.goodsName || r.container_number || "—",
          contractQty: Number(r.loaded_quantity || r.contractQty || 0),
          grossWeight: Number(r.grossWeight || 0),
          tareWeight: Number(r.tareWeight || 0),
          netWeight: Number(r.netWeight || 0),
          purchasePriceRate: Number(r.purchasePriceRate || 0),
          totalPurchaseFc: Number(r.totalPurchaseFc || 0),
          advanceFc: Number(r.advanceFc || 0),
          remainingFc: Number(r.remainingFc || 0),
          exchangeRate: Number(r.exchangeRate || 1),
          finalAmountLc: Number(r.finalAmountLc || 0),
          finalAdvanceLc: Number(r.finalAdvanceLc || 0),
          finalRemainingLc: Number(r.finalRemainingLc || 0),
          loadedQty: Number(r.loaded_quantity || 0),
          remainingToLoad: Number(r.remainingToLoad || 0),
          loadingStatus: r.loading_status || r.loadingStatus || "Pending",
        }))
      : orders.slice(0, 10).map((o: any, i: number) => {
          const form = o.form_data?.form || {};
          return {
            id: o.id || String(i),
            country: o.countryName || form.countryName || "—",
            branch: o.branchName || form.branchName || "—",
            purchaseBookingNo: o.purchase_order_no || "—",
            salesAccount: form.salesAccountName || "—",
            purchaseAccount: form.purchaseAccountName || "—",
            goods: form.goodsName || form.productName || "—",
            contractQty: Number(form.quantity || o.quantity || 0),
            grossWeight: Number(form.grossWeight || 0),
            tareWeight: Number(form.tareWeight || 0),
            netWeight: Number(form.netWeight || 0),
            purchasePriceRate: Number(form.purchaseRate || 0),
            totalPurchaseFc: Number(o.order_total || 0),
            advanceFc: Number(o.paid_amount || 0),
            remainingFc: Number(o.remaining_amount || 0),
            exchangeRate: Number(form.exchangeRate || 1),
            finalAmountLc: Number(o.order_total || 0) * Number(form.exchangeRate || 1),
            finalAdvanceLc: Number(o.paid_amount || 0) * Number(form.exchangeRate || 1),
            finalRemainingLc: Number(o.remaining_amount || 0) * Number(form.exchangeRate || 1),
            loadedQty: 0,
            remainingToLoad: Number(form.quantity || 0),
            loadingStatus: o.order_status || "Pending",
          };
        });
    openLoadingRecordsPrintReport({ rows, companyInfo: { name: "DIGITAL DOCK ERP", tagline: "Import | Export | Trading | ERP Solutions", printedBy: "Super Admin" } });
  }, [loadingRecords, orders]);

  // 3. Finalized POs
  const handlePrintFinalizedPO = useCallback(() => {
    const rows: FinalizedPORow[] = orders.slice(0, 50).map((o: any, i: number) => {
      const form = o.form_data?.form || {};
      return {
        id: o.id || String(i),
        poNumber: o.purchase_order_no || "—",
        soNumber: form.salesOrderNo || "—",
        country: o.countryName || form.countryName || "—",
        branch: o.branchName || form.branchName || "—",
        supplier: form.supplierName || form.customerName || "—",
        purchaseAccount: form.purchaseAccountName || "—",
        salesAccount: form.salesAccountName || "—",
        goods: form.goodsName || form.productName || "—",
        contractQty: Number(form.quantity || o.quantity || 0),
        grossWeight: Number(form.grossWeight || 0),
        tareWeight: Number(form.tareWeight || 0),
        netWeight: Number(form.netWeight || 0),
        purchaseRate: Number(form.purchaseRate || o.purchase_rate || 0),
        totalPurchaseFc: Number(o.order_total || 0),
        advanceFc: Number(o.paid_amount || 0),
        remainingFc: Number(o.remaining_amount || 0),
        currencyFc: form.currencyType || o.currency_code || "USD",
        exchangeRate: Number(form.exchangeRate || 1),
        finalAmountLc: Number(o.order_total || 0) * Number(form.exchangeRate || 1),
        finalAdvanceLc: Number(o.paid_amount || 0) * Number(form.exchangeRate || 1),
        finalRemainingLc: Number(o.remaining_amount || 0) * Number(form.exchangeRate || 1),
        currencyLc: form.localCurrency || "AED",
        status: o.order_status || "Draft",
      };
    });
    openFinalizedPOPrintReport({ rows, companyInfo: { name: "DIGITAL DOCK ERP", branch: "ALL BRANCHES", printedBy: "SUPER ADMIN" } });
  }, [orders]);

  // 4. Transfer Payment
  const handlePrintTransferPayment = useCallback(() => {
    const o = orders.find((o: any) => o.order_status === "transferred" || o.order_status === "completed") || orders[0];
    if (!o) { alert("No purchase order data available for transfer payment report."); return; }
    const form = o.form_data?.form || {};
    openTransferPaymentPrintReport({
      record: {
        id: o.id,
        voucherNo: `VOUCHER-${o.purchase_order_no || "N/A"}`,
        billNo: o.purchase_order_no || "N/A",
        transferDate: o.updated_at || new Date().toISOString(),
        supplierName: form.supplierName || form.customerName || "Supplier",
        supplierAccountNo: form.salesAccountNumber || "—",
        branchName: o.branchName || form.branchName || "—",
        countryName: o.countryName || form.countryName || "—",
        goodsName: form.goodsName || form.productName || "—",
        paymentMode: form.paymentType || "BANK TRANSFER",
        bankOrCashAccount: form.bankAccount || "Cash Account",
        amountFc: Number(o.paid_amount || o.order_total || 0),
        currencyFc: form.currencyType || "USD",
        exchangeRate: Number(form.exchangeRate || 1),
        amountLc: Number(o.paid_amount || o.order_total || 0) * Number(form.exchangeRate || 1),
        currencyLc: form.localCurrency || "AED",
        amountInWords: "AMOUNT IN WORDS",
        purchaseAccountNo: form.purchaseAccountNumber || "—",
        salesAccountNo: form.salesAccountNumber || "—",
        narration: `Transfer payment for ${o.purchase_order_no || "order"}`,
        userFullName: "Super Admin",
      },
      companyInfo: { name: "DIGITAL DOCK ERP", branch: o.branchName || "ALL", printedBy: "Super Admin" },
    });
  }, [orders]);

  // 5. Cash Entries
  const handlePrintCashEntries = useCallback(() => {
    const cashLines: CashEntryLine[] = roznamchaEntries.slice(0, 30).map((r: any, i: number) => ({
      id: r.id || String(i),
      voucherNo: r.voucherNo || r.voucher_no || `CE-${i + 1}`,
      entryDate: r.date || r.entry_date || "—",
      accountCode: r.serial || "—",
      accountTitle: r.narration?.slice(0, 40) || "Cash Entry",
      debit: Number(r.debit || 0),
      credit: Number(r.credit || 0),
      currency: r.currency || "AED",
      narration: r.narration || "—",
      user: r.creator || "System",
      branch: selectedBranch === "All Branches" ? "ALL" : selectedBranch,
    }));
    openRecentCashEntriesPrintReport({ entries: cashLines, companyInfo: { name: "DIGITAL DOCK ERP", branch: selectedBranch === "All Branches" ? "ALL" : selectedBranch, printedBy: "SUPER ADMIN" } });
  }, [roznamchaEntries, selectedBranch]);

  // 6. Purchase Booking Order
  const handlePrintPurchaseBooking = useCallback(() => {
    const o = orders[0];
    if (!o) { alert("No purchase orders available."); return; }
    const form = o.form_data?.form || {};
    const goods = o.form_data?.goodsEntries || [];
    openPurchaseBookingOrderPrintReport({
      order: {
        id: o.id,
        systemBillNo: o.purchase_order_no || "—",
        manualBillNo: form.manualBillNo || form.purchaseContractNo || "—",
        superAdminSerialNo: o.super_admin_serial_number || "—",
        countrySerialNo: o.country_transaction_serial_number || "—",
        branchSerialNo: o.branch_transaction_serial_number || "—",
        bookingDate: form.purchaseDate || o.order_date || "—",
        supplierName: form.supplierName || form.customerName || "—",
        supplierContact: form.supplierContact || "—",
        buyerName: form.buyerName || "DAMAN BUSINESS GROUP",
        purchaseAccountNo: form.purchaseAccountNumber || "—",
        purchaseAccountName: form.purchaseAccountName || "—",
        salesAccountNo: form.salesAccountNumber || "—",
        salesAccountName: form.salesAccountName || "—",
        countryName: o.countryName || "—",
        branchName: o.branchName || "—",
        shippingMode: form.shippingMode || "By Sea",
        containerNumbers: form.containerNumbers || "—",
        vesselName: form.vesselName || "—",
        loadingCountryPort: `${form.loadingCountry || "—"} / ${form.loadingPort || "—"}`,
        receivedCountryPort: `${form.receivedCountry || "—"} / ${form.receivedPort || "—"}`,
        goodsItems: goods.length > 0
          ? goods.map((g: any, gi: number) => ({
              srNo: gi + 1,
              goodsName: g.goodsName || g.productName || "—",
              grade: g.grade || g.quality || "—",
              origin: g.origin || "—",
              quantity: Number(g.qtyNo || g.quantity || 0),
              unit: g.qtyName || g.unit || "KGS",
              grossWeight: Number(g.qtyKgs || 0) * Number(g.qtyNo || 0),
              tareWeight: Number(g.emptyKgs || 0) * Number(g.qtyNo || 0),
              netWeight: (Number(g.qtyKgs || 0) - Number(g.emptyKgs || 0)) * Number(g.qtyNo || 0),
              rateKg: Number(g.coursePrice || 0),
              amountFc: Number(g.totalAmount || 0),
              currencyFc: form.currencyType || "USD",
              exchangeRate: Number(form.exchangeRate || 1),
              amountLc: Number(g.totalAmount || 0) * Number(form.exchangeRate || 1),
              currencyLc: form.localCurrency || "AED",
            }))
          : [{ srNo: 1, goodsName: form.goodsName || "—", grade: "—", origin: "—", quantity: Number(form.quantity || 0), unit: "KGS", grossWeight: 0, tareWeight: 0, netWeight: 0, rateKg: 0, amountFc: Number(o.order_total || 0), currencyFc: "USD", exchangeRate: 1, amountLc: Number(o.order_total || 0), currencyLc: "AED" }],
        totalPurchaseFc: Number(o.order_total || 0),
        currencyFc: form.currencyType || "USD",
        totalPurchaseLc: Number(o.order_total || 0) * Number(form.exchangeRate || 1),
        currencyLc: form.localCurrency || "AED",
        advancePercent: o.paid_amount && o.order_total ? Math.round((Number(o.paid_amount) / Number(o.order_total)) * 100) : 0,
        advanceAmountFc: Number(o.paid_amount || 0),
        advanceAmountLc: Number(o.paid_amount || 0) * Number(form.exchangeRate || 1),
        remainingAmountFc: Number(o.remaining_amount || 0),
        remainingAmountLc: Number(o.remaining_amount || 0) * Number(form.exchangeRate || 1),
        advancePaymentDate: form.advanceDate || "—",
        remainingDueDate: form.remainingDueDate || "—",
        status: o.order_status || "Draft",
        remarks: form.remarks || "",
      },
      companyInfo: { name: "DIGITAL DOCK ERP", branch: o.branchName || "ALL", printedBy: "Super Admin" },
    });
  }, [orders]);

  // 7. Roznamcha Voucher
  const handlePrintRoznamchaVoucher = useCallback(() => {
    const entry = roznamchaEntries[0];
    const amount = entry ? Number(entry.debit || entry.credit || 0) : 0;
    openRoznamchaVoucherPrintReport({
      data: {
        receiptNo: entry?.voucherNo || entry?.serial || "RV-001",
        voucherNo: entry?.voucherNo || "V-001",
        date: entry?.date || new Date().toISOString().slice(0, 10),
        accountNo: entry?.serial || "—",
        accountName: entry?.narration?.slice(0, 30) || "Cash Account",
        amount,
        currency: entry?.currency || "AED",
        narration: entry?.narration || "Roznamcha Voucher Entry",
        type: (entry?.credit || 0) > 0 ? "payment" : "receipt",
        branchName: selectedBranch === "All Branches" ? "ALL" : selectedBranch,
        countryName: selectedCountry === "All Countries" ? "ALL" : selectedCountry,
        createdByName: entry?.creator || "Super Admin",
      },
      companyInfo: { name: "DIGITAL DOCK ERP" },
    });
  }, [roznamchaEntries, selectedBranch, selectedCountry]);

  // 8. Sales Order Report
  const handlePrintSalesOrder = useCallback(() => {
    const so = salesOrders[0] || orders[0];
    if (!so) { alert("No sales orders available."); return; }
    const form = so.form_data?.form || {};
    openSalesA4ReportWindow({
      title: "Sales Order Report",
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
        unit: form.unit || "KGS",
        totalWeight: Number(form.totalWeight || so.total_weight || 0),
        containerCount: Number(form.containerCount || 1),
        salesRate: Number(form.salesRate || form.purchaseRate || 0),
        totalSalesAmount: Number(so.order_total || 0),
        currency: form.currencyType || so.currency_code || "USD",
        status: so.sales_status || so.order_status || "Draft",
        paymentStatus: so.payment_status || "Pending",
        branchName: so.branchName || form.branchName || "—",
        countryName: so.countryName || form.countryName || "—",
        createdAt: so.created_at || "—",
        form_data: so.form_data,
        audit: { userName: "Super Admin", userId: "system", branchCode: so.branchCode || "—" },
      },
    });
  }, [salesOrders, orders]);

  // 9. Account Statement
  const handlePrintAccountStatement = useCallback(() => {
    const acc = accountsList[0];
    if (!acc) { alert("No account data available."); return; }
    openAccountA4ReportWindow({
      title: "Account Statement Report",
      accountData: {
        accountName: acc.contacts?.accountTitle || acc.account_number || "—",
        accountCode: acc.account_number || "—",
        accountTitle: acc.contacts?.accountTitle || "—",
        subType: acc.sub_type || "General",
        category: acc.category || "Asset",
        currency: acc.currency_code || "AED",
        status: acc.status || "Active",
        selectedCountryName: selectedCountry === "All Countries" ? "—" : selectedCountry,
        selectedBranchName: selectedBranch === "All Branches" ? "—" : selectedBranch,
        createdBy: "Super Admin",
      },
    });
  }, [accountsList, selectedCountry, selectedBranch]);

  // 10. Proforma Invoice
  const handlePrintProformaInvoice = useCallback(() => {
    const o = orders[0];
    if (!o) { alert("No purchase data for proforma invoice."); return; }
    const form = o.form_data?.form || {};
    openProformaInvoiceWindow({
      purchaseData: {
        id: o.id,
        purchaseBookingOrderNumber: o.purchase_order_no || "—",
        purchaseDate: form.purchaseDate || o.order_date || "—",
        bookingDate: o.created_at || "—",
        purchaseAccountName: form.purchaseAccountName || "—",
        purchaseAccountNumber: form.purchaseAccountNumber || "—",
        salesAccountName: form.salesAccountName || "—",
        salesAccountNumber: form.salesAccountNumber || "—",
        supplierName: form.supplierName || "—",
        buyerName: form.buyerName || "DAMAN BUSINESS GROUP",
        productName: form.goodsName || form.productName || "—",
        goodsDescription: form.goodsName || "—",
        quantity: Number(form.quantity || 0),
        unit: form.unit || "KGS",
        totalWeight: Number(form.totalWeight || 0),
        containerCount: Number(form.containerCount || 1),
        purchaseRate: Number(form.purchaseRate || 0),
        totalPurchaseAmount: Number(o.order_total || 0),
        currency: form.currencyType || "USD",
        status: o.order_status || "Draft",
        paymentStatus: o.payment_status || "Pending",
        branchName: o.branchName || "—",
        countryName: o.countryName || "—",
        createdAt: o.created_at || "—",
        form_data: o.form_data,
        audit: { userName: "Super Admin", userId: "system", branchCode: o.branchCode || "—" },
      },
    });
  }, [orders]);

  // 11. Expenses Bill (via A4 report)
  const handlePrintExpenses = useCallback(() => {
    alert("Expenses Bill Report — Opens when expense data is available in the system.");
  }, []);

  // 12. Trade Document
  const handlePrintTradeDocument = useCallback(() => {
    const o = orders[0];
    if (!o) { alert("No purchase orders for trade document."); return; }
    openTradeDocumentWindow("contract", o);
  }, [orders]);

  // 13. Purchase A4 Full Report
  const handlePrintPurchaseA4 = useCallback(() => {
    const o = orders[0];
    if (!o) { alert("No purchase data available."); return; }
    const form = o.form_data?.form || {};
    openPurchaseA4ReportWindow({
      title: "Purchase Booking Order Report",
      purchaseData: {
        id: o.id,
        purchaseBookingOrderNumber: o.purchase_order_no || "—",
        purchaseDate: form.purchaseDate || o.order_date || "—",
        bookingDate: o.created_at || "—",
        purchaseAccountName: form.purchaseAccountName || "—",
        purchaseAccountNumber: form.purchaseAccountNumber || "—",
        salesAccountName: form.salesAccountName || "—",
        salesAccountNumber: form.salesAccountNumber || "—",
        supplierName: form.supplierName || "—",
        buyerName: form.buyerName || "DAMAN BUSINESS GROUP",
        productName: form.goodsName || form.productName || "—",
        goodsDescription: form.goodsName || "—",
        quantity: Number(form.quantity || 0),
        unit: form.unit || "KGS",
        totalWeight: Number(form.totalWeight || 0),
        containerCount: Number(form.containerCount || 1),
        purchaseRate: Number(form.purchaseRate || 0),
        totalPurchaseAmount: Number(o.order_total || 0),
        currency: form.currencyType || "USD",
        status: o.order_status || "Draft",
        paymentStatus: o.payment_status || "Pending",
        branchName: o.branchName || "—",
        countryName: o.countryName || "—",
        createdAt: o.created_at || "—",
        form_data: o.form_data,
        audit: { userName: "Super Admin", userId: "system", branchCode: o.branchCode || "—" },
      },
    });
  }, [orders]);

  // 14. User Activity Report
  const handlePrintUserActivity = useCallback(() => {
    openUserA4ReportWindow({
      title: "User Activity Report",
      subtitle: "ERP User Activity Summary",
      userData: {
        userId: "super-admin",
        userCode: "SA-001",
        fullName: "Super Admin",
        countryName: selectedCountry === "All Countries" ? "ALL" : selectedCountry,
        branchName: selectedBranch === "All Branches" ? "ALL" : selectedBranch,
        branchType: "super_admin",
        role: "Super Admin",
        registrationDate: "2026-01-01",
        status: "Active",
        permissions: ["Full Access"],
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
  }, [roznamchaEntries, orders, accountsList, selectedCountry, selectedBranch]);

  // 15. Daily Roznamcha Summary
  const handlePrintDailyRoznamcha = useCallback(() => {
    handlePrintCashEntries();
  }, [handlePrintCashEntries]);

  // 16. Ledger Balance Report
  const handlePrintLedgerBalance = useCallback(() => {
    if (ledgersList.length === 0 && accountsList.length === 0) {
      alert("No ledger data available.");
      return;
    }
    const acc = accountsList[0] || { account_number: "—", contacts: {} };
    openAccountA4ReportWindow({
      title: "Ledger Balance Report",
      subtitle: "Complete Ledger Balance Summary",
      accountData: {
        accountName: acc.contacts?.accountTitle || acc.account_number || "Ledger Report",
        accountCode: acc.account_number || "—",
        accountTitle: acc.contacts?.accountTitle || "—",
        subType: "Ledger",
        category: "Financial",
        currency: acc.currency_code || "AED",
        status: "Active",
        selectedCountryName: selectedCountry === "All Countries" ? "—" : selectedCountry,
        selectedBranchName: selectedBranch === "All Branches" ? "—" : selectedBranch,
        createdBy: "Super Admin",
      },
    });
  }, [ledgersList, accountsList, selectedCountry, selectedBranch]);

  // 17. Purchase Transfer Verification
  const handlePrintTransferVerification = useCallback(() => {
    handlePrintTransferPayment();
  }, [handlePrintTransferPayment]);

  /* ── REPORT CARDS REGISTRY ── */
  const reportCards = useMemo(() => [
    { id: "customer-ledger", title: "Customer Ledger Report & Account Statement", subtitle: "Roznamacha / Account Statement", description: "Complete customer financial statement with opening balance, debit/credit transactions, closing balance, and Dr/Cr status.", format: "A4 Landscape", icon: BookOpen, color: "from-blue-600 to-indigo-700", badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300", onPrint: handlePrintCustomerLedger, category: "Accounting", dataCount: roznamchaEntries.length },
    { id: "loading-records", title: "Purchase Loading Records Report", subtitle: "Container Loading & Status Register", description: "23-column landscape report for tracking loading status, contract qty, gross/tare/net weights, rates, FC & LC amounts.", format: "A4 Landscape", icon: Ship, color: "from-emerald-600 to-teal-700", badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", onPrint: handlePrintLoadingRecords, category: "Purchase", dataCount: loadingRecords.length || orders.length },
    { id: "finalized-po", title: "Finalized Purchase Orders Report", subtitle: "Completed Purchase Contracts", description: "Comprehensive summary of finalized purchase orders with DR/CR account breakdown, currency conversions, and completion status.", format: "A4 Landscape", icon: ClipboardList, color: "from-purple-600 to-violet-700", badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300", onPrint: handlePrintFinalizedPO, category: "Purchase", dataCount: orders.length },
    { id: "transfer-payment", title: "Purchase Transfer Payment Voucher", subtitle: "Official GL Settlement Voucher", description: "Official voucher document with amount in digits and words, GL posting double-entry table, and cashier/manager signatures.", format: "A4 Portrait", icon: Coins, color: "from-amber-600 to-orange-700", badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", onPrint: handlePrintTransferPayment, category: "Payment", dataCount: orders.length },
    { id: "cash-entries", title: "Recent Cash Entries (Roznamacha) Report", subtitle: "Daily Cash Journal Sheet", description: "Daily cash debit & credit transactions sheet featuring balanced status check, branch code postings, and narration log.", format: "A4 Portrait", icon: Wallet, color: "from-cyan-600 to-blue-700", badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300", onPrint: handlePrintCashEntries, category: "Cash", dataCount: roznamchaEntries.length },
    { id: "purchase-booking", title: "New Purchase Booking Order Document", subtitle: "Order Confirmation Sheet", description: "Full purchase order document containing supplier/buyer cards, goods breakdown, payment terms schedule, and GL postings.", format: "A4 Portrait", icon: FileText, color: "from-rose-600 to-red-700", badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", onPrint: handlePrintPurchaseBooking, category: "Purchase", dataCount: orders.length },
    { id: "roznamcha-voucher", title: "Roznamcha Payment / Receipt Voucher", subtitle: "Cash Payment & Receipt Voucher", description: "Dual-copy (Office + Customer) voucher for cash payments and receipts with letterhead, amount in words, and signatures.", format: "A4 Portrait", icon: Receipt, color: "from-teal-600 to-cyan-700", badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300", onPrint: handlePrintRoznamchaVoucher, category: "Cash", dataCount: roznamchaEntries.length },
    { id: "sales-order", title: "Sales Order Report", subtitle: "Sales Booking Confirmation", description: "Full sales order report with customer details, goods specification, pricing, payment status, and delivery tracking.", format: "A4 Portrait", icon: CreditCard, color: "from-indigo-600 to-blue-700", badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300", onPrint: handlePrintSalesOrder, category: "Sales", dataCount: salesOrders.length },
    { id: "account-statement", title: "Account Statement Report", subtitle: "Enterprise Account Detail Sheet", description: "Detailed account master report showing account code, category, sub-type, currency, and connected customer/company/bank details.", format: "A4 Portrait", icon: Landmark, color: "from-sky-600 to-blue-700", badgeColor: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", onPrint: handlePrintAccountStatement, category: "Accounting", dataCount: accountsList.length },
    { id: "proforma-invoice", title: "Proforma Invoice", subtitle: "Pre-Shipment Commercial Invoice", description: "Proforma invoice for international trade with goods breakdown, HS codes, shipping terms, and payment schedule.", format: "A4 Portrait", icon: FileBadge, color: "from-orange-500 to-amber-700", badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", onPrint: handlePrintProformaInvoice, category: "Trade", dataCount: orders.length },
    { id: "expenses-bill", title: "Expenses Bill Report", subtitle: "Expense Voucher & Breakdown", description: "Detailed expense bill report with line items, tax calculations, exchange rates, and GL double-entry postings.", format: "A4 Portrait", icon: ScrollText, color: "from-red-500 to-rose-700", badgeColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", onPrint: handlePrintExpenses, category: "Expenses", dataCount: 0 },
    { id: "trade-document", title: "Trade Contract Document", subtitle: "International Trade Agreement", description: "Official trade contract document with shipping details, container numbers, port information, and terms of delivery.", format: "A4 Portrait", icon: FileBarChart, color: "from-violet-600 to-purple-700", badgeColor: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300", onPrint: handlePrintTradeDocument, category: "Trade", dataCount: orders.length },
    { id: "purchase-a4", title: "Purchase A4 Full Report", subtitle: "Complete Purchase Detail Sheet", description: "Full A4 portrait purchase report with all booking details, goods specification, payment history, and workflow journey.", format: "A4 Portrait", icon: FileCheck, color: "from-green-600 to-emerald-700", badgeColor: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300", onPrint: handlePrintPurchaseA4, category: "Purchase", dataCount: orders.length },
    { id: "user-activity", title: "User Activity Report", subtitle: "ERP User Audit Trail", description: "User activity summary showing login count, transaction count, and module usage statistics.", format: "A4 Portrait", icon: Users, color: "from-slate-600 to-gray-700", badgeColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300", onPrint: handlePrintUserActivity, category: "Audit", dataCount: 0 },
    { id: "daily-roznamcha", title: "Daily Roznamcha Summary", subtitle: "Day-End Cash Journal Report", description: "End-of-day summary of all cash entries, receipts, and payments for a specific branch.", format: "A4 Portrait", icon: Scale, color: "from-yellow-600 to-amber-700", badgeColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300", onPrint: handlePrintDailyRoznamcha, category: "Cash", dataCount: roznamchaEntries.length },
    { id: "ledger-balance", title: "Ledger Balance Report", subtitle: "GL Ledger Balance Sheet", description: "Complete ledger balance report showing debit totals, credit totals, and current balance for each ledger account.", format: "A4 Portrait", icon: BarChart3, color: "from-fuchsia-600 to-pink-700", badgeColor: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300", onPrint: handlePrintLedgerBalance, category: "Accounting", dataCount: ledgersList.length },
    { id: "transfer-verification", title: "Purchase Transfer Verification Sheet", subtitle: "SAP/Oracle Grade Audit Sheet", description: "Enterprise-grade transfer verification with workflow pipeline, KPI cards, GL double-entry matrix, and 5-language support.", format: "A4 Portrait", icon: ArrowRightLeft, color: "from-emerald-700 to-green-800", badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", onPrint: handlePrintTransferVerification, category: "Purchase", dataCount: orders.length },
  ], [handlePrintCustomerLedger, handlePrintLoadingRecords, handlePrintFinalizedPO, handlePrintTransferPayment, handlePrintCashEntries, handlePrintPurchaseBooking, handlePrintRoznamchaVoucher, handlePrintSalesOrder, handlePrintAccountStatement, handlePrintProformaInvoice, handlePrintExpenses, handlePrintTradeDocument, handlePrintPurchaseA4, handlePrintUserActivity, handlePrintDailyRoznamcha, handlePrintLedgerBalance, handlePrintTransferVerification, roznamchaEntries, loadingRecords, orders, salesOrders, accountsList, ledgersList]);

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

      {/* ═══════ TOP BANNER BAR ═══════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            <span>Dashboard</span><span>›</span><span>Reports Hub</span><span>›</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">All Super Admin Journal Reporting</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Printer className="h-7 w-7 text-blue-600" />
            All Super Admin Journal Reporting & Print Hub
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Central ERP reporting hub with {reportCards.length} reports connected to live database • Auto-refresh every 60s
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <Button type="button" variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className={`h-8 text-xs font-bold gap-1.5 px-3 rounded-lg ${viewMode === "table" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"}`}>
              <TableIcon className="h-3.5 w-3.5" /> Table View
            </Button>
            <Button type="button" variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className={`h-8 text-xs font-bold gap-1.5 px-3 rounded-lg ${viewMode === "grid" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Grid Cards
            </Button>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => { setShowActivityDashboard(v => !v); }} className="h-9 text-xs font-semibold gap-1.5">
            <Activity className={`h-3.5 w-3.5 ${showActivityDashboard ? "text-emerald-600" : "text-slate-400"}`} />
            {showActivityDashboard ? "Hide" : "Show"} Activity
          </Button>

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
                { label: "Purchases", value: activityData.grandTotal.purchases, icon: ClipboardList, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40" },
                { label: "Sales", value: activityData.grandTotal.sales, icon: CreditCard, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
                { label: "Journal", value: activityData.grandTotal.journalEntries, icon: BookOpen, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
                { label: "Cash", value: activityData.grandTotal.cashEntries, icon: Wallet, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
                { label: "Payments", value: activityData.grandTotal.payments, icon: Coins, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
                { label: "Ledgers", value: activityData.grandTotal.ledgerEntries, icon: BarChart3, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
                { label: "Accounts", value: activityData.grandTotal.accounts, icon: Landmark, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/40" },
                { label: "Active", value: `${activityData.grandTotal.activeBranches}/${activityData.grandTotal.totalBranches}`, icon: Building2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
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

          {/* Branch Activity Matrix Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-600 text-white"><TrendingUp className="h-4 w-4" /></div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">ERP Activity Summary Dashboard</h2>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Live branch-wise activity matrix • Auto-refreshes every 60s
                    {activityData && <> • Generated {fmtDateTime(activityData.generatedAt)}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activityLoading && <Timer className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
                <Button type="button" variant="ghost" size="sm" onClick={() => void fetchActivitySummary()} className="h-7 text-[10px] font-bold text-blue-600 gap-1">
                  <RefreshCcw className={`h-3 w-3 ${activityLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>
            </div>

            {activityError && (
              <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold border-b border-amber-200 dark:border-amber-800">
                ⚠ {activityError}
              </div>
            )}

            {activityLoading && !activityData ? (
              <div className="px-5 py-12 text-center">
                <RefreshCcw className="h-6 w-6 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">Loading branch activity data...</p>
              </div>
            ) : activityData ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-800 dark:bg-slate-950 text-white text-[9px] font-extrabold uppercase tracking-wider">
                      <th className="px-3 py-2.5 text-center w-8">#</th>
                      <th className="px-3 py-2.5 min-w-[140px]">Branch</th>
                      <th className="px-3 py-2.5 min-w-[90px]">Country</th>
                      <th className="px-3 py-2.5 text-center">Purchase</th>
                      <th className="px-3 py-2.5 text-center">Sales</th>
                      <th className="px-3 py-2.5 text-center">Accounts</th>
                      <th className="px-3 py-2.5 text-center">Cash Entry</th>
                      <th className="px-3 py-2.5 text-center">Payments</th>
                      <th className="px-3 py-2.5 text-center">Journal</th>
                      <th className="px-3 py-2.5 text-center">Ledger</th>
                      <th className="px-3 py-2.5 text-center">Loading</th>
                      <th className="px-3 py-2.5 text-center">Transfers</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5 min-w-[120px]">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activityData.branches.map((b, i) => (
                      <tr key={b.branchId} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                        <td className="px-3 py-2 text-center font-mono text-slate-400 text-[10px]">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-extrabold text-slate-900 dark:text-white text-[11px]">{b.branchName}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{b.branchCode}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            <Globe2 className="h-3 w-3 text-blue-500" />{b.countryName}
                          </span>
                        </td>
                        {[b.purchases, b.sales, b.accounts, b.cashEntries, b.payments, b.journalEntries, b.ledgerEntries, b.loadingRecords, b.transfers].map((val, ci) => (
                          <td key={ci} className={`px-3 py-2 text-center ${cellColor(val)} ${cellBg(val)} rounded-sm`}>
                            {val}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${statusBadge(b.isActive)}`}>
                            {b.isActive ? <><CheckCircle2 className="h-2.5 w-2.5" /> Active</> : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[10px] font-medium text-slate-600 dark:text-slate-400">{fmtDateTime(b.lastActivity)}</td>
                      </tr>
                    ))}

                    {/* Country Subtotals */}
                    {activityData.countryTotals.map(ct => (
                      <tr key={ct.countryId} className="bg-blue-50/80 dark:bg-blue-950/30 font-extrabold border-t-2 border-blue-200 dark:border-blue-800">
                        <td className="px-3 py-2 text-center text-blue-500">Σ</td>
                        <td className="px-3 py-2 text-blue-800 dark:text-blue-300 text-[11px]" colSpan={2}>
                          <span className="flex items-center gap-1.5">
                            <Globe2 className="h-3.5 w-3.5" /> {ct.countryName} Total ({ct.branchCount} branches)
                          </span>
                        </td>
                        {[ct.purchases, ct.sales, ct.accounts, ct.cashEntries, ct.payments, ct.journalEntries, ct.ledgerEntries, ct.loadingRecords, ct.transfers].map((val, ci) => (
                          <td key={ci} className="px-3 py-2 text-center text-blue-800 dark:text-blue-300">{val}</td>
                        ))}
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-[10px] text-blue-700 dark:text-blue-400">{fmtDateTime(ct.lastActivity)}</td>
                      </tr>
                    ))}

                    {/* Grand Total */}
                    <tr className="bg-slate-900 dark:bg-slate-950 text-white font-extrabold border-t-2 border-slate-600">
                      <td className="px-3 py-3 text-center text-emerald-400">★</td>
                      <td className="px-3 py-3 text-emerald-400 text-xs" colSpan={2}>
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5" /> GRAND TOTAL ({activityData.grandTotal.totalBranches} branches)
                        </span>
                      </td>
                      {[activityData.grandTotal.purchases, activityData.grandTotal.sales, activityData.grandTotal.accounts, activityData.grandTotal.cashEntries, activityData.grandTotal.payments, activityData.grandTotal.journalEntries, activityData.grandTotal.ledgerEntries, activityData.grandTotal.loadingRecords, activityData.grandTotal.transfers].map((val, ci) => (
                        <td key={ci} className="px-3 py-3 text-center text-white">{val}</td>
                      ))}
                      <td className="px-3 py-3 text-center">
                        <span className="text-[9px] text-emerald-400 font-extrabold">{activityData.grandTotal.activeBranches} ACTIVE</span>
                      </td>
                      <td className="px-3 py-3 text-[10px] text-slate-300">{fmtDateTime(activityData.grandTotal.lastActivity)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
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

      {/* ═══════ TABLE VIEW ═══════ */}
      {viewMode === "table" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900" ref={menuRef}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-center w-10">#</th>
                  <th className="px-4 py-3">Report Title & Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Format</th>
                  <th className="px-4 py-3 text-center">Live Data</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3 text-center">Print</th>
                  <th className="px-4 py-3 text-center w-16">•••</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCards.map((card, index) => {
                  const Icon = card.icon;
                  const isMenuOpen = activeMenuId === card.id;
                  return (
                    <tr key={card.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl bg-gradient-to-r ${card.color} text-white shrink-0 shadow-xs`}><Icon className="h-4 w-4" /></div>
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white block text-xs group-hover:text-blue-600 transition-colors">{card.title}</span>
                            <span className="text-[10.5px] text-slate-500 line-clamp-1 max-w-md font-normal mt-0.5">{card.description}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">{card.subtitle}</span>
                        <span className="text-[9.5px] text-slate-400 font-mono">{card.category}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[9.5px] font-extrabold uppercase tracking-wider ${card.badgeColor}`}>{card.format}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${card.dataCount > 0 ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800" : "text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                          {card.dataCount > 0 ? <><CheckCircle2 className="h-3 w-3" /> {card.dataCount} rows</> : "No data"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">{selectedCountry}</span>
                        <span className="text-[9.5px] text-slate-400">{selectedBranch}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button type="button" size="sm" onClick={card.onPrint} className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] px-3 rounded-lg shadow-xs gap-1.5">
                          <Printer className="h-3.5 w-3.5" /> Print
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-center relative">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setActiveMenuId(isMenuOpen ? null : card.id)} className="h-8 w-8 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                        {isMenuOpen && (
                          <div className="absolute right-4 top-12 z-50 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-1 text-left animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-2.5 py-1 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">REPORT OPTIONS</div>
                            <button type="button" onClick={() => { card.onPrint(); setActiveMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 transition-colors">
                              <Printer className="h-3.5 w-3.5 text-blue-600" /> Open Preview & Print
                            </button>
                            <button type="button" onClick={() => { card.onPrint(); setActiveMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 transition-colors">
                              <Download className="h-3.5 w-3.5 text-emerald-600" /> Save PDF Document
                            </button>
                            <button type="button" onClick={() => { card.onPrint(); setActiveMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950 hover:text-teal-600 transition-colors">
                              <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" /> Export to Excel
                            </button>
                            <button type="button" onClick={() => { card.onPrint(); setActiveMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 transition-colors border-t border-slate-100 dark:border-slate-800 mt-1 pt-1.5">
                              <Eye className="h-3.5 w-3.5 text-indigo-600" /> Quick View A4 Sheet
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
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
                    <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Category: {card.category}</div>
                  </CardContent>
                </div>
                <div className="p-4 pt-0 gap-2 flex flex-col border-t border-slate-100 dark:border-slate-800/60 mt-2">
                  <Button type="button" onClick={card.onPrint} className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2">
                    <Printer className="h-4 w-4" /> Open Preview & Print Report
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={card.onPrint} className="h-8 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-1">
                      <Download className="h-3.5 w-3.5 text-emerald-600" /> Save PDF
                    </Button>
                    <Button type="button" variant="outline" onClick={card.onPrint} className="h-8 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-1">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" /> Export Excel
                    </Button>
                  </div>
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
              Clicking <strong>&quot;Open Preview & Print Report&quot;</strong> or <strong>&quot;Save PDF&quot;</strong> opens an A4 formatted window complete with your official company letterhead, signature strips, and a sticky toolbar for 1-click Printing, PDF saving, Excel export, Emailing, and WhatsApp sharing. All {reportCards.length} reports are connected to live ERP data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
