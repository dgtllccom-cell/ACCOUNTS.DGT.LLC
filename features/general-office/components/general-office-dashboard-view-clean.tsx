"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users, Building2, ScrollText, Clock, Calendar, Banknote,
  ClipboardList, FileText, Badge as IdBadgeIcon, BarChart3,
  Search, Filter, Plus, Printer, Download, Mail, MessageSquare,
  Eye, Edit3, Trash2, CheckCircle2, AlertCircle, XCircle, ChevronRight,
  ShieldCheck, RefreshCcw, FileSpreadsheet, Send, PhoneCall, Check, UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SimpleModal } from "@/components/ui/simple-modal";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { EmployeeForm } from "@/features/hr-payroll/components/employee-form";
import { AdvanceLoanModal } from "@/features/hr-payroll/components/advance-loan-modal";
import { EmployeeLedgerPanel } from "@/features/hr-payroll/components/employee-ledger-panel";
import { openUserA4ReportWindow } from "@/lib/reports/open-user-a4-report-window";
import { Th } from "@/components/ui/translated-th";
import { translateHeader } from "@/lib/i18n/table-headers";

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
  "Printed Employee Master": { ur: "ملازم ماسٹر پرنٹ کیا", ar: "تمت طباعة سجل الموظفين الرئيسي", fa: "گزارش اصلی کارکنان چاپ شد", ps: "د کارمندانو اصلي راپور چاپ شو" }
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
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals State
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeForLoan, setSelectedEmployeeForLoan] = useState<any | null>(null);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<any | null>(null);

  // Sync active language from HTML tag / localStorage
  useEffect(() => {
    function syncLang() {
      if (typeof document === "undefined") return;
      const htmlLang = document.documentElement.lang || "en";
      const l = (htmlLang.split("-")[0] as SupportedLanguage) || "en";
      const validLang = ["en", "ur", "ps", "fa", "ar"].includes(l) ? (l as SupportedLanguage) : "en";
      setLang(validLang);
      setIsRtl(["ur", "ps", "fa", "ar"].includes(validLang));
    }
    syncLang();
    const observer = new MutationObserver(syncLang);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  // Automatically trigger form modal if navigated directly to master-setup
  useEffect(() => {
    if (initialTab === "master-setup") {
      setShowFormModal(true);
    }
  }, [initialTab]);

  // Fetch employees from API
  const loadEmployeesRequestSeq = useRef(0);
  const loadEmployees = useCallback(async () => {
    // `lang` starts at "en" and is corrected to the real active language by the syncLang
    // effect immediately after mount (see below) — that correction fires a second call to
    // this function with the right lang. Guard against the stale "en" request's response
    // arriving *after* the corrected one and clobbering it (a real race observed here: the
    // slower request would silently win and re-leak the source-language name).
    const requestSeq = ++loadEmployeesRequestSeq.current;
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (search) qp.set("search", search);
      if (categoryFilter) qp.set("category", categoryFilter);
      if (statusFilter) qp.set("status", statusFilter);
      // Resolve the employee's linked Person Master name into the active language server-side —
      // without this the Employee Name column always showed whatever script the underlying
      // customer record happened to be typed in, regardless of the selected UI language.
      qp.set("lang", lang);

      const res = await fetch(`/api/erp/hr-payroll/employees?${qp.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (requestSeq === loadEmployeesRequestSeq.current) {
          setEmployees(json.employees || []);
        }
      }
    } catch (err) {
      console.error("Error loading employees:", err);
    } finally {
      if (requestSeq === loadEmployeesRequestSeq.current) {
        setLoading(false);
      }
    }
  }, [search, categoryFilter, statusFilter, lang]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  // Sample static data for sub-modules
  const departmentsList = [
    { id: "1", name: "Executive Headquarters", code: "EXEC", head: "Super Admin", employees: 12, budget: "AED 120,000" },
    { id: "2", name: "Accounts & Finance", code: "FIN", head: "Asmatullah Khan", employees: 28, budget: "AED 250,000" },
    { id: "3", name: "Customs & Clearing Operations", code: "CLR", head: "Jan Ali", employees: 45, budget: "AED 380,000" },
    { id: "4", name: "Logistics & Fleet Transport", code: "LOG", head: "Mohammad Shah", employees: 64, budget: "AED 420,000" },
  ];

  const designationsList = [
    { id: "1", title: "General Manager", dept: "Executive Headquarters", grade: "M-1", minSalary: "AED 25,000" },
    { id: "2", title: "Senior Accountant", dept: "Accounts & Finance", grade: "A-2", minSalary: "AED 12,000" },
    { id: "3", title: "Clearing Agent Specialist", dept: "Customs & Clearing", grade: "O-3", minSalary: "AED 8,500" },
    { id: "4", title: "Branch Cashier", dept: "Accounts & Finance", grade: "C-1", minSalary: "PKR 95,000" },
  ];

  const attendanceList = [
    { empCode: "EMP-001", name: "Asmatullah Khan", timeIn: "08:30 AM", timeOut: "05:30 PM", status: "Present", hours: "9.0 hrs" },
    { empCode: "EMP-002", name: "Jan Ali", timeIn: "08:45 AM", timeOut: "05:45 PM", status: "Present", hours: "9.0 hrs" },
    { empCode: "EMP-003", name: "Mohammad Shah", timeIn: "09:15 AM", timeOut: "05:30 PM", status: "Late", hours: "8.25 hrs" },
    { empCode: "EMP-004", name: "Tariq Ahmad", timeIn: "—", timeOut: "—", status: "On Leave", hours: "0 hrs" },
  ];

  const leaveList = [
    { empCode: "EMP-004", name: "Tariq Ahmad", type: "Annual Leave", from: "2026-07-28", to: "2026-08-05", days: 8, status: "Approved" },
    { empCode: "EMP-008", name: "Gul Mohammad", type: "Medical Leave", from: "2026-07-30", to: "2026-08-01", days: 2, status: "Pending" },
  ];

  const assetList = [
    { tag: "AST-DXB-001", name: "MacBook Pro M3 Max", category: "IT Hardware", assignedTo: "Asmatullah Khan", serial: "C02G8009MD6R", status: "In Use" },
    { tag: "AST-DXB-002", name: "Toyota Land Cruiser", category: "Vehicle", assignedTo: "Jan Ali", serial: "DXB-99081", status: "In Use" },
  ];

  // Printable ID Card handler
  const handlePrintIdCard = (emp: any) => {
    openUserA4ReportWindow({
      title: `Official Employee ID Card — ${emp.person?.customer_name || emp.employee_code}`,
      subtitle: "Digital Dock Corporate Identity Verification",
      userData: {
        userId: emp.id || "EMP-001",
        userCode: emp.employee_code || "EMP-001",
        fullName: emp.person?.customer_name || "Employee Name",
        countryName: "UAE & Pakistan",
        branchName: "Dubai Main HQ",
        branchType: "main_branch",
        role: emp.designation || "Staff Member",
        registrationDate: emp.joining_date || "2026-01-01",
        status: emp.status || "Active",
        permissions: ["Employee Identity Badge", "Official Access Pass"],
        lastActivity: new Date().toISOString(),
        lastActivityAction: "Generated ID Card",
        activityCounts: { logins: 12, transactions: 45, purchases: 8, payments: 15, accounts: 2, edits: 3 }
      }
    });
  };

  return (
    <div className={cn("space-y-6 pb-16 min-h-screen", isRtl && "text-right")} dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Top Executive Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              {tr("General Office Enterprise Management")}
            </div>
            <h1 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              {t.title}
            </h1>
            <p className="mt-1 max-w-2xl text-xs md:text-sm text-slate-300">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => {
                setSelectedEmployeeId(null);
                setShowFormModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20"
            >
              <UserPlus className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
              {t.registerBtn}
            </Button>
          </div>
        </div>

        {/* Ambient light glow */}
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* ── STANDARDIZED 5 KPI SUMMARY CARDS GRID ── */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* MANDATORY Card 1: BRANCH & USER DETAILS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">1. {tr("Branch & User Details")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{tr("Country")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{tr("Pakistan / UAE")}</span>
            </div>
            <div className="flex justify-between">
              <span>{tr("Branch Name")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">{tr("Karachi Main")}</span>
            </div>
            <div className="flex justify-between">
              <span>{tr("User ID / Name")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[110px]" title={`USR-001 (${tr("Admin User")})`}>USR-001 ({tr("Admin")})</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>{tr("Status")}:</span>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px]">Active Session</span>
            </div>
          </div>
        </div>

        {/* Card 2: EMPLOYEES & STAFF SUMMARY */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ClipboardList className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">2. {tr("Employees Summary")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t.totalEmployees}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{employees.length || 142}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{t.activeStaff}:</span>
              <span>{employees.filter((e: any) => e.status === "Active").length || 138}</span>
            </div>
            <div className="flex justify-between text-blue-600 font-bold">
              <span>{t.attendanceRate}:</span>
              <span>98.4%</span>
            </div>
          </div>
        </div>

        {/* Card 3: PAYROLL & ASSETS SUMMARY */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Banknote className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">3. {tr("Payroll & Assets")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t.monthlyPayroll}:</span>
              <span className="font-bold font-mono text-slate-900 dark:text-slate-100">AED 450K</span>
            </div>
            <div className="flex justify-between text-amber-600 font-bold">
              <span>{t.pendingLeaves}:</span>
              <span>12</span>
            </div>
            <div className="flex justify-between text-indigo-600 font-bold">
              <span>{t.assetsTracked}:</span>
              <span>480</span>
            </div>
          </div>
        </div>

        {/* Card 4: BRANCHES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">4. {tr("Branches")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{tr("Total Branches")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">12</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{tr("Active Branches")}:</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* Card 5: QUICK INFO */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <FileText className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">5. {tr("Quick Info")}</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{tr("Currency")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">AED / USD</span>
            </div>
            <div className="flex justify-between">
              <span>{tr("Company")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[110px]">DGT LLC</span>
            </div>
            <div className="flex justify-between">
              <span>{tr("Financial Year")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">2025-26</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE (full width — module switching lives only in the main left sidebar now;
           see lib/navigation/sidebar.ts. The in-page "Office Modules" panel that duplicated it
           has been removed so this content uses the full available width on every breakpoint). ── */}
      <div className="space-y-6">
        <div className="space-y-6">
          {/* TAB 1 & 2: EMPLOYEE MASTER SETUP & MANAGEMENT TABLE DIRECTORY */}
          {(activeTab === "master-setup" || activeTab === "management") && (
            <div className="space-y-4">
              {/* Search & Filter Toolbar */}
              <div className="rounded-2xl border bg-card p-4 shadow-sm flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="h-9 pl-9 text-xs"
                  />
                </div>

                <div className="w-40">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-medium"
                  >
                    <option value="">{t.allCategories}</option>
                    <option value="Manager">{tr("Manager")}</option>
                    <option value="Normal Staff">{tr("Normal Staff")}</option>
                    <option value="Employee">{tr("Employee")}</option>
                    <option value="Others">{tr("Others")}</option>
                  </select>
                </div>

                <div className="w-36">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-medium"
                  >
                    <option value="">{t.allStatuses}</option>
                    <option value="Active">{t.active}</option>
                    <option value="Inactive">{t.inactive}</option>
                    <option value="On Leave">{t.onLeave}</option>
                    <option value="Suspended">{t.suspended}</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground uppercase font-bold text-[11px] border-b">
                    <tr>
                      <Th className="px-4 py-3.5">{t.colEmpCode}</Th>
                      <Th className="px-4 py-3.5">{t.colName}</Th>
                      <Th className="px-4 py-3.5">{t.colCategory}</Th>
                      <Th className="px-4 py-3.5">{t.colDesigDept}</Th>
                      <Th className="px-4 py-3.5">{t.colJoining}</Th>
                      <Th className="px-4 py-3.5">{t.colNetSalary}</Th>
                      <Th className="px-4 py-3.5">{t.colDeductions}</Th>
                      <Th className="px-4 py-3.5">{t.colStatus}</Th>
                      <Th className="px-4 py-3.5 text-right">{t.colActions}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">{tr("Loading registered employees...")}</td>
                      </tr>
                    ) : employees.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No employee records found. Click "Register New Employee" above.</td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3.5 font-mono font-bold">{emp.employee_code}</td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold">{emp.person?.customer_name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{emp.person?.mobile || "-"}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold">
                              {emp.category}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-semibold">{emp.designation || "-"}</div>
                            <div className="text-[10px] text-muted-foreground">{emp.department || "-"}</div>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground font-medium">{emp.joining_date || "-"}</td>
                          <td className="px-4 py-3.5 font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {emp.net_salary?.toLocaleString()} {emp.salary_currency}
                          </td>
                          <td className="px-4 py-3.5 text-red-600 dark:text-red-400 font-semibold font-mono">
                            -{((emp.advance_deduction || 0) + (emp.loan_deduction || 0))?.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px]">
                              {emp.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setShowFormModal(true);
                              }}
                              className="h-7 text-[11px] px-2"
                            >
                              {t.edit}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEmployeeForLoan(emp)}
                              className="h-7 text-[11px] px-2"
                            >
                              {t.loanAdv}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintIdCard(emp)}
                              className="h-7 text-[11px] px-2 text-indigo-600 dark:text-indigo-400"
                            >
                              {t.idCardPreview}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
                      <div><strong className="text-foreground">{tr("Monthly Budget")}:</strong> {dept.budget}</div>
                    </div>
                  </div>
                ))}
              </div>
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
                      <Th className="px-4 py-3">Department</Th>
                      <Th className="px-4 py-3">{tr("Pay Grade")}</Th>
                      <Th className="px-4 py-3">{tr("Min Base Scale")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {designationsList.map((desig) => (
                      <tr key={desig.id}>
                        <td className="px-4 py-3 font-bold">{desig.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{desig.dept}</td>
                        <td className="px-4 py-3"><Badge variant="secondary">{desig.grade}</Badge></td>
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
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold">{t.attendance}</h2>
                  <p className="text-xs text-muted-foreground">{tr("Daily office attendance log, biometric check-in, and work duration tracking.")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> {t.print}
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                    {tr("Mark Biometric Entry")}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-muted font-bold border-b">
                    <tr>
                      <Th className="px-4 py-3">Emp Code</Th>
                      <Th className="px-4 py-3">Employee Name</Th>
                      <Th className="px-4 py-3">{tr("Time In")}</Th>
                      <Th className="px-4 py-3">{tr("Time Out")}</Th>
                      <Th className="px-4 py-3">{tr("Duration")}</Th>
                      <Th className="px-4 py-3">Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attendanceList.map((att, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-mono font-bold">{att.empCode}</td>
                        <td className="px-4 py-3 font-semibold">{att.name}</td>
                        <td className="px-4 py-3 font-mono">{att.timeIn}</td>
                        <td className="px-4 py-3 font-mono">{att.timeOut}</td>
                        <td className="px-4 py-3 font-mono">{att.hours}</td>
                        <td className="px-4 py-3">
                          <Badge className={cn(
                            att.status === "Present" ? "bg-emerald-100 text-emerald-800" :
                            att.status === "Late" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                          )}>
                            {att.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: LEAVE MANAGEMENT */}
          {activeTab === "leave" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold">{t.leave}</h2>
                  <p className="text-xs text-muted-foreground">{tr("Manage employee leave requests, annual allocations, and approvals.")}</p>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                  + {tr("Apply Leave")}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-muted font-bold border-b">
                    <tr>
                      <Th className="px-4 py-3">Emp Code</Th>
                      <Th className="px-4 py-3">Employee Name</Th>
                      <Th className="px-4 py-3">{tr("Leave Type")}</Th>
                      <Th className="px-4 py-3">{tr("Duration")}</Th>
                      <Th className="px-4 py-3">Days</Th>
                      <Th className="px-4 py-3">Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaveList.map((lv, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-mono font-bold">{lv.empCode}</td>
                        <td className="px-4 py-3 font-semibold">{lv.name}</td>
                        <td className="px-4 py-3">{lv.type}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lv.from} to {lv.to}</td>
                        <td className="px-4 py-3 font-mono font-bold">{lv.days} {tr("Days")}</td>
                        <td className="px-4 py-3">
                          <Badge className={lv.status === "Approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                            {lv.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                  <span>{tr("Current Payroll Month")}: July 2026</span>
                  <span className="text-emerald-600 font-mono">{tr("Total Disbursed")}: AED 450,000 / PKR 34,200,000</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: OFFICE ASSETS */}
          {activeTab === "assets" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold">{t.officeAssets}</h2>
                  <p className="text-xs text-muted-foreground">{tr("Register corporate laptops, vehicles, and equipment assigned to staff.")}</p>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                  + {tr("Assign Asset")}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-muted font-bold border-b">
                    <tr>
                      <Th className="px-4 py-3">{tr("Asset Tag")}</Th>
                      <Th className="px-4 py-3">{tr("Item Description")}</Th>
                      <Th className="px-4 py-3">Category</Th>
                      <Th className="px-4 py-3">{tr("Assigned To")}</Th>
                      <Th className="px-4 py-3">{tr("Serial No")}</Th>
                      <Th className="px-4 py-3">Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {assetList.map((ast, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{ast.tag}</td>
                        <td className="px-4 py-3 font-bold">{ast.name}</td>
                        <td className="px-4 py-3">{ast.category}</td>
                        <td className="px-4 py-3 text-emerald-600 font-semibold">{ast.assignedTo}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{ast.serial}</td>
                        <td className="px-4 py-3"><Badge className="bg-emerald-100 text-emerald-800">{ast.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="font-bold text-xs">Asmatullah_Passport_Visa.pdf</div>
                      <div className="text-[10px] text-muted-foreground">{tr("Uploaded on")} 2026-06-15 • 2.4 MB</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-[10px] h-7">{t.pdf}</Button>
                </div>
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
                        <div className="font-bold text-sm text-white">{emp.person?.customer_name}</div>
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
                      userData: {
                        userId: "SA-001",
                        userCode: "GO-MASTER",
                        fullName: tr("General Office Master Audit"),
                        countryName: tr("Pakistan & UAE"),
                        branchName: tr("Global Branches"),
                        branchType: "super_admin",
                        role: tr("Executive Manager"),
                        registrationDate: "2026-01-01",
                        status: t.active,
                        permissions: [tr("Full Access")],
                        lastActivity: new Date().toISOString(),
                        lastActivityAction: tr("Printed Employee Master"),
                        activityCounts: { logins: 50, transactions: 120, purchases: 45, payments: 30, accounts: 10, edits: 5 }
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
