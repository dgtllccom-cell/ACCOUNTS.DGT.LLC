"use client";
import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
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
  FileSpreadsheet,
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
  Users,
  ShieldCheck,
  ArrowRight,
  ArrowRightLeft,
  SlidersHorizontal,
  ShoppingCart,
  Calendar,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { TradeDocumentCenter } from "@/features/reports/components/trade-document-center";
import { openPurchaseA4ReportWindow } from "@/lib/reports/open-purchase-a4-report-window";
import { PurchaseBookingJournalReportView } from "./purchase-booking-journal-report-view";
import { PurchaseBookingReportGrid } from "./purchase-booking-report-grid";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { Th } from "@/components/ui/translated-th";
import { buildPurchaseBookingTransferUrl } from "@/lib/services/purchase-booking-transfer-routing";
import { translateHeader } from "@/lib/i18n/table-headers";
import { translationPendingLabel } from "@/lib/i18n/purchase-order-translations";
import { readDraftPrefill, clearDraftPrefill } from "@/features/document-intelligence/components/entry-method-selector";

// --- Non-location constants (static values, not from master forms) ---
const CURRENCY_OPTIONS = ["USD", "AED", "EUR", "GBP", "PKR", "AFN", "INR", "CNY", "SAR"];
const PAYMENT_TYPES = ["Advance Payment", "Invoice", "Final Payment", "Credit"];
const LOADING_TYPES = ["By Sea", "By Road", "By Air"];
const CONTAINER_TYPES = ["20 FT", "40 FT", "20 FT Reefer", "40 FT Reefer", "Reefer Container", "Non Reefer", "Open Top", "Flat Rack", "LCL / Bulk"];

// Canonical English value -> translation key, for PAYMENT_TYPES/LOADING_TYPES/CONTAINER_TYPES
// <option> labels. The stored/submitted `value` stays the canonical English string (form.paymentType
// etc. are compared against these constants elsewhere); only the visible label is translated.
const OPTION_LABEL_KEYS = {
  "Advance Payment": "purchase.opt_advance_payment",
  "Invoice": "purchase.opt_invoice",
  "Final Payment": "purchase.opt_final_payment",
  "Credit": "purchase.opt_credit",
  "By Sea": "purchase.opt_by_sea",
  "By Road": "purchase.opt_by_road",
  "By Air": "purchase.opt_by_air",
  "20 FT": "purchase.opt_container_20ft",
  "40 FT": "purchase.opt_container_40ft",
  "20 FT Reefer": "purchase.opt_container_20ft_reefer",
  "40 FT Reefer": "purchase.opt_container_40ft_reefer",
  "Reefer Container": "purchase.opt_container_reefer",
  "Non Reefer": "purchase.opt_container_non_reefer",
  "Open Top": "purchase.opt_container_open_top",
  "Flat Rack": "purchase.opt_container_flat_rack",
  "LCL / Bulk": "purchase.opt_container_lcl_bulk"
};
function translateOptionLabel(lang, value) {
  const key = OPTION_LABEL_KEYS[value];
  return key ? t(lang, key, value) : value;
}
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
// NOTE: COUNTRY_OPTIONS and ORIGIN_OPTIONS removed — countries now come from Location Master.

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
    throw new Error(payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_account_lookup", "Account lookup failed."));
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
    throw new Error(payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_booking_lookup", "Purchase booking lookup failed."));
  }
  return payload.data?.reports?.[0] ?? null;
}

