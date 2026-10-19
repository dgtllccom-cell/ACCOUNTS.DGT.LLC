const fs = require('fs');

const UI_PATH = 'lib/i18n/ui.ts';
let content = fs.readFileSync(UI_PATH, 'utf8');

const KEYS = [
  {
    key: "paytrack.due_date",
    en: "Agreed Due Date",
    ur: "متفقہ مقررہ تاریخ",
    ar: "تاريخ الاستحقاق المتفق عليه",
    fa: "تاریخ سررسید توافق شده",
    ps: "د موافقه شوې تادیې نېټه"
  },
  {
    key: "paytrack.due_date_not_set",
    en: "Due Date Not Set",
    ur: "تاریخ مقرر نہیں",
    ar: "لم يتم تحديد تاريخ الاستحقاق",
    fa: "تاریخ سررسید تعیین نشده",
    ps: "د تادیې نېټه نه ده ټاکل شوې"
  },
  {
    key: "paytrack.days_remaining",
    en: "Days Remaining",
    ur: "باقی دن",
    ar: "الأيام المتبقية",
    fa: "روزهای باقی‌مانده",
    ps: "پاتې ورځې"
  },
  {
    key: "paytrack.due_today",
    en: "Due Today",
    ur: "آج واجب الادا",
    ar: "مستحق اليوم",
    fa: "سررسید امروز",
    ps: "نن واجب الادا"
  },
  {
    key: "paytrack.overdue",
    en: "Overdue",
    ur: "میعاد ختم",
    ar: "متأخر",
    fa: "سررسید گذشته",
    ps: "ځنډول شوې"
  },
  {
    key: "paytrack.overdue_days",
    en: "Overdue Days",
    ur: "تاخیری دن",
    ar: "أيام التأخير",
    fa: "روزهای تاخیر",
    ps: "د ځنډ ورځې"
  },
  {
    key: "paytrack.outstanding_balance",
    en: "Outstanding Balance",
    ur: "باقی واجب الادا رقم",
    ar: "الرصيد المستحق",
    fa: "مانده معوقه",
    ps: "پاتې پاتې بیلانس"
  },
  {
    key: "paytrack.total_payment_amount",
    en: "Total Payment Amount",
    ur: "کل ادائیگی رقم",
    ar: "إجمالي مبلغ الدفع",
    fa: "مبلغ کل پرداختی",
    ps: "د تادیې ټولټال مقدار"
  },
  {
    key: "paytrack.amount_paid_received",
    en: "Amount Paid / Received",
    ur: "ادا شدہ / وصول شدہ رقم",
    ar: "المبلغ المدفوع / المستلم",
    fa: "مبلغ پرداختی / دریافتی",
    ps: "تادیه شوی / ترلاسه شوی مقدار"
  },
  {
    key: "paytrack.payment_status",
    en: "Payment Status",
    ur: "ادائیگی کی حیثیت",
    ar: "حالة الدفع",
    fa: "وضعیت پرداخت",
    ps: "د تادیې وضعیت"
  },
  {
    key: "paytrack.status_upcoming",
    en: "Upcoming",
    ur: "آئندہ",
    ar: "قادم",
    fa: "پیش رو",
    ps: "راتلونکی"
  },
  {
    key: "paytrack.status_partially_paid",
    en: "Partially Paid",
    ur: "جزوی ادا شدہ",
    ar: "مدفوع جزئياً",
    fa: "پرداخت جزئی",
    ps: "یو څه تادیه شوی"
  },
  {
    key: "paytrack.status_fully_paid",
    en: "Fully Paid",
    ur: "مکمل ادا شدہ",
    ar: "مدفوع بالكامل",
    fa: "کاملاً پرداخت شده",
    ps: "بشپړ تادیه شوی"
  },
  {
    key: "paytrack.money_we_must_pay",
    en: "Purchase Payments — Money We Must Pay",
    ur: "خریداری کی ادائیگیاں — واجب الادا رقم",
    ar: "مدفوعات الشراء — المبالغ المستحقة للدفع",
    fa: "پرداخت‌های خرید — مبالغ پرداختی ما",
    ps: "د پیرودلو تادیات — هغه پیسې چې موږ یې ورکوو"
  },
  {
    key: "paytrack.money_we_must_receive",
    en: "Sales Payments — Money We Must Receive",
    ur: "فروخت کی ادائیگیاں — قابل وصول رقم",
    ar: "مقبوضات المبيعات — المبالغ المستحقة للاستلام",
    fa: "دریافت‌های فروش — مبالغی که باید دریافت کنیم",
    ps: "د پلور تادیات — هغه پیسې چې موږ یې ترلاسه کوو"
  },
  {
    key: "paytrack.crm_payables_receivables",
    en: "Purchase Payables & Sales Receivables",
    ur: "خریداری واجبات اور فروخت وصولیات",
    ar: "ذمم الشراء الدائنة ومستحقات المبيعات المدينة",
    fa: "بدهی‌های خرید و مطالبات فروش",
    ps: "د پیرودلو پورونه او د پلور ترلاسه کول"
  },
  {
    key: "paytrack.five_day_forecast",
    en: "5-Day Payment Forecast",
    ur: "5 روزہ ادائیگی کی پیش گوئی",
    ar: "توقعات المدفوعات لخمسة أيام",
    fa: "پیش‌بینی ۵ روزه پرداخت‌ها",
    ps: "د ۵ ورځو د تادیې وړاندوینه"
  },
  {
    key: "paytrack.today",
    en: "Today",
    ur: "آج",
    ar: "اليوم",
    fa: "امروز",
    ps: "نن"
  },
  {
    key: "paytrack.tomorrow",
    en: "Tomorrow",
    ur: "کل",
    ar: "غداً",
    fa: "فردا",
    ps: "سبا"
  },
  {
    key: "paytrack.day_2",
    en: "Day 2",
    ur: "دوسرا دن",
    ar: "اليوم 2",
    fa: "روز ۲",
    ps: "دویمه ورځ"
  },
  {
    key: "paytrack.day_3",
    en: "Day 3",
    ur: "تیسرا دن",
    ar: "اليوم 3",
    fa: "روز ۳",
    ps: "دریمه ورځ"
  },
  {
    key: "paytrack.day_4",
    en: "Day 4",
    ur: "چوتھا دن",
    ar: "اليوم 4",
    fa: "روز ۴",
    ps: "څلورمه ورځ"
  },
  {
    key: "paytrack.day_5",
    en: "Day 5",
    ur: "پانچواں دن",
    ar: "اليوم 5",
    fa: "روز ۵",
    ps: "پنځمه ورځ"
  },
  {
    key: "paytrack.pay_due_today",
    en: "Purchase Payments Due Today",
    ur: "آج واجب الادا خریداری ادائیگیاں",
    ar: "مدفوعات الشراء المستحقة اليوم",
    fa: "پرداخت‌های خرید سررسید امروز",
    ps: "د پیرودلو تادیات نن واجب الادا"
  },
  {
    key: "paytrack.rec_expected_today",
    en: "Sales Receipts Expected Today",
    ur: "آج متوقع فروخت وصولیاں",
    ar: "مقبوضات المبيعات المتوقعة اليوم",
    fa: "دریافتی‌های فروش مورد انتظار امروز",
    ps: "د پلور پیسې نن تمه کیږي"
  },
  {
    key: "paytrack.pay_due_5days",
    en: "Purchase Payments Due (Next 5 Days)",
    ur: "اگلے 5 دنوں میں واجب الادا خریداری",
    ar: "مدفوعات الشراء المستحقة خلال 5 أيام",
    fa: "پرداخت‌های خرید طی ۵ روز آینده",
    ps: "د پیرودلو تادیات په راتلونکو ۵ ورځو کې"
  },
  {
    key: "paytrack.rec_expected_5days",
    en: "Sales Receipts Expected (Next 5 Days)",
    ur: "اگلے 5 دنوں میں متوقع فروخت وصولیاں",
    ar: "مقبوضات المبيعات المتوقعة خلال 5 أيام",
    fa: "دریافتی‌های فروش مورد انتظار طی ۵ روز آینده",
    ps: "د پلور عواید په راتلونکو ۵ ورځو کې"
  },
  {
    key: "paytrack.overdue_purchases",
    en: "Overdue Purchase Payments",
    ur: "واجب الادا میعاد ختم خریداری",
    ar: "مدفوعات الشراء المتأخرة",
    fa: "پرداخت‌های معوقه خرید",
    ps: "د پیرودلو ځنډول شوې تادیات"
  },
  {
    key: "paytrack.overdue_sales",
    en: "Overdue Sales Receivables",
    ur: "میعاد ختم فروخت وصولیات",
    ar: "مستحقات المبيعات المتأخرة",
    fa: "مطالبات معوقه فروش",
    ps: "د پلور ځنډول شوې پیسې"
  },
  {
    key: "paytrack.total_out_payables",
    en: "Total Outstanding Purchase Payables",
    ur: "کل واجب الادا خریداری بیلانس",
    ar: "إجمالي ذمم الشراء المستحقة",
    fa: "کل بدهی‌های معوقه خرید",
    ps: "د پیرودلو ټول پاتې پورونه"
  },
  {
    key: "paytrack.total_out_receivables",
    en: "Total Outstanding Sales Receivables",
    ur: "کل واجب الوصول فروخت بیلانس",
    ar: "إجمالي مستحقات المبيعات المعلقة",
    fa: "کل مطالبات معوقه فروش",
    ps: "د پلور ټول پاتې عواید"
  },
  {
    key: "paytrack.net_expected_cashflow",
    en: "Net Expected Cash Flow",
    ur: "خالص متوقع نقد بہاؤ",
    ar: "صافي التدفق النقدي المتوقع",
    fa: "جریان نقدی خالص مورد انتظار",
    ps: "خالص تمه کیدونکی نغدي جریان"
  },
  {
    key: "paytrack.cat_advance",
    en: "Advance Payment",
    ur: "پیشگی ادائیگی",
    ar: "دفعة مقدمة",
    fa: "پرداخت پیش‌پرداخت",
    ps: "مخکینۍ تادیه"
  },
  {
    key: "paytrack.cat_endorsement",
    en: "Endorsement Payment",
    ur: "توثیقی ادائیگی",
    ar: "دفع التظهير",
    fa: "پرداخت پشت‌نویسی",
    ps: "د تائیدۍ تادیه"
  },
  {
    key: "paytrack.cat_credit",
    en: "Credit Payment",
    ur: "ادھار ادائیگی",
    ar: "دفع آجل",
    fa: "پرداخت اعتباری",
    ps: "د پور تادیه"
  },
  {
    key: "paytrack.cat_remaining",
    en: "Remaining Payment",
    ur: "باقی ادائیگی",
    ar: "الدفعة المتبقية",
    fa: "پرداخت باقیمانده",
    ps: "پاتې تادیه"
  },
  {
    key: "paytrack.cat_final",
    en: "Final Payment",
    ur: "حتمی ادائیگی",
    ar: "الدفعة النهائية",
    fa: "پرداخت نهایی",
    ps: "وروستۍ تادیه"
  },
  {
    key: "paytrack.cat_sales_advance",
    en: "Advance Payment / Receipt",
    ur: "پیشگی ادائیگی / وصولی",
    ar: "دفعة مقدمة / إيصال",
    fa: "پیش‌پرداخت / رسید",
    ps: "مخکینۍ تادیه / رسید"
  },
  {
    key: "paytrack.cat_sales_credit",
    en: "Credit Payment / Receipt",
    ur: "ادھار ادائیگی / وصولی",
    ar: "دفع آجل / إيصال",
    fa: "پرداخت اعتباری / رسید",
    ps: "د پور تادیه / رسید"
  },
  {
    key: "paytrack.cat_sales_remaining",
    en: "Remaining Payment / Receipt",
    ur: "باقی ادائیگی / وصولی",
    ar: "الدفعة المتبقية / إيصال",
    fa: "پرداخت باقیمانده / رسید",
    ps: "پاتې تادیه / رسید"
  },
  {
    key: "paytrack.cat_sales_final",
    en: "Final Payment",
    ur: "حتمی ادائیگی",
    ar: "الدفعة النهائية",
    fa: "پرداخت نهایی",
    ps: "وروستۍ تادیه"
  },
  {
    key: "paytrack.set_due_date",
    en: "Set / Update Due Date",
    ur: "مقررہ تاریخ مقرر / تبدیل کریں",
    ar: "تحديد / تعديل تاريخ الاستحقاق",
    fa: "تنظیم / به‌روزرسانی تاریخ سررسید",
    ps: "د مقررې نیټې ټاکل / تازه کول"
  },
  {
    key: "paytrack.agreed_payment_due_date",
    en: "Agreed Payment Due Date",
    ur: "متفقہ ادائیگی کی تاریخ",
    ar: "تاريخ استحقاق الدفع المتفق عليه",
    fa: "تاریخ سررسید توافق‌شده پرداخت",
    ps: "د تادیې موافقه شوې نېټه"
  },
  {
    key: "paytrack.supplier_or_customer",
    en: "Supplier / Customer Name",
    ur: "سپلائر / کسٹمر کا نام",
    ar: "اسم المورد / العميل",
    fa: "نام تامین‌کننده / مشتری",
    ps: "د عرضه کوونکي / پیرودونکي نوم"
  },
  {
    key: "paytrack.bill_or_invoice_no",
    en: "Bill / Invoice No",
    ur: "بل / انوائس نمبر",
    ar: "رقم الفاتورة",
    fa: "شماره صورتحساب / فاکتور",
    ps: "د بل / انوایس شمیره"
  },
  {
    key: "paytrack.history_recorded_due_date",
    en: "Recorded Due Date",
    ur: "درج شدہ مقررہ تاریخ",
    ar: "تاريخ الاستحقاق المسجل",
    fa: "تاریخ سررسید ثبت‌شده",
    ps: "ثبت شوې نیټه"
  },
  {
    key: "paytrack.history_payment_date",
    en: "Payment Date",
    ur: "ادائیگی کی تاریخ",
    ar: "تاريخ الدفع",
    fa: "تاریخ پرداخت",
    ps: "د تادیې نیټه"
  },
  {
    key: "paytrack.historical_status",
    en: "Historical Status",
    ur: "تاریخی حیثیت",
    ar: "الحالة التاريخية",
    fa: "وضعیت تاریخی",
    ps: "تاریخي وضعیت"
  },
  {
    key: "paytrack.save_due_date",
    en: "Save Due Date",
    ur: "مقررہ تاریخ محفوظ کریں",
    ar: "حفظ تاريخ الاستحقاق",
    fa: "ذخیره تاریخ سررسید",
    ps: "مقرره نیټه خوندي کړئ"
  },
  {
    key: "paytrack.due_date_saved",
    en: "Agreed due date updated successfully.",
    ur: "متفقہ تاریخ کامیابی سے محفوظ ہو گئی۔",
    ar: "تم تحديث تاريخ الاستحقاق المتفق عليه بنجاح.",
    fa: "تاریخ سررسید با موفقیت به‌روزرسانی شد.",
    ps: "موافقه شوې نیټه په بریالیتوب سره تازه شوه."
  },
  {
    key: "paytrack.category_breakdown",
    en: "Payment Category Breakdown",
    ur: "ادائیگی زمرہ جات کی تفصیل",
    ar: "تفصيل فئات المدفوعات",
    fa: "تفکیک دسته‌بندی پرداخت",
    ps: "د تادیاتو د کټګورۍ تفصیل"
  },
  {
    key: "paytrack.all_categories",
    en: "All Categories",
    ur: "تمام زمرہ جات",
    ar: "جميع الفئات",
    fa: "همه دسته‌ها",
    ps: "ټولې کټګورۍ"
  },
  {
    key: "paytrack.open_payment_page",
    en: "Open Payment Page",
    ur: "ادائیگی صفحہ کھولیں",
    ar: "فتح صفحة الدفع",
    fa: "باز کردن صفحه پرداخت",
    ps: "د تادیې پاڼه پرانیزئ"
  }
];

