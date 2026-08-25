"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Globe2,
  Info,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BranchOwnerPicker } from "@/features/branches/components/branch-owner-picker";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { openJournalReportWindow } from "@/lib/reports/open-journal-report-window";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { Th } from "@/components/ui/translated-th";

type KycEntityType = "country_branch" | "city_branch" | "user_account" | "new_account";

type KycItem = {
  id: string;
  name: string;
  code?: string | null;
  type: KycEntityType;
  typeLabel: string;
  countryName: string;
  cityName?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "incomplete" | "near_expiry" | "suspended" | "compliant";
  statusBadge: string;
  missingRequirements: string[];
  createdAt: string;
  graceTotalDays: number;
  daysRemaining: number;
  progressPercent: number;
  ownerName?: string | null;
  documentsCount: number;
  editUrl?: string;
  rawDetails: Record<string, any>;
};

type KycMetrics = {
  total: number;
  incomplete: number;
  nearExpiry: number;
  suspended: number;
  compliant: number;
};

const KYC_UI: Record<string, Record<SupportedLanguage, string>> = {
  reportBrand: {
    en: "Regulatory Compliance & Verification Center",
    ur: "ریگولیٹری کمپلائنس و توثیق سینٹر",
    ar: "مركز الامتثال والتحقق التنظيمي",
    fa: "مرکز انطباق و تأیید مقرراتی",
    ps: "د مقرراتي اطاعت او تایید مرکز"
  },
  title: {
    en: "KYC Reports & Master Record Audit Center",
    ur: "کے وائی سی رپورٹ اور ماسٹر ریکارڈ آڈٹ سینٹر",
    ar: "تقرير KYC ومركز تدقيق السجلات الرئيسية",
    fa: "گزارش KYC و مرکز حسابرسی پرونده‌های اصلی",
    ps: "د KYC راپور او د ماسټر ریکارډ د پلټنې مرکز"
  },
  subtitle: {
    en: "Live audit monitoring of missing profile fields, documents, and compliance grace period for Countries, Branches, Users & Fleet",
    ur: "ممالک، برانچز، صارفین اور گاڑیوں کے لیے ادھورے پروفائلز اور دستاویزات کا لائیو جائزہ",
    ar: "مراقبة التدقيق المباشر للحقول والمستندات المفقودة وفترة التوفيق للمؤسسات",
    fa: "پایش زنده مدارک و پرونده‌های ناقص برای کشورها، شعب، کاربران و ناوگان",
    ps: "د هیوادونو، څانګو، کاروونکو او موټرو لپاره د نیمګړو ریکارډونو ژوندۍ ارزونه"
  },
  totalTracked: {
    en: "Total Audited Entities",
    ur: "کل آڈٹ شدہ ریکارڈز",
    ar: "إجمالي السجلات المدققة",
    fa: "کل پرونده‌های آڈیت شده",
    ps: "ټول ارزیابي شوي ریکارډونه"
  },
  actionRequired: {
    en: "Incomplete (Red Alert)",
    ur: "غیر مکمل (سرخ الرٹ)",
    ar: "غير مكتمل (تنبيه أحمر)",
    fa: "ناقص (هشدار قرمز)",
    ps: "نیمګړی (سور خبرداری)"
  },
  nearExpiry: {
    en: "Near Expiry / Overdue",
    ur: "مہلت ختم ہونے کے قریب",
    ar: "قريب من الانتهاء",
    fa: "نزدیک به انقضا",
    ps: "د مودي پای ته نږدې"
  },
  compliant: {
    en: "Compliant & Verified",
    ur: "مکمل اور تصدیق شدہ",
    ar: "متوافق وموثق",
    fa: "کامل و تایید شده",
    ps: "بشپړ او تایید شوی"
  },
  completeNow: {
    en: "+ Upload / Complete Profile",
    ur: "+ پروفائل مکمل کریں",
    ar: "+ إكمال الملف",
    fa: "+ تکمیل پرونده",
    ps: "+ پروفایل بشپړ کړئ"
  },
  printPdf: {
    en: "Print / PDF",
    ur: "پرنٹ / پی ڈی ایف",
    ar: "طباعة / PDF",
    fa: "چاپ / PDF",
    ps: "چاپ / PDF"
  },
  refreshMatrix: {
    en: "Refresh KYC Matrix",
    ur: "KYC میٹرکس ریفریش کریں",
    ar: "تحديث مصفوفة KYC",
    fa: "بازآوری ماتریس KYC",
    ps: "د KYC میټریکس تازه کړئ"
  },
  searchPlaceholder: {
    en: "Search entity name, code, email, or country…",
    ur: "ریکارڈ نام، کوڈ، ای میل، یا ملک تلاش کریں…",
    ar: "ابحث عن الاسم أو الكود أو البريد أو الدولة…",
    fa: "جستجوی نام، کد، ایمیل یا کشور…",
    ps: "د ریکارډ نوم، کوډ، ایمیل یا هېواد ولټوئ…"
  },
  allEntities: {
    en: "All Entities",
    ur: "تمام ریکارڈز",
    ar: "جميع السجلات",
    fa: "همه پرونده‌ها",
    ps: "ټول ریکارډونه"
  },
  allStatuses: {
    en: "All Statuses",
    ur: "تمام اسٹیٹس",
    ar: "جميع الحالات",
    fa: "همه وضعیت‌ها",
    ps: "ټول حالتونه"
  },
  countryBranches: {
    en: "Countries & Main Branches",
    ur: "ممالک اور مین برانچز",
    ar: "الدول والفروع الرئيسية",
    fa: "کشورها و شعب اصلی",
    ps: "هیوادونه او اصلي څانګې"
  },
  cityBranches: {
    en: "City Branch Nodes",
    ur: "سٹی برانچ نوڈز",
    ar: "فروع المدن",
    fa: "شعب شهری",
    ps: "ښاري څانګې"
  },
  usersStaff: {
    en: "Users & Staff",
    ur: "صارفین و عملہ",
    ar: "المستخدمون والموظفون",
    fa: "کاربران و کارمندان",
    ps: "کاروونکي او کارکوونکي"
  },
  commercialAccounts: {
    en: "Commercial Accounts",
    ur: "تجارتی اکاؤنٹس",
    ar: "الحسابات التجارية",
    fa: "حساب‌های تجاری",
    ps: "تجارتي حسابونه"
  },
  filterStatus: {
    en: "Filter Status:",
    ur: "اسٹیٹس فلٹر:",
    ar: "تصفية الحالة:",
    fa: "فیلتر وضعیت:",
    ps: "د حالت فلټر:"
  },
  incompleteStatus: {
    en: "Incomplete (Red Alert)",
    ur: "نامکمل (سرخ الرٹ)",
    ar: "غير مكتمل (تنبيه أحمر)",
    fa: "ناقص (هشدار قرمز)",
    ps: "نیمګړی (سور خبرداری)"
  },
  nearExpiryStatus: {
    en: "Near Expiry (< 5 Days)",
    ur: "ختم ہونے کے قریب (< 5 دن)",
    ar: "قريب من الانتهاء (< 5 أيام)",
    fa: "نزدیک انقضا (< 5 روز)",
    ps: "د پای نېټې ته نږدې (< 5 ورځې)"
  },
  suspendedStatus: {
    en: "Suspended / Overdue",
    ur: "معطل / تاخیر شدہ",
    ar: "موقوف / متأخر",
    fa: "معلق / معوق",
    ps: "ځنډول شوی / پاتې"
  },
  compliantStatus: {
    en: "Compliant & Verified",
    ur: "مطابق اور تصدیق شدہ",
    ar: "متوافق ومتحقق منه",
    fa: "منطبق و تأیید شده",
    ps: "مطابقت لرونکی او تایید شوی"
  },
  scopeGlobal: {
    en: "ERP-wide review set",
    ur: "ERP-وائڈ جائزہ سیٹ",
    ar: "نطاق مراجعة على مستوى النظام",
    fa: "مجموعه بررسی کل ERP",
    ps: "د ERP پراخه بیاکتنې مجموعه"
  },
  scopeCountry: {
    en: "Country-wide review set",
    ur: "ملکی جائزہ سیٹ",
    ar: "نطاق مراجعة على مستوى الدولة",
    fa: "مجموعه بررسی کشوری",
    ps: "د هېواد په کچه بیاکتنه"
  },
  scopeBranch: {
    en: "Branch-restricted review set",
    ur: "برانچ محدود جائزہ سیٹ",
    ar: "نطاق مراجعة خاص بالفرع",
    fa: "مجموعه بررسی محدود به شعبه",
    ps: "د څانګې پورې محدوده بیاکتنه"
  },
  countryBranchCount: {
    en: "Country Branches",
    ur: "ملکی برانچز",
    ar: "فروع الدولة",
    fa: "شعب کشوری",
    ps: "د هېواد څانګې"
  },
  cityBranchCount: {
    en: "City Branches",
    ur: "سٹی برانچز",
    ar: "فروع المدن",
    fa: "شعب شهری",
    ps: "ښاري څانګې"
  },
  userCount: {
    en: "Users / Accounts",
    ur: "صارفین / اکاؤنٹس",
    ar: "المستخدمون / الحسابات",
    fa: "کاربران / حساب‌ها",
    ps: "کاروونکي / حسابونه"
  },
  loadingText: {
    en: "Loading live KYC reports and compliance audit timers...",
    ur: "لائیو KYC رپورٹس اور کمپلائنس آڈٹ ٹائمرز لوڈ ہو رہے ہیں...",
    ar: "جارٍ تحميل تقارير KYC المباشرة ومؤقتات التدقيق...",
    fa: "در حال بارگذاری گزارش‌های زنده KYC و زمان‌سنج‌های انطباق...",
    ps: "د KYC ژوندۍ راپورونه او د اطاعت د پلټنې ټایمرونه لوډ کېږي..."
  },
  noRecords: {
    en: "No KYC compliance records match your search criteria.",
    ur: "آپ کی تلاش کے مطابق کوئی KYC ریکارڈ نہیں ملا۔",
    ar: "لا توجد سجلات KYC مطابقة لبحثك.",
    fa: "هیچ رکورد KYC مطابق جستجوی شما یافت نشد.",
    ps: "ستاسو له لټون سره سم د KYC کوم ریکارډ ونه موندل شو."
  },
  scopeLabel: {
    en: "Active reporting scope",
    ur: "فعال رپورٹنگ اسکوپ",
    ar: "نطاق التقارير النشط",
    fa: "دامنه فعال گزارش",
    ps: "د راپور فعال ساحه"
  },
  typeLabel: {
    en: "Entity type",
    ur: "ریکارڈ کی قسم",
    ar: "نوع السجل",
    fa: "نوع پرونده",
    ps: "د ریکارډ ډول"
  },
  codeLabel: {
    en: "Code",
    ur: "کوڈ",
    ar: "الرمز",
    fa: "کد",
    ps: "کوډ"
  },
  entityRecordTitle: {
    en: "Entity & Record Title",
    ur: "ریکارڈ اور عنوان",
    ar: "الكيان وعنوان السجل",
    fa: "عنوان موجودیت و رکورد",
    ps: "د ریکارډ او عنوان"
  },
  entityTypeLocation: {
    en: "Type & Location",
    ur: "قسمت اور مقام",
    ar: "النوع والموقع",
    fa: "نوع و موقعیت",
    ps: "ډول او ځای"
  },
  missingRequirementsHeader: {
    en: "Missing Profile Requirements",
    ur: "نامکمل پروفائل تقاضے",
    ar: "متطلبات الملف المفقودة",
    fa: "نیازمندی‌های ناقص پرونده",
    ps: "ورکې شوې د پروفایل اړتیاوې"
  },
  gracePeriodHeader: {
    en: "Grace Period (15 Days)",
    ur: "مہلت مدت (15 دن)",
    ar: "فترة السماح (15 يومًا)",
    fa: "مهلت (15 روز)",
    ps: "د مهلت موده (۱۵ ورځې)"
  },
  statusHeader: {
    en: "Status",
    ur: "اسٹیٹس",
    ar: "الحالة",
    fa: "وضعیت",
    ps: "حالت"
  },
  actionsHeader: {
    en: "Actions",
    ur: "کارروائیاں",
    ar: "الإجراءات",
    fa: "اقدامات",
    ps: "کړنې"
  },
  allRequirementsVerified: {
    en: "All requirements verified",
    ur: "تمام تقاضے تصدیق شدہ",
    ar: "تم التحقق من جميع المتطلبات",
    fa: "همه نیازمندی‌ها تأیید شده‌اند",
    ps: "ټولې اړتیاوې تایید شوې"
  },
  verifiedLabel: {
    en: "Verified",
    ur: "تصدیق شدہ",
    ar: "موثّق",
    fa: "تأیید شدہ",
    ps: "تایید شوی"
  },
  daysRemainingLabel: {
    en: "Days Remaining",
    ur: "دن باقی",
    ar: "الأيام المتبقية",
    fa: "روز باقی",
    ps: "پاتې ورځې"
  },
  directEdit: {
    en: "Direct Edit",
    ur: "براہِ راست ترمیم",
    ar: "تعديل مباشر",
    fa: "ویرایش مستقیم",
    ps: "مستقیم سمون"
  },
  kycVerificationPortal: {
    en: "KYC Verification Portal",
    ur: "KYC تصدیقی پورٹل",
    ar: "بوابة التحقق من KYC",
    fa: "درگاه تأیید KYC",
    ps: "د KYC د تایید دروازه"
  },
  registeredNameTitle: {
    en: "Registered Name / Title",
    ur: "رجسٹرڈ نام / عنوان",
    ar: "الاسم / العنوان المسجل",
    fa: "نام / عنوان ثبت‌شده",
    ps: "ثبت شوی نوم / عنوان"
  },
  ownerOrEntityTitle: {
    en: "Owner or Entity Title",
    ur: "مالک یا ادارہ عنوان",
    ar: "اسم المالك أو الكيان",
    fa: "نام مالک یا موجودیت",
    ps: "د مالک یا ادارې عنوان"
  },
  officialPhoneTitle: {
    en: "Official Phone / WhatsApp",
    ur: "سرکاری فون / واٹس ایپ",
    ar: "الهاتف الرسمي / واتساب",
    fa: "تلفن رسمی / واتساپ",
    ps: "رسمي ټیلیفون / واټساپ"
  },
  officialEmailTitle: {
    en: "Official Email Address",
    ur: "سرکاری ای میل ایڈریس",
    ar: "البريد الإلكتروني الرسمي",
    fa: "ایمیل رسمی",
    ps: "رسمي برېښنالیک"
  },
  physicalAddressTitle: {
    en: "Physical Address",
    ur: "جسمانی پتہ",
    ar: "العنوان الفعلي",
    fa: "نشانی فیزیکی",
    ps: "فزیکي پته"
  },
  attachedComplianceDocuments: {
    en: "Attached Compliance Documents",
    ur: "منسلک کمپلائنس دستاویزات",
    ar: "مستندات الامتثال المرفقة",
    fa: "اسناد انطباق پیوست‌شده",
    ps: "نښلول شوي د اطاعت اسناد"
  },
  docNamePlaceholder: {
    en: "Doc name (e.g. Pakistan_NTN_Registration.pdf)",
    ur: "دستاویز نام (مثلاً Pakistan_NTN_Registration.pdf)",
    ar: "اسم المستند (مثال: Pakistan_NTN_Registration.pdf)",
    fa: "نام سند (مثلاً Pakistan_NTN_Registration.pdf)",
    ps: "د سند نوم (لکه Pakistan_NTN_Registration.pdf)"
  },
  addDoc: {
    en: "Add Doc",
    ur: "دستاویز شامل کریں",
    ar: "إضافة مستند",
    fa: "افزودن سند",
    ps: "سند اضافه کړئ"
  },
  remove: {
    en: "Remove",
    ur: "ہٹائیں",
    ar: "إزالة",
    fa: "حذف",
    ps: "لرې کړئ"
  },
  cancel: {
    en: "Cancel",
    ur: "منسوخ",
    ar: "إلغاء",
    fa: "لغو",
    ps: "لغوه"
  },
  saveAndComplete: {
    en: "Save & Complete Verification",
    ur: "محفوظ کریں اور تصدیق مکمل کریں",
    ar: "حفظ وإكمال التحقق",
    fa: "ذخیره و تکمیل تأیید",
    ps: "ساتنه او تایید بشپړول"
  },
  savingKycDocuments: {
    en: "Saving KYC Documents...",
    ur: "KYC دستاویزات محفوظ ہو رہی ہیں...",
    ar: "جارٍ حفظ مستندات KYC...",
    fa: "در حال ذخیره اسناد KYC...",
    ps: "د KYC اسناد خوندي کېږي..."
  },
  kycUpdatedSuccess: {
    en: "KYC records updated successfully.",
    ur: "KYC ریکارڈز کامیابی سے اپ ڈیٹ ہو گئے۔",
    ar: "تم تحديث سجلات KYC بنجاح.",
    fa: "رکوردهای KYC با موفقیت به‌روزرسانی شد.",
    ps: "د KYC ریکارډونه په بریالیتوب سره تازه شول."
  },
  kycUpdatedEntity: {
    en: "Updated for",
    ur: "کے لیے اپ ڈیٹ ہوا",
    ar: "تم التحديث لـ",
    fa: "به‌روزرسانی شد برای",
    ps: "تازه شو د"
  },
  kycUpdateFailed: {
    en: "Failed to update KYC record.",
    ur: "KYC ریکارڈ اپ ڈیٹ نہ ہو سکا۔",
    ar: "فشل تحديث سجل KYC.",
    fa: "به‌روزرسانی رکورد KYC ناموفق بود.",
    ps: "د KYC ریکارډ تازه کول ناکام شول."
  },
  showingRecordsOf: {
    en: "Showing",
    ur: "دکھا رہے ہیں",
    ar: "عرض",
    fa: "نمایش",
    ps: "ښودل کېږي"
  },
  ofRecords: {
    en: "of",
    ur: "میں سے",
    ar: "من",
    fa: "از",
    ps: "له"
  },
  complianceAuditRecords: {
    en: "compliance audit records",
    ur: "کمپلائنس آڈٹ ریکارڈز",
    ar: "سجلات تدقيق الامتثال",
    fa: "رکوردهای حسابرسی انطباق",
    ps: "د اطاعت د پلټنې ریکارډونه"
  },
  missingRequiredFields: {
    en: "Missing required profile fields",
    ur: "ضروری پروفائل فیلڈز غائب ہیں",
    ar: "حقول الملف المطلوبة مفقودة",
    fa: "فیلدهای ضروری پرونده ناقص هستند",
    ps: "اړین د پروفایل ساحې ورکې دي"
  }
};

