"use client";
import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
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
import { openPurchaseA4ReportWindow } from "@/lib/reports/open-purchase-a4-report-window";
import { PurchaseBookingJournalReportView } from "./purchase-booking-journal-report-view";

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
// NOTE: COUNTRY_OPTIONS and ORIGIN_OPTIONS removed Ã¢â‚¬â€ countries now come from Location Master.

const MOCK_ACCOUNTS = [
  { accountCode: "AE-AC-0001", accountName: "Dubai Purchase Account", cityBranchName: "Dubai Main Branch", ledgerCurrency: "AED" },
  { accountCode: "SA-2001", accountName: "Damaan Sales Account", cityBranchName: "Dubai Sales Branch", ledgerCurrency: "AED" },
  { accountCode: "US-AC-1002", accountName: "US Vendor Ledger Account", cityBranchName: "New York Branch", ledgerCurrency: "USD" },
  { accountCode: "PK-AC-3001", accountName: "Kharadar Purchase Account", cityBranchName: "Karachi Central Branch", ledgerCurrency: "PKR" },
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

async function lookupPurchaseBookingReport(query, countryId, countryBranchId, cityBranchId, isSuperAdmin) {
  const needle = String(query || "").trim();
  if (!needle) return null;

  const params = new URLSearchParams();
  params.set("purchaseOrderNo", needle);
  params.set("limit", "1");
  if (!isSuperAdmin) {
    if (countryId) params.set("countryId", countryId);
    if (countryBranchId) params.set("countryBranchId", countryBranchId);
    if (cityBranchId) params.set("cityBranchId", cityBranchId);
  }

  const response = await fetch(`/api/erp/purchases/booking-journal-report?${params.toString()}`, {
    credentials: "same-origin"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload?.error?.message || payload?.error || "Purchase booking lookup failed.");
  }
  return payload.data?.reports?.[0] ?? null;
}

const DEFAULT_FORM = {
  countryId: "",
  countryBranchId: "",
  cityBranchId: "",
  purchaseAccountNo: "",
  purchaseAccountName: "",
  purchaseAccountBranch: "",
  purchaseAccountCurrency: "",
  purchaseAccountKind: "",
  purchaseAccountIsControl: false,
  purchaseAccountCurrentBalance: 0,
  purchaseAccountOpeningBalance: 0,
  purchaseAccountStatus: "active",
  purchaseAccountSerialNumber: "",
  purchaseAccountCountrySerialNumber: "",
  purchaseAccountBranchSerialNumber: "",
  purchaseAccountManualReferenceNumber: "",
  purchaseAccountMobile: "",
  purchaseAccountWhatsapp: "",
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
  purchaseContractNo: "",
  purchaseOrderNo: "",
  billNo: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  currencyType: "USD",
  purchaseCurrency: "USD",
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
  supplierId: "",
  supplierName: "",
  customerId: "",
  customerName: "",
  salesStatus: "Draft",
  remarks: "",
  paymentReport: "",
  loadingReport: "",
  orderReportRemarks: "",
  purchaseReportRemarks: "",
  purchaseInvoiceRemarks: "",
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

export function PurchaseOrderWizard({ session }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("booking"); // "booking" | "goods" | "others" | "reports"
  const [isMounted, setIsMounted] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "true" || params.get("id") || params.get("purchaseOrderId")) {
        setIsFormOpen(true);
      }
    }
  }, []);
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
      purchaseOrderNo: `PO-2026-${randomSuffix}`,
      salesOrderNo: `SO-2026-${randomSuffix}`,
      purchaseContractNo: `PC-2026-${randomSuffix}`,
      billNo: `BILL-${randomSuffix}`,
    };
  });
  const [goodsEntries, setGoodsEntries] = useState([]);
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
  const purchaseDropdownRef = React.useRef(null);
  const salesDropdownRef = React.useRef(null);
  const verifyDropdownRef = React.useRef(null);
  const purchaseCompanyDropdownRef = React.useRef(null);
  const salesCompanyDropdownRef = React.useRef(null);

  const [purchaseDropdownOpen, setPurchaseDropdownOpen] = useState(false);
  const [salesDropdownOpen, setSalesDropdownOpen] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [salesSearch, setSalesSearch] = useState("");

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setViewDropdownOpen(false);
      }
      if (purchaseDropdownRef.current && !purchaseDropdownRef.current.contains(event.target)) {
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
      if (purchaseCompanyDropdownRef.current && !purchaseCompanyDropdownRef.current.contains(event.target)) {
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

  const [supplierDetail, setSupplierDetail] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [purchasePinDropdownOpen, setPurchasePinDropdownOpen] = useState(false);
  const [salesPinDropdownOpen, setSalesPinDropdownOpen] = useState(false);
  const [purchaseCompanySelectOpen, setPurchaseCompanySelectOpen] = useState(false);
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Booking Date:</span> <span className="font-semibold text-foreground">{form.purchaseDate}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fiscal Year:</span> <span className="font-semibold">2025-26</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground font-bold">Booking Branch:</span> <span className="font-bold text-emerald-600 dark:text-emerald-450 truncate" title={loginBranchName}>{loginBranchName || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status:</span> <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-1.5 py-0.2 text-[8px] font-bold text-yellow-600 dark:text-yellow-450 uppercase">{form.salesStatus}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">System Serial:</span> <span className="font-bold text-foreground truncate font-mono" title={form.purchaseOrderNo}>{form.purchaseOrderNo}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground font-bold text-primary">Branch Serial:</span> <span className="font-bold text-primary truncate font-mono" title={form.billNo}>{form.billNo}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Contract No:</span> <span className="font-semibold text-foreground truncate font-mono" title={form.purchaseContractNo}>{form.purchaseContractNo}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Loading Mode:</span> <span className="font-semibold text-foreground truncate" title={form.shippingMode}>{form.shippingMode || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Origin Country:</span> <span className="font-semibold text-foreground truncate" title={form.origin || form.branchCountry}>{form.origin || form.branchCountry || "N/A"}</span></div>
                </div>
              </div>

              {/* Card 3: Purchase Account Details */}
              <div className="bg-card border border-border shadow-sm rounded-xl p-3.5 hover:shadow-md hover:border-primary/30 transition duration-200">
                <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-border/60">
                  <span className="p-1 rounded-md bg-primary/10 text-primary dark:bg-primary/20">
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Purchase Account Details</h4>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Account Code:</span> <span className="font-bold text-foreground truncate block w-full text-right font-mono" title={form.purchaseAccountNo}>{form.purchaseAccountNo}</span></div>
                  <div className="space-y-0.5 pt-1">
                    <span className="text-muted-foreground block text-[9px]">Account Name:</span>
                    <span className="font-semibold text-foreground block truncate text-xs text-primary" title={form.purchaseAccountName}>{form.purchaseAccountName}</span>
                  </div>
                  <div className="flex justify-between pt-1"><span className="text-muted-foreground">Branch:</span> <span className="font-semibold text-foreground truncate" title={form.purchaseAccountBranch}>{form.purchaseAccountBranch}</span></div>
                  <div className="flex justify-between pt-0.5"><span className="text-muted-foreground">Currency:</span> <span className="font-bold text-foreground">{form.purchaseAccountCurrency || form.purchaseCurrency || form.secondaryCurrency || "-"}</span></div>
                  <div className="flex justify-between items-center pt-0.5 border-t border-border/20 mt-1 relative" ref={purchaseCompanyDropdownRef}>
                    <span className="text-muted-foreground font-semibold">Company:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-foreground truncate max-w-[100px] text-[8.5px] text-right font-mono" title={form.purchaseCompanyName ? `${form.purchaseCompanyName} (${form.purchaseCompanyCode || "COM-N/A"})` : "None"}>
                        {form.purchaseCompanyName ? `${form.purchaseCompanyName} (${form.purchaseCompanyCode || "COM-N/A"})` : "None"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPurchaseCompanySelectOpen(prev => !prev)}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors shrink-0"
                        title="Select Company"
                      >
                        <Pin className={`h-2.5 w-2.5 ${purchaseCompanySelectOpen ? "text-primary fill-primary/25" : ""}`} />
                      </button>
                    </div>

                    {purchaseCompanySelectOpen && (
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
                                    setValue("purchaseCompanyId", c.id);
                                    setValue("purchaseCompanyName", c.name);
                                    setValue("purchaseCompanyCode", cCode);
                                    setPurchaseCompanySelectOpen(false);
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
                        <div className="border-t border-border/40 pt-1 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPurchaseCompanySelectOpen(false);
                              setCreateCompanyType("purchase");
                              setCreateCompanyForm({ name: "", legalName: "", baseCurrency: "USD" });
                              setCreateCompanyError("");
                              setCreateCompanyModalOpen(true);
                            }}
                            className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold text-primary hover:bg-primary/5 transition text-left"
                          >
                            <span className="text-xs">+</span>
                            <span>New Company</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {form.purchaseAccountName && (
                    <div className="mt-2 pt-2 border-t border-border/40 space-y-2 text-[9px] font-mono text-muted-foreground">
                      {/* Category & Control Type */}
                      <div className="grid grid-cols-2 gap-1 pb-1.5 border-b border-border/20">
                        <div>
                          <span className="text-[7.5px] text-muted-foreground block uppercase">Kind</span>
                          <span className="font-bold text-foreground uppercase">{form.purchaseAccountKind || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] text-muted-foreground block uppercase">Type</span>
                          <span className="font-bold text-foreground truncate block">
                            {form.purchaseAccountIsControl ? "Control" : "Sub-Acct"}
                          </span>
                        </div>
                      </div>

                      {/* Serials Sub-Grid */}
                      <div className="bg-muted/30 p-1.5 rounded-lg border border-border/30 space-y-1">
                        <span className="text-[7.5px] font-black text-primary block uppercase tracking-wider">Serials & Ref</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                          <div>
                            <span className="text-[7px] text-muted-foreground block">Acct S/N</span>
                            <span className="font-semibold text-foreground/90">{form.purchaseAccountSerialNumber || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[7px] text-muted-foreground block">Country S/N</span>
                            <span className="font-semibold text-foreground/90">{form.purchaseAccountCountrySerialNumber || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[7px] text-muted-foreground block">Branch S/N</span>
                            <span className="font-semibold text-foreground/90">{form.purchaseAccountBranchSerialNumber || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[7px] text-muted-foreground block">Manual Ref</span>
                            <span className="font-semibold text-foreground/90">{form.purchaseAccountManualReferenceNumber || "-"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Balances */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-[7.5px] text-muted-foreground block uppercase">Opening Bal</span>
                          <span className="font-bold text-foreground">
                            {currencySymbol(form.purchaseAccountCurrency)} {formatNumber(form.purchaseAccountOpeningBalance)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[7.5px] text-muted-foreground block uppercase">Current Bal</span>
                          <span className={`font-bold ${form.purchaseAccountCurrentBalance >= 0 ? "text-emerald-600 dark:text-emerald-450" : "text-rose-600 dark:text-rose-450"}`}>
                            {currencySymbol(form.purchaseAccountCurrency)} {formatNumber(form.purchaseAccountCurrentBalance)}
                          </span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      {(form.purchaseAccountMobile || form.purchaseAccountWhatsapp) && (
                        <div className="border-t border-border/20 pt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                          {form.purchaseAccountMobile && (
                            <div>
                              <span className="text-[7.5px] text-muted-foreground mr-0.5 font-bold">MOB:</span>
                              <span className="text-foreground font-semibold">{form.purchaseAccountMobile}</span>
                            </div>
                          )}
                          {form.purchaseAccountWhatsapp && (
                            <div>
                              <span className="text-[7.5px] text-emerald-600 dark:text-emerald-450 mr-0.5 font-bold">WA:</span>
                              <span className="text-foreground font-semibold">{form.purchaseAccountWhatsapp}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Sales Account Details */}
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
                  <div className="flex justify-between pt-0.5"><span className="text-muted-foreground">Currency:</span> <span className="font-bold text-foreground">{form.salesAccountCurrency || form.purchaseCurrency || form.secondaryCurrency || "-"}</span></div>
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
                        <div className="border-t border-border/40 pt-1 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSalesCompanySelectOpen(false);
                              setCreateCompanyType("sales");
                              setCreateCompanyForm({ name: "", legalName: "", baseCurrency: "USD" });
                              setCreateCompanyError("");
                              setCreateCompanyModalOpen(true);
                            }}
                            className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold text-primary hover:bg-primary/5 transition text-left"
                          >
                            <span className="text-xs">+</span>
                            <span>New Company</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {form.salesAccountName && (
                    <div className="mt-2 pt-2 border-t border-border/40 space-y-2 text-[9px] font-mono text-muted-foreground">
                      {/* Category & Control Type */}
                      <div className="grid grid-cols-2 gap-1 pb-1.5 border-b border-border/20">
                        <div>
                          <span className="text-[7.5px] text-muted-foreground block uppercase">Kind</span>
                          <span className="font-bold text-foreground uppercase">{form.salesAccountKind || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] text-muted-foreground block uppercase">Type</span>
                          <span className="font-bold text-foreground truncate block">
                            {form.salesAccountIsControl ? "Control" : "Sub-Acct"}
                          </span>
                        </div>
                      </div>

                      {/* Serials Sub-Grid */}
                      <div className="bg-muted/30 p-1.5 rounded-lg border border-border/30 space-y-1">
                        <span className="text-[7.5px] font-black text-primary block uppercase tracking-wider">Serials & Ref</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                          <div>
                            <span className="text-[7px] text-muted-foreground block">Acct S/N</span>
                            <span className="font-semibold text-foreground/90">{form.salesAccountSerialNumber || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[7px] text-muted-foreground block">Country S/N</span>
                            <span className="font-semibold text-foreground/90">{form.salesAccountCountrySerialNumber || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[7px] text-muted-foreground block">Branch S/N</span>
                            <span className="font-semibold text-foreground/90">{form.salesAccountBranchSerialNumber || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[7px] text-muted-foreground block">Manual Ref</span>
                            <span className="font-semibold text-foreground/90">{form.salesAccountManualReferenceNumber || "-"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Balances */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-[7.5px] text-muted-foreground block uppercase">Opening Bal</span>
                          <span className="font-bold text-foreground">
                            {currencySymbol(form.salesAccountCurrency)} {formatNumber(form.salesAccountOpeningBalance)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[7.5px] text-muted-foreground block uppercase">Current Bal</span>
                          <span className={`font-bold ${form.salesAccountCurrentBalance >= 0 ? "text-emerald-600 dark:text-emerald-450" : "text-rose-600 dark:text-rose-450"}`}>
                            {currencySymbol(form.salesAccountCurrency)} {formatNumber(form.salesAccountCurrentBalance)}
                          </span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      {(form.salesAccountMobile || form.salesAccountWhatsapp) && (
                        <div className="border-t border-border/20 pt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                          {form.salesAccountMobile && (
                            <div>
                              <span className="text-[7.5px] text-muted-foreground mr-0.5 font-bold">MOB:</span>
                              <span className="text-foreground font-semibold">{form.salesAccountMobile}</span>
                            </div>
                          )}
                          {form.salesAccountWhatsapp && (
                            <div>
                              <span className="text-[7.5px] text-emerald-600 dark:text-emerald-450 mr-0.5 font-bold">WA:</span>
                              <span className="text-foreground font-semibold">{form.salesAccountWhatsapp}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
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

  // Fetch full details when supplierId changes
  useEffect(() => {
    if (!form.supplierId) {
      setSupplierDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/erp/customers/${form.supplierId}`)
      .then((r) => r.json())
      .then((json) => {
        const cust = json?.customer || json?.data;
        if (!cancelled && cust) {
          setSupplierDetail(cust);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [form.supplierId]);

  // Fetch full details when customerId changes
  useEffect(() => {
    if (!form.customerId) {
      setCustomerDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/erp/customers/${form.customerId}`)
      .then((r) => r.json())
      .then((json) => {
        const cust = json?.customer || json?.data;
        if (!cancelled && cust) {
          setCustomerDetail(cust);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [form.customerId]);

  // Derived country options from Master Settings (pure database-driven, no static fallback lists)
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

  const selectedDbGood = useMemo(() => {
    if (!form.goodsName) return undefined;
    const searchName = form.goodsName.trim().toUpperCase();
    return dbGoods.find(g =>
      (g.goods_name || g.goodsName || "").trim().toUpperCase() === searchName
    );
  }, [dbGoods, form.goodsName]);

  const availableSizes = useMemo(() => {
    const variations = selectedDbGood?.variations || selectedDbGood?.goods_variations || [];
    let filtered = variations;
    if (form.origin) {
      const originCountry = transitCountryOptions.find(c => c.name === form.origin);
      const originCountryId = originCountry?.id || null;
      if (selectedDbGood?.origin_country_id && selectedDbGood.origin_country_id !== originCountryId) {
        filtered = []; // If good origin mismatch, no sizes
      }
    }
    const sizes = [...new Set(filtered.map(v => (v.size || "").trim().toUpperCase()).filter(Boolean))];
    return sizes;
  }, [selectedDbGood, form.origin, transitCountryOptions]);

  const availableBrands = useMemo(() => {
    const variations = selectedDbGood?.variations || selectedDbGood?.goods_variations || [];
    let filtered = variations;
    if (form.origin) {
      const originCountry = transitCountryOptions.find(c => c.name === form.origin);
      const originCountryId = originCountry?.id || null;
      if (selectedDbGood?.origin_country_id && selectedDbGood.origin_country_id !== originCountryId) {
        filtered = [];
      }
    }
    if (form.size) {
      filtered = filtered.filter(v => (v.size || "").trim().toLowerCase() === (form.size || "").trim().toLowerCase());
    }
    const brands = [...new Set(filtered.map(v => (v.brand || "").trim().toUpperCase()).filter(Boolean))];
    return brands;
  }, [selectedDbGood, form.origin, form.size, transitCountryOptions]);

  // Load existing purchase order if purchaseOrderNo or id is in URL query parameters
  useEffect(() => {
    // activeSession is defined at the component level now
    if (!activeSession) return;
    const poNo = searchParams.get("purchaseOrderNo");
    const orderId = searchParams.get("id") || searchParams.get("purchaseOrderId");
    if (!poNo && !orderId) return;
    setIsFormOpen(true);

    let cancelled = false;

    async function loadPO() {
      setSavingOrder(true);
      setSaveMessage("Loading purchase order details...");
      try {
        let poData = null;
        if (orderId) {
          const res = await fetch(`/api/erp/purchases/orders/${encodeURIComponent(orderId)}`, {
            credentials: "same-origin"
          });
          const payload = await res.json().catch(() => ({}));
          if (res.ok && payload.ok) {
            poData = payload.data?.order ?? payload.order ?? null;
          } else {
            throw new Error(payload?.error?.message || payload?.error || "Failed to load purchase order by ID.");
          }
        } else if (poNo) {
          poData = await lookupPurchaseBookingReport(
            poNo,
            activeSession.countryIds?.[0] || activeSession.scopes?.countryIds?.[0] || null,
            activeSession.countryBranchIds?.[0] || activeSession.scopes?.countryBranchIds?.[0] || null,
            activeSession.cityBranchIds?.[0] || activeSession.scopes?.cityBranchIds?.[0] || null,
            isSuperAdmin
          );
        }

        if (cancelled) return;

        if (poData?.form_data?.totals) {
          // You might set reportTotals here if there's a state for it, but usually it's derived.
        }
        if (poData?.form_data?.reports) {
          setReportsList(Array.isArray(poData.form_data.reports) ? poData.form_data.reports : []);
        }

        if (poData) {
          const rawFormData = poData.form_data || {};
          const loadedForm = rawFormData.form || {};
          const loadedGoods = rawFormData.goodsEntries || [];

          const poNumber = poData.purchase_order_no || poData.purchaseBookingOrderNumber || loadedForm.purchaseOrderNo || poNo || "";
          const contractNumber = poData.purchase_contract_no || poData.purchaseContractNo || loadedForm.purchaseContractNo || "";

          setSavedOrderId(poData.id || orderId || "");
          setSavedOrderNo(poNumber);

          const mergedCountryId = loadedForm.countryId || poData.country_id || poData.countryId || "";
          const mergedCountryBranchId = loadedForm.countryBranchId || poData.country_branch_id || poData.countryBranchId || poData.branch_id || poData.branchId || "";
          const mergedCityBranchId = loadedForm.cityBranchId || poData.city_branch_id || poData.cityBranchId || "";

          setForm((prev) => ({
            ...prev,
            ...loadedForm,
            countryId: mergedCountryId,
            countryBranchId: mergedCountryBranchId,
            cityBranchId: mergedCityBranchId,
            // Retain PO/Contract identification numbers
            purchaseOrderNo: poNumber,
            purchaseContractNo: contractNumber,
          }));
          setScopeConfirmed(true);

          // Sync search display labels from the loaded account names
          if (loadedForm.purchaseAccountName || loadedForm.purchaseAccountNo) {
            setPurchaseSearch(loadedForm.purchaseAccountName || loadedForm.purchaseAccountNo || "");
          }
          if (loadedForm.salesAccountName || loadedForm.salesAccountNo) {
            setSalesSearch(loadedForm.salesAccountName || loadedForm.salesAccountNo || "");
          }

          if (Array.isArray(loadedGoods) && loadedGoods.length) {
            setGoodsEntries(loadedGoods);
          }

          // When loading for edit, always show the editable form (not the transfer success screen)
          setIsTransferred(false);
          setTransferredData(null);

          // Render the editing wizard directly at Step 1 (booking) for editing
          setActiveTab("booking");
          setSaveMessage("Purchase order loaded successfully.");
        } else {
          setSaveMessage(`Purchase order not found.`);
        }
      } catch (err) {
        if (cancelled) return;
        setSaveMessage(err instanceof Error ? err.message : "Error loading purchase order.");
      } finally {
        if (!cancelled) setSavingOrder(false);
      }
    }

    loadPO();
    return () => {
      cancelled = true;
    };
  }, [
    searchParams.get("purchaseOrderNo"),
    searchParams.get("id"),
    searchParams.get("purchaseOrderId"),
    !!activeSession
  ]);

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
      const suffix = form.purchaseOrderNo ? form.purchaseOrderNo.split("-").pop() : "0000";

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
    } else {
      setForm(prev => {
        if (!prev.branchCode || prev.branchCode === "BR-KBL-001") {
          return {
            ...prev,
            branchName: "Branch Not Selected",
            branchCode: "BR-XXXX-000",
            branchCity: "",
            branchCountry: ""
          };
        }
        return prev;
      });
    }
  }, [form.countryId, form.countryBranchId, form.cityBranchId, mainBranches, cityBranches, form.purchaseOrderNo, transitCountryOptions]);

  // Auto-select Default Purchase and Sales Accounts for the selected Branch
  useEffect(() => {
    // Only run if we have accounts and a branch is selected
    if (dbAccounts.length === 0 || !form.countryId) return;

    // Wait until the user has actually selected a branch
    const branchContextId = form.cityBranchId || form.countryBranchId;
    if (!branchContextId) return;
    
    // Find matching accounts for the current scope
    const scopedAccounts = dbAccounts.filter(acc => accountMatchesScope(acc));

    // Try to auto-populate if currently empty OR if current account doesn't belong to the new branch
    const purchaseNeedsUpdate = !form.purchaseAccountNo || !scopedAccounts.some(a => a.accountCode === form.purchaseAccountNo);
    const salesNeedsUpdate = !form.salesAccountNo || !scopedAccounts.some(a => a.accountCode === form.salesAccountNo);

    let newPurchaseAcc = null;
    let newSalesAcc = null;

    if (purchaseNeedsUpdate) {
      newPurchaseAcc = scopedAccounts.find(a => String(a.kind || "").toLowerCase() === "liability" && !a.isControlAccount);
      if (!newPurchaseAcc) newPurchaseAcc = scopedAccounts.find(a => String(a.kind || "").toLowerCase() === "liability");
    }
    
    if (salesNeedsUpdate) {
      newSalesAcc = scopedAccounts.find(a => String(a.kind || "").toLowerCase() === "asset" && !a.isControlAccount);
      if (!newSalesAcc) newSalesAcc = scopedAccounts.find(a => String(a.kind || "").toLowerCase() === "asset");
    }

    if (newPurchaseAcc || newSalesAcc) {
      // applyAccountMaster uses functional updates, so it's safe to call sequentially
      if (newPurchaseAcc) applyAccountMaster("purchase", newPurchaseAcc);
      if (newSalesAcc) applyAccountMaster("sales", newSalesAcc);
    }
  }, [form.cityBranchId, form.countryBranchId, dbAccounts]);

  // Load latest exchange rate and set currency when country or branch changes
  useEffect(() => {
    const countryId = form.countryId;
    let localCurrency = ""; // Do NOT default to PKR unconditionally!
    const activeCountry = transitCountryOptions.find(c => String(c.id) === String(countryId)) || countries.find(c => String(c.id) === String(countryId));

    // Determine the active country name or ISO from either the selected country or the user's session scope
    const cName = activeCountry?.name || session?.countryName || session?.scopes?.countryName || "";
    const iso = activeCountry?.iso2 || "";

    if (cName) {
      const name = cName.toUpperCase();
      if (iso === "AE" || name.includes("UNITED ARAB EMIRATES") || name.includes("DUBAI") || name.includes("UAE")) localCurrency = "AED";
      else if (iso === "PK" || name.includes("PAKISTAN")) localCurrency = "PKR";
      else if (iso === "AF" || name.includes("AFGHANISTAN")) localCurrency = "AFN";
      else if (iso === "IN" || name.includes("INDIA")) localCurrency = "INR";
      else if (iso === "IR" || name.includes("IRAN")) localCurrency = "IRR";
      else if (iso === "US" || name.includes("UNITED STATES")) localCurrency = "USD";
    }

    // Fallback if no country match
    if (!localCurrency) localCurrency = "USD";


    setForm((prev) => {
      let newPurchaseCurr = prev.purchaseCurrency;
      let newPurchaseAccCurr = prev.purchaseAccountCurrency;
      let newSalesAccCurr = prev.salesAccountCurrency;

      // If no account is selected, sync the ledger currencies to the branch's local currency.
      // This prevents a stale "PKR" default from sticking when country options load late.
      if (!prev.purchaseAccountNo) {
        newPurchaseCurr = localCurrency;
        newPurchaseAccCurr = localCurrency;
      }
      if (!prev.salesAccountNo) {
        newSalesAccCurr = localCurrency;
      }

      return {
        ...prev,
        // We no longer blindly overwrite currencyType so product pricing can remain independent.
        purchaseCurrency: newPurchaseCurr || localCurrency,
        purchaseAccountCurrency: newPurchaseAccCurr || localCurrency,
        salesAccountCurrency: newSalesAccCurr || localCurrency,
        secondaryCurrency: (prev.secondaryCurrency === "PKR" && localCurrency !== "PKR") ? localCurrency : (prev.secondaryCurrency || localCurrency),
      };
    });
  }, [form.countryId, form.countryBranchId, transitCountryOptions]);

  // Keep display labels in sync with UUID scopes
  useEffect(() => {
    const activeCountry = countries.find(c => c.id === form.countryId);
    const activeMainBranch = mainBranches.find(b => b.id === form.countryBranchId);
    const activeCityBranch = cityBranches.find(cb => cb.id === form.cityBranchId);

    setForm(prev => ({
      ...prev,
      branchCountry: activeCountry?.name || prev.branchCountry,
      branchName: activeCityBranch?.name || activeMainBranch?.name || prev.branchName,
      branchCode: activeCityBranch?.code || activeMainBranch?.code || prev.branchCode,
      branchCity: activeCityBranch?.city_name || prev.branchCity,
    }));
  }, [form.countryId, form.countryBranchId, form.cityBranchId, countries, mainBranches, cityBranches]);

  // Dynamic live item totals (used for display in Step 2)
  const currentItemTotals = useMemo(() => calculateItemTotals(form), [form]);

  // Aggregated totals over all goods entries
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

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleDivideTypeChange = (e) => {
    const type = e.target.value;
    let weight = form.divideWeight;
    if (type === "D/KGs") weight = 1.0;
    else if (type === "D/Ton") weight = 1000.0;
    else if (type === "D/Bag") weight = form.qtyKgs || 1.0;
    setForm(prev => ({ ...prev, divideType: type, divideWeight: weight }));
  };

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
      acc.accountSerialNumber,
      acc.countrySerialNumber,
      acc.branchSerialNumber,
      acc.mobile,
      acc.whatsapp,
      acc.companyName
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  };

  const accountMatchesScope = (acc) => {
    // For non-Super Admins, strictly enforce session country/branch scopes first
    if (!isSuperAdmin) {
      const allowedCountryId = activeSession?.countryIds?.[0] || activeSession?.scopes?.countryIds?.[0] || null;
      const allowedBranchId = activeSession?.cityBranchIds?.[0] || activeSession?.scopes?.cityBranchIds?.[0] || null;
      
      if (allowedCountryId && acc.countryId !== allowedCountryId) {
        return false;
      }
      if (allowedBranchId && acc.cityBranchId !== allowedBranchId) {
        return false;
      }
    }
    
    // Narrow down based on form country/branch selection (e.g. for Super Admins)
    if (form.countryId && acc.countryId !== form.countryId) {
      return false;
    }
    if (form.cityBranchId && acc.cityBranchId !== form.cityBranchId) {
      return false;
    }
    
    return true;
  };
  const formatAccountDisplayLabel = (accountName, accountCode, manualReferenceNumber) => {
    const name = accountName || "Unnamed Account";
    const code = accountCode || "No Code";
    const manual = manualReferenceNumber ? ` [Manual: ${manualReferenceNumber}]` : "";
    return `${name} (${code})${manual}`;
  };
  const applyAccountMaster = (type, account) => {
    if (!account) return;
    const accountNo = account.accountCode || account.rawAccountCode || account.ledgerCode || account.code || "";

    // Find the rich account from dbAccounts if available to get extra attributes
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
            purchaseAccountNo: accountNo,
            purchaseAccountName: accountName,
            purchaseAccountBranch: branchName,
            purchaseAccountCurrency: currency || prev.purchaseAccountCurrency || prev.purchaseCurrency || prev.secondaryCurrency || "PKR",
            purchaseCurrency: currency || prev.purchaseCurrency || prev.secondaryCurrency || "PKR",
            supplierId: entityId,
            purchaseAccountLedgerId: entityId,
            supplierName: accountName || prev.supplierName,
            purchaseCompanyId: resolvedCompId,
            purchaseCompanyName: cName,
            purchaseCompanyCode: cCode,
            purchaseAccountKind: richAccount.kind || richAccount.accountKind || "",
            purchaseAccountIsControl: richAccount.isControlAccount ?? richAccount.is_control_account ?? false,
            purchaseAccountCurrentBalance: richAccount.currentBalance ?? richAccount.current_balance ?? 0,
            purchaseAccountOpeningBalance: richAccount.openingBalance ?? richAccount.opening_balance ?? 0,
            purchaseAccountStatus: richAccount.status || "active",
            purchaseAccountSerialNumber: richAccount.accountSerialNumber ?? richAccount.account_serial_number ?? "",
            purchaseAccountCountrySerialNumber: richAccount.countrySerialNumber ?? richAccount.country_serial_number ?? "",
            purchaseAccountBranchSerialNumber: richAccount.branchSerialNumber ?? richAccount.branch_serial_number ?? "",
            purchaseAccountManualReferenceNumber: richAccount.manualReferenceNumber ?? richAccount.manual_reference_number ?? "",
            purchaseAccountMobile: richAccount.mobile ?? richAccount.customers?.mobile ?? "",
            purchaseAccountWhatsapp: richAccount.whatsapp ?? richAccount.customers?.whatsapp ?? "",
          }
        : {
            salesAccountNo: accountNo,
            salesAccountName: accountName,
            salesAccountBranch: branchName,
            salesAccountCurrency: currency || prev.salesAccountCurrency || prev.purchaseCurrency || prev.secondaryCurrency || "PKR",
            customerId: entityId,
            salesAccountLedgerId: entityId,
            customerName: accountName || prev.customerName,
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
      // Do NOT force currencyType here so pricing currency remains unchanged
    }));

    // Sync search display text to empty so input cleanly shows Account Name (Code)
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
    // Update only the local search display state Ã¢â‚¬â€ do NOT overwrite the
    // form account code field with raw text. The account code will only be
    // set once a valid account is confirmed via selection or background lookup.
    if (type === "purchase") {
      setPurchaseSearch(val);
      setPurchaseDropdownOpen(true);
      // Clear the stored account if text is cleared
      if (!val.trim()) {
        setForm((prev) => ({
          ...prev,
          purchaseAccountNo: "",
          purchaseAccountName: "",
          purchaseAccountBranch: "",
          purchaseAccountCurrency: "",
          purchaseAccountKind: "",
          purchaseAccountIsControl: false,
          purchaseAccountCurrentBalance: 0,
          purchaseAccountOpeningBalance: 0,
          purchaseAccountStatus: "active",
          purchaseAccountSerialNumber: "",
          purchaseAccountCountrySerialNumber: "",
          purchaseAccountBranchSerialNumber: "",
          purchaseAccountManualReferenceNumber: "",
          purchaseAccountMobile: "",
          purchaseAccountWhatsapp: "",
        }));
      }
    } else {
      setSalesSearch(val);
      setSalesDropdownOpen(true);
      // Clear the stored account if text is cleared
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
      // Debounced background lookup
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
      ? (purchaseSearch || form.purchaseAccountNo)
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
        `${type === "purchase" ? "Purchase" : "Sales"} account loaded: ${account.accountName}`
      );
    } catch (error) {
      setAccountLookupMessage(error instanceof Error ? error.message : "Account lookup failed.");
    } finally {
      setAccountLookupLoading(null);
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
      purchaseCurrency: row.purchaseCurrency,
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

  const handleCreatePort = async (portName, countryName, transportType, side) => {
    const targetCountryName = (countryName || "").trim();
    const country = transitCountryOptions.find(c => c.name?.toLowerCase() === targetCountryName.toLowerCase())
      || allCountries.find(c => c.name?.toLowerCase() === targetCountryName.toLowerCase())
      || countries.find(c => c.name?.toLowerCase() === targetCountryName.toLowerCase());
    const countryId = country?.id || null;

    setSavingOrder(true);
    setSaveMessage(`Creating ${transportType} port "${portName}"...`);
    try {
      const endpoint = side === "loading" ? "/api/erp/ports/loading" : "/api/erp/ports/received";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portName,
          countryId,
          portCode: null,
          transportType,
          isActive: true
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "Failed to create port.");
      }

      // Re-fetch port list
      const [loadRes, recRes] = await Promise.all([
        fetch("/api/erp/ports/loading?all=true&limit=500").then(r => r.json()).catch(() => ({})),
        fetch("/api/erp/ports/received?all=true&limit=500").then(r => r.json()).catch(() => ({}))
      ]);

      const loadPorts = loadRes?.data?.ports || loadRes?.ports;
      const recPorts = recRes?.data?.ports || recRes?.ports;
      if (loadPorts) setDbLoadingPorts(loadPorts);
      if (recPorts) setDbReceivedPorts(recPorts);

      // Set the newly created port value in form across all fields
      if (side === "loading") {
        setValue("loadingPort", portName);
        setValue("loadingLocation", portName);
        setValue("loadingBorder", portName);
        setValue("airportName", portName);
        if (targetCountryName) {
          setValue("loadingCountry", targetCountryName);
          setValue("originCountry", targetCountryName);
          setValue("origin", targetCountryName);
        }
      } else {
        setValue("receivedPort", portName);
        setValue("receivedBorder", portName);
        setValue("receivedPortName", portName);
        setValue("receivingPort", portName);
        setValue("destinationPort", portName);
        if (targetCountryName) {
          setValue("receivedCountry", targetCountryName);
          setValue("receivingCountry", targetCountryName);
          setValue("destinationCountry", targetCountryName);
        }
      }

      setSaveMessage(`Port "${portName}" created successfully.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating port.");
    } finally {
      setSavingOrder(false);
    }
  };

  const buildPurchaseOrderPayload = (ledgerPostingStatus = "Pending", customOrderNo = null) => {
    const usdRate = Number(form.exchangeRate || 1);

    return {
      countryId: form.countryId || null,
      countryBranchId: form.countryBranchId || null,
      cityBranchId: form.cityBranchId || null,
      supplierCompanyId: form.purchaseCompanyId || null,
      purchaseOrderNo: customOrderNo || form.purchaseOrderNo,
      purchaseContractNo: form.purchaseContractNo || form.purchaseOrderNo,
      currencyCode: form.currencyType || "USD",
      paymentCurrencyCode: form.secondaryCurrency?.split(" ")[0] || "PKR",
      exchangeRate: usdRate,
      orderTotal: reportTotals.grandFinal || reportTotals.grandPrimaryFinal,
      totalGoodsOriginal: reportTotals.grandPrimaryFinal || reportTotals.grandFinal,
      totalGoodsLocal: reportTotals.grandFinal || reportTotals.grandPrimaryFinal,
      totalGoodsUsd: reportTotals.grandPrimaryFinal || reportTotals.grandFinal,
      items: goodsEntries.map(g => {
        const rateOrig = Number(g.coursePrice || 0);
        const rateLoc = rateOrig * usdRate;
        const totOrig = Number(g.totalAmount || 0);
        const totLoc = Number(g.finalAmount || totOrig * usdRate);
        return {
          goodsName: g.goodsName,
          hsCode: g.hsCode,
          size: g.size,
          brand: g.brand,
          origin: g.origin,
          quantity: g.qtyNo,
          unitName: g.qtyName,
          unitWeight: g.divideWeight,
          grossWeight: g.grossWeight,
          netWeight: g.netWeight,
          rateOriginal: rateOrig,
          rateLocal: rateLoc,
          rateUsd: rateOrig,
          totalOriginal: totOrig,
          totalLocal: totLoc,
          totalUsd: totOrig
        };
      }),
      paymentStatus: ledgerPostingStatus === "Posted" ? "partial" : "pending",
      ledgerPostingStatus,
      formData: {
        form,
        totals: reportTotals,
        goodsEntries: goodsEntries,
        reports: reportsList,
        workflow: {
          currentStep: ledgerPostingStatus === "Posted" ? "Journal Entry & Payment" : "Booking Purchase Order",
          nextStep: ledgerPostingStatus === "Posted" ? "Payment & Documents" : "Booking Confirm",
          bookingStatus: "Saved",
          confirmationStatus: ledgerPostingStatus === "Posted" ? "Confirmed" : "Pending",
          journalStatus: ledgerPostingStatus === "Posted" ? "Posted" : "Pending",
          paymentStatus: ledgerPostingStatus === "Posted" ? "Advance Posted" : "Pending",
          containerStatus: "Pending",
          inventoryStatus: "Pending",
          deliveryStatus: "Pending",
          savedAt: new Date().toISOString(),
        },
        savedAt: new Date().toISOString()
      }
    };
  };

  const isSubmittingRef = React.useRef(false);

  const handleSavePurchaseOrder = async (shouldClose = false) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSavingOrder(true);
    setSaveMessage("");
    try {
      const nextOrderNo = (form.purchaseOrderNo || await fetchNextPurchaseOrderNo()).trim();
      const response = await fetch(savedOrderId ? `/api/erp/purchases/orders/${savedOrderId}` : "/api/erp/purchases/orders", {
        method: savedOrderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPurchaseOrderPayload("Pending", nextOrderNo))
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const errDetails = payload?.error?.details ? JSON.stringify(payload.error.details) : "";
        throw new Error(`${payload?.error?.message || payload?.error || "Purchase order failed to save."} ${errDetails}`);
      }
      const returnedOrderId = payload.data?.purchaseOrderId || savedOrderId || payload.data?.id;
      const returnedOrderNo = payload.data?.purchaseOrderNo || savedOrderNo || form.purchaseOrderNo;
      setSavedOrderId(returnedOrderId || "");
      setSavedOrderNo(returnedOrderNo);
      setSaveMessage(`Successfully saved Purchase Order: ${returnedOrderNo}.`);
      setRegisterRefreshKey((key) => key + 1);

      if (shouldClose) {
        setIsFormOpen(false);
        handleReset();
        if (searchParams.get("id") || searchParams.get("purchaseOrderNo")) {
          router.push("/dashboard/purchase/purchase-booking-journal-report");
        }
      } else if (savedOrderId) {
        // Editing an existing order — close form and show the list
        setIsFormOpen(false);
        router.push("/dashboard/purchase/purchase-booking-journal-report");
      } else {
        setActiveTab("report");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving order.";
      setSaveMessage(msg);
      alert(msg); // Ensure the user actually sees the error!
    } finally {
      isSubmittingRef.current = false;
      setSavingOrder(false);
    }
  };

  const handleTransfer = async () => {
    setSavingOrder(true);
    setSaveMessage("");
    try {
      const isAccepting = false && form.purchaseOrderNo;
      const ledgerStatus = isAccepting ? "Pending" : "Pending";
      const nextOrderNo = (form.purchaseOrderNo || await fetchNextPurchaseOrderNo()).trim();
      const transferPayload = buildPurchaseOrderPayload(ledgerStatus, nextOrderNo);
      const response = await fetch(savedOrderId ? `/api/erp/purchases/orders/${savedOrderId}` : "/api/erp/purchases/orders", {
        method: savedOrderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferPayload)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const errDetails = payload?.error?.details ? JSON.stringify(payload.error.details) : "";
        throw new Error(`${payload?.error?.message || payload?.error || "Purchase order failed to save."} ${errDetails}`);
      }
      const returnedOrderId = payload.data?.purchaseOrderId || savedOrderId || payload.data?.id;
      const returnedOrderNo = payload.data?.purchaseOrderNo || savedOrderNo || form.purchaseOrderNo;
      
      // Now call the transfer API to actually post to Roznamcha
      if (returnedOrderId) {
        const transferResponse = await fetch(`/api/erp/purchases/orders/${returnedOrderId}/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        const transferPayload = await transferResponse.json().catch(() => ({}));
        if (!transferResponse.ok || !transferPayload.ok) {
          throw new Error(transferPayload?.error?.message || transferPayload?.error || "Roznamcha/Ledger Transfer failed.");
        }
      }

      setSavedOrderId(returnedOrderId || "");
      setSavedOrderNo(returnedOrderNo);
      setSaveMessage(`Transferred Purchase Order ${returnedOrderNo} to Journal / Payment and ledger posting.`);
      setTransferredData(payload.data || { purchaseOrderNo: returnedOrderNo });
      setIsTransferred(true);
      setRegisterRefreshKey((key) => key + 1);
      
      // Redirect to Purchase Transfer Payment screen directly after successful transfer
      window.location.href = `/dashboard/journal/purchase-order-payment/advance?purchaseOrderNo=${encodeURIComponent(returnedOrderNo)}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving order.";
      setSaveMessage(msg);
      alert(msg);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleTransferEmpty = async () => {
    setSavingOrder(true);
    setSaveMessage("");
    try {
      const isAccepting = false && form.purchaseOrderNo;
      const ledgerStatus = isAccepting ? "Pending" : "Pending";
      const nextOrderNo = (form.purchaseOrderNo || await fetchNextPurchaseOrderNo()).trim();
      const transferPayload = buildPurchaseOrderPayload(ledgerStatus, nextOrderNo);
      const response = await fetch(savedOrderId ? `/api/erp/purchases/orders/${savedOrderId}` : "/api/erp/purchases/orders", {
        method: savedOrderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferPayload)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const errDetails = payload?.error?.details ? JSON.stringify(payload.error.details) : "";
        throw new Error(`${payload?.error?.message || payload?.error || "Purchase order failed to save."} ${errDetails}`);
      }
      const returnedOrderId = payload.data?.purchaseOrderId || savedOrderId || payload.data?.id;
      const returnedOrderNo = payload.data?.purchaseOrderNo || savedOrderNo || form.purchaseOrderNo;
      
      // Now call the transfer API to actually post to Roznamcha
      if (returnedOrderId) {
        const transferResponse = await fetch(`/api/erp/purchases/orders/${returnedOrderId}/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        const transferPayload = await transferResponse.json().catch(() => ({}));
        if (!transferResponse.ok || !transferPayload.ok) {
          throw new Error(transferPayload?.error?.message || transferPayload?.error || "Roznamcha/Ledger Transfer failed.");
        }
      }

      setSavedOrderId(returnedOrderId || "");
      setSavedOrderNo(returnedOrderNo);
      setSaveMessage(`Transferred Purchase Order ${returnedOrderNo}.`);
      setTransferredData(payload.data || { purchaseOrderNo: returnedOrderNo });
      setIsTransferred(true);
      setRegisterRefreshKey((key) => key + 1);
      
      // Redirect to Purchase Transfer Payment screen (Empty form, no pre-fill)
      window.location.href = `/dashboard/journal/purchase-order-payment/advance`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving order.";
      setSaveMessage(msg);
      alert(msg);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDelete = async () => {
    if (!savedOrderId) return;
    if (!window.confirm("Are you sure you want to permanently delete this booking? All associated ledger transfers will be reverted.")) {
      return;
    }

    setSavingOrder(true);
    setSaveMessage("Deleting booking and reverting transfers...");
    try {
      const response = await fetch(`/api/erp/purchases/orders/${savedOrderId}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "Failed to delete booking.");
      }

      alert("Booking successfully deleted and transfers reverted.");
      setRegisterRefreshKey(k => k + 1);
      setIsFormOpen(false);
      handleReset();
      router.push("/dashboard/purchase/purchase-booking-journal-report");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting order.");
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
      purchaseBookingOrderNumber: form.purchaseOrderNo,
      purchaseDate: form.purchaseDate,
      bookingDate: form.purchaseDate,
      purchaseAccountName: form.purchaseAccountName,
      purchaseAccountNumber: form.purchaseAccountNo,
      salesAccountName: form.salesAccountName,
      salesAccountNumber: form.salesAccountNo,
      supplierName: form.supplierName || "N/A",
      buyerName: form.customerName || "N/A",
      productName: firstGoodName,
      goodsDescription: rawRemarks,
      quantity: reportTotals.totalQty,
      unit: firstQtyUnit,
      totalWeight: reportTotals.totalNet,
      containerCount: form.containerCount || 0,
      purchaseRate: avgRateKg,
      totalPurchaseAmount: reportTotals.grandPrimaryFinal,
      currency: form.currencyType,
      status: isTransferred ? "Posted" : "Pending",
      paymentStatus: isTransferred ? "partial" : "pending",
      branchName: form.branchName || "Main Branch",
      countryName: form.branchCountry || "Country",
      createdAt: new Date().toISOString(),
      totalGrossWeight: reportTotals.totalGross,
      totalNetWeight: reportTotals.totalNet,
      purchaseAmount: reportTotals.grandPrimaryFinal,
      finalAmount: reportTotals.grandFinal,
      form_data: { form, goodsEntries },
      audit: {
        userName: form.userName || "Admin User",
        userId: form.userId || "USR-1001",
        branchCode: form.branchCode || "BR-KBL-001"
      }
    };

    openPurchaseA4ReportWindow({
      title: "Purchase Booking Order",
      subtitle: "DGT Accounts Purchase Registry",
      purchaseData: reportData,
      autoPrint
    });
  };

  const handleReset = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setForm({
      ...DEFAULT_FORM,
      purchaseOrderNo: `PO-2026-${randomSuffix}`,
      salesOrderNo: `SO-2026-${randomSuffix}`,
      purchaseContractNo: `PC-2026-${randomSuffix}`,
      billNo: `BILL-2026-${randomSuffix}`,
      purchaseDate: new Date().toISOString().slice(0, 10),
      purchaseAccountNo: "",
      purchaseAccountName: "",
      purchaseAccountBranch: "",
      purchaseAccountCurrency: "",
      salesAccountNo: "",
      salesAccountName: "",
      salesAccountBranch: "",
      salesAccountCurrency: "",
      remarks: "",
      orderReportRemarks: "",
      purchaseReportRemarks: "",
      purchaseInvoiceRemarks: "",
      showRemarksOnA4: true,
      manualTotalAmount: "",
      manualFinalAmount: "",
    });
    setGoodsEntries([]);
    setSavedOrderId("");
    setSavedOrderNo("");
    setTransferredData(null);
    setIsTransferred(false);
    setPreviewType("booking_report");
    setPreviewModalOpen(false);
    setReportsList([]);
    setSelectedReportId("");
    setReportSaved(false);
    setPurchaseSearch("");
    setSalesSearch("");
    setSaveMessage("All inputs and goods listings cleared.");
  };


  // Ã¢â€â‚¬Ã¢â€â‚¬ Inline Master Creation Handlers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
      // Refresh goods list and auto-select the new good
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
      ? (supplierDetail ? (supplierDetail.company_name ? `${supplierDetail.customer_name} (${supplierDetail.company_name})` : supplierDetail.customer_name) : (form.supplierName || ""))
      : (customerDetail ? (customerDetail.customer_name ? `${customerDetail.customer_name} (${customerDetail.company_name})` : customerDetail.customer_name) : (form.customerName || ""));

    setCreateAccountType(type);
    setCreateAccountForm({
      code: "AUTO",
      name: defaultName,
      kind: type === "purchase" ? "liability" : "asset",
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
        customerId: createAccountType === "purchase" ? form.supplierId : form.customerId,
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

      // Refresh accounts list
      const reloadRes = await fetch("/api/erp/accounting/accounts?limit=1000").then(r => r.json()).catch(() => ({}));
      if (reloadRes?.data?.accounts) {
        const mapped = reloadRes.data.accounts.map(acc => ({
            accountCode: acc.code || acc.account_number,
            accountName: acc.name,
            cityBranchName: acc.branch_code || "",
            ledgerCurrency: acc.currency || "USD",
            customerId: acc.customer_id || acc.customerId || null,
            companyId: acc.company_id || null,
            mobile: acc.customers?.mobile || "",
            whatsapp: acc.customers?.whatsapp || "",
            kind: acc.kind || "",
            isControlAccount: acc.is_control_account || false,
            currentBalance: acc.current_balance || 0,
            openingBalance: acc.opening_balance || 0,
            status: acc.status || "active",
            accountSerialNumber: acc.account_serial_number || "",
            countrySerialNumber: acc.country_serial_number || "",
            branchSerialNumber: acc.branch_serial_number || "",
            manualReferenceNumber: acc.manual_reference_number || "",
            countryId: acc.country_id || null,
            countryBranchId: acc.country_branch_id || null,
            cityBranchId: acc.city_branch_id || null
        }));
        setDbAccounts(mapped);

        // Find the created account
        const createdAcc = mapped.find(acc => acc.accountCode === payloadData.accountCode);
        if (createdAcc) {
          applyAccountMaster(createAccountType, createdAcc);
        } else {
          // Fallback if not found in reload (e.g. scoping lag)
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

      // Refresh companies list from database
      const reloadRes = await fetch("/api/erp/companies?limit=100").then(r => r.json()).catch(() => ({}));
      const companiesData = reloadRes?.data?.companies || reloadRes?.companies;
      if (companiesData) {
        setDbCompanies(companiesData);
      } else {
        // Fallback: append locally
        setDbCompanies(prev => [...prev, { id: createdId, name: finalName, legal_name: legalName.trim() || finalName }]);
      }

      // Automatically select the newly created company for the active card
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
      // Auto-create the Good if it doesn't exist yet
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

        // Skip variation POST since initialVariation was passed, just reload
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

  const headerTitle = (
    <div className="flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h2 className="text-[11px] sm:text-xs font-black tracking-tight uppercase text-foreground">
          Purchase Booking Order
        </h2>
      </div>
      <div className="h-4 w-px bg-border/60"></div>
      <h2 className="text-[11px] sm:text-xs font-black tracking-tight uppercase text-primary/80">
        Purchase Booking Report
      </h2>
    </div>
  );

  const headerActions = (
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
          onClick={() => setIsFormOpen(false)}
          className="flex items-center gap-1 h-7.5 px-2.5 bg-slate-700 hover:bg-slate-800 text-white transition-all shadow-md font-bold text-[10px]"
        >
          ← Register
        </Button>
        <Button
          type="button"
          onClick={handleReset}
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
          className="flex items-center gap-1 h-7.5 px-2 bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-md font-bold text-[10px]"
        >
          <MoreVertical className="h-3.5 w-3.5" /> Actions
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
                if (searchParams.get("id") || searchParams.get("purchaseOrderNo")) {
                  router.push("/dashboard/purchase/purchase-booking-journal-report");
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
                openTradeDocumentWindow("contract", { form_data: { form, goodsEntries }, containerCount: form.containerCount });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <FileSignature className="h-3.5 w-3.5 text-purple-500" />
              <span>Print Contract</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                openTradeDocumentWindow("proforma", { form_data: { form, goodsEntries }, containerCount: form.containerCount });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              <span>Print Proforma Invoice</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                openTradeDocumentWindow("commercial", { form_data: { form, goodsEntries }, containerCount: form.containerCount });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <Receipt className="h-3.5 w-3.5 text-rose-500" />
              <span>Print Commercial Invoice</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                openTradeDocumentWindow("packing", { form_data: { form, goodsEntries }, containerCount: form.containerCount });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <Package className="h-3.5 w-3.5 text-emerald-500" />
              <span>Print Packing List</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                alert("Email action triggered!");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition border-t border-border/40 pt-2 mt-1"
            >
              <Mail className="h-3.5 w-3.5 text-indigo-500" />
              <span>Email</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                alert("WhatsApp action triggered!");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                alert("Checkup action triggered!");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <CheckSquare className="h-3.5 w-3.5 text-yellow-500" />
              <span>Checkup</span>
            </button>
          </div>
        )}
    </div>
  );

  if (!isFormOpen) {
    return (
      <div className="space-y-6 text-foreground bg-background">
        <PurchaseBookingJournalReportView
          refreshKey={registerRefreshKey}
          highlightPurchaseOrderNo={savedOrderNo}
          onNewBooking={() => {
            handleReset();
            setSavedOrderId("");
            setSavedOrderNo("");
            setIsFormOpen(true);
            setActiveTab("booking");
          }}
        />
      </div>
    );
  }

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

    // Auto-save the purchase order to persist the new report in form_data
    if (savedOrderId) {
      setTimeout(() => {
        handleSavePurchaseOrder(false);
      }, 100);
    }
  };

  const handleUpdateCurrentReport = () => {
    if (!selectedReportId) return;
    const currentReportIndex = reportsList.findIndex(r => r.id === selectedReportId);
    if (currentReportIndex === -1) return;

    const updatedReports = [...reportsList];
    updatedReports[currentReportIndex] = {
      ...updatedReports[currentReportIndex],
      updatedAt: new Date().toISOString()
    };
    setReportsList(updatedReports);
    handleSavePurchaseOrder(false);
  };

  const handleDeleteReport = (id) => {
    if (!window.confirm("Are you sure you want to delete this report?")) return;
    const updatedReports = reportsList.filter(r => r.id !== id);
    setReportsList(updatedReports);
    if (selectedReportId === id) setSelectedReportId("");
    if (savedOrderId) {
      setTimeout(() => {
        handleSavePurchaseOrder(false);
      }, 100);
    }
  };

  return (
    <div className="space-y-2 text-foreground bg-background mt-[-10px] max-w-[1500px] mx-auto">
      {isSuperAdmin && (!form.countryId || !form.countryBranchId || !scopeConfirmed) && (
        <SimpleModal
          isOpen={true}
          onClose={() => {}} // Cannot close without selecting
          title="Super Admin: Select Working Scope"
          width="md"
        >
          <div className="space-y-4 p-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Please select the Country, Branch, and City Branch you want to work in for Purchase Orders.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black">Country</label>
                <select
                  value={form.countryId}
                  onChange={(e) => {
                    const country = countries.find(c => c.id === e.target.value);
                    setForm(p => ({
                      ...p,
                      countryId: e.target.value,
                      countryBranchId: "",
                      cityBranchId: "",
                      currencyType: "USD",
                      purchaseCurrency: country ? country.currency_code : p.purchaseCurrency,
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
                  value={form.countryBranchId}
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
      )}
      {isTransferred ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="space-y-1">
            <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20">
              POSTED VOUCHER REGISTRATION
            </span>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
              Voucher JV-{(transferredData?.purchaseOrderNo || form.purchaseOrderNo).slice(-6)} Successfully Registered
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              The purchase booking has been successfully transferred to payment records and logged into the accounts ledger database.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleReset}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl shadow-md transition-all border-none font-bold"
            >
              + New Booking
            </Button>
            <Button
              type="button"
              onClick={handleTransfer}
              disabled={savingOrder || isTransferred}
              className="font-bold text-[10px] h-8 px-6 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingOrder ? "Saving..." : isTransferred ? "Transferred" : "Save & Transfer to Journal"}
            </Button>
            <Button
              type="button"
              onClick={handleTransferEmpty}
              disabled={savingOrder || isTransferred}
              className="font-bold text-[10px] h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {savingOrder ? "Saving..." : isTransferred ? "Transferred" : "Transfer to Payment Form (Empty)"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {titlePortal && actionsPortal ? (
            <>
              {createPortal(headerTitle, titlePortal)}
              {createPortal(headerActions, actionsPortal)}
            </>
          ) : (
            <div className="pb-2 border-b border-border/60 flex items-center justify-between">
               {headerTitle}
               {headerActions}
            </div>
          )}

          {activeTab === "report" && isMounted && document.getElementById("erp-page-actions-slot") && createPortal(
            <>
              {!savedOrderId && (
                <Button
                  type="button"
                  onClick={() => handleSavePurchaseOrder(false)}
                  disabled={savingOrder}
                  className="h-10 text-[11px] font-black tracking-wider uppercase px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_4px_14px_0_rgb(5,150,105,0.39)] hover:shadow-[0_6px_20px_rgba(5,150,105,0.23)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4"/>}
                  {savingOrder ? "ACCEPTING..." : "ACCEPT BOOKING"}
                </Button>
              )}

              {savedOrderId && !isTransferred && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setTransferConfirmModal(true)}
                    disabled={savingOrder}
                    className="h-10 text-[11px] font-black tracking-wider uppercase px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_14px_0_rgb(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <CheckCircle2 className="h-4 w-4"/> TRANSFER TO PAYMENT
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Transfer to Payment Module and go to empty form?")) {
                        handleTransferEmpty();
                      }
                    }}
                    disabled={savingOrder}
                    className="h-10 text-[11px] font-black tracking-wider uppercase px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <CheckCircle2 className="h-4 w-4"/> TRANSFER TO PAYMENT (EMPTY FORM)
                  </Button>
                </div>
              )}
            </>,
            document.getElementById("erp-page-actions-slot")
          )}

          {activeTab !== "report" && (
            activeTab === "reports_tab" ? (
              <div className="w-full space-y-4 mt-4 animate-in fade-in duration-300">
                {/* Global Info Cards at the top */}
                {renderGlobalInfoCards()}


                <div className="mx-auto w-full max-w-[1180px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:max-w-none print:border-slate-300 print:p-0 print:shadow-none">
                  <div className="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-400">Professional Printable Report</p>
                      <h2 className="text-xl font-black uppercase tracking-[0.08em] text-slate-950">Purchase Booking Complete Report</h2>
                      <p className="text-[10px] font-semibold text-slate-500">Booking, accounts, goods, payment, loading, user details, and remarks in one A4-ready report.</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right text-[9px] font-bold text-slate-600">
                      <div>PO: <span className="font-black text-slate-950">{form.purchaseOrderNo || "-"}</span></div>
                      <div>Generated: <span className="font-black text-slate-950">{new Date().toLocaleString()}</span></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-slate-950 text-white px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.24em] text-slate-300 font-black">Purchase Booking Header</p>
                        <h3 className="text-base font-black tracking-wide">{form.purchaseOrderNo || "Purchase Booking"}</h3>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${isTransferred ? "bg-emerald-500/20 text-emerald-100" : "bg-amber-400/20 text-amber-100"}`}>
                        {isTransferred ? "Transferred" : "Pending Transfer"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 text-[10px]">
                      {[
                        ["Purchase Order No.", form.purchaseOrderNo || "-"],
                        ["System Bill No.", form.billNo || "-"],
                        ["Manual Bill No.", form.manualBillNo || form.purchaseContractNo || "-"],
                        ["Booking Date", form.purchaseDate || "-"],
                        ["Contract No.", form.purchaseContractNo || "-"],
                        ["Country", form.branchCountry || form.originCountry || "-"],
                        ["Branch", form.branchName || "-"],
                        ["Currency", form.purchaseCurrency || form.secondaryCurrency || form.currencyType || "-"],
                      ].map(([label, value]) => (
                        <div key={label} className="border-b border-r border-slate-100 px-3 py-2 last:border-r-0">
                          <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                          <span className="font-bold text-slate-900 break-words">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-600" />
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-amber-900">Pending Transfer</h3>
                    </div>
                    <p className="text-[10px] leading-5 font-semibold text-amber-800">
                      This Purchase Booking is saved as booking data only. No Roznamcha, Journal, Ledger, Cash Entry, Advance Payment, Debit, or Credit posting is created at this stage. Accounting starts only after Transfer to Payment and final payment save.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[
                    ["Purchase Account Report", ArrowDownLeft, "DR", [
                      ["Account Code", form.purchaseAccountNo || "-"],
                      ["Manual Account No", form.purchaseAccountManualReferenceNumber || "-"],
                      ["Account Name", form.purchaseAccountName || "-"],
                      ["Company", form.purchaseCompanyName || "-"],
                      ["Contact Person", supplierDetail?.contact_person || supplierDetail?.customer_name || "-"],
                      ["Mobile Number", form.purchaseAccountMobile || supplierDetail?.mobile || "-"],
                      ["Phone Number", supplierDetail?.phone || form.purchaseAccountWhatsapp || "-"],
                      ["Email", supplierDetail?.email || "-"],
                      ["Address", supplierDetail?.address || "-"],
                      ["Tax / NTN / GST", supplierDetail?.tax_number || supplierDetail?.ntn || supplierDetail?.gst_number || "-"],
                    ]],
                    ["Sales Account Report", ArrowUpRight, "CR", [
                      ["Account Code", form.salesAccountNo || "-"],
                      ["Manual Account No", form.salesAccountManualReferenceNumber || "-"],
                      ["Account Name", form.salesAccountName || "-"],
                      ["Company", form.salesCompanyName || "-"],
                      ["Contact Person", customerDetail?.contact_person || customerDetail?.customer_name || "-"],
                      ["Mobile Number", form.salesAccountMobile || customerDetail?.mobile || "-"],
                      ["Phone Number", customerDetail?.phone || form.salesAccountWhatsapp || "-"],
                      ["Email", customerDetail?.email || "-"],
                      ["Address", customerDetail?.address || "-"],
                      ["Tax / NTN / GST", customerDetail?.tax_number || customerDetail?.ntn || customerDetail?.gst_number || "-"],
                    ]]
                  ].map(([title, Icon, badge, rows]) => (
                    <div key={title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between bg-slate-950 px-3 py-2 text-white">
                        <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider"><Icon className="h-3.5 w-3.5" /> {title}</h3>
                        <span className="rounded bg-white/10 px-2 py-0.5 text-[8px] font-black">{badge}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 text-[9px]">
                        {rows.map(([label, value]) => (
                          <div key={label} className="border-b border-r border-slate-100 px-3 py-2 last:border-r-0">
                            <span className="block text-[7.5px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                            <span className="font-bold text-slate-900 break-words">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-2 flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-blue-600" /> User & Branch Information
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 text-[9px]">
                    {[
                      ["User ID", activeSession?.userId || activeSession?.id || "-"],
                      ["User Name", activeSession?.name || activeSession?.fullName || form.userName || "Admin"],
                      ["Team", activeSession?.team || "Accounts Team"],
                      ["Role", (activeSession?.roles?.[0] || activeSession?.scopes?.roles?.[0] || "User").replace(/_/g, " ")],
                      ["Branch", form.branchName || "-"],
                      ["Country", form.branchCountry || "-"],
                      ["Date & Time", `${form.purchaseDate || "-"} ${new Date().toLocaleTimeString()}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                        <span className="block text-[7.5px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                        <span className="font-bold text-slate-900 break-words">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>                {/* Reports below the cards */}
                <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="space-y-4 w-full">
                  {/* Goods Table Read-Only View */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-2 flex items-center gap-2">
                      <ListChecks className="h-3.5 w-3.5 text-blue-600" /> Goods Overview
                    </h3>
                    <div className="overflow-x-auto custom-scrollbar pb-2">
                      <table className="w-full min-w-[1100px] text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                            <th className="px-2 py-1.5 text-left font-bold">Goods Name</th>
                            <th className="px-2 py-1.5 text-center font-bold">HS Code</th>
                            <th className="px-2 py-1.5 text-center font-bold">Brand</th>
                            <th className="px-2 py-1.5 text-center font-bold">Size</th>
                            <th className="px-2 py-1.5 text-center font-bold">Origin Country</th>
                            <th className="px-2 py-1.5 text-right font-bold">Quantity</th>
                            <th className="px-2 py-1.5 text-center font-bold">Unit</th>
                            <th className="px-2 py-1.5 text-right font-bold">Gross Wt</th>
                            <th className="px-2 py-1.5 text-right font-bold">Net Wt</th>
                            <th className="px-2 py-1.5 text-right font-bold">Price</th>
                            <th className="px-2 py-1.5 text-right font-bold">Ex. Rate</th>
                            <th className="px-2 py-1.5 text-right font-bold">Amount</th>
                            <th className="px-2 py-1.5 text-right font-bold">Final ({form.secondaryCurrency || "PKR"})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {goodsEntries.length === 0 ? (
                            <tr><td colSpan={13} className="px-2 py-4 text-center text-slate-400 italic">No goods added yet.</td></tr>
                          ) : (
                            goodsEntries.map((g, i) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-2 py-1.5 font-bold text-slate-800">{g.goodsName || "-"}</td>
                                <td className="px-2 py-1.5 text-center text-slate-600">{g.hsCode || "-"}</td>
                                <td className="px-2 py-1.5 text-center text-slate-600">{g.brand || "-"}</td>
                                <td className="px-2 py-1.5 text-center text-slate-600">{g.size || g.sizeSpec || "-"}</td>
                                <td className="px-2 py-1.5 text-center text-slate-600">{g.origin || form.origin || "-"}</td>
                                <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-700">{Number(g.qtyNo || 0).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-center text-slate-600">{g.qtyName || g.unit || "-"}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-slate-700">{Number(g.grossWeight || (Number(g.qtyNo || 0) * Number(g.qtyKgs || 0)) || 0).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-slate-700">{Number(g.netWeight || (Number(g.qtyNo || 0) * (Number(g.qtyKgs || 0) - Number(g.emptyKgs || 0))) || 0).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-slate-700">{Number(g.coursePrice || g.price || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-slate-700">{Number(g.exchangeRate || form.exchangeRate || 1).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-slate-700">{Number(g.totalAmount || g.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-700">{Number(g.finalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[9px]">
                    {[["Total Quantity", goodsEntries.reduce((sum, g) => sum + Number(g.qtyNo || 0), 0).toLocaleString()], ["Total Gross Weight", goodsEntries.reduce((sum, g) => sum + Number(g.grossWeight || (Number(g.qtyNo || 0) * Number(g.qtyKgs || 0)) || 0), 0).toLocaleString()], ["Total Net Weight", goodsEntries.reduce((sum, g) => sum + Number(g.netWeight || (Number(g.qtyNo || 0) * (Number(g.qtyKgs || 0) - Number(g.emptyKgs || 0))) || 0), 0).toLocaleString()], ["Origin Country", form.origin || goodsEntries[0]?.origin || "-"], ["Items", goodsEntries.length.toLocaleString()]].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                        <span className="block text-[7.5px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                        <span className="font-black text-slate-900">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Payment Details & Report */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-2 flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-blue-600" /> Report 1: Payment Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[9px] space-y-2">
                        <div className="flex justify-between"><span className="text-slate-500">Payment Type:</span> <span className="font-bold text-slate-800">{form.paymentType || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Payment Terms:</span> <span className="font-bold text-slate-800 text-right">{form.paymentCondition || form.paymentTerms || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Currency:</span> <span className="font-bold text-slate-800">{form.purchaseCurrency || form.currencyType || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Exchange Rate:</span> <span className="font-bold text-slate-800">{goodsEntries[0]?.exchangeRate || form.exchangeRate || 1}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Bank:</span> <span className="font-bold text-slate-800 text-right">{form.bankName || form.paymentBank || form.cashBankName || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Payment Method:</span> <span className="font-bold text-slate-800 text-right">{form.paymentDaysAndMethodDetails || form.paymentMethod || form.paymentType || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Payment Status:</span> <span className="font-bold text-amber-700">{isTransferred ? "Transferred" : "Pending Transfer"}</span></div>

                        <div className="flex justify-between border-t border-slate-200 pt-1">
                          <span className="text-slate-500">Advance ({form.advancePercent || 0}%):<br/><span className="text-[7px]">Due: {form.advancePaymentDate}</span></span>
                          <span className="font-bold text-slate-800 text-right">
                            <span className="block text-emerald-700">{form.currencyType || "USD"} {((reportTotals.grandPrimaryFinal || reportTotals.grandFinal || 0) * (form.advancePercent || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="block text-blue-600 mt-0.5">{form.purchaseCurrency || "AED"} {((reportTotals.grandFinal || 0) * (form.advancePercent || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[7px] text-slate-400 font-mono">(@ {goodsEntries[0]?.exchangeRate || form.exchangeRate || 1})</span></span>
                          </span>
                        </div>

                        <div className="flex justify-between border-t border-slate-200 pt-1">
                          <span className="text-slate-500">Remaining ({100 - (form.advancePercent || 0)}%):<br/><span className="text-[7px]">Due: {form.paymentDate}</span></span>
                          <span className="font-bold text-slate-800 text-right">
                            <span className="block text-emerald-700">{form.currencyType || "USD"} {((reportTotals.grandPrimaryFinal || reportTotals.grandFinal || 0) * (100 - (form.advancePercent || 0)) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="block text-blue-600 mt-0.5">{form.purchaseCurrency || "AED"} {((reportTotals.grandFinal || 0) * (100 - (form.advancePercent || 0)) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[7px] text-slate-400 font-mono">(@ {goodsEntries[0]?.exchangeRate || form.exchangeRate || 1})</span></span>
                          </span>
                        </div>

                        <div className="flex justify-between border-t border-slate-200 pt-1">
                          <span className="text-slate-500">Grand Total:</span>
                          <span className="font-bold text-right">
                            <span className="block text-emerald-700">{form.currencyType || "USD"} {(reportTotals.grandPrimaryFinal || reportTotals.grandFinal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="block text-blue-600 mt-0.5">{form.purchaseCurrency || "AED"} {(reportTotals.grandFinal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-700 mb-1">Payment Report / Notes</label>
                        <textarea
                          rows={3}
                          value={form.paymentReport || ""}
                          onChange={(e) => setValue("paymentReport", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-900 outline-none focus:border-blue-500 resize-none text-[9px]"
                          placeholder="Write notes regarding payment terms, conditions, or guarantees..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Loading Details & Report */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-2 flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-blue-600" /> Report 2: Loading & Transit Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[9px] space-y-1">
                        <div className="flex justify-between"><span className="text-slate-500">Shipping Mode:</span> <span className="font-bold text-slate-800">{form.shippingMode || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Shipping Line:</span> <span className="font-bold text-slate-800 text-right">{form.shippingLine || form.shippingCompany || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Loading From:</span> <span className="font-bold text-slate-800">{form.loadingPort || form.loadingBorder || form.airportName || "N/A"} ({form.origin || "N/A"})</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Destination:</span> <span className="font-bold text-slate-800">{form.receivedPort || form.receivedBorder || form.receivedPortName || "N/A"} ({form.receivedCountry || "N/A"})</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Loading Date:</span> <span className="font-bold text-slate-800">{form.loadingDate || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Receiving Date:</span> <span className="font-bold text-slate-800">{form.receivingDate || form.receivedDate || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Container No:</span> <span className="font-bold text-slate-800 text-right">{form.containerNumbers || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Container Type:</span> <span className="font-bold text-slate-800">{form.containerSize || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Vessel:</span> <span className="font-bold text-slate-800 text-right">{form.vesselName || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">BL No:</span> <span className="font-bold text-slate-800 text-right">{form.blNo || form.billOfLadingNo || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">ETA / ETD:</span> <span className="font-bold text-slate-800 text-right">{form.eta || form.etd || form.receivingDate || "N/A"}</span></div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-700 mb-1">Loading Report / Notes</label>
                        <textarea
                          rows={3}
                          value={form.loadingReport || ""}
                          onChange={(e) => setValue("loadingReport", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-900 outline-none focus:border-blue-500 resize-none text-[9px]"
                          placeholder="Write notes regarding loading, transit, agents, or customs..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Booking Remarks & Narration */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm mb-4">
                    <div className="border-b border-slate-100 pb-2 mb-2">
                      <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-600" /> Booking Remarks & Narration
                      </h3>
                    </div>
                    <div>
                      <textarea
                        rows={6}
                        value={form.remarks || ""}
                        onChange={(e) => setValue("remarks", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-900 outline-none focus:border-blue-500 resize-none text-[10px]"
                        placeholder="Write general transaction remarks and narration (Visible on Dashboard)..."
                      />
                    </div>
                  </div>

                  {/* Dynamic Reports */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
                    <div className="border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
                      <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-blue-600" /> Dynamic Reports & Notes
                      </h3>
                      <Button
                        type="button"
                        onClick={() => setIsNewReportModalOpen(true)}
                        className="h-6 text-[9px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white px-2 rounded shadow-sm"
                      >
                        + Add New Report
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {reportsList.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-[10px] italic bg-muted/30 rounded border border-border/50">
                          No reports or notes added yet. Click "+ Add New Report" to create one.
                        </div>
                      ) : (
                        reportsList.map((report) => (
                          <div key={report.id} className="bg-card border border-border rounded-lg p-3 shadow-sm">
                            <div className="flex justify-between items-start mb-2 border-b border-border/40 pb-2">
                              <div>
                                <h4 className="text-[11px] font-bold text-foreground">{report.name}</h4>
                                {report.description && <p className="text-[9px] text-muted-foreground mt-0.5">{report.description}</p>}
                              </div>
                              <div className="flex gap-2 items-center">
                                <span className="text-[8px] font-mono text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</span>
                                <button type="button" onClick={() => handleDeleteReport(report.id)} className="text-red-500 hover:text-red-700 p-1" title="Delete Report"><Trash2 className="h-3 w-3"/></button>
                              </div>
                            </div>
                            <div className="text-[10px] text-foreground whitespace-pre-wrap">
                              {report.notes}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>


                  <div className="pt-3 border-t border-border flex flex-col gap-1.5 mt-4">
                    <Button
                      type="button"
                      onClick={() => setActiveTab("report")}
                      className="w-full font-bold h-7.5 text-[10px] py-1 shadow uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Next Step (Verify & Print)
                    </Button>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="outline" onClick={() => setActiveTab("others")} className="flex-1 font-bold h-7.5 text-[10px] py-1">Back</Button>
                    </div>
                  </div>
                </fieldset>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start w-full">
                <section className="lg:col-span-9 space-y-4 order-2 mt-4">
                  {/* GLOBAL INFO CARDS (Always visible at top) */}
                  {renderGlobalInfoCards()}

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

            <main className="lg:col-span-3 space-y-0 flex flex-col order-1 mt-4">

              {activeTab === "booking" && (
                <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="space-y-4 order-2 w-full mt-4">
                  <div className="border-b border-border pb-2 mb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Purchase Booking / Bill Info</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="relative" ref={purchaseDropdownRef}>
                      <label className="block text-[10px] font-bold text-foreground mb-1">Purchase Account (DR)*</label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder={form.purchaseAccountName ? formatAccountDisplayLabel(form.purchaseAccountName, form.purchaseAccountNo, form.purchaseAccountManualReferenceNumber) : "Search Code, Name, Branch, Manual A/C..."}
                          value={purchaseDropdownOpen ? purchaseSearch : (form.purchaseAccountName ? formatAccountDisplayLabel(form.purchaseAccountName, form.purchaseAccountNo, form.purchaseAccountManualReferenceNumber) : form.purchaseAccountNo || "")}
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
                          disabled={!form.supplierId}
                          onClick={() => {
                            setPurchasePinDropdownOpen(prev => !prev);
                            setPurchaseDropdownOpen(false);
                          }}
                          className="absolute right-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                        >
                          <Pin className={`h-3.5 w-3.5 ${purchasePinDropdownOpen ? "text-primary rotate-45" : ""}`} />
                        </button>
                      </div>

                      {purchaseDropdownOpen && (
                        <div className="absolute left-0 mt-1.5 w-full min-w-[290px] sm:min-w-[440px] md:min-w-[520px] rounded-2xl bg-card border-2 border-primary/40 shadow-2xl z-[80] p-2 overflow-hidden backdrop-blur-md">
                          <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/5 rounded-lg mb-1.5 border border-primary/10">
                            <span className="text-[10px] font-black uppercase text-primary tracking-wider">Select Purchase Account (DR)</span>
                            <span className="text-[9px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, purchaseSearch)).length} found
                            </span>
                          </div>
                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, purchaseSearch)).map((acc) => {
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
                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, purchaseSearch)).length === 0 && (
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
                          value={form.purchaseContractNo}
                          onChange={(e) => setValue("purchaseContractNo", e.target.value)}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px] h-8 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1">Contract / Booking Date</label>
                        <input
                          type="date"
                          value={form.purchaseDate}
                          onChange={(e) => setValue("purchaseDate", e.target.value)}
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
                  <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
                    <Button type="button" onClick={() => setActiveTab("goods")} className="font-bold text-[10px] h-8 px-10 bg-primary text-primary-foreground">Next</Button>
                  </div>
                </fieldset>
              )}

              {activeTab === "goods" && (
                <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="space-y-4 order-2 w-full mt-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="border-b border-border pb-2 mb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                      GOODS ENTRY
                    </h3>
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
                        <label className="block text-[10px] text-muted-foreground mb-1">Allot Name / ID</label>
                        <input
                          type="text"
                          value={form.allotName || ""}
                          onChange={(e) => setValue("allotName", e.target.value)}
                          className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                        />
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

                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1">Quality Report Reference</label>
                      <input
                        type="text"
                        value={form.qualityReport || ""}
                        onChange={(e) => setValue("qualityReport", e.target.value)}
                        className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary text-[10px]"
                        placeholder="Passed"
                      />
                    </div>

                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900 mt-2">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-2">Purchase Currency & Conversion</h4>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <label className="block text-[9px] text-emerald-700 dark:text-emerald-500 mb-1 font-bold">Pricing Currency</label>
                          <select
                            value={form.currencyType || "USD"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm(prev => ({ ...prev, currencyType: val, purchaseCurrency: val }));
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

                  <div className="flex justify-between gap-2 pt-4 border-t border-border mt-4">
                    <Button type="button" variant="outline" onClick={() => setActiveTab("booking")} className="font-bold text-[10px] h-8 px-6 text-slate-600">Back</Button>
                    <div className="flex gap-2">
                      <Button type="button" onClick={handleAddGoodsEntry} className="font-bold text-[10px] h-8 px-6 bg-emerald-600 hover:bg-emerald-700 text-white">+ Add Item to List</Button>
                      <Button type="button" onClick={() => setActiveTab("others")} className="font-bold text-[10px] h-8 px-6 bg-primary text-primary-foreground">Next: Other Details</Button>
                    </div>
                  </div>
                </fieldset>
              )}

              {activeTab === "others" && (
                <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="space-y-4 order-2 w-full mt-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="border-b border-border pb-2 mb-3">
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

                  <div className="flex justify-between gap-2 pt-2 border-t border-border mt-2">
                    <Button type="button" variant="outline" onClick={() => setActiveTab("goods")} className="font-bold text-[10px] h-8 px-6 text-slate-600">Back</Button>
                    <Button type="button" onClick={() => setActiveTab("reports_tab")} className="font-bold text-[10px] h-8 px-6 bg-primary text-primary-foreground">Next</Button>
                  </div>
                </fieldset>
              )}
              {activeTab === "reports_tab" && (
                <div className="space-y-4 order-2 w-full mt-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center space-y-3">
                    <h3 className="text-[11px] font-black uppercase text-slate-800">
                      Step 4: Review Reports
                    </h3>
                    <p className="text-[9px] text-slate-500 font-semibold">
                      Review all generated reports and notes before final verification.
                    </p>
                    <div className="flex justify-between gap-2 pt-2 border-t border-slate-200 mt-2">
                      <Button type="button" variant="outline" onClick={() => setActiveTab("others")} className="font-bold text-[10px] h-8 px-6 text-slate-600">Back</Button>
                      <Button type="button" onClick={() => setActiveTab("report")} className="font-bold text-[10px] h-8 px-6 bg-primary text-primary-foreground">Next</Button>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        )
      )}

      {activeTab === "report" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">

                  {/* Transfer / Journal Status Block */}
                  {isTransferred ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 mb-2 border-b border-emerald-100 pb-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Transfer Completed</h4>
                        </div>
                        <p className="text-[9px] text-emerald-700 font-semibold mb-3 leading-relaxed">
                          This bill has been automatically transferred and posted to the business journal (Roznamcha). All associated ledger accounts have been updated.
                        </p>

                        <div className="space-y-1.5 text-[9px] font-mono bg-white/60 p-2 rounded border border-emerald-100/50">
                          <div className="flex justify-between"><span className="text-emerald-700/80 uppercase font-sans font-bold text-[8px]">General Serial No:</span> <span className="font-bold text-emerald-900">{form.generalSerialNumber || `GSN-${new Date().getFullYear()}-0001`}</span></div>
                          <div className="flex justify-between"><span className="text-emerald-700/80 uppercase font-sans font-bold text-[8px]">Roznamcha (Journal) No:</span> <span className="font-bold text-emerald-900">{form.journalNumber || `JRN-${new Date().getFullYear()}-8821`}</span></div>
                          <div className="flex justify-between"><span className="text-emerald-700/80 uppercase font-sans font-bold text-[8px]">Branch Roznamcha No:</span> <span className="font-bold text-emerald-900">{form.branchJournalNumber || `BR-JRN-402`}</span></div>
                          <div className="flex justify-between"><span className="text-emerald-700/80 uppercase font-sans font-bold text-[8px]">Cash Entry Serial:</span> <span className="font-bold text-emerald-900">{form.cashEntrySerial || `CE-9921`}</span></div>
                          <div className="flex justify-between border-t border-emerald-100/50 pt-1 mt-1"><span className="text-emerald-700/80 uppercase font-sans font-bold text-[8px]">Business Entry Ref:</span> <span className="font-bold text-emerald-900 uppercase">{form.businessEntryRef || `BUS-ENT-PURCHASE`}</span></div>
                        </div>
                      </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-amber-600" />
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-800">Pending Transfer</h4>
                      </div>
                      <p className="text-[9px] text-amber-700 font-semibold mt-1">
                        This booking is pending verification. Once transferred, the journal (Roznamcha) and serial details will automatically appear here.
                      </p>
                    </div>
                  )}

                  {/* Inline Bill View */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-4 shadow-sm overflow-x-auto">
                    <div className="mx-auto w-full max-w-5xl bg-white border border-slate-200 p-5 md:p-6 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
                          <div className="mb-6 overflow-hidden rounded-xl border border-slate-200">
                            <div className="flex flex-col gap-4 bg-slate-950 px-5 py-4 text-white md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Damaan Business Group</p>
                                <h1 className="mt-1 text-xl font-black uppercase tracking-[0.22em]">Purchase Booking Order</h1>
                                <p className="mt-1 text-[10px] font-semibold text-slate-300">Professional verification, account routing, goods, payment and audit template</p>
                              </div>
                              <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right text-[10px] font-bold md:min-w-[360px]">
                                <span className="text-slate-400">PO No</span><span>{form.purchaseOrderNo || "N/A"}</span>
                                <span className="text-slate-400">Bill No</span><span>{form.billNo || "N/A"}</span>
                                <span className="text-slate-400">Date</span><span>{form.purchaseDate || "N/A"}</span>
                                <span className="text-slate-400">Status</span><span className={isTransferred ? "text-emerald-300" : "text-amber-300"}>{isTransferred ? "Transferred" : "Pending Transfer"}</span>
                              </div>
                            </div>
                            <div className="grid gap-0 border-t border-slate-200 bg-white text-[10px] font-semibold text-slate-700 md:grid-cols-4">
                              <div className="border-b border-slate-200 p-3 md:border-b-0 md:border-r"><span className="block text-[8px] uppercase tracking-wider text-slate-400">Country</span>{form.branchCountry || form.origin || "N/A"}</div>
                              <div className="border-b border-slate-200 p-3 md:border-b-0 md:border-r"><span className="block text-[8px] uppercase tracking-wider text-slate-400">Branch</span>{form.branchName || "N/A"}</div>
                              <div className="border-b border-slate-200 p-3 md:border-b-0 md:border-r"><span className="block text-[8px] uppercase tracking-wider text-slate-400">Branch Code</span>{form.branchCode || "N/A"}</div>
                              <div className="p-3"><span className="block text-[8px] uppercase tracking-wider text-slate-400">Currency</span>{form.purchaseCurrency || form.currencyType || "N/A"}</div>
                            </div>
                          </div>
                          
                          <div className="grid gap-4 mb-6 text-[10px] md:grid-cols-2">
                            <div className="border border-slate-300 p-3 rounded">
                              <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800 text-[10px]">Purchase Account (DR)</h3>
                              <div className="grid grid-cols-[80px_1fr] gap-1">
                                <span className="text-slate-500 font-semibold">Account Code:</span><span className="font-bold">{form.purchaseAccountNo || "N/A"}</span>
                                <span className="text-slate-500 font-semibold">Account Name:</span><span className="font-bold">{form.purchaseAccountName || "N/A"}</span>
                                <span className="text-slate-500 font-semibold">Company:</span><span className="font-bold">{form.purchaseCompanyName || "N/A"}</span>
                              </div>
                            </div>
                            <div className="border border-slate-300 p-3 rounded">
                              <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800 text-[10px]">Sales Account (CR)</h3>
                              <div className="grid grid-cols-[80px_1fr] gap-1">
                                <span className="text-slate-500 font-semibold">Account Code:</span><span className="font-bold">{form.salesAccountNo || "N/A"}</span>
                                <span className="text-slate-500 font-semibold">Account Name:</span><span className="font-bold">{form.salesAccountName || "N/A"}</span>
                                <span className="text-slate-500 font-semibold">Company:</span><span className="font-bold">{form.salesCompanyName || "N/A"}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mb-6">
                            <h3 className="font-black text-[10px] border-b border-slate-800 pb-1 mb-2 uppercase text-slate-800 flex items-center gap-2">
                              <Package className="h-3.5 w-3.5" /> Goods Details
                            </h3>
                            <table className="w-full text-[10px] text-left border border-slate-300">
                              <thead className="bg-slate-100 border-b border-slate-300">
                                <tr>
                                  <th className="p-1.5 font-bold uppercase border-r border-slate-300">Goods</th>
                                  <th className="p-1.5 font-bold uppercase border-r border-slate-300">Brand</th>
                                  <th className="p-1.5 font-bold uppercase border-r border-slate-300">Origin</th>
                                  <th className="p-1.5 text-right font-bold uppercase border-r border-slate-300">Qty</th>
                                  <th className="p-1.5 text-right font-bold uppercase border-r border-slate-300">G.Wt</th>
                                  <th className="p-1.5 text-right font-bold uppercase border-r border-slate-300">N.Wt</th>
                                  <th className="p-1.5 text-right font-bold uppercase border-r border-slate-300">Rate</th>
                                  <th className="p-1.5 text-right font-bold uppercase border-r border-slate-300">Amount ({form.currencyType || "USD"})</th>
                                  <th className="p-1.5 text-right font-bold uppercase text-emerald-800">Final ({form.secondaryCurrency || "PKR"})</th>
                                </tr>
                              </thead>
                              <tbody>
                                {goodsEntries.map((row, idx) => (
                                  <tr key={idx} className="border-b border-slate-200">
                                    <td className="p-1.5 font-bold border-r border-slate-300">{row.goodsName}</td>
                                    <td className="p-1.5 border-r border-slate-300">{row.brand}</td>
                                    <td className="p-1.5 border-r border-slate-300">{row.origin}</td>
                                    <td className="p-1.5 text-right border-r border-slate-300 font-mono font-bold">{row.qtyNo.toLocaleString()} {row.qtyName}</td>
                                    <td className="p-1.5 text-right border-r border-slate-300 font-mono">{row.grossWeight.toFixed(2)}</td>
                                    <td className="p-1.5 text-right border-r border-slate-300 font-mono font-bold">{row.netWeight.toFixed(2)}</td>
                                    <td className="p-1.5 text-right border-r border-slate-300 font-mono">{row.coursePrice.toFixed(2)}</td>
                                    <td className="p-1.5 text-right border-r border-slate-300 font-mono font-bold text-slate-700">{row.totalAmount.toLocaleString()}</td>
                                    <td className="p-1.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50">
                                      {row.finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                                {goodsEntries.length > 0 && (
                                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-400">
                                    <td colSpan={3} className="p-1.5 text-right border-r border-slate-300">TOTALS:</td>
                                    <td className="p-1.5 text-right border-r border-slate-300">{reportTotals.totalQty.toLocaleString()} {goodsEntries[0]?.qtyName || ""}</td>
                                    <td className="p-1.5 text-right border-r border-slate-300">{reportTotals.totalGross.toFixed(2)}</td>
                                    <td className="p-1.5 text-right border-r border-slate-300">{reportTotals.totalNet.toFixed(2)}</td>
                                    <td className="p-1.5 text-right border-r border-slate-300 bg-slate-200">-</td>
                                    <td className="p-1.5 text-right border-r border-slate-300 text-slate-800">{reportTotals.grandPrimaryFinal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="p-1.5 text-right text-emerald-800 bg-emerald-100">{reportTotals.grandFinal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Account Verification & Transfer Info */}
                  <div className="mx-auto w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Ledger Routing Details</h4>
                    <div className="space-y-3 text-[9px]">
                      <div className="bg-slate-50 border border-slate-200 rounded p-3">
                        <div className="flex justify-between items-center mb-1"><span className="font-bold text-rose-700 uppercase text-[8px] bg-rose-100 px-1.5 py-0.5 rounded">Purchase Account (DR)</span> <span className="text-slate-600 font-mono text-[8px]">{form.purchaseAccountNo || "N/A"}</span></div>
                        <div className="font-bold text-slate-900 mb-1 truncate text-[10px]" title={form.purchaseAccountName}>{form.purchaseAccountName || "N/A"}</div>
                        <div className="flex justify-between items-center text-[8px] text-slate-500 mb-0.5">
                          <span>Branch: <strong className="text-slate-700">{form.purchaseAccountBranch || "-"}</strong></span>
                          <span>Country: <strong className="text-slate-700">{form.origin || "-"}</strong></span>
                        </div>
                        <div className="flex justify-between items-center text-[8px] text-slate-500 mb-3">
                          <span>Currency: <strong className="text-slate-700">{form.purchaseCurrency || form.purchaseAccountCurrency || "-"}</strong></span>
                          <span>Contact: <strong className="text-slate-700">{form.purchaseAccountMobile || form.purchaseAccountWhatsapp || "-"}</strong></span>
                        </div>

                        <div className="flex justify-between items-center mb-1 border-t border-slate-200 pt-3"><span className="font-bold text-emerald-700 uppercase text-[8px] bg-emerald-100 px-1.5 py-0.5 rounded">Sales Account (CR)</span> <span className="text-slate-600 font-mono text-[8px]">{form.salesAccountNo || "N/A"}</span></div>
                        <div className="font-bold text-slate-900 mb-1 truncate text-[10px]" title={form.salesAccountName}>{form.salesAccountName || "N/A"}</div>
                        <div className="flex justify-between items-center text-[8px] text-slate-500 mb-0.5">
                          <span>Branch: <strong className="text-slate-700">{form.salesAccountBranch || "-"}</strong></span>
                          <span>Country: <strong className="text-slate-700">{form.branchCountry || "-"}</strong></span>
                        </div>
                        <div className="flex justify-between items-center text-[8px] text-slate-500 mb-2">
                          <span>Currency: <strong className="text-slate-700">{form.salesAccountCurrency || "-"}</strong></span>
                          <span>Contact: <strong className="text-slate-700">{form.salesAccountMobile || form.salesAccountWhatsapp || "-"}</strong></span>
                        </div>

                        <div className="border-t border-slate-200 pt-3 mt-3 space-y-1.5">
                          <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-[8px]">Transfer Date:</span> <span className="font-bold text-slate-900 font-mono">{form.purchaseDate}</span></div>
                          <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-[8px]">Transferred To:</span> <span className="font-black text-blue-600 uppercase">Purchase Accounts</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* User Info */}
                  <div className="mx-auto w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">User & Session Information</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2 text-[9px]">
                      <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase text-[8px]">User ID:</span> <span className="font-semibold text-slate-900 font-mono">{form.userId || "USR-1001"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase text-[8px]">User Name:</span> <span className="font-bold text-slate-900 uppercase">{form.userName || "ADMIN"}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-0.5"><span className="text-slate-500 font-bold uppercase text-[8px]">Team Name:</span> <span className="font-semibold text-slate-900">Logistics & Operations</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase text-[8px]">Team Code:</span> <span className="font-semibold text-slate-900 font-mono">TR-LOG</span></div>
                    </div>
                  </div>

                  {/* Remarks Input */}
                  <div className="mx-auto w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2 block border-b border-slate-100 pb-1">Remarks (Report)</span>
                    <textarea
                      value={form.orderReportRemarks}
                      onChange={(e) => handleTextChange("orderReportRemarks", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 outline-none focus:border-blue-500 resize-none h-20 text-[9px] font-semibold"
                      placeholder="Type verification or audit remarks here..."
                    />
                  </div>

                  {/* Saved Reports */}
                  {reportsList.length > 0 && (
                    <div>
                      <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Saved Reports</h4>
                      <div className="space-y-2 mb-4">
                        {reportsList.map((report) => (
                          <div key={report.id} className="bg-slate-50 border border-slate-200 rounded p-2 text-[9px]">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-slate-800">{report.name}</span>
                              <button type="button" onClick={() => handleDeleteReport(report.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            {report.description && <p className="text-slate-600 mb-1 font-semibold">{report.description}</p>}
                            <p className="text-slate-500 font-mono text-[8px]">{formatShortDate(report.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

                {/* Header */}
                <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                  <h1 className="text-2xl font-black uppercase text-slate-900 tracking-widest">Purchase Booking Order</h1>
                  <div className="flex justify-between items-end mt-4 text-xs font-bold text-slate-700">
                    <div className="text-left">
                      <p>Booking Date: {form.purchaseDate}</p>
                      <p>Branch: {form.branchName} ({form.branchCode})</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">PO No: {form.purchaseOrderNo}</p>
                      <p>Contract No: {form.purchaseContractNo || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Account Info */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-[10px]">
                  <div className="border border-slate-300 p-3 rounded">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">Purchase Account (DR)</h3>
                    <div className="grid grid-cols-[80px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">Account Code:</span><span className="font-bold">{form.purchaseAccountNo || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Account Name:</span><span className="font-bold">{form.purchaseAccountName || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Company:</span><span className="font-bold">{form.purchaseCompanyName || "N/A"}</span>
                    </div>
                  </div>
                  <div className="border border-slate-300 p-3 rounded">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">Sales Account (CR)</h3>
                    <div className="grid grid-cols-[80px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">Account Code:</span><span className="font-bold">{form.salesAccountNo || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Account Name:</span><span className="font-bold">{form.salesAccountName || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">Company:</span><span className="font-bold">{form.salesCompanyName || "N/A"}</span>
                    </div>
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
                  You are about to transfer this Purchase Booking to the <strong>Purchase Transfer Payment</strong> module.
                  <br/><br/>
                  <em>Note: No accounting entries (Roznamcha, Ledger) will be posted at this stage. Entries will only be posted when the payment is officially processed.</em>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded p-2.5 bg-white shadow-sm flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Invoice No</span>
                  <div className="font-black font-mono text-slate-900">{form.purchaseOrderNo}</div>
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
    </div>
  );
}
