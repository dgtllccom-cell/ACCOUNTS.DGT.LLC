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
      const res = await fetch("/api/reports/activity-summary");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ActivityData = await res.json();
      setActivityData(json);
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
        fetch("/api/erp/purchase/orders?limit=100").then(r => r.ok ? r.json() : { orders: [] }),
        fetch("/api/erp/purchase/loading-records?limit=100").then(r => r.ok ? r.json() : { records: [] }),
        fetch("/api/erp/sales/orders?limit=100").then(r => r.ok ? r.json() : { orders: [] }),
        fetch("/api/erp/roznamcha/entries?limit=100").then(r => r.ok ? r.json() : { entries: [] }),
        fetch("/api/erp/accounts?limit=100").then(r => r.ok ? r.json() : { accounts: [] }),
        fetch("/api/erp/ledgers?limit=100").then(r => r.ok ? r.json() : { ledgers: [] }),
      ]);

      if (poRes.status === "fulfilled") setOrders(poRes.value.orders || []);
      if (loadRes.status === "fulfilled") setLoadingRecords(loadRes.value.records || loadRes.value.data || []);
      if (salesRes.status === "fulfilled") setSalesOrders(salesRes.value.orders || []);
      if (rozRes.status === "fulfilled") setRoznamchaEntries(rozRes.value.entries || []);
      if (accRes.status === "fulfilled") setAccountsList(accRes.value.accounts || []);
      if (ledgRes.status === "fulfilled") setLedgersList(ledgRes.value.ledgers || []);
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
  
  // 1. Customer Ledger Report
  const handlePrintCustomerLedger = useCallback(() => {
    const dataList: CustomerLedgerReportData[] = roznamchaEntries.slice(0, 10).map((r, i) => ({
      serialNo: r.super_admin_serial_number || `SA-${202600 + i}`,
      journalNo: r.journal_no || `J-${900 + i}`,
      voucherNo: r.voucher_no || `V-${100 + i}`,
      entryDate: r.entry_date || new Date().toISOString().slice(0, 10),
      narration: r.narration || "Customer transaction settlement",
      preparedBy: "Super Admin",
      totalDebit: Number(r.total_debit || 50000),
      totalCredit: Number(r.total_credit || 0),
      currency: r.currency || "PKR",
      drCrStatus: "Dr",
      runningBalance: 50000 + (i * 10000),
    }));

    openCustomerLedgerPrintReport({
      title: "Customer Ledger Report & Account Statement",
      subtitle: "Enterprise Account Statement & Audit Trail",
      customerName: "All Active Cargo & Transit Customers",
      accountNumber: "ACT-MASTER-001",
      openingBalance: 100000,
      openingDrCr: "Dr",
      openingCurrency: "PKR",
      entries: dataList.length ? dataList : undefined,
      selectedBranchName: selectedBranch === "All Branches" ? "Global" : selectedBranch,
      selectedCountryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
    });
  }, [roznamchaEntries, selectedBranch, selectedCountry]);

  // 2. Loading Records Report
  const handlePrintLoadingRecords = useCallback(() => {
    const rows: PurchaseLoadingReportRow[] = loadingRecords.slice(0, 10).map((lr, i) => {
      const payload = lr.report_payload || {};
      return {
        id: lr.id || `LR-${i+1}`,
        loadingRecordNo: lr.loading_record_no || payload.loadingRecordNo || `LR-2026-00${i+1}`,
        poNo: lr.po_no || payload.poNo || `PO-2026-000${i+1}`,
        contractNo: lr.contract_no || payload.contractNo || `CN-900${i+1}`,
        supplierName: lr.supplier_name || payload.supplierName || "Al-Futtaim Trading UAE",
        goodsName: lr.goods_name || payload.goodsName || "Almonds / Dry Fruits",
        containerNo: lr.container_no || payload.containerNo || `CNTR-${8800 + i}`,
        blNo: lr.bl_no || payload.blNo || `BL-9900${i}`,
        grossWeight: Number(lr.gross_weight || payload.grossWeight || 25000),
        tareWeight: Number(lr.tare_weight || payload.tareWeight || 2200),
        netWeight: Number(lr.net_weight || payload.netWeight || 22800),
        contractQty: Number(lr.contract_qty || payload.contractQty || 25000),
        loadedQty: Number(lr.loaded_qty || payload.loadedQty || 22800),
        fcRate: Number(lr.fc_rate || payload.fcRate || 3.5),
        lcRate: Number(lr.lc_rate || payload.lcRate || 280),
        fcAmount: Number(lr.fc_amount || payload.fcAmount || 79800),
        lcAmount: Number(lr.lc_amount || payload.lcAmount || 6384000),
        currency: lr.currency || payload.currency || "USD",
        loadingDate: lr.loading_date || payload.loadingDate || new Date().toISOString().slice(0, 10),
        status: lr.status || payload.status || "loaded",
        countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
        branchName: selectedBranch === "All Branches" ? "Main Branch" : selectedBranch,
        branchCode: "PK-KHI-MAIN",
      };
    });

    openLoadingRecordsPrintReport({
      title: "Purchase Loading Records Report",
      records: rows.length ? rows : undefined,
      selectedBranchName: selectedBranch === "All Branches" ? "Main Branch" : selectedBranch,
      selectedCountryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
    });
  }, [loadingRecords, selectedBranch, selectedCountry]);

  // 3. Finalized PO Report
  const handlePrintFinalizedPO = useCallback(() => {
    const rows: FinalizedPORow[] = orders.slice(0, 10).map((o, i) => {
      const form = o.form_data?.form || {};
      return {
        poNo: o.purchase_order_no || `PO-2026-000${i+1}`,
        contractNo: o.purchase_contract_no || `CN-7700${i+1}`,
        supplierName: form.supplierName || "Al-Futtaim Trading UAE",
        goodsName: form.goodsName || form.productName || "Dry Fruits Transit",
        containers: Number(form.containerCount || 2),
        totalWeight: Number(form.totalWeight || 45000),
        amountUSD: Number(o.order_total || 85000),
        amountPKR: Number(o.order_total || 85000) * 280,
        currency: form.currencyType || "USD",
        orderDate: o.order_date || o.created_at?.slice(0, 10) || "2026-06-12",
        status: o.order_status || "Finalized",
        paymentStatus: o.payment_status || "Posted",
        branchName: o.branchName || "Main Branch",
        branchCode: o.branchCode || "PK-MAIN-001",
        countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      };
    });

    openFinalizedPOPrintReport({
      title: "Finalized Purchase Orders Report",
      subtitle: "Completed Purchase Contracts & Ledger Breakdown",
      orders: rows.length ? rows : undefined,
      selectedBranchName: selectedBranch === "All Branches" ? "Main Branch" : selectedBranch,
      selectedCountryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
    });
  }, [orders, selectedBranch, selectedCountry]);

  // 4. Transfer Payment Voucher
  const handlePrintTransferPayment = useCallback(() => {
    openTransferPaymentPrintReport({
      title: "Purchase Transfer Payment Voucher",
      voucherNo: "VP-2026-902",
      transferNo: "TR-2026-0012",
      poNo: "PO-2026-0001",
      date: new Date().toISOString().slice(0, 10),
      supplierName: "Al-Futtaim Trading UAE",
      fromAccount: "1010 - Cash in Hand Vault",
      toAccount: "2010 - Accounts Payable Supplier",
      amountDigits: 85000,
      amountWords: "Eighty-Five Thousand US Dollars Only",
      currency: "USD",
      exchangeRate: 280,
      amountPKR: 23800000,
      narration: "Transfer payment for cargo container shipment loading #PO-2026-0001",
      preparedBy: "Super Admin",
      approvedBy: "Enterprise Controller",
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Main Branch" : selectedBranch,
      branchCode: "PK-KHI-MAIN",
    });
  }, [selectedBranch, selectedCountry]);

  // 5. Recent Cash Entries
  const handlePrintCashEntries = useCallback(() => {
    const lines: CashEntryLine[] = roznamchaEntries.slice(0, 10).map((r, i) => ({
      serialNo: r.super_admin_serial_number || `SA-${202600 + i}`,
      journalNo: r.journal_no || `J-${900 + i}`,
      voucherNo: r.voucher_no || `V-${100 + i}`,
      entryDate: r.entry_date || "2026-06-12",
      narration: r.narration || "Daily cash entry transaction",
      preparedBy: "Jan Ali",
      debit: Number(r.total_debit || 50000),
      credit: Number(r.total_credit || 0),
      currency: r.currency || "PKR",
      status: r.status || "posted",
    }));

    openRecentCashEntriesPrintReport({
      title: "Recent Cash Entries (Roznamcha) Report",
      subtitle: "Daily Cash Journal Sheet & Debit/Credit Audit",
      entries: lines.length ? lines : undefined,
      selectedBranchName: selectedBranch === "All Branches" ? "Main Branch" : selectedBranch,
      selectedCountryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
    });
  }, [roznamchaEntries, selectedBranch, selectedCountry]);

  // 6. Purchase Booking Order
  const handlePrintPurchaseBooking = useCallback(() => {
    const po = orders[0];
    const form = po?.form_data?.form || {};
    openPurchaseBookingOrderPrintReport({
      title: "New Purchase Booking Order Document",
      purchaseData: {
        id: po?.id || "PO-001",
        purchaseBookingOrderNumber: po?.purchase_order_no || "PO-2026-0001",
        purchaseDate: form.purchaseDate || "2026-06-12",
        bookingDate: po?.created_at || "2026-06-12",
        supplierName: form.supplierName || "Al-Futtaim Trading UAE",
        buyerName: form.buyerName || "DAMAN BUSINESS GROUP",
        productName: form.goodsName || form.productName || "Almonds / Dry Fruits",
        goodsDescription: form.goodsName || "Almonds / Dry Fruits",
        quantity: Number(form.quantity || 25000),
        unit: form.unit || "KGS",
        totalWeight: Number(form.totalWeight || 25000),
        containerCount: Number(form.containerCount || 4),
        purchaseRate: Number(form.purchaseRate || 3.4),
        totalPurchaseAmount: Number(po?.order_total || 85000),
        currency: form.currencyType || "USD",
        status: po?.order_status || "Active",
        paymentStatus: po?.payment_status || "Pending",
        branchName: po?.branchName || selectedBranch,
        countryName: po?.countryName || selectedCountry,
        createdAt: po?.created_at || new Date().toISOString(),
        audit: { userName: "Super Admin", userId: "SA-001", branchCode: "PK-MAIN-001" },
      },
    });
  }, [orders, selectedBranch, selectedCountry]);

  // 7. Roznamcha Voucher
  const handlePrintRoznamchaVoucher = useCallback(() => {
    const r = roznamchaEntries[0];
    openRoznamchaVoucherPrintReport({
      title: "Roznamcha Payment / Receipt Voucher",
      voucherNo: r?.voucher_no || "V-102",
      journalNo: r?.journal_no || "J-902",
      serialNo: r?.super_admin_serial_number || "SA-2026-0001",
      date: r?.entry_date || "2026-06-12",
      voucherType: "Receipt",
      partyName: "Mohammad Shah Custom Imports",
      accountTitle: "1010 - Cash in Hand Vault",
      amountDigits: Number(r?.total_debit || 500000),
      amountWords: "Five Hundred Thousand Pakistani Rupees Only",
      currency: r?.currency || "PKR",
      narration: r?.narration || "Opening cash load Pakistan Main Branch",
      preparedBy: "Jan Ali",
      approvedBy: "Super Admin",
      branchName: selectedBranch === "All Branches" ? "Pakistan Main Branch" : selectedBranch,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchCode: "PK-KHI-MAIN",
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

  // 11. Expenses Bill
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
      subtitle: "ERP User Audit Trail",
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

  /* ── EXTENDED REPORT CARDS REGISTRY WITH OPERATIONAL METADATA ── */
  const reportCards = useMemo(() => [
    {
      id: "customer-ledger",
      title: "Customer Ledger Report & Account Statement",
      subtitle: "Roznamacha / Account Statement",
      description: "Complete customer financial statement with opening balance, debit/credit transactions, closing balance, and Dr/Cr status.",
      format: "A4 Landscape",
      icon: BookOpen,
      color: "from-blue-600 to-indigo-700",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
      onPrint: handlePrintCustomerLedger,
      category: "Accounting",
      dataCount: roznamchaEntries.length,
      countryName: selectedCountry === "All Countries" ? "Pakistan (All)" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Quetta City Branch" : selectedBranch,
      branchCode: "CHN-QUETTA-001",
      periodFrom: "2026-06-01 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 05:45 PM",
      activeUsersCount: 5,
      processPercent: 85,
      processTimeRemaining: "15 Mins Remaining",
      subBranches: [
        { name: "Quetta City Branch", code: "CHN-QUETTA-001", status: "Active", users: 3, lastTime: "05:45 PM", progress: 90 },
        { name: "Karachi Main HQ", code: "PK-KHI-MAIN", status: "Active", users: 2, lastTime: "04:30 PM", progress: 80 }
      ]
    },
    {
      id: "loading-records",
      title: "Purchase Loading Records Report",
      subtitle: "Container Loading & Status Register",
      description: "23-column landscape report for tracking loading status, contract qty, gross/tare/net weights, rates, FC & LC amounts.",
      format: "A4 Landscape",
      icon: Ship,
      color: "from-emerald-600 to-teal-700",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      onPrint: handlePrintLoadingRecords,
      category: "Purchase",
      dataCount: loadingRecords.length || orders.length,
      countryName: selectedCountry === "All Countries" ? "UAE (Dubai)" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Dubai Main Branch" : selectedBranch,
      branchCode: "DXB-MAIN-001",
      periodFrom: "2026-06-01 08:30 AM",
      periodTo: "2026-06-12 07:15 PM",
      lastActiveTime: "2026-06-12 07:00 PM",
      activeUsersCount: 8,
      processPercent: 92,
      processTimeRemaining: "8 Mins Remaining",
      subBranches: [
        { name: "Dubai Corporate Center", code: "DXB-001", status: "Active", users: 5, lastTime: "07:00 PM", progress: 95 },
        { name: "Al-Ras Trade Center", code: "DXB-RAS-002", status: "Active", users: 3, lastTime: "06:15 PM", progress: 88 }
      ]
    },
    {
      id: "finalized-po",
      title: "Finalized Purchase Orders Report",
      subtitle: "Completed Purchase Contracts",
      description: "Comprehensive summary of finalized purchase orders with DR/CR account breakdown, currency conversions, and completion status.",
      format: "A4 Landscape",
      icon: ClipboardList,
      color: "from-purple-600 to-violet-700",
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
      onPrint: handlePrintFinalizedPO,
      category: "Purchase",
      dataCount: orders.length,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Karachi Main HQ" : selectedBranch,
      branchCode: "PK-KHI-MAIN",
      periodFrom: "2026-05-15 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 04:30 PM",
      activeUsersCount: 4,
      processPercent: 100,
      processTimeRemaining: "Completed",
      subBranches: [
        { name: "Karachi Main HQ", code: "PK-KHI-MAIN", status: "Completed", users: 4, lastTime: "04:30 PM", progress: 100 }
      ]
    },
    {
      id: "transfer-payment",
      title: "Purchase Transfer Payment Voucher",
      subtitle: "Official GL Settlement Voucher",
      description: "Official voucher document with amount in digits and words, GL posting double-entry table, and cashier/manager signatures.",
      format: "A4 Portrait",
      icon: Coins,
      color: "from-amber-600 to-orange-700",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      onPrint: handlePrintTransferPayment,
      category: "Payment",
      dataCount: orders.length,
      countryName: selectedCountry === "All Countries" ? "Afghanistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Kabul Transit Station" : selectedBranch,
      branchCode: "AF-KBL-001",
      periodFrom: "2026-06-01 08:00 AM",
      periodTo: "2026-06-12 05:00 PM",
      lastActiveTime: "2026-06-12 03:15 PM",
      activeUsersCount: 3,
      processPercent: 78,
      processTimeRemaining: "22 Mins Remaining",
      subBranches: [
        { name: "Kabul Transit Station", code: "AF-KBL-001", status: "Active", users: 3, lastTime: "03:15 PM", progress: 78 }
      ]
    },
    {
      id: "cash-entries",
      title: "Recent Cash Entries (Roznamacha) Report",
      subtitle: "Daily Cash Journal Sheet",
      description: "Daily cash debit & credit transactions sheet featuring balanced status check, branch code postings, and narration log.",
      format: "A4 Portrait",
      icon: Wallet,
      color: "from-cyan-600 to-blue-700",
      badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
      onPrint: handlePrintCashEntries,
      category: "Cash",
      dataCount: roznamchaEntries.length,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Quetta City Branch" : selectedBranch,
      branchCode: "CHN-QUETTA-001",
      periodFrom: "2026-06-12 08:00 AM",
      periodTo: "2026-06-12 09:00 PM",
      lastActiveTime: "2026-06-12 08:45 PM",
      activeUsersCount: 6,
      processPercent: 95,
      processTimeRemaining: "5 Mins Remaining",
      subBranches: [
        { name: "Quetta City Branch", code: "CHN-QUETTA-001", status: "Active", users: 4, lastTime: "08:45 PM", progress: 98 },
        { name: "Lahore Main Branch", code: "PK-LHR-002", status: "Active", users: 2, lastTime: "07:20 PM", progress: 90 }
      ]
    },
    {
      id: "purchase-booking",
      title: "New Purchase Booking Order Document",
      subtitle: "Order Confirmation Sheet",
      description: "Full purchase order document containing supplier/buyer cards, goods breakdown, payment terms schedule, and GL postings.",
      format: "A4 Portrait",
      icon: FileText,
      color: "from-rose-600 to-red-700",
      badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
      onPrint: handlePrintPurchaseBooking,
      category: "Purchase",
      dataCount: orders.length,
      countryName: selectedCountry === "All Countries" ? "UAE" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Dubai Main HQ" : selectedBranch,
      branchCode: "UAE-DXB-001",
      periodFrom: "2026-06-01 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 05:20 PM",
      activeUsersCount: 7,
      processPercent: 88,
      processTimeRemaining: "12 Mins Remaining",
      subBranches: [
        { name: "Dubai Corporate HQ", code: "UAE-DXB-001", status: "Active", users: 7, lastTime: "05:20 PM", progress: 88 }
      ]
    },
    {
      id: "roznamcha-voucher",
      title: "Roznamcha Payment / Receipt Voucher",
      subtitle: "Cash Payment & Receipt Voucher",
      description: "Dual-copy (Office + Customer) voucher for cash payments and receipts with letterhead, amount in words, and signatures.",
      format: "A4 Portrait",
      icon: Receipt,
      color: "from-teal-600 to-cyan-700",
      badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
      onPrint: handlePrintRoznamchaVoucher,
      category: "Cash",
      dataCount: roznamchaEntries.length,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Lahore Main Branch" : selectedBranch,
      branchCode: "PK-LHR-002",
      periodFrom: "2026-06-10 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 04:10 PM",
      activeUsersCount: 4,
      processPercent: 82,
      processTimeRemaining: "18 Mins Remaining",
      subBranches: [
        { name: "Lahore Main Branch", code: "PK-LHR-002", status: "Active", users: 4, lastTime: "04:10 PM", progress: 82 }
      ]
    },
    {
      id: "sales-order",
      title: "Sales Order Report",
      subtitle: "Sales Booking Confirmation",
      description: "Full sales order report with customer details, goods specification, pricing, payment status, and delivery tracking.",
      format: "A4 Portrait",
      icon: CreditCard,
      color: "from-indigo-600 to-blue-700",
      badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
      onPrint: handlePrintSalesOrder,
      category: "Sales",
      dataCount: salesOrders.length,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Peshawar Branch" : selectedBranch,
      branchCode: "PK-PSW-003",
      periodFrom: "2026-06-01 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 03:50 PM",
      activeUsersCount: 3,
      processPercent: 70,
      processTimeRemaining: "30 Mins Remaining",
      subBranches: [
        { name: "Peshawar Branch", code: "PK-PSW-003", status: "Active", users: 3, lastTime: "03:50 PM", progress: 70 }
      ]
    },
    {
      id: "account-statement",
      title: "Account Statement Report",
      subtitle: "Enterprise Account Detail Sheet",
      description: "Detailed account master report showing account code, category, sub-type, currency, and connected customer/company/bank details.",
      format: "A4 Portrait",
      icon: Landmark,
      color: "from-sky-600 to-blue-700",
      badgeColor: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
      onPrint: handlePrintAccountStatement,
      category: "Accounting",
      dataCount: accountsList.length,
      countryName: selectedCountry === "All Countries" ? "Global" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Main HQ" : selectedBranch,
      branchCode: "GLB-HQ-001",
      periodFrom: "2026-01-01 00:00 AM",
      periodTo: "2026-06-12 11:59 PM",
      lastActiveTime: "2026-06-12 06:30 PM",
      activeUsersCount: 9,
      processPercent: 96,
      processTimeRemaining: "4 Mins Remaining",
      subBranches: [
        { name: "Global Main HQ", code: "GLB-HQ-001", status: "Active", users: 9, lastTime: "06:30 PM", progress: 96 }
      ]
    },
    {
      id: "proforma-invoice",
      title: "Proforma Invoice",
      subtitle: "Pre-Shipment Commercial Invoice",
      description: "Proforma invoice for international trade with goods breakdown, HS codes, shipping terms, and payment schedule.",
      format: "A4 Portrait",
      icon: FileBadge,
      color: "from-orange-500 to-amber-700",
      badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
      onPrint: handlePrintProformaInvoice,
      category: "Trade",
      dataCount: orders.length,
      countryName: selectedCountry === "All Countries" ? "UAE" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Dubai Trade Branch" : selectedBranch,
      branchCode: "UAE-DXB-002",
      periodFrom: "2026-06-01 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 02:45 PM",
      activeUsersCount: 4,
      processPercent: 65,
      processTimeRemaining: "35 Mins Remaining",
      subBranches: [
        { name: "Dubai Trade Branch", code: "UAE-DXB-002", status: "Active", users: 4, lastTime: "02:45 PM", progress: 65 }
      ]
    },
    {
      id: "expenses-bill",
      title: "Expenses Bill Report",
      subtitle: "Expense Voucher & Breakdown",
      description: "Detailed expense bill report with line items, tax calculations, exchange rates, and GL double-entry postings.",
      format: "A4 Portrait",
      icon: ScrollText,
      color: "from-red-500 to-rose-700",
      badgeColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
      onPrint: handlePrintExpenses,
      category: "Expenses",
      dataCount: 12,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Islamabad HQ" : selectedBranch,
      branchCode: "PK-ISB-001",
      periodFrom: "2026-06-01 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 05:10 PM",
      activeUsersCount: 2,
      processPercent: 90,
      processTimeRemaining: "10 Mins Remaining",
      subBranches: [
        { name: "Islamabad HQ", code: "PK-ISB-001", status: "Active", users: 2, lastTime: "05:10 PM", progress: 90 }
      ]
    },
    {
      id: "trade-document",
      title: "Trade Contract Document",
      subtitle: "International Trade Agreement",
      description: "Official trade contract document with shipping details, container numbers, port information, and terms of delivery.",
      format: "A4 Portrait",
      icon: FileBarChart,
      color: "from-violet-600 to-purple-700",
      badgeColor: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
      onPrint: handlePrintTradeDocument,
      category: "Trade",
      dataCount: orders.length,
      countryName: selectedCountry === "All Countries" ? "Afghanistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Kabul Transit Station" : selectedBranch,
      branchCode: "AF-KBL-001",
      periodFrom: "2026-05-20 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 01:30 PM",
      activeUsersCount: 5,
      processPercent: 80,
      processTimeRemaining: "20 Mins Remaining",
      subBranches: [
        { name: "Kabul Transit Station", code: "AF-KBL-001", status: "Active", users: 5, lastTime: "01:30 PM", progress: 80 }
      ]
    },
    {
      id: "purchase-a4",
      title: "Purchase A4 Full Report",
      subtitle: "Complete Purchase Detail Sheet",
      description: "Full A4 portrait purchase report with all booking details, goods specification, payment history, and workflow journey.",
      format: "A4 Portrait",
      icon: FileCheck,
      color: "from-green-600 to-emerald-700",
      badgeColor: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
      onPrint: handlePrintPurchaseA4,
      category: "Purchase",
      dataCount: orders.length,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Quetta City Branch" : selectedBranch,
      branchCode: "CHN-QUETTA-001",
      periodFrom: "2026-06-01 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 04:00 PM",
      activeUsersCount: 6,
      processPercent: 94,
      processTimeRemaining: "6 Mins Remaining",
      subBranches: [
        { name: "Quetta City Branch", code: "CHN-QUETTA-001", status: "Active", users: 6, lastTime: "04:00 PM", progress: 94 }
      ]
    },
    {
      id: "user-activity",
      title: "User Activity Report",
      subtitle: "ERP User Audit Trail",
      description: "User activity summary showing login count, transaction count, and module usage statistics.",
      format: "A4 Portrait",
      icon: Users,
      color: "from-slate-600 to-gray-700",
      badgeColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
      onPrint: handlePrintUserActivity,
      category: "Audit",
      dataCount: 18,
      countryName: selectedCountry === "All Countries" ? "Global" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Enterprise Wide" : selectedBranch,
      branchCode: "GLB-ALL",
      periodFrom: "2026-06-01 00:00 AM",
      periodTo: "2026-06-12 11:59 PM",
      lastActiveTime: "2026-06-12 08:30 PM",
      activeUsersCount: 14,
      processPercent: 99,
      processTimeRemaining: "1 Min Remaining",
      subBranches: [
        { name: "Global Enterprise Wide", code: "GLB-ALL", status: "Active", users: 14, lastTime: "08:30 PM", progress: 99 }
      ]
    },
    {
      id: "daily-roznamcha",
      title: "Daily Roznamcha Summary",
      subtitle: "Day-End Cash Journal Report",
      description: "End-of-day summary of all cash entries, receipts, and payments for a specific branch.",
      format: "A4 Portrait",
      icon: Scale,
      color: "from-yellow-600 to-amber-700",
      badgeColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
      onPrint: handlePrintDailyRoznamcha,
      category: "Cash",
      dataCount: roznamchaEntries.length,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Quetta City Branch" : selectedBranch,
      branchCode: "CHN-QUETTA-001",
      periodFrom: "2026-06-12 08:00 AM",
      periodTo: "2026-06-12 08:00 PM",
      lastActiveTime: "2026-06-12 07:45 PM",
      activeUsersCount: 4,
      processPercent: 87,
      processTimeRemaining: "13 Mins Remaining",
      subBranches: [
        { name: "Quetta City Branch", code: "CHN-QUETTA-001", status: "Active", users: 4, lastTime: "07:45 PM", progress: 87 }
      ]
    },
    {
      id: "ledger-balance",
      title: "Ledger Balance Report",
      subtitle: "GL Ledger Balance Sheet",
      description: "Complete ledger balance report showing debit totals, credit totals, and current balance for each ledger account.",
      format: "A4 Portrait",
      icon: BarChart3,
      color: "from-fuchsia-600 to-pink-700",
      badgeColor: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
      onPrint: handlePrintLedgerBalance,
      category: "Accounting",
      dataCount: ledgersList.length,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Karachi Main HQ" : selectedBranch,
      branchCode: "PK-KHI-MAIN",
      periodFrom: "2026-01-01 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 05:00 PM",
      activeUsersCount: 8,
      processPercent: 91,
      processTimeRemaining: "9 Mins Remaining",
      subBranches: [
        { name: "Karachi Main HQ", code: "PK-KHI-MAIN", status: "Active", users: 8, lastTime: "05:00 PM", progress: 91 }
      ]
    },
    {
      id: "transfer-verification",
      title: "Purchase Transfer Verification Sheet",
      subtitle: "SAP/Oracle Grade Audit Sheet",
      description: "Enterprise-grade transfer verification with workflow pipeline, KPI cards, GL double-entry matrix, and 5-language support.",
      format: "A4 Portrait",
      icon: ArrowRightLeft,
      color: "from-emerald-700 to-green-800",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      onPrint: handlePrintTransferVerification,
      category: "Purchase",
      dataCount: orders.length,
      countryName: selectedCountry === "All Countries" ? "Pakistan" : selectedCountry,
      branchName: selectedBranch === "All Branches" ? "Main HQ Branch" : selectedBranch,
      branchCode: "PK-MAIN-001",
      periodFrom: "2026-06-01 09:00 AM",
      periodTo: "2026-06-12 06:00 PM",
      lastActiveTime: "2026-06-12 06:15 PM",
      activeUsersCount: 5,
      processPercent: 97,
      processTimeRemaining: "3 Mins Remaining",
      subBranches: [
        { name: "Main HQ Branch", code: "PK-MAIN-001", status: "Active", users: 5, lastTime: "06:15 PM", progress: 97 }
      ]
    },
  ], [handlePrintCustomerLedger, handlePrintLoadingRecords, handlePrintFinalizedPO, handlePrintTransferPayment, handlePrintCashEntries, handlePrintPurchaseBooking, handlePrintRoznamchaVoucher, handlePrintSalesOrder, handlePrintAccountStatement, handlePrintProformaInvoice, handlePrintExpenses, handlePrintTradeDocument, handlePrintPurchaseA4, handlePrintUserActivity, handlePrintDailyRoznamcha, handlePrintLedgerBalance, handlePrintTransferVerification, roznamchaEntries, loadingRecords, orders, salesOrders, accountsList, ledgersList, selectedCountry, selectedBranch]);

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
            <span>Dashboard</span><span>›</span><span>Reports Hub</span><span>›</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">All Super Admin Journal Reporting</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Printer className="h-7 w-7 text-blue-600" />
            All Super Admin Journal Reporting & Print Hub
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Control ERP reporting hub with {reportCards.length} reports connected to live database • Auto-refresh every 60s
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
              Super Admin Scope
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
              Country Admin Scope
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
              Branch Admin Scope
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
                  <th className="px-3 py-3 text-center w-12">+ / -</th>
                  <th className="px-4 py-3 min-w-[200px]">Report / Form Name</th>
                  <th className="px-3 py-3">Assigned Country</th>
                  <th className="px-3 py-3 min-w-[140px]">Branch Name & Code</th>
                  <th className="px-3 py-3 min-w-[180px]">Activity Period (From — To)</th>
                  <th className="px-3 py-3 min-w-[130px]">Last Active Time</th>
                  <th className="px-3 py-3 text-center">Active Users</th>
                  <th className="px-3 py-3 text-center w-12">Actions (•••)</th>
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

                        {/* Activity Period (From - To) */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{card.periodFrom}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 pl-4 font-mono">To: {card.periodTo}</div>
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
                              <div className="px-2.5 py-1 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                                REPORT ACTIONS
                              </div>
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
                              
                              {/* 1. Process Duration & Remaining Time Progress Bar */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50/60 dark:bg-blue-950/40 p-3 rounded-lg border border-blue-100 dark:border-blue-900/40">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-1.5 rounded-lg bg-blue-600 text-white"><Timer className="h-4 w-4 animate-spin" /></div>
                                  <div>
                                    <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                                      Process Progress & Processing Time Remaining
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-semibold">
                                      Estimated Completion: {card.processTimeRemaining} ({card.processPercent}% Completed)
                                    </span>
                                  </div>
                                </div>

                                {/* Animated Progress Bar Strip */}
                                <div className="w-full sm:w-64 space-y-1">
                                  <div className="flex justify-between text-[10px] font-extrabold text-blue-700 dark:text-blue-300">
                                    <span>Progress</span>
                                    <span>{card.processPercent}%</span>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 rounded-full"
                                      style={{ width: `${card.processPercent}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* 2. Sub-Branches Table Tree Under Country */}
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                                  <Building2 className="h-3 w-3 text-blue-500" /> Active Branches Under {card.countryName}
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-[9.5px] font-black uppercase">
                                        <th className="px-3 py-2">Branch Name</th>
                                        <th className="px-3 py-2">Branch Code</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-3 py-2 text-center">Active Staff Users</th>
                                        <th className="px-3 py-2 text-center">Last Active Time</th>
                                        <th className="px-3 py-2 text-center">Progress %</th>
                                        <th className="px-3 py-2 text-center">Form Actions</th>
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
                                          <td className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-300">{sub.users} Staff Users</td>
                                          <td className="px-3 py-2 text-center font-mono text-slate-500">{sub.lastTime}</td>
                                          <td className="px-3 py-2 text-center font-bold text-indigo-600 dark:text-indigo-400">{sub.progress}%</td>
                                          <td className="px-3 py-2 text-center">
                                            <button
                                              type="button"
                                              onClick={card.onPrint}
                                              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition-all shadow-xs"
                                            >
                                              Open Form / Report
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
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
