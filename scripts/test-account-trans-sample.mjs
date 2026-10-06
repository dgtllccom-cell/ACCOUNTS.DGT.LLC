import { detectScriptType } from "../lib/i18n/multilingual-translator.ts";
import { transliterateProperNoun, transliterateToLatin } from "../lib/i18n/transliteration.ts";

const DICTIONARY_PAIRS = [
  // Compound Accounts
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
  { en: "Main Branch", ur: "مین برانچ", ar: "الفرع الرئيسي", fa: "شعبه اصلی", ps: "اصلي څانګه" },
  { en: "City Branch", ur: "سٹی برانچ", ar: "فرع المدينة", fa: "شعبه شهری", ps: "د ښار څانګه" },
  { en: "Head Office", ur: "ہیڈ آفس", ar: "المكتب الرئيسي", fa: "دفتر مرکزی", ps: "مرکزي دفتر" },
  { en: "Habib Bank Limited", ur: "حبیب بینک لمیٹڈ", ar: "حبيب بنك المحدود", fa: "حبیب بانک محدود", ps: "حبیب بانک محدود" },
  { en: "National Bank of Pakistan", ur: "نیشنل بینک آف پاکستان", ar: "بنك باكستان الوطني", fa: "بانک ملی پاکستان", ps: "د پاکستان ملي بانک" },
  { en: "Meezan Bank", ur: "میزان بینک", ar: "بنك ميزان", fa: "بانک میزان", ps: "میزان بانک" },
  { en: "United Bank Limited", ur: "یونائیٹڈ بینک لمیٹڈ", ar: "يونايتد بنك المحدود", fa: "یونایتد بانک محدود", ps: "یونایټډ بانک محدود" },
  { en: "Bank Alfalah", ur: "بینک الفلاح", ar: "بنك الفلاح", fa: "بانک الفلاح", ps: "بانک الفلاح" },
  { en: "Allied Bank Limited", ur: "الائیڈ بینک لمیٹڈ", ar: "ألايد بنك المحدود", fa: "الاید بانک محدود", ps: "الایډ بانک محدود" },

  // Single terms
  { en: "Dev", ur: "دیو", ar: "ديف", fa: "دو", ps: "ډیو" },
  { en: "Test", ur: "ٹیسٹ", ar: "اختبار", fa: "تست", ps: "ازموینه" },
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
  { en: "Transport", ur: "ٹرانسپورٹ", ar: "النقل", fa: "حمل و نقل", ps: "ټرانسپورټ" },
  { en: "Enterprises", ur: "انٹرپرائزز", ar: "مشاريع", fa: "موسسات", ps: "تصدۍ" },
  { en: "Services", ur: "سروسز", ar: "خدمات", fa: "خدمات", ps: "خدمتونه" },
  { en: "Logistics", ur: "لوجسٹکس", ar: "لوجستيات", fa: "لجستیک", ps: "لوژستیک" },
  { en: "Limited", ur: "لمیٹڈ", ar: "المحدودة", fa: "محدود", ps: "محدود" },
  { en: "Quetta", ur: "کوئٹہ", ar: "كويتا", fa: "کویته", ps: "کوټه" },
  { en: "Chaman", ur: "چمن", ar: "تشامان", fa: "چمن", ps: "چمن" },
  { en: "Karachi", ur: "کراچی", ar: "كراتشي", fa: "کرچی", ps: "کراچۍ" },
  { en: "Lahore", ur: "لاہور", ar: "لاهور", fa: "لاهور", ps: "لاهور" },
  { en: "Islamabad", ur: "اسلام آباد", ar: "إسلام أباد", fa: "اسلام‌آباد", ps: "اسلام آباد" },
  { en: "Peshawar", ur: "پشاور", ar: "بيشاور", fa: "پیشاور", ps: "پېښور" },
  { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دبي" },
  { en: "Kabul", ur: "کابل", ar: "كابول", fa: "کابل", ps: "کابل" },
  { en: "Kandahar", ur: "قندھار", ar: "قندهار", fa: "قندهار", ps: "کندهار" },
  { en: "Ahmed", ur: "احمد", ar: "أحمد", fa: "احمد", ps: "احمد" },
  { en: "Muhammad", ur: "محمد", ar: "محمد", fa: "محمد", ps: "محمد" },
  { en: "Ali", ur: "علی", ar: "علي", fa: "علی", ps: "علي" },
  { en: "Khan", ur: "خان", ar: "خان", fa: "خان", ps: "خان" },
  { en: "Hassan", ur: "حسن", ar: "حسن", fa: "حسن", ps: "حسن" },
  { en: "Tariq", ur: "طارق", ar: "طارق", fa: "طارق", ps: "طارق" }
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function testTranslate(input) {
  const trimmed = (input || "").trim();
  const script = detectScriptType(trimmed);
  const isArabic = script === "arabic";

  // Build sorted list of matches
  const sortedPairs = [...DICTIONARY_PAIRS].sort((a, b) => {
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

    if (regex.test(workingEn) || regex.test(workingUr)) {
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

  return {
    en: workingEn,
    ur: workingUr,
    ar: workingAr,
    fa: workingFa,
    ps: workingPs
  };
}

const samples = [
  "دیو ٹیسٹ قابل ادائیگی کھاتہ",
  "Dev Test Payable Account",
  "کیش اکاؤنٹ کوئٹہ",
  "Quetta Main Branch Cash Account",
  "حبیب بینک لمیٹڈ",
  "Habib Bank Limited",
  "احمد علی ٹریڈرز",
  "Ahmed Ali Traders",
  "اللہ رحم اینڈ سنز",
  "Allah Rahm & Sons"
];

console.log("=== Testing Upgraded 5-Language Translation Engine ===");
for (const s of samples) {
  console.log(`\nInput: "${s}"`);
  console.log(JSON.stringify(testTranslate(s), null, 2));
}
