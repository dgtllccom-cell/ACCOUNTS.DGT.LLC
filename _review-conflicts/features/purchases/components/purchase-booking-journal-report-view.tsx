"use client";

import { openLoadingRecordsPrintReport } from "@/lib/reports/open-loading-records-print-report";
import { openPurchaseBookingOrderPrintReport } from "@/lib/reports/open-purchase-booking-print-report";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Filter,
  Landmark,
  MoreVertical,
  PackageCheck,
  PieChart,
  Printer,
  RefreshCcw,
  Search,
  ShipWheel,
  TrendingUp,
  WalletCards,
  Globe,
  Clock3,
  FileText,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  CheckCircle,
  Wallet,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewportActionMenu } from "@/components/ui/viewport-action-menu";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { openPurchaseA4ReportWindow } from "@/lib/reports/open-purchase-a4-report-window";
import { openProformaInvoiceWindow } from "@/lib/reports/open-proforma-invoice-window";
import { openTradeDocumentWindow } from "@/lib/reports/open-trade-document-window";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";

type PurchaseReport = {
  id: string;
  purchaseBookingOrderNumber: string;
  purchaseDate: string;
  bookingDate: string;
  purchaseAccountName: string;
  purchaseAccountNumber: string;
  salesAccountName: string;
  salesAccountNumber: string;
  supplierName: string;
  buyerName: string;
  productName: string;
  goodsDescription: string;
  quantity: number;
  unit: string;
  totalWeight: number;
  containerCount: number;
  purchaseRate: number;
  totalPurchaseAmount: number;
  currency: string;
  status: string;
  currentStep?: string;
  nextStep?: string;
  bookingStatus?: string;
  confirmationStatus?: string;
  journalStatus?: string;
  paymentStatus: string;
  containerStatus?: string;
  inventoryStatus?: string;
  deliveryStatus?: string;
  finalDeliveryStatus?: string;
  workflowDates?: Record<string, unknown>;
  workflowTotals?: Record<string, unknown>;
  workflowAuditTrail?: Array<Record<string, unknown>>;
  branchName: string;
  branchCode?: string;
  countryName: string;
  countryCode?: string;
  createdAt: string;
  totalGrossWeight?: number;
  totalNetWeight?: number;
  purchaseAmount?: number;
  finalAmount?: number;
  exchange_rate?: number;
  remarks?: string;
  purchaseContractNo?: string;
  manualBillNumber?: string;
  createdByName?: string;
  finalCurrency?: string;
  form_data?: any;
  audit: {
    userName: string;
    userId: string;
    branchCode: string;
  };
};

type ApiPayload = {
  ok: boolean;
  data?: {
    reports: PurchaseReport[];
    selected: PurchaseReport | null;
    summary: {
      total: number;
      totalAmount: number;
      totalQuantity: number;
      totalContainers: number;
    };
    scope?: {
      type: "super_admin" | "country" | "main_branch" | "city_branch";
      countryIds: string[];
      countryBranchIds: string[];
      cityBranchIds: string[];
      isGlobal: boolean;
    };
    warning?: string;
  };
  error?: string | { message?: string };
};

type ReportScope = NonNullable<NonNullable<ApiPayload["data"]>["scope"]>;

type ContainerRow = {
  id: string;
  bookingNo: string;
  containerNo: string;
  blNo: string;
  truckNo: string;
  sealNo: string;
  loadingCountry: string;
  receivingCountry: string;
  loadingDate: string;
  receivingDate: string;
  status: "Confirmed" | "Pending" | "Cancelled";
  confirmedOn: string;
};

type DashboardTab = "overview" | "daily" | "general" | "purchase" | "branch";

function initialPurchaseOrderFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("purchaseOrderNo") ?? "";
}

type CurrencyBookingSummary = {
  currency: string;
  totalOrders: number;
  totalAmount: number;
  totalInvoiceAmount: number;
  paidAmount: number;
  dueAmount: number;
  advanceAmount: number;
  pendingPayment: number;
  billsCount: number;

  bookedCount: number;
  bookedAmount: number;
  transferredCount: number;
  transferredAmount: number;
  verifiedCount: number;
  verifiedAmount: number;
  paymentDoneCount: number;
  paymentDoneAmount: number;
  pendingCount: number;
  pendingAmount: number;
};

export type PurchaseCurrencySummaryFC = {
  currency: string;
  totalPurchase: number;
  advancePaid: number;
  remainingBalance: number;
  advanceRequired: number;
};

export type DashboardSummaryData = {
  country: string;
  branchName: string;
  userName: string;
  userId: string;
  role: string;
  
  totalTransactions: number;
  localCurrency: string;
  
  // Left side (Foreign Currencies)
  foreignCurrencies: Record<string, PurchaseCurrencySummaryFC>;
  totalAllFC: {
    totalPurchase: number;
    advancePaid: number;
    remainingBalance: number;
    advanceRequired: number;
  };
  
  // Right side (Local Currency)
  totalPurchaseLC: number;
  advancePaidLC: number;
  remainingBalanceLC: number;
  totalAdvanceRequiredLC: number;
};

function getDashboardSummaryData(rows: PurchaseReport[], session: any): DashboardSummaryData | null {
  if (!rows || rows.length === 0) return null;

  const firstRow = rows[0];
  const country = firstRow.countryName || session?.countryName || "Unknown";
  const branchName = session?.branchName || "Main Branch";
  
  let baseCurrencyFallback = firstRow?.form_data?.form?.secondaryCurrency?.split(" ")?.[0];
  if (!baseCurrencyFallback) {
    const c = country.toUpperCase();
    if (c.includes("PAKISTAN") || c === "PK") baseCurrencyFallback = "PKR";
    else if (c.includes("EMIRATES") || c.includes("DUBAI") || c === "AE" || c === "UAE") baseCurrencyFallback = "AED";
    else if (c.includes("INDIA") || c === "IN") baseCurrencyFallback = "INR";
    else baseCurrencyFallback = "PKR";
  }
                             
  const localCurRaw = baseCurrencyFallback;
  const localCur = (localCurRaw === "USD") ? "PKR" : localCurRaw;

  const summary: DashboardSummaryData = {
    country,
    branchName,
    userName: session?.name || session?.username || session?.user?.fullName || "SUPER ADMIN",
    userId: session?.userId || session?.user?.id || "SA001",
    role: session?.role || "Super Admin",
    
    totalTransactions: rows.length,
    localCurrency: localCur,
    
    foreignCurrencies: {},
    totalAllFC: { totalPurchase: 0, advancePaid: 0, remainingBalance: 0, advanceRequired: 0 },
    
    totalPurchaseLC: 0,
    advancePaidLC: 0,
    remainingBalanceLC: 0,
    totalAdvanceRequiredLC: 0,
  };

  const parseNumber = (val: unknown): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const num = Number(String(val).replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  rows.forEach((row) => {
    let foreignCur = String(row.currency || row.form_data?.form?.currencyType || row.form_data?.form?.purchaseCurrency || "").toUpperCase();
    if (!foreignCur || foreignCur === "UNDEFINED") {
       foreignCur = "USD";
    }

    const invoiceAmountRaw = parseNumber(row.totalPurchaseAmount || row.purchaseAmount || 0);
    const advancePaidRaw = parseNumber((row as any).advance_paid || 0);
    const exRateRaw = parseNumber((row as any).exchange_rate || row.form_data?.goodsEntries?.[0]?.exchangeRate || row.form_data?.goodsEntries?.[0]?.rate2 || 1);
    const exRate = exRateRaw > 0 ? exRateRaw : 1;
    
    const invoiceAmountFC = invoiceAmountRaw;
    const advancePaidFC = (exRate > 1 && advancePaidRaw > invoiceAmountFC * 1.05) ? advancePaidRaw / exRate : advancePaidRaw;
    const remainingFC = Math.max(0, invoiceAmountFC - advancePaidFC);

    const invoiceAmountLC = invoiceAmountFC * exRate;
    const advancePaidLC = advancePaidFC * exRate;
    const remainingLC = remainingFC * exRate;

    // Calculate advance required based on row advance percent (defaulting to 10)
    const advancePercent = Number(row.form_data?.form?.advancePercent || row.form_data?.form?.invoicePercent || 10);
    const advanceRequiredFC = (invoiceAmountFC * advancePercent) / 100;
    const advanceRequiredLC = (invoiceAmountLC * advancePercent) / 100;

    if (!summary.foreignCurrencies[foreignCur]) {
      summary.foreignCurrencies[foreignCur] = {
        currency: foreignCur,
        totalPurchase: 0,
        advancePaid: 0,
        remainingBalance: 0,
        advanceRequired: 0
      };
    }
    summary.foreignCurrencies[foreignCur].totalPurchase += invoiceAmountFC;
    summary.foreignCurrencies[foreignCur].advancePaid += advancePaidFC;
    summary.foreignCurrencies[foreignCur].remainingBalance += remainingFC;
    summary.foreignCurrencies[foreignCur].advanceRequired += advanceRequiredFC;
    
    summary.totalAllFC.totalPurchase += invoiceAmountFC;
    summary.totalAllFC.advancePaid += advancePaidFC;
    summary.totalAllFC.remainingBalance += remainingFC;
    summary.totalAllFC.advanceRequired += advanceRequiredFC;

    summary.totalPurchaseLC += invoiceAmountLC;
    summary.advancePaidLC += advancePaidLC;
    summary.remainingBalanceLC += remainingLC;
    summary.totalAdvanceRequiredLC += advanceRequiredLC;
  });

  return summary;
}

function money(value: unknown, currency = "") {
  const amount = Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${amount} ${currency}` : amount;
}

const sampleReports: PurchaseReport[] = [
  {
    id: "sample-1",
    purchaseBookingOrderNumber: "PB-2025-0001",
    purchaseDate: "2025-01-02",
    bookingDate: "2025-01-02",
    purchaseAccountName: "Kabul Dry Fruits Purchase Account",
    purchaseAccountNumber: "PA-1001",
    salesAccountName: "Damaan Sales Account",
    salesAccountNumber: "SA-2001",
    supplierName: "Kabul Dry Fruits Wholesale",
    buyerName: "Damaan Trading LLC",
    productName: "Pistachio Kernels",
    goodsDescription: "Premium dry fruits container booking",
    quantity: 500,
    unit: "MT",
    totalWeight: 500000,
    containerCount: 10,
    purchaseRate: 250,
    totalPurchaseAmount: 125000,
    currency: "USD",
    status: "Partial Confirmed",
    paymentStatus: "Advance Paid",
    branchName: "Kabul Main Branch",
    countryName: "Afghanistan",
    createdAt: "2025-01-02T10:00:00.000Z",
    audit: { userName: "Admin User", userId: "USR-001", branchCode: "KBL-001" }
  },
  {
    id: "sample-2",
    purchaseBookingOrderNumber: "PB-2025-0002",
    purchaseDate: "2025-01-01",
    bookingDate: "2025-01-01",
    purchaseAccountName: "Afghan Traders Purchase",
    purchaseAccountNumber: "PA-1002",
    salesAccountName: "Dubai Sales Account",
    salesAccountNumber: "SA-2002",
    supplierName: "Afghan Traders Group",
    buyerName: "Damaan UAE",
    productName: "Almonds",
    goodsDescription: "Almond container booking",
    quantity: 250,
    unit: "MT",
    totalWeight: 250000,
    containerCount: 5,
    purchaseRate: 250,
    totalPurchaseAmount: 62500,
    currency: "USD",
    status: "Fully Confirmed",
    paymentStatus: "Full Payment",
    branchName: "Dubai Main Branch",
    countryName: "Afghanistan",
    createdAt: "2025-01-01T11:30:00.000Z",
    audit: { userName: "Admin User", userId: "USR-001", branchCode: "DXB-001" }
  },
  {
    id: "sample-3",
    purchaseBookingOrderNumber: "PB-2024-0098",
    purchaseDate: "2024-12-31",
    bookingDate: "2024-12-31",
    purchaseAccountName: "Kabul Dry Fruits Purchase Account",
    purchaseAccountNumber: "PA-1001",
    salesAccountName: "Damaan Sales Account",
    salesAccountNumber: "SA-2001",
    supplierName: "Kabul Dry Fruits Wholesale",
    buyerName: "Damaan Pakistan",
    productName: "Raisins",
    goodsDescription: "Raisins purchase booking",
    quantity: 200,
    unit: "MT",
    totalWeight: 200000,
    containerCount: 8,
    purchaseRate: 200,
    totalPurchaseAmount: 40000,
    currency: "USD",
    status: "Open",
    paymentStatus: "Pending",
    branchName: "Quetta City Branch",
    countryName: "Afghanistan",
    createdAt: "2024-12-31T12:00:00.000Z",
    audit: { userName: "Admin User", userId: "USR-001", branchCode: "QTA-001" }
  },
  {
    id: "sample-4",
    purchaseBookingOrderNumber: "PB-2024-0097",
    purchaseDate: "2024-12-30",
    bookingDate: "2024-12-30",
    purchaseAccountName: "Herat Purchase Account",
    purchaseAccountNumber: "PA-1003",
    salesAccountName: "Wholesale Sales Account",
    salesAccountNumber: "SA-2003",
    supplierName: "Herat Wholesale Co.",
    buyerName: "Damaan Trading LLC",
    productName: "Pistachio Nuts",
    goodsDescription: "Pistachio nuts bulk booking",
    quantity: 600,
    unit: "MT",
    totalWeight: 600000,
    containerCount: 12,
    purchaseRate: 250,
    totalPurchaseAmount: 150000,
    currency: "USD",
    status: "Partial Confirmed",
    paymentStatus: "Partial Payment",
    branchName: "Herat Branch",
    countryName: "Afghanistan",
    createdAt: "2024-12-30T12:00:00.000Z",
    audit: { userName: "Admin User", userId: "USR-001", branchCode: "HRT-001" }
  },
  {
    id: "sample-5",
    purchaseBookingOrderNumber: "PB-2024-0096",
    purchaseDate: "2024-12-29",
    bookingDate: "2024-12-29",
    purchaseAccountName: "Kabul Purchase Account",
    purchaseAccountNumber: "PA-1004",
    salesAccountName: "Damaan Sales Account",
    salesAccountNumber: "SA-2001",
    supplierName: "Kabul Dry Fruits Wholesale",
    buyerName: "Damaan Trading LLC",
    productName: "Walnuts",
    goodsDescription: "Walnut purchase booking",
    quantity: 300.75,
    unit: "MT",
    totalWeight: 300750,
    containerCount: 6,
    purchaseRate: 251.58,
    totalPurchaseAmount: 75657.5,
    currency: "USD",
    status: "Fully Confirmed",
    paymentStatus: "Full Payment",
    branchName: "Kabul Main Branch",
    countryName: "Afghanistan",
    createdAt: "2024-12-29T12:00:00.000Z",
    audit: { userName: "Admin User", userId: "USR-001", branchCode: "KBL-001" }
  }
];

function formatMoney(value: unknown) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(value: unknown) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

function date(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB");
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function formatIsoDate(value: string | null | undefined) {
  if (!value) return "N/A";
  if (value === "-" || value === "N/A") return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function safeTerm(value: string) {
  return value.trim().toLowerCase();
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("full") || normalized.includes("complete") || normalized.includes("confirmed")) return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (normalized.includes("partial")) return "border-amber-300 bg-amber-50 text-amber-700";
  if (normalized.includes("cancel")) return "border-red-300 bg-red-50 text-red-700";
  return "border-sky-300 bg-sky-50 text-sky-700";
}

function makeContainers(report: PurchaseReport | null): ContainerRow[] {
  if (!report) return [];
  const total = Math.max(1, Math.min(10, Number(report.containerCount || 0) || 5));
  const confirmed = report.status.toLowerCase().includes("full") ? total : report.status.toLowerCase().includes("partial") ? Math.max(1, Math.floor(total * 0.25)) : 0;
  return Array.from({ length: total }).map((_, index) => {
    const isConfirmed = index < confirmed;
    return {
      id: `${report.id}-container-${index + 1}`,
      bookingNo: report.purchaseBookingOrderNumber,
      containerNo: `CONT-${String(index + 1).padStart(3, "0")}`,
      blNo: isConfirmed ? `BL-${1001 + index}` : "-",
      truckNo: isConfirmed ? (index % 2 ? "XYZ-888" : "ABC-123") : "-",
      sealNo: isConfirmed ? `S-00123${index + 4}` : "-",
      loadingCountry: report.countryName || "Afghanistan",
      receivingCountry: report.branchName || "Dubai",
      loadingDate: isConfirmed ? report.purchaseDate : "-",
      receivingDate: isConfirmed ? report.purchaseDate : "-",
      status: report.status.toLowerCase().includes("cancel") ? "Cancelled" : isConfirmed ? "Confirmed" : "Pending",
      confirmedOn: isConfirmed ? report.purchaseDate : "-"
    };
  });
}

function exportCsv(rows: PurchaseReport[], fileName: string) {
  try {
    const headers = [
      "P#",
      "Date",
      "Branch",
      "Allot",
      "Good Name",
      "ORIGIN",
      "Warehouse",
      "Invoice No.",
      "Seller Acc.",
      "Qty",
      "KGs",
      "P.TYPE",
      "D.Terms",
      "Route",
      "Loading",
      "Loading Date",
      "Receiving",
      "Receiving Date"
    ];
    const csvRows = rows.map((row, index) => {
      const pNum = `P#${rows.length - index}`;
      
      const goods = row.form_data?.goodsEntries || [];
      const allot = goods.map((g: any) => g.allotName).filter(Boolean).join("; ") || row.form_data?.form?.allotName || "N/A";
      const goodName = goods.map((g: any) => g.goodsName).filter(Boolean).join("; ") || row.productName || "N/A";
      const origin = goods.map((g: any) => g.origin).filter(Boolean).join("; ") || "N/A";
      const warehouse = goods.map((g: any) => g.warehouse).filter(Boolean).join("; ") || "N/A";
      const invoiceNo = row.form_data?.form?.billNo || row.form_data?.form?.invoiceNo || row.form_data?.form?.purchaseContractNo || row.purchaseContractNo || "N/A";
      const sellerAcc = row.form_data?.form?.purchaseAccountName || row.supplierName || "-";
      
      const qty = goods.length > 0 ? goods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || 0), 0) : "N/A";
      const kgs = goods.length > 0 ? goods.reduce((sum: number, g: any) => sum + Number(g.netWeight || g.grossWeight || 0), 0) : "N/A";

      const dateStr = formatShortDate(row.purchaseDate);
      const branch = row.branchName || row.form_data?.form?.branchCode || "-";

      const pTypeRaw = String(row.form_data?.form?.paymentType || row.paymentStatus || "");
      let pType = "N/A";
      if (pTypeRaw.toLowerCase().includes("advance")) pType = "Advance";
      else if (pTypeRaw.toLowerCase().includes("credit")) pType = "Credit";
      else if (pTypeRaw.toLowerCase().includes("full") || pTypeRaw.toLowerCase().includes("final")) pType = "Full";
      else if (pTypeRaw) pType = pTypeRaw;

      const dTerms = row.form_data?.form?.deliveryTerms || row.form_data?.form?.dTerms || row.form_data?.form?.incoterms || row.form_data?.form?.transportAgent || row.form_data?.form?.paymentDaysAndMethodDetails || "N/A";
      
      const routeRaw = String(row.form_data?.form?.shippingMode || row.form_data?.form?.shippingType || row.form_data?.form?.shipmentType || "");
      const route = routeRaw.replace(/^By\s+/i, "") || "N/A";

      const loadingLoc = row.form_data?.form?.loadingCountry || "N/A";
      const loadingDate = formatIsoDate(row.form_data?.form?.loadingDate);
      const receivingLoc = row.form_data?.form?.receivedCountry || "N/A";
      const receivingDate = formatIsoDate(row.form_data?.form?.receivedDate);

      return [
        pNum,
        dateStr,
        branch,
        allot,
        goodName,
        origin,
        warehouse,
        invoiceNo,
        sellerAcc,
        qty,
        kgs,
        pType,
        dTerms,
        route,
        loadingLoc,
        loadingDate,
        receivingLoc,
        receivingDate
      ].map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",");
    });

    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to export rows:", error);
    alert("Failed to export to CSV. Please try again.");
  }
}

