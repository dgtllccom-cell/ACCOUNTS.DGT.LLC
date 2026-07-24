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
  "search_placeholder": {
    en: "Search by PO#, contract, status, supplier name, country, city...",
    ur: "پرچیز آرڈر نمبر، معاہدہ، حیثیت، سپلائر کا نام، ملک، شہر سے تلاش کریں...",
    ar: "ابحث برقم طلب الشراء، العقد، الحالة، اسم المورد، البلد، المدينة...",
    fa: "جستجو بر اساس شماره سفارش، قرارداد، وضعیت، نام تأمین‌کننده، کشور، شهر...",
    ps: "د پیرود امر، قرارداد، حالت، چمتو کونکي نوم، هیواد، ښار په واسطه لټون وکړئ..."
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
