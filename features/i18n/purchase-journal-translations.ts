// Full-scale translations dictionary for purchase order payment journal
// Supports 5 languages: en (English), ur (Urdu), ar (Arabic), fa (Persian), ps (Pashto)

export type LanguageCode = "en" | "ur" | "ar" | "fa" | "ps";

export const UI_TRANSLATIONS: Record<string, Record<LanguageCode, string>> = {
  // Page headers & tabs
  "page_title": {
    en: "Traceable Purchase Order Payment Journal",
    ur: "ٹریک ایبل پرچیز آرڈر پیمنٹ جرنل",
    ar: "دفتر يوميات مدفوعات طلب الشراء القابل للتتبع",
    fa: "دفتر روزنامه پرداخت سفارش خرید قابل پیگیری",
    ps: "د تعقیب وړ پیرود امر تادیې ژورنال"
  },
  "page_title_sales": {
    en: "Traceable Sales Order Payment Journal",
    ur: "ٹریک ایبل سیلز آرڈر پیمنٹ جرنل",
    ar: "دفتر يوميات مدفوعات طلب البيع القابل للتتبع",
    fa: "دفتر روزنامه پرداخت سفارش فروش قابل پیگیری",
    ps: "د تعقیب وړ پلور امر تادیې ژورنال"
  },
  "search_placeholder": {
    en: "Search by PO#, contract, status, supplier name, country, city...",
    ur: "پرچیز آرڈر نمبر، معاہدہ، حیثیت، سپلائر کا نام، ملک، شہر سے تلاش کریں...",
    ar: "ابحث برقم طلب الشراء، العقد، الحالة، اسم المورد، البلد، المدينة...",
    fa: "جستجو بر اساس شماره سفارش، قرارداد، وضعیت، نام تأمین‌کننده، کشور، شهر...",
    ps: "د پیرود امر، قرارداد، حالت، چمتو کونکي نوم، هیواد، ښار په واسطه لټون وکړئ..."
  },
  "no_payment_records_found": {
    en: "No payment records found.",
    ur: "کوئی ادائیگی کا ریکارڈ نہیں ملا۔",
    ar: "لم يتم العثور على سجلات دفع.",
    fa: "هیچ رکورد پرداختی یافت نشد.",
    ps: "د تادیې هیڅ ریکارډ ونه موندل شو."
  },
  "try_adjusting_filters": {
    en: "Try adjusting filters or check if orders are posted.",
    ur: "فلٹرز تبدیل کریں یا چیک کریں کہ آرڈرز پوسٹ ہوئے ہیں یا نہیں۔",
    ar: "حاول تعديل المرشحات أو تحقق مما إذا كانت الطلبات قد تم ترحيلها.",
    fa: "فیلترها را تنظیم کنید یا بررسی کنید که آیا سفارش‌ها ثبت شده‌اند.",
    ps: "فلټرونه سم کړئ یا وګورئ چې ایا امرونه پوسټ شوي دي."
  },
  "rows_per_page": {
    en: "Rows per page:",
    ur: "فی صفحہ قطاریں:",
    ar: "الصفوف لكل صفحة:",
    fa: "ردیف‌ها در هر صفحه:",
    ps: "په هر مخ کې قطارونه:"
  },
  "showing": {
    en: "Showing",
    ur: "دکھایا جا رہا ہے",
    ar: "عرض",
    fa: "نمایش",
    ps: "ښودل کیږي"
  },
  "of_records": {
    en: "of",
    ur: "میں سے",
    ar: "من",
    fa: "از",
    ps: "له"
  },
  "records_word": {
    en: "records",
    ur: "ریکارڈز",
    ar: "سجلات",
    fa: "رکوردها",
    ps: "ریکارډونه"
  },
  "range_to": {
    en: "to",
    ur: "تا",
    ar: "إلى",
    fa: "تا",
    ps: "تر"
  },
  "previous_page": {
    en: "Previous page",
    ur: "پچھلا صفحہ",
    ar: "الصفحة السابقة",
    fa: "صفحه قبلی",
    ps: "پخوانی مخ"
  },
  "next_page": {
    en: "Next page",
    ur: "اگلا صفحہ",
    ar: "الصفحة التالية",
    fa: "صفحه بعدی",
    ps: "بل مخ"
  },
  "loading_records": {
    en: "Loading records...",
    ur: "ریکارڈز لوڈ ہو رہے ہیں...",
    ar: "جارٍ تحميل السجلات...",
    fa: "در حال بارگذاری رکوردها...",
    ps: "ریکارډونه بارېږي..."
  },
  "loading_history": {
    en: "Loading history...",
    ur: "ہسٹری لوڈ ہو رہی ہے...",
    ar: "جارٍ تحميل السجل...",
    fa: "در حال بارگذاری تاریخچه...",
    ps: "تاریخچه بارېږي..."
  },
  "converted_currency_flow": {
    en: "Converted Currency Flow",
    ur: "تبدیل شدہ کرنسی فلو",
    ar: "تدفق العملة المحوّلة",
    fa: "جریان ارز تبدیل‌شده",
    ps: "د بدل شوي اسعارو جریان"
  },
  "converted_local_amount": {
    en: "Converted Local Amount:",
    ur: "تبدیل شدہ مقامی رقم:",
    ar: "المبلغ المحلي المحوّل:",
    fa: "مبلغ محلی تبدیل‌شده:",
    ps: "بدل شوی سیمه ایز اندازه:"
  },
  "local_currency_advance": {
    en: "Local Currency Advance",
    ur: "مقامی کرنسی ایڈوانس",
    ar: "سلفة العملة المحلية",
    fa: "پیش‌پرداخت ارز محلی",
    ps: "د سیمه ایز اسعارو پیش"
  },
  "remaining_local_balance": {
    en: "Remaining Local Balance:",
    ur: "بقایا مقامی بیلنس:",
    ar: "الرصيد المحلي المتبقي:",
    fa: "موجودی محلی باقیمانده:",
    ps: "پاتې سیمه ایز بیلانس:"
  },
  "traceable_payment_history": {
    en: "Traceable Payment History (Nested Journal Entries)",
    ur: "ٹریک ایبل ادائیگی کی تاریخ (نیسٹڈ جرنل اندراجات)",
    ar: "سجل الدفع القابل للتتبع (قيود يومية متداخلة)",
    fa: "تاریخچه پرداخت قابل پیگیری (ورودی‌های تودرتوی روزنامه)",
    ps: "د تعقیب وړ تادیې تاریخچه (ننه شوي ژورنال ننوتنې)"
  },
  "loading_container_records": {
    en: "Loading container records...",
    ur: "کنٹینر ریکارڈز لوڈ ہو رہے ہیں...",
    ar: "جارٍ تحميل سجلات الحاوية...",
    fa: "در حال بارگذاری رکوردهای کانتینر...",
    ps: "د کانتینر ریکارډونه بارېږي..."
  },
  "select_loaded_container": {
    en: "Select a Loaded Container to Process Payment",
    ur: "ادائیگی کی کارروائی کے لیے لوڈڈ کنٹینر منتخب کریں",
    ar: "حدد حاوية محملة لمعالجة الدفع",
    fa: "برای پردازش پرداخت یک کانتینر بارگیری‌شده انتخاب کنید",
    ps: "د تادیې د پروسس لپاره یو بار شوی کانتینر وټاکئ"
  },
  "select_container_instruction": {
    en: "Remaining payments must be processed separately for each loaded container record. Please select one of the loaded containers below to continue:",
    ur: "بقایا ادائیگیاں ہر لوڈڈ کنٹینر ریکارڈ کے لیے الگ الگ کی جانی چاہئیں۔ جاری رکھنے کے لیے نیچے دیے گئے کنٹینرز میں سے ایک منتخب کریں:",
    ar: "يجب معالجة الدفعات المتبقية بشكل منفصل لكل سجل حاوية محملة. الرجاء اختيار إحدى الحاويات المحملة أدناه للمتابعة:",
    fa: "پرداخت‌های باقیمانده باید برای هر رکورد کانتینر بارگیری‌شده به‌طور جداگانه پردازش شوند. لطفاً یکی از کانتینرهای زیر را برای ادامه انتخاب کنید:",
    ps: "پاتې تادیې باید د هر بار شوي کانتینر ریکارډ لپاره جلا جلا وپروسس شي. مهرباني وکړئ د دوام لپاره لاندې یو کانتینر وټاکئ:"
  },
  "filters": {
    en: "Filters",
    ur: "فلٹرز",
    ar: "الفلاتر",
    fa: "فیلترها",
    ps: "فلټرونه"
  },
  "all_drafts": {
    en: "All Clearance Status",
    ur: "تمام کلیئرنس کی حیثیت",
    ar: "جميع حالات التخليص",
    fa: "همه وضعیت‌های تسویه",
    ps: "د تصفیې ټول حالتونه"
  },
  "all_countries": {
    en: "All Countries",
    ur: "تمام ممالک",
    ar: "جميع البلدان",
    fa: "همه کشورها",
    ps: "ټول هیوادونه"
  },
  "all_branches": {
    en: "All Branches",
    ur: "تمام برانچز",
    ar: "جميع الفروع",
    fa: "همه شعبه‌ها",
    ps: "ټولې څانګې"
  },
  "all_currencies": {
    en: "All Currencies",
    ur: "تمام کرنسیاں",
    ar: "جميع العملات",
    fa: "همه ارزها",
    ps: "ټولې اسعار"
  },
  "reset_all": {
    en: "Reset",
    ur: "ریسیٹ",
    ar: "إعادة ضبط",
    fa: "بازنشانی",
    ps: "بیا تنظیمول"
  },

  // Box 1: Super Admin Country Report
  "super_admin_report_title": {
    en: "1. SUPER ADMIN COUNTRY REPORT",
    ur: "1. سپر ایڈمن کنٹری رپورٹ",
    ar: "1. تقرير البلد للمسؤول الفائق",
    fa: "1. گزارش کشور مدیر کل",
    ps: "1. د سوپر اډمین د هیواد راپور"
  },
  "country": {
    en: "Country",
    ur: "ملک",
    ar: "البلد",
    fa: "کشور",
    ps: "هیواد"
  },
  "branch": {
    en: "Branch",
    ur: "برانچ",
    ar: "الفرع",
    fa: "شعبه",
    ps: "څانګه"
  },
  "scope": {
    en: "Scope",
    ur: "دائرہ کار",
    ar: "النطاق",
    fa: "محدوده",
    ps: "حوزه"
  },
  "user_id": {
    en: "User ID",
    ur: "صارف آئی ڈی",
    ar: "معرف المستخدم",
    fa: "شناسه کاربر",
    ps: "کارن پیژند"
  },
  "name": {
    en: "Name",
    ur: "نام",
    ar: "الاسم",
    fa: "نام",
    ps: "نوم"
  },
  "role": {
    en: "Role",
    ur: "کردار",
    ar: "الدور",
    fa: "نقش",
    ps: "رول"
  },
  "time": {
    en: "Time",
    ur: "وقت",
    ar: "الوقت",
    fa: "زمان",
    ps: "وخت"
  },
  "status": {
    en: "Status",
    ur: "حیثیت",
    ar: "الحالة",
    fa: "وضعیت",
    ps: "حالت"
  },
  "active": {
    en: "Active",
    ur: "فعال",
    ar: "نشط",
    fa: "فعال",
    ps: "فعال"
  },
  "global_all": {
    en: "GLOBAL (ALL)",
    ur: "عالمی (تمام)",
    ar: "عالمي (الكل)",
    fa: "جهانی (همه)",
    ps: "نړیوال (ټول)"
  },

  // Table Columns
  "col_po_number": {
    en: "PO Number",
    ur: "آرڈر نمبر",
    ar: "رقم طلب الشراء",
    fa: "شماره سفارش",
    ps: "د امر شمیره"
  },
  "col_bill_date": {
    en: "Bill & Date",
    ur: "بل اور تاریخ",
    ar: "الفاتورة والتاريخ",
    fa: "صورتحساب و تاریخ",
    ps: "بل او نیټه"
  },
  "col_branch_country": {
    en: "Branch & Country",
    ur: "برانچ اور ملک",
    ar: "الفرع والبلد",
    fa: "شعبه و کشور",
    ps: "څانګه او هیواد"
  },
  "col_supplier_seller": {
    en: "Supplier / Seller",
    ur: "سپلائر / بیچنے والا",
    ar: "المورد / البائع",
    fa: "تأمین‌کننده / فروشنده",
    ps: "چمتو کونکی / پلورونکی"
  },
  "col_currency": {
    en: "Curr",
    ur: "کرنسی",
    ar: "العملة",
    fa: "ارز",
    ps: "اسعار"
  },
  "col_total_value": {
    en: "Total Value",
    ur: "کل مالیت",
    ar: "القيمة الإجمالية",
    fa: "ارزش کل",
    ps: "ټول ارزښت"
  },
  "col_paid_amount": {
    en: "Paid Amount",
    ur: "ادا شدہ رقم",
    ar: "المبلغ المدفوع",
    fa: "مبلغ پرداخت شده",
    ps: "تادیه شوی مقدار"
  },
  "col_remaining_balance": {
    en: "Remaining Balance",
    ur: "باقی ماندہ بیلنس",
    ar: "الرصيد المتبقي",
    fa: "مانده باقی‌مانده",
    ps: "پاتې بیلانس"
  },
  "col_status_action": {
    en: "Status & Action",
    ur: "حیثیت اور کارروائی",
    ar: "الحالة والإجراء",
    fa: "وضعیت و اقدام",
    ps: "حالت او عمل"
  },
  "total_summary": {
    en: "Total Summary",
    ur: "کل خلاصہ",
    ar: "الملخص الإجمالي",
    fa: "خلاصه کل",
    ps: "ټولیز لنډیز"
  },

  // Box 2: Purchase & Payment Report
  "report_title": {
    en: "2. PURCHASE & PAYMENT REPORT",
    ur: "2. پرچیز اور پیمنٹ رپورٹ",
    ar: "2. تقرير الشراء والدفع",
    fa: "2. گزارش خرید و پرداخت",
    ps: "2. د پیرود او تادیې راپور"
  },
  "purchase_summary": {
    en: "Purchase Summary",
    ur: "پرچیز خلاصہ",
    ar: "ملخص المشتريات",
    fa: "خلاصه خرید",
    ps: "د پیرود لنډیز"
  },
  "advance_summary": {
    en: "Advance Summary",
    ur: "ایڈوانس خلاصہ",
    ar: "ملخص الدفعات المقدمة",
    fa: "خلاصه پیش‌پرداخت",
    ps: "د پرمختګ لنډیز"
  },
  "paid_advance": {
    en: "Paid Advance",
    ur: "ادا شدہ ایڈوانس",
    ar: "الدفعة المقدمة المدفوعة",
    fa: "پیش‌پرداخت پرداخت شده",
    ps: "تادیه شوی پرمختګ"
  },
  "remaining_advance": {
    en: "Remaining Advance",
    ur: "باقی ماندہ ایڈوانس",
    ar: "الدفعة المقدمة المتبقية",
    fa: "پیش‌پرداخت باقی‌مانده",
    ps: "پاتې پرمختګ"
  },
  "currencies": {
    en: "Purchase Currencies",
    ur: "پرچیز کرنسیاں",
    ar: "عملات الشراء",
    fa: "ارزهای خرید",
    ps: "د پیرود اسعار"
  },
  "total_purchase_fc": {
    en: "Total Purchase (FC)",
    ur: "کل پرچیز (غیر ملکی کرنسی)",
    ar: "إجمالي الشراء (عملة أجنبية)",
    fa: "کل خرید (ارز خارجی)",
    ps: "ټول پیرود (بهرني اسعار)"
  },
  "total_purchase_lc": {
    en: "Total Purchase",
    ur: "کل پرچیز",
    ar: "إجمالي الشراء",
    fa: "کل خرید",
    ps: "ټول پیرود"
  },
  "avg_rate": {
    en: "Avg Conversion Rate",
    ur: "اوسط شرح تبادلہ",
    ar: "متوسط معدل التحويل",
    fa: "میانگین نرخ تبدیل",
    ps: "د تبادلې اوسط نرخ"
  },
  "cleared_records": {
    en: "Cleared Records",
    ur: "صاف شدہ ریکارڈز",
    ar: "السجلات المخلصة",
    fa: "سوابق تسویه شده",
    ps: "پاک شوي ریکارډونه"
  },
  "remaining_ratio": {
    en: "Remaining Ratio",
    ur: "باقی ماندہ تناسب",
    ar: "النسبة المتبقية",
    fa: "نسبت باقی‌مانده",
    ps: "پاتې تناسب"
  },

  // Modal payment fields
  "payment_entry_title": {
    en: "Payment Entry",
    ur: "ادائیگی کا اندراج",
    ar: "إدخال دفعة مالية",
    fa: "ثبت پرداخت",
    ps: "د تادیې ننوتل"
  },
  "active_bill_selection": {
    en: "Active Bill Selection",
    ur: "فعال بل کا انتخاب",
    ar: "تحديد الفاتورة النشطة",
    fa: "انتخاب صورتحساب فعال",
    ps: "د فعال بل انتخاب"
  },
  "contract": {
    en: "Contract",
    ur: "معاہدہ",
    ar: "العقد",
    fa: "قرارداد",
    ps: "قرار داد"
  },
  "total_value_modal": {
    en: "Total Value",
    ur: "کل مالیت",
    ar: "القيمة الإجمالية",
    fa: "ارزش کل",
    ps: "ټول ارزښت"
  },
  "paid_advance_modal": {
    en: "Paid Advance",
    ur: "ادا شدہ ایڈوانس",
    ar: "الدفعة المقدمة المدفوعة",
    fa: "پیش‌پرداخت پرداخت شده",
    ps: "تادیه شوی پرمختګ"
  },
  "remaining_advance_due": {
    en: "Remaining Advance Due",
    ur: "باقی ماندہ ایڈوانس واجب الادا",
    ar: "الدفعة المقدمة المتبقية المستحقة",
    fa: "پیش‌پرداخت باقی‌مانده سررسید",
    ps: "د پاتې کیدو تادیه"
  },
  "ledger_posting_guide": {
    en: "Double-Entry Posting Guide",
    ur: "ڈبل انٹری پوسٹنگ گائیڈ",
    ar: "دليل الترحيل مزدوج القيد",
    fa: "راهنمای ثبت دوطرفه",
    ps: "د ډبل انټري پوسټ کولو لارښود"
  },
  "ledger_posting_desc": {
    en: "Every transaction balances dynamically. When you process a payment: The Debit (Dr) records are updated to settle liabilities with the seller/supplier. The Credit (Cr) records deduct funds from your payment source ledger. Exchange conversion calculates local currency value automatically.",
    ur: "ہر لین دین متحرک طور پر متوازن ہوتا ہے۔ جب آپ ادائیگی پروسیس کرتے ہیں: ڈیبٹ (Dr) ریکارڈز کو بیچنے والے/سپلائر کے ساتھ واجبات کو طے کرنے کے لیے اپ ڈیٹ کیا جاتا ہے۔ کریڈٹ (Cr) ریکارڈز آپ کے ادائیگی کے ماخذ لیجر سے فنڈز کاٹتے ہیں۔ شرح تبادلہ مقامی کرنسی کی قیمت کا خود بخود حساب لگاتا ہے۔",
    ar: "كل معاملة تتوازن ديناميكيًا. عندما تقوم بمعالجة دفعة: يتم تحديث سجلات المدين (Dr) لتسوية الالتزامات مع البائع/المورد. تخصم سجلات الدائن (Cr) الأموال من دفتر حسابات مصدر الدفع الخاص بك. يحسب تحويل العملات قيمة العملة المحلية تلقائيًا.",
    fa: "هر تراکنش به صورت پویا متعادل می‌شود. هنگامی که یک پرداخت را پردازش می‌کنید: سوابق بدهکار (Dr) برای تسویه بدهی‌ها با فروشنده/تأمین‌کننده به‌روزرسانی می‌شوند. سوابق بستانکار (Cr) وجوه را از دفتر کل منبع پرداخت شما کسر می‌کنند. تبدیل ارز ارزش ارز محلی را به‌طور خودکار محاسبه می‌کند.",
    ps: "هر معامله په متحرک ډول متوازن کیږي. کله چې تاسو تادیه پروسس کوئ: د ډیبیټ (Dr) ریکارډونه د پلورونکي / چمتو کونکي سره د مکلفیتونو د حل کولو لپاره تازه کیږي. د کریډیټ (Cr) ریکارډونه ستاسو د تادیې سرچینې لیجر څخه فنډونه کموي. د تبادلې تبادله په اوتومات ډول د ځایی اسعارو ارزښت محاسبه کوي."
  },
  "close_details": {
    en: "Close Details",
    ur: "تفصیلات بند کریں",
    ar: "إغلاق التفاصيل",
    fa: "بستن جزئیات",
    ps: "توضیحات بند کړئ"
  },
  "print_full_receipt": {
    en: "Print Full A4 Invoice (PDF)",
    ur: "مکمل A4 رسید پرنٹ کریں (PDF)",
    ar: "طباعة فاتورة A4 كاملة (PDF)",
    fa: "چاپ فاکتور کامل A4 (PDF)",
    ps: "بشپړ A4 رسید چاپ کړئ (PDF)"
  },
  "reference_no": {
    en: "Reference No",
    ur: "حوالہ نمبر",
    ar: "رقم المرجع",
    fa: "شماره مرجع",
    ps: "د حوالې شمیره"
  },
  "payment_date": {
    en: "Payment Date",
    ur: "ادائیگی کی تاریخ",
    ar: "تاريخ الدفع",
    fa: "تاریخ پرداخت",
    ps: "د تادیې نیټه"
  },
  "attachment_upload": {
    en: "Attachment Upload",
    ur: "منسلک فائل اپ لوڈ",
    ar: "تحميل المرفق",
    fa: "آپلود پیوست",
    ps: "د فایل ضمیمه اپلوډ"
  },
  "remarks_narration": {
    en: "Remarks / Narration",
    ur: "ریمارکس / تفصیل",
    ar: "الملاحظات / البيان",
    fa: "توضیحات / شرح",
    ps: "تبصرې / تفصیل"
  },
  "process_payment_button": {
    en: "Process & Balance Double Entry Voucher",
    ur: "پروسیس اور بیلنس ڈبل انٹری واؤچر",
    ar: "معالجة وموازنة قسيمة القيد المزدوج",
    fa: "پردازش و تراز کردن سند دوطرفه",
    ps: "د ډبل انټري واؤچر پروسس او بیلنس کړئ"
  },
  "payment_success_msg": {
    en: "Double-entry ledger voucher successfully balanced!",
    ur: "ڈبل انٹری لیجر واؤچر کامیابی سے متوازن ہو گیا ہے!",
    ar: "تم موازنة قسيمة حساب الأستاذ مزدوجة القيد بنجاح!",
    fa: "سند دفتر کل دوطرفه با موفقیت تراز شد!",
    ps: "د ډبل انټري لیجر واؤچر په بریالیتوب سره متوازن شو!"
  },
  "validation_error_msg": {
    en: "Invalid ledger account selection. Please ensure accounts are mapped.",
    ur: "غلط لیجر اکاؤنٹ کا انتخاب۔ براہ کرم اکاؤنٹس کے میپ ہونے کو یقینی بنائیں۔",
    ar: "تحديد غير صالح لحساب الأستاذ. يرجى التأكد من ربط الحسابات.",
    fa: "انتخاب حساب دفتر کل نامعتبر است. لطفاً از اتصال حساب‌ها اطمینان حاصل کنید.",
    ps: "د غلط لیجر حساب انتخاب. مهرباني وکړئ ډاډ ترلاسه کړئ چې حسابونه نقشه شوي دي."
  },
  "payment_method": {
    en: "Payment Method",
    ur: "ادائیگی کا طریقہ",
    ar: "طريقة الدفع",
    fa: "روش پرداخت",
    ps: "د تادیې طریقه"
  },
  "bank_name": {
    en: "Bank Name",
    ur: "بینک کا نام",
    ar: "اسم البنك",
    fa: "نام بانک",
    ps: "د بانک نوم"
  },
  "remarks": {
    en: "Remarks",
    ur: "ریمارکس",
    ar: "الملاحظات",
    fa: "توضیحات",
    ps: "تبصرې"
  },
  "transacted_by": {
    en: "Transacted By",
    ur: "معاملہ کار",
    ar: "تمت المعاملة بواسطة",
    fa: "انجام دهنده تراکنش",
    ps: "معامله کونکی"
  },
  "date_and_time": {
    en: "Date & Time",
    ur: "تاریخ اور وقت",
    ar: "التاريخ والوقت",
    fa: "تاریخ و زمان",
    ps: "نیټه او وخت"
  },
  "ledger_postings": {
    en: "Ledger Postings",
    ur: "لیجر پوسٹنگز",
    ar: "ترحيلات الحسابات",
    fa: "ثبت‌های دفتر کل",
    ps: "د لیجر پوسټونه"
  },
  "actions": {
    en: "Actions",
    ur: "کارروائیاں",
    ar: "العمليات",
    fa: "عملیات‌ها",
    ps: "عملونه"
  },
  "currency_rate": {
    en: "Exchange Rate",
    ur: "شرح تبادلہ",
    ar: "سعر الصرف",
    fa: "نرخ ارز",
    ps: "د تبادلې نرخ"
  },

  // Payment status values
  "Pending": {
    en: "Pending",
    ur: "زیر التواء",
    ar: "قيد الانتظار",
    fa: "در انتظار",
    ps: "پاتې"
  },
  "Paid": {
    en: "Paid",
    ur: "ادا شدہ",
    ar: "مدفوع",
    fa: "پرداخت شده",
    ps: "تادیه شوی"
  },
  "Completed": {
    en: "Completed",
    ur: "مکمل",
    ar: "مكتمل",
    fa: "تکمیل شده",
    ps: "بشپړ شوی"
  },
  "Cleared": {
    en: "Cleared",
    ur: "کلیئر",
    ar: "تمت التسوية",
    fa: "تسویه شده",
    ps: "پاک شوی"
  },
  "Posted": {
    en: "Posted",
    ur: "پوسٹ شدہ",
    ar: "مرحل",
    fa: "ثبت شده",
    ps: "پوسټ شوی"
  },
  "Transferred": {
    en: "Transferred",
    ur: "منتقل شدہ",
    ar: "محول",
    fa: "منتقل شده",
    ps: "لیږدول شوی"
  },
  "transaction_entry_preview": {
    en: "Transaction Entry Preview",
    ur: "ٹرانزیکشن انٹری کا پیش نظارہ",
    ar: "معاينة إدخال المعاملة",
    fa: "پیش‌نمایش ثبت تراکنش",
    ps: "د معاملې ننوتلو دمخه لید"
  },
  "narration_remarks": {
    en: "Narration / Remarks",
    ur: "تفصیل / ریمارکس",
    ar: "السرد / الملاحظات",
    fa: "شرح / ملاحظات",
    ps: "تفصیل / څرګندونې"
  },
  "double_entry_posting_preview": {
    en: "Double-Entry Journal Posting Preview",
    ur: "ڈبل انٹری جرنل پوسٹنگ کا پیش نظارہ",
    ar: "معاينة ترحيل القيود المزدوجة",
    fa: "پیش‌نمایش ثبت دفتر روزنامه دوطرفه",
    ps: "د ډبل انټري ژورنال پوسټ کولو دمخه لید"
  },
  "double_entry_posting_guide": {
    en: "Double-Entry Posting Guide",
    ur: "ڈبل انٹری پوسٹنگ گائیڈ",
    ar: "دليل ترحيل القيد المزدوج",
    fa: "راهنمای ثبت دوطرفه",
    ps: "د ډبل انټري پوسټ کولو لارښود"
  },
  "every_transaction_balances": {
    en: "Every transaction balances dynamically. When you process a payment:",
    ur: "ہر ٹرانزیکشن متحرک طور پر متوازن ہوتی ہے۔ جب آپ ادائیگی پروسیس کرتے ہیں:",
    ar: "تتوازن كل معاملة ديناميكيًا. عند معالجة الدفع:",
    fa: "هر تراکنش به صورت پویا متوازن می‌شود. هنگام پردازش پرداخت:",
    ps: "هر معامله په متحرک ډول متوازن کیږي. کله چې تاسو تادیه پروسس کوئ:"
  },
  "debit_records_updated": {
    en: "The Debit (Dr) records are updated to settle liabilities with the seller/supplier.",
    ur: "ڈیبٹ (Dr) ریکارڈز بیچنے والے/سپلائر کے ساتھ واجبات کی ادائیگی کے لیے اپ ڈیٹ کیے جاتے ہیں۔",
    ar: "يتم تحديث سجلات المدين (Dr) لتسوية الالتزامات مع البائع/المورد.",
    fa: "سوابق بدهکار (Dr) برای تسویه بدهی‌ها با فروشنده/تأمین‌کننده به‌روزرسانی می‌شوند.",
    ps: "د ډیبیټ (Dr) ریکارډونه د پلورونکي/چمتو کونکي سره د مکلفیتونو د تصفیې لپاره تازه کیږي."
  },
  "credit_records_deduct": {
    en: "The Credit (Cr) records deduct funds from your payment source ledger.",
    ur: "کریڈٹ (Cr) ریکارڈز آپ کے ادائیگی کے سورس لیجر سے فنڈز کاٹتے ہیں۔",
    ar: "تخصم سجلات الدائن (Cr) الأموال من دفتر حساب مصدر الدفع الخاص بك.",
    fa: "سوابق بستانکار (Cr) وجوه را از دفتر کل منبع پرداخت شما کسر می‌کنند.",
    ps: "د کریډیټ (Cr) ریکارډونه ستاسو د تادیې سرچینې لیجر څخه فنډونه کموي."
  },
  "exchange_conversion_calculates": {
    en: "Exchange conversion calculates local currency value ({baseCurrency}) automatically.",
    ur: "ایکسچینج کنورژن مقامی کرنسی کی قدر ({baseCurrency}) خود کار طریقے سے حساب کرتی ہے۔",
    ar: "يحسب تحويل العملة القيمة بالعملة المحلية ({baseCurrency}) تلقائيًا.",
    fa: "تبدیل ارز ارزش ارز محلی ({baseCurrency}) را به طور خودکار محاسبه می‌کند.",
    ps: "د تبادلې تبادله په اتوماتیک ډول ځایی اسعارو ارزښت ({baseCurrency}) محاسبه کوي."
  },
  "invalid_ledger_selection": {
    en: "Invalid ledger account selection. Please ensure debit and credit accounts are fully mapped with valid UUIDs.",
    ur: "غلط لیجر اکاؤنٹ کا انتخاب۔ براہ کرم یقینی بنائیں کہ ڈیبٹ اور کریڈٹ اکاؤنٹس کو درست UUIDs کے ساتھ مکمل طور پر نقشہ کیا گیا ہے۔",
    ar: "اختيار غير صالح لحساب دفتر الأستاذ. يرجى التأكد من مطابقة حسابات المدين والدائن بالكامل بمعرفات UUID صالحة.",
    fa: "انتخاب حساب دفتر کل نامعتبر است. لطفاً مطمئن شوید حساب‌های بدهکار و بستانکار کاملاً با UUIDهای معتبر نگاشت شده‌اند.",
    ps: "د لیجر حساب ناسم انتخاب. مهرباني وکړئ ډاډ ترلاسه کړئ چې ډیبیټ او کریډیټ حسابونه د باوري UUIDs سره په بشپړ ډول نقشه شوي."
  },
  "use_suggested": {
    en: "Use suggested",
    ur: "تجویز کردہ استعمال کریں",
    ar: "استخدام المقترح",
    fa: "استفاده از پیشنهاد شده",
    ps: "وړاندیز شوی وکاروئ"
  },
  "payment_source_account": {
    en: "Payment Source Account",
    ur: "ادائیگی کا سورس اکاؤنٹ",
    ar: "حساب مصدر الدفع",
    fa: "حساب منبع پرداخت",
    ps: "د تادیې سرچینې حساب"
  },
  "roznamcha_type_label": {
    en: "Roznamcha Type",
    ur: "روزنامچہ کی قسم",
    ar: "نوع الروزنامة",
    fa: "نوع روزنامچه",
    ps: "د روزنامچې ډول"
  },
  "roznamcha_number_label": {
    en: "Roznamcha Number",
    ur: "روزنامچہ نمبر",
    ar: "رقم الروزنامة",
    fa: "شماره روزنامچه",
    ps: "د روزنامچې شمیره"
  },
  "roznamcha_category_label": {
    en: "Roznamcha Category",
    ur: "روزنامچہ کیٹیگری",
    ar: "فئة الروزنامة",
    fa: "دسته‌بندی روزنامچه",
    ps: "د روزنامچې کټګوري"
  },
  "payment_date_label": {
    en: "Payment Date",
    ur: "ادائیگی کی تاریخ",
    ar: "تاريخ الدفع",
    fa: "تاریخ پرداخت",
    ps: "د تادیې نیټه"
  },
  "comments_label": {
    en: "Comments / Remarks",
    ur: "کمنٹس / ریمارکس",
    ar: "تعليقات",
    fa: "نظرات",
    ps: "تبصرو"
  },
  "cash_details": {
    en: "Cash Details",
    ur: "کیش کی تفصیلات",
    ar: "تفاصيل النقد",
    fa: "جزئیات نقدی",
    ps: "د نغدو جزئیات"
  },
  "bank_details": {
    en: "Bank Details",
    ur: "بینک کی تفصیلات",
    ar: "تفاصيل البنك",
    fa: "جزئیات بانکی",
    ps: "د بانک جزئیات"
  },
  "business_details": {
    en: "Business Details",
    ur: "بزنس کی تفصیلات",
    ar: "تفاصيل العمل",
    fa: "جزئیات کسب‌وکار",
    ps: "د سوداګرۍ جزئیات"
  },
  "invoice_details": {
    en: "Invoice Details",
    ur: "انوائس کی تفصیلات",
    ar: "تفاصيل الفاتورة",
    fa: "جزئیات فاکتور",
    ps: "د انوائس جزئیات"
  },
  "transfer_details": {
    en: "Transfer Details",
    ur: "منتقلی کی تفصیلات",
    ar: "تفاصيل التحويل",
    fa: "جزئیات انتقال",
    ps: "د لیږد جزئیات"
  },
  "select_currency": {
    en: "Select Currency",
    ur: "کرنسی منتخب کریں",
    ar: "اختر العملة",
    fa: "انتخاب ارز",
    ps: "اسعار وټاکئ"
  },
  "search_payment_source_account": {
    en: "Search Payment Source Account...",
    ur: "ادائیگی کا سورس اکاؤنٹ تلاش کریں...",
    ar: "ابحث عن حساب مصدر الدفع...",
    fa: "جستجوی حساب منبع پرداخت...",
    ps: "د تادیې سرچینې حساب لټون..."
  },
  "search_credit_account_cash_bank": {
    en: "Search & Select Credit Account (Cash / Bank)...",
    ur: "کریڈٹ اکاؤنٹ منتخب کریں (کیش / بینک)...",
    ar: "ابحث واختر حساب الدائن (نقد / بنك)...",
    fa: "جستجو و انتخاب حساب بستانکار (نقد / بانک)...",
    ps: "د کریډیټ حساب لټون او ټاکل (نغدي / بانک)..."
  },
  "balance_colon": {
    en: "Balance: ",
    ur: "بیلنس: ",
    ar: "الرصيد: ",
    fa: "موجودی: ",
    ps: "بیلانس: "
  },
  "currency_colon": {
    en: "Currency: ",
    ur: "کرنسی: ",
    ar: "العملة: ",
    fa: "ارز: ",
    ps: "اسعار: "
  },
  "receipt_no_full_label": {
    en: "Receipt No.",
    ur: "رسید نمبر",
    ar: "رقم الإيصال",
    fa: "شماره رسید",
    ps: "د رسید شمیره"
  },
  "select_type": {
    en: "Select Type",
    ur: "قسم منتخب کریں",
    ar: "اختر النوع",
    fa: "انتخاب نوع",
    ps: "ډول وټاکئ"
  },
  "select_category": {
    en: "Select Category",
    ur: "زمرہ منتخب کریں",
    ar: "اختر الفئة",
    fa: "انتخاب دسته",
    ps: "ډله وټاکئ"
  },
  "cash_roznamcha": {
    en: "Cash Roznamcha",
    ur: "کیش روزنامچہ",
    ar: "روزنامچة النقد",
    fa: "روزنامچه نقدی",
    ps: "د نغدو روزنامچه"
  },
  "bank_roznamcha": {
    en: "Bank Roznamcha",
    ur: "بینک روزنامچہ",
    ar: "روزنامچة البنك",
    fa: "روزنامچه بانکی",
    ps: "د بانک روزنامچه"
  },
  "business_roznamcha": {
    en: "Business Roznamcha",
    ur: "بزنس روزنامچہ",
    ar: "روزنامچة العمل",
    fa: "روزنامچه کسب‌وکار",
    ps: "د سوداګرۍ روزنامچه"
  },
  "invoice_journal": {
    en: "Invoice Journal",
    ur: "انوائس جرنل",
    ar: "دفتر يومية الفاتورة",
    fa: "دفتر روزنامه فاکتور",
    ps: "د انوائس جرنل"
  },
  "transfer_label": {
    en: "Transfer",
    ur: "منتقلی",
    ar: "تحويل",
    fa: "انتقال",
    ps: "لیږد"
  },
  "receiver_or_sender_name_placeholder": {
    en: "Receiver or sender name",
    ur: "وصول کنندہ یا بھیجنے والے کا نام",
    ar: "اسم المستلم أو المرسل",
    fa: "نام گیرنده یا فرستنده",
    ps: "د ترلاسه کونکي یا لیږونکي نوم"
  },
  "attach_label": {
    en: "Attach",
    ur: "منسلک کریں",
    ar: "إرفاق",
    fa: "پیوست",
    ps: "منسلکول"
  },
  "select_bank": {
    en: "Select Bank",
    ur: "بینک منتخب کریں",
    ar: "اختر البنك",
    fa: "انتخاب بانک",
    ps: "بانک وټاکئ"
  },
  "new_bank": {
    en: "New Bank",
    ur: "نیا بینک",
    ar: "بنك جديد",
    fa: "بانک جدید",
    ps: "نوی بانک"
  },
  "select_method": {
    en: "Select Method",
    ur: "طریقہ منتخب کریں",
    ar: "اختر الطريقة",
    fa: "انتخاب روش",
    ps: "طریقه وټاکئ"
  },
  "new_method": {
    en: "New Method",
    ur: "نیا طریقہ",
    ar: "طريقة جديدة",
    fa: "روش جدید",
    ps: "نوې طریقه"
  },
  "cheque_mobile_transaction_number": {
    en: "Cheque/Mobile transaction number",
    ur: "چیک یا ٹرانزیکشن نمبر",
    ar: "رقم معاملة الشيك/الجوال",
    fa: "شماره تراکنش چک/موبایل",
    ps: "د چک/ګرځنده معاملې شمیره"
  },
  "invoice_number_label": {
    en: "Invoice Number",
    ur: "انوائس نمبر",
    ar: "رقم الفاتورة",
    fa: "شماره فاکتور",
    ps: "د انوائس شمیره"
  },
  "purchase_information": {
    en: "Purchase Information",
    ur: "خریداری کی معلومات",
    ar: "معلومات الشراء",
    fa: "اطلاعات خرید",
    ps: "د پیرودلو معلومات"
  },
  "from_label": {
    en: "From",
    ur: "سے",
    ar: "من",
    fa: "از",
    ps: "له"
  },
  "to_label": {
    en: "To",
    ur: "کو",
    ar: "إلى",
    fa: "به",
    ps: "ته"
  },
  "reference_label": {
    en: "Reference",
    ur: "حوالہ",
    ar: "المرجع",
    fa: "مرجع",
    ps: "حواله"
  },
  "multiply_op": {
    en: "Multiply (*)",
    ur: "ضرب کریں (*)",
    ar: "ضرب (*)",
    fa: "ضرب (*)",
    ps: "ضرب (*)"
  },
  "divide_op": {
    en: "Divide (/)",
    ur: "تقسیم کریں (/)",
    ar: "قسمة (/)",
    fa: "تقسیم (/)",
    ps: "ویش (/)"
  },
  "manual_notes_placeholder": {
    en: "Manually add additional descriptions, comments, explanations, or transaction notes...",
    ur: "تفصیلات، کمنٹس، وضاحت، یا ٹرانزیکشن نوٹس شامل کریں...",
    ar: "أضف يدويًا أوصافًا إضافية أو تعليقات أو توضيحات أو ملاحظات المعاملة...",
    fa: "توضیحات، نظرات، شرح یا یادداشت‌های تراکنش را به‌صورت دستی اضافه کنید...",
    ps: "لاسي ډول اضافي تشریحات، تبصرې، وضاحتونه، یا د معاملې یادښتونه ورنغاړئ..."
  },
  "add_transaction_narration_example": {
    en: "Add transaction narration / comments (e.g. 22000 USD x 3.6725 = 80,740.00 AED | Bank TT to Supplier)",
    ur: "تفصیلات، کمنٹس، یا ٹرانزیکشن نوٹس شامل کریں...",
    ar: "أضف وصف المعاملة / التعليقات (مثال: 22000 USD x 3.6725 = 80,740.00 AED | تحويل بنكي للمورد)",
    fa: "شرح تراکنش / نظرات را اضافه کنید (مثال: 22000 USD x 3.6725 = 80,740.00 AED | حواله بانکی به تأمین‌کننده)",
    ps: "د معاملې تشریح / تبصرې ورزیاتئ (مثال: 22000 USD x 3.6725 = 80,740.00 AED | بانکي لیږد پلورونکي ته)"
  },
  "posting_colon": {
    en: "Posting: ",
    ur: "پوسٹنگ: ",
    ar: "الترحيل: ",
    fa: "ثبت سند: ",
    ps: "پوسټینګ: "
  },
  "amount_colon": {
    en: "Amount: ",
    ur: "رقم: ",
    ar: "المبلغ: ",
    fa: "مبلغ: ",
    ps: "اندازه: "
  },
  "total_remaining_bill_colon": {
    en: "Total Remaining Bill: ",
    ur: "کل بقایا بل: ",
    ar: "إجمالي رصيد الفاتورة المتبقي: ",
    fa: "مجموع مانده صورتحساب: ",
    ps: "د پاتې بل ټول اندازه: "
  },
  "remaining_bill_balance_baqaya_colon": {
    en: "Remaining Bill Balance (Baqaya): ",
    ur: "باقی بل بقایا: ",
    ar: "رصيد الفاتورة المتبقي (باقايا): ",
    fa: "مانده صورتحساب (باقیا): ",
    ps: "د بل پاتې بیلانس (باقي): "
  },
  "roznamcha_voucher_number": {
    en: "Roznamcha / Voucher Number",
    ur: "روزنامچہ / واؤچر نمبر",
    ar: "رقم روزنامچة / السند",
    fa: "شماره روزنامچه / سند",
    ps: "د روزنامچې / واوچر شمیره"
  },
  "debit_account_party_supplier": {
    en: "Debit Account (Party/Supplier)",
    ur: "ڈیبٹ اکاؤنٹ",
    ar: "حساب المدين (الطرف/المورد)",
    fa: "حساب بدهکار (طرف/تأمین‌کننده)",
    ps: "د ډیبیټ حساب (کوونکی/عرضه کوونکی)"
  },
  "payment_type_label": {
    en: "Payment Type",
    ur: "ادائیگی کی قسم",
    ar: "نوع الدفع",
    fa: "نوع پرداخت",
    ps: "د تادیې ډول"
  },
  "payment_type_select_source_hint": {
    en: "Payment Type (select a source account to set this)",
    ur: "ادائیگی کی قسم (سیٹ کرنے کے لیے سورس اکاؤنٹ منتخب کریں)",
    ar: "نوع الدفع (اختر حساب المصدر لتعيين هذا)",
    fa: "نوع پرداخت (برای تنظیم، حساب منبع را انتخاب کنید)",
    ps: "د تادیې ډول (د دې ټاکلو لپاره سرچینه حساب وټاکئ)"
  },
  "payment_amount_label": {
    en: "Payment Amount",
    ur: "ادائیگی کی رقم",
    ar: "مبلغ الدفع",
    fa: "مبلغ پرداخت",
    ps: "د تادیې اندازه"
  },
  "payment_amount_gt_zero": {
    en: "Payment Amount (must be greater than 0)",
    ur: "ادائیگی کی رقم (0 سے زیادہ ہونی چاہیے)",
    ar: "مبلغ الدفع (يجب أن يكون أكبر من 0)",
    fa: "مبلغ پرداخت (باید بزرگتر از 0 باشد)",
    ps: "د تادیې اندازه (باید له 0 څخه زیاته وي)"
  },
  "processing_label": {
    en: "Processing...",
    ur: "پروسیسنگ ہو رہی ہے...",
    ar: "جارٍ المعالجة...",
    fa: "در حال پردازش...",
    ps: "پروسس کیږي..."
  },
  "post_credit_payment": {
    en: "Post Credit Payment",
    ur: "کریڈٹ ادائیگی پوسٹ کریں",
    ar: "ترحيل الدفعة الآجلة",
    fa: "ثبت پرداخت اعتباری",
    ps: "د کریډیټ تادیې پوسټ کول"
  },
  "post_remaining_payment": {
    en: "Post Remaining Payment",
    ur: "باقی ادائیگی پوسٹ کریں",
    ar: "ترحيل الدفعة المتبقية",
    fa: "ثبت پرداخت باقیمانده",
    ps: "د پاتې تادیې پوسټ کول"
  },
  "save_disabled_prefix": {
    en: "Save is disabled — still needed: ",
    ur: "محفوظ کرنا غیر فعال ہے — ابھی درکار ہے: ",
    ar: "الحفظ معطل — لا يزال مطلوبًا: ",
    fa: "ذخیره غیرفعال است — هنوز نیاز است: ",
    ps: "خوندي کول غیرفعال دي — لاهم اړین دي: "
  },
  "list_separator": {
    en: ", ",
    ur: "، ",
    ar: "، ",
    fa: "، ",
    ps: "، "
  },
  "payment_posted_successfully": {
    en: "Payment Posted Successfully",
    ur: "ادائیگی کامیابی سے پوسٹ ہو گئی",
    ar: "تم ترحيل الدفعة بنجاح",
    fa: "پرداخت با موفقیت ثبت شد",
    ps: "تادیه په بریالیتوب سره پوسټ شوه"
  },
  "professional_payment_summary": {
    en: "Professional Payment Summary",
    ur: "پیمنٹ کی پیشہ ورانہ تفصیلات",
    ar: "ملخص الدفع الاحترافي",
    fa: "خلاصه حرفه‌ای پرداخت",
    ps: "مسلکي د تادیې لنډیز"
  },
  "account_label": {
    en: "Account",
    ur: "اکاؤنٹ",
    ar: "الحساب",
    fa: "حساب",
    ps: "حساب"
  },
  "amount_label": {
    en: "Amount",
    ur: "رقم",
    ar: "المبلغ",
    fa: "مبلغ",
    ps: "اندازه"
  },
  "receiver_sender_name": {
    en: "Receiver / Sender Name",
    ur: "وصول کنندہ / بھیجنے والے کا نام",
    ar: "اسم المستلم / المرسل",
    fa: "نام گیرنده / فرستنده",
    ps: "د ترلاسه کونکي / لیږونکي نوم"
  },
  "mobile_number": {
    en: "Mobile Number",
    ur: "موبائل نمبر",
    ar: "رقم الجوال",
    fa: "شماره موبایل",
    ps: "د ګرځنده شمیره"
  },
  "whatsapp_number": {
    en: "WhatsApp Number",
    ur: "واٹس ایپ نمبر",
    ar: "رقم الواتساب",
    fa: "شماره واتساپ",
    ps: "د واټساپ شمیره"
  },
  "id_card_copy_upload": {
    en: "ID Card Copy Upload",
    ur: "شناختی کارڈ کاپی اپ لوڈ",
    ar: "تحميل نسخة من بطاقة الهوية",
    fa: "آپلود کپی کارت شناسایی",
    ps: "د پیژندپاڼې کاپي اپلوډ"
  },
  "transaction_conversion_details": {
    en: "Transaction Conversion Details",
    ur: "ٹرانزیکشن کنورژن کی تفصیلات",
    ar: "تفاصيل تحويل المعاملة",
    fa: "جزئیات تبدیل تراکنش",
    ps: "د معاملې تبادلې توضیحات"
  },
  "purchase_currency_amount": {
    en: "Purchase Currency Amount",
    ur: "پرچیز کرنسی رقم",
    ar: "مبلغ عملة الشراء",
    fa: "مبلغ ارز خرید",
    ps: "د پیرود اسعارو مقدار"
  },
  "exchange_rate_label": {
    en: "Exchange Rate",
    ur: "ایکسچینج ریٹ",
    ar: "سعر الصرف",
    fa: "نرخ ارز",
    ps: "د تبادلې نرخ"
  },
  "operation_label": {
    en: "Operation",
    ur: "آپریشن",
    ar: "العملية",
    fa: "عملیات",
    ps: "عملیات"
  },
  "final_local_amount": {
    en: "Final Local Amount",
    ur: "حتمی مقامی رقم",
    ar: "المبلغ المحلي النهائي",
    fa: "مبلغ محلی نهایی",
    ps: "وروستی ځایی مقدار"
  },
  "posting_success": {
    en: "Double-entry ledger voucher successfully balanced! Journal Serial Number:",
    ur: "ڈبل انٹری لیجر واؤچر کامیابی سے متوازن ہو گیا! جرنل سیریل نمبر:",
    ar: "تم موازنة سند دفتر أستاذ القيد المزدوج بنجاح! رقم تسلسل اليومية:",
    fa: "سند دفتر کل دوطرفه با موفقیت متوازن شد! شماره سریال روزنامه:",
    ps: "د ډبل انټري لیجر واؤچر په بریالیتوب سره متوازن شو! د ژورنال سریال شمیره:"
  },
  "payment_entry_po": {
    en: "Payment Entry - PO",
    ur: "ادائیگی انٹری - پرچیز آرڈر",
    ar: "إدخال الدفع - طلب الشراء",
    fa: "ثبت پرداخت - سفارش خرید",
    ps: "د تادیې ننوتل - پیرود امر"
  },
  "post_advance_payment": {
    en: "Post Advance Payment",
    ur: "ایڈوانس ادائیگی پوسٹ کریں",
    ar: "ترحيل الدفعة المقدمة",
    fa: "ثبت پرداخت علی‌الحساب",
    ps: "مخکینۍ تادیه پوسټ کړئ"
  },
  "original_purchase_amount": {
    en: "Original Purchase Amount",
    ur: "اصل خریداری کی رقم",
    ar: "مبلغ الشراء الأصلي",
    fa: "مبلغ خرید اصلی",
    ps: "د پیرود اصلي مقدار"
  },
  "purchase_currency": {
    en: "Purchase Currency",
    ur: "خریداری کی کرنسی",
    ar: "عملة الشراء",
    fa: "ارز خرید",
    ps: "د پیرود اسعارو"
  },
  "final_converted_amount": {
    en: "Final Converted Amount",
    ur: "حتمی تبدیل شدہ رقم",
    ar: "المبلغ المحول النهائي",
    fa: "مبلغ تبدیل شده نهایی",
    ps: "وروستی بدل شوی مقدار"
  },
  "total_advance_required": {
    en: "Total Advance Required",
    ur: "کل ایڈوانس درکار",
    ar: "إجمالي الدفعة المقدمة المطلوبة",
    fa: "کل علی‌الحساب مورد نیاز",
    ps: "ټول اړین پرمختګ"
  },
  "total_paid": {
    en: "Total Paid",
    ur: "کل ادا شدہ",
    ar: "إجمالي المدفوع",
    fa: "کل پرداخت شده",
    ps: "ټول تادیه شوي"
  },
  "outstanding_amount": {
    en: "Outstanding Amount",
    ur: "بقایا رقم",
    ar: "المبلغ المستحق",
    fa: "مبلغ معوقه",
    ps: "پاتې مقدار"
  },
  "remaining_balance_label": {
    en: "Remaining Balance",
    ur: "باقی ماندہ بیلنس",
    ar: "الرصيد المتبقي",
    fa: "مانده باقی‌مانده",
    ps: "پاتې بیلانس"
  },
  "final_debit_amount": {
    en: "Final Debit Amount",
    ur: "حتمی ڈیبٹ رقم",
    ar: "مبلغ المدين النهائي",
    fa: "مبلغ بدهکار نهایی",
    ps: "وروستی ډیبیټ مقدار"
  },
  "final_credit_amount": {
    en: "Final Credit Amount",
    ur: "حتمی کریڈٹ رقم",
    ar: "مبلغ الدائن النهائي",
    fa: "مبلغ بستانکار نهایی",
    ps: "وروستی کریډیټ مقدار"
  },
  "payment_status_label": {
    en: "Payment Status",
    ur: "ادائیگی کی صورتحال",
    ar: "حالة الدفع",
    fa: "وضعیت پرداخت",
    ps: "د تادیې حالت"
  },
  "receipt_payment_receipt": {
    en: "PAYMENT RECEIPT",
    ur: "رسید ادائیگی",
    ar: "إيصال الدفع",
    fa: "رسید پرداخت",
    ps: "د تادیې رسید"
  },
  "receipt_purchase_payment_receipt": {
    en: "Purchase Payment Receipt",
    ur: "پرچیز پیمنٹ رسید",
    ar: "إيصال دفع الشراء",
    fa: "رسید پرداخت خرید",
    ps: "د پیرود تادیې رسید"
  },
  "receipt_no": {
    en: "No",
    ur: "نمبر",
    ar: "رقم",
    fa: "شماره",
    ps: "شمیره"
  },
  "receipt_printed": {
    en: "Printed",
    ur: "پرنٹ کیا گیا",
    ar: "تمت الطباعة",
    fa: "چاپ شده",
    ps: "چاپ شوی"
  },
  "receipt_purchase_vendor_details": {
    en: "Purchase & Vendor Details",
    ur: "پرچیز اور وینڈر کی تفصیلات",
    ar: "تفاصيل الشراء والمورد",
    fa: "جزئیات خرید و تأمین‌کننده",
    ps: "د پیرود او پلورونکي توضیحات"
  },
  "receipt_purchase_order_no": {
    en: "Purchase Order No",
    ur: "پرچیز آرڈر نمبر",
    ar: "رقم أمر الشراء",
    fa: "شماره سفارش خرید",
    ps: "د پیرود امر شمیره"
  },
  "receipt_contract_grn_no": {
    en: "Contract / GRN No",
    ur: "معاہدہ / جی آر این نمبر",
    ar: "رقم العقد / إيصال الاستلام",
    fa: "شماره قرارداد / رسید کالا",
    ps: "د قرارداد / GRN شمیره"
  },
  "receipt_supplier_name": {
    en: "Supplier Name",
    ur: "سپلائر کا نام",
    ar: "اسم المورد",
    fa: "نام تأمین‌کننده",
    ps: "د چمتو کونکي نوم"
  },
  "receipt_purchase_date": {
    en: "Purchase Date",
    ur: "خریداری کی تاریخ",
    ar: "تاريخ الشراء",
    fa: "تاریخ خرید",
    ps: "د پیرود نیټه"
  },
  "receipt_currency": {
    en: "Currency",
    ur: "کرنسی",
    ar: "العملة",
    fa: "ارز",
    ps: "اسعارې"
  },
  "receipt_purchase_financial_summary": {
    en: "Purchase Financial Summary",
    ur: "پرچیز کا مالی خلاصہ",
    ar: "الملخص المالي للشراء",
    fa: "خلاصه مالی خرید",
    ps: "د پیرود مالي لنډیز"
  },
  "receipt_goods_total_amount": {
    en: "Goods Total Amount",
    ur: "سامان کی کل رقم",
    ar: "إجمالي مبلغ البضائع",
    fa: "مبلغ کل کالا",
    ps: "د توکو ټول مقدار"
  },
  "receipt_discount": {
    en: "Discount",
    ur: "ڈسکاؤنٹ",
    ar: "الخصم",
    fa: "تخفیف",
    ps: "تخفیف"
  },
  "receipt_freight_charges": {
    en: "Freight Charges",
    ur: "مال برداری کے اخراجات",
    ar: "رسوم الشحن",
    fa: "هزینه حمل و نقل",
    ps: "د لېږد لګښتونه"
  },
  "receipt_grand_total": {
    en: "Grand Total",
    ur: "کل مجموعی رقم",
    ar: "المجموع الكلي",
    fa: "مجموع کل",
    ps: "ټول مجموعه"
  },
  "receipt_accounting_audit_trail": {
    en: "Accounting & Audit Trail",
    ur: "اکاؤنٹنگ اور آڈٹ ٹریل",
    ar: "المحاسبة ومسار التدقيق",
    fa: "حسابداری و ردیابی حسابرسی",
    ps: "محاسبه او تدقیق لاره"
  },
  "receipt_debit_ledger": {
    en: "Debit Ledger (Dr)",
    ur: "ڈیبٹ لیجر (Dr)",
    ar: "دفتر الأستاذ المدين (Dr)",
    fa: "دفتر بدهکار (Dr)",
    ps: "د ډیبیټ لیجر (Dr)"
  },
  "receipt_credit_ledger": {
    en: "Credit Ledger (Cr)",
    ur: "کریڈٹ لیجر (Cr)",
    ar: "دفتر الأستاذ الدائن (Cr)",
    fa: "دفتر بستانکار (Cr)",
    ps: "د کریډیټ لیجر (Cr)"
  },
  "receipt_posted_by": {
    en: "Posted By",
    ur: "پوسٹ کنندہ",
    ar: "نُشر بواسطة",
    fa: "ثبت شده توسط",
    ps: "لخوا پوسټ شوی"
  },
  "receipt_journal_serial": {
    en: "Journal Serial",
    ur: "جرنل سیریل",
    ar: "الرقم التسلسلي لليومية",
    fa: "شماره سریال دفتر روزنامه",
    ps: "د ژورنال سیریل"
  },
  "receipt_remarks": {
    en: "Remarks",
    ur: "تبصرے",
    ar: "ملاحظات",
    fa: "توضیحات",
    ps: "تبصرې"
  },
  "receipt_payment_summary": {
    en: "Payment Summary",
    ur: "ادائیگی کا خلاصہ",
    ar: "ملخص الدفع",
    fa: "خلاصه پرداخت",
    ps: "د تادیې لنډیز"
  },
  "receipt_previously_paid": {
    en: "Previously Paid",
    ur: "پہلے ادا کی گئی رقم",
    ar: "المبلغ المدفوع سابقاً",
    fa: "قبلاً پرداخت شده",
    ps: "مخکې تادیه شوی"
  },
  "receipt_current_payment": {
    en: "Current Payment",
    ur: "موجودہ ادائیگی",
    ar: "الدفعة الحالية",
    fa: "پرداخت فعلی",
    ps: "اوسنۍ تادیه"
  },
  "receipt_total_paid_to_date": {
    en: "Total Paid to Date",
    ur: "تاریخ تک کل ادا شدہ رقم",
    ar: "إجمالي المدفوع حتى الآن",
    fa: "مجموع پرداخت شده تاکنون",
    ps: "تر نن پورې ټول تادیه شوی"
  },
  "receipt_running_purchase_balance": {
    en: "Running Purchase Balance",
    ur: "رواں پرچیز بیلنس",
    ar: "رصيد الشراء الجاري",
    fa: "مانده جاری خرید",
    ps: "روان د پیرود بیلانس"
  },
  "receipt_prepared_by": {
    en: "Prepared By",
    ur: "تیار کنندہ",
    ar: "أعده",
    fa: "تهیه شده توسط",
    ps: "چمتو شوی لخوا"
  },
  "receipt_company_stamp": {
    en: "Company Stamp",
    ur: "کمپنی کی مہر",
    ar: "ختم الشركة",
    fa: "مهر شرکت",
    ps: "د شرکت مهر"
  },
  "receipt_authorized_signatory": {
    en: "Authorized Signatory",
    ur: "مجاز دستخط کنندہ",
    ar: "الموقّع المعتمد",
    fa: "امضاکننده مجاز",
    ps: "مجاز لاسلیک کوونکی"
  },
  "receipt_receiver_signature": {
    en: "Receiver Signature",
    ur: "وصول کنندہ کے دستخط",
    ar: "توقيع المستلم",
    fa: "امضای دریافت‌کننده",
    ps: "د ترلاسه کوونکي لاسلیک"
  },
  "receipt_system_generated_document": {
    en: "*** THIS IS A SYSTEM GENERATED DOCUMENT ***",
    ur: "*** یہ سسٹم سے تیار کردہ دستاویز ہے ***",
    ar: "*** هذا مستند تم إنشاؤه بواسطة النظام ***",
    fa: "*** این یک سند تولید شده توسط سیستم است ***",
    ps: "*** دا د سیسټم لخوا تولید شوی سند دی ***"
  },
  "receipt_exchange_rate_applied": {
    en: "Exchange Rate Applied",
    ur: "لاگو کردہ زر مبادلہ کی شرح",
    ar: "سعر الصرف المطبق",
    fa: "نرخ ارز اعمال شده",
    ps: "پلي شوی د تبادلې نرخ"
  },
  "receipt_super_admin": {
    en: "SUPER ADMIN",
    ur: "سپر ایڈمن",
    ar: "المشرف العام",
    fa: "سوپر ادمین",
    ps: "سوپر اډمین"
  }
};

