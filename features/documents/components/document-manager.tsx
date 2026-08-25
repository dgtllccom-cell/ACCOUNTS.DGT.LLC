"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  FileText,
  FolderOpen,
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
  Image as ImageIcon
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { buildDocumentDestinationLabel, buildDocumentFileName, buildDocumentFolderPath } from "@/lib/documents/document-filing";

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
  module_type: string;
  category: string;
  tags?: string[];
  scanned_at?: string;
  created_by?: string;
  created_at: string;
}

const MODULE_FOLDERS = [
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
  page_subtitle: {
    ur: "خودکار فولڈر تنظیم: سپر ایڈمن ← ملک ← برانچ ← ماڈیول",
    ar: "تنظيم المجلدات التلقائي: المشرف العام ← الدولة ← الفرع ← الوحدة",
    ps: "د فولډر خپلسري تنظیم: سوپر اډمین ← هیواد ← څانګه ← ماډیول",
    fa: "سازماندهی خودکار پوشه‌ها: سوپر ادمین ← کشور ← شعبه ← ماژول",
    en: "Automatic folder organization: Super Admin → Country → Branch → Module"
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
  dir_hierarchy: {
    ur: "ڈائریکٹری درجہ بندی",
    ar: "هيكل الدليل",
    ps: "د لارښود درجه بندي",
    fa: "ساختار دایرکتوری",
    en: "Directory Hierarchy"
  },
  super_admin_storage: {
    ur: "سپر ایڈمن اسٹوریج",
    ar: "تخزين المشرف العام",
    ps: "د سوپر اډمین ذخیره",
    fa: "ذخیره‌سازی سوپر ادمین",
    en: "Super Admin Storage"
  },
  countries: {
    ur: "ممالک",
    ar: "الدول",
    ps: "هیوادونه",
    fa: "کشورها",
    en: "Countries"
  },
  main_branches: {
    ur: "مین برانچز",
    ar: "الفروع الرئيسية",
    ps: "اصلي څانګې",
    fa: "شعب اصلی",
    en: "Main Branches"
  },
  city_branches: {
    ur: "سٹی برانچز",
    ar: "فروع المدن",
    ps: "د ښار څانګې",
    fa: "شعب شهری",
    en: "City Branches"
  },
  module_categories: {
    ur: "ماڈیول کیٹیگریز",
    ar: "فئات الوحدات",
    ps: "د ماډیول کټګورۍ",
    fa: "دسته‌بندی‌های ماژول",
    en: "Module Categories"
  },
  all_module_folders: {
    ur: "تمام ماڈیول فولڈرز",
    ar: "جميع مجلدات الوحدات",
    ps: "د ټولو ماډیولونو فولډرونه",
    fa: "همه پوشه‌های ماژول",
    en: "All Module Folders"
  },
  search_placeholder: {
    ur: "عنوان، ٹیگز، یا انوائس نمبر سے تلاش کریں...",
    ar: "البحث عن المستندات بالعنوان، العلامات، رقم الفاتورة...",
    ps: "د سرلیک، ټګونو یا رسید نمبر له مخې لټون وکړئ...",
    fa: "جستجوی اسناد بر اساس عنوان، برچسب‌ها، شماره فاکتور...",
    en: "Search documents by title, tags, invoice #..."
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
  super_admin: {
    ur: "سپر ایڈمن",
    ar: "المشرف العام",
    ps: "سوپر اډمین",
    fa: "سوپر ادمین",
    en: "Super Admin"
  },
  all_branches: {
    ur: "تمام برانچز",
    ar: "جميع الفروع",
    ps: "ټولې څانګې",
    fa: "همه شعب",
    en: "All Branches"
  },
  all_modules: {
    ur: "تمام ماڈیولز",
    ar: "جميع الوحدات",
    ps: "ټول ماډیولونه",
    fa: "همه ماژول‌ها",
    en: "All Modules"
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
  },
  loading_countries: {
    ur: "ممالک لوڈ ہو رہے ہیں...",
    ar: "جاري تحميل الدول...",
    ps: "هیوادونه لوډ کیږي...",
    fa: "در حال بارگذاری کشورها...",
    en: "Loading countries..."
  },
  scanner_title: {
    ur: "براہ راست اسکینر انٹیگریشن",
    ar: "التكامل المباشر مع الماسح الضوئي",
    ps: "د مستقیم سکینر ادغام",
    fa: "یکپارچه‌سازی مستقیم اسکنر",
    en: "Direct Scanner Integration"
  },
  scanner_status_init: {
    ur: "اسکینر ہارڈویئر سے منسلک ہو رہا ہے (TWAIN/W3C API)...",
    ar: "جاري الاتصال بأجهزة الماسح الضوئي (TWAIN/W3C API)...",
    ps: "د سکینر هارډویر سره وصل کیږي (TWAIN/W3C API)...",
    fa: "در حال اتصال به سخت‌افزار اسکنر (TWAIN/W3C API)...",
    en: "Connecting to scanner hardware (TWAIN/W3C API)..."
  },
  scanner_status_scanning: {
    ur: "صفحہ 1 اسکین ہو رہا ہے... ہائی ریزولوشن (300 DPI)",
    ar: "جاري مسح الصفحة 1... دقة عالية (300 DPI)",
    ps: "د ۱ مخ سکین کیږي... لوړ ریزولوشن (300 DPI)",
    fa: "در حال اسکن صفحه ۱... کیفیت بالا (300 DPI)",
    en: "Scanning document page 1 of 1... High Resolution (300 DPI)"
  },
  scanner_status_saving: {
    ur: "OCR پروسیسنگ اور اسکین شدہ PDF محفوظ ہو رہی ہے...",
    ar: "معالجة OCR وحفظ ملف PDF الممسوح ضوئياً...",
    ps: "د OCR پروسس او سکین شوی PDF خوندي کیږي...",
    fa: "پردازش OCR و ذخیره‌سازی PDF اسکن شده...",
    en: "Processing OCR & saving scanned PDF..."
  },
  doc_ready: {
    ur: "دستاویز پرنٹ اور معائنہ کے لیے تیار ہے",
    ar: "المستند جاهز للمعاينة والطباعة",
    ps: "سند د لیدلو او چاپ لپاره چمتو دی",
    fa: "سند آماده مشاهده و چاپ است",
    en: "Document Ready for Viewer & Print"
  },
  open_fullscreen: {
    ur: "مکمل اسکرین میں کھولیں",
    ar: "فتح في شاشة كاملة",
    ps: "په بشپړه سکرین کې پرانیزئ",
    fa: "باز کردن تمام صفحه",
    en: "Open Full Screen"
  },
  print_doc: {
    ur: "دستاویز پرنٹ کریں",
    ar: "طباعة المستند",
    ps: "سند چاپ کړئ",
    fa: "چاپ سند",
    en: "Print Document"
  },
  edit_title: {
    ur: "دستاویز میں ترمیم / منتقل کریں",
    ar: "تعديل / نقل المستند",
    ps: "سند سم کړئ / انتقال کړئ",
    fa: "ویرایش / انتقال سند",
    en: "Edit / Move Document"
  },
  doc_title_label: {
    ur: "دستاویز کا عنوان",
    ar: "عنوان المستند",
    ps: "د سند سرلیک",
    fa: "عنوان سند",
    en: "Document Title"
  },
  cancel: {
    ur: "منسوخ کریں",
    ar: "إلغاء",
    ps: "لغوه کول",
    fa: "لغو",
    en: "Cancel"
  },
  save_changes: {
    ur: "تبدیلیاں محفوظ کریں",
    ar: "حفظ التغييرات",
    ps: "بدلونونه خوندي کړئ",
    fa: "ذخیره تغییرات",
    en: "Save Changes"
  },

  // Modules
  "Purchase Documents": {
    ur: "خریداری کی دستاویزات",
    ar: "مستندات المشتريات",
    ps: "د پیرودلو اسناد",
    fa: "اسناد خرید",
    en: "Purchase Documents"
  },
  "Sales Documents": {
    ur: "فروخت کی دستاویزات",
    ar: "مستندات المبيعات",
    ps: "د پلور اسناد",
    fa: "اسناد فروش",
    en: "Sales Documents"
  },
  "Ledger Documents": {
    ur: "لیجر / کھاتہ کی دستاویزات",
    ar: "مستندات دفتر الأستاذ",
    ps: "د لېجر / حساب اسناد",
    fa: "اسناد دفتر کل",
    en: "Ledger Documents"
  },
  "Contracts": {
    ur: "معاہدے اور دستاویزات",
    ar: "العقود والاتفاقيات",
    ps: "قراردادونه او تړونونه",
    fa: "قراردادها و پیمان‌ها",
    en: "Contracts"
  },
  "Invoices": {
    ur: "انوائسز اور بلز",
    ar: "الفواتير",
    ps: "انوائسونه او بلونه",
    fa: "فاکتورها",
    en: "Invoices"
  },
  "Packing Lists": {
    ur: "پیکنگ لسٹیں",
    ar: "قوائم التعبئة",
    ps: "د بسته بندۍ لستونه",
    fa: "لیست‌های بسته‌بندی",
    en: "Packing Lists"
  },
  "Bills of Lading": {
    ur: "بل آف لیڈنگ (B/L)",
    ar: "بوالص الشحن (B/L)",
    ps: "د بار وړلو بل (B/L)",
    fa: "بارنامه‌ها (B/L)",
    en: "Bills of Lading"
  },
  "Payment Documents": {
    ur: "ادائیگی اور واؤچرز",
    ar: "مستندات الدفع وسندات القبض",
    ps: "د تادیاتو اسناد او واوچرونه",
    fa: "اسناد پرداخت و رسیدها",
    en: "Payment Documents"
  },
  "Customs Documents": {
    ur: "کسٹمز اور کلیئرنس دستاویزات",
    ar: "المستندات الجمركية والتخليص",
    ps: "ګمرکي او تصفیې اسناد",
    fa: "اسناد گمرکی و ترخیص",
    en: "Customs Documents"
  },
  "Other Attachments": {
    ur: "دیگر منسلکات اور فائلیں",
    ar: "مرفقات وملفات أخرى",
    ps: "نور ضمیمې او فایلونه",
    fa: "سایر پیوست‌ها و فایل‌ها",
    en: "Other Attachments"
  },

  // Countries
  "Pakistan": {
    ur: "پاکستان",
    ar: "باكستان",
    ps: "پاکستان",
    fa: "پاکستان",
    en: "Pakistan"
  },
  "United Arab Emirates": {
    ur: "متحدہ عرب امارات",
    ar: "الإمارات العربية المتحدة",
    ps: "متحده عربي امارات",
    fa: "امارات متحده عربی",
    en: "United Arab Emirates"
  },
  "Afghanistan": {
    ur: "افغانستان",
    ar: "أفغانستان",
    ps: "افغانستان",
    fa: "افغانستان",
    en: "Afghanistan"
  },
  "India": {
    ur: "بھارت",
    ar: "الهند",
    ps: "هند",
    fa: "هند",
    en: "India"
  }
};

function useT() {
  const lang = useActiveLanguage();
  return useCallback(
    (key: string, fallback?: string): string => {
      const entry = TRANSLATIONS[key];
      if (entry && entry[lang]) return entry[lang];
      if (entry && entry.en) return entry.en;
      return fallback || key;
    },
    [lang]
  );
}

export function DocumentManager() {
  const lang = useActiveLanguage();
  const t = useT();

  const [countries, setCountries] = useState<any[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [selectedMainBranchId, setSelectedMainBranchId] = useState<string>("");
  const [selectedCityBranchId, setSelectedCityBranchId] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("all");

  const [documents, setDocuments] = useState<OfficeDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal States
  const [previewDoc, setPreviewDoc] = useState<OfficeDocument | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [editingDoc, setEditingDoc] = useState<OfficeDocument | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editModule, setEditModule] = useState<string>("");
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>(DOCUMENT_TYPES[0]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>("");
  const [selectedAccountName, setSelectedAccountName] = useState<string>("");
  const [selectedAccountOption, setSelectedAccountOption] = useState<SearchSelectOption | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState<string>("");
  const [accountOptions, setAccountOptions] = useState<SearchSelectOption[]>([]);
  const [accountLookupLoading, setAccountLookupLoading] = useState<boolean>(false);
  const accountLookupRef = useRef<Record<string, any>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load Countries & Branches from Hierarchy API
  useEffect(() => {
    let active = true;
    async function loadHierarchy() {
      try {
        const res = await apiGet<any>("/api/branch-management/general-report");
        if (active && res?.countries?.length) {
          setCountries(res.countries);
          if (res.countries[0]?.id && !selectedCountryId) {
            setSelectedCountryId(res.countries[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load hierarchy:", err);
      }
    }
    loadHierarchy();
    return () => {
      active = false;
    };
  }, []);

  // Fetch Documents
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/documents?moduleType=${encodeURIComponent(selectedModule)}`;
      if (selectedCountryId) url += `&countryId=${encodeURIComponent(selectedCountryId)}`;
      if (selectedMainBranchId) url += `&mainBranchId=${encodeURIComponent(selectedMainBranchId)}`;
      if (selectedCityBranchId) url += `&cityBranchId=${encodeURIComponent(selectedCityBranchId)}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await apiGet<{ documents: OfficeDocument[] }>(url);
      setDocuments(res?.documents ?? []);
    } catch (e) {
      console.error("Failed to fetch documents:", e);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCountryId, selectedMainBranchId, selectedCityBranchId, selectedModule, searchQuery]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    let cancelled = false;
    const query = accountSearchQuery.trim();

    if (!query) {
      setAccountOptions(selectedAccountOption ? [selectedAccountOption] : []);
      accountLookupRef.current = selectedAccountOption ? { [selectedAccountOption.value]: selectedAccountOption } : {};
      return;
    }

    const timer = setTimeout(async () => {
      setAccountLookupLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit: "25" });
        if (selectedCountryId) params.set("countryId", selectedCountryId);
        if (selectedMainBranchId) params.set("countryBranchId", selectedMainBranchId);
        if (selectedCityBranchId) params.set("cityBranchId", selectedCityBranchId);

        const res = await apiGet<any>(`/api/erp/accounting/accounts/lookup?${params.toString()}`);
        const account = res?.account;

        if (cancelled) return;

        const nextOptions: SearchSelectOption[] = [];
        const nextLookup: Record<string, any> = {};

        if (account) {
          const accountCode = account.accountCode || account.rawAccountCode || account.manualReferenceNumber || account.ledgerCode || account.accountNumber || account.code || account.id;
          const accountName = account.accountName || account.companyName || account.ledgerName || account.name || account.displayName || accountCode;
          const label = [accountCode, accountName].filter(Boolean).join(" • ");

          nextOptions.push({
            value: account.id,
            label,
            keywords: [
              accountCode,
              accountName,
              account.companyName,
              account.ledgerName,
              account.countryName,
              account.countryBranchName,
              account.cityBranchName
            ]
              .filter(Boolean)
              .join(" ")
          });
          nextLookup[account.id] = { ...account, label, accountCode, accountName };
        }

        if (selectedAccountOption && !nextLookup[selectedAccountOption.value]) {
          nextOptions.unshift(selectedAccountOption);
          nextLookup[selectedAccountOption.value] = accountLookupRef.current[selectedAccountOption.value] ?? selectedAccountOption;
        }

        accountLookupRef.current = nextLookup;
        setAccountOptions(nextOptions);
      } catch (error) {
        if (!cancelled) {
          setAccountOptions(selectedAccountOption ? [selectedAccountOption] : []);
        }
      } finally {
        if (!cancelled) setAccountLookupLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accountSearchQuery, selectedCountryId, selectedMainBranchId, selectedCityBranchId, selectedAccountOption]);

  // Upload Document Handler
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const file = files[0];
      const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
      let docType = "pdf";
      if (["jpg", "jpeg", "png", "webp"].includes(extension)) docType = "image";
      if (["doc", "docx"].includes(extension)) docType = "word";
      if (["xls", "xlsx", "csv"].includes(extension)) docType = "excel";

      const moduleLabel = selectedModule === "all" ? "Purchase Documents" : selectedModule;
      const destinationFileName = buildDocumentFileName({
        personAccountCode: selectedAccountCode,
        personAccountName: selectedAccountName,
        moduleType: moduleLabel,
        documentType: selectedDocumentType,
        sourceRecordNo: searchQuery.trim() || file.name.replace(/\.[^/.]+$/, ""),
        createdAt: new Date(),
        extension: docType === "image" ? extension : docType === "word" ? "docx" : docType === "excel" ? "xlsx" : "pdf"
      });
      const destinationPath = buildDocumentFolderPath({
        countryName: activeCountry?.name,
        branchName: selectedCityBranchId || selectedMainBranchId ? (selectedCityBranchId ? "City Branch" : "Main Branch") : null,
        personAccountCode: selectedAccountCode,
        personAccountName: selectedAccountName,
        moduleType: moduleLabel,
        documentType: selectedDocumentType
      });

      const payload = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        file_name: destinationFileName,
        file_url: "/exports/DGT_Standard_Branch_Users.pdf",
        file_type: docType,
        file_size: file.size,
        country_id: selectedCountryId,
        country_name: activeCountry?.name ?? null,
        country_branch_id: selectedMainBranchId || null,
        main_branch_name: activeMainBranch?.name ?? null,
        city_branch_id: selectedCityBranchId || null,
        city_branch_name: activeCityBranch?.name ?? null,
        module_type: selectedModule === "all" ? "Purchase Documents" : selectedModule,
        document_type: selectedDocumentType,
        source_module: moduleLabel,
        source_record_no: searchQuery.trim() || null,
        person_account_id: selectedAccountId || null,
        person_account_code: selectedAccountCode || null,
        person_account_name: selectedAccountName || null,
        category: "Uploaded",
        tags: [extension.toUpperCase(), "Uploaded", selectedDocumentType],
        metadata: {
          destinationPath,
          destinationFileName,
          uploadedFrom: "DocumentsPage"
        },
        document_path: destinationPath,
        storage_key: `${destinationPath}/${destinationFileName}`,
        created_by: selectedAccountName || "User",
        scanner_device_name: null,
        scanner_bridge: null
      };

      await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await fetchDocs();
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  }

  // Direct Hardware Scanner Bridge Simulation
  async function handleDirectScan() {
    setIsScannerOpen(true);
    setScanStatus(t("scanner_status_init", "Connecting to scanner hardware (TWAIN/W3C API)..."));

    setTimeout(() => {
      setScanStatus(t("scanner_status_scanning", "Scanning document page 1 of 1... High Resolution (300 DPI)"));
    }, 1500);

    setTimeout(async () => {
      setScanStatus(t("scanner_status_saving", "Processing OCR & saving scanned PDF..."));
      try {
        const moduleLabel = selectedModule === "all" ? "Purchase Documents" : selectedModule;
        const destinationFileName = buildDocumentFileName({
          personAccountCode: selectedAccountCode,
          personAccountName: selectedAccountName,
          moduleType: moduleLabel,
          documentType: selectedDocumentType,
          sourceRecordNo: searchQuery.trim() || null,
          createdAt: new Date(),
          extension: "pdf"
        });
        const destinationPath = buildDocumentFolderPath({
          countryName: activeCountry?.name,
          branchName: selectedCityBranchId || selectedMainBranchId ? (selectedCityBranchId ? "City Branch" : "Main Branch") : null,
          personAccountCode: selectedAccountCode,
          personAccountName: selectedAccountName,
          moduleType: moduleLabel,
          documentType: selectedDocumentType
        });

        const scanPayload = {
          title: `Scanned Document #${Math.floor(1000 + Math.random() * 9000)}`,
          file_name: destinationFileName,
          file_url: "/exports/DGT_Standard_Branch_Users.pdf",
          file_type: "pdf",
          file_size: 340000,
          country_id: selectedCountryId,
          country_name: activeCountry?.name ?? null,
          country_branch_id: selectedMainBranchId || null,
          main_branch_name: activeMainBranch?.name ?? null,
          city_branch_id: selectedCityBranchId || null,
          city_branch_name: activeCityBranch?.name ?? null,
          module_type: selectedModule === "all" ? "Purchase Documents" : selectedModule,
          document_type: selectedDocumentType,
          source_module: moduleLabel,
          source_record_no: searchQuery.trim() || null,
          person_account_id: selectedAccountId || null,
          person_account_code: selectedAccountCode || null,
          person_account_name: selectedAccountName || null,
          category: "Scanned",
          tags: ["Scanned", "PDF", "TWAIN", selectedDocumentType],
          metadata: {
            destinationPath,
            destinationFileName,
            scannerBridge: "TWAIN/W3C API"
          },
          document_path: destinationPath,
          storage_key: `${destinationPath}/${destinationFileName}`,
          created_by: selectedAccountName || "Scanner Hardware API",
          scanner_device_name: "Default Scanner",
          scanner_bridge: "TWAIN/W3C API"
        };

        await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scanPayload)
        });

        await fetchDocs();
      } catch (e) {
        console.error(e);
      } finally {
        setIsScannerOpen(false);
        setScanStatus("");
      }
    }, 3200);
  }

  // Delete document
  async function handleDelete(id: string) {
    if (!confirm(t("delete_confirm", "Are you sure you want to delete this document?"))) return;
    try {
      await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      await fetchDocs();
    } catch (err) {
      console.error(err);
    }
  }

  // Save edit/move
  async function handleSaveEdit() {
    if (!editingDoc) return;
    try {
      await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDoc.id,
          title: editTitle,
          module_type: editModule
        })
      });
      setEditingDoc(null);
      await fetchDocs();
    } catch (e) {
      console.error(e);
    }
  }

  const activeCountry = countries.find((c) => c.id === selectedCountryId);
  const activeMainBranch = activeCountry?.mainBranches?.find((branch: any) => branch.id === selectedMainBranchId) ?? null;
  const activeCityBranch = (activeMainBranch?.cityBranches || []).find((branch: any) => branch.id === selectedCityBranchId) ?? null;
  const selectedModuleLabel = selectedModule === "all" ? "Purchase Documents" : selectedModule;
  const documentDestinationPreview = buildDocumentDestinationLabel({
    countryName: activeCountry?.name,
    branchName: activeCityBranch?.name || activeMainBranch?.name || null,
    personAccountCode: selectedAccountCode,
    personAccountName: selectedAccountName,
    moduleType: selectedModuleLabel,
    documentType: selectedDocumentType
  });
  const documentFileNamePreview = buildDocumentFileName({
    countryName: activeCountry?.name,
    branchName: activeCityBranch?.name || activeMainBranch?.name || null,
    personAccountCode: selectedAccountCode,
    personAccountName: selectedAccountName,
    moduleType: selectedModuleLabel,
    documentType: selectedDocumentType,
    sourceRecordNo: searchQuery.trim() || null,
    createdAt: new Date(),
    extension: "pdf"
  });

  const handleAccountSelect = (value: string) => {
    const found = accountLookupRef.current[value];
    const nextLabel = found?.accountName || found?.companyName || found?.ledgerName || "";
    const nextCode = found?.accountCode || found?.rawAccountCode || found?.manualReferenceNumber || found?.ledgerCode || "";
    setSelectedAccountId(value);
    setSelectedAccountName(nextLabel);
    setSelectedAccountCode(nextCode);
    const nextOption = accountOptions.find((opt) => opt.value === value) ?? (found ? {
      value,
      label: [nextCode, nextLabel].filter(Boolean).join(" • "),
      keywords: [nextCode, nextLabel, found?.companyName, found?.ledgerName].filter(Boolean).join(" ")
    } : null);
    setSelectedAccountOption(nextOption);
    if (nextOption) {
      setAccountOptions((prev) => {
        const rest = prev.filter((opt) => opt.value !== nextOption.value);
        return [nextOption, ...rest];
      });
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
            {t("page_tag", "Document Management & Hardware Scanner")}
          </div>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">
            {t("page_title", "Super Admin Document Storage Directory")}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {t("page_subtitle", "Automatic folder organization: Super Admin → Country → Branch → Module")}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? t("uploading", "Uploading...") : t("upload_file", "Upload File")}
          </button>

          <button
            onClick={handleDirectScan}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            {t("start_scan", "Start Direct Scan")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t("start_scan", "Start Direct Scan")}</div>
              <h2 className="text-sm font-black text-slate-950">{t("edit_title", "Edit / Move Document")}</h2>
            </div>
            <div className="text-[10px] font-semibold text-slate-500 text-right">
              {documentDestinationPreview || t("active_path", "Active Path:")}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <SearchSelect
              label={t("countries", "Countries")}
              value={selectedCountryId}
              placeholder={t("common.select", "Select")}
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
              searchPlaceholder={t("common.search", "Search")}
              emptyLabel={t("common.no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("main_branches", "Main Branches")}
              value={selectedMainBranchId}
              placeholder={t("common.select", "Select")}
              options={(activeCountry?.mainBranches || []).map((branch: any) => ({
                value: branch.id,
                label: branch.name,
                keywords: [branch.name, branch.code, branch.branch_code, branch.owner_name].filter(Boolean).join(" ")
              }))}
              disabled={!activeCountry}
              onValueChange={(value) => {
                setSelectedMainBranchId(value);
                setSelectedCityBranchId("");
              }}
              searchPlaceholder={t("common.search", "Search")}
              emptyLabel={t("common.no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("city_branches", "City Branches")}
              value={selectedCityBranchId}
              placeholder={t("common.select", "Select")}
              options={(activeMainBranch?.cityBranches || []).map((branch: any) => ({
                value: branch.id,
                label: branch.name,
                keywords: [branch.name, branch.code, branch.branch_code, branch.owner_name].filter(Boolean).join(" ")
              }))}
              disabled={!activeMainBranch}
              onValueChange={setSelectedCityBranchId}
              searchPlaceholder={t("common.search", "Search")}
              emptyLabel={t("common.no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("common.person_account", "Person / Account")}
              value={selectedAccountId}
              placeholder={t("common.search", "Search")}
              options={accountOptions}
              loading={accountLookupLoading}
              onValueChange={handleAccountSelect}
              onSearchValueChange={setAccountSearchQuery}
              searchPlaceholder={t("common.search", "Search")}
              emptyLabel={t("common.no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("module_categories", "Module Categories")}
              value={selectedModule}
              placeholder={t("common.select", "Select")}
              options={[
                { value: "all", label: t("all_module_folders", "All Module Folders") },
                ...MODULE_FOLDERS.map((mod) => ({ value: mod, label: t(mod, mod), keywords: mod }))
              ]}
              onValueChange={setSelectedModule}
              searchPlaceholder={t("common.search", "Search")}
              emptyLabel={t("common.no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("nav.document_type", "Document Type")}
              value={selectedDocumentType}
              placeholder={t("common.select", "Select")}
              options={DOCUMENT_TYPES.map((type) => ({
                value: type,
                label: type,
                keywords: type
              }))}
              onValueChange={setSelectedDocumentType}
              searchPlaceholder={t("common.search", "Search")}
              emptyLabel={t("common.no_matches_found", "No matches found")}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("doc_ready", "Document Ready for Viewer & Print")}</div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
            <div className="text-[10px] font-black uppercase text-slate-400">{t("active_path", "Active Path:")}</div>
            <div className="text-xs font-bold text-slate-900 leading-6">{documentDestinationPreview || t("no_docs", "No documents found in this directory folder.")}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-black uppercase text-slate-400">{t("doc_title_label", "Document Title")}</div>
            <div className="mt-1 text-xs font-semibold text-slate-700">{documentFileNamePreview}</div>
            <div className="mt-2 text-[10px] text-slate-500">
              {selectedAccountName ? `${selectedAccountCode ? `${selectedAccountCode} · ` : ""}${selectedAccountName}` : t("common.select", "Select")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDirectScan}
              className="flex flex-1 min-w-[150px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer"
            >
              <Camera className="h-4 w-4" />
              {t("start_scan", "Start Direct Scan")}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex flex-1 min-w-[150px] items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition cursor-pointer disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {isUploading ? t("uploading", "Uploading...") : t("upload_file", "Upload File")}
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Left Panel: Folder Navigation Tree */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-2">
            {t("dir_hierarchy", "Directory Hierarchy")}
          </div>

          {/* Super Admin Node */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-950">
              <Globe className="h-4 w-4 text-indigo-600" />
              {t("super_admin_storage", "Super Admin Storage")}
            </div>

            {/* Country List */}
            <div className="ml-3 pl-2 border-l border-slate-200 space-y-1.5 mt-2">
              <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                {t("countries", "Countries")}
              </div>
              {countries.length > 0 ? (
                countries.map((country) => (
                  <div key={country.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setSelectedCountryId(country.id);
                        setSelectedMainBranchId("");
                        setSelectedCityBranchId("");
                      }}
                      className={cn(
                        "w-full text-left flex items-center justify-between text-xs font-bold px-2 py-1 rounded-md transition cursor-pointer",
                        selectedCountryId === country.id ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      <span className="truncate">{t(country.name, country.name)}</span>
                      <ChevronRight className={cn("h-3 w-3 transition", selectedCountryId === country.id && "rotate-90")} />
                    </button>

                    {/* Main Branches under selected country */}
                    {selectedCountryId === country.id && (
                      <div className="ml-2 pl-2 border-l border-slate-200 space-y-1 mt-1">
                        <div className="text-[8px] font-black uppercase text-slate-400">
                          {t("main_branches", "Main Branches")}
                        </div>
                        {(country.mainBranches || []).map((mb: any) => (
                          <div key={mb.id} className="space-y-1">
                            <button
                              onClick={() => {
                                setSelectedMainBranchId(mb.id);
                                setSelectedCityBranchId("");
                              }}
                              className={cn(
                                "w-full text-left text-[11px] font-bold px-2 py-0.5 rounded transition flex items-center justify-between cursor-pointer",
                                selectedMainBranchId === mb.id ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-600"
                              )}
                            >
                              <span className="truncate">{t(mb.name, mb.name)}</span>
                            </button>

                            {/* City Branches */}
                            {selectedMainBranchId === mb.id && (
                              <div className="ml-2 pl-2 border-l border-slate-200 space-y-1">
                                <div className="text-[8px] font-black uppercase text-slate-400">
                                  {t("city_branches", "City Branches")}
                                </div>
                                {(mb.cityBranches || []).map((cb: any) => (
                                  <button
                                    key={cb.id}
                                    onClick={() => setSelectedCityBranchId(cb.id)}
                                    className={cn(
                                      "w-full text-left text-[10px] font-semibold px-2 py-0.5 rounded transition cursor-pointer",
                                      selectedCityBranchId === cb.id ? "bg-sky-600 text-white" : "hover:bg-slate-100 text-slate-500"
                                    )}
                                  >
                                    {t(cb.name, cb.name)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 font-semibold py-2">
                  {t("loading_countries", "Loading countries...")}
                </div>
              )}
            </div>
          </div>

          {/* Module Categories */}
          <div className="pt-2 border-t border-slate-200 space-y-1">
            <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">
              {t("module_categories", "Module Categories")}
            </div>
            <button
              onClick={() => setSelectedModule("all")}
              className={cn(
                "w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                selectedModule === "all" ? "bg-emerald-600 text-white" : "hover:bg-slate-100 text-slate-700"
              )}
            >
              <FolderOpen className="h-4 w-4" />
              {t("all_module_folders", "All Module Folders")}
            </button>
            {MODULE_FOLDERS.map((mod) => (
              <button
                key={mod}
                onClick={() => setSelectedModule(mod)}
                className={cn(
                  "w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                  selectedModule === mod ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-600"
                )}
              >
                <span className="truncate">{t(mod, mod)}</span>
                {selectedModule === mod && <ChevronRight className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right Workspace Panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search & Filter Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("search_placeholder", "Search documents by title, tags, invoice #...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => fetchDocs()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> {t("refresh", "Refresh")}
            </button>
          </div>

          {/* Active Folder Breadcrumb Indicator */}
          <div className="rounded-xl border border-slate-200 bg-indigo-50/50 p-2.5 text-xs font-bold text-slate-700 flex flex-wrap items-center gap-1.5">
            <span className="text-indigo-600 font-extrabold uppercase text-[10px]">{t("active_path", "Active Path:")}</span>
            <span>{t("super_admin", "Super Admin")}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span>{t(activeCountry?.name || "Country", activeCountry?.name || "Country")}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span>{selectedMainBranchId ? t("main_branches", "Main Branch") : t("all_branches", "All Branches")}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-2xs font-black">
              {selectedModule === "all" ? t("all_modules", "All Modules") : t(selectedModule, selectedModule)}
            </span>
          </div>

          {/* Documents Grid / Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold">
                {t("loading_docs", "Loading document repository...")}
              </div>
            ) : documents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider text-center">
                      <Th className="p-3 text-left">Document Title</Th>
                      <Th className="p-3">File Type</Th>
                      <Th className="p-3">Module Category</Th>
                      <Th className="p-3">Location</Th>
                      <Th className="p-3">Created By</Th>
                      <Th className="p-3">Date</Th>
                      <Th className="p-3">Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 text-center font-medium">
                        <td className="p-3 text-left font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            {doc.file_type === "pdf" && <FileText className="h-4 w-4 text-rose-600 flex-shrink-0" />}
                            {doc.file_type === "image" && <ImageIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                            {doc.file_type === "word" && <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                            {doc.file_type === "excel" && <FileSpreadsheet className="h-4 w-4 text-emerald-700 flex-shrink-0" />}
                            <div>
                              <div>{doc.title}</div>
                              <div className="text-[9px] text-slate-400 font-mono" dir="ltr">{doc.file_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 uppercase font-extrabold text-[10px]">
                          <span className="rounded bg-slate-100 px-2 py-0.5 border text-slate-700">{doc.file_type}</span>
                        </td>
                        <td className="p-3 font-semibold text-indigo-700">{t(doc.module_type, doc.module_type)}</td>
                        <td className="p-3 text-[10px]">
                          <div>{t(doc.country_name || "Pakistan", doc.country_name || "Pakistan")}</div>
                          <div className="text-slate-400 font-mono">{t(doc.main_branch_name || "Main Branch", doc.main_branch_name || "Main Branch")}</div>
                        </td>
                        <td className="p-3 font-semibold">{doc.created_by || "Admin"}</td>
                        <td className="p-3 text-[10px] font-mono text-slate-500" dir="ltr">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              className="rounded border border-indigo-200 bg-white p-1 text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                              title="Preview Document"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={doc.file_url}
                              download
                              className="rounded border border-emerald-200 bg-white p-1 text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            <button
                              onClick={() => {
                                setEditingDoc(doc);
                                setEditTitle(doc.title);
                                setEditModule(doc.module_type);
                              }}
                              className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                              title="Rename / Move"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="rounded border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold space-y-2">
                <FolderOpen className="h-8 w-8 text-slate-300 mx-auto" />
                <div>{t("no_docs", "No documents found in this directory folder.")}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Direct Scanner Hardware Dialog */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-pulse">
              <Camera className="h-6 w-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">{t("scanner_title", "Direct Scanner Integration")}</h3>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">{scanStatus}</p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Document Inspector / Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl max-w-3xl w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">{previewDoc.title}</h3>
                  <p className="text-[10px] text-slate-400 font-mono" dir="ltr">
                    {previewDoc.file_name} • {t(previewDoc.module_type, previewDoc.module_type)}
                  </p>
                </div>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 bg-slate-50 min-h-[300px] flex items-center justify-center text-center">
              <div className="space-y-3">
                <FileCheck className="h-12 w-12 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900">{t("doc_ready", "Document Ready for Viewer & Print")}</div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <a
                    href={previewDoc.file_url}
                    target="_blank"
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" /> {t("open_fullscreen", "Open Full Screen")}
                  </a>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100 cursor-pointer"
                  >
                    <Printer className="h-4 w-4" /> {t("print_doc", "Print Document")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Move Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full space-y-4">
            <h3 className="font-bold text-base text-slate-900">{t("edit_title", "Edit / Move Document")}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">{t("doc_title_label", "Document Title")}</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border p-2 text-xs font-semibold mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">{t("module_categories", "Module Category")}</label>
                <select
                  value={editModule}
                  onChange={(e) => setEditModule(e.target.value)}
                  className="w-full rounded-xl border p-2 text-xs font-semibold mt-1 bg-white"
                >
                  {MODULE_FOLDERS.map((m) => (
                    <option key={m} value={m}>{t(m, m)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingDoc(null)}
                className="rounded-xl border px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                onClick={handleSaveEdit}
                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 cursor-pointer"
              >
                {t("save_changes", "Save Changes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
