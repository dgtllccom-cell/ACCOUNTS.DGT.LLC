import type { SupportedLanguage } from "./languages";
import { transliterateProperNoun, transliterateToLatin } from "./transliteration";

export interface MultilingualText {
  en: string;
  ur: string;
  ar: string;
  fa: string;
  ps: string;
}

/**
 * Bidirectional Transliteration & Translation dictionary mapping key business,
 * accounting, locations, names, and entity terms into 5 languages.
 */
export const MULTILINGUAL_DICTIONARY: Array<{ en: string; ur: string; ar: string; fa: string; ps: string }> = [
  // Compound Accounts & Ledgers
  { en: "Payable Account", ur: "قابل ادائیگی کھاتہ", ar: "حساب الدفع", fa: "حساب پرداختنی", ps: "د تادیې وړ حساب" },
  { en: "Receivable Account", ur: "قابل وصولی کھاتہ", ar: "حساب القبض", fa: "حساب دریافتنی", ps: "د ترلاسه کولو وړ حساب" },
  { en: "Cash Account", ur: "کیش اکاؤنٹ", ar: "حساب النقد", fa: "حساب نقدی", ps: "د نغدو پیسو حساب" },
  { en: "Bank Account", ur: "بینک اکاؤنٹ", ar: "حساب بنكي", fa: "حساب بانکی", ps: "بانکي حساب" },
  { en: "Purchase Account", ur: "خریداری اکاؤنٹ", ar: "حساب الشراء", fa: "حساب خرید", ps: "د پیرودلو حساب" },
  { en: "Sales Account", ur: "فروخت اکاؤنٹ", ar: "حساب المبيعات", fa: "حساب فروش", ps: "د پلورلو حساب" },
  { en: "Expense Account", ur: "اخراجات اکاؤنٹ", ar: "حساب المصروفات", fa: "حساب هزینه‌ها", ps: "د لګښتونو حساب" },
  { en: "Income Account", ur: "آمدنی اکاؤنٹ", ar: "حساب الإيرادات", fa: "حساب درآمد", ps: "د عاید حساب" },
  { en: "Asset Account", ur: "اثاثہ جات اکاؤنٹ", ar: "حساب الأصول", fa: "حساب دارایی", ps: "د شتمنیو حساب" },
  { en: "Liability Account", ur: "واجبات اکاؤنٹ", ar: "حساب الخصوم", fa: "حساب بدهی", ps: "د پورونو حساب" },
  { en: "Equity Account", ur: "سرمایہ اکاؤنٹ", ar: "حساب حقوق الملكية", fa: "حساب حقوق صاحبان سهام", ps: "د پانګې حساب" },
  { en: "Capital Account", ur: "سرمایہ اکاؤنٹ", ar: "حساب رأس المال", fa: "حساب سرمایه", ps: "د سرمایې حساب" },
  { en: "General Ledger", ur: "جنرل لیجر", ar: "دفتر الأستاذ العام", fa: "دفتر کل", ps: "عمومي لیجر" },
  { en: "Main Branch", ur: "مین برانچ", ar: "الفرع الرئيسي", fa: "شعبه اصلی", ps: "اصلي څانګه" },
  { en: "City Branch", ur: "سٹی برانچ", ar: "فرع المدينة", fa: "شعبه شهری", ps: "د ښار څانګه" },
  { en: "Head Office", ur: "ہیڈ آفس", ar: "المكتب الرئيسي", fa: "دفتر مرکزی", ps: "مرکزي دفتر" },
  { en: "Control Account", ur: "کنٹرول اکاؤنٹ", ar: "حساب المراقبة", fa: "حساب کنترل", ps: "کنټرول حساب" },

  // Banks
  { en: "Habib Bank Limited", ur: "حبیب بینک لمیٹڈ", ar: "حبيب بنك المحدود", fa: "حبیب بانک محدود", ps: "حبیب بانک محدود" },
  { en: "National Bank of Pakistan", ur: "نیشنل بینک آف پاکستان", ar: "بنك باكستان الوطني", fa: "بانک ملی پاکستان", ps: "د پاکستان ملي بانک" },
  { en: "Meezan Bank", ur: "میزان بینک", ar: "بنك ميزان", fa: "بانک میزان", ps: "میزان بانک" },
  { en: "United Bank Limited", ur: "یونائیٹڈ بینک لمیٹڈ", ar: "يونايتد بنك المحدود", fa: "یونایتد بانک محدود", ps: "یونایټډ بانک محدود" },
  { en: "MCB Bank", ur: "ایم سی بی بینک", ar: "بنك إم سي بي", fa: "بانک ام‌سی‌بی", ps: "ایم سي بي بانک" },
  { en: "Bank Alfalah", ur: "بینک الفلاح", ar: "بنك الفلاح", fa: "بانک الفلاح", ps: "بانک الفلاح" },
  { en: "Allied Bank Limited", ur: "الائیڈ بینک لمیٹڈ", ar: "ألايد بنك المحدود", fa: "الاید بانک محدود", ps: "الایډ بانک محدود" },
  { en: "Dubai Islamic Bank", ur: "دبئی اسلامک بینک", ar: "بنك دبي الإسلامي", fa: "بانک اسلامی دبی", ps: "د دبي اسلامي بانک" },
  { en: "Emirates NBD", ur: "امارات این بی ڈی", ar: "الإمارات دبي الوطني", fa: "امارات ان‌بی‌دی", ps: "امارات این بي ډي" },

  // Single Common Words & ERP Concepts
  { en: "Dev", ur: "دیو", ar: "ديف", fa: "دو", ps: "ډیو" },
  { en: "Test", ur: "ٹیسٹ", ar: "اختبار", fa: "تست", ps: "ازموینه" },
  { en: "Demo", ur: "ڈیمو", ar: "تجريبي", fa: "دمو", ps: "ډیمو" },
  { en: "Sample", ur: "نمونہ", ar: "عينة", fa: "نمونه", ps: "نمونه" },
  { en: "Account", ur: "اکاؤنٹ", ar: "حساب", fa: "حساب", ps: "حساب" },
  { en: "Account", ur: "کھاتہ", ar: "حساب", fa: "حساب", ps: "حساب" },
  { en: "Payable", ur: "قابل ادائیگی", ar: "الدفع", fa: "پرداختنی", ps: "د تادیې وړ" },
  { en: "Receivable", ur: "قابل وصولی", ar: "القبض", fa: "دریافتنی", ps: "د ترلاسه کولو وړ" },
  { en: "Payable", ur: "ادائیگی", ar: "الدفع", fa: "پرداختنی", ps: "تادیه" },
  { en: "Receivable", ur: "وصولی", ar: "القبض", fa: "دریافتنی", ps: "ترلاسه کول" },
  { en: "Cash", ur: "کیش", ar: "النقد", fa: "نقد", ps: "نغدې پیسې" },
  { en: "Cash", ur: "نقد", ar: "النقد", fa: "نقد", ps: "نغد" },
  { en: "Bank", ur: "بینک", ar: "بنك", fa: "بانک", ps: "بانک" },
  { en: "Traders", ur: "ٹریڈرز", ar: "تجار", fa: "بازرگانان", ps: "سوداګر" },
  { en: "Trading", ur: "ٹریڈنگ", ar: "تجارة", fa: "تجارت", ps: "سوداګري" },
  { en: "Company", ur: "کمپنی", ar: "شركة", fa: "شرکت", ps: "شرکت" },
  { en: "Enterprises", ur: "انٹرپرائزز", ar: "مشاريع", fa: "موسسات", ps: "تصدۍ" },
  { en: "Services", ur: "سروسز", ar: "خدمات", fa: "خدمات", ps: "خدمتونه" },
  { en: "Logistics", ur: "لوجسٹکس", ar: "لوجستيات", fa: "لجستیک", ps: "لوژستیک" },
  { en: "Transport", ur: "ٹرانسپورٹ", ar: "النقل", fa: "حمل و نقل", ps: "ټرانسپورټ" },
  { en: "Limited", ur: "لمیٹڈ", ar: "المحدودة", fa: "محدود", ps: "محدود" },
  { en: "Private", ur: "پرائیویٹ", ar: "خاصة", fa: "خصوصی", ps: "خصوصي" },
  { en: "International", ur: "انٹرنیشنل", ar: "دولي", fa: "بین‌المللی", ps: "نړیوال" },
  { en: "National", ur: "نیشنل", ar: "وطني", fa: "ملی", ps: "ملي" },
  { en: "Commercial", ur: "کمرشل", ar: "تجاري", fa: "تجاری", ps: "تجارتي" },
  { en: "Market", ur: "مارکیٹ", ar: "سوق", fa: "بازار", ps: "بازار" },
  { en: "Center", ur: "سینٹر", ar: "مركز", fa: "مرکز", ps: "مرکز" },
  { en: "Store", ur: "سٹور", ar: "متجر", fa: "فروشگاه", ps: "پلورنځی" },
  { en: "Supplier", ur: "سپلائر", ar: "المورد", fa: "تامین کننده", ps: "ورکونکی" },
  { en: "Buyer", ur: "خریدار", ar: "المشتري", fa: "خریدار", ps: "اخیستونکی" },
  { en: "Customer", ur: "گاہک", ar: "العميل", fa: "مشتری", ps: "پیرودونکی" },
  { en: "Customer", ur: "کسٹمر", ar: "العميل", fa: "مشتری", ps: "پیرودونکی" },
  { en: "Goods", ur: "مال / اشیاء", ar: "البضائع", fa: "کالاها", ps: "مالونه" },
  { en: "Quantity", ur: "مقدار", ar: "الكمية", fa: "مقدار", ps: "شمیر" },
  { en: "Accepted", ur: "منظور شدہ", ar: "مقبول", fa: "تایید شده", ps: "منل شوی" },
  { en: "Transferred", ur: "منتقل شدہ", ar: "محول", fa: "منتقل شده", ps: "لیږدول شوی" },
  { en: "Pending", ur: "زیر التواء", ar: "معلق", fa: "در انتظار", ps: "پاتې" },
  { en: "Completed", ur: "مکمل", ar: "مكتمل", fa: "تکمیل شده", ps: "بشپړ شوی" },
  { en: "Draft", ur: "ڈرافٹ", ar: "مسودة", fa: "پیش‌نویس", ps: "مسوده" },

  // Geographic Locations
  { en: "Quetta", ur: "کوئٹہ", ar: "كويتا", fa: "کویته", ps: "کوټه" },
  { en: "Chaman", ur: "چمن", ar: "تشامان", fa: "چمن", ps: "چمن" },
  { en: "Karachi", ur: "کراچی", ar: "كراتشي", fa: "کرچی", ps: "کراچۍ" },
  { en: "Lahore", ur: "لاہور", ar: "لاهور", fa: "لاهور", ps: "لاهور" },
  { en: "Islamabad", ur: "اسلام آباد", ar: "إسلام أباد", fa: "اسلام‌آباد", ps: "اسلام آباد" },
  { en: "Peshawar", ur: "پشاور", ar: "بيشاور", fa: "پیشاور", ps: "پېښور" },
  { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دبي" },
  { en: "Kabul", ur: "کابل", ar: "كابول", fa: "کابل", ps: "کابل" },
  { en: "Kandahar", ur: "قندھار", ar: "قندهار", fa: "قندهار", ps: "کندهار" },
  { en: "Tehran", ur: "تہران", ar: "طهران", fa: "تهران", ps: "تهران" },
  { en: "Muscat", ur: "مسقط", ar: "مسقط", fa: "مسقط", ps: "مسقط" },
  { en: "Sharjah", ur: "شارجہ", ar: "الشارقة", fa: "شارجه", ps: "شارجه" },
  { en: "Pakistan", ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
  { en: "Afghanistan", ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" },
  { en: "United Arab Emirates", ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
  { en: "Iran", ur: "ایران", ar: "إيران", fa: "ایران", ps: "ایران" },
  { en: "India", ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" },

  // Common Names & Surnames
  { en: "Allah", ur: "اللہ", ar: "الله", fa: "الله", ps: "الله" },
  { en: "Rahm", ur: "رحم", ar: "رحم", fa: "رحم", ps: "رحم" },
  { en: "Sons", ur: "سنز", ar: "أبناء", fa: "پسران", ps: "زامن" },
  { en: "Brothers", ur: "برادرز", ar: "إخوان", fa: "برادران", ps: "وروڼه" },
  { en: "Haji", ur: "حاجی", ar: "الحاج", fa: "حاجی", ps: "حاجي" },
  { en: "Malik", ur: "ملک", ar: "مالك", fa: "ملک", ps: "ملک" },
  { en: "Sardar", ur: "سردار", ar: "سردار", fa: "سردار", ps: "سردار" },
  { en: "Khan", ur: "خان", ar: "خان", fa: "خان", ps: "خان" },
  { en: "Ahmed", ur: "احمد", ar: "أحمد", fa: "احمد", ps: "احمد" },
  { en: "Muhammad", ur: "محمد", ar: "محمد", fa: "محمد", ps: "محمد" },
  { en: "Ali", ur: "علی", ar: "علي", fa: "علی", ps: "علي" },
  { en: "Hassan", ur: "حسن", ar: "حسن", fa: "حسن", ps: "حسن" },
  { en: "Tariq", ur: "طارق", ar: "طارق", fa: "طارق", ps: "طارق" },
  { en: "Noor", ur: "نور", ar: "نور", fa: "نور", ps: "نور" },
  { en: "Gulistan", ur: "گلستان", ar: "جليستان", fa: "گلستان", ps: "ګلستان" },
  { en: "Damaan", ur: "دامان", ar: "ضمان", fa: "دامان", ps: "دامان" }
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect script direction / character set.
 */
export function detectScriptType(text: string): "latin" | "arabic" | "other" {
  if (!text || !text.trim()) return "latin";
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (arabicRegex.test(text)) return "arabic";
  return "latin";
}

/**
 * Automatically generates 5-language values (en, ur, ar, fa, ps) from input text.
 * Completely local, deterministic, and bidirectional.
 */
export function autoTranslate5Languages(
  input: string,
  sourceLang: SupportedLanguage = "en",
  currentObj?: Partial<MultilingualText>
): MultilingualText {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return {
      en: currentObj?.en || "",
      ur: currentObj?.ur || "",
      ar: currentObj?.ar || "",
      fa: currentObj?.fa || "",
      ps: currentObj?.ps || "",
    };
  }

  const script = detectScriptType(trimmed);
  const isArabic = script === "arabic";

  // Build sorted list of matches: longest phrases first
  const sortedPairs = [...MULTILINGUAL_DICTIONARY].sort((a, b) => {
    const lenA = Math.max(a.en.length, a.ur.length);
    const lenB = Math.max(b.en.length, b.ur.length);
    return lenB - lenA;
  });

  let workingEn = trimmed;
  let workingUr = trimmed;
  let workingAr = trimmed;
  let workingFa = trimmed;
  let workingPs = trimmed;

  for (const pair of sortedPairs) {
    const patternStr = isArabic ? escapeRegExp(pair.ur) : `\\b${escapeRegExp(pair.en)}\\b`;
    const regex = new RegExp(patternStr, isArabic ? "gu" : "gi");

    if (regex.test(workingEn) || regex.test(workingUr) || (isArabic && regex.test(trimmed))) {
      workingEn = workingEn.replace(new RegExp(patternStr, isArabic ? "gu" : "gi"), pair.en);
      workingUr = workingUr.replace(new RegExp(patternStr, isArabic ? "gu" : "gi"), pair.ur);
      workingAr = workingAr.replace(new RegExp(patternStr, isArabic ? "gu" : "gi"), pair.ar);
      workingFa = workingFa.replace(new RegExp(patternStr, isArabic ? "gu" : "gi"), pair.fa);
      workingPs = workingPs.replace(new RegExp(patternStr, isArabic ? "gu" : "gi"), pair.ps);
    }
  }

  // If any Arabic script remains in English, transliterate to Latin
  if (detectScriptType(workingEn) === "arabic") {
    workingEn = transliterateToLatin(workingEn);
  }

  // If English script remains in Urdu/Arabic/Persian/Pashto, transliterate to Perso-Arabic
  if (detectScriptType(workingUr) === "latin") {
    workingUr = transliterateProperNoun(workingUr, "ur");
  }
  if (detectScriptType(workingAr) === "latin") {
    workingAr = transliterateProperNoun(workingAr, "ar");
  }
  if (detectScriptType(workingFa) === "latin") {
    workingFa = transliterateProperNoun(workingFa, "fa");
  }
  if (detectScriptType(workingPs) === "latin") {
    workingPs = transliterateProperNoun(workingPs, "ps");
  }

  const result: MultilingualText = {
    en: currentObj?.en || workingEn || trimmed,
    ur: currentObj?.ur || workingUr || trimmed,
    ar: currentObj?.ar || workingAr || trimmed,
    fa: currentObj?.fa || workingFa || trimmed,
    ps: currentObj?.ps || workingPs || trimmed,
  };

  // Preserve the original text verbatim in its source language
  if (isArabic) {
    if (sourceLang === "en") sourceLang = "ur";
    result[sourceLang] = trimmed;
  } else {
    result.en = trimmed;
  }

  return result;
}

/**
 * Returns text for display in active language with fallback chain.
 */
export function resolveActiveText(
  obj: Partial<MultilingualText> | null | undefined,
  activeLang: SupportedLanguage = "en",
  fallbackDefault = ""
): string {
  if (!obj) return fallbackDefault;
  const langOrder: SupportedLanguage[] = [activeLang, "en", "ur", "ar", "fa", "ps"];
  for (const l of langOrder) {
    const val = obj[l];
    if (val && val.trim()) return val.trim();
  }
  return fallbackDefault;
}

