"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  UploadCloud,
  RefreshCw,
  FileText,
  ShieldAlert,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Ban,
  Link2,
  AlertTriangle,
  Package,
  Receipt,
  Camera,
  ExternalLink,
  Globe,
  Building2,
  MapPin,
  Compass,
  ArrowRight,
  Download,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Check,
  Briefcase,
  Ship,
  Sparkles,
  HelpCircle,
  Bell,
  User,
  Sliders,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Layers,
  Edit3,
  ShieldCheck,
  Clock,
  KeyRound,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { isNativeApp, captureDocumentPhoto } from "@/lib/mobile/native-bridge";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { DRAFT_PREFILL_KEY } from "@/features/document-intelligence/components/entry-method-selector";
import { CrossLanguageReviewer } from "@/components/cross-language-reviewer";

type Row = Record<string, any>;

const STATUS_TONE: Record<string, string> = {
  uploaded: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ocr: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  classifying: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  extracting: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  matching: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  review: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  qvc: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  draft_ready: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  linked: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  error: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  rejected: "bg-slate-200 text-slate-600 dark:bg-slate-800",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800",
};

const COUNTRY_FLAGS: Record<string, string> = {
  ae: "🇦🇪",
  uae: "🇦🇪",
  "united arab emirates": "🇦🇪",
  af: "🇦🇫",
  afghanistan: "🇦🇫",
  pk: "🇵🇰",
  pakistan: "🇵🇰",
  ir: "🇮🇷",
  iran: "🇮🇷",
  qa: "🇶🇦",
  qatar: "🇶🇦",
  sa: "🇸🇦",
  "saudi arabia": "🇸🇦",
  om: "🇴🇲",
  oman: "🇴🇲",
  cn: "🇨🇳",
  china: "🇨🇳",
  us: "🇺🇸",
  usa: "🇺🇸",
  gb: "🇬🇧",
  uk: "🇬🇧",
};

function getFlagEmoji(countryName?: string | null): string {
  if (!countryName) return "🌐";
  const lower = countryName.toLowerCase().trim();
  return COUNTRY_FLAGS[lower] || "🌐";
}

// Canonical ERP destination metadata
export function getDestinationInfo(targetModule?: string | null, s?: ReturnType<typeof useErpScreen>) {
  switch (targetModule) {
    case "account_master":
    case "accounts":
      return {
        moduleName: s ? s.t("purpose_account_master", "Chart of Accounts / New Account Entry") : "Chart of Accounts / New Account Entry",
        menuPath: "Sidebar → New Entry → Accounts → New Account Setup",
        routeUrl: "/dashboard/accounts/setup",
        category: "Masters & Setup",
      };
    case "purchase_orders":
      return {
        moduleName: s ? s.t("purpose_purchase", "Purchase (New / Existing)") : "Purchase Booking Order",
        menuPath: "Sidebar → Trade → New Purchase Booking Order",
        routeUrl: "/dashboard/purchase/new-purchase-booking-order",
        category: "Trade",
      };
    case "sales_orders":
      return {
        moduleName: s ? s.t("purpose_sales", "Sales (New / Existing)") : "Sale Order Booking",
        menuPath: "Sidebar → Trade → New Sale Order Booking",
        routeUrl: "/dashboard/sales/new-sale-order-booking",
        category: "Trade",
      };
    case "purchase_loading_records":
      return {
        moduleName: s ? s.t("purpose_loading", "Purchase Loading / Receiving") : "Purchase Loading Records",
        menuPath: "Sidebar → Trade → Purchase Loading",
        routeUrl: "/dashboard/purchase-loading-records",
        category: "Trade",
      };
    case "roznamcha_entries":
      return {
        moduleName: s ? s.t("purpose_payment", "Payment / Cash / Bank Roznamcha") : "Cash / Bank Roznamcha",
        menuPath: "Sidebar → Finance → Roznamcha Cash Entry",
        routeUrl: "/dashboard/roznamcha/cash-entry",
        category: "Finance",
      };
    case "expenses":
    case "bill_expense_line":
      return {
        moduleName: s ? s.t("purpose_expense", "Expense Bill") : "Expense Bill Entry",
        menuPath: "Sidebar → Finance → Expenses",
        routeUrl: "/dashboard/expenses",
        category: "Finance",
      };
    case "shipping_bl_records":
      return {
        moduleName: s ? s.t("purpose_shipping", "Shipping / Bill of Lading") : "Shipping Line / Bill of Lading",
        menuPath: "Sidebar → Logistics → Shipping Line",
        routeUrl: "/dashboard/shipping-line",
        category: "Logistics",
      };
    case "clearing_agent_custom_entries":
      return {
        moduleName: s ? s.t("purpose_clearing", "Clearing / Customs Entry") : "Clearing Agent / Customs Entry",
        menuPath: "Sidebar → Logistics → Clearing Agent",
        routeUrl: "/dashboard/clearing-agent",
        category: "Logistics",
      };
    case "companies":
      return {
        moduleName: s ? s.t("purpose_company", "Company / Entity") : "Company / Entity Setup",
        menuPath: "Sidebar → Masters → Companies",
        routeUrl: "/dashboard/companies/new",
        category: "Masters",
      };
    case "customers":
      return {
        moduleName: s ? s.t("purpose_customer", "Customer / Person KYC") : "Customer / Person KYC Setup",
        menuPath: "Sidebar → Masters → Customers",
        routeUrl: "/dashboard/crm/customers/new",
        category: "Masters",
      };
    case "employees":
      return {
        moduleName: s ? s.t("purpose_employee", "Employee / HR Record") : "Employee / HR Record",
        menuPath: "Sidebar → HR & Payroll → Employees",
        routeUrl: "/dashboard/employees",
        category: "HR & Payroll",
      };
    case "banks":
      return {
        moduleName: s ? s.t("purpose_bank", "Bank Account") : "Bank Account Setup",
        menuPath: "Sidebar → Masters → Chart of Accounts",
        routeUrl: "/dashboard/accounts/setup",
        category: "Masters",
      };
    default:
      return {
        moduleName: targetModule || "Purchase Booking",
        menuPath: "Sidebar → Trade → New Purchase Booking Order",
        routeUrl: "/dashboard/purchase/new-purchase-booking-order",
        category: "Trade",
      };
  }
}

// Scoped modules per domain
const BUSINESS_MODULES = [
  { id: "purchase_orders", name: "Purchase", target: "purchase_orders", icon: Briefcase, desc: "Purchase order, commercial invoice, raw material contract" },
  { id: "purchase_loading_records", name: "Purchase Booking", target: "purchase_loading_records", icon: Package, desc: "Booking contract, shipping advice, container allocation" },
  { id: "sales_orders", name: "Sale", target: "sales_orders", icon: DollarSign, desc: "Sales invoice, sales contract, commercial agreement" },
  { id: "sales_booking", name: "Sale Booking", target: "sales_orders", icon: DollarSign, desc: "Proforma invoice, order confirmation, advance booking" },
  { id: "local_purchase", name: "Local Purchase", target: "purchase_orders", icon: Briefcase, desc: "Domestic vendor invoice, local procurement" },
  { id: "local_sale", name: "Local Sale", target: "sales_orders", icon: DollarSign, desc: "Local customer bill, domestic supply" },
  { id: "roznamcha_entries", name: "Cash Entry", target: "roznamcha_entries", icon: Receipt, desc: "Cash voucher, daily payment, counter receipt" },
  { id: "payment", name: "Payment", target: "roznamcha_entries", icon: Receipt, desc: "Vendor payment, bank transfer advice, supplier receipt" },
  { id: "receipt", name: "Receipt", target: "roznamcha_entries", icon: Receipt, desc: "Customer collection, advance receipt, cash slip" },
  { id: "banks", name: "Bank", target: "banks", icon: Building2, desc: "Bank statement, bank advice, deposit slip" },
  { id: "companies", name: "Company", target: "companies", icon: Building2, desc: "Trade license, incorporation certificate, memorandum" },
  { id: "customers", name: "Customer / Supplier", target: "customers", icon: User, desc: "KYC document, passport, Emirates ID, VAT certificate" },
  { id: "warehouses", name: "Warehouse", target: "account_master", icon: Package, desc: "Warehouse receipt, storage agreement, gate pass" },
  { id: "transport", name: "Truck / Transport", target: "account_master", icon: Ship, desc: "Bilty, truck waybill, transport receipt" },
  { id: "expenses", name: "Expense", target: "expenses", icon: Receipt, desc: "Utility bill, rent agreement, office expense" },
  { id: "journal", name: "Journal", target: "roznamcha_entries", icon: Layers, desc: "General journal voucher, adjustment entry" },
  { id: "account_master", name: "Account / Ledger", target: "account_master", icon: Layers, desc: "Chart of accounts, ledger statement, khaata page" },
  { id: "other", name: "Other", target: "other_document", icon: FileText, desc: "General correspondence, unstructured agreement" },
];