export const DATA_TRANSLATIONS: Record<string, Record<string, string>> = {
  ur: {
    "Pakistan": "پاکستان",
    "United Arab Emirates": "متحدہ عرب امارات",
    "China": "چین",
    "India": "بھارت",
    "Afghanistan": "افغانستان",
    "Karachi Branch": "کراچی برانچ",
    "Islamabad Branch": "اسلام آباد برانچ",
    "Quetta Branch": "کوئٹہ برانچ",
    "Chaman Branch": "چمن برانچ",
    "Kabul Branch": "کابل برانچ",
    "Kabul Main Branch": "کابل مین برانچ",
    "Dubai Branch": "دبئی برانچ",
    "Main Branch": "مین برانچ",
    "Unassigned Branch": "غیر تفویض شدہ برانچ",
    "Wheat": "گندم",
    "Sugar": "چینی",
    "Rice": "چاول",
    "Cash Book Dubai Branch": "کیش بک دبئی برانچ",
    "Cash Book Karachi": "کیش بک کراچی",
    "Supplier Liability Ledger": "سپلائر لائیبلٹی لیجر",
    "Purchase Account": "پرچیز اکاؤنٹ",
    "Cash Book No.": "کیش بک نمبر",
    "Roznamcha Book No.": "روزنامچہ بک نمبر"
  },
  ar: {
    "Pakistan": "باكستان",
    "United Arab Emirates": "الإمارات العربية المتحدة",
    "China": "الصين",
    "India": "الهند",
    "Afghanistan": "أفغانستان",
    "Karachi Branch": "فرع كراتشي",
    "Islamabad Branch": "فرع إسلام أباد",
    "Quetta Branch": "فرع كويتا",
    "Chaman Branch": "فرع تشامان",
    "Kabul Branch": "فرع كابول",
    "Kabul Main Branch": "فرع كابول الرئيسي",
    "Dubai Branch": "فرع دبي",
    "Main Branch": "الفرع الرئيسي",
    "Unassigned Branch": "فرع غير معين",
    "Wheat": "قمح",
    "Sugar": "سكر",
    "Rice": "أرز",
    "Cash Book Dubai Branch": "دفتر الصندوق فرع دبي",
    "Cash Book Karachi": "دفتر الصندوق كراتشي",
    "Supplier Liability Ledger": "دفتر حسابات التزامات المورد",
    "Purchase Account": "حساب المشتريات",
    "Cash Book No.": "دفتر حساب الصندوق رقم",
    "Roznamcha Book No.": "دفتر اليومية رقم"
  },
  fa: {
    "Pakistan": "پاکستان",
    "United Arab Emirates": "امارات متحده عربی",
    "China": "چین",
    "India": "هند",
    "Afghanistan": "افغانستان",
    "Karachi Branch": "شعبه کراچی",
    "Islamabad Branch": "شعبه اسلام آباد",
    "Quetta Branch": "شعبه کویته",
    "Chaman Branch": "شعبه چمن",
    "Kabul Branch": "شعبه کابل",
    "Kabul Main Branch": "شعبه اصلی کابل",
    "Dubai Branch": "شعبه دبی",
    "Main Branch": "شعبه اصلی",
    "Unassigned Branch": "شعبه نامشخص",
    "Wheat": "گندم",
    "Sugar": "شکر",
    "Rice": "برنج",
    "Cash Book Dubai Branch": "دفتر صندوق شعبه دبی",
    "Cash Book Karachi": "دفتر صندوق شعبه کراچی",
    "Supplier Liability Ledger": "دفتر بدهی‌های تأمین‌کننده",
    "Purchase Account": "حساب خرید",
    "Cash Book No.": "دفتر روزنامه صندوق شماره",
    "Roznamcha Book No.": "دفتر روزنامه عمومی شماره"
  },
  ps: {
    "Pakistan": "پاکستان",
    "United Arab Emirates": "متحده عربي امارات",
    "China": "چین",
    "India": "هند",
    "Afghanistan": "افغانستان",
    "Karachi Branch": "د کراچۍ څانګه",
    "Islamabad Branch": "د اسلام آباد څانګه",
    "Quetta Branch": "د کویټې څانګه",
    "Chaman Branch": "د چمن څانګه",
    "Kabul Branch": "د کابل څانګه",
    "Kabul Main Branch": "د کابل اصلي څانګه",
    "Dubai Branch": "د دوبۍ څانګه",
    "Main Branch": "اصلي څانګه",
    "Unassigned Branch": "ناټاکل شوې څانګه",
    "Wheat": "غنم",
    "Sugar": "بوره",
    "Rice": "وریجې",
    "Cash Book Dubai Branch": "د دوبۍ د نغدو کتاب څانګه",
    "Cash Book Karachi": "د کراچۍ د نغدو کتاب څانګه",
    "Supplier Liability Ledger": "د پلورونکي مسؤلیت کتاب",
    "Purchase Account": "د پیرودلو حساب",
    "Cash Book No.": "د نغدو کتاب ګڼه",
    "Roznamcha Book No.": "د روزنامچې کتاب ګڼه"
  }
};

// Translate static labels helper
export const t = (key: string, lang: LanguageCode): string => {
  const translations = UI_TRANSLATIONS[key];
  if (translations && translations[lang]) {
    return translations[lang];
  }
  return key;
};

// Translate local database values helper
export const tData = (text: string | null | undefined, lang: LanguageCode): string => {
  if (!text) return "";
  const clean = text.trim();
  if (lang === "en") return clean;
  
  const langTranslations = DATA_TRANSLATIONS[lang];
  if (langTranslations && langTranslations[clean]) {
    return langTranslations[clean];
  }
  
  // Try matching substring or case insensitive
  if (langTranslations) {
    for (const key of Object.keys(langTranslations)) {
      if (clean.toLowerCase() === key.toLowerCase()) {
        return langTranslations[key];
      }
    }
  }
  
  return clean;
};
