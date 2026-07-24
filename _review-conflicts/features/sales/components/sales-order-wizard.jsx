"use client";
import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Download,
  Eye,
  FileText,
  Package,
  Printer,
  Search,
  Ship,
  Trash2,
  Lock,
  Building2,
  CheckCircle2,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  MoreVertical,
  Mail,
  MessageCircle,
  CheckSquare,
  FileSignature,
  Receipt,
  PenLine,
  Pin,
  Save,
  X,
  Globe2,
  BarChart3,
  Edit3,
  Settings,
  ListChecks,
  Truck,
  MessageSquare,
  Loader2,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomerPicker } from "@/features/customers/components/customer-picker";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { openTradeDocumentWindow } from "@/lib/reports/open-trade-document-window";
import { openSalesA4ReportWindow } from "@/lib/reports/open-sales-a4-report-window";
import { SalesBookingJournalReportView } from "./sales-booking-journal-report-view";

// Ã¢â€â‚¬Ã¢â€â‚¬ Non-location constants (static values, not from master forms) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const CURRENCY_OPTIONS = ["USD", "AED", "EUR", "GBP", "PKR", "AFN", "INR", "CNY", "SAR"];
const PAYMENT_TYPES = ["Advance Payment", "Invoice", "Final Payment", "Credit"];
const LOADING_TYPES = ["By Sea", "By Road", "By Air"];
const CONTAINER_TYPES = ["20 FT", "40 FT", "20 FT Reefer", "40 FT Reefer", "Reefer Container", "Non Reefer", "Open Top", "Flat Rack", "LCL / Bulk"];
const QTY_TYPE_OPTIONS = ["BAGS", "CARTONS", "Loose", "KGS", "Ton"];
const SIZE_OPTIONS = ["Large", "Medium", "Standard", "Small"];
const BRAND_OPTIONS = ["Premium", "Choice", "Organic", "Standard"];
const GOODS_OPTIONS = ["PISTACHIOS KERNEL", "CASHEW NUTS (W320)", "WALNUTS INSHELL", "ALMONDS", "HAZELNUTS"];
const GOODS_HS_CODES = {
  "PISTACHIOS KERNEL": "0802.51",
  "CASHEW NUTS (W320)": "0801.32",
  "WALNUTS INSHELL": "0802.31",
  "ALMONDS": "0802.12",
  "HAZELNUTS": "0802.22"
};

const SALE_SOURCE_OPTIONS = [
  { value: "booking", label: "Booking Sale", description: "Create a fresh sales booking from this order.", icon: FileText },
  { value: "in_transit", label: "In-Transit Lot", description: "Sell goods already loaded or on the route.", icon: Truck },
  { value: "local", label: "Local Purchase", description: "Sell goods purchased locally in this branch.", icon: Package },
  { value: "warehouse", label: "Warehouse Stock", description: "Sell stock currently available in warehouse.", icon: Building2 },
  { value: "endorse", label: "Endorse Stock", description: "Sell endorsed stock with traceable stock journal.", icon: ListChecks }
];

const MOCK_SALE_LOTS = [
  { lotNo: "BOOK-LOT-0001", source: "booking", goodsName: "CASHEW NUTS (W320)", brand: "Organic", size: "STANDARD", origin: "Pakistan", hsCode: "0801.32", qtyName: "BAGS", availableQty: 100, qtyKgs: 50, emptyKgs: 0.1, netWeight: 4990, location: "New Booking", stockRef: "SO-DRAFT", currencyType: "USD", exchangeRate: 1, coursePrice: 12.5, status: "Ready for booking" },
  { lotNo: "TRN-LOT-2401", source: "in_transit", goodsName: "PISTACHIOS KERNEL", brand: "Premium", size: "Large", origin: "Iran", hsCode: "0802.51", qtyName: "BAGS", availableQty: 2000, qtyKgs: 50, emptyKgs: 0.1, netWeight: 99800, location: "In Transit - Karachi Port", stockRef: "LOAD-000241", currencyType: "USD", exchangeRate: 278, coursePrice: 8.75, status: "Loaded / On route" },
  { lotNo: "LOC-LOT-1022", source: "local", goodsName: "ALMONDS", brand: "Choice", size: "Medium", origin: "Pakistan", hsCode: "0802.12", qtyName: "BAGS", availableQty: 500, qtyKgs: 25, emptyKgs: 0.05, netWeight: 12475, location: "Local Purchase Stock", stockRef: "LP-001022", currencyType: "PKR", exchangeRate: 1, coursePrice: 950, status: "Local stock" },
  { lotNo: "WH-LOT-7788", source: "warehouse", goodsName: "WALNUTS INSHELL", brand: "Standard", size: "Large", origin: "Afghanistan", hsCode: "0802.31", qtyName: "BAGS", availableQty: 1250, qtyKgs: 40, emptyKgs: 0.08, netWeight: 49900, location: "Main Warehouse", stockRef: "WH-007788", currencyType: "USD", exchangeRate: 278, coursePrice: 6.2, status: "Warehouse available" },
  { lotNo: "END-LOT-4500", source: "endorse", goodsName: "HAZELNUTS", brand: "Choice", size: "Standard", origin: "Turkey", hsCode: "0802.22", qtyName: "BAGS", availableQty: 750, qtyKgs: 30, emptyKgs: 0.05, netWeight: 22462.5, location: "Endorse Stock", stockRef: "END-004500", currencyType: "USD", exchangeRate: 278, coursePrice: 7.4, status: "Endorsed / sellable" }
];

const MOCK_LOT_DEDUCTIONS = {
  "BOOK-LOT-0001": [
    { customer: "Kharadar Customer A/C", date: "2026-07-10", quantity: 20, weight: 1000, reference: "SO-2026-1102" },
    { customer: "Sharjah Supply A/C", date: "2026-07-12", quantity: 10, weight: 500, reference: "SO-2026-1215" }
  ],
  "TRN-LOT-2401": [
    { customer: "Dubai Customer A/C", date: "2026-07-05", quantity: 300, weight: 15000, reference: "SO-2026-0504" },
    { customer: "Mumbai Import A/C", date: "2026-07-15", quantity: 150, weight: 7500, reference: "SO-2026-0881" }
  ],
  "LOC-LOT-1022": [
    { customer: "Kharadar Customer A/C", date: "2026-07-01", quantity: 50, weight: 1250, reference: "SO-2026-0331" }
  ],
  "WH-LOT-7788": [
    { customer: "Dubai Customer A/C", date: "2026-06-20", quantity: 100, weight: 4000, reference: "SO-2026-0045" },
    { customer: "Kabul Trading A/C", date: "2026-07-18", quantity: 50, weight: 2000, reference: "SO-2026-0922" }
  ],
  "END-LOT-4500": [
    { customer: "Sharjah Supply A/C", date: "2026-07-14", quantity: 80, weight: 2400, reference: "SO-2026-1044" }
  ]
};
// NOTE: COUNTRY_OPTIONS and ORIGIN_OPTIONS removed Ã¢â‚¬â€ countries now come from Location Master.

const MOCK_ACCOUNTS = [
  { accountCode: "AE-AC-0001", accountName: "Dubai Customer Account", cityBranchName: "Dubai Main Branch", ledgerCurrency: "AED" },
  { accountCode: "SA-2001", accountName: "Damaan Sales Account", cityBranchName: "Dubai Sales Branch", ledgerCurrency: "AED" },
  { accountCode: "US-AC-1002", accountName: "US Vendor Ledger Account", cityBranchName: "New York Branch", ledgerCurrency: "USD" },
  { accountCode: "PK-AC-3001", accountName: "Kharadar Customer Account", cityBranchName: "Karachi Central Branch", ledgerCurrency: "PKR" },
  { accountCode: "AF-AC-4001", accountName: "Kabul Trading Account", cityBranchName: "Kabul Main Branch", ledgerCurrency: "AFN" },
  { accountCode: "AE-AC-0002", accountName: "Sharjah Supply Account", cityBranchName: "Sharjah Branch", ledgerCurrency: "AED" },
  { accountCode: "IN-AC-5001", accountName: "Mumbai Import Account", cityBranchName: "Mumbai Port Branch", ledgerCurrency: "INR" }
];

// API Helpers
async function lookupAccountMaster(query, countryId, countryBranchId, cityBranchId, isSuperAdmin) {
  const needle = String(query || "").trim();
  if (!needle) return null;

  const params = new URLSearchParams();
  params.set("q", needle);
  params.set("limit", "500");
  if (countryId) params.set("countryId", countryId);
  if (countryBranchId) params.set("countryBranchId", countryBranchId);
  if (cityBranchId) params.set("cityBranchId", cityBranchId);

  const response = await fetch(`/api/erp/accounting/accounts/lookup?${params.toString()}`, {
    credentials: "same-origin"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload?.error?.message || payload?.error || "Account lookup failed.");
  }
  return payload.data?.found ? payload.data.account : null;
}

async function lookupSalesBookingReport(query, countryId, countryBranchId, cityBranchId, isSuperAdmin) {
  const needle = String(query || "").trim();
  if (!needle) return null;

  const params = new URLSearchParams();
  params.set("salesOrderNo", needle);
  params.set("limit", "1");
  if (!isSuperAdmin) {
    if (countryId) params.set("countryId", countryId);
    if (countryBranchId) params.set("countryBranchId", countryBranchId);
    if (cityBranchId) params.set("cityBranchId", cityBranchId);
  }

  const response = await fetch(`/api/erp/sales/booking-journal-report?${params.toString()}`, {
    credentials: "same-origin"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload?.error?.message || payload?.error || "Sales Booking lookup failed.");
  }
  return payload.data?.reports?.[0] ?? null;
}

const DEFAULT_FORM = {
  countryId: "",
  countryBranchId: "",
  cityBranchId: "",
  customerAccountNo: "",
  customerAccountName: "",
  customerAccountBranch: "",
  customerAccountCurrency: "",
  customerAccountKind: "",
  customerAccountIsControl: false,
  customerAccountCurrentBalance: 0,
  customerAccountOpeningBalance: 0,
  customerAccountStatus: "active",
  customerAccountSerialNumber: "",
  customerAccountCountrySerialNumber: "",
  customerAccountBranchSerialNumber: "",
  customerAccountManualReferenceNumber: "",
  customerAccountMobile: "",
  customerAccountWhatsapp: "",
  salesAccountNo: "",
  salesAccountName: "",
  salesAccountBranch: "",
  salesAccountCurrency: "",
  salesAccountKind: "",
  salesAccountIsControl: false,
  salesAccountCurrentBalance: 0,
  salesAccountOpeningBalance: 0,
  salesAccountStatus: "active",
  salesAccountSerialNumber: "",
  salesAccountCountrySerialNumber: "",
  salesAccountBranchSerialNumber: "",
  salesAccountManualReferenceNumber: "",
  salesAccountMobile: "",
  salesAccountWhatsapp: "",
  salesOrderNo: "",
  salesContractNo: "",
  salesOrderNo: "",
  billNo: "",
  salesDate: new Date().toISOString().slice(0, 10),
  currencyType: "USD",
  salesCurrency: "USD",
  exchangeRate: 1,
  branchName: "Kabul Main Branch",
  branchCode: "BR-KBL-001",
  branchCity: "Kabul",
  branchCountry: "Afghanistan",
  userName: "ADMIN",
  userId: "USR-1001",
  paymentType: "Advance Payment",
  shipmentType: "By Ship",
  shippingMode: "By Sea",
  customerId: "",
  customerName: "",
  customerId: "",
  customerName: "",
  salesStatus: "Draft",
  remarks: "",
  paymentReport: "",
  loadingReport: "",
  orderReportRemarks: "",
  salesReportRemarks: "",
  salesInvoiceRemarks: "",
  showRemarksOnA4: true,

  // Tab 3 details
  advancePercent: 10,
  advancePaymentDate: new Date().toISOString().slice(0, 10),
  paymentDate: new Date().toISOString().slice(0, 10),
  paymentDaysAndMethodDetails: "",
  loadingCountry: "",
  loadingPort: "",
  loadingDate: "",
  receivedCountry: "",
  receivedPort: "",
  receivedDate: "",
  loadingBorder: "",
  receivedBorder: "",
  airportName: "",
  receivedPortName: "",
  transportAgent: "",
  airlineName: "",
  receivedAgentName: "",
  containerCount: 1,
  containerSize: "40 FT",
  containerNumbers: "",
  vesselName: "",
  sealNumber: "",

  // Step 2 Active Item inputs
  saleSource: "booking",
  stockLotNo: "",
  goodsName: "",
  size: "",
  brand: "",
  origin: "",
  hsCode: "",
  allotName: "",
  qtyName: "BAGS",
  qtyNo: 100,
  qtyKgs: 50.00,
  emptyKgs: 0.10,
  netWeight: 4990.00,
  divideType: "D/KGs",
  divideWeight: 1.0,
  priceType: "P/KGs",
  coursePrice: 12.50,
  secondaryCurrency: "PKR",
  rate2: 280.00,
  operator: "*",
  qualityReport: "Passed"
};

// Seeded rows matching user's mock screenshots
const SEEDED_GOODS = [
  {
    allotName: "ALT-4421",
    goodsName: "PISTACHIOS KERNEL",
    size: "Large",
    brand: "Premium",
    origin: "Iran",
    hsCode: "0802.51",
    qtyName: "BAGS",
    qtyNo: 100,
    qtyKgs: 50.00,
    grossWeight: 5000.00,
    emptyKgs: 0.10,
    netWeight: 4990.00,
    priceType: "P/KGs",
    divideType: "D/KGs",
    divideWeight: 1,
    coursePrice: 12.50,
    currencyType: "USD",
    exchangeRate: 280.00,
    totalAmount: 62375.00,
    op: "*",
    finalAmount: 17465000.00
  },
  {
    allotName: "ALT-4422",
    goodsName: "CASHEW NUTS (W320)",
    size: "Medium",
    brand: "Choice",
    origin: "Vietnam",
    hsCode: "0801.32",
    qtyName: "CARTONS",
    qtyNo: 50,
    qtyKgs: 22.68,
    grossWeight: 1134.00,
    emptyKgs: 0.10,
    netWeight: 1129.00,
    priceType: "P/KGs",
    divideType: "D/KGs",
    divideWeight: 1,
    coursePrice: 8.75,
    currencyType: "USD",
    exchangeRate: 280.00,
    totalAmount: 9878.75,
    op: "*",
    finalAmount: 2766050.00
  },
  {
    allotName: "ALT-4423",
    goodsName: "WALNUTS INSHELL",
    size: "Standard",
    brand: "Organic",
    origin: "USA",
    hsCode: "0802.31",
    qtyName: "BAGS",
    qtyNo: 200,
    qtyKgs: 25.00,
    grossWeight: 5000.00,
    emptyKgs: 0.10,
    netWeight: 4980.00,
    priceType: "P/KGs",
    divideType: "D/KGs",
    divideWeight: 1,
    coursePrice: 6.50,
    currencyType: "USD",
    exchangeRate: 280.00,
    totalAmount: 32370.00,
    op: "*",
    finalAmount: 9063600.00
  }
];

function calculateItemTotals(form) {
  const qtyNo = Number(form.qtyNo || 0);
  const qtyKgs = Number(form.qtyKgs || 0);
  const emptyKgs = Number(form.emptyKgs || 0);
  const coursePrice = Number(form.coursePrice || 0);
  const divideWeight = Number(form.divideWeight || 1);
  const exchangeRate = Number(form.exchangeRate || 1);
  const operator = form.operator || "*";

  const grossWeight = qtyNo * qtyKgs;
  const totalEmptyDeduct = qtyNo * emptyKgs;
  const netWeight = form.netWeight !== undefined && form.netWeight !== "" && form.netWeight !== 0
    ? Number(form.netWeight)
    : Math.max(0, grossWeight - totalEmptyDeduct);

  // Amount in Purchase Currency (Original Amount)
  const originalAmount = (netWeight / divideWeight) * coursePrice;

  // Amount in Local Country Currency
  let localAmount = 0;
  if (operator === "/") {
    localAmount = exchangeRate !== 0 ? originalAmount / exchangeRate : 0;
  } else {
    localAmount = originalAmount * exchangeRate;
  }

  return {
    grossWeight,
    netWeight,
    totalAmount: originalAmount, // Total in Purchase Currency
    finalAmount: localAmount,    // Total in Local Currency
    baseAmount: originalAmount,
    localAmount: localAmount
  };
}

function currencySymbol(currency) {
  const c = String(currency || "").toUpperCase();
  if (c.includes("USD")) return "$";
  if (c.includes("AED")) return "DH";
  if (c.includes("PKR")) return "Ã¢â€šÂ¨";
  if (c.includes("AFN")) return "Ã˜â€¹";
  if (c.includes("INR")) return "Ã¢â€šÂ¹";
  return currency || "";
}

function formatShortDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatIsoDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 10);
  } catch {
    return dateStr;
  }
}