function printReport() {
  if (typeof window !== "undefined") window.print();
}

function openReportWindow(report: PurchaseReport, autoPrint: boolean) {
  openPurchaseA4ReportWindow({
    title: "Purchase Booking Order",
    subtitle: "DGT Accounts Purchase Registry",
    purchaseData: {
      ...report,
      audit: report.audit || { userName: "Admin User", userId: "USR-001", branchCode: "QTA-001" }
    },
    autoPrint
  });
}

function ReportToolbar({
  title,
  rows,
  draftStatus,
  searchText,
  filtersOpen,
  onDraftChange,
  onSearchChange,
  onToggleFilters,
  onReset,
  onExport
}: {
  title: string;
  rows: PurchaseReport[];
  draftStatus: string;
  searchText: string;
  filtersOpen: boolean;
  onDraftChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onToggleFilters: () => void;
  onReset: () => void;
  onExport?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Purchase Management</p>
          <h2 className="text-base font-black text-foreground">{title}</h2>
        </div>
        <div className="flex flex-1 flex-col gap-2 lg:max-w-5xl lg:flex-row lg:items-center lg:justify-end">
          <select
             value={draftStatus}
            onChange={(event) => onDraftChange(event.target.value)}
            className="h-9 min-w-[150px] rounded-lg border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
            aria-label="Draft status"
          >
            <option value="">Draft Dropdown</option>
            <option value="open">Open</option>
            <option value="partial">Partial Confirmed</option>
            <option value="fully">Fully Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="relative min-w-[220px] flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchText}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search booking, account, supplier, branch"
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onToggleFilters} className="h-9">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onReset} className="h-9">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <ReportActionsMenu rows={rows} onExport={onExport!} />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>Scope filters {filtersOpen ? "ready" : "collapsed"}</span>
        <span className="font-semibold">Rows: {rows.length}</span>
      </div>
    </div>
  );
}

function ScopeRegisterPanel({
  scope,
  rows,
  totals
}: {
  scope: ReportScope | null;
  rows: number;
  totals: { totalAmount: number; totalContainers: number; outstanding: number };
}) {
  const label =
    scope?.type === "super_admin"
      ? "Super Admin Register"
      : scope?.type === "country"
        ? "Country Purchase Register"
        : scope?.type === "main_branch"
          ? "Main Branch Purchase Register"
          : scope?.type === "city_branch"
            ? "City Branch Purchase Register"
            : "Purchase Register Scope";
  const detail = scope?.isGlobal
    ? "Global access: all countries, branches, and city branches."
    : scope
      ? [
          scope.countryIds.length ? `${scope.countryIds.length} country scope` : "",
          scope.countryBranchIds.length ? `${scope.countryBranchIds.length} main branch scope` : "",
          scope.cityBranchIds.length ? `${scope.cityBranchIds.length} city branch scope` : ""
        ].filter(Boolean).join(" / ") || "Session scoped records only"
      : "Scope will appear after the register API loads.";

  return (
    <div className="my-3 grid gap-2 rounded-xl border border-blue-400/25 bg-blue-500/10 p-3 text-xs text-blue-50 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <div className="font-black uppercase tracking-[0.18em] text-blue-200">{label}</div>
        <div className="mt-1 text-blue-100/80">{detail}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScopePill label="Records" value={rows} />
        <ScopePill label="Containers" value={totals.totalContainers} />
        <ScopePill label="Amount" value={formatMoney(totals.totalAmount)} />
        <ScopePill label="Outstanding" value={formatMoney(totals.outstanding)} />
      </div>
    </div>
  );
}

function ScopePill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-blue-300/20 bg-slate-950/40 px-3 py-2 text-right">
      <div className="text-[10px] font-bold uppercase text-blue-200/70">{label}</div>
      <div className="text-sm font-black text-white">{value}</div>
    </div>
  );
}
function getCurrencySymbol(c: string) {
  if (!c) return "";
  const upper = c.toUpperCase();
  if (upper === "USD") return "$";
  if (upper === "AED") return "د.إ";
  if (upper === "PKR") return "₨";
  if (upper === "AFN") return "؋";
  if (upper === "INR") return "₹";
  return upper;
}

function getCountryFlag(countryName: string | undefined | null) {
  if (!countryName) return "🌐";
  const name = countryName.toLowerCase();
  if (name.includes("united arab") || name.includes("uae") || name.includes("dubai")) return "🇦🇪";
  if (name.includes("pakistan") || name.includes("chaman") || name.includes("karachi")) return "🇵🇰";
  if (name.includes("afghanistan") || name.includes("kabul")) return "🇦🇫";
  if (name.includes("india") || name.includes("mumbai")) return "🇮🇳";
  if (name.includes("iran") || name.includes("tehran")) return "🇮🇷";
  if (name.includes("usa") || name.includes("united states") || name.includes("new york")) return "🇺🇸";
  return "🌐";
}

function ReportActionsMenu({ rows, onExport }: { rows: PurchaseReport[]; onExport: () => void }) {
  return (
    <ViewportActionMenu
      ariaLabel="Report actions"
      buttonClassName="flex h-9 w-10 items-center justify-center rounded-lg border border-input bg-background text-foreground transition hover:bg-muted"
      trigger={<MoreVertical className="h-4 w-4" />}
    >
      {(close) => (
        <>
          <MenuAction icon={<Eye />} label="Plate View" onClick={() => close()} />
          <MenuAction icon={<DownloadActionIcon />} label="Download" onClick={() => { close(); onExport ? onExport() : exportCsv(rows, "purchase-booking-register.csv"); }} />
          <MenuAction icon={<FileSpreadsheet />} label="Export Excel" onClick={() => { close(); onExport ? onExport() : exportCsv(rows, "purchase-booking-register.csv"); }} />
          <MenuAction icon={<DownloadActionIcon />} label="Export PDF" onClick={() => { close(); printReport(); }} />
          <MenuAction icon={<Printer />} label="Print" onClick={() => { close(); printReport(); }} />
          <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{rows.length} report rows selected</div>
        </>
      )}
    </ViewportActionMenu>
  );
}

function RowActionsMenu({
  report,
  onSelect,
  onEdit,
  onAccept,
  onTransfer,
  onPrint,
  onPdf
}: {
  report: any;
  onSelect: () => void;
  onEdit?: () => void;
  onAccept?: () => void;
  onTransfer?: () => void;
  onPrint?: () => void;
  onPdf?: () => void;
  isSuperAdmin?: boolean;
  isCountryAdmin?: boolean;
  isBranchAdmin?: boolean;
}) {
  const router = useRouter();

  return (
    <UnifiedActionMenu
      onView={onSelect}
      onEdit={() => {
        if (onEdit) onEdit();
        else router.push(`/dashboard/purchase/new-purchase-booking-order?id=${encodeURIComponent(report.id)}&purchaseOrderNo=${encodeURIComponent(report.purchaseBookingOrderNumber)}`);
      }}
      onPrint={onPrint || (() => openReportWindow(report, true))}
      onExportPdf={onPdf || (() => openReportWindow(report, false))}
      onEmail={() => alert(`Email initiated for Booking: ${report.purchaseBookingOrderNumber}`)}
      onWhatsApp={() => alert(`WhatsApp initiated for Booking: ${report.purchaseBookingOrderNumber}`)}
      customItems={[
        { label: "Accept Bill", icon: <CheckCircle className="h-4 w-4 text-rose-500" />, onClick: () => { if (onAccept) onAccept(); else onSelect(); } },
        { label: "Transfer Bill", icon: <ArrowRight className="h-4 w-4 text-emerald-500" />, onClick: () => { if (onTransfer) onTransfer(); else onSelect(); } },
        { label: "History Timeline", icon: <Clock className="h-4 w-4 text-purple-500" />, onClick: onSelect }
      ]}
    />
  );
}

function MenuAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-muted">
      <span className="text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {label}
    </button>
  );
}

