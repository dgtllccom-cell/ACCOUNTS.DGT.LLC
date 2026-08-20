"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users, Building2, ScrollText, Clock, Calendar, Banknote,
  ClipboardList, FileText, Badge as IdBadgeIcon, BarChart3,
  Search, Filter, Plus, Printer, Download, Mail, MessageSquare,
  Eye, Edit3, Trash2, CheckCircle2, AlertCircle, XCircle, ChevronRight,
  ShieldCheck, RefreshCcw, FileSpreadsheet, Send, PhoneCall, Check, UserPlus, MoreVertical
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
    title: "General Office Management",
    subtitle: "Enterprise HR, Payroll, Attendance & Assets Center",
    searchPlaceholder: "Search employees...",
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
  ps: {
    title: "General Office Management",
    subtitle: "Enterprise HR, Payroll, Attendance & Assets",
    searchPlaceholder: "Search...",
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
  fa: {
    title: "General Office Management",
    subtitle: "Enterprise HR, Payroll, Attendance & Assets",
    searchPlaceholder: "Search...",
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
  ar: {
    title: "General Office Management",
    subtitle: "Enterprise HR, Payroll, Attendance & Assets",
    searchPlaceholder: "Search...",
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
  "New Employees": { ur: "نئے ملازمین", ar: "موظفون جدد", fa: "کارکنان جدید", ps: "نوي کارمندان" },
  "Updated Employees": { ur: "اپ ڈیٹ شدہ ملازمین", ar: "موظفون محدثون", fa: "کارکنان به‌روزشده", ps: "تازه شوي کارمندان" },
  "In Selected Range": { ur: "منتخب مدت میں", ar: "في الفترة المحددة", fa: "در بازه انتخابی", ps: "په ټاکلې موده کې" }
};

function translateGeneralOffice(label: string, lang: SupportedLanguage) {
  if (lang === "en") return label;
  return generalOfficeLabels[label]?.[lang] || translateHeader(lang, label);
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
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) || "management";

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // The in-page "Office Modules" panel (that duplicated the real left sidebar) has been
  // removed — module switching is now driven entirely by the sidebar's ?tab= links
  // (lib/navigation/sidebar.ts). Since sidebar navigation stays on this same route and only
  // the query string changes, sync activeTab whenever it changes so those links actually work
  // (useState's initial value only applies on first mount, not on subsequent client-side nav).
  useEffect(() => {
    const nextTab = searchParams.get("tab") as TabKey | null;
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [lang, setLang] = useState<SupportedLanguage>("en");
  const [isRtl, setIsRtl] = useState(false);
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
  // Date-wise employee activity (Priority 3). Defaults to Today; filters the table + drives the
  // daily-count cards off the real created_at/updated_at timestamps.
  const [dateRange, setDateRange] = useState<DateRange>(() => computeRange("day", new Date().toISOString().slice(0, 10)));
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

  // Sync active language. Read localStorage FIRST (the canonical client store) and fall back to
  // the html tag — reading only the html tag raced on load and left this whole page (and the
  // embedded Employee wizard it feeds `lang` to) stuck on English while the store was already ur.
  useEffect(() => {
    function syncLang() {
      if (typeof document === "undefined") return;
      const raw = ((typeof localStorage !== "undefined" && localStorage.getItem("erp_lang")) || document.documentElement.lang || "en").trim();
      const l = (raw.split("-")[0] as SupportedLanguage) || "en";
      const validLang = ["en", "ur", "ps", "fa", "ar"].includes(l) ? (l as SupportedLanguage) : "en";
      setLang(validLang);
      setIsRtl(["ur", "ps", "fa", "ar"].includes(validLang));
    }
    syncLang();
    const observer = new MutationObserver(syncLang);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    window.addEventListener("storage", syncLang);
    window.addEventListener("erp_language_changed", syncLang);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", syncLang);
      window.removeEventListener("erp_language_changed", syncLang);
    };
  }, []);

  // Automatically trigger form modal if navigated directly to master-setup
  useEffect(() => {
    if (initialTab === "master-setup") {
      setShowFormModal(true);
    }
  }, [initialTab]);

  // Fetch employees from API
  // Root-cause fix for the intermittent empty list: `lang` is corrected en→active right after
  // mount, which fires a second load. Previously a request-sequence guard DROPPED the superseded
  // response, so if the newer request was slow/failed on a slow server the table stayed empty even
  // though the API had data. We now abort the superseded request and always apply the LATEST
  // non-aborted response — the UI can never be left empty while the API is returning rows.
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadEmployees = useCallback(async () => {
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (search) qp.set("search", search);
      if (categoryFilter) qp.set("category", categoryFilter);
      if (statusFilter) qp.set("status", statusFilter);
      qp.set("lang", lang);
      const res = await fetch(`/api/erp/hr-payroll/employees?${qp.toString()}`, { signal: ac.signal });
      if (res.ok) {
        const json = await res.json();
        if (!ac.signal.aborted) setEmployees(Array.isArray(json.employees) ? json.employees : []);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) console.error("Error loading employees:", err);
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
      {/* ── Top Header with Controls matching Reference Image 2 ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Left Title & Icon */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 dark:border-purple-900 shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              {t.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Right Filter & Action Controls Cluster */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Country Dropdown */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Country</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All Countries</option>
              <option value="pk">Pakistan</option>
              <option value="uae">United Arab Emirates</option>
              <option value="af">Afghanistan</option>
            </select>
          </div>

          {/* Branch Dropdown */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Stadium / Branch</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All Branches</option>
              <option value="karachi">Karachi Main</option>
              <option value="lahore">Lahore City</option>
              <option value="dubai">Dubai Main Hub</option>
            </select>
          </div>

          {/* Date Picker Button */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Date Range</span>
            <div className="h-8.5 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>{dateRange.from && dateRange.to ? `${dateRange.from} - ${dateRange.to}` : "All Dates (2026)"}</span>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 self-end">
            <button
              type="button"
              onClick={() => setDateRange(computeRange("day", iso(new Date())))}
              className="h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateRange(computeRange("day", addDays(iso(new Date()), -1)))}
              className="h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setDateRange(computeRange("month", iso(new Date())))}
              className="h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              This Month
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 self-end">
            <Button
              type="button"
              variant="outline"
              className="h-8.5 rounded-xl border-blue-200 bg-blue-700 text-white hover:bg-blue-800 text-xs font-bold px-3 gap-1.5 shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
              Meet
            </Button>

            <Button
              onClick={() => {
                setSelectedEmployeeId(null);
                setShowFormModal(true);
              }}
              className="h-8.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 gap-1.5 shadow-sm"
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
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Today Report</span>
              <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5">📈 View</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Monthly Payroll</span>
              <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5">📈 View</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Attendance Summary</span>
              <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5">📈 View</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Assets Summary</span>
              <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5">📈 View</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE ── */}
      <div className="space-y-6">
        {/* TAB 1 & 2: EMPLOYEE MASTER SETUP & MANAGEMENT TABLE DIRECTORY */}
        {(activeTab === "master-setup" || activeTab === "management") && (
          <div className="space-y-4">
            {/* ── Search, Categories, Statuses & More Filters Toolbar matching Reference Image 2 ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="h-9.5 pl-10 text-xs bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="">{t.allCategories}</option>
            <option value="Manager">{tr("Manager")}</option>
            <option value="Normal Staff">{tr("Normal Staff")}</option>
            <option value="Employee">{tr("Employee")}</option>
            <option value="Others">{tr("Others")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="">{t.allStatuses}</option>
            <option value="Active">{t.active}</option>
            <option value="Inactive">{t.inactive}</option>
            <option value="On Leave">{t.onLeave}</option>
            <option value="Suspended">{t.suspended}</option>
          </select>

          <Button
            type="button"
            variant="outline"
            className="h-9.5 rounded-xl border-slate-200 text-xs font-semibold px-3 gap-1.5 text-slate-700 dark:border-slate-800 dark:text-slate-300"
          >
            <Filter className="h-3.5 w-3.5" />
            More Filters
          </Button>

          <button
            type="button"
            className="h-9.5 w-9.5 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── EMPLOYEES LIST TABLE CARD matching Reference Image 2 ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase">EMPLOYEES LIST</span>
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
              {employeesByDate.length === 0 ? (
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
                    <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">{personFullName(emp.person || {}) || emp.name}</td>
                    <td className="p-3.5 text-muted-foreground">{emp.category || "Staff"}</td>
                    <td className="p-3.5">{emp.designation} / {emp.department}</td>
                    <td className="p-3.5 font-mono text-muted-foreground">{emp.joining_date || "—"}</td>
                    <td className="p-3.5 font-mono font-bold">{emp.net_salary ? `${Number(emp.net_salary).toLocaleString()} ${emp.salary_currency || "USD"}` : "—"}</td>
                    <td className="p-3.5 font-mono text-muted-foreground">0</td>
                    <td className="p-3.5">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[10px]">
                        {emp.status || "Active"}
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