function formatNumber(num) {
  if (num === null || num === undefined) return "-";
  return Number(num).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function LightTable({ headers, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-xs text-slate-800">
        <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-wide text-slate-650 border-b border-slate-200">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="whitespace-nowrap border-r border-slate-200 px-3 py-3 text-left font-black last:border-r-0"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white text-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

function LightTd({ children, className = "", center = false, right = false }) {
  return (
    <td
      className={`whitespace-nowrap border-r border-slate-200 px-3 py-2.5 last:border-r-0 ${
        center ? "text-center" : ""
      } ${right ? "text-right" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

function LightStatusBadge({ status }) {
  const s = String(status || "Open").toLowerCase();
  let badgeClass = "bg-slate-100 text-slate-700 border-slate-205";
  if (s.includes("confirm")) {
    badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-250";
  } else if (s.includes("cancel")) {
    badgeClass = "bg-rose-50 text-rose-700 border-rose-250";
  } else if (s.includes("open") || s.includes("draft")) {
    badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
  }
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[9px] font-black uppercase ${badgeClass}`}>
      {status || "Open"}
    </span>
  );
}

export function SalesOrderWizard({ session }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("booking"); // "booking" | "goods" | "others" | "reports"
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined" && window.location.pathname.includes("new-")) {
      setIsFormOpen(true);
    }
  }, []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [isTransferred, setIsTransferred] = useState(false);
  const [transferredData, setTransferredData] = useState(null);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [verifyDropdownOpen, setVerifyDropdownOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [transferConfirmModal, setTransferConfirmModal] = useState(false);
  const [showTransferScreen, setShowTransferScreen] = useState(false);
  const [isVerificationSidebarOpen, setIsVerificationSidebarOpen] = useState(false);
  const [previewType, setPreviewType] = useState("booking_report"); // "booking_report" | "contract" | "invoice"
  const [form, setForm] = useState(() => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return {
      ...DEFAULT_FORM,
      salesOrderNo: `PO-2026-${randomSuffix}`,
      salesOrderNo: `SO-2026-${randomSuffix}`,
      salesContractNo: `PC-2026-${randomSuffix}`,
      billNo: `BILL-${randomSuffix}`,
    };
  });
  const [goodsEntries, setGoodsEntries] = useState([]);
  const [lotPanelOpen, setLotPanelOpen] = useState(false);
  const [lotSearch, setLotSearch] = useState("");
  const [checkedLotNo, setCheckedLotNo] = useState(null);

  const selectedSaleSource = useMemo(() => {
    return SALE_SOURCE_OPTIONS.find((option) => option.value === (form.saleSource || "booking")) || SALE_SOURCE_OPTIONS[0];
  }, [form.saleSource]);

  const availableSaleLots = useMemo(() => {
    return MOCK_SALE_LOTS.filter((lot) => lot.source === (form.saleSource || "booking"));
  }, [form.saleSource]);

  const filteredSaleLots = useMemo(() => {
    const needle = lotSearch.trim().toLowerCase();
    if (!needle) return availableSaleLots;
    return availableSaleLots.filter((lot) => [lot.lotNo, lot.goodsName, lot.location, lot.stockRef, lot.status].join(" ").toLowerCase().includes(needle));
  }, [availableSaleLots, lotSearch]);

  const selectedSaleLot = useMemo(() => {
    return MOCK_SALE_LOTS.find((lot) => lot.lotNo === form.stockLotNo) || null;
  }, [form.stockLotNo]);

  const openSaleSource = (sourceValue) => {
    setForm((prev) => ({ ...prev, saleSource: sourceValue, stockLotNo: "" }));
    setLotSearch("");
    setLotPanelOpen(true);
  };

  const applySaleLot = (lot) => {
    setForm((prev) => ({
      ...prev,
      saleSource: lot.source,
      stockLotNo: lot.lotNo,
      allotName: lot.lotNo,
      goodsName: lot.goodsName,
      brand: lot.brand,
      size: lot.size,
      origin: lot.origin,
      hsCode: lot.hsCode,
      qtyName: lot.qtyName,
      qtyNo: lot.availableQty,
      qtyKgs: lot.qtyKgs,
      emptyKgs: lot.emptyKgs,
      netWeight: lot.netWeight,
      currencyType: lot.currencyType,
      salesCurrency: lot.currencyType,
      exchangeRate: lot.exchangeRate,
      coursePrice: lot.coursePrice,
      manualTotalAmount: "",
      manualFinalAmount: ""
    }));
    setLotPanelOpen(false);
  };
  const [selectedLotId, setSelectedLotId] = useState("");
  const [isLotModalOpen, setIsLotModalOpen] = useState(false);
  const [editingRemarksType, setEditingRemarksType] = useState(null);
  const [tempRemarksText, setTempRemarksText] = useState("");
  const [reportType, setReportType] = useState("branch"); // "branch" | "totaling" | "payment"
  const [previewRemarks, setPreviewRemarks] = useState(false);
  const [branchPinOpen, setBranchPinOpen] = useState(false);
  // Dynamic Reports System
  const [reportsList, setReportsList] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);
  const [newReportForm, setNewReportForm] = useState({ name: "", description: "", notes: "" });

  const previewItems = useMemo(() => {
    return goodsEntries.map((g, index) => {
      const qtyNo = Number(g.qtyNo || 0);
      const qtyKgs = Number(g.qtyKgs || 0);
      const emptyKgs = Number(g.emptyKgs || 0);
      const grossWt = qtyNo * qtyKgs;
      const netWt = qtyNo * (qtyKgs - emptyKgs);
      const rateKg = Number(g.coursePrice || 0);
      const rateTon = rateKg * 1000;
      const amountUsd = Number(g.totalAmount || 0);
      const finalAmountPkr = Number(g.finalAmount || 0);
      return {
        srNo: index + 1,
        goodsName: g.goodsName || "N/A",
        allotName: g.allotName || "N/A",
        grade: g.size || "N/A",
        origin: g.origin || "N/A",
        quantity: `${qtyNo.toLocaleString()} ${g.qtyName || "BAGS"}`,
        packing: `${qtyKgs} KG / ${emptyKgs} KG`,
        grossWt,
        netWt,
        rateKg,
        rateTon,
        amountUsd,
        exRate: g.exchangeRate || 1.00,
        finalAmountPkr
      };
    });
  }, [goodsEntries]);

  const avgRateKg = useMemo(() => {
    return goodsEntries.length > 0
      ? goodsEntries.reduce((sum, item) => sum + (Number(item.coursePrice) || 0), 0) / goodsEntries.length
      : 0;
  }, [goodsEntries]);

  const avgRateTon = useMemo(() => avgRateKg * 1000, [avgRateKg]);


  const [titlePortal, setTitlePortal] = useState(null);
  const [actionsPortal, setActionsPortal] = useState(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      setTitlePortal(document.getElementById("erp-page-title-slot"));
      setActionsPortal(document.getElementById("erp-page-actions-slot"));
    }
  }, []);

  const [savingOrder, setSavingOrder] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedOrderId, setSavedOrderId] = useState("");
  const [savedOrderNo, setSavedOrderNo] = useState("");
  const [registerRefreshKey, setRegisterRefreshKey] = useState(0);
  const [accountLookupMessage, setAccountLookupMessage] = useState("");
  const [accountLookupLoading, setAccountLookupLoading] = useState(null);

  const dropdownRef = React.useRef(null);
  const customerDropdownRef = React.useRef(null);
  const salesDropdownRef = React.useRef(null);
  const verifyDropdownRef = React.useRef(null);
  const companyDropdownRef = React.useRef(null);
  const salesCompanyDropdownRef = React.useRef(null);

  const [customerDropdownOpen, setPurchaseDropdownOpen] = useState(false);
  const [salesDropdownOpen, setSalesDropdownOpen] = useState(false);
  const [customerSearch, setPurchaseSearch] = useState("");
  const [salesSearch, setSalesSearch] = useState("");

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setViewDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setPurchaseDropdownOpen(false);
        setPurchasePinDropdownOpen(false);
      }
      if (salesDropdownRef.current && !salesDropdownRef.current.contains(event.target)) {
        setSalesDropdownOpen(false);
        setSalesPinDropdownOpen(false);
      }
      if (verifyDropdownRef.current && !verifyDropdownRef.current.contains(event.target)) {
        setVerifyDropdownOpen(false);
      }
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target)) {
        setPurchaseCompanySelectOpen(false);
      }
      if (salesCompanyDropdownRef.current && !salesCompanyDropdownRef.current.contains(event.target)) {
        setSalesCompanySelectOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Scoping States
  const [localSession, setLocalSession] = useState(session || null);
  const activeSession = session || localSession;
  const isSuperAdmin = activeSession?.isSuperAdmin || activeSession?.scopes?.isSuperAdmin || false;
  const isCountryAdmin = activeSession?.roles?.includes("country_admin") || activeSession?.scopes?.isCountryAdmin || (activeSession?.countryIds?.length > 0) || (activeSession?.scopes?.countryIds?.length > 0) || false;
  const [countries, setCountries] = useState([]);
  const [allCountries, setAllCountries] = useState([]); // unscoped Ã¢â‚¬â€ for transit pickers
  const [dbGoods, setDbGoods] = useState([]); // goods from master DB
  const [dbLoadingPorts, setDbLoadingPorts] = useState([]);
  const [dbReceivedPorts, setDbReceivedPorts] = useState([]);
  const [mainBranches, setMainBranches] = useState([]);
  const [cityBranches, setCityBranches] = useState([]);
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const [dbAccounts, setDbAccounts] = useState([]);
  const [customQtyNames, setCustomQtyNames] = useState([]);

  const mapEnterpriseAccount = (acc) => ({
    accountCode: acc.code || acc.account_number || "",
    accountName: acc.name || "",
    cityBranchName: acc.branch_code || acc.branch_name || "",
    ledgerCurrency: acc.currency || "USD",
    customerId: acc.customer_id || acc.customerId || acc.id || null,
    companyId: acc.company_id || acc.companyId || null,
    companyName: acc.company_name || acc.companyName || acc.company?.name || "",
    mobile: acc.customers?.mobile || acc.mobile || "",
    whatsapp: acc.customers?.whatsapp || acc.whatsapp || "",
    kind: acc.kind || "",
    isControlAccount: acc.is_control_account || false,
    currentBalance: acc.current_balance || 0,
    openingBalance: acc.opening_balance || 0,
    status: acc.status || "active",
    accountSerialNumber: acc.account_serial_number || "",
    countrySerialNumber: acc.country_serial_number || "",
    branchSerialNumber: acc.branch_serial_number || "",
    manualReferenceNumber: acc.manual_reference_number || "",
    customerNumber: acc.customer_number || "",
    countryId: acc.country_id || null,
    countryBranchId: acc.country_branch_id || null,
    cityBranchId: acc.city_branch_id || null
  });

  const [sellerDetail, setSellerDetail] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const isSubmittingRef = React.useRef(false);
  const currentItemTotals = useMemo(() => calculateItemTotals(form), [form]);

  const masterCountryOptions = useMemo(() => {
    const list = allCountries.length > 0 ? allCountries : countries;
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allCountries, countries]);

  const transitCountryOptions = masterCountryOptions;

  // Fully dynamic, database-driven dependent dropdown logic for Loading Ports
  const currentLoadingPorts = useMemo(() => {
    let ports = dbLoadingPorts;
    if (form.loadingCountry) {
      const targetCountry = (form.loadingCountry || "").trim().toLowerCase();
      ports = ports.filter(p => (p.country?.name || "").trim().toLowerCase() === targetCountry || (p.country_name || "").trim().toLowerCase() === targetCountry);
    }
    const mode = form.shippingMode || "By Sea";
    if (mode === "By Road") {
      return ports.filter(p => p.transport_type === "road");
    } else if (mode === "By Air") {
      return ports.filter(p => p.transport_type === "air");
    } else if (mode === "By Sea") {
      return ports.filter(p => p.transport_type === "sea");
    }
    return ports;
  }, [dbLoadingPorts, form.loadingCountry, form.shippingMode]);

  // Fully dynamic, database-driven dependent dropdown logic for Receiving Ports
  const currentReceivedPorts = useMemo(() => {
    let ports = dbReceivedPorts;
    const recCountry = form.receivingCountry || form.receivedCountry || form.destinationCountry || "";
    if (recCountry) {
      const targetCountry = recCountry.trim().toLowerCase();
      ports = ports.filter(p => (p.country?.name || "").trim().toLowerCase() === targetCountry || (p.country_name || "").trim().toLowerCase() === targetCountry);
    }
    const mode = form.shippingMode || "By Sea";
    if (mode === "By Road") {
      return ports.filter(p => p.transport_type === "road");
    } else if (mode === "By Air") {
      return ports.filter(p => p.transport_type === "air");
    } else if (mode === "By Sea") {
      return ports.filter(p => p.transport_type === "sea");
    }
    return ports;
  }, [dbReceivedPorts, form.receivingCountry, form.receivedCountry, form.destinationCountry, form.shippingMode]);

  const reportTotals = useMemo(() => {
    const totalGross = goodsEntries.reduce((sum, item) => sum + Number(item.grossWeight || 0), 0);
    const totalNet = goodsEntries.reduce((sum, item) => sum + Number(item.netWeight || 0), 0);
    const grandFinal = goodsEntries.reduce((sum, item) => sum + Number(item.finalAmount || 0), 0);
    const grandPrimaryFinal = goodsEntries.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const totalQty = goodsEntries.reduce((sum, item) => sum + Number(item.qtyNo || 0), 0);
    const totalDeductions = goodsEntries.reduce((sum, item) => sum + Number((item.qtyNo * item.emptyKgs) || 0), 0);
    return {
      totalGross,
      totalNet,
      grandFinal,
      grandPrimaryFinal,
      totalQty,
      totalDeductions
    };
  }, [goodsEntries]);

  const accountMatchesSearch = (acc, term) => {
    const q = String(term || "").trim().toLowerCase();
    if (!q) return true;
    return [
      acc.accountCode,
      acc.accountName,
      acc.cityBranchName,
      acc.ledgerCurrency,
      acc.manualReferenceNumber,
      acc.customerNumber,
      acc.mobile,
      acc.whatsapp
    ].some(v => String(v || "").toLowerCase().includes(q));
  };

  const accountMatchesScope = (acc) => {
    if (isSuperAdmin) {
      if (form.cityBranchId) return acc.cityBranchId === form.cityBranchId;
      if (form.countryBranchId) return acc.countryBranchId === form.countryBranchId;
      if (form.countryId) return acc.countryId === form.countryId;
      return true;
    }
    const allowedCountries = activeSession?.countryIds || activeSession?.scopes?.countryIds || [];
    const allowedBranches = activeSession?.countryBranchIds || activeSession?.scopes?.countryBranchIds || [];
    const allowedCities = activeSession?.cityBranchIds || activeSession?.scopes?.cityBranchIds || [];

    if (allowedCities.length > 0) return allowedCities.includes(acc.cityBranchId);
    if (allowedBranches.length > 0) return allowedBranches.includes(acc.countryBranchId);
    if (allowedCountries.length > 0) return allowedCountries.includes(acc.countryId);
    return true;
  };

  const formatAccountDisplayLabel = (name, code, manualRef) => {
    if (manualRef) return `${name} (Manual A/C: ${manualRef})`;
    if (code) return `${name} (${code})`;
    return name;
  };

  const applyAccountMaster = (type, account) => {
    if (!account) return;
    const accountNo = account.accountCode || account.rawAccountCode || account.ledgerCode || account.code || "";

    const richAccount = dbAccounts.find(
      (a) => (a.accountCode || "").trim().toLowerCase() === accountNo.trim().toLowerCase()
    ) || account;

    const accountName = richAccount.accountName || richAccount.ledgerName || richAccount.name || "";
    const branchName = richAccount.cityBranchName || richAccount.countryBranchName || richAccount.branch_code || "";
    const currency = (richAccount.ledgerCurrency || richAccount.currency || "").toUpperCase();
    const companyId = richAccount.companyId || richAccount.company_id || null;

    let matchedComp = null;
    if (companyId && dbCompanies.length > 0) {
      matchedComp = dbCompanies.find(c => c.id === companyId);
    }
    let cName = matchedComp?.name || richAccount.companyName || richAccount.company_name || "";
    if (!cName && dbCompanies.length > 0) {
      cName = dbCompanies[0]?.name || "";
    }
    const cCode = cName ? "COM-" + cName.slice(0, 3).toUpperCase() : "";
    const resolvedCompId = matchedComp?.id || companyId || (dbCompanies.length > 0 ? dbCompanies[0].id : null);
    const entityId = richAccount.customerId || richAccount.customer_id || richAccount.id || accountNo;

    setForm((prev) => ({
      ...prev,
      ...(type === "purchase"
        ? {
            customerAccountNo: accountNo,
            customerAccountName: accountName,
            customerAccountBranch: branchName,
            customerAccountCurrency: currency || prev.customerAccountCurrency || prev.salesCurrency || prev.secondaryCurrency || "PKR",
            salesCurrency: currency || prev.salesCurrency || prev.secondaryCurrency || "PKR",
            customerId: entityId,
            customerAccountLedgerId: entityId,
            customerName: accountName || prev.customerName,
            salesCompanyId: resolvedCompId,
            salesCompanyName: cName,
            salesCompanyCode: cCode,
            customerAccountKind: richAccount.kind || richAccount.accountKind || "",
            customerAccountIsControl: richAccount.isControlAccount ?? richAccount.is_control_account ?? false,
            customerAccountCurrentBalance: richAccount.currentBalance ?? richAccount.current_balance ?? 0,
            customerAccountOpeningBalance: richAccount.openingBalance ?? richAccount.opening_balance ?? 0,
            customerAccountStatus: richAccount.status || "active",
            customerAccountSerialNumber: richAccount.accountSerialNumber ?? richAccount.account_serial_number ?? "",
            customerAccountCountrySerialNumber: richAccount.countrySerialNumber ?? richAccount.country_serial_number ?? "",
            customerAccountBranchSerialNumber: richAccount.branchSerialNumber ?? richAccount.branch_serial_number ?? "",
            customerAccountManualReferenceNumber: richAccount.manualReferenceNumber ?? richAccount.manual_reference_number ?? "",
            customerAccountMobile: richAccount.mobile ?? richAccount.customers?.mobile ?? "",
            customerAccountWhatsapp: richAccount.whatsapp ?? richAccount.customers?.whatsapp ?? "",
          }
        : {
            salesAccountNo: accountNo,
            salesAccountName: accountName,
            salesAccountBranch: branchName,
            salesAccountCurrency: currency || prev.salesAccountCurrency || prev.salesCurrency || prev.secondaryCurrency || "PKR",
            salesAccountLedgerId: entityId,
            salesCompanyId: resolvedCompId,
            salesCompanyName: cName,
            salesCompanyCode: cCode,
            salesAccountKind: richAccount.kind || richAccount.accountKind || "",
            salesAccountIsControl: richAccount.isControlAccount ?? richAccount.is_control_account ?? false,
            salesAccountCurrentBalance: richAccount.currentBalance ?? richAccount.current_balance ?? 0,
            salesAccountOpeningBalance: richAccount.openingBalance ?? richAccount.opening_balance ?? 0,
            salesAccountStatus: richAccount.status || "active",
            salesAccountSerialNumber: richAccount.accountSerialNumber ?? richAccount.account_serial_number ?? "",
            salesAccountCountrySerialNumber: richAccount.countrySerialNumber ?? richAccount.country_serial_number ?? "",
            salesAccountBranchSerialNumber: richAccount.branchSerialNumber ?? richAccount.branch_serial_number ?? "",
            salesAccountManualReferenceNumber: richAccount.manualReferenceNumber ?? richAccount.manual_reference_number ?? "",
            salesAccountMobile: richAccount.mobile ?? richAccount.customers?.mobile ?? "",
            salesAccountWhatsapp: richAccount.whatsapp ?? richAccount.customers?.whatsapp ?? "",
          })
    }));

    if (type === "purchase") {
      setPurchaseSearch("");
    } else {
      setSalesSearch("");
    }
  };

  const lookupTimers = React.useRef({ purchase: null, sales: null });

  const triggerBackgroundLookup = async (type, query) => {
    if (!query || query.trim().length < 2) return;
    try {
      const account = await lookupAccountMaster(query, form.countryId, form.countryBranchId, form.cityBranchId, isSuperAdmin);
      if (account) {
        applyAccountMaster(type, account);
      }
    } catch (err) {
      console.error("Background lookup failed:", err);
    }
  };

  const handleTextChange = (type, val) => {
    if (type === "purchase") {
      setPurchaseSearch(val);
      setPurchaseDropdownOpen(true);
      if (!val.trim()) {
        setForm((prev) => ({
          ...prev,
          customerAccountNo: "",
          customerAccountName: "",
          customerAccountBranch: "",
          customerAccountCurrency: "",
          customerAccountKind: "",
          customerAccountIsControl: false,
          customerAccountCurrentBalance: 0,
          customerAccountOpeningBalance: 0,
          customerAccountStatus: "active",
          customerAccountSerialNumber: "",
          customerAccountCountrySerialNumber: "",
          customerAccountBranchSerialNumber: "",
          customerAccountManualReferenceNumber: "",
          customerAccountMobile: "",
          customerAccountWhatsapp: "",
        }));
      }
    } else if (type === "sales") {
      setSalesSearch(val);
      setSalesDropdownOpen(true);
      if (!val.trim()) {
        setForm((prev) => ({
          ...prev,
          salesAccountNo: "",
          salesAccountName: "",
          salesAccountBranch: "",
          salesAccountCurrency: "",
          salesAccountKind: "",
          salesAccountIsControl: false,
          salesAccountCurrentBalance: 0,
          salesAccountOpeningBalance: 0,
          salesAccountStatus: "active",
          salesAccountSerialNumber: "",
          salesAccountCountrySerialNumber: "",
          salesAccountBranchSerialNumber: "",
          salesAccountManualReferenceNumber: "",
          salesAccountMobile: "",
          salesAccountWhatsapp: "",
        }));
      }
    } else {
      setValue(type, val);
    }

    const matched = dbAccounts.find(acc =>
      accountMatchesScope(acc) && (
        (acc.accountCode || "").trim().toLowerCase() === val.trim().toLowerCase() ||
        (acc.manualReferenceNumber || "").trim().toLowerCase() === val.trim().toLowerCase() ||
        (acc.customerNumber || "").trim().toLowerCase() === val.trim().toLowerCase() ||
        (acc.accountName || "").trim().toLowerCase() === val.trim().toLowerCase()
      )
    );

    if (matched) {
      applyAccountMaster(type, matched);
    } else {
      if (lookupTimers.current[type]) {
        clearTimeout(lookupTimers.current[type]);
      }
      lookupTimers.current[type] = setTimeout(() => {
        triggerBackgroundLookup(type, val);
      }, 500);
    }
  };

  const handleAccountLookup = async (type) => {
    const query = type === "purchase"
      ? (customerSearch || form.customerAccountNo)
      : (salesSearch || form.salesAccountNo);
    setAccountLookupLoading(type);
    setAccountLookupMessage("");
    try {
      const account = await lookupAccountMaster(query, form.countryId, form.countryBranchId, form.cityBranchId, isSuperAdmin);
      if (!account) {
        setAccountLookupMessage(`Account not found: ${query}.`);
        return;
      }
      applyAccountMaster(type, account);
      setAccountLookupMessage(
        `${type === "purchase" ? "Customer" : "Sales"} account loaded: ${account.accountName}`
      );
    } catch (error) {
      setAccountLookupMessage(error instanceof Error ? error.message : "Account lookup failed.");
    } finally {
      setAccountLookupLoading(null);
    }
  };

  // Fetch session & countries on load
  useEffect(() => {
    let cancelled = false;
    async function initSession() {
      if (session) return; // Use prop session if available
      try {
        const response = await fetch("/api/erp/auth/session");
        const payload = await response.json();
        const sessionRes = payload?.data || payload;
        if (!cancelled && sessionRes) {
          setLocalSession(sessionRes);
          const sScopes = sessionRes.scopes || sessionRes || {};
          const isSup = sScopes.isSuperAdmin;
          const userCountryId = (!isSup && sScopes.countryIds?.[0]) ? sScopes.countryIds[0] : null;
          const userCountryBranchId = (!isSup && sScopes.countryBranchIds?.[0]) ? sScopes.countryBranchIds[0] : null;
          const userCityBranchId = (!isSup && sScopes.cityBranchIds?.[0]) ? sScopes.cityBranchIds[0] : null;

          setForm((prev) => ({
            ...prev,
            userName: sessionRes.user?.fullName || sessionRes.fullName || prev.userName,
            userId: sessionRes.user?.id || sessionRes.userId || prev.userId,
            countryId: userCountryId || prev.countryId,
            countryBranchId: userCountryBranchId || prev.countryBranchId,
            cityBranchId: userCityBranchId || prev.cityBranchId
          }));
        }
      } catch (err) {
        console.error("Failed to load session:", err);
      }
    }
    async function initCountries() {
      try {
        const response = await fetch("/api/erp/locations/countries");
        const res = await response.json();
        const countriesData = res?.data?.countries || res?.countries;
        if (!cancelled && countriesData) {
          setCountries(countriesData);
          if (countriesData.length === 1) {
            setForm(prev => ({ ...prev, countryId: prev.countryId || countriesData[0].id }));
          }
        }
      } catch (err) {
        console.error("Failed to load countries:", err);
      }
    }
    async function initAllCountries() {
      try {
        const response = await fetch("/api/erp/locations/countries?all=true&limit=500");
        const res = await response.json();
        const countriesData = res?.data?.countries || res?.countries;
        if (!cancelled && countriesData) {
          setAllCountries(countriesData);
        }
      } catch (err) {
        console.error("Failed to load all countries:", err);
      }
    }
    async function initGoods() {
      try {
        const response = await fetch("/api/erp/goods?limit=500");
        const res = await response.json();
        const goodsData = res?.data?.goods || res?.goods;
        if (!cancelled && goodsData) {
          setDbGoods(goodsData);
        }
      } catch (err) {
        console.error("Failed to load goods master:", err);
      }
    }
    async function initCompanies() {
      try {
        const response = await fetch("/api/erp/companies?limit=100");
        const res = await response.json();
        const companiesData = res?.data?.companies || res?.companies;
        if (!cancelled && companiesData) {
          setDbCompanies(companiesData);
        }
      } catch (err) {
        console.error("Failed to load companies:", err);
      }
    }
    async function initAccounts() {
      try {
        const response = await fetch("/api/erp/accounting/accounts?limit=1000");
        const res = await response.json();
        if (!cancelled && res?.data?.accounts) {
          setDbAccounts(res.data.accounts.map(mapEnterpriseAccount));
        }
      } catch (err) {
        console.error("Failed to load accounts:", err);
      }
    }
    async function initPorts() {
      try {
        const [loadRes, recRes] = await Promise.all([
          fetch("/api/erp/ports/loading?all=true&limit=500"),
          fetch("/api/erp/ports/received?all=true&limit=500")
        ]);
        const loadJson = await loadRes.json();
        const recJson = await recRes.json();
        const loadPorts = loadJson?.data?.ports || loadJson?.ports;
        const recPorts = recJson?.data?.ports || recJson?.ports;
        if (!cancelled && loadPorts) {
          setDbLoadingPorts(loadPorts);
        }
        if (!cancelled && recPorts) {
          setDbReceivedPorts(recPorts);
        }
      } catch (err) {
        console.error("Failed to load ports master data:", err);
      }
    }
    initSession();
    initCountries();
    initAllCountries();
    initGoods();
    initAccounts();
    initPorts();
    initCompanies();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadScopedAccounts() {
      try {
        const params = new URLSearchParams({ limit: "500" });
        if (form.countryId) params.set("countryId", form.countryId);
        if (form.countryBranchId) params.set("countryBranchId", form.countryBranchId);
        if (form.cityBranchId) params.set("cityBranchId", form.cityBranchId);
        params.set("limit", "1000");
        const response = await fetch(`/api/erp/accounting/accounts?${params.toString()}`, { cache: "no-store" });
        const res = await response.json();
        if (!cancelled && res?.data?.accounts) {
          setDbAccounts(res.data.accounts.map(mapEnterpriseAccount));
        }
      } catch (err) {
        console.error("Failed to load scoped accounts:", err);
      }
    }
    loadScopedAccounts();
    return () => { cancelled = true; };
  }, [form.countryId, form.countryBranchId, form.cityBranchId, isSuperAdmin]);

  // Load Main Branches (Country Branches) when countryId changes
  useEffect(() => {
    let cancelled = false;
    const countryId = form.countryId;
    if (!countryId) {
      setMainBranches([]);
      return;
    }
    async function loadCountryBranches() {
      try {
        const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`).then(r => r.json());
        const list = Array.isArray(res?.countryBranches) ? res.countryBranches : [];
        if (!cancelled) {
          setMainBranches(list);
          if (list.length === 1 && !form.countryBranchId) {
            setForm(prev => ({ ...prev, countryBranchId: list[0].id }));
          }
        }
      } catch (err) {
        console.error("Failed to load country branches:", err);
      }
    }
    loadCountryBranches();
    return () => {
      cancelled = true;
    };
  }, [form.countryId]);

  // Load City Branches when countryId or countryBranchId changes
  useEffect(() => {
    let cancelled = false;
    const countryId = form.countryId;
    const countryBranchId = form.countryBranchId;
    if (!countryId) {
      setCityBranches([]);
      return;
    }
    async function loadCityBranches() {
      try {
        const queryParams = new URLSearchParams({ countryId });
        if (countryBranchId) queryParams.append("countryBranchId", countryBranchId);
        const res = await fetch(`/api/branch-management/city-branches?${queryParams.toString()}`).then(r => r.json());
        const list = Array.isArray(res?.cityBranches) ? res.cityBranches : [];
        if (!cancelled) {
          setCityBranches(list);
          if (list.length === 1 && !form.cityBranchId) {
            setForm(prev => ({ ...prev, cityBranchId: list[0].id }));
          }
        }
      } catch (err) {
        console.error("Failed to load city branches:", err);
      }
    }
    loadCityBranches();
    return () => {
      cancelled = true;
    };
  }, [form.countryId, form.countryBranchId]);

  // Sync Branch Code and Name for Branch Serial display and generate formatted Bill No
  useEffect(() => {
    let selectedBranch = null;
    if (form.cityBranchId && cityBranches.length > 0) {
      selectedBranch = cityBranches.find(cb => cb.id === form.cityBranchId);
    } else if (form.countryBranchId && mainBranches.length > 0) {
      selectedBranch = mainBranches.find(b => b.id === form.countryBranchId);
    }

    if (selectedBranch) {
      const codeBase = selectedBranch.code || "BR";
      const suffix = form.salesOrderNo ? form.salesOrderNo.split("-").pop() : "0000";

      const parts = codeBase.split("-");
      let serialPrefix = codeBase;
      let cityCode = "CITY";
      if (parts.length >= 3) {
        serialPrefix = parts.slice(0, 2).join("-");
        cityCode = parts[1];
      } else if (parts.length === 2) {
        cityCode = parts[1];
      }

      const country = transitCountryOptions.find(c => String(c.id) === String(form.countryId));
      const countryPrefix = country ? (country.iso2 || country.name.substring(0, 2).toUpperCase()) : "CT";

      setForm(prev => {
        const newCode = `${serialPrefix}-${suffix}`;
        const newName = selectedBranch.name || selectedBranch.city_name || prev.branchName;
        const branchNameWord = newName ? newName.split(" ")[0].toUpperCase() : cityCode;
        const newBillNo = `${branchNameWord}-${suffix}`;

        if (prev.branchCode === newCode && prev.branchName === newName && prev.billNo === newBillNo && prev.branchCountry === (country?.name || "")) return prev;
        return {
          ...prev,
          branchName: newName,
          branchCode: newCode,
          billNo: newBillNo,
          branchCountry: country ? country.name : ""
        };
      });
    }
  }, [form.countryId, form.countryBranchId, form.cityBranchId, mainBranches, cityBranches, form.salesOrderNo, transitCountryOptions]);

  // Set initial scope fields for scoped users
  useEffect(() => {
    if (!activeSession) return;
    if (activeSession.isSuperAdmin || activeSession.scopes?.isSuperAdmin) return;

    const cid = activeSession.countryIds?.[0] || activeSession.scopes?.countryIds?.[0] || "";
    const bid = activeSession.countryBranchIds?.[0] || activeSession.scopes?.countryBranchIds?.[0] || "";
    const cbid = activeSession.cityBranchIds?.[0] || activeSession.scopes?.cityBranchIds?.[0] || "";

    setForm(prev => {
      const next = {
        ...prev,
        countryId: prev.countryId || cid,
        countryBranchId: prev.countryBranchId || bid,
        cityBranchId: prev.cityBranchId || cbid
      };
      return next.countryId === prev.countryId && next.countryBranchId === prev.countryBranchId && next.cityBranchId === prev.cityBranchId ? prev : next;
    });
  }, [activeSession?.id, activeSession?.userId, activeSession?.countryIds?.[0], activeSession?.countryBranchIds?.[0], activeSession?.cityBranchIds?.[0], activeSession?.scopes?.countryIds?.[0], activeSession?.scopes?.countryBranchIds?.[0], activeSession?.scopes?.cityBranchIds?.[0], activeSession?.isSuperAdmin, activeSession?.scopes?.isSuperAdmin]);

  // Load existing sales order if salesOrderNo or id is in URL query parameters
  useEffect(() => {
    if (!activeSession) return;
    const soNo = searchParams.get("salesOrderNo");
    const orderId = searchParams.get("id") || searchParams.get("salesOrderId");
    if (!soNo && !orderId) return;
    setIsFormOpen(true);

    let cancelled = false;

    async function loadSO() {
      setSavingOrder(true);
      setSaveMessage("Loading sales order details...");
      try {
        let soData = null;
        if (orderId) {
          const res = await fetch(`/api/erp/sales/orders/${encodeURIComponent(orderId)}`, {
            credentials: "same-origin"
          });
          const payload = await res.json().catch(() => ({}));
          if (res.ok && payload.ok) {
            soData = payload.data?.order ?? payload.order ?? null;
          } else {
            throw new Error(payload?.error?.message || payload?.error || "Failed to load sales order by ID.");
          }
        } else if (soNo) {
          soData = await lookupSalesBookingReport(
            soNo,
            activeSession.countryIds?.[0] || activeSession.scopes?.countryIds?.[0] || null,
            activeSession.countryBranchIds?.[0] || activeSession.scopes?.countryBranchIds?.[0] || null,
            activeSession.cityBranchIds?.[0] || activeSession.scopes?.cityBranchIds?.[0] || null,
            isSuperAdmin
          );
        }

        if (cancelled) return;

        if (soData) {
          const rawFormData = soData.form_data || {};
          const loadedForm = rawFormData.form || {};
          const loadedGoods = rawFormData.goodsEntries || [];

          const soNumber = soData.sales_order_no || soData.salesBookingOrderNumber || loadedForm.salesOrderNo || soNo || "";
          const contractNumber = soData.sales_contract_no || soData.salesContractNo || loadedForm.salesContractNo || "";

          setSavedOrderId(soData.id || orderId || "");
          setSavedOrderNo(soNumber);

          const mergedCountryId = loadedForm.countryId || soData.country_id || soData.countryId || "";
          const mergedCountryBranchId = loadedForm.countryBranchId || soData.country_branch_id || soData.countryBranchId || soData.branch_id || soData.branchId || "";
          const mergedCityBranchId = loadedForm.cityBranchId || soData.city_branch_id || soData.cityBranchId || "";

          setForm((prev) => ({
            ...prev,
            ...loadedForm,
            countryId: mergedCountryId,
            countryBranchId: mergedCountryBranchId,
            cityBranchId: mergedCityBranchId,
            salesOrderNo: soNumber,
            salesContractNo: contractNumber,
          }));
          setScopeConfirmed(true);

          if (loadedForm.customerAccountName || loadedForm.customerAccountNo) {
            setPurchaseSearch(loadedForm.customerAccountName || loadedForm.customerAccountNo || "");
          }
          if (loadedForm.salesAccountName || loadedForm.salesAccountNo) {
            setSalesSearch(loadedForm.salesAccountName || loadedForm.salesAccountNo || "");
          }

          if (Array.isArray(loadedGoods) && loadedGoods.length) {
            setGoodsEntries(loadedGoods);
          }

          setIsTransferred(false);
          setTransferredData(null);
          setActiveTab("booking");
          setSaveMessage("Sales order loaded successfully.");
        } else {
          setSaveMessage(`Sales order not found.`);
        }
      } catch (err) {
        if (cancelled) return;
        setSaveMessage(err instanceof Error ? err.message : "Error loading sales order.");
      } finally {
        if (!cancelled) setSavingOrder(false);
      }
    }

    loadSO();
    return () => {
      cancelled = true;
    };
  }, [
    searchParams.get("salesOrderNo"),
    searchParams.get("id"),
    searchParams.get("salesOrderId"),
    !!activeSession
  ]);

  const buildSalesOrderPayload = (salesStatus = "Draft", customOrderNo = null) => {
    const usdRate = Number(form.exchangeRate || 1);

    const customerAccount = dbAccounts.find(acc => acc.accountCode === form.customerAccountNo);
    const salesAccount = dbAccounts.find(acc => acc.accountCode === form.salesAccountNo);

    return {
      countryId: form.countryId || null,
      countryBranchId: form.countryBranchId || null,
      cityBranchId: form.cityBranchId || null,
      customerAccountId: form.salesAccountLedgerId || null,
      customerLedgerId: form.customerAccountLedgerId || null,
      salesOrderNo: customOrderNo || form.salesOrderNo,
      salesContractNo: form.salesContractNo || form.salesOrderNo,
      orderDate: form.salesDate || new Date().toISOString().slice(0, 10),
      customerName: form.customerAccountName || null,
      accountNumber: form.customerAccountNo || null,
      manualReferenceNumber: form.customerAccountManualReferenceNumber || null,
      customerNumber: customerAccount?.customerNumber || null,
      quantity: reportTotals.totalQty || 0,
      totalWeight: reportTotals.totalNet || 0,
      currencyCode: form.salesCurrency || "USD",
      exchangeRate: usdRate,
      orderTotal: reportTotals.grandFinal || reportTotals.grandPrimaryFinal || 0,
      paidAmount: isTransferred ? (reportTotals.grandFinal || reportTotals.grandPrimaryFinal || 0) : 0,
      remainingAmount: isTransferred ? 0 : (reportTotals.grandFinal || reportTotals.grandPrimaryFinal || 0),
      salesStatus: salesStatus.toLowerCase(),
      paymentStatus: isTransferred ? "completed" : "pending",
      deliveryStatus: "pending",
      formData: {
        form,
        totals: reportTotals,
        goodsEntries: goodsEntries,
        reports: reportsList,
        workflow: {
          currentStep: isTransferred ? "sales_transfer_payment" : "booking_sales_order",
          nextStep: isTransferred ? "Post Payment" : "Booking Confirm",
          bookingStatus: "Saved",
          confirmationStatus: isTransferred ? "Confirmed" : "Pending",
          journalStatus: isTransferred ? "Posted" : "Pending",
          paymentStatus: isTransferred ? "completed" : "Pending",
          savedAt: new Date().toISOString(),
        },
        savedAt: new Date().toISOString()
      }
    };
  };

  const handleSaveSalesOrder = async (shouldClose = false) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSavingOrder(true);
    setSaveMessage("");
    try {
      const nextOrderNo = (form.salesOrderNo || "").trim();
      const response = await fetch(savedOrderId ? `/api/erp/sales/orders/${savedOrderId}` : "/api/erp/sales/orders", {
        method: savedOrderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSalesOrderPayload("Draft", nextOrderNo))
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const errDetails = payload?.error?.details ? JSON.stringify(payload.error.details) : "";
        throw new Error(`${payload?.error?.message || payload?.error || "Sales order failed to save."} ${errDetails}`);
      }
      const returnedOrderId = payload.data?.salesOrderId || savedOrderId || payload.data?.id;
      const returnedOrderNo = payload.data?.salesOrderNo || savedOrderNo || form.salesOrderNo;
      setSavedOrderId(returnedOrderId || "");
      setSavedOrderNo(returnedOrderNo);
      setSaveMessage(`Successfully saved Sales Order: ${returnedOrderNo}.`);
      setRegisterRefreshKey((key) => key + 1);

      if (shouldClose) {
        setIsFormOpen(false);
        handleReset();
        if (searchParams.get("id") || searchParams.get("salesOrderNo")) {
          router.push("/dashboard/sales/sales-booking-register");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving order.";
      setSaveMessage(msg);
      alert(msg);
    } finally {
      setSavingOrder(false);
      isSubmittingRef.current = false;
    }
  };

  const handleTransfer = async () => {
    setSavingOrder(true);
    setSaveMessage("");
    try {
      const nextOrderNo = (form.salesOrderNo || "").trim();
      const transferPayload = buildSalesOrderPayload("Pending", nextOrderNo);
      const response = await fetch(savedOrderId ? `/api/erp/sales/orders/${savedOrderId}` : "/api/erp/sales/orders", {
        method: savedOrderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferPayload)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const errDetails = payload?.error?.details ? JSON.stringify(payload.error.details) : "";
        throw new Error(`${payload?.error?.message || payload?.error || "Sales order failed to save."} ${errDetails}`);
      }
      const returnedOrderId = payload.data?.salesOrderId || savedOrderId || payload.data?.id;
      const returnedOrderNo = payload.data?.salesOrderNo || savedOrderNo || form.salesOrderNo;

      if (returnedOrderId) {
        const transferResponse = await fetch(`/api/erp/sales/orders/${returnedOrderId}/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        const transferPayloadData = await transferResponse.json().catch(() => ({}));
        if (!transferResponse.ok || !transferPayloadData.ok) {
          throw new Error(transferPayloadData?.error?.message || transferPayloadData?.error || "Roznamcha/Ledger Transfer failed.");
        }
      }

      setSavedOrderId(returnedOrderId || "");
      setSavedOrderNo(returnedOrderNo);
      setSaveMessage(`Transferred Sales Order ${returnedOrderNo} to Journal / Payment and ledger posting.`);
      setTransferredData(payload.data || { salesOrderNo: returnedOrderNo });
      setIsTransferred(true);
      setRegisterRefreshKey((key) => key + 1);

      window.location.href = `/dashboard/journal/sales-order-payment/advance?salesOrderNo=${encodeURIComponent(returnedOrderNo)}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving order.";
      setSaveMessage(msg);
      alert(msg);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleOpenA4Report = (autoPrint = false) => {
    const firstGoodName = goodsEntries[0]?.goodsName || "Cargo";
    const firstQtyUnit = goodsEntries[0]?.qtyName || "BAGS";
    const rawRemarks = form.remarks || form.orderReportRemarks || "";

    const reportData = {
      id: savedOrderId || "new-temp",
      salesBookingOrderNumber: form.salesOrderNo,
      salesDate: form.salesDate,
      bookingDate: form.salesDate,
      salesAccountName: form.salesAccountName,
      salesAccountNumber: form.salesAccountNo,
      purchaseAccountName: form.customerAccountName,
      purchaseAccountNumber: form.customerAccountNo,
      supplierName: form.salesAccountName || "N/A",
      customerName: form.customerAccountName || "N/A",
      productName: firstGoodName,
      goodsDescription: rawRemarks,
      quantity: reportTotals.totalQty,
      unit: firstQtyUnit,
      totalWeight: reportTotals.totalNet,
      containerCount: form.containerCount || 0,
      salesRate: avgRateKg,
      totalSalesAmount: reportTotals.grandPrimaryFinal,
      currency: form.currencyType,
      status: isTransferred ? "Posted" : "Pending",
      paymentStatus: isTransferred ? "completed" : "pending",
      branchName: form.branchName || "Main Branch",
      countryName: form.branchCountry || "Country",
      createdAt: new Date().toISOString(),
      totalGrossWeight: reportTotals.totalGross,
      totalNetWeight: reportTotals.totalNet,
      salesAmount: reportTotals.grandPrimaryFinal,
      finalAmount: reportTotals.grandFinal,
      form_data: { form, goodsEntries },
      audit: {
        userName: form.userName || "Admin User",
        userId: form.userId || "USR-1001",
        branchCode: form.branchCode || "BR-KBL-001"
      }
    };

    openSalesA4ReportWindow({
      title: "Sales Booking Order",
      subtitle: "DGT Accounts Sales Registry",
      salesData: reportData,
      autoPrint
    });
  };

  const handleReset = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setForm({
      ...DEFAULT_FORM,
      salesOrderNo: `SO-2026-${randomSuffix}`,
      salesContractNo: `SC-2026-${randomSuffix}`,
      billNo: `BILL-${randomSuffix}`,
    });
    setGoodsEntries([]);
    setReportsList([]);
    setSavedOrderId("");
    setSavedOrderNo("");
    setIsTransferred(false);
    setTransferredData(null);
    setSaveMessage("All inputs and goods listings cleared.");
  };

  const handleNewReportSubmit = (e) => {
    e.preventDefault();
    if (!newReportForm.name.trim()) {
      alert("Report name is required.");
      return;
    }
    const newReport = {
      id: crypto.randomUUID(),
      name: newReportForm.name,
      description: newReportForm.description,
      notes: newReportForm.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updatedReports = [...reportsList, newReport];
    setReportsList(updatedReports);
    setSelectedReportId(newReport.id);
    setNewReportForm({ name: "", description: "", notes: "" });
    setIsNewReportModalOpen(false);

    if (savedOrderId) {
      setTimeout(() => {
        handleSaveSalesOrder(false);
      }, 100);
    }
  };

  const handleDeleteReport = (id) => {
    if (!window.confirm("Are you sure you want to delete this report?")) return;
    const updatedReports = reportsList.filter(r => r.id !== id);
    setReportsList(updatedReports);
    if (selectedReportId === id) setSelectedReportId("");
    if (savedOrderId) {
      setTimeout(() => {
        handleSaveSalesOrder(false);
      }, 100);
    }
  };

  const handleAddGoodsEntry = async () => {
    const searchName = (form.goodsName || "").trim().toUpperCase();
    if (!searchName) {
      alert("Please select or enter Goods Name before adding an item to the list.");
      return;
    }
    const selectedGood = dbGoods.find(g =>
      (g.goods_name || g.goodsName || "").trim().toUpperCase() === searchName
    );
    const sizeStr = (form.size || "").trim();
    const brandStr = (form.brand || "").trim();

    if (selectedGood && sizeStr && brandStr) {
      const hasVar = (selectedGood.variations || []).some(v => 
        (v.size || "").trim().toUpperCase() === sizeStr.toUpperCase() &&
        (v.brand || "").trim().toUpperCase() === brandStr.toUpperCase()
      );
      if (!hasVar) {
        fetch("/api/erp/goods/variations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goodsId: selectedGood.id,
            size: sizeStr.toUpperCase(),
            brand: brandStr.toUpperCase()
          })
        }).then(res => res.json())
          .then(data => {
            if (data.ok) {
              fetch("/api/erp/goods?limit=500")
                .then(r => r.json())
                .then(reloadRes => {
                  const goodsData = reloadRes?.data?.goods || reloadRes?.goods;
                  if (goodsData) setDbGoods(goodsData);
                }).catch(() => {});
            }
          }).catch(() => {});
      }
    }

    const calculated = calculateItemTotals(form);
    setGoodsEntries((prev) => [
      ...prev,
      {
        allotName: form.allotName || `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
        goodsName: form.goodsName,
        size: form.size || "-",
        brand: form.brand || "-",
        origin: form.origin || "-",
        hsCode: form.hsCode || "-",
        qtyName: form.qtyName || "BAGS",
        qtyNo: Number(form.qtyNo || 0),
        qtyKgs: Number(form.qtyKgs || 0),
        grossWeight: calculated.grossWeight,
        emptyKgs: Number(form.emptyKgs || 0),
        netWeight: calculated.netWeight,
        priceType: form.priceType || "P/KGs",
        divideType: form.divideType || "D/KGs",
        divideWeight: Number(form.divideWeight || 1),
        coursePrice: Number(form.coursePrice || 0),
        currencyType: form.currencyType || "USD",
        purchaseCurrency: form.purchaseCurrency || form.currencyType || "USD",
        exchangeRate: Number(form.exchangeRate || 1),
        totalAmount: form.manualTotalAmount !== undefined && form.manualTotalAmount !== "" ? Number(form.manualTotalAmount) : calculated.totalAmount,
        op: form.operator || "*",
        finalAmount: form.manualFinalAmount !== undefined && form.manualFinalAmount !== "" ? Number(form.manualFinalAmount) : calculated.finalAmount
      }
    ]);
    setSaveMessage("Item added to live report draft list.");
    // Clear/reset item fields
    setForm((prev) => ({
      ...prev,
      goodsName: "",
      size: "",
      brand: "",
      origin: "",
      hsCode: "",
      qtyNo: 0,
      qtyKgs: 0,
      emptyKgs: 0,
      netWeight: "",
      coursePrice: 0,
      allotName: `ALT-${Math.floor(4424 + Math.random() * 1000)}`,
      manualTotalAmount: "",
      manualFinalAmount: ""
    }));
  };

  const handleViewGoodsEntry = (index) => {
    const row = goodsEntries[index];
    alert(`View Item:

Goods: ${row.goodsName}
Brand: ${row.brand}
Size: ${row.size}
Origin: ${row.origin}
Qty: ${row.qtyNo} ${row.qtyName}
Price: ${row.coursePrice} ${row.currencyType}
Amount: ${row.totalAmount.toLocaleString()} ${row.currencyType}`);
  };

  const handleEditGoodsEntry = (index) => {
    const row = goodsEntries[index];
    setForm((prev) => ({
      ...prev,
      goodsName: row.goodsName,
      size: row.size,
      brand: row.brand,
      origin: row.origin,
      hsCode: row.hsCode,
      qtyName: row.qtyName,
      qtyNo: row.qtyNo,
      qtyKgs: row.qtyKgs,
      emptyKgs: row.emptyKgs,
      netWeight: row.netWeight,
      priceType: row.priceType,
      divideType: row.divideType,
      divideWeight: row.divideWeight,
      coursePrice: row.coursePrice,
      currencyType: row.currencyType,
      salesCurrency: row.purchaseCurrency || row.salesCurrency,
      exchangeRate: row.exchangeRate,
      operator: row.op,
      allotName: row.allotName,
      manualTotalAmount: row.totalAmount,
      manualFinalAmount: row.finalAmount
    }));
    setGoodsEntries((prev) => prev.filter((_, idx) => idx !== index));
    setActiveTab("goods");
    setSaveMessage("Item moved to form for editing.");
  };

  const handleAddNewCountry = async () => {
    const { name } = newCountryForm;
    if (!name.trim()) {
      setNewCountryError("Country name is required.");
      return;
    }
    setNewCountryLoading(true);
    setNewCountryError("");
    try {
      const trimmed = name.trim();
      const iso2 = trimmed.slice(0, 2).toUpperCase();
      const iso3 = trimmed.slice(0, 3).toUpperCase();
      const code = iso2.toLowerCase();
      const response = await fetch("/api/erp/locations/countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          iso2,
          iso3,
          currencyCode: "USD",
          officialEmail: `official.${code}@dgtllc.com`,
          adminEmail: `admin.${code}@dgtllc.com`,
          whatsappNumber: null
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "Failed to create country.");
      }
      const created = payload.data?.country;
      if (created) {
        setAllCountries(prev => [...prev, created]);
        if (newCountryForm.targetField === "loadingCountry") {
          setValue("loadingCountry", created.name);
          setValue("originCountry", created.name);
          setValue("origin", created.name);
        } else if (newCountryForm.targetField === "receivingCountry") {
          setValue("receivingCountry", created.name);
          setValue("receivedCountry", created.name);
          setValue("destinationCountry", created.name);
        } else if (newGoodModal) {
          setNewGoodForm(p => ({ ...p, originCountryId: created.id }));
        } else if (customVariationModal) {
          setCustomVariationForm(p => ({ ...p, originCountryId: created.id }));
        } else {
          setValue("origin", created.name);
        }
      }
      const reloadRes = await fetch("/api/erp/locations/countries?all=true&limit=500").then(r => r.json()).catch(() => ({}));
      const countriesData = reloadRes?.data?.countries || reloadRes?.countries;
      if (countriesData) setAllCountries(countriesData);
      setNewCountryModal(false);
      setNewCountryForm({ name: "" });
      setSaveMessage(`Country "${trimmed}" saved to master.`);
    } catch (err) {
      setNewCountryError(err instanceof Error ? err.message : "Failed to create country.");
    } finally {
      setNewCountryLoading(false);
    }
  };

  const handleAddNewGood = async () => {
    const { goodsName, chsCode } = newGoodForm;
    if (!goodsName.trim() || !chsCode.trim()) {
      setNewGoodError("Goods name and HS code are required.");
      return;
    }
    setNewGoodLoading(true);
    setNewGoodError("");
    try {
      const response = await fetch("/api/erp/goods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodsName: goodsName.trim().toUpperCase(),
          chsCode: chsCode.trim(),
          originalLanguage: "en"
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "Failed to create good.");
      }
      const reloadRes = await fetch("/api/erp/goods?limit=500").then(r => r.json()).catch(() => ({}));
      const goodsData = reloadRes?.data?.goods || reloadRes?.goods;
      if (goodsData) setDbGoods(goodsData);
      setValue("goodsName", goodsName.trim().toUpperCase());
      setValue("hsCode", chsCode.trim());
      setNewGoodModal(false);
      setNewGoodForm({ goodsName: "", chsCode: "" });
      setSaveMessage(`Good "${goodsName.trim().toUpperCase()}" saved to master.`);
    } catch (err) {
      setNewGoodError(err instanceof Error ? err.message : "Failed to create good.");
    } finally {
      setNewGoodLoading(false);
    }
  };

  const openCreateAccountModal = (type) => {
    const defaultName = type === "purchase"
      ? (customerDetail ? (customerDetail.customer_name ? `${customerDetail.customer_name} (${customerDetail.company_name})` : customerDetail.customer_name) : (form.customerName || ""))
      : (sellerDetail ? (sellerDetail.customer_name ? `${sellerDetail.customer_name} (${sellerDetail.company_name})` : sellerDetail.customer_name) : (form.customerName || ""));

    setCreateAccountType(type);
    setCreateAccountForm({
      code: "AUTO",
      name: defaultName,
      kind: type === "purchase" ? "asset" : "revenue",
      currency: form.currencyType || "USD",
      parentId: "",
      isControlAccount: false
    });
    setCreateAccountError("");
    setCreateAccountModalOpen(true);
  };

  const handleAddNewAccount = async () => {
    const { code, name, kind, currency, parentId, isControlAccount } = createAccountForm;
    if (!name.trim() || !code.trim()) {
      setCreateAccountError("Account name and code are required.");
      return;
    }
    setCreateAccountLoading(true);
    setCreateAccountError("");

    try {
      const scope = form.cityBranchId ? "city_branch" : form.countryBranchId ? "main_branch" : form.countryId ? "country" : "super_admin";
      const payload = {
        scope,
        countryId: form.countryId || null,
        countryBranchId: form.countryBranchId || null,
        cityBranchId: form.cityBranchId || null,
        parentId: parentId || null,
        customerId: form.customerId || null,
        code: code.trim(),
        manualReferenceNumber: null,
        name: name.trim(),
        kind,
        currency: currency.toUpperCase(),
        openingBalance: 0,
        isControlAccount
      };

      const response = await fetch("/api/erp/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const payloadData = await response.json().catch(() => ({}));
      if (!response.ok || !payloadData.ok) {
        throw new Error(payloadData?.error?.message || payloadData?.error || "Failed to create account.");
      }

      const reloadRes = await fetch("/api/erp/accounting/accounts?limit=1000").then(r => r.json()).catch(() => ({}));
      if (reloadRes?.data?.accounts) {
        const mapped = reloadRes.data.accounts.map(mapEnterpriseAccount);
        setDbAccounts(mapped);

        const createdAcc = mapped.find(acc => acc.accountCode === payloadData.accountCode);
        if (createdAcc) {
          applyAccountMaster(createAccountType, createdAcc);
        } else {
          applyAccountMaster(createAccountType, {
            accountCode: payloadData.accountCode,
            accountName: name.trim(),
            cityBranchName: "",
            ledgerCurrency: currency.toUpperCase(),
            customerId: payload.customerId
          });
        }
      }

      setCreateAccountModalOpen(false);
    } catch (err) {
      setCreateAccountError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setCreateAccountLoading(false);
    }
  };

  const handleAddNewCompany = async () => {
    const { name, legalName, baseCurrency } = createCompanyForm;
    if (!name.trim()) {
      setCreateCompanyError("Company name is required.");
      return;
    }
    setCreateCompanyLoading(true);
    setCreateCompanyError("");

    try {
      const lang = (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
      const originalLanguage = ["ar", "ur", "fa", "ps"].includes(lang) ? lang : "en";

      const response = await fetch("/api/erp/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          legalName: legalName.trim() || name.trim(),
          baseCurrency: baseCurrency || "USD",
          originalLanguage
        })
      });

      const payloadData = await response.json().catch(() => ({}));
      if (!response.ok || !payloadData.ok) {
        throw new Error(payloadData?.error?.message || payloadData?.error || "Failed to create company.");
      }

      const createdId = payloadData.companyId || payloadData.data?.companyId;
      const finalName = name.trim();
      const finalCode = "COM-" + finalName.slice(0, 3).toUpperCase();

      const reloadRes = await fetch("/api/erp/companies?limit=100").then(r => r.json()).catch(() => ({}));
      const companiesData = reloadRes?.data?.companies || reloadRes?.companies;
      if (companiesData) {
        setDbCompanies(companiesData);
      } else {
        setDbCompanies(prev => [...prev, { id: createdId, name: finalName, legal_name: legalName.trim() || finalName }]);
      }

      if (createCompanyType === "purchase") {
        setValue("purchaseCompanyId", createdId);
        setValue("purchaseCompanyName", finalName);
        setValue("purchaseCompanyCode", finalCode);
      } else {
        setValue("salesCompanyId", createdId);
        setValue("salesCompanyName", finalName);
        setValue("salesCompanyCode", finalCode);
      }

      setCreateCompanyModalOpen(false);
      setCreateCompanyForm({ name: "", legalName: "", baseCurrency: "USD" });
      setSaveMessage(`Company "${finalName}" created successfully.`);
    } catch (err) {
      setCreateCompanyError(err instanceof Error ? err.message : "Failed to create company.");
    } finally {
      setCreateCompanyLoading(false);
    }
  };

  const handleSaveCustomVariation = async () => {
    const { goodsName, brand, size } = customVariationForm;
    if (!brand.trim() || !size.trim()) {
      alert("Please fill both Brand and Size.");
      return;
    }

    const searchName = goodsName?.trim().toUpperCase() || "";
    const selectedGood = dbGoods.find(g => {
      const gName = (g.goods_name || g.goodsName || "").trim().toUpperCase();
      return gName === searchName;
    });

    let targetGoodsId = null;

    if (!selectedGood) {
      setSavingOrder(true);
      setSaveMessage(`Creating new Good "${searchName}" in master...`);
      try {
        let baseCode = searchName.substring(0, 10).trim();
        let finalCode = baseCode;
        let suffix = 1;
        while (dbGoods.some(g => (g.chs_code || g.chsCode || "").trim().toUpperCase() === finalCode.toUpperCase())) {
          const suffixStr = `-${suffix}`;
          finalCode = `${baseCode.substring(0, 10 - suffixStr.length)}${suffixStr}`;
          suffix++;
        }

        const createRes = await fetch("/api/erp/goods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goodsName: searchName,
            chsCode: finalCode,
            originalLanguage: "en",
            initialVariation: {
              size: size.trim().toUpperCase(),
              brand: brand.trim().toUpperCase()
            }
          })
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok || !createData.ok) {
          throw new Error(createData?.error?.message || createData?.error || "Failed to create Good in master.");
        }
        targetGoodsId = createData.goodsId || createData.data?.goodsId;
      } catch (err) {
        setSavingOrder(false);
        alert(err instanceof Error ? err.message : "Error creating Good.");
        return;
      }
    } else {
      targetGoodsId = selectedGood.id;
      setSavingOrder(true);
      setSaveMessage(`Registering variation ${brand.trim().toUpperCase()} - ${size.trim().toUpperCase()}...`);
      try {
        const response = await fetch("/api/erp/goods/variations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goodsId: targetGoodsId,
            size: size.trim().toUpperCase(),
            brand: brand.trim().toUpperCase()
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload?.error?.message || payload?.error || "Failed to save variation.");
        }
      } catch (err) {
        setSavingOrder(false);
        alert(err instanceof Error ? err.message : "Error saving variation.");
        return;
      }
    }

    try {
      const reloadRes = await fetch("/api/erp/goods?limit=500").then(r => r.json()).catch(() => ({}));
      const goodsData = reloadRes?.data?.goods || reloadRes?.goods;
      if (goodsData) {
        setDbGoods(goodsData);
      }

      setValue("brand", brand.trim().toUpperCase());
      setValue("size", size.trim().toUpperCase());

      const good = goodsData?.find((g) => g.id === targetGoodsId);
      if (good?.origin_country_id) {
        const matching = transitCountryOptions.find(c => c.id === good.origin_country_id);
        if (matching) {
          setValue("origin", matching.name);
        }
      }
      setCustomVariationModal(false);
      setSaveMessage(`Variation "${brand.trim().toUpperCase()} - ${size.trim().toUpperCase()}" saved successfully.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving variation.");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleUpdateHsCode = async () => {
    const selectedGood = dbGoods.find(g => (g.goods_name || g.goodsName || "").trim().toUpperCase() === (form.goodsName || "").trim().toUpperCase());
    if (!selectedGood) return;
    
    setSavingOrder(true);
    setSaveMessage("Updating HS Code...");
    try {
      const response = await fetch(`/api/erp/goods/${selectedGood.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chsCode: form.hsCode })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data?.error || data?.error?.message || "Failed to update HS Code.");
      
      const reloadRes = await fetch("/api/erp/goods?limit=500").then(r => r.json()).catch(() => ({}));
      const goodsData = reloadRes?.data?.goods || reloadRes?.goods;
      if (goodsData) setDbGoods(goodsData);
      
      setSaveMessage("HS Code updated successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating HS Code.");
    } finally {
      setSavingOrder(false);
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const handleAddNewVariationItem = async (type) => {
    const selectedGood = dbGoods.find(g => (g.goods_name || g.goodsName || "").trim().toUpperCase() === (form.goodsName || "").trim().toUpperCase());
    if (!selectedGood) {
       alert(`Please select a Good first before adding a new ${type}.`);
       return;
    }
    
    const value = window.prompt(`Enter New ${type === 'brand' ? 'Brand' : 'Size'}:`);
    if (!value || !value.trim()) return;
    
    setSavingOrder(true);
    setSaveMessage(`Saving new ${type}...`);
    try {
      const response = await fetch("/api/erp/goods/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodsId: selectedGood.id,
          size: type === 'size' ? value.trim().toUpperCase() : (form.size || "-").trim().toUpperCase(),
          brand: type === 'brand' ? value.trim().toUpperCase() : (form.brand || "-").trim().toUpperCase()
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || `Failed to save ${type}.`);
      }
      
      const reloadRes = await fetch("/api/erp/goods?limit=500").then(r => r.json()).catch(() => ({}));
      const goodsData = reloadRes?.data?.goods || reloadRes?.goods;
      if (goodsData) setDbGoods(goodsData);
      
      setValue(type, value.trim().toUpperCase());
      setSaveMessage(`New ${type} saved successfully.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Error saving ${type}.`);
    } finally {
      setSavingOrder(false);
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const handleAddNewLocationItem = async (type, targetField) => {
    const value = window.prompt(`Enter New ${type === 'country' ? 'Country' : 'Port'} Name:`);
    if (!value || !value.trim()) return;
    const trimmed = value.trim();

    setSavingOrder(true);
    setSaveMessage(`Saving new ${type}...`);

    try {
      if (type === "country") {
        const iso2 = trimmed.slice(0, 2).toUpperCase();
        const iso3 = trimmed.slice(0, 3).toUpperCase();
        const code = iso2.toLowerCase();
        
        const response = await fetch("/api/erp/locations/countries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            iso2,
            iso3,
            currencyCode: "USD",
            officialEmail: `official.${code}@dgtllc.com`,
            adminEmail: `admin.${code}@dgtllc.com`,
            whatsappNumber: null
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || payload?.error || "Failed to create country.");
        
        const reloadRes = await fetch("/api/erp/locations/countries?all=true&limit=500").then(r => r.json()).catch(() => ({}));
        const countriesData = reloadRes?.data?.countries || reloadRes?.countries;
        if (countriesData) setAllCountries(countriesData);
        
        if (targetField === "loadingCountry") {
          setValue("loadingCountry", trimmed);
          setValue("originCountry", trimmed);
          setValue("origin", trimmed);
          setValue("loadingPort", "");
          setValue("loadingLocation", "");
        } else if (targetField === "receivingCountry") {
          setValue("receivingCountry", trimmed);
          setValue("receivedCountry", trimmed);
          setValue("destinationCountry", trimmed);
          setValue("receivingPort", "");
          setValue("destinationPort", "");
          setValue("receivedPort", "");
        }
      } else if (type === "port") {
        let countryName = "";
        let isReceiving = false;
        if (targetField === "loadingPort") {
           countryName = form.loadingCountry;
        } else if (targetField === "receivingPort") {
           countryName = form.receivingCountry;
           isReceiving = true;
        }
        
        const countryObj = allCountries.find(c => c.name === countryName);
        const countryId = countryObj ? countryObj.id : null;
        
        const transportTypeMapping = {
          "By Sea": "sea",
          "By Road": "road",
          "By Air": "air"
        };
        const transportType = transportTypeMapping[form.shippingMode] || "sea";

        const endpoint = isReceiving ? "/api/erp/ports/received" : "/api/erp/ports/loading";
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portName: trimmed,
            countryId: countryId,
            portCode: trimmed.slice(0, 3).toUpperCase(),
            transportType: transportType,
            isActive: true
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || payload?.error || "Failed to create port.");

        const [loadRes, recRes] = await Promise.all([
          fetch("/api/erp/ports/loading?all=true&limit=500"),
          fetch("/api/erp/ports/received?all=true&limit=500")
        ]);
        const loadPorts = await loadRes.json().then(r => r?.data?.ports || r?.ports).catch(() => null);
        const recPorts = await recRes.json().then(r => r?.data?.ports || r?.ports).catch(() => null);
        
        if (loadPorts) setDbLoadingPorts(loadPorts);
        if (recPorts) setDbReceivedPorts(recPorts);

        if (targetField === "loadingPort") {
          setValue("loadingPort", trimmed);
          setValue("loadingLocation", trimmed);
          if (form.shippingMode === "By Air") setValue("airportName", trimmed);
          if (form.shippingMode === "By Road") setValue("loadingBorder", trimmed);
        } else if (targetField === "receivingPort") {
          setValue("receivingPort", trimmed);
          setValue("destinationPort", trimmed);
          setValue("receivedPort", trimmed);
          if (form.shippingMode === "By Air") setValue("destinationAirportName", trimmed);
          if (form.shippingMode === "By Road") setValue("receivingBorder", trimmed);
        }
      }
      
      setSaveMessage(`New ${type} saved successfully.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Error saving ${type}.`);
    } finally {
      setSavingOrder(false);
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const [customerPinDropdownOpen, setPurchasePinDropdownOpen] = useState(false);
  const [salesPinDropdownOpen, setSalesPinDropdownOpen] = useState(false);
  const [companySelectOpen, setPurchaseCompanySelectOpen] = useState(false);
  const [salesCompanySelectOpen, setSalesCompanySelectOpen] = useState(false);
  const [dbCompanies, setDbCompanies] = useState([]);

  // Account Creation Modal States
  const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false);
  const [createAccountType, setCreateAccountType] = useState("purchase"); // "purchase" | "sales"
  const [createAccountForm, setCreateAccountForm] = useState({
    code: "AUTO",
    name: "",
    kind: "liability",
    currency: "USD",
    parentId: "",
    isControlAccount: false
  });
  const [createAccountLoading, setCreateAccountLoading] = useState(false);
  const [createAccountError, setCreateAccountError] = useState("");

  // Inline Company Creation Modal States
  const [createCompanyModalOpen, setCreateCompanyModalOpen] = useState(false);
  const [createCompanyType, setCreateCompanyType] = useState("purchase"); // "purchase" | "sales"
  const [createCompanyForm, setCreateCompanyForm] = useState({
    name: "",
    legalName: "",
    baseCurrency: "USD"
  });
  const [createCompanyLoading, setCreateCompanyLoading] = useState(false);
  const [createCompanyError, setCreateCompanyError] = useState("");

  // Inline Master-Creation Modal States
  const [newCountryModal, setNewCountryModal] = useState(false);
  const [newCountryForm, setNewCountryForm] = useState({ name: "" });
  const [newCountryLoading, setNewCountryLoading] = useState(false);
  const [newCountryError, setNewCountryError] = useState("");

  const [newPortModal, setNewPortModal] = useState(false);
  const [newPortForm, setNewPortForm] = useState({ portName: "", countryName: "", transportType: "sea", side: "loading" });
  const [newPortError, setNewPortError] = useState("");
  const [newPortLoading, setNewPortLoading] = useState(false);

  const [customVariationModal, setCustomVariationModal] = useState(false);
  const [customVariationForm, setCustomVariationForm] = useState({ goodsName: "", brand: "", size: "", originCountryId: "" });

  const [newGoodModal, setNewGoodModal] = useState(false);
  const [newGoodForm, setNewGoodForm] = useState({ goodsName: "", chsCode: "", size: "", brand: "", originCountryId: "" });
  const [newGoodLoading, setNewGoodLoading] = useState(false);
  const [newGoodError, setNewGoodError] = useState("");

  const renderGlobalInfoCards = () => {
    // Determine logged-in user's branch details
    let loginBranchName = "N/A";
    let loginBranchCode = "N/A";
    let loginCityName = "N/A";
    let loginCountryName = "N/A";

    if (isSuperAdmin) {
      loginBranchName = "Global System";
      loginBranchCode = "GLOBAL-00";
      loginCountryName = "All";
      loginCityName = "Global HQ";
    } else {
      const uCid = activeSession?.countryIds?.[0] || activeSession?.scopes?.countryIds?.[0];
      const uBid = activeSession?.countryBranchIds?.[0] || activeSession?.scopes?.countryBranchIds?.[0];
      const uCbid = activeSession?.cityBranchIds?.[0] || activeSession?.scopes?.cityBranchIds?.[0];

      const c = countries.find(x => x.id === uCid) || allCountries.find(x => x.id === uCid);
      const mb = mainBranches.find(x => x.id === uBid);
      const cb = cityBranches.find(x => x.id === uCbid);

      if (uCbid && cb) {
        loginBranchName = cb.name || cb.city_name;
        loginBranchCode = cb.code || cb.branch_code;
        loginCityName = cb.city_name || cb.name;
        loginCountryName = c?.name || "N/A";
      } else if (uBid && mb) {
        loginBranchName = mb.name;
        loginBranchCode = mb.code;
        loginCityName = "Main Branch";
        loginCountryName = c?.name || "N/A";
      } else if (uCid && c) {
        loginBranchName = `${c.name} Region`;
        loginBranchCode = c.iso2 || "N/A";
        loginCityName = "All Cities";
        loginCountryName = c.name;
      } else {
        // Fallback to what's in the form if lists haven't loaded yet
        loginBranchName = form.branchName;
        loginBranchCode = form.branchCode;
        loginCityName = form.branchCity;
        loginCountryName = form.branchCountry;
      }
    }

    const primaryRole = (activeSession?.roles?.[0] || activeSession?.scopes?.roles?.[0] || "User").replace(/_/g, " ");

    return (
      <div className="w-full mb-4 animate-in fade-in duration-300">
        <div className="bg-card border border-border shadow-md rounded-lg p-3 relative">
          {/* Horizontal Cards row */}
          <div className="z-10 bg-card pb-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">

              {/* Card 1: Branch Login Details */}
              <div className="bg-card border border-border shadow-sm rounded-xl p-3.5 hover:shadow-md hover:border-primary/30 transition duration-200">
                <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-border/60">
                  <span className="p-1 rounded-md bg-primary/10 text-primary dark:bg-primary/20">
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Branch Login Details</h4>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="space-y-0.5 border-b border-border/40 pb-1.5 mb-1.5">
                    <span className="text-muted-foreground block text-[8px] uppercase font-bold">Branch Name</span>
                    <span className="font-black text-primary block truncate text-xs" title={loginBranchName}>{loginBranchName || "N/A"}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Branch Code:</span> <span className="font-semibold text-foreground font-mono">{loginBranchCode || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">User Admin:</span> <span className="font-black text-emerald-600 dark:text-emerald-450 uppercase">{form.userName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">User ID:</span> <span className="font-semibold text-foreground font-mono text-[9px]">{form.userId || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Role:</span> <span className="font-semibold text-foreground capitalize text-[9px]">{primaryRole}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Location:</span> <span className="font-semibold text-foreground truncate" title={`${loginCityName || "N/A"}, ${loginCountryName || "N/A"}`}>{loginCityName || "N/A"}, {loginCountryName || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Country:</span> <span className="font-semibold text-foreground truncate" title={loginCountryName}>{loginCountryName || "N/A"}</span></div>
                </div>
              </div>

              {/* Card 2: Bill Details */}
              <div className="bg-card border border-border shadow-sm rounded-xl p-3.5 hover:shadow-md hover:border-primary/30 transition duration-200">
                <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-border/60">
                  <span className="p-1 rounded-md bg-primary/10 text-primary dark:bg-primary/20">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Bill Details</h4>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Booking Date:</span> <span className="font-semibold text-foreground">{form.salesDate}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fiscal Year:</span> <span className="font-semibold">2025-26</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground font-bold">Booking Branch:</span> <span className="font-bold text-emerald-600 dark:text-emerald-450 truncate" title={loginBranchName}>{loginBranchName || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status:</span> <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-1.5 py-0.2 text-[8px] font-bold text-yellow-600 dark:text-yellow-450 uppercase">{form.salesStatus}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">System Serial:</span> <span className="font-bold text-foreground truncate font-mono" title={form.salesOrderNo}>{form.salesOrderNo}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground font-bold text-primary">Branch Serial:</span> <span className="font-bold text-primary truncate font-mono" title={form.billNo}>{form.billNo}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Contract No:</span> <span className="font-semibold text-foreground truncate font-mono" title={form.salesContractNo}>{form.salesContractNo}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Loading Mode:</span> <span className="font-semibold text-foreground truncate" title={form.shippingMode}>{form.shippingMode || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Origin Country:</span> <span className="font-semibold text-foreground truncate" title={form.origin || form.branchCountry}>{form.origin || form.branchCountry || "N/A"}</span></div>
                </div>
              </div>

              {/* Card 3: Sales Account Details */}
              <div className="bg-card border border-border shadow-sm rounded-xl p-3.5 hover:shadow-md hover:border-primary/30 transition duration-200">
                <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-border/60">
                  <span className="p-1 rounded-md bg-primary/10 text-primary dark:bg-primary/20">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Sales Account (CR)</h4>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Account Code:</span> <span className="font-bold text-foreground truncate block w-full text-right font-mono" title={form.salesAccountNo}>{form.salesAccountNo}</span></div>
                  <div className="space-y-0.5 pt-1">
                    <span className="text-muted-foreground block text-[9px]">Account Name:</span>
                    <span className="font-semibold text-foreground block truncate text-xs text-primary" title={form.salesAccountName}>{form.salesAccountName}</span>
                  </div>
                  <div className="flex justify-between pt-1"><span className="text-muted-foreground">Branch:</span> <span className="font-semibold text-foreground truncate" title={form.salesAccountBranch}>{form.salesAccountBranch}</span></div>
                  <div className="flex justify-between pt-0.5"><span className="text-muted-foreground">Currency:</span> <span className="font-bold text-foreground">{form.salesAccountCurrency || form.salesCurrency || form.secondaryCurrency || "-"}</span></div>
                  <div className="flex justify-between items-center pt-0.5 border-t border-border/20 mt-1 relative" ref={salesCompanyDropdownRef}>
                    <span className="text-muted-foreground font-semibold">Company:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-foreground truncate max-w-[100px] text-[8.5px] text-right font-mono" title={form.salesCompanyName ? `${form.salesCompanyName} (${form.salesCompanyCode || "COM-N/A"})` : "None"}>
                        {form.salesCompanyName ? `${form.salesCompanyName} (${form.salesCompanyCode || "COM-N/A"})` : "None"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSalesCompanySelectOpen(prev => !prev)}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors shrink-0"
                        title="Select Company"
                      >
                        <Pin className={`h-2.5 w-2.5 ${salesCompanySelectOpen ? "text-primary fill-primary/25" : ""}`} />
                      </button>
                    </div>

                    {salesCompanySelectOpen && (
                      <div className="absolute right-0 top-6 w-48 rounded-xl bg-card border border-border shadow-2xl z-[60] p-1.5 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                        <div className="px-2 py-0.5 text-[8px] font-black uppercase text-primary tracking-wider border-b border-border/40 mb-1">
                          Select Company
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-0.5 scrollbar-thin">
                          {dbCompanies.length === 0 ? (
                            <div className="px-2 py-2 text-center text-muted-foreground text-[8px] italic">
                              No companies found.
                            </div>
                          ) : (
                            dbCompanies.map((c) => {
                              const cCode = "COM-" + c.name.slice(0, 3).toUpperCase();
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setValue("salesCompanyId", c.id);
                                    setValue("salesCompanyName", c.name);
                                    setValue("salesCompanyCode", cCode);
                                    setSalesCompanySelectOpen(false);
                                  }}
                                  className="w-full text-left px-2 py-0.5 rounded hover:bg-muted text-[8.5px] text-foreground font-semibold truncate block"
                                  title={c.name}
                                 >
                                   {c.name} ({cCode})
                                 </button>
                               );
                             })
                           )}
                         </div>
                       </div>
                     )}
                   </div>
                </div>
              </div>

              {/* Card 4: Customer Account Details */}
              <div className="bg-card border border-border shadow-sm rounded-xl p-3.5 hover:shadow-md hover:border-primary/30 transition duration-200">
                <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-border/60">
                  <span className="p-1 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/30">
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Customer Account (DR)</h4>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Code:</span>
                    <span className="font-bold text-foreground truncate block font-mono text-right" title={form.customerAccountNo}>{form.customerAccountNo || "N/A"}</span>
                  </div>
                  <div className="space-y-0.5 pt-1">
                    <span className="text-muted-foreground block text-[9px]">Account Name:</span>
                    <span className="font-semibold text-rose-700 dark:text-rose-400 block truncate text-xs" title={form.customerAccountName}>{form.customerAccountName || "N/A"}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Branch:</span>
                    <span className="font-semibold text-foreground truncate" title={form.customerAccountBranch}>{form.customerAccountBranch || "N/A"}</span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-muted-foreground">Currency:</span>
                    <span className="font-bold text-foreground">{form.customerAccountCurrency || form.salesCurrency || form.secondaryCurrency || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center pt-0.5 border-t border-border/20 mt-1">
                    <span className="text-muted-foreground font-semibold">Company:</span>
                    <span className="font-bold text-foreground truncate max-w-[120px] text-[8.5px] text-right font-mono" title={form.salesCompanyName || "None"}>
                      {form.salesCompanyName || "None"}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-2 text-foreground bg-background mt-[-10px] max-w-[1500px] mx-auto">
      {isSuperAdmin && (!form.countryId || !form.countryBranchId || !scopeConfirmed) ? (
        <SimpleModal
          isOpen={true}
          onClose={() => {}} // Cannot close without selecting
          title="Super Admin: Select Working Scope"
          width="md"
        >
          <div className="space-y-4 p-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Please select the Country, Branch, and City Branch you want to work in for Sales Orders.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black">Country</label>
                <select
                  value={form.countryId || ""}
                  onChange={(e) => {
                    const country = countries.find(c => c.id === e.target.value);
                    setForm(p => ({
                      ...p,
                      countryId: e.target.value,
                      countryBranchId: "",
                      cityBranchId: "",
                      currencyType: "USD",
                      salesCurrency: country ? country.currency_code : p.salesCurrency,
                      secondaryCurrency: country ? country.currency_code : p.secondaryCurrency,
                      paymentCurrency: country ? country.currency_code : p.paymentCurrency
                    }));
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                >
                  <option value="">Select Country...</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.currency_code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-black">Branch</label>
                <select
                  value={form.countryBranchId || ""}
                  onChange={(e) => setForm(p => ({ ...p, countryBranchId: e.target.value, cityBranchId: "" }))}
                  disabled={!form.countryId}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                >
                  <option value="">Select Branch...</option>
                  {mainBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-black">City Branch</label>
                <select
                  value={form.cityBranchId || ""}
                  onChange={(e) => setForm(p => ({ ...p, cityBranchId: e.target.value }))}
                  disabled={!form.countryBranchId}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none"
                >
                  <option value="">Select City Branch...</option>
                  {cityBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.city_name || b.name} ({b.code || b.branch_code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                onClick={() => setScopeConfirmed(true)}
                disabled={!form.countryId || !form.countryBranchId}
                className="bg-primary text-primary-foreground font-bold h-8 text-xs px-6"
              >
                Confirm Scope
              </Button>
            </div>
          </div>
        </SimpleModal>
      ) : (
        <>
          {titlePortal && actionsPortal ? (
            <>
              {createPortal(
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h2 className="text-[11px] sm:text-xs font-black tracking-tight uppercase text-foreground">
                      Sales Booking Order
                    </h2>
                  </div>
                  <div className="h-4 w-px bg-border/60"></div>
                  <h2 className="text-[11px] sm:text-xs font-black tracking-tight uppercase text-primary/80">
                    Sales Booking Report
                  </h2>
                </div>,
                titlePortal
              )}
              {createPortal(
                <div className="flex items-center gap-1.5 shrink-0 relative" ref={dropdownRef}>
                  <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border/50 mr-2">
                    <button type="button" onClick={() => setActiveTab("booking")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "booking" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>1 Booking</button>
                    <button type="button" onClick={() => setActiveTab("goods")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "goods" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>2 Goods</button>
                    <button type="button" onClick={() => setActiveTab("others")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "others" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>3 Others</button>
                    <button type="button" onClick={() => setActiveTab("reports_tab")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "reports_tab" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>4 Reports</button>
                    <button type="button" onClick={() => setActiveTab("report")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "report" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>5 Verify</button>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1 border border-border/50 mr-1">
                    <span className="relative flex h-2 w-2 ml-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pr-1">Live</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-1 h-7.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md font-bold text-[10px]"
                  >
                    + New
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setReportSaved(!!form.orderReportRemarks);
                      setIsTransferred(false);
                      setActiveTab("report");
                    }}
                    className="flex items-center gap-1 h-7.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md font-bold text-[10px]"
                  >
                    <FileText className="h-3.5 w-3.5" /> Report
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
                    className="flex items-center gap-1 h-7.5 px-2 bg-slate-800 text-white hover:bg-slate-700 transition"
                  >
                    Actions <ChevronDown className="h-3 w-3" />
                  </Button>

                  {viewDropdownOpen && (
                    <div className="absolute right-0 top-8.5 w-48 rounded-xl bg-card border border-border shadow-2xl z-50 p-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        type="button"
                        onClick={() => {
                          setViewDropdownOpen(false);
                          handleReset();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
                      >
                        <span className="h-3.5 w-3.5 flex items-center justify-center font-bold text-sm text-primary">+</span>
                        <span>New Booking</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewDropdownOpen(false);
                          setGoodsEntries([]);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-left transition"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        <span>Clear Goods</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewDropdownOpen(false);
                          setIsFormOpen(false);
                          handleReset();
                          if (searchParams.get("id") || searchParams.get("salesOrderNo")) {
                            router.push("/dashboard/sales/sales-booking-register");
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900 text-left transition border-b border-border/40 pb-2 mb-1"
                      >
                        <X className="h-3.5 w-3.5 text-slate-500" />
                        <span>Close Form</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewDropdownOpen(false);
                          window.print();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition border-b border-border/40 pb-2 mb-1"
                      >
                        <Printer className="h-3.5 w-3.5 text-blue-500" />
                        <span>Print Screen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewDropdownOpen(false);
                          setPreviewModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
                      >
                        <Eye className="h-3.5 w-3.5 text-sky-500" />
                        <span>Open Large Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewDropdownOpen(false);
                          handleOpenA4Report(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition border-b border-border/40 pb-2 mb-1"
                      >
                        <Download className="h-3.5 w-3.5 text-blue-500" />
                        <span>Open A4 / PDF Template</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setViewDropdownOpen(false);
                          setReportSaved(!!form.orderReportRemarks);
                          setIsTransferred(false);
                          setActiveTab("report");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition border-b border-border/40 pb-2 mb-1"
                      >
                        <Eye className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">View / Check Entry</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewDropdownOpen(false);
                          handleSaveSalesOrder(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
                      >
                        <Save className="h-3.5 w-3.5 text-blue-500" />
                        <span>Save Draft</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewDropdownOpen(false);
                          handleSaveSalesOrder(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Save & Close</span>
                      </button>
                    </div>
                  )}
                </div>,
                actionsPortal
              )}
            </>
          ) : (
            <div className="pb-2 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h2 className="text-[11px] sm:text-xs font-black tracking-tight uppercase text-foreground">
                    Sales Booking Order
                  </h2>
                </div>
                <div className="h-4 w-px bg-border/60"></div>
                <h2 className="text-[11px] sm:text-xs font-black tracking-tight uppercase text-primary/80">
                  Sales Booking Report
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 relative" ref={dropdownRef}>
                <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border/50 mr-2">
                  <button type="button" onClick={() => setActiveTab("booking")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "booking" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>1 Booking</button>
                  <button type="button" onClick={() => setActiveTab("goods")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "goods" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>2 Goods</button>
                  <button type="button" onClick={() => setActiveTab("others")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "others" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>3 Others</button>
                  <button type="button" onClick={() => setActiveTab("reports_tab")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "reports_tab" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>4 Reports</button>
                  <button type="button" onClick={() => setActiveTab("report")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "report" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>5 Verify</button>
                </div>
                <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1 border border-border/50 mr-1">
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pr-1">Live</span>
                </div>
                <Button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1 h-7.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md font-bold text-[10px]"
                >
                  + New
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setReportSaved(!!form.orderReportRemarks);
                    setIsTransferred(false);
                    setActiveTab("report");
                  }}
                  className="flex items-center gap-1 h-7.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md font-bold text-[10px]"
                >
                  <FileText className="h-3.5 w-3.5" /> Report
                </Button>
                <Button
                  type="button"
                  onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
                  className="flex items-center gap-1 h-7.5 px-2 bg-slate-800 text-white hover:bg-slate-700 transition"
                >
                  Actions <ChevronDown className="h-3 w-3" />
                </Button>

                {viewDropdownOpen && (
                  <div className="absolute right-0 top-8.5 w-48 rounded-xl bg-card border border-border shadow-2xl z-50 p-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      type="button"
                      onClick={() => {
                        setViewDropdownOpen(false);
                        handleReset();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
                    >
                      <span className="h-3.5 w-3.5 flex items-center justify-center font-bold text-sm text-primary">+</span>
                      <span>New Booking</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewDropdownOpen(false);
                        setGoodsEntries([]);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-left transition"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      <span>Clear Goods</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewDropdownOpen(false);
                        setIsFormOpen(false);
                        handleReset();
                        if (searchParams.get("id") || searchParams.get("salesOrderNo")) {
                          router.push("/dashboard/sales/sales-booking-register");
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900 text-left transition border-b border-border/40 pb-2 mb-1"
                    >
                      <X className="h-3.5 w-3.5 text-slate-500" />
                      <span>Close Form</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewDropdownOpen(false);
                        window.print();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition border-b border-border/40 pb-2 mb-1"
                    >
                      <Printer className="h-3.5 w-3.5 text-blue-500" />
                      <span>Print Screen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewDropdownOpen(false);
                        setPreviewModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
                    >
                      <Eye className="h-3.5 w-3.5 text-sky-500" />
                      <span>Open Large Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewDropdownOpen(false);
                        handleOpenA4Report(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition border-b border-border/40 pb-2 mb-1"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-500" />
                      <span>Open A4 / PDF Template</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setViewDropdownOpen(false);
                        setReportSaved(!!form.orderReportRemarks);
                        setIsTransferred(false);
                        setActiveTab("report");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition border-b border-border/40 pb-2 mb-1"
                    >
                      <Eye className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">View / Check Entry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewDropdownOpen(false);
                        handleSaveSalesOrder(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
                    >
                      <Save className="h-3.5 w-3.5 text-blue-500" />
                      <span>Save Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewDropdownOpen(false);
                        handleSaveSalesOrder(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Save & Close</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "report" && isMounted && document.getElementById("erp-page-actions-slot") && createPortal(
            <>
              {!isTransferred && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleTransfer}
                    disabled={savingOrder || isTransferred}
                    className="h-10 text-[11px] font-black tracking-wider uppercase px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_14px_0_rgb(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <CheckCircle2 className="h-4 w-4"/> CONFIRM & TRANSFER
                  </Button>
                </div>
              )}
            </>,
            document.getElementById("erp-page-actions-slot")
          )}

          {activeTab !== "report" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-0 items-start w-full">
              <section className="lg:col-span-9 space-y-4 order-2 lg:order-2 mt-4">
                {/* GLOBAL INFO CARDS (Always visible at top) */}
                {renderGlobalInfoCards()}

                {/* LOT STOCK PANEL */}
                {lotPanelOpen && (
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 border-b border-border pb-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Lot Stock Panel</p>
                        <h4 className="text-sm font-black text-foreground">{selectedSaleSource.label}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={lotSearch}
                          onChange={(e) => setLotSearch(e.target.value)}
                          placeholder="Search lot no, goods, stock ref..."
                          className="h-8 w-56 rounded-lg border border-input bg-background px-3 text-[10px] outline-none focus:border-primary"
                        />
                        <button type="button" onClick={() => setLotPanelOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-[10px] text-foreground border-collapse text-left whitespace-nowrap">
                        <thead className="bg-slate-950 text-white">
                          <tr className="font-bold uppercase tracking-wider text-[9px]">
                            <th className="px-3 py-2.5 text-left">Lot No</th>
                            <th className="px-3 py-2.5 text-left">Goods / Brand</th>
                            <th className="px-3 py-2.5 text-right">Available</th>
                            <th className="px-3 py-2.5 text-right">Net KG</th>
                            <th className="px-3 py-2.5 text-left">Location</th>
                            <th className="px-3 py-2.5 text-left">Status</th>
                            <th className="px-3 py-2.5 text-center w-36">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSaleLots.map((lot) => {
                            const isChecked = checkedLotNo === lot.lotNo;
                            const deductions = MOCK_LOT_DEDUCTIONS[lot.lotNo] || [];
                            const totalDeductedQty = deductions.reduce((sum, d) => sum + d.quantity, 0);
                            const totalDeductedWeight = deductions.reduce((sum, d) => sum + d.weight, 0);
                            const originalQty = lot.availableQty + totalDeductedQty;
                            const originalWeight = lot.netWeight + totalDeductedWeight;
                            return (
                              <React.Fragment key={lot.lotNo}>
                                <tr className="border-t border-border hover:bg-sky-50/50 transition">
                                  <td className="px-3 py-2.5 font-black text-primary">
                                    {lot.lotNo}
                                    <div className="text-[9px] font-semibold text-muted-foreground font-mono">{lot.stockRef}</div>
                                  </td>
                                  <td className="px-3 py-2.5 font-bold text-foreground">
                                    {lot.goodsName}
                                    <div className="text-[9px] font-semibold text-muted-foreground">{lot.brand} / {lot.size} / {lot.origin}</div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-black">{Number(lot.availableQty || 0).toLocaleString()} {lot.qtyName}</td>
                                  <td className="px-3 py-2.5 text-right font-mono font-bold">{Number(lot.netWeight || 0).toLocaleString()}</td>
                                  <td className="px-3 py-2.5 text-muted-foreground">{lot.location}</td>
                                  <td className="px-3 py-2.5"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">{lot.status}</span></td>
                                  <td className="px-3 py-2.5 text-center">
                                    <div className="flex gap-1.5 justify-center items-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          applySaleLot(lot);
                                          setLotPanelOpen(false);
                                        }}
                                        className="rounded-lg bg-sky-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-sm hover:bg-sky-700 transition shrink-0"
                                      >
                                        Use Lot
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCheckedLotNo(checkedLotNo === lot.lotNo ? null : lot.lotNo);
                                        }}
                                        className="rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition shrink-0"
                                      >
                                        {checkedLotNo === lot.lotNo ? "Hide" : "Check Stock"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {isChecked && (
                                  <tr className="bg-slate-50/70 border-t border-b border-slate-250 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <td colSpan={7} className="px-4 py-3 bg-slate-50/50">
                                      <div className="space-y-2.5 max-w-[95%] mx-auto">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                                          <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                                            Stock Utilization History & Balance for {lot.lotNo}
                                          </h5>
                                          <div className="text-[9px] font-bold text-slate-500">
                                            Original Capacity: <span className="font-mono text-slate-800">{originalQty.toLocaleString()} {lot.qtyName}</span> ({originalWeight.toLocaleString()} KG)
                                          </div>
                                        </div>

                                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                          <table className="w-full text-[9px] text-slate-700 border-collapse">
                                            <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[8px] border-b border-slate-200">
                                              <tr>
                                                <th className="px-3 py-1.5 text-left">Transaction Ref</th>
                                                <th className="px-3 py-1.5 text-left">Sale Date</th>
                                                <th className="px-3 py-1.5 text-left">Customer / Debtor</th>
                                                <th className="px-3 py-1.5 text-right">Qty Deducted</th>
                                                <th className="px-3 py-1.5 text-right">Weight Deducted</th>
                                                <th className="px-3 py-1.5 text-left">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {/* Initial import/purchase record */}
                                              <tr className="border-b border-slate-100 font-semibold bg-emerald-50/20 text-emerald-800">
                                                <td className="px-3 py-1.5 font-mono">{lot.stockRef}</td>
                                                <td className="px-3 py-1.5">Intake Date</td>
                                                <td className="px-3 py-1.5 italic text-emerald-700">Initial Import / Stock Inbound</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-600">+{originalQty.toLocaleString()}</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-600">+{originalWeight.toLocaleString()} KG</td>
                                                <td className="px-3 py-1.5"><span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded">Inbound</span></td>
                                              </tr>

                                              {/* Deduction history */}
                                              {deductions.map((d, dIdx) => (
                                                <tr key={dIdx} className="border-b border-slate-100 text-red-800 hover:bg-slate-50/50 transition">
                                                  <td className="px-3 py-1.5 font-mono font-bold">{d.reference}</td>
                                                  <td className="px-3 py-1.5">{d.date}</td>
                                                  <td className="px-3 py-1.5 font-semibold text-slate-800">{d.customer}</td>
                                                  <td className="px-3 py-1.5 text-right font-mono font-bold">-{d.quantity.toLocaleString()}</td>
                                                  <td className="px-3 py-1.5 text-right font-mono font-bold">-{d.weight.toLocaleString()} KG</td>
                                                  <td className="px-3 py-1.5"><span className="text-[8px] font-black uppercase bg-red-100 text-red-800 px-1 py-0.5 rounded">Sold Out</span></td>
                                                </tr>
                                              ))}

                                              {/* Total Sold Summary row */}
                                              {deductions.length > 0 && (
                                                <tr className="bg-slate-50/50 border-t border-slate-150 font-bold">
                                                  <td colSpan={3} className="px-3 py-1.5 text-right text-slate-500 uppercase tracking-wider text-[8px]">Total Outward Deductions:</td>
                                                  <td className="px-3 py-1.5 text-right font-mono text-red-600 font-black">-{totalDeductedQty.toLocaleString()} {lot.qtyName}</td>
                                                  <td className="px-3 py-1.5 text-right font-mono text-red-600 font-black">-{totalDeductedWeight.toLocaleString()} KG</td>
                                                  <td className="px-3 py-1.5 text-slate-400 font-semibold">—</td>
                                                </tr>
                                              )}

                                              {/* Net Remaining Balance row */}
                                              <tr className="bg-sky-50 border-t border-slate-200 font-black text-sky-950">
                                                <td colSpan={3} className="px-3 py-1.5 text-right uppercase tracking-wider text-[8px]">Net Available Balance:</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-[10px] font-black text-sky-700">{lot.availableQty.toLocaleString()} {lot.qtyName}</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-[10px] font-black text-sky-700">{lot.netWeight.toLocaleString()} KG</td>
                                                <td className="px-3 py-1.5"><span className="text-[8px] font-black uppercase bg-sky-200 text-sky-800 px-1 py-0.5 rounded animate-pulse">Live Stock</span></td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                          {filteredSaleLots.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground italic font-semibold">
                                No lots found for this source.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* GOODS LIST TABLE */}
                {(activeTab === "goods" || activeTab === "others") && (
                  <div className="mt-4">
                    <div className="overflow-x-auto rounded-lg border border-border bg-background shadow-sm">
                      <table className="w-full text-[9px] text-foreground border-collapse text-left whitespace-nowrap">
                        <thead>
                          <tr className="bg-muted/80 text-muted-foreground border-b border-border font-bold uppercase tracking-wider">
                            <th className="px-3 py-2.5 text-center w-8">#</th>
                            <th className="px-3 py-2.5">Goods Name</th>
                            <th className="px-3 py-2.5 text-center">Size</th>
                            <th className="px-3 py-2.5 text-center">Brand</th>
                            <th className="px-3 py-2.5 text-center">HS Code</th>
                            <th className="px-3 py-2.5 text-center">Origin</th>
                            <th className="px-3 py-2.5 text-right">Qty</th>
                            <th className="px-3 py-2.5 text-center">Unit</th>
                            <th className="px-3 py-2.5 text-right">Price ({form.currencyType || "USD"})</th>
                            <th className="px-3 py-2.5 text-right">Amount ({form.currencyType || "USD"})</th>
                            <th className="px-3 py-2.5 text-center">Ex. Rate</th>
                            <th className="px-3 py-2.5 text-right bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Final ({form.secondaryCurrency || "PKR"})</th>
                            <th className="px-3 py-2.5 text-center w-10">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {goodsEntries.length === 0 ? (
                            <tr>
                              <td colSpan={13} className="px-3 py-6 text-center text-muted-foreground italic font-semibold text-[10px]">
                                No goods added yet. Add an item above to see it here.
                              </td>
                            </tr>
                          ) : (
                            goodsEntries.map((row, index) => (
                              <tr key={index} className="border-t border-border hover:bg-muted/50 transition">
                                <td className="px-3 py-2 text-center font-mono text-muted-foreground">{index + 1}</td>
                                <td className="px-3 py-2 font-black text-primary">{row.goodsName}</td>
                                <td className="px-3 py-2 text-center font-semibold">{row.size}</td>
                                <td className="px-3 py-2 text-center font-semibold">{row.brand}</td>
                                <td className="px-3 py-2 text-center font-mono text-muted-foreground">{row.hsCode}</td>
                                <td className="px-3 py-2 text-center font-semibold">{row.origin}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold">{row.qtyNo.toLocaleString()}</td>
                                <td className="px-3 py-2 text-center font-semibold">{row.qtyName}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-muted-foreground">{row.coursePrice.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-mono font-black text-yellow-600 dark:text-yellow-450">{row.totalAmount.toLocaleString()}</td>
                                <td className="px-3 py-2 text-center font-mono text-muted-foreground">{row.op || "*"} {row.exchangeRate}</td>
                                <td className="px-3 py-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                                  {row.finalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleViewGoodsEntry(index)}
                                      className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-bold transition-colors"
                                      title="View"
                                    >
                                      <Eye className="h-3 w-3" /> View
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleEditGoodsEntry(index)}
                                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[9px] font-bold transition-colors shadow-sm border border-blue-200"
                                      title="Edit"
                                    >
                                      <Edit3 className="h-3 w-3" /> Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setGoodsEntries(prev => prev.filter((_, idx) => idx !== index))}
                                      className="flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[9px] font-bold transition-colors shadow-sm border border-red-100"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <main className="lg:col-span-3 space-y-3 flex flex-col order-1 lg:order-1 mt-4">

              {activeTab === "booking" && (
                <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="space-y-3 order-2 w-full mt-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Sales Booking / Bill Info</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="relative" ref={customerDropdownRef}>
                      <label className="block text-[10px] font-bold text-foreground mb-1">Customer Account (DR)*</label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder={form.customerAccountName ? formatAccountDisplayLabel(form.customerAccountName, form.customerAccountNo, form.customerAccountManualReferenceNumber) : "Search Code, Name, Branch, Manual A/C..."}
                          value={customerDropdownOpen ? customerSearch : (form.customerAccountName ? formatAccountDisplayLabel(form.customerAccountName, form.customerAccountNo, form.customerAccountManualReferenceNumber) : form.customerAccountNo || "")}
                          onChange={(e) => handleTextChange("purchase", e.target.value)}
                          onFocus={() => {
                            setPurchaseDropdownOpen(true);
                            setPurchasePinDropdownOpen(false);
                            setPurchaseSearch("");
                          }}
                          className="w-full bg-background border border-input rounded pl-2.5 pr-8 py-1.5 text-foreground font-semibold outline-none focus:border-primary text-xs h-9"
                        />
                        <button
                          type="button"
                          disabled={!form.customerId}
                          onClick={() => {
                            setPurchasePinDropdownOpen(prev => !prev);
                            setPurchaseDropdownOpen(false);
                          }}
                          className="absolute right-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                        >
                          <Pin className={`h-3.5 w-3.5 ${customerPinDropdownOpen ? "text-primary rotate-45" : ""}`} />
                        </button>
                      </div>

                      {customerDropdownOpen && (
                        <div className="absolute left-0 mt-1.5 w-full min-w-[290px] sm:min-w-[440px] md:min-w-[520px] rounded-2xl bg-card border-2 border-primary/40 shadow-2xl z-[80] p-2 overflow-hidden backdrop-blur-md">
                          <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/5 rounded-lg mb-1.5 border border-primary/10">
                            <span className="text-[10px] font-black uppercase text-primary tracking-wider">Select Customer Account (DR)</span>
                            <span className="text-[9px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, customerSearch)).length} found
                            </span>
                          </div>
                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, customerSearch)).map((acc) => {
                              const compName = acc.companyName || acc.company_name || (acc.companyId && dbCompanies.find(c => c.id === acc.companyId)?.name) || dbCompanies[0]?.name || "None";
                              return (
                                <button
                                  key={acc.accountCode}
                                  type="button"
                                  onClick={() => {
                                    applyAccountMaster("purchase", acc);
                                    setPurchaseDropdownOpen(false);
                                    setPurchaseSearch("");
                                  }}
                                  className="w-full text-left p-2.5 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition duration-150 group bg-background/60"
                                >
                                  <div className="flex justify-between items-start gap-2 mb-1">
                                    <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{formatAccountDisplayLabel(acc.accountName, acc.accountCode, acc.manualReferenceNumber)}</span>
                                    <span className="font-mono text-[9.5px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">System: {acc.accountCode}</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[9px] text-muted-foreground">
                                    <div><span className="font-semibold text-foreground/80">Branch:</span> {acc.cityBranchName || "Main Branch"}</div>
                                    <div>
                                      {acc.manualReferenceNumber && (
                                        <div className="mb-0.5"><span className="font-semibold text-foreground/80">Manual A/C:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{acc.manualReferenceNumber}</span></div>
                                      )}
                                      <div><span className="font-semibold text-foreground/80">Curr:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{acc.ledgerCurrency || "PKR"}</span></div>
                                    </div>
                                    <div><span className="font-semibold text-foreground/80">Company:</span> <span className="truncate inline-block max-w-[120px] align-bottom">{compName}</span></div>
                                  </div>
                                </button>
                              );
                            })}
                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, customerSearch)).length === 0 && (
                              <div className="p-4 text-center text-muted-foreground text-xs italic">
                                No matching accounts found. Try searching by Code, Name, Currency, or Phone.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative" ref={salesDropdownRef}>
                      <label className="block text-[10px] font-bold text-foreground mb-1">Sales Account (CR)*</label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder={form.salesAccountName ? formatAccountDisplayLabel(form.salesAccountName, form.salesAccountNo, form.salesAccountManualReferenceNumber) : "Search Code, Name, Branch, Manual A/C..."}
                          value={salesDropdownOpen ? salesSearch : (form.salesAccountName ? formatAccountDisplayLabel(form.salesAccountName, form.salesAccountNo, form.salesAccountManualReferenceNumber) : form.salesAccountNo || "")}
                          onChange={(e) => handleTextChange("sales", e.target.value)}
                          onFocus={() => {
                            setSalesDropdownOpen(true);
                            setSalesPinDropdownOpen(false);
                            setSalesSearch("");
                          }}
                          className="w-full bg-background border border-input rounded pl-2.5 pr-8 py-1.5 text-foreground font-semibold outline-none focus:border-primary text-xs h-9"
                        />
                        <button
                          type="button"
                          disabled={!form.customerId}
                          onClick={() => {
                            setSalesPinDropdownOpen(prev => !prev);
                            setSalesDropdownOpen(false);
                          }}
                          className="absolute right-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                        >
                          <Pin className={`h-3.5 w-3.5 ${salesPinDropdownOpen ? "text-primary rotate-45" : ""}`} />
                        </button>
                      </div>
                      {salesDropdownOpen && (
                        <div className="absolute left-0 mt-1.5 w-full min-w-[290px] sm:min-w-[440px] md:min-w-[520px] rounded-2xl bg-card border-2 border-primary/40 shadow-2xl z-[80] p-2 overflow-hidden backdrop-blur-md">
                          <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/5 rounded-lg mb-1.5 border border-primary/10">
                            <span className="text-[10px] font-black uppercase text-primary tracking-wider">Select Sales Account (CR)</span>
                            <span className="text-[9px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, salesSearch)).length} found
                            </span>
                          </div>
                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, salesSearch)).map((acc) => {
                              const compName = acc.companyName || acc.company_name || (acc.companyId && dbCompanies.find(c => c.id === acc.companyId)?.name) || dbCompanies[0]?.name || "None";
                              return (
                                <button
                                  key={acc.accountCode}
                                  type="button"
                                  onClick={() => {
                                    applyAccountMaster("sales", acc);
                                    setSalesDropdownOpen(false);
                                    setSalesSearch("");
                                  }}
                                  className="w-full text-left p-2.5 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition duration-150 group bg-background/60"
                                >
                                  <div className="flex justify-between items-start gap-2 mb-1">
                                    <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{formatAccountDisplayLabel(acc.accountName, acc.accountCode, acc.manualReferenceNumber)}</span>
                                    <span className="font-mono text-[9.5px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">System: {acc.accountCode}</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[9px] text-muted-foreground">
                                    <div><span className="font-semibold text-foreground/80">Branch:</span> {acc.cityBranchName || "Main Branch"}</div>
                                    <div>
                                      {acc.manualReferenceNumber && (
                                        <div className="mb-0.5"><span className="font-semibold text-foreground/80">Manual A/C:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{acc.manualReferenceNumber}</span></div>
                                      )}
                                      <div><span className="font-semibold text-foreground/80">Curr:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{acc.ledgerCurrency || "PKR"}</span></div>
                                    </div>
                                    <div><span className="font-semibold text-foreground/80">Company:</span> <span className="truncate inline-block max-w-[120px] align-bottom">{compName}</span></div>
                                  </div>
                                </button>
                              );
                            })}
                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, salesSearch)).length === 0 && (
                              <div className="p-4 text-center text-muted-foreground text-xs italic">
                                No matching accounts found. Try searching by Code, Name, Currency, or Phone.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Contract No</label>
                        <input
                          type="text"
                          value={form.salesContractNo}
                          onChange={(e) => setValue("salesContractNo", e.target.value)}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] h-8 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Contract / Booking Date</label>
                        <input
                          type="date"
                          value={form.salesDate}
                          onChange={(e) => setValue("salesDate", e.target.value)}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] h-8 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Invoice / Payment Select</label>
                        <select
                          value={form.paymentType}
                          onChange={(e) => setValue("paymentType", e.target.value)}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] h-8"
                        >
                          {PAYMENT_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Ship Option</label>
                        <select
                          value={form.shippingMode}
                          onChange={(e) => {
                            const mode = e.target.value;
                            setValue("shippingMode", mode);
                            setValue("shipmentType", mode === "By Sea" ? "By Ship" : mode);
                          }}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] h-8"
                        >
                          {LOADING_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Status</label>
                        <select
                          value={form.salesStatus}
                          onChange={(e) => setValue("salesStatus", e.target.value)}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] h-8"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Transferred">Transferred</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-[10px] text-muted-foreground mb-1">Booking Remarks / Terms</label>
                      <textarea
                        rows={2}
                        value={form.remarks}
                        onChange={(e) => setValue("remarks", e.target.value)}
                        placeholder="Write booking terms, payment notes, invoice note, or shipping instruction..."
                        className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
                    <Button
                      type="button"
                      onClick={() => setActiveTab("goods")}
                      className="w-full font-bold h-10 rounded-lg text-xs uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow"
                    >
                      Next: Goods Entry
                    </Button>
                  </div>
                </fieldset>
              )}

              {activeTab === "goods" && (
                <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="space-y-3 order-2 w-full mt-0 rounded-2xl border border-border bg-card p-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                      GOODS ENTRY
                    </h3>
                  </div>
                  
                  <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 font-bold mb-1">Sale Source / Lot Selection</p>
                    <select
                      value={form.saleSource || "booking"}
                      onChange={(e) => openSaleSource(e.target.value)}
                      className="w-full bg-background border border-input rounded px-3 py-2 text-foreground font-bold outline-none focus:border-primary text-xs h-10 mt-2 shadow-sm"
                    >
                      <option value="booking">Booking Sale (Fresh Booking)</option>
                      <option value="in_transit">In-Transit Lot (Cargo on Route)</option>
                      <option value="local">Local Purchase (Purchased Locally)</option>
                      <option value="warehouse">Warehouse Stock (In Whse)</option>
                      <option value="endorse">Endorse Stock (Traceable Stock)</option>
                    </select>
                    {form.saleSource && form.saleSource !== "booking" && (
                      <button
                        type="button"
                        onClick={() => setLotPanelOpen(prev => !prev)}
                        className="mt-2.5 w-full h-8 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded text-[10px] shadow transition uppercase tracking-wider"
                      >
                        {lotPanelOpen ? "Close Stock Panel" : "View / Open Stock Lots"}
                      </button>
                    )}

                    {selectedSaleLot ? (
                      <div className="mt-3 space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[10px]">
                        <div>
                          <span className="text-emerald-700 font-bold block uppercase text-[8px]">Selected Lot:</span>
                          <span className="font-black text-foreground text-xs">{selectedSaleLot.lotNo}</span>
                        </div>
                        <div className="flex justify-between border-t border-emerald-100/50 pt-1.5">
                          <span className="text-emerald-700 font-semibold">Goods:</span>
                          <span className="font-bold text-foreground truncate max-w-[120px]">{selectedSaleLot.goodsName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-700 font-semibold">Available Qty:</span>
                          <span className="font-black text-foreground font-mono">{Number(selectedSaleLot.availableQty || 0).toLocaleString()} {selectedSaleLot.qtyName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-700 font-semibold">Net Weight:</span>
                          <span className="font-black text-foreground font-mono">{Number(selectedSaleLot.netWeight || 0).toLocaleString()} KG</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-700 font-semibold">Stock Ref:</span>
                          <span className="font-bold text-foreground font-mono">{selectedSaleLot.stockRef}</span>
                        </div>
                      </div>
                    ) : (
                      form.saleSource !== "booking" && (
                        <div className="mt-3 rounded-xl border border-dashed border-sky-300 bg-white/60 p-2.5 text-[10px] font-semibold text-sky-700 leading-relaxed">
                          Please open stock lots to copy and use an available cargo lot for this sales entry.
                        </div>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Manual Net KGs Input */}
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1">Net KGs (Weight)</label>
                      <input
                        type="number"
                        value={form.netWeight !== undefined && form.netWeight !== "" ? form.netWeight : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setValue("netWeight", val === "" ? "" : Number(val));
                          setValue("manualTotalAmount", "");
                          setValue("manualFinalAmount", "");
                        }}
                        className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] font-mono font-bold"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1">Origin Country</label>
                      <select
                        value={form.origin || ""}
                        onChange={(e) => setValue("origin", e.target.value)}
                        className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                      >
                        <option value="">Select Origin</option>
                        {Array.from(new Set([
                          "United Arab Emirates", "Iran", "USA", "Vietnam", "Pakistan", "India", "Afghanistan", "China", "Turkey",
                          ...allCountries.map(c => c.name).filter(Boolean),
                          ...transitCountryOptions.map(c => c.name).filter(Boolean),
                          form.origin
                        ].filter(Boolean))).sort().map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <label className="block text-[10px] text-muted-foreground mb-1">Goods Name*</label>
                      <SearchableSelect
                        value={form.goodsName || ""}
                        onChange={(val) => {
                          if (val === "__ADD_NEW__") {
                            setNewGoodForm({ goodsName: "", chsCode: "", size: "", brand: "", originCountryId: "" });
                            setNewGoodError("");
                            setNewGoodModal(true);
                          } else {
                            setValue("goodsName", val);
                            const foundGood = dbGoods.find(g => (g.goods_name || g.goodsName) === val);
                            if (foundGood) {
                              const hs = foundGood.chs_code || foundGood.chsCode || "";
                              const firstVar = foundGood.variations?.[0] || {};
                              const br = firstVar.brand || foundGood.brand || "";
                              const sz = firstVar.size || foundGood.size || "";
                              const originId = foundGood.origin_country_id || foundGood.originCountryId;
                              const originCountryObj = originId ? (allCountries.find(c => c.id === originId) || countries.find(c => c.id === originId) || transitCountryOptions.find(c => c.id === originId)) : null;
                              const cName = originCountryObj?.name || foundGood.origin || "";

                              setForm(prev => ({
                                ...prev,
                                goodsName: val,
                                hsCode: hs || prev.hsCode,
                                brand: br || prev.brand,
                                size: sz || prev.size,
                                origin: cName || prev.origin
                              }));
                            }
                          }
                        }}
                        options={[
                          ...dbGoods.map(g => ({ label: g.goods_name || g.goodsName, value: g.goods_name || g.goodsName })),
                          ...GOODS_OPTIONS.filter(go => !dbGoods.some(g => (g.goods_name || g.goodsName) === go)).map(g => ({ label: g, value: g }))
                        ]}
                        placeholder="Select Goods"
                        addOptionLabel="Add New Good"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] text-muted-foreground">HS Code</label>
                          {form.goodsName && (() => {
                            const selectedGood = dbGoods.find(g => (g.goods_name || g.goodsName || "").trim().toUpperCase() === form.goodsName.trim().toUpperCase());
                            if (selectedGood && (selectedGood.chs_code || selectedGood.chsCode || "") !== (form.hsCode || "")) {
                              return (
                                <button
                                  type="button"
                                  onClick={handleUpdateHsCode}
                                  className="text-[9px] bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-1.5 py-0.5 rounded transition-colors"
                                >
                                  Save to Master
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <input
                          type="text"
                          value={form.hsCode || ""}
                          onChange={(e) => setValue("hsCode", e.target.value)}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1 font-bold">Allot Name / ID</label>
                        {form.saleSource && form.saleSource !== "booking" ? (
                          <select
                            value={form.allotName || ""}
                            onChange={(e) => {
                              const selectedLotNo = e.target.value;
                              setValue("allotName", selectedLotNo);
                              const lotObj = MOCK_SALE_LOTS.find(l => l.lotNo === selectedLotNo);
                              if (lotObj) {
                                applySaleLot(lotObj);
                              } else {
                                setForm(prev => ({
                                  ...prev,
                                  allotName: "",
                                  stockLotNo: "",
                                  goodsName: "",
                                  brand: "",
                                  size: "",
                                  origin: "",
                                  hsCode: "",
                                  qtyNo: 0,
                                  qtyKgs: 0,
                                  netWeight: "",
                                  coursePrice: 0
                                }));
                              }
                            }}
                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] font-bold"
                          >
                            <option value="">-- Choose Lot --</option>
                            {MOCK_SALE_LOTS.filter(l => l.source === form.saleSource).map((lot) => (
                              <option key={lot.lotNo} value={lot.lotNo}>
                                {lot.lotNo} - {lot.goodsName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={form.allotName || ""}
                            onChange={(e) => setValue("allotName", e.target.value)}
                            placeholder="e.g. ALT-2003"
                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Brand</label>
                        <SearchableSelect
                          value={form.brand || ""}
                          onChange={(val) => {
                            if (val === "__ADD_NEW__") {
                              const selGood = dbGoods.find(g => (g.goods_name || g.goodsName || "").trim().toUpperCase() === (form.goodsName || "").trim().toUpperCase());
                              if (!selGood) {
                                alert(`Please select a Good first before adding a new Brand. (Current goodsName: "${form.goodsName || ""}", dbGoods count: ${dbGoods.length})`);
                                return;
                              }
                              setCustomVariationForm({
                                goodsName: selGood.goods_name || selGood.goodsName,
                                brand: "",
                                size: form.size || "",
                                originCountryId: ""
                              });
                              setCustomVariationModal(true);
                            } else {
                              setValue("brand", val);
                            }
                          }}
                          options={(() => {
                            const selGood = dbGoods.find(g => (g.goods_name || g.goodsName) === form.goodsName);
                            const brands = Array.from(new Set([
                              ...BRAND_OPTIONS,
                              ...(selGood?.variations || []).map(v => v.brand).filter(Boolean),
                              ...dbGoods.flatMap(g => (g.variations || []).map(v => v.brand)).filter(Boolean),
                              form.brand
                            ].filter(Boolean))).sort();
                            return brands.map(b => ({ label: b, value: b }));
                          })()}
                          placeholder="Select Brand"
                          addOptionLabel="Add New Brand"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Size Specification</label>
                        <SearchableSelect
                          value={form.size || ""}
                          onChange={(val) => {
                            if (val === "__ADD_NEW__") {
                              const selGood = dbGoods.find(g => (g.goods_name || g.goodsName || "").trim().toUpperCase() === (form.goodsName || "").trim().toUpperCase());
                              if (!selGood) {
                                alert(`Please select a Good first before adding a new Size. (Current goodsName: "${form.goodsName || ""}", dbGoods count: ${dbGoods.length})`);
                                return;
                              }
                              setCustomVariationForm({
                                goodsName: selGood.goods_name || selGood.goodsName,
                                brand: form.brand || "",
                                size: "",
                                originCountryId: ""
                              });
                              setCustomVariationModal(true);
                            } else {
                              setValue("size", val);
                            }
                          }}
                          options={(() => {
                            const selGood = dbGoods.find(g => (g.goods_name || g.goodsName) === form.goodsName);
                            const sizes = Array.from(new Set([
                              ...SIZE_OPTIONS,
                              ...(selGood?.variations || []).map(v => v.size).filter(Boolean),
                              ...dbGoods.flatMap(g => (g.variations || []).map(v => v.size)).filter(Boolean),
                              form.size
                            ].filter(Boolean))).sort();
                            return sizes.map(s => ({ label: s, value: s }));
                          })()}
                          placeholder="Select Size"
                          addOptionLabel="Add New Size"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Qty Name</label>
                        <SearchableSelect
                          value={form.qtyName || "BAGS"}
                          onChange={(val) => {
                            if (val === "__ADD_NEW__") {
                              const newQty = window.prompt("Enter New Qty Name:");
                              if (newQty && newQty.trim()) {
                                setValue("qtyName", newQty.trim());
                                setCustomQtyNames(prev => [...prev, newQty.trim()]);
                              }
                            } else {
                              setValue("qtyName", val);
                            }
                          }}
                          options={Array.from(new Set([...QTY_TYPE_OPTIONS, ...customQtyNames, form.qtyName])).filter(Boolean).map(q => ({ label: q, value: q }))}
                          placeholder="Select Qty Name"
                          addOptionLabel="Add New Qty Name"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Quantity No</label>
                        <input
                          type="number"
                          value={form.qtyNo || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setValue("qtyNo", val);
                            setValue("manualTotalAmount", "");
                            setValue("manualFinalAmount", "");
                            const qtyKgs = Number(form.qtyKgs || 0);
                            const emptyKgs = Number(form.emptyKgs || 0);
                            setValue("netWeight", val * qtyKgs - val * emptyKgs);
                          }}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">1 Qty KGS</label>
                        <input
                          type="number"
                          value={form.qtyKgs || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setValue("qtyKgs", val);
                            setValue("manualTotalAmount", "");
                            setValue("manualFinalAmount", "");
                            const qtyNo = Number(form.qtyNo || 0);
                            const emptyKgs = Number(form.emptyKgs || 0);
                            setValue("netWeight", qtyNo * val - qtyNo * emptyKgs);
                          }}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">1 Empty KGS</label>
                        <input
                          type="number"
                          value={form.emptyKgs || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setValue("emptyKgs", val);
                            setValue("manualTotalAmount", "");
                            setValue("manualFinalAmount", "");
                            const qtyNo = Number(form.qtyNo || 0);
                            const qtyKgs = Number(form.qtyKgs || 0);
                            setValue("netWeight", qtyNo * qtyKgs - qtyNo * val);
                          }}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Divide Type</label>
                        <select
                          value={form.divideType || "D/KGs"}
                          onChange={(e) => setValue("divideType", e.target.value)}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                        >
                          <option value="D/KGs">D/KGs</option>
                          <option value="D/LBs">D/LBs</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Divide Weight / Value</label>
                        <input
                          type="number"
                          value={form.divideWeight || 1}
                          onChange={(e) => {
                            setValue("divideWeight", Number(e.target.value));
                            setValue("manualTotalAmount", "");
                            setValue("manualFinalAmount", "");
                          }}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Price Type</label>
                        <select
                          value={form.priceType || "P/KGs"}
                          onChange={(e) => setValue("priceType", e.target.value)}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                        >
                          <option value="P/KGs">P/KGs</option>
                          <option value="P/LBs">P/LBs</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Price Rate (C1)</label>
                        <input
                          type="number"
                          value={form.coursePrice || ""}
                          onChange={(e) => {
                            setValue("coursePrice", Number(e.target.value));
                            setValue("manualTotalAmount", "");
                            setValue("manualFinalAmount", "");
                          }}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] font-mono"
                        />
                      </div>
                    </div>
 
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900 mt-2">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-2">Sales Currency & Conversion</h4>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <label className="block text-[9px] text-emerald-700 dark:text-emerald-500 mb-1 font-bold">Pricing Currency</label>
                          <select
                            value={form.currencyType || "USD"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm(prev => ({ ...prev, currencyType: val, salesCurrency: val }));
                            }}
                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                          >
                            {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] text-emerald-700 dark:text-emerald-500 mb-1 font-bold">Exchange Rate to {form.secondaryCurrency || "PKR"}</label>
                          <div className="flex gap-1.5">
                            <input
                               type="number"
                               value={form.exchangeRate || 1}
                               onChange={(e) => {
                                 setValue("exchangeRate", Number(e.target.value));
                                 setValue("manualFinalAmount", "");
                               }}
                               className="flex-1 min-w-0 bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] font-mono h-8"
                            />
                            <select
                              value={form.operator || "*"}
                              onChange={(e) => {
                                setValue("operator", e.target.value);
                                setValue("manualFinalAmount", "");
                              }}
                              className="w-12 bg-background border border-input rounded text-center text-xs font-bold text-foreground outline-none focus:border-primary h-8"
                            >
                              <option value="*">*</option>
                              <option value="/">/</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="block text-[9px] text-emerald-700 dark:text-emerald-500 mb-1 font-bold">Amount ({form.currencyType || "USD"})</label>
                          <input
                            type="number"
                            value={form.manualTotalAmount !== undefined && form.manualTotalAmount !== "" ? form.manualTotalAmount : currentItemTotals.totalAmount}
                            onChange={(e) => setValue("manualTotalAmount", e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder={currentItemTotals.totalAmount.toFixed(2)}
                            className="w-full bg-background border border-emerald-200 dark:border-emerald-800 rounded px-2.5 py-1.5 text-foreground outline-none focus:border-emerald-500 text-[10px] font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-emerald-700 dark:text-emerald-500 mb-1 font-bold">Final ({form.secondaryCurrency || "PKR"})</label>
                          <input
                            type="number"
                            value={form.manualFinalAmount !== undefined && form.manualFinalAmount !== "" ? form.manualFinalAmount : currentItemTotals.finalAmount}
                            onChange={(e) => setValue("manualFinalAmount", e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder={currentItemTotals.finalAmount.toFixed(2)}
                            className="w-full bg-background border border-emerald-200 dark:border-emerald-800 rounded px-2.5 py-1.5 text-foreground outline-none focus:border-emerald-500 text-[10px] font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
 
                  <div className="flex flex-col gap-2.5 pt-4 border-t border-border mt-4">
                    <Button
                      type="button"
                      onClick={handleAddGoodsEntry}
                      className="w-full font-bold h-10 rounded-lg text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-all"
                    >
                      + Add Item to List
                    </Button>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTab("booking")}
                        className="flex-1 font-bold h-10 rounded-lg text-xs text-slate-600 hover:bg-slate-50 border border-input"
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setActiveTab("others")}
                        className="flex-1 font-bold h-10 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </fieldset>
              )}

              {activeTab === "others" && (
                <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="space-y-3 order-2 w-full mt-0 rounded-2xl border border-border bg-card p-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                      STEP 3: OTHER DETAILS
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* SECTION 1: SHIPPING & LOCATION */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                            <Globe2 className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Shipping & Location</h4>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Essential route information only: country, port, mode and dates.</p>
                          </div>
                        </div>
                        <label className="min-w-[150px] space-y-1">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Shipping Mode</span>
                          <select
                            value={form.shippingMode || "By Sea"}
                            onChange={(e) => {
                              const mode = e.target.value;
                              setValue("shippingMode", mode);
                              setValue("shipmentType", mode === "By Sea" ? "By Ship" : mode);
                            }}
                            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {LOADING_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </label>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/50 dark:bg-amber-950/10">
                          <div className="mb-3 flex items-center gap-2 border-b border-amber-100 pb-2 dark:border-amber-900/40">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Loading / Departure</h5>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-3">
                            <label className="space-y-1">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Loading Country</span>
                              <SearchableSelect
                                value={form.loadingCountry || ""}
                                onChange={(val) => {
                                  if (val === "__ADD_NEW__") {
                                    handleAddNewLocationItem("country", "loadingCountry");
                                  } else {
                                    setValue("loadingCountry", val);
                                    setValue("originCountry", val);
                                    setValue("origin", val);
                                    setValue("loadingPort", "");
                                    setValue("loadingLocation", "");
                                  }
                                }}
                                options={masterCountryOptions.map((c) => ({ label: `${c.name} ${c.iso2 ? `(${c.iso2})` : ""}`, value: c.name }))}
                                placeholder="Select Country"
                                addOptionLabel="Add New Country"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Loading Port</span>
                              <SearchableSelect
                                value={form.loadingPort || form.airportName || form.loadingBorder || ""}
                                onChange={(val) => {
                                  if (val === "__ADD_NEW__") {
                                    handleAddNewLocationItem("port", "loadingPort");
                                  } else {
                                    setValue("loadingPort", val);
                                    setValue("loadingLocation", val);
                                    if (form.shippingMode === "By Air") setValue("airportName", val);
                                    if (form.shippingMode === "By Road") setValue("loadingBorder", val);
                                  }
                                }}
                                options={currentLoadingPorts.map((p, idx) => ({ label: `${p.port_name} ${p.port_code ? `[${p.port_code}]` : ""}`, value: p.port_name }))}
                                placeholder="Select Port"
                                addOptionLabel="Add New Port"
                                disabled={!form.loadingCountry && currentLoadingPorts.length === 0}
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Loading Date</span>
                              <input
                                type="date"
                                value={form.loadingDate || ""}
                                onChange={(e) => setValue("loadingDate", e.target.value)}
                                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                              />
                            </label>
                          </div>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/10">
                          <div className="mb-3 flex items-center gap-2 border-b border-emerald-100 pb-2 dark:border-emerald-900/40">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Receiving / Arrival</h5>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-3">
                            <label className="space-y-1">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Receiving Country</span>
                              <SearchableSelect
                                value={form.receivingCountry || form.destinationCountry || form.receivedCountry || ""}
                                onChange={(val) => {
                                  if (val === "__ADD_NEW__") {
                                    handleAddNewLocationItem("country", "receivingCountry");
                                  } else {
                                    setValue("receivingCountry", val);
                                    setValue("receivedCountry", val);
                                    setValue("destinationCountry", val);
                                    setValue("receivingPort", "");
                                    setValue("destinationPort", "");
                                    setValue("receivedPort", "");
                                  }
                                }}
                                options={masterCountryOptions.map((c) => ({ label: `${c.name} ${c.iso2 ? `(${c.iso2})` : ""}`, value: c.name }))}
                                placeholder="Select Country"
                                addOptionLabel="Add New Country"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Receiving Port</span>
                              <SearchableSelect
                                value={form.receivingPort || form.destinationPort || form.receivedPort || ""}
                                onChange={(val) => {
                                  if (val === "__ADD_NEW__") {
                                    handleAddNewLocationItem("port", "receivingPort");
                                  } else {
                                    setValue("receivingPort", val);
                                    setValue("destinationPort", val);
                                    setValue("receivedPort", val);
                                    if (form.shippingMode === "By Air") setValue("destinationAirportName", val);
                                    if (form.shippingMode === "By Road") setValue("receivingBorder", val);
                                  }
                                }}
                                options={currentReceivedPorts.map((p, idx) => ({ label: `${p.port_name} ${p.port_code ? `[${p.port_code}]` : ""}`, value: p.port_name }))}
                                placeholder="Select Port"
                                addOptionLabel="Add New Port"
                                disabled={!(form.receivingCountry || form.destinationCountry || form.receivedCountry) && currentReceivedPorts.length === 0}
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Receiving Date</span>
                              <input
                                type="date"
                                value={form.receivedDate || ""}
                                onChange={(e) => setValue("receivedDate", e.target.value)}
                                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Ã¢â€â‚¬Ã¢â€â‚¬ SECTION 2: ADVANCE & PAYMENT TERMS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3 space-y-3">
                      <h4 className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1">Advance & Payment Terms</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Payment Type</label>
                          <select
                            value={form.paymentType || "Advance Payment"}
                            onChange={(e) => setValue("paymentType", e.target.value)}
                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                          >
                            {PAYMENT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Advance Percentage (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={form.advancePercent ?? ""}
                            onChange={(e) => setValue("advancePercent", e.target.value ? Number(e.target.value) : null)}
                            placeholder="e.g. 20"
                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Advance Payment Date</label>
                          <input
                            type="date"
                            value={form.advancePaymentDate || ""}
                            onChange={(e) => setValue("advancePaymentDate", e.target.value)}
                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Final Payment Date</label>
                          <input
                            type="date"
                            value={form.paymentDate || ""}
                            onChange={(e) => setValue("paymentDate", e.target.value)}
                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Ã¢â€â‚¬Ã¢â€â‚¬ SECTION 3: TRANSPORT & CONTAINER DETAILS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3 space-y-3">
                      <h4 className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1">Transport & Container Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Container Numbers</label>
                          <input
                            type="text"
                            value={form.containerNumbers || ""}
                            onChange={(e) => setValue("containerNumbers", e.target.value)}
                            placeholder="e.g. ABCU1234567"
                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Container Size / Type</label>
                          <select
                            value={form.containerSize || ""}
                            onChange={(e) => setValue("containerSize", e.target.value)}
                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                          >
                            <option value="">Select Type...</option>
                            {CONTAINER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Ã¢â€â‚¬Ã¢â€â‚¬ SECTION 4: REMARKS & NARRATION Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Remarks & Narration</label>
                      <textarea
                        value={form.remarks || ""}
                        onChange={(e) => setValue("remarks", e.target.value)}
                        className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] h-16 resize-none"
                        placeholder="Add any remarks or narration here..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("goods")}
                      className="flex-1 font-bold h-10 rounded-lg text-xs text-slate-600 hover:bg-slate-50 border border-input"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setActiveTab("reports_tab")}
                      className="flex-1 font-bold h-10 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                      Next
                    </Button>
                  </div>
                </fieldset>
              )}
              {activeTab === "reports_tab" && (
                <div className="space-y-3 order-2 w-full mt-0 rounded-2xl border border-border bg-card p-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-3">
                    <h3 className="text-[11px] font-black uppercase text-slate-800">
                      Step 4: Review Reports
                    </h3>
                    <p className="text-[9px] text-slate-500 font-semibold">
                      Review all generated reports and notes before final verification.
                    </p>
                    <div className="flex gap-3 pt-3 border-t border-slate-200 mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTab("others")}
                        className="flex-1 font-bold h-10 rounded-lg text-xs text-slate-600 hover:bg-slate-50 border border-input"
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setActiveTab("report")}
                        className="flex-1 font-bold h-10 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        )}

      {activeTab === "report" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">

          {/* Top Review Header Banner */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">Sales Booking Order – Final Review & Approval</h2>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Please review all information carefully before final approval. You can approve, send back for edit, or request changes.</p>
            </div>
            <div className="flex gap-2.5">
              <Button
                type="button"
                onClick={() => handleOpenA4Report(false)}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-bold h-9 px-3 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                Download Review Report (PDF)
              </Button>
              <Button
                type="button"
                onClick={() => window.print()}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-bold h-9 px-3 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                Print Review
              </Button>
            </div>
          </div>

          {/* Alert Success bar */}
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 flex items-center gap-3 text-[10px] font-bold shadow-sm">
            <span className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-black">✓</span>
            All information has been saved successfully and is ready for final review.
          </div>

          {/* Grid Layout Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            
            {/* 1. Branch & Booking Info */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-[10px]">
              <h3 className="font-black text-slate-800 border-b border-slate-100 pb-1.5 mb-2.5 uppercase flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[8px]">1</span>
                Branch Information
              </h3>
              <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5">
                <span className="text-slate-400 font-semibold">Country:</span><span className="font-bold text-slate-800">{form.branchCountry || "Pakistan"}</span>
                <span className="text-slate-400 font-semibold">Main Branch:</span><span className="font-bold text-slate-800">{form.branchName || "N/A"}</span>
                <span className="text-slate-400 font-semibold">City Branch:</span><span className="font-bold text-slate-800">{form.branchName || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Branch Code:</span><span className="font-bold text-slate-800">{form.branchCode || "N/A"}</span>
                <span className="text-slate-400 font-semibold">User Admin:</span><span className="font-bold text-slate-800">{form.userName || "ADMIN"}</span>
                <span className="text-slate-400 font-semibold">User ID:</span><span className="font-bold text-slate-800 font-mono">{form.userId || "USR-1001"}</span>
                <span className="text-slate-400 font-semibold">Currency:</span><span className="font-bold text-slate-800">{form.salesCurrency || "PKR"}</span>
                <span className="text-slate-400 font-semibold">Status:</span><span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase w-max">{isTransferred ? "Active" : "Draft"}</span>
                <span className="text-slate-400 font-semibold">Established Date:</span><span className="font-bold text-slate-800">{form.salesDate}</span>
              </div>
            </div>

            {/* 2. Address & Logistics */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-[10px]">
              <h3 className="font-black text-slate-800 border-b border-slate-100 pb-1.5 mb-2.5 uppercase flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[8px]">2</span>
                Logistics & Routing
              </h3>
              <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5">
                <span className="text-slate-400 font-semibold">Loading Mode:</span><span className="font-bold text-slate-800">{form.salesLoadingMode || "By Sea"}</span>
                <span className="text-slate-400 font-semibold">Contract No:</span><span className="font-bold text-slate-800">{form.salesContractNo || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Port of Loading:</span><span className="font-bold text-slate-800">{form.salesPortOfLoading || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Port of Discharge:</span><span className="font-bold text-slate-800">{form.salesPortOfDischarge || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Destination Country:</span><span className="font-bold text-slate-800">{form.salesDestinationCountry || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Origin Country:</span><span className="font-bold text-slate-800">{form.origin || "Pakistan"}</span>
                <span className="text-slate-400 font-semibold">Delivery Term:</span><span className="font-bold text-slate-800">{form.deliveryTerm || "CFR"}</span>
              </div>
            </div>

            {/* 3. Customer Account (DR) */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-[10px]">
              <h3 className="font-black text-slate-800 border-b border-slate-100 pb-1.5 mb-2.5 uppercase flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[8px]">3</span>
                Customer Account (DR)
              </h3>
              <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5">
                <span className="text-slate-400 font-semibold">Account Code:</span><span className="font-bold text-slate-800 font-mono">{form.customerAccountNo || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Account Name:</span><span className="font-bold text-slate-800">{form.customerAccountName || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Branch:</span><span className="font-bold text-slate-800">{form.customerAccountBranch || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Currency:</span><span className="font-bold text-slate-800">{form.salesCurrency || "PKR"}</span>
                <span className="text-slate-400 font-semibold">Company:</span><span className="font-bold text-slate-800">{form.salesCompanyName || "None"}</span>
                <span className="text-slate-400 font-semibold">Email:</span><span className="font-bold text-slate-800 truncate" title={form.customerAccountEmail}>{form.customerAccountEmail || "N/A"}</span>
                <span className="text-slate-400 font-semibold">WhatsApp:</span><span className="font-bold text-slate-800">{form.customerAccountWhatsapp || "N/A"}</span>
              </div>
            </div>

            {/* 4. Sales Account (CR) */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-[10px]">
              <h3 className="font-black text-slate-800 border-b border-slate-100 pb-1.5 mb-2.5 uppercase flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[8px]">4</span>
                Sales Account (CR)
              </h3>
              <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5">
                <span className="text-slate-400 font-semibold">Account Code:</span><span className="font-bold text-slate-800 font-mono">{form.salesAccountNo || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Account Name:</span><span className="font-bold text-slate-800">{form.salesAccountName || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Branch:</span><span className="font-bold text-slate-800">{form.salesAccountBranch || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Currency:</span><span className="font-bold text-slate-800">{form.salesCurrency || "PKR"}</span>
                <span className="text-slate-400 font-semibold">Company:</span><span className="font-bold text-slate-800">{form.salesCompanyName || "None"}</span>
                <span className="text-slate-400 font-semibold">Email:</span><span className="font-bold text-slate-800 truncate" title={form.salesAccountEmail}>{form.salesAccountEmail || "N/A"}</span>
                <span className="text-slate-400 font-semibold">WhatsApp:</span><span className="font-bold text-slate-800">{form.salesAccountWhatsapp || "N/A"}</span>
              </div>
            </div>

          </div>

          {/* Row 2 Grid Cards */}
          <div className="grid gap-4 md:grid-cols-3">

            {/* 5. Roles & Permissions Summary */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-[10px]">
              <h3 className="font-black text-slate-800 border-b border-slate-100 pb-1.5 mb-2.5 uppercase flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[8px]">5</span>
                Roles & Permissions
              </h3>
              <table className="w-full text-left text-[9px] mt-1">
                <thead>
                  <tr className="border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-1.5">Role Name</th>
                    <th className="pb-1.5">Users</th>
                    <th className="pb-1.5 text-right">Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  <tr><td className="py-1">Branch Admin</td><td className="py-1">2</td><td className="py-1 text-right text-blue-600">Full Access</td></tr>
                  <tr><td className="py-1">Accountant</td><td className="py-1">3</td><td className="py-1 text-right text-blue-600">Accounting Access</td></tr>
                  <tr><td className="py-1">Store Manager</td><td className="py-1">1</td><td className="py-1 text-right text-blue-600">Inventory Access</td></tr>
                  <tr><td className="py-1">Sales Executive</td><td className="py-1">4</td><td className="py-1 text-right text-blue-600">Sales Access</td></tr>
                </tbody>
              </table>
            </div>

            {/* 6. Accounting Setup / Parameters */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-[10px]">
              <h3 className="font-black text-slate-800 border-b border-slate-100 pb-1.5 mb-2.5 uppercase flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[8px]">6</span>
                Accounting Setup
              </h3>
              <div className="grid grid-cols-[140px_1fr] gap-x-2 gap-y-1.5">
                <span className="text-slate-400 font-semibold">Default Purchase Account:</span><span className="font-bold text-slate-800">Purchases - Local</span>
                <span className="text-slate-400 font-semibold">Default Sales Account:</span><span className="font-bold text-slate-800">Sales - Local</span>
                <span className="text-slate-400 font-semibold">General Serial No:</span><span className="font-bold text-slate-800 font-mono">{form.generalSerialNumber || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Roznamcha (Journal) No:</span><span className="font-bold text-slate-800 font-mono">{form.journalNumber || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Cash Entry Serial:</span><span className="font-bold text-slate-800 font-mono">{form.cashEntrySerial || "N/A"}</span>
                <span className="text-slate-400 font-semibold">Current Year Start:</span><span className="font-bold text-slate-800">01 Jul 2025</span>
                <span className="text-slate-400 font-semibold">Accounting Method:</span><span className="font-bold text-slate-800">Accrual Basis</span>
              </div>
            </div>

            {/* 7. Communication Setup */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-[10px]">
              <h3 className="font-black text-slate-800 border-b border-slate-100 pb-1.5 mb-2.5 uppercase flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[8px]">7</span>
                Communication Setup
              </h3>
              <div className="grid grid-cols-[140px_1fr] gap-x-2 gap-y-1.5">
                <span className="text-slate-400 font-semibold">Email (For Documents):</span><span className="font-bold text-slate-850 truncate">{form.branchEmail || "info@damaanbusiness.com"}</span>
                <span className="text-slate-400 font-semibold">Email (Notifications):</span><span className="font-bold text-slate-850 truncate">{form.notificationsEmail || "notify@damaanbusiness.com"}</span>
                <span className="text-slate-400 font-semibold">WhatsApp Number:</span><span className="font-bold text-slate-800">+92 333 1234567</span>
                <span className="text-slate-400 font-semibold">SMS Notifications:</span><span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase w-max">Enabled</span>
                <span className="text-slate-400 font-semibold">Email Notifications:</span><span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase w-max">Enabled</span>
                <span className="text-slate-400 font-semibold">Language:</span><span className="font-bold text-slate-800">English</span>
                <span className="text-slate-400 font-semibold">Time Zone:</span><span className="font-bold text-slate-800 truncate">(GMT+05:00) Pakistan</span>
              </div>
            </div>

          </div>

          {/* Goods Details Spreadsheet-like Table */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <h3 className="font-black text-[11px] text-slate-800 border-b border-slate-100 pb-2 mb-3 uppercase flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-blue-600" /> Goods Details
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] text-left border-collapse border border-slate-200">
                <thead className="bg-slate-50 text-slate-650 font-bold uppercase tracking-wider text-[8px] border-b border-slate-200">
                  <tr>
                    <th className="p-2 border-r border-slate-200">Goods</th>
                    <th className="p-2 border-r border-slate-200">Brand</th>
                    <th className="p-2 border-r border-slate-200">Origin</th>
                    <th className="p-2 border-r border-slate-200 text-right">Qty</th>
                    <th className="p-2 border-r border-slate-200 text-right">G.Wt</th>
                    <th className="p-2 border-r border-slate-200 text-right">N.Wt</th>
                    <th className="p-2 border-r border-slate-200 text-right">Rate</th>
                    <th className="p-2 border-r border-slate-200 text-right">Amount ({form.currencyType || "USD"})</th>
                    <th className="p-2 text-right text-emerald-800">Final ({form.secondaryCurrency || "PKR"})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-semibold">
                  {goodsEntries.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="p-2 font-bold border-r border-slate-200">{row.goodsName}</td>
                      <td className="p-2 border-r border-slate-200">{row.brand}</td>
                      <td className="p-2 border-r border-slate-200">{row.origin}</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono font-bold">{row.qtyNo.toLocaleString()} {row.qtyName}</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono">{row.grossWeight.toFixed(2)}</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono font-bold">{row.netWeight.toFixed(2)}</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono">{row.coursePrice.toFixed(2)}</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono font-bold text-slate-700">{row.totalAmount.toLocaleString()}</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                        {row.finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {goodsEntries.length > 0 && (
                    <tr className="bg-slate-50 font-black border-t-2 border-slate-300 text-slate-800">
                      <td colSpan={3} className="p-2 text-right border-r border-slate-200">TOTALS:</td>
                      <td className="p-2 text-right border-r border-slate-200">{reportTotals.totalQty.toLocaleString()} {goodsEntries[0]?.qtyName || ""}</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono">{reportTotals.totalGross.toFixed(2)}</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono">{reportTotals.totalNet.toFixed(2)}</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono bg-slate-100/50">-</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono text-slate-900">{reportTotals.grandPrimaryFinal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono text-emerald-800 bg-emerald-100">{reportTotals.grandFinal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks (Report) Input */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <h3 className="font-black text-[11px] text-slate-800 border-b border-slate-100 pb-2 mb-3 uppercase">
              Remarks (Report Summary)
            </h3>
            <textarea
              value={form.orderReportRemarks}
              onChange={(e) => handleTextChange("orderReportRemarks", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 outline-none focus:border-blue-500 resize-none h-24 text-[10px] font-semibold"
              placeholder="Type verification, approval, or audit remarks here..."
            />
          </div>

          {/* Saved Reports */}
          {reportsList.length > 0 && (
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <h3 className="font-black text-[11px] text-slate-800 border-b border-slate-100 pb-2 mb-3 uppercase">Saved Reports</h3>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {reportsList.map((report) => (
                  <div key={report.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] font-semibold relative">
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-bold text-slate-800 uppercase tracking-wider">{report.name}</span>
                      <button type="button" onClick={() => handleDeleteReport(report.id)} className="text-red-500 hover:text-red-700 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {report.description && <p className="text-slate-600 mb-1.5">{report.description}</p>}
                    <p className="text-slate-400 font-mono text-[8px]">{formatShortDate(report.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FINAL APPROVAL ACTIONS (Approve, Send Back, Request Changes) */}
          <div className="grid gap-4 md:grid-cols-3">

            {/* A. Approve & Activate */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">✓</span>
                  <h4 className="text-xs font-black text-slate-900 uppercase">Approve & Activate Order</h4>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mb-4">
                  Approve this booking order and transfer/post it to the General Ledger. The booking will become active and available for all operations.
                </p>
              </div>
              <div>
                {isTransferred ? (
                  <div className="w-full bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase text-center py-2 border border-emerald-200 rounded-lg">
                    Approved & Transferred
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={handleTransfer}
                    disabled={savingOrder || isTransferred}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-lg text-xs uppercase tracking-wider shadow transition-all flex items-center justify-center gap-2"
                  >
                    Approve & Activate
                  </Button>
                )}
              </div>
            </div>

            {/* B. Send Back for Edit */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px]">↩</span>
                  <h4 className="text-xs font-black text-slate-900 uppercase">Send Back for Edit</h4>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mb-4">
                  Send this booking back to the entries screen for corrections, adjustments, or additional cargo/amount information.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setActiveTab("goods")}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-10 rounded-lg text-xs uppercase tracking-wider shadow transition-all"
              >
                Send Back for Edit
              </Button>
            </div>

            {/* C. Request Changes */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-5 w-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px]">✕</span>
                  <h4 className="text-xs font-black text-slate-900 uppercase">Request Changes / Cancel</h4>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mb-4">
                  Flag specific discrepancies or cancel this booking process entirely. All logs will record this audit action.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  if (confirm("Are you sure you want to request changes and reset this booking?")) {
                    handleReset();
                    setActiveTab("booking");
                  }
                }}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-10 rounded-lg text-xs uppercase tracking-wider shadow transition-all"
              >
                Request Changes
              </Button>
            </div>

          </div>

          {/* Information banner */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-[9px] font-semibold text-slate-500 leading-relaxed">
            Please review all information carefully before taking action. Once approved, the booking will be finalized and its postings posted permanently to the general ledger.
          </div>

          {/* Bottom Navigation Buttons */}
          <div className="flex justify-between items-center border-t border-slate-200 pt-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab("goods")}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-bold h-10 px-6 rounded-lg shadow-sm"
            >
              ← Back to Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/sales/sales-booking-register")}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-bold h-10 px-6 rounded-lg shadow-sm"
            >
              Close Review ✕
            </Button>
          </div>

        </div>
      )}

      {previewModalOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-5xl h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Printer className="h-4 w-4 text-blue-600" /> Print Preview
              </h2>
              <div className="flex items-center gap-3">
                <Button type="button" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs font-bold rounded shadow transition-all">Print Document</Button>
                <Button type="button" variant="outline" onClick={() => setPreviewModalOpen(false)} className="h-8 px-4 text-xs font-bold hover:bg-slate-100">Close</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50 flex justify-center custom-scrollbar">
              <div className="w-[210mm] min-h-[297mm] bg-white shadow-xl border border-slate-200 p-8 transform scale-[0.9] origin-top print:scale-100 print:shadow-none print:m-0 print:border-none print:p-0">

                {/* Header Banner */}
                <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 text-left">
                  <div className="flex flex-col gap-4 bg-slate-950 px-5 py-4 text-white md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Damaan Business Group</p>
                      <h1 className="mt-1 text-xl font-black uppercase tracking-[0.22em]">Sales Booking Order</h1>
                      <p className="mt-1 text-[10px] font-semibold text-slate-300">Professional verification, account routing, goods, payment and audit template</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right text-[10px] font-bold md:min-w-[360px]">
                      <span className="text-slate-400">PO No</span><span>{form.salesOrderNo || "N/A"}</span>
                      <span className="text-slate-400">Bill No</span><span>{form.billNo || "N/A"}</span>
                      <span className="text-slate-400">Date</span><span>{form.salesDate || "N/A"}</span>
                      <span className="text-slate-400">Status</span><span className={isTransferred ? "text-emerald-300" : "text-amber-300"}>{isTransferred ? "Transferred" : "Pending Transfer"}</span>
                    </div>
                  </div>

                  {/* Account Info Cards */}
                  <div className="grid gap-4 p-4 text-[10px] md:grid-cols-2 bg-slate-50/50">
                    <div className="border border-slate-300 bg-white p-3 rounded shadow-sm">
                      <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800 text-[10px]">Sales Account (CR)</h3>
                      <div className="grid grid-cols-[80px_1fr] gap-1">
                        <span className="text-slate-500 font-semibold">Account Code:</span><span className="font-bold">{form.salesAccountNo || "N/A"}</span>
                        <span className="text-slate-500 font-semibold">Account Name:</span><span className="font-bold">{form.salesAccountName || "N/A"}</span>
                        <span className="text-slate-500 font-semibold">Company:</span><span className="font-bold">{form.salesCompanyName || "N/A"}</span>
                      </div>
                    </div>
                    <div className="border border-slate-300 bg-white p-3 rounded shadow-sm">
                      <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800 text-[10px]">Customer Account (DR)</h3>
                      <div className="grid grid-cols-[80px_1fr] gap-1">
                        <span className="text-slate-500 font-semibold">Account Code:</span><span className="font-bold">{form.customerAccountNo || "N/A"}</span>
                        <span className="text-slate-500 font-semibold">Account Name:</span><span className="font-bold">{form.customerAccountName || "N/A"}</span>
                        <span className="text-slate-500 font-semibold">Company:</span><span className="font-bold">{form.salesCompanyName || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Routing row */}
                  <div className="grid gap-0 border-t border-slate-200 bg-white text-[10px] font-semibold text-slate-700 md:grid-cols-4">
                    <div className="border-b border-slate-200 p-3 md:border-b-0 md:border-r"><span className="block text-[8px] uppercase tracking-wider text-slate-400">Country</span>{form.branchCountry || form.origin || "N/A"}</div>
                    <div className="border-b border-slate-200 p-3 md:border-b-0 md:border-r"><span className="block text-[8px] uppercase tracking-wider text-slate-400">Branch</span>{form.branchName || "N/A"}</div>
                    <div className="border-b border-slate-200 p-3 md:border-b-0 md:border-r"><span className="block text-[8px] uppercase tracking-wider text-slate-400">Branch Code</span>{form.branchCode || "N/A"}</div>
                    <div className="p-3"><span className="block text-[8px] uppercase tracking-wider text-slate-400">Currency</span>{form.salesCurrency || form.currencyType || "N/A"}</div>
                  </div>
                </div>

                {/* Goods Table */}
                <div className="mb-6">
                  <h3 className="font-black text-xs border-b-2 border-slate-400 pb-1 mb-2 uppercase text-slate-800">Goods Details</h3>
                  <table className="w-full text-[9px] border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th className="border-r border-slate-300 p-1.5 text-left">#</th>
                        <th className="border-r border-slate-300 p-1.5 text-left">Goods Name</th>
                        <th className="border-r border-slate-300 p-1.5 text-center">HS Code</th>
                        <th className="border-r border-slate-300 p-1.5 text-center">Origin</th>
                        <th className="border-r border-slate-300 p-1.5 text-right">Qty</th>
                        <th className="border-r border-slate-300 p-1.5 text-center">Unit</th>
                        <th className="border-r border-slate-300 p-1.5 text-right">Price ({form.currencyType || "USD"})</th>
                        <th className="border-r border-slate-300 p-1.5 text-center">Ex. Rate</th>
                        <th className="p-1.5 text-right">Final ({form.secondaryCurrency || "PKR"})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goodsEntries.length === 0 ? (
                        <tr><td colSpan={9} className="p-3 text-center italic text-slate-500">No goods entries.</td></tr>
                      ) : (
                        goodsEntries.map((g, i) => (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="border-r border-slate-200 p-1.5 text-center">{i + 1}</td>
                            <td className="border-r border-slate-200 p-1.5 font-bold">{g.goodsName} {g.brand ? `(${g.brand})` : ""}</td>
                            <td className="border-r border-slate-200 p-1.5 text-center">{g.hsCode}</td>
                            <td className="border-r border-slate-200 p-1.5 text-center">{g.origin}</td>
                            <td className="border-r border-slate-200 p-1.5 text-right font-bold">{g.qtyNo.toLocaleString()}</td>
                            <td className="border-r border-slate-200 p-1.5 text-center">{g.qtyName}</td>
                            <td className="border-r border-slate-200 p-1.5 text-right">{g.coursePrice}</td>
                            <td className="border-r border-slate-200 p-1.5 text-center">{g.exchangeRate}</td>
                            <td className="p-1.5 text-right font-bold">{g.finalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-400 font-bold">
                        <td colSpan={4} className="p-1.5 text-right">Total:</td>
                        <td className="border-r border-slate-200 p-1.5 text-right">{reportTotals.totalQty.toLocaleString()}</td>
                        <td colSpan={3} className="border-r border-slate-200 p-1.5 text-right text-[8px] text-slate-500 uppercase">Grand Total:</td>
                        <td className="p-1.5 text-right">{form.secondaryCurrency || "PKR"} {reportTotals.grandFinal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Loading Details */}
                <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                  <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">Loading & Transit Report</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">Shipping Mode:</span><span className="font-bold">{form.shippingMode || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Origin Country:</span><span className="font-bold">{form.origin || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Loading Port/Border:</span><span className="font-bold">{form.loadingPort || form.loadingBorder || form.airportName || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Loading Date:</span><span className="font-bold">{form.loadingDate || "N/A"}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">Transit Country:</span><span className="font-bold">{form.transitCountry || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Destination Country:</span><span className="font-bold">{form.receivedCountry || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Received Port/Border:</span><span className="font-bold">{form.receivedPort || form.receivedBorder || form.receivedPortName || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Received Date:</span><span className="font-bold">{form.receivedDate || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Condition */}
                <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                  <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">Payment Conditions Report</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-[120px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">Payment Term:</span><span className="font-bold">{form.paymentType || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Advance (%):</span><span className="font-bold">{form.advancePercent || 0}%</span>
                      <span className="text-slate-500 font-semibold">Advance Payment Date:</span><span className="font-bold">{form.advancePaymentDate || "N/A"}</span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">Invoice Terms:</span><span className="font-bold">{form.invoicePayment || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Remaining (%):</span><span className="font-bold">{100 - (form.advancePercent || 0)}%</span>
                      <span className="text-slate-500 font-semibold">Final Payment Date:</span><span className="font-bold">{form.paymentDate || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Remarks & Narration */}
                {form.remarks && (
                  <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">Remarks & Narration</h3>
                    <p className="whitespace-pre-wrap font-medium text-slate-800">{form.remarks}</p>
                  </div>
                )}

                {/* User Remarks (Report) */}
                {form.orderReportRemarks && (
                  <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">User Remarks (Report)</h3>
                    <p className="whitespace-pre-wrap font-medium text-slate-800">{form.orderReportRemarks}</p>
                  </div>
                )}

                {/* Dynamic Reports */}
                {reportsList.length > 0 && (
                  <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">Dynamic Reports & Notes</h3>
                    <div className="space-y-3">
                      {reportsList.map((r, i) => (
                        <div key={r.id}>
                          <h4 className="font-bold text-slate-900 underline underline-offset-2 mb-1">{r.name}</h4>
                          <p className="whitespace-pre-wrap text-slate-800">{r.notes || r.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signatures */}
                <div className="mt-16 grid grid-cols-3 gap-8 text-center text-[10px] font-bold">
                  <div>
                    <div className="border-t border-slate-400 pt-1">Prepared By</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1">Checked By</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1">Authorized Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ NEW COUNTRY MODAL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {newCountryModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">Add New Country</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">ISO codes and emails are auto-generated</p>
              </div>
              <button
                type="button"
                onClick={() => { setNewCountryModal(false); setNewCountryError(""); setNewCountryForm({ name: "" }); }}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >Ã¢Å“â€¢</button>
            </div>
            <div className="p-5 space-y-3">
              {newCountryError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">{newCountryError}</div>
              )}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Country Name *</label>
                <input
                  type="text"
                  value={newCountryForm.name}
                  onChange={(e) => setNewCountryForm({ name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddNewCountry(); }}
                  placeholder="e.g. Iran"
                  autoFocus
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                />
              </div>
              <p className="text-[9px] text-muted-foreground/60">ISO-2, ISO-3, currency code and system emails will be auto-generated. You can update them later in Location Setup.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={() => { setNewCountryModal(false); setNewCountryError(""); setNewCountryForm({ name: "" }); }}
                className="px-4 py-1.5 text-[11px] rounded border border-input text-muted-foreground hover:text-foreground transition-colors"
              >Cancel</button>
              <button
                type="button"
                onClick={handleAddNewCountry}
                disabled={newCountryLoading}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >{newCountryLoading ? "SavingÃ¢â‚¬Â¦" : "Save Country"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ NEW GOOD MODAL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {newGoodModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">Add New Good</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Creates a new item in the Goods Master</p>
              </div>
              <button
                type="button"
                onClick={() => { setNewGoodModal(false); setNewGoodError(""); setNewGoodForm({ goodsName: "", chsCode: "" }); }}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >Ã¢Å“â€¢</button>
            </div>
            <div className="p-5 space-y-3">
              {newGoodError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">{newGoodError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] text-muted-foreground mb-1">Goods Name *</label>
                  <input
                    type="text"
                    value={newGoodForm.goodsName}
                    onChange={(e) => setNewGoodForm(p => ({ ...p, goodsName: e.target.value.toUpperCase() }))}
                    placeholder="e.g. PINE NUTS INSHELL"
                    className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">HS Code *</label>
                  <input
                    type="text"
                    value={newGoodForm.chsCode}
                    onChange={(e) => setNewGoodForm(p => ({ ...p, chsCode: e.target.value }))}
                    placeholder="0802.90"
                    className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/60">After saving, this good will be auto-selected with HS Code pre-filled.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={() => { setNewGoodModal(false); setNewGoodError(""); setNewGoodForm({ goodsName: "", chsCode: "" }); }}
                className="px-4 py-1.5 text-[11px] rounded border border-input text-muted-foreground hover:text-foreground transition-colors"
              >Cancel</button>
              <button
                type="button"
                onClick={handleAddNewGood}
                disabled={newGoodLoading}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >{newGoodLoading ? "SavingÃ¢â‚¬Â¦" : "Save Good"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ NEW PORT / BORDER / AIRPORT MODAL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {newPortModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground uppercase">
                  Add New {newPortForm.transportType === "sea" ? "Port" : newPortForm.transportType === "road" ? "Border" : "Airport"}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Adding to {newPortForm.side === "loading" ? "Loading" : "Received"} registry
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setNewPortModal(false); setNewPortError(""); setNewPortForm(p => ({ ...p, portName: "" })); }}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >Ã¢Å“â€¢</button>
            </div>
            <div className="p-5 space-y-3">
              {newPortError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">{newPortError}</div>
              )}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Country Name *</label>
                <select
                  value={newPortForm.countryName || ""}
                  onChange={(e) => setNewPortForm(p => ({ ...p, countryName: e.target.value }))}
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                >
                  <option value="">Select Country...</option>
                  {transitCountryOptions.map(c => <option key={c.name || c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">
                  {newPortForm.transportType === "sea" ? "Port" : newPortForm.transportType === "road" ? "Border" : "Airport"} Name *
                </label>
                <input
                  type="text"
                  value={newPortForm.portName}
                  onChange={(e) => setNewPortForm(p => ({ ...p, portName: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newPortForm.portName.trim()) {
                      handleCreatePort(newPortForm.portName.trim(), newPortForm.countryName, newPortForm.transportType, newPortForm.side);
                      setNewPortModal(false);
                    }
                  }}
                  placeholder={`e.g. ${newPortForm.transportType === "sea" ? "Karachi Port" : newPortForm.transportType === "road" ? "Torkham" : "Kabul Airport"}`}
                  autoFocus
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={() => { setNewPortModal(false); setNewPortError(""); setNewPortForm(p => ({ ...p, portName: "" })); }}
                className="px-4 py-1.5 text-[11px] rounded border border-input text-muted-foreground hover:text-foreground transition-colors"
              >Cancel</button>
              <button
                type="button"
                disabled={!newPortForm.portName.trim()}
                onClick={() => {
                  if (newPortForm.portName.trim()) {
                    handleCreatePort(newPortForm.portName.trim(), newPortForm.countryName, newPortForm.transportType, newPortForm.side);
                    setNewPortModal(false);
                  }
                }}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ NEW GOOD VARIATION MODAL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {customVariationModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground uppercase">
                  Add Good Variation
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Specify size/brand under selected good
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomVariationModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >Ã¢Å“â€¢</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Goods Name</label>
                <input
                  type="text"
                  value={customVariationForm.goodsName}
                  disabled
                  className="w-full bg-muted border border-input rounded px-3 py-1.5 text-muted-foreground text-[11px] outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Brand Name *</label>
                <input
                  type="text"
                  value={customVariationForm.brand}
                  onChange={(e) => setCustomVariationForm(p => ({ ...p, brand: e.target.value.toUpperCase() }))}
                  placeholder="e.g. PREMIUM"
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Size Specification *</label>
                <input
                  type="text"
                  value={customVariationForm.size}
                  onChange={(e) => setCustomVariationForm(p => ({ ...p, size: e.target.value.toUpperCase() }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveCustomVariation();
                    }
                  }}
                  placeholder="e.g. 20/22"
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary uppercase"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={() => setCustomVariationModal(false)}
                className="px-4 py-1.5 text-[11px] rounded border border-input text-muted-foreground hover:text-foreground transition-colors"
              >Cancel</button>
              <button
                type="button"
                onClick={handleSaveCustomVariation}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ CREATE NEW ACCOUNT MODAL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {createAccountModalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  Create New {createAccountType === "purchase" ? "Supplier Account" : "Customer Account"}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Scope: {form.cityBranchId ? "City Branch" : form.countryBranchId ? "Main Branch" : form.countryId ? "Country Scope" : "Super Admin"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateAccountModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >Ã¢Å“â€¢</button>
            </div>
            <div className="p-5 space-y-3">
              {createAccountError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">
                  {createAccountError}
                </div>
              )}

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Account Name *</label>
                <input
                  type="text"
                  value={createAccountForm.name}
                  onChange={(e) => setCreateAccountForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Haji Ahmad Dry Fruits"
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">Account Code *</label>
                  <input
                    type="text"
                    value={createAccountForm.code}
                    onChange={(e) => setCreateAccountForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="AUTO"
                    className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">Currency *</label>
                  <select
                    value={createAccountForm.currency}
                    onChange={(e) => setCreateAccountForm(p => ({ ...p, currency: e.target.value }))}
                    className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">Account Category *</label>
                  <select
                    value={createAccountForm.kind}
                    onChange={(e) => setCreateAccountForm(p => ({ ...p, kind: e.target.value }))}
                    className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                  >
                    <option value="liability">Liability</option>
                    <option value="asset">Asset</option>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="equity">Equity</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={createAccountForm.isControlAccount}
                      onChange={(e) => setCreateAccountForm(p => ({ ...p, isControlAccount: e.target.checked }))}
                      className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    Control Account
                  </label>
                </div>
              </div>

              <p className="text-[9px] text-muted-foreground/60">
                This account will be created under the selected country and branch scoping, and auto-selected.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={() => setCreateAccountModalOpen(false)}
                className="px-4 py-1.5 text-[11px] rounded border border-input text-muted-foreground hover:text-foreground transition-colors"
              >Cancel</button>
              <button
                type="button"
                onClick={handleAddNewAccount}
                disabled={createAccountLoading}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {createAccountLoading ? "SavingÃ¢â‚¬Â¦" : "Save Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Report Modal */}
      {isNewReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border/60 bg-muted/30">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                Create New Report
              </h3>
              <button
                type="button"
                onClick={() => setIsNewReportModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleNewReportSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Report Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={newReportForm.name}
                  onChange={(e) => setNewReportForm({ ...newReportForm, name: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="e.g. Loading Report, Shipping Report"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Description</label>
                <input
                  type="text"
                  value={newReportForm.description}
                  onChange={(e) => setNewReportForm({ ...newReportForm, description: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Notes</label>
                <textarea
                  rows={3}
                  value={newReportForm.notes}
                  onChange={(e) => setNewReportForm({ ...newReportForm, notes: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Additional notes for this report"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewReportModalOpen(false)}
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-9 bg-primary hover:bg-primary/90 font-bold"
                >
                  Create & Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ CREATE NEW COMPANY MODAL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {createCompanyModalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  Create New Company
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Adding to Company Master Settings registry
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateCompanyModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >Ã¢Å“â€¢</button>
            </div>
            <div className="p-5 space-y-3">
              {createCompanyError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">
                  {createCompanyError}
                </div>
              )}

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Company Name *</label>
                <input
                  type="text"
                  value={createCompanyForm.name}
                  onChange={(e) => setCreateCompanyForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Apex Trading LLC"
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Legal Name</label>
                <input
                  type="text"
                  value={createCompanyForm.legalName}
                  onChange={(e) => setCreateCompanyForm(p => ({ ...p, legalName: e.target.value }))}
                  placeholder="e.g. Apex Imports (Optional)"
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Base Currency *</label>
                <select
                  value={createCompanyForm.baseCurrency}
                  onChange={(e) => setCreateCompanyForm(p => ({ ...p, baseCurrency: e.target.value }))}
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <p className="text-[9px] text-muted-foreground/60">
                This company will be saved to the master company registry and auto-selected for the current account.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={() => setCreateCompanyModalOpen(false)}
                className="px-4 py-1.5 text-[11px] rounded border border-input text-muted-foreground hover:text-foreground transition-colors"
              >Cancel</button>
              <button
                type="button"
                onClick={handleAddNewCompany}
                disabled={createCompanyLoading}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {createCompanyLoading ? "SavingÃ¢â‚¬Â¦" : "Save Company"}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ TRANSFER CONFIRMATION MODAL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {transferConfirmModal && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-lg animate-in zoom-in-95 duration-200">
            <div className="bg-blue-900 text-white p-4 flex items-center justify-between border-b border-blue-800">
              <h2 className="font-black tracking-wider uppercase text-sm flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-blue-300" /> Transfer to Payment Module
              </h2>
              <button type="button" onClick={() => setTransferConfirmModal(false)} className="text-blue-300 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-slate-800 bg-slate-50/50">
              <div className="flex items-start gap-3 bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100">
                <CheckSquare className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
                <p className="font-semibold leading-relaxed">
                  You are about to transfer this Sales Booking to the <strong>Sales Transfer / Receipt</strong> module.
                  <br/><br/>
                  <em>Note: No accounting entries (Roznamcha, Ledger) will be posted at this stage. Entries will only be posted when the payment is officially processed.</em>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded p-2.5 bg-white shadow-sm flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Invoice No</span>
                  <div className="font-black font-mono text-slate-900">{form.salesOrderNo}</div>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-white shadow-sm flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Base Entry No</span>
                  <div className="font-black font-mono text-slate-900">{savedOrderNo || "Pending..."}</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-100 border-t border-slate-200 p-4 flex justify-end gap-3 rounded-b-xl">
              <Button type="button" variant="outline" className="font-bold border-slate-300 text-slate-600" onClick={() => setTransferConfirmModal(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 shadow-md transition-all uppercase tracking-wider"
                disabled={savingOrder}
                onClick={() => {
                  setTransferConfirmModal(false);
                  handleTransfer();
                }}
              >
                {savingOrder ? "Processing..." : "Confirm & Transfer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LOT DETAILS MODAL ("Parda") */}
      {isLotModalOpen && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-border overflow-hidden w-full max-w-md animate-in zoom-in-95 duration-200 text-slate-800">
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between">
              <h3 className="font-black text-xs uppercase tracking-wider flex items-center gap-2">
                <Package className="h-4 w-4 text-sky-400" />
                {form.saleSource === "in_transit" ? "Transit Cargo Details" : "Lot Details"}
              </h3>
              <button
                type="button"
                onClick={() => setIsLotModalOpen(false)}
                className="text-white/60 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              {(() => {
                const lot = MOCK_SALE_LOTS.find((l) => l.lotNo === selectedLotId);
                if (!lot) return <p className="text-muted-foreground italic">No lot selected.</p>;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Lot Number</span>
                        <span className="font-mono font-black text-primary text-sm">{lot.lotNo}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Reference Number</span>
                        <span className="font-mono font-bold text-slate-700">{lot.stockRef}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-medium">Goods Name:</span>
                        <span className="font-bold text-slate-900">{lot.goodsName}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-medium">Brand:</span>
                        <span className="font-semibold text-slate-900">{lot.brand}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-medium">Size:</span>
                        <span className="font-semibold text-slate-900">{lot.size}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-medium">Origin:</span>
                        <span className="font-semibold text-slate-900">{lot.origin}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-medium">Available Quantity:</span>
                        <span className="font-black text-emerald-600">{Number(lot.availableQty).toLocaleString()} {lot.qtyName}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-medium">Net Weight:</span>
                        <span className="font-bold text-slate-900">{Number(lot.netWeight).toLocaleString()} KG</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 font-medium">Price:</span>
                        <span className="font-bold text-slate-950">{lot.currencyType} {lot.coursePrice}</span>
                      </div>
                    </div>

                    <div className="bg-sky-50 text-sky-900 p-3 rounded-lg border border-sky-100 flex items-start gap-2.5 mt-2">
                      <input
                        type="checkbox"
                        id="confirm-lot-chk"
                        className="mt-0.5 h-3.5 w-3.5 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
                        defaultChecked
                      />
                      <label htmlFor="confirm-lot-chk" className="font-bold text-[10px] leading-tight cursor-pointer">
                        Confirm selection of this cargo lot to apply details to the goods entry form.
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 font-bold"
                        onClick={() => setIsLotModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 shadow-md"
                        onClick={() => {
                          applySaleLot(lot);
                          setIsLotModalOpen(false);
                        }}
                      >
                        Save & Apply
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







