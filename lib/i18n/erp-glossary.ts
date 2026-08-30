import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Curated ERP terminology — the five languages the ERP actually needs
 * (EN / UR / AR / FA / PS). This is the authoritative business-term layer of the
 * central translator: it is matched BEFORE any machine translation and, once a
 * term is here, it is rendered identically everywhere (DGT Connect, forms,
 * reports, Print/PDF, transactional data).
 *
 * Keep entries as whole ERP concepts (single words and short business phrases).
 * Longer free sentences are handled by the phrase engine + translation memory.
 */

export type GlossaryDomain =
  | "accounting" | "shipping" | "clearing" | "banking" | "tax"
  | "hr" | "crm" | "purchase" | "sales" | "inventory" | "general";

export type GlossaryEntry = {
  en: string; ur: string; ar: string; fa: string; ps: string;
  domain: GlossaryDomain;
  /** extra source spellings/variants that should resolve to this entry (any language) */
  variants?: string[];
};

export const ERP_GLOSSARY: GlossaryEntry[] = [
  // ── Core transaction types ────────────────────────────────────────────────
  { en: "Purchase", ur: "خریداری", ar: "شراء", fa: "خرید", ps: "پیرودنه", domain: "purchase", variants: ["purchases", "purchasing"] },
  { en: "Purchase Order", ur: "خریداری آرڈر", ar: "أمر شراء", fa: "سفارش خرید", ps: "د پیرودنې امر", domain: "purchase", variants: ["PO", "purchase booking", "purchase booking order"] },
  { en: "Purchase Contract", ur: "خریداری معاہدہ", ar: "عقد شراء", fa: "قرارداد خرید", ps: "د پیرودنې تړون", domain: "purchase" },
  { en: "Local Purchase", ur: "مقامی خریداری", ar: "شراء محلي", fa: "خرید محلی", ps: "محلي پیرودنه", domain: "purchase" },
  { en: "Sales", ur: "فروخت", ar: "مبيعات", fa: "فروش", ps: "پلور", domain: "sales", variants: ["sale", "selling"] },
  { en: "Sales Order", ur: "فروخت آرڈر", ar: "أمر بيع", fa: "سفارش فروش", ps: "د پلور امر", domain: "sales", variants: ["SO"] },
  { en: "Sales Contract", ur: "فروخت معاہدہ", ar: "عقد بيع", fa: "قرارداد فروش", ps: "د پلور تړون", domain: "sales" },
  { en: "Quotation", ur: "کوٹیشن", ar: "عرض سعر", fa: "پیش‌فاکتور", ps: "بیه‌لیک", domain: "sales", variants: ["proforma", "proforma invoice"] },
  { en: "Invoice", ur: "انوائس", ar: "فاتورة", fa: "فاکتور", ps: "انوایس", domain: "sales", variants: ["bill"] },
  { en: "Commercial Invoice", ur: "کمرشل انوائس", ar: "فاتورة تجارية", fa: "فاکتور تجاری", ps: "سوداګریز انوایس", domain: "sales" },
  { en: "Packing List", ur: "پیکنگ لسٹ", ar: "قائمة التعبئة", fa: "لیست بسته‌بندی", ps: "د بسته‌بندۍ لیست", domain: "shipping" },

  // ── Ledger / journal / roznamcha ─────────────────────────────────────────
  { en: "Journal", ur: "جرنل", ar: "دفتر اليومية", fa: "روزنامه", ps: "جورنال", domain: "accounting", variants: ["journal entry", "journal booking"] },
  { en: "Ledger", ur: "لیجر", ar: "دفتر الأستاذ", fa: "دفتر کل", ps: "لیجر", domain: "accounting", variants: ["general ledger", "account ledger"] },
  { en: "Roznamcha", ur: "روزنامچہ", ar: "دفتر اليومية (روزنامچه)", fa: "روزنامچه", ps: "روزنامچه", domain: "accounting", variants: ["روزنامچہ", "day book", "daybook", "cash entry"] },
  { en: "Voucher", ur: "واؤچر", ar: "سند", fa: "سند", ps: "رسید", domain: "accounting", variants: ["voucher no", "voucher number"] },
  { en: "Debit", ur: "ڈیبٹ", ar: "مدين", fa: "بدهکار", ps: "ډیبیټ", domain: "accounting", variants: ["DR", "dr", "debit amount"] },
  { en: "Credit", ur: "کریڈٹ", ar: "دائن", fa: "بستانکار", ps: "کریډیټ", domain: "accounting", variants: ["CR", "cr", "credit amount"] },
  { en: "Debit / Credit", ur: "ڈیبٹ / کریڈٹ", ar: "مدين / دائن", fa: "بدهکار / بستانکار", ps: "ډیبیټ / کریډیټ", domain: "accounting", variants: ["DR/CR", "dr/cr", "DR / CR"] },
  { en: "Opening Balance", ur: "ابتدائی بیلنس", ar: "الرصيد الافتتاحي", fa: "مانده اول دوره", ps: "پرانستی بیلانس", domain: "accounting" },
  { en: "Closing Balance", ur: "اختتامی بیلنس", ar: "الرصيد الختامي", fa: "مانده پایان دوره", ps: "پای بیلانس", domain: "accounting" },
  { en: "Balance", ur: "بیلنس", ar: "الرصيد", fa: "مانده", ps: "بیلانس", domain: "accounting", variants: ["net balance", "current balance", "running balance"] },
  { en: "Narration", ur: "تفصیل", ar: "بيان", fa: "شرح", ps: "تشریح", domain: "accounting", variants: ["description", "particulars"] },
  { en: "Posting", ur: "پوسٹنگ", ar: "ترحيل", fa: "ثبت", ps: "پوسټ کول", domain: "accounting", variants: ["posted", "post entry"] },
  { en: "Chart of Accounts", ur: "چارٹ آف اکاؤنٹس", ar: "دليل الحسابات", fa: "فهرست حساب‌ها", ps: "د حسابونو چارت", domain: "accounting" },
  { en: "Account", ur: "اکاؤنٹ", ar: "حساب", fa: "حساب", ps: "حساب", domain: "accounting", variants: ["کھاتہ", "account name", "account code"] },
  { en: "Trial Balance", ur: "ٹرائل بیلنس", ar: "ميزان المراجعة", fa: "تراز آزمایشی", ps: "آزمایښتي بیلانس", domain: "accounting" },
  { en: "Profit & Loss", ur: "نفع و نقصان", ar: "الأرباح والخسائر", fa: "سود و زیان", ps: "ګټه او زیان", domain: "accounting", variants: ["P&L", "profit and loss", "P/L"] },
  { en: "Balance Sheet", ur: "بیلنس شیٹ", ar: "الميزانية العمومية", fa: "ترازنامه", ps: "بیلانس شیټ", domain: "accounting" },

  // ── Shipping / clearing / loading / receiving ────────────────────────────
  { en: "Shipping", ur: "شپنگ", ar: "الشحن", fa: "حمل و نقل", ps: "لېږد", domain: "shipping", variants: ["shipment"] },
  { en: "Clearing", ur: "کلیئرنگ", ar: "التخليص", fa: "ترخیص", ps: "پاکول", domain: "clearing", variants: ["customs clearing", "customs clearance"] },
  { en: "Clearing Agent", ur: "کلیئرنگ ایجنٹ", ar: "وكيل التخليص", fa: "کارگزار ترخیص", ps: "د پاکولو استازی", domain: "clearing" },
  { en: "Loading", ur: "لوڈنگ", ar: "التحميل", fa: "بارگیری", ps: "بار کول", domain: "shipping", variants: ["loading record", "loaded quantity"] },
  { en: "Receiving", ur: "وصولی", ar: "الاستلام", fa: "دریافت", ps: "ترلاسه کول", domain: "shipping", variants: ["goods received", "received quantity"] },
  { en: "Bill of Lading", ur: "بل آف لیڈنگ", ar: "بوليصة الشحن", fa: "بارنامه", ps: "د بار نامه", domain: "shipping", variants: ["B/L", "BL", "BL number"] },
  { en: "Container", ur: "کنٹینر", ar: "حاوية", fa: "کانتینر", ps: "کانټینر", domain: "shipping" },
  { en: "Port of Loading", ur: "بندرگاہِ لوڈنگ", ar: "ميناء التحميل", fa: "بندر بارگیری", ps: "د بار بندر", domain: "shipping" },
  { en: "Port of Discharge", ur: "بندرگاہِ تخلیہ", ar: "ميناء التفريغ", fa: "بندر تخلیه", ps: "د تخلیې بندر", domain: "shipping" },
  { en: "Transit", ur: "ٹرانزٹ", ar: "العبور", fa: "ترانزیت", ps: "ترانزیت", domain: "shipping" },
  { en: "Freight", ur: "کرایہ", ar: "أجرة الشحن", fa: "کرایه حمل", ps: "د بار کرایه", domain: "shipping" },
  { en: "Gross Weight", ur: "مجموعی وزن", ar: "الوزن الإجمالي", fa: "وزن ناخالص", ps: "ټول وزن", domain: "shipping" },
  { en: "Net Weight", ur: "خالص وزن", ar: "الوزن الصافي", fa: "وزن خالص", ps: "خالص وزن", domain: "shipping" },
  { en: "Tare Weight", ur: "خالی وزن", ar: "وزن الفارغ", fa: "وزن ظرف", ps: "تش وزن", domain: "shipping" },

  // ── Banking / settlement / tax ──────────────────────────────────────────
  { en: "Bank", ur: "بینک", ar: "بنك", fa: "بانک", ps: "بانک", domain: "banking" },
  { en: "Banking", ur: "بینکنگ", ar: "الأعمال المصرفية", fa: "بانکداری", ps: "بانکوالي", domain: "banking" },
  { en: "Cheque", ur: "چیک", ar: "شيك", fa: "چک", ps: "چک", domain: "banking", variants: ["check", "cheque no", "cheque number"] },
  { en: "Bank Transfer", ur: "بینک ٹرانسفر", ar: "تحويل بنكي", fa: "انتقال بانکی", ps: "بانکي لېږد", domain: "banking" },
  { en: "Beneficiary", ur: "مستفید", ar: "المستفيد", fa: "ذی‌نفع", ps: "ګټه اخیستونکی", domain: "banking" },
  { en: "IBAN", ur: "آئی بین", ar: "آيبان", fa: "شماره شبا", ps: "آی‌بان", domain: "banking" },
  { en: "SWIFT Code", ur: "سوئفٹ کوڈ", ar: "رمز سويفت", fa: "کد سوئیفت", ps: "د سویفټ کوډ", domain: "banking" },
  { en: "Settlement", ur: "تصفیہ", ar: "التسوية", fa: "تسویه", ps: "تصفیه", domain: "accounting", variants: ["settle", "settled", "reconciliation"] },
  { en: "Reconciliation", ur: "مطابقت", ar: "المطابقة", fa: "مغایرت‌گیری", ps: "سمون", domain: "accounting" },
  { en: "Exchange Rate", ur: "شرحِ تبادلہ", ar: "سعر الصرف", fa: "نرخ ارز", ps: "د تبادلې نرخ", domain: "accounting", variants: ["ex rate", "fx rate", "conversion rate"] },
  { en: "Currency", ur: "کرنسی", ar: "العملة", fa: "ارز", ps: "اسعارو", domain: "accounting" },
  { en: "Tax", ur: "ٹیکس", ar: "الضريبة", fa: "مالیات", ps: "مالیه", domain: "tax" },
  { en: "VAT", ur: "ویٹ", ar: "ضريبة القيمة المضافة", fa: "مالیات بر ارزش افزوده", ps: "د ارزښت اضافه مالیه", domain: "tax", variants: ["value added tax"] },
  { en: "Withholding Tax", ur: "ود ہولڈنگ ٹیکس", ar: "ضريبة الاستقطاع", fa: "مالیات تکلیفی", ps: "د نیولو مالیه", domain: "tax" },
  { en: "Tax Invoice", ur: "ٹیکس انوائس", ar: "فاتورة ضريبية", fa: "فاکتور مالیاتی", ps: "مالیاتي انوایس", domain: "tax" },
  { en: "E-Invoicing", ur: "ای انوائسنگ", ar: "الفوترة الإلكترونية", fa: "صورت‌حساب الکترونیکی", ps: "بریښنایي انوایس", domain: "tax" },

  // ── Parties / masters ──────────────────────────────────────────────────
  { en: "Customer", ur: "کسٹمر", ar: "العميل", fa: "مشتری", ps: "پیرودونکی", domain: "crm", variants: ["customers", "client", "buyer"] },
  { en: "Supplier", ur: "سپلائر", ar: "المورد", fa: "تأمین‌کننده", ps: "عرضه کوونکی", domain: "purchase", variants: ["vendor", "seller", "shipper"] },
  { en: "Company", ur: "کمپنی", ar: "الشركة", fa: "شرکت", ps: "شرکت", domain: "general", variants: ["companies", "firm"] },
  { en: "Branch", ur: "برانچ", ar: "الفرع", fa: "شعبه", ps: "څانګه", domain: "general", variants: ["branches", "office"] },
  { en: "Main Branch", ur: "مین برانچ", ar: "الفرع الرئيسي", fa: "شعبه اصلی", ps: "اصلي څانګه", domain: "general", variants: ["country branch", "head branch"] },
  { en: "City Branch", ur: "سٹی برانچ", ar: "فرع المدينة", fa: "شعبه شهری", ps: "د ښار څانګه", domain: "general" },
  { en: "Country", ur: "ملک", ar: "الدولة", fa: "کشور", ps: "هیواد", domain: "general" },
  { en: "Goods", ur: "مال", ar: "البضائع", fa: "کالا", ps: "توکي", domain: "inventory", variants: ["goods description", "commodity", "product", "products"] },
  { en: "Warehouse", ur: "گودام", ar: "المستودع", fa: "انبار", ps: "ګدام", domain: "inventory", variants: ["store", "godown"] },
  { en: "Inventory", ur: "انوینٹری", ar: "المخزون", fa: "موجودی", ps: "موجودي", domain: "inventory", variants: ["stock"] },
  { en: "Quantity", ur: "مقدار", ar: "الكمية", fa: "مقدار", ps: "مقدار", domain: "inventory", variants: ["qty"] },
  { en: "Unit", ur: "یونٹ", ar: "الوحدة", fa: "واحد", ps: "واحد", domain: "inventory", variants: ["uom", "unit of measure"] },
  { en: "Rate", ur: "ریٹ", ar: "السعر", fa: "نرخ", ps: "نرخ", domain: "general", variants: ["price", "unit price"] },
  { en: "Amount", ur: "رقم", ar: "المبلغ", fa: "مبلغ", ps: "مقدار", domain: "accounting", variants: ["total amount", "value"] },
  { en: "Advance", ur: "ایڈوانس", ar: "دفعة مقدمة", fa: "پیش‌پرداخت", ps: "وړاندې تادیه", domain: "accounting", variants: ["advance payment", "salary advance"] },
  { en: "Payment", ur: "ادائیگی", ar: "الدفع", fa: "پرداخت", ps: "تادیه", domain: "accounting", variants: ["paid", "receipt"] },
  { en: "Outstanding", ur: "واجب الادا", ar: "المستحق", fa: "معوق", ps: "پاتې", domain: "accounting", variants: ["remaining", "due", "pending payment"] },

  // ── HR ─────────────────────────────────────────────────────────────────
  { en: "Employee", ur: "ملازم", ar: "الموظف", fa: "کارمند", ps: "کارمند", domain: "hr", variants: ["staff", "worker"] },
  { en: "Payroll", ur: "پے رول", ar: "كشوف المرتبات", fa: "لیست حقوق", ps: "د معاشونو لیست", domain: "hr" },
  { en: "Salary", ur: "تنخواہ", ar: "الراتب", fa: "حقوق", ps: "معاش", domain: "hr", variants: ["basic salary", "gross salary"] },
  { en: "Attendance", ur: "حاضری", ar: "الحضور", fa: "حضور و غیاب", ps: "حاضري", domain: "hr" },
  { en: "Leave", ur: "چھٹی", ar: "الإجازة", fa: "مرخصی", ps: "رخصتي", domain: "hr" },
  { en: "Deduction", ur: "کٹوتی", ar: "الاستقطاع", fa: "کسر", ps: "کمښت", domain: "hr", variants: ["deductions"] },
  { en: "Gratuity", ur: "گریجویٹی", ar: "مكافأة نهاية الخدمة", fa: "پاداش پایان خدمت", ps: "د خدمت پای انعام", domain: "hr" },

  // ── Report / status chrome ─────────────────────────────────────────────
  { en: "Report", ur: "رپورٹ", ar: "تقرير", fa: "گزارش", ps: "راپور", domain: "general" },
  { en: "Status", ur: "حیثیت", ar: "الحالة", fa: "وضعیت", ps: "حالت", domain: "general" },
  { en: "Draft", ur: "مسودہ", ar: "مسودة", fa: "پیش‌نویس", ps: "مسوده", domain: "general" },
  { en: "Approved", ur: "منظور شدہ", ar: "معتمد", fa: "تأییدشده", ps: "منظور شوی", domain: "general" },
  { en: "Pending", ur: "زیرِ التوا", ar: "قيد الانتظار", fa: "در انتظار", ps: "پاتې", domain: "general" },
  { en: "Completed", ur: "مکمل", ar: "مكتمل", fa: "تکمیل‌شده", ps: "بشپړ شوی", domain: "general" },
  { en: "Transferred", ur: "منتقل شدہ", ar: "محوّل", fa: "منتقل‌شده", ps: "لېږدول شوی", domain: "general" },
  { en: "Date", ur: "تاریخ", ar: "التاريخ", fa: "تاریخ", ps: "نېټه", domain: "general" },
  { en: "Total", ur: "کل", ar: "الإجمالي", fa: "مجموع", ps: "ټول", domain: "general" },

  // ── common connective words (help sentence-level substitution read naturally) ──
  { en: "and", ur: "اور", ar: "و", fa: "و", ps: "او", domain: "general" },
  { en: "for", ur: "کے لیے", ar: "لأجل", fa: "برای", ps: "لپاره", domain: "general" },
  { en: "to", ur: "کو", ar: "إلى", fa: "به", ps: "ته", domain: "general" },
  { en: "from", ur: "سے", ar: "من", fa: "از", ps: "له", domain: "general" },
  { en: "of", ur: "کا", ar: "من", fa: "از", ps: "د", domain: "general" },
  { en: "with", ur: "کے ساتھ", ar: "مع", fa: "با", ps: "سره", domain: "general" },
  { en: "against", ur: "کے عوض", ar: "مقابل", fa: "در برابر", ps: "په مقابل کې", domain: "accounting" },
  { en: "charges", ur: "چارجز", ar: "رسوم", fa: "هزینه‌ها", ps: "لګښتونه", domain: "general" },
  { en: "expense", ur: "اخراجات", ar: "مصروف", fa: "هزینه", ps: "لګښت", domain: "accounting", variants: ["expenses"] },
  { en: "ready", ur: "تیار", ar: "جاهز", fa: "آماده", ps: "چمتو", domain: "general" },
  { en: "dispatch", ur: "روانگی", ar: "إرسال", fa: "ارسال", ps: "لېږل", domain: "shipping", variants: ["dispatched"] },
  { en: "done", ur: "مکمل", ar: "تم", fa: "انجام شد", ps: "ترسره شو", domain: "general" },
  { en: "received", ur: "موصول", ar: "مستلم", fa: "دریافت شد", ps: "ترلاسه شو", domain: "general" },
  { en: "sent", ur: "بھیج دیا", ar: "مرسل", fa: "ارسال شد", ps: "ولېږل شو", domain: "general" },
  { en: "paid", ur: "ادا شدہ", ar: "مدفوع", fa: "پرداخت شد", ps: "ورکړل شو", domain: "accounting" },
  { en: "confirm", ur: "تصدیق کریں", ar: "تأكيد", fa: "تأیید کنید", ps: "تایید کړئ", domain: "general", variants: ["confirmed", "confirmation"] },
  { en: "cancelled", ur: "منسوخ", ar: "ملغى", fa: "لغو شد", ps: "لغوه شو", domain: "general", variants: ["canceled"] },
  { en: "urgent", ur: "فوری", ar: "عاجل", fa: "فوری", ps: "بیړني", domain: "general" },
  { en: "please", ur: "براہ کرم", ar: "من فضلك", fa: "لطفاً", ps: "مهرباني وکړئ", domain: "general" },
  { en: "thank you", ur: "شکریہ", ar: "شكرًا", fa: "متشکرم", ps: "مننه", domain: "general", variants: ["thanks"] },
  { en: "tomorrow", ur: "کل", ar: "غدًا", fa: "فردا", ps: "سبا", domain: "general" },
  { en: "today", ur: "آج", ar: "اليوم", fa: "امروز", ps: "نن", domain: "general" },
  { en: "morning", ur: "صبح", ar: "الصباح", fa: "صبح", ps: "سهار", domain: "general" },
];

/** Fast lookup: normalized source term (any language) -> entry. */
export function buildGlossaryIndex(normalize: (s: string) => string) {
  const map = new Map<string, GlossaryEntry>();
  const add = (term: string, entry: GlossaryEntry) => {
    const k = normalize(term);
    if (k && !map.has(k)) map.set(k, entry);
  };
  for (const e of ERP_GLOSSARY) {
    (["en", "ur", "ar", "fa", "ps"] as const).forEach((l) => add(e[l], e));
    (e.variants || []).forEach((v) => add(v, e));
  }
  return map;
}

export function glossaryValue(entry: GlossaryEntry, lang: SupportedLanguage): string {
  return entry[lang] || entry.en;
}
