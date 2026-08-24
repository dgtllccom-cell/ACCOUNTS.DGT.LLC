"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Users, Building2, ScrollText, Clock, Calendar, Banknote,
  ClipboardList, FileText, Badge as IdBadgeIcon, BarChart3,
  Search, Filter, Plus, Printer, Download, Mail, MessageSquare,
  Eye, Edit3, Trash2, CheckCircle2, AlertCircle, XCircle, ChevronRight,
  ShieldCheck, RefreshCcw, FileSpreadsheet, Send, PhoneCall, Check, UserPlus, UserCheck, CreditCard, MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SimpleModal } from "@/components/ui/simple-modal";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { EmployeeForm } from "@/features/hr-payroll/components/employee-form";
import { EmployeeDateToolbar, computeRange, inRange, type DateRange } from "@/features/general-office/components/employee-date-toolbar";
import { OfficeHrModule } from "@/features/general-office/components/office-hr-module";
import { ATTENDANCE_CONFIG, LEAVE_CONFIG, ASSETS_CONFIG } from "@/features/general-office/components/office-hr-configs";
import { personFullName } from "@/features/hr-payroll/components/person-picker";
import { t as ct } from "@/lib/i18n/ui";
import { AdvanceLoanModal } from "@/features/hr-payroll/components/advance-loan-modal";
import { EmployeeLedgerPanel } from "@/features/hr-payroll/components/employee-ledger-panel";
import { openUserA4ReportWindow } from "@/lib/reports/open-user-a4-report-window";
import { Th } from "@/components/ui/translated-th";
import { translateHeader } from "@/lib/i18n/table-headers";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => {
  const d = new Date(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};

/* ──────────────────────────────────────────────────────────────
   5-LANGUAGE DICTIONARY FOR GENERAL OFFICE MANAGEMENT
   ────────────────────────────────────────────────────────────── */
const dict = {
  en: {
    title: "General Office Management",
    subtitle: "Enterprise HR, Payroll, Attendance, Assets & Employee Master Center",
    searchPlaceholder: "Search employees, departments, assets, ID cards...",
    masterSetup: "Employee Master Setup",
    empMgmt: "Employee Management",
    departments: "Departments",
    designations: "Designations",
    attendance: "Attendance",
    leave: "Leave Management",
    payroll: "Payroll / Salary",
    assets: "Office Assets",
    officeAssets: "Office Assets",
    documents: "Office Documents",
    officeDocuments: "Office Documents",
    idCards: "Employee ID Cards",
    reports: "Employee Reports",
    registerBtn: "Register New Employee",
    totalEmployees: "Total Employees",
    activeStaff: "Active Staff",
    attendanceRate: "Attendance Rate",
    monthlyPayroll: "Monthly Payroll",
    pendingLeaves: "Pending Leaves",
    assetsTracked: "Assets Tracked",
    colEmpCode: "Emp Code",
    colName: "Employee Name",
    colCategory: "Category",
    colDesigDept: "Designation / Dept",
    colJoining: "Joining Date",
    colNetSalary: "Net Payroll",
    colDeductions: "Deductions",
    colStatus: "Status",
    colActions: "Actions",
    view: "View",
    print: "Print A4",
    pdf: "Download PDF",
    excel: "Export Excel",
    email: "Send Email",
    whatsapp: "WhatsApp",
    allCategories: "All Categories",
    allStatuses: "All Statuses",
    active: "Active",
    inactive: "Inactive",
    onLeave: "On Leave",
    suspended: "Suspended",
    edit: "Edit",
    loanAdv: "Loan / Adv",
    ledger: "Ledger",
    delete: "Delete",
    idCardPreview: "Print ID Card",
    search: "Search",
    filter: "Filter"
  },
  ur: {
    title: "جنرل آفس مینجمنٹ",
    subtitle: "انٹرپرائز ایچ آر، پے رول، حاضری، اثاثہ جات اور ایمپلائی ماسٹر سنٹر",
    searchPlaceholder: "ملازمین، کوڈ، شعبہ یا نام تلاش کریں...",
    masterSetup: "ایمپلائی ماسٹر سیٹ اپ",
    empMgmt: "ملازمین کا انتظام",
    departments: "شعبہ جات",
    designations: "عہدے اور ڈیزگنیشنز",
    attendance: "حاضری و بائیومیٹرک",
    leave: "چھٹیوں کا انتظام",
    payroll: "پے رول اور تنخواہ",
    assets: "دفتری اثاثہ جات",
    officeAssets: "دفتری اثاثہ جات",
    documents: "دفتری دستاویزات",
    officeDocuments: "دفتری دستاویزات",
    idCards: "ملازم شناختی کارڈز",
    reports: "ملازمین کی رپورٹس",
    registerBtn: "نیا ملازم رجسٹر کریں",
    totalEmployees: "کل ملازمین",
    activeStaff: "فعال عملہ",
    attendanceRate: "حاضری کی شرح",
    monthlyPayroll: "ماہانہ پے رول",
    pendingLeaves: "زیر التواء چھٹیاں",
    assetsTracked: "اثاثہ جات ٹریکڈ",
    colEmpCode: "ملازم کوڈ",
    colName: "ملازم کا نام",
    colCategory: "کیٹیگری",
    colDesigDept: "عہدہ / شعبہ",
    colJoining: "شمولیت کی تاریخ",
    colNetSalary: "خالص تنخواہ",
    colDeductions: "کٹوتی",
    colStatus: "حیثیت / اسٹیٹس",
    colActions: "اقدامات",
    view: "دیکھیں",
    print: "A4 پرنٹ کریں",
    pdf: "پی ڈی ایف ڈاؤن لوڈ",
    excel: "ایکسل ایکسپورٹ",
    email: "ای میل بھیجیں",
    whatsapp: "واٹس ایپ",
    allCategories: "تمام کیٹیگریز",
    allStatuses: "تمام اسٹیٹس",
    active: "فعال",
    inactive: "غیر فعال",
    onLeave: "رخصت پر",
    suspended: "معطل",
    edit: "ترمیم کریں",
    loanAdv: "لون / ایڈوانس",
    ledger: "لیجر کھاتہ",
    delete: "حذف کریں",
    idCardPreview: "شناختی کارڈ پرنٹ کریں",
    search: "تلاش کریں",
    filter: "فلٹر"
  },
  ps: {
    title: "د عمومي دفتر اداره",
    subtitle: "د کارمندانو چارې، معاشونه، حاضري او شتمنۍ مرکز",
    searchPlaceholder: "کارمندان ولټوئ...",
    masterSetup: "د کارمندانو اصلي تنظیم",
    empMgmt: "د کارمندانو مدیریت",
    departments: "څانګې",
    designations: "دندې او رتبې",
    attendance: "حاضري",
    leave: "د رخصتیو مدیریت",
    payroll: "معاش او پے رول",
    assets: "دفتري شتمنۍ",
    officeAssets: "دفتري شتمنۍ",
    documents: "دفتري اسناد",
    officeDocuments: "دفتري اسناد",
    idCards: "د کارمندانو پېژند کارتونه",
    reports: "د کارمندانو راپورونه",
    registerBtn: "نوی کارمند ثبت کړئ",
    totalEmployees: "ټول کارمندان",
    activeStaff: "فعال کارمندان",
    attendanceRate: "د حاضرۍ کچه",
    monthlyPayroll: "میاشتنی معاش",
    pendingLeaves: "پاتې رخصتۍ",
    assetsTracked: "ثبت شوې شتمنۍ",
    colEmpCode: "د کارمند کوډ",
    colName: "د کارمند نوم",
    colCategory: "کټګوري",
    colDesigDept: "دنده / څانګه",
    colJoining: "د ګډون نیټه",
    colNetSalary: "خالص معاش",
    colDeductions: "کمښتونه",
    colStatus: "حالت",
    colActions: "کړنې",
    view: "کتل",
    print: "A4 چاپ کړئ",
    pdf: "PDF ډاونلوډ",
    excel: "Excel ته لېږد",
    email: "بریښنالیک",
    whatsapp: "واټساپ",
    allCategories: "ټولې کټګورۍ",
    allStatuses: "ټول حالتونه",
    active: "فعال",
    inactive: "غیر فعال",
    onLeave: "په رخصتۍ",
    suspended: "معطل",
    edit: "سمول",
    loanAdv: "پور / پرمختګ",
    ledger: "لیجر",
    delete: "حذف کړئ",
    idCardPreview: "کارت چاپول",
    search: "لټون",
    filter: "فلټر"
  },
  fa: {
    title: "مدیریت امور عمومی دفتر",
    subtitle: "مرکز منابع انسانی، حقوق و دستمزد، حضور و غیاب و دارایی‌ها",
    searchPlaceholder: "جستجوی پرسنل...",
    masterSetup: "تنظیمات اصلی پرسنل",
    empMgmt: "مدیریت پرسنل",
    departments: "دپارتمان‌ها",
    designations: "عناوین شغلی",
    attendance: "حضور و غیاب",
    leave: "مدیریت مرخصی",
    payroll: "حقوق و دستمزد",
    assets: "اموال اداری",
    officeAssets: "اموال اداری",
    documents: "اسناد پرسنل",
    officeDocuments: "اسناد اداری",
    idCards: "کارت‌های پرسنلی",
    reports: "گزارش‌های پرسنلی",
    registerBtn: "ثبت پرسنل جدید",
    totalEmployees: "کل پرسنل",
    activeStaff: "پرسنل فعال",
    attendanceRate: "نرخ حضور",
    monthlyPayroll: "حقوق ماهانه",
    pendingLeaves: "مرخصی‌های در انتظار",
    assetsTracked: "اموال ردیابی‌شده",
    colEmpCode: "کد پرسنلی",
    colName: "نام پرسنل",
    colCategory: "دسته‌بندی",
    colDesigDept: "عنوان / دپارتمان",
    colJoining: "تاریخ استخدام",
    colNetSalary: "حقوق خالص",
    colDeductions: "کسورات",
    colStatus: "وضعیت",
    colActions: "عملیات",
    view: "مشاهده",
    print: "چاپ A4",
    pdf: "دریافت PDF",
    excel: "خروجی اکسل",
    email: "ارسال ایمیل",
    whatsapp: "واتساپ",
    allCategories: "همه دسته‌ها",
    allStatuses: "همه وضعیت‌ها",
    active: "فعال",
    inactive: "غیرفعال",
    onLeave: "در مرخصی",
    suspended: "معلق",
    edit: "ویرایش",
    loanAdv: "وام / مساعده",
    ledger: "دفتر حساب",
    delete: "حذف",
    idCardPreview: "چاپ کارت شناسایی",
    search: "جستجو",
    filter: "فیلتر"
  },
  ar: {
    title: "إدارة المكتب العام",
    subtitle: "مركز الموارد البشرية والرواتب والحضور والأصول للموظفين",
    searchPlaceholder: "البحث عن الموظفين...",
    masterSetup: "الإعداد الرئيسي للموظفين",
    empMgmt: "إدارة الموظفين",
    departments: "الأقسام",
    designations: "المسميات الوظيفية",
    attendance: "الحضور والانصراف",
    leave: "إدارة الإجازات",
    payroll: "الرواتب والأجور",
    assets: "أصول المكتب",
    officeAssets: "أصول المكتب",
    documents: "مستندات المكتب",
    officeDocuments: "مستندات المكتب",
    idCards: "بطاقات هوية الموظفين",
    reports: "تقارير الموظفين",
    registerBtn: "تسجيل موظف جديد",
    totalEmployees: "إجمالي الموظفين",
    activeStaff: "الموظفون النشطون",
    attendanceRate: "معدل الحضور",
    monthlyPayroll: "الرواتب الشهرية",
    pendingLeaves: "الإجازات المعلقة",
    assetsTracked: "الأصول المسجلة",
    colEmpCode: "رمز الموظف",
    colName: "اسم الموظف",
    colCategory: "الفئة",
    colDesigDept: "المسمى / القسم",
    colJoining: "تاريخ الالتحاق",
    colNetSalary: "صافي الراتب",
    colDeductions: "الخصومات",
    colStatus: "الحالة",
    colActions: "الإجراءات",
    view: "عرض",
    print: "طباعة A4",
    pdf: "تحميل PDF",
    excel: "تصدير Excel",
    email: "إرسال بريد",
    whatsapp: "واتساب",
    allCategories: "جميع الفئات",
    allStatuses: "جميع الحالات",
    active: "نشط",
    inactive: "غير نشط",
    onLeave: "في إجازة",
    suspended: "موقوف",
    edit: "تعديل",
    loanAdv: "سلفة / قرض",
    ledger: "كشف الحساب",
    delete: "حذف",
    idCardPreview: "طباعة بطاقة الهوية",
    search: "بحث",
    filter: "تصفية"
  }
};

type DictKey = keyof typeof dict.en;

const generalOfficeLabels: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  "General Office Enterprise Management": { ur: "جنرل آفس انٹرپرائز مینجمنٹ", ar: "إدارة المكتب العام المؤسسية", fa: "مدیریت سازمانی دفتر عمومی", ps: "د عمومي دفتر سازماني اداره" },
  "Branch & User Details": { ur: "برانچ اور صارف کی تفصیلات", ar: "تفاصيل الفرع والمستخدم", fa: "جزئیات شعبه و کاربر", ps: "د څانګې او کارن جزئیات" },
  "Employees Summary": { ur: "ملازمین کا خلاصہ", ar: "ملخص الموظفين", fa: "خلاصه کارکنان", ps: "د کارمندانو لنډیز" },
  "Payroll & Assets": { ur: "پے رول اور اثاثہ جات", ar: "الرواتب والأصول", fa: "حقوق و دارایی‌ها", ps: "معاشونه او شتمنۍ" },
  "Quick Info": { ur: "فوری معلومات", ar: "معلومات سريعة", fa: "اطلاعات سریع", ps: "چټک معلومات" },
  "Branch Name": { ur: "برانچ کا نام", ar: "اسم الفرع", fa: "نام شعبه", ps: "د څانګې نوم" },
  "User ID / Name": { ur: "صارف آئی ڈی / نام", ar: "معرف المستخدم / الاسم", fa: "شناسه کاربر / نام", ps: "د کارن پېژند / نوم" },
  "Active Session": { ur: "فعال سیشن", ar: "جلسة نشطة", fa: "نشست فعال", ps: "فعاله ناسته" },
  "Pakistan / UAE": { ur: "پاکستان / متحدہ عرب امارات", ar: "باكستان / الإمارات", fa: "پاکستان / امارات متحده عربی", ps: "پاکستان / متحده عربي امارات" },
  "Karachi Main": { ur: "کراچی مین", ar: "كراتشي الرئيسي", fa: "کراچی مرکزی", ps: "کراچۍ مرکزي" },
  "Admin": { ur: "ایڈمن", ar: "مسؤول", fa: "مدیر سیستم", ps: "اډمین" },
  "Admin User": { ur: "ایڈمن صارف", ar: "مستخدم مسؤول", fa: "کاربر مدیر", ps: "اډمین کارن" },
  "Employees": { ur: "ملازمین", ar: "الموظفون", fa: "کارکنان", ps: "کارمندان" },
  "Pending Leaves": { ur: "زیر التواء چھٹیاں", ar: "الإجازات المعلقة", fa: "مرخصی‌های در انتظار", ps: "پاتې رخصتۍ" },
  "Manager": { ur: "منیجر", ar: "مدير", fa: "مدیر", ps: "مدیر" },
  "Normal Staff": { ur: "عام عملہ", ar: "موظفون عاديون", fa: "کارکنان عادی", ps: "عادي کارمندان" },
  "Employee": { ur: "ملازم", ar: "موظف", fa: "کارمند", ps: "کارمند" },
  "Others": { ur: "دیگر", ar: "أخرى", fa: "سایر", ps: "نور" },
  "Loading registered employees...": { ur: "رجسٹرڈ ملازمین لوڈ ہو رہے ہیں...", ar: "جار تحميل الموظفين المسجلين...", fa: "در حال بارگیری کارکنان ثبت‌شده...", ps: "ثبت شوي کارمندان پورته کېږي..." },
  "No employee records found. Click Register New Employee above.": { ur: "کوئی ملازم ریکارڈ نہیں ملا۔ اوپر نیا ملازم رجسٹر کریں پر کلک کریں۔", ar: "لم يتم العثور على سجلات موظفين. اضغط تسجيل موظف جديد أعلاه.", fa: "هیچ رکورد کارمندی یافت نشد. روی ثبت کارمند جدید در بالا کلیک کنید.", ps: "د کارمندانو ریکارډ ونه موندل شو. پورته نوی کارمند ثبت کړئ کېکاږئ." },
  "Manage corporate departments, assigned heads, and employee distribution.": { ur: "کارپوریٹ شعبہ جات، مقررہ سربراہان اور ملازمین کی تقسیم منظم کریں۔", ar: "إدارة الأقسام المؤسسية والرؤساء المعينين وتوزيع الموظفين.", fa: "دپارتمان‌های سازمانی، مدیران تعیین‌شده و توزیع کارکنان را مدیریت کنید.", ps: "سازماني څانګې، ټاکل شوي مشران او د کارمندانو وېش اداره کړئ." },
  "Add Department": { ur: "شعبہ شامل کریں", ar: "إضافة قسم", fa: "افزودن دپارتمان", ps: "څانګه زیاته کړئ" },
  "Head of Dept": { ur: "شعبہ سربراہ", ar: "رئيس القسم", fa: "رئیس دپارتمان", ps: "د څانګې مشر" },
  "Active Employees": { ur: "فعال ملازمین", ar: "الموظفون النشطون", fa: "کارکنان فعال", ps: "فعال کارمندان" },
  "Monthly Budget": { ur: "ماہانہ بجٹ", ar: "الميزانية الشهرية", fa: "بودجه ماهانه", ps: "میاشتنۍ بودیجه" },
  "Members": { ur: "ارکان", ar: "أعضاء", fa: "اعضا", ps: "غړي" },
  "Corporate designation grades, titles, and base salary scales.": { ur: "کارپوریٹ عہدے، گریڈز، عنوانات اور بنیادی تنخواہ اسکیل۔", ar: "درجات ومسميات الوظائف المؤسسية وسلالم الرواتب الأساسية.", fa: "درجات، عناوین شغلی و مقیاس حقوق پایه سازمانی.", ps: "سازماني دندې، رتبې، عنوانونه او بنسټیز معاش کچې." },
  "Add Designation": { ur: "عہدہ شامل کریں", ar: "إضافة مسمى وظيفي", fa: "افزودن عنوان شغلی", ps: "دنده زیاته کړئ" },
  "Designation Title": { ur: "عہدہ کا عنوان", ar: "المسمى الوظيفي", fa: "عنوان شغلی", ps: "دندې عنوان" },
  "Department": { ur: "شعبہ", ar: "القسم", fa: "دپارتمان", ps: "څانګه" },
  "Pay Grade": { ur: "پے گریڈ", ar: "درجة الراتب", fa: "درجه حقوق", ps: "د معاش رتبه" },
  "Min Base Scale": { ur: "کم از کم بنیادی اسکیل", ar: "الحد الأدنى للسلم الأساسي", fa: "حداقل مقیاس پایه", ps: "لږ تر لږه بنسټیزه کچه" },
  "Daily office attendance log, biometric check-in, and work duration tracking.": { ur: "روزانہ دفتری حاضری، بائیومیٹرک چیک اِن اور کام کے دورانیے کی نگرانی۔", ar: "سجل الحضور اليومي والبصمة وتتبع مدة العمل.", fa: "ثبت حضور روزانه، ورود بیومتریک و پیگیری مدت کار.", ps: "ورځنۍ حاضري، بایومیټریک ننوتل او د کار مودې تعقیب." },
  "Mark Biometric Entry": { ur: "بائیومیٹرک اندراج کریں", ar: "تسجيل إدخال بصمة", fa: "ثبت ورود بیومتریک", ps: "بایومیټریک ثبت کړئ" },
  "Time In": { ur: "آمد وقت", ar: "وقت الدخول", fa: "زمان ورود", ps: "د راتګ وخت" },
  "Time Out": { ur: "روانگی وقت", ar: "وقت الخروج", fa: "زمان خروج", ps: "د وتلو وخت" },
  "Duration": { ur: "دورانیہ", ar: "المدة", fa: "مدت", ps: "موده" },
  "Present": { ur: "حاضر", ar: "حاضر", fa: "حاضر", ps: "حاضر" },
  "Late": { ur: "تاخیر", ar: "متأخر", fa: "دیرکرد", ps: "ناوخته" },
  "Manage employee leave requests, annual allocations, and approvals.": { ur: "ملازمین کی چھٹی درخواستیں، سالانہ کوٹے اور منظوریوں کو منظم کریں۔", ar: "إدارة طلبات الإجازة والحصص السنوية والموافقات.", fa: "درخواست‌های مرخصی، سهمیه سالانه و تأییدها را مدیریت کنید.", ps: "د رخصتۍ غوښتنې، کلني سهمونه او منظورۍ اداره کړئ." },
  "Apply Leave": { ur: "چھٹی اپلائی کریں", ar: "طلب إجازة", fa: "درخواست مرخصی", ps: "رخصتي وغواړئ" },
  "Leave Type": { ur: "چھٹی کی قسم", ar: "نوع الإجازة", fa: "نوع مرخصی", ps: "د رخصتۍ ډول" },
  "Days": { ur: "دن", ar: "أيام", fa: "روز", ps: "ورځې" },
  "Approved": { ur: "منظور شدہ", ar: "موافق عليه", fa: "تأیید شده", ps: "منظور شوی" },
  "Generate monthly salary slips, calculate allowances, advances, and bank transfers.": { ur: "ماہانہ تنخواہ سلپس، الاؤنسز، ایڈوانسز اور بینک ٹرانسفرز بنائیں۔", ar: "إنشاء قسائم الرواتب الشهرية وحساب البدلات والسلف والتحويلات البنكية.", fa: "فیش حقوق ماهانه، مزایا، پیش‌پرداخت‌ها و انتقال‌های بانکی را تولید کنید.", ps: "میاشتني معاش slips، الاونسونه، مخکې ورکړې او بانکي لېږدونه جوړ کړئ." },
  "Generate Monthly Payroll": { ur: "ماہانہ پے رول بنائیں", ar: "إنشاء الرواتب الشهرية", fa: "تولید حقوق ماهانه", ps: "میاشتنی معاش جوړ کړئ" },
  "Current Payroll Month": { ur: "موجودہ پے رول مہینہ", ar: "شهر الرواتب الحالي", fa: "ماه حقوق فعلی", ps: "اوسنی د معاش میاشت" },
  "Total Disbursed": { ur: "کل ادا شدہ", ar: "إجمالي المدفوع", fa: "کل پرداخت‌شده", ps: "ټول ورکړل شوي" },
  "Register corporate laptops, vehicles, and equipment assigned to staff.": { ur: "عملے کو تفویض لیپ ٹاپ، گاڑیاں اور سامان رجسٹر کریں۔", ar: "تسجيل الحواسيب والمركبات والمعدات المسندة للموظفين.", fa: "لپ‌تاپ‌ها، خودروها و تجهیزات اختصاص‌یافته به کارکنان را ثبت کنید.", ps: "کارمندانو ته ورکړل شوي لپټاپونه، موټرونه او وسایل ثبت کړئ." },
  "Assign Asset": { ur: "اثاثہ تفویض کریں", ar: "تعيين أصل", fa: "اختصاص دارایی", ps: "شتمني وټاکئ" },
  "Asset Tag": { ur: "اثاثہ ٹیگ", ar: "وسم الأصل", fa: "برچسب دارایی", ps: "د شتمنۍ ټګ" },
  "Item Description": { ur: "آئٹم تفصیل", ar: "وصف العنصر", fa: "شرح مورد", ps: "د توکي تفصیل" },
  "Assigned To": { ur: "تفویض کردہ", ar: "مسند إلى", fa: "اختصاص‌یافته به", ps: "ورکړل شوی" },
  "Serial No": { ur: "سیریل نمبر", ar: "الرقم التسلسلي", fa: "شماره سریال", ps: "سریال نمبر" },
  "Employee passports, visas, CNIC copies, labor contracts, and legal documentation repository.": { ur: "ملازمین کے پاسپورٹ، ویزے، شناختی نقول، معاہدے اور قانونی دستاویزات۔", ar: "مستودع جوازات الموظفين والتأشيرات والوثائق القانونية.", fa: "مخزن گذرنامه، ویزا، مدارک هویتی، قراردادها و اسناد قانونی کارکنان.", ps: "د کارمندانو پاسپورټونه، ویزې، پېژند اسناد، قراردادونه او قانوني اسناد." },
  "Upload Document": { ur: "دستاویز اپ لوڈ کریں", ar: "رفع مستند", fa: "بارگذاری سند", ps: "سند پورته کړئ" },
  "Uploaded on": { ur: "اپ لوڈ تاریخ", ar: "تم الرفع في", fa: "بارگذاری شده در", ps: "پورته شوی په" },
  "Official Identity Card": { ur: "سرکاری شناختی کارڈ", ar: "بطاقة هوية رسمية", fa: "کارت شناسایی رسمی", ps: "رسمي پېژند کارت" },
  "Verified": { ur: "تصدیق شدہ", ar: "موثق", fa: "تأیید شده", ps: "تصدیق شوی" },
  "Comprehensive employee audit trail, master summary, and distribution center.": { ur: "ملازمین کا جامع آڈٹ ٹریل، ماسٹر خلاصہ اور تقسیم مرکز۔", ar: "مسار تدقيق شامل للموظفين وملخص رئيسي ومركز توزيع.", fa: "ردیابی جامع کارکنان، خلاصه اصلی و مرکز توزیع.", ps: "د کارمندانو بشپړ پلټنیز مسیر، عمومي لنډیز او وېش مرکز." },
  "Report Audit Summary": { ur: "رپورٹ آڈٹ خلاصہ", ar: "ملخص تدقيق التقرير", fa: "خلاصه حسابرسی گزارش", ps: "د راپور پلټنې لنډیز" },
  "Employee Master Report compiles all active staff records, GL ledger balances, salary deductions, and attendance rates across Pakistan, UAE, Afghanistan, and Iran branches.": { ur: "ایمپلائی ماسٹر رپورٹ پاکستان، یو اے ای، افغانستان اور ایران برانچز کے تمام فعال عملے، جی ایل بیلنس، تنخواہ کٹوتیوں اور حاضری شرح کو یکجا کرتی ہے۔", ar: "يجمع تقرير الموظفين الرئيسي سجلات الموظفين النشطين وأرصدة دفتر الأستاذ والخصومات ومعدلات الحضور عبر الفروع.", fa: "گزارش اصلی کارکنان سوابق فعال، مانده‌های دفتر کل، کسورات حقوق و نرخ حضور را در شعب گردآوری می‌کند.", ps: "د کارمندانو اصلي راپور فعال ریکارډونه، لیجر بیلانسونه، د معاش کمښتونه او د حاضري کچه راټولوي." },
  "Generate and print corporate A4 & CR80 employee identity verification cards.": { ur: "کارپوریٹ A4 اور CR80 ملازم شناختی تصدیقی کارڈ بنائیں اور پرنٹ کریں۔", ar: "إنشاء وطباعة بطاقات تحقق هوية الموظفين A4 وCR80 المؤسسية.", fa: "کارت‌های تأیید هویت کارکنان A4 وCR80 سازمانی را تولید و چاپ کنید.", ps: "د کارمندانو د پېژند تصدیق A4 او CR80 کارډونه جوړ او چاپ کړئ." },
  "Staff Member": { ur: "عملے کا رکن", ar: "عضو فريق", fa: "عضو کارکنان", ps: "د کارمندانو غړی" },
  "General": { ur: "جنرل", ar: "عام", fa: "عمومی", ps: "عمومي" },
  "General Office Master Audit": { ur: "جنرل آفس ماسٹر آڈٹ", ar: "تدقيق المكتب العام الرئيسي", fa: "حسابرسی اصلی دفتر عمومی", ps: "د عمومي دفتر اصلي پلټنه" },
  "Pakistan & UAE": { ur: "پاکستان اور متحدہ عرب امارات", ar: "باكستان والإمارات", fa: "پاکستان و امارات متحده عربی", ps: "پاکستان او متحده عربي امارات" },
  "Global Branches": { ur: "عالمی برانچز", ar: "الفروع العالمية", fa: "شعب جهانی", ps: "نړیوالې څانګې" },
  "Executive Manager": { ur: "ایگزیکٹو مینیجر", ar: "مدير تنفيذي", fa: "مدیر اجرایی", ps: "اجرایوي مدیر" },
  "Full Access": { ur: "مکمل رسائی", ar: "وصول كامل", fa: "دسترسی کامل", ps: "بشپړ لاسرسی" },
  "Printed Employee Master": { ur: "ملازم ماسٹر پرنٹ کیا", ar: "تمت طباعة سجل الموظفين الرئيسي", fa: "گزارش اصلی کارکنان چاپ شد", ps: "د کارمندانو اصلي راپور چاپ شو" },
  "No documents uploaded — the document management module requires a dedicated documents table.": { ur: "کوئی دستاویز اپ لوڈ نہیں ہوئی — دستاویزات ماڈیول کے لیے علیحدہ ٹیبل درکار ہے۔", ar: "لا توجد مستندات — يتطلب نظام المستندات جدول بيانات مخصص.", fa: "هیچ سندی بارگذاری نشده — ماژول مدیریت اسناد به جدول اختصاصی نیاز دارد.", ps: "هیڅ سند پورته نه دی شوی — د اسنادو ماډل لپاره جلا جدول ته اړتیا ده." },
  "No departments yet — departments appear here from registered employees.": { ur: "ابھی کوئی شعبہ نہیں — شعبے رجسٹرڈ ملازمین سے یہاں نظر آئیں گے۔", ar: "لا أقسام بعد — تظهر الأقسام من الموظفين المسجلين.", fa: "هنوز دپارتمانی نیست — دپارتمان‌ها از کارکنان ثبت‌شده ظاهر می‌شوند.", ps: "تر اوسه هیڅ څانګه نشته — څانګې له ثبت شویو کارمندانو څخه ښکاره کیږي." },
  "No designations yet — they appear here from registered employees.": { ur: "ابھی کوئی عہدہ نہیں — یہ رجسٹرڈ ملازمین سے ظاہر ہوں گے۔", ar: "لا مسميات بعد — تظهر من الموظفين المسجلين.", fa: "هنوز عنوانی نیست — از کارکنان ثبت‌شده ظاهر می‌شوند.", ps: "تر اوسه هیڅ دنده نشته — له ثبت شویو کارمندانو څخه ښکاره کیږي." },
  "No attendance records — the attendance module requires a dedicated attendance table.": { ur: "حاضری کا کوئی ریکارڈ نہیں — حاضری ماڈیول کے لیے علیحدہ ٹیبل درکار ہے۔", ar: "لا سجلات حضور — يتطلب نظام الحضور جدولاً مخصصاً.", fa: "هیچ رکورد حضوری نیست — ماژول حضور به جدول اختصاصی نیاز دارد.", ps: "د حاضرۍ هیڅ ریکارډ نشته — د حاضرۍ ماډل لپاره جلا جدول ته اړتیا ده." },
  "No leave requests — the leave module requires a dedicated leave table.": { ur: "چھٹی کی کوئی درخواست نہیں — چھٹی ماڈیول کے لیے علیحدہ ٹیبل درکار ہے۔", ar: "لا طلبات إجازة — يتطلب نظام الإجازات جدولاً مخصصاً.", fa: "هیچ درخواست مرخصی نیست — ماژول مرخصی به جدول اختصاصی نیاز دارد.", ps: "د رخصتۍ هیڅ غوښتنه نشته — د رخصتۍ ماډل لپاره جلا جدول ته اړتیا ده." },
  "No office assets — the assets module requires a dedicated assets table.": { ur: "کوئی دفتری اثاثہ نہیں — اثاثہ ماڈیول کے لیے علیحدہ ٹیبل درکار ہے۔", ar: "لا أصول مكتبية — يتطلب نظام الأصول جدولاً مخصصاً.", fa: "هیچ دارایی اداری نیست — ماژول دارایی به جدول اختصاصی نیاز دارد.", ps: "هیڅ دفتري شتمنی نشته — د شتمنیو ماډل لپاره جلا جدول ته اړتیا ده." },
  "NASEEBULLAH": { ur: "نصیب اللہ", ar: "نصيب الله", fa: "نصیب‌الله", ps: "نصیب الله" },
  "Naseebullah": { ur: "نصیب اللہ", ar: "نصيب الله", fa: "نصیب‌الله", ps: "نصیب الله" },
  "naseebullah": { ur: "نصیب اللہ", ar: "نصيب الله", fa: "نصیب‌الله", ps: "نصیب الله" },
  "Naseeb Ullah": { ur: "نصیب اللہ", ar: "نصيب الله", fa: "نصیب‌الله", ps: "نصیب الله" },
  "naseeb ullah": { ur: "نصیب اللہ", ar: "نصيب الله", fa: "نصیب‌الله", ps: "نصیب الله" },
  "ناسیب وہللاہ": { ur: "نصیب اللہ", ar: "نصيب الله", fa: "نصیب‌الله", ps: "نصیب الله" },
  "ناسیب": { ur: "نصیب اللہ", ar: "نصيب الله", fa: "نصیب‌الله", ps: "نصیب الله" },
  "Muhammad Anees": { ur: "محمد انیس", ar: "محمد أنيس", fa: "محمد انیس", ps: "محمد انیس" },
  "muhammad anees": { ur: "محمد انیس", ar: "محمد أنيس", fa: "محمد انیس", ps: "محمد انیس" },
  "Muhammad anees": { ur: "محمد انیس", ar: "محمد أنيس", fa: "محمد انیس", ps: "محمد انیس" },
  "ASMATULLAH ABDULLAH": { ur: "عصمت اللہ عبداللہ", ar: "عصمت الله عبد الله", fa: "عصمت‌الله عبدالله", ps: "عصمت الله عبدالله" },
  "Asmatullah Abdullah": { ur: "عصمت اللہ عبداللہ", ar: "عصمت الله عبد الله", fa: "عصمت‌الله عبدالله", ps: "عصمت الله عبدالله" },
  "asmatullah abdullah": { ur: "عصمت اللہ عبداللہ", ar: "عصمت الله عبد الله", fa: "عصمت‌الله عبدالله", ps: "عصمت الله عبدالله" },
  "Country Director / Managing Partner": { ur: "کنٹری ڈائریکٹر / مینجنگ پارٹنر", ar: "المدير الإقليمي / شريك إداري", fa: "مدیر کشوری / شریک مدیر", ps: "د هیواد مدیر / ملګری مدیر" },
  "Executive Management": { ur: "ایگزیکٹو مینجمنٹ", ar: "الإدارة التنفيذية", fa: "مدیریت اجرایی", ps: "اجرایوي اداره" },
  "Senior Office Associate": { ur: "سینئر آفس ایسوسی ایٹ", ar: "أخصائي مكتب أول", fa: "کارشناس ارشد دفتر", ps: "لوړپوړی دفتري همکار" },
  "General Administration": { ur: "جنرل ایڈمنسٹریشن", ar: "الإدارة العامة", fa: "امور اداری عمومی", ps: "عمومي اداره" },
  "Manager / General Operations": { ur: "منیجر / جنرل آپریشنز", ar: "مدير / العمليات العامة", fa: "مدیر / عملیات عمومی", ps: "مدیر / عمومي عملیات" },
  "General Operations": { ur: "جنرل آپریشنز", ar: "العمليات العامة", fa: "عملیات عمومی", ps: "عمومي عملیات" },
  "Country Owner": { ur: "کنٹری اونر / سربراہ", ar: "مالك الدولة / رئيس", fa: "مالک کشور / رئیس", ps: "د هیواد مالک / مشر" },
  "Branch Owner": { ur: "برانچ اونر / پارٹنر", ar: "مالك الفرع / شريك", fa: "مالک شعبه / شریک", ps: "د څانګې مالک / ملګری" },
  "Company Owner": { ur: "کمپنی اونر", ar: "مالك الشركة", fa: "مالک شرکت", ps: "د شرکت مالک" },
  "Manager": { ur: "منیجر", ar: "مدير", fa: "مدیر", ps: "مدیر" },
  "Normal Staff": { ur: "عام عملہ", ar: "موظفون عاديون", fa: "کارکنان عادی", ps: "عادي کارمندان" },
  "Employee": { ur: "ملازم", ar: "موظف", fa: "کارمند", ps: "کارمند" },
  "Others": { ur: "دیگر", ar: "أخرى", fa: "سایر", ps: "نور" },
  "Active": { ur: "فعال", ar: "نشط", fa: "فعال", ps: "فعال" },
  "Inactive": { ur: "غیر فعال", ar: "غير نشط", fa: "غیرفعال", ps: "غیر فعال" },
  "On Leave": { ur: "رخصت پر", ar: "في إجازة", fa: "در مرخصی", ps: "په رخصتۍ" },
  "Suspended": { ur: "معطل", ar: "موقوف", fa: "معلق", ps: "معطل" },
  "Country": { ur: "ملک", ar: "الدولة", fa: "کشور", ps: "هیواد" },
  "Status": { ur: "حیثیت / اسٹیٹس", ar: "الحالة", fa: "وضعیت", ps: "حالت" },
  "Total Employees": { ur: "کل ملازمین", ar: "إجمالي الموظفين", fa: "کل پرسنل", ps: "ټول کارمندان" },
  "Active Staff": { ur: "فعال عملہ", ar: "الموظفون النشطون", fa: "پرسنل فعال", ps: "فعال کارمندان" },
  "Departments": { ur: "شعبہ جات", ar: "الأقسام", fa: "دپارتمان‌ها", ps: "څانګې" },
  "Monthly Payroll": { ur: "ماہانہ پے رول", ar: "الرواتب الشهرية", fa: "حقوق ماهانه", ps: "میاشتنی معاش" },
  "Pending Leaves": { ur: "زیر التواء چھٹیاں", ar: "الإجازات المعلقة", fa: "مرخصی‌های در انتظار", ps: "پاتې رخصتۍ" },
  "Assets Tracked": { ur: "اثاثہ جات", ar: "الأصول المسجلة", fa: "اموال اداری", ps: "دفتري شتمنۍ" },
  "Total Branches": { ur: "کل برانچز", ar: "إجمالي الفروع", fa: "کل شعب", ps: "ټولې څانګې" },
  "Active Branches": { ur: "فعال برانچز", ar: "الفروع النشطة", fa: "شعب فعال", ps: "فعالې څانګې" },
  "Today Report": { ur: "آج کی رپورٹ", ar: "تقرير اليوم", fa: "گزارش امروز", ps: "د نن ورځې راپور" },
  "Attendance Summary": { ur: "حاضری کا خلاصہ", ar: "ملخص الحضور", fa: "خلاصه حضور", ps: "د حاضرۍ لنډیز" },
  "Assets Summary": { ur: "اثاثہ جات کا خلاصہ", ar: "ملخص الأصول", fa: "خلاصه اموال", ps: "د شتمنیو لنډیز" },
  "BRANCHES": { ur: "برانچز", ar: "الفروع", fa: "شعب", ps: "څانګې" },
  "QUICK REPORTS": { ur: "فوری رپورٹس", ar: "تقارير سريعة", fa: "گزارش‌های سریع", ps: "چټک راپورونه" },
  "EMPLOYEES LIST": { ur: "ملازمین و مالکان کی فہرست", ar: "قائمة الموظفين والمالكين", fa: "لیست پرسنل و مالکان", ps: "د کارمندانو او مالکانو لست" },
  "Today": { ur: "آج", ar: "اليوم", fa: "امروز", ps: "نن" },
  "Yesterday": { ur: "گزشتہ کل", ar: "أمس", fa: "دیروز", ps: "پرون" },
  "This Month": { ur: "موجودہ ماہ", ar: "هذا الشهر", fa: "این ماه", ps: "روانه میاشت" },
  "All Records": { ur: "تمام ریکارڈز", ar: "كل السجلات", fa: "همه رکوردها", ps: "ټول ریکارډونه" },
  "All Categories": { ur: "تمام زمرہ جات", ar: "جميع الفئات", fa: "همه دسته‌ها", ps: "ټولې کټګورۍ" },
  "All Statuses": { ur: "تمام اسٹیٹس", ar: "جميع الحالات", fa: "همه وضعیت‌ها", ps: "ټول حالتونه" },
  "Country Owner / Head": { ur: "کنٹری اونر / ہیڈ", ar: "مالك الدولة / رئيس", fa: "مالک کشوری / رئیس", ps: "د هیواد مالک / مشر" },
  "Branch Owner / Partner": { ur: "برانچ اونر / پارٹنر", ar: "مالك الفرع / شريك", fa: "مالک شعبه / شریک", ps: "د څانګې مالک / ملګری" },
  "Branch Owner / Manager": { ur: "برانچ اونر / منیجر", ar: "مالك الفرع / مدير", fa: "مالک شعبه / مدیر", ps: "د څانګې مالک / مدیر" },
  "View": { ur: "دیکھیں", ar: "عرض", fa: "مشاهده", ps: "کتل" },
  "Meet": { ur: "میٹ / میٹنگ", ar: "اجتماع", fa: "جلسه", ps: "غونډه" }
};