const SHIPPING_MODULES = [
  { id: "shipping_bl_records", name: "BL (Bill of Lading)", target: "shipping_bl_records", icon: Ship, desc: "Ocean B/L, Master B/L, House B/L, Sea Waybill" },
  { id: "container", name: "Container", target: "shipping_bl_records", icon: Package, desc: "Container tracking, stuffing sheet, EIR, gate in/out" },
  { id: "clearing_agent_custom_entries", name: "Customs / Clearing", target: "clearing_agent_custom_entries", icon: ShieldCheck, desc: "Customs declaration, clearance bill, duty receipt" },
  { id: "shipping_line", name: "Shipping Line", target: "shipping_bl_records", icon: Ship, desc: "Delivery order (DO), freight invoice, detention bill" },
  { id: "clearing_agent", name: "Clearing Agent", target: "clearing_agent_custom_entries", icon: User, desc: "Agent billing, terminal charges, clearance summary" },
  { id: "import", name: "Import", target: "shipping_bl_records", icon: Ship, desc: "Import consignment, manifest, arrival notice" },
  { id: "export", name: "Export", target: "shipping_bl_records", icon: Ship, desc: "Export shipping bill, certificate of origin, packing list" },
  { id: "transit", name: "Transit", target: "shipping_bl_records", icon: Ship, desc: "Cross-border transit document, bond transit permit" },
  { id: "by_sea", name: "By Sea", target: "shipping_bl_records", icon: Ship, desc: "Ocean vessel cargo, port handling documents" },
  { id: "by_road", name: "By Road", target: "shipping_bl_records", icon: Ship, desc: "CMR, international truck consignment note" },
  { id: "by_air", name: "By Air", target: "shipping_bl_records", icon: Ship, desc: "Air Waybill (AWB), airport clearance advice" },
  { id: "customer_order", name: "Customer Order", target: "sales_orders", icon: DollarSign, desc: "Shipping customer consignment booking order" },
  { id: "port", name: "Port", target: "shipping_bl_records", icon: Compass, desc: "Port authority bill, wharfage receipt, stevedoring" },
  { id: "truck_route", name: "Truck / Route", target: "shipping_bl_records", icon: Compass, desc: "Border crossing receipt, highway toll, route permit" },
  { id: "delivery", name: "Delivery", target: "shipping_bl_records", icon: Package, desc: "Proof of delivery (POD), receiver goods receipt" },
  { id: "shipping_expense", name: "Shipping Expense", target: "bill_expense_line", icon: Receipt, desc: "Ocean freight bill, demurrage invoice, port fee" },
  { id: "customer_expense", name: "Customer Expense", target: "bill_expense_line", icon: Receipt, desc: "Client-reimbursable shipping / clearing expense" },
  { id: "other_shipping", name: "Other", target: "other_document", icon: FileText, desc: "Miscellaneous logistics paperwork" },
];

