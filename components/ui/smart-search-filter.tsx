"use client";

/**
 * Smart Search & Filter / Cascading Dropdown Component
 *
 * Standardized across the entire ERP system in a clean white/light theme.
 * Features:
 * 1. Clean white/light ERP theme (with subtle slate borders and vibrant blue accents)
 * 2. Instant global search bar with quick reset & primary filter buttons
 * 3. Smart cascading dropdown flow (Country → Branch → Main / City Branch)
 * 4. Rich filter pills (Risk Level, Status, Dates, Module, User, Currency, Custom)
 * 5. Full 5-language translation (English, Urdu, Arabic, Persian, Pashto) with RTL layout
 * 6. Responsive across Desktop (1400px+), Tablet (768px-1024px), and Mobile (375px-767px)
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search,
  RotateCcw,
  Filter,
  Globe,
  Building,
  GitFork,
  Shield,
  BadgeCheck,
  Calendar,
  Boxes,
  User,
  Coins,
  ChevronDown,
  Check,
  X,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";

// ─── 5-Language Dictionary ───────────────────────────────────────────────────

type Lang = SupportedLanguage;

const filterDict: Record<string, Record<Lang, string>> = {
  headerTitle: {
    en: "Smart Search & Filter",
    ur: "سمارٹ سرچ اور فلٹر",
    ar: "البحث والتصفية الذكية",
    fa: "جستجو و فیلتر هوشمند",
    ps: "هوښیار لټون او فلټر"
  },
  badgeCompact: {
    en: "Compact • Responsive",
    ur: "کومپیکٹ • رسپانسو",
    ar: "مدمج • متجاوب",
    fa: "فشرده • پاسخگو",
    ps: "کمپیکٹ • ځواب ویونکی"
  },
  headerSubtitle: {
    en: "Find, Filter and Analyze Faster",
    ur: "تیزی سے تلاش کریں، فلٹر کریں اور تجزیہ کریں",
    ar: "ابحث وصفِّ وحلل بسرعة أكبر",
    fa: "سریع‌تر جستجو، فیلتر و تحلیل کنید",
    ps: "ګړندی لټون، فلټر او تحلیل کړئ"
  },
  searchPlaceholder: {
    en: "Search bill, reference or keywords...",
    ur: "بل، حوالہ یا مطلوبہ الفاظ تلاش کریں...",
    ar: "ابحث برقم الفاتورة أو المرجع أو الكلمات...",
    fa: "جستجوی صورتحساب، مرجع یا کلمات کلیدی...",
    ps: "بل، حواله یا کلیدي کلمې وپلټئ..."
  },
  btnReset: {
    en: "Reset",
    ur: "ری سیٹ",
    ar: "إعادة ضبط",
    fa: "بازنشانی",
    ps: "بیا تنظیمول"
  },
  btnFilter: {
    en: "Filter",
    ur: "فلٹر",
    ar: "تصفية",
    fa: "فیلتر",
    ps: "فلټر"
  },
  btnApplyFilter: {
    en: "Apply Filter",
    ur: "فلٹر لاگو کریں",
    ar: "تطبيق التصفية",
    fa: "اعمال فیلتر",
    ps: "فلټر تطبیق کړئ"
  },
  lblRiskLevel: {
    en: "Risk Level",
    ur: "رسک لیول",
    ar: "مستوى المخاطر",
    fa: "سطح ریسک",
    ps: "د خطر کچه"
  },
  allRiskLevels: {
    en: "All Risk Levels",
    ur: "تمام رسک لیولز",
    ar: "جميع مستويات المخاطر",
    fa: "همه سطوح ریسک",
    ps: "د خطر ټولې کچې"
  },
  lblCountry: {
    en: "Country",
    ur: "ملک",
    ar: "الدولة",
    fa: "کشور",
    ps: "هیواد"
  },
  allCountries: {
    en: "All Countries",
    ur: "تمام ممالک",
    ar: "جميع الدول",
    fa: "همه کشورها",
    ps: "ټول هیوادونه"
  },
  lblBranch: {
    en: "Branch",
    ur: "برانچ",
    ar: "الفرع",
    fa: "شعبه",
    ps: "څانګه"
  },
  allBranches: {
    en: "All Branches",
    ur: "تمام برانچز",
    ar: "جميع الفروع",
    fa: "همه شعب",
    ps: "ټولې څانګې"
  },
  lblMainBranch: {
    en: "Main / City Branch",
    ur: "مین / سٹی برانچ",
    ar: "الفرع الرئيسي / فرع المدينة",
    fa: "شعبه اصلی / شهری",
    ps: "اصلي / ښاري څانګه"
  },
  allMainBranches: {
    en: "All Main Branches",
    ur: "تمام مین برانچز",
    ar: "جميع الفروع الرئيسية",
    fa: "همه شعب اصلی",
    ps: "ټولې اصلي څانګې"
  },
  lblApprovalStatus: {
    en: "Approval Status",
    ur: "منظوری کی حیثیت",
    ar: "حالة الاعتماد",
    fa: "وضعیت تایید",
    ps: "د تصویب حالت"
  },
  allStatuses: {
    en: "All Statuses",
    ur: "تمام حیثیتیں",
    ar: "جميع الحالات",
    fa: "همه وضعیت‌ها",
    ps: "ټول حالتونه"
  },
  lblFromDate: {
    en: "From Date",
    ur: "تاریخ سے",
    ar: "من تاريخ",
    fa: "از تاریخ",
    ps: "له نیټې"
  },
  lblToDate: {
    en: "To Date",
    ur: "تاریخ تک",
    ar: "إلى تاريخ",
    fa: "تا تاریخ",
    ps: "تر نیټې"
  },
  lblModule: {
    en: "Module",
    ur: "ماڈیول",
    ar: "الوحدة",
    fa: "ماژول",
    ps: "ماډیول"
  },
  allModules: {
    en: "All Modules",
    ur: "تمام ماڈیولز",
    ar: "جميع الوحدات",
    fa: "همه ماژول‌ها",
    ps: "ټول ماډیولونه"
  },
  lblEditedBy: {
    en: "Edited By",
    ur: "ترمیم کنندہ",
    ar: "تم التعديل بواسطة",
    fa: "ویرایش توسط",
    ps: "سمول لخوا"
  },
  allUsers: {
    en: "All Users",
    ur: "تمام صارفین",
    ar: "جميع المستخدمين",
    fa: "همه کاربران",
    ps: "ټول کارونکي"
  },
  lblCurrency: {
    en: "Currency",
    ur: "کرنسی",
    ar: "العملة",
    fa: "ارز",
    ps: "اسعار"
  },
  allCurrencies: {
    en: "All Currencies",
    ur: "تمام کرنسیاں",
    ar: "جميع العملات",
    fa: "همه ارزها",
    ps: "ټول اسعار"
  },
  searchInsideDropdown: {
    en: "Search...",
    ur: "تلاش کریں...",
    ar: "بحث...",
    fa: "جستجو...",
    ps: "لټون..."
  },
  noResultsFound: {
    en: "No options found",
    ur: "کوئی آپشن نہیں ملا",
    ar: "لا توجد خيارات",
    fa: "گزینه‌ای یافت نشد",
    ps: "هیڅ انتخاب ونه موندل شو"
  },
  cascadingFlowHint: {
    en: "Cascading Dropdown Flow: Country → Branch → Main Branch",
    ur: "آبشاری فلو: ملک → برانچ → مین برانچ",
    ar: "تدفق متتالي: الدولة ← الفرع ← الفرع الرئيسي",
    fa: "جریان آبشاری: کشور ← شعبه ← شعبه اصلی",
    ps: "ځړیدونکی بهیر: هیواد ← څانګه ← اصلي څانګه"
  },
  activeFiltersCount: {
    en: "Active Filters",
    ur: "فعال فلٹرز",
    ar: "عوامل التصفية النشطة",
    fa: "فیلترهای فعال",
    ps: "فعال فلټرونه"
  },
  closeMobileFilters: {
    en: "Close",
    ur: "بند کریں",
    ar: "إغلاق",
    fa: "بستن",
    ps: "بندول"
  }
};

function tx(key: string, lang: Lang): string {
  return filterDict[key]?.[lang] ?? filterDict[key]?.["en"] ?? key;
}

// ─── Filter Option Types ──────────────────────────────────────────────────────

export type FilterOption = {
  value: string;
  label: string;
  labelTranslations?: Partial<Record<Lang, string>>;
  icon?: string | React.ReactNode;
  countryId?: string;
  branchId?: string;
};

export type SmartFilterState = {
  query?: string;
  riskLevel?: string;
  country?: string;
  branch?: string;
  mainBranch?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  module?: string;
  editedBy?: string;
  currency?: string;
  custom?: Record<string, string>;
};

export type CustomFilterConfig = {
  key: string;
  label: string;
  labelTranslations?: Partial<Record<Lang, string>>;
  icon?: React.ReactNode;
  options: FilterOption[];
  defaultValue?: string;
};

export type SmartSearchFilterProps = {
  value: SmartFilterState;
  onChange: (next: SmartFilterState) => void;
  onApply?: (filters: SmartFilterState) => void;
  onReset?: () => void;
  placeholder?: string;
  hideHeader?: boolean;
  hideSearch?: boolean;
  hideCascadingLocations?: boolean;
  hideRiskLevel?: boolean;
  hideStatus?: boolean;
  hideDateRange?: boolean;
  hideModule?: boolean;
  hideUser?: boolean;
  hideCurrency?: boolean;
  customFilters?: CustomFilterConfig[];
  countryOptions?: FilterOption[];
  branchOptions?: FilterOption[];
  mainBranchOptions?: FilterOption[];
  statusOptions?: FilterOption[];
  riskOptions?: FilterOption[];
  moduleOptions?: FilterOption[];
  userOptions?: FilterOption[];
  currencyOptions?: FilterOption[];
  className?: string;
};

// ─── Default Master Options with 5-Language Translations ───────────────────────

const DEFAULT_COUNTRIES: FilterOption[] = [
  { value: "all", label: "All Countries", labelTranslations: { ur: "تمام ممالک", ar: "جميع الدول", fa: "همه کشورها", ps: "ټول هیوادونه" } },
  { value: "pakistan", label: "Pakistan", labelTranslations: { ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" }, icon: "🇵🇰" },
  { value: "uae", label: "United Arab Emirates", labelTranslations: { ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" }, icon: "🇦🇪" },
  { value: "afghanistan", label: "Afghanistan", labelTranslations: { ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" }, icon: "🇦🇫" },
  { value: "india", label: "India", labelTranslations: { ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" }, icon: "🇮🇳" },
  { value: "saudi_arabia", label: "Saudi Arabia", labelTranslations: { ur: "سعودی عرب", ar: "المملكة العربية السعودية", fa: "عربستان سعودی", ps: "سعودي عربستان" }, icon: "🇸🇦" },
  { value: "china", label: "China", labelTranslations: { ur: "چین", ar: "الصين", fa: "چین", ps: "چین" }, icon: "🇨🇳" }
];

const DEFAULT_BRANCHES: FilterOption[] = [
  { value: "all", label: "All Branches", labelTranslations: { ur: "تمام برانچز", ar: "جميع الفروع", fa: "همه شعب", ps: "ټولې څانګې" } },
  // Pakistan Branches
  { value: "pk_karachi", label: "Karachi Region", labelTranslations: { ur: "کراچی ریجن", ar: "منطقة كراتشي", fa: "منطقه کراچی", ps: "د کراچۍ سیمه" }, countryId: "pakistan" },
  { value: "pk_lahore", label: "Lahore Region", labelTranslations: { ur: "لاہور ریجن", ar: "منطقة لاهور", fa: "منطقه لاهور", ps: "د لاهور سیمه" }, countryId: "pakistan" },
  { value: "pk_islamabad", label: "Islamabad Region", labelTranslations: { ur: "اسلام آباد ریجن", ar: "منطقة إسلام آباد", fa: "منطقه اسلام‌آباد", ps: "د اسلام آباد سیمه" }, countryId: "pakistan" },
  { value: "pk_peshawar", label: "Peshawar Region", labelTranslations: { ur: "پشاور ریجن", ar: "منطقة بيشاور", fa: "منطقه پیشاور", ps: "د پیښور سیمه" }, countryId: "pakistan" },
  { value: "pk_quetta", label: "Quetta Region", labelTranslations: { ur: "کوئٹہ ریجن", ar: "منطقة كويتا", fa: "منطقه کویته", ps: "د کوټې سیمه" }, countryId: "pakistan" },
  { value: "pk_chaman", label: "Chaman Border Branch", labelTranslations: { ur: "چمن بارڈر برانچ", ar: "فرع معبر جمن", fa: "شعبه مرزی چمن", ps: "د چمن پولې څانګه" }, countryId: "pakistan" },
  { value: "pk_torkham", label: "Torkham Border Branch", labelTranslations: { ur: "طورخم بارڈر برانچ", ar: "فرع معبر تورخم", fa: "شعبه مرزی تورخم", ps: "د تورخم پولې څانګه" }, countryId: "pakistan" },
  // UAE Branches
  { value: "ae_dubai", label: "Dubai Head Office", labelTranslations: { ur: "دبئی ہیڈ آفس", ar: "المكتب الرئيسي بدبي", fa: "دفتر مرکزی دبی", ps: "په دوبۍ کې مرکزي دفتر" }, countryId: "uae" },
  { value: "ae_jafza", label: "JAFZA Free Zone", labelTranslations: { ur: "جبل علی فری زون", ar: "منطقة جافزا الحرة", fa: "منطقه آزاد جافزا", ps: "د جافزا ازاده سیمه" }, countryId: "uae" },
  { value: "ae_sharjah", label: "Sharjah Branch", labelTranslations: { ur: "شارجہ برانچ", ar: "فرع الشارقة", fa: "شعبه شارجه", ps: "د شارجه څانګه" }, countryId: "uae" },
  // Afghanistan Branches
  { value: "af_kabul", label: "Kabul Main Branch", labelTranslations: { ur: "کابل مین برانچ", ar: "فرع كابل الرئيسي", fa: "شعبه اصلی کابل", ps: "د کابل اصلي څانګه" }, countryId: "afghanistan" },
  { value: "af_kandahar", label: "Kandahar Branch", labelTranslations: { ur: "قندھار برانچ", ar: "فرع قندهار", fa: "شعبه قندهار", ps: "د کندهار څانګه" }, countryId: "afghanistan" }
];

const DEFAULT_MAIN_BRANCHES: FilterOption[] = [
  { value: "all", label: "All Main Branches", labelTranslations: { ur: "تمام مین برانچز", ar: "جميع الفروع الرئيسية", fa: "همه شعب اصلی", ps: "ټولې اصلي څانګې" } },
  // Karachi sub-branches
  { value: "khi_main", label: "Karachi Main Branch", labelTranslations: { ur: "کراچی مین برانچ", ar: "فرع كراتشي الرئيسي", fa: "شعبه اصلی کراچی", ps: "د کراچۍ اصلي څانګه" }, branchId: "pk_karachi" },
  { value: "khi_north", label: "Karachi North Branch", labelTranslations: { ur: "کراچی نارتھ برانچ", ar: "فرع شمال كراتشي", fa: "شعبه شمال کراچی", ps: "د کراچۍ شمالي څانګه" }, branchId: "pk_karachi" },
  { value: "khi_south", label: "Karachi South Branch", labelTranslations: { ur: "کراچی ساؤتھ برانچ", ar: "فرع جنوب كراتشي", fa: "شعبه جنوب کراچی", ps: "د کراچۍ سویلي څانګه" }, branchId: "pk_karachi" },
  { value: "khi_east", label: "Karachi East Branch", labelTranslations: { ur: "کراچی ایسٹ برانچ", ar: "فرع شرق كراتشي", fa: "شعبه شرق کراچی", ps: "د کراچۍ ختیځه څانګه" }, branchId: "pk_karachi" },
  { value: "khi_west", label: "Karachi West Branch", labelTranslations: { ur: "کراچی ویسٹ برانچ", ar: "فرع غرب كراتشي", fa: "شعبه غرب کراچی", ps: "د کراچۍ لویدیځه څانګه" }, branchId: "pk_karachi" },
  { value: "khi_port", label: "Port Qasim Operations", labelTranslations: { ur: "پورٹ قاسم آپریشنز", ar: "عمليات ميناء قاسم", fa: "عملیات بندر قاسم", ps: "د پورټ قاسم عملیات" }, branchId: "pk_karachi" },
  // Dubai sub-offices
  { value: "dxb_hq", label: "Deira Operations Hub", labelTranslations: { ur: "دیرہ آپریشنز ہب", ar: "مركز عمليات ديرة", fa: "مرکز عملیات دیره", ps: "د دیرې عملیاتي مرکز" }, branchId: "ae_dubai" },
  { value: "dxb_business_bay", label: "Business Bay Corporate", labelTranslations: { ur: "بزنس بے کارپوریٹ", ar: "مكتب الخليج التجاري", fa: "دفتر بیزنس بی", ps: "د سوداګرۍ خلیج دفتر" }, branchId: "ae_dubai" }
];

const DEFAULT_RISK_LEVELS: FilterOption[] = [
  { value: "all", label: "All Risk Levels", labelTranslations: { ur: "تمام رسک لیولز", ar: "جميع مستويات المخاطر", fa: "همه سطوح ریسک", ps: "د خطر ټولې کچې" } },
  { value: "low", label: "Low Risk", labelTranslations: { ur: "کم خطرہ (Low)", ar: "مخاطر منخفضة", fa: "ریسک کم", ps: "ټیټ خطر" } },
  { value: "medium", label: "Medium Risk", labelTranslations: { ur: "درمیانہ خطرہ (Medium)", ar: "مخاطر متوسطة", fa: "ریسک متوسط", ps: "منځنی خطر" } },
  { value: "high", label: "High Risk", labelTranslations: { ur: "زیادہ خطرہ (High)", ar: "مخاطر عالية", fa: "ریسک بالا", ps: "لوړ خطر" } },
  { value: "critical", label: "Critical", labelTranslations: { ur: "انتہائی نازک (Critical)", ar: "حرج للغاية", fa: "بحرانی", ps: "خورا بحراني" } }
];

const DEFAULT_STATUSES: FilterOption[] = [
  { value: "all", label: "All Statuses", labelTranslations: { ur: "تمام حیثیتیں", ar: "جميع الحالات", fa: "همه وضعیت‌ها", ps: "ټول حالتونه" } },
  { value: "approved", label: "Approved", labelTranslations: { ur: "منظور شدہ", ar: "معتمد", fa: "تایید شده", ps: "تصویب شوی" } },
  { value: "pending", label: "Pending", labelTranslations: { ur: "زیر التواء", ar: "معلق", fa: "در انتظار", ps: "پاتې" } },
  { value: "rejected", label: "Rejected", labelTranslations: { ur: "مسترد شدہ", ar: "مرفوض", fa: "رد شده", ps: "رد شوی" } },
  { value: "draft", label: "Draft", labelTranslations: { ur: "ڈرافٹ", ar: "مسودة", fa: "پیش‌نویس", ps: "مسوده" } }
];

const DEFAULT_MODULES: FilterOption[] = [
  { value: "all", label: "All Modules", labelTranslations: { ur: "تمام ماڈیولز", ar: "جميع الوحدات", fa: "همه ماژول‌ها", ps: "ټول ماډیولونه" } },
  { value: "clearing_agent", label: "Clearing Agent", labelTranslations: { ur: "کلیرنگ ایجنٹ", ar: "وكيل التخليص الجمركي", fa: "ترخیص‌کار گمرکی", ps: "د ګمرکي تصفیې ایجنټ" } },
  { value: "shipping_line", label: "Shipping Line", labelTranslations: { ur: "شپنگ لائن", ar: "خط الشحن البحري", fa: "خط کشتیرانی", ps: "د بار وړلو کښتۍ لاین" } },
  { value: "accounts", label: "General Accounts", labelTranslations: { ur: "جنرل اکاؤنٹس", ar: "الحسابات العامة", fa: "حسابداری عمومی", ps: "عمومي حسابونه" } },
  { value: "general_office", label: "General Office", labelTranslations: { ur: "جنرل آفس مینجمنٹ", ar: "إدارة المكتب العام", fa: "مدیریت دفتر عمومی", ps: "د عمومي دفتر مدیریت" } },
  { value: "settlement", label: "Settlement & Reconciliation", labelTranslations: { ur: "سیٹلمنٹ و ریکنسلیشن", ar: "التسوية والمطابقة", fa: "تسویه و تطبیق", ps: "تصفیه او مطابقت" } },
  { value: "tax_einvoicing", label: "Tax & E-Invoicing", labelTranslations: { ur: "ٹیکس اور ای انوائسنگ", ar: "الضرائب والفوترة الإلكترونية", fa: "مالیات و فاکتور الکترونیکی", ps: "مالیه او بریښنایی بلونه" } }
];

const DEFAULT_USERS: FilterOption[] = [
  { value: "all", label: "All Users", labelTranslations: { ur: "تمام صارفین", ar: "جميع المستخدمين", fa: "همه کاربران", ps: "ټول کارونکي" } },
  { value: "super_admin", label: "Super Admin", labelTranslations: { ur: "سپر ایڈمن", ar: "المدير العام", fa: "مدیر ارشد", ps: "لوړ مدیر" } },
  { value: "accountant", label: "Head Accountant", labelTranslations: { ur: "ہیڈ اکاؤنٹنٹ", ar: "رئيس الحسابات", fa: "سرپرست حسابداری", ps: "مشر محاسب" } },
  { value: "clearing_officer", label: "Clearing Officer", labelTranslations: { ur: "کلیرنگ آفیسر", ar: "مسؤول التخليص", fa: "افسر ترخیص", ps: "د تصفیې افسر" } },
  { value: "audit_manager", label: "Audit Manager", labelTranslations: { ur: "آڈٹ مینیجر", ar: "مدير التدقيق", fa: "مدیر حسابرسی", ps: "د پلټنې مدیر" } }
];

const DEFAULT_CURRENCIES: FilterOption[] = [
  { value: "all", label: "All Currencies", labelTranslations: { ur: "تمام کرنسیاں", ar: "جميع العملات", fa: "همه ارزها", ps: "ټول اسعار" } },
  { value: "AED", label: "AED (UAE Dirham)", labelTranslations: { ur: "AED (درہم)", ar: "AED (درهم إماراتي)", fa: "AED (درهم)", ps: "AED (درهم)" } },
  { value: "PKR", label: "PKR (Pakistani Rupee)", labelTranslations: { ur: "PKR (پاکستانی روپیہ)", ar: "PKR (روبية باكستانية)", fa: "PKR (روپیه)", ps: "PKR (روپۍ)" } },
  { value: "USD", label: "USD (US Dollar)", labelTranslations: { ur: "USD (امریکی ڈالر)", ar: "USD (دولار أمريكي)", fa: "USD (دلار)", ps: "USD (ډالر)" } },
  { value: "EUR", label: "EUR (Euro)", labelTranslations: { ur: "EUR (یورو)", ar: "EUR (يورو)", fa: "EUR (یورو)", ps: "EUR (یورو)" } },
  { value: "AFN", label: "AFN (Afghan Afghani)", labelTranslations: { ur: "AFN (افغانی)", ar: "AFN (أفغاني)", fa: "AFN (افغانی)", ps: "AFN (افغانۍ)" } }
];

// ─── Compact Dropdown Pill Component ──────────────────────────────────────────

export function SmartFilterDropdown({
  label,
  icon,
  value,
  options,
  onChange,
  disabled = false,
  lang,
  className = ""
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  options: FilterOption[];
  onChange: (val: string) => void;
  disabled?: boolean;
  lang: Lang;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Selected Option Object
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value) || options[0];
  }, [options, value]);

  const selectedDisplay = useMemo(() => {
    if (!selectedOption) return label;
    return selectedOption.labelTranslations?.[lang] || selectedOption.label;
  }, [selectedOption, lang, label]);

  // Filtered List
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((opt) => {
      const translated = (opt.labelTranslations?.[lang] || "").toLowerCase();
      const raw = opt.label.toLowerCase();
      return raw.includes(q) || translated.includes(q);
    });
  }, [options, search, lang]);

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  return (
    <div className={`relative inline-block text-left w-full sm:w-auto ${className}`} ref={popoverRef}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-all shadow-xs ${
          value && value !== "all"
            ? "border-blue-500 bg-blue-50/70 text-blue-900 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200"
            : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/60"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-slate-500 shrink-0">{icon}</span>}
          <span className="truncate">{selectedDisplay}</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className="absolute z-50 mt-1.5 w-64 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100"
          style={{ [isRtl ? "right" : "left"]: 0 }}
        >
          {/* Dropdown Search Input */}
          <div className="relative mb-1.5 p-1">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tx("searchInsideDropdown", lang)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-1.5 pe-2.5 ps-7 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans"
            />
          </div>

          {/* Scrollable Options List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 font-medium">
                {tx("noResultsFound", lang)}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = (value || "all") === option.value;
                const optLabel = option.labelTranslations?.[lang] || option.label;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition text-left ${
                      isSelected
                        ? "bg-blue-600 text-white font-bold"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {option.icon && (
                        <span className="shrink-0">{typeof option.icon === "string" ? option.icon : option.icon}</span>
                      )}
                      <span className="truncate">{optLabel}</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Reusable Component: SmartSearchFilter ───────────────────────────────

export function SmartSearchFilter({
  value,
  onChange,
  onApply,
  onReset,
  placeholder,
  hideHeader = false,
  hideSearch = false,
  hideCascadingLocations = false,
  hideRiskLevel = false,
  hideStatus = false,
  hideDateRange = false,
  hideModule = false,
  hideUser = false,
  hideCurrency = false,
  customFilters = [],
  countryOptions = DEFAULT_COUNTRIES,
  branchOptions = DEFAULT_BRANCHES,
  mainBranchOptions = DEFAULT_MAIN_BRANCHES,
  statusOptions = DEFAULT_STATUSES,
  riskOptions = DEFAULT_RISK_LEVELS,
  moduleOptions = DEFAULT_MODULES,
  userOptions = DEFAULT_USERS,
  currencyOptions = DEFAULT_CURRENCIES,
  className = ""
}: SmartSearchFilterProps) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Cascading Branch Filtering: When Country changes, filter branches
  const filteredBranchOptions = useMemo(() => {
    if (!value.country || value.country === "all") return branchOptions;
    return [
      branchOptions[0], // "All Branches"
      ...branchOptions.slice(1).filter((b) => b.countryId === value.country || !b.countryId)
    ];
  }, [branchOptions, value.country]);

  // Cascading Main/City Branch Filtering: When Branch changes, filter main branches
  const filteredMainBranchOptions = useMemo(() => {
    if (!value.branch || value.branch === "all") return mainBranchOptions;
    return [
      mainBranchOptions[0], // "All Main Branches"
      ...mainBranchOptions.slice(1).filter((mb) => mb.branchId === value.branch || !mb.branchId)
    ];
  }, [mainBranchOptions, value.branch]);

  // Active filters count
  const activeCount = useMemo(() => {
    let count = 0;
    if (value.query?.trim()) count++;
    if (value.country && value.country !== "all") count++;
    if (value.branch && value.branch !== "all") count++;
    if (value.mainBranch && value.mainBranch !== "all") count++;
    if (value.riskLevel && value.riskLevel !== "all") count++;
    if (value.status && value.status !== "all") count++;
    if (value.fromDate) count++;
    if (value.toDate) count++;
    if (value.module && value.module !== "all") count++;
    if (value.editedBy && value.editedBy !== "all") count++;
    if (value.currency && value.currency !== "all") count++;
    if (value.custom) {
      Object.values(value.custom).forEach((v) => {
        if (v && v !== "all") count++;
      });
    }
    return count;
  }, [value]);

  const handleReset = useCallback(() => {
    const empty: SmartFilterState = {
      query: "",
      riskLevel: "all",
      country: "all",
      branch: "all",
      mainBranch: "all",
      status: "all",
      fromDate: "",
      toDate: "",
      module: "all",
      editedBy: "all",
      currency: "all",
      custom: {}
    };
    onChange(empty);
    onReset?.();
  }, [onChange, onReset]);

  const handleApply = useCallback(() => {
    onApply?.(value);
    setMobileDrawerOpen(false);
  }, [onApply, value]);

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={`w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all ${className}`}
    >
      {/* ── Top Header Strip ────────────────────────────────────────────── */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {tx("headerTitle", lang)}
                </h3>
                <span className="rounded-full border border-blue-200 bg-blue-50/80 px-2 py-0.5 text-[9.5px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                  {tx("badgeCompact", lang)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tx("headerSubtitle", lang)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {activeCount > 0 && (
              <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 px-2.5 py-0.5 text-[11px] font-bold">
                {activeCount} {tx("activeFiltersCount", lang)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Search Input & Primary Action Buttons ────────────────────────── */}
      {!hideSearch && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mb-3.5">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={value.query || ""}
              onChange={(e) => onChange({ ...value, query: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              placeholder={placeholder || tx("searchPlaceholder", lang)}
              className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 py-2 pe-8 ps-9 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-sans shadow-xs"
            />
            {value.query ? (
              <button
                type="button"
                onClick={() => onChange({ ...value, query: "" })}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/60 shadow-xs transition"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>{tx("btnReset", lang)}</span>
          </button>

          {/* Primary Filter Button */}
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-98 transition cursor-pointer"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>{tx("btnFilter", lang)}</span>
          </button>

          {/* Mobile Filter Sheet Trigger */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="sm:hidden inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{tx("btnFilter", lang)} ({activeCount})</span>
          </button>
        </div>
      )}

      {/* ── Filter Dropdown Grid (Desktop & Tablet) ────────────────────── */}
      <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {/* Risk Level */}
        {!hideRiskLevel && (
          <SmartFilterDropdown
            label={tx("lblRiskLevel", lang)}
            icon={<Shield className="h-3.5 w-3.5" />}
            value={value.riskLevel || "all"}
            options={riskOptions}
            onChange={(val) => onChange({ ...value, riskLevel: val })}
            lang={lang}
          />
        )}

        {/* Cascading Flow 1: Country */}
        {!hideCascadingLocations && (
          <SmartFilterDropdown
            label={tx("lblCountry", lang)}
            icon={<Globe className="h-3.5 w-3.5" />}
            value={value.country || "all"}
            options={countryOptions}
            onChange={(val) => {
              onChange({
                ...value,
                country: val,
                branch: "all",
                mainBranch: "all"
              });
            }}
            lang={lang}
          />
        )}

        {/* Cascading Flow 2: Branch (Filtered by Country) */}
        {!hideCascadingLocations && (
          <SmartFilterDropdown
            label={tx("lblBranch", lang)}
            icon={<Building className="h-3.5 w-3.5" />}
            value={value.branch || "all"}
            options={filteredBranchOptions}
            onChange={(val) => {
              onChange({
                ...value,
                branch: val,
                mainBranch: "all"
              });
            }}
            lang={lang}
          />
        )}

        {/* Cascading Flow 3: Main Branch (Filtered by Branch) */}
        {!hideCascadingLocations && (
          <SmartFilterDropdown
            label={tx("lblMainBranch", lang)}
            icon={<GitFork className="h-3.5 w-3.5" />}
            value={value.mainBranch || "all"}
            options={filteredMainBranchOptions}
            onChange={(val) => onChange({ ...value, mainBranch: val })}
            lang={lang}
          />
        )}

        {/* Approval Status */}
        {!hideStatus && (
          <SmartFilterDropdown
            label={tx("lblApprovalStatus", lang)}
            icon={<BadgeCheck className="h-3.5 w-3.5" />}
            value={value.status || "all"}
            options={statusOptions}
            onChange={(val) => onChange({ ...value, status: val })}
            lang={lang}
          />
        )}

        {/* From Date */}
        {!hideDateRange && (
          <div className="w-full">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {tx("lblFromDate", lang)}
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={value.fromDate || ""}
                onChange={(e) => onChange({ ...value, fromDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200/90 bg-white py-2 pe-3 ps-8 text-xs font-semibold text-slate-700 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-sans shadow-xs"
              />
            </div>
          </div>
        )}

        {/* To Date */}
        {!hideDateRange && (
          <div className="w-full">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {tx("lblToDate", lang)}
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={value.toDate || ""}
                onChange={(e) => onChange({ ...value, toDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200/90 bg-white py-2 pe-3 ps-8 text-xs font-semibold text-slate-700 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-sans shadow-xs"
              />
            </div>
          </div>
        )}

        {/* Module */}
        {!hideModule && (
          <SmartFilterDropdown
            label={tx("lblModule", lang)}
            icon={<Boxes className="h-3.5 w-3.5" />}
            value={value.module || "all"}
            options={moduleOptions}
            onChange={(val) => onChange({ ...value, module: val })}
            lang={lang}
          />
        )}

        {/* Edited By / User */}
        {!hideUser && (
          <SmartFilterDropdown
            label={tx("lblEditedBy", lang)}
            icon={<User className="h-3.5 w-3.5" />}
            value={value.editedBy || "all"}
            options={userOptions}
            onChange={(val) => onChange({ ...value, editedBy: val })}
            lang={lang}
          />
        )}

        {/* Currency */}
        {!hideCurrency && (
          <SmartFilterDropdown
            label={tx("lblCurrency", lang)}
            icon={<Coins className="h-3.5 w-3.5" />}
            value={value.currency || "all"}
            options={currencyOptions}
            onChange={(val) => onChange({ ...value, currency: val })}
            lang={lang}
          />
        )}

        {/* Custom Module Filters */}
        {customFilters.map((custom) => {
          const customVal = value.custom?.[custom.key] || custom.defaultValue || "all";
          const customLabel = custom.labelTranslations?.[lang] || custom.label;
          return (
            <SmartFilterDropdown
              key={custom.key}
              label={customLabel}
              icon={custom.icon}
              value={customVal}
              options={custom.options}
              onChange={(val) => {
                onChange({
                  ...value,
                  custom: {
                    ...(value.custom || {}),
                    [custom.key]: val
                  }
                });
              }}
              lang={lang}
            />
          );
        })}
      </div>

      {/* ── Mobile Filter Drawer ────────────────────────────────────────── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            dir={isRtl ? "rtl" : "ltr"}
            className="w-full rounded-t-3xl border-t border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[85vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {tx("headerTitle", lang)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {!hideRiskLevel && (
                <SmartFilterDropdown
                  label={tx("lblRiskLevel", lang)}
                  icon={<Shield className="h-3.5 w-3.5" />}
                  value={value.riskLevel || "all"}
                  options={riskOptions}
                  onChange={(val) => onChange({ ...value, riskLevel: val })}
                  lang={lang}
                />
              )}

              {!hideCascadingLocations && (
                <>
                  <SmartFilterDropdown
                    label={tx("lblCountry", lang)}
                    icon={<Globe className="h-3.5 w-3.5" />}
                    value={value.country || "all"}
                    options={countryOptions}
                    onChange={(val) => {
                      onChange({
                        ...value,
                        country: val,
                        branch: "all",
                        mainBranch: "all"
                      });
                    }}
                    lang={lang}
                  />

                  <SmartFilterDropdown
                    label={tx("lblBranch", lang)}
                    icon={<Building className="h-3.5 w-3.5" />}
                    value={value.branch || "all"}
                    options={filteredBranchOptions}
                    onChange={(val) => {
                      onChange({
                        ...value,
                        branch: val,
                        mainBranch: "all"
                      });
                    }}
                    lang={lang}
                  />

                  <SmartFilterDropdown
                    label={tx("lblMainBranch", lang)}
                    icon={<GitFork className="h-3.5 w-3.5" />}
                    value={value.mainBranch || "all"}
                    options={filteredMainBranchOptions}
                    onChange={(val) => onChange({ ...value, mainBranch: val })}
                    lang={lang}
                  />
                </>
              )}

              {!hideStatus && (
                <SmartFilterDropdown
                  label={tx("lblApprovalStatus", lang)}
                  icon={<BadgeCheck className="h-3.5 w-3.5" />}
                  value={value.status || "all"}
                  options={statusOptions}
                  onChange={(val) => onChange({ ...value, status: val })}
                  lang={lang}
                />
              )}

              {!hideDateRange && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      {tx("lblFromDate", lang)}
                    </label>
                    <input
                      type="date"
                      value={value.fromDate || ""}
                      onChange={(e) => onChange({ ...value, fromDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      {tx("lblToDate", lang)}
                    </label>
                    <input
                      type="date"
                      value={value.toDate || ""}
                      onChange={(e) => onChange({ ...value, toDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              {!hideModule && (
                <SmartFilterDropdown
                  label={tx("lblModule", lang)}
                  icon={<Boxes className="h-3.5 w-3.5" />}
                  value={value.module || "all"}
                  options={moduleOptions}
                  onChange={(val) => onChange({ ...value, module: val })}
                  lang={lang}
                />
              )}

              {!hideUser && (
                <SmartFilterDropdown
                  label={tx("lblEditedBy", lang)}
                  icon={<User className="h-3.5 w-3.5" />}
                  value={value.editedBy || "all"}
                  options={userOptions}
                  onChange={(val) => onChange({ ...value, editedBy: val })}
                  lang={lang}
                />
              )}
            </div>

            {/* Sticky Mobile Actions */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-900 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                {tx("btnReset", lang)}
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700"
              >
                {tx("btnApplyFilter", lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