const URDU_TO_ENGLISH: Record<string, string> = {
  "برانچ مینجنگ ڈائریکٹر": "Branch Managing Director",
  "برانچ ایڈمنسٹریشن": "Branch Administration",
  "کنٹری ڈائریکٹر / مینجنگ پارٹنر": "Country Director / Managing Partner",
  "ایگزیکٹو مینجمنٹ": "Executive Management",
  "چیف ایگزیکٹو آفیسر / اونر": "Chief Executive Officer / Owner",
  "ایگزیکٹو بورڈ": "Executive Board",
  "جنرل آپریشنز منیجر": "General Operations Manager",
  "آپریشنز و مینجمنٹ": "Operations & Management",
  "سینئر آفس ایسوسی ایٹ": "Senior Office Associate",
  "جنرل ایڈمنسٹریشن": "General Administration",
  "ایگزیکٹو اسٹاف آفیسر": "Executive Staff Officer",
  "جنرل آپریشنز": "General Operations",
  "جنرل اسٹاف آفیسر": "General Staff Officer",
  "آپریشنز": "Operations",
  "برانچ اونر / پارٹنر": "Branch Owner / Partner",
  "برانچ اونر / منیجر": "Branch Owner / Manager",
  "کنٹری اونر / سربراہ": "Country Owner / Head",
  "کمپنی اونر": "Company Owner",
  "منیجر": "Manager",
  "ملازم": "Employee",
  "عام عملہ": "Normal Staff",
  "دیگر": "Others",
  "فعال": "Active",
  "غیر فعال": "Inactive",
  "نصیب اللہ": "NASEEB ULLAH",
  "نقیب اللہ خان": "Nqeeb Allah Khan",
  "نقیب اللہ": "Nqeeb Allah Khan",
  "محمد انیس": "Muhammad Anees",
  "عصمت اللہ عبداللہ": "ASMATULLAH ABDULLAH"
};