const KYC_ENTITY_LABELS: Record<KycEntityType, Record<SupportedLanguage, string>> = {
  country_branch: {
    en: "Country Main Branch",
    ur: "ملکی مرکزی برانچ",
    ar: "الفرع الرئيسي للدولة",
    fa: "شعبه اصلی کشور",
    ps: "د هېواد اصلي څانګه"
  },
  city_branch: {
    en: "City Branch Node",
    ur: "سٹی برانچ نوڈ",
    ar: "فرع مدينة",
    fa: "گره شعبه شهری",
    ps: "ښاري څانګه"
  },
  user_account: {
    en: "Employee / User Account",
    ur: "ملازم / صارف اکاؤنٹ",
    ar: "حساب موظف / مستخدم",
    fa: "حساب کارمند / کاربر",
    ps: "کارکوونکی / کارن حساب"
  },
  new_account: {
    en: "New Ledger Account",
    ur: "نیا لیجر اکاؤنٹ",
    ar: "حساب دفتر أستاذ جديد",
    fa: "حساب کل جدید",
    ps: "نوی لېجر حساب"
  }
};

function getKycEntityLabel(type: KycEntityType, lang: SupportedLanguage) {
  return KYC_ENTITY_LABELS[type]?.[lang] ?? KYC_ENTITY_LABELS[type]?.en ?? type;
}

