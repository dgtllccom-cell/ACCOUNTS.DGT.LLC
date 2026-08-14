import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateHeader, hasHeaderTranslation } from "@/lib/i18n/table-headers";

/**
 * Cell VALUE translations for the finite, enumerable vocabulary that appears inside
 * table rows and drill-down/detail screens — NOT free-form master-data text.
 *
 * Why this exists: `<Th>` / translateHeader() only translate column HEADINGS. The data
 * inside rows (status badges, next-step labels, shipment types, journey step names,
 * payment methods/conditions, quantity units, common origin countries) is a small,
 * closed set of system-generated strings. Those must also follow the language selector,
 * otherwise switching to Urdu leaves the whole grid in English except the headers
 * (the exact bug reported on the Stock/Journal report).
 *
 * Free-form master-data names (supplier/company/goods names a user typed) are handled
 * separately by localizeRecordNames() against `record_translations`. This dictionary is
 * only for the controlled vocabulary the system itself emits.
 *
 * Lookup order: this dictionary → translateHeader() (shares 300+ terms like WAREHOUSE,
 * RECEIVED, GENERAL GOODS, COMPLETED) → original text. Always safe: unknown/`en`
 * returns the input unchanged, so wrapping any cell value can never blank it out.
 */

type Row = { ur: string; ar: string; fa: string; ps: string };

