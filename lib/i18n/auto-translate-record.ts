import type { SupportedLanguage } from "@/lib/i18n/languages";

export type RecordTranslations = Record<SupportedLanguage, string>;

// Common business terms dictionary for offline 5-language translation
const localTermDictionary: Record<string, Record<SupportedLanguage, string>> = {
  // Common Countries
  "united arab emirates": { en: "United Arab Emirates", ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
  "pakistan": { en: "Pakistan", ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
  "afghanistan": { en: "Afghanistan", ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" },
  "india": { en: "India", ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" },

  // Common Branches & Cities
  "dubai": { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دبي" },
  "karachi": { en: "Karachi", ur: "کراچی", ar: "كراتشي", fa: "کراچی", ps: "کراچۍ" },
  "lahore": { en: "Lahore", ur: "لاہور", ar: "لاهور", fa: "لاهور", ps: "لاهور" },
  "kabul": { en: "Kabul", ur: "کابل", ar: "كابول", fa: "کابل", ps: "کابل" },
  "kandahar": { en: "Kandahar", ur: "قندھار", ar: "قندهار", fa: "قندهار", ps: "کندهار" },
  "mumbai": { en: "Mumbai", ur: "ممبئی", ar: "مومباي", fa: "بمبئی", ps: "ممبئی" },
  "chaman": { en: "Chaman", ur: "چمن", ar: "تشامان", fa: "چمن", ps: "چمن" },
  "quetta": { en: "Quetta", ur: "کوئٹہ", ar: "كويتا", fa: "کویته", ps: "کټه" },
  "herat": { en: "Herat", ur: "ہرات", ar: "هرات", fa: "هرات", ps: "هرات" },

  // Account Categories & Types
  "cash": { en: "Cash Account", ur: "کیش اکاؤنٹ", ar: "حساب الصندوق", fa: "حساب صندوق", ps: "د نغدو حساب" },
  "bank": { en: "Bank Account", ur: "بینک اکاؤنٹ", ar: "حساب البنك", fa: "حساب بانکی", ps: "بانکي حساب" },
  "customer": { en: "Customer Account", ur: "کسٹمر اکاؤنٹ", ar: "حساب العميل", fa: "حساب مشتری", ps: "د پیرودونکي حساب" },
  "supplier": { en: "Supplier Account", ur: "سپلائر اکاؤنٹ", ar: "حساب المورد", fa: "حساب تامین‌کننده", ps: "د عرضه کوونکي حساب" },
  "wholesaler": { en: "Wholesaler Account", ur: "تھوک فروش اکاؤنٹ", ar: "حساب تاجر الجملة", fa: "حساب عمده‌فروش", ps: "د عمده پلورونکي حساب" },
  "freight": { en: "Freight & Shipping", ur: "کرایہ اور شپنگ", ar: "الشحن والتفريغ", fa: "باربری و حمل", ps: "بار وړل او لیږد" },
  "expense": { en: "Expense Account", ur: "اخراجات کا اکاؤنٹ", ar: "حساب المصروفات", fa: "حساب هزینه", ps: "د لګښتونو حساب" },
  "revenue": { en: "Revenue / Income", ur: "آمدن کا اکاؤنٹ", ar: "حساب الإيرادات", fa: "حساب درآمد", ps: "د عایداتو حساب" },

  // Commodities & Goods
  "almonds": { en: "Almonds", ur: "بادام", ar: "لوز", fa: "بادام", ps: "بادام" },
  "pistachios": { en: "Pistachios", ur: "پستہ", ar: "فستق", fa: "پسته", ps: "پسته" },
  "walnuts": { en: "Walnuts", ur: "اخروٹ", ar: "جوز", fa: "گردو", ps: "اخروټ" },
  "raisins": { en: "Green Raisins", ur: "کشمش", ar: "زبيب", fa: "کشمش", ps: "کشمش" },
  "pine nuts": { en: "Pine Nuts (Chilgoza)", ur: "چلغوزہ", ar: "صنوبر", fa: "چلغوزه", ps: "جلغوزي" },
  "saffron": { en: "Pure Saffron", ur: "زعفران", ar: "زعفران", fa: "زعفران", ps: "زعفران" },
  "figs": { en: "Dried Figs", ur: "انجیر", ar: "تین مجفف", fa: "انجیر خشک", ps: "وچ انځر" },
  "cashews": { en: "Cashews", ur: "کاجو", ar: "كاجو", fa: "کاجو", ps: "کاجو" },

  // Transaction Statuses
  "posted": { en: "Posted", ur: "پوسٹ شدہ", ar: "معتمد", fa: "ثبت شده", ps: "ثبت شوی" },
  "pending": { en: "Pending", ur: "زیرِ التوا", ar: "قيد الانتظار", fa: "در انتظار", ps: "په تمه" },
  "draft": { en: "Draft", ur: "ڈرافٹ", ar: "مسودة", fa: "پیش‌نویس", ps: "مسوده" },
  "transferred": { en: "Transferred", ur: "منتقل شدہ", ar: "محول", fa: "منتقل شده", ps: "انتقال شوی" },
  "completed": { en: "Completed", ur: "مکمل", ar: "مكتمل", fa: "تکمیل شده", ps: "بشپړ شوی" },
  "paid": { en: "Paid", ur: "ادا شدہ", ar: "مدفوع", fa: "پرداخت شده", ps: "تادیه شوی" },
  "unpaid": { en: "Unpaid", ur: "غیر ادا شدہ", ar: "غير مدفوع", fa: "پرداخت نشده", ps: "نا تادیه شوی" },
  "partially_paid": { en: "Partially Paid", ur: "جزوی ادا شدہ", ar: "مدفوع جزئياً", fa: "جزئی پرداخت شده", ps: "جزوي تادیه شوی" },

  // Payment Terms & Methods
  "advance": { en: "Advance Payment", ur: "پیشگی ادائیگی", ar: "دفعة مقدمة", fa: "پیش‌پرداخت", ps: "مخکینۍ تادیه" },
  "bank transfer": { en: "Bank Transfer", ur: "بینک ٹرانسفر", ar: "تحويل بنكي", fa: "انتقال بانکی", ps: "بانکي لیږد" },
  "cash payment": { en: "Cash Payment", ur: "نقد ادائیگی", ar: "دفع نقدي", fa: "پرداخت نقدی", ps: "نغدي تادیه" },
  "debit": { en: "Debit (DR)", ur: "ڈیبٹ (DR)", ar: "مدين (DR)", fa: "بدهکار (DR)", ps: "ډیبیټ (DR)" },
  "credit": { en: "Credit (CR)", ur: "کریڈٹ (CR)", ar: "دائن (CR)", fa: "بستانکار (CR)", ps: "کریډیټ (CR)" },

  // Units
  "kgs": { en: "KGS", ur: "کلو گرام", ar: "كجم", fa: "کیلوگرم", ps: "کیلوګرام" },
  "bags": { en: "Bags", ur: "بوریاں", ar: "أكياس", fa: "کیسه", ps: "بوجۍ" },
  "cartons": { en: "Cartons", ur: "کارٹن", ar: "كراتين", fa: "کارتن", ps: "کارتنونه" },
  "containers": { en: "Containers", ur: "کنٹینرز", ar: "حاويات", fa: "کانتینرها", ps: "کنټینرونه" },

  // Document Titles
  "purchase booking": { en: "Purchase Booking Order", ur: "خریداری بکنگ آرڈر", ar: "أمر حجز الشراء", fa: "سفارش خرید", ps: "د پیرودلو امر" },
  "sales order": { en: "Sales Order", ur: "فروخت کا آرڈر", ar: "أمر البيع", fa: "سفارش فروش", ps: "د پلورلو امر" },
  "customer ledger": { en: "Customer Ledger Report", ur: "کسٹمر لیجر رپورٹ", ar: "تقرير دفتر العميل", fa: "گزارش دفتر مشتری", ps: "د پیرودونکي لیجر راپور" },
  "roznamcha": { en: "Roznamcha Entry", ur: "روزنامچہ اندراج", ar: "قيد روزنامجة", fa: "ثبت روزنامه", ps: "د روزنامچې لیکل" }
};

/**
 * Generates local 5-language translations for any input record field
 * using the built-in offline terminology engine.
 */
export function generateLocalTranslations(inputText: string | null | undefined): RecordTranslations {
  const raw = (inputText || "").trim();
  if (!raw) {
    return { en: "", ur: "", ar: "", fa: "", ps: "" };
  }

  const lowerKey = raw.toLowerCase();

  // 1. Direct match in local dictionary
  if (localTermDictionary[lowerKey]) {
    return localTermDictionary[lowerKey];
  }

  // 2. Check substring match
  for (const [key, trans] of Object.entries(localTermDictionary)) {
    if (lowerKey.includes(key)) {
      return trans;
    }
  }

  // 3. Fallback: Provide safe localized wrappers
  return {
    en: raw,
    ur: raw,
    ar: raw,
    fa: raw,
    ps: raw
  };
}

/**
 * Returns translated string for given record based on requested language code.
 */
export function getTranslatedRecordField(
  rawText: string | null | undefined,
  translationsObj: Record<string, string> | null | undefined,
  lang: SupportedLanguage
): string {
  if (translationsObj && typeof translationsObj === "object" && translationsObj[lang]) {
    return translationsObj[lang];
  }
  return rawText || "";
}