// Check if first key already exists
if (content.includes('"paytrack.due_date"')) {
  console.log('Keys already present in ui.ts');
  process.exit(0);
}

// 1. Add to UiKey type definition
const typeUnion = KEYS.map(k => `  | "${k.key}"`).join('\n');
const typeTarget = '  // Registered Truck redesign (trk.* additions, 2026-09-09)\n';
content = content.replace(typeTarget, `  // Payment Due Tracking & CRM Forecast\n${typeUnion}\n${typeTarget}`);

// 2. Add to EN
const enEntries = KEYS.map(k => `  "${k.key}": "${k.en}",`).join('\n');
const enTarget = '  "trk.registered_truck_title": "Clearing Truck Registration",';
content = content.replace(enTarget, `${enEntries}\n${enTarget}`);

// 3. Add to UR
const urEntries = KEYS.map(k => `  "${k.key}": "${k.ur}",`).join('\n');
const urTarget = '  "trk.registered_truck_title": "کلیئرنگ ٹرک رجسٹریشن",';
content = content.replace(urTarget, `${urEntries}\n${urTarget}`);

// 4. Add to AR
const arEntries = KEYS.map(k => `  "${k.key}": "${k.ar}",`).join('\n');
const arTarget = '  "trk.registered_truck_title": "تسجيل شاحنة التخليص",';
content = content.replace(arTarget, `${arEntries}\n${arTarget}`);

// 5. Add to FA
const faEntries = KEYS.map(k => `  "${k.key}": "${k.fa}",`).join('\n');
const faTarget = '  "trk.registered_truck_title": "ثبت کامیون ترخیص",';
content = content.replace(faTarget, `${faEntries}\n${faTarget}`);

// 6. Add to PS
const psEntries = KEYS.map(k => `  "${k.key}": "${k.ps}",`).join('\n');
const psTarget = '  "trk.registered_truck_title": "د کلیرنس د لارۍ راجستر",';
content = content.replace(psTarget, `${psEntries}\n${psTarget}`);

fs.writeFileSync(UI_PATH, content, 'utf8');
console.log(`Added ${KEYS.length} keys across all 5 language blocks in ui.ts!`);