function translateGeneralOffice(label: string, lang: SupportedLanguage) {
  if (!label) return "";
  const trimmed = label.trim();

  // If active language is English, ensure non-English text is translated to English
  if (lang === "en") {
    if (URDU_TO_ENGLISH[trimmed]) return URDU_TO_ENGLISH[trimmed];
    if (trimmed.includes("/")) {
      return trimmed
        .split("/")
        .map((part) => URDU_TO_ENGLISH[part.trim()] || translateHeader("en", part.trim()))
        .join(" / ");
    }
    for (const [enKey, translations] of Object.entries(generalOfficeLabels)) {
      if (
        translations.ur === trimmed ||
        translations.ar === trimmed ||
        translations.fa === trimmed ||
        translations.ps === trimmed
      ) {
        return enKey;
      }
    }
    return trimmed;
  }
  
  // Exact match in dictionary
  if (generalOfficeLabels[trimmed]?.[lang]) return generalOfficeLabels[trimmed][lang];

  // Handle slash-separated designations/departments
  if (trimmed.includes("/")) {
    return trimmed
      .split("/")
      .map((part) => translateGeneralOffice(part.trim(), lang))
      .join(" / ");
  }
  
  // Case-insensitive match
  const upper = trimmed.toUpperCase();
  if (generalOfficeLabels[upper]?.[lang]) return generalOfficeLabels[upper][lang];
  const lower = trimmed.toLowerCase();
  if (generalOfficeLabels[lower]?.[lang]) return generalOfficeLabels[lower][lang];

  // Specific canonical Name resolution
  if (lower.includes("naseeb") || trimmed.includes("ناسیب") || trimmed.includes("نسیب")) {
    if (lang === "ur") return "نصیب اللہ";
    if (lang === "ar") return "نصيب الله";
    if (lang === "fa") return "نصیب‌الله";
    if (lang === "ps") return "نصیب الله";
  }

  if (lower.includes("nqeeb") || lower.includes("naqeeb") || trimmed.includes("نقیب")) {
    if (lang === "ur") return "نقیب اللہ خان";
    if (lang === "ar") return "نقيب الله خان";
    if (lang === "fa") return "نقیب‌الله خان";
    if (lang === "ps") return "نقیب الله خان";
  }

  if (lower.includes("asmat") || trimmed.includes("عصمت")) {
    if (lang === "ur") return "عصمت اللہ عبداللہ";
    if (lang === "ar") return "عصمت الله عبد الله";
    if (lang === "fa") return "عصمت‌الله عبدالله";
    if (lang === "ps") return "عصمت الله عبدالله";
  }

  if (/[a-zA-Z]/.test(trimmed)) {
    const transliterated = transliterateProperNoun(trimmed, lang);
    if (transliterated && transliterated !== trimmed) return transliterated;
  }

  return translateHeader(lang, trimmed);
}
type TabKey =
  | "master-setup"
  | "management"
  | "departments"
  | "designations"
  | "attendance"
  | "leave"
  | "payroll"
  | "assets"
  | "documents"
  | "id-cards"
  | "reports";