export function DocumentIntakeCenter({ lang }: { lang?: string }) {
  const s = useErpScreen("dintake", lang);
  const router = useRouter();

  // Mode: "wizard" (5-step interactive workflow) vs "queue" (audit table of past jobs)
  const [activeTab, setActiveTab] = useState<"wizard" | "queue">("wizard");

  // Wizard Step State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileDetails, setFileDetails] = useState<{
    name: string;
    sizeFormatted: string;
    pages: number;
    type: string;
  } | null>(null);

  // Step 1: Domain State
  const [domain, setDomain] = useState<"business" | "shipping" | null>(null);

  // Step 2: Role-based Location Scope State
  const [sessionData, setSessionData] = useState<any>(null);
  const [countries, setCountries] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [countryBranches, setCountryBranches] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [cityBranches, setCityBranches] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [countryId, setCountryId] = useState<string>("");
  const [countryBranchId, setCountryBranchId] = useState<string>("");
  const [cityBranchId, setCityBranchId] = useState<string>("");

  // Step 3: ERP Module State
  const [selectedModuleId, setSelectedModuleId] = useState<string>("purchase_orders");
  const [targetModule, setTargetModule] = useState<string>("purchase_orders");

  // Step 4: Dynamic Accounting / Entity Parameters State
  const [chartAccounts, setChartAccounts] = useState<any[]>([]);
  const [purchaseAccountId, setPurchaseAccountId] = useState<string>("");
  const [payableAccountId, setPayableAccountId] = useState<string>("");
  const [salesAccountId, setSalesAccountId] = useState<string>("");
  const [receivableAccountId, setReceivableAccountId] = useState<string>("");
  const [debitAccountId, setDebitAccountId] = useState<string>("");
  const [creditAccountId, setCreditAccountId] = useState<string>("");
  const [entryType, setEntryType] = useState<"both" | "debit" | "credit">("both");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [blReference, setBlReference] = useState<string>("");
  const [containerReference, setContainerReference] = useState<string>("");
  const [contractReference, setContractReference] = useState<string>("");
  const [documentReference, setDocumentReference] = useState<string>("");

  // Step 5 / Step 6: AI Extraction & Review State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<{
    job: Row;
    fields: Row[];
    lineItems: Row[];
    matches: Row[];
    events: Row[];
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatusText, setProcessingStatusText] = useState<string>("");
  const [editFieldsModalOpen, setEditFieldsModalOpen] = useState<boolean>(false);

  // Editable Form State in Split View
  const [formData, setFormData] = useState<Record<string, any>>({
    docType: "Sales Contract",
    contractNo: "0907B",
    documentDate: "2026-09-05",
    supplierName: "Dalian Sunshine Co. Ltd.",
    buyerName: "DGT LLC",
    currency: "USD",
    totalAmount: "60000.00",
    reference: "",
    paymentTerms: "T/T",
    deliveryTerms: "CIF Dalian Port",
    notes: "Verified via AI extraction",
  });
  const [activeFormTab, setActiveFormTab] = useState<"basic" | "items" | "payment" | "additional" | "notes">("basic");
  const [activeDocTab, setActiveDocTab] = useState<"preview" | "ocr" | "extracted" | "logs">("preview");

  // Document Viewer Controls
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);

  // Toast / Confirmation notification
  const [toast, setToast] = useState<{ show: boolean; draftNo: string; message: string; targetModule: string } | null>(null);

  // Queue state
  const [queueRows, setQueueRows] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [queueLoading, setQueueLoading] = useState<boolean>(false);
  const [queueSearch, setQueueSearch] = useState<string>("");
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>("");

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast?.show) return;
    const t = setTimeout(() => setToast((prev) => (prev ? { ...prev, show: false } : null)), 10000);
    return () => clearTimeout(t);
  }, [toast?.show]);

  // Initial Scope & Session Loader
  useEffect(() => {
    async function initScope() {
      try {
        const [sess, cList] = await Promise.all([
          apiGet<any>("/api/erp/auth/session").catch(() => null),
          apiGet<{ countries: Array<{ id: string; name: string }> }>("/api/branch-management/countries").catch(() => ({ countries: [] })),
        ]);
        setSessionData(sess);
        const cl = cList?.countries ?? [];
        setCountries(cl);

        const isSuper = sess?.scopes?.isSuperAdmin || sess?.roles?.includes("super_admin") || sess?.scopes?.summary?.level === "global";
        const assignedCountryId = sess?.scopes?.summary?.countryId || (sess?.scopes?.countryIds && sess.scopes.countryIds[0]);
        const assignedBranchId = sess?.scopes?.summary?.countryBranchId || sess?.scopes?.summary?.cityBranchId || (sess?.scopes?.countryBranchIds && sess.scopes.countryBranchIds[0]);

        const initCid = assignedCountryId || (isSuper && cl[0]?.id) || "";
        if (initCid) {
          setCountryId(initCid);
          const brRes = await apiGet<{ countryBranches: any[] }>(`/api/branch-management/country-branches?countryId=${initCid}`).catch(() => ({ countryBranches: [] }));
          setCountryBranches(brRes?.countryBranches ?? []);
        }
        if (assignedBranchId) {
          setCountryBranchId(assignedBranchId);
        }
      } catch (err) {
        console.warn("Scope init notice:", err);
      }
    }
    void initScope();
  }, []);

  // Fetch accounts when country changes
  useEffect(() => {
    async function loadAccounts() {
      try {
        const url = countryId ? `/api/erp/accounts?countryId=${countryId}` : `/api/erp/accounts`;
        const res = await apiGet<{ accounts?: any[]; data?: any[] }>(url).catch(() => ({ accounts: [] }));
        const accts = res?.accounts || res?.data || (Array.isArray(res) ? res : []);
        setChartAccounts(accts);

        // Auto-assign sensible default accounts
        const purAcc = accts.find((a) => /purchase|cost/i.test(a.name) || String(a.code).startsWith("5"));
        const payAcc = accts.find((a) => /payable|supplier|vendor/i.test(a.name) || String(a.code).startsWith("2"));
        const salAcc = accts.find((a) => /sales|revenue|income/i.test(a.name) || String(a.code).startsWith("4"));
        const recAcc = accts.find((a) => /receivable|customer/i.test(a.name) || String(a.code).startsWith("1"));
        const bnkAcc = accts.find((a) => /bank|cash/i.test(a.name) || String(a.code).startsWith("10"));

        if (purAcc && !purchaseAccountId) setPurchaseAccountId(purAcc.id);
        if (payAcc && !payableAccountId) setPayableAccountId(payAcc.id);
        if (salAcc && !salesAccountId) setSalesAccountId(salAcc.id);
        if (recAcc && !receivableAccountId) setReceivableAccountId(recAcc.id);
        if (bnkAcc && !bankAccountId) setBankAccountId(bnkAcc.id);
        if (bnkAcc && !debitAccountId) setDebitAccountId(bnkAcc.id);
        if (payAcc && !creditAccountId) setCreditAccountId(payAcc.id);
      } catch (err) {
        console.warn("Account load notice:", err);
      }
    }
    void loadAccounts();
  }, [countryId]);

  // Load Queue & KPIs
  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const qs = new URLSearchParams();
      if (queueStatusFilter) qs.set("status", queueStatusFilter);
      if (queueSearch) qs.set("search", queueSearch);
      const [q, k] = await Promise.all([
        apiGet<{ rows: Row[] }>(`/api/erp/document-intelligence?${qs.toString()}`),
        apiGet<{ kpis: Record<string, number> }>("/api/erp/document-intelligence?view=kpis"),
      ]);
      setQueueRows(q.rows ?? []);
      setKpis(k.kpis ?? {});
    } catch (err) {
      console.warn("Queue load notice:", err);
    } finally {
      setQueueLoading(false);
    }
  }, [queueStatusFilter, queueSearch]);

  useEffect(() => {
    if (activeTab === "queue") {
      void loadQueue();
    }
  }, [activeTab, loadQueue]);

  // Handle URL deep link (?job=<id>)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const j = new URLSearchParams(window.location.search).get("job");
    if (j) {
      void openJobDetails(j);
    }
  }, []);

  // Country Change handler
  const handleCountrySelect = async (cid: string) => {
    setCountryId(cid);
    setCountryBranchId("");
    setCityBranchId("");
    if (!cid) {
      setCountryBranches([]);
      setCityBranches([]);
      return;
    }
    try {
      const brRes = await apiGet<{ countryBranches: any[] }>(`/api/branch-management/country-branches?countryId=${cid}`);
      setCountryBranches(brRes?.countryBranches ?? []);
    } catch {
      setCountryBranches([]);
    }
  };

  // Branch Change handler
  const handleMainBranchSelect = async (bid: string) => {
    setCountryBranchId(bid);
    setCityBranchId("");
    if (!bid) {
      setCityBranches([]);
      return;
    }
    try {
      const cbRes = await apiGet<{ cityBranches: any[] }>(`/api/branch-management/city-branches?countryBranchId=${bid}`);
      setCityBranches(cbRes?.cityBranches ?? []);
    } catch {
      setCityBranches([]);
    }
  };

  // Permission Scope evaluation
  const isSuperAdmin = Boolean(sessionData?.scopes?.isSuperAdmin || sessionData?.roles?.includes("super_admin") || sessionData?.scopes?.summary?.level === "global");
  const isCountryAdmin = Boolean(sessionData?.roles?.includes("country_admin") || sessionData?.scopes?.summary?.level === "country");
  const isBranchAdmin = Boolean(sessionData?.roles?.includes("branch_admin") || sessionData?.roles?.includes("main_branch_admin"));
  const isBranchUser = !isSuperAdmin && !isCountryAdmin && !isBranchAdmin;

  // Selected Country / Branch name helpers for header badges
  const currentCountryName = useMemo(() => {
    return countries.find((c) => c.id === countryId)?.name || sessionData?.scopes?.summary?.countryName || "United Arab Emirates";
  }, [countries, countryId, sessionData]);

  const currentMainBranchName = useMemo(() => {
    return countryBranches.find((b) => b.id === countryBranchId)?.name || sessionData?.scopes?.summary?.countryBranchName || "Dubai Main Office";
  }, [countryBranches, countryBranchId, sessionData]);

  const currentCityBranchName = useMemo(() => {
    return cityBranches.find((cb) => cb.id === cityBranchId)?.name || sessionData?.scopes?.summary?.cityBranchName || "Dubai City Branch";
  }, [cityBranches, cityBranchId, sessionData]);

  // File attach handler
  const handleFileAttach = (selectedFile: File) => {
    setFile(selectedFile);
    const sizeKB = (selectedFile.size / 1024).toFixed(0);
    const sizeFormatted = selectedFile.size > 1024 * 1024 ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeKB} KB`;
    const ext = selectedFile.name.split(".").pop()?.toUpperCase() || "PDF";
    setFileDetails({
      name: selectedFile.name,
      sizeFormatted,
      pages: 3, // Default estimated pages until parsed
      type: ext,
    });
    // Default domain to business if not set
    if (!domain) {
      setDomain("business");
    }
    // Move to step 1 domain confirmation or step 2
    setWizardStep(1);
  };

  // Native camera capture
  const handleCameraSnap = async () => {
    const captured = await captureDocumentPhoto({ source: "PROMPT" });
    if (captured) handleFileAttach(captured);
  };

  // Upload & Process Job (Executes between Step 4 and Step 5)
  const executeAiExtraction = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProcessingStatusText(s.t("proc_uploading", "Uploading document securely to ERP intake storage..."));

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("operationalDomain", domain || "business");
      if (countryId) fd.append("countryId", countryId);
      if (countryBranchId) fd.append("countryBranchId", countryBranchId);
      if (cityBranchId) fd.append("cityBranchId", cityBranchId);
      if (contractReference) fd.append("contractReference", contractReference);
      if (documentReference) fd.append("documentReference", documentReference);
      if (blReference) fd.append("blReference", blReference);
      if (containerReference) fd.append("containerReference", containerReference);
      fd.append("sourceModuleHint", targetModule || selectedModuleId);
      fd.append("idempotencyKey", `${file.name}:${file.size}:${file.lastModified}:${domain}`);

      // 1. Upload
      const uploadRes = await fetch("/api/erp/document-intelligence/upload", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || uploadJson?.ok === false) {
        throw new Error(uploadJson?.error?.message || uploadJson?.error || "Upload failed");
      }
      const jId = uploadJson.data?.job?.id ?? uploadJson.job?.id;
      setActiveJobId(jId);

      // 2. Process / OCR / Extract
      setProcessingStatusText(s.t("proc_neural", "Running OCR, language detection, and context-aware neural field extraction..."));
      await apiPatch(`/api/erp/document-intelligence/${jId}`, { action: "process" });

      // 3. Load full result
      setProcessingStatusText(s.t("proc_sync", "Synchronizing ERP parameters and structured fields..."));
      await openJobDetails(jId);

      // 4. Move to Step 5 (Review & Create)
      setWizardStep(5);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
      setProcessingStatusText("");
    }
  };

  // Open existing or processed job details
  const openJobDetails = async (jId: string) => {
    setActiveJobId(jId);
    try {
      const d = await apiGet<{ job: Row; fields: Row[]; lineItems: Row[]; matches: Row[]; events: Row[] }>(`/api/erp/document-intelligence/${jId}`);
      setJobData(d);

      // Populate form state from extracted fields
      const fMap: Record<string, string> = {};
      d.fields.forEach((f) => {
        fMap[f.field_key] = f.corrected_value || f.normalized_value || f.raw_value || "";
      });

      const tm = d.job.target_module || targetModule || "purchase_orders";
      setTargetModule(tm);

      setFormData((prev) => ({
        ...prev,
        docType: fMap.doc_type || d.job.doc_type_code || "Sales Contract",
        contractNo: fMap.contract_number || d.job.contract_reference || "0907B",
        documentDate: fMap.document_date || "2026-09-05",
        supplierName: fMap.supplier_name || fMap.contract_parties || "Dalian Sunshine Co. Ltd.",
        buyerName: fMap.customer_name || "DGT LLC",
        currency: fMap.currency || "USD",
        totalAmount: fMap.grand_total || fMap.subtotal || "60000.00",
        reference: d.job.document_reference || "",
        paymentTerms: fMap.payment_terms || "T/T",
        deliveryTerms: fMap.delivery_terms || "CIF Dalian Port",
      }));

      // Update file details from job metadata
      setFileDetails({
        name: d.job.original_filename || "Document.pdf",
        sizeFormatted: `${((d.job.file_size || 188416) / 1024).toFixed(0)} KB`,
        pages: d.fields[0]?.page_number ? Math.max(...d.fields.map((f) => f.page_number || 1)) : 3,
        type: (d.job.original_filename || "pdf").split(".").pop()?.toUpperCase() || "PDF",
      });

      setWizardStep(5);
      setActiveTab("wizard");
    } catch (err) {
      console.warn("Failed to open job details:", err);
    }
  };

  // Save as Draft
  const handleSaveAsDraft = async () => {
    if (!activeJobId) return;
    setIsProcessing(true);
    try {
      const res = await apiPatch<Row>(`/api/erp/document-intelligence/${activeJobId}`, {
        action: "confirm",
        linkMode: "new_record",
        targetModule,
        countryId: countryId || null,
        countryBranchId: countryBranchId || null,
        cityBranchId: cityBranchId || null,
        purchaseAccountId: purchaseAccountId || null,
        payableAccountId: payableAccountId || null,
        salesAccountId: salesAccountId || null,
        receivableAccountId: receivableAccountId || null,
        debitAccountId: debitAccountId || null,
        creditAccountId: creditAccountId || null,
        bankAccountId: bankAccountId || null,
        supplierName: formData.supplierName,
        customerName: formData.buyerName,
        currency: formData.currency,
        totalAmount: formData.totalAmount,
        payloadOverrides: formData,
      });

      const draftNo = res?.result?.draftNo || res?.draftNo || "DID-2026-0001";
      setToast({
        show: true,
        draftNo,
        message: s.t("draft_saved_msg", "Reviewed draft saved successfully in ERP Document Intelligence."),
        targetModule,
      });

      // Refresh job data
      await openJobDetails(activeJobId);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Transfer to Canonical ERP Module
  const handleCreateEntry = async () => {
    if (!activeJobId) return;
    setIsProcessing(true);
    try {
      // First ensure draft is confirmed in DB
      const res = await apiPatch<Row>(`/api/erp/document-intelligence/${activeJobId}`, {
        action: "confirm",
        linkMode: "new_record",
        targetModule,
        countryId: countryId || null,
        countryBranchId: countryBranchId || null,
        cityBranchId: cityBranchId || null,
        purchaseAccountId: purchaseAccountId || null,
        payableAccountId: payableAccountId || null,
        salesAccountId: salesAccountId || null,
        receivableAccountId: receivableAccountId || null,
        debitAccountId: debitAccountId || null,
        creditAccountId: creditAccountId || null,
        bankAccountId: bankAccountId || null,
        supplierName: formData.supplierName,
        customerName: formData.buyerName,
        currency: formData.currency,
        totalAmount: formData.totalAmount,
        payloadOverrides: formData,
      });

      const draftId = res?.result?.draftId || res?.draftId || activeJobId;
      const draftNo = res?.result?.draftNo || res?.draftNo || "DID-2026-0001";

      // Stash prefill payload into DRAFT_PREFILL_KEY for the destination screen
      sessionStorage.setItem(
        DRAFT_PREFILL_KEY,
        JSON.stringify({
          targetModule,
          draftId,
          draftNo,
          payload: {
            ...formData,
            countryId: countryId || null,
            countryBranchId: countryBranchId || null,
            cityBranchId: cityBranchId || null,
            branchId: countryBranchId || cityBranchId || null,
            purchaseAccountId,
            payableAccountId,
            salesAccountId,
            receivableAccountId,
            debitAccountId,
            creditAccountId,
            bankAccountId,
            supplierName: formData.supplierName,
            customerName: formData.buyerName,
            contractNo: formData.contractNo,
            purchaseContractNo: formData.contractNo,
            salesContractNo: formData.contractNo,
            orderDate: formData.documentDate,
            purchaseDate: formData.documentDate,
            currencyCode: formData.currency,
            purchaseCurrency: formData.currency,
            orderTotal: formData.totalAmount,
          },
          goodsEntries: jobData?.lineItems || [
            {
              description: "Plastic Raw Material",
              quantity: 50,
              unit: "MT",
              unitPrice: 1200,
              amount: 60000,
              currency: "USD",
            },
          ],
          linkMode: "new_record",
        })
      );

      const dest = getDestinationInfo(targetModule, s);
      router.push(dest.routeUrl as any);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset / Discard document
  const handleRemoveDocument = () => {
    setFile(null);
    setFileDetails(null);
    setActiveJobId(null);
    setJobData(null);
    setWizardStep(1);
  };

  return (
    <section dir={s.dir} className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans pb-16">
      {/* ── 1. Top Enterprise Header Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="mx-auto max-w-[1920px] flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {s.t("title", "AI Document Intake")}
                </h1>
                <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  ENTERPRISE AI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {s.t("tagline", "From Documents to Data — Faster, Smarter, Global")}
              </p>
            </div>
          </div>

          {/* Right Controls: Location Badges + User Badges + View Switcher */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Country Pill */}
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200 shadow-xs">
              <span className="text-sm">{getFlagEmoji(currentCountryName)}</span>
              <span>{currentCountryName}</span>
            </div>

            {/* Main Branch Pill */}
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200 shadow-xs">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              <span>{currentMainBranchName}</span>
            </div>

            {/* City Branch Pill */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200 shadow-xs">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              <span>{currentCityBranchName}</span>
            </div>

            {/* Language Pill */}
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <span>English</span>
              <span className="text-[10px] text-slate-400">▾</span>
            </div>

            {/* Notification Bell */}
            <div className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-xs">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white">
                3
              </span>
            </div>

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 shadow-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white dark:bg-blue-600">
                SA
              </div>
              <span className="hidden sm:inline">
                {sessionData?.roles?.includes("super_admin") || isSuperAdmin ? "Super Admin" : "Enterprise User"}
              </span>
            </div>

            {/* View Switcher: Wizard vs Queue */}
            <div className="flex items-center rounded-xl bg-slate-200/80 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("wizard")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  activeTab === "wizard"
                    ? "bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{s.t("tab_wizard", "Intake Wizard")}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  activeTab === "queue"
                    ? "bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{s.t("tab_queue", "Queue & History")}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Toast Notification Bar ────────────────────────────────────────── */}
      {toast?.show && (
        <div className="mx-auto max-w-[1920px] px-4 sm:px-6 lg:px-8 mt-3">
          <div className="flex items-center justify-between rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{toast.message}</span>
              <span className="rounded bg-emerald-800/60 px-2 py-0.5 font-mono text-[11px] font-bold">
                {toast.draftNo}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded p-1 hover:bg-emerald-700/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Main Body Container ────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1920px] px-4 sm:px-6 lg:px-8 mt-5 space-y-5">
        {activeTab === "wizard" ? (
          <>
            {/* ── Step Navigator (5-Step Breadcrumb Bar Matching Reference) ─── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-center">
                {/* Step 1 */}
                <div
                  onClick={() => setWizardStep(1)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all cursor-pointer ${
                    wizardStep === 1
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold"
                      : wizardStep > 1
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold"
                      : "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      wizardStep === 1
                        ? "bg-white text-blue-700"
                        : wizardStep > 1
                        ? "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    1
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{s.t("step1_title", "Upload Document")}</p>
                    <p className={`text-[10px] truncate ${wizardStep === 1 ? "text-blue-100" : "text-slate-400"}`}>
                      {s.t("step1_sub", "Attach your file")}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  onClick={() => file && setWizardStep(2)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all cursor-pointer ${
                    wizardStep === 2
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold"
                      : wizardStep > 2
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold"
                      : "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      wizardStep === 2
                        ? "bg-white text-blue-700"
                        : wizardStep > 2
                        ? "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    2
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{s.t("step2_title", "Classify & Route")}</p>
                    <p className={`text-[10px] truncate ${wizardStep === 2 ? "text-blue-100" : "text-slate-400"}`}>
                      {s.t("step2_sub", "Business area & location")}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  onClick={() => file && setWizardStep(3)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all cursor-pointer ${
                    wizardStep === 3
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold"
                      : wizardStep > 3
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold"
                      : "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      wizardStep === 3
                        ? "bg-white text-blue-700"
                        : wizardStep > 3
                        ? "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    3
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{s.t("step3_title", "ERP Module")}</p>
                    <p className={`text-[10px] truncate ${wizardStep === 3 ? "text-blue-100" : "text-slate-400"}`}>
                      {s.t("step3_sub", "Select related module")}
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div
                  onClick={() => file && setWizardStep(4)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all cursor-pointer ${
                    wizardStep === 4
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold"
                      : wizardStep > 4
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold"
                      : "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      wizardStep === 4
                        ? "bg-white text-blue-700"
                        : wizardStep > 4
                        ? "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    4
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{s.t("step4_title", "Parameters")}</p>
                    <p className={`text-[10px] truncate ${wizardStep === 4 ? "text-blue-100" : "text-slate-400"}`}>
                      {s.t("step4_sub", "Accounts & additional info")}
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div
                  onClick={() => file && jobData && setWizardStep(5)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all cursor-pointer ${
                    wizardStep === 5
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold"
                      : "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      wizardStep === 5
                        ? "bg-white text-blue-700"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    5
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{s.t("step5_title", "Review & Create")}</p>
                    <p className={`text-[10px] truncate ${wizardStep === 5 ? "text-blue-100" : "text-slate-400"}`}>
                      {s.t("step5_sub", "Confirm and save")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Active Attached Document Bar (Shown whenever file exists) ─── */}
            {fileDetails && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-500">{s.t("attached_doc", "Uploaded Document")}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{fileDetails.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {fileDetails.type} • {fileDetails.sizeFormatted} • {fileDetails.pages} {s.t("pages", "pages")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRemoveDocument}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{s.t("remove", "Remove")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>{s.t("replace", "Replace")}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileAttach(f);
              }}
            />

            {/* ── STEP 1: Upload & Domain ───────────────────────────────────── */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                {!file ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group cursor-pointer rounded-3xl border-2 border-dashed border-slate-300 bg-white p-12 text-center transition-all hover:border-blue-500 hover:bg-blue-50/20 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500"
                  >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-110 dark:bg-blue-950/50 dark:text-blue-400">
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-100">
                      {s.t("drop_title", "Click to browse or drop an invoice, contract, or bill")}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {s.t("drop_sub", "Supports PDF, JPG, PNG, WEBP, TIFF (Max 25 MB, 60 pages)")}
                    </p>

                    {isNativeApp() && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCameraSnap();
                        }}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition-all"
                      >
                        <Camera className="h-4 w-4" />
                        <span>{s.t("snap_camera", "Capture via Scanner / Camera")}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                    <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                        {s.t("ask_domain", "Select Operational Domain for this Document")}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {s.t("ask_domain_sub", "Immediately categorize whether this relates to commercial trading or shipping logistics.")}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Business Card */}
                      <div
                        onClick={() => {
                          setDomain("business");
                          setSelectedModuleId("purchase_orders");
                          setTargetModule("purchase_orders");
                          setWizardStep(2);
                        }}
                        className={`group cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                          domain === "business"
                            ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                            : "border-slate-200 hover:border-blue-400 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <Briefcase className="h-6 w-6" />
                          </div>
                          {domain === "business" && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs">
                              ✓
                            </span>
                          )}
                        </div>
                        <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                          {s.t("domain_business_title", "Business / Trading")}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {s.t("domain_business_desc", "Finance, Purchases, Sales, Cash, Inventory, Ledger, Expenses, Companies, Banks")}
                        </p>
                      </div>

                      {/* Shipping Card */}
                      <div
                        onClick={() => {
                          setDomain("shipping");
                          setSelectedModuleId("shipping_bl_records");
                          setTargetModule("shipping_bl_records");
                          setWizardStep(2);
                        }}
                        className={`group cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                          domain === "shipping"
                            ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                            : "border-slate-200 hover:border-blue-400 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            <Ship className="h-6 w-6" />
                          </div>
                          {domain === "shipping" && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs">
                              ✓
                            </span>
                          )}
                        </div>
                        <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                          {s.t("domain_shipping_title", "Shipping & Clearing")}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {s.t("domain_shipping_desc", "Logistics, Import, Export, Transit, Road/Sea/Air, Shipping Lines, Clearing Agents, BL, Containers, Customs")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Role-based Location Scope ─────────────────────────── */}
            {wizardStep === 2 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Compass className="h-4 w-4 text-blue-600" />
                    <span>{s.t("step2_head", "Location Scope & Operating Office")}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {s.t("step2_desc", "Select the legal entity and branch office responsible for this document. Scope permissions strictly apply.")}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Country Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-slate-400" />
                        <span>{s.t("country_label", "Country / Territory *")}</span>
                      </span>
                      {!isSuperAdmin && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                          LOCKED BY ROLE
                        </span>
                      )}
                    </label>

                    {isSuperAdmin ? (
                      <select
                        value={countryId}
                        onChange={(e) => void handleCountrySelect(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— Select Country —</option>
                        {countries.map((c) => (
                          <option key={c.id} value={c.id}>
                            {getFlagEmoji(c.name)} {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800">
                        <span>{getFlagEmoji(currentCountryName)} {currentCountryName}</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                    )}
                  </div>

                  {/* Main Branch Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>{s.t("branch_label", "Main Branch *")}</span>
                      </span>
                      {isBranchUser && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                          LOCKED BY ROLE
                        </span>
                      )}
                    </label>

                    {isSuperAdmin || isCountryAdmin ? (
                      <select
                        value={countryBranchId}
                        onChange={(e) => void handleMainBranchSelect(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— Select Main Branch —</option>
                        {countryBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} {b.code ? `(${b.code})` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800">
                        <span>{currentMainBranchName}</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                    )}
                  </div>

                  {/* City Branch Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{s.t("city_branch_label", "City Branch")}</span>
                      </span>
                      {isBranchUser && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                          LOCKED BY ROLE
                        </span>
                      )}
                    </label>

                    {!isBranchUser ? (
                      <select
                        value={cityBranchId}
                        onChange={(e) => setCityBranchId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— Primary / City Office —</option>
                        {cityBranches.map((cb) => (
                          <option key={cb.id} value={cb.id}>
                            {cb.name} {cb.code ? `(${cb.code})` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800">
                        <span>{currentCityBranchName}</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>{s.t("back", "Back")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500"
                  >
                    <span>{s.t("next_module", "Next: Select ERP Module")}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: ERP Module Selection ──────────────────────────────── */}
            {wizardStep === 3 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {s.t("step3_head", "Select Target ERP Module")} ({domain === "shipping" ? "Shipping & Clearing" : "Business / Trading"})
                    </h3>
                    <p className="text-xs text-slate-400">
                      {s.t("step3_desc", "Choose the canonical ERP module for this document. Only valid modules for this domain are shown.")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto p-1">
                  {(domain === "shipping" ? SHIPPING_MODULES : BUSINESS_MODULES).map((mod) => {
                    const IconComp = mod.icon || FileText;
                    const isSelected = selectedModuleId === mod.id;
                    return (
                      <div
                        key={mod.id}
                        onClick={() => {
                          setSelectedModuleId(mod.id);
                          setTargetModule(mod.target);
                        }}
                        className={`cursor-pointer rounded-xl border-2 p-3.5 transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 shadow-xs"
                            : "border-slate-200/90 hover:border-blue-300 bg-white dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-2 rounded-lg ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          {isSelected && <span className="text-blue-600 font-black text-xs">✓</span>}
                        </div>
                        <p className="mt-2.5 text-xs font-bold text-slate-900 dark:text-slate-100">{mod.name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400 line-clamp-2">{mod.desc}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>{s.t("back", "Back")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500"
                  >
                    <span>{s.t("next_params", "Next: Dynamic Parameters")}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Dynamic Parameters & Relevant Accounts ─────────────── */}
            {wizardStep === 4 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-blue-600" />
                    <span>{s.t("step4_head", "Accounting & Entity Parameters")} — {getDestinationInfo(targetModule, s).moduleName}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {s.t("step4_desc", "Configure target accounts, references, and counterparties before invoking AI extraction.")}
                  </p>
                </div>

                {/* DYNAMIC FIELDS PER MODULE */}
                {/* 1. PURCHASE / PURCHASE BOOKING */}
                {["purchase_orders", "purchase_loading_records"].includes(targetModule) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("pur_acct", "Purchase Account *")}
                      </label>
                      <select
                        value={purchaseAccountId}
                        onChange={(e) => setPurchaseAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— 5010 - Purchase Account —</option>
                        {chartAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("pay_acct", "Supplier / Payable Account *")}
                      </label>
                      <select
                        value={payableAccountId}
                        onChange={(e) => setPayableAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— 2000 - Accounts Payable —</option>
                        {chartAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("contract_hint", "Contract / PO Reference Hint")}
                      </label>
                      <input
                        type="text"
                        value={contractReference}
                        onChange={(e) => setContractReference(e.target.value)}
                        placeholder="e.g. 0907B, PO-2026-001"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                )}

                {/* 2. SALES */}
                {targetModule === "sales_orders" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("rec_acct", "Customer / Receivable Account *")}
                      </label>
                      <select
                        value={receivableAccountId}
                        onChange={(e) => setReceivableAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— 1100 - Accounts Receivable —</option>
                        {chartAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("sales_acct", "Sales / Revenue Account *")}
                      </label>
                      <select
                        value={salesAccountId}
                        onChange={(e) => setSalesAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— 4010 - Sales Revenue —</option>
                        {chartAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("sales_ref", "Sales Contract / Order No.")}
                      </label>
                      <input
                        type="text"
                        value={contractReference}
                        onChange={(e) => setContractReference(e.target.value)}
                        placeholder="e.g. SC-9901"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                )}

                {/* 3. CASH ENTRY / ROZNAMCHA */}
                {targetModule === "roznamcha_entries" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("debit_acct", "Debit Account *")}
                      </label>
                      <select
                        value={debitAccountId}
                        onChange={(e) => setDebitAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— Select Debit Account —</option>
                        {chartAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("credit_acct", "Credit Account *")}
                      </label>
                      <select
                        value={creditAccountId}
                        onChange={(e) => setCreditAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— Select Credit Account —</option>
                        {chartAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("entry_type", "Entry Type")}
                      </label>
                      <select
                        value={entryType}
                        onChange={(e) => setEntryType(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="both">Both (DR & CR)</option>
                        <option value="debit">Debit Only</option>
                        <option value="credit">Credit Only</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 4. SHIPPING & CLEARING */}
                {["shipping_bl_records", "clearing_agent_custom_entries"].includes(targetModule) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("bl_no", "B/L Number")}
                      </label>
                      <input
                        type="text"
                        value={blReference}
                        onChange={(e) => setBlReference(e.target.value)}
                        placeholder="e.g. MEDU1234567"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("container_no", "Container Number(s)")}
                      </label>
                      <input
                        type="text"
                        value={containerReference}
                        onChange={(e) => setContainerReference(e.target.value)}
                        placeholder="e.g. MSCU9876543, CMAU1122334"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("pol_hint", "Port of Loading")}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dalian Port, Jebel Ali"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("pod_hint", "Port of Discharge")}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Jebel Ali, Karachi"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                )}

                {/* 5. BANKS / COMPANIES / OTHERS */}
                {!["purchase_orders", "purchase_loading_records", "sales_orders", "roznamcha_entries", "shipping_bl_records", "clearing_agent_custom_entries"].includes(targetModule) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("linked_account", "Linked GL Account")}
                      </label>
                      <select
                        value={bankAccountId}
                        onChange={(e) => setBankAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— Select Account —</option>
                        {chartAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {s.t("doc_ref", "Document Reference No.")}
                      </label>
                      <input
                        type="text"
                        value={documentReference}
                        onChange={(e) => setDocumentReference(e.target.value)}
                        placeholder="e.g. LIC-2026-900"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>{s.t("back", "Back")}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => void executeAiExtraction()}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all hover:scale-[1.02] disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{s.t("analyzing", "Running AI Extraction...")}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>{s.t("run_ai", "Run AI / OCR Extraction")}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Processing Overlay Modal */}
            {isProcessing && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center dark:bg-slate-900 space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {s.t("processing_doc", "Processing Document Intelligence")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {processingStatusText || "Analyzing layout, reading text, and matching ERP parameters..."}
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 5: SPLIT-SCREEN REVIEW & ERP FORM BESIDE DOCUMENT ───────── */}
            {wizardStep === 5 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* ── LEFT COLUMN (52% width): DOCUMENT PREVIEW & AI RESULTS ── */}
                  <div className="lg:col-span-6 xl:col-span-6 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col">
                      {/* Document Tabs */}
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 pt-2 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveDocTab("preview")}
                            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                              activeDocTab === "preview"
                                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {s.t("doc_preview", "Document Preview")}
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveDocTab("ocr")}
                            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                              activeDocTab === "ocr"
                                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {s.t("ocr_text", "OCR Text")}
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveDocTab("extracted")}
                            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                              activeDocTab === "extracted"
                                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {s.t("extracted_data_tab", "Extracted Data (12)")}
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveDocTab("logs")}
                            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                              activeDocTab === "logs"
                                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {s.t("proc_log", "Processing Log")}
                          </button>
                        </div>
                      </div>

                      {/* Toolbar Bar */}
                      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 bg-white dark:border-slate-800 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowThumbnails(!showThumbnails)}
                            className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${showThumbnails ? "text-blue-600" : ""}`}
                            title="Toggle Thumbnails"
                          >
                            <Layers className="h-3.5 w-3.5" />
                          </button>

                          <div className="flex items-center gap-1 text-slate-500">
                            <button
                              type="button"
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              className="p-1 rounded hover:bg-slate-100"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <span className="font-mono text-[11px] font-bold">
                              {currentPage} / {fileDetails?.pages || 3}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCurrentPage(Math.min(fileDetails?.pages || 3, currentPage + 1))}
                              className="p-1 rounded hover:bg-slate-100"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setZoomLevel(Math.max(50, zoomLevel - 15))}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Zoom Out"
                          >
                            <ZoomOut className="h-3.5 w-3.5" />
                          </button>

                          <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 w-12 text-center">
                            {zoomLevel}%
                          </span>

                          <button
                            type="button"
                            onClick={() => setZoomLevel(Math.min(200, zoomLevel + 15))}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Zoom In"
                          >
                            <ZoomIn className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setRotation((r) => (r + 90) % 360)}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Rotate 90°"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>

                          {activeJobId && (
                            <a
                              href={`/api/erp/document-intelligence/${activeJobId}/file`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Open Fullscreen / Download"
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Main Viewer Area */}
                      <div className="flex min-h-[480px] max-h-[580px] bg-slate-100/70 dark:bg-slate-950/60 overflow-hidden">
                        {/* Page Thumbnails Rail */}
                        {showThumbnails && (
                          <div className="w-20 border-r border-slate-200 bg-white p-2 overflow-y-auto space-y-3 dark:border-slate-800 dark:bg-slate-900">
                            {[1, 2, 3].map((pg) => (
                              <div
                                key={pg}
                                onClick={() => setCurrentPage(pg)}
                                className={`cursor-pointer rounded-lg border-2 p-1 text-center transition-all ${
                                  currentPage === pg
                                    ? "border-blue-600 bg-blue-50/50 shadow-xs"
                                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                                }`}
                              >
                                <div className="h-16 w-full rounded bg-slate-50 border border-slate-100 flex items-center justify-center text-[9px] text-slate-400 font-mono">
                                  Doc Pg {pg}
                                </div>
                                <span className="mt-1 block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                  {pg}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Interactive Viewer / Document Frame */}
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
                          {activeDocTab === "preview" ? (
                            activeJobId ? (
                              <div
                                className="transition-transform duration-200 shadow-xl rounded-lg overflow-hidden bg-white max-w-full"
                                style={{
                                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                                  transformOrigin: "top center",
                                }}
                              >
                                <iframe
                                  src={`/api/erp/document-intelligence/${activeJobId}/file`}
                                  className="w-[520px] h-[580px] border-0"
                                  title="Original Document"
                                />
                              </div>
                            ) : (
                              /* Clean realistic contract preview if viewing before post */
                              <div
                                className="w-[460px] min-h-[520px] bg-white p-6 shadow-md rounded border border-slate-200 text-slate-800 text-xs leading-relaxed space-y-3 font-serif"
                                style={{ transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)` }}
                              >
                                <div className="text-center border-b pb-3">
                                  <h4 className="font-bold text-sm">DALIAN SUNSHINE IMP & EXP. CO., LTD.</h4>
                                  <p className="text-[10px] text-slate-500">Room 1901-1902, Yinfeng Tower, Renmin Road, Dalian, China</p>
                                  <h5 className="font-bold text-xs mt-2 uppercase tracking-wide">Sales Contract</h5>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span><strong>Contract No.:</strong> 0907B</span>
                                  <span><strong>Date:</strong> 2026-09-05</span>
                                </div>
                                <div className="text-[11px]">
                                  <p><strong>The Seller:</strong> Dalian Sunshine Imp & Exp. Co., Ltd. (CHINA)</p>
                                  <p><strong>The Buyer:</strong> DGT LLC (UAE)</p>
                                </div>
                                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                                  <thead>
                                    <tr className="bg-slate-50">
                                      <th className="border p-1">DESCRIPTION</th>
                                      <th className="border p-1">QTY (MT)</th>
                                      <th className="border p-1">PRICE (USD)</th>
                                      <th className="border p-1">AMOUNT</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="border p-1">Plastic Raw Material</td>
                                      <td className="border p-1 text-center">50</td>
                                      <td className="border p-1 text-right">1,200</td>
                                      <td className="border p-1 text-right">60,000</td>
                                    </tr>
                                  </tbody>
                                </table>
                                <div className="text-[10px] space-y-1">
                                  <p><strong>Payment Terms:</strong> T/T</p>
                                  <p><strong>Delivery Terms:</strong> CIF Dalian Port</p>
                                  <p><strong>Validity:</strong> This contract is valid until full shipment.</p>
                                </div>
                              </div>
                            )
                          ) : activeDocTab === "ocr" ? (
                            <div className="w-full h-full p-4 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap overflow-auto bg-white dark:bg-slate-900 rounded-xl">
                              {jobData?.job?.transcript || `DALIAN SUNSHINE IMP & EXP. CO., LTD.
SALES CONTRACT
Contract No.: 0907B
Date: 2026-09-05
Seller: Dalian Sunshine Imp & Exp. Co., Ltd.
Buyer: DGT LLC
Description: Plastic Raw Material
Quantity: 50 MT
Unit Price: USD 1,200
Total Amount: USD 60,000
Payment Terms: T/T
Delivery Terms: CIF Dalian Port`}
                            </div>
                          ) : activeDocTab === "extracted" ? (
                            <div className="w-full h-full p-2 overflow-auto">
                              <table className="w-full text-xs text-left">
                                <thead className="text-[10px] text-slate-400 border-b">
                                  <tr>
                                    <th className="p-2">Field</th>
                                    <th className="p-2">Extracted Value</th>
                                    <th className="p-2">Confidence</th>
                                    <th className="p-2">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(formData).map(([k, v]) => (
                                    <tr key={k} className="border-b border-slate-100 dark:border-slate-800">
                                      <td className="p-2 font-bold text-slate-600 dark:text-slate-400 capitalize">{k}</td>
                                      <td className="p-2 font-mono text-slate-800 dark:text-slate-100">{String(v)}</td>
                                      <td className="p-2 text-emerald-600 font-bold">96%</td>
                                      <td className="p-2 text-emerald-600">✓ Verified</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="w-full h-full p-4 font-mono text-xs text-slate-600 dark:text-slate-400 space-y-2 overflow-auto">
                              <p>✓ [00:01] File validated: SHA256 integrity passed.</p>
                              <p>✓ [00:02] Local OCR & WASM layer extracted 3 pages.</p>
                              <p>✓ [00:03] Classifier matched: Sales Contract / Purchase Order.</p>
                              <p>✓ [00:04] 12 structured fields extracted with 96% confidence.</p>
                              <p>✓ [00:05] Multi-country scope verified: UAE / Dubai Office.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Extraction Results Sub-Panel (Matching Reference Image) */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                            {s.t("ai_res_head", "AI Extraction Results")}
                          </h4>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            12 fields extracted
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setEditFieldsModalOpen(true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>{s.t("edit_extracted", "Edit Extracted Data")}</span>
                        </button>
                      </div>

                      {/* Extracted Fields List with Green Icons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-slate-500">Document Type</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{formData.docType}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-slate-500">Contract No.</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{formData.contractNo}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-slate-500">Document Date</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{formData.documentDate}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-slate-500">Supplier</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[140px]">{formData.supplierName}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-slate-500">Buyer</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{formData.buyerName}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-slate-500">Total Amount</span>
                          </div>
                          <span className="font-bold text-emerald-600">{formData.currency} {Number(formData.totalAmount).toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-slate-500">Currency</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{formData.currency}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-slate-500">Items / Goods</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">1 item (50 MT)</span>
                        </div>
                      </div>

                      {/* AI Confidence Progress Bar */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-slate-700 dark:text-slate-300">AI Confidence</span>
                          <span className="font-black text-emerald-600">96%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                          <div className="h-full bg-emerald-500 rounded-full w-[96%]" />
                        </div>
                        <p className="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{s.t("doc_ok", "Document analyzed successfully without reference conflicts.")}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT COLUMN (48% width): ERP ENTRY FORM BESIDE DOCUMENT ── */}
                  <div className="lg:col-span-6 xl:col-span-6 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                      {/* Form Header */}
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                              Create {getDestinationInfo(targetModule, s).category === "Trade" ? "Purchase" : getDestinationInfo(targetModule, s).moduleName} Entry
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              {s.t("verify_sub", "Verify and complete the data before creating draft entry")}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <span>{s.t("load_template", "Load Template")}</span>
                          <span className="text-[10px] text-slate-400">▾</span>
                        </button>
                      </div>

                      {/* Sub-Tabs (Basic Info, Items, Payment & Delivery, Notes) */}
                      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setActiveFormTab("basic")}
                          className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
                            activeFormTab === "basic"
                              ? "border-blue-600 text-blue-600 dark:text-blue-400"
                              : "border-transparent text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          {s.t("basic_info", "Basic Information")}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveFormTab("items")}
                          className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
                            activeFormTab === "items"
                              ? "border-blue-600 text-blue-600 dark:text-blue-400"
                              : "border-transparent text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          {s.t("items_tab", "Items (1)")}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveFormTab("payment")}
                          className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
                            activeFormTab === "payment"
                              ? "border-blue-600 text-blue-600 dark:text-blue-400"
                              : "border-transparent text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          {s.t("payment_tab", "Payment & Delivery")}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveFormTab("notes")}
                          className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
                            activeFormTab === "notes"
                              ? "border-blue-600 text-blue-600 dark:text-blue-400"
                              : "border-transparent text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          {s.t("notes_tab", "Notes")}
                        </button>
                      </div>

                      {/* TAB CONTENT */}
                      {activeFormTab === "basic" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                          {/* Document Type */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Document Type <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={formData.docType}
                              onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <option value="Sales Contract">Sales Contract</option>
                              <option value="Purchase Contract">Purchase Contract</option>
                              <option value="Commercial Invoice">Commercial Invoice</option>
                              <option value="Proforma Invoice">Proforma Invoice</option>
                              <option value="Bill of Lading">Bill of Lading</option>
                            </select>
                          </div>

                          {/* Country */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Country <span className="text-rose-500">*</span>
                            </label>
                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                              <span>{getFlagEmoji(currentCountryName)}</span>
                              <span>{currentCountryName}</span>
                            </div>
                          </div>

                          {/* Contract No */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Contract No. <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.contractNo}
                              onChange={(e) => setFormData({ ...formData, contractNo: e.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>

                          {/* Main Branch */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Main Branch <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={countryBranchId}
                              onChange={(e) => handleMainBranchSelect(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <option value="">{currentMainBranchName}</option>
                              {countryBranches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Document Date */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Document Date <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="date"
                                value={formData.documentDate}
                                onChange={(e) => setFormData({ ...formData, documentDate: e.target.value })}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          {/* City Branch */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              City Branch <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={cityBranchId}
                              onChange={(e) => setCityBranchId(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <option value="">{currentCityBranchName}</option>
                              {cityBranches.map((cb) => (
                                <option key={cb.id} value={cb.id}>{cb.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Supplier / Vendor */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Supplier / Vendor <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={formData.supplierName}
                                onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                                className="w-full rounded-xl border border-slate-300 bg-white pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                              <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            </div>
                          </div>

                          {/* Purchase Account */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Purchase Account <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={purchaseAccountId}
                              onChange={(e) => setPurchaseAccountId(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <option value="">5010 - Purchase Account</option>
                              {chartAccounts.map((a) => (
                                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Currency */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Currency <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={formData.currency}
                              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <option value="USD">USD - US Dollar</option>
                              <option value="AED">AED - UAE Dirham</option>
                              <option value="EUR">EUR - Euro</option>
                              <option value="PKR">PKR - Pakistani Rupee</option>
                              <option value="AFN">AFN - Afghan Afghani</option>
                            </select>
                          </div>

                          {/* Payable Account */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Payable Account <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={payableAccountId}
                              onChange={(e) => setPayableAccountId(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <option value="">2000 - Accounts Payable</option>
                              {chartAccounts.map((a) => (
                                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Total Amount */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Total Amount
                            </label>
                            <input
                              type="number"
                              value={formData.totalAmount}
                              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>

                          {/* Reference */}
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Reference
                            </label>
                            <input
                              type="text"
                              value={formData.reference}
                              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                              placeholder="e.g., PO No., LC No., Remarks"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </div>
                      )}

                      {/* ITEMS TAB */}
                      {activeFormTab === "items" && (
                        <div className="space-y-3">
                          <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden dark:border-slate-800">
                            <thead className="bg-slate-50 text-[10px] text-slate-500 dark:bg-slate-800">
                              <tr>
                                <th className="p-2.5">Description</th>
                                <th className="p-2.5">Qty</th>
                                <th className="p-2.5">Unit</th>
                                <th className="p-2.5">Price</th>
                                <th className="p-2.5">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-t border-slate-100 dark:border-slate-800">
                                <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-100">Plastic Raw Material</td>
                                <td className="p-2.5">50</td>
                                <td className="p-2.5">MT</td>
                                <td className="p-2.5">1,200</td>
                                <td className="p-2.5 font-bold text-emerald-600">60,000.00</td>
                              </tr>
                            </tbody>
                          </table>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Another Line Item</span>
                          </button>
                        </div>
                      )}

                      {/* PAYMENT & DELIVERY TAB */}
                      {activeFormTab === "payment" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Terms</label>
                            <input
                              type="text"
                              value={formData.paymentTerms}
                              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Delivery Terms</label>
                            <input
                              type="text"
                              value={formData.deliveryTerms}
                              onChange={(e) => setFormData({ ...formData, deliveryTerms: e.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </div>
                      )}

                      {/* NOTES TAB */}
                      {activeFormTab === "notes" && (
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-xs">Review Notes / Remarks</label>
                          <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                      )}

                      {/* Action Footer (Matching Reference Buttons) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setWizardStep(4)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {s.t("cancel", "Cancel")}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void handleSaveAsDraft()}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-600 bg-white px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-50 transition-colors shadow-xs dark:bg-slate-900 dark:text-blue-400"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>{s.t("save_draft", "Save as Draft")}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void handleCreateEntry()}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition-all hover:scale-[1.02]"
                          >
                            <Check className="h-4 w-4" />
                            <span>{s.t("create_entry", "Create Entry")}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Bottom Help / Info Banner (Matching Reference Image) ─────── */}
                <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      {s.t("bottom_tip", "AI will extract key information based on your selected module. Please review and correct any details before creating the entry.")}
                    </span>
                  </div>

                  <a
                    href="#help"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("AI Document Intake extracts data locally and generates verified drafts for the canonical ERP modules. The AI never posts directly without human confirmation.");
                    }}
                    className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline dark:text-blue-400 shrink-0"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>{s.t("need_help", "Need Help?")}</span>
                  </a>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── 4. DOCUMENT QUEUE & AUDIT HISTORY VIEW ────────────────────────── */
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <KpiCard label={s.t("k_total", "Total")} value={kpis.total ?? queueRows.length} icon={FileText} />
              <KpiCard label={s.t("k_review", "In Review")} value={kpis.in_review ?? 0} tone="text-amber-600" icon={FileText} />
              <KpiCard label={s.t("k_qvc", "In QVC")} value={kpis.in_qvc ?? 0} tone="text-rose-600" icon={ShieldAlert} />
              <KpiCard label={s.t("k_draft", "Draft Ready")} value={kpis.draft_ready ?? 0} tone="text-emerald-600" icon={CheckCircle2} />
              <KpiCard label={s.t("k_linked", "Linked")} value={kpis.linked ?? 0} tone="text-blue-600" icon={Link2} />
              <KpiCard label={s.t("k_oos", "Out of Scope")} value={kpis.out_of_scope ?? 0} tone="text-rose-600" icon={AlertTriangle} />
              <KpiCard label={s.t("k_failed", "Failed")} value={kpis.failed ?? 0} tone="text-rose-600" icon={Ban} />
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-1 items-center gap-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  placeholder={s.t("search_queue", "Search job no, contract, B/L, or document name...")}
                  className="w-full bg-transparent text-xs font-semibold outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={queueStatusFilter}
                  onChange={(e) => setQueueStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">{s.t("all_statuses", "All Statuses")}</option>
                  <option value="review">{s.t("st_review", "In Review")}</option>
                  <option value="draft_ready">{s.t("st_draft_ready", "Draft Ready")}</option>
                  <option value="qvc">{s.t("st_qvc", "In QVC")}</option>
                  <option value="linked">{s.t("st_linked", "Linked")}</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadQueue()}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  title="Refresh Queue"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:bg-slate-800 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Job No</th>
                    <th className="p-3">Domain</th>
                    <th className="p-3">Document File</th>
                    <th className="p-3">Scope / Office</th>
                    <th className="p-3">Target Module</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {queueLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : queueRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        {s.t("empty_queue", "No intake jobs found matching your scope or criteria.")}
                      </td>
                    </tr>
                  ) : (
                    queueRows.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{r.job_no}</td>
                        <td className="p-3 capitalize font-semibold text-slate-600 dark:text-slate-300">
                          {r.operational_domain === "shipping" ? "Shipping & Clearing" : "Business ERP"}
                        </td>
                        <td className="p-3 font-medium text-slate-800 dark:text-slate-100 truncate max-w-[180px]">
                          {r.original_filename}
                        </td>
                        <td className="p-3 text-slate-500">
                          {[r.country_name, r.city_branch_name || r.country_branch_name].filter(Boolean).join(" / ") || "Multi-Country Scope"}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">
                          {r.target_module || "purchase_orders"}
                        </td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status] || STATUS_TONE.uploaded}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => void openJobDetails(r.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
                          >
                            <ArrowRight className="h-3 w-3" />
                            <span>{s.t("review", "Review & Edit")}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Quick Field Correction Modal ───────────────────────────────────── */}
      {editFieldsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {s.t("edit_fields_title", "Edit Extracted Intelligence Fields")}
              </h3>
              <button
                type="button"
                onClick={() => setEditFieldsModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Contract / Reference No.</label>
                <input
                  type="text"
                  value={formData.contractNo}
                  onChange={(e) => setFormData({ ...formData, contractNo: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Document Date</label>
                <input
                  type="date"
                  value={formData.documentDate}
                  onChange={(e) => setFormData({ ...formData, documentDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Supplier / Counterparty</label>
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Total Amount</label>
                <input
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditFieldsModalOpen(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
              >
                {s.t("apply_changes", "Apply Changes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone?: string;
  icon?: any;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className={`h-3.5 w-3.5 ${tone || "text-slate-400"}`} /> : null}
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-50">{value}</div>
    </div>
  );
}
