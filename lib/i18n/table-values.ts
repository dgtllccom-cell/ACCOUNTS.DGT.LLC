import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateHeader, hasHeaderTranslation, HEADER_TRANSLATIONS, registeredUiDictionaries } from "@/lib/i18n/table-headers";
import { localizeTerm } from "@/lib/i18n/transliteration";
import { ERP_GLOSSARY } from "@/lib/i18n/erp-glossary";

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

export const VALUE_TRANSLATIONS: Record<string, Row> = {
  // ── Lifecycle / current status ───────────────────────────────────────────
  "IN WAREHOUSE": { ur: "گودام میں", ar: "في المستودع", fa: "در انبار", ps: "په ګودام کې" },
  "IN LOADING": { ur: "لوڈنگ میں", ar: "قيد التحميل", fa: "در حال بارگیری", ps: "په بارولو کې" },
  "LOADING READY": { ur: "لوڈنگ تیار", ar: "جاهز للتحميل", fa: "آماده بارگیری", ps: "بارول چمتو" },
  "IN TRANSIT (EXPORT)": { ur: "ٹرانزٹ میں (برآمد)", ar: "قيد النقل (تصدير)", fa: "در حال ترانزیت (صادرات)", ps: "په لېږد کې (صادرات)" },
  "IN TRANSIT": { ur: "ٹرانزٹ میں", ar: "قيد النقل", fa: "در حال ترانزیت", ps: "په لېږد کې" },
  "DISPATCHED": { ur: "روانہ کر دیا گیا", ar: "تم الشحن", fa: "ارسال شد", ps: "لېږل شوی" },
  "ADVANCE PAYMENT": { ur: "ایڈوانس ادائیگی", ar: "دفعة مقدمة", fa: "پیش‌پرداخت", ps: "پیشکي تادیه" },
  "BY SEA": { ur: "بذریعہ سمندر", ar: "عن طريق البحر", fa: "از طریق دریا", ps: "د سمندر له لارې" },
  "UNPAID": { ur: "غیر ادا شدہ", ar: "غير مدفوع", fa: "پرداخت‌نشده", ps: "نه تادیه شوی" },
  "STANDARD": { ur: "معیاری", ar: "قياسي", fa: "استاندارد", ps: "معیاري" },
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
  "SUPER ADMIN WORKSPACE": { ur: "سپر ایڈمن ورک اسپیس", ar: "مساحة عمل المشرف العام", fa: "فضای کاری مدیر ارشد", ps: "د سوپر اډمین کاري ځای" },
  "CONTROL ACCOUNT": { ur: "کنٹرول اکاؤنٹ", ar: "حساب مراقبة", fa: "حساب کنترل", ps: "کنټرول حساب" },
  "CITY BRANCH": { ur: "سٹی برانچ", ar: "فرع المدينة", fa: "شعبه شهر", ps: "د ښار څانګه" },
  "MAIN BRANCH": { ur: "مین برانچ", ar: "الفرع الرئيسي", fa: "شعبه اصلی", ps: "اصلي څانګه" },
  "COUNTRY": { ur: "ملک", ar: "الدولة", fa: "کشور", ps: "هېواد" },
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

  // ── Common origin / operating countries & territories ────────────────────────
  "PAKISTAN": { ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
  "INDIA": { ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" },
  "CHINA": { ur: "چین", ar: "الصين", fa: "چین", ps: "چین" },
  "IRAN": { ur: "ایران", ar: "إيران", fa: "ایران", ps: "ایران" },
  "AFGHANISTAN": { ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" },
  "UNITED ARAB EMIRATES": { ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
  "UAE": { ur: "متحدہ عرب امارات", ar: "الإمارات", fa: "امارات", ps: "امارات" },
  "DUBAI": { ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دوبۍ" },
  "SAUDI ARABIA": { ur: "سعودی عرب", ar: "المملكة العربية السعودية", fa: "عربستان سعودی", ps: "سعودي عربستان" },
  "KSA": { ur: "سعودی عرب", ar: "السعودية", fa: "عربستان", ps: "سعودي" },
  "UNITED STATES": { ur: "امریکہ", ar: "الولايات المتحدة", fa: "ایالات متحده", ps: "متحده ایالات" },
  "USA": { ur: "امریکہ", ar: "أمريكا", fa: "آمریکا", ps: "امریکا" },
  "UNITED KINGDOM": { ur: "برطانیہ", ar: "المملكة المتحدة", fa: "بریتانیا", ps: "برتانیه" },
  "UK": { ur: "برطانیہ", ar: "بريطانيا", fa: "بریتانیا", ps: "برتانیه" },
  "RUSSIA": { ur: "روس", ar: "روسيا", fa: "روسیه", ps: "روسیه" },
  "TURKEY": { ur: "ترکی", ar: "تركيا", fa: "ترکیه", ps: "ترکیه" },
  "TURKIYE": { ur: "ترکیہ", ar: "تركيا", fa: "ترکیه", ps: "ترکیه" },
  "KAZAKHSTAN": { ur: "قازقستان", ar: "كازاخستان", fa: "قزاقستان", ps: "قزاقستان" },
  "TAJIKISTAN": { ur: "تاجکستان", ar: "طاجيكستان", fa: "تاجیکستان", ps: "تاجکستان" },
  "TURKMENISTAN": { ur: "ترکمانستان", ar: "تركمانستان", fa: "ترکمنستان", ps: "ترکمنستان" },
  "UZBEKISTAN": { ur: "ازبکستان", ar: "أوزبكستان", fa: "ازبکستان", ps: "ازبکستان" },
  "OMAN": { ur: "عمان", ar: "عُمان", fa: "عمان", ps: "عمان" },
  "QATAR": { ur: "قطر", ar: "قطر", fa: "قطر", ps: "قطر" },
  "KUWAIT": { ur: "کویت", ar: "الكويت", fa: "کویت", ps: "کویت" },
  "BAHRAIN": { ur: "بحرین", ar: "البحرين", fa: "بحرین", ps: "بحرین" },
  "GERMANY": { ur: "جرمنی", ar: "ألمانيا", fa: "آلمان", ps: "جرمني" },
  "JAPAN": { ur: "جاپان", ar: "اليابان", fa: "ژاپن", ps: "جاپان" },
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

  // ── Ledger / account enum values (kind, normal balance, status, type) ────
  "INCOME": { ur: "آمدنی", ar: "دخل", fa: "درآمد", ps: "عاید" },
  "EXPENSE": { ur: "خرچہ", ar: "مصروف", fa: "هزینه", ps: "لګښت" },
  "ASSET": { ur: "اثاثہ", ar: "أصل", fa: "دارایی", ps: "شتمنه" },
  "LIABILITY": { ur: "واجبات", ar: "التزام", fa: "بدهی", ps: "پور" },
  "EQUITY": { ur: "سرمایہ", ar: "حقوق الملكية", fa: "حقوق صاحبان سهام", ps: "پانګه" },
  // Required accounting terminology: UR/PS use بنام (Debit) / جمع (Credit); AR/FA keep the
  // established accounting terms (مدين/دائن, بدهکار/بستانکار). Not transliterations.
  "CREDIT": { ur: "جمع", ar: "دائن", fa: "بستانکار", ps: "جمع" },
  "DEBIT": { ur: "بنام", ar: "مدين", fa: "بدهکار", ps: "بنام" },
  "DR": { ur: "بنام", ar: "مدين", fa: "بدهکار", ps: "بنام" },
  "CR": { ur: "جمع", ar: "دائن", fa: "بستانکار", ps: "جمع" },
  "ACTIVE": { ur: "فعال", ar: "نشط", fa: "فعال", ps: "فعال" },
  "INACTIVE": { ur: "غیر فعال", ar: "غير نشط", fa: "غیرفعال", ps: "غیرفعال" },
  "RECEIVABLE": { ur: "قابل وصول", ar: "مستحق القبض", fa: "دریافتنی", ps: "د ترلاسه وړ" },
  "PAYABLE": { ur: "قابل ادائیگی", ar: "مستحق الدفع", fa: "پرداختنی", ps: "د ورکړې وړ" },
  "NORMAL ACCOUNT": { ur: "عام اکاؤنٹ", ar: "حساب عادي", fa: "حساب عادی", ps: "عادي حساب" },
  "CENTRAL ACCOUNT": { ur: "مرکزی اکاؤنٹ", ar: "حساب مركزي", fa: "حساب مرکزی", ps: "مرکزي حساب" },
  "ROZNAMCHA": { ur: "روزنامچہ", ar: "دفتر اليومية", fa: "روزنامچه", ps: "روزنامچه" },
  "OPENING BALANCE": { ur: "ابتدائی بیلنس", ar: "الرصيد الافتتاحي", fa: "مانده اولیه", ps: "پرانستی بیلانس" },
  "CLOSING BALANCE": { ur: "اختتامی بیلنس", ar: "الرصيد الختامي", fa: "مانده پایانی", ps: "پای بیلانس" },
  "OVERDUE": { ur: "زائد المیعاد", ar: "متأخر", fa: "سررسیدگذشته", ps: "له نېټې تېر" },
  "GENERAL": { ur: "عام", ar: "عام", fa: "عمومی", ps: "عمومي" },
  "ZERO": { ur: "صفر", ar: "صفر", fa: "صفر", ps: "صفر" },
  "EXPENSES ACCOUNT": { ur: "اخراجات کا اکاؤنٹ", ar: "حساب المصروفات", fa: "حساب هزینه‌ها", ps: "د لګښتونو حساب" },
  "EXPENSE ACCOUNT": { ur: "اخراجات کا اکاؤنٹ", ar: "حساب المصروفات", fa: "حساب هزینه‌ها", ps: "د لګښتونو حساب" },
  "OFFICE EXPENSES": { ur: "دفتر کے اخراجات", ar: "مصروفات المكتب", fa: "هزینه‌های دفتر", ps: "د دفتر لګښتونه" },
  "OPERATIONAL EXPENSES": { ur: "آپریشنل اخراجات", ar: "المصروفات التشغيلية", fa: "هزینه‌های عملیاتی", ps: "عملیاتي لګښتونه" },
  "UTILITY & BILLS": { ur: "یوٹیلیٹی اور بلز", ar: "المرافق والفواتير", fa: "قبوض و خدمات شهری", ps: "د اوبو او برېښنا لګښتونه" },
  "RENT & LEASE": { ur: "کرایہ اور لیز", ar: "الإيجار وعقود الإيجار", fa: "اجاره و کرایه", ps: "کرایه او اجاره" },
  "SALARIES & WAGES": { ur: "تنخواہیں اور اجرت", ar: "الرواتب والأجور", fa: "حقوق و دستمزد", ps: "معاشونه او مزدوري" },
  "TRAVEL & TRANSPORT": { ur: "سفر اور ٹرانسپورٹ", ar: "السفر والمواصلات", fa: "سفر و ترابری", ps: "سفر او ترانسپورت" },
  "MARKETING & ADVERTISING": { ur: "مارکیٹنگ اور اشتہارات", ar: "التسويق والإعلان", fa: "بازاریابی و تبلیغات", ps: "بازارموندنه او اعلانونه" },
  "LEGAL & PROFESSIONAL": { ur: "قانونی اور پیشہ ورانہ", ar: "الخدمات القانونية والمهنية", fa: "حقوقی و حرفه‌ای", ps: "حقوقي او مسلکي" },
  "MAINTENANCE & REPAIRS": { ur: "دیکھ بھال اور مرمت", ar: "الصيانة والإصلاحات", fa: "نگهداری و تعمیرات", ps: "ساتنه او ترمیم" },
  "MISCELLANEOUS EXPENSES": { ur: "متفرق اخراجات", ar: "مصروفات متنوعة", fa: "هزینه‌های متفرقه", ps: "متفرقه لګښتونه" },

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
  // A value saved in Urdu / Pashto / Persian / Arabic (a status, type or term typed or picked in that language) is looked up in the
  // approved dictionaries in every language, so an English viewer reads the English term instead of the entry language.
  const savedInOtherScript = PERSO_ARABIC_RE.test(original);
  if (code === "en") return savedInOtherScript ? vocabularyFor("en", original) ?? original : original;

  const row = VALUE_TRANSLATIONS[normalize(original)];
  if (row) return row[code as keyof Row] || original;

  // Fall back to the shared header dictionary (covers WAREHOUSE, RECEIVED, COMPLETED, …).
  if (hasHeaderTranslation(original)) return translateHeader(code, original);

  if (savedInOtherScript) return vocabularyFor(code as SupportedLanguage, original) ?? original;
  return original;
}

// ── Saved-value vocabulary: a known term saved in ANY of the five languages ──────────────────────────────────────────────
// The value dictionaries above are keyed by English, so a term saved in another language ("گودام", "موبائل فون", "پارٹی") never
// matched and stayed in the entry language for every viewer. This index reads the SAME approved dictionaries (value + header
// dictionaries, the curated ERP glossary and the central UI dictionary) in all five languages, so an exact, unambiguous match of a
// saved value resolves to that term in the viewer's language. Exact whole-value matches only — no word-by-word substitution — and
// never for names (callers skip legal names). Approved terms only: nothing here is machine output.

export type VocabularyEntry = Record<SupportedLanguage, string>;
const VOCAB_LANGS: SupportedLanguage[] = ["en", "ur", "ar", "fa", "ps"];
const PERSO_ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** Normalize a saved value for matching across spelling variants of the same letters (Arabic vs Urdu/Persian yeh / kaf / heh,
 *  harakat, tatweel, zero-width marks, Eastern digits, case, surrounding punctuation). Matching only — never written back. */
export function normalizeVocabularyText(value: string): string {
  const input = String(value ?? "");
  let out = "";
  let pendingSpace = false;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // harakat, superscript alef, tatweel and the zero-width / direction marks carry no letter
    if ((code >= 0x064b && code <= 0x065f) || code === 0x0670 || code === 0x0640 || (code >= 0x200c && code <= 0x200f) || code === 0xfeff) continue;
    if (code === 32 || code === 9 || code === 10 || code === 13 || code === 0xa0) {
      pendingSpace = out.length > 0;
      continue;
    }
    let ch = input[i];
    if (code === 0x064a || code === 0x0649) ch = "ی";
    else if (code === 0x0643) ch = "ک";
    else if (code === 0x06c1 || code === 0x06c3 || code === 0x0629 || code === 0x06c0) ch = "ه";
    else if (code === 0x0623 || code === 0x0625 || code === 0x0671 || code === 0x0622) ch = "ا";
    else if (code >= 0x06f0 && code <= 0x06f9) ch = String(code - 0x06f0);
    else if (code >= 0x0660 && code <= 0x0669) ch = String(code - 0x0660);
    if (pendingSpace) out += " ";
    pendingSpace = false;
    out += ch;
  }
  return out.replace(EDGE_PUNCTUATION_RE, "").trim().toLowerCase();
}
const EDGE_PUNCTUATION_RE = /^[.:;،؛,!?؟\-–—]+|[.:;،؛,!?؟\-–—]+$/g;
const LETTER_RE = /\p{L}/u;

/** Enough letters to be a term (initials such as "پ ش", one-letter or two-letter abbreviations never match a dictionary word). */
function isMatchableTerm(norm: string): boolean {
  let letters = 0;
  let run = 0;
  let longest = 0;
  for (const ch of norm) {
    if (ch === " ") { run = 0; continue; }
    if (LETTER_RE.test(ch)) {
      letters++;
      run++;
      if (run > longest) longest = run;
    }
  }
  return letters >= 3 && longest >= 2;
}

type VocabCandidate = { entry: Partial<VocabularyEntry>; weight: number };
let vocabularyIndex: Map<string, Map<string, VocabCandidate[]>> | null = null;
let vocabularyBuiltWithUi = false;
const registeredVocabulary: Array<{ entry: Partial<VocabularyEntry>; weight: number }> = [];

const ACRONYMS = new Set(["VAT", "BL", "B/L", "CNIC", "NTN", "USD", "AED", "PKR", "AFN", "IRR", "SAR", "ID", "PO", "SO", "GD", "LC", "TT", "HR", "IT", "UAE", "KSA", "UK", "USA", "PDF", "SMS", "CEO", "ERP", "QR", "OTP", "KG", "MT", "CBM", "FOB", "CIF", "CFR"]);
function displayEnglish(key: string): string {
  if (/[a-z]/.test(key)) return key;
  return key.split(" ").map((word) => (ACRONYMS.has(word) || /\d/.test(word) ? word : word.charAt(0) + word.slice(1).toLowerCase())).join(" ");
}

function addVocabulary(index: Map<string, Map<string, VocabCandidate[]>>, entry: Partial<VocabularyEntry>, weight: number) {
  const english = (entry.en ?? "").trim();
  if (!english) return;
  const englishKey = english.toLowerCase();
  for (const lang of VOCAB_LANGS) {
    if (lang === "en") continue; // only values saved in another language are looked up here; English values use the forward dictionaries
    const text = (entry[lang] ?? "").trim();
    if (!text || text === english) continue;
    const norm = normalizeVocabularyText(text);
    if (!isMatchableTerm(norm)) continue;
    let byEnglish = index.get(norm);
    if (!byEnglish) index.set(norm, (byEnglish = new Map()));
    const list = byEnglish.get(englishKey);
    if (list) list.push({ entry, weight });
    else byEnglish.set(englishKey, [{ entry, weight }]);
  }
}

function getVocabularyIndex(): Map<string, Map<string, VocabCandidate[]>> {
  const ui = registeredUiDictionaries();
  if (vocabularyIndex && (vocabularyBuiltWithUi || !ui)) return vocabularyIndex;
  const index = new Map<string, Map<string, VocabCandidate[]>>();
  for (const item of registeredVocabulary) addVocabulary(index, item.entry, item.weight);
  for (const [key, row] of Object.entries(VALUE_TRANSLATIONS)) addVocabulary(index, { en: displayEnglish(key), ...row }, 50);
  for (const [key, row] of Object.entries(HEADER_TRANSLATIONS)) addVocabulary(index, { en: displayEnglish(key), ...row }, 40);
  for (const entry of ERP_GLOSSARY) addVocabulary(index, entry, 40);
  if (ui?.en) {
    for (const [key, english] of Object.entries(ui.en)) {
      if (!english || /[{}<>]/.test(english) || english.length > 80) continue;
      addVocabulary(index, { en: english, ur: ui.ur?.[key], ar: ui.ar?.[key], fa: ui.fa?.[key], ps: ui.ps?.[key] }, 1);
    }
  }
  vocabularyIndex = index;
  vocabularyBuiltWithUi = Boolean(ui);
  return index;
}

/** Server side: add approved central-dictionary rows (record_translations 'system_dictionary') to the vocabulary, above the static
 *  dictionaries. Replaces the previously registered set. */
export function registerApprovedVocabulary(entries: Array<Partial<VocabularyEntry>>): void {
  registeredVocabulary.length = 0;
  for (const entry of entries) registeredVocabulary.push({ entry, weight: 100 });
  vocabularyIndex = null;
}

/** The approved term a saved value is (any language, exact and unambiguous), or null. */
export function lookupVocabulary(value: string | null | undefined): Partial<VocabularyEntry> | null {
  const norm = normalizeVocabularyText(value ?? "");
  if (!isMatchableTerm(norm)) return null;
  const byEnglish = getVocabularyIndex().get(norm);
  if (!byEnglish) return null;
  let best: { english: string; weight: number; candidates: VocabCandidate[] } | null = null;
  let total = 0;
  for (const [english, candidates] of byEnglish) {
    const weight = candidates.reduce((sum, c) => sum + c.weight, 0);
    total += weight;
    if (!best || weight > best.weight) best = { english, weight, candidates };
  }
  // the same spelling can mean different terms; only a clear majority of the dictionaries counts as "this term"
  if (!best || best.weight * 3 < total * 2) return null;
  const ordered = [...best.candidates].sort((a, b) => b.weight - a.weight);
  const merged: Partial<VocabularyEntry> = {};
  for (const lang of VOCAB_LANGS) merged[lang] = ordered.map((c) => (c.entry[lang] ?? "").trim()).find(Boolean) || undefined;
  return merged;
}

/** A saved value in `lang` when it is a known approved term in any language; null when it is not a term or already reads that way. */
export function vocabularyFor(lang: SupportedLanguage, value: string | null | undefined): string | null {
  const original = (value ?? "").trim();
  if (!original) return null;
  const entry = lookupVocabulary(original);
  // a dictionary label can carry a colon ("Driver:") that the saved value does not have
  const target = (entry?.[lang] ?? "").trim().replace(/\s*[:：]$/, /[:：]$/.test(original) ? ":" : "");
  if (!target) return null;
  if (lang !== "en" && target === (entry?.en ?? "").trim()) return null;
  return normalizeVocabularyText(target) === normalizeVocabularyText(original) ? null : target;
}

/** True when a controlled value has a translation registered (value or header dict). */
export function hasValueTranslation(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  return Boolean(VALUE_TRANSLATIONS[normalize(value)]) || hasHeaderTranslation(value);
}

/**
 * Translate a country name into the active language across all 5 supported languages.
 * Order: exact country dictionary -> header dictionary -> authentic names transliteration -> original text.
 */
export function translateCountry(
  name: string | null | undefined,
  lang: SupportedLanguage | string | null | undefined
): string {
  if (!name) return "";
  const code = (lang || "en") as SupportedLanguage;
  if (code === "en") return name;
  const translatedVal = translateValue(code, name);
  if (translatedVal && translatedVal !== name) return translatedVal;
  const translit = localizeTerm(name, code);
  if (translit && translit !== name) return translit;
  return name;
}