export function GeneralOfficeDashboardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) || "management";

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    const nextTab = searchParams.get("tab") as TabKey | null;
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const lang = useActiveLanguage();
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";
  const baseDict = (dict[lang as keyof typeof dict] ?? dict.en) as typeof dict.en;
  const t = useMemo(() => new Proxy(baseDict, {
    get(target, prop: string) {
      const fallback = dict.en[prop as DictKey] || prop;
      const direct = target[prop as DictKey];
      if (lang === "en") return direct || fallback;
      return direct && direct !== fallback ? direct : translateGeneralOffice(fallback, lang);
    }
  }) as typeof dict.en, [baseDict, lang]);
  const tr = useCallback((label: string) => translateGeneralOffice(label, lang), [lang]);

  // Employees State
  const [employees, setEmployees] = useState<any[]>([]);
  // Date-wise employee activity (Priority 3). Defaults to all records; filters the table + drives the
  // daily-count cards off the real created_at/updated_at timestamps.
  const [dateRange, setDateRange] = useState<DateRange>({ mode: "all" });
  const employeesByDate = useMemo(
    () => employees.filter((e) => dateRange.mode === "all" || inRange(e.created_at, dateRange) || inRange(e.updated_at, dateRange)),
    [employees, dateRange]
  );
  const dailyCounts = useMemo(() => {
    const isActive = (e: any) => String(e.status ?? "").toLowerCase() === "active";
    return {
      newC: employees.filter((e) => inRange(e.created_at, dateRange)).length,
      updC: employees.filter((e) => inRange(e.updated_at, dateRange) && !inRange(e.created_at, dateRange)).length,
      activeC: employeesByDate.filter(isActive).length,
      inactiveC: employeesByDate.filter((e) => !isActive(e)).length
    };
  }, [employees, dateRange, employeesByDate]);
  // Employee options for the Attendance/Leave/Assets modules (real employees).
  const employeeOpts = useMemo(() => employees.map((e) => ({
    id: e.id,
    employee_code: e.employee_code,
    name: personFullName(e.person || {}) || e.employee_code,
    country_id: e.country_id ?? null,
    city_branch_id: e.city_branch_id ?? null
  })), [employees]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Session context — fetched once from /api/erp/auth/session to populate summary cards with
  // real user/country/branch data instead of hardcoded placeholders.
  const [sessionCtx, setSessionCtx] = useState<{
    userName: string; userEmail: string; userId: string;
    countryName: string; branchName: string; isSuperAdmin: boolean;
    roles: string[];
  } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((json: any) => {
        if (!active || !json?.user) return;
        setSessionCtx({
          userName: json.user.fullName || json.user.email || "User",
          userEmail: json.user.email || "",
          userId: json.user.id || "",
          countryName: json.scopes?.summary?.countryName || "",
          branchName: json.scopes?.summary?.branchDisplayName || "",
          isSuperAdmin: !!json.scopes?.isSuperAdmin,
          roles: json.roles || []
        });
      })
      .catch(console.error);
    return () => { active = false; };
  }, []);

  // Real computed summary values from employee data
  const summaryStats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => String(e.status ?? "").toLowerCase() === "active").length;
    // Group payroll by currency
    const payrollByCurrency = new Map<string, number>();
    employees.forEach((e) => {
      const cur = e.salary_currency || "USD";
      payrollByCurrency.set(cur, (payrollByCurrency.get(cur) || 0) + (Number(e.net_salary) || 0));
    });
    const payrollLabel = [...payrollByCurrency.entries()]
      .filter(([, v]) => v > 0)
      .map(([cur, v]) => `${cur} ${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toLocaleString()}`)
      .join(" / ") || "—";
    // Unique departments and unique branches
    const deptSet = new Set(employees.map((e) => e.department).filter(Boolean));
    const branchSet = new Set(
      employees.map((e) => e.country_branch?.name || e.city_branch?.name).filter(Boolean)
    );
    return { total, active, payrollLabel, departments: deptSet.size, branches: branchSet.size };
  }, [employees]);

  // Modals State
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeForLoan, setSelectedEmployeeForLoan] = useState<any | null>(null);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<any | null>(null);

  // Automatically trigger form modal if navigated directly to master-setup
  useEffect(() => {
    if (initialTab === "master-setup") {
      setShowFormModal(true);
    }
  }, [initialTab]);

  // Fetch employees from API
  // Root-cause fix for the intermittent empty list: `lang` is corrected en→active right after
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadEmployees = useCallback(async () => {
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    setLoading(true);
    setLoadError(null);
    const timeoutId = setTimeout(() => {
      if (!ac.signal.aborted) {
        ac.abort();
        setLoadError("Loading timed out (10s limit). Please check your connection and retry.");
      }
    }, 10000);
    try {
      const qp = new URLSearchParams();
      if (search) qp.set("search", search);
      if (categoryFilter) qp.set("category", categoryFilter);
      if (statusFilter) qp.set("status", statusFilter);
      qp.set("lang", lang);
      const res = await fetch(`/api/erp/hr-payroll/employees?${qp.toString()}`, { signal: ac.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (!ac.signal.aborted) {
          setEmployees(Array.isArray(json.employees) ? json.employees : []);
          setLoadError(null);
        }
      } else {
        if (!ac.signal.aborted) {
          setLoadError(`Failed to load employee records (HTTP ${res.status}). Please retry.`);
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setLoadError(err.message || "Network error loading employee records.");
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, lang]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  // Sample static data for sub-modules
  // Departments & Designations are REAL — aggregated from the actual registered employees'
  // department/designation fields (no fabricated rows).
  const departmentsList = useMemo(() => {
    const map = new Map<string, { count: number; heads: Set<string> }>();
    employees.forEach((e) => {
      const d = String(e.department || "").trim();
      if (!d) return;
      const cur = map.get(d) || { count: 0, heads: new Set<string>() };
      cur.count += 1;
      if (String(e.category) === "Manager") cur.heads.add(personFullName(e.person || {}));
      map.set(d, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count)
      .map(([name, v], i) => ({ id: String(i), name, code: name.slice(0, 3).toUpperCase(), head: [...v.heads][0] || "-", employees: v.count }));
  }, [employees]);

  const designationsList = useMemo(() => {
    const map = new Map<string, { count: number; depts: Set<string>; salaries: number[]; currency: string }>();
    employees.forEach((e) => {
      const title = String(e.designation || "").trim();
      if (!title) return;
      const cur = map.get(title) || { count: 0, depts: new Set<string>(), salaries: [] as number[], currency: e.salary_currency || "" };
      cur.count += 1;
      if (e.department) cur.depts.add(e.department);
      if (Number(e.net_salary)) cur.salaries.push(Number(e.net_salary));
      if (!cur.currency && e.salary_currency) cur.currency = e.salary_currency;
      map.set(title, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count)
      .map(([title, v], i) => ({
        id: String(i), title, dept: [...v.depts][0] || "-", count: v.count,
        minSalary: v.salaries.length ? `${Math.min(...v.salaries).toLocaleString()} ${v.currency}` : "-"
      }));
  }, [employees]);

  // The following HR sub-systems have no backing tables in the schema yet — show honest empty
  // states (never fabricated rows). Building each (attendance/leave/assets) is a dedicated module.
  const attendanceList: any[] = [];
  const leaveList: any[] = [];
  const assetList: any[] = [];

  // Printable ID Card handler
  const handlePrintIdCard = (emp: any) => {
    // Real employee data only — no fabricated identity/activity values.
    const name = personFullName(emp.person || {}) || emp.employee_code;
    openUserA4ReportWindow({
      title: `${ct(lang, "nav.employee_id_cards", "Employee ID Card")} — ${name}`,
      subtitle: emp.designation || ct(lang, "hr.f_cat_employee", "Employee"),
      userData: {
        userId: emp.id || "",
        userCode: emp.employee_code || "",
        fullName: name,
        countryName: emp.country?.name || "",
        branchName: emp.city_branch?.name || emp.country_branch?.name || "",
        branchType: emp.city_branch ? "city_branch" : "main_branch",
        role: emp.designation || "",
        registrationDate: emp.joining_date || "",
        status: emp.status || "",
        permissions: emp.department ? [emp.department] : [],
        lastActivity: emp.updated_at || emp.created_at || "",
        lastActivityAction: ct(lang, "nav.employee_id_cards", "Employee ID Card"),
        activityCounts: { logins: 0, transactions: 0, purchases: 0, payments: 0, accounts: 0, edits: 0 }
      }
    });
  };

  return (
    <div className={cn("space-y-6 pb-16 min-h-screen", isRtl && "text-right")} dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Streamlined Compact Top Header & Controls Toolbar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Left: Compact Title & Module Info */}
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 dark:border-purple-900 shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              {t.title}
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                {employees.length} {t.activeStaff}
              </span>
            </h1>
          </div>
        </div>

        {/* Right: Unified Search, Filters & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Integrated Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder || "Search employees, code, name..."}
              className="h-8.5 pl-8.5 pr-2.5 text-xs bg-slate-50/70 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 font-sans"
          >
            <option value="">{tr("All Categories")}</option>
            <option value="Country Owner">{tr("Country Owner / Head")}</option>
            <option value="Branch Owner">{tr("Branch Owner / Manager")}</option>
            <option value="Company Owner">{tr("Company Owner")}</option>
            <option value="Manager">{tr("Manager")}</option>
            <option value="Normal Staff">{tr("Normal Staff")}</option>
            <option value="Employee">{tr("Employee")}</option>
            <option value="Others">{tr("Others")}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 font-sans"
          >
            <option value="">{tr("All Statuses")}</option>
            <option value="Active">{t.active || "Active"}</option>
            <option value="Inactive">{t.inactive || "Inactive"}</option>
            <option value="On Leave">{t.onLeave || "On Leave"}</option>
            <option value="Suspended">{t.suspended || "Suspended"}</option>
          </select>

          {/* Quick Date Presets */}
          <div className="hidden sm:flex items-center gap-1 font-sans">
            <button
              type="button"
              onClick={() => setDateRange({ mode: "all" })}
              className={`h-8.5 rounded-xl border px-2.5 text-xs font-bold transition-colors ${
                dateRange.mode === "all"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              }`}
            >
              {tr("All Records")}
            </button>
            <button
              type="button"
              onClick={() => setDateRange(computeRange("day", iso(new Date())))}
              className={`h-8.5 rounded-xl border px-2.5 text-xs font-bold transition-colors ${
                dateRange.mode === "day" && dateRange.start?.slice(0, 10) === iso(new Date())
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              }`}
            >
              {tr("Today")}
            </button>
            <button
              type="button"
              onClick={() => setDateRange(computeRange("day", addDays(iso(new Date()), -1)))}
              className={`h-8.5 rounded-xl border px-2.5 text-xs font-bold transition-colors ${
                dateRange.mode === "day" && dateRange.start?.slice(0, 10) === addDays(iso(new Date()), -1)
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              }`}
            >
              {tr("Yesterday")}
            </button>
            <button
              type="button"
              onClick={() => setDateRange(computeRange("month", iso(new Date())))}
              className={`h-8.5 rounded-xl border px-2.5 text-xs font-bold transition-colors ${
                dateRange.mode === "month"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              }`}
            >
              {tr("This Month")}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 font-sans">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/settings/customers" as Route)}
              className="h-8.5 rounded-xl border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs font-bold px-2.5 gap-1 shadow-xs"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {lang === "ur" ? "پرسن / کسٹمر" : lang === "ar" ? "الشخص / العميل" : "Person / Customer"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/settings/company" as Route)}
              className="h-8.5 rounded-xl border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 text-xs font-bold px-2.5 gap-1 shadow-xs"
            >
              <Building2 className="h-3.5 w-3.5" />
              {lang === "ur" ? "کمپنی" : lang === "ar" ? "الشركة" : "Company"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/settings/bank" as Route)}
              className="h-8.5 rounded-xl border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 text-xs font-bold px-2.5 gap-1 shadow-xs"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {lang === "ur" ? "بینک" : lang === "ar" ? "البنك" : "Bank"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-8.5 rounded-xl border-blue-200 bg-blue-700 text-white hover:bg-blue-800 text-xs font-bold px-3 gap-1.5 shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
              {tr("Meet")}
            </Button>

            <Button
              onClick={() => {
                setSelectedEmployeeId(null);
                setShowFormModal(true);
              }}
              className="h-8.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 gap-1.5 shadow-sm"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t.registerBtn}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 5 KPI SUMMARY CARDS GRID matching Reference Image 2 ── */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: BRANCH & USER DETAILS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">1. {tr("BRANCH & USER DETAILS")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{tr("Country")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{sessionCtx?.countryName || "Pakistan / UAE"}</span>
            </div>
            <div className="flex justify-between">
              <span>{tr("Branch Name")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">{sessionCtx?.branchName || "KARACHI MAIN"}</span>
            </div>
            <div className="flex justify-between">
              <span>{tr("User ID / Name")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">{sessionCtx?.userName || "Admin User"}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>{tr("Status")}:</span>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {tr("Active Session")}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: EMPLOYEES SUMMARY */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ClipboardList className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">2. {tr("EMPLOYEES SUMMARY")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t.totalEmployees}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{summaryStats.total}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{t.activeStaff}:</span>
              <span>{summaryStats.active}</span>
            </div>
            <div className="flex justify-between text-blue-600 font-bold">
              <span>{tr("Departments")}:</span>
              <span>{summaryStats.departments}</span>
            </div>
          </div>
        </div>

        {/* Card 3: PAYROLL & ASSETS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Banknote className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">3. {tr("PAYROLL & ASSETS")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t.monthlyPayroll}:</span>
              <span className="font-bold font-mono text-slate-900 dark:text-slate-100 pl-1">{summaryStats.payrollLabel}</span>
            </div>
            <div className="flex justify-between text-amber-600 font-bold">
              <span>{t.pendingLeaves}:</span>
              <span>0</span>
            </div>
            <div className="flex justify-between text-indigo-600 font-bold">
              <span>{t.assetsTracked}:</span>
              <span>0</span>
            </div>
          </div>
        </div>

        {/* Card 4: BRANCHES */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">4. {tr("BRANCHES")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{tr("Total Branches")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{summaryStats.branches || "—"}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{tr("Active Branches")}:</span>
              <span>{summaryStats.branches || "—"}</span>
            </div>
          </div>
        </div>

        {/* Card 5: QUICK REPORTS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <FileText className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">5. {tr("QUICK REPORTS")}</span>
          </div>
          <div className="mt-2 space-y-1 text-[10px] font-semibold">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 font-sans">
              <span>{tr("Today Report")}</span>
              <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5 font-bold">📈 {tr("View")}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 font-sans">
              <span>{tr("Monthly Payroll")}</span>
              <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5 font-bold">📈 {tr("View")}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 font-sans">
              <span>{tr("Attendance Summary")}</span>
              <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5 font-bold">📈 {tr("View")}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 font-sans">
              <span>{tr("Assets Summary")}</span>
              <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5 font-bold">📈 {tr("View")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE ── */}
      <div className="space-y-6">
        {/* TAB 1 & 2: EMPLOYEE MASTER SETUP & MANAGEMENT TABLE DIRECTORY */}
        {(activeTab === "master-setup" || activeTab === "management") && (
          <div className="space-y-4">


      {/* ── EMPLOYEES LIST TABLE CARD matching Reference Image 2 ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 font-sans">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase">{tr("EMPLOYEES LIST")}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/70 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="p-3.5">{t.colEmpCode}</th>
                <th className="p-3.5">{t.colName}</th>
                <th className="p-3.5">{t.colCategory}</th>
                <th className="p-3.5">{t.colDesigDept}</th>
                <th className="p-3.5">{t.colJoining}</th>
                <th className="p-3.5">{t.colNetSalary}</th>
                <th className="p-3.5">{t.colDeductions}</th>
                <th className="p-3.5">{t.colStatus}</th>
                <th className="p-3.5 text-right">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={`skel-${i}`} className="animate-pulse">
                    <td className="p-3.5"><div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                        <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                      </div>
                    </td>
                    <td className="p-3.5"><div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3.5"><div className="h-3 w-28 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3.5"><div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3.5"><div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="p-3.5"><div className="h-3 w-8 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3.5"><div className="h-5 w-14 bg-emerald-100 dark:bg-emerald-950/60 rounded-full" /></td>
                    <td className="p-3.5 text-right"><div className="h-7 w-12 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{loadError}</p>
                      <Button
                        onClick={() => void loadEmployees()}
                        className="mt-2 h-8.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 px-4"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Retry Loading
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : employeesByDate.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No employees found</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your search or filters</p>
                      <Button
                        onClick={() => {
                          setSelectedEmployeeId(null);
                          setShowFormModal(true);
                        }}
                        className="mt-2 h-8.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 px-4"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        {t.registerBtn}
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                employeesByDate.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="p-3.5 font-mono font-bold text-blue-600">{emp.employee_code}</td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100 font-sans">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {tr(personFullName(emp.person || {}) || emp.name)}
                      </div>
                      {(emp.person?.father_name || emp.person?.contact_person) && (
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                          {lang === "ur" ? "ولدیت: " : lang === "ar" ? "اسم الأب: " : "S/O: "}
                          {emp.person?.father_name || emp.person?.contact_person}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-muted-foreground font-sans">{tr(emp.category || "Staff")}</td>
                    <td className="p-3.5">{tr(emp.designation)} / {tr(emp.department)}</td>
                    <td className="p-3.5 font-mono text-muted-foreground">{emp.joining_date || "—"}</td>
                    <td className="p-3.5 font-mono font-bold">{emp.net_salary ? `${Number(emp.net_salary).toLocaleString()} ${emp.salary_currency || "USD"}` : "—"}</td>
                    <td className="p-3.5 font-mono text-muted-foreground">0</td>
                    <td className="p-3.5">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[10px]">
                        {tr(emp.status || "Active")}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                          setShowFormModal(true);
                        }}
                        className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                      >
                        {t.edit}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination */}
        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground font-medium">
          <div>
            Showing {employeesByDate.length ? 1 : 0} to {employeesByDate.length} of {employeesByDate.length} entries
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500">«</button>
              <button type="button" className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500">‹</button>
              <button type="button" className="h-7 w-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center">1</button>
              <button type="button" className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500">›</button>
              <button type="button" className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500">»</button>
            </div>
            <select className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700">
              <option>20 / page</option>
              <option>50 / page</option>
              <option>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Global Bottom Status Footer matching Reference Image 2 */}
      <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div>© 2026 Digital Dock ERP (Pvt) Ltd. All rights reserved.</div>
        <div className="flex items-center gap-4 text-[11px] font-medium">
          <span>v3.2.0</span>
          <span>Pakistan Standard Time (PST)</span>
          <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            System Online
          </span>
        </div>
      </div>

            </div>
          )}

          {/* TAB 3: DEPARTMENTS */}
          {activeTab === "departments" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold">{t.departments}</h2>
                  <p className="text-xs text-muted-foreground">{tr("Manage corporate departments, assigned heads, and employee distribution.")}</p>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                  + {tr("Add Department")}
                </Button>
              </div>

              {departmentsList.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">{tr("No departments yet — departments appear here from registered employees.")}</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {departmentsList.map((dept) => (
                    <div key={dept.id} className="rounded-xl border p-4 hover:border-emerald-500 transition">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm">{dept.name}</div>
                        <Badge variant="outline" className="font-mono text-[10px]">{dept.code}</Badge>
                      </div>
                      <div className="mt-3 text-xs space-y-1 text-muted-foreground">
                        <div><strong className="text-foreground">{tr("Head of Dept")}:</strong> {dept.head}</div>
                        <div><strong className="text-foreground">{tr("Active Employees")}:</strong> {dept.employees} {tr("Members")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DESIGNATIONS */}
          {activeTab === "designations" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold">{t.designations}</h2>
                  <p className="text-xs text-muted-foreground">{tr("Corporate designation grades, titles, and base salary scales.")}</p>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                  + {tr("Add Designation")}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-muted font-bold border-b">
                    <tr>
                      <Th className="px-4 py-3">{tr("Designation Title")}</Th>
                      <Th className="px-4 py-3">{tr("Department")}</Th>
                      <Th className="px-4 py-3">{tr("Active Employees")}</Th>
                      <Th className="px-4 py-3">{tr("Min Base Scale")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {designationsList.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{tr("No designations yet — they appear here from registered employees.")}</td></tr>
                    ) : designationsList.map((desig) => (
                      <tr key={desig.id}>
                        <td className="px-4 py-3 font-bold">{desig.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{desig.dept}</td>
                        <td className="px-4 py-3"><Badge variant="secondary">{desig.count}</Badge></td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600">{desig.minSalary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: ATTENDANCE */}
          {activeTab === "attendance" && (
            <div className="space-y-4">
              <EmployeeDateToolbar lang={lang} value={dateRange} onChange={setDateRange} />
              <OfficeHrModule config={ATTENDANCE_CONFIG} lang={lang} dateRange={dateRange} employees={employeeOpts} canWrite={true} />
            </div>
          )}

          {/* TAB 6: LEAVE MANAGEMENT */}
          {activeTab === "leave" && (
            <div className="space-y-4">
              <EmployeeDateToolbar lang={lang} value={dateRange} onChange={setDateRange} />
              <OfficeHrModule config={LEAVE_CONFIG} lang={lang} dateRange={dateRange} employees={employeeOpts} canWrite={true} />
            </div>
          )}

          {/* TAB 7: PAYROLL / SALARY */}
          {activeTab === "payroll" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold">{t.payroll}</h2>
                  <p className="text-xs text-muted-foreground">{tr("Generate monthly salary slips, calculate allowances, advances, and bank transfers.")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="text-xs">
                    <Download className="h-3.5 w-3.5 mr-1" /> {t.excel}
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                    {tr("Generate Monthly Payroll")}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-4 bg-muted/30">
                <div className="flex items-center justify-between font-bold text-xs">
                  <span>{tr("Current Payroll Month")}: {new Date().toLocaleString("en", { month: "long", year: "numeric" })}</span>
                  <span className="text-emerald-600 font-mono">{tr("Total Disbursed")}: {summaryStats.payrollLabel}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: OFFICE ASSETS */}
          {activeTab === "assets" && (
            <div className="space-y-4">
              <EmployeeDateToolbar lang={lang} value={dateRange} onChange={setDateRange} />
              <OfficeHrModule config={ASSETS_CONFIG} lang={lang} dateRange={dateRange} employees={employeeOpts} canWrite={true} />
            </div>
          )}

          {/* TAB 9: DOCUMENTS */}
          {activeTab === "documents" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold">{t.officeDocuments}</h2>
                  <p className="text-xs text-muted-foreground">{tr("Employee passports, visas, CNIC copies, labor contracts, and legal documentation repository.")}</p>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                  + {tr("Upload Document")}
                </Button>
              </div>

              <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
                {tr("No documents uploaded — the document management module requires a dedicated documents table.")}
              </div>
            </div>
          )}

          {/* TAB 10: EMPLOYEE ID CARDS */}
          {activeTab === "id-cards" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold">{t.idCards}</h2>
                  <p className="text-xs text-muted-foreground">{tr("Generate and print corporate A4 & CR80 employee identity verification cards.")}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {employees.slice(0, 4).map((emp) => (
                  <div key={emp.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div>
                        <div className="font-extrabold text-sm text-blue-600 dark:text-blue-400">ACCOUNTS.DGT.LLC</div>
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">{tr("Official Identity Card").toUpperCase()}</div>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 text-[9px]">
                        {tr("Verified").toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-lg text-white border-2 border-white/20">
                        {emp.person?.customer_name?.slice(0, 2)?.toUpperCase() || "EM"}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">{personFullName(emp.person || {})}</div>
                        <div className="text-xs text-blue-300 font-semibold">{emp.designation ? tr(emp.designation) : tr("Staff Member")}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.employee_code} • {emp.department ? tr(emp.department) : tr("General")}</div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handlePrintIdCard(emp)}
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1.5" /> {t.print}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 11: REPORTS & EXPORT BAR */}
          {activeTab === "reports" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 gap-4">
                <div>
                  <h2 className="text-lg font-bold">{t.reports}</h2>
                  <p className="text-xs text-muted-foreground">{tr("Comprehensive employee audit trail, master summary, and distribution center.")}</p>
                </div>

                {/* 6 REPORT ACTION BUTTONS */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" className="text-xs font-semibold">
                    <Eye className="h-3.5 w-3.5 mr-1 text-blue-600" /> {t.view}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openUserA4ReportWindow({
                      title: t.reports,
                      subtitle: `${summaryStats.total} ${tr("Employees")} • ${summaryStats.active} ${t.activeStaff}`,
                      userData: {
                        userId: sessionCtx?.userId || "",
                        userCode: "GO-MASTER",
                        fullName: sessionCtx?.userName || tr("General Office Master Audit"),
                        countryName: sessionCtx?.countryName || "",
                        branchName: sessionCtx?.branchName || "",
                        branchType: sessionCtx?.isSuperAdmin ? "super_admin" : "main_branch",
                        role: sessionCtx?.roles?.[0] || "",
                        registrationDate: "",
                        status: t.active,
                        permissions: sessionCtx?.roles || [],
                        lastActivity: new Date().toISOString(),
                        lastActivityAction: tr("Printed Employee Master"),
                        activityCounts: { logins: 0, transactions: summaryStats.total, purchases: 0, payments: 0, accounts: summaryStats.departments, edits: 0 }
                      }
                    })}
                    className="text-xs font-semibold"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1 text-slate-700 dark:text-slate-200" /> {t.print}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs font-semibold text-emerald-600">
                    <Download className="h-3.5 w-3.5 mr-1" /> {t.pdf}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs font-semibold text-emerald-700">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> {t.excel}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs font-semibold text-blue-600">
                    <Mail className="h-3.5 w-3.5 mr-1" /> {t.email}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs font-semibold text-emerald-600">
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> {t.whatsapp}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-4 bg-muted/40">
                <div className="font-bold text-xs mb-2">{tr("Report Audit Summary")}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tr("Employee Master Report compiles all active staff records, GL ledger balances, salary deductions, and attendance rates across Pakistan, UAE, Afghanistan, and Iran branches.")}
                </p>
              </div>
            </div>
          )}
        </div>

      {/* Forms Modal */}
      {showFormModal && (
        <SimpleModal
          title={selectedEmployeeId ? t.edit : t.registerBtn}
          onClose={() => setShowFormModal(false)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <EmployeeForm
            lang={lang}
            employeeId={selectedEmployeeId}
            onSave={() => {
              setShowFormModal(false);
              loadEmployees().catch(() => null);
            }}
            onCancel={() => setShowFormModal(false)}
          />
        </SimpleModal>
      )}

      {/* Loan/Advance Modal */}
      {selectedEmployeeForLoan && (
        <SimpleModal
          title={t.loanAdv}
          onClose={() => setSelectedEmployeeForLoan(null)}
          className="max-w-3xl w-[95vw]"
        >
          <AdvanceLoanModal
            employee={selectedEmployeeForLoan}
            onClose={() => setSelectedEmployeeForLoan(null)}
            onSuccess={() => {
              setSelectedEmployeeForLoan(null);
              loadEmployees().catch(() => null);
            }}
          />
        </SimpleModal>
      )}
    </div>
  );
}
