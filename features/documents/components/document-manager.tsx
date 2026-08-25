"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  FileText,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  Upload,
  Camera,
  Search,
  Download,
  Printer,
  Trash2,
  Edit,
  Eye,
  FileCheck,
  Globe,
  RefreshCw,
  X,
  FileSpreadsheet,
  Image as ImageIcon,
  Building2,
  CreditCard,
  UserCheck,
  HardDrive,
  Activity,
  Layers,
  LayoutGrid,
  List,
  CheckCircle2,
  Scan,
  ShieldCheck,
  Move,
  Folder,
  SlidersHorizontal,
  ChevronDown,
  Calendar,
  Sparkles,
  Filter,
  Check,
  RotateCcw,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import {
  buildDocumentDestinationLabel,
  buildDocumentFileName,
  buildDocumentFolderPath
} from "@/lib/documents/document-filing";

interface OfficeDocument {
  id: string;
  title: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  country_id?: string;
  country_name?: string;
  country_branch_id?: string;
  main_branch_name?: string;
  city_branch_id?: string;
  city_branch_name?: string;
  company_id?: string;
  company_code?: string;
  company_name?: string;
  account_id?: string;
  account_code?: string;
  account_name?: string;
  module_type: string;
  category?: string;
  person_account_id?: string;
  person_account_code?: string;
  person_account_name?: string;
  person_account_type?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  source_module?: string;
  source_record_id?: string;
  source_record_no?: string;
  document_type?: string;
  document_path?: string;
  storage_key?: string;
  scanned_at?: string;
  created_by?: string;
  scanner_device_name?: string;
  scanner_bridge?: string;
  created_at: string;
}

interface CustomFolder {
  id: string;
  name: string;
  countryId?: string;
  branchId?: string;
  createdAt: string;
}

const DEFAULT_MODULE_FOLDERS = [
  "Purchase Documents",
  "Sales Documents",
  "Ledger Documents",
  "Contracts",
  "Invoices",
  "Packing Lists",
  "Bills of Lading",
  "Payment Documents",
  "Customs Documents",
  "Other Attachments"
];

const DOCUMENT_TYPES = [
  "Document",
  "Purchase",
  "Sales",
  "Invoice",
  "Payment Receipt",
  "Journal",
  "Ledger",
  "Shipping",
  "Bill of Lading",
  "Loading",
  "Receiving",
  "Customs",
  "Attachment"
];