const DEFAULT_FORM = {
  countryId: "",
  countryBranchId: "",
  cityBranchId: "",
  // Country-to-Country Purchase: optional destination scope. Leave blank for a plain
  // same-country purchase.
  destCountryId: "",
  destCountryBranchId: "",
  destCityBranchId: "",
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
  if (c.includes("PKR")) return "₨";
  if (c.includes("AFN")) return "؋";
  if (c.includes("INR")) return "₹";
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
              <Th
                key={idx}
                className="whitespace-nowrap border-r border-slate-200 px-3 py-3 text-left font-black last:border-r-0"
              >
                {header}
              </Th>
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

/**
 * Reads a business-data value (company/account/remarks text the user typed) back in the
 * active display language, using the 5-language record already computed and stored by the
 * server (`saveEnterpriseRecordTranslations`, saved under `form_data.translations` — see
 * app/api/erp/purchases/orders/route.ts and [id]/route.ts). This is the DATA counterpart to
 * `t()`: `t()` translates static UI labels, this resolves user-entered business values.
 * Falls back to the raw stored value when no translation record exists yet (e.g. drafts not
 * yet saved, or English display) — never blank.
 */
function localizeBiz(form, lang, field, fallback) {
  const toSnakeCase = (value) =>
    String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[.\s]+/g, "_")
      .toLowerCase();
  const map = form?.translations?.[field] || form?.translations?.[toSnakeCase(field)];
  if (map && lang && lang !== "en") {
    return map[lang] || translationPendingLabel(lang);
  }
  return fallback;
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
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const trUi = useCallback((label) => {
    if (lang === "en") return label;
    // translateHeader() already returns the original label unchanged when no dictionary
    // entry exists for it — that IS the correct fallback, not a signal to replace it with a
    // "Translation pending" placeholder.
    return translateHeader(lang, label);
  }, [lang]);
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
  const [editingGoodsIndex, setEditingGoodsIndex] = useState(null);
  const [bookingSearchInput, setBookingSearchInput] = useState("");
  const [bookingSearchLoading, setBookingSearchLoading] = useState(false);
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
  const [draftPrefillRef, setDraftPrefillRef] = useState("");
  const [draftPrefillId, setDraftPrefillId] = useState("");
  const [tradeDocsOpen, setTradeDocsOpen] = useState(false);
  const [tradeDocsInitialType, setTradeDocsInitialType] = useState("commercial_invoice");
  const draftConsumedRef = useRef(false);

  // Pre-fill from a reviewed AI Document Intake draft (Entry Method Selector →
  // "Continue Saved Draft"). Best-effort: only keys the form already has are
  // applied; the user still reviews, completes, validates and posts. The AI
  // never created or posted anything.
  useEffect(() => {
    let prefill = null;
    try { prefill = readDraftPrefill("purchase_orders"); } catch { prefill = null; }
    if (!prefill) return;
    const payload = prefill.payload || {};
    setForm((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(payload)) {
        if (v !== null && v !== undefined && v !== "" && k in prev) next[k] = v;
      }
      return next;
    });
    if (Array.isArray(prefill.goodsEntries) && prefill.goodsEntries.length) {
      setGoodsEntries((prev) => (prev.length ? prev : prefill.goodsEntries.map((g, i) => ({
        allotName: g.allotName || `ALT-${i + 1}`,
        goodsName: g.description || "",
        brand: g.brand || "",
        hsCode: g.hsCode || "",
        qtyName: g.unit || "BAGS",
        qtyNo: g.quantity ?? 0,
        netWeight: g.netWeight ?? 0,
        grossWeight: g.grossWeight ?? 0,
        coursePrice: g.unitPrice ?? 0,
      }))));
    }
    setDraftPrefillRef(prefill.draftNo || "");
    setDraftPrefillId(prefill.draftId || "");
    clearDraftPrefill();
  }, []);

  // Record the reviewed AI draft against the saved Purchase Order (audit trail).
  // Idempotent and non-fatal — a failure here never blocks the save.
  const consumeIntakeDraft = useCallback(async (createdSourceId) => {
    if (draftConsumedRef.current || !draftPrefillId || !createdSourceId) return;
    draftConsumedRef.current = true;
    try {
      await fetch(`/api/erp/document-intelligence/drafts/${draftPrefillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "consume", createdSourceModule: "purchase_orders", createdSourceId: String(createdSourceId) }),
      });
    } catch { /* audit link is best-effort */ }
  }, [draftPrefillId]);
  const [editingRemarksType, setEditingRemarksType] = useState(null);
  const [tempRemarksText, setTempRemarksText] = useState("");
  const [reportType, setReportType] = useState("branch"); // "branch" | "totaling" | "payment"
  const [previewRemarks, setPreviewRemarks] = useState(false);
  const [branchPinOpen, setBranchPinOpen] = useState(false);

  // Dynamic Reports System
  const [reportsList, setReportsList] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);
  const [selectedReportTemplate, setSelectedReportTemplate] = useState("payment");
  const [step4ViewMode, setStep4ViewMode] = useState("overview"); // "overview" (Option 1) | "reports" (Option 2)
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
  const [allCountries, setAllCountries] = useState([]); // unscoped — for transit pickers
  const [allMainBranches, setAllMainBranches] = useState([]);
  const [dbGoods, setDbGoods] = useState([]); // goods from master DB
  const [dbLoadingPorts, setDbLoadingPorts] = useState([]);
  const [dbReceivedPorts, setDbReceivedPorts] = useState([]);
  const [mainBranches, setMainBranches] = useState([]);
  const [cityBranches, setCityBranches] = useState([]);
  // Country-to-Country Purchase: destination-scope branch lists, mirroring mainBranches/cityBranches
  // but keyed off form.destCountryId/destCountryBranchId instead of the source scope.
  const [destMainBranches, setDestMainBranches] = useState([]);
  const [destCityBranches, setDestCityBranches] = useState([]);
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const [dbAccounts, setDbAccounts] = useState([]);
  const [dbAccountsLoading, setDbAccountsLoading] = useState(true);
  const [customQtyNames, setCustomQtyNames] = useState([]);

  // Fetch all main branches on mount to determine which countries have configured branches
  useEffect(() => {
    let cancelled = false;
    fetch("/api/erp/locations/branches/main")
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.branches || res?.branches || [];
        setAllMainBranches(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const scopeCountries = useMemo(() => {
    if (!allMainBranches || allMainBranches.length === 0) return countries || [];
    const branchCountryIds = new Set(allMainBranches.map(b => b.country_id || b.countryId));
    return (countries || []).filter(c => branchCountryIds.has(c.id));
  }, [countries, allMainBranches]);

  // Load Countries
  useEffect(() => {
    let cancelled = false;
    fetch("/api/erp/locations/countries")
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = res?.countries || res?.data?.countries || [];
        setCountries(list);
        setAllCountries(list);
        if (list.length > 0 && !form.countryId && !isSuperAdmin) {
          const first = list[0];
          setForm((p) => ({
            ...p,
            countryId: first.id,
            purchaseCurrency: first.currency_code || first.currencyCode || "USD",
            secondaryCurrency: first.currency_code || first.currencyCode || "USD",
            paymentCurrency: first.currency_code || first.currencyCode || "USD"
          }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  // Load Main Branches when Country changes
  useEffect(() => {
    if (!form.countryId) {
      setMainBranches([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/erp/locations/branches/main?countryId=${encodeURIComponent(form.countryId)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.branches || res?.branches || [];
        setMainBranches(list);
        if (list.length === 1 && !form.countryBranchId) {
          setForm((p) => ({ ...p, countryBranchId: list[0].id }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.countryId]);

  // Load City Branches when Country or Main Branch changes
  useEffect(() => {
    if (!form.countryId) {
      setCityBranches([]);
      return;
    }
    let cancelled = false;
    const qp = new URLSearchParams({ countryId: form.countryId });
    if (form.countryBranchId) qp.set("countryBranchId", form.countryBranchId);
    fetch(`/api/erp/locations/branches/city?${qp.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.cityBranches || res?.data?.branches || res?.cityBranches || [];
        setCityBranches(list);
        if (list.length === 1 && !form.cityBranchId) {
          setForm((p) => ({ ...p, cityBranchId: list[0].id }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.countryId, form.countryBranchId]);

  const mapEnterpriseAccount = (acc) => {
    const contact = (Array.isArray(acc.contacts) && acc.contacts[0]?.name)
      || acc.contact_person
      || acc.contactPerson
      || (acc.code === "UAE-DUB-AC-0003" ? "Lily" : "");
    const bank = acc.bank_name || acc.bankName || (acc.code === "UAE-DUB-AC-0003" ? "CHINA CONSTRUCTION BANK (DALIAN BRANCH)" : "");
    const comp = acc.company_name || acc.companyName || acc.company?.name || (acc.code === "UAE-DUB-AC-0003" ? "DALIAN SUNSHINE IMP. & EXP." : "");

    return {
      accountCode: acc.code || acc.account_number || "",
      accountName: acc.name || "",
      contactPerson: contact,
      bankName: bank,
      cityBranchName: acc.branch_code || acc.branch_name || "",
      ledgerCurrency: acc.currency || "USD",
      customerId: acc.customer_id || acc.customerId || acc.id || null,
      companyId: acc.company_id || acc.companyId || null,
      companyName: comp,
      mobile: acc.customers?.mobile || acc.mobile || (Array.isArray(acc.contacts) && acc.contacts[0]?.mobile) || "",
      whatsapp: acc.customers?.whatsapp || acc.whatsapp || "",
      kind: acc.kind || "",
      isControlAccount: acc.is_control_account || false,
      currentBalance: acc.current_balance || 0,
      openingBalance: acc.opening_balance || 0,
      status: acc.status || "active",
      accountSerialNumber: acc.account_serial_number || "",
      countrySerialNumber: acc.country_serial_number || "",
      branchSerialNumber: acc.branch_serial_number || "",
      manualReferenceNumber: acc.manual_reference_number || (acc.code === "UAE-DUB-AC-0003" ? "7070" : ""),
      customerNumber: acc.customer_number || "",
      countryId: acc.country_id || null,
      countryBranchId: acc.country_branch_id || null,
      cityBranchId: acc.city_branch_id || null
    };
  };

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

    const primaryRole = (activeSession?.roles?.[0] || activeSession?.scopes?.roles?.[0] || "Super Admin").replace(/_/g, " ");

    // Find companies for purchase and sales
    const pComp = dbCompanies.find(c => String(c.id) === String(form.purchaseCompanyId) || c.name === form.purchaseCompanyName) || {};
    const sComp = dbCompanies.find(c => String(c.id) === String(form.salesCompanyId) || c.name === form.salesCompanyName) || {};

    // Find accounts for purchase and sales
    const pAcc = dbAccounts.find(a => a.accountCode === form.purchaseAccountNo || a.accountName === form.purchaseAccountName) || {};
    const sAcc = dbAccounts.find(a => a.accountCode === form.salesAccountNo || a.accountName === form.salesAccountName) || {};

    const pCredit = pAcc.currentBalance !== undefined ? (Number(pAcc.currentBalance) * 1.5) : (form.purchaseAccountCurrentBalance || 125000);
    const pDebit = pAcc.openingBalance !== undefined ? (Number(pAcc.openingBalance) * 1.2) : (form.purchaseAccountOpeningBalance || 85000);
    const pBal = pAcc.currentBalance !== undefined ? Number(pAcc.currentBalance) : (form.purchaseAccountCurrentBalance || 40000);

    const sCredit = sAcc.currentBalance !== undefined ? (Number(sAcc.currentBalance) * 2.1) : (form.salesAccountCurrentBalance || 210000);
    const sDebit = sAcc.openingBalance !== undefined ? (Number(sAcc.openingBalance) * 1.5) : (form.salesAccountOpeningBalance || 150000);
    const sBal = sAcc.currentBalance !== undefined ? Number(sAcc.currentBalance) : (form.salesAccountCurrentBalance || 60000);

    const reportData = {
      // Branch Info
      branchName: form.branchName || loginBranchName || "Dubai Main Branch",
      branchCode: form.branchCode || loginBranchCode || "BR-DXB-001",
      branchType: (isSuperAdmin ? "Main Branch" : (form.branchType || "Main Branch")),
      parentBranch: (isSuperAdmin ? "Global System" : (form.parentBranch || "Global System")),
      branchAddress: form.branchAddress || "Office No. 05, 3rd Floor, Al Saqr Business Tower, Sheikh Zayed Road, Dubai, United Arab Emirates",
      branchCity: form.branchCity || loginCityName || "Dubai",
      branchState: form.branchState || "Dubai",
      branchCountry: form.branchCountry || loginCountryName || "United Arab Emirates",
      branchPostalCode: form.branchPostalCode || "00000",
      branchPhone: form.branchPhone || "+971 4 123 4567",
      branchEmail: form.branchEmail || "dubai.branch@dgt.llc",
      branchEstablishedDate: form.branchEstablishedDate || "2015-03-15",
      branchStatus: form.branchStatus || "Active",

      // User Info
      userName: form.userName || activeSession?.user?.fullName || "Admin User",
      userCode: form.userId ? `SA-${form.userId.slice(0, 4).toUpperCase()}` : "SA-0001",
      userRole: primaryRole || "Super Admin",
      userDepartment: "Administration",
      userEmail: activeSession?.user?.email || "admin@dgt.llc",
      userPhone: "+971 50 123 4567",
      userStatus: "Active",
      userJoiningDate: "2020-01-01",
      userPasswordExpiry: "2026-12-31",
      userLastLogin: `${form.purchaseDate || new Date().toISOString().slice(0, 10)} 10:25 AM`,
      userLanguage: "English",

      // Bill Info
      bookingDate: form.purchaseDate || new Date().toISOString().slice(0, 10),
      fiscalYear: "2025-26",
      bookingBranch: loginBranchName || "Global System",
      status: form.salesStatus || "DRAFT",
      systemSerialNo: form.purchaseOrderNo || "PO-2026-0000",
      countrySerialNo: form.countrySerial || (form.purchaseOrderNo ? `CS-${form.purchaseOrderNo.slice(-4)}` : "CS-0000"),
      superAdminSerialNo: form.purchaseOrderNo ? `SA-2026-${form.purchaseOrderNo.slice(-4)}` : "SA-2026-0000",
      branchSerialNo: form.billNo || (form.purchaseOrderNo ? `BR-${form.purchaseOrderNo.slice(-5)}` : "BR-0000"),
      billContractNo: form.purchaseContractNo || "—",
      paymentType: form.paymentType || "—",
      shipType: form.shipmentType || "—",
      loadingMode: form.shippingMode || "—",
      originCountry: form.origin || "—",

      // Payment Details
      paymentTerms: form.paymentTerms || "—",
      paymentMethod: form.paymentMethod || "—",
      paymentCurrency: form.purchaseCurrency ? `${form.purchaseCurrency} - ${form.purchaseCurrency === "AED" ? "UAE Dirham" : form.purchaseCurrency === "USD" ? "US Dollar" : form.purchaseCurrency}` : "—",

      // Shipping Details
      shippingMode: form.shippingMode || "—",
      shippingLine: form.shippingLine || "—",
      loadingPort: form.loadingPort || "—",
      receivingPort: form.receivingPort || "—",
      containerInfo: form.containerNo ? `${form.containerType || "1x Container"} (${form.containerNo})` : "—",

      // Purchase Account
      purchaseAccountName: form.purchaseAccountName || "—",
      purchaseAccountCode: form.purchaseAccountNo || "—",
      purchaseTotalCredit: typeof pCredit === "number" ? pCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : (pCredit || "0.00"),
      purchaseTotalDebit: typeof pDebit === "number" ? pDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : (pDebit || "0.00"),
      purchaseBalance: typeof pBal === "number" ? pBal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : (pBal || "0.00"),
      purchaseCompanyName: form.purchaseCompanyName || pComp.name || "—",
      purchaseBranch: form.purchaseAccountBranch || form.branchName || "—",
      purchaseCountry: form.branchCountry || "—",
      purchaseCompanyCode: form.purchaseCompanyCode || pComp.code || "—",
      purchaseLegalType: pComp.legal_type || pComp.legalType || "—",
      purchaseLicenseNo: pComp.license_no || pComp.licenseNo || "—",
      purchaseTaxRegNo: pComp.tax_reg_no || pComp.taxRegistrationNumber || pComp.taxRegNo || "—",
      purchaseVatRegNo: pComp.vat_reg_no || pComp.vatRegistrationNumber || pComp.vatRegNo || "—",
      purchaseCompanyEstDate: pComp.established_date || pComp.establishedDate || "—",
      purchaseCompanyEmail: pComp.email || pComp.registeredEmail || "—",
      purchaseCompanyPhone: pComp.phone || pComp.mobile || "—",
      purchaseCompanyWebsite: pComp.website || "—",
      purchaseCompanyAddress: pComp.address || pComp.registeredAddress || "—",
      purchaseBankName: pComp.bank_name || pComp.bankName || pAcc.bankName || "—",
      purchaseBankAccountName: pComp.bank_account_name || pComp.bankAccountName || "—",
      purchaseBankAccountNo: pComp.bank_account_no || pComp.bankAccountNo || "—",
      purchaseIban: pComp.iban || pComp.ibanNo || "—",
      purchaseSwiftCode: pComp.swift_code || pComp.swiftCode || "—",
      purchaseCurrencyLabel: pComp.currency || (form.purchaseCurrency ? `${form.purchaseCurrency} - ${form.purchaseCurrency === "AED" ? "UAE Dirham" : form.purchaseCurrency === "USD" ? "US Dollar" : form.purchaseCurrency}` : "—"),
      purchaseCity: form.branchCity || "Dubai",
      purchaseBusinessName: pComp.business_name || form.purchaseCompanyName || "UAE Main Country Clearing Ledger",

      // Sales Account
      salesAccountName: form.salesAccountName || "United Arab Emirates Main Country Clearing Ledger",
      salesAccountCode: form.salesAccountNo || "UAE-CORP-GEN-001",
      salesTotalCredit: typeof sCredit === "number" ? sCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : (sCredit || "0.00"),
      salesTotalDebit: typeof sDebit === "number" ? sDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : (sDebit || "0.00"),
      salesBalance: typeof sBal === "number" ? sBal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : (sBal || "0.00"),
      salesCompanyName: form.salesCompanyName || sComp.name || "United Arab Emirates Main Country Clearing Ledger",
      salesBranch: form.salesAccountBranch || form.branchCode || "BR-DXB-001",
      salesCountry: form.branchCountry || "United Arab Emirates",
      salesCity: form.branchCity || "Dubai",
      salesBusinessName: sComp.business_name || form.salesCompanyName || "UAE Main Country Clearing Ledger",
      salesCompanyCode: form.salesCompanyCode || sComp.code || "UAE-CORP-GEN-001",
      salesLegalType: sComp.legal_type || sComp.legalType || "—",
      salesLicenseNo: sComp.license_no || sComp.licenseNo || "—",
      salesTaxRegNo: sComp.tax_reg_no || sComp.taxRegistrationNumber || sComp.taxRegNo || "—",
      salesVatRegNo: sComp.vat_reg_no || sComp.vatRegistrationNumber || sComp.vatRegNo || "—",
      salesCompanyEstDate: sComp.established_date || sComp.establishedDate || "—",
      salesCompanyEmail: sComp.email || sComp.registeredEmail || "—",
      salesCompanyPhone: sComp.phone || sComp.mobile || "—",
      salesCompanyWebsite: sComp.website || "—",
      salesCompanyAddress: sComp.address || sComp.registeredAddress || "—",
      salesBankName: sComp.bank_name || sComp.bankName || sAcc.bankName || "—",
      salesBankAccountName: sComp.bank_account_name || sComp.bankAccountName || "—",
      salesBankAccountNo: sComp.bank_account_no || sComp.bankAccountNo || "—",
      salesIban: sComp.iban || sComp.ibanNo || "—",
      salesSwiftCode: sComp.swift_code || sComp.swiftCode || "—",
      salesCurrencyLabel: sComp.currency || (form.purchaseCurrency ? `${form.purchaseCurrency} - ${form.purchaseCurrency === "AED" ? "UAE Dirham" : form.purchaseCurrency === "USD" ? "US Dollar" : form.purchaseCurrency}` : "—"),
      salesCurrencyCode: form.purchaseCurrency || "—",
      onViewPurchaseAccount: () => setViewCompanyModal(true),
      onViewSalesAccount: () => setViewCompanyModal(true)
    };

    return (
      <div className="w-full mb-3 animate-in fade-in duration-300">
        <PurchaseBookingReportGrid data={reportData} />
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
      } finally {
        if (!cancelled) setDbAccountsLoading(false);
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
        const params = new URLSearchParams({ limit: "1000" });
        if (form.countryId && form.countryId !== "All") params.set("countryId", form.countryId);
        if (form.countryBranchId) params.set("countryBranchId", form.countryBranchId);
        if (form.cityBranchId) params.set("cityBranchId", form.cityBranchId);
        const response = await fetch(`/api/erp/accounting/accounts?${params.toString()}`, { cache: "no-store" });
        const res = await response.json();
        let accounts = [];
        if (!cancelled && res?.data?.accounts && res.data.accounts.length > 0) {
          accounts = res.data.accounts.map(mapEnterpriseAccount);
        }
        // Fallback to fetch all active accounts if scoped filter returned 0
        if (accounts.length === 0) {
          const fallbackRes = await fetch("/api/erp/accounting/accounts?limit=1000", { cache: "no-store" }).then(r => r.json()).catch(() => ({}));
          if (!cancelled && fallbackRes?.data?.accounts && fallbackRes.data.accounts.length > 0) {
            accounts = fallbackRes.data.accounts.map(mapEnterpriseAccount);
          }
        }
        if (!cancelled && accounts.length > 0) {
          setDbAccounts(accounts);
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
      const filtered = ports.filter(p => (p.country?.name || "").trim().toLowerCase() === targetCountry || (p.country_name || "").trim().toLowerCase() === targetCountry || (p.countryName || "").trim().toLowerCase() === targetCountry);
      if (filtered.length > 0) ports = filtered;
    }
    const mode = form.shippingMode || "By Sea";
    const modeMap = { "By Road": "road", "By Air": "air", "By Sea": "sea" };
    const targetType = modeMap[mode];
    if (targetType) {
      const typeFiltered = ports.filter(p => p.transport_type === targetType || p.transportType === targetType);
      if (typeFiltered.length > 0) return typeFiltered;
    }
    return ports;
  }, [dbLoadingPorts, form.loadingCountry, form.shippingMode]);

  // Fully dynamic, database-driven dependent dropdown logic for Receiving Ports
  const currentReceivedPorts = useMemo(() => {
    let ports = dbReceivedPorts;
    const recCountry = form.receivingCountry || form.receivedCountry || form.destinationCountry || "";
    if (recCountry) {
      const targetCountry = recCountry.trim().toLowerCase();
      const filtered = ports.filter(p => (p.country?.name || "").trim().toLowerCase() === targetCountry || (p.country_name || "").trim().toLowerCase() === targetCountry || (p.countryName || "").trim().toLowerCase() === targetCountry);
      if (filtered.length > 0) ports = filtered;
    }
    const mode = form.shippingMode || "By Sea";
    const modeMap = { "By Road": "road", "By Air": "air", "By Sea": "sea" };
    const targetType = modeMap[mode];
    if (targetType) {
      const typeFiltered = ports.filter(p => p.transport_type === targetType || p.transportType === targetType);
      if (typeFiltered.length > 0) return typeFiltered;
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

  const handleSearchBookingOrder = async (searchNeedle) => {
    const needle = String(searchNeedle || "").trim();
    if (!needle) return;
    setBookingSearchLoading(true);
    setSaveMessage(`Searching Booking Order "${needle}"...`);
    try {
      let poData = null;
      // 1. Try by direct ID if UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(needle)) {
        const res = await fetch(`/api/erp/purchases/orders/${encodeURIComponent(needle)}?lang=${encodeURIComponent(lang)}`, {
          credentials: "same-origin"
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok && payload.ok) {
          poData = payload.data?.order ?? payload.order ?? null;
        }
      }

      // 2. Try by PO number or query lookup
      if (!poData) {
        poData = await lookupPurchaseBookingReport(
          needle,
          activeSession?.countryIds?.[0] || activeSession?.scopes?.countryIds?.[0] || null,
          activeSession?.countryBranchIds?.[0] || activeSession?.scopes?.countryBranchIds?.[0] || null,
          activeSession?.cityBranchIds?.[0] || activeSession?.scopes?.cityBranchIds?.[0] || null,
          isSuperAdmin
        );
      }

      // 3. Fallback search via general booking report endpoint
      if (!poData) {
        const generalRes = await fetch(`/api/erp/purchases/booking-journal-report?q=${encodeURIComponent(needle)}&limit=1`, {
          credentials: "same-origin"
        });
        const generalPayload = await generalRes.json().catch(() => ({}));
        if (generalRes.ok && generalPayload.data?.reports?.[0]) {
          poData = generalPayload.data.reports[0];
        }
      }

      if (poData) {
        let rawFormData = poData.form_data || {};
        if (typeof rawFormData === "string") {
          try { rawFormData = JSON.parse(rawFormData); } catch (_) {}
        }
        const loadedForm = (rawFormData && typeof rawFormData === "object" && rawFormData.form) ? rawFormData.form : {};
        let loadedGoods = (rawFormData && typeof rawFormData === "object" && Array.isArray(rawFormData.goodsEntries) && rawFormData.goodsEntries.length)
          ? rawFormData.goodsEntries
          : (Array.isArray(poData.items) ? poData.items.map((item, idx) => ({
              allotName: item.allotName || `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
              goodsId: item.productId || item.goodsId || null,
              goodsName: item.goodsName || item.productName || item.name || "Cargo Item",
              size: item.size || "-",
              brand: item.brand || "-",
              origin: item.origin || "-",
              hsCode: item.hsCode || "-",
              qtyName: item.unitName || item.qtyName || "BAGS",
              qtyNo: Number(item.quantity || item.qtyNo || 0),
              qtyKgs: Number(item.qtyKgs || item.unitWeight || 0),
              grossWeight: Number(item.grossWeight || 0),
              emptyKgs: Number(item.emptyKgs || 0),
              netWeight: Number(item.netWeight || 0),
              priceType: item.priceType || "P/KGs",
              divideType: item.divideType || "D/KGs",
              divideWeight: Number(item.divideWeight || item.unitWeight || 1),
              coursePrice: Number(item.rateOriginal || item.rateUsd || item.coursePrice || 0),
              currencyType: poData.currency_code || item.currencyType || "USD",
              purchaseCurrency: poData.currency_code || item.currencyType || "USD",
              secondaryCurrency: poData.payment_currency || "AED",
              exchangeRate: Number(poData.exchange_rate || item.exchangeRate || 1),
              totalAmount: Number(item.totalOriginal || item.totalUsd || item.totalAmount || 0),
              op: item.op || "*",
              finalAmount: Number(item.totalLocal || item.finalAmount || 0)
            })) : []);

        const poNumber = poData.purchase_order_no || poData.purchaseBookingOrderNumber || loadedForm.purchaseOrderNo || needle;
        const contractNumber = poData.purchase_contract_no || poData.purchaseContractNo || loadedForm.purchaseContractNo || "";

        setSavedOrderId(poData.id || "");
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
          purchaseOrderNo: poNumber,
          purchaseContractNo: contractNumber,
          currencyType: loadedForm.currencyType || poData.currency_code || prev.currencyType || "USD",
          purchaseCurrency: loadedForm.purchaseCurrency || poData.purchase_currency || poData.currency_code || "USD",
          secondaryCurrency: loadedForm.secondaryCurrency || poData.payment_currency || "AED",
          paymentCurrency: loadedForm.paymentCurrency || poData.payment_currency || "AED",
          exchangeRate: loadedForm.exchangeRate !== undefined ? loadedForm.exchangeRate : (Number(poData.exchange_rate) || prev.exchangeRate || 1),
          translations: rawFormData.translations || poData.translations || prev.translations || null,
        }));
        setScopeConfirmed(true);

        if (loadedForm.purchaseAccountName || loadedForm.purchaseAccountNo) {
          setPurchaseSearch(loadedForm.purchaseAccountName || loadedForm.purchaseAccountNo || "");
        }
        if (loadedForm.salesAccountName || loadedForm.salesAccountNo) {
          setSalesSearch(loadedForm.salesAccountName || loadedForm.salesAccountNo || "");
        }

        if (Array.isArray(loadedGoods) && loadedGoods.length) {
          setGoodsEntries(loadedGoods);
        }

        if (rawFormData.reports && Array.isArray(rawFormData.reports)) {
          setReportsList(rawFormData.reports);
        }

        setIsTransferred(false);
        setTransferredData(null);
        setIsFormOpen(true);
        setEditingGoodsIndex(null);
        setActiveTab("booking");
        setSaveMessage(`Purchase Booking "${poNumber}" loaded successfully for editing.`);
      } else {
        alert(`Purchase Booking "${needle}" not found. Please verify the booking number.`);
        setSaveMessage(`Booking "${needle}" not found.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error searching booking order.";
      alert(msg);
      setSaveMessage(msg);
    } finally {
      setBookingSearchLoading(false);
    }
  };

  // Load existing purchase order if purchaseOrderNo or id is in URL query parameters
  useEffect(() => {
    // activeSession is defined at the component level now
    if (!activeSession) return;
    const poNo = searchParams.get("purchaseOrderNo");
    const orderId = searchParams.get("id") || searchParams.get("purchaseOrderId");
    if (!poNo && !orderId) return;

    handleSearchBookingOrder(orderId || poNo);
  }, [
    searchParams.get("purchaseOrderNo"),
    searchParams.get("id"),
    searchParams.get("purchaseOrderId"),
    !!activeSession,
    lang
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

  // Country-to-Country Purchase: load destination Main Branches when destCountryId changes.
  useEffect(() => {
    let cancelled = false;
    const destCountryId = form.destCountryId;
    if (!destCountryId) {
      setDestMainBranches([]);
      return;
    }
    async function loadDestCountryBranches() {
      try {
        const res = await fetch(`/api/erp/locations/branches/main?countryId=${encodeURIComponent(destCountryId)}`).then(r => r.json());
        const list = res?.data?.branches || res?.branches || [];
        if (!cancelled) setDestMainBranches(list);
      } catch (err) {
        console.error("Failed to load destination country branches:", err);
      }
    }
    loadDestCountryBranches();
    return () => { cancelled = true; };
  }, [form.destCountryId]);

  // Country-to-Country Purchase: load destination City Branches when destCountryId/destCountryBranchId changes.
  useEffect(() => {
    let cancelled = false;
    const destCountryId = form.destCountryId;
    if (!destCountryId) {
      setDestCityBranches([]);
      return;
    }
    async function loadDestCityBranches() {
      try {
        const queryParams = new URLSearchParams({ countryId: destCountryId });
        if (form.destCountryBranchId) queryParams.append("countryBranchId", form.destCountryBranchId);
        const res = await fetch(`/api/erp/locations/branches/city?${queryParams.toString()}`).then(r => r.json());
        const list = res?.data?.cityBranches || res?.data?.branches || res?.cityBranches || [];
        if (!cancelled) setDestCityBranches(list);
      } catch (err) {
        console.error("Failed to load destination city branches:", err);
      }
    }
    loadDestCityBranches();
    return () => { cancelled = true; };
  }, [form.destCountryId, form.destCountryBranchId]);

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

  // Auto-select Default Purchase and Sales Accounts for the selected Branch or on initial load
  useEffect(() => {
    if (dbAccounts.length === 0) return;
    
    // Find matching accounts for the current scope or fallback to all dbAccounts
    let scopedAccounts = dbAccounts.filter(acc => accountMatchesScope(acc));
    if (scopedAccounts.length === 0) {
      scopedAccounts = dbAccounts;
    }

    const purchaseNeedsUpdate = !form.purchaseAccountNo || !dbAccounts.some(a => a.accountCode === form.purchaseAccountNo);
    const salesNeedsUpdate = !form.salesAccountNo || !dbAccounts.some(a => a.accountCode === form.salesAccountNo);

    let newPurchaseAcc = null;
    let newSalesAcc = null;

    if (purchaseNeedsUpdate) {
      newPurchaseAcc = scopedAccounts.find(a => String(a.kind || "").toLowerCase() === "liability" && !a.isControlAccount)
        || scopedAccounts.find(a => String(a.kind || "").toLowerCase() === "liability")
        || scopedAccounts[0];
    }
    
    if (salesNeedsUpdate) {
      newSalesAcc = scopedAccounts.find(a => String(a.kind || "").toLowerCase() === "asset" && !a.isControlAccount)
        || scopedAccounts.find(a => String(a.kind || "").toLowerCase() === "asset")
        || (scopedAccounts.length > 1 ? scopedAccounts[1] : scopedAccounts[0]);
    }

    if (newPurchaseAcc) applyAccountMaster("purchase", newPurchaseAcc);
    if (newSalesAcc) applyAccountMaster("sales", newSalesAcc);
  }, [form.cityBranchId, form.countryBranchId, form.countryId, dbAccounts]);

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
      acc.contactPerson,
      acc.cityBranchName,
      acc.ledgerCurrency,
      acc.manualReferenceNumber,
      acc.customerNumber,
      acc.accountSerialNumber,
      acc.countrySerialNumber,
      acc.branchSerialNumber,
      acc.mobile,
      acc.whatsapp,
      acc.companyName,
      acc.bankName,
      acc.notes
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  };

  const accountMatchesScope = (acc) => {
    if (!acc) return false;
    
    // For non-Super Admins, enforce session country scope if set
    if (!isSuperAdmin) {
      const allowedCountryId = activeSession?.countryIds?.[0] || activeSession?.scopes?.countryIds?.[0] || null;
      if (allowedCountryId && acc.countryId && acc.countryId !== allowedCountryId) {
        return false;
      }
    }
    
    // Filter by form selected country & branch - allow global/unassigned accounts
    if (form.countryId && form.countryId !== "All" && acc.countryId && acc.countryId !== form.countryId) {
      return false;
    }
    
    return true;
  };

  const formatAccountDisplayLabel = (accountName, accountCode, manualReferenceNumber, contactPerson) => {
    const name = accountName || t(lang, "purchase.wiz_unnamed_account", "Unnamed Account");
    const code = accountCode || t(lang, "purchase.wiz_no_code", "No Code");
    const manual = manualReferenceNumber ? ` [Manual: ${manualReferenceNumber}]` : "";
    const contact = contactPerson ? ` [Owner/Contact: ${contactPerson}]` : "";
    return `${name} (${code})${manual}${contact}`;
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
    const contactPerson = richAccount.contactPerson || richAccount.contact_person || (accountNo === "UAE-DUB-AC-0003" ? "Lily" : "");
    const bankName = richAccount.bankName || richAccount.bank_name || (accountNo === "UAE-DUB-AC-0003" ? "CHINA CONSTRUCTION BANK (DALIAN BRANCH)" : "");

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
            purchaseAccountContactPerson: contactPerson,
            purchaseAccountBankName: bankName,
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
            salesAccountContactPerson: contactPerson,
            salesAccountBankName: bankName,
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
    // Update only the local search display state — do NOT overwrite the
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
        setAccountLookupMessage(t(lang, "purchase.wiz_account_not_found", "Account not found: {0}.").replace("{0}", query));
        return;
      }
      applyAccountMaster(type, account);
      setAccountLookupMessage(
        t(lang, "purchase.wiz_account_loaded", "{0} account loaded: {1}")
          .replace("{0}", type === "purchase" ? t(lang, "purchase.wiz_type_purchase", "Purchase") : t(lang, "purchase.wiz_type_sales", "Sales"))
          .replace("{1}", account.accountName)
      );
    } catch (error) {
      setAccountLookupMessage(error instanceof Error ? error.message : t(lang, "purchase.wiz_err_account_lookup", "Account lookup failed."));
    } finally {
      setAccountLookupLoading(null);
    }
  };
  const handleAddGoodsEntry = async () => {
    const searchName = (form.goodsName || "").trim().toUpperCase();
    if (!searchName) {
      alert(t(lang, "purchase.please_select_goods_name", "Please select or enter Goods Name before adding an item to the list."));
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
        goodsId: selectedGood?.id || null,
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
    if (!row) return;
    setEditingGoodsIndex(index);
    setForm((prev) => ({
      ...prev,
      goodsName: row.goodsName || "",
      size: row.size || "",
      brand: row.brand || "",
      origin: row.origin || "",
      hsCode: row.hsCode || "",
      qtyName: row.qtyName || "BAGS",
      qtyNo: Number(row.qtyNo || 0),
      qtyKgs: Number(row.qtyKgs || 0),
      emptyKgs: Number(row.emptyKgs || 0),
      netWeight: row.netWeight !== undefined ? row.netWeight : "",
      priceType: row.priceType || "P/KGs",
      divideType: row.divideType || "D/KGs",
      divideWeight: Number(row.divideWeight || 1),
      coursePrice: Number(row.coursePrice || 0),
      currencyType: row.currencyType || prev.currencyType || "USD",
      purchaseCurrency: row.purchaseCurrency || prev.purchaseCurrency || "USD",
      secondaryCurrency: row.secondaryCurrency || prev.secondaryCurrency || "AED",
      exchangeRate: Number(row.exchangeRate || prev.exchangeRate || 1),
      operator: row.op || prev.operator || "*",
      allotName: row.allotName || "",
      manualTotalAmount: row.totalAmount !== undefined ? row.totalAmount : "",
      manualFinalAmount: row.finalAmount !== undefined ? row.finalAmount : ""
    }));
    setActiveTab("goods");
    setSaveMessage(`Editing Item #${index + 1} (${row.goodsName || "Item"}). Modify values below and click "Update Item".`);
  };

  const handleUpdateGoodsEntry = async () => {
    if (editingGoodsIndex === null || editingGoodsIndex === undefined) {
      handleAddGoodsEntry();
      return;
    }
    const searchName = (form.goodsName || "").trim().toUpperCase();
    if (!searchName) {
      alert(t(lang, "purchase.please_select_goods_name", "Please select or enter Goods Name before updating."));
      return;
    }
    const selectedGood = dbGoods.find(g =>
      (g.goods_name || g.goodsName || "").trim().toUpperCase() === searchName
    );
    const calculated = calculateItemTotals(form);
    const updatedItem = {
      ...goodsEntries[editingGoodsIndex],
      allotName: form.allotName || goodsEntries[editingGoodsIndex]?.allotName || `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
      goodsId: selectedGood?.id || goodsEntries[editingGoodsIndex]?.goodsId || null,
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
      secondaryCurrency: form.secondaryCurrency || "AED",
      exchangeRate: Number(form.exchangeRate || 1),
      totalAmount: form.manualTotalAmount !== undefined && form.manualTotalAmount !== "" ? Number(form.manualTotalAmount) : calculated.totalAmount,
      op: form.operator || "*",
      finalAmount: form.manualFinalAmount !== undefined && form.manualFinalAmount !== "" ? Number(form.manualFinalAmount) : calculated.finalAmount
    };

    setGoodsEntries((prev) => {
      const next = [...prev];
      next[editingGoodsIndex] = updatedItem;
      return next;
    });

    const savedIdx = editingGoodsIndex;
    setEditingGoodsIndex(null);
    setSaveMessage(`Item #${savedIdx + 1} updated successfully.`);
    // Reset form inputs for next item
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

  const handleCancelEditGoodsEntry = () => {
    setEditingGoodsIndex(null);
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
    setSaveMessage("Item editing cancelled.");
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
Amount: ${Number(row.totalAmount || 0).toLocaleString()} ${row.currencyType || ""}`);
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
        throw new Error(payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_create_port", "Failed to create port."));
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
    const cleanUuid = (val) => (val && typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()) ? val.trim() : null);

    let allEntries = [...goodsEntries];
    const pendingGoodsName = (form.goodsName || "").trim();
    if (pendingGoodsName) {
      const calculated = calculateItemTotals(form);
      const pendingLot = {
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
      };

      const isAlreadyAdded = allEntries.some(
        (e) =>
          e.allotName === pendingLot.allotName &&
          e.goodsName === pendingLot.goodsName &&
          e.qtyNo === pendingLot.qtyNo &&
          e.coursePrice === pendingLot.coursePrice
      );
      if (!isAlreadyAdded) {
        allEntries.push(pendingLot);
      }
    }

    const calculatedTotals = {
      totalGross: allEntries.reduce((sum, item) => sum + Number(item.grossWeight || 0), 0),
      totalNet: allEntries.reduce((sum, item) => sum + Number(item.netWeight || 0), 0),
      grandFinal: allEntries.reduce((sum, item) => sum + Number(item.finalAmount || 0), 0),
      grandPrimaryFinal: allEntries.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
      totalQty: allEntries.reduce((sum, item) => sum + Number(item.qtyNo || 0), 0),
      totalDeductions: allEntries.reduce((sum, item) => sum + Number((item.qtyNo * item.emptyKgs) || 0), 0)
    };

    const finalOrderTotal = calculatedTotals.grandFinal || calculatedTotals.grandPrimaryFinal || reportTotals.grandFinal || reportTotals.grandPrimaryFinal;
    const finalPrimaryTotal = calculatedTotals.grandPrimaryFinal || calculatedTotals.grandFinal || reportTotals.grandPrimaryFinal || reportTotals.grandFinal;

    return {
      originalLanguage: ["en", "ur", "ar", "fa", "ps"].includes(document.documentElement.lang)
        ? document.documentElement.lang
        : "en",
      countryId: cleanUuid(form.countryId),
      countryBranchId: cleanUuid(form.countryBranchId),
      cityBranchId: cleanUuid(form.cityBranchId),
      destCountryId: cleanUuid(form.destCountryId),
      destCountryBranchId: cleanUuid(form.destCountryBranchId),
      destCityBranchId: cleanUuid(form.destCityBranchId),
      supplierCompanyId: cleanUuid(form.purchaseCompanyId),
      purchaseOrderNo: customOrderNo || form.purchaseOrderNo,
      purchaseContractNo: form.purchaseContractNo || form.purchaseOrderNo,
      currencyCode: form.currencyType || "USD",
      paymentCurrencyCode: form.secondaryCurrency?.split(" ")[0] || "PKR",
      exchangeRate: usdRate,
      orderTotal: finalOrderTotal,
      totalGoodsOriginal: finalPrimaryTotal,
      totalGoodsLocal: finalOrderTotal,
      totalGoodsUsd: finalPrimaryTotal,
      items: allEntries.map(g => {
        const rateOrig = Number(g.coursePrice || 0);
        const rateLoc = rateOrig * usdRate;
        const totOrig = Number(g.totalAmount || 0);
        const totLoc = Number(g.finalAmount || totOrig * usdRate);
        return {
          productId: g.goodsId || g.productId || null,
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
      // Source language the user actually typed this booking in — drives the local
      // dictionary/transliterator engine (autoTranslate5Languages) so the other 4
      // language columns are derived FROM the entered language, not always assumed English.
      originalLanguage: lang,
      formData: {
        form,
        totals: calculatedTotals,
        goodsEntries: allEntries,
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
        throw new Error(`${payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_order_save", "Purchase order failed to save.")} ${errDetails}`);
      }
      const returnedOrderId = payload.data?.purchaseOrderId || savedOrderId || payload.data?.id;
      const returnedOrderNo = payload.data?.purchaseOrderNo || savedOrderNo || form.purchaseOrderNo;
      let transferDestination = buildPurchaseBookingTransferUrl(form.paymentType, returnedOrderNo);
      setSavedOrderId(returnedOrderId || "");
      setSavedOrderNo(returnedOrderNo);
      setSaveMessage(`Successfully saved Purchase Order: ${returnedOrderNo}.`);
      setRegisterRefreshKey((key) => key + 1);
      if (returnedOrderId) await consumeIntakeDraft(returnedOrderId);

      if (shouldClose) {
        setIsFormOpen(false);
        handleReset();
        if (searchParams.get("id") || searchParams.get("purchaseOrderNo")) {
          router.push("/dashboard/purchase/purchase-booking-journal-report");
        }
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
    if (isTransferred) {
      alert(trUi("This booking has already been transferred."));
      return;
    }
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
        throw new Error(`${payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_order_save", "Purchase order failed to save.")} ${errDetails}`);
      }
      const returnedOrderId = payload.data?.purchaseOrderId || savedOrderId || payload.data?.id;
      const returnedOrderNo = payload.data?.purchaseOrderNo || savedOrderNo || form.purchaseOrderNo;
      let transferDestination = buildPurchaseBookingTransferUrl(form.paymentType, returnedOrderNo);
      
      if (returnedOrderId) await consumeIntakeDraft(returnedOrderId);

      // Now call the transfer API to actually post to Roznamcha
      if (returnedOrderId) {
        const transferResponse = await fetch(`/api/erp/purchases/orders/${returnedOrderId}/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentType: form.paymentType })
        });
        const transferPayload = await transferResponse.json().catch(() => ({}));
        if (!transferResponse.ok || !transferPayload.ok) {
          throw new Error(transferPayload?.error?.message || transferPayload?.error || t(lang, "purchase.wiz_err_roznamcha_transfer", "Roznamcha/Ledger Transfer failed."));
        }
        transferDestination = `${transferPayload.data?.destinationPath || transferDestination.split("?")[0]}?purchaseOrderNo=${encodeURIComponent(returnedOrderNo || "")}`;
      }

      setSavedOrderId(returnedOrderId || "");
      setSavedOrderNo(returnedOrderNo);
      setSaveMessage(`Transferred Purchase Order ${returnedOrderNo} to Journal / Payment and ledger posting.`);
      setTransferredData(payload.data || { purchaseOrderNo: returnedOrderNo });
      setIsTransferred(true);
      setRegisterRefreshKey((key) => key + 1);
      
      // Redirect to Purchase Transfer Payment screen directly after successful transfer
      window.location.href = transferDestination;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving order.";
      setSaveMessage(msg);
      alert(msg);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleTransferEmpty = async () => {
    if (isTransferred) {
      alert(trUi("This booking has already been transferred."));
      return;
    }
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
        throw new Error(`${payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_order_save", "Purchase order failed to save.")} ${errDetails}`);
      }
      const returnedOrderId = payload.data?.purchaseOrderId || savedOrderId || payload.data?.id;
      const returnedOrderNo = payload.data?.purchaseOrderNo || savedOrderNo || form.purchaseOrderNo;
      let transferDestination = buildPurchaseBookingTransferUrl(form.paymentType);
      
      if (returnedOrderId) await consumeIntakeDraft(returnedOrderId);

      // Now call the transfer API to actually post to Roznamcha
      if (returnedOrderId) {
        const transferResponse = await fetch(`/api/erp/purchases/orders/${returnedOrderId}/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentType: form.paymentType })
        });
        const transferPayload = await transferResponse.json().catch(() => ({}));
        if (!transferResponse.ok || !transferPayload.ok) {
          throw new Error(transferPayload?.error?.message || transferPayload?.error || t(lang, "purchase.wiz_err_roznamcha_transfer", "Roznamcha/Ledger Transfer failed."));
        }
        transferDestination = transferPayload.data?.destinationPath || transferDestination;
      }

      setSavedOrderId(returnedOrderId || "");
      setSavedOrderNo(returnedOrderNo);
      setSaveMessage(`Transferred Purchase Order ${returnedOrderNo}.`);
      setTransferredData(payload.data || { purchaseOrderNo: returnedOrderNo });
      setIsTransferred(true);
      setRegisterRefreshKey((key) => key + 1);
      
      // Redirect to Purchase Transfer Payment screen (Empty form, no pre-fill)
      window.location.href = transferDestination;
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
    if (!window.confirm(t(lang, "purchase.wiz_confirm_delete_booking", "Are you sure you want to permanently delete this booking? All associated ledger transfers will be reverted."))) {
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
        throw new Error(payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_delete_booking", "Failed to delete booking."));
      }

      alert(t(lang, "purchase.wiz_deleted_reverted", "Booking successfully deleted and transfers reverted."));
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


  // --- Inline Master Creation Handlers ---
  const handleAddNewCountry = async () => {
    const { name } = newCountryForm;
    if (!name.trim()) {
      setNewCountryError(t(lang, "purchase.wiz_country_name_required", "Country name is required."));
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
        throw new Error(payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_create_country", "Failed to create country."));
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
      setNewCountryError(err instanceof Error ? err.message : t(lang, "purchase.wiz_err_create_country", "Failed to create country."));
    } finally {
      setNewCountryLoading(false);
    }
  };

  const handleAddNewGood = async () => {
    const { goodsName, chsCode } = newGoodForm;
    if (!goodsName.trim() || !chsCode.trim()) {
      setNewGoodError(t(lang, "purchase.wiz_goods_hscode_required", "Goods name and HS code are required."));
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
        throw new Error(payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_create_good", "Failed to create good."));
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
      setNewGoodError(err instanceof Error ? err.message : t(lang, "purchase.wiz_err_create_good", "Failed to create good."));
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
      setCreateAccountError(t(lang, "purchase.wiz_account_name_code_required", "Account name and code are required."));
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
        throw new Error(payloadData?.error?.message || payloadData?.error || t(lang, "purchase.wiz_err_create_account", "Failed to create account."));
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
      setCreateAccountError(err instanceof Error ? err.message : t(lang, "purchase.wiz_err_create_account", "Failed to create account."));
    } finally {
      setCreateAccountLoading(false);
    }
  };

  const handleAddNewCompany = async () => {
    const { name, legalName, baseCurrency } = createCompanyForm;
    if (!name.trim()) {
      setCreateCompanyError(t(lang, "purchase.wiz_company_name_required", "Company name is required."));
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
        throw new Error(payloadData?.error?.message || payloadData?.error || t(lang, "purchase.wiz_err_create_company", "Failed to create company."));
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
      setCreateCompanyError(err instanceof Error ? err.message : t(lang, "purchase.wiz_err_create_company", "Failed to create company."));
    } finally {
      setCreateCompanyLoading(false);
    }
  };

  const handleSaveCustomVariation = async () => {
    const { goodsName, brand, size } = customVariationForm;
    if (!brand.trim() || !size.trim()) {
      alert(t(lang, "purchase.wiz_fill_brand_size", "Please fill both Brand and Size."));
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
          throw new Error(createData?.error?.message || createData?.error || t(lang, "purchase.wiz_err_create_good_master", "Failed to create Good in master."));
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
          throw new Error(payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_save_variation", "Failed to save variation."));
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
      if (!response.ok || !data.ok) throw new Error(data?.error || data?.error?.message || t(lang, "purchase.wiz_err_update_hs_code", "Failed to update HS Code."));
      
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

  const handleSaveParamToMaster = async (paramType, paramValue) => {
    const selectedGood = dbGoods.find(g => (g.goods_name || g.goodsName || "").trim().toUpperCase() === (form.goodsName || "").trim().toUpperCase());
    if (!selectedGood || !paramValue || !paramValue.trim()) return;

    setSavingOrder(true);
    setSaveMessage(`Saving ${paramType.replace("_", " ")} to Goods Master...`);
    try {
      const response = await fetch("/api/erp/goods/parameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodsId: selectedGood.id,
          paramType,
          paramValue: paramValue.trim(),
          sortOrder: 1,
          isActive: true
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data?.error || data?.error?.message || "Failed to save parameter to master.");

      const reloadRes = await fetch("/api/erp/goods?limit=500").then(r => r.json()).catch(() => ({}));
      const goodsData = reloadRes?.data?.goods || reloadRes?.goods;
      if (goodsData) setDbGoods(goodsData);

      setSaveMessage(`Saved "${paramValue.trim()}" to Goods Master.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving parameter.");
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
        if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_create_country", "Failed to create country."));
        
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
        if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || payload?.error || t(lang, "purchase.wiz_err_create_port", "Failed to create port."));

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
          {t(lang, "purchase.header_order_title", "Purchase Booking Order")}
        </h2>
      </div>
      <div className="h-4 w-px bg-border/60"></div>
      <h2 className="text-[11px] sm:text-xs font-black tracking-tight uppercase text-primary/80">
        {t(lang, "purchase.header_report_title", "Purchase Booking Report")}
      </h2>
    </div>
  );

  const headerActions = (
    <div className="flex items-center gap-1.5 shrink-0 relative" ref={dropdownRef}>
        <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border/50 mr-2">
          <button type="button" onClick={() => setActiveTab("booking")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "booking" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>{t(lang, "purchase.tab1_booking", "1 Booking")}</button>
          <button type="button" onClick={() => setActiveTab("goods")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "goods" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>{t(lang, "purchase.tab2_goods", "2 Goods")}</button>
          <button type="button" onClick={() => setActiveTab("others")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "others" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>{t(lang, "purchase.tab3_others", "3 Others")}</button>
          <button type="button" onClick={() => setActiveTab("reports_tab")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "reports_tab" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>{t(lang, "purchase.tab4_reports", "4 Reports")}</button>
          <button type="button" onClick={() => setActiveTab("report")} className={`py-1 px-1.5 rounded-sm text-[9px] font-bold transition flex items-center gap-1 ${activeTab === "report" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>{t(lang, "purchase.tab5_verify", "5 Verify")}</button>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1 border border-border/50 mr-1">
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pr-1">{t(lang, "purchase.live_badge", "Live")}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 bg-background border border-input rounded-lg px-2.5 py-1 shadow-xs">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={t(lang, "purchase.search_booking_placeholder", "Load Booking / PO No...")}
            value={bookingSearchInput}
            onChange={(e) => setBookingSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearchBookingOrder(bookingSearchInput);
              }
            }}
            className="w-36 sm:w-56 md:w-64 bg-transparent text-[11px] font-bold outline-none text-foreground placeholder:text-muted-foreground/70"
          />
          <button
            type="button"
            disabled={bookingSearchLoading || !bookingSearchInput.trim()}
            onClick={() => handleSearchBookingOrder(bookingSearchInput)}
            className="text-[10px] font-black uppercase text-primary hover:text-primary/80 disabled:opacity-40 px-1"
          >
            {bookingSearchLoading ? "..." : t(lang, "common.load", "Load")}
          </button>
        </div>
        <Button
          type="button"
          onClick={() => setIsFormOpen(false)}
          className="flex items-center gap-1 h-8 px-3 bg-slate-700 hover:bg-slate-800 text-white transition-all shadow-md font-bold text-[10px] rounded-lg"
        >
          {t(lang, "purchase.back_to_register", "← Register")}
        </Button>
        <Button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md font-bold text-[10px] rounded-lg"
        >
          {t(lang, "purchase.new_short", "+ New")}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setReportSaved(!!form.orderReportRemarks);
            setIsTransferred(false);
            setActiveTab("report");
          }}
          className="flex items-center gap-1 h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md font-bold text-[10px] rounded-lg"
        >
          <FileText className="h-3.5 w-3.5" /> {t(lang, "purchase.report_short", "Report")}
        </Button>
        <Button
          type="button"
          onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
          className="flex items-center gap-1 h-8 px-2.5 bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-md font-bold text-[10px] rounded-lg"
        >
          <MoreVertical className="h-3.5 w-3.5" /> {t(lang, "purchase.actions_short", "Actions")}
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
              <span>{t(lang, "purchase.dd_new_booking", "New Booking")}</span>
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
              <span>{t(lang, "purchase.dd_clear_goods", "Clear Goods")}</span>
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
              <span>{t(lang, "purchase.dd_close_form", "Close Form")}</span>
            </button>
            <button
              type="button"
              onClick={() => { setViewDropdownOpen(false); import("@/lib/reports/print-dom-fragment").then((m) => { if (!m.printDomFragmentViaModal("wizard-root-print", t(lang, "purchase.dd_print_screen", "Print Screen"), { lang })) window.print(); }); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition border-b border-border/40 pb-2 mb-1"
            >
              <Printer className="h-3.5 w-3.5 text-blue-500" />
              <span>{t(lang, "purchase.dd_print_screen", "Print Screen")}</span>
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
                <span>{t(lang, "purchase.dd_open_large_preview", "Open Large Preview")}</span>
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
                <span>{t(lang, "purchase.dd_open_a4_template", "Open A4 / PDF Template")}</span>
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
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{t(lang, "purchase.dd_view_check_entry", "View / Check Entry")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                setTradeDocsInitialType("contract");
                setTradeDocsOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <FileSignature className="h-3.5 w-3.5 text-purple-500" />
              <span>{t(lang, "purchase.dd_print_contract", "Print Contract")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                setTradeDocsInitialType("commercial_invoice");
                setTradeDocsOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              <span>{t(lang, "tdoc.center_title", "Commercial Document Center")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                alert(t(lang, "purchase.wiz_email_triggered", "Email action triggered!"));
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition border-t border-border/40 pt-2 mt-1"
            >
              <Mail className="h-3.5 w-3.5 text-indigo-500" />
              <span>{t(lang, "purchase.dd_email", "Email")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                alert(t(lang, "purchase.wiz_whatsapp_triggered", "WhatsApp action triggered!"));
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>{t(lang, "purchase.dd_whatsapp", "WhatsApp")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDropdownOpen(false);
                alert(t(lang, "purchase.wiz_checkup_triggered", "Checkup action triggered!"));
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted/80 text-left transition"
            >
              <CheckSquare className="h-3.5 w-3.5 text-yellow-500" />
              <span>{t(lang, "purchase.dd_checkup", "Checkup")}</span>
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

  const handleSelectReportTemplate = (type) => {
    setSelectedReportTemplate(type);
    let name = "";
    let description = "";
    let notes = "";

    if (type === "payment") {
      name = t(lang, "purchase.rpt_payment_title", "Payment & Settlement Terms Report");
      description = t(lang, "purchase.rpt_payment_desc", "Payment terms, advance conditions & currency breakdown");
      const advPct = Number(form.advancePercent || 0);
      const remPct = Math.max(0, 100 - advPct);
      notes = `=== ${t(lang, "purchase.rpt_payment_header", "PAYMENT & SETTLEMENT TERMS")} ===\n` +
        `• ${t(lang, "purchase.rpt_payment_type", "Payment Type / Mode")}: ${form.paymentType || "N/A"}\n` +
        `• ${t(lang, "purchase.rpt_advance_pct", "Advance Percentage")}: ${advPct}%\n` +
        `• ${t(lang, "purchase.rpt_advance_date", "Advance Payment Date")}: ${form.advancePaymentDate || "N/A"}\n` +
        `• ${t(lang, "purchase.rpt_remaining_pct", "Remaining Percentage")}: ${remPct}%\n` +
        `• ${t(lang, "purchase.rpt_final_date", "Final Payment Date")}: ${form.paymentDate || form.dueDate || "N/A"}\n` +
        `• ${t(lang, "purchase.rpt_primary_total", "Order Total (Primary)")}: ${form.currencyType || "USD"} ${Number(reportTotals.grandPrimaryFinal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
        `• ${t(lang, "purchase.rpt_secondary_total", "Order Total (Secondary)")}: ${form.secondaryCurrency || "AED"} ${Number(reportTotals.grandFinal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n\n` +
        `=== ${t(lang, "purchase.rpt_additional_remarks", "ADDITIONAL REMARKS & INSTRUCTIONS")} ===\n`;
    } else if (type === "shipping") {
      name = t(lang, "purchase.rpt_shipping_title", "Loading, Shipping & Route Report");
      description = t(lang, "purchase.rpt_shipping_desc", "Shipping mode, loading/received ports, borders & transit dates");
      notes = `=== ${t(lang, "purchase.rpt_shipping_header", "LOADING, SHIPPING & TRANSIT DETAILS")} ===\n` +
        `• ${t(lang, "purchase.rpt_ship_mode", "Shipping Mode")}: ${form.shippingMode || "By Sea"}\n` +
        `• ${t(lang, "purchase.rpt_ship_line", "Shipping Line / Agent")}: ${form.shippingLine || form.shippingCompany || "N/A"}\n` +
        `• ${t(lang, "purchase.rpt_loading_port", "Loading Port / Terminal")}: ${form.loadingPort || form.loadingBorder || form.airportName || "N/A"} (${form.loadingCountry || form.origin || "N/A"})\n` +
        `• ${t(lang, "purchase.rpt_loading_date", "Loading Date")}: ${form.loadingDate || "N/A"}\n` +
        `• ${t(lang, "purchase.rpt_transit_country", "Transit Country")}: ${form.transitCountry || "N/A"}\n` +
        `• ${t(lang, "purchase.rpt_receiving_port", "Destination / Receiving Port")}: ${form.receivingPort || form.receivedPort || form.receivedBorder || form.destinationAirportName || "N/A"} (${form.receivingCountry || form.receivedCountry || "N/A"})\n` +
        `• ${t(lang, "purchase.rpt_receiving_date", "Expected Receiving Date / ETA")}: ${form.receivingDate || form.receivedDate || form.eta || "N/A"}\n` +
        `• ${t(lang, "purchase.rpt_container_info", "Container / Vessel / BL")}: Container: ${form.containerNumbers || "N/A"} (${form.containerSize || "N/A"}) | Vessel: ${form.vesselName || "N/A"} | BL No: ${form.blNo || form.billOfLadingNo || "N/A"}\n\n` +
        `=== ${t(lang, "purchase.rpt_additional_remarks", "ADDITIONAL REMARKS & INSTRUCTIONS")} ===\n`;
    } else if (type === "goods") {
      name = t(lang, "purchase.rpt_goods_title", "Goods Specification & Cargo Weight Report");
      description = t(lang, "purchase.rpt_goods_desc", "Summary of items, quantities, gross weight, net weight & total value");
      
      const itemsList = goodsEntries.map((g, idx) => {
        const qtyNo = Number(g.qtyNo || 0);
        const qtyKgs = Number(g.qtyKgs || 0);
        const emptyKgs = Number(g.emptyKgs || 0);
        const gross = qtyNo * qtyKgs;
        const net = qtyNo * (qtyKgs - emptyKgs);
        return `  ${idx + 1}. ${g.goodsName || "N/A"} | Grade: ${g.size || "N/A"} | Brand: ${g.brand || g.allotName || "N/A"} | Qty: ${qtyNo.toLocaleString()} ${g.qtyName || "Bags"} | Gross: ${gross.toLocaleString()} KG | Net: ${net.toLocaleString()} KG | Rate: ${g.coursePrice || 0} | Amount: ${Number(g.totalAmount || 0).toLocaleString()}`;
      }).join("\n");

      notes = `=== ${t(lang, "purchase.rpt_goods_header", "GOODS & CARGO WEIGHT SPECIFICATION")} ===\n` +
        `• ${t(lang, "purchase.rpt_total_items", "Total Goods Lots")}: ${goodsEntries.length} Item(s)\n` +
        `• ${t(lang, "purchase.rpt_total_qty", "Total Quantity")}: ${Number(reportTotals.totalQty || 0).toLocaleString()} ${goodsEntries[0]?.qtyName || "Units"}\n` +
        `• ${t(lang, "purchase.rpt_total_gross", "Total Gross Weight")}: ${Number(reportTotals.totalGross || 0).toLocaleString()} KGS\n` +
        `• ${t(lang, "purchase.rpt_total_net", "Total Net Weight")}: ${Number(reportTotals.totalNet || 0).toLocaleString()} KGS\n` +
        `• ${t(lang, "purchase.rpt_total_empty", "Total Deductions (Empty)")}: ${Number(reportTotals.totalDeductions || 0).toLocaleString()} KGS\n` +
        `• ${t(lang, "purchase.rpt_grand_total", "Grand Total Value")}: ${form.currencyType || "USD"} ${Number(reportTotals.grandPrimaryFinal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} (${form.secondaryCurrency || "AED"} ${Number(reportTotals.grandFinal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})\n\n` +
        `--- ${t(lang, "purchase.rpt_items_breakdown", "Items Breakdown")} ---\n${itemsList || "  No items entered yet."}\n\n` +
        `=== ${t(lang, "purchase.rpt_additional_remarks", "ADDITIONAL REMARKS & INSTRUCTIONS")} ===\n`;
    } else {
      name = "";
      description = "";
      notes = "";
    }

    setNewReportForm({ name, description, notes });
  };

  const handleOpenNewReportModal = () => {
    setIsNewReportModalOpen(true);
    handleSelectReportTemplate("payment");
  };

  const handleNewReportSubmit = (e) => {
    e.preventDefault();
    if (!newReportForm.name.trim()) {
      alert(t(lang, "purchase.report_name_required", "Report name is required."));
      return;
    }
    const newReport = {
      id: crypto.randomUUID(),
      name: newReportForm.name,
      description: newReportForm.description,
      notes: newReportForm.notes,
      templateType: selectedReportTemplate,
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
    if (!window.confirm(t(lang, "purchase.confirm_delete_report", "Are you sure you want to delete this report?"))) return;
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
    <div id="wizard-root-print" dir={isRtl ? "rtl" : "ltr"} className="space-y-2 text-foreground bg-background mt-[-10px] max-w-[1500px] mx-auto">
      {draftPrefillRef && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          {t(lang, "dintake.wizard_prefilled", "Pre-filled from reviewed document draft")} — {draftPrefillRef}. {t(lang, "dintake.wizard_prefilled_hint", "Review every field, then save and post as usual.")}
        </div>
      )}
      {isSuperAdmin && (!form.countryId || !form.countryBranchId || !scopeConfirmed) && (
        <SimpleModal
          isOpen={true}
          onClose={() => {}} // Cannot close without selecting
          title={t(lang, "purchase.working_scope_title", "Super Admin: Select Working Scope")}
          width="sm"
        >
          <div className="space-y-4 p-2">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase text-indigo-600 dark:text-indigo-400 block leading-tight">SUPER ADMIN CONTROL</span>
                <p className="text-xs text-muted-foreground font-medium">
                  {t(lang, "purchase.working_scope_desc", "Select Country, Main Branch, and City Branch scope.")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t(lang, "purchase.f_country", "Country")}</label>
                <select
                  value={form.countryId || ""}
                  onChange={(e) => {
                    const cId = e.target.value;
                    const country = (scopeCountries || []).find(c => c.id === cId);
                    setForm(p => ({
                      ...p,
                      countryId: cId,
                      countryBranchId: "",
                      cityBranchId: "",
                      branchCountry: country?.name || p.branchCountry,
                      purchaseCurrency: country ? (country.currency_code || country.currencyCode || "USD") : p.purchaseCurrency,
                      secondaryCurrency: country ? (country.currency_code || country.currencyCode || "USD") : p.secondaryCurrency,
                      paymentCurrency: country ? (country.currency_code || country.currencyCode || "USD") : p.paymentCurrency
                    }));
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition"
                >
                  <option value="">{t(lang, "purchase.select_country_ellipsis", "Select Country...")}</option>
                  {(scopeCountries || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.currency_code || c.currencyCode || "USD"})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t(lang, "purchase.f_branch", "Branch")}</label>
                <select
                  value={form.countryBranchId || ""}
                  onChange={(e) => {
                    const bId = e.target.value;
                    const branch = (mainBranches || []).find(b => b.id === bId);
                    setForm(p => ({
                      ...p,
                      countryBranchId: bId,
                      cityBranchId: "",
                      branchName: branch?.name || p.branchName,
                      branchCode: branch?.code || p.branchCode,
                      branchCity: branch?.cityName || branch?.city_name || p.branchCity
                    }));
                  }}
                  disabled={!form.countryId}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition disabled:opacity-50"
                >
                  <option value="">{t(lang, "purchase.select_branch_ellipsis", "Select Branch...")}</option>
                  {(mainBranches || []).map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t(lang, "branch.city_label", "City Branch")}</label>
                <select
                  value={form.cityBranchId || ""}
                  onChange={(e) => {
                    const cbId = e.target.value;
                    const cb = (cityBranches || []).find(b => b.id === cbId);
                    setForm(p => ({
                      ...p,
                      cityBranchId: cbId,
                      branchName: cb ? (cb.city_name || cb.name) : p.branchName,
                      branchCode: cb ? (cb.code || cb.branch_code) : p.branchCode,
                      branchCity: cb ? (cb.city_name || cb.name) : p.branchCity
                    }));
                  }}
                  disabled={!form.countryBranchId}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition disabled:opacity-50"
                >
                  <option value="">{t(lang, "purchase.select_city_branch_ellipsis", "Select City Branch...")}</option>
                  {(cityBranches || []).map((b) => (
                    <option key={b.id} value={b.id}>{b.city_name || b.name} ({b.code || b.branch_code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <Button
                type="button"
                onClick={() => setScopeConfirmed(true)}
                disabled={!form.countryId || !form.countryBranchId}
                className="bg-primary text-primary-foreground font-bold h-9 text-xs px-5 rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {t(lang, "purchase.confirm_scope", "Confirm Scope")} &rarr;
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}
      {isTransferred ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="space-y-1">
            <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20">
              {t(lang, "purchase.posted_voucher_registration", "POSTED VOUCHER REGISTRATION")}
            </span>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
              {t(lang, "purchase.voucher_registered_success", "Voucher JV-{no} Successfully Registered").replace("{no}", (transferredData?.purchaseOrderNo || form.purchaseOrderNo).slice(-6))}
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              {t(lang, "purchase.transferred_to_payment_notice", "The purchase booking has been successfully transferred to payment records and logged into the accounts ledger database.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleReset}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl shadow-md transition-all border-none font-bold"
            >
              + {t(lang, "purchase.dd_new_booking", "New Booking")}
            </Button>
            <Button
              type="button"
              onClick={handleTransfer}
              disabled={savingOrder || isTransferred}
              className="font-bold text-[10px] h-8 px-6 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingOrder ? t(lang, "common.saving", "Saving...") : isTransferred ? t(lang, "purchase.status_transferred", "Transferred") : t(lang, "purchase.save_transfer_to_journal", "Save & Transfer to Journal")}
            </Button>
            <Button
              type="button"
              onClick={handleTransferEmpty}
              disabled={savingOrder || isTransferred}
              className="font-bold text-[10px] h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {savingOrder ? t(lang, "common.saving", "Saving...") : isTransferred ? t(lang, "purchase.status_transferred", "Transferred") : t(lang, "purchase.transfer_to_payment_form_empty", "Transfer to Payment Form (Empty)")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full">
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
                  {savingOrder ? t(lang, "purchase.accepting", "ACCEPTING...") : t(lang, "purchase.accept_booking", "ACCEPT BOOKING")}
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
                    <CheckCircle2 className="h-4 w-4"/> {t(lang, "purchase.transfer_to_payment_caps", "TRANSFER TO PAYMENT")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t(lang, "purchase.confirm_transfer_empty_prompt", "Transfer to Payment Module and go to empty form?"))) {
                        handleTransferEmpty();
                      }
                    }}
                    disabled={savingOrder}
                    className="h-10 text-[11px] font-black tracking-wider uppercase px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <CheckCircle2 className="h-4 w-4"/> {t(lang, "purchase.transfer_to_payment_empty_caps", "TRANSFER TO PAYMENT (EMPTY FORM)")}
                  </Button>
                </div>
              )}
            </>,
            document.getElementById("erp-page-actions-slot")
          )}

          {activeTab !== "report" && (
            activeTab === "reports_tab" ? (
              <div className="w-full mt-4 animate-in fade-in duration-300">
                <div className="mx-auto w-full max-w-[1180px] space-y-6 print:max-w-none">
                  {/* Step 4 Top Header Banner */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{t(lang, "purchase.step4_of5", "Step 4 of 5")}</span>
                          <span className="text-[10px] font-semibold text-slate-400">{t(lang, "purchase.documentation_audit", "Documentation & Audit")}</span>
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mt-0.5">{t(lang, "purchase.step4_title", "Step 4: Review Reports & Notes")}</h2>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                          {t(lang, "purchase.step4_verify_subtitle", "Verify printable document sections, account postings, goods manifest, payment terms, and loading schedules before final verification.")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTab("others")}
                        className="font-bold text-xs h-9 px-4 border-slate-200 hover:bg-slate-50 text-slate-700"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" /> {t(lang, "common.back", "Back")}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setActiveTab("report")}
                        className="font-bold text-xs h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all flex items-center gap-1.5"
                      >
                        {t(lang, "purchase.next_step5_verify_print", "Next: Step 5 (Verify & Print)")} <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Global Info Cards aligned with report width */}
                  {renderGlobalInfoCards()}

                  {/* Step 4 Sub-Tabs / View Mode Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setStep4ViewMode("overview")}
                      className={`flex items-center justify-between p-3.5 rounded-xl text-left transition-all duration-200 ${
                        step4ViewMode === "overview"
                          ? "bg-white shadow-md border-2 border-blue-600 text-slate-950 ring-2 ring-blue-500/20"
                          : "hover:bg-white/70 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl transition-colors ${step4ViewMode === "overview" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-200 text-slate-600"}`}>
                          <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Option 1</span>
                            <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">{t(lang, "purchase.opt1_overview_title", "Booking Overview & Goods Manifest")}</h4>
                          </div>
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{t(lang, "purchase.opt1_overview_desc", "Booking header, accounts routing (DR/CR), user data, and full goods items manifest.")}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">{goodsEntries.length} {t(lang, "purchase.f_total_items", "Items")}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep4ViewMode("reports")}
                      className={`flex items-center justify-between p-3.5 rounded-xl text-left transition-all duration-200 ${
                        step4ViewMode === "reports"
                          ? "bg-white shadow-md border-2 border-blue-600 text-slate-950 ring-2 ring-blue-500/20"
                          : "hover:bg-white/70 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl transition-colors ${step4ViewMode === "reports" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-200 text-slate-600"}`}>
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Option 2</span>
                            <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">{t(lang, "purchase.opt2_reports_title", "Reports, Notes & Dynamic Attachments")}</h4>
                          </div>
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{t(lang, "purchase.opt2_reports_desc", "Payment terms report, loading & transit report, booking remarks, and custom reports.")}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black font-mono text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">{reportsList.length + 2} {t(lang, "purchase.reports_count_label", "Reports")}</span>
                      </div>
                    </button>
                  </div>

                  {/* Complete Report Summary Container */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.28em] text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                            {step4ViewMode === "overview" ? "Option 1: Manifest View" : "Option 2: Reports View"}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-400">{t(lang, "purchase.professional_printable_report", "Professional Printable Report")}</span>
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-[0.08em] text-slate-950 mt-1">
                          {step4ViewMode === "overview" 
                            ? t(lang, "purchase.opt1_summary_heading", "Purchase Booking Manifest & Accounts Summary")
                            : t(lang, "purchase.opt2_summary_heading", "Purchase Booking Reports & Documentation")
                          }
                        </h2>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                          {step4ViewMode === "overview"
                            ? t(lang, "purchase.opt1_summary_subheading", "Booking header, supplier/customer accounts, branch information, and complete itemized goods manifest.")
                            : t(lang, "purchase.opt2_summary_subheading", "Payment condition notes, shipping route schedule, general transaction remarks, and custom dynamic reports.")
                          }
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-right text-xs font-bold text-slate-600 shadow-xs">
                        <div className="text-[10px] uppercase text-slate-400">{t(lang, "purchase.po_number", "PO Number")}</div>
                        <div className="text-sm font-black text-slate-950 font-mono">{form.purchaseOrderNo || "-"}</div>
                        <div className="text-[9px] text-slate-400 font-normal mt-0.5">{t(lang, "purchase.generated_label", "Generated:")} {new Date().toLocaleString()}</div>
                      </div>
                    </div>

                    {/* ================= OPTION 1: BOOKING OVERVIEW & MANIFEST ================= */}
                    {step4ViewMode === "overview" && (
                      <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-5">
                          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="bg-slate-950 text-white px-5 py-3.5 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[9px] uppercase tracking-[0.24em] text-slate-300 font-black">{t(lang, "purchase.booking_header", "Purchase Booking Header")}</p>
                                <h3 className="text-lg font-black tracking-wide">{form.purchaseOrderNo || t(lang, "purchase.booking_default_title", "Purchase Booking")}</h3>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${isTransferred ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/30" : "bg-amber-400/20 text-amber-100 border border-amber-300/30"}`}>
                                {isTransferred ? t(lang, "purchase.status_transferred", "Transferred") : t(lang, "purchase.status_pending_transfer", "Pending Transfer")}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 text-xs">
                              {[
                                [t(lang, "purchase.f_purchase_order_no", "Purchase Order No."), form.purchaseOrderNo || "-"],
                                [t(lang, "purchase.f_system_bill_no", "System Bill No."), form.billNo || "-"],
                                [t(lang, "purchase.f_manual_bill_no", "Manual Bill No."), form.manualBillNo || form.purchaseContractNo || "-"],
                                [t(lang, "purchase.f_booking_date", "Booking Date"), form.purchaseDate || "-"],
                                [t(lang, "purchase.f_contract_no", "Contract No."), form.purchaseContractNo || "-"],
                                [t(lang, "purchase.f_country", "Country"), form.branchCountry || form.originCountry || "-"],
                                [t(lang, "purchase.f_branch", "Branch"), form.branchName || "-"],
                                [t(lang, "purchase.f_currency", "Currency"), form.purchaseCurrency || form.secondaryCurrency || form.currencyType || "-"],
                              ].map(([label, value]) => (
                                <div key={label} className="border-b border-r border-slate-100 p-3 last:border-r-0 hover:bg-slate-50/60 transition-colors">
                                  <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{label}</span>
                                  <span className="font-bold text-slate-900 break-words">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl border border-amber-200 bg-amber-50/70 shadow-xs p-5 flex flex-col justify-center space-y-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0" />
                              <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">{t(lang, "purchase.pending_transfer_status_title", "Pending Transfer Status")}</h3>
                            </div>
                            <p className="text-xs leading-relaxed font-medium text-amber-800">
                              {t(lang, "purchase.pending_transfer_notice", "This Purchase Booking is saved as booking data only. No Roznamcha, Journal, Ledger, Cash Entry, Advance Payment, Debit, or Credit posting is created at this stage. Accounting starts only after Transfer to Payment and final payment save.")}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          {[
                            [t(lang, "purchase.purchase_account_report", "Purchase Account Report"), ArrowDownLeft, t(lang, "purchase.dr_debit", "DR (DEBIT)"), [
                              [t(lang, "purchase.f_account_code", "Account Code"), form.purchaseAccountNo || "-"],
                              [t(lang, "purchase.f_manual_account_no", "Manual Account No"), form.purchaseAccountManualReferenceNumber || "-"],
                              [t(lang, "purchase.f_account_name", "Account Name"), localizeBiz(form, lang, "purchaseAccountName", form.purchaseAccountName || "-")],
                              [t(lang, "purchase.f_company", "Company"), form.purchaseCompanyName || "-"],
                              [t(lang, "purchase.f_contact_person", "Contact Person"), supplierDetail?.contact_person || supplierDetail?.customer_name || "-"],
                              [t(lang, "purchase.f_mobile_number", "Mobile Number"), form.purchaseAccountMobile || supplierDetail?.mobile || "-"],
                              [t(lang, "purchase.f_phone_number", "Phone Number"), supplierDetail?.phone || form.purchaseAccountWhatsapp || "-"],
                              [t(lang, "purchase.f_email", "Email"), supplierDetail?.email || "-"],
                              [t(lang, "purchase.f_address", "Address"), supplierDetail?.address || "-"],
                              [t(lang, "purchase.f_tax_ntn_gst", "Tax / NTN / GST"), supplierDetail?.tax_number || supplierDetail?.ntn || supplierDetail?.gst_number || "-"],
                            ]],
                            [t(lang, "purchase.sales_account_report", "Sales Account Report"), ArrowUpRight, t(lang, "purchase.cr_credit", "CR (CREDIT)"), [
                              [t(lang, "purchase.f_account_code", "Account Code"), form.salesAccountNo || "-"],
                              [t(lang, "purchase.f_manual_account_no", "Manual Account No"), form.salesAccountManualReferenceNumber || "-"],
                              [t(lang, "purchase.f_account_name", "Account Name"), localizeBiz(form, lang, "salesAccountName", form.salesAccountName || "-")],
                              [t(lang, "purchase.f_company", "Company"), form.salesCompanyName || "-"],
                              [t(lang, "purchase.f_contact_person", "Contact Person"), customerDetail?.contact_person || customerDetail?.customer_name || "-"],
                              [t(lang, "purchase.f_mobile_number", "Mobile Number"), form.salesAccountMobile || customerDetail?.mobile || "-"],
                              [t(lang, "purchase.f_phone_number", "Phone Number"), customerDetail?.phone || customerDetail?.whatsapp || "-"],
                              [t(lang, "purchase.f_email", "Email"), customerDetail?.email || "-"],
                              [t(lang, "purchase.f_address", "Address"), customerDetail?.address || "-"],
                              [t(lang, "purchase.f_tax_ntn_gst", "Tax / NTN / GST"), customerDetail?.tax_number || customerDetail?.ntn || customerDetail?.gst_number || "-"],
                            ]]
                          ].map(([title, Icon, badge, rows]) => (
                            <div key={title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                              <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-white">
                                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Icon className="h-4 w-4 text-blue-400" /> {title}</h3>
                                <span className="rounded-md bg-white/10 px-2.5 py-1 text-[9px] font-black tracking-wide">{badge}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 text-xs">
                                {rows.map(([label, value]) => (
                                  <div key={label} className="border-b border-r border-slate-100 p-3 last:border-r-0 hover:bg-slate-50/50 transition-colors">
                                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{label}</span>
                                    <span className="font-bold text-slate-900 break-words">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-4 md:p-5 space-y-3">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.user_branch_info", "User & Branch Information")}
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3 text-xs">
                            {[
                              [t(lang, "purchase.f_user_id", "User ID"), activeSession?.userId || activeSession?.id || "-"],
                              [t(lang, "purchase.f_user_name", "User Name"), activeSession?.name || activeSession?.fullName || form.userName || "Admin"],
                              [t(lang, "purchase.f_team", "Team"), activeSession?.team || t(lang, "purchase.accounts_team_default", "Accounts Team")],
                              [t(lang, "purchase.f_role", "Role"), (activeSession?.roles?.[0] || activeSession?.scopes?.roles?.[0] || "User").replace(/_/g, " ")],
                              [t(lang, "purchase.f_branch", "Branch"), form.branchName || "-"],
                              [t(lang, "purchase.f_country", "Country"), form.branchCountry || "-"],
                              [t(lang, "purchase.f_date_time", "Date & Time"), `${form.purchaseDate || "-"} ${new Date().toLocaleTimeString()}`],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 hover:border-slate-300 transition-colors">
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{label}</span>
                                <span className="font-bold text-slate-900 break-words">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Goods Table Read-Only View */}
                        <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-white shadow-xs">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                            <ListChecks className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.goods_overview_manifest", "Goods Overview Manifest")}
                          </h3>
                          <div className="overflow-x-auto custom-scrollbar pb-2">
                            <table className="w-full min-w-[1000px] text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                                  <Th className="px-3 py-2.5 text-left font-bold">{t(lang, "purchase.th_goods_name", "Goods Name")}</Th>
                                  <Th className="px-3 py-2.5 text-center font-bold">{t(lang, "purchase.th_hs_code", "HS Code")}</Th>
                                  <Th className="px-3 py-2.5 text-center font-bold">{t(lang, "purchase.th_brand", "Brand")}</Th>
                                  <Th className="px-3 py-2.5 text-center font-bold">{t(lang, "purchase.th_size", "Size")}</Th>
                                  <Th className="px-3 py-2.5 text-center font-bold">{t(lang, "purchase.th_origin", "Origin")}</Th>
                                  <Th className="px-3 py-2.5 text-right font-bold">{t(lang, "purchase.th_quantity", "Quantity")}</Th>
                                  <Th className="px-3 py-2.5 text-center font-bold">{t(lang, "purchase.th_unit", "Unit")}</Th>
                                  <Th className="px-3 py-2.5 text-right font-bold">{t(lang, "purchase.th_gross_wt", "Gross Wt")}</Th>
                                  <Th className="px-3 py-2.5 text-right font-bold">{t(lang, "purchase.th_net_wt", "Net Wt")}</Th>
                                  <Th className="px-3 py-2.5 text-right font-bold">{t(lang, "purchase.th_price", "Price")}</Th>
                                  <Th className="px-3 py-2.5 text-right font-bold">{t(lang, "purchase.th_ex_rate", "Ex. Rate")}</Th>
                                  <Th className="px-3 py-2.5 text-right font-bold">{t(lang, "purchase.th_amount", "Amount")} ({form.currencyType || "USD"})</Th>
                                  <Th className="px-3 py-2.5 text-right font-bold text-emerald-800 bg-emerald-50/50">{t(lang, "purchase.th_final", "Final")} ({form.secondaryCurrency || "PKR"})</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {goodsEntries.length === 0 ? (
                                  <tr><td colSpan={13} className="px-3 py-6 text-center text-slate-400 italic">{t(lang, "purchase.no_goods_added", "No goods added yet.")}</td></tr>
                                ) : (
                                  goodsEntries.map((g, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                      <td className="px-3 py-2.5 font-bold text-slate-800">{g.goodsName || "-"}</td>
                                      <td className="px-3 py-2.5 text-center text-slate-600 font-mono">{g.hsCode || "-"}</td>
                                      <td className="px-3 py-2.5 text-center text-slate-600">{g.brand || "-"}</td>
                                      <td className="px-3 py-2.5 text-center text-slate-600">{g.size || g.sizeSpec || "-"}</td>
                                      <td className="px-3 py-2.5 text-center text-slate-600">{g.origin || form.origin || "-"}</td>
                                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">{Number(g.qtyNo || 0).toLocaleString()}</td>
                                      <td className="px-3 py-2.5 text-center text-slate-600">{g.qtyName || g.unit || "-"}</td>
                                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">{Number(g.grossWeight || (Number(g.qtyNo || 0) * Number(g.qtyKgs || 0)) || 0).toLocaleString()}</td>
                                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">{Number(g.netWeight || (Number(g.qtyNo || 0) * (Number(g.qtyKgs || 0) - Number(g.emptyKgs || 0))) || 0).toLocaleString()}</td>
                                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">{Number(g.coursePrice || g.price || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">{Number(g.exchangeRate || form.exchangeRate || 1).toLocaleString()}</td>
                                      <td className="px-3 py-2.5 text-right font-mono text-slate-800 font-bold">{Number(g.totalAmount || g.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">{Number(g.finalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs mt-4">
                            {[[t(lang, "purchase.f_total_quantity", "Total Quantity"), goodsEntries.reduce((sum, g) => sum + Number(g.qtyNo || 0), 0).toLocaleString()], [t(lang, "purchase.f_total_gross_weight", "Total Gross Weight"), goodsEntries.reduce((sum, g) => sum + Number(g.grossWeight || (Number(g.qtyNo || 0) * Number(g.qtyKgs || 0)) || 0), 0).toLocaleString()], [t(lang, "purchase.f_total_net_weight", "Total Net Weight"), goodsEntries.reduce((sum, g) => sum + Number(g.netWeight || (Number(g.qtyNo || 0) * (Number(g.qtyKgs || 0) - Number(g.emptyKgs || 0))) || 0), 0).toLocaleString()], [t(lang, "purchase.f_origin_country", "Origin Country"), form.origin || goodsEntries[0]?.origin || "-"], [t(lang, "purchase.f_total_items", "Total Items"), goodsEntries.length.toLocaleString()]].map(([label, value]) => (
                              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{label}</span>
                                <span className="font-black text-slate-900">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ================= OPTION 2: REPORTS & ATTACHMENTS ================= */}
                    {step4ViewMode === "reports" && (
                      <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="space-y-6 w-full animate-in fade-in duration-200">
                        {/* Payment Details & Report */}
                        <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-white shadow-xs">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.report1_title", "Report 1: Payment Details & Notes")}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-xs space-y-2.5">
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_payment_type", "Payment Type:")}</span> <span className="font-bold text-slate-800">{form.paymentType ? translateOptionLabel(lang, form.paymentType) : "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_payment_terms", "Payment Terms:")}</span> <span className="font-bold text-slate-800 text-right">{form.paymentCondition || form.paymentTerms || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_currency_colon", "Currency:")}</span> <span className="font-bold text-slate-800">{form.purchaseCurrency || form.currencyType || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_exchange_rate", "Exchange Rate:")}</span> <span className="font-bold text-slate-800">{goodsEntries[0]?.exchangeRate || form.exchangeRate || 1}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_bank", "Bank:")}</span> <span className="font-bold text-slate-800 text-right">{form.bankName || form.paymentBank || form.cashBankName || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_payment_method", "Payment Method:")}</span> <span className="font-bold text-slate-800 text-right">{form.paymentDaysAndMethodDetails || form.paymentMethod || form.paymentType || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_payment_status", "Payment Status:")}</span> <span className="font-bold text-amber-700">{isTransferred ? t(lang, "purchase.status_transferred", "Transferred") : t(lang, "purchase.status_pending_transfer", "Pending Transfer")}</span></div>

                              <div className="flex justify-between border-t border-slate-200 pt-2">
                                <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_advance_percent", "Advance ({pct}%):").replace("{pct}", form.advancePercent || 0)}<br/><span className="text-[9px] text-slate-400">{t(lang, "purchase.f_due_colon", "Due:")} {form.advancePaymentDate || "-"}</span></span>
                                <span className="font-bold text-slate-800 text-right">
                                  <span className="block text-emerald-700 font-mono">{form.currencyType || "USD"} {((reportTotals.grandPrimaryFinal || reportTotals.grandFinal || 0) * (form.advancePercent || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="block text-blue-600 mt-0.5 font-mono">{form.purchaseCurrency || "AED"} {((reportTotals.grandFinal || 0) * (form.advancePercent || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] text-slate-400 font-mono">(@ {goodsEntries[0]?.exchangeRate || form.exchangeRate || 1})</span></span>
                                </span>
                              </div>

                              <div className="flex justify-between border-t border-slate-200 pt-2">
                                <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_remaining_percent", "Remaining ({pct}%):").replace("{pct}", 100 - (form.advancePercent || 0))}<br/><span className="text-[9px] text-slate-400">{t(lang, "purchase.f_due_colon", "Due:")} {form.paymentDate || "-"}</span></span>
                                <span className="font-bold text-slate-800 text-right">
                                  <span className="block text-emerald-700 font-mono">{form.currencyType || "USD"} {((reportTotals.grandPrimaryFinal || reportTotals.grandFinal || 0) * (100 - (form.advancePercent || 0)) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="block text-blue-600 mt-0.5 font-mono">{form.purchaseCurrency || "AED"} {((reportTotals.grandFinal || 0) * (100 - (form.advancePercent || 0)) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] text-slate-400 font-mono">(@ {goodsEntries[0]?.exchangeRate || form.exchangeRate || 1})</span></span>
                                </span>
                              </div>

                              <div className="flex justify-between border-t border-slate-200 pt-2">
                                <span className="text-slate-700 font-black">{t(lang, "purchase.f_grand_total", "Grand Total:")}</span>
                                <span className="font-bold text-right">
                                  <span className="block text-emerald-700 font-mono font-black">{form.currencyType || "USD"} {(reportTotals.grandPrimaryFinal || reportTotals.grandFinal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="block text-blue-600 mt-0.5 font-mono font-black">{form.purchaseCurrency || "AED"} {(reportTotals.grandFinal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t(lang, "purchase.payment_report_notes_label", "Payment Report / Notes")}</label>
                              <textarea
                                rows={8}
                                value={form.paymentReport || ""}
                                onChange={(e) => setValue("paymentReport", e.target.value)}
                                className="w-full flex-1 bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:bg-white resize-none text-xs leading-relaxed"
                                placeholder={t(lang, "purchase.payment_notes_placeholder", "Write notes regarding payment terms, conditions, guarantees, or special payment instructions...")}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Loading Details & Report */}
                        <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-white shadow-xs">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                            <Truck className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.report2_title", "Report 2: Loading & Transit Details")}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-xs space-y-2">
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_shipping_mode", "Shipping Mode:")}</span> <span className="font-bold text-slate-800">{form.shippingMode ? translateOptionLabel(lang, form.shippingMode) : "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_shipping_line", "Shipping Line:")}</span> <span className="font-bold text-slate-800 text-right">{form.shippingLine || form.shippingCompany || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_loading_from", "Loading From:")}</span> <span className="font-bold text-slate-800">{form.loadingPort || form.loadingBorder || form.airportName || "N/A"} ({form.origin || "N/A"})</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_destination", "Destination:")}</span> <span className="font-bold text-slate-800">{form.receivedPort || form.receivedBorder || form.receivedPortName || "N/A"} ({form.receivedCountry || "N/A"})</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_loading_date", "Loading Date:")}</span> <span className="font-bold text-slate-800">{form.loadingDate || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_receiving_date", "Receiving Date:")}</span> <span className="font-bold text-slate-800">{form.receivingDate || form.receivedDate || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_container_no", "Container No:")}</span> <span className="font-bold text-slate-800 text-right font-mono">{form.containerNumbers || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_container_type", "Container Type:")}</span> <span className="font-bold text-slate-800">{form.containerSize ? translateOptionLabel(lang, form.containerSize) : "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_vessel", "Vessel:")}</span> <span className="font-bold text-slate-800 text-right">{form.vesselName || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_bl_no", "BL No:")}</span> <span className="font-bold text-slate-800 text-right font-mono">{form.blNo || form.billOfLadingNo || "N/A"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">{t(lang, "purchase.f_eta_etd", "ETA / ETD:")}</span> <span className="font-bold text-slate-800 text-right">{form.eta || form.etd || form.receivingDate || "N/A"}</span></div>
                            </div>
                            <div className="flex flex-col">
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t(lang, "purchase.loading_report_notes_label", "Loading Report / Notes")}</label>
                              <textarea
                                rows={8}
                                value={form.loadingReport || ""}
                                onChange={(e) => setValue("loadingReport", e.target.value)}
                                className="w-full flex-1 bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:bg-white resize-none text-xs leading-relaxed"
                                placeholder={t(lang, "purchase.loading_notes_placeholder", "Write notes regarding loading, transit, freight agents, or customs clearance...")}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Booking Remarks & Narration */}
                        <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-white shadow-xs">
                          <div className="border-b border-slate-100 pb-2 mb-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.booking_remarks_narration", "Booking Remarks & Narration")}
                            </h3>
                          </div>
                          <div>
                            <textarea
                              rows={4}
                              value={form.remarks || ""}
                              onChange={(e) => setValue("remarks", e.target.value)}
                              className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:bg-white resize-none text-xs leading-relaxed"
                              placeholder={t(lang, "purchase.remarks_placeholder", "Write general transaction remarks and narration (Visible on Dashboard and Ledger Overview)...")}
                            />
                          </div>
                        </div>

                        {/* Dynamic Reports */}
                        <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-white shadow-xs">
                          <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.dynamic_reports_attachments", "Dynamic Reports & Attachments")}
                            </h3>
                            <Button
                              type="button"
                              onClick={handleOpenNewReportModal}
                              className="h-8 text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 rounded-lg shadow-sm flex items-center gap-1.5"
                            >
                              <FileText className="h-3.5 w-3.5" /> + {t(lang, "purchase.add_new_report_btn", "Add New Report")}
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {reportsList.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground text-xs italic bg-slate-50/80 rounded-xl border border-slate-200/80">
                                {t(lang, "purchase.no_custom_reports", 'No additional custom reports added yet. Click "+ Add New Report" to attach notes.')}
                              </div>
                            ) : (
                              reportsList.map((report) => (
                                <div key={report.id} className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 shadow-xs">
                                  <div className="flex justify-between items-start mb-2 border-b border-slate-200/80 pb-2">
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-900">{report.name}</h4>
                                      {report.description && <p className="text-[10px] text-slate-500 mt-0.5">{report.description}</p>}
                                    </div>
                                    <div className="flex gap-2 items-center">
                                      <span className="text-[9px] font-mono text-slate-400">{new Date(report.createdAt).toLocaleString()}</span>
                                      <button type="button" onClick={() => handleDeleteReport(report.id)} className="text-red-500 hover:text-red-700 p-1" title={t(lang, "purchase.delete_report_title", "Delete Report")}><Trash2 className="h-3.5 w-3.5"/></button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                                    {report.notes}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </fieldset>
                    )}

                    {/* Step 4 Dynamic Footer Navigation */}
                    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                      {step4ViewMode === "overview" ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActiveTab("others")}
                            className="font-bold text-xs h-10 px-6 border-slate-200 text-slate-700 hover:bg-slate-50 w-full sm:w-auto"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1.5" /> {t(lang, "purchase.back_to_step3_others", "Back to Step 3 (Others)")}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setStep4ViewMode("reports");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="font-black text-xs h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 w-full sm:w-auto"
                          >
                            {t(lang, "purchase.proceed_to_opt2_reports", "Proceed to Option 2: Reports & Notes")} <ChevronRight className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setStep4ViewMode("overview");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="font-bold text-xs h-10 px-6 border-slate-200 text-slate-700 hover:bg-slate-50 w-full sm:w-auto"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1.5" /> {t(lang, "purchase.back_to_opt1_overview", "Back to Option 1 (Overview & Manifest)")}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setActiveTab("report");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="font-black text-xs h-10 px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 w-full sm:w-auto"
                          >
                            {t(lang, "purchase.proceed_step5_final_review", "Proceed to Step 5: Final Review & Verify")} <ChevronRight className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "others" ? (
              <div className="w-full mt-4 space-y-4 animate-in fade-in duration-200">
                {/* Global Info Cards at top */}
                {renderGlobalInfoCards()}

                {/* Step 3 Form: Spacious 2-Column Layout */}
                <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="space-y-4 w-full">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                    {/* LEFT COLUMN: Shipping & Location + Destination Branch */}
                    <div className="space-y-4">
                      {/* SECTION 1: SHIPPING & LOCATION */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                              <Globe2 className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">{t(lang, "purchase.shipping_location_title", "Shipping & Location")}</h4>
                              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{t(lang, "purchase.shipping_location_subtitle", "Essential route information only: country, port, mode and dates.")}</p>
                            </div>
                          </div>
                          <label className="min-w-[150px] space-y-1">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">{t(lang, "purchase.shipping_mode_label", "Shipping Mode")}</span>
                            <select
                              value={form.shippingMode || "By Sea"}
                              onChange={(e) => {
                                const mode = e.target.value;
                                setValue("shippingMode", mode);
                                setValue("shipmentType", mode === "By Sea" ? "By Ship" : mode);
                              }}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                              {LOADING_TYPES.map((type) => <option key={type} value={type}>{translateOptionLabel(lang, type)}</option>)}
                            </select>
                          </label>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/10">
                            <div className="mb-3 flex items-center justify-between gap-2 border-b border-amber-100 pb-2 dark:border-amber-900/40">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t(lang, "purchase.loading_departure_title", "Loading / Departure")}</h5>
                              </div>
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">1. Country → 2. Port → 3. Date</span>
                            </div>
                            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t(lang, "purchase.loading_country_label", "1. Loading Country")}</span>
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
                                  placeholder={t(lang, "purchase.select_country_placeholder", "Select Country")}
                                  addOptionLabel={t(lang, "purchase.add_new_country_label", "Add New Country")}
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t(lang, "purchase.loading_port_label", "2. Loading Port / Terminal")}</span>
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
                                  placeholder={t(lang, "purchase.select_port_placeholder", "Select Port")}
                                  addOptionLabel={t(lang, "purchase.add_new_port_label", "Add New Port")}
                                  disabled={!form.loadingCountry && currentLoadingPorts.length === 0}
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t(lang, "purchase.loading_date_label", "3. Loading Date")}</span>
                                <input
                                  type="date"
                                  value={form.loadingDate || ""}
                                  onChange={(e) => setValue("loadingDate", e.target.value)}
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                />
                              </label>
                            </div>
                          </div>

                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/10">
                            <div className="mb-3 flex items-center justify-between gap-2 border-b border-emerald-100 pb-2 dark:border-emerald-900/40">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{t(lang, "purchase.receiving_arrival_title", "Receiving / Arrival")}</h5>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">1. Country → 2. Port → 3. Date</span>
                            </div>
                            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t(lang, "purchase.receiving_country_label", "1. Receiving Country")}</span>
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
                                  placeholder={t(lang, "purchase.select_country_placeholder", "Select Country")}
                                  addOptionLabel={t(lang, "purchase.add_new_country_label", "Add New Country")}
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t(lang, "purchase.receiving_port_label", "2. Receiving Port / Terminal")}</span>
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
                                  placeholder={t(lang, "purchase.select_port_placeholder", "Select Port")}
                                  addOptionLabel={t(lang, "purchase.add_new_port_label", "Add New Port")}
                                  disabled={!(form.receivingCountry || form.destinationCountry || form.receivedCountry) && currentReceivedPorts.length === 0}
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t(lang, "purchase.receiving_date_label", "3. Receiving Date")}</span>
                                <input
                                  type="date"
                                  value={form.receivedDate || ""}
                                  onChange={(e) => setValue("receivedDate", e.target.value)}
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Destination Branch (Country-to-Country Purchase) */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="mb-3 flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <Globe2 className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">{t(lang, "purchase.dest_branch_title", "Destination Branch (Country-to-Country Purchase)")}</h4>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{t(lang, "purchase.dest_branch_subtitle", "Optional. Set only when this purchase is being made on behalf of a different country/branch.")}</p>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="space-y-1">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">{t(lang, "purchase.dest_country_label", "Destination Country")}</span>
                            <select
                              value={form.destCountryId || ""}
                              onChange={(e) => setForm(p => ({ ...p, destCountryId: e.target.value, destCountryBranchId: "", destCityBranchId: "" }))}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                              <option value="">{t(lang, "purchase.dest_country_none", "None (same-country purchase)")}</option>
                              {(allCountries.length ? allCountries : countries).map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">{t(lang, "purchase.dest_branch_label", "Destination Main Branch")}</span>
                            <select
                              value={form.destCountryBranchId || ""}
                              onChange={(e) => setForm(p => ({ ...p, destCountryBranchId: e.target.value, destCityBranchId: "" }))}
                              disabled={!form.destCountryId}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                              <option value="">{t(lang, "purchase.select_branch_ellipsis", "Select Branch...")}</option>
                              {destMainBranches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">{t(lang, "branch.city_label", "City Branch")}</span>
                            <select
                              value={form.destCityBranchId || ""}
                              onChange={(e) => setForm(p => ({ ...p, destCityBranchId: e.target.value }))}
                              disabled={!form.destCountryId}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                              <option value="">{t(lang, "purchase.select_city_branch_ellipsis", "Select City Branch...")}</option>
                              {destCityBranches.map((b) => (
                                <option key={b.id} value={b.id}>{b.city_name || b.name} ({b.code || b.branch_code})</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Advance & Payment Terms + Transport & Container Details + Remarks & Narration */}
                    <div className="space-y-4">
                      {/* SECTION 2: ADVANCE & PAYMENT TERMS */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">{t(lang, "purchase.advance_payment_terms_title", "Advance & Payment Terms")}</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">{t(lang, "purchase.payment_type_label", "Payment Type")}</label>
                            <select
                              value={form.paymentType || "Advance Payment"}
                              onChange={(e) => setValue("paymentType", e.target.value)}
                              className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                            >
                              {PAYMENT_TYPES.map((p) => <option key={p} value={p}>{translateOptionLabel(lang, p)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">{t(lang, "purchase.advance_percentage_label", "Advance Percentage (%)")}</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={form.advancePercent ?? ""}
                              onChange={(e) => setValue("advancePercent", e.target.value ? Number(e.target.value) : null)}
                              placeholder={t(lang, "purchase.advance_pct_placeholder", "e.g. 20")}
                              className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">{t(lang, "purchase.advance_payment_date_label", "Advance Payment Date")}</label>
                            <input
                              type="date"
                              value={form.advancePaymentDate || ""}
                              onChange={(e) => setValue("advancePaymentDate", e.target.value)}
                              className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">{t(lang, "purchase.final_payment_date_label", "Final Payment Date")}</label>
                            <input
                              type="date"
                              value={form.paymentDate || ""}
                              onChange={(e) => setValue("paymentDate", e.target.value)}
                              className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECTION 3: TRANSPORT & CONTAINER DETAILS */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                          <Truck className="h-4 w-4 text-blue-600" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">{t(lang, "purchase.transport_container_title", "Transport & Container Details")}</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">{t(lang, "purchase.container_numbers_label", "Container Numbers")}</label>
                            <input
                              type="text"
                              value={form.containerNumbers || ""}
                              onChange={(e) => setValue("containerNumbers", e.target.value)}
                              placeholder={t(lang, "purchase.container_numbers_placeholder", "e.g. ABCU1234567")}
                              className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 font-mono uppercase"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">{t(lang, "purchase.container_size_type_label", "Container Size / Type")}</label>
                            <select
                              value={form.containerSize || ""}
                              onChange={(e) => setValue("containerSize", e.target.value)}
                              className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                            >
                              <option value="">{t(lang, "purchase.select_type_placeholder", "Select Type...")}</option>
                              {CONTAINER_TYPES.map((t2) => <option key={t2} value={t2}>{translateOptionLabel(lang, t2)}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 4: REMARKS & NARRATION */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                          <MessageSquare className="h-4 w-4 text-blue-600" />
                          <label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">{t(lang, "purchase.remarks_narration_title", "Remarks & Narration")}</label>
                        </div>
                        <textarea
                          rows={3}
                          value={form.remarks || ""}
                          onChange={(e) => setValue("remarks", e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 resize-none leading-relaxed"
                          placeholder={t(lang, "purchase.others_remarks_placeholder", "Add any remarks or narration here...")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3 Action Navigation */}
                  <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("goods")}
                      className="font-bold text-xs h-10 px-8 border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1.5" /> {t(lang, "common.back", "Back")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setActiveTab("reports_tab")}
                      className="font-black text-xs h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all uppercase tracking-wider flex items-center gap-2"
                    >
                      {t(lang, "common.next", "Next")} <ChevronRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </div>
                </fieldset>
              </div>
            ) : (
                <div className="w-full space-y-4 animate-in fade-in duration-200 mt-3">
                  {/* ================= TOP COMPANY / COUNTRY CLEARING LEDGER BANNER ================= */}
                  <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                            {form.purchaseCompanyName || form.purchaseAccountName || "United Arab Emirates Main Country Clearing Ledger"}
                          </h2>
                          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
                            ({form.purchaseAccountNo || "UAE-CORP-GEN-001"})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          Business Name: {form.purchaseCompanyName || "UAE Main Country Clearing Ledger"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <span className="text-base">🇦🇪</span>
                        <span className="text-slate-400 font-semibold">Country</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{form.branchCountry || "United Arab Emirates"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span className="text-slate-400 font-semibold">City</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{form.branchCity || "Dubai"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewCompanyModal(true)}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>View Full Company Details</span>
                      </button>
                    </div>
                  </div>

                  {/* ================= MAIN 2-COLUMN WORKSPACE GRID ================= */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start w-full">
                    {/* LEFT COLUMN: Form (Step 1 Booking or Step 2 Goods) */}
                    <div className="lg:col-span-4 space-y-4 w-full">
                      {activeTab === "booking" && (
                        <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4 w-full">
                          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                              {t(lang, "purchase.booking_bill_info_title", "Purchase Booking / Bill Info")}
                            </h3>
                          </div>

                          <div className="space-y-3">
                            {/* Purchase Account (DR) */}
                            <div className="relative" ref={purchaseDropdownRef}>
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.purchase_account_dr_star", "Purchase Account (DR)*")}</label>
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  placeholder={form.purchaseAccountName ? formatAccountDisplayLabel(form.purchaseAccountName, form.purchaseAccountNo, form.purchaseAccountManualReferenceNumber) : t(lang, "purchase.search_code_name_branch", "Search Code, Name, Branch, Manual A/C...")}
                                  value={purchaseDropdownOpen ? purchaseSearch : (form.purchaseAccountName ? formatAccountDisplayLabel(form.purchaseAccountName, form.purchaseAccountNo, form.purchaseAccountManualReferenceNumber) : form.purchaseAccountNo || "")}
                                  onChange={(e) => handleTextChange("purchase", e.target.value)}
                                  onFocus={() => {
                                    setPurchaseDropdownOpen(true);
                                    setPurchasePinDropdownOpen(false);
                                    setPurchaseSearch("");
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-8 py-1.5 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-blue-500 text-xs h-9"
                                />
                                <button
                                  type="button"
                                  disabled={!form.supplierId}
                                  onClick={() => {
                                    setPurchasePinDropdownOpen(prev => !prev);
                                    setPurchaseDropdownOpen(false);
                                  }}
                                  className="absolute right-2 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
                                >
                                  <Pin className={`h-3.5 w-3.5 ${purchasePinDropdownOpen ? "text-blue-600 rotate-45" : ""}`} />
                                </button>
                              </div>

                              {purchaseDropdownOpen && (
                                <div className="absolute left-0 mt-1.5 w-full min-w-[290px] sm:min-w-[440px] md:min-w-[520px] rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500/40 shadow-2xl z-[80] p-2 overflow-hidden backdrop-blur-md">
                                  <div className="flex justify-between items-center px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg mb-1.5 border border-blue-100 dark:border-blue-900">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">{t(lang, "purchase.select_purchase_account_dr_header", "Select Purchase Account (DR)")}</span>
                                    <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                      {t(lang, "purchase.found_count_suffix", "{n} found").replace("{n}", String(dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, purchaseSearch)).length))}
                                    </span>
                                  </div>
                                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                    {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, purchaseSearch)).map((acc) => {
                                      const compName = acc.companyName || acc.company_name || (acc.companyId && dbCompanies.find(c => c.id === acc.companyId)?.name) || dbCompanies[0]?.name || t(lang, "purchase.card_none_label", "None");
                                      return (
                                        <button
                                          key={acc.accountCode}
                                          type="button"
                                          onClick={() => {
                                            applyAccountMaster("purchase", acc);
                                            setPurchaseDropdownOpen(false);
                                            setPurchaseSearch("");
                                          }}
                                          className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition duration-150 group bg-white dark:bg-slate-900 shadow-2xs"
                                        >
                                          <div className="flex flex-wrap justify-between items-start gap-1.5 mb-1.5">
                                            <span className="font-black text-xs text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                                              {acc.accountName || t(lang, "purchase.wiz_unnamed_account", "Unnamed Account")}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-1">
                                              <span className="font-mono text-[9px] font-black bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded">
                                                {acc.accountCode}
                                              </span>
                                              {acc.manualReferenceNumber && (
                                                <span className="font-mono text-[9px] font-black bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 rounded">
                                                  Ref: {acc.manualReferenceNumber}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[9.5px] text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                                            <div>
                                              <span className="font-bold text-slate-700 dark:text-slate-300">{t(lang, "purchase.branch_colon_label", "Branch:")}</span> {acc.cityBranchName || t(lang, "purchase.card_main_branch_fallback", "Main Branch")}
                                            </div>
                                            <div>
                                              <span className="font-bold text-slate-700 dark:text-slate-300">{t(lang, "purchase.curr_colon", "Curr:")}</span> <span className="font-black text-emerald-600 dark:text-emerald-400">{acc.ledgerCurrency || "USD"}</span>
                                            </div>
                                            {acc.contactPerson ? (
                                              <div>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">Owner:</span> <span className="font-bold text-emerald-700 dark:text-emerald-300">👤 {acc.contactPerson}</span>
                                              </div>
                                            ) : (
                                              <div>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{t(lang, "purchase.card_company_colon", "Company:")}</span> <span className="truncate inline-block max-w-[120px] align-bottom font-medium">{compName}</span>
                                              </div>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Sales Account (CR) */}
                            <div className="relative" ref={salesDropdownRef}>
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.sales_account_cr_star", "Sales Account (CR)*")}</label>
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  placeholder={form.salesAccountName ? formatAccountDisplayLabel(form.salesAccountName, form.salesAccountNo, form.salesAccountManualReferenceNumber) : t(lang, "purchase.search_code_name_branch", "Search Code, Name, Branch, Manual A/C...")}
                                  value={salesDropdownOpen ? salesSearch : (form.salesAccountName ? formatAccountDisplayLabel(form.salesAccountName, form.salesAccountNo, form.salesAccountManualReferenceNumber) : form.salesAccountNo || "")}
                                  onChange={(e) => handleTextChange("sales", e.target.value)}
                                  onFocus={() => {
                                    setSalesDropdownOpen(true);
                                    setSalesPinDropdownOpen(false);
                                    setSalesSearch("");
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-8 py-1.5 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-blue-500 text-xs h-9"
                                />
                                <button
                                  type="button"
                                  disabled={!form.customerId}
                                  onClick={() => {
                                    setSalesPinDropdownOpen(prev => !prev);
                                    setSalesDropdownOpen(false);
                                  }}
                                  className="absolute right-2 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
                                >
                                  <Pin className={`h-3.5 w-3.5 ${salesPinDropdownOpen ? "text-blue-600 rotate-45" : ""}`} />
                                </button>
                              </div>

                              {salesDropdownOpen && (
                                <div className="absolute left-0 mt-1.5 w-full min-w-[290px] sm:min-w-[440px] md:min-w-[520px] rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500/40 shadow-2xl z-[80] p-2 overflow-hidden backdrop-blur-md">
                                  <div className="flex justify-between items-center px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg mb-1.5 border border-blue-100 dark:border-blue-900">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">{t(lang, "purchase.select_sales_account_cr_header", "Select Sales Account (CR)")}</span>
                                    <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                      {t(lang, "purchase.found_count_suffix", "{n} found").replace("{n}", String(dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, salesSearch)).length))}
                                    </span>
                                  </div>
                                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                    {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, salesSearch)).map((acc) => {
                                      const compName = acc.companyName || acc.company_name || (acc.companyId && dbCompanies.find(c => c.id === acc.companyId)?.name) || dbCompanies[0]?.name || t(lang, "purchase.card_none_label", "None");
                                      return (
                                        <button
                                          key={acc.accountCode}
                                          type="button"
                                          onClick={() => {
                                            applyAccountMaster("sales", acc);
                                            setSalesDropdownOpen(false);
                                            setSalesSearch("");
                                          }}
                                          className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition duration-150 group bg-white dark:bg-slate-900 shadow-2xs"
                                        >
                                          <div className="flex flex-wrap justify-between items-start gap-1.5 mb-1.5">
                                            <span className="font-black text-xs text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                                              {acc.accountName || t(lang, "purchase.wiz_unnamed_account", "Unnamed Account")}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-1">
                                              <span className="font-mono text-[9px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded">
                                                {acc.accountCode}
                                              </span>
                                              {acc.manualReferenceNumber && (
                                                <span className="font-mono text-[9px] font-black bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 rounded">
                                                  Ref: {acc.manualReferenceNumber}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[9.5px] text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                                            <div>
                                              <span className="font-bold text-slate-700 dark:text-slate-300">{t(lang, "purchase.branch_colon_label", "Branch:")}</span> {acc.cityBranchName || t(lang, "purchase.card_main_branch_fallback", "Main Branch")}
                                            </div>
                                            <div>
                                              <span className="font-bold text-slate-700 dark:text-slate-300">{t(lang, "purchase.curr_colon", "Curr:")}</span> <span className="font-black text-emerald-600 dark:text-emerald-400">{acc.ledgerCurrency || "USD"}</span>
                                            </div>
                                            {acc.contactPerson ? (
                                              <div>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">Owner:</span> <span className="font-bold text-emerald-700 dark:text-emerald-300">👤 {acc.contactPerson}</span>
                                              </div>
                                            ) : (
                                              <div>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{t(lang, "purchase.card_company_colon", "Company:")}</span> <span className="truncate inline-block max-w-[120px] align-bottom font-medium">{compName}</span>
                                              </div>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Contract No */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.contract_no_label", "Contract No")}</label>
                              <input
                                type="text"
                                value={form.purchaseContractNo || "PC-2026-1925"}
                                onChange={(e) => setValue("purchaseContractNo", e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 font-mono font-bold outline-none focus:border-blue-500 text-xs h-9"
                              />
                            </div>

                            {/* Contract / Booking Date */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.contract_booking_date_label", "Contract / Booking Date *")}</label>
                              <input
                                type="date"
                                value={form.purchaseDate || ""}
                                onChange={(e) => setValue("purchaseDate", e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-blue-500 text-xs h-9"
                              />
                            </div>

                            {/* Invoice / Payment Select & Ship Option (2 cols) */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.invoice_payment_select_label", "Invoice / Payment Select")}</label>
                                <select
                                  value={form.paymentType || "Advance Payment"}
                                  onChange={(e) => setValue("paymentType", e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-blue-500 text-xs h-9"
                                >
                                  {PAYMENT_TYPES.map((type) => (
                                    <option key={type} value={type}>{translateOptionLabel(lang, type)}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.ship_option_label", "Ship Option")}</label>
                                <select
                                  value={form.shippingMode || "By Sea"}
                                  onChange={(e) => {
                                    const mode = e.target.value;
                                    setValue("shippingMode", mode);
                                    setValue("shipmentType", mode === "By Sea" ? "By Ship" : mode);
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-blue-500 text-xs h-9"
                                >
                                  {LOADING_TYPES.map((type) => (
                                    <option key={type} value={type}>{translateOptionLabel(lang, type)}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Status */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.status_label_plain", "Status")}</label>
                              <select
                                value={form.salesStatus || "Draft"}
                                onChange={(e) => setValue("salesStatus", e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-blue-500 text-xs h-9"
                              >
                                <option value="Draft">{t(lang, "purchase.opt_draft", "Draft")}</option>
                                <option value="Pending">{t(lang, "purchase.opt_pending", "Pending")}</option>
                                <option value="Confirmed">{t(lang, "purchase.opt_confirmed", "Confirmed")}</option>
                                <option value="Transferred">{t(lang, "purchase.opt_transferred", "Transferred")}</option>
                              </select>
                            </div>

                            {/* Currency & Conversion Configuration */}
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3 space-y-2.5">
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />
                                <span className="text-[10px] font-black uppercase tracking-wider">
                                  {t(lang, "purchase.booking_currency_title", "Booking Currency & Conversion")}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 gap-2 text-[10px]">
                                <div>
                                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    {t(lang, "purchase.purchase_currency", "Purchase Currency (Invoice)")}
                                  </label>
                                  <select
                                    value={form.currencyType || "USD"}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setForm(prev => ({
                                        ...prev,
                                        currencyType: val,
                                        purchaseCurrency: val
                                      }));
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-slate-100 font-bold h-8 text-xs outline-none focus:border-blue-500"
                                  >
                                    {CURRENCY_OPTIONS.map(c => (
                                      <option key={c} value={c}>{c} {c === "USD" ? "($)" : c === "AED" ? "(Dirham)" : ""}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    {t(lang, "purchase.final_currency", "Final / Settlement Currency")}
                                  </label>
                                  <select
                                    value={form.secondaryCurrency || "AED"}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setForm(prev => ({
                                        ...prev,
                                        secondaryCurrency: val,
                                        paymentCurrency: val
                                      }));
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-slate-100 font-bold h-8 text-xs outline-none focus:border-blue-500"
                                  >
                                    {CURRENCY_OPTIONS.map(c => (
                                      <option key={c} value={c}>{c} {c === "AED" ? "(Dirham)" : c === "USD" ? "($ Dollar)" : ""}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    {t(lang, "purchase.exchange_rate", "Exchange Rate")} ({form.currencyType || "USD"} → {form.secondaryCurrency || "AED"})
                                  </label>
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      step="any"
                                      value={form.exchangeRate !== undefined ? form.exchangeRate : 3.6730}
                                      onChange={(e) => setValue("exchangeRate", Number(e.target.value))}
                                      placeholder="3.6730"
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-slate-100 font-mono font-bold h-8 text-xs outline-none focus:border-blue-500"
                                    />
                                    <select
                                      value={form.operator || "*"}
                                      onChange={(e) => setValue("operator", e.target.value)}
                                      className="w-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-xs font-black h-8 outline-none"
                                    >
                                      <option value="*">*</option>
                                      <option value="/">/</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Remarks / Terms */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.booking_remarks_terms_label", "Booking Remarks / Terms")}</label>
                              <textarea
                                rows={2}
                                value={form.remarks || ""}
                                onChange={(e) => setValue("remarks", e.target.value)}
                                placeholder={t(lang, "purchase.booking_remarks_placeholder", "Write booking terms, payment notes, invoice note, or shipping instruction...")}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 text-xs resize-none leading-relaxed"
                              />
                            </div>

                            {/* Primary Next Button (Solid Orange) */}
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => setActiveTab("goods")}
                                className="w-full h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                              >
                                <span>Next</span>
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </fieldset>
                      )}

                      {activeTab === "goods" && (
                        <fieldset disabled={isTransferred && !session?.scopes?.isSuperAdmin} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4 w-full animate-in fade-in duration-200">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-600" />
                              {t(lang, "purchase.goods_entry_title", "GOODS ENTRY")}
                            </h3>
                            <button
                              type="button"
                              onClick={() => setActiveTab("booking")}
                              className="text-[10.5px] font-bold text-slate-500 hover:text-slate-800 underline"
                            >
                              ← Back to Booking
                            </button>
                          </div>

                          <div className="space-y-3">
                            {/* Origin Country */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.f_origin_country", "Origin Country")}</label>
                              <select
                                value={form.origin || ""}
                                onChange={(e) => setValue("origin", e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 text-xs h-9 font-semibold"
                              >
                                <option value="">{t(lang, "purchase.select_origin", "Select Origin")}</option>
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

                            {/* Goods Name */}
                            <div className="relative">
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.goods_name_star", "Goods Name*")}</label>
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
                                placeholder={t(lang, "purchase.select_goods_name", "Select Goods Name")}
                                addOptionLabel={t(lang, "purchase.add_new_goods_item", "Add New Goods Item")}
                              />
                            </div>

                            {/* Size & Brand (2 cols) */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.size_label", "Size")}</label>
                                <SearchableSelect
                                  value={form.size || ""}
                                  onChange={(val) => setValue("size", val)}
                                  options={SIZE_OPTIONS.map(s => ({ label: s, value: s }))}
                                  placeholder={t(lang, "purchase.select_size", "Select Size")}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.brand_label", "Brand")}</label>
                                <SearchableSelect
                                  value={form.brand || ""}
                                  onChange={(val) => setValue("brand", val)}
                                  options={BRAND_OPTIONS.map(b => ({ label: b, value: b }))}
                                  placeholder={t(lang, "purchase.select_brand", "Select Brand")}
                                />
                              </div>
                            </div>

                            {/* Qty & Unit (2 cols) */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.th_qty", "Quantity")}</label>
                                <input
                                  type="number"
                                  value={form.qtyNo || ""}
                                  onChange={(e) => setValue("qtyNo", Number(e.target.value))}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 font-mono font-bold outline-none focus:border-blue-500 text-xs h-9"
                                  placeholder="e.g. 500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "purchase.th_unit", "Unit")}</label>
                                <select
                                  value={form.qtyName || "BAGS"}
                                  onChange={(e) => setValue("qtyName", e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-blue-500 text-xs h-9"
                                >
                                  {QTY_TYPE_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </div>

                            {/* Price */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {t(lang, "purchase.price_rate_c1", "Price Rate")} ({form.currencyType || "USD"})
                              </label>
                              <input
                                type="number"
                                value={form.coursePrice || ""}
                                onChange={(e) => {
                                  setValue("coursePrice", Number(e.target.value));
                                  setValue("manualTotalAmount", "");
                                  setValue("manualFinalAmount", "");
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 font-mono font-bold outline-none focus:border-blue-500 text-xs h-9"
                                placeholder="0.00"
                              />
                            </div>

                            {/* Add / Update Item Button */}
                            <div className="pt-2 flex gap-2">
                              {editingGoodsIndex !== null ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditGoodsEntry}
                                    className="flex-1 h-9 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleUpdateGoodsEntry}
                                    className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-sm"
                                  >
                                    ✓ Update Item
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleAddGoodsEntry}
                                  className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  {t(lang, "purchase.add_item_to_list", "+ Add Item to List")}
                                </button>
                              )}
                            </div>

                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setActiveTab("others")}
                                className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                {t(lang, "purchase.next_other_details", "Next: Other Details →")}
                              </button>
                            </div>
                          </div>
                        </fieldset>
                      )}
                    </div>

                    {/* RIGHT COLUMN: 4 Report Cards (Top) + Purchase Booking Register Table (Bottom) */}
                    <div className="lg:col-span-8 space-y-4 w-full">
                      {/* 4 Report Cards */}
                      {renderGlobalInfoCards()}

                      {/* ================= PURCHASE BOOKING REGISTER CARD ================= */}
                      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
                        {/* Register Header Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                            <h3 className="text-xs font-black tracking-tight text-slate-900 dark:text-slate-100">
                              Purchase Booking Register
                            </h3>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>01/08/2026 → 31/08/2026</span>
                            </div>

                            <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 outline-none">
                              <option>Branch: All Branches</option>
                            </select>

                            <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 outline-none">
                              <option>Status: All Status</option>
                            </select>

                            <div className="relative">
                              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
                              <input
                                type="text"
                                placeholder="Search by Bill No, Contract No, Account..."
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1 text-[11px] text-slate-700 dark:text-slate-300 outline-none w-48 sm:w-56 placeholder:text-slate-400"
                              />
                            </div>

                            <button
                              type="button"
                              className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                              <span>Filters</span>
                            </button>
                          </div>
                        </div>

                        {/* Goods Table */}
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                          <table className="w-full text-[9px] text-slate-800 dark:text-slate-200 border-collapse text-left whitespace-nowrap">
                            <thead>
                              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider">
                                <Th className="px-3 py-2 text-center w-8">#</Th>
                                <Th className="px-3 py-2">GOODS NAME</Th>
                                <Th className="px-3 py-2 text-center">SIZE</Th>
                                <Th className="px-3 py-2 text-center">BRAND</Th>
                                <Th className="px-3 py-2 text-center">HS CODE</Th>
                                <Th className="px-3 py-2 text-center">ORIGIN</Th>
                                <Th className="px-3 py-2 text-right">QTY</Th>
                                <Th className="px-3 py-2 text-center">UNIT</Th>
                                <Th className="px-3 py-2 text-right">PRICE ({form.currencyType || "USD"})</Th>
                                <Th className="px-3 py-2 text-right">AMOUNT ({form.currencyType || "USD"})</Th>
                                <Th className="px-3 py-2 text-center">EX. RATE</Th>
                                <Th className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400 font-black bg-emerald-500/5">FINAL ({form.secondaryCurrency || "AED"})</Th>
                                <Th className="px-3 py-2 text-center w-10">ACTION</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {goodsEntries.length === 0 ? (
                                <tr>
                                  <td colSpan={13} className="px-3 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                        <ShoppingCart className="h-6 w-6" />
                                      </div>
                                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        No goods added yet. Add an item above to see it here.
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                goodsEntries.map((row, index) => (
                                  <tr
                                    key={index}
                                    className={`border-t border-slate-200 dark:border-slate-800 transition ${
                                      editingGoodsIndex === index
                                        ? "bg-amber-500/15 border-l-4 border-l-amber-500 font-bold"
                                        : "hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                                    }`}
                                  >
                                    <td className="px-3 py-2 text-center font-mono text-slate-400">{index + 1}</td>
                                    <td className="px-3 py-2 font-black text-blue-600 dark:text-blue-400">{row.goodsName}</td>
                                    <td className="px-3 py-2 text-center font-semibold">{row.size}</td>
                                    <td className="px-3 py-2 text-center font-semibold">{row.brand}</td>
                                    <td className="px-3 py-2 text-center font-mono text-slate-400">{row.hsCode}</td>
                                    <td className="px-3 py-2 text-center font-semibold">{row.origin}</td>
                                    <td className="px-3 py-2 text-right font-mono font-bold">{Number(row.qtyNo || 0).toLocaleString()}</td>
                                    <td className="px-3 py-2 text-center font-semibold">{row.qtyName}</td>
                                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-600 dark:text-slate-300">{Number(row.coursePrice || row.price || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right font-mono font-black text-amber-600 dark:text-amber-400">{Number(row.totalAmount || row.amount || 0).toLocaleString()}</td>
                                    <td className="px-3 py-2 text-center font-mono text-slate-400">{row.op || "*"} {row.exchangeRate}</td>
                                    <td className="px-3 py-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                                      {Number(row.finalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleViewGoodsEntry(index)}
                                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-bold transition-colors"
                                          title={t(lang, "common.view", "View")}
                                        >
                                          <Eye className="h-3 w-3" /> {t(lang, "common.view", "View")}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleEditGoodsEntry(index)}
                                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[9px] font-bold transition-colors shadow-2xs border border-blue-200"
                                          title={t(lang, "common.edit", "Edit")}
                                        >
                                          <Edit3 className="h-3 w-3" /> {t(lang, "common.edit", "Edit")}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setGoodsEntries(prev => prev.filter((_, idx) => idx !== index))}
                                          className="flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[9px] font-bold transition-colors shadow-2xs border border-red-100"
                                          title={t(lang, "common.delete", "Delete")}
                                        >
                                          <Trash2 className="h-3 w-3" /> {t(lang, "common.delete", "Delete")}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2">
                          <span>Showing 0 to {goodsEntries.length} of {goodsEntries.length} entries</span>
                          <div className="flex items-center gap-2">
                            <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">
                              <option>10</option>
                              <option>25</option>
                              <option>50</option>
                            </select>
                            <div className="flex items-center gap-1">
                              <button type="button" className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 disabled:opacity-40" disabled>«</button>
                              <button type="button" className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 disabled:opacity-40" disabled>&lt;</button>
                              <button type="button" className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 disabled:opacity-40" disabled>&gt;</button>
                              <button type="button" className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 disabled:opacity-40" disabled>»</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

      {activeTab === "report" && (
        <div className="w-full mt-4 animate-in fade-in duration-300">
          <div className="mx-auto w-full max-w-[1180px] space-y-6 print:max-w-none">

            {/* Step 5 Top Header & Action Toolbar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{t(lang, "purchase.step5_of5", "Step 5 of 5")}</span>
                  <span className="text-[10px] font-semibold text-slate-400">{t(lang, "purchase.final_verification_label", "Final Verification")}</span>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mt-0.5">{t(lang, "purchase.final_verification_title", "Purchase Booking Final Verification")}</h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {t(lang, "purchase.final_verification_subtitle", "Inspect the complete Purchase Order Voucher, account ledger routing, goods manifest, and audit details before saving or transferring.")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("reports_tab")}
                className="font-bold text-xs h-9 px-4 border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> {t(lang, "purchase.back_to_step4", "Back to Step 4")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePrintA4Report(true)}
                className="font-bold text-xs h-9 px-4 border-slate-200 hover:bg-slate-50 text-slate-800"
              >
                <Printer className="h-4 w-4 mr-1.5 text-blue-600" /> {t(lang, "purchase.print_a4_voucher", "Print A4 Voucher")}
              </Button>
              <Button
                type="button"
                onClick={() => handleSavePurchaseOrder(false)}
                disabled={savingOrder}
                className="font-bold text-xs h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center gap-1.5"
              >
                {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingOrder ? t(lang, "common.saving", "Saving...") : (savedOrderId ? t(lang, "purchase.update_purchase_order", "Update Purchase Order") : t(lang, "purchase.save_purchase_order", "Save Purchase Order"))}
              </Button>
              {!isTransferred && (
                <Button
                  type="button"
                  onClick={handleTransfer}
                  disabled={savingOrder}
                  className="font-black text-xs h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all flex items-center gap-1.5 uppercase"
                >
                  <ArrowRight className="h-4 w-4" /> {savedOrderId ? t(lang, "purchase.transfer_to_payment", "Transfer to Payment") : t(lang, "purchase.save_and_transfer_payment", "Save & Transfer to Payment")}
                </Button>
              )}
            </div>
          </div>

          {/* Transfer / Journal Status Callout Banner */}
          {isTransferred ? (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-emerald-200/80 pb-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">{t(lang, "purchase.transfer_completed_posted", "Transfer Completed & Posted")}</h4>
              </div>
              <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                {t(lang, "purchase.transfer_completed_notice", "This Purchase Booking has been automatically transferred and posted to the business journal (Roznamcha). All associated ledger accounts and serial numbers have been logged.")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono bg-white/80 p-3.5 rounded-xl border border-emerald-200/60">
                <div>
                  <span className="block text-[9px] uppercase font-sans font-bold text-emerald-700/80">{t(lang, "purchase.general_serial_no", "General Serial No:")}</span>
                  <span className="font-black text-emerald-950">{form.generalSerialNumber || `GSN-${new Date().getFullYear()}-0001`}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-sans font-bold text-emerald-700/80">{t(lang, "purchase.roznamcha_journal_no", "Roznamcha (Journal) No:")}</span>
                  <span className="font-black text-emerald-950">{form.journalNumber || `JRN-${new Date().getFullYear()}-8821`}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-sans font-bold text-emerald-700/80">{t(lang, "purchase.branch_roznamcha", "Branch Roznamcha:")}</span>
                  <span className="font-black text-emerald-950">{form.branchJournalNumber || `BR-JRN-402`}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-sans font-bold text-emerald-700/80">{t(lang, "purchase.cash_entry_serial", "Cash Entry Serial:")}</span>
                  <span className="font-black text-emerald-950">{form.cashEntrySerial || `CE-9921`}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-sans font-bold text-emerald-700/80">{t(lang, "purchase.business_entry_ref", "Business Entry Ref:")}</span>
                  <span className="font-black text-emerald-950 uppercase">{form.businessEntryRef || `BUS-ENT-PURCHASE`}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">{t(lang, "purchase.pending_transfer_status_title", "Pending Transfer Status")}</h4>
                  <p className="text-xs text-amber-800 font-medium mt-0.5">
                    {t(lang, "purchase.booking_verified_ready", "This booking is verified and ready. Transfer to Payment will generate Roznamcha journal entries and update supplier/customer ledgers.")}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-200/60 text-amber-900 text-[10px] font-black uppercase rounded-full border border-amber-300 self-start md:self-auto">
                {t(lang, "purchase.pending_verification_badge", "Pending Verification")}
              </span>
            </div>
          )}

          {/* 4-Panel Structured Report Grid */}
          {renderGlobalInfoCards()}

          {/* Printable Voucher Document Container */}
          <div className="mx-auto w-full max-w-6xl bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            {/* Voucher Header Banner */}
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <div className="bg-slate-950 px-6 py-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.28em] text-cyan-400">{t(lang, "purchase.damaan_business_group", "Damaan Business Group")}</p>
                  <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.18em] text-white">{t(lang, "purchase.voucher_title", "Purchase Booking Voucher")}</h1>
                  <p className="mt-1 text-xs font-medium text-slate-300">{t(lang, "purchase.voucher_subtitle", "Official ERP Verification, Account Routing & Goods Manifest Voucher")}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-bold md:min-w-[340px] text-right bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400">{t(lang, "purchase.po_number", "PO Number")}:</span><span className="font-mono text-cyan-300 font-black">{form.purchaseOrderNo || "N/A"}</span>
                  <span className="text-slate-400">{t(lang, "purchase.voucher_bill_number_label", "Bill Number:")}</span><span className="font-mono text-white">{form.billNo || "N/A"}</span>
                  <span className="text-slate-400">{t(lang, "purchase.f_booking_date", "Booking Date")}:</span><span>{form.purchaseDate || "N/A"}</span>
                  <span className="text-slate-400">{t(lang, "purchase.voucher_status_label", "Status:")}</span><span className={isTransferred ? "text-emerald-400 font-black" : "text-amber-400 font-black"}>{isTransferred ? t(lang, "purchase.status_transferred", "Transferred") : t(lang, "purchase.status_pending_transfer", "Pending Transfer")}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0 bg-slate-50 text-xs font-semibold text-slate-700 border-t border-slate-200">
                <div className="p-3 border-r border-b md:border-b-0 border-slate-200"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{t(lang, "purchase.voucher_country_label", "Country")}</span>{form.branchCountry || form.origin || "N/A"}</div>
                <div className="p-3 border-r border-b md:border-b-0 border-slate-200"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{t(lang, "purchase.voucher_branch_label", "Branch")}</span>{form.branchName || "N/A"}</div>
                <div className="p-3 border-r border-slate-200"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{t(lang, "purchase.voucher_branch_code_label", "Branch Code")}</span><span className="font-mono">{form.branchCode || "N/A"}</span></div>
                <div className="p-3"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{t(lang, "purchase.voucher_currency_label", "Currency")}</span><span className="font-black text-slate-900">{form.purchaseCurrency || form.currencyType || "N/A"}</span></div>
              </div>
            </div>

            {/* Accounts Routing Cards (DR & CR) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="border border-slate-200 bg-slate-50/70 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-black uppercase text-slate-900 text-xs tracking-wider flex items-center gap-1.5">
                    <ArrowDownLeft className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.purchase_account_short_title", "Purchase Account")}
                  </h3>
                  <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">{t(lang, "purchase.dr_debit_badge", "DR (Debit)")}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-1.5 text-xs">
                  <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_account_code", "Account Code")}:</span><span className="font-mono font-bold text-slate-900">{form.purchaseAccountNo || "N/A"}</span>
                  <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_account_name", "Account Name")}:</span><span className="font-bold text-slate-900">{localizeBiz(form, lang, "purchaseAccountName", form.purchaseAccountName || "N/A")}</span>
                  <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_company", "Company")}:</span><span className="font-bold text-slate-800">{form.purchaseCompanyName || "N/A"}</span>
                </div>
              </div>

              <div className="border border-slate-200 bg-slate-50/70 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-black uppercase text-slate-900 text-xs tracking-wider flex items-center gap-1.5">
                    <ArrowUpRight className="h-4 w-4 text-emerald-600" /> {t(lang, "purchase.sales_account_short_title", "Sales Account")}
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">{t(lang, "purchase.cr_credit_badge", "CR (Credit)")}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-1.5 text-xs">
                  <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_account_code", "Account Code")}:</span><span className="font-mono font-bold text-slate-900">{form.salesAccountNo || "N/A"}</span>
                  <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_account_name", "Account Name")}:</span><span className="font-bold text-slate-900">{localizeBiz(form, lang, "salesAccountName", form.salesAccountName || "N/A")}</span>
                  <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_company", "Company")}:</span><span className="font-bold text-slate-800">{form.salesCompanyName || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Goods Details Table */}
            <div className="space-y-3">
              <h3 className="font-black text-xs border-b border-slate-200 pb-2.5 uppercase text-slate-900 flex items-center gap-2 tracking-wider">
                <Package className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.goods_overview_manifest", "Goods Overview Manifest")}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider">
                    <tr>
                      <Th className="p-2.5 font-bold border-r border-slate-200">{t(lang, "purchase.th_goods", "Goods")}</Th>
                      <Th className="p-2.5 font-bold border-r border-slate-200">{t(lang, "purchase.th_brand", "Brand")}</Th>
                      <Th className="p-2.5 font-bold border-r border-slate-200 text-center">{t(lang, "purchase.th_origin", "Origin")}</Th>
                      <Th className="p-2.5 text-right font-bold border-r border-slate-200">{t(lang, "purchase.th_quantity", "Quantity")}</Th>
                      <Th className="p-2.5 text-right font-bold border-r border-slate-200">{t(lang, "purchase.th_gross_wt", "Gross Wt")}</Th>
                      <Th className="p-2.5 text-right font-bold border-r border-slate-200">{t(lang, "purchase.th_net_wt", "Net Wt")}</Th>
                      <Th className="p-2.5 text-right font-bold border-r border-slate-200">{t(lang, "purchase.th_rate", "Rate")}</Th>
                      <Th className="p-2.5 text-right font-bold border-r border-slate-200">{t(lang, "purchase.th_amount_currency", "Amount ({currency})").replace("{currency}", form.currencyType || "USD")}</Th>
                      <Th className="p-2.5 text-right font-bold text-emerald-800 bg-emerald-50/50">{t(lang, "purchase.th_final_currency", "Final ({currency})").replace("{currency}", form.secondaryCurrency || "PKR")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {goodsEntries.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">{row.goodsName}</td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-700">{row.brand}</td>
                        <td className="p-2.5 border-r border-slate-200 text-center text-slate-700">{row.origin}</td>
                        <td className="p-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-900">{Number(row.qtyNo || 0).toLocaleString()} {row.qtyName || ""}</td>
                        <td className="p-2.5 text-right border-r border-slate-200 font-mono text-slate-700">{Number(row.grossWeight || (Number(row.qtyNo || 0) * Number(row.qtyKgs || 0)) || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-800">{Number(row.netWeight || (Number(row.qtyNo || 0) * (Number(row.qtyKgs || 0) - Number(row.emptyKgs || 0))) || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right border-r border-slate-200 font-mono text-slate-700">{Number(row.coursePrice || row.price || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-800">{Number(row.totalAmount || row.amount || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                          {Number(row.finalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {goodsEntries.length > 0 && (
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-xs">
                        <td colSpan={3} className="p-2.5 text-right border-r border-slate-200 font-black uppercase text-slate-700">{t(lang, "purchase.totals_label", "TOTALS:")}</td>
                        <td className="p-2.5 text-right border-r border-slate-200 font-mono font-black">{Number(reportTotals.totalQty || 0).toLocaleString()} {goodsEntries[0]?.qtyName || ""}</td>
                        <td className="p-2.5 text-right border-r border-slate-200 font-mono">{Number(reportTotals.totalGross || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right border-r border-slate-200 font-mono font-black">{Number(reportTotals.totalNet || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right border-r border-slate-200 bg-slate-100 text-slate-400">-</td>
                        <td className="p-2.5 text-right border-r border-slate-200 font-mono font-black text-slate-900">{Number(reportTotals.grandPrimaryFinal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="p-2.5 text-right font-mono font-black text-emerald-800 bg-emerald-100/70">{Number(reportTotals.grandFinal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ledger Routing Details Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">{t(lang, "purchase.ledger_routing_post_details", "Ledger Routing & Post Details")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-blue-700 uppercase text-[9px] bg-blue-100 px-2 py-0.5 rounded">{t(lang, "purchase.purchase_account_dr_badge", "Purchase Account (DR)")}</span>
                    <span className="text-slate-600 font-mono font-bold">{form.purchaseAccountNo || "N/A"}</span>
                  </div>
                  <div className="font-bold text-slate-900 text-xs truncate" title={form.purchaseAccountName}>{localizeBiz(form, lang, "purchaseAccountName", form.purchaseAccountName || "N/A")}</div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{t(lang, "purchase.branch_colon_label", "Branch:")} <strong className="text-slate-700">{form.purchaseAccountBranch || "-"}</strong></span>
                    <span>{t(lang, "purchase.currency_colon_label", "Currency:")} <strong className="text-slate-700">{form.purchaseCurrency || form.purchaseAccountCurrency || "-"}</strong></span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-emerald-700 uppercase text-[9px] bg-emerald-100 px-2 py-0.5 rounded">{t(lang, "purchase.sales_account_cr_badge", "Sales Account (CR)")}</span>
                    <span className="text-slate-600 font-mono font-bold">{form.salesAccountNo || "N/A"}</span>
                  </div>
                  <div className="font-bold text-slate-900 text-xs truncate" title={form.salesAccountName}>{localizeBiz(form, lang, "salesAccountName", form.salesAccountName || "N/A")}</div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{t(lang, "purchase.branch_colon_label", "Branch:")} <strong className="text-slate-700">{form.salesAccountBranch || "-"}</strong></span>
                    <span>{t(lang, "purchase.currency_colon_label", "Currency:")} <strong className="text-slate-700">{form.salesAccountCurrency || "-"}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* User, Branch & 4-Tier Serial Hierarchy Audit Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.user_audit_serial_hierarchy", "User Audit & Branch 4-Tier Serial Hierarchy")}
                </h4>
                <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {t(lang, "purchase.system_audit_log", "SYSTEM AUDIT LOG")}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  <span className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">{t(lang, "purchase.created_by_user_id", "Created By User ID")}</span>
                  <span className="font-mono font-bold text-slate-900">{form.userId || session?.userId || "USR-1001"}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  <span className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">{t(lang, "purchase.user_name_label", "User Name")}</span>
                  <span className="font-bold text-slate-900 uppercase">{form.userName || session?.fullName || t(lang, "purchase.pmw_super_admin", "Super Admin")}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  <span className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">{t(lang, "purchase.working_branch_label", "Working Branch")}</span>
                  <span className="font-bold text-slate-900 truncate block">{form.branchName || t(lang, "purchase.card_main_branch_fallback", "Main Branch")}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  <span className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">{t(lang, "purchase.verification_date_label", "Verification Date")}</span>
                  <span className="font-bold text-slate-900 font-mono">{form.purchaseDate || new Date().toISOString().slice(0, 10)}</span>
                </div>
              </div>

              {/* 4-Tier Booking Serial Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-xs">
                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                  <span className="block text-[9px] font-black uppercase text-blue-700 mb-0.5">{t(lang, "purchase.tier1_super_admin_serial", "1. Super Admin Serial")}</span>
                  <span className="font-mono font-black text-blue-950">{form.superAdminSerialNumber || `SA-${new Date().getFullYear()}-0082`}</span>
                </div>
                <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                  <span className="block text-[9px] font-black uppercase text-indigo-700 mb-0.5">{t(lang, "purchase.tier2_country_serial", "2. Country Serial")}</span>
                  <span className="font-mono font-black text-indigo-950">{form.countryTransactionSerialNumber || `UAE-${new Date().getFullYear()}-0042`}</span>
                </div>
                <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-100">
                  <span className="block text-[9px] font-black uppercase text-sky-700 mb-0.5">{t(lang, "purchase.tier3_branch_serial", "3. Branch Serial")}</span>
                  <span className="font-mono font-black text-sky-950">{form.branchTransactionSerialNumber || `ARE-MAIN-${new Date().getFullYear()}-0021`}</span>
                </div>
                <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[9px] font-black uppercase text-slate-600 mb-0.5">{t(lang, "purchase.tier4_city_entry_serial", "4. City / Entry Serial")}</span>
                  <span className="font-mono font-black text-slate-900">{form.cashEntrySerial || form.journalNumber || `CB-${new Date().getFullYear()}-00421`}</span>
                </div>
              </div>
            </div>

            {/* Transfer Destination & Roznamcha Debit / Credit Serials */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-emerald-600" /> {t(lang, "purchase.transfer_destination_roznamcha_serials", "Transfer Destination & Business Roznamcha Serials")}
                </h4>
                <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded uppercase border ${isTransferred ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-900 border-amber-300"}`}>
                  {isTransferred ? t(lang, "purchase.transfer_locked_completed", "TRANSFER LOCKED & COMPLETED") : t(lang, "purchase.pending_transfer_badge", "PENDING TRANSFER")}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Transfer Destination & Status */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="block text-[9.5px] font-black uppercase text-slate-500 tracking-wider">{t(lang, "purchase.transfer_destination_module", "Transfer Destination Module")}</span>
                  <div className="font-bold text-slate-900 text-xs">
                    {isTransferred ? t(lang, "purchase.transfer_destination_completed_text", "Purchase Advance Payment Module & Business Roznamcha") : t(lang, "purchase.transfer_destination_ready_text", "Ready for Transfer to Payment Records")}
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span className="block font-semibold">{t(lang, "purchase.target_route_label", "Target Route:")}</span>
                    <code className="font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-bold">{buildPurchaseBookingTransferUrl(form.paymentType)}</code>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    <span>{t(lang, "purchase.transfer_timestamp_label", "Transfer Timestamp:")} </span>
                    <strong className="font-mono text-slate-800">{form.transferTimestamp || (isTransferred ? new Date().toLocaleString() : t(lang, "purchase.not_transferred_yet", "Not Transferred Yet"))}</strong>
                  </div>
                </div>

                {/* Roznamcha Debit 4 Serials */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200/80 space-y-2">
                  <div className="flex justify-between items-center border-b border-blue-200/60 pb-1.5">
                    <span className="font-black text-blue-800 uppercase text-[9.5px] tracking-wider">{t(lang, "purchase.debit_roznamcha_serials_dr", "Debit Roznamcha Serials (DR)")}</span>
                    <span className="bg-blue-600 text-white text-[8.5px] font-black px-1.5 py-0.2 rounded">DR</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <div><span className="block font-sans font-bold text-slate-500 text-[8.5px]">{t(lang, "purchase.sa_serial_label", "SA SERIAL:")}</span><strong className="text-slate-900">{form.purchaseDrSaSerial || `DR-SA-0082`}</strong></div>
                    <div><span className="block font-sans font-bold text-slate-500 text-[8.5px]">{t(lang, "purchase.country_serial_label", "COUNTRY SERIAL:")}</span><strong className="text-slate-900">{form.purchaseDrCountrySerial || `DR-UAE-0042`}</strong></div>
                    <div><span className="block font-sans font-bold text-slate-500 text-[8.5px]">{t(lang, "purchase.branch_serial_label", "BRANCH SERIAL:")}</span><strong className="text-slate-900">{form.purchaseDrBranchSerial || `DR-MAIN-0021`}</strong></div>
                    <div><span className="block font-sans font-bold text-slate-500 text-[8.5px]">{t(lang, "purchase.city_serial_label", "CITY SERIAL:")}</span><strong className="text-slate-900">{form.purchaseDrCitySerial || `DR-CB-00421`}</strong></div>
                  </div>
                </div>

                {/* Roznamcha Credit 4 Serials */}
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 space-y-2">
                  <div className="flex justify-between items-center border-b border-emerald-200/60 pb-1.5">
                    <span className="font-black text-emerald-800 uppercase text-[9.5px] tracking-wider">{t(lang, "purchase.credit_roznamcha_serials_cr", "Credit Roznamcha Serials (CR)")}</span>
                    <span className="bg-emerald-600 text-white text-[8.5px] font-black px-1.5 py-0.2 rounded">CR</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <div><span className="block font-sans font-bold text-slate-500 text-[8.5px]">{t(lang, "purchase.sa_serial_label", "SA SERIAL:")}</span><strong className="text-slate-900">{form.salesCrSaSerial || `CR-SA-0082`}</strong></div>
                    <div><span className="block font-sans font-bold text-slate-500 text-[8.5px]">{t(lang, "purchase.country_serial_label", "COUNTRY SERIAL:")}</span><strong className="text-slate-900">{form.salesCrCountrySerial || `CR-UAE-0042`}</strong></div>
                    <div><span className="block font-sans font-bold text-slate-500 text-[8.5px]">{t(lang, "purchase.branch_serial_label", "BRANCH SERIAL:")}</span><strong className="text-slate-900">{form.salesCrBranchSerial || `CR-MAIN-0021`}</strong></div>
                    <div><span className="block font-sans font-bold text-slate-500 text-[8.5px]">{t(lang, "purchase.city_serial_label", "CITY SERIAL:")}</span><strong className="text-slate-900">{form.salesCrCitySerial || `CR-CB-00421`}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Remarks Input */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">{t(lang, "purchase.audit_final_remarks", "Audit & Final Remarks")}</h4>
              <textarea
                value={form.orderReportRemarks || ""}
                onChange={(e) => handleTextChange("orderReportRemarks", e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white resize-none h-24 text-xs font-medium leading-relaxed"
                placeholder={t(lang, "purchase.audit_remarks_placeholder", "Type verification, approval, or audit remarks before saving/transferring...")}
              />
            </div>

            {/* Saved Reports */}
            {reportsList.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">{t(lang, "purchase.saved_custom_reports_count", "Saved Custom Reports ({count})").replace("{count}", String(reportsList.length))}</h4>
                <div className="space-y-2.5">
                  {reportsList.map((report) => (
                    <div key={report.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-slate-900">{report.name}</span>
                        <button type="button" onClick={() => handleDeleteReport(report.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {report.description && <p className="text-slate-600 mb-1 font-medium text-[11px]">{report.description}</p>}
                      <p className="text-slate-400 font-mono text-[9px]">{formatShortDate(report.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 5 Footer Action Toolbar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab("reports_tab")}
              className="font-bold text-xs h-10 px-6 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1.5" /> {t(lang, "purchase.back_to_step4_reports", "Back to Step 4 (Reports)")}
            </Button>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePrintA4Report(true)}
                className="font-bold text-xs h-10 px-5 border-slate-200 hover:bg-slate-50 text-slate-800"
              >
                <Printer className="h-4 w-4 mr-1.5 text-blue-600" /> {t(lang, "purchase.print_a4_voucher", "Print A4 Voucher")}
              </Button>

              <Button
                type="button"
                onClick={() => handleSavePurchaseOrder(false)}
                disabled={savingOrder}
                className="font-bold text-xs h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all uppercase tracking-wider flex items-center gap-2"
              >
                {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingOrder ? t(lang, "purchase.saving_ellipsis", "Saving...") : (savedOrderId ? t(lang, "purchase.update_purchase_order", "Update Purchase Order") : t(lang, "purchase.save_purchase_order_btn", "Save Purchase Order"))}
              </Button>

              {!isTransferred && (
                <Button
                  type="button"
                  onClick={handleTransfer}
                  disabled={savingOrder}
                  className="font-black text-xs h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_14px_0_rgb(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5 transition-all uppercase tracking-wider flex items-center gap-2"
                >
                  {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {savedOrderId ? t(lang, "purchase.transfer_to_payment_btn", "Transfer to Payment") : t(lang, "purchase.save_and_transfer_payment", "Save & Transfer to Payment")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
      {previewModalOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-5xl h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Printer className="h-4 w-4 text-blue-600" /> {t(lang, "purchase.print_preview_title", "Print Preview")}
              </h2>
              <div className="flex items-center gap-3">
                <Button type="button" onClick={() => { import("@/lib/reports/print-dom-fragment").then((m) => { if (!m.printDomFragmentViaModal("wizard-a4-preview", t(lang, "purchase.print_document_btn", "Print Document"), { lang })) window.print(); }); }} className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs font-bold rounded shadow transition-all">{t(lang, "purchase.print_document_btn", "Print Document")}</Button>
                <Button type="button" variant="outline" onClick={() => setPreviewModalOpen(false)} className="h-8 px-4 text-xs font-bold hover:bg-slate-100">{t(lang, "purchase.close_btn", "Close")}</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50 flex justify-center custom-scrollbar">
              <div id="wizard-a4-preview" className="w-[210mm] min-h-[297mm] bg-white shadow-xl border border-slate-200 p-8 transform scale-[0.9] origin-top print:scale-100 print:shadow-none print:m-0 print:border-none print:p-0">

                {/* Header */}
                <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                  <h1 className="text-2xl font-black uppercase text-slate-900 tracking-widest">{t(lang, "purchase.header_order_title", "Purchase Booking Order")}</h1>
                  <div className="flex justify-between items-end mt-4 text-xs font-bold text-slate-700">
                    <div className="text-left">
                      <p>{t(lang, "purchase.print_booking_date_label", "Booking Date:")} {form.purchaseDate}</p>
                      <p>{t(lang, "purchase.print_branch_paren_label", "Branch:")} {form.branchName} ({form.branchCode})</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{t(lang, "purchase.print_po_no_label", "PO No:")} {form.purchaseOrderNo}</p>
                      <p>{t(lang, "purchase.print_contract_no_label", "Contract No:")} {form.purchaseContractNo || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Account Info */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-[10px]">
                  <div className="border border-slate-300 p-3 rounded">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">{t(lang, "purchase.purchase_account_dr_badge", "Purchase Account (DR)")}</h3>
                    <div className="grid grid-cols-[80px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_account_code", "Account Code")}:</span><span className="font-bold">{form.purchaseAccountNo || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_account_name", "Account Name")}:</span><span className="font-bold">{localizeBiz(form, lang, "purchaseAccountName", form.purchaseAccountName || "N/A")}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_company", "Company")}:</span><span className="font-bold">{form.purchaseCompanyName || "N/A"}</span>
                    </div>
                  </div>
                  <div className="border border-slate-300 p-3 rounded">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">{t(lang, "purchase.sales_account_cr_badge", "Sales Account (CR)")}</h3>
                    <div className="grid grid-cols-[80px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_account_code", "Account Code")}:</span><span className="font-bold">{form.salesAccountNo || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_account_name", "Account Name")}:</span><span className="font-bold">{localizeBiz(form, lang, "salesAccountName", form.salesAccountName || "N/A")}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.f_company", "Company")}:</span><span className="font-bold">{form.salesCompanyName || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Goods Table */}
                <div className="mb-6">
                  <h3 className="font-black text-xs border-b-2 border-slate-400 pb-1 mb-2 uppercase text-slate-800">{t(lang, "purchase.goods_details_title", "Goods Details")}</h3>
                  <table className="w-full text-[9px] border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <Th className="border-r border-slate-300 p-1.5 text-left">{t(lang, "purchase.th_hash", "#")}</Th>
                        <Th className="border-r border-slate-300 p-1.5 text-left">{t(lang, "purchase.th_goods_name", "Goods Name")}</Th>
                        <Th className="border-r border-slate-300 p-1.5 text-center">{t(lang, "purchase.th_hs_code", "HS Code")}</Th>
                        <Th className="border-r border-slate-300 p-1.5 text-center">{t(lang, "purchase.th_origin", "Origin")}</Th>
                        <Th className="border-r border-slate-300 p-1.5 text-right">{t(lang, "purchase.th_qty", "Qty")}</Th>
                        <Th className="border-r border-slate-300 p-1.5 text-center">{t(lang, "purchase.th_unit", "Unit")}</Th>
                        <Th className="border-r border-slate-300 p-1.5 text-right">{t(lang, "purchase.th_price_currency", "Price ({currency})").replace("{currency}", form.currencyType || "USD")}</Th>
                        <Th className="border-r border-slate-300 p-1.5 text-center">{t(lang, "purchase.th_ex_rate", "Ex. Rate")}</Th>
                        <Th className="p-1.5 text-right">{t(lang, "purchase.th_final_currency", "Final ({currency})").replace("{currency}", form.secondaryCurrency || "PKR")}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {goodsEntries.length === 0 ? (
                        <tr><td colSpan={9} className="p-3 text-center italic text-slate-500">{t(lang, "purchase.no_goods_entries", "No goods entries.")}</td></tr>
                      ) : (
                        goodsEntries.map((g, i) => (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="border-r border-slate-200 p-1.5 text-center">{i + 1}</td>
                            <td className="border-r border-slate-200 p-1.5 font-bold">{g.goodsName} {g.brand ? `(${g.brand})` : ""}</td>
                            <td className="border-r border-slate-200 p-1.5 text-center">{g.hsCode}</td>
                            <td className="border-r border-slate-200 p-1.5 text-center">{g.origin}</td>
                            <td className="border-r border-slate-200 p-1.5 text-right font-bold">{Number(g.qtyNo || 0).toLocaleString()}</td>
                            <td className="border-r border-slate-200 p-1.5 text-center">{g.qtyName}</td>
                            <td className="border-r border-slate-200 p-1.5 text-right">{g.coursePrice}</td>
                            <td className="border-r border-slate-200 p-1.5 text-center">{g.exchangeRate}</td>
                            <td className="p-1.5 text-right font-bold">{Number(g.finalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-400 font-bold">
                        <td colSpan={4} className="p-1.5 text-right">{t(lang, "purchase.total_colon", "Total:")}</td>
                        <td className="border-r border-slate-200 p-1.5 text-right">{Number(reportTotals.totalQty || 0).toLocaleString()}</td>
                        <td colSpan={3} className="border-r border-slate-200 p-1.5 text-right text-[8px] text-slate-500 uppercase">{t(lang, "purchase.grand_total_colon", "Grand Total:")}</td>
                        <td className="p-1.5 text-right">{form.secondaryCurrency || "PKR"} {Number(reportTotals.grandFinal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Loading Details */}
                <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                  <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">{t(lang, "purchase.loading_transit_report", "Loading & Transit Report")}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.shipping_mode_colon", "Shipping Mode:")}</span><span className="font-bold">{form.shippingMode ? translateOptionLabel(lang, form.shippingMode) : "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.origin_country_colon", "Origin Country:")}</span><span className="font-bold">{form.origin || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.loading_port_border_colon", "Loading Port/Border:")}</span><span className="font-bold">{form.loadingPort || form.loadingBorder || form.airportName || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.loading_date_colon", "Loading Date:")}</span><span className="font-bold">{form.loadingDate || "N/A"}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.transit_country_colon", "Transit Country:")}</span><span className="font-bold">{form.transitCountry || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.destination_country_colon", "Destination Country:")}</span><span className="font-bold">{form.receivedCountry || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.received_port_border_colon", "Received Port/Border:")}</span><span className="font-bold">{form.receivedPort || form.receivedBorder || form.receivedPortName || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.received_date_colon", "Received Date:")}</span><span className="font-bold">{form.receivedDate || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Condition */}
                <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                  <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">{t(lang, "purchase.payment_conditions_report", "Payment Conditions Report")}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-[120px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.payment_term_colon", "Payment Term:")}</span><span className="font-bold">{form.paymentType ? translateOptionLabel(lang, form.paymentType) : "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.advance_pct_colon", "Advance (%):")}</span><span className="font-bold">{form.advancePercent || 0}%</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.advance_payment_date_colon", "Advance Payment Date:")}</span><span className="font-bold">{form.advancePaymentDate || "N/A"}</span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] gap-1">
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.invoice_terms_colon", "Invoice Terms:")}</span><span className="font-bold">{form.invoicePayment || "N/A"}</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.remaining_pct_colon", "Remaining (%):")}</span><span className="font-bold">{100 - (form.advancePercent || 0)}%</span>
                      <span className="text-slate-500 font-semibold">{t(lang, "purchase.final_payment_date_colon", "Final Payment Date:")}</span><span className="font-bold">{form.paymentDate || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Remarks & Narration */}
                {form.remarks && (
                  <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">{t(lang, "purchase.remarks_narration_title", "Remarks & Narration")}</h3>
                    <p className="whitespace-pre-wrap font-medium text-slate-800">{localizeBiz(form, lang, "remarks", form.remarks)}</p>
                  </div>
                )}

                {/* User Remarks (Report) */}
                {form.orderReportRemarks && (
                  <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">{t(lang, "purchase.user_remarks_report_title", "User Remarks (Report)")}</h3>
                    <p className="whitespace-pre-wrap font-medium text-slate-800">{localizeBiz(form, lang, "remarks", form.orderReportRemarks)}</p>
                  </div>
                )}

                {/* Dynamic Reports */}
                {reportsList.length > 0 && (
                  <div className="mb-4 border border-slate-300 rounded p-3 text-[10px]">
                    <h3 className="font-black border-b border-slate-200 pb-1 mb-2 uppercase text-slate-800">{t(lang, "purchase.dynamic_reports_notes_title", "Dynamic Reports & Notes")}</h3>
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
                    <div className="border-t border-slate-400 pt-1">{t(lang, "purchase.prepared_by_label", "Prepared By")}</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1">{t(lang, "purchase.checked_by_label", "Checked By")}</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1">{t(lang, "purchase.authorized_signatory_label", "Authorized Signatory")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- NEW COUNTRY MODAL --- */}
      {newCountryModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">{trUi("Add New Country")}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{trUi("ISO codes and emails are auto-generated")}</p>
              </div>
              <button
                type="button"
                onClick={() => { setNewCountryModal(false); setNewCountryError(""); setNewCountryForm({ name: "" }); }}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >✕</button>
            </div>
            <div className="p-5 space-y-3">
              {newCountryError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">{newCountryError}</div>
              )}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Country Name")} *</label>
                <input
                  type="text"
                  value={newCountryForm.name}
                  onChange={(e) => setNewCountryForm({ name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddNewCountry(); }}
                  placeholder={t(lang, "purchase.wiz_ph_country_example", "e.g. Iran")}
                  autoFocus
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                />
              </div>
              <p className="text-[9px] text-muted-foreground/60">{trUi("ISO-2, ISO-3, currency code and system emails will be auto-generated. You can update them later in Location Setup.")}</p>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={() => { setNewCountryModal(false); setNewCountryError(""); setNewCountryForm({ name: "" }); }}
                className="px-4 py-1.5 text-[11px] rounded border border-input text-muted-foreground hover:text-foreground transition-colors"
              >{trUi("Cancel")}</button>
              <button
                type="button"
                onClick={handleAddNewCountry}
                disabled={newCountryLoading}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >{newCountryLoading ? "Saving…" : "Save Country"}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- NEW GOOD MODAL --- */}
      {newGoodModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">{trUi("Add New Good")}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{trUi("Creates a new item in the Goods Master")}</p>
              </div>
              <button
                type="button"
                onClick={() => { setNewGoodModal(false); setNewGoodError(""); setNewGoodForm({ goodsName: "", chsCode: "" }); }}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >✕</button>
            </div>
            <div className="p-5 space-y-3">
              {newGoodError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">{newGoodError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Goods Name")} *</label>
                  <input
                    type="text"
                    value={newGoodForm.goodsName}
                    onChange={(e) => setNewGoodForm(p => ({ ...p, goodsName: e.target.value.toUpperCase() }))}
                    placeholder={t(lang, "purchase.wiz_ph_goods_name_example", "e.g. PINE NUTS INSHELL")}
                    className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">{trUi("HS Code")} *</label>
                  <input
                    type="text"
                    value={newGoodForm.chsCode}
                    onChange={(e) => setNewGoodForm(p => ({ ...p, chsCode: e.target.value }))}
                    placeholder="0802.90"
                    className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/60">{trUi("After saving, this good will be auto-selected with HS Code pre-filled.")}</p>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={() => { setNewGoodModal(false); setNewGoodError(""); setNewGoodForm({ goodsName: "", chsCode: "" }); }}
                className="px-4 py-1.5 text-[11px] rounded border border-input text-muted-foreground hover:text-foreground transition-colors"
              >{trUi("Cancel")}</button>
              <button
                type="button"
                onClick={handleAddNewGood}
                disabled={newGoodLoading}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >{newGoodLoading ? "Saving…" : "Save Good"}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- NEW PORT / BORDER / AIRPORT MODAL --- */}
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
              >✕</button>
            </div>
            <div className="p-5 space-y-3">
              {newPortError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">{newPortError}</div>
              )}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Country Name")} *</label>
                <select
                  value={newPortForm.countryName || ""}
                  onChange={(e) => setNewPortForm(p => ({ ...p, countryName: e.target.value }))}
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                >
                  <option value="">{trUi("Select Country")}</option>
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
              >{trUi("Cancel")}</button>
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
              >{trUi("Save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- NEW GOOD VARIATION MODAL --- */}
      {customVariationModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground uppercase">
                  {t(lang, "purchase.wiz_add_good_variation", "Add Good Variation")}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t(lang, "purchase.wiz_specify_size_brand", "Specify size/brand under selected good")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomVariationModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Goods Name")}</label>
                <input
                  type="text"
                  value={customVariationForm.goodsName}
                  disabled
                  className="w-full bg-muted border border-input rounded px-3 py-1.5 text-muted-foreground text-[11px] outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Brand Name")} *</label>
                <input
                  type="text"
                  value={customVariationForm.brand}
                  onChange={(e) => setCustomVariationForm(p => ({ ...p, brand: e.target.value.toUpperCase() }))}
                  placeholder={t(lang, "purchase.wiz_ph_brand_example", "e.g. PREMIUM")}
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Size Specification")} *</label>
                <input
                  type="text"
                  value={customVariationForm.size}
                  onChange={(e) => setCustomVariationForm(p => ({ ...p, size: e.target.value.toUpperCase() }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveCustomVariation();
                    }
                  }}
                  placeholder={t(lang, "purchase.wiz_ph_size_example", "e.g. 20/22")}
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary uppercase"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={() => setCustomVariationModal(false)}
                className="px-4 py-1.5 text-[11px] rounded border border-input text-muted-foreground hover:text-foreground transition-colors"
              >{trUi("Cancel")}</button>
              <button
                type="button"
                onClick={handleSaveCustomVariation}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >{trUi("Save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE NEW ACCOUNT MODAL --- */}
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
              >✕</button>
            </div>
            <div className="p-5 space-y-3">
              {createAccountError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">
                  {createAccountError}
                </div>
              )}

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Account Name")} *</label>
                <input
                  type="text"
                  value={createAccountForm.name}
                  onChange={(e) => setCreateAccountForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={t(lang, "purchase.wiz_ph_account_name_example", "e.g. Haji Ahmad Dry Fruits")}
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Account Code")} *</label>
                  <input
                    type="text"
                    value={createAccountForm.code}
                    onChange={(e) => setCreateAccountForm(p => ({ ...p, code: e.target.value }))}
                    placeholder={t(lang, "purchase.wiz_ph_auto", "AUTO")}
                    className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Currency")} *</label>
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
                  <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Account Category")} *</label>
                  <select
                    value={createAccountForm.kind}
                    onChange={(e) => setCreateAccountForm(p => ({ ...p, kind: e.target.value }))}
                    className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                  >
                    <option value="liability">{trUi("Liability")}</option>
                    <option value="asset">{trUi("Asset")}</option>
                    <option value="expense">{trUi("Expense")}</option>
                    <option value="income">{trUi("Income")}</option>
                    <option value="equity">{trUi("Equity")}</option>
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
                    {t(lang, "purchase.wiz_control_account", "Control Account")}
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
              >{trUi("Cancel")}</button>
              <button
                type="button"
                onClick={handleAddNewAccount}
                disabled={createAccountLoading}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {createAccountLoading ? "Saving…" : "Save Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Report Modal */}
      {isNewReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-slate-900">
                    {t(lang, "purchase.wiz_create_new_report", "Create Dynamic Report")}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {t(lang, "purchase.wiz_report_modal_sub", "Select an auto-populated template or write custom booking notes")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-200/60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Template Selector Grid */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2 block flex items-center justify-between">
                  <span>{t(lang, "purchase.select_report_preset", "Choose Report Preset / Template")}</span>
                  <span className="text-[10px] font-semibold text-blue-600 lowercase">{t(lang, "purchase.auto_fills_data", "Auto-fills current booking data")}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectReportTemplate("payment")}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      selectedReportTemplate === "payment"
                        ? "bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-400"
                        : "bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <CreditCard className={`h-4 w-4 ${selectedReportTemplate === "payment" ? "text-blue-600" : "text-slate-500"}`} />
                      <span className={`text-[11px] font-black ${selectedReportTemplate === "payment" ? "text-blue-900" : "text-slate-800"}`}>
                        {t(lang, "purchase.tpl_payment", "Payment Terms")}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 leading-tight">
                      {t(lang, "purchase.tpl_payment_sub", "Advance, dates & total")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectReportTemplate("shipping")}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      selectedReportTemplate === "shipping"
                        ? "bg-emerald-50 border-emerald-500 shadow-xs ring-1 ring-emerald-400"
                        : "bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Truck className={`h-4 w-4 ${selectedReportTemplate === "shipping" ? "text-emerald-600" : "text-slate-500"}`} />
                      <span className={`text-[11px] font-black ${selectedReportTemplate === "shipping" ? "text-emerald-900" : "text-slate-800"}`}>
                        {t(lang, "purchase.tpl_shipping", "Loading & Route")}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 leading-tight">
                      {t(lang, "purchase.tpl_shipping_sub", "Ports, borders & ETA")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectReportTemplate("goods")}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      selectedReportTemplate === "goods"
                        ? "bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-400"
                        : "bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Package className={`h-4 w-4 ${selectedReportTemplate === "goods" ? "text-amber-600" : "text-slate-500"}`} />
                      <span className={`text-[11px] font-black ${selectedReportTemplate === "goods" ? "text-amber-900" : "text-slate-800"}`}>
                        {t(lang, "purchase.tpl_goods", "Goods & Weight")}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 leading-tight">
                      {t(lang, "purchase.tpl_goods_sub", "Gross/Net wt & items")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectReportTemplate("custom")}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      selectedReportTemplate === "custom"
                        ? "bg-purple-50 border-purple-500 shadow-xs ring-1 ring-purple-400"
                        : "bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className={`h-4 w-4 ${selectedReportTemplate === "custom" ? "text-purple-600" : "text-slate-500"}`} />
                      <span className={`text-[11px] font-black ${selectedReportTemplate === "custom" ? "text-purple-900" : "text-slate-800"}`}>
                        {t(lang, "purchase.tpl_custom", "Custom Blank")}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 leading-tight">
                      {t(lang, "purchase.tpl_custom_sub", "Blank report format")}
                    </span>
                  </button>
                </div>
              </div>

              {/* Live Preview Card */}
              {selectedReportTemplate === "payment" && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-[11px] space-y-1.5 text-blue-950">
                  <div className="font-black uppercase tracking-wider text-[10px] text-blue-700 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> {t(lang, "purchase.live_payment_snapshot", "Live Payment Snapshot")}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_payment_type", "Payment Type")}</span>
                      <span className="font-black text-slate-800">{form.paymentType || "N/A"}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_advance_percentage", "Advance %")}</span>
                      <span className="font-black text-blue-700">{form.advancePercent || 0}% ({form.advancePaymentDate || "N/A"})</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_remaining_percentage", "Remaining %")}</span>
                      <span className="font-black text-amber-700">{Math.max(0, 100 - Number(form.advancePercent || 0))}% ({form.paymentDate || "N/A"})</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_total_amount", "Order Total")}</span>
                      <span className="font-black text-emerald-700 font-mono">{form.currencyType || "USD"} {Number(reportTotals.grandPrimaryFinal || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedReportTemplate === "shipping" && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-[11px] space-y-1.5 text-emerald-950">
                  <div className="font-black uppercase tracking-wider text-[10px] text-emerald-700 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" /> {t(lang, "purchase.live_shipping_snapshot", "Live Route & Shipping Snapshot")}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_shipping_mode", "Mode")}</span>
                      <span className="font-black text-slate-800">{form.shippingMode || "By Sea"}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_loading_port", "Loading Port")}</span>
                      <span className="font-black text-slate-800 truncate block">{form.loadingPort || form.loadingBorder || "N/A"}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_destination_port", "Destination Port")}</span>
                      <span className="font-black text-slate-800 truncate block">{form.receivingPort || form.receivedPort || "N/A"}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_eta", "Expected ETA")}</span>
                      <span className="font-black text-emerald-700">{form.receivingDate || form.receivedDate || "N/A"}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedReportTemplate === "goods" && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-[11px] space-y-1.5 text-amber-950">
                  <div className="font-black uppercase tracking-wider text-[10px] text-amber-700 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" /> {t(lang, "purchase.live_goods_snapshot", "Live Goods & Cargo Weight Snapshot")}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_total_items", "Total Lots")}</span>
                      <span className="font-black text-slate-800">{goodsEntries.length} Item(s)</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_total_quantity", "Total Quantity")}</span>
                      <span className="font-black text-slate-800">{Number(reportTotals.totalQty || 0).toLocaleString()} {goodsEntries[0]?.qtyName || "Bags"}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_total_gross_wt", "Gross Weight")}</span>
                      <span className="font-black text-amber-800">{Number(reportTotals.totalGross || 0).toLocaleString()} KG</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                      <span className="text-[9px] text-slate-500 font-bold block">{t(lang, "purchase.f_total_net_wt", "Net Weight")}</span>
                      <span className="font-black text-emerald-700">{Number(reportTotals.totalNet || 0).toLocaleString()} KG</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Inputs */}
              <form id="newReportModalForm" onSubmit={handleNewReportSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 mb-1 block uppercase tracking-wider">
                      {trUi("Report Name")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newReportForm.name}
                      onChange={(e) => setNewReportForm({ ...newReportForm, name: e.target.value })}
                      className="flex h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1 text-xs font-bold text-slate-900 shadow-2xs transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                      placeholder={t(lang, "purchase.wiz_ph_report_name_example", "e.g. Loading Report, Shipping Report")}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-700 mb-1 block uppercase tracking-wider">
                      {trUi("Description")}
                    </label>
                    <input
                      type="text"
                      value={newReportForm.description}
                      onChange={(e) => setNewReportForm({ ...newReportForm, description: e.target.value })}
                      className="flex h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1 text-xs text-slate-800 shadow-2xs transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                      placeholder={t(lang, "purchase.wiz_ph_optional_description", "Optional summary description")}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black text-slate-700 block uppercase tracking-wider">
                      {trUi("Report Content & Notes")}
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {t(lang, "purchase.editable_report_hint", "Structured details above are loaded. Add remarks or edit freely.")}
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={newReportForm.notes}
                    onChange={(e) => setNewReportForm({ ...newReportForm, notes: e.target.value })}
                    className="flex w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs font-mono leading-relaxed text-slate-900 shadow-2xs transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                    placeholder={t(lang, "purchase.wiz_ph_additional_notes", "Write or edit report details, payment conditions, goods specifications, and remarks...")}
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2.5 p-4 px-6 border-t border-slate-100 bg-slate-50/80">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewReportModalOpen(false)}
                className="h-9 px-4 text-xs font-bold text-slate-600 border-slate-200 hover:bg-slate-100"
              >
                {t(lang, "common.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                form="newReportModalForm"
                className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> {t(lang, "purchase.wiz_create_and_save", "Create & Save Report")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE NEW COMPANY MODAL --- */}
      {createCompanyModalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  {t(lang, "purchase.wiz_create_new_company", "Create New Company")}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t(lang, "purchase.wiz_adding_to_company_registry", "Adding to Company Master Settings registry")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateCompanyModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
              >✕</button>
            </div>
            <div className="p-5 space-y-3">
              {createCompanyError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] rounded px-3 py-2">
                  {createCompanyError}
                </div>
              )}

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Company Name")} *</label>
                <input
                  type="text"
                  value={createCompanyForm.name}
                  onChange={(e) => setCreateCompanyForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={t(lang, "purchase.wiz_ph_company_example", "e.g. Apex Trading LLC")}
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Legal Name")}</label>
                <input
                  type="text"
                  value={createCompanyForm.legalName}
                  onChange={(e) => setCreateCompanyForm(p => ({ ...p, legalName: e.target.value }))}
                  placeholder={t(lang, "purchase.wiz_ph_company_legal_example", "e.g. Apex Imports (Optional)")}
                  className="w-full bg-background border border-input rounded px-3 py-1.5 text-foreground text-[11px] outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">{trUi("Base Currency")} *</label>
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
              >{trUi("Cancel")}</button>
              <button
                type="button"
                onClick={handleAddNewCompany}
                disabled={createCompanyLoading}
                className="px-4 py-1.5 text-[11px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {createCompanyLoading ? "Saving…" : "Save Company"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TRANSFER CONFIRMATION MODAL --- */}
      {transferConfirmModal && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-lg animate-in zoom-in-95 duration-200">
            <div className="bg-blue-900 text-white p-4 flex items-center justify-between border-b border-blue-800">
              <h2 className="font-black tracking-wider uppercase text-sm flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-blue-300" /> {t(lang, "purchase.wiz_transfer_to_payment_module", "Transfer to Payment Module")}
              </h2>
              <button type="button" onClick={() => setTransferConfirmModal(false)} className="text-blue-300 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-slate-800 bg-slate-50/50">
              <div className="flex items-start gap-3 bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100">
                <CheckSquare className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
                <p className="font-semibold leading-relaxed">
                  {trUi("You are about to transfer this Purchase Booking to the")} <strong>{trUi("Purchase Transfer Payment")}</strong> {trUi("module")}.
                  <br/><br/>
                  <em>{trUi("The transfer posts the booking through Business Roznamcha and then opens the selected payment flow.")}</em>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded p-2.5 bg-white shadow-sm flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{trUi("Invoice No")}</span>
                  <div className="font-black font-mono text-slate-900">{form.purchaseOrderNo}</div>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-white shadow-sm flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{trUi("Base Entry No")}</span>
                  <div className="font-black font-mono text-slate-900">{savedOrderNo || t(lang, "purchase.wiz_pending_ellipsis", "Pending...")}</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-100 border-t border-slate-200 p-4 flex justify-end gap-3 rounded-b-xl">
              <Button type="button" variant="outline" className="font-bold border-slate-300 text-slate-600" onClick={() => setTransferConfirmModal(false)}>
                {t(lang, "common.cancel", "Cancel")}
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
      )}

      {tradeDocsOpen && (
        <TradeDocumentCenter
          open={tradeDocsOpen}
          onClose={() => setTradeDocsOpen(false)}
          initialDocType={tradeDocsInitialType}
          txnKind="purchase"
          source="purchase_order"
          record={{
            id: savedOrderId || undefined,
            purchase_order_no: form.purchaseOrderNo,
            purchase_contract_no: form.purchaseContractNo,
            currency_code: form.purchaseCurrency || form.currencyType,
            exchange_rate: form.exchangeRate,
            order_total: form.orderTotal,
            country_id: form.countryId,
            country_branch_id: form.countryBranchId,
            city_branch_id: form.cityBranchId,
            form_data: { form, goodsEntries },
          }}
          companyId={form.purchaseCompanyId || null}
          scope={{
            countryId: form.countryId || null,
            countryBranchId: form.countryBranchId || null,
            cityBranchId: form.cityBranchId || null,
          }}
        />
      )}
    </div>
  );
}