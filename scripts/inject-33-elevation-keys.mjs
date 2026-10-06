import fs from "node:fs";

const UI_FILE = "lib/i18n/ui.ts";
let content = fs.readFileSync(UI_FILE, "utf8");

const keys_en = {
  "cl.customers_group": "Customers",
  "cl.customer_management": "Customer Management",
  "cl.hero_banner_title": "Build Stronger Relationships",
  "cl.hero_banner_sub": "Convert leads into lasting customers",
  "cl.kpi_branch_user": "Branch & User Details",
  "cl.f_branch": "Branch",
  "cl.head_office": "Head Office",
  "cl.f_total_users": "Total Users",
  "cl.f_active_users": "Active Users",
  "cl.f_inactive_users": "Inactive Users",
  "cl.kpi_customer_summary": "Customer Summary",
  "cl.f_total_customers": "Total Customers",
  "cl.f_active_customers": "Active Customers",
  "cl.f_new_this_month": "New This Month",
  "cl.f_inactive_customers": "Inactive Customers",
  "cl.kpi_pipeline_summary": "Customer Pipeline / Status Summary",
  "cl.kpi_country_branch": "Country / Branch Customer Report",
  "cl.f_total_countries": "Total Countries",
  "cl.f_total_branches": "Total Branches",
  "cl.f_customers_this_branch": "Customers (This Branch)",
  "cl.f_top_country": "Top Country",
  "cl.search_ph_short": "Search name, company, country...",
  "lp.crumb_local_purchase": "Local Purchase Booking",
  "lp.voucher_title": "Local Purchase Booking Voucher",
  "lp.serial_no": "Serial No",
  "purchase.currency": "Currency",
  "roz.branch_category": "Branch Category",
  "roz.business_branch": "Business Branch",
  "roz.clearing_agent_branch": "Clearing Agent Branch",
  "roz.entry_scope_branch": "Entry Scope Branch",
  "roz.all_countries": "All Countries",
  "roz.main_branch": "Main Branch",
  "roz.select_main_branch": "Select Main Branch"
};

const keys_ur = {
  "cl.customers_group": "کسٹمرز",
  "cl.customer_management": "کسٹمر مینجمنٹ",
  "cl.hero_banner_title": "مضبوط تعلقات قائم کریں",
  "cl.hero_banner_sub": "لیڈز کو مستقل کسٹمرز میں تبدیل کریں",
  "cl.kpi_branch_user": "برانچ اور صارف کی تفصیلات",
  "cl.f_branch": "برانچ",
  "cl.head_office": "ہیڈ آفس",
  "cl.f_total_users": "کل صارفین",
  "cl.f_active_users": "فعال صارفین",
  "cl.f_inactive_users": "غیر فعال صارفین",
  "cl.kpi_customer_summary": "کسٹمر خلاصہ",
  "cl.f_total_customers": "کل کسٹمرز",
  "cl.f_active_customers": "فعال کسٹمرز",
  "cl.f_new_this_month": "اس ماہ نئے",
  "cl.f_inactive_customers": "غیر فعال کسٹمرز",
  "cl.kpi_pipeline_summary": "کسٹمر پائپ لائن / اسٹیٹس خلاصہ",
  "cl.kpi_country_branch": "ملک / برانچ کسٹمر رپورٹ",
  "cl.f_total_countries": "کل ممالک",
  "cl.f_total_branches": "کل برانچز",
  "cl.f_customers_this_branch": "کسٹمرز (یہ برانچ)",
  "cl.f_top_country": "سر فہرست ملک",
  "cl.search_ph_short": "نام، کمپنی، ملک تلاش کریں...",
  "lp.crumb_local_purchase": "لوکل پرچیز بکنگ",
  "lp.voucher_title": "لوکل پرچیز بکنگ واؤچر",
  "lp.serial_no": "سیریل نمبر",
  "purchase.currency": "کرنسی",
  "roz.branch_category": "برانچ کیٹیگری",
  "roz.business_branch": "بزنس برانچ",
  "roz.clearing_agent_branch": "کلیئرنگ ایجنٹ برانچ",
  "roz.entry_scope_branch": "انٹری اسکوپ برانچ",
  "roz.all_countries": "تمام ممالک",
  "roz.main_branch": "مین برانچ",
  "roz.select_main_branch": "مین برانچ منتخب کریں"
};

const keys_ar = {
  "cl.customers_group": "العملاء",
  "cl.customer_management": "إدارة العملاء",
  "cl.hero_banner_title": "بناء علاقات أقوى",
  "cl.hero_banner_sub": "تحويل العملاء المحتملين إلى عملاء دائمين",
  "cl.kpi_branch_user": "تفاصيل الفرع والمستخدم",
  "cl.f_branch": "الفرع",
  "cl.head_office": "المكتب الرئيسي",
  "cl.f_total_users": "إجمالي المستخدمين",
  "cl.f_active_users": "المستخدمون النشطون",
  "cl.f_inactive_users": "المستخدمون غير النشطين",
  "cl.kpi_customer_summary": "ملخص العملاء",
  "cl.f_total_customers": "إجمالي العملاء",
  "cl.f_active_customers": "العملاء النشطون",
  "cl.f_new_this_month": "جديد هذا الشهر",
  "cl.f_inactive_customers": "العملاء غير النشطين",
  "cl.kpi_pipeline_summary": "مسار العملاء / ملخص الحالة",
  "cl.kpi_country_branch": "تقرير عملاء الدولة / الفرع",
  "cl.f_total_countries": "إجمالي الدول",
  "cl.f_total_branches": "إجمالي الفروع",
  "cl.f_customers_this_branch": "العملاء (هذا الفرع)",
  "cl.f_top_country": "أعلى دولة",
  "cl.search_ph_short": "ابحث عن الاسم، الشركة، الدولة...",
  "lp.crumb_local_purchase": "حجز الشراء المحلي",
  "lp.voucher_title": "سند حجز الشراء المحلي",
  "lp.serial_no": "الرقم التسلسلي",
  "purchase.currency": "العملة",
  "roz.branch_category": "فئة الفرع",
  "roz.business_branch": "فرع الأعمال",
  "roz.clearing_agent_branch": "فرع وكيل التخليص",
  "roz.entry_scope_branch": "فرع نطاق القيد",
  "roz.all_countries": "جميع الدول",
  "roz.main_branch": "الفرع الرئيسي",
  "roz.select_main_branch": "حدد الفرع الرئيسي"
};

const keys_fa = {
  "cl.customers_group": "مشتریان",
  "cl.customer_management": "مدیریت مشتریان",
  "cl.hero_banner_title": "ایجاد روابط قوی‌تر",
  "cl.hero_banner_sub": "تبدیل سرنخ‌ها به مشتریان دائمی",
  "cl.kpi_branch_user": "جزئیات شعبه و کاربر",
  "cl.f_branch": "شعبه",
  "cl.head_office": "دفتر مرکزی",
  "cl.f_total_users": "کل کاربران",
  "cl.f_active_users": "کاربران فعال",
  "cl.f_inactive_users": "کاربران غیرفعال",
  "cl.kpi_customer_summary": "خلاصه مشتریان",
  "cl.f_total_customers": "کل مشتریان",
  "cl.f_active_customers": "مشتریان فعال",
  "cl.f_new_this_month": "جدید این ماه",
  "cl.f_inactive_customers": "مشتریان غیرفعال",
  "cl.kpi_pipeline_summary": "خط لوله مشتریان / خلاصه وضعیت",
  "cl.kpi_country_branch": "گزارش مشتریان کشور / شعبه",
  "cl.f_total_countries": "کل کشورها",
  "cl.f_total_branches": "کل شعبات",
  "cl.f_customers_this_branch": "مشتریان (این شعبه)",
  "cl.f_top_country": "برترین کشور",
  "cl.search_ph_short": "جستجوی نام، شرکت، کشور...",
  "lp.crumb_local_purchase": "ثبت خرید محلی",
  "lp.voucher_title": "سند ثبت خرید محلی",
  "lp.serial_no": "شماره سریال",
  "purchase.currency": "ارز",
  "roz.branch_category": "دسته‌بندی شعبه",
  "roz.business_branch": "شعبه کسب‌وکار",
  "roz.clearing_agent_branch": "شعبه ترخیص‌کار",
  "roz.entry_scope_branch": "شعبه محدوده ثبت",
  "roz.all_countries": "همه کشورها",
  "roz.main_branch": "شعبه اصلی",
  "roz.select_main_branch": "انتخاب شعبه اصلی"
};

