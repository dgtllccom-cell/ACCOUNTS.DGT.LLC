"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  Calendar,
  Settings,
  X,
  ChevronDown,
  Eye,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
  DollarSign,
  Plus,
  RefreshCw,
  FileText
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { t as tc } from "@/lib/i18n/ui";

export type ExpenseCategory = "customer" | "truck" | "customs" | "other";

type RegisterRow = {
  id: string;
  expenseNo: string;
  date: string;
  countryCode: string;
  countryName: string;
  flag: string;
  branch: string;
  entryUser: string;
  party: string;
  expenseType: string;
  creditAcc: string;
  debitAcc: string;
  amount: string;
  amountValue: number;
  currency: string;
  status: string;
};

const CATEGORY_BILL_TITLE: Record<string, string> = {
  customer: "customer_expenses",
  truck: "truck_expenses",
  customs: "customs_expenses",
  other: "other_expenses",
};

function flagFromIso2(iso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return "";
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Totals grouped by currency: one currency -> "USD 1,000.00"; mixed -> "USD 1,000.00 + AED 500.00" (never summed across currencies). */
function currencyTotals(rows: RegisterRow[], pick: (r: RegisterRow) => boolean): string {
  const byCur = new Map<string, number>();
  for (const r of rows) {
    if (!pick(r)) continue;
    const cur = r.currency || "";
    byCur.set(cur, (byCur.get(cur) || 0) + r.amountValue);
  }
  if (byCur.size === 0) return "0.00";
  return [...byCur.entries()].map(([cur, v]) => `${cur ? cur + " " : ""}${formatAmount(v)}`).join(" + ");
}
interface ExpensesBillRegisterViewProps {
  category: ExpenseCategory;
  onOpenEntryForm?: () => void;
}

// Full 5-language dictionary covering user's exact uploaded screenshots
const DICT = {
  en: {
    customer_title: "Customer Expenses Register",
    truck_title: "Truck Expenses Register",
    customs_title: "Custom Bills Register",
    other_title: "Other Expenses Register",
    customer_summary: "Customer Expense Summary",
    truck_summary: "Truck Expense Summary",
    customs_summary: "Custom Bills Summary",
    other_summary: "Other Expense Summary",
    country_wise_expenses: "Country Wise Expenses",
    country_wise_customer: "Country Wise Customer Expenses",
    country_wise_truck: "Country Wise Truck Expenses",
    country_wise_customs: "Country Wise Custom Bills",
    country_wise_other: "Country Wise Other Expenses",
    country_wise_ledger: "Country Wise Ledger Transfer (USD)",
    country_wise_ledger_balance: "Country Wise Ledger Transfer & Balance (USD)",
    total_expenses: "Total Expenses",
    total_bills: "Total Bills",
    transferred_to_ledger: "Transferred to Ledger",
    pending_review: "Pending Review",
    remaining_balance: "Remaining Balance",
    approved: "Approved",
    pending: "Pending",
    rejected: "Rejected",
    records: "Records",
    search_placeholder: "Search by expense no, customer, voucher no...",
    filter_btn: "Filter",
    bill_date_btn: "Bill Date",
    actions_btn: "Actions",
    filters_header: "Filters",
    country: "Country",
    select_country: "Select Country",
    branch: "Branch",
    select_branch: "Select Branch",
    user: "User",
    select_user: "Select User",
    customer: "Customer",
    select_customer: "Select Customer",
    party: "Party / Payee",
    select_party: "Select Party",
    expense_type: "Expense Type",
    select_expense_type: "Select Expense Type",
    voucher_number: "Voucher Number",
    enter_voucher: "Enter Voucher Number",
    status: "Status",
    select_status: "Select Status",
    apply_filter: "Apply Filter",
    clear: "Clear",
    all_countries: "All Countries",
    uae: "UAE",
    pakistan: "Pakistan",
    afghanistan: "Afghanistan",
    uzbekistan: "Uzbekistan",
    col_num: "#",
    col_expense_no: "Expense No.",
    col_date: "Date",
    col_country: "Country",
    col_branch: "Branch",
    col_entry_user: "Entry User",
    col_customer: "Customer",
    col_party: "Party / Vehicle",
    col_expense_type: "Expense Type",
    col_credit_acc: "Credit Account No.",
    col_debit_acc: "Debit Account No.",
    col_amount: "Amount",
    col_currency: "Currency",
    col_status: "Status",
    col_actions: "Actions",
    col_total_usd: "Total Bills",
    col_total_transfer: "Total (USD)",
    col_transferred: "Transferred",
    col_pending: "Pending",
    col_remaining: "Remaining",
    col_total_amount: "Total (USD)",
    col_transfer_ledger: "Transfer Ledger",
    col_ledger_remaining: "Remaining Balance",
    showing: "Showing 1 to 10 of 125 records",
    per_page: "10 / page",
    lang_auto_note: "Language switched: layout, buttons, dropdowns, and filters automatically follow active language direction."
  },
  ur: {
    customer_title: "کسٹمر اخراجات رجسٹر",
    truck_title: "ٹرک اخراجات رجسٹر",
    customs_title: "کسٹم بلز رجسٹر",
    other_title: "دیگر اخراجات رجسٹر",
    customer_summary: "کسٹمر اخراجات کا خلاصہ",
    truck_summary: "ٹرک اخراجات کا خلاصہ",
    customs_summary: "کسٹم بلز کا خلاصہ",
    other_summary: "دیگر اخراجات کا خلاصہ",
    country_wise_expenses: "ملک کے حساب سے اخراجات",
    country_wise_customer: "ملک کے حساب سے کسٹمر اخراجات",
    country_wise_truck: "ملک کے حساب سے ٹرک اخراجات",
    country_wise_customs: "ملک کے حساب سے کسٹم بلز",
    country_wise_other: "ملک کے حساب سے دیگر اخراجات",
    country_wise_ledger: "ملک کے حساب سے لیجر ٹرانسفر (امریکی ڈالر)",
    country_wise_ledger_balance: "ملک کے حساب سے لیجر ٹرانسفر و بیلنس (امریکی ڈالر)",
    total_expenses: "کل اخراجات",
    total_bills: "کل بلز",
    transferred_to_ledger: "لیجر میں ٹرانسفر شدہ",
    pending_review: "زیر التواء",
    remaining_balance: "بقایا بیلنس",
    approved: "منظور شدہ",
    pending: "زیر التواء",
    rejected: "مسترد",
    records: "ریکارڈز",
    search_placeholder: "اخراجات نمبر، کسٹمر، ووچر نمبر وغیرہ سے تلاش کریں...",
    filter_btn: "فلٹر",
    bill_date_btn: "بل تاریخ",
    actions_btn: "اعمالیات",
    filters_header: "فلٹرز",
    country: "ملک",
    select_country: "ملک منتخب کریں",
    branch: "برانچ",
    select_branch: "برانچ منتخب کریں",
    user: "صارف",
    select_user: "صارف منتخب کریں",
    customer: "کسٹمر",
    select_customer: "کسٹمر منتخب کریں",
    party: "پارٹی / گاڑی",
    select_party: "پارٹی منتخب کریں",
    expense_type: "اخراجات کی قسم",
    select_expense_type: "اخراجات کی قسم منتخب کریں",
    voucher_number: "ووچر نمبر",
    enter_voucher: "ووچر نمبر درج کریں",
    status: "حالت",
    select_status: "حالت منتخب کریں",
    apply_filter: "فلٹر لاگو کریں",
    clear: "صاف کریں",
    all_countries: "تمام ممالک",
    uae: "متحدہ عرب امارات",
    pakistan: "پاکستان",
    afghanistan: "افغانستان",
    uzbekistan: "ازبکستان",
    col_num: "#",
    col_expense_no: "اخراجات نمبر",
    col_date: "تاریخ",
    col_country: "ملک",
    col_branch: "برانچ",
    col_entry_user: "اندراج کرنے والا",
    col_customer: "کسٹمر",
    col_party: "پارٹی / گاڑی",
    col_expense_type: "اخراجات کی قسم",
    col_credit_acc: "کریڈٹ اکاؤنٹ نمبر",
    col_debit_acc: "ڈیبٹ اکاؤنٹ نمبر",
    col_amount: "رقم",
    col_currency: "کرنسی",
    col_status: "حالت",
    col_actions: "اعمالیات",
    col_total_usd: "کل بلز",
    col_total_transfer: "کل رقم (USD)",
    col_transferred: "ٹرانسفر شدہ",
    col_pending: "زیر التواء",
    col_remaining: "بقایا رقم",
    col_total_amount: "کل رقم (USD)",
    col_transfer_ledger: "ٹرانسفر لیجر",
    col_ledger_remaining: "بقایا بیلنس",
    showing: "125 میں سے 1 سے 10 ریکارڈ دکھائے جا رہے ہیں",
    per_page: "10 / صفحہ",
    lang_auto_note: "زبان تبدیل کرنے پر تمام بٹن، ڈراپ ڈاؤن، فلٹرز اور لے آؤٹ کی سمت خودکار طور پر تبدیل ہو جاتی ہے۔"
  },
  fa: {
    customer_title: "ثبت هزینه‌های مشتری",
    truck_title: "ثبت هزینه‌های موتر",
    customs_title: "ثبت صورتحساب‌های گمرک",
    other_title: "ثبت سایر هزینه‌ها",
    customer_summary: "خلاصه هزینه‌های مشتری",
    truck_summary: "خلاصه هزینه‌های موتر",
    customs_summary: "خلاصه صورتحساب‌های گمرک",
    other_summary: "خلاصه سایر هزینه‌ها",
    country_wise_expenses: "هزینه‌ها به تفکیک کشور",
    country_wise_customer: "هزینه‌های مشتری به تفکیک کشور",
    country_wise_truck: "هزینه‌های موتر به تفکیک کشور",
    country_wise_customs: "صورتحساب‌های گمرک به تفکیک کشور",
    country_wise_other: "سایر هزینه‌ها به تفکیک کشور",
    country_wise_ledger: "انتقال حساب به تفکیک کشور (دلار آمریکا)",
    country_wise_ledger_balance: "انتقال به دفتر کل و مانده به تفکیک کشور (دلار)",
    total_expenses: "کل هزینه‌ها",
    total_bills: "کل صورتحساب‌ها",
    transferred_to_ledger: "انتقال به دفتر کل",
    pending_review: "در انتظار بررسی",
    remaining_balance: "مانده باقیمانده",
    approved: "تأیید شده",
    pending: "در انتظار",
    rejected: "رد شده",
    records: "رکورد",
    search_placeholder: "جستجو بر اساس شماره هزینه، مشتری، شماره ووچر...",
    filter_btn: "فیلتر",
    bill_date_btn: "تاریخ صورتحساب",
    actions_btn: "عملیات",
    filters_header: "فیلترها",
    country: "کشور",
    select_country: "انتخاب کشور",
    branch: "شعبه",
    select_branch: "انتخاب شعبه",
    user: "کاربر",
    select_user: "انتخاب کاربر",
    customer: "مشتری",
    select_customer: "انتخاب مشتری",
    party: "طرف حساب / خودرو",
    select_party: "انتخاب طرف حساب",
    expense_type: "نوع هزینه",
    select_expense_type: "انتخاب نوع هزینه",
    voucher_number: "شماره ووچر",
    enter_voucher: "شماره ووچر را وارد کنید",
    status: "وضعیت",
    select_status: "انتخاب وضعیت",
    apply_filter: "اعمال فیلتر",
    clear: "پاک کردن",
    all_countries: "همه کشورها",
    uae: "امارات متحده عربی",
    pakistan: "پاکستان",
    afghanistan: "افغانستان",
    uzbekistan: "ازبکستان",
    col_num: "#",
    col_expense_no: "شماره هزینه",
    col_date: "تاریخ",
    col_country: "کشور",
    col_branch: "شعبه",
    col_entry_user: "کاربر ثبت‌کننده",
    col_customer: "مشتری",
    col_party: "طرف حساب",
    col_expense_type: "نوع هزینه",
    col_credit_acc: "شماره حساب بستانکار",
    col_debit_acc: "شماره حساب بدهکار",
    col_amount: "مبلغ",
    col_currency: "ارز",
    col_status: "وضعیت",
    col_actions: "عملیات",
    col_total_usd: "مجموع صورتحساب",
    col_total_transfer: "مبلغ انتقال کل (دلار)",
    col_transferred: "تأیید و انتقال",
    col_pending: "در انتظار",
    col_remaining: "مانده باقیمانده",
    col_total_amount: "مبلغ کل (دلار)",
    col_transfer_ledger: "انتقال به دفتر کل",
    col_ledger_remaining: "مانده باقیمانده",
    showing: "نمایش ۱ تا ۱۰ از ۱۲۵ رکورد",
    per_page: "۱۰ / صفحه",
    lang_auto_note: "با تغییر زبان، دکمه‌ها، منوهای کشویی، فیلترها و جهت چیدمان به صورت خودکار به‌روزرسانی می‌شوند."
  },
  ar: {
    customer_title: "سجل مصاريف العملاء",
    truck_title: "سجل مصاريف الشاحنات",
    customs_title: "سجل فواتير الجمارك",
    other_title: "سجل المصاريف الأخرى",
    customer_summary: "ملخص مصاريف العملاء",
    truck_summary: "ملخص مصاريف الشاحنات",
    customs_summary: "ملخص فواتير الجمارك",
    other_summary: "ملخص المصاريف الأخرى",
    country_wise_expenses: "المصاريف حسب الدولة",
    country_wise_customer: "مصاريف العملاء حسب الدولة",
    country_wise_truck: "مصاريف الشاحنات حسب الدولة",
    country_wise_customs: "فواتير الجمارك حسب الدولة",
    country_wise_other: "المصاريف الأخرى حسب الدولة",
    country_wise_ledger: "تحويلات الأستاذ حسب الدولة (دولار أمريكي)",
    country_wise_ledger_balance: "تحويلات الأستاذ والرصيد المتبقي حسب الدولة (دولار)",
    total_expenses: "إجمالي المصروفات",
    total_bills: "إجمالي الفواتير",
    transferred_to_ledger: "المحول لدفتر الأستاذ",
    pending_review: "قيد المراجعة",
    remaining_balance: "الرصيد المتبقي",
    approved: "المعتمد",
    pending: "قيد المراجعة",
    rejected: "المرفوض",
    records: "سجل",
    search_placeholder: "البحث برقم المصروف، اسم العميل، رقم القيد...",
    filter_btn: "تصفية",
    bill_date_btn: "تاريخ الفاتورة",
    actions_btn: "إجراءات",
    filters_header: "تصفية البيانات",
    country: "الدولة",
    select_country: "اختر الدولة",
    branch: "الفرع",
    select_branch: "اختر الفرع",
    user: "المستخدم",
    select_user: "اختر المستخدم",
    customer: "العميل",
    select_customer: "اختر العميل",
    party: "المستفيد / الشاحنة",
    select_party: "اختر الطرف",
    expense_type: "نوع المصروف",
    select_expense_type: "اختر نوع المصروف",
    voucher_number: "رقم القيد / الإذن",
    enter_voucher: "أدخل رقم القيد",
    status: "الحالة",
    select_status: "اختر الحالة",
    apply_filter: "تطبيق التصفية",
    clear: "إعادة تعيين",
    all_countries: "جميع الدول",
    uae: "الإمارات العربية المتحدة",
    pakistan: "باكستان",
    afghanistan: "أفغانستان",
    uzbekistan: "أوزبكستان",
    col_num: "#",
    col_expense_no: "رقم المصروف",
    col_date: "التاريخ",
    col_country: "الدولة",
    col_branch: "الفرع",
    col_entry_user: "المستخدم المدخل",
    col_customer: "العميل",
    col_party: "المستفيد",
    col_expense_type: "نوع المصروف",
    col_credit_acc: "رقم حساب الدائن",
    col_debit_acc: "رقم حساب المدين",
    col_amount: "المبلغ",
    col_currency: "العملة",
    col_status: "الحالة",
    col_actions: "الإجراءات",
    col_total_usd: "إجمالي الفواتير",
    col_total_transfer: "إجمالي التحويل (دولار أمريكي)",
    col_transferred: "المحول للأستاذ",
    col_pending: "قيد الانتظار",
    col_remaining: "الرصيد المتبقي",
    col_total_amount: "إجمالي المبلغ (دولار)",
    col_transfer_ledger: "المحول للأستاذ",
    col_ledger_remaining: "الرصيد المتبقي",
    showing: "عرض 1 إلى 10 من أصل 125 سجل",
    per_page: "10 / صفحة",
    lang_auto_note: "عند تغيير اللغة، سيتم تحديث الأزرار والقوائم المنسدلة والفلاتر واتجاه الصفحة تلقائياً."
  },
  ps: {
    customer_title: "د پیرودونکي لګښتونو راجستر",
    truck_title: "د لارۍ لګښتونو راجستر",
    customs_title: "د ګمرک بلونو راجستر",
    other_title: "د نورو لګښتونو راجستر",
    customer_summary: "د پیرودونکي لګښتونو لنډیز",
    truck_summary: "د لارۍ لګښتونو لنډیز",
    customs_summary: "د ګمرک بلونو لنډیز",
    other_summary: "د نورو لګښتونو لنډیز",
    country_wise_expenses: "د هیواد له مخې لګښتونه",
    country_wise_customer: "د هیواد له مخې د پیرودونکي لګښتونه",
    country_wise_truck: "د هیوادونو له مخې د موټرو لګښتونه",
    country_wise_customs: "د هیوادونو له مخې د ګمرک بلونه",
    country_wise_other: "د هیوادونو له مخې نور لګښتونه",
    country_wise_ledger: "د هیواد له مخې لیجر لیږد (امریکایي ډالر)",
    country_wise_ledger_balance: "د هیواد له مخې د لیجر لیږد او پاتې بیلانس (ډالر)",
    total_expenses: "ټول لګښتونه",
    total_bills: "ټول بلونه",
    transferred_to_ledger: "لیجر ته لیږدول شوی",
    pending_review: "تر کتنې لاندې",
    remaining_balance: "پاتې بیلانس",
    approved: "منظور شوی",
    pending: "پاتې",
    rejected: "رد شوی",
    records: "ریکارډونه",
    search_placeholder: "د لګښت شمیره، پیرودونکی، یا واوچر له لارې لټون وکړئ...",
    filter_btn: "فلټر",
    bill_date_btn: "د بل نېټه",
    actions_btn: "عملیات",
    filters_header: "فلټرونه",
    country: "هیواد",
    select_country: "هیواد وټاکئ",
    branch: "څانګه",
    select_branch: "څانګه وټاکئ",
    user: "کاروونکی",
    select_user: "کاروونکی وټاکئ",
    customer: "پیرودونکی",
    select_customer: "پیرودونکی وټاکئ",
    party: "اړوند اړخ / ګاډی",
    select_party: "اړخ وټاکئ",
    expense_type: "د لګښت ډول",
    select_expense_type: "د لګښت ډول وټاکئ",
    voucher_number: "د واوچر شمیره",
    enter_voucher: "د واوچر شمیره ولیکئ",
    status: "حالت",
    select_status: "حالت وټاکئ",
    apply_filter: "فلټر پلي کړئ",
    clear: "پاک کړئ",
    all_countries: "ټول هیوادونه",
    uae: "متحده عربي امارات",
    pakistan: "پاکستان",
    afghanistan: "افغانستان",
    uzbekistan: "ازبکستان",
    col_num: "#",
    col_expense_no: "د لګښت شمیره",
    col_date: "نېټه",
    col_country: "هیواد",
    col_branch: "څانګه",
    col_entry_user: "ثبت کوونکی",
    col_customer: "پیرودونکی",
    col_party: "اړخ / موټر",
    col_expense_type: "د لګښت ډول",
    col_credit_acc: "د کریډیټ حساب شمېره",
    col_debit_acc: "د ډیبیټ حساب شمېره",
    col_amount: "رقم",
    col_currency: "اسعار",
    col_status: "حالت",
    col_actions: "عملیات",
    col_total_usd: "ټول بلونه",
    col_total_transfer: "د لیږد ټول مقدار (ډالر)",
    col_transferred: "لیږدول شوی",
    col_pending: "ځنډول شوی",
    col_remaining: "پاتې رقم",
    col_total_amount: "ټول مقدار (ډالر)",
    col_transfer_ledger: "لیجر ته لیږدول",
    col_ledger_remaining: "پاتې بیلانس",
    showing: "له ۱۲۵ ریکارډونو څخه ۱ تر ۱۰ ښودل کیږي",
    per_page: "۱۰ / پاڼه",
    lang_auto_note: "د ژبې په بدلولو سره، تڼۍ، انتخابي لستونه، فلټرونه او د پاڼې لوری په خپله بدلیږي."
  }
};


export function ExpensesBillRegisterView({ category, onOpenEntryForm }: ExpensesBillRegisterViewProps) {
  const activeLang = useActiveLanguage();
  const lang = (DICT[activeLang as keyof typeof DICT] ? activeLang : "en") as keyof typeof DICT;
  const isRtl = ["ur", "fa", "ar", "ps"].includes(lang);
  const t = DICT[lang];

  // States
  const [selectedCountryTab, setSelectedCountryTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Form filters
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("all");
  const [filterExpenseType, setFilterExpenseType] = useState("all");
  const [filterVoucher, setFilterVoucher] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Determine category-specific text
  const categoryTitle =
    category === "customer"
      ? t.customer_title
      : category === "truck"
      ? t.truck_title
      : category === "customs"
      ? t.customs_title
      : t.other_title;

  const summaryTitle =
    category === "customer"
      ? t.customer_summary
      : category === "truck"
      ? t.truck_summary
      : category === "customs"
      ? t.customs_summary
      : t.other_summary;

  const countryWiseCategoryTitle =
    category === "customer"
      ? t.country_wise_customer
      : category === "truck"
      ? t.country_wise_truck
      : category === "customs"
      ? t.country_wise_customs
      : t.country_wise_other;

  const partyHeader = category === "customer" ? t.col_customer : t.col_party;

  // Real data: expense bills of this register's category (bill_title), scoped by the server's session rules.
  const [rawRows, setRawRows] = useState<RegisterRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const billTitle = CATEGORY_BILL_TITLE[category] || "other_expenses";
    fetch(`/api/erp/expenses?category=${encodeURIComponent(billTitle)}&limit=2000`, { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        const bills: any[] = Array.isArray(body?.bills) ? body.bills : [];
        const mapped: RegisterRow[] = bills.map((b) => {
          const lines: any[] = Array.isArray(b.expenses_bill_lines) ? b.expenses_bill_lines : [];
          const amountValue = lines.reduce((sum, l) => sum + Number(l.grand_amount || 0), 0);
          const currency = lines.find((l) => l.currency)?.currency || b.city_branches?.countries?.currency_code || "";
          const country = b.city_branches?.countries;
          const iso2 = String(country?.iso2 || "");
          return {
            id: String(b.id),
            expenseNo: b.serial_no || "",
            date: b.bill_date ? String(b.bill_date).slice(0, 10) : "",
            countryCode: iso2 || String(country?.name || ""),
            countryName: String(country?.name || ""),
            flag: flagFromIso2(iso2),
            branch: String(b.city_branches?.name || ""),
            entryUser: String(b.profiles?.full_name || ""),
            party: String(b.reference_no || ""),
            expenseType: String(lines[0]?.details || b.bill_title || ""),
            creditAcc: "",
            debitAcc: "",
            amount: formatAmount(amountValue),
            amountValue,
            currency,
            status: b.transferred_to_roznamcha ? "approved" : "pending",
          };
        });
        setRawRows(mapped);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setRawRows([]);
        setLoadError(String(err?.message || err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  // Filter options come from the rows that really exist (never a fixed list).
  const branchOptions = useMemo(() => [...new Set(rawRows.map((r) => r.branch).filter(Boolean))].sort(), [rawRows]);
  const partyOptions = useMemo(() => [...new Set(rawRows.map((r) => r.party).filter(Boolean))].sort(), [rawRows]);
  const expenseTypeOptions = useMemo(() => [...new Set(rawRows.map((r) => r.expenseType).filter(Boolean))].sort(), [rawRows]);

  // Country tabs / filter options come from the rows that really exist (never a fixed list).
  const countryOptions = useMemo(() => {
    const seen = new Map<string, { code: string; label: string; flag: string; count: number }>();
    for (const r of rawRows) {
      const hit = seen.get(r.countryCode);
      if (hit) hit.count += 1;
      else seen.set(r.countryCode, { code: r.countryCode, label: r.countryName || r.countryCode, flag: r.flag, count: 1 });
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [rawRows]);

  // Per-country figures from the real rows (amounts are never summed across currencies).
  const countryRows = useMemo(() => countryOptions.map((c) => {
    const rs = rawRows.filter((r) => r.countryCode === c.code);
    return {
      code: c.code,
      label: c.label,
      flag: c.flag,
      total: currencyTotals(rs, () => true),
      transferred: currencyTotals(rs, (r) => r.status === "approved"),
      pending: currencyTotals(rs, (r) => r.status !== "approved"),
      remaining: currencyTotals(rs, (r) => r.status !== "approved"),
    };
  }), [countryOptions, rawRows]);

  // Summary figures: computed from the real rows. Empty database -> zeros.
  const summary = useMemo(() => {
    const transferredRows = rawRows.filter((r) => r.status === "approved");
    const pendingRows = rawRows.filter((r) => r.status !== "approved");
    return {
      count: rawRows.length,
      total: currencyTotals(rawRows, () => true),
      transferred: currencyTotals(rawRows, (r) => r.status === "approved"),
      transferredCount: transferredRows.length,
      pending: currencyTotals(rawRows, (r) => r.status !== "approved"),
      pendingCount: pendingRows.length,
      remaining: currencyTotals(rawRows, (r) => r.status !== "approved"),
    };
  }, [rawRows]);

  // Filter rows based on search, country tab, and filter form
  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      // Tab filter
      if (selectedCountryTab !== "all" && r.countryCode !== selectedCountryTab) {
        return false;
      }
      // Form country filter
      if (filterCountry !== "all" && r.countryCode !== filterCountry) {
        return false;
      }
      // Form status filter
      if (filterStatus !== "all" && r.status !== filterStatus) {
        return false;
      }
      if (filterBranch !== "all" && r.branch !== filterBranch) return false;
      if (filterCustomer !== "all" && r.party !== filterCustomer) return false;
      if (filterExpenseType !== "all" && r.expenseType !== filterExpenseType) return false;
      if (filterVoucher.trim() && !r.expenseNo.toLowerCase().includes(filterVoucher.trim().toLowerCase())) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit =
          r.expenseNo.toLowerCase().includes(q) ||
          r.party.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q) ||
          r.expenseType.toLowerCase().includes(q) ||
          r.entryUser.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [rawRows, selectedCountryTab, filterCountry, filterBranch, filterCustomer, filterExpenseType, filterVoucher, filterStatus, searchQuery]);

  const handleResetFilters = () => {
    setFilterCountry("all");
    setFilterBranch("all");
    setFilterUser("all");
    setFilterCustomer("all");
    setFilterExpenseType("all");
    setFilterVoucher("");
    setFilterStatus("all");
    setSelectedCountryTab("all");
    setSearchQuery("");
  };

  return (
    <div className={`space-y-4 animate-in fade-in duration-200 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* ─────────────────────────────────────────────────────────────
          TOP ACTION BAR: Title, Search, Filter, Bill Date, Actions
         ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Title & Count Badge */}
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {categoryTitle}
            </h1>
            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              ({summary.count})
            </span>
          </div>

          {/* Search, Filter, Bill Date, Actions buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input with search icon */}
            <div className="relative min-w-[240px] sm:min-w-[320px] flex-1 sm:flex-initial">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search_placeholder}
                className={`w-full h-9 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${
                  isRtl ? "pr-8 pl-3 text-right" : "pl-8 pr-3 text-left"
                }`}
              />
              <Search
                className={`absolute top-2.5 h-4 w-4 text-slate-400 pointer-events-none ${
                  isRtl ? "right-2.5" : "left-2.5"
                }`}
              />
            </div>

            {/* Filter Toggle Button (Blue) with Dropdown Popover Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 text-xs font-bold shadow-2xs transition"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>{t.filter_btn}</span>
                <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
              </button>

              {/* Floating Dropdown Filter Card */}
              {showFiltersPanel && (
                <div
                  className={`absolute top-full mt-2 ${
                    isRtl ? "left-0" : "right-0"
                  } z-50 w-72 sm:w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-3.5 animate-in fade-in zoom-in-95 duration-150`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{t.filters_header}</span>
                    <button
                      type="button"
                      onClick={() => setShowFiltersPanel(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {/* Country */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.country}</label>
                      <select
                        value={filterCountry}
                        onChange={(e) => setFilterCountry(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="all">{t.select_country}</option>
                        {countryOptions.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Branch */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.branch}</label>
                      <select
                        value={filterBranch}
                        onChange={(e) => setFilterBranch(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="all">{t.select_branch}</option>
                        {branchOptions.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>

                    {/* User */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.user}</label>
                      <select
                        value={filterUser}
                        onChange={(e) => setFilterUser(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="all">{t.select_user}</option>
                        <option value="Ali Khan">Ali Khan / علی خان</option>
                        <option value="Sara Ahmed">Sara Ahmed / سارہ احمد</option>
                        <option value="Mohammad Iqbal">Mohammad Iqbal / محمد اقبال</option>
                      </select>
                    </div>

                    {/* Customer / Party */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">{partyHeader}</label>
                      <select
                        value={filterCustomer}
                        onChange={(e) => setFilterCustomer(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="all">{category === "customer" ? t.select_customer : t.select_party}</option>
                        {partyOptions.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>

                    {/* Expense Type */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.expense_type}</label>
                      <select
                        value={filterExpenseType}
                        onChange={(e) => setFilterExpenseType(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="all">{t.select_expense_type}</option>
                        {expenseTypeOptions.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>

                    {/* Voucher Number */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.voucher_number}</label>
                      <input
                        type="text"
                        value={filterVoucher}
                        onChange={(e) => setFilterVoucher(e.target.value)}
                        placeholder={t.enter_voucher}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.status}</label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="all">{t.select_status}</option>
                        <option value="approved">{t.approved}</option>
                        <option value="pending">{t.pending}</option>
                        <option value="rejected">{t.rejected}</option>
                      </select>
                    </div>

                    {/* Action Buttons: Apply Filter & Clear */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFiltersPanel(false)}
                        className="flex-1 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition inline-flex items-center justify-center gap-1.5"
                      >
                        <Filter className="h-3 w-3" />
                        <span>{t.apply_filter}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 font-semibold text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition inline-flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>{t.clear}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bill Date Button (Purple) */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3.5 text-xs font-bold shadow-2xs transition"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{t.bill_date_btn}</span>
            </button>

            {/* Actions Button (Blue) */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 text-xs font-bold shadow-2xs transition"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{t.actions_btn}</span>
            </button>

            {/* + New Entry Button */}
            {onOpenEntryForm && (
              <button
                type="button"
                onClick={onOpenEntryForm}
                className="inline-flex items-center gap-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 text-xs font-bold shadow-2xs transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{translateHeader(activeLang, "+ New")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          UPPER 3 PANELS: Summary Cards + Country Analytics Tables
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: 4 Colored KPI Cards */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <FileText className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">{summaryTitle}</h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Blue: Total Bills */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 flex items-center justify-between dark:border-blue-900 dark:bg-blue-950/40">
              <div>
                <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block">{t.total_bills}</span>
                <span className="font-mono font-black text-blue-950 dark:text-blue-200 text-sm">{summary.total}</span>
                <span className="text-[10px] text-slate-400 block">{summary.count} {t.records}</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>

            {/* Green: Transferred to Ledger */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5 flex items-center justify-between dark:border-emerald-900 dark:bg-emerald-950/40">
              <div>
                <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block">{t.transferred_to_ledger}</span>
                <span className="font-mono font-black text-emerald-900 dark:text-emerald-200 text-sm">{summary.transferred}</span>
                <span className="text-[10px] text-slate-400 block">{summary.transferredCount} {t.records}</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>

            {/* Amber: Pending Review */}
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5 flex items-center justify-between dark:border-amber-900 dark:bg-amber-950/40">
              <div>
                <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block">{t.pending_review}</span>
                <span className="font-mono font-black text-amber-900 dark:text-amber-200 text-sm">{summary.pending}</span>
                <span className="text-[10px] text-slate-400 block">{summary.pendingCount} {t.records}</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4" />
              </div>
            </div>

            {/* Rose: Remaining Balance */}
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-2.5 flex items-center justify-between dark:border-rose-900 dark:bg-rose-950/40">
              <div>
                <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block">{t.remaining_balance}</span>
                <span className="font-mono font-black text-rose-900 dark:text-rose-200 text-sm">{summary.remaining}</span>
                <span className="text-[10px] text-slate-400 block">{summary.pendingCount} {t.records}</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                <ArrowRightLeft className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Country Wise Expenses Breakdown Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">{countryWiseCategoryTitle}</h3>
          </div>

          <div className="overflow-x-auto text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="pb-1.5">{t.country}</th>
                  <th className="pb-1.5 text-right">{t.col_total_usd}</th>
                  <th className="pb-1.5 text-right">{t.col_transferred}</th>
                  <th className="pb-1.5 text-right">{t.col_pending}</th>
                  <th className="pb-1.5 text-right">{t.col_remaining}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60 font-mono">
                {countryRows.length === 0 ? (
                  <tr>
                    <td className="py-1 font-sans font-semibold">—</td>
                    <td className="py-1 text-right font-bold">0.00</td>
                    <td className="py-1 text-right text-emerald-600 font-semibold">0.00</td>
                    <td className="py-1 text-right text-amber-600 font-semibold">0.00</td>
                    <td className="py-1 text-right text-rose-600 font-semibold">0.00</td>
                  </tr>
                ) : countryRows.map((c) => (
                  <tr key={c.code}>
                    <td className="py-1 font-sans font-semibold flex items-center gap-1">
                      {c.flag && <span>{c.flag}</span>}
                      <span>{c.label}</span>
                    </td>
                    <td className="py-1 text-right font-bold">{c.total}</td>
                    <td className="py-1 text-right text-emerald-600 font-semibold">{c.transferred}</td>
                    <td className="py-1 text-right text-amber-600 font-semibold">{c.pending}</td>
                    <td className="py-1 text-right text-rose-600 font-semibold">{c.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 3: Country Wise Ledger Transfer & Balance Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <ArrowRightLeft className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">{t.country_wise_ledger_balance}</h3>
          </div>

          <div className="overflow-x-auto text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="pb-1.5">{t.country}</th>
                  <th className="pb-1.5 text-right">{t.col_total_amount}</th>
                  <th className="pb-1.5 text-right">{t.col_transfer_ledger}</th>
                  <th className="pb-1.5 text-right">{t.col_ledger_remaining}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60 font-mono">
                {countryRows.length === 0 ? (
                  <tr>
                    <td className="py-1 font-sans font-semibold">—</td>
                    <td className="py-1 text-right font-bold text-slate-800 dark:text-slate-100">0.00</td>
                    <td className="py-1 text-right font-bold text-emerald-600">0.00</td>
                    <td className="py-1 text-right font-black text-blue-900 dark:text-blue-200">0.00</td>
                  </tr>
                ) : countryRows.map((c) => (
                  <tr key={c.code}>
                    <td className="py-1 font-sans font-semibold flex items-center gap-1">
                      {c.flag && <span>{c.flag}</span>}
                      <span>{c.label}</span>
                    </td>
                    <td className="py-1 text-right font-bold text-slate-800 dark:text-slate-100">{c.total}</td>
                    <td className="py-1 text-right font-bold text-emerald-600">{c.transferred}</td>
                    <td className="py-1 text-right font-black text-blue-900 dark:text-blue-200">{c.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {loadError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {loadError}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
          COUNTRY FILTER TABS (Pills with Flags)
         ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setSelectedCountryTab("all")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition whitespace-nowrap ${
            selectedCountryTab === "all"
              ? "bg-blue-600 text-white shadow-2xs"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
        >
          <span>{t.all_countries} ({summary.count})</span>
        </button>

        {countryOptions.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setSelectedCountryTab(c.code)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition whitespace-nowrap ${
              selectedCountryTab === c.code
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {c.flag && <span>{c.flag}</span>}
            <span>{c.label} ({c.count})</span>
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          14-COLUMN DATA TABLE (Matching Exact Uploaded Screenshots)
         ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <th className="py-3 px-3 w-8 text-center">{t.col_num}</th>
                <th className="py-3 px-3">{t.col_expense_no}</th>
                <th className="py-3 px-3">{t.col_date}</th>
                <th className="py-3 px-3">{t.col_country}</th>
                <th className="py-3 px-3">{t.col_branch}</th>
                <th className="py-3 px-3">{t.col_entry_user}</th>
                <th className="py-3 px-3">{partyHeader}</th>
                <th className="py-3 px-3">{t.col_expense_type}</th>
                <th className="py-3 px-3">{t.col_credit_acc}</th>
                <th className="py-3 px-3">{t.col_debit_acc}</th>
                <th className="py-3 px-3 text-right">{t.col_amount}</th>
                <th className="py-3 px-3 text-center">{t.col_currency}</th>
                <th className="py-3 px-3 text-center">{t.col_status}</th>
                <th className="py-3 px-3 text-center w-16">{t.col_actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.map((row) => {
                const isApproved = row.status === "approved";
                const isPending = row.status === "pending";
                const statusLabel = isApproved ? t.approved : isPending ? t.pending : t.rejected;
                const statusBadge = isApproved
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : isPending
                  ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300";

                return (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-center font-medium text-slate-400">{row.id}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {row.expenseNo}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                        <span>{row.flag}</span>
                        <span>{row.countryName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.branch}</td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.entryUser}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {row.party}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.expenseType}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.creditAcc}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.debitAcc}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 text-right whitespace-nowrap">
                      {row.amount}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-center">{row.currency}</td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${statusBadge}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 text-slate-400">
                        <button
                          type="button"
                          className="p-1 hover:text-blue-600 rounded transition"
                          title={tc(activeLang, "common.view_details", "View Details")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:text-slate-600 rounded transition"
                          title={tc(activeLang, "common.more_options", "More Options")}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Pagination & Note */}
        <div className="p-3 bg-slate-50/50 border-t border-slate-100 dark:border-slate-800 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            {filteredRows.length} {t.records}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">{t.per_page}</span>
            <div className="flex items-center gap-1 font-mono">
              <span className="h-7 w-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center">1</span>
              <span className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer">2</span>
              <span className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer">3</span>
              <span className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer">4</span>
              <span className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer">5</span>
              <span className="text-slate-400 px-1">...</span>
              <span className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer">13</span>
            </div>
          </div>
        </div>
      </div>

      {/* Language Auto Switcher Note */}
      <div className="text-center text-[11px] text-slate-400 py-1">
        ⓘ {t.lang_auto_note}
      </div>
    </div>
  );
}