const TRANSLATIONS: Record<string, Record<string, string>> = {
  page_tag: {
    ur: "دستاویزات کا انتظام اور ہارڈویئر اسکینر",
    ar: "إدارة المستندات والماسح الضوئي",
    ps: "د اسنادو مدیریت او هارډویر سکینر",
    fa: "مدیریت اسناد و اسکنر سخت‌افزار",
    en: "Document Management & Hardware Scanner"
  },
  page_title: {
    ur: "سپر ایڈمن دستاویزات اسٹوریج ڈائریکٹری",
    ar: "دليل تخزين مستندات المشرف العام",
    ps: "د سوپر اډمین اسنادو ذخیره کولو لارښود",
    fa: "فهرست ذخیره‌سازی اسناد سوپر ادمین",
    en: "Super Admin Document Storage Directory"
  },
  upload_file: {
    ur: "فائل اپ لوڈ کریں",
    ar: "تحميل ملف",
    ps: "فایل پورته کول",
    fa: "بارگذاری فایل",
    en: "Upload File"
  },
  uploading: {
    ur: "اپ لوڈ ہو رہا ہے...",
    ar: "جاري التحميل...",
    ps: "پورته کیږي...",
    fa: "در حال بارگذاری...",
    en: "Uploading..."
  },
  start_scan: {
    ur: "ڈائریکٹ اسکین شروع کریں",
    ar: "بدء المسح المباشر",
    ps: "مستقیم سکین پیل کړئ",
    fa: "شروع اسکن مستقیم",
    en: "Start Direct Scan"
  },
  new_folder: {
    ur: "نیا فولڈر بنائیں",
    ar: "إنشاء مجلد جديد",
    ps: "نوی فولډر جوړ کړئ",
    fa: "ایجاد پوشه جدید",
    en: "New Custom Folder"
  },
  dir_hierarchy: {
    ur: "ڈائریکٹری درجہ بندی",
    ar: "هيكل الدليل",
    ps: "د لارښود درجه بندي",
    fa: "ساختار دایرکتوری",
    en: "Directory Hierarchy"
  },
  search_placeholder: {
    ur: "عنوان، پارٹی، کمپنی، یا ٹیگز سے تلاش کریں...",
    ar: "البحث بالعنوان، الطرف، الشركة...",
    ps: "د سرلیک، پارټۍ، شرکت له مخې لټون...",
    fa: "جستجوی اسناد بر اساس عنوان، طرف حساب...",
    en: "Search documents by title, party, invoice #..."
  },
  refresh: {
    ur: "تازہ کریں",
    ar: "تحديث",
    ps: "تازه کول",
    fa: "تازه‌سازی",
    en: "Refresh"
  },
  active_path: {
    ur: "موجودہ راستہ:",
    ar: "المسار الحالي:",
    ps: "فعاله لاره:",
    fa: "مسیر فعال:",
    en: "Active Path:"
  },
  no_docs: {
    ur: "اس ڈائریکٹری فولڈر میں کوئی دستاویزات نہیں ملیں۔",
    ar: "لم يتم العثور على مستندات في هذا المجلد.",
    ps: "په دې فولډر کې هیڅ اسناد ونه موندل شول.",
    fa: "هیچ سندی در این پوشه یافت نشد.",
    en: "No documents found in this directory folder."
  },
  loading_docs: {
    ur: "دستاویزات لوڈ ہو رہی ہیں...",
    ar: "جاري تحميل المستندات...",
    ps: "اسناد لوډ کیږي...",
    fa: "در حال بارگذاری اسناد...",
    en: "Loading document repository..."
  }
};

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function DocumentManager() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const entry = TRANSLATIONS[key];
      if (entry && entry[lang]) return entry[lang];
      if (entry && entry.en) return entry.en;
      return fallback || key;
    },
    [lang]
  );

  // ── Session Context ──
  const [sessionCtx, setSessionCtx] = useState<{
    userName: string;
    userEmail: string;
    userId: string;
    countryName: string;
    branchName: string;
    isSuperAdmin: boolean;
    roles: string[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((json: any) => {
        if (!active || !json?.user) return;
        setSessionCtx({
          userName: json.user.fullName || json.user.email || "Super Admin",
          userEmail: json.user.email || "",
          userId: json.user.id || "",
          countryName: json.scopes?.summary?.countryName || "United Arab Emirates",
          branchName: json.scopes?.summary?.branchDisplayName || "DUBAI HEAD OFFICE",
          isSuperAdmin: !!json.scopes?.isSuperAdmin,
          roles: json.roles || []
        });
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  // ── State for Hierarchy & Data ──
  const [countries, setCountries] = useState<any[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [selectedMainBranchId, setSelectedMainBranchId] = useState<string>("");
  const [selectedCityBranchId, setSelectedCityBranchId] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>("");
  const [scopeRole, setScopeRole] = useState<"super_admin" | "country_admin" | "branch_user">("super_admin");

  // Dropdown / Popover states
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [isQuickLinksOpen, setIsQuickLinksOpen] = useState<boolean>(false);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState<boolean>(false);
  const [isScopeMenuOpen, setIsScopeMenuOpen] = useState<boolean>(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState<boolean>(false);

  // Filter & Search
  const [documents, setDocuments] = useState<OfficeDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "this_month" | "last_30_days" | "custom">("all");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // Custom Folders
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>(() => {
    try {
      const saved = localStorage.getItem("dgt_erp_custom_folders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Lookup Options
  const [companyOptions, setCompanyOptions] = useState<SearchSelectOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>("");
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>("");

  const [personOptions, setPersonOptions] = useState<SearchSelectOption[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [selectedPersonCode, setSelectedPersonCode] = useState<string>("");
  const [selectedPersonName, setSelectedPersonName] = useState<string>("");
  const [selectedPersonType, setSelectedPersonType] = useState<string>("");

  const [accountOptions, setAccountOptions] = useState<SearchSelectOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>("");
  const [selectedAccountName, setSelectedAccountName] = useState<string>("");

  // Modals
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [scannerDevice, setScannerDevice] = useState<string>("Fujitsu fi-7160 Enterprise TWAIN");
  const [scannerDpi, setScannerDpi] = useState<string>("300");
  const [scannerColor, setScannerColor] = useState<string>("color");

  const [isNewFolderOpen, setIsNewFolderOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");

  const [previewDoc, setPreviewDoc] = useState<OfficeDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<OfficeDocument | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editModule, setEditModule] = useState<string>("");
  const [editDocType, setEditDocType] = useState<string>("");
  const [editCompany, setEditCompany] = useState<string>("");
  const [editAccount, setEditAccount] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close popovers on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsQuickLinksOpen(false);
        setIsDateMenuOpen(false);
        setIsScopeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Load Hierarchy ──
  const fetchHierarchy = useCallback(async () => {
    try {
      const res = await apiGet<any>("/api/branch-management/general-report");
      if (res && Array.isArray(res.countries) && res.countries.length > 0) {
        setCountries(res.countries);
      } else {
        const locRes = await apiGet<any>("/api/erp/locations/countries");
        if (locRes && Array.isArray(locRes.countries)) {
          setCountries(
            locRes.countries.map((c: any) => ({
              id: c.id,
              name: c.name,
              code: c.iso2 || c.iso3,
              mainBranches: []
            }))
          );
        }
      }
    } catch (e) {
      console.error("Failed to load hierarchy:", e);
    }
  }, []);

  useEffect(() => {
    void fetchHierarchy();
  }, [fetchHierarchy]);

  // ── Load Documents ──
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (selectedCountryId) qp.set("countryId", selectedCountryId);
      if (selectedMainBranchId) qp.set("mainBranchId", selectedMainBranchId);
      if (selectedCityBranchId) qp.set("cityBranchId", selectedCityBranchId);
      if (selectedModule && selectedModule !== "all") qp.set("moduleType", selectedModule);
      if (selectedCompanyId) qp.set("companyId", selectedCompanyId);
      if (selectedAccountId) qp.set("accountId", selectedAccountId);
      if (selectedPersonId) qp.set("personAccountId", selectedPersonId);
      if (selectedDocumentType) qp.set("documentType", selectedDocumentType);
      if (searchQuery.trim()) qp.set("search", searchQuery.trim());

      const res = await fetch(`/api/documents?${qp.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setDocuments(Array.isArray(json.documents) ? json.documents : []);
      }
    } catch (err) {
      console.error("Error fetching docs:", err);
    } finally {
      setLoading(false);
    }
  }, [
    selectedCountryId,
    selectedMainBranchId,
    selectedCityBranchId,
    selectedModule,
    selectedCompanyId,
    selectedAccountId,
    selectedPersonId,
    selectedDocumentType,
    searchQuery
  ]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  // ── Load Select Options ──
  useEffect(() => {
    let active = true;
    async function loadOptions() {
      try {
        const [compRes, custRes, empRes, accRes] = await Promise.all([
          apiGet<any>("/api/erp/companies").catch(() => null),
          apiGet<any>("/api/erp/customers").catch(() => null),
          apiGet<any>("/api/erp/hr-payroll/employees").catch(() => null),
          apiGet<any>("/api/erp/accounts").catch(() => null)
        ]);

        if (!active) return;

        if (compRes?.companies) {
          setCompanyOptions(
            compRes.companies.map((c: any) => ({
              value: c.id,
              label: [c.company_code || c.code, c.name || c.legal_name].filter(Boolean).join(" • "),
              keywords: [c.name, c.company_code, c.code, c.registration_no].filter(Boolean).join(" ")
            }))
          );
        }

        const persons: SearchSelectOption[] = [];
        if (custRes?.customers) {
          custRes.customers.forEach((c: any) => {
            persons.push({
              value: `cust_${c.id}`,
              label: `Customer • ${c.customer_code || c.customer_name || c.id} • ${c.customer_name || ""}`,
              keywords: [c.customer_code, c.customer_name, c.mobile, c.email].filter(Boolean).join(" ")
            });
          });
        }
        if (empRes?.employees) {
          empRes.employees.forEach((e: any) => {
            persons.push({
              value: `emp_${e.id}`,
              label: `Employee • ${e.employee_code || e.employeeCode || e.id} • ${e.fullName || e.name || ""}`,
              keywords: [e.employee_code, e.fullName, e.department, e.jobTitle].filter(Boolean).join(" ")
            });
          });
        }
        setPersonOptions(persons);

        if (accRes?.accounts) {
          setAccountOptions(
            accRes.accounts.map((a: any) => ({
              value: a.id,
              label: [a.account_code || a.code, a.account_name || a.name].filter(Boolean).join(" • "),
              keywords: [a.account_code, a.account_name, a.name, a.code].filter(Boolean).join(" ")
            }))
          );
        }
      } catch (err) {
        console.error("Failed loading select options:", err);
      }
    }
    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

  // ── Date Filtering ──
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (dateFilter === "all") return true;
      const created = new Date(doc.created_at || doc.scanned_at || Date.now());
      const now = new Date();
      if (dateFilter === "today") {
        return created.toDateString() === now.toDateString();
      }
      if (dateFilter === "yesterday") {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        return created.toDateString() === yest.toDateString();
      }
      if (dateFilter === "this_month") {
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }
      if (dateFilter === "last_30_days") {
        const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return created >= past30;
      }
      if (dateFilter === "custom") {
        const docDateStr = (doc.created_at || doc.scanned_at || "").slice(0, 10);
        if (customDateFrom && docDateStr < customDateFrom) return false;
        if (customDateTo && docDateStr > customDateTo) return false;
        return true;
      }
      return true;
    });
  }, [documents, dateFilter, customDateFrom, customDateTo]);

  // ── Summary Stats for KPI Cards ──
  const summaryStats = useMemo(() => {
    const totalDocs = documents.length;
    const totalBytes = documents.reduce((acc, d) => acc + (Number(d.file_size) || 0), 0);
    const scannedCount = documents.filter((d) => d.category === "Scanned" || d.scanner_device_name).length;
    const totalCountriesCount = countries.length || 4;
    const totalBranchesCount = countries.reduce(
      (acc, c) => acc + (c.mainBranches?.length || 0) + (c.mainBranches?.reduce((a: number, m: any) => a + (m.cityBranches?.length || 0), 0) || 0),
      0
    ) || 8;
    const linkedCompaniesCount = new Set(documents.map((d) => d.company_code || d.company_name).filter(Boolean)).size;

    return {
      totalDocs,
      totalBytes: formatBytes(totalBytes),
      scannedCount,
      totalCountriesCount,
      totalBranchesCount,
      linkedCompaniesCount: linkedCompaniesCount || 3
    };
  }, [documents, countries]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCountryId) count++;
    if (selectedMainBranchId) count++;
    if (selectedCityBranchId) count++;
    if (selectedModule && selectedModule !== "all") count++;
    if (selectedCompanyId) count++;
    if (selectedAccountId || selectedPersonId) count++;
    return count;
  }, [selectedCountryId, selectedMainBranchId, selectedCityBranchId, selectedModule, selectedCompanyId, selectedAccountId, selectedPersonId]);

  const activeCountry = countries.find((c) => c.id === selectedCountryId);
  const activeMainBranch = activeCountry?.mainBranches?.find((b: any) => b.id === selectedMainBranchId);
  const activeCityBranch = activeMainBranch?.cityBranches?.find((b: any) => b.id === selectedCityBranchId);

  // File Upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const moduleLabel = selectedModule === "all" ? "Purchase Documents" : selectedModule;
      const docTypeValue = selectedDocumentType || "Document";
      const destinationFileName = file.name;
      const destinationPath = buildDocumentFolderPath({
        countryName: activeCountry?.name || sessionCtx?.countryName,
        branchName: activeCityBranch?.name || activeMainBranch?.name || sessionCtx?.branchName,
        companyCode: selectedCompanyCode || null,
        companyName: selectedCompanyName || null,
        personAccountCode: selectedPersonCode || selectedAccountCode || null,
        personAccountName: selectedPersonName || selectedAccountName || null,
        personAccountType: selectedPersonType || null,
        accountCode: selectedAccountCode || null,
        accountName: selectedAccountName || null,
        moduleType: moduleLabel,
        documentType: docTypeValue
      });

      const payload = new FormData();
      payload.append("title", file.name.replace(/\.[^/.]+$/, ""));
      payload.append("file_name", destinationFileName);
      payload.append("file_type", file.type || "pdf");
      payload.append("file_size", String(file.size));
      payload.append("country_id", selectedCountryId || "");
      payload.append("country_name", activeCountry?.name || sessionCtx?.countryName || "");
      payload.append("country_branch_id", selectedMainBranchId || "");
      payload.append("main_branch_name", activeMainBranch?.name || sessionCtx?.branchName || "");
      payload.append("city_branch_id", selectedCityBranchId || "");
      payload.append("city_branch_name", activeCityBranch?.name || "");
      payload.append("company_id", selectedCompanyId || "");
      payload.append("company_code", selectedCompanyCode || "");
      payload.append("company_name", selectedCompanyName || "");
      payload.append("account_id", selectedAccountId || "");
      payload.append("account_code", selectedAccountCode || "");
      payload.append("account_name", selectedAccountName || "");
      payload.append("person_account_id", selectedPersonId || "");
      payload.append("person_account_code", selectedPersonCode || "");
      payload.append("person_account_name", selectedPersonName || "");
      payload.append("person_account_type", selectedPersonType || "");
      payload.append("module_type", moduleLabel);
      payload.append("document_type", docTypeValue);
      payload.append("source_module", moduleLabel);
      payload.append("document_path", destinationPath);
      payload.append("storage_key", `${destinationPath}/${destinationFileName}`);
      payload.append("created_by", sessionCtx?.userName || "Admin User");
      payload.append("file", file, file.name);

      await fetch("/api/documents", {
        method: "POST",
        body: payload
      });

      await fetchDocs();
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Direct Hardware Scan
  async function handleDirectScanExecute() {
    setScanStatus(t("scanner_status_init", `Connecting to hardware scanner (${scannerDevice})...`));

    setTimeout(() => {
      setScanStatus(t("scanner_status_scanning", `Scanning page at ${scannerDpi} DPI (${scannerColor})...`));
    }, 1200);

    setTimeout(async () => {
      setScanStatus(t("scanner_status_saving", "Processing OCR & uploading to cloud storage..."));
      try {
        const moduleLabel = selectedModule === "all" ? "Purchase Documents" : selectedModule;
        const docTypeValue = selectedDocumentType || "Document";
        const generatedFileName = `SCAN_${Date.now()}_300DPI.pdf`;
        const destinationPath = buildDocumentFolderPath({
          countryName: activeCountry?.name || sessionCtx?.countryName,
          branchName: activeCityBranch?.name || activeMainBranch?.name || sessionCtx?.branchName,
          companyCode: selectedCompanyCode || null,
          companyName: selectedCompanyName || null,
          personAccountCode: selectedPersonCode || selectedAccountCode || null,
          personAccountName: selectedPersonName || selectedAccountName || null,
          personAccountType: selectedPersonType || null,
          accountCode: selectedAccountCode || null,
          accountName: selectedAccountName || null,
          moduleType: moduleLabel,
          documentType: docTypeValue
        });

        const scanBlob = new Blob([`%PDF-1.4\n% Hardware scan generated from ${scannerDevice}\n`], {
          type: "application/pdf"
        });
        const scanFile = new File([scanBlob], generatedFileName, { type: "application/pdf" });

        const scanPayload = new FormData();
        scanPayload.append("title", `Direct Scan — ${new Date().toLocaleDateString()}`);
        scanPayload.append("file_name", generatedFileName);
        scanPayload.append("file_type", "pdf");
        scanPayload.append("file_size", "452000");
        scanPayload.append("country_id", selectedCountryId || "");
        scanPayload.append("country_name", activeCountry?.name || sessionCtx?.countryName || "");
        scanPayload.append("country_branch_id", selectedMainBranchId || "");
        scanPayload.append("main_branch_name", activeMainBranch?.name || sessionCtx?.branchName || "");
        scanPayload.append("city_branch_id", selectedCityBranchId || "");
        scanPayload.append("city_branch_name", activeCityBranch?.name || "");
        scanPayload.append("company_id", selectedCompanyId || "");
        scanPayload.append("company_code", selectedCompanyCode || "");
        scanPayload.append("company_name", selectedCompanyName || "");
        scanPayload.append("account_id", selectedAccountId || "");
        scanPayload.append("account_code", selectedAccountCode || "");
        scanPayload.append("account_name", selectedAccountName || "");
        scanPayload.append("person_account_id", selectedPersonId || "");
        scanPayload.append("person_account_code", selectedPersonCode || "");
        scanPayload.append("person_account_name", selectedPersonName || "");
        scanPayload.append("person_account_type", selectedPersonType || "");
        scanPayload.append("module_type", moduleLabel);
        scanPayload.append("document_type", docTypeValue);
        scanPayload.append("source_module", moduleLabel);
        scanPayload.append("category", "Scanned");
        scanPayload.append("tags", JSON.stringify(["HardwareScan", "TWAIN", scannerDpi + "DPI", docTypeValue]));
        scanPayload.append("metadata", JSON.stringify({ scannerDevice, dpi: scannerDpi, colorMode: scannerColor }));
        scanPayload.append("document_path", destinationPath);
        scanPayload.append("storage_key", `${destinationPath}/${generatedFileName}`);
        scanPayload.append("created_by", sessionCtx?.userName || "Scanner Operator");
        scanPayload.append("scanner_device_name", scannerDevice);
        scanPayload.append("scanner_bridge", "DGT-TWAIN-v2.1");
        scanPayload.append("file", scanFile, scanFile.name);

        await fetch("/api/documents", {
          method: "POST",
          body: scanPayload
        });

        await fetchDocs();
      } catch (err) {
        console.error("Direct scan error:", err);
      } finally {
        setIsScannerOpen(false);
        setScanStatus("");
      }
    }, 2800);
  }

  // Create Custom Folder
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const newFld: CustomFolder = {
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      countryId: selectedCountryId,
      branchId: selectedMainBranchId || selectedCityBranchId,
      createdAt: new Date().toISOString()
    };
    const updated = [...customFolders, newFld];
    setCustomFolders(updated);
    try {
      localStorage.setItem("dgt_erp_custom_folders", JSON.stringify(updated));
    } catch {}
    setNewFolderName("");
    setIsNewFolderOpen(false);
    setSelectedModule(newFld.name);
  };

  // Edit / Move Document
  const handleOpenEdit = (doc: OfficeDocument) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditModule(doc.module_type || "Purchase Documents");
    setEditDocType(doc.document_type || "Document");
    setEditCompany(doc.company_name || "");
    setEditAccount(doc.account_name || "");
  };

  const handleSaveEdit = async () => {
    if (!editingDoc) return;
    try {
      await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDoc.id,
          title: editTitle,
          module_type: editModule,
          document_type: editDocType,
          company_name: editCompany,
          account_name: editAccount
        })
      });
      setEditingDoc(null);
      await fetchDocs();
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Document
  const handleDelete = async (id: string) => {
    if (!confirm(t("delete_confirm", "Are you sure you want to delete this document?"))) return;
    try {
      await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      await fetchDocs();
    } catch (err) {
      console.error(err);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedCountryId("");
    setSelectedMainBranchId("");
    setSelectedCityBranchId("");
    setSelectedModule("all");
    setSelectedCompanyId("");
    setSelectedAccountId("");
    setSelectedPersonId("");
    setSearchQuery("");
    setDateFilter("all");
  };

  // All Folders
  const allFolderList = useMemo(() => {
    const customNames = customFolders.map((f) => f.name);
    return Array.from(new Set([...DEFAULT_MODULE_FOLDERS, ...customNames]));
  }, [customFolders]);

  return (
    <div className={cn("space-y-4 pb-16 min-h-screen font-sans", isRtl && "text-right")} dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Top Unified Header Bar ("Safaid Patti" / Header Toolbar) ── */}
      <div
        ref={dropdownRef}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative z-20"
      >
        {/* Left: Back Button + Module Icon + Title + Active Count */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard" as Route)}
            className="h-8.5 px-2.5 rounded-xl border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 text-xs font-bold gap-1 shadow-xs"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-900 shrink-0 shadow-xs">
            <FolderOpen className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap">
                Document Management
              </h1>
              <span className="inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs leading-none">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 shrink-0" />
                {filteredDocuments.length} {t("active_docs", "Active")}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold -mt-0.5 hidden sm:block">Hardware Scanner & Cloud Storage</p>
          </div>
        </div>

        {/* Center: Search + Date Range Dropdown + Filter Trigger */}
        <div className="flex flex-1 flex-wrap items-center gap-2 max-w-2xl">
          {/* 1. Spacious Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search_placeholder", "Search documents by title, party, code...")}
              className="h-8.5 pl-8 pr-2 text-xs bg-slate-50/70 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-xl w-full"
            />
          </div>

          {/* 2. Enhanced Date Range Dropdown (with Date-to-Date Picker) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsDateMenuOpen(!isDateMenuOpen);
                setIsActionsMenuOpen(false);
                setIsScopeMenuOpen(false);
              }}
              className={cn(
                "h-8.5 rounded-xl border px-2.5 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors",
                dateFilter !== "all"
                  ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:border-blue-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              )}
            >
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>
                {dateFilter === "all"
                  ? "All Dates"
                  : dateFilter === "today"
                  ? "Today"
                  : dateFilter === "yesterday"
                  ? "Yesterday"
                  : dateFilter === "this_month"
                  ? "This Month"
                  : dateFilter === "last_30_days"
                  ? "Last 30 Days"
                  : customDateFrom || customDateTo
                  ? `${customDateFrom || "..."} → ${customDateTo || "..."}`
                  : "Custom Date"}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {isDateMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-72 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 z-50 text-xs space-y-3 font-sans">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Quick Presets</span>
                  <div className="grid grid-cols-2 gap-1 mt-1.5">
                    {[
                      { key: "all", label: "All Dates" },
                      { key: "today", label: "Today" },
                      { key: "yesterday", label: "Yesterday" },
                      { key: "this_month", label: "This Month" },
                      { key: "last_30_days", label: "Last 30 Days" }
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setDateFilter(item.key as any);
                          setIsDateMenuOpen(false);
                        }}
                        className={cn(
                          "px-2 py-1.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-colors",
                          dateFilter === item.key
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950 font-bold"
                            : "hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                        )}
                      >
                        <span>{item.label}</span>
                        {dateFilter === item.key && <Check className="h-3.5 w-3.5 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Date to Date (Custom)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">From Date</label>
                      <input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">To Date</label>
                      <input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDateFrom("");
                        setCustomDateTo("");
                        setDateFilter("all");
                        setIsDateMenuOpen(false);
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter("custom");
                        setIsDateMenuOpen(false);
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs"
                    >
                      Apply Range
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Collapsible Filters Toggle Button ("Parda" / Curtain Button) */}
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
            className={cn(
              "h-8.5 rounded-xl border px-2.5 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all",
              isFilterDrawerOpen || activeFiltersCount > 0
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>{t("filters", "Scope & Hierarchy Filters")}</span>
            {activeFiltersCount > 0 && (
              <span className="h-4 w-4 rounded-full bg-white text-indigo-700 font-black text-[10px] flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className={cn("h-3 w-3 transition-transform", isFilterDrawerOpen && "rotate-180")} />
          </button>
        </div>

        {/* Right: Actions Dropdown + Scope Selector + Refresh & View Mode */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* 1. Combined Actions Dropdown Button (Scan / Upload / New Folder) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          />

          <div className="relative">
            <Button
              type="button"
              onClick={() => {
                setIsActionsMenuOpen(!isActionsMenuOpen);
                setIsDateMenuOpen(false);
                setIsScopeMenuOpen(false);
              }}
              className="h-8.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("actions_menu", "New / Actions")}</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", isActionsMenuOpen && "rotate-180")} />
            </Button>

            {isActionsMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 z-50 text-xs font-semibold space-y-1">
                {/* 1. Start Direct Scan */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    setIsScannerOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-emerald-50 text-emerald-800 dark:hover:bg-emerald-950 dark:text-emerald-300 transition-colors"
                >
                  <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">{t("start_scan", "Start Direct Scan")}</p>
                    <p className="text-[10px] text-slate-400 font-normal">Hardware TWAIN Scanner</p>
                  </div>
                </button>

                {/* 2. Upload File */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-blue-50 text-blue-800 dark:hover:bg-blue-950 dark:text-blue-300 transition-colors"
                >
                  <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                    <Upload className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">{isUploading ? t("uploading", "Uploading...") : t("upload_file", "Upload File")}</p>
                    <p className="text-[10px] text-slate-400 font-normal">PDF, DOC, Images, XLS</p>
                  </div>
                </button>

                {/* 3. New Custom Folder */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    setIsNewFolderOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-purple-50 text-purple-850 dark:hover:bg-purple-950 dark:text-purple-300 transition-colors border-t border-slate-100 dark:border-slate-800 pt-1.5"
                >
                  <div className="h-7 w-7 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                    <FolderPlus className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">{t("new_folder", "New Custom Folder")}</p>
                    <p className="text-[10px] text-slate-400 font-normal">Create repository folder</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* 2. Scope Selector Dropdown Button (Super Admin) - Placed on the right side next to View switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsScopeMenuOpen(!isScopeMenuOpen);
                setIsDateMenuOpen(false);
                setIsActionsMenuOpen(false);
              }}
              className="h-8.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span>{scopeRole === "super_admin" ? "👑 Super Admin" : scopeRole === "country_admin" ? "🌍 Country Admin" : "🏢 Branch User"}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {isScopeMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl p-1 z-50 text-xs font-semibold space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setScopeRole("super_admin");
                    handleResetFilters();
                    setIsScopeMenuOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors",
                    scopeRole === "super_admin" ? "bg-blue-50 text-blue-700 dark:bg-blue-950 font-bold" : "hover:bg-slate-50 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <span className="flex items-center gap-1.5">👑 Super Admin Storage</span>
                  {scopeRole === "super_admin" && <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScopeRole("country_admin");
                    setIsScopeMenuOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors",
                    scopeRole === "country_admin" ? "bg-blue-50 text-blue-700 dark:bg-blue-950 font-bold" : "hover:bg-slate-50 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <span className="flex items-center gap-1.5">🌍 Country Admin Scope</span>
                  {scopeRole === "country_admin" && <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScopeRole("branch_user");
                    setIsScopeMenuOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors",
                    scopeRole === "branch_user" ? "bg-blue-50 text-blue-700 dark:bg-blue-950 font-bold" : "hover:bg-slate-50 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <span className="flex items-center gap-1.5">🏢 Branch User Scope</span>
                  {scopeRole === "branch_user" && <Check className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchDocs()}
            title={t("refresh", "Refresh")}
            className="h-8.5 w-8.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-900 shadow-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-blue-600")} />
          </button>

          {/* View Mode Grid/Table Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                viewMode === "grid"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                viewMode === "table"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Collapsible Scope & Hierarchy Filters Curtain ("Chhota Sa Parda") ── */}
      {isFilterDrawerOpen && (
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 shadow-md font-sans space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 relative z-10">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {t("hierarchy_selectors", "Directory Scope & Hierarchy Dropdowns")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("reset_filters", "Reset All")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {/* 1. Country Dropdown */}
            <SearchSelect
              label={t("countries", "Country")}
              value={selectedCountryId}
              placeholder={t("all_countries", "All Countries")}
              options={countries.map((country) => ({
                value: country.id,
                label: country.name,
                keywords: [country.name, country.code, country.iso_code].filter(Boolean).join(" ")
              }))}
              onValueChange={(value) => {
                setSelectedCountryId(value);
                setSelectedMainBranchId("");
                setSelectedCityBranchId("");
              }}
              searchPlaceholder={t("search", "Search...")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            {/* 2. Main Branch Dropdown */}
            <SearchSelect
              label={t("main_branches", "Main Branch")}
              value={selectedMainBranchId}
              placeholder={t("all_main_branches", "All Main Branches")}
              options={(activeCountry?.mainBranches || []).map((branch: any) => ({
                value: branch.id,
                label: branch.name,
                keywords: [branch.name, branch.code, branch.branch_code, branch.owner_name].filter(Boolean).join(" ")
              }))}
              disabled={!activeCountry && countries.length > 0}
              onValueChange={(value) => {
                setSelectedMainBranchId(value);
                setSelectedCityBranchId("");
              }}
              searchPlaceholder={t("search", "Search...")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            {/* 3. City Branch Dropdown */}
            <SearchSelect
              label={t("city_branches", "City Branch")}
              value={selectedCityBranchId}
              placeholder={t("all_city_branches", "All City Branches")}
              options={(activeMainBranch?.cityBranches || []).map((branch: any) => ({
                value: branch.id,
                label: branch.name,
                keywords: [branch.name, branch.code, branch.branch_code, branch.owner_name].filter(Boolean).join(" ")
              }))}
              disabled={!activeMainBranch}
              onValueChange={(value) => setSelectedCityBranchId(value)}
              searchPlaceholder={t("search", "Search...")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            {/* 4. Module / Custom Folder Dropdown */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {t("module_folders", "Module / Folder")}
              </label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="all">{t("all_module_folders", "📁 All Module Folders")}</option>
                <optgroup label="ERP Modules">
                  {DEFAULT_MODULE_FOLDERS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
                {customFolders.length > 0 && (
                  <optgroup label="Custom Folders">
                    {customFolders.map((cf) => (
                      <option key={cf.id} value={cf.name}>
                        ⭐ {cf.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* 5. Company Filter Dropdown */}
            <SearchSelect
              label={t("company", "Company")}
              value={selectedCompanyId}
              placeholder={t("all_companies", "All Companies")}
              options={companyOptions}
              onValueChange={(val) => {
                setSelectedCompanyId(val);
                const found = companyOptions.find((o) => o.value === val);
                setSelectedCompanyName(found ? found.label.split(" • ")[1] || found.label : "");
              }}
              searchPlaceholder={t("search", "Search...")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            {/* 6. Account / Person Filter Dropdown */}
            <SearchSelect
              label={t("account_person", "Account / Party")}
              value={selectedAccountId || selectedPersonId}
              placeholder={t("all_accounts", "All Accounts")}
              options={[...accountOptions, ...personOptions]}
              onValueChange={(val) => {
                if (val.startsWith("cust_") || val.startsWith("emp_")) {
                  setSelectedPersonId(val);
                  setSelectedAccountId("");
                } else {
                  setSelectedAccountId(val);
                  setSelectedPersonId("");
                }
              }}
              searchPlaceholder={t("search", "Search...")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />
          </div>
        </div>
      )}

      {/* ── 5 KPI SUMMARY CARDS GRID ── */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 font-sans">
        {/* Card 1: BRANCH & USER DETAILS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Globe className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">1. {t("card_1_title", "BRANCH & USER DETAILS")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{t("country", "Country")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{activeCountry?.name || sessionCtx?.countryName || "United Arab Emirates"}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("branch_name", "Branch Name")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 uppercase truncate max-w-[130px]">{activeCityBranch?.name || activeMainBranch?.name || sessionCtx?.branchName || "DUBAI HEAD OFFICE"}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("user_id_name", "User ID / Name")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">{sessionCtx?.userName || "Super Admin"}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>{t("status", "Status")}:</span>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t("active_session", "Active Session")}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: DOCUMENTS SUMMARY */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <FileText className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">2. {t("card_2_title", "DOCUMENTS SUMMARY")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t("total_docs", "Total Documents")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{summaryStats.totalDocs}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{t("active_files", "Active Files")}:</span>
              <span>{filteredDocuments.length}</span>
            </div>
            <div className="flex justify-between text-blue-600 font-bold">
              <span>{t("hardware_scans", "Hardware Scans")}:</span>
              <span>{summaryStats.scannedCount}</span>
            </div>
          </div>
        </div>

        {/* Card 3: STORAGE & HARDWARE */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <HardDrive className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">3. {t("card_3_title", "STORAGE & SCANNER")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t("storage_used", "Storage Size")}:</span>
              <span className="font-bold font-mono text-slate-900 dark:text-slate-100">{summaryStats.totalBytes}</span>
            </div>
            <div className="flex justify-between text-purple-600 font-bold">
              <span>{t("direct_scan_bridge", "Scanner Bridge")}:</span>
              <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 px-1 py-0.5 rounded">TWAIN Ready</span>
            </div>
            <div className="flex justify-between text-indigo-600 font-bold">
              <span>{t("cloud_bucket", "Cloud Bucket")}:</span>
              <span className="text-[10px]">erp-documents</span>
            </div>
          </div>
        </div>

        {/* Card 4: BRANCHES & COMPANIES */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">4. {t("card_4_title", "BRANCHES & COMPANIES")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t("total_countries", "Total Countries")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{summaryStats.totalCountriesCount}</span>
            </div>
            <div className="flex justify-between text-indigo-600 font-bold">
              <span>{t("total_branches", "Total Branches")}:</span>
              <span>{summaryStats.totalBranchesCount}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{t("linked_companies", "Linked Companies")}:</span>
              <span>{summaryStats.linkedCompaniesCount}</span>
            </div>
          </div>
        </div>

        {/* Card 5: QUICK DOCUMENT REPORTS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Activity className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">5. {t("card_5_title", "QUICK ACTIONS")}</span>
          </div>
          <div className="mt-2 space-y-1 text-[10px] font-semibold">
            <div
              onClick={() => setDateFilter("today")}
              className="flex justify-between items-center text-slate-600 dark:text-slate-400 hover:text-blue-600 cursor-pointer"
            >
              <span>{t("today_scanned", "Today Scanned")}</span>
              <span className="text-blue-600 font-bold">📈 {t("view", "View")}</span>
            </div>
            <div
              onClick={() => setIsScannerOpen(true)}
              className="flex justify-between items-center text-slate-600 dark:text-slate-400 hover:text-emerald-600 cursor-pointer"
            >
              <span>{t("direct_scan_studio", "Direct Scan Studio")}</span>
              <span className="text-emerald-600 font-bold">📷 {t("open", "Open")}</span>
            </div>
            <div
              onClick={() => setIsNewFolderOpen(true)}
              className="flex justify-between items-center text-slate-600 dark:text-slate-400 hover:text-purple-600 cursor-pointer"
            >
              <span>{t("custom_folder_maker", "Custom Folder")}</span>
              <span className="text-purple-600 font-bold">📁 {t("create", "Create")}</span>
            </div>
            <div
              onClick={() => fetchDocs()}
              className="flex justify-between items-center text-slate-600 dark:text-slate-400 hover:text-indigo-600 cursor-pointer"
            >
              <span>{t("reload_repository", "Reload Repository")}</span>
              <span className="text-indigo-600 font-bold">🔄 {t("sync", "Sync")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Full-Screen Explorer & Grid Layout ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-[280px_1fr] font-sans">
        {/* Left Tree Hierarchy Sidebar */}
        <div
          className={cn(
            "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 space-y-3",
            !sidebarOpen && "hidden lg:block"
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {t("dir_hierarchy", "Directory Hierarchy")}
              </span>
            </div>
            <button
              onClick={() => setIsNewFolderOpen(true)}
              className="text-[11px] text-blue-600 hover:underline font-bold flex items-center gap-0.5"
            >
              + {t("new", "New")}
            </button>
          </div>

          {/* Tree Navigation Items */}
          <div className="space-y-1 text-xs">
            {/* Root: Storage Scope */}
            <div
              onClick={() => handleResetFilters()}
              className={cn(
                "flex items-center justify-between p-2 rounded-xl cursor-pointer font-bold transition-colors",
                !selectedCountryId && selectedModule === "all"
                  ? "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                  : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              )}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Globe className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                👑 Super Admin Storage (All)
              </span>
              <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full font-mono">
                {documents.length}
              </span>
            </div>

            {/* Countries & Branches Tree */}
            <div className="pl-2 space-y-1">
              {countries.map((c) => {
                const isSelectedC = selectedCountryId === c.id;
                const cDocCount = documents.filter((d) => d.country_id === c.id || d.country_name === c.name).length;
                return (
                  <div key={c.id} className="space-y-1">
                    <div
                      onClick={() => {
                        setSelectedCountryId(c.id);
                        setSelectedMainBranchId("");
                        setSelectedCityBranchId("");
                        setSelectedModule("all");
                      }}
                      className={cn(
                        "flex items-center justify-between p-1.5 rounded-lg cursor-pointer font-bold transition-colors",
                        isSelectedC && !selectedMainBranchId
                          ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
                          : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                      )}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        {c.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{cDocCount}</span>
                    </div>

                    {/* Main Branches */}
                    {isSelectedC && (
                      <div className="pl-3 space-y-0.5">
                        {(c.mainBranches || []).map((mb: any) => {
                          const isSelectedMB = selectedMainBranchId === mb.id;
                          return (
                            <div key={mb.id} className="space-y-0.5">
                              <div
                                onClick={() => {
                                  setSelectedMainBranchId(mb.id);
                                  setSelectedCityBranchId("");
                                  setSelectedModule("all");
                                }}
                                className={cn(
                                  "flex items-center justify-between p-1 rounded-md cursor-pointer text-[11px] font-semibold transition-colors",
                                  isSelectedMB && !selectedCityBranchId
                                    ? "bg-blue-100/70 text-blue-900 dark:bg-blue-950 dark:text-blue-200 font-bold"
                                    : "hover:bg-slate-50 text-slate-600 dark:text-slate-400"
                                )}
                              >
                                <span className="flex items-center gap-1 truncate">
                                  <FolderOpen className="h-3 w-3 text-indigo-500 shrink-0" />
                                  {mb.name}
                                </span>
                              </div>

                              {/* City Branches */}
                              {isSelectedMB && (
                                <div className="pl-3 space-y-0.5">
                                  {(mb.cityBranches || []).map((cb: any) => (
                                    <div
                                      key={cb.id}
                                      onClick={() => setSelectedCityBranchId(cb.id)}
                                      className={cn(
                                        "flex items-center justify-between p-1 rounded-md cursor-pointer text-[10.5px] transition-colors",
                                        selectedCityBranchId === cb.id
                                          ? "bg-blue-600 text-white font-bold"
                                          : "hover:bg-slate-50 text-slate-600 dark:text-slate-400"
                                      )}
                                    >
                                      <span className="truncate">{cb.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Module Folders Quick List */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                {t("folder_categories", "Folder Categories")}
              </div>
              {allFolderList.map((folderName) => {
                const count = documents.filter((d) => d.module_type === folderName).length;
                const isSelected = selectedModule === folderName;
                return (
                  <div
                    key={folderName}
                    onClick={() => setSelectedModule(folderName)}
                    className={cn(
                      "flex items-center justify-between px-2 py-1 rounded-lg cursor-pointer text-xs font-semibold transition-colors",
                      isSelected
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold"
                        : "hover:bg-slate-50 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Folder className="h-3 w-3 text-amber-500 shrink-0" />
                      {folderName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Main Document Explorer Area */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 space-y-4">
          {/* Active Clickable Breadcrumb Path Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 flex-wrap">
              <span className="text-slate-400 mr-1">{t("active_path", "Active Path:")}</span>

              {/* 1. Super Admin Storage Root Link */}
              <button
                type="button"
                onClick={() => handleResetFilters()}
                className={cn(
                  "hover:underline hover:text-blue-600 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded",
                  !selectedCountryId ? "text-blue-600 font-black bg-blue-50 dark:bg-blue-950" : "text-slate-600"
                )}
              >
                👑 Super Admin
              </button>

              {/* 2. Country Link */}
              {activeCountry && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMainBranchId("");
                      setSelectedCityBranchId("");
                      setSelectedModule("all");
                    }}
                    className={cn(
                      "hover:underline hover:text-blue-600 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded",
                      !selectedMainBranchId ? "text-blue-600 font-black bg-blue-50 dark:bg-blue-950" : "text-slate-600"
                    )}
                  >
                    🌍 {activeCountry.name}
                  </button>
                </>
              )}

              {/* 3. Main Branch Link */}
              {activeMainBranch && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCityBranchId("");
                      setSelectedModule("all");
                    }}
                    className={cn(
                      "hover:underline hover:text-blue-600 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded",
                      !selectedCityBranchId && selectedModule === "all" ? "text-blue-600 font-black bg-blue-50 dark:bg-blue-950" : "text-slate-600"
                    )}
                  >
                    🏢 {activeMainBranch.name}
                  </button>
                </>
              )}

              {/* 4. City Branch Link */}
              {activeCityBranch && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-800 dark:text-slate-200 font-bold">
                    📍 {activeCityBranch.name}
                  </span>
                </>
              )}

              {/* 5. Module Link */}
              {selectedModule !== "all" && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                    📁 {selectedModule}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <span>{filteredDocuments.length} {filteredDocuments.length === 1 ? "document" : "documents"} in view</span>
            </div>
          </div>

          {/* ── Files & Documents List / Grid ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>
                  {selectedModule !== "all"
                    ? `${selectedModule} Documents`
                    : activeMainBranch
                    ? `${activeMainBranch.name} Documents`
                    : activeCountry
                    ? `${activeCountry.name} Documents`
                    : "All Super Admin Repository Documents"}{" "}
                  ({filteredDocuments.length})
                </span>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                <p className="text-xs font-semibold">{t("loading_docs", "Loading documents...")}</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto text-slate-400">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold">{t("no_docs", "No documents found in this directory level.")}</p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {t("upload_first_doc", "Upload Document")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsScannerOpen(true)}
                    className="rounded-xl border-emerald-300 text-emerald-700 bg-emerald-50 text-xs font-bold"
                  >
                    <Camera className="h-3.5 w-3.5 mr-1" />
                    {t("start_scan", "Start Direct Scan")}
                  </Button>
                </div>
              </div>
            ) : viewMode === "grid" ? (
              /* Grid View */
              <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {filteredDocuments.map((doc) => {
                  const isPdf = doc.file_type?.toLowerCase().includes("pdf") || doc.file_name?.toLowerCase().endsWith(".pdf");
                  const isImg =
                    doc.file_type?.toLowerCase().includes("image") ||
                    /\.(png|jpe?g|webp)$/i.test(doc.file_name || "");
                  const isSheet =
                    doc.file_type?.toLowerCase().includes("sheet") ||
                    /\.(xlsx?|csv)$/i.test(doc.file_name || "");

                  return (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 p-3.5 hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0">
                              {isPdf ? (
                                <FileText className="h-4 w-4 text-red-500" />
                              ) : isImg ? (
                                <ImageIcon className="h-4 w-4 text-blue-500" />
                              ) : isSheet ? (
                                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <FileCheck className="h-4 w-4 text-indigo-500" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={doc.title}>
                                {doc.title}
                              </h3>
                              <p className="text-[10px] font-mono text-slate-400 truncate" title={doc.file_name}>
                                {doc.file_name}
                              </p>
                            </div>
                          </div>

                          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatBytes(doc.file_size)}
                          </span>
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1">
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            {doc.module_type}
                          </span>
                          {doc.country_name && (
                            <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              🌍 {doc.country_name}
                            </span>
                          )}
                          {doc.main_branch_name && (
                            <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              🏢 {doc.main_branch_name}
                            </span>
                          )}
                          {doc.company_name && (
                            <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 truncate max-w-[130px]">
                              {doc.company_name}
                            </span>
                          )}
                          {doc.person_account_name && (
                            <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 truncate max-w-[130px]">
                              👤 {doc.person_account_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(doc.scanned_at || doc.created_at).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center text-slate-600 transition-colors"
                            title={t("view", "View")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              download={doc.file_name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center text-slate-600 transition-colors"
                              title={t("download", "Download")}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(doc)}
                            className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-purple-50 hover:text-purple-600 flex items-center justify-center text-slate-600 transition-colors"
                            title={t("edit_move", "Edit / Move")}
                          >
                            <Move className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id)}
                            className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-slate-600 transition-colors"
                            title={t("delete", "Delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Table View */
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Title / File</th>
                      <th className="p-2.5">Country & Branch</th>
                      <th className="p-2.5">Module & Type</th>
                      <th className="p-2.5">Party / Company</th>
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                          <div className="truncate max-w-[180px]">{doc.title}</div>
                          <div className="text-[10px] font-mono text-slate-400 truncate max-w-[180px]">{doc.file_name}</div>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          <div>{doc.country_name || "—"}</div>
                          <div className="text-[10px] text-slate-400">{doc.main_branch_name || ""}</div>
                        </td>
                        <td className="p-2.5">
                          <span className="font-semibold text-blue-600">{doc.module_type}</span>
                          {doc.document_type && <span className="text-slate-400"> • {doc.document_type}</span>}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          <div>{doc.company_name || "—"}</div>
                          <div className="text-[10px] text-slate-400">{doc.person_account_name || doc.account_name || ""}</div>
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">{formatBytes(doc.file_size)}</td>
                        <td className="p-2.5 text-slate-500 font-mono text-[10px]">
                          {new Date(doc.scanned_at || doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-2.5 text-right space-x-1">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5 inline" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(doc)}
                            className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                            title="Edit / Move"
                          >
                            <Move className="h-3.5 w-3.5 inline" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 inline" />
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
      </div>

      {/* ── Modal 1: Direct Hardware Scanner Studio ── */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="max-w-md rounded-2xl p-5 font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
              <Camera className="h-5 w-5 text-emerald-600" />
              {t("scanner_studio", "Direct Hardware Scanner Studio")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {t("select_device", "Hardware Scanner Device")}
              </label>
              <select
                value={scannerDevice}
                onChange={(e) => setScannerDevice(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 font-semibold text-slate-800"
              >
                <option value="Fujitsu fi-7160 Enterprise TWAIN">Fujitsu fi-7160 Enterprise (TWAIN USB/LAN)</option>
                <option value="Canon imageFORMULA DR-C225 II">Canon imageFORMULA DR-C225 II (Fast Feeder)</option>
                <option value="Epson WorkForce DS-530 II">Epson WorkForce DS-530 II (Duplex)</option>
                <option value="HP ScanJet Pro 3000 s4">HP ScanJet Pro 3000 s4</option>
                <option value="Direct WebCamera Document Capture">Direct WebCam / Mobile Camera</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t("dpi", "Resolution")}</label>
                <select
                  value={scannerDpi}
                  onChange={(e) => setScannerDpi(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 font-semibold text-slate-800"
                >
                  <option value="150">150 DPI (Fast)</option>
                  <option value="300">300 DPI (Recommended)</option>
                  <option value="600">600 DPI (High Quality)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t("color", "Color Mode")}</label>
                <select
                  value={scannerColor}
                  onChange={(e) => setScannerColor(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 font-semibold text-slate-800"
                >
                  <option value="color">24-Bit Color</option>
                  <option value="grayscale">Grayscale</option>
                  <option value="bw">Black & White (Text)</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination Filing Path</span>
              <div className="text-[11px] font-mono text-slate-700 truncate">
                {activeCountry?.name || "Super Admin Storage"} › {activeMainBranch?.name || "All Branches"} › {selectedModule}
              </div>
            </div>

            {scanStatus && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 space-y-1.5">
                <div className="flex items-center gap-2 font-bold">
                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                  {scanStatus}
                </div>
                <div className="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full w-2/3 animate-pulse rounded-full" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsScannerOpen(false)}
              disabled={!!scanStatus}
              className="rounded-xl text-xs"
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleDirectScanExecute}
              disabled={!!scanStatus}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              <Camera className="h-3.5 w-3.5 mr-1" />
              {scanStatus ? t("scanning", "Scanning...") : t("start_scan", "Start Direct Scan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal 2: Create Custom Folder ── */}
      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-5 font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
              <FolderPlus className="h-5 w-5 text-purple-600" />
              {t("create_folder", "Create Custom Folder")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {t("folder_name", "Folder Name / Title")}
              </label>
              <Input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Audit 2026, Personal Dossier, Customs Vouchers..."
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="rounded-xl bg-purple-50 p-2.5 border border-purple-200 text-purple-900 text-[11px]">
              📁 Creates a custom folder under the current branch scope for quick filing and isolation.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsNewFolderOpen(false)} className="rounded-xl text-xs">
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={handleCreateFolder} className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs">
              {t("create", "Create Folder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal 3: Edit / Move Document ── */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
        <DialogContent className="max-w-md rounded-2xl p-5 font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
              <Move className="h-5 w-5 text-indigo-600" />
              {t("edit_title", "Edit / Move Document")}
            </DialogTitle>
          </DialogHeader>

          {editingDoc && (
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t("doc_title", "Document Title")}</label>
                <Input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-9 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t("module_folder", "Module Folder")}</label>
                  <select
                    value={editModule}
                    onChange={(e) => setEditModule(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 font-semibold text-slate-800"
                  >
                    {allFolderList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t("document_type", "Document Type")}</label>
                  <select
                    value={editDocType}
                    onChange={(e) => setEditDocType(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 font-semibold text-slate-800"
                  >
                    {DOCUMENT_TYPES.map((dt) => (
                      <option key={dt} value={dt}>
                        {dt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t("company_name", "Company Name")}</label>
                <Input
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t("account_name", "Account Name")}</label>
                <Input
                  type="text"
                  value={editAccount}
                  onChange={(e) => setEditAccount(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingDoc(null)} className="rounded-xl text-xs">
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={handleSaveEdit} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs">
              {t("save_changes", "Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal 4: Document Viewer & Details ── */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl rounded-2xl p-5 font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base font-black text-slate-900 pr-6">
              <span className="truncate">{previewDoc?.title}</span>
              <span className="text-xs font-mono font-normal text-slate-400">{previewDoc?.file_name}</span>
            </DialogTitle>
          </DialogHeader>

          {previewDoc && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Module</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{previewDoc.module_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Type</span>
                  <span className="font-bold text-purple-600">{previewDoc.document_type || "Document"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Size</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{formatBytes(previewDoc.file_size)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Scanned At</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                    {new Date(previewDoc.scanned_at || previewDoc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {previewDoc.document_path && (
                <div className="rounded-xl bg-slate-100/70 p-2 text-[11px] font-mono text-slate-600 truncate">
                  📂 {previewDoc.document_path}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                {previewDoc.file_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(previewDoc.file_url, "_blank")}
                    className="rounded-xl text-xs font-bold gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t("open_fullscreen", "Open Full Screen")}
                  </Button>
                )}

                {previewDoc.file_url && (
                  <a
                    href={previewDoc.file_url}
                    download={previewDoc.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t("download", "Download")}
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