function formatKycStatusLabel(lang: SupportedLanguage, status: KycItem["status"], daysRemaining: number) {
  if (status === "compliant") return KYC_UI.verifiedLabel[lang];
  if (status === "suspended") return KYC_UI.suspendedStatus[lang];
  const daysText = `${daysRemaining} ${KYC_UI.daysRemainingLabel[lang]}`;
  return status === "near_expiry" ? `${KYC_UI.nearExpiryStatus[lang]} — ${daysText}` : `${KYC_UI.incompleteStatus[lang]} — ${daysText}`;
}

export default function KycReportsPage() {
  const [activeLang, setActiveLang] = useState<SupportedLanguage>("en");
  const dir = getLanguageDirection(activeLang);

  const [items, setItems] = useState<KycItem[]>([]);
  const [metrics, setMetrics] = useState<KycMetrics>({
    total: 0,
    incomplete: 0,
    nearExpiry: 0,
    suspended: 0,
    compliant: 0
  });
  const [scopeSummary, setScopeSummary] = useState<{ level: string; label: string; countryId: string | null; branchId: string | null } | null>(null);
  const [scopeTotals, setScopeTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [message, setMessage] = useState("");

  // Modal state for Uploading & Completing KYC
  const [activeItem, setActiveItem] = useState<KycItem | null>(null);
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editOwnerCustomerId, setEditOwnerCustomerId] = useState<string | null>(null);
  const [editOwnerProfileId, setEditOwnerProfileId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [docList, setDocList] = useState<string[]>([]);
  const [savingKyc, setSavingKyc] = useState(false);

  const tUI = (key: string) => KYC_UI[key]?.[activeLang] || KYC_UI[key]?.en || key;

  async function fetchKycData() {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/kyc/reports");
      const json = await res.json();
      if (res.ok && json.items) {
        setItems(json.items);
        setMetrics(json.metrics || { total: 0, incomplete: 0, nearExpiry: 0, suspended: 0, compliant: 0 });
        setScopeSummary(json.scope ? {
          level: json.scope.level,
          label: json.scope.scopeLabel || json.scope.label || "Global",
          countryId: json.scope.countryId ?? null,
          branchId: json.scope.branchId ?? null
        } : null);
        setScopeTotals(json.totals || {});
      }
    } catch (err: any) {
      console.error("Failed to load KYC reports:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function updateLang() {
      try {
        const stored = localStorage.getItem("erp_lang") as SupportedLanguage | null;
        if (stored && ["en", "ur", "ps", "ar", "fa"].includes(stored)) {
          setActiveLang(stored);
        } else {
          const match = document.cookie.match(/erp_lang=([^;]+)/);
          if (match && match[1] && ["en", "ur", "ps", "ar", "fa"].includes(match[1])) {
            setActiveLang(match[1] as SupportedLanguage);
          }
        }
      } catch {
        // ignore SSR errors
      }
    }

    updateLang();
    window.addEventListener("erp_lang_changed", updateLang);
    window.addEventListener("storage", updateLang);
    fetchKycData();

    return () => {
      window.removeEventListener("erp_lang_changed", updateLang);
      window.removeEventListener("storage", updateLang);
    };
  }, []);

  function handleOpenKycModal(item: KycItem) {
    setActiveItem(item);
    setEditOwnerName(item.ownerName || item.rawDetails?.owner_name || "");
    const ownerCustomerId = item.rawDetails?.owner_customer_id || null;
    const ownerProfileId = item.rawDetails?.owner_profile_id || null;
    setEditOwnerCustomerId(ownerCustomerId);
    setEditOwnerProfileId(ownerProfileId);
    setEditOwnerId(ownerCustomerId || ownerProfileId || "");
    setEditPhone(item.phone || item.rawDetails?.phone || "");
    setEditEmail(item.email || item.rawDetails?.email || "");
    setEditAddress(item.rawDetails?.address || "");
    setDocList(Array.isArray(item.rawDetails?.documents) ? item.rawDetails.documents : ["Official Trade License Copy.pdf", "NTN Tax Registration.pdf"]);
    setNewDocName("");
  }

  function handleAddDocument() {
    if (!newDocName.trim()) return;
    setDocList([...docList, newDocName.trim()]);
    setNewDocName("");
  }

  async function handleSaveKyc(e: React.FormEvent) {
    e.preventDefault();
    if (!activeItem) return;

    setSavingKyc(true);
    setMessage("");

    try {
      const res = await fetch("/api/erp/kyc/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: activeItem.id,
          entityType: activeItem.type,
          action: "complete_kyc",
          ownerName: editOwnerName,
          ownerCustomerId: editOwnerCustomerId,
          ownerProfileId: editOwnerProfileId,
          phone: editPhone,
          email: editEmail,
          address: editAddress,
          documents: docList
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update KYC record");

      setMessage(`✅ ${tUI("kycUpdatedSuccess")} ${tUI("kycUpdatedEntity")} "${activeItem.name}"!`);
      setActiveItem(null);
      await fetchKycData();
    } catch (err: any) {
      console.error("Failed to update KYC record:", err);
      setMessage("❌ " + tUI("kycUpdateFailed"));
    } finally {
      setSavingKyc(false);
    }
  }

  function handleKycPrint() {
    const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);
    openJournalReportWindow({
      lang: activeLang,
      autoPrint: true,
      title: tt("nav.kyc_reports", "KYC Compliance Report"),
      subtitle: tt("jrn.roznamcha_journal", "Compliance Audit Report"),
      overviewLabel: tt("jrn.overview", "Report Overview"),
      scopeName: tt("nav.kyc_reports", "KYC Compliance Report"),
      reportIdPrefix: "KYC",
      reportIdValue: "audit",
      chips: [{ label: tt("jrn.entry_count", "Total Records"), value: String(filteredItems.length) }],
      kpis: [],
      columns: [
        { key: "sno", label: tt("rozrep.sno", "S.No") },
        { key: "code", label: tt("acct.account_code", "Code") },
        { key: "name", label: tt("acct.customer_name", "Name") },
        { key: "type", label: tt("acct.account_type", "Type") },
        { key: "country", label: tt("acct.country", "Country") },
        { key: "owner", label: tt("prof.owner_name", "Owner") },
        { key: "phone", label: tt("acct.phone", "Phone") },
        { key: "email", label: tt("acct.email", "Email") },
        { key: "status", label: tt("acct.status", "Status") }
      ],
      rows: filteredItems.map((item, idx) => ({
        sno: String(idx + 1),
        code: item.code,
        name: item.name,
        type: getKycEntityLabel(item.type, activeLang),
        country: item.countryName,
        owner: item.ownerName,
        phone: item.phone,
        email: item.email,
        status: formatKycStatusLabel(activeLang, item.status, item.daysRemaining)
      }))
    });
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.countryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.email || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === "all" || item.type === selectedType;
    const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div dir={dir} className="w-full space-y-6 text-foreground p-3 sm:p-5 lg:p-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">
              {tUI("reportBrand")}
            </p>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            {tUI("title")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
            {tUI("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <Button
            onClick={handleKycPrint}
            variant="outline"
            className="border-border/80 bg-card hover:bg-muted text-foreground h-9 px-3.5 rounded-xl shadow-xs text-xs font-bold transition-all"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            {tUI("printPdf")}
          </Button>

          <Button
            onClick={fetchKycData}
            disabled={loading}
            variant="outline"
            className="border-border/80 bg-card hover:bg-muted text-foreground h-9 px-3.5 rounded-xl shadow-xs text-xs font-bold transition-all"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading ? "animate-spin text-rose-600" : "")} />
            {tUI("refreshMatrix")}
          </Button>
        </div>
      </div>

      {message && (
        <div className={cn(
          "px-4 py-3 rounded-xl text-xs font-semibold border flex items-center justify-between shadow-sm",
          message.startsWith("✅")
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
        )}>
          <span>{message}</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border/60 p-4 rounded-2xl shadow-sm hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tUI("totalTracked")}</p>
              <p className="mt-1.5 text-2xl font-black text-foreground">{metrics.total}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {scopeSummary ? `${tUI("scopeLabel")}: ${scopeSummary.label}` : tUI("scopeGlobal")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/60 p-4 rounded-2xl shadow-sm hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{tUI("actionRequired")}</p>
              <p className="mt-1.5 text-2xl font-black text-rose-600 dark:text-rose-400">{metrics.incomplete}</p>
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                {scopeTotals.total ? `${tUI("typeLabel")}: ${scopeTotals.total}` : tUI("missingRequiredFields")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/60 p-4 rounded-2xl shadow-sm hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">{tUI("nearExpiry")}</p>
              <p className="mt-1.5 text-2xl font-black text-rose-600 dark:text-rose-400">{metrics.nearExpiry + metrics.suspended}</p>
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">{tUI("nearExpiryStatus")}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/60 p-4 rounded-2xl shadow-sm hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{tUI("compliant")}</p>
              <p className="mt-1.5 text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.compliant}</p>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{tUI("compliantStatus")}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tUI("scopeLabel")}</p>
          <p className="mt-1 text-sm font-black text-foreground">{scopeSummary?.label ?? tUI("scopeGlobal")}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {scopeSummary?.level === "branch" ? tUI("scopeBranch") : scopeSummary?.level === "country" ? tUI("scopeCountry") : tUI("scopeGlobal")}
          </p>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tUI("countryBranchCount")}</p>
          <p className="mt-1 text-sm font-black text-foreground">{scopeTotals.countryBranches ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{tUI("scopeCountry")}</p>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tUI("cityBranchCount")}</p>
          <p className="mt-1 text-sm font-black text-foreground">{scopeTotals.cityBranches ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{tUI("scopeBranch")}</p>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tUI("userCount")}</p>
          <p className="mt-1 text-sm font-black text-foreground">{scopeTotals.users ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{scopeSummary ? scopeSummary.label : tUI("scopeGlobal")}</p>
        </Card>
      </div>

      {/* Unified Search & Filter Strip (Picture 2 Design) */}
      <div className="bg-card border border-border/80 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px] max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tUI("searchPlaceholder")}
              className="w-full bg-background border border-border/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-foreground placeholder:text-muted-foreground/60 transition-all"
            />
          </div>

          {/* Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: "all", label: tUI("allEntities") },
              { id: "country_branch", label: tUI("countryBranches") },
              { id: "city_branch", label: tUI("cityBranches") },
              { id: "user_account", label: tUI("usersStaff") },
              { id: "new_account", label: tUI("commercialAccounts") }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
                  selectedType === type.id
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Row */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0 mr-1">{tUI("filterStatus")}</span>
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {[
              { id: "all", label: tUI("allStatuses") },
              { id: "incomplete", label: tUI("incompleteStatus") },
              { id: "near_expiry", label: tUI("nearExpiryStatus") },
              { id: "suspended", label: tUI("suspendedStatus") },
              { id: "compliant", label: tUI("compliantStatus") }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all shrink-0 border",
                  selectedStatus === st.id
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 shadow-xs"
                    : "bg-background border-border/70 text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main KYC Report Table */}
      <Card className="bg-card border-border/60 rounded-2xl overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              {tUI("title")}
            </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {tUI("showingRecordsOf")} {filteredItems.length} {tUI("ofRecords")} {items.length} {tUI("complianceAuditRecords")}.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-foreground">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/60">
              <tr>
                <Th className="px-5 py-3.5">{tUI("entityRecordTitle")}</Th>
                <Th className="px-5 py-3.5">{tUI("entityTypeLocation")}</Th>
                <Th className="px-5 py-3.5">{tUI("missingRequirementsHeader")}</Th>
                <Th className="px-5 py-3.5">{tUI("gracePeriodHeader")}</Th>
                <Th className="px-5 py-3.5">{tUI("statusHeader")}</Th>
                <Th className="px-5 py-3.5 text-right">{tUI("actionsHeader")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-semibold">
                    {tUI("loadingText")}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    {tUI("noRecords")}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-foreground flex items-center gap-2">
                        {item.type === "country_branch" && <Globe2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
                        {item.type === "city_branch" && <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
                        {item.type === "user_account" && <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                        {item.type === "new_account" && <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                        <span>{item.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{tUI("codeLabel")}: {item.code || "N/A"}</span>
                        {item.email && <span>&bull; {item.email}</span>}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-muted text-foreground border border-border/60 whitespace-nowrap">
                        {getKycEntityLabel(item.type, activeLang)}
                      </span>
                      <p className="text-[11px] font-semibold text-muted-foreground mt-1 whitespace-nowrap">{item.countryName}</p>
                    </td>

                    <td className="px-5 py-4 max-w-xs">
                      {item.missingRequirements.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.missingRequirements.map((req, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                              ⚠ {req}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {tUI("allRequirementsVerified")}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 min-w-[160px]">
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                        <span className={cn(
                          item.status === "compliant" ? "text-emerald-600 dark:text-emerald-400" :
                          item.status === "suspended" ? "text-rose-600 dark:text-rose-400" :
                          item.daysRemaining <= 5 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                        )}>
                          {formatKycStatusLabel(activeLang, item.status, item.daysRemaining)}
                        </span>
                        <span className="text-muted-foreground font-mono">{item.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-300",
                            item.status === "compliant" ? "bg-emerald-500" :
                            item.status === "suspended" ? "bg-rose-600" :
                            item.daysRemaining <= 5 ? "bg-rose-500 animate-pulse" : "bg-amber-500"
                          )}
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase border inline-flex items-center gap-1",
                        item.status === "compliant"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : item.status === "suspended"
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 animate-pulse"
                          : item.status === "near_expiry"
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      )}>
                        {formatKycStatusLabel(activeLang, item.status, item.daysRemaining)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.editUrl && (
                          <Link href={item.editUrl as any}>
                            <Button
                              variant="outline"
                              className="h-8 px-2.5 text-[11px] font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                            <ExternalLink className="h-3 w-3 mr-1 text-slate-600 dark:text-slate-400" /> {tUI("directEdit")}
                          </Button>
                        </Link>
                      )}
                      <Button
                        onClick={() => handleOpenKycModal(item)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-8 px-3 rounded-lg text-xs shadow-xs"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" /> {tUI("completeNow")}
                      </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Interactive Modal for KYC Upload & Completion */}
      {activeItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">{tUI("kycVerificationPortal")}</span>
                <h3 className="text-base font-extrabold text-foreground">{activeItem.name}</h3>
              </div>
              <button onClick={() => setActiveItem(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKyc} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-foreground">{tUI("registeredNameTitle")}</Label>
                  {activeItem.type === "country_branch" || activeItem.type === "city_branch" ? (
                    <div className="mt-1">
                      <BranchOwnerPicker
                        value={editOwnerId}
                        onValueChange={setEditOwnerId}
                        onOwnerResolved={(owner) => {
                          setEditOwnerName(owner?.name || "");
                          setEditOwnerCustomerId(owner?.kind === "customer" ? owner.id : null);
                          setEditOwnerProfileId(owner?.kind === "profile" ? owner.id : null);
                        }}
                        placeholder={tUI("ownerOrEntityTitle")}
                        createButtonPlacement="below"
                      />
                    </div>
                  ) : (
                    <Input
                      value={editOwnerName}
                      onChange={(e) => setEditOwnerName(e.target.value)}
                      placeholder={tUI("ownerOrEntityTitle")}
                      className="bg-background text-xs h-9 rounded-lg mt-1"
                    />
                  )}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">{tUI("officialPhoneTitle")}</Label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="bg-background text-xs h-9 rounded-lg mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">{tUI("officialEmailTitle")}</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="official@company.dgt.llc"
                  className="bg-background text-xs h-9 rounded-lg mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">{tUI("physicalAddressTitle")}</Label>
                <Input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Official office street address, city, country"
                  className="bg-background text-xs h-9 rounded-lg mt-1"
                />
              </div>

              {/* Uploaded Documents List */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>{tUI("attachedComplianceDocuments")}</span>
                  <span className="text-[10px] text-muted-foreground">NTN, Trade License, CNIC/Passport</span>
                </Label>

                <div className="flex gap-2">
                  <Input
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder={tUI("docNamePlaceholder")}
                    className="bg-background text-xs h-9 rounded-lg flex-1"
                  />
                  <Button type="button" onClick={handleAddDocument} variant="outline" className="h-9 px-3 text-xs font-bold">
                    <Plus className="h-3.5 w-3.5 mr-1" /> {tUI("addDoc")}
                  </Button>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {docList.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/40 text-xs">
                        <span className="font-mono text-[11px] text-foreground truncate">{doc}</span>
                        <button
                          type="button"
                          onClick={() => setDocList(docList.filter((_, i) => i !== idx))}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs font-bold"
                        >
                        {tUI("remove")}
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <Button type="button" variant="outline" onClick={() => setActiveItem(null)} className="h-9 text-xs font-bold">
                  {tUI("cancel")}
                </Button>
                <Button type="submit" disabled={savingKyc} className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 px-4 text-xs">
                  {savingKyc ? tUI("savingKycDocuments") : tUI("saveAndComplete")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