const keys_ps = {
  "cl.customers_group": "پیرودونکي",
  "cl.customer_management": "د پیرودونکو مدیریت",
  "cl.hero_banner_title": "قوي اړیکې جوړې کړئ",
  "cl.hero_banner_sub": "احتمالي پیرودونکي په دوامداره پیرودونکو بدل کړئ",
  "cl.kpi_branch_user": "د څانګې او کاروونکي تفصیلات",
  "cl.f_branch": "څانګه",
  "cl.head_office": "مرکزي دفتر",
  "cl.f_total_users": "ټول کاروونکي",
  "cl.f_active_users": "فعال کاروونکي",
  "cl.f_inactive_users": "غیر فعال کاروونکي",
  "cl.kpi_customer_summary": "د پیرودونکو لنډیز",
  "cl.f_total_customers": "ټول پیرودونکي",
  "cl.f_active_customers": "فعال پیرودونکي",
  "cl.f_new_this_month": "پدې میاشت کې نوي",
  "cl.f_inactive_customers": "غیر فعال پیرودونکي",
  "cl.kpi_pipeline_summary": "د پیرودونکو پایپ لاین / د وضعیت لنډیز",
  "cl.kpi_country_branch": "د هېواد / څانګې د پیرودونکو راپور",
  "cl.f_total_countries": "ټول هېوادونه",
  "cl.f_total_branches": "ټولې څانګې",
  "cl.f_customers_this_branch": "پیرودونکي (دا څانګه)",
  "cl.f_top_country": "مخکښ هېواد",
  "cl.search_ph_short": "نوم، شرکت، هېواد لټول...",
  "lp.crumb_local_purchase": "د محلي پیرود بکینګ",
  "lp.voucher_title": "د محلي پیرود بکینګ واؤچر",
  "lp.serial_no": "سیریل شمېره",
  "purchase.currency": "اسعارو",
  "roz.branch_category": "د څانګې کټګوري",
  "roz.business_branch": "د سوداګرۍ څانګه",
  "roz.clearing_agent_branch": "د ګمرکي اجنټ څانګه",
  "roz.entry_scope_branch": "د اندراج د ساحې څانګه",
  "roz.all_countries": "ټول هېوادونه",
  "roz.main_branch": "اصلي څانګه",
  "roz.select_main_branch": "اصلي څانګه وټاکئ"
};

function formatEntries(dict) {
  return Object.entries(dict)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
}

// Inject into en, ur, ar, fa, ps before the end of each block
const langs = [
  { name: "en", entries: formatEntries(keys_en) },
  { name: "ur", entries: formatEntries(keys_ur) },
  { name: "ar", entries: formatEntries(keys_ar) },
  { name: "fa", entries: formatEntries(keys_fa) },
  { name: "ps", entries: formatEntries(keys_ps) }
];

for (const { name, entries } of langs) {
  const blockMarker = `const ${name}: Dict = {`;
  const nextMarker = name === "en" ? "const ur: Dict" :
                     name === "ur" ? "const ar: Dict" :
                     name === "ar" ? "const fa: Dict" :
                     name === "fa" ? "const ps: Dict" :
                     "const dictionaries: Record";
  
  const startIdx = content.indexOf(blockMarker);
  const endIdx = content.indexOf(nextMarker, startIdx);
  if (startIdx === -1 || endIdx === -1) {
    console.error(`Marker for ${name} not found!`);
    process.exit(1);
  }
  
  // Find the last closing brace before nextMarker
  const block = content.slice(startIdx, endIdx);
  const lastBrace = block.lastIndexOf("};");
  if (lastBrace === -1) {
    console.error(`Closing brace for ${name} not found!`);
    process.exit(1);
  }

  const updatedBlock = block.slice(0, lastBrace) + "\n  // --- 33 ELEVATION KEYS ---\n" + entries + "\n" + block.slice(lastBrace);
  content = content.slice(0, startIdx) + updatedBlock + content.slice(endIdx);
}

fs.writeFileSync(UI_FILE, content, "utf8");
console.log("✓ Successfully injected 33 missing keys into all 5 languages in ui.ts");