const VALUE_TRANSLATIONS: Record<string, Row> = {
  // ── Lifecycle / current status ───────────────────────────────────────────
  "IN WAREHOUSE": { ur: "گودام میں", ar: "في المستودع", fa: "در انبار", ps: "په ګودام کې" },
  "IN LOADING": { ur: "لوڈنگ میں", ar: "قيد التحميل", fa: "در حال بارگیری", ps: "په بارولو کې" },
  "LOADING READY": { ur: "لوڈنگ تیار", ar: "جاهز للتحميل", fa: "آماده بارگیری", ps: "بارول چمتو" },
  "IN TRANSIT (EXPORT)": { ur: "ٹرانزٹ میں (برآمد)", ar: "قيد النقل (تصدير)", fa: "در حال ترانزیت (صادرات)", ps: "په لېږد کې (صادرات)" },
  "IN TRANSIT": { ur: "ٹرانزٹ میں", ar: "قيد النقل", fa: "در حال ترانزیت", ps: "په لېږد کې" },
  "DOCUMENTATION": { ur: "دستاویزات", ar: "التوثيق", fa: "مستندسازی", ps: "اسنادونه" },
  "DELIVERED": { ur: "پہنچا دیا گیا", ar: "تم التسليم", fa: "تحویل شد", ps: "سل شوی" },
  "DELIVERED / COMPLETED": { ur: "پہنچا دیا / مکمل", ar: "تم التسليم / مكتمل", fa: "تحویل شد / تکمیل", ps: "سل شوی / بشپړ" },
  "CUSTOMS CLEARANCE": { ur: "کسٹمز کلیئرنس", ar: "التخليص الجمركي", fa: "ترخیص گمرکی", ps: "ګمرکي پاکول" },
  "BOOKING CREATED": { ur: "بکنگ بن گئی", ar: "تم إنشاء الحجز", fa: "رزرو ایجاد شد", ps: "بکنګ جوړ شو" },
  "ACCEPTED": { ur: "قبول شدہ", ar: "مقبول", fa: "پذیرفته شد", ps: "منل شوی" },
  "INVOICE PAYMENT": { ur: "انوائس ادائیگی", ar: "دفع الفاتورة", fa: "پرداخت فاکتور", ps: "د رسید تادیه" },

  // ── Next-step labels (badges) ────────────────────────────────────────────
  "INVOICE PAYMENT HUA": { ur: "انوائس ادائیگی ہو گئی", ar: "تم دفع الفاتورة", fa: "پرداخت فاکتور انجام شد", ps: "د رسید تادیه وشوه" },
  "INVOICE PAYMENT PENDING": { ur: "انوائس ادائیگی باقی", ar: "دفع الفاتورة معلق", fa: "پرداخت فاکتور در انتظار", ps: "د رسید تادیه پاتې" },
  "REMAINING PAYMENT": { ur: "باقی ادائیگی", ar: "الدفعة المتبقية", fa: "پرداخت باقی‌مانده", ps: "پاتې تادیه" },
  "DISPATCH": { ur: "روانگی", ar: "الإرسال", fa: "ارسال", ps: "لېږل" },

  // ── Shipment types ───────────────────────────────────────────────────────
  "WAREHOUSE": { ur: "گودام", ar: "المستودع", fa: "انبار", ps: "ګودام" },
  "LOADING": { ur: "لوڈنگ", ar: "التحميل", fa: "بارگیری", ps: "بارول" },
  "EXPORT": { ur: "برآمد", ar: "تصدير", fa: "صادرات", ps: "صادرات" },

  // ── Journey step operators / actors ──────────────────────────────────────
  "WAREHOUSE STAFF": { ur: "گودام عملہ", ar: "موظفو المستودع", fa: "کارکنان انبار", ps: "د ګودام کارکوونکي" },
  "LOADER OPERATOR": { ur: "لوڈر آپریٹر", ar: "مشغل التحميل", fa: "اپراتور بارگیری", ps: "د بارولو چلوونکی" },
  "LOGISTICS TEAM": { ur: "لاجسٹکس ٹیم", ar: "فريق اللوجستيات", fa: "تیم لجستیک", ps: "د لوژستیک ټیم" },
  "EXPORT DEPT": { ur: "برآمد شعبہ", ar: "قسم التصدير", fa: "بخش صادرات", ps: "د صادراتو څانګه" },
  "CLEARING AGENT": { ur: "کلیئرنگ ایجنٹ", ar: "وكيل التخليص", fa: "نماینده ترخیص", ps: "د پاکولو ایجنټ" },
  "CUSTOMS AGENT": { ur: "کسٹمز ایجنٹ", ar: "وكيل الجمارك", fa: "نماینده گمرک", ps: "د ګمرک ایجنټ" },
  "DELIVERY TEAM": { ur: "ڈیلیوری ٹیم", ar: "فريق التسليم", fa: "تیم تحویل", ps: "د سلولو ټیم" },
  "ACCOUNTANT A/C": { ur: "اکاؤنٹنٹ", ar: "المحاسب", fa: "حسابدار", ps: "محاسب" },
  "SUPER ADMIN": { ur: "سپر ایڈمن", ar: "المشرف العام", fa: "مدیر ارشد", ps: "سوپر اډمین" },
  "IN PROGRESS": { ur: "جاری ہے", ar: "قيد التنفيذ", fa: "در حال انجام", ps: "روان دی" },
  "PENDING": { ur: "زیر التواء", ar: "معلق", fa: "در انتظار", ps: "پاتې" },

  // ── Quantity units ───────────────────────────────────────────────────────
  "BAGS": { ur: "تھیلے", ar: "أكياس", fa: "کیسه‌ها", ps: "بوجۍ" },
  "BAG": { ur: "تھیلا", ar: "كيس", fa: "کیسه", ps: "بوجۍ" },
  "CARTONS": { ur: "کارٹن", ar: "كراتين", fa: "کارتن‌ها", ps: "کارتنونه" },
  "CANS": { ur: "کین", ar: "علب", fa: "قوطی‌ها", ps: "کینونه" },
  "KGS": { ur: "کلوگرام", ar: "كجم", fa: "کیلوگرم", ps: "کیلوګرامه" },
  "PCS": { ur: "عدد", ar: "قطع", fa: "عدد", ps: "دانې" },

  // ── Payment methods / conditions ─────────────────────────────────────────
  "BANK TRANSFER": { ur: "بینک ٹرانسفر", ar: "تحويل بنكي", fa: "انتقال بانکی", ps: "بانکي لېږد" },
  "CASH": { ur: "نقد", ar: "نقداً", fa: "نقدی", ps: "نغدي" },
  "CLEARED": { ur: "کلیئر", ar: "تمت التسوية", fa: "تسویه شد", ps: "پاک شوی" },
  "ADVANCE PAID (FULL)": { ur: "ایڈوانس مکمل ادا", ar: "دفعة مقدمة (كاملة)", fa: "پیش‌پرداخت (کامل)", ps: "پېشوړی (بشپړ)" },
  "ADVANCE PAID (PART)": { ur: "ایڈوانس جزوی ادا", ar: "دفعة مقدمة (جزئية)", fa: "پیش‌پرداخت (جزئی)", ps: "پېشوړی (جزوي)" },
  "PARTIALLY PAID": { ur: "جزوی ادائیگی", ar: "مدفوع جزئياً", fa: "پرداخت جزئی", ps: "جزوي تادیه" },
  "CREDIT (30 DAYS)": { ur: "ادھار (30 دن)", ar: "آجل (30 يوماً)", fa: "اعتباری (۳۰ روز)", ps: "پور (۳۰ ورځې)" },
  "ADVANCE": { ur: "ایڈوانس", ar: "دفعة مقدمة", fa: "پیش‌پرداخت", ps: "پېشوړی" },
  "REMAINING": { ur: "باقی", ar: "المتبقي", fa: "باقی‌مانده", ps: "پاتې" },
  "FINAL": { ur: "حتمی", ar: "نهائي", fa: "نهایی", ps: "وروستی" },

  // ── Common origin countries (goods origin column) ────────────────────────
  "PAKISTAN": { ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
  "INDIA": { ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" },
  "CHINA": { ur: "چین", ar: "الصين", fa: "چین", ps: "چین" },
  "IRAN": { ur: "ایران", ar: "إيران", fa: "ایران", ps: "ایران" },
  "AFGHANISTAN": { ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" },
  "UNITED ARAB EMIRATES": { ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
  "LOCAL": { ur: "مقامی", ar: "محلي", fa: "محلی", ps: "سیمه ییز" },

  // ── Inventory / stock movement types & statuses ──────────────────────────
  "STOCK_IN": { ur: "اسٹاک اِن", ar: "إدخال مخزون", fa: "ورود موجودی", ps: "سټاک ننوتل" },
  "STOCK_OUT": { ur: "اسٹاک آؤٹ", ar: "إخراج مخزون", fa: "خروج موجودی", ps: "سټاک وتل" },
  "STOCK IN": { ur: "اسٹاک اِن", ar: "إدخال مخزون", fa: "ورود موجودی", ps: "سټاک ننوتل" },
  "STOCK OUT": { ur: "اسٹاک آؤٹ", ar: "إخراج مخزون", fa: "خروج موجودی", ps: "سټاک وتل" },
  "ADJUSTMENT": { ur: "ایڈجسٹمنٹ", ar: "تسوية", fa: "تعدیل", ps: "برابرول" },
  "TRANSFER": { ur: "منتقلی", ar: "تحويل", fa: "انتقال", ps: "لېږد" },
  "ON HAND": { ur: "موجود", ar: "المتوفر", fa: "موجود", ps: "شته" },
  "AVAILABLE": { ur: "دستیاب", ar: "متاح", fa: "در دسترس", ps: "شته" },

  // ── System-generated goods defaults (not user master data) ───────────────
  "GENERAL GOODS": { ur: "عام سامان", ar: "بضائع عامة", fa: "کالای عمومی", ps: "عمومي توکي" },
  "GENERAL SUPPLIER": { ur: "عام سپلائر", ar: "مورد عام", fa: "تأمین‌کننده عمومی", ps: "عمومي عرضه کوونکی" },
  "LOCAL SUPPLIER": { ur: "مقامی سپلائر", ar: "مورد محلي", fa: "تأمین‌کننده محلی", ps: "سیمه ییز عرضه کوونکی" },
};

function normalize(label: string): string {
  return label.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Translate a controlled-vocabulary cell VALUE into the active language.
 * Order: value dictionary → header dictionary → original text.
 * Returns the input unchanged for `en`, empty, or unknown values (never blanks a cell).
 */
export function translateValue(
  lang: SupportedLanguage | string | null | undefined,
  value: string | null | undefined
): string {
  const original = value ?? "";
  if (!original.trim()) return original;
  const code = (lang || "en") as string;
  if (code === "en") return original;

  const row = VALUE_TRANSLATIONS[normalize(original)];
  if (row) return row[code as keyof Row] || original;

  // Fall back to the shared header dictionary (covers WAREHOUSE, RECEIVED, COMPLETED, …).
  if (hasHeaderTranslation(original)) return translateHeader(code, original);

  return original;
}

/** True when a controlled value has a translation registered (value or header dict). */
export function hasValueTranslation(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  return Boolean(VALUE_TRANSLATIONS[normalize(value)]) || hasHeaderTranslation(value);
}
