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
  company_id?: string;
  company_code?: string;
  company_name?: string;
  account_id?: string;
  account_code?: string;
  account_name?: string;
  module_type: string;
  category: string;
  person_account_type?: string;
  tags?: string[];
  source_module?: string;
  source_record_id?: string;
  source_record_no?: string;
  document_type?: string;
  document_path?: string;
  storage_key?: string;
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
  main_branch: {
    ur: "مین برانچ",
    ar: "الفرع الرئيسي",
    ps: "اصلي څانګه",
    fa: "شعبه اصلی",
    en: "Main Branch"
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
  select: {
    ur: "منتخب کریں",
    ar: "اختر",
    ps: "وټاکئ",
    fa: "انتخاب کنید",
    en: "Select"
  },
  search: {
    ur: "تلاش کریں",
    ar: "بحث",
    ps: "لټون",
    fa: "جستجو",
    en: "Search"
  },
  no_matches_found: {
    ur: "کوئی مماثلت نہیں ملی",
    ar: "لم يتم العثور على نتائج",
    ps: "هیڅ ورته پایله ونه موندل شوه",
    fa: "هیچ موردی یافت نشد",
    en: "No matches found"
  },
  company: {
    ur: "کمپنی",
    ar: "الشركة",
    ps: "شرکت",
    fa: "شرکت",
    en: "Company"
  },
  account: {
    ur: "اکاؤنٹ",
    ar: "الحساب",
    ps: "حساب",
    fa: "حساب",
    en: "Account"
  },
  person_customer_employee: {
    ur: "شخص / کسٹمر / ملازم",
    ar: "شخص / عميل / موظف",
    ps: "شخص / پیرودونکی / کارکوونکی",
    fa: "شخص / مشتری / کارمند",
    en: "Person / Customer / Employee"
  },
  module: {
    ur: "ماڈیول",
    ar: "الوحدة",
    ps: "ماډیول",
    fa: "ماژول",
    en: "Module"
  },
  document_type: {
    ur: "دستاویز کی قسم",
    ar: "نوع المستند",
    ps: "د سند ډول",
    fa: "نوع سند",
    en: "Document Type"
  },
  document_title: {
    ur: "دستاویز کا عنوان",
    ar: "عنوان المستند",
    ps: "د سند سرلیک",
    fa: "عنوان سند",
    en: "Document Title"
  },
  file_type: {
    ur: "فائل کی قسم",
    ar: "نوع الملف",
    ps: "د فایل ډول",
    fa: "نوع فایل",
    en: "File Type"
  },
  module_category: {
    ur: "ماڈیول کیٹیگری",
    ar: "فئة الوحدة",
    ps: "د ماډیول کټګورۍ",
    fa: "دسته‌بندی ماژول",
    en: "Module Category"
  },
  location: {
    ur: "مقام",
    ar: "الموقع",
    ps: "ځای",
    fa: "مکان",
    en: "Location"
  },
  created_by: {
    ur: "بنانے والا",
    ar: "أنشأه",
    ps: "جوړونکی",
    fa: "ایجاد شده توسط",
    en: "Created By"
  },
  date: {
    ur: "تاریخ",
    ar: "التاريخ",
    ps: "نېټه",
    fa: "تاریخ",
    en: "Date"
  },
  actions: {
    ur: "کاروائیاں",
    ar: "الإجراءات",
    ps: "اقدامونه",
    fa: "اقدامات",
    en: "Actions"
  },
  preview: {
    ur: "پیش نظارہ",
    ar: "معاينة",
    ps: "مخکتنه",
    fa: "پیش‌نمایش",
    en: "Preview"
  },
  download: {
    ur: "ڈاؤن لوڈ",
    ar: "تنزيل",
    ps: "ډاونلوډ",
    fa: "دانلود",
    en: "Download"
  },
  edit: {
    ur: "ترمیم",
    ar: "تعديل",
    ps: "سمول",
    fa: "ویرایش",
    en: "Edit"
  },
  delete: {
    ur: "حذف",
    ar: "حذف",
    ps: "ړنګول",
    fa: "حذف",
    en: "Delete"
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
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>("");
  const [companySearchQuery, setCompanySearchQuery] = useState<string>("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>("");
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>("");
  const [selectedCompanyOption, setSelectedCompanyOption] = useState<SearchSelectOption | null>(null);
  const [companyOptions, setCompanyOptions] = useState<SearchSelectOption[]>([]);
  const [companyLookupLoading, setCompanyLookupLoading] = useState<boolean>(false);
  const companyLookupRef = useRef<Record<string, any>>({});

  const [personSearchQuery, setPersonSearchQuery] = useState<string>("");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [selectedPersonType, setSelectedPersonType] = useState<string>("");
  const [selectedPersonCode, setSelectedPersonCode] = useState<string>("");
  const [selectedPersonName, setSelectedPersonName] = useState<string>("");
  const [selectedPersonOption, setSelectedPersonOption] = useState<SearchSelectOption | null>(null);
  const [personOptions, setPersonOptions] = useState<SearchSelectOption[]>([]);
  const [personLookupLoading, setPersonLookupLoading] = useState<boolean>(false);
  const personLookupRef = useRef<Record<string, any>>({});

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>("");
  const [selectedAccountName, setSelectedAccountName] = useState<string>("");
  const [selectedAccountOption, setSelectedAccountOption] = useState<SearchSelectOption | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState<string>("");
  const [accountOptions, setAccountOptions] = useState<SearchSelectOption[]>([]);
  const [accountLookupLoading, setAccountLookupLoading] = useState<boolean>(false);
  const accountLookupRef = useRef<Record<string, any>>({});
  const [documentTypeOptions, setDocumentTypeOptions] = useState<SearchSelectOption[]>([]);
  const [documentTypeLoading, setDocumentTypeLoading] = useState<boolean>(false);

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

  useEffect(() => {
    let cancelled = false;
    async function loadDocumentTypes() {
      setDocumentTypeLoading(true);
      try {
        const res = await apiGet<any>(`/api/erp/document-types?lang=${encodeURIComponent(lang)}&q=&limit=500`);
        const raw = Array.isArray(res?.documentTypes) ? res.documentTypes : [];
        const nextOptions = raw.map((docType: any) => {
          const label = docType.name || docType.name_en || docType.code;
          return {
            value: docType.code || docType.id,
            label,
            keywords: [docType.code, docType.name, docType.description, docType.name_en, docType.name_ur, docType.name_ar, docType.name_fa, docType.name_ps]
              .filter(Boolean)
              .join(" ")
          };
        });
        if (!cancelled) {
          setDocumentTypeOptions(nextOptions);
          setSelectedDocumentType((current) => current || nextOptions[0]?.value || "");
        }
      } catch (error) {
        if (!cancelled) {
          const nextOptions = DOCUMENT_TYPES.map((type) => ({ value: type, label: type, keywords: type }));
          setDocumentTypeOptions(nextOptions);
          setSelectedDocumentType((current) => current || nextOptions[0]?.value || "");
        }
      } finally {
        if (!cancelled) setDocumentTypeLoading(false);
      }
    }
    loadDocumentTypes();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  // Fetch Documents
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/documents?moduleType=${encodeURIComponent(selectedModule)}`;
      if (selectedCountryId) url += `&countryId=${encodeURIComponent(selectedCountryId)}`;
      if (selectedMainBranchId) url += `&mainBranchId=${encodeURIComponent(selectedMainBranchId)}`;
      if (selectedCityBranchId) url += `&cityBranchId=${encodeURIComponent(selectedCityBranchId)}`;
      if (selectedCompanyId) url += `&companyId=${encodeURIComponent(selectedCompanyId)}`;
      if (selectedCompanyCode) url += `&companyCode=${encodeURIComponent(selectedCompanyCode)}`;
      if (selectedCompanyName) url += `&companyName=${encodeURIComponent(selectedCompanyName)}`;
      if (selectedPersonId) url += `&personAccountId=${encodeURIComponent(selectedPersonId)}`;
      if (selectedPersonCode) url += `&personAccountCode=${encodeURIComponent(selectedPersonCode)}`;
      if (selectedPersonName) url += `&personAccountName=${encodeURIComponent(selectedPersonName)}`;
      if (selectedPersonType) url += `&personAccountType=${encodeURIComponent(selectedPersonType)}`;
      if (selectedAccountId) url += `&accountId=${encodeURIComponent(selectedAccountId)}`;
      if (selectedAccountCode) url += `&accountCode=${encodeURIComponent(selectedAccountCode)}`;
      if (selectedAccountName) url += `&accountName=${encodeURIComponent(selectedAccountName)}`;
      if (selectedDocumentType) url += `&documentType=${encodeURIComponent(selectedDocumentType)}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await apiGet<{ documents: OfficeDocument[] }>(url);
      setDocuments(res?.documents ?? []);
    } catch (e) {
      console.error("Failed to fetch documents:", e);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [
    selectedCountryId,
    selectedMainBranchId,
    selectedCityBranchId,
    selectedCompanyId,
    selectedCompanyCode,
    selectedCompanyName,
    selectedPersonId,
    selectedPersonCode,
    selectedPersonName,
    selectedPersonType,
    selectedAccountId,
    selectedAccountCode,
    selectedAccountName,
    selectedDocumentType,
    selectedModule,
    searchQuery
  ]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    let cancelled = false;
    const query = companySearchQuery.trim();
    if (!query) {
      setCompanyOptions(selectedCompanyOption ? [selectedCompanyOption] : []);
      companyLookupRef.current = selectedCompanyOption ? { [selectedCompanyOption.value]: selectedCompanyOption } : {};
      return;
    }
    const timer = setTimeout(async () => {
      setCompanyLookupLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit: "25", lang });
        if (selectedCountryId) params.set("countryId", selectedCountryId);
        const res = await apiGet<any>(`/api/erp/companies?${params.toString()}`);
        const companies = Array.isArray(res?.companies) ? res.companies : [];
        if (cancelled) return;

        const nextOptions: SearchSelectOption[] = companies.map((company: any) => {
          const companyCode = company.company_code || company.code || company.registration_no || company.registration_number || company.id;
          const companyName = company.name || company.legal_name || company.business_name || companyCode;
          const label = [companyCode, companyName].filter(Boolean).join(" • ");
          return {
            value: company.id,
            label,
            keywords: [
              companyCode,
              companyName,
              company.legal_name,
              company.owner_name,
              company.country_name,
              company.city_name,
              company.business_type
            ]
              .filter(Boolean)
              .join(" ")
          };
        });

        const nextLookup: Record<string, any> = {};
        nextOptions.forEach((opt, index) => {
          nextLookup[opt.value] = companies[index];
        });
        if (selectedCompanyOption && !nextLookup[selectedCompanyOption.value]) {
          nextOptions.unshift(selectedCompanyOption);
          nextLookup[selectedCompanyOption.value] = companyLookupRef.current[selectedCompanyOption.value] ?? selectedCompanyOption;
        }
        companyLookupRef.current = nextLookup;
        setCompanyOptions(nextOptions);
      } catch (error) {
        if (!cancelled) setCompanyOptions(selectedCompanyOption ? [selectedCompanyOption] : []);
      } finally {
        if (!cancelled) setCompanyLookupLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companySearchQuery, selectedCountryId, selectedCompanyOption, lang]);

  useEffect(() => {
    let cancelled = false;
    const query = personSearchQuery.trim();
    if (!query) {
      setPersonOptions(selectedPersonOption ? [selectedPersonOption] : []);
      personLookupRef.current = selectedPersonOption ? { [selectedPersonOption.value]: selectedPersonOption } : {};
      return;
    }
    const timer = setTimeout(async () => {
      setPersonLookupLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit: "25", lang });
        if (selectedCountryId) params.set("countryId", selectedCountryId);
        const res = await apiGet<any>(`/api/erp/parties/directory?${params.toString()}`);
        const parties = Array.isArray(res?.parties) ? res.parties : [];
        if (cancelled) return;

        const nextOptions: SearchSelectOption[] = [];
        const nextLookup: Record<string, any> = {};

        for (const party of parties) {
          const customerCode = party.customerCode || party.customer_code || party.customerId || "CUST";
          const customerName = party.customerName || party.customer_name || "Customer";
          const customerValue = `customer:${party.customerId}`;
          const customerLabel = [`Customer`, customerCode, customerName].filter(Boolean).join(" • ");
          nextOptions.push({
            value: customerValue,
            label: customerLabel,
            keywords: [customerCode, customerName, party.mobile, party.email, party.cityName, party.countryName].filter(Boolean).join(" ")
          });
          nextLookup[customerValue] = { type: "customer", party };

          for (const employee of party.employees || []) {
            const employeeValue = `employee:${employee.id}`;
            const employeeLabel = [`Employee`, employee.employeeCode, employee.fullName].filter(Boolean).join(" • ");
            nextOptions.push({
              value: employeeValue,
              label: employeeLabel,
              keywords: [employee.employeeCode, employee.fullName, employee.department, employee.jobTitle, employee.branchName].filter(Boolean).join(" ")
            });
            nextLookup[employeeValue] = { type: "employee", party, employee };
          }
        }

        if (selectedPersonOption && !nextLookup[selectedPersonOption.value]) {
          nextOptions.unshift(selectedPersonOption);
          nextLookup[selectedPersonOption.value] = personLookupRef.current[selectedPersonOption.value] ?? selectedPersonOption;
        }
        personLookupRef.current = nextLookup;
        setPersonOptions(nextOptions);
      } catch (error) {
        if (!cancelled) setPersonOptions(selectedPersonOption ? [selectedPersonOption] : []);
      } finally {
        if (!cancelled) setPersonLookupLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [personSearchQuery, selectedCountryId, selectedPersonOption, lang]);

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
      const docTypeValue = selectedDocumentType || documentTypeOptions[0]?.value || "Document";
      const destinationFileName = buildDocumentFileName({
        countryName: activeCountry?.name ?? null,
        branchName: activeCityBranch?.name || activeMainBranch?.name || null,
        companyCode: selectedCompanyCode || null,
        companyName: selectedCompanyName || null,
        personAccountCode: selectedAccountCode,
        personAccountName: selectedAccountName,
        personAccountType: selectedPersonType || null,
        accountCode: selectedAccountCode,
        accountName: selectedAccountName,
        moduleType: moduleLabel,
        documentType: docTypeValue,
        sourceRecordNo: selectedPersonCode || selectedAccountCode || searchQuery.trim() || file.name.replace(/\.[^/.]+$/, ""),
        createdAt: new Date(),
        extension: docType === "image" ? extension : docType === "word" ? "docx" : docType === "excel" ? "xlsx" : "pdf"
      });
      const destinationPath = buildDocumentFolderPath({
        countryName: activeCountry?.name,
        branchName: activeCityBranch?.name || activeMainBranch?.name || null,
        companyCode: selectedCompanyCode || null,
        companyName: selectedCompanyName || null,
        personAccountCode: selectedAccountCode,
        personAccountName: selectedAccountName,
        personAccountType: selectedPersonType || null,
        accountCode: selectedAccountCode,
        accountName: selectedAccountName,
        moduleType: moduleLabel,
        documentType: docTypeValue
      });

      const payload = new FormData();
      payload.append("title", file.name.replace(/\.[^/.]+$/, ""));
      payload.append("file_name", destinationFileName);
      payload.append("file_type", docType);
      payload.append("file_size", String(file.size));
      payload.append("country_id", selectedCountryId || "");
      payload.append("country_name", activeCountry?.name ?? "");
      payload.append("country_branch_id", selectedMainBranchId || "");
      payload.append("main_branch_name", activeMainBranch?.name ?? "");
      payload.append("city_branch_id", selectedCityBranchId || "");
      payload.append("city_branch_name", activeCityBranch?.name ?? "");
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
      payload.append("module_type", selectedModule === "all" ? "Purchase Documents" : selectedModule);
      payload.append("document_type", docTypeValue);
      payload.append("source_module", moduleLabel);
      payload.append("source_record_id", selectedPersonId || selectedCompanyId || selectedAccountId || "");
      payload.append("source_record_no", selectedPersonCode || selectedAccountCode || searchQuery.trim() || file.name.replace(/\.[^/.]+$/, ""));
      payload.append("category", "Uploaded");
      payload.append("tags", JSON.stringify([extension.toUpperCase(), "Uploaded", docTypeValue]));
      payload.append("metadata", JSON.stringify({
        destinationPath,
        destinationFileName,
        uploadedFrom: "DocumentsPage"
      }));
      payload.append("document_path", destinationPath);
      payload.append("storage_key", `${destinationPath}/${destinationFileName}`);
      payload.append("created_by", selectedCompanyName || selectedPersonName || selectedAccountName || "User");
      payload.append("scanner_device_name", "");
      payload.append("scanner_bridge", "");
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
        const docTypeValue = selectedDocumentType || documentTypeOptions[0]?.value || "Document";
        const destinationFileName = buildDocumentFileName({
          countryName: activeCountry?.name ?? null,
          branchName: activeCityBranch?.name || activeMainBranch?.name || null,
          companyCode: selectedCompanyCode || null,
          companyName: selectedCompanyName || null,
          personAccountCode: selectedAccountCode,
          personAccountName: selectedAccountName,
          personAccountType: selectedPersonType || null,
          accountCode: selectedAccountCode,
          accountName: selectedAccountName,
          moduleType: moduleLabel,
          documentType: docTypeValue,
          sourceRecordNo: selectedPersonCode || selectedAccountCode || searchQuery.trim() || null,
          createdAt: new Date(),
          extension: "pdf"
        });
        const destinationPath = buildDocumentFolderPath({
          countryName: activeCountry?.name,
          branchName: activeCityBranch?.name || activeMainBranch?.name || null,
          companyCode: selectedCompanyCode || null,
          companyName: selectedCompanyName || null,
          personAccountCode: selectedAccountCode,
          personAccountName: selectedAccountName,
          personAccountType: selectedPersonType || null,
          accountCode: selectedAccountCode,
          accountName: selectedAccountName,
          moduleType: moduleLabel,
          documentType: docTypeValue
        });

        const scanFile = new File(
          [new Blob([`%PDF-1.4\n% Scan simulation generated for ${destinationFileName}\n`], { type: "application/pdf" })],
          destinationFileName,
          { type: "application/pdf" }
        );
        const scanPayload = new FormData();
        scanPayload.append("title", `Scanned Document #${Math.floor(1000 + Math.random() * 9000)}`);
        scanPayload.append("file_name", destinationFileName);
        scanPayload.append("file_type", "pdf");
        scanPayload.append("file_size", "340000");
        scanPayload.append("country_id", selectedCountryId || "");
        scanPayload.append("country_name", activeCountry?.name ?? "");
        scanPayload.append("country_branch_id", selectedMainBranchId || "");
        scanPayload.append("main_branch_name", activeMainBranch?.name ?? "");
        scanPayload.append("city_branch_id", selectedCityBranchId || "");
        scanPayload.append("city_branch_name", activeCityBranch?.name ?? "");
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
        scanPayload.append("module_type", selectedModule === "all" ? "Purchase Documents" : selectedModule);
        scanPayload.append("document_type", docTypeValue);
        scanPayload.append("source_module", moduleLabel);
        scanPayload.append("source_record_id", selectedPersonId || selectedCompanyId || selectedAccountId || "");
        scanPayload.append("source_record_no", selectedPersonCode || selectedAccountCode || searchQuery.trim() || "");
        scanPayload.append("category", "Scanned");
        scanPayload.append("tags", JSON.stringify(["Scanned", "PDF", "TWAIN", docTypeValue]));
        scanPayload.append("metadata", JSON.stringify({
          destinationPath,
          destinationFileName,
          scannerBridge: "TWAIN/W3C API"
        }));
        scanPayload.append("document_path", destinationPath);
        scanPayload.append("storage_key", `${destinationPath}/${destinationFileName}`);
        scanPayload.append("created_by", selectedCompanyName || selectedPersonName || selectedAccountName || "Scanner Hardware API");
        scanPayload.append("scanner_device_name", "Default Scanner");
        scanPayload.append("scanner_bridge", "TWAIN/W3C API");
        scanPayload.append("file", scanFile, scanFile.name);

        await fetch("/api/documents", {
          method: "POST",
          body: scanPayload
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
  const resolvedDocumentTypeLabel =
    documentTypeOptions.find((option) => option.value === selectedDocumentType)?.label ||
    selectedDocumentType ||
    "Document";
  const documentDestinationPreview = buildDocumentDestinationLabel({
    countryName: activeCountry?.name,
    branchName: activeCityBranch?.name || activeMainBranch?.name || null,
    companyCode: selectedCompanyCode,
    companyName: selectedCompanyName,
    personAccountCode: selectedPersonCode || selectedAccountCode,
    personAccountName: selectedPersonName || selectedAccountName,
    personAccountType: selectedPersonType,
    accountCode: selectedAccountCode,
    accountName: selectedAccountName,
    moduleType: selectedModuleLabel,
    documentType: resolvedDocumentTypeLabel
  });
  const documentFileNamePreview = buildDocumentFileName({
    countryName: activeCountry?.name,
    branchName: activeCityBranch?.name || activeMainBranch?.name || null,
    companyCode: selectedCompanyCode,
    companyName: selectedCompanyName,
    personAccountCode: selectedPersonCode || selectedAccountCode,
    personAccountName: selectedPersonName || selectedAccountName,
    personAccountType: selectedPersonType,
    accountCode: selectedAccountCode,
    accountName: selectedAccountName,
    moduleType: selectedModuleLabel,
    documentType: resolvedDocumentTypeLabel,
    sourceRecordNo: selectedPersonCode || selectedAccountCode || searchQuery.trim() || null,
    createdAt: new Date(),
    extension: "pdf"
  });

  const handleCompanySelect = (value: string) => {
    const found = companyLookupRef.current[value];
    const nextCode = found?.company_code || found?.code || found?.registration_no || found?.registration_number || found?.id || "";
    const nextName = found?.name || found?.legal_name || found?.business_name || "";
    setSelectedCompanyId(value);
    setSelectedCompanyCode(nextCode);
    setSelectedCompanyName(nextName);
    const nextOption = companyOptions.find((opt) => opt.value === value) ?? (found ? {
      value,
      label: [nextCode, nextName].filter(Boolean).join(" • "),
      keywords: [nextCode, nextName, found?.legal_name, found?.owner_name, found?.country_name, found?.city_name].filter(Boolean).join(" ")
    } : null);
    setSelectedCompanyOption(nextOption);
    if (nextOption) {
      setCompanyOptions((prev) => [nextOption, ...prev.filter((opt) => opt.value !== nextOption.value)]);
    }
  };

  const handlePersonSelect = (value: string) => {
    const found = personLookupRef.current[value];
    if (!found) return;

    if (found.type === "employee") {
      const employee = found.employee;
      const nextCode = employee.employeeCode || employee.employee_code || employee.id || "";
      const nextName = employee.fullName || employee.customer_name || "";
      setSelectedPersonId(employee.id);
      setSelectedPersonType("employee");
      setSelectedPersonCode(nextCode);
      setSelectedPersonName(nextName);
    } else {
      const party = found.party;
      const nextCode = party.customerCode || party.customer_code || party.customerId || "";
      const nextName = party.customerName || party.customer_name || "";
      setSelectedPersonId(party.customerId || party.customer_id || value.replace(/^customer:/, ""));
      setSelectedPersonType("customer");
      setSelectedPersonCode(nextCode);
      setSelectedPersonName(nextName);
    }

    const nextOption = personOptions.find((opt) => opt.value === value) ?? (found ? {
      value,
      label: found.type === "employee"
        ? [`Employee`, found.employee.employeeCode, found.employee.fullName].filter(Boolean).join(" • ")
        : [`Customer`, found.party.customerCode || found.party.customer_code || found.party.customerId, found.party.customerName || found.party.customer_name].filter(Boolean).join(" • "),
      keywords: found.type === "employee"
        ? [found.employee.employeeCode, found.employee.fullName, found.employee.department, found.employee.jobTitle, found.employee.branchName].filter(Boolean).join(" ")
        : [found.party.customerCode, found.party.customerName, found.party.mobile, found.party.email, found.party.cityName, found.party.countryName].filter(Boolean).join(" ")
    } : null);

    setSelectedPersonOption(nextOption);
    if (nextOption) {
      setPersonOptions((prev) => [nextOption, ...prev.filter((opt) => opt.value !== nextOption.value)]);
    }
  };

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

          <div className="grid gap-3 xl:grid-cols-4">
            <SearchSelect
              label={t("countries", "Countries")}
              value={selectedCountryId}
              placeholder={t("select", "Select")}
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
              searchPlaceholder={t("search", "Search")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("main_branches", "Main Branches")}
              value={selectedMainBranchId}
              placeholder={t("select", "Select")}
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
              searchPlaceholder={t("search", "Search")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("city_branches", "City Branches")}
              value={selectedCityBranchId}
              placeholder={t("select", "Select")}
              options={(activeMainBranch?.cityBranches || []).map((branch: any) => ({
                value: branch.id,
                label: branch.name,
                keywords: [branch.name, branch.code, branch.branch_code, branch.owner_name].filter(Boolean).join(" ")
              }))}
              disabled={!activeMainBranch}
              onValueChange={setSelectedCityBranchId}
              searchPlaceholder={t("search", "Search")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("person_customer_employee", "Person / Customer / Employee")}
              value={selectedPersonId ? (selectedPersonType ? `${selectedPersonType}:${selectedPersonId}` : selectedPersonId) : ""}
              placeholder={t("search", "Search")}
              options={personOptions}
              loading={personLookupLoading}
              onValueChange={handlePersonSelect}
              onSearchValueChange={setPersonSearchQuery}
              searchPlaceholder={t("search", "Search")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("company", "Company")}
              value={selectedCompanyId}
              placeholder={t("search", "Search")}
              options={companyOptions}
              loading={companyLookupLoading}
              onValueChange={handleCompanySelect}
              onSearchValueChange={setCompanySearchQuery}
              searchPlaceholder={t("search", "Search")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("account", "Account")}
              value={selectedAccountId}
              placeholder={t("search", "Search")}
              options={accountOptions}
              loading={accountLookupLoading}
              onValueChange={handleAccountSelect}
              onSearchValueChange={setAccountSearchQuery}
              searchPlaceholder={t("search", "Search")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("module", "Module")}
              value={selectedModule}
              placeholder={t("select", "Select")}
              options={[
                { value: "all", label: t("all_module_folders", "All Module Folders") },
                ...MODULE_FOLDERS.map((mod) => ({ value: mod, label: t(mod, mod), keywords: mod }))
              ]}
              onValueChange={setSelectedModule}
              searchPlaceholder={t("search", "Search")}
              emptyLabel={t("no_matches_found", "No matches found")}
            />

            <SearchSelect
              label={t("document_type", "Document Type")}
              value={selectedDocumentType}
              placeholder={t("select", "Select")}
              options={documentTypeOptions}
              loading={documentTypeLoading}
              onValueChange={setSelectedDocumentType}
              searchPlaceholder={t("search", "Search")}
              emptyLabel={t("no_matches_found", "No matches found")}
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
            <div className="text-[10px] font-black uppercase text-slate-400">{t("document_title", "Document Title")}</div>
            <div className="mt-1 text-xs font-semibold text-slate-700">{documentFileNamePreview}</div>
            <div className="mt-2 space-y-1 text-[10px] text-slate-500">
              <div>{selectedCompanyName ? `${selectedCompanyCode ? `${selectedCompanyCode} · ` : ""}${selectedCompanyName}` : t("company", "Company")}</div>
              <div>{selectedPersonName ? `${selectedPersonCode ? `${selectedPersonCode} · ` : ""}${selectedPersonName}` : t("person_customer_employee", "Person / Customer / Employee")}</div>
              <div>{selectedAccountName ? `${selectedAccountCode ? `${selectedAccountCode} · ` : ""}${selectedAccountName}` : t("account", "Account")}</div>
              <div className="text-[9px] text-slate-400">{resolvedDocumentTypeLabel}</div>
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
            <span>{selectedMainBranchId ? t("main_branch", "Main Branch") : t("all_branches", "All Branches")}</span>
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
                <table className="w-full min-w-[1200px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider text-center">
                      <Th className="p-3 text-left">{t("document_title", "Document Title")}</Th>
                      <Th className="p-3">{t("company", "Company")} / {t("person_customer_employee", "Person / Customer / Employee")} / {t("account", "Account")}</Th>
                      <Th className="p-3">{t("module", "Module")}</Th>
                      <Th className="p-3">{t("document_type", "Document Type")}</Th>
                      <Th className="p-3">{t("location", "Location")}</Th>
                      <Th className="p-3">{t("file_type", "File Type")}</Th>
                      <Th className="p-3">{t("created_by", "Created By")}</Th>
                      <Th className="p-3">{t("date", "Date")}</Th>
                      <Th className="p-3">{t("actions", "Actions")}</Th>
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
                              {doc.document_path ? <div className="text-[9px] text-slate-400 font-mono" dir="ltr">{doc.document_path}</div> : null}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 uppercase font-extrabold text-[10px]">
                          <div className="space-y-1">
                            <div className="rounded bg-slate-100 px-2 py-0.5 border text-slate-700">
                              {doc.company_code || doc.company_name ? `${doc.company_code ? `${doc.company_code} · ` : ""}${doc.company_name ?? ""}` : "—"}
                            </div>
                            <div className="rounded bg-slate-50 px-2 py-0.5 border text-slate-600">
                              {doc.person_account_type || "—"}
                              {doc.person_account_name ? ` · ${doc.person_account_name}` : ""}
                            </div>
                            <div className="rounded bg-slate-100 px-2 py-0.5 border text-slate-700">
                              {doc.account_code || doc.account_name ? `${doc.account_code ? `${doc.account_code} · ` : ""}${doc.account_name ?? ""}` : "—"}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-indigo-700">{t(doc.source_module || doc.module_type, doc.source_module || doc.module_type)}</td>
                        <td className="p-3 font-semibold text-emerald-700">{t(doc.document_type || doc.module_type, doc.document_type || doc.module_type)}</td>
                        <td className="p-3 text-[10px]">
                          <div>{t(doc.country_name || "Pakistan", doc.country_name || "Pakistan")}</div>
                          <div className="text-slate-400 font-mono">{t(doc.main_branch_name || "Main Branch", doc.main_branch_name || "Main Branch")}</div>
                          {doc.city_branch_name ? <div className="text-slate-400 font-mono">{t(doc.city_branch_name, doc.city_branch_name)}</div> : null}
                        </td>
                        <td className="p-3 uppercase font-extrabold text-[10px]">
                          <span className="rounded bg-slate-100 px-2 py-0.5 border text-slate-700">{doc.file_type}</span>
                        </td>
                        <td className="p-3 font-semibold">{doc.created_by || t("super_admin", "Super Admin")}</td>
                        <td className="p-3 text-[10px] font-mono text-slate-500" dir="ltr">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              className="rounded border border-indigo-200 bg-white p-1 text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                              title={t("preview", "Preview")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={doc.file_url}
                              download
                              className="rounded border border-emerald-200 bg-white p-1 text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                              title={t("download", "Download")}
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
                              title={t("edit", "Edit")}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="rounded border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title={t("delete", "Delete")}
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
                <label className="text-[10px] font-black uppercase text-slate-400">{t("document_title", "Document Title")}</label>
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