function TabNavigation({ activeTab, onChange, isBranchAdmin }: { activeTab: DashboardTab; onChange: (tab: DashboardTab) => void; isBranchAdmin?: boolean }) {
  const tabs = [
    { key: "overview", label: "Dashboard Overview", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "daily", label: "Daily Reports", icon: <ClipboardList className="h-4 w-4" /> },
    { key: "general", label: "General Reports", icon: <Landmark className="h-4 w-4" /> },
    { key: "purchase", label: "Purchase Booking Reports", icon: <PackageCheck className="h-4 w-4" /> },
    ...(!isBranchAdmin ? [{ key: "branch", label: "Branch Summary", icon: <TrendingUp className="h-4 w-4" /> }] : [])
  ] as Array<{ key: DashboardTab; label: string; icon: React.ReactNode }>;

  return (
    <div className="mb-3 overflow-x-auto rounded-xl border border-slate-700 bg-[#0b1730] p-2">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition ${
              activeTab === tab.key
                ? "border-blue-400/70 bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-blue-400/50 hover:bg-blue-500/10"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DailyFilterRow({
  filters,
  setFilters,
  suppliers,
  currencies
}: {
  filters: { fromDate: string; toDate: string; financialSupplier: string; financialCurrency: string };
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  suppliers: string[];
  currencies: string[];
}) {
  return (
    <>
      <DarkInput label="From Date" type="date" value={filters.fromDate} onChange={(value) => setFilters((previous: any) => ({ ...previous, fromDate: value }))} />
      <DarkInput label="To Date" type="date" value={filters.toDate} onChange={(value) => setFilters((previous: any) => ({ ...previous, toDate: value }))} />
      <DarkSelect label="Supplier" value={filters.financialSupplier} options={suppliers} placeholder="All Suppliers" onChange={(value) => setFilters((previous: any) => ({ ...previous, financialSupplier: value }))} />
      <DarkSelect label="Currency" value={filters.financialCurrency} options={currencies} placeholder="All" onChange={(value) => setFilters((previous: any) => ({ ...previous, financialCurrency: value }))} />
    </>
  );
}

function GeneralFilterRow({
  filters,
  setFilters,
  branches,
  countries,
  disabledCountry,
  disabledBranch
}: {
  filters: { branch: string; country: string; status: string };
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  branches: string[];
  countries: string[];
  disabledCountry?: boolean;
  disabledBranch?: boolean;
}) {
  return (
    <>
      <DarkSelect disabled={disabledCountry} label="Country" value={filters.country} options={countries} placeholder="All Countries" onChange={(value) => setFilters((previous: any) => ({ ...previous, country: value }))} />
      <DarkSelect disabled={disabledBranch} label="Branch" value={filters.branch} options={branches} placeholder="All Branches" onChange={(value) => setFilters((previous: any) => ({ ...previous, branch: value }))} />
      <DarkSelect label="Status" value={filters.status} options={["Open", "Partial Confirmed", "Fully Confirmed", "Cancelled"]} placeholder="All Status" onChange={(value) => setFilters((previous: any) => ({ ...previous, status: value }))} />
    </>
  );
}

function BranchFilterRow({
  filters,
  setFilters,
  branches,
  countries,
  disabledCountry,
  disabledBranch
}: {
  filters: { branch: string; country: string };
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  branches: string[];
  countries: string[];
  disabledCountry?: boolean;
  disabledBranch?: boolean;
}) {
  return (
    <>
      <DarkSelect disabled={disabledCountry} label="Country" value={filters.country} options={countries} placeholder="All Countries" onChange={(value) => setFilters((previous: any) => ({ ...previous, country: value }))} />
      <DarkSelect disabled={disabledBranch} label="Branch" value={filters.branch} options={branches} placeholder="All Branches" onChange={(value) => setFilters((previous: any) => ({ ...previous, branch: value }))} />
    </>
  );
}

function ReportActions({ rows }: { rows: PurchaseReport[] }) {
  return (
    <details className="relative">
      <summary className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 [&::-webkit-details-marker]:hidden" aria-label="Report actions" title="Report actions">
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1 text-sm text-slate-900 shadow-xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <button
          type="button"
          onClick={() => exportCsv(rows, "purchase-booking-register.csv")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900"
        >
          <Download className="h-4 w-4 text-blue-600 dark:text-blue-450" />
          Download CSV
        </button>
        <button
          type="button"
          onClick={() => exportCsv(rows, "purchase-booking-register.csv")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-450" />
          Export Excel
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900"
        >
          <Printer className="h-4 w-4 text-slate-650" />
          Print
        </button>
      </div>
    </details>
  );
}
const getFlag = (country: string) => {
  if (!country) return "🏳️";
  const c = country.toUpperCase();
  if (c.includes("PAKISTAN")) return "🇵🇰";
  if (c.includes("UNITED ARAB") || c === "UAE") return "🇦🇪";
  if (c.includes("UNITED STATES") || c === "USA") return "🇺🇸";
  if (c.includes("SAUDI")) return "🇸🇦";
  if (c.includes("CHINA")) return "🇨🇳";
  if (c.includes("INDIA")) return "🇮🇳";
  if (c.includes("AFGHANISTAN")) return "🇦🇫";
  if (c.includes("UNITED KINGDOM") || c === "UK") return "🇬🇧";
  if (c.includes("CANADA")) return "🇨🇦";
  if (c.includes("AUSTRALIA")) return "🇦🇺";
  return "🏳️";
};

const formatAmount = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
  if (num >= 1000) return (num / 1000).toFixed(2) + "K";
  return num.toFixed(2);
};

function SuperAdminPurchaseSummary({ 
  rows,
  usdRates,
  lastExchangeRateUpdate,
  session
}: { 
  rows: PurchaseReport[],
  usdRates: Record<string, number>,
  lastExchangeRateUpdate: string | null,
  session: any
}) {
  if (!rows || rows.length === 0) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

  // Data for Report #1
  const firstRow = rows[0];
  const country = firstRow.countryName || session?.countryName || "All Countries";
  const branchName = session?.branchName || "Main Branch";
  const userName = session?.name || session?.username || session?.user?.fullName || "SUPER ADMIN";
  const userId = session?.userId || session?.user?.id || "SA001";
  const role = session?.role || "Super Admin";

  // Shared variables
  const uniqueCountries = new Set<string>();
  
  // Data for Report #2 (Purchase Summary)
  let totalCountriesPurchaseBookingCount = 0;
  let totalCountriesPurchaseLC = 0;
  let totalPurchaseLoading = 0;
  let totalPurchaseLoadingLC = 0;
  let totalPurchaseWarehouse = 0;
  let totalPurchaseWarehouseLC = 0;

  // Data for Report #3 (USD Summary)
  let totalPurchaseUSD = 0;
  let totalInvoiceUSD = 0;
  let totalPaidUSD = 0;

  // Data for Report #4 (Transaction Summary)
  let invoiceTransactions = 0;
  let paidTransactions = 0;
  let pendingTransactions = 0;
  let completedTransactions = 0;
  let cancelledTransactions = 0;
  let lastTransactionDateStr = "";
  let totalTransactionAmount = 0; // The sum of original invoice amounts
  let totalPaidAmountReport4 = 0; // Assuming same as total paid

  rows.forEach((report) => {
    const cName = report.countryName || "Unknown";
    uniqueCountries.add(cName);

    const goods = Array.isArray(report.form_data?.goodsEntries) ? report.form_data.goodsEntries : [];
    const amount = goods.length ? goods.reduce((sum: number, item: any) => sum + Number(item.totalAmount || item.finalAmount || 0), 0) : Number(report.totalPurchaseAmount || report.purchaseAmount || 0);
    
    // Default LC conversion from order if available, else use 1
    const exRateRaw = Number((report as any).exchange_rate || report.form_data?.goodsEntries?.[0]?.exchangeRate || report.form_data?.goodsEntries?.[0]?.rate2 || 1);
    const exRate = exRateRaw > 0 ? exRateRaw : 1;
    const amountLC = amount * exRate;
    
    // Status checking
    const statusText = `${report.status || ""} ${report.bookingStatus || ""} ${report.paymentStatus || ""} ${report.containerStatus || ""} ${report.inventoryStatus || ""} ${report.deliveryStatus || ""}`.toLowerCase();
    
    // Paid calculation (advance + remaining)
    const advancePaidRaw = Number((report as any).advance_paid || 0);
    const remainingPaidRaw = Number((report as any).remaining_paid || 0);
    const creditAmountRaw = Number((report as any).credit_amount || 0);
    const totalPaidRaw = advancePaidRaw + remainingPaidRaw + creditAmountRaw;
    const paidLC = totalPaidRaw * exRate;

    // Report #2 Aggregation
    totalCountriesPurchaseBookingCount += 1;
    totalCountriesPurchaseLC += amountLC;

    const isLoaded = statusText.includes("loaded") || statusText.includes("in transit") || statusText.includes("shipping");
    const isWarehouse = statusText.includes("warehouse") || statusText.includes("received") || statusText.includes("delivered");
    
    if (isLoaded) {
      totalPurchaseLoading += amount;
      totalPurchaseLoadingLC += amountLC;
    }
    if (isWarehouse) {
      totalPurchaseWarehouse += amount;
      totalPurchaseWarehouseLC += amountLC;
    }

    // Report #3 Aggregation (USD Conversion)
    const currency = String(report.currency || report.form_data?.form?.currencyType || "USD").toUpperCase();
    const usdRate = usdRates[currency] || 1; // If currency is USD, rate is 1. If INR, maybe 83. etc.
    // Ensure we multiply or divide? daily_usd_rates stores how many units of local currency = 1 USD (e.g., PKR 280)
    const toUSD = (val: number) => usdRate > 0 ? val / usdRate : val;
    
    totalPurchaseUSD += toUSD(amount);
    totalInvoiceUSD += toUSD(amount); // Assuming invoice amount is same as purchase amount for now
    totalPaidUSD += toUSD(totalPaidRaw);

    // Report #4 Aggregation
    totalTransactionAmount += amount;
    totalPaidAmountReport4 += totalPaidRaw;

    if (totalPaidRaw > 0) paidTransactions += 1;
    if (statusText.includes("invoice") || report.form_data?.form?.invoiceNo || report.form_data?.form?.billNo) invoiceTransactions += 1;
    
    if (statusText.includes("cancel")) cancelledTransactions += 1;
    else if (statusText.includes("complete") || statusText.includes("fully confirmed") || statusText.includes("posted") || statusText.includes("transferred")) completedTransactions += 1;
    else pendingTransactions += 1;

    const bDate = report.bookingDate || report.purchaseDate || report.createdAt;
    if (bDate && (!lastTransactionDateStr || new Date(bDate).getTime() > new Date(lastTransactionDateStr).getTime())) {
      lastTransactionDateStr = bDate;
    }
  });

  const totalRemainingUSD = Math.max(0, totalInvoiceUSD - totalPaidUSD);
  const activeCountriesCount = uniqueCountries.size;

  return (
    <div className="flex flex-col mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Panel 1: Branch & User Details */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="bg-blue-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">1. BRANCH & USER DETAILS</h4>
          </div>
          <div className="p-4 flex flex-col gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>Country:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">{getFlag(country)} {country}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Branch Name:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{branchName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>User ID:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{userId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>User Name:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{userName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Role:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{role}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Date & Time:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{dateStr}, {timeStr}</span>
            </div>
            <div className="flex justify-between items-center mt-auto">
              <span>Status:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">Active</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Purchase Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-900/10">
            <div className="bg-purple-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">2. PURCHASE SUMMARY</h4>
          </div>
          <div className="p-4 flex flex-col gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>Total Countries Purchase Booking:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{totalCountriesPurchaseBookingCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Total Countries Purchase (LC):</span>
              <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{formatMoney(totalCountriesPurchaseLC)}</span>
            </div>
            <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-amber-600 dark:text-amber-500">Total Purchase Loading:</span>
              <span className="font-black text-amber-700 dark:text-amber-400 font-mono">{formatMoney(totalPurchaseLoading)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-amber-600 dark:text-amber-500">Total Purchase Loading (LC):</span>
              <span className="font-black text-amber-700 dark:text-amber-400 font-mono">{formatMoney(totalPurchaseLoadingLC)}</span>
            </div>
            <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-emerald-600 dark:text-emerald-500">Total Purchase Warehouse:</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatMoney(totalPurchaseWarehouse)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-emerald-600 dark:text-emerald-500">Total Purchase Warehouse (LC):</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatMoney(totalPurchaseWarehouseLC)}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Total Active Countries:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{activeCountriesCount}</span>
            </div>
          </div>
        </div>

        {/* Panel 3: Total Countries Spread Main Summary (USD) */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div className="bg-emerald-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 truncate" title="3. TOTAL COUNTRIES SPREAD MAIN SUMMARY (USD)">3. TOTAL COUNTRIES SPREAD MAIN SUMMARY (USD)</h4>
          </div>
          <div className="p-4 flex flex-col gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>Total Purchase (USD):</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatMoney(totalPurchaseUSD)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Total Invoice Amount (USD):</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatMoney(totalInvoiceUSD)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blue-600 dark:text-blue-500">Total Paid Amount (USD):</span>
              <span className="font-black text-blue-700 dark:text-blue-400 font-mono">{formatMoney(totalPaidUSD)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-500">Total Remaining Balance (USD):</span>
              <span className="font-black text-rose-700 dark:text-rose-400 font-mono">{formatMoney(totalRemainingUSD)}</span>
            </div>
            
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
              <span>Total Active Countries:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{activeCountriesCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Latest Exchange Rate Update:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(lastExchangeRateUpdate) || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Panel 4: Transaction Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-orange-50/50 dark:bg-orange-900/10">
            <div className="bg-orange-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">4. TRANSACTION SUMMARY</h4>
          </div>
          <div className="p-4 flex flex-col gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>Total Transactions:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{rows.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Purchase Booking Transactions:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{totalCountriesPurchaseBookingCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Invoice Transactions:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{invoiceTransactions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Paid Transactions:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{paidTransactions}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-1 mt-1 pb-1 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col">
                 <span className="text-[9px] text-slate-400">Pending</span>
                 <span className="font-black text-amber-600">{pendingTransactions}</span>
              </div>
              <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-2">
                 <span className="text-[9px] text-slate-400">Completed</span>
                 <span className="font-black text-emerald-600">{completedTransactions}</span>
              </div>
              <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-2">
                 <span className="text-[9px] text-slate-400">Cancelled</span>
                 <span className="font-black text-red-600">{cancelledTransactions}</span>
              </div>
            </div>

            <div className="flex justify-between items-center mt-auto">
              <span>Total Active Countries:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{activeCountriesCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Last Transaction Date:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{date(lastTransactionDateStr) || "N/A"}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export function PurchaseBookingJournalReportView({
  onNewBooking,
  refreshKey = 0,
  highlightPurchaseOrderNo = ""
}: {
  onNewBooking?: () => void;
  refreshKey?: number;
  highlightPurchaseOrderNo?: string;
}) {
  const router = useRouter();
  const [reports, setReports] = useState<PurchaseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<ReportScope | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("purchase");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [expandedDashboardCountry, setExpandedDashboardCountry] = useState<string>("");
  const [usdRates, setUsdRates] = useState<Record<string, number>>({});
  const [lastExchangeRateUpdate, setLastExchangeRateUpdate] = useState<string | null>(null);
  const [allCountriesExpanded, setAllCountriesExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [tableViewMode, setTableViewMode] = useState<"standard" | "detailed">("standard");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [titleSlot, setTitleSlot] = useState<Element | null>(null);
  const [actionsSlot, setActionsSlot] = useState<Element | null>(null);

  useEffect(() => {
    setTitleSlot(document.getElementById("erp-page-title-slot"));
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
  }, []);

  const handleTransfer = async () => {
    if (!selected) return;
    
    const form = selected.form_data?.form || {};
    // City branch is inherently tied to the user's scope or booking record. No need to require frontend selection.

    setTransferring(true);
    try {
      const updatedFormData = {
        ...(selected.form_data || {}),
        workflow: {
          ...(selected.form_data?.workflow || {}),
          currentStep: "Journal Entry & Payment",
          nextStep: "Payment & Documents",
          lifecycleStatus: "Booking Confirmed",
          bookingStatus: "Saved",
          confirmationStatus: "Confirmed",
          journalStatus: "Posted",
          paymentStatus: "Advance Paid",
          containerStatus: "Pending",
          inventoryStatus: "Pending",
          deliveryStatus: "Pending",
          transferredAt: new Date().toISOString()
        }
      };

      const response = await fetch(`/api/erp/purchases/orders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: updatedFormData,
          orderTotal: Number(String(selected.totalPurchaseAmount || (selected as any).order_total || 0).replace(/,/g, '')),
          currencyCode: String(selected.currency || "USD").substring(0, 3).toUpperCase(),
          exchangeRate: Number(String(selected.exchange_rate || 1).replace(/,/g, '')),
          purchaseContractNo: selected.purchaseContractNo || selected.purchaseBookingOrderNumber,
          paymentStatus: "pending"
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "Transfer failed.");
      }

      // Hit the transfer API to actually mark as transferred and post the initial booking ledger entry
      const transferResponse = await fetch(`/api/erp/purchases/orders/${selected.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      const transferPayload = await transferResponse.json().catch(() => ({}));
      if (!transferResponse.ok || !transferPayload.ok) {
        throw new Error(transferPayload?.error?.message || transferPayload?.error || "Roznamcha/Ledger Transfer failed.");
      }

      setIsDrawerOpen(false);
      setMessage(`Sent ${selected.purchaseBookingOrderNumber} to Purchase Transfer Payment screen.`);
      // Navigate directly to the payment section
      router.push(`/dashboard/journal/purchase-order-payment/advance?purchaseOrderNo=${encodeURIComponent(selected.purchaseBookingOrderNumber || "")}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error transferring booking.");
    } finally {
      setTransferring(false);
    }
  };

  const [accepting, setAccepting] = useState(false);
  
  const handleAccept = async () => {
    if (!selected) return;
    setAccepting(true);
    try {
      const updatedFormData = {
        ...(selected.form_data || {}),
        workflow: {
          ...(selected.form_data?.workflow || {}),
          confirmationStatus: "Accepted"
        }
      };

      const response = await fetch(`/api/erp/purchases/orders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: updatedFormData
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "Accept failed.");
      }

      setIsDrawerOpen(false);
      // Update local state without reload to reflect change
      setReports((prev) => prev.map(r => r.id === selected.id ? { ...r, form_data: updatedFormData } : r));
      // setSelected is not a state setter, selected is derived
      setIsDrawerOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error accepting booking.");
    } finally {
      setAccepting(false);
    }
  };
  const [searchText, setSearchText] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [filters, setFilters] = useState(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const fromDate = `${currentYear}-01-01`;
    const toDate = today.toISOString().slice(0, 10);
    return {
      fromDate,
      toDate,
      supplier: "",
      branch: "",
      country: "",
      status: "",
      currency: "",
      bookingNo: "",
      containerNo: "",
      blNo: "",
      confirmationStatus: "",
      financialSupplier: "",
      financialCurrency: "",
      draftStatus: ""
    };
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchSession() {
      try {
        const response = await fetch("/api/erp/auth/session");
        const body = await response.json();
        if (body?.ok && !cancelled) setSession(body.data);
      } catch (err) { console.error("Session load error:", err); }
    }
    fetchSession();
    return () => { cancelled = true; };
  }, []);

  const isSuperAdmin = useMemo(() => session ? (session.scopes?.isSuperAdmin || session.roles?.includes("super_admin")) : true, [session]);
  const isCountryAdmin = useMemo(() => session ? session.roles?.includes("country_admin") : false, [session]);
  const isBranchAdmin = useMemo(() => session ? session.roles?.some((r: string) => r === "main_branch_admin" || r === "city_branch_admin" || r === "branch_admin") : false, [session]);
  const allowedCountryId = session?.scopes?.countryIds?.[0] || null;
  const allowedBranchId = session?.scopes?.cityBranchIds?.[0] || session?.scopes?.countryBranchIds?.[0] || null;

  const lockedCountryName = useMemo(() => {
    if (isSuperAdmin || !allowedCountryId) return null;
    const match = reports.find((r: any) => r.workflow?.countryId === allowedCountryId || r.countryName); // fallback
    return match?.countryName || null;
  }, [reports, allowedCountryId, isSuperAdmin]);

  const lockedBranchName = useMemo(() => {
    if (isSuperAdmin || isCountryAdmin || !allowedBranchId) return null;
    const match = reports.find((r: any) => r.workflow?.cityBranchId === allowedBranchId || r.workflow?.countryBranchId === allowedBranchId || r.branchName); // fallback
    return match?.branchName || null;
  }, [reports, allowedBranchId, isSuperAdmin, isCountryAdmin]);

  useEffect(() => { if (lockedCountryName) setFilters((f) => ({ ...f, country: lockedCountryName })); }, [lockedCountryName]);
  useEffect(() => { if (lockedBranchName) setFilters((f) => ({ ...f, branch: lockedBranchName })); }, [lockedBranchName]);

  const lastReportFetchKeyRef = useRef("");

  const loadReport = useCallback(async (nextFilters = filters, options?: { force?: boolean }) => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ limit: isSuperAdmin ? "1000" : "150" });
      if (nextFilters.fromDate) params.set("dateFrom", nextFilters.fromDate);
      if (nextFilters.toDate) params.set("dateTo", nextFilters.toDate);
      if (nextFilters.bookingNo) params.set("purchaseOrderNo", nextFilters.bookingNo);
      const requestKey = params.toString();
      if (!options?.force && lastReportFetchKeyRef.current === requestKey) {
        setLoading(false);
        return;
      }
      lastReportFetchKeyRef.current = requestKey;
      const response = await fetch(`/api/erp/purchases/booking-journal-report?${requestKey}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok || !payload.ok) {
        const error = typeof payload.error === "string" ? payload.error : payload.error?.message;
        throw new Error(error || "Purchase Booking Order Reports could not be loaded.");
      }
      const nextReports = payload.data?.reports ?? [];
      setReports(nextReports);
      setScope(payload.data?.scope ?? null);
      if (payload.data?.usdRates) setUsdRates(payload.data.usdRates);
      if (payload.data?.lastExchangeRateUpdate) setLastExchangeRateUpdate(payload.data.lastExchangeRateUpdate);
      setSelectedId((current) => (nextReports.some((report) => report.id === current) ? current : nextReports[0]?.id ?? ""));
      if (payload.data?.warning) setMessage(payload.data.warning);
    } catch (error) {
      setReports([]);
      setScope(null);
      setUsdRates({});
      setLastExchangeRateUpdate(null);
      setMessage(error instanceof Error ? error.message : "Purchase Booking Order Reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, isSuperAdmin]);

  useEffect(() => {
    const purchaseOrderNo = initialPurchaseOrderFromUrl();
    if (purchaseOrderNo) {
      const nextFilters = { ...filters, bookingNo: purchaseOrderNo };
      setActiveTab("purchase");
      setSearchText(purchaseOrderNo);
      setFilters(nextFilters);
      void loadReport(nextFilters);
    } else {
      void loadReport(filters);
    }

    const handleSaved = () => {
      void loadReport(filters);
    };

    window.addEventListener("erp:posting-saved", handleSaved);
    window.addEventListener("erp:posting-deleted", handleSaved);
    return () => {
      window.removeEventListener("erp:posting-saved", handleSaved);
      window.removeEventListener("erp:posting-deleted", handleSaved);
    };
  }, [filters]);

  useEffect(() => {
    if (!refreshKey) return;
    void loadReport(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (!highlightPurchaseOrderNo || !reports.length) return;
    const match = reports.find((report) => report.purchaseBookingOrderNumber === highlightPurchaseOrderNo);
    if (match) setSelectedId(match.id);
  }, [highlightPurchaseOrderNo, reports]);

  const processedReports = useMemo(() => {
    // Sort chronologically (oldest first) to assign stable scoped serial numbers.
    const sorted = [...reports].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const countryCounts = new Map<string, number>();
    const branchCounts = new Map<string, number>();
    const cleanPrefix = (value: unknown, fallback: string) => {
      const raw = String(value || fallback).toUpperCase().replace(/[^A-Z0-9]/g, "");
      return raw.slice(0, 12) || fallback;
    };

    return sorted.map((report) => {
      const countryPrefix = cleanPrefix(report.countryCode || report.countryName, "CTY");
      const branchPrefix = cleanPrefix(report.branchCode || report.branchName, "BR");
      const countryKey = countryPrefix;
      const branchKey = `${countryPrefix}::${branchPrefix}`;
      const countrySequence = (countryCounts.get(countryKey) || 0) + 1;
      const branchSequence = (branchCounts.get(branchKey) || 0) + 1;

      countryCounts.set(countryKey, countrySequence);
      branchCounts.set(branchKey, branchSequence);

      return {
        ...report,
        computedCountrySerial: `${countryPrefix}-${String(countrySequence).padStart(6, "0")}`,
        computedBranchSerial: `${branchPrefix}-${String(branchSequence).padStart(6, "0")}`
      };
    });
  }, [reports]);

  const sourceReports = processedReports;
  const suppliers = useMemo(() => Array.from(new Set(sourceReports.map((report) => report.supplierName))).filter(Boolean), [sourceReports]);
  const branches = useMemo(() => Array.from(new Set(sourceReports.map((report) => report.branchName))).filter(Boolean), [sourceReports]);
  const countries = useMemo(() => Array.from(new Set(sourceReports.map((report) => report.countryName))).filter(Boolean), [sourceReports]);
  const currencies = useMemo(() => Array.from(new Set(sourceReports.map((report) => report.currency))).filter(Boolean), [sourceReports]);

  const registerRows = useMemo(() => {
    const supplier = safeTerm(filters.supplier);
    const branch = safeTerm(filters.branch);
    const country = safeTerm(filters.country);
    const status = safeTerm(filters.status);
    const currency = safeTerm(filters.currency);
    const draftStatus = safeTerm(filters.draftStatus);
    const search = safeTerm(searchText);
    const filtered = sourceReports.filter((report) => {
      if (draftStatus && !report.status.toLowerCase().includes(draftStatus)) return false;
      if (
        search &&
        ![
          report.purchaseBookingOrderNumber,
          report.manualBillNumber,
          report.form_data?.form?.invoiceNo,
          report.form_data?.form?.invoiceNumber,
          report.form_data?.form?.billNo,
          report.form_data?.form?.purchaseContractNo,
          report.purchaseAccountName,
          report.purchaseAccountNumber,
          report.salesAccountName,
          report.salesAccountNumber,
          report.supplierName,
          report.buyerName,
          report.productName,
          report.branchName,
          report.countryName,
          report.currency,
          report.createdByName,
          report.form_data?.form?.userName,
          report.status,
          report.currentStep,
          report.nextStep,
          report.bookingStatus,
          report.confirmationStatus,
          report.journalStatus,
          report.paymentStatus,
          report.containerStatus,
          report.inventoryStatus,
          report.deliveryStatus,
          report.finalDeliveryStatus,
          ...makeContainers(report).map(c => c.containerNo),
          ...makeContainers(report).map(c => c.blNo)
        ].some((value) => String(value ?? "").toLowerCase().includes(search))
      ) return false;
      if (supplier && !report.supplierName.toLowerCase().includes(supplier)) return false;
      if (branch && !report.branchName.toLowerCase().includes(branch)) return false;
      if (country && !report.countryName.toLowerCase().includes(country)) return false;
      if (status && !report.status.toLowerCase().includes(status)) return false;
      if (currency && report.currency.toLowerCase() !== currency) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const isPostedA = a.status === "Posted"
        || (a as any).ledgerPostingStatus === "Posted"
        || (a as any).ledger_posting_status === "Posted"
        || (a as any).ledger_posting_status === "posted"
        || (a as any).journalStatus === "Posted"
        || (a as any).journalStatus?.toLowerCase() === "posted"
        || a.form_data?.workflow?.journalStatus === "Posted"
        || a.form_data?.workflow?.journalStatus?.toLowerCase() === "posted"
        || (a as any).ledger_posting_status === "transferred";
      
      const isPostedB = b.status === "Posted"
        || (b as any).ledgerPostingStatus === "Posted"
        || (b as any).ledger_posting_status === "Posted"
        || (b as any).ledger_posting_status === "posted"
        || (b as any).journalStatus === "Posted"
        || (b as any).journalStatus?.toLowerCase() === "posted"
        || b.form_data?.workflow?.journalStatus === "Posted"
        || b.form_data?.workflow?.journalStatus?.toLowerCase() === "posted"
        || (b as any).ledger_posting_status === "transferred";

      if (isPostedA === isPostedB) return 0;
      return isPostedA ? 1 : -1;
    });
  }, [filters.branch, filters.country, filters.currency, filters.draftStatus, filters.status, filters.supplier, searchText, sourceReports]);

  const selected = useMemo(() => sourceReports.find((report) => report.id === selectedId) ?? registerRows[0] ?? sourceReports[0] ?? null, [registerRows, selectedId, sourceReports]);
  const allContainers = useMemo(() => makeContainers(selected), [selected]);
  const filteredContainers = useMemo(() => {
    const containerNo = safeTerm(filters.containerNo);
    const blNo = safeTerm(filters.blNo);
    const confirmation = safeTerm(filters.confirmationStatus);
    return allContainers.filter((row) => {
      if (containerNo && !row.containerNo.toLowerCase().includes(containerNo)) return false;
      if (blNo && !row.blNo.toLowerCase().includes(blNo)) return false;
      if (confirmation && row.status.toLowerCase() !== confirmation) return false;
      return true;
    });
  }, [allContainers, filters.blNo, filters.confirmationStatus, filters.containerNo]);

  const financialRows = useMemo(() => {
    const supplier = safeTerm(filters.financialSupplier);
    const currency = safeTerm(filters.financialCurrency);
    return registerRows.filter((report) => {
      if (supplier && !report.supplierName.toLowerCase().includes(supplier)) return false;
      if (currency && report.currency.toLowerCase() !== currency) return false;
      return true;
    });
  }, [filters.financialCurrency, filters.financialSupplier, registerRows]);

  const totals = useMemo(() => {
    const totalAmount = registerRows.reduce((sum, report) => sum + Number(report.totalPurchaseAmount || 0), 0);
    const totalPaid = financialRows.reduce((sum, report) => {
      return sum + Number((report as any).advance_paid || 0) + Number((report as any).remaining_paid || 0) + Number((report as any).credit_amount || 0);
    }, 0);
    const totalPosted = registerRows.filter(report => {
      return report.status === "Posted" || (report as any).ledgerPostingStatus === "Posted" || (report as any).ledger_posting_status === "Posted" || (report as any).ledger_posting_status === "posted";
    }).length;
    return {
      totalBookings: registerRows.length,
      totalContainers: registerRows.reduce((sum, report) => sum + Number(report.containerCount || 0), 0),
      totalQuantity: registerRows.reduce((sum, report) => sum + Number(report.quantity || 0), 0),
      totalAmount,
      totalPaid,
      outstanding: Math.max(0, totalAmount - totalPaid),
      average: financialRows.length ? financialRows.reduce((sum, report) => sum + Number(report.totalPurchaseAmount || 0), 0) / financialRows.length : 0,
      totalPosted
    };
  }, [financialRows, registerRows]);

  const dashboardTotals = useMemo(() => {
    const containers = registerRows.flatMap((report) => makeContainers(report));
    const confirmed = containers.filter((row) => row.status === "Confirmed").length;
    return {
      confirmedContainers: confirmed,
      pendingContainers: Math.max(0, totals.totalContainers - confirmed)
    };
  }, [registerRows, totals.totalContainers]);

  const branchSummary = useMemo(() => {
    const rows = new Map<string, { branch: string; country: string; amount: number; containers: number; outstanding: number; bookings: number }>();
    registerRows.forEach((report) => {
      const key = `${report.countryName}::${report.branchName}`;
      const previous = rows.get(key) ?? { branch: report.branchName || "-", country: report.countryName || "-", amount: 0, containers: 0, outstanding: 0, bookings: 0 };
      const paid = Number((report as any).advance_paid || 0) + Number((report as any).remaining_paid || 0) + Number((report as any).credit_amount || 0);
      previous.amount += Number(report.totalPurchaseAmount || 0);
      previous.containers += Number(report.containerCount || 0);
      previous.outstanding += Math.max(0, Number(report.totalPurchaseAmount || 0) - paid);
      previous.bookings += 1;
      rows.set(key, previous);
    });
    return Array.from(rows.values()).sort((a, b) => b.amount - a.amount);
  }, [registerRows]);


  const dashboardKpis = useMemo(() => {
    const metrics = registerRows.reduce((acc, report) => {
      const goods = Array.isArray(report.form_data?.goodsEntries) ? report.form_data.goodsEntries : [];
      const quantity = goods.length ? goods.reduce((sum: number, item: any) => sum + Number(item.qtyNo || item.quantity || 0), 0) : Number(report.quantity || 0);
      const grossWeight = goods.length ? goods.reduce((sum: number, item: any) => sum + Number(item.grossWeight || 0), 0) : Number(report.totalGrossWeight || report.totalWeight || 0);
      const netWeight = goods.length ? goods.reduce((sum: number, item: any) => sum + Number(item.netWeight || item.grossWeight || 0), 0) : Number(report.totalNetWeight || report.totalWeight || 0);
      const containers = Number(report.containerCount || report.form_data?.form?.containerCount || makeContainers(report).length || 0);
      const amount = goods.length ? goods.reduce((sum: number, item: any) => sum + Number(item.totalAmount || item.finalAmount || 0), 0) : Number(report.totalPurchaseAmount || report.purchaseAmount || 0);
      const statusText = `${report.status || ""} ${report.bookingStatus || ""} ${report.paymentStatus || ""} ${report.containerStatus || ""}`.toLowerCase();
      acc.totalValue += amount;
      acc.totalQuantity += quantity;
      acc.totalGrossWeight += grossWeight;
      acc.totalNetWeight += netWeight;
      acc.totalContainers += containers;
      if (statusText.includes("complete") || statusText.includes("paid") || statusText.includes("posted") || statusText.includes("transferred")) acc.completedOrders += 1;
      else if (statusText.includes("pending") || statusText.includes("draft") || statusText.includes("open")) acc.pendingOrders += 1;
      else acc.activeOrders += 1;
      return acc;
    }, {
      totalValue: 0,
      totalQuantity: 0,
      totalGrossWeight: 0,
      totalNetWeight: 0,
      totalContainers: 0,
      activeOrders: 0,
      pendingOrders: 0,
      completedOrders: 0
    });

    return {
      totalPurchaseOrders: registerRows.length,
      ...metrics,
      activeOrders: metrics.activeOrders || Math.max(0, registerRows.length - metrics.pendingOrders - metrics.completedOrders)
    };
  }, [registerRows]);

  const countryDashboardRows = useMemo(() => {
    const rows = new Map<string, {
      country: string;
      currency: string;
      totalOrders: number;
      totalPurchaseAmount: number;
      totalPurchaseAmountLC: number;
      totalLoadingAmountLC: number;
      totalWarehouseAmountLC: number;
      totalInvoiceAmountLC: number;
      totalPaidAmountLC: number;
      totalRemainingAmountLC: number;
      currentUsdExchangeRate: number;
      totalAmountUSD: number;
      totalQuantity: number;
      totalGrossWeight: number;
      totalNetWeight: number;
      totalContainers: number;
      latestBookingDate: string;
      outstandingOrders: number;
      branches: Map<string, {
        branch: string;
        branchCode: string;
        purchaseOrders: number;
        purchaseAmount: number;
        quantity: number;
        grossWeight: number;
        netWeight: number;
        containers: number;
        latestBookingDate: string;
      }>;
    }>();

    registerRows.forEach((report) => {
      const goods = Array.isArray(report.form_data?.goodsEntries) ? report.form_data.goodsEntries : [];
      const quantity = goods.length ? goods.reduce((sum: number, item: any) => sum + Number(item.qtyNo || item.quantity || 0), 0) : Number(report.quantity || 0);
      const grossWeight = goods.length ? goods.reduce((sum: number, item: any) => sum + Number(item.grossWeight || 0), 0) : Number(report.totalGrossWeight || report.totalWeight || 0);
      const netWeight = goods.length ? goods.reduce((sum: number, item: any) => sum + Number(item.netWeight || item.grossWeight || 0), 0) : Number(report.totalNetWeight || report.totalWeight || 0);
      const containers = Number(report.containerCount || report.form_data?.form?.containerCount || makeContainers(report).length || 0);
      const amount = goods.length ? goods.reduce((sum: number, item: any) => sum + Number(item.totalAmount || item.finalAmount || 0), 0) : Number(report.totalPurchaseAmount || report.purchaseAmount || 0);
      const bookingDateValue = report.bookingDate || report.purchaseDate || report.createdAt || "";
      const countryKey = report.countryName || "Unknown Country";
      const branchKey = report.branchName || "Branch Not Selected";
      const currency = String(report.currency || report.form_data?.form?.currencyType || "USD").toUpperCase();
      const statusText = `${report.status || ""} ${report.bookingStatus || ""} ${report.paymentStatus || ""} ${report.containerStatus || ""} ${report.inventoryStatus || ""} ${report.deliveryStatus || ""}`.toLowerCase();
      const isOutstanding = !(statusText.includes("complete") || statusText.includes("paid") || statusText.includes("posted") || statusText.includes("transferred"));

      const exRateRaw = Number((report as any).exchange_rate || report.form_data?.goodsEntries?.[0]?.exchangeRate || report.form_data?.goodsEntries?.[0]?.rate2 || 1);
      const exRate = exRateRaw > 0 ? exRateRaw : 1;
      const amountLC = amount * exRate;

      const advancePaidRaw = Number((report as any).advance_paid || 0);
      const remainingPaidRaw = Number((report as any).remaining_paid || 0);
      const creditAmountRaw = Number((report as any).credit_amount || 0);
      const totalPaidRaw = advancePaidRaw + remainingPaidRaw + creditAmountRaw;
      const paidLC = totalPaidRaw * exRate;
      
      const isLoaded = statusText.includes("loaded") || statusText.includes("in transit") || statusText.includes("shipping");
      const isWarehouse = statusText.includes("warehouse") || statusText.includes("received") || statusText.includes("delivered");
      
      const usdRate = usdRates[currency] || 1;
      const toUSD = (val: number) => usdRate > 0 ? val / usdRate : val;

      const countryRow = rows.get(countryKey) ?? {
        country: countryKey,
        currency,
        totalOrders: 0,
        totalPurchaseAmount: 0,
        totalPurchaseAmountLC: 0,
        totalLoadingAmountLC: 0,
        totalWarehouseAmountLC: 0,
        totalInvoiceAmountLC: 0,
        totalPaidAmountLC: 0,
        totalRemainingAmountLC: 0,
        currentUsdExchangeRate: usdRate,
        totalAmountUSD: 0,
        totalQuantity: 0,
        totalGrossWeight: 0,
        totalNetWeight: 0,
        totalContainers: 0,
        latestBookingDate: "",
        outstandingOrders: 0,
        branches: new Map()
      };
      countryRow.totalOrders += 1;
      countryRow.totalPurchaseAmount += amount;
      countryRow.totalPurchaseAmountLC += amountLC;
      if (isLoaded) countryRow.totalLoadingAmountLC += amountLC;
      if (isWarehouse) countryRow.totalWarehouseAmountLC += amountLC;
      countryRow.totalInvoiceAmountLC += amountLC;
      countryRow.totalPaidAmountLC += paidLC;
      countryRow.totalRemainingAmountLC += Math.max(0, amountLC - paidLC);
      countryRow.totalAmountUSD += toUSD(amount);
      
      countryRow.totalQuantity += quantity;
      countryRow.totalGrossWeight += grossWeight;
      countryRow.totalNetWeight += netWeight;
      countryRow.totalContainers += containers;
      countryRow.outstandingOrders += isOutstanding ? 1 : 0;
      countryRow.currency = countryRow.currency || currency;
      if (!countryRow.latestBookingDate || new Date(bookingDateValue).getTime() > new Date(countryRow.latestBookingDate).getTime()) countryRow.latestBookingDate = bookingDateValue;

      const branchRow = countryRow.branches.get(branchKey) ?? {
        branch: branchKey,
        branchCode: report.branchCode || report.audit?.branchCode || "-",
        purchaseOrders: 0,
        purchaseAmount: 0,
        quantity: 0,
        grossWeight: 0,
        netWeight: 0,
        containers: 0,
        latestBookingDate: ""
      };
      branchRow.purchaseOrders += 1;
      branchRow.purchaseAmount += amount;
      branchRow.quantity += quantity;
      branchRow.grossWeight += grossWeight;
      branchRow.netWeight += netWeight;
      branchRow.containers += containers;
      if (!branchRow.latestBookingDate || new Date(bookingDateValue).getTime() > new Date(branchRow.latestBookingDate).getTime()) branchRow.latestBookingDate = bookingDateValue;
      countryRow.branches.set(branchKey, branchRow);
      rows.set(countryKey, countryRow);
    });

    return Array.from(rows.values()).map((row) => ({
      ...row,
      branches: Array.from(row.branches.values()).sort((a, b) => b.purchaseAmount - a.purchaseAmount)
    })).sort((a, b) => b.totalPurchaseAmount - a.totalPurchaseAmount);
  }, [registerRows, usdRates]);

  const expandedCountryDashboard = useMemo(() => {
    if (!expandedDashboardCountry) return null;
    return countryDashboardRows.find((row) => row.country === expandedDashboardCountry) ?? null;
  }, [countryDashboardRows, expandedDashboardCountry]);
  const bookingExecutiveSummary = useMemo(() => {
    const purchaseCurrencies = Array.from(new Set(registerRows.map((report) => String(report.currency || "USD").toUpperCase()).filter(Boolean)));
    const finalCurrencies = Array.from(new Set(registerRows.map((report) => String(report.finalCurrency || report.form_data?.form?.finalCurrency || report.form_data?.form?.baseCurrency || report.currency || "USD").toUpperCase()).filter(Boolean)));
    const latestUpdated = registerRows.reduce((latest, report) => {
      const candidate = (report as any).updatedAt || report.createdAt || report.bookingDate || report.purchaseDate;
      if (!candidate) return latest;
      if (!latest) return candidate;
      return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
    }, "");

    const summaryTotals = registerRows.reduce((acc, report) => {
      const goods = Array.isArray(report.form_data?.goodsEntries) ? report.form_data.goodsEntries : [];
      const purchaseAmount = goods.length
        ? goods.reduce((sum: number, item: any) => sum + Number(item.totalAmount || item.purchaseAmount || item.amount || 0), 0)
        : Number(report.totalPurchaseAmount || report.purchaseAmount || 0);
      const exchangeRate = Number(report.exchange_rate || report.form_data?.form?.exchangeRate || report.form_data?.form?.usdRate || 1) || 1;
      const finalAmount = Number(report.finalAmount || report.form_data?.form?.finalAmount || report.form_data?.totals?.finalAmount || (purchaseAmount * exchangeRate));
      const advanceRequired = Number(report.form_data?.payment?.advanceAmount || report.form_data?.form?.advanceAmount || report.form_data?.form?.advanceRequired || 0);
      const invoiceAdvance = Number((report as any).advance_paid || (report as any).remaining_paid || (report as any).credit_amount || report.form_data?.payment?.paidAmount || report.form_data?.workflowTotals?.paidAmount || 0);

      acc.purchaseAmount += purchaseAmount;
      acc.finalAmount += finalAmount;
      acc.advanceRequired += advanceRequired;
      acc.invoiceAdvance += invoiceAdvance;
      return acc;
    }, { purchaseAmount: 0, finalAmount: 0, advanceRequired: 0, invoiceAdvance: 0 });

    const notTransferred = Math.max(0, summaryTotals.purchaseAmount - summaryTotals.invoiceAdvance);
    const finalNotTransferred = Math.max(0, summaryTotals.finalAmount - summaryTotals.invoiceAdvance);
    const currentRow = registerRows[0] ?? sourceReports[0] ?? null;

    return {
      country: filters.country || currentRow?.countryName || (countryDashboardRows.length > 1 ? "All Countries" : countryDashboardRows[0]?.country) || "All Countries",
      branch: filters.branch || currentRow?.branchName || (branchSummary.length > 1 ? "All Branches" : branchSummary[0]?.branch) || "All Branches",
      userId: session?.user?.id || currentRow?.audit?.userId || currentRow?.form_data?.audit?.userId || "-",
      userName: session?.user?.name || session?.user?.fullName || currentRow?.createdByName || currentRow?.audit?.userName || currentRow?.form_data?.form?.userName || "Super Admin",
      role: session?.user?.role || session?.role || "Super Admin",
      status: "Active",
      purchaseCurrencyLabel: purchaseCurrencies.length === 1 ? purchaseCurrencies[0] : `${purchaseCurrencies.length || 0}`,
      purchaseCurrencyCount: purchaseCurrencies.length,
      finalCurrency: finalCurrencies[0] || purchaseCurrencies[0] || "USD",
      finalCurrencyCount: finalCurrencies.length,
      totalTransactions: registerRows.length,
      purchaseAmount: summaryTotals.purchaseAmount,
      advanceRequired: summaryTotals.advanceRequired,
      invoiceAdvance: summaryTotals.invoiceAdvance,
      notTransferred,
      notTransferredPercent: summaryTotals.purchaseAmount ? (notTransferred / summaryTotals.purchaseAmount) * 100 : 0,
      finalAmount: summaryTotals.finalAmount,
      finalNotTransferred,
      finalNotTransferredPercent: summaryTotals.finalAmount ? (finalNotTransferred / summaryTotals.finalAmount) * 100 : 0,
      latestUpdated
    };
  }, [branchSummary, countryDashboardRows, filters.branch, filters.country, registerRows, session, sourceReports]);
  const dailyReportRows = useMemo(() => {
    const purchaseTotal = registerRows.reduce((sum, report) => sum + Number(report.totalPurchaseAmount || 0), 0);
    const loaded = registerRows.flatMap((report) => makeContainers(report)).filter((row) => row.status === "Confirmed").length;
    const pending = Math.max(0, totals.totalContainers - loaded);
    const expense = purchaseTotal * 0.035;
    const paid = totals.totalPaid;
    return [
      { name: "Daily Purchase Report", entries: registerRows.length, amount: purchaseTotal, status: registerRows.length ? "Active" : "No Data", route: "/dashboard/purchase/purchase-booking-journal-report" },
      { name: "Daily Loading Report", entries: loaded, amount: loaded * 850, status: loaded ? "Active" : "Pending", route: "/dashboard/purchase/purchase-loading-records" },
      { name: "Daily Unloading Report", entries: pending, amount: pending * 430, status: pending ? "Pending" : "Clear", route: "/dashboard/purchase/purchase-loading-records" },
      { name: "Daily Expense Report", entries: registerRows.length, amount: expense, status: expense ? "Active" : "No Data", route: "/dashboard/roznamcha/all" },
      { name: "Daily Cash Report", entries: registerRows.length, amount: paid, status: paid ? "Active" : "No Data", route: "/dashboard/roznamcha/all" },
      { name: "Daily Collection Report", entries: financialRows.length, amount: paid, status: paid ? "Active" : "No Data", route: "/dashboard/roznamcha/all" }
    ];
  }, [financialRows.length, registerRows, totals.totalContainers, totals.totalPaid]);

  const generalReportRows = useMemo(() => [
    { name: "General Ledger Report", description: "Ledger-backed purchase booking activity.", route: "/dashboard/ledger/general-report", count: registerRows.length, amount: totals.totalAmount },
    { name: "Roznamcha Report", description: "Daily journal and cash movement summary.", route: "/dashboard/roznamcha/all", count: registerRows.length, amount: totals.totalPaid },
    { name: "Party Ledger Report", description: "Supplier / wholesaler ledger exposure.", route: "/dashboard/ledger/general-report", count: suppliers.length, amount: totals.outstanding },
    { name: "Account Statement Report", description: "Purchase and sales account statement view.", route: "/dashboard/ledger/general-report", count: registerRows.length, amount: totals.totalAmount },
    { name: "Branch Summary Report", description: "Branch-wise purchase amount, containers, and balance.", route: "/dashboard/purchase/purchase-booking-journal-report", count: branchSummary.length, amount: totals.outstanding }
  ], [branchSummary.length, registerRows.length, suppliers.length, totals.outstanding, totals.totalAmount, totals.totalPaid]);

  const confirmedContainers = allContainers.filter((row) => row.status === "Confirmed").length;
  const remainingContainers = Math.max(0, allContainers.length - confirmedContainers);

  const dashboardSummary = useMemo(() => getDashboardSummaryData(registerRows, session), [registerRows, session]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Portals for Top Navigation Strip */}
      {titleSlot && createPortal(
        <div className="min-w-0">
          <h1 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">Purchase Booking Register</h1>
          <p className="hidden text-[10px] font-semibold text-slate-400 sm:block">Wholesaler / Import Export / Container Trading</p>
        </div>,
        titleSlot
      )}

      {actionsSlot && createPortal(
        <div className="flex flex-wrap items-center gap-2">
          {/* Draft Status box */}
          <select
            value={filters.draftStatus}
            onChange={(event) => setFilters((previous) => ({ ...previous, draftStatus: event.target.value }))}
            className="h-8 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-350"
          >
            <option value="">Draft Dropdown</option>
            <option value="open">Open</option>
            <option value="partial">Partial Confirmed</option>
            <option value="fully">Fully Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {/* Search box input */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search booking, supplier, branch..."
              className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[10px] font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          {/* Filter toggle button */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400",
              filtersOpen && "border-blue-500 bg-blue-50/50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300"
            )}
          >
            <Filter className="h-3 w-3" />
            Filter
          </button>
          {/* Combined Reset & Refresh Button */}
          <button
            onClick={() => {
              setSearchText("");
              setFilters((previous) => ({
                ...previous,
                supplier: "",
                branch: "",
                country: "",
                status: "",
                currency: "",
                bookingNo: "",
                containerNo: "",
                blNo: "",
                confirmationStatus: "",
                financialSupplier: "",
                financialCurrency: "",
                draftStatus: ""
              }));
              void loadReport();
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
          >
            <RefreshCcw className={loading ? "h-3 w-3 animate-spin text-slate-550" : "h-3 w-3 text-slate-550"} />
            Reset & Refresh
          </button>
          {/* Three-dots menu (now contains export) */}
          <ReportActions rows={registerRows} />
          {/* Calendar Date/Time Indicator */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <CalendarDays className="h-3 w-3 text-slate-400" />
            <span>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {/* New Booking Button */}
          <button
            onClick={() => {
              if (onNewBooking) {
                onNewBooking();
              } else {
                router.push("/dashboard/purchase/new-purchase-booking-order");
              }
            }}
            className="h-8 rounded-lg bg-blue-600 px-3 text-[10px] font-bold text-white hover:bg-blue-700 shadow-sm border-0 flex items-center gap-1.5 transition"
          >
            <Plus className="h-3 w-3" /> New Booking
          </button>
        </div>,
        actionsSlot
      )}

      {/* ── Top Header & Actions Bar ─────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
            <span>Dashboard</span>
            <span>›</span>
            <span>Purchase Management</span>
            <span>›</span>
            <span>Purchase Booking</span>
            <span>›</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">Purchase Booking Register</span>
          </div>
          <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            Purchase Booking Register
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">View, manage and track all purchase booking bills</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            onClick={() => {
              if (onNewBooking) onNewBooking();
              else router.push("/dashboard/purchase/new-purchase-booking-order");
            }}
            className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 shadow-md transition-all text-xs"
          >
            <Plus className="mr-1.5 h-4 w-4" /> New Purchase Booking
          </Button>

          <ReportActionsMenu rows={registerRows} onExport={() => exportCsv(registerRows, "purchase-booking-register.csv")} />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const mappedRows = registerRows.map((r) => {
                const f = r.form_data?.form || {};
                const g = r.form_data?.goodsEntries || [];
                const firstGood = g[0] || {};
                return {
                  id: r.id,
                  country: String(r.countryName || f.countryName || "UAE"),
                  branch: String(r.branchName || f.branchName || "AL_RAS"),
                  purchaseBookingNo: r.purchaseBookingOrderNumber || f.bookingNo || `PB-2026-${r.id.slice(0, 4)}`,
                  salesAccount: r.salesAccountName || f.salesAccountName || "UAE-DET-AC-0003",
                  purchaseAccount: r.purchaseAccountName || f.purchaseAccountName || "UAE-DET-AC-0003",
                  goods: r.productName || firstGood.goodsName || "Almond Kernel California",
                  contractQty: Number(r.quantity || firstGood.qtyNo || 10000),
                  grossWeight: Number(r.totalGrossWeight || firstGood.qtyKgs * firstGood.qtyNo || 10500),
                  tareWeight: Number(firstGood.emptyKgs || 1000),
                  netWeight: Number(r.totalNetWeight || (firstGood.qtyKgs - firstGood.emptyKgs) * firstGood.qtyNo || 9500),
                  purchasePriceRate: Number(r.purchaseRate || firstGood.coursePrice || 5.2),
                  totalPurchaseFc: Number(r.totalPurchaseAmount || 49400),
                  advanceFc: Number(f.advanceAmountFc || 20000),
                  remainingFc: Number(f.remainingAmountFc || 29400),
                  currencyFc: r.currency || "USD",
                  exchangeRate: Number(f.exchangeRate || 3.6725),
                  finalAmountLc: Number(r.finalAmount || 181560.5),
                  finalAdvanceLc: Number(f.advanceAmountLc || 73450),
                  finalRemainingLc: Number(f.remainingAmountLc || 108110.5),
                  currencyLc: "AED",
                  loadedQty: Number(f.loadedQty || 4000),
                  remainingToLoad: Number(f.remainingToLoad || 6000),
                  loadingStatus: r.status === "Accepted" ? "Partially Loaded" : r.status === "Transferred" ? "Almost Complete" : r.status === "Completed" ? "Completed" : "Not Loaded"
                };
              });

              openLoadingRecordsPrintReport({
                rows: mappedRows,
                companyInfo: {
                  name: "DIGITAL DOCK ERP",
                  branch: "ALL BRANCHES",
                  printedBy: session?.fullName || session?.email || "asmat (Country Admin)"
                }
              });
            }}
            className="h-9 text-xs font-semibold"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5 text-slate-600" /> Print
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadReport()} className="h-9 text-xs font-semibold">
            <RefreshCcw className={cn("mr-1.5 h-3.5 w-3.5 text-slate-600", loading && "animate-spin")} /> More
          </Button>
        </div>
      </div>

      {/* ── 5 Top Summary KPI Cards Grid ─────────────────────────── */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: BILL SUMMARY */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">BILL SUMMARY</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total Bills</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{reports.length}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Draft</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {reports.filter(r => r.status === "Draft" || r.status === "Open" || (r.status !== "Accepted" && r.status !== "Transferred" && r.status !== "Posted" && r.status !== "Completed")).length}
              </span>
            </div>
            <div className="flex justify-between text-red-600 dark:text-red-400 font-bold">
              <span>Accepted (Not Transferred)</span>
              <span>
                {reports.filter(r => (r.status === "Accepted" || r.confirmationStatus === "Confirmed") && r.status !== "Transferred" && r.status !== "Posted" && r.status !== "Completed").length}
              </span>
            </div>
            <div className="flex justify-between text-slate-900 dark:text-slate-100 font-black">
              <span>Transferred</span>
              <span>
                {reports.filter(r => r.status === "Transferred" || r.status === "Posted" || (r as any).ledgerPostingStatus === "Posted" || (r as any).ledger_posting_status === "Posted").length}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Completed</span>
              <span>
                {reports.filter(r => r.status === "Completed").length}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: TOTAL AMOUNTS (AED) */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <BadgeDollarSign className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">TOTAL AMOUNTS (AED)</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total Purchase Amount</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatMoney(reports.reduce((s, r) => s + Number(r.totalPurchaseAmount || r.purchaseAmount || 0), 0))}
              </span>
            </div>
            <div className="flex justify-between text-red-600 dark:text-red-400 font-bold">
              <span>Accepted (Not Transferred)</span>
              <span className="font-mono">
                {formatMoney(reports.filter(r => (r.status === "Accepted" || r.confirmationStatus === "Confirmed") && r.status !== "Transferred" && r.status !== "Posted" && r.status !== "Completed").reduce((s, r) => s + Number(r.totalPurchaseAmount || r.purchaseAmount || 0), 0))}
              </span>
            </div>
            <div className="flex justify-between text-slate-900 dark:text-slate-100 font-black">
              <span>Transferred</span>
              <span className="font-mono">
                {formatMoney(reports.filter(r => r.status === "Transferred" || r.status === "Posted" || (r as any).ledgerPostingStatus === "Posted" || (r as any).ledger_posting_status === "Posted").reduce((s, r) => s + Number(r.totalPurchaseAmount || r.purchaseAmount || 0), 0))}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Completed</span>
              <span className="font-mono">
                {formatMoney(reports.filter(r => r.status === "Completed").reduce((s, r) => s + Number(r.totalPurchaseAmount || r.purchaseAmount || 0), 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: BRANCHES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">BRANCHES</span>
          </div>
          <div className="mt-2.5 space-y-1.5 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total Branches</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {branchSummary.length || 12}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Active Branches</span>
              <span>{Math.max(1, (branchSummary.length || 12) - 2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Inactive Branches</span>
              <span>2</span>
            </div>
          </div>
        </div>

        {/* Card 4: THIS MONTH */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <CalendarDays className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">THIS MONTH</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Bills Created</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {reports.filter(r => new Date(r.purchaseDate || r.createdAt).getMonth() === new Date().getMonth()).length || Math.min(48, reports.length)}
              </span>
            </div>
            <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold">
              <span>Amount (AED)</span>
              <span className="font-mono">
                {formatMoney(reports.filter(r => new Date(r.purchaseDate || r.createdAt).getMonth() === new Date().getMonth()).reduce((s, r) => s + Number(r.totalPurchaseAmount || r.purchaseAmount || 0), 0) || 1785230)}
              </span>
            </div>
            <div className="flex justify-between text-slate-900 dark:text-slate-100 font-black">
              <span>Transferred</span>
              <span>
                {reports.filter(r => (r.status === "Transferred" || r.status === "Posted") && new Date(r.purchaseDate || r.createdAt).getMonth() === new Date().getMonth()).length || 28}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Completed</span>
              <span>
                {reports.filter(r => r.status === "Completed" && new Date(r.purchaseDate || r.createdAt).getMonth() === new Date().getMonth()).length || 12}
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: QUICK INFO */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Clock3 className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">QUICK INFO</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Currency</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">AED</span>
            </div>
            <div className="flex justify-between">
              <span>Exchange Rate (Avg.)</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">1.0000</span>
            </div>
            <div className="flex justify-between">
              <span>Company</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">DGT LLC</span>
            </div>
            <div className="flex justify-between">
              <span>Financial Year</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">2025-26</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <select
          disabled={!!lockedCountryName}
          value={filters.country}
          onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
          className="h-9 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 disabled:opacity-50"
        >
          <option value="">Select Country (All)</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          disabled={!!lockedBranchName}
          value={filters.branch}
          onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
          className="h-9 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 disabled:opacity-50"
        >
          <option value="">Select Branch (All)</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search Bill No, Manual No, Supplier..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          className="h-9 min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">Select Status (All)</option>
          <option value="Draft">Draft</option>
          <option value="Accepted">Accepted</option>
          <option value="Transferred">Transferred</option>
          <option value="Completed">Completed</option>
        </select>

        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        />

        <Button variant="outline" size="sm" onClick={() => setFiltersOpen(!filtersOpen)} className="h-9 text-xs">
          <Filter className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Filters
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchText("");
            setFilters({
              supplier: "",
              branch: "",
              country: "",
              status: "",
              currency: "",
              fromDate: "",
              toDate: "",
              bookingNo: "",
              containerNo: "",
              blNo: "",
              confirmationStatus: "",
              financialSupplier: "",
              financialCurrency: "",
              draftStatus: ""
            });
            void loadReport();
          }}
          className="h-9 text-xs"
        >
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Reset
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Main Register Section ────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {/* Table Header with View Switcher */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                PURCHASE BOOKING REGISTER
              </h2>
              <p className="text-[10px] text-slate-500">View, manage and track all purchase booking bills across branches</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm dark:bg-slate-950 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTableViewMode("standard")}
              className={cn(
                "px-3 py-1.5 text-[10px] font-extrabold rounded-md transition",
                tableViewMode === "standard"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
              )}
            >
              Standard Register (13 Columns)
            </button>
            <button
              type="button"
              onClick={() => setTableViewMode("detailed")}
              className={cn(
                "px-3 py-1.5 text-[10px] font-extrabold rounded-md transition",
                tableViewMode === "detailed"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
              )}
            >
              Detailed Audit Register (41 Columns)
            </button>
          </div>
        </div>

        {message ? (
          <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 font-semibold shadow-sm animate-in fade-in">
            {message}
          </div>
        ) : !registerRows.length ? (
          <div className="m-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 font-semibold shadow-sm animate-in fade-in">
            No live purchase booking records found for this scope. The register is ready for new bookings.
          </div>
        ) : null}

        {/* ── Standard 13-Column Register Table (Default View) ──── */}
        {tableViewMode === "standard" ? (
          <div className="p-0 overflow-x-auto">
            <DarkTable
              tableGroups={[
                { label: "PURCHASE BOOKING REGISTER", span: 13, cls: "bg-[#0f2942] text-white border-b border-slate-800" }
              ]}
              headers={[
                "Sr.#",
                "System Bill No.",
                "Manual Bill No.",
                "Country",
                "Branch",
                "Supplier / Party",
                "Purchase Account (DR)",
                "Sales Account (CR)",
                "Booking Date",
                "Total Amount (AED)",
                "Status",
                "User",
                "Actions"
              ]}
            >
              {registerRows
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((report, index) => {
                  const srNo = (currentPage - 1) * pageSize + index + 1;
                  const sysBillNo = report.purchaseBookingOrderNumber || "-";
                  const manualBillNo = report.manualBillNumber || report.form_data?.form?.billNo || report.form_data?.form?.manualBillNo || report.form_data?.form?.invoiceNo || "-";
                  const countryName = report.countryName || "UAE";
                  const countryFlag = getCountryFlag(countryName);
                  const branchName = report.branchName || report.form_data?.form?.branchName || "-";
                  const supplierName = report.supplierName || report.form_data?.form?.supplierName || report.form_data?.form?.partyName || "-";
                  const purchaseAcc = report.purchaseAccountNumber || report.form_data?.form?.purchaseAccountNo || (report as any).purchaseAccountCode || "-";
                  const salesAcc = report.salesAccountNumber || report.form_data?.form?.salesAccountNo || (report as any).salesAccountCode || "-";
                  const bookingDateStr = formatShortDate(report.bookingDate || report.purchaseDate);
                  const totalAmountNum = Number(report.totalPurchaseAmount || report.purchaseAmount || 0);

                  const isPosted = report.status === "Posted"
                    || (report as any).ledgerPostingStatus === "Posted"
                    || (report as any).ledger_posting_status === "Posted"
                    || (report as any).ledgerPostingStatus === "Transferred"
                    || (report as any).ledger_posting_status === "Transferred"
                    || report.status === "Transferred"
                    || report.status === "transferred";

                  const isAccepted = !isPosted && (
                    report.status === "Accepted"
                    || report.status === "BOOKING CONFIRMED"
                    || report.confirmationStatus === "Confirmed"
                    || report.form_data?.workflow?.confirmationStatus === "Confirmed"
                    || report.form_data?.workflow?.lifecycleStatus === "Accepted"
                    || (report.status !== "Draft" && report.status !== "draft" && report.status !== "Open")
                  );

                  const isCompleted = report.status === "Completed" || report.status === "completed";

                  let statusLabel = "Draft";
                  let statusBadgeClass = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
                  let rowBgClass = "bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-200";

                  if (isCompleted) {
                    statusLabel = "Completed";
                    statusBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold";
                    rowBgClass = "bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-200";
                  } else if (isPosted) {
                    statusLabel = "Transferred";
                    statusBadgeClass = "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 font-black";
                    rowBgClass = "bg-white text-slate-900 font-medium dark:bg-slate-950 dark:text-slate-100";
                  } else if (isAccepted) {
                    statusLabel = "Accepted";
                    statusBadgeClass = "bg-red-500 text-white border-red-600 font-black shadow-sm";
                    rowBgClass = "bg-red-50/50 text-red-600 font-bold dark:bg-red-950/20 dark:text-red-400 border-l-4 border-l-red-500";
                  }

                  const userName = report.audit?.userName || (report as any).createdByName || "ADMIN";

                  return (
                    <tr
                      key={report.id}
                      onClick={() => { setSelectedId(report.id); setIsDrawerOpen(true); }}
                      className={cn(
                        "cursor-pointer border-b border-slate-200 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-900/60",
                        rowBgClass
                      )}
                    >
                      <Td center className="font-bold text-[10px]">{srNo}</Td>
                      <Td center className="font-mono font-bold text-[10px] text-blue-600 dark:text-blue-400">{sysBillNo}</Td>
                      <Td center className="font-mono text-[10px]">{manualBillNo}</Td>
                      <Td className="text-[10px] whitespace-nowrap">
                        <span className="mr-1.5">{countryFlag}</span>
                        <span className="font-semibold">{countryName}</span>
                      </Td>
                      <Td className="font-semibold text-[10px] whitespace-nowrap">{branchName}</Td>
                      <Td className="font-bold text-[10px] whitespace-nowrap">{supplierName}</Td>
                      <Td className="font-mono text-[10px] whitespace-nowrap">{purchaseAcc}</Td>
                      <Td className="font-mono text-[10px] whitespace-nowrap">{salesAcc}</Td>
                      <Td center className="font-semibold whitespace-nowrap text-[10px]">{bookingDateStr}</Td>
                      <Td right className="font-mono font-bold text-[10px]">{formatMoney(totalAmountNum)}</Td>
                      <Td center>
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-wider ${statusBadgeClass}`}>
                          {statusLabel}
                        </span>
                      </Td>
                      <Td center className="font-bold text-[10px] uppercase text-slate-600 dark:text-slate-400">{userName}</Td>
                      <Td center onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setSelectedId(report.id); setIsDrawerOpen(true); }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-sm"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/dashboard/purchase/new-purchase-booking-order?id=${encodeURIComponent(report.id)}&purchaseOrderNo=${encodeURIComponent(report.purchaseBookingOrderNumber)}`);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition shadow-sm"
                            title="Edit Booking"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedId(report.id); handleTransfer(); }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 transition shadow-sm"
                            title="Transfer/Accept"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const f = report.form_data?.form || {};
                              const goodsEntries = report.form_data?.goodsEntries || [];
                              openPurchaseBookingOrderPrintReport({
                                order: {
                                  id: report.id,
                                  systemBillNo: report.purchaseBookingOrderNumber || f.bookingNo || `PB-2026-${report.id.slice(0, 4)}`,
                                  manualBillNo: f.salesOrderNo || f.billNo || report.purchaseContractNumber,
                                  superAdminSerialNo: (report as any).super_admin_serial_number || f.superAdminSerialNo,
                                  countrySerialNo: (report as any).country_transaction_serial_number || f.countrySerialNo,
                                  branchSerialNo: (report as any).branch_transaction_serial_number || f.branchSerialNo,
                                  bookingDate: report.bookingDate || report.purchaseDate || new Date().toISOString(),
                                  supplierName: report.supplierName || f.purchaseAccountName || "SUPPLIER ACCOUNT",
                                  supplierContact: f.supplierContact,
                                  buyerName: report.buyerName || f.customerName || "DAMAN GROUP",
                                  purchaseAccountNo: report.purchaseAccountNumber || f.purchaseAccountNo || "UAE-DET-AC-0003",
                                  purchaseAccountName: report.purchaseAccountName || f.purchaseAccountName || "Purchase Account",
                                  salesAccountNo: report.salesAccountNumber || f.salesAccountNo || "UAE-DET-AC-0003",
                                  salesAccountName: report.salesAccountName || f.salesAccountName || "Sales Account",
                                  countryName: report.countryName || f.countryName || "UAE",
                                  branchName: report.branchName || f.branchName || "AL_RAS",
                                  shippingMode: f.shippingMode || "By Sea",
                                  containerNumbers: f.containerNumbers || "N/A",
                                  vesselName: f.vesselName || "N/A",
                                  loadingCountryPort: f.loadingPort || f.loadingCountry || "N/A",
                                  receivedCountryPort: f.receivedPort || f.receivedCountry || "N/A",
                                  goodsItems: goodsEntries.map((g: any, idx: number) => ({
                                    srNo: idx + 1,
                                    goodsName: g.goodsName || report.productName || "COMMODITY GOODS",
                                    grade: g.size || "Standard",
                                    origin: g.origin || report.countryName || "USA",
                                    quantity: Number(g.qtyNo || report.quantity || 1),
                                    unit: g.qtyName || report.unit || "BAGS",
                                    grossWeight: Number(g.qtyNo * g.qtyKgs || report.totalGrossWeight || 1000),
                                    tareWeight: Number(g.emptyKgs || 0),
                                    netWeight: Number(g.qtyNo * (g.qtyKgs - (g.emptyKgs || 0)) || report.totalNetWeight || 1000),
                                    rateKg: Number(g.coursePrice || report.purchaseRate || 0),
                                    amountFc: Number(g.totalAmount || report.totalPurchaseAmount || 0),
                                    currencyFc: g.purchaseCurrency || report.currency || "USD",
                                    exchangeRate: Number(g.exchangeRate || f.exchangeRate || 3.6725),
                                    amountLc: Number(g.finalAmount || report.finalAmount || 0),
                                    currencyLc: report.finalCurrency || "AED"
                                  })),
                                  totalPurchaseFc: Number(report.totalPurchaseAmount || 0),
                                  currencyFc: report.currency || "USD",
                                  totalPurchaseLc: Number(report.finalAmount || 0),
                                  currencyLc: "AED",
                                  advancePercent: Number(f.advancePercent || 10),
                                  advanceAmountFc: Number(f.advanceAmountFc || 0),
                                  advanceAmountLc: Number(f.advanceAmountLc || 0),
                                  remainingAmountFc: Number(f.remainingAmountFc || 0),
                                  remainingAmountLc: Number(f.remainingAmountLc || 0),
                                  advancePaymentDate: f.advancePaymentDate,
                                  remainingDueDate: f.paymentDate,
                                  paymentType: f.paymentType || report.paymentStatus || "Advance Payment",
                                  status: report.status || "Accepted",
                                  remarks: f.orderReportRemarks || report.goodsDescription || "",
                                  userName: report.audit?.userName || "ADMIN"
                                },
                                companyInfo: {
                                  name: "DIGITAL DOCK ERP",
                                  branch: report.branchName || "AL_RAS",
                                  printedBy: session?.fullName || session?.email || "SUPER ADMIN"
                                }
                              });
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-sm"
                            title="Print Bill"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <RowActionsMenu
                            report={report}
                            onSelect={() => { setSelectedId(report.id); setIsDrawerOpen(true); }}
                            onEdit={() => { router.push(`/dashboard/purchase/new-purchase-booking-order?id=${encodeURIComponent(report.id)}&purchaseOrderNo=${encodeURIComponent(report.purchaseBookingOrderNumber)}`); }}
                            onAccept={() => { setSelectedId(report.id); handleAccept(); }}
                            onTransfer={() => { setSelectedId(report.id); handleTransfer(); }}
                            isSuperAdmin={isSuperAdmin}
                            isCountryAdmin={isCountryAdmin}
                            isBranchAdmin={isBranchAdmin}
                          />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
            </DarkTable>
          </div>
        ) : (
          /* ── Detailed 41-Column Audit Register View ──────────── */
          <div className="p-0 overflow-x-auto">
            <DarkTable
              tableGroups={[
                { label: "General Information", span: 11, cls: "bg-[#0f2942] text-white border-b border-slate-800 border-r border-slate-700" },
                { label: "Product Information", span: 7, cls: "bg-[#143657] text-white border-b border-slate-800 border-r border-slate-700" },
                { label: "Financial Information", span: 10, cls: "bg-[#0f2942] text-white border-b border-slate-800 border-r border-slate-700" },
                { label: "Route & Loading", span: 7, cls: "bg-[#143657] text-white border-b border-slate-800 border-r border-slate-700" },
                { label: "Status", span: 4, cls: "bg-[#0f2942] text-white border-b border-slate-800 border-r border-slate-700" },
                { label: "Actions", span: 1, cls: "bg-[#143657] text-white border-b border-slate-800" },
              ]}
              headers={[
                "", "SR.", "SUPER S/N", "CTY S/N", "BR. S/N", "PURCHASE ACC.", "SALES ACC.", "COUNTRY", "CITY BRANCH", "DATE", "USER",
                "GOODS NAME", "BRAND", "ORIGIN", "QTY", "UNIT", "GROSS WT (KG)", "NET WT (KG)",
                "PURCH. CURR", "PURCH. PRICE", "TOTAL AMT", "ADVANCE (FC)", "EX. RATE", "FINAL CURR", "FINAL AMT", "ADVANCE (LC)", "INV. %", "PAY. CONDITION",
                "ROUTE", "LOAD. COUNTRY", "LOAD. PORT", "LOAD. DATE", "RCV. COUNTRY", "RCV. PORT", "RCV. DATE",
                "TRANSFER THE BILL", "INV. STS.", "PAY. STATUS", "LOAD. STATUS", "ACTIONS"
              ]}
            >
              {registerRows.map((report, index) => {
                const srNo = index + 1;
                const goods = report.form_data?.goodsEntries || [];
                const g0 = goods[0] as any;
                const superSerialNo = (report as any).superAdminSerialNo || `GBL-${report.purchaseBookingOrderNumber}`;
                const countrySerialNo = (report as any).computedCountrySerial || "-";
                const branchSerialNo = (report as any).computedBranchSerial || "-";
                const purchaseAccCode = report.purchaseAccountNumber || report.form_data?.form?.purchaseAccountNo || "-";
                const salesAccCode = report.salesAccountNumber || report.form_data?.form?.salesAccountNo || "-";
                const dateStr = formatShortDate(report.purchaseDate);
                const goodsName = goods.map((g: any) => g.goodsName).filter(Boolean).join(", ") || report.productName || "-";

                return (
                  <tr key={report.id} onClick={() => { setSelectedId(report.id); setIsDrawerOpen(true); }} className="cursor-pointer border-b border-slate-200 hover:bg-slate-100">
                    <Td center className="font-bold text-[10px]">{srNo}</Td>
                    <Td center className="font-mono text-[10px]">{superSerialNo}</Td>
                    <Td center className="font-mono text-[10px]">{countrySerialNo}</Td>
                    <Td center className="font-mono text-[10px]">{branchSerialNo}</Td>
                    <Td className="text-[10px]">{purchaseAccCode}</Td>
                    <Td className="text-[10px]">{salesAccCode}</Td>
                    <Td className="text-[10px]">{report.countryName}</Td>
                    <Td className="text-[10px]">{report.branchName}</Td>
                    <Td center className="text-[10px]">{dateStr}</Td>
                    <Td className="text-[10px]">{report.audit?.userName || "ADMIN"}</Td>
                    <Td className="text-[10px]">{goodsName}</Td>
                    <Td center className="text-[10px]">Standard</Td>
                    <Td center className="text-[10px]">{report.countryName}</Td>
                    <Td right className="font-mono text-[10px]">{formatNumber(report.quantity || 0)}</Td>
                    <Td center className="text-[10px]">{report.unit || "KG"}</Td>
                    <Td right className="font-mono text-[10px]">{formatNumber(report.totalGrossWeight || 0)}</Td>
                    <Td right className="font-mono text-[10px]">{formatNumber(report.totalNetWeight || 0)}</Td>
                    <Td center className="text-[10px]">{report.currency || "AED"}</Td>
                    <Td right className="font-mono text-[10px]">{formatMoney(report.purchaseRate || 0)}</Td>
                    <Td right className="font-mono font-bold text-[10px]">{formatMoney(report.totalPurchaseAmount || 0)}</Td>
                    <Td right className="font-mono text-[10px]">0.00</Td>
                    <Td right className="font-mono text-[10px]">1.00</Td>
                    <Td center className="text-[10px]">AED</Td>
                    <Td right className="font-mono font-bold text-[10px]">{formatMoney(report.totalPurchaseAmount || 0)}</Td>
                    <Td right className="font-mono text-[10px]">0.00</Td>
                    <Td center className="text-[10px]">100%</Td>
                    <Td className="text-[10px]">Normal</Td>
                    <Td center className="text-[10px]">By Road</Td>
                    <Td className="text-[10px]">{report.countryName}</Td>
                    <Td className="text-[10px]">Port</Td>
                    <Td center className="text-[10px]">{dateStr}</Td>
                    <Td className="text-[10px]">{report.countryName}</Td>
                    <Td className="text-[10px]">Port</Td>
                    <Td center className="text-[10px]">{dateStr}</Td>
                    <Td center><span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[8px] font-bold">YES</span></Td>
                    <Td center><span className="rounded bg-slate-50 text-slate-700 px-2 py-0.5 text-[8px]">Confirmed</span></Td>
                    <Td center><span className="rounded bg-slate-50 text-slate-700 px-2 py-0.5 text-[8px]">Paid</span></Td>
                    <Td center><span className="rounded bg-slate-50 text-slate-700 px-2 py-0.5 text-[8px]">Loaded</span></Td>
                    <Td center onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => { setSelectedId(report.id); setIsDrawerOpen(true); }} className="h-7 w-7 rounded border bg-white text-slate-600">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </DarkTable>
          </div>
        )}

        {/* ── Footer Controls & Pagination ───────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <div>
            Showing {registerRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, registerRows.length)} of {registerRows.length} entries
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-8 w-8 p-0"
              >
                ‹
              </Button>
              {Array.from({ length: Math.min(5, Math.ceil(registerRows.length / pageSize) || 1) }, (_, i) => i + 1).map(p => (
                <Button
                  key={p}
                  variant={currentPage === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(p)}
                  className={cn("h-8 w-8 p-0 font-bold text-xs", currentPage === p && "bg-blue-600 text-white")}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.ceil(registerRows.length / pageSize)}
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(registerRows.length / pageSize), prev + 1))}
                className="h-8 w-8 p-0"
              >
                ›
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Status Legend & Notes Footer Cards ───────────────────── */}
      <div className="grid gap-3.5 md:grid-cols-2">
        {/* STATUS LEGEND */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">STATUS LEGEND</h4>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-slate-400"></span>
              <span className="text-slate-600 dark:text-slate-400">Draft (Not Accepted)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-600"></span>
              <span className="text-red-600 font-bold">Accepted (Not Transferred)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-slate-900 dark:bg-white"></span>
              <span className="text-slate-900 dark:text-slate-100 font-bold">Transferred</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-600"></span>
              <span className="text-emerald-600 font-bold">Completed</span>
            </div>
          </div>
        </div>

        {/* NOTE */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">NOTE</h4>
          <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 space-y-1">
            <div>• After Accept: Bill will appear in register in <strong className="text-red-600">RED color</strong>.</div>
            <div>• After Transfer: Same bill will remain in register in <strong className="text-slate-900 dark:text-white">BLACK color</strong>.</div>
          </div>
        </div>
      </div>

        <DetailDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Purchase Transfer Verification Screen"
          subtitle={`Booking Ref: ${selected?.purchaseBookingOrderNumber}`}
          className="sm:max-w-none md:max-w-none w-screen h-screen"
          actions={
            <div className="flex items-center gap-1.5 mr-2">
              <details className="relative">
                <summary className="flex items-center gap-1.5 cursor-pointer list-none rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-2.5 py-1.5 transition-all h-8 [&::-webkit-details-marker]:hidden">
                  <span>Print & Documents</span>
                  <span className="text-[8px]">▼</span>
                </summary>
                <div className="absolute right-0 mt-1 w-56 rounded-xl bg-card border border-border shadow-2xl z-50 p-1 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150 text-foreground">
                  <button
                    type="button"
                    onClick={() => selected && openReportWindow(selected, true)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-muted"
                  >
                    <span>🖨️</span> Print A4 Report
                  </button>
                  <button
                    type="button"
                    onClick={() => selected && openReportWindow(selected, false)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-muted"
                  >
                    <span>👁️</span> PDF Preview
                  </button>
                  <div className="h-px bg-border my-1" />
                  <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Trade Documents</div>
                  <button
                    type="button"
                    onClick={() => selected && openTradeDocumentWindow("contract", selected)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-muted"
                  >
                    <span>📄</span> Purchase Contract
                  </button>
                  <button
                    type="button"
                    onClick={() => selected && openTradeDocumentWindow("proforma", selected)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-muted"
                  >
                    <span>📑</span> Proforma Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => selected && openTradeDocumentWindow("commercial", selected)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-muted"
                  >
                    <span>🧾</span> Commercial Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => selected && openTradeDocumentWindow("packing", selected)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-muted"
                  >
                    <span>📦</span> Packing List
                  </button>
                </div>
              </details>
              {selected && (
                <Button
                  type="button"
                  onClick={handleAccept}
                  disabled={accepting}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8"
                >
                  {accepting ? "Accepting..." : "Accept"}
                </Button>
              )}
              {selected && (
                <Button
                  type="button"
                  onClick={handleTransfer}
                  disabled={transferring}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8"
                >
                  {transferring ? "Processing..." : ((selected as any)?.is_edited_since_transfer ? "Update Transfer" : "Transfer")}
                </Button>
              )}
            </div>
          }
        >
          {(() => {
            if (!selected) return null;
            const goodsEntries = selected.form_data?.goodsEntries || [
              {
                goodsName: selected.productName || selected.goodsDescription || "Purchase Cargo",
                brand: selected.goodsDescription || "-",
                origin: selected.countryName || "-",
                qtyNo: selected.quantity || 0,
                qtyName: selected.unit || "BAGS",
                qtyKgs: selected.totalWeight && selected.quantity ? Math.round(selected.totalWeight / selected.quantity) : 0,
                grossWeight: selected.totalGrossWeight || selected.totalWeight || 0,
                netWeight: selected.totalNetWeight || selected.totalWeight || 0,
                coursePrice: selected.purchaseRate || 0,
                totalAmount: selected.totalPurchaseAmount || 0,
                exchangeRate: selected.exchange_rate || 280,
                  finalAmount: selected.finalAmount || (selected.totalPurchaseAmount * 280) || 0
              }
            ];

            const totalQty = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.qtyNo || 0), 0);
            const totalGross = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.grossWeight || 0), 0);
            const totalNet = goodsEntries.reduce((sum: number, item: any) => sum + Number(item.netWeight || 0), 0);
            
            const exRate = goodsEntries[0]?.exchangeRate || selected.exchange_rate || 280;

            const totalUSDVal = goodsEntries.reduce((sum: number, item: any) => {
              const qtyNo = Number(item.qtyNo || 0);
              const qtyKgs = Number(item.qtyKgs || 0);
              const grossWeight = Number(item.grossWeight || qtyNo * qtyKgs);
              const netWeight = Number(item.netWeight || grossWeight);
              const coursePrice = Number(item.coursePrice || 0);
              const amount = Number(item.totalAmount || netWeight * coursePrice);
              return sum + amount;
            }, 0);

            const totalPKRVal = goodsEntries.reduce((sum: number, item: any) => {
              const qtyNo = Number(item.qtyNo || 0);
              const qtyKgs = Number(item.qtyKgs || 0);
              const grossWeight = Number(item.grossWeight || qtyNo * qtyKgs);
              const netWeight = Number(item.netWeight || grossWeight);
              const coursePrice = Number(item.coursePrice || 0);
              const amount = Number(item.totalAmount || netWeight * coursePrice);
              const exVal = Number(item.exchangeRate || exRate);
              const finalAmountVal = Number(item.finalAmount || amount * exVal);
              return sum + finalAmountVal;
            }, 0);
            const purchaseCurrency = selected.currency || selected.form_data?.form?.currency || "USD";
            const purchaseCurrencySymbol = getCurrencySymbol(purchaseCurrency);

            const displayCurrency = selected.form_data?.form?.secondaryCurrency || "PKR";
            const displayCurrencySymbol = getCurrencySymbol(displayCurrency);

            const avgRateKg = totalNet > 0 ? (totalUSDVal / totalNet) : 0;
            const avgRateTon = avgRateKg * 1000;

            const advancePercent = selected.form_data?.form?.advancePercent || 10;
            const advanceAmount = (totalUSDVal * advancePercent) / 100;
            const remainingPercent = 100 - advancePercent;
            const remainingAmount = totalUSDVal - advanceAmount;
            const advanceAmountFinal = (totalPKRVal * advancePercent) / 100;
            const remainingAmountFinal = totalPKRVal - advanceAmountFinal;

            const remarksText = selected.form_data?.form?.orderReportRemarks || selected.remarks || "No narration provided.";
            const reportDate = date(selected.bookingDate || selected.purchaseDate || selected.createdAt);
            const reportNo = `PTVR-2026-${selected.purchaseBookingOrderNumber.replace(/[^0-9]/g, "").slice(-6) || "000123"}`;

            const containerCount = selected.containerCount || 0;
            const containerNumbersText = selected.form_data?.form?.containerNumbers || "-";
            const billNumberText = selected.form_data?.form?.billNo || "CONT-001";
            const vesselFlightText = selected.form_data?.form?.vesselName || "BILL-7788";
            const loadingPortText = selected.form_data?.form?.loadingPort || "-";
            const destinationPortText = selected.form_data?.form?.receivedPort || "-";
            const transitTimeText = selected.form_data?.form?.transitTime || "-";

            const expectedLoadingDate = selected.form_data?.form?.loadingDate || "-";
            const actualLoadingDate = selected.form_data?.form?.loadingDate || "-";
            const expectedArrivalDate = "-";
            const actualArrivalDate = "-";
            const shippingLineCarrier = "-";
            const modeOfShipment = "Sea Cargo";
            const scheduleRemarks = "-";

            const paymentConditionText = selected.form_data?.form?.paymentType || "Advance Payment";
            const advanceDueDateText = selected.form_data?.form?.advancePaymentDate || reportDate;
            const finalPaymentDueDateText = selected.form_data?.form?.paymentDate || reportDate;

            const journalEntryNumberText = selected.form_data?.form?.journalEntryNo || "Pending Posting";
            const paymentStatusLabel = (selected.paymentStatus || "PENDING").toUpperCase();

            return (
              <div className="w-full bg-slate-100 dark:bg-slate-900/60 p-4 flex justify-center rounded-xl border border-border overflow-x-auto select-none">
                {/* Simulated A4 Page */}
                <div className="print-a4-content bg-white text-slate-800 border border-slate-300 w-[210mm] min-h-[297mm] p-[10mm] shadow-2xl text-[9px] font-sans flex flex-col gap-3 relative rounded-sm text-left leading-relaxed">
                  
                  {/* CSS print hack injection */}
                  <style dangerouslySetInnerHTML={{__html: `
                    @media print {
                      body * {
                        visibility: hidden !important;
                      }
                      .print-a4-content, .print-a4-content * {
                        visibility: visible !important;
                      }
                      .print-a4-content {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        color: black !important;
                        font-size: 9px !important;
                      }
                    }
                  `}} />
                  
                  {/* Branding Header */}
                  <div className="flex justify-between items-center border-b border-slate-350 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 text-blue-900 shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-9 h-9">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                          <path d="M2 12h20" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-black tracking-widest text-blue-900 uppercase leading-none">
                          DEMI TRADING CO.
                        </div>
                        <div className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Global Trade, Trusted Partner</div>
                      </div>
                    </div>
                    <div className="text-right text-[8px] font-bold text-slate-650 uppercase">
                      <div>BRANCH : {selected.branchName || "Main Branch"}</div>
                      <div>COUNTRY : {selected.countryName || ""}</div>
                      <div>ADDRESS : {selected.branchName || "Branch Address"}</div>
                      <div>PHONE : +93 700 000 000</div>
                      <div>EMAIL : info@demitrading.com</div>
                    </div>
                  </div>

                  {/* Document Title Bar */}
                  <div className="bg-[#0f2942] text-white text-[8.5px] font-bold px-3 py-1 flex justify-between rounded-sm items-center">
                    <span>Report No: {reportNo}</span>
                    <span className="text-xs tracking-widest uppercase font-black">Purchase Transfer Verification Report</span>
                    <div className="flex gap-4">
                      <span>Report Date: {reportDate}</span>
                      <span>Time: 10:30 AM</span>
                    </div>
                  </div>

                  {/* Transfer Status Panel */}
                  <div className="flex gap-3">
                    <div className="w-[38%] bg-emerald-500/5 border border-emerald-500/10 rounded p-2.5 flex flex-col justify-center">
                      <span className="text-[7.5px] text-emerald-600 uppercase font-black tracking-wider block">Transfer Status</span>
                      <span className="text-xs font-black text-emerald-700 block mt-1 mb-1.5">
                        ● {selected.status === "Posted" || (selected as any).ledgerPostingStatus === "Posted" ? "Fully Transferred & Posted" : "Approved & Ready for Transfer"}
                      </span>
                      {(selected.status === "Posted" || (selected as any).ledgerPostingStatus === "Posted") && selected.form_data?.form?.transferAudit && (
                        <div className="text-[7.5px] text-emerald-800/80 bg-emerald-500/10 p-1.5 rounded-sm border border-emerald-500/20 leading-snug font-semibold mt-0.5">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="font-black uppercase tracking-wider text-emerald-700">Transferred By:</span> {selected.form_data.form.transferAudit.userName}
                          </div>
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="font-black uppercase tracking-wider text-emerald-700">Date/Time:</span> {new Date(selected.form_data.form.transferAudit.transferDate).toLocaleString("en-US")}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-black uppercase tracking-wider text-emerald-700">Transfer ID:</span> <span className="font-mono font-bold text-emerald-900">{selected.form_data.form.transferAudit.transferId}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="w-[62%] bg-emerald-500/5 border border-emerald-500/10 rounded p-2.5 text-[8.5px] text-slate-655 leading-relaxed font-semibold">
                      <span className="text-[7.5px] text-emerald-650 uppercase font-black tracking-wider block mb-1">Transferred To (Destination Accounts)</span>
                      <ul className="list-disc pl-3.5 space-y-0.5">
                        <li>General Ledger Debit Account: <strong className="text-slate-800 font-mono">{selected.form_data?.form?.purchaseAccountNo || selected.purchaseAccountNumber} - {selected.form_data?.form?.purchaseAccountName || selected.purchaseAccountName}</strong> & Credit Account: <strong className="text-slate-800 font-mono">{selected.form_data?.form?.salesAccountNo || selected.salesAccountNumber} - {selected.form_data?.form?.salesAccountName || selected.salesAccountName}</strong></li>
                        <li>Internal Voucher Entry No: <strong className="text-slate-800 font-mono">{selected.status === "Posted" || (selected as any).ledgerPostingStatus === "Posted" ? `JV-${selected.purchaseBookingOrderNumber.slice(-6)}` : `Pending Posting`}</strong></li>
                        <li>Logistics cargo loading module (<strong className="text-slate-800">{containerCount} Container</strong>)</li>
                      </ul>
                    </div>
                  </div>

                  {/* 3-Column General Information */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Booking Information */}
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 px-2 py-1 text-[8px] font-black uppercase text-blue-900 flex items-center gap-1">
                        <span>👤</span> Booking Information
                      </div>
                      <table className="w-full text-[8px] font-semibold text-slate-600">
                        <tbody>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Booking Reference:</td><td className="px-2 py-1 font-bold text-slate-800 font-mono">{selected.purchaseBookingOrderNumber}</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Purchase Date:</td><td className="px-2 py-1 text-slate-800">{date(selected.purchaseDate)}</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Booking Date:</td><td className="px-2 py-1 text-slate-800">{reportDate}</td></tr>
                          <tr><td className="px-2 py-1 text-slate-400">Booking User:</td><td className="px-2 py-1 font-bold text-slate-800 uppercase">{selected.audit?.userName || "ADMIN"}</td></tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Supplier Information */}
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 px-2 py-1 text-[8px] font-black uppercase text-blue-900 flex items-center gap-1">
                        <span>🏢</span> Supplier Information
                      </div>
                      <table className="w-full text-[8px] font-semibold text-slate-600">
                        <tbody>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Supplier Name:</td><td className="px-2 py-1 font-bold text-slate-800 truncate max-w-[100px]">{selected.supplierName}</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Contact Person:</td><td className="px-2 py-1 text-slate-800">{selected.form_data?.form?.purchaseContactPerson || selected.form_data?.form?.supplierContactPerson || "Mr. Ahmad Shah"}</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Mobile Number:</td><td className="px-2 py-1 text-slate-800 font-mono">{selected.form_data?.form?.purchaseContact || selected.form_data?.form?.supplierContact || "+93 700 000 000"}</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Email Address:</td><td className="px-2 py-1 text-slate-800 truncate max-w-[100px]">{selected.form_data?.form?.supplierEmail || "supplier@globalfoods.com"}</td></tr>
                          <tr><td className="px-2 py-1 text-slate-400">Country:</td><td className="px-2 py-1 text-slate-800">{selected.countryName}</td></tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Buyer Information */}
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 px-2 py-1 text-[8px] font-black uppercase text-blue-900 flex items-center gap-1">
                        <span>👤</span> Buyer Information
                      </div>
                      <table className="w-full text-[8px] font-semibold text-slate-600">
                        <tbody>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Buyer Name:</td><td className="px-2 py-1 font-bold text-slate-800 truncate max-w-[100px]">{selected.buyerName}</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Contact Person:</td><td className="px-2 py-1 text-slate-800">Mr. Imran Hassan</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Mobile Number:</td><td className="px-2 py-1 text-slate-800 font-mono">+92 300 1234567</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Email Address:</td><td className="px-2 py-1 text-slate-800 truncate max-w-[100px]">info@demitrading.com</td></tr>
                          <tr><td className="px-2 py-1 text-slate-400">Country:</td><td className="px-2 py-1 text-slate-800">Afghanistan</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Goods Details section */}
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-[#0f2942] text-white px-2.5 py-1 text-[8px] font-black uppercase tracking-wider">
                      📦 Goods Details
                    </div>
                    <table className="w-full text-[8px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase">
                          <th className="p-1 border-r border-slate-200 text-center w-[3%]">SR.</th>
                          <th className="p-1 border-r border-slate-200 w-[17%]">GOODS NAME</th>
                          <th className="p-1 border-r border-slate-200 text-center w-[8%]">BRAND</th>
                          <th className="p-1 border-r border-slate-200 text-center w-[8%]">SIZE</th>
                          <th className="p-1 border-r border-slate-200 text-center w-[8%]">ORIGIN</th>
                          <th className="p-1 border-r border-slate-200 text-right w-[8%]">QUANTITY</th>
                          <th className="p-1 border-r border-slate-200 text-right w-[8%]">QTY (KGS)</th>
                          <th className="p-1 border-r border-slate-200 text-right w-[8%]">GROSS WT</th>
                          <th className="p-1 border-r border-slate-200 text-right w-[8%]">NET WT</th>
                          <th className="p-1 border-r border-slate-200 text-right w-[8%]">RATE / KG</th>
                          <th className="p-1 border-r border-slate-200 text-right w-[10%]">AMOUNT ({purchaseCurrency})</th>
                          <th className="p-1 border-r border-slate-200 text-right w-[6%]">EX. RATE</th>
                          <th className="p-1 text-right w-[10%]">FINAL AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {goodsEntries.map((item: any, idx: number) => {
                          const qtyNo = Number(item.qtyNo || 0);
                          const qtyKgs = Number(item.qtyKgs || 0);
                          const grossWeight = Number(item.grossWeight || qtyNo * qtyKgs);
                          const netWeight = Number(item.netWeight || grossWeight);
                          const coursePrice = Number(item.coursePrice || 0);
                          const amount = Number(item.totalAmount || netWeight * coursePrice);
                          const exVal = Number(item.exchangeRate || exRate);
                          const finalAmountVal = Number(item.finalAmount || amount * exVal);

                          const ratePerKg = item.priceType === "P/KGs" ? coursePrice : coursePrice / 1000;

                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition border-t border-slate-200 font-semibold text-slate-700">
                              <td className="p-1 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                              <td className="p-1 border-r border-slate-200 font-bold text-slate-900">
                                {item.goodsName}
                              </td>
                              <td className="p-1 border-r border-slate-200 text-center">{item.brand || "-"}</td>
                              <td className="p-1 border-r border-slate-200 text-center">{item.size || "-"}</td>
                              <td className="p-1 border-r border-slate-200 text-center">{item.origin || selected.countryName || "-"}</td>
                              <td className="p-1 border-r border-slate-200 text-right font-bold">{qtyNo.toLocaleString()} {item.qtyName}</td>
                              <td className="p-1 border-r border-slate-200 text-right font-mono">{qtyKgs.toLocaleString()} kg</td>
                              <td className="p-1 border-r border-slate-200 text-right font-mono">{grossWeight.toLocaleString()} kg</td>
                              <td className="p-1 border-r border-slate-200 text-right font-mono">{netWeight.toLocaleString()} kg</td>
                              <td className="p-1 border-r border-slate-200 text-right font-mono">{purchaseCurrencySymbol}{ratePerKg.toFixed(2)}</td>
                              <td className="p-1 border-r border-slate-200 text-right font-mono font-bold">{purchaseCurrencySymbol}{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="p-1 border-r border-slate-200 text-right font-mono">{exVal}</td>
                              <td className="p-1 text-right font-mono font-bold text-emerald-600">{finalAmountVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-[1.5px] border-slate-350 bg-slate-50 font-bold text-[8px]">
                        <tr className="text-slate-800">
                          <td colSpan={5} className="p-1 text-right text-slate-500 font-extrabold uppercase text-[7.5px]">Totals:</td>
                          <td className="p-1 text-right text-slate-900 font-black">{totalQty.toLocaleString()} {goodsEntries[0]?.qtyName || "Units"}</td>
                          <td className="p-1"></td>
                          <td className="p-1 text-right text-slate-950 font-bold">{totalGross.toLocaleString()} kg</td>
                          <td className="p-1 text-right text-slate-950 font-bold">{totalNet.toLocaleString()} kg</td>
                          <td className="p-1 text-right text-slate-550 text-[7px]">Avg: {purchaseCurrencySymbol}{avgRateKg.toFixed(2)}</td>
                          <td className="p-1 text-right text-blue-600 font-black">{totalUSDVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {purchaseCurrencySymbol}</td>
                          <td className="p-1"></td>
                          <td className="p-1 text-right text-emerald-600 font-black">{totalPKRVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {displayCurrencySymbol}</td>
                        </tr>
                        <tr className="text-[7.5px] text-slate-550 border-t border-slate-200/60 font-semibold">
                          <td colSpan={5} className="p-1 text-right uppercase text-[7px]">Containers & Dues:</td>
                          <td colSpan={3} className="p-1 text-left">FCL: <span className="font-bold text-slate-800">{containerCount}</span></td>
                          <td colSpan={5} className="p-1 text-left">Avg Rate/Ton: <span className="font-bold text-slate-800">{purchaseCurrencySymbol}{avgRateTon.toFixed(2)}</span></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Loading & Transit Information */}
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-2 py-1 text-[8px] font-black uppercase text-blue-900 flex items-center gap-1">
                      <span>🚢</span> Loading & Transit Information
                    </div>
                    <table className="w-full text-[8px] font-semibold text-slate-600">
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="px-2 py-1 text-slate-400 w-[20%]">Loading Country:</td>
                          <td className="px-2 py-1 text-slate-800 font-bold w-[30%]">{selected.countryName || "Afghanistan"}</td>
                          <td className="px-2 py-1 text-slate-400 w-[20%]">Receiving Country:</td>
                          <td className="px-2 py-1 text-slate-800 font-bold w-[30%]">{selected.form_data?.form?.receivedCountry || selected.buyerName || "Pakistan"}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="px-2 py-1 text-slate-400">Loading Port:</td>
                          <td className="px-2 py-1 text-slate-800">{loadingPortText}</td>
                          <td className="px-2 py-1 text-slate-400">Receiving Port:</td>
                          <td className="px-2 py-1 text-slate-800">{destinationPortText}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="px-2 py-1 text-slate-400">Loading Date:</td>
                          <td className="px-2 py-1 text-slate-800 font-mono font-bold text-blue-750">{expectedLoadingDate}</td>
                          <td className="px-2 py-1 text-slate-400">Received Date at Port:</td>
                          <td className="px-2 py-1 text-slate-800 font-mono font-bold text-blue-750">{selected.form_data?.form?.receivedDate || "-"}</td>
                        </tr>
                        <tr>
                          <td className="px-2 py-1 text-slate-400">Containers:</td>
                          <td className="px-2 py-1 text-slate-800 font-bold">{containerCount} Containers</td>
                          <td className="px-2 py-1 text-slate-400">Container Numbers & BL:</td>
                          <td className="px-2 py-1 text-slate-800 font-mono truncate max-w-[200px]">{containerNumbersText} {billNumberText !== "-" && `/ BL: ${billNumberText}`}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Payment & Accounting details */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Payment Information */}
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 px-2 py-1 text-[8px] font-black uppercase text-blue-900 flex items-center gap-1">
                        <span>💵</span> Payment Information
                      </div>
                      <table className="w-full text-[8px] font-semibold text-slate-650">
                        <tbody>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Payment Condition:</td><td className="px-2 py-1 text-slate-800 font-bold">{paymentConditionText}</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Advance Percent / Due:</td><td className="px-2 py-1 text-slate-800">{advancePercent}% / <span className="font-bold text-blue-700">{advanceDueDateText}</span></td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Advance Amount:</td><td className="px-2 py-1 font-bold text-emerald-600 font-mono">{purchaseCurrencySymbol}{advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {purchaseCurrency !== displayCurrency && `/ ${displayCurrencySymbol}${advanceAmountFinal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Remaining Balance / Due:</td><td className="px-2 py-1 text-slate-800">{remainingPercent}% / <span className="font-bold text-rose-600">{finalPaymentDueDateText}</span></td></tr>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Remaining Amount:</td><td className="px-2 py-1 text-slate-800 font-mono">{purchaseCurrencySymbol}{remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {purchaseCurrency !== displayCurrency && `/ ${displayCurrencySymbol}${remainingAmountFinal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</td></tr>
                          <tr>
                            <td className="px-2 py-1 text-slate-400">Payment Status:</td>
                            <td className="px-2 py-1">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[7px] font-black uppercase text-white ${
                                paymentStatusLabel === "PAID" || paymentStatusLabel === "FULL PAYMENT" || paymentStatusLabel === "ADVANCE PAID" ? "bg-emerald-600" : "bg-rose-600"
                              }`}>
                                {paymentStatusLabel}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Accounting Information */}
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 px-2 py-1 text-[8px] font-black uppercase text-blue-900 flex items-center gap-1">
                        <span>📊</span> Accounting Information
                      </div>
                      <table className="w-full text-[8px] font-semibold text-slate-600">
                        <tbody>
                          <tr className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">Journal Entry Number:</td><td className="px-2 py-1 text-slate-800 font-mono font-bold">{journalEntryNumberText}</td></tr>
                          <tr className="border-b border-slate-100">
                            <td className="px-2 py-1 text-slate-400">Debit Account:</td>
                            <td className="px-2 py-1 text-slate-800 font-mono">
                              {selected.form_data?.form?.purchaseAccountNo || selected.purchaseAccountNumber || "-"} 
                              <span className="ml-1 text-slate-500 font-sans font-semibold">
                                {selected.form_data?.form?.purchaseAccountName || selected.purchaseAccountName ? `(${selected.form_data?.form?.purchaseAccountName || selected.purchaseAccountName})` : ""}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="px-2 py-1 text-slate-400">Debit Amount:</td>
                            <td className="px-2 py-1 text-slate-800 font-mono font-bold text-emerald-600">
                              {totalUSDVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {purchaseCurrency} 
                              <span className="text-slate-400 font-medium px-1.5">@</span> 
                              <span className="text-blue-600">{exRate}</span> 
                              <span className="text-slate-400 font-medium px-1.5">=</span> 
                              {totalPKRVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {displayCurrency}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="px-2 py-1 text-slate-400">Credit Account:</td>
                            <td className="px-2 py-1 text-slate-800 font-mono">
                              {selected.form_data?.form?.salesAccountNo || selected.salesAccountNumber || "-"} 
                              <span className="ml-1 text-slate-500 font-sans font-semibold">
                                {selected.form_data?.form?.salesAccountName || selected.salesAccountName ? `(${selected.form_data?.form?.salesAccountName || selected.salesAccountName})` : ""}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="px-2 py-1 text-slate-400">Credit Amount:</td>
                            <td className="px-2 py-1 text-slate-800 font-mono font-bold text-emerald-600">
                              {totalUSDVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {purchaseCurrency} 
                              <span className="text-slate-400 font-medium px-1.5">@</span> 
                              <span className="text-blue-600">{exRate}</span> 
                              <span className="text-slate-400 font-medium px-1.5">=</span> 
                              {totalPKRVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {displayCurrency}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="px-2 py-1 text-slate-400">Total Quantity:</td>
                            <td className="px-2 py-1 text-slate-800 font-bold">{totalQty.toLocaleString()} {goodsEntries[0]?.qtyName || "Units"}</td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="px-2 py-1 text-slate-400">Net Weight:</td>
                            <td className="px-2 py-1 text-slate-800 font-mono">{totalNet.toLocaleString()} kg</td>
                          </tr>
                          <tr>
                            <td className="px-2 py-1 text-slate-400">Gross Weight:</td>
                            <td className="px-2 py-1 text-slate-800 font-mono">{totalGross.toLocaleString()} kg</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Document Remarks / Narration full-width block */}
                  {selected.form_data?.form?.showRemarksOnA4 !== false && (
                    <div className="border border-slate-200 rounded overflow-hidden mt-2.5">
                      <div className="bg-slate-50 border-b border-slate-200 px-2 py-1 text-[8px] font-black uppercase text-blue-900 flex items-center gap-1">
                        <span>📝</span> Remarks / Narration
                      </div>
                      <div className="p-2 bg-white text-[8px] font-semibold text-slate-800 italic leading-normal min-h-[30px] whitespace-pre-wrap break-words">
                        {remarksText}
                      </div>
                    </div>
                  )}

                  {/* Stamp & Signatures */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-auto text-[7.5px]">
                    <div className="w-[45%] text-slate-400 font-medium leading-relaxed">
                      This is a system generated print sheet of Demi Trading Co. accounts ledger. Double-entry transaction postings have been validated.
                    </div>
                    <div className="w-[12%] text-center">
                      {/* Stamp SVG */}
                      <svg viewBox="0 0 100 100" className="w-12 h-12 text-blue-900 mx-auto opacity-70">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
                        <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1" />
                        <path d="M50 15 A35 35 0 0 1 85 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M15 50 A35 35 0 0 1 50 15" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M50 85 A35 35 0 0 1 15 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M85 50 A35 35 0 0 1 50 85" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <text x="50" y="42" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="currentColor" letterSpacing="0.3">DEMI TRADING</text>
                        <text x="50" y="52" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">★ STAMP ★</text>
                        <text x="50" y="62" textAnchor="middle" fontSize="5.5" fontWeight="900" fill="currentColor" letterSpacing="0.3">{(selected.branchName || "MAIN BRANCH").toUpperCase()}</text>
                      </svg>
                    </div>
                    <div className="w-[18%] text-center border-t border-slate-300 pt-1">
                      <div className="font-bold text-slate-800 text-[8px] italic leading-none">{selected.audit?.userName || "ADMIN"}</div>
                      <div className="font-bold text-slate-400 text-[6.5px] mt-1">PREPARED BY</div>
                    </div>
                    <div className="w-[18%] text-center border-t border-slate-300 pt-1">
                      <div className="font-bold text-slate-800 text-[8px] italic leading-none">Branch Manager</div>
                      <div className="font-bold text-slate-400 text-[6.5px] mt-1">AUTHORIZED BY</div>
                    </div>
                  </div>

                  {/* Transfer Info */}
                  {selected.form_data?.form?.transferAudit && (
                    <div className="text-right text-[8px] font-bold text-blue-600 mt-2 border-t border-slate-200 pt-1.5">
                      Transferred to Purchase Transfer Payment by <span className="uppercase">{selected.form_data.form.transferAudit.userName}</span> on {new Date(selected.form_data.form.transferAudit.transferDate).toLocaleDateString()}
                    </div>
                  )}

                </div>
              </div>
            );
          })()}
        </DetailDrawer>
    </div>
  );
}

function ReportSection({ number, title, filters, actions, children }: { number: string; title: string; filters: React.ReactNode; actions: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-3 rounded-xl border border-slate-700 bg-[#0b1730] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-[280px] items-center gap-3">
          <span className="grid h-6 w-6 place-items-center rounded bg-blue-500 text-xs font-black text-white">{number}</span>
          <h2 className="text-sm font-black tracking-wide text-white md:text-base">{title}</h2>
        </div>
        <div className="grid flex-1 gap-2 md:grid-cols-3 xl:grid-cols-7">{filters}</div>
        {actions}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function DarkInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block min-w-[130px]">
      <span className="mb-1 block text-[10px] font-bold text-muted-foreground">{label}</span>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground outline-none ring-blue-500/30 placeholder:text-muted-foreground focus:border-blue-400 focus:ring-2"
          placeholder={label}
        />
        {type === "text" ? <Search className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" /> : <CalendarDays className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />}
      </div>
    </label>
  );
}

function DarkSelect({ label, value, options, placeholder, onChange, disabled }: { label: string; value: string; options: string[]; placeholder: string; onChange: (value: string) => void; disabled?: boolean }) {
  const formattedOptions = useMemo(() => {
    return [
      { label: placeholder, value: "" },
      ...options.map(opt => ({ label: opt || "Blank", value: opt }))
    ];
  }, [options, placeholder]);

  return (
    <label className="block min-w-[130px] relative z-[45]">
      <span className="mb-1 block text-[10px] font-bold text-muted-foreground">{label}</span>
      <SearchableSelect
        disabled={disabled}
        value={value}
        onChange={onChange}
        options={formattedOptions}
        placeholder={placeholder}
        className="w-full text-xs font-semibold"
      />
    </label>
  );
}

function FilterActions({ onApply, onReset }: { onApply: () => void; onReset: () => void }) {
  return (
    <div className="flex items-end gap-2">
      <Button type="button" size="sm" onClick={onApply} className="h-9 bg-blue-600 px-4 text-white hover:bg-blue-500">Apply</Button>
      <Button type="button" size="sm" variant="outline" onClick={onReset} className="h-9 px-4">Reset</Button>
    </div>
  );
}

function DashboardMetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: "blue" | "emerald" | "violet" | "amber" }) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-lg border ${toneClass}`}>{icon}</span>
        <span className="text-right text-[10px] font-black uppercase tracking-wide text-slate-400">KPI</span>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate text-lg font-black tabular-nums text-slate-950 dark:text-slate-100" title={String(value)}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-xs font-black tabular-nums ${danger ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`} title={String(value)}>{value}</p>
    </div>
  );
}

function DashboardInfoLine({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "success" | "danger" | "accent" }) {
  const toneClass = {
    default: "text-slate-950 dark:text-slate-100",
    success: "text-emerald-700 dark:text-emerald-300",
    danger: "text-rose-700 dark:text-rose-300",
    accent: "text-blue-700 dark:text-blue-300"
  }[tone];

  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/70 pb-1.5 text-[11px] last:border-b-0 dark:border-slate-800/70">
      <span className="font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`max-w-[58%] text-right font-black tabular-nums ${toneClass}`}>{value || "-"}</span>
    </div>
  );
}
function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: "blue" | "emerald" | "violet" | "amber" | "red" }) {
  const color = {
    blue: "text-blue-300 bg-blue-500/15 border-blue-400/30",
    emerald: "text-emerald-300 bg-emerald-500/15 border-emerald-400/30",
    violet: "text-violet-300 bg-violet-500/15 border-violet-400/30",
    amber: "text-amber-300 bg-amber-500/15 border-amber-400/30",
    red: "text-red-300 bg-red-500/15 border-red-400/30"
  }[accent];
  return (
    <div className="flex items-center gap-4 border-b border-r border-slate-700 p-4 last:border-r-0 md:border-b-0">
      <div className={`grid h-14 w-14 place-items-center rounded-xl border ${color}`}>{icon}</div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-1 text-2xl font-black text-white">{value}</div>
      </div>
    </div>
  );
}

function DarkTable({ headers, tableGroups, children }: { headers: string[]; tableGroups: {label: string, span: number, cls: string}[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm max-h-[calc(100vh-300px)] min-h-[420px]">
      <table className="w-max min-w-full border-collapse text-xs text-slate-800">
        <thead className="sticky top-0 z-10 border-b border-slate-200">
          {/* Group header row */}
          <tr>
            {tableGroups.map((group) => (
              <th
                key={group.label}
                colSpan={group.span}
                className={`${group.cls} px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-center border-r border-white/20 last:border-r-0`}
              >
                {group.label}
              </th>
            ))}
          </tr>
          {/* Column header row */}
          <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600">
            {headers.map((header, idx) => (
              <th key={`${header}-${idx}`} className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-left font-black last:border-r-0">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white text-slate-800 divide-y divide-slate-200">{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className = "", center = false, right = false, title, onClick }: { children: React.ReactNode; className?: string; center?: boolean; right?: boolean; title?: string; onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void }) {
  return <td onClick={onClick} title={title} className={`whitespace-nowrap border-r border-slate-200 px-3 py-2.5 last:border-r-0 ${center ? "text-center" : ""} ${right ? "text-right" : ""} ${className}`}>{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-black uppercase ${statusClass(status)}`}>{status || "Open"}</span>;
}

function ContainerStatus({ status }: { status: ContainerRow["status"] }) {
  const className = status === "Confirmed" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : status === "Cancelled" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-black uppercase ${className}`}>{status}</span>;
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 py-1.5 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`text-right font-bold ${highlight ? "text-amber-300" : "text-slate-100"}`}>{value || "-"}</span>
    </div>
  );
}

function MiniFinancial({ label, value, tone }: { label: string; value: string; tone: "blue" | "emerald" | "red" | "amber" }) {
  const className = {
    blue: "text-blue-300",
    emerald: "text-emerald-300",
    red: "text-red-300",
    amber: "text-amber-300"
  }[tone];
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-black ${className}`}>{value}</div>
    </div>
  );
}

function TableFooter({ text }: { text: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-2 text-xs text-muted-foreground">
      <span>{text}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="rounded border border-border bg-primary px-3 py-1 text-primary-foreground font-semibold">1</button>
        <button type="button" className="rounded border border-border bg-background px-3 py-1 text-foreground hover:bg-muted font-semibold transition">2</button>
        <button type="button" className="rounded border border-border bg-background px-3 py-1 text-foreground hover:bg-muted font-semibold transition">3</button>
      </div>
    </div>
  );
}




