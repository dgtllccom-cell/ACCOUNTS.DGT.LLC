// Purchase / Sales Order Payment Journal translation helpers.
// UI_TRANSLATIONS was migrated into the central dictionary lib/i18n/ui.ts under
// the `pjt.` prefix (single source of truth per CLAUDE.md). `t()` now delegates
// there; call sites are unchanged: t(key, lang). DATA_TRANSLATIONS / tData()
// (local DB-value translation) are unchanged.
import { t as centralT } from "@/lib/i18n/ui";

export type LanguageCode = "en" | "ur" | "ar" | "fa" | "ps";

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
export const t = (key: string, lang: LanguageCode): string =>
  centralT(lang, `pjt.${key}`, key);

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
