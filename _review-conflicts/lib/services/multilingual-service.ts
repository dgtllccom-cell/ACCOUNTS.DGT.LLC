import {
  getLanguageDirection,
  supportedLanguages,
  type SupportedLanguage
} from "@/lib/i18n/languages";

export type MultilingualText = {
  originalText: string;
  originalLanguage: SupportedLanguage;
  en?: string;
  ar?: string;
  ur?: string;
  fa?: string;
  ps?: string;
};

export type RecordTranslationPayload = {
  recordTable: string;
  recordId: string;
  fieldName: string;
  originalText: string;
  originalLanguageCode: SupportedLanguage;
  englishText: string | null;
  arabicText: string | null;
  urduText: string | null;
  persianText: string | null;
  pashtoText: string | null;
};

const languageFieldMap: Record<SupportedLanguage, keyof MultilingualText> = {
  en: "en",
  ar: "ar",
  ur: "ur",
  fa: "fa",
  ps: "ps"
};

// Unified dynamic dictionary of key ERP names (Bidirectional / Case-insensitive)
const TRANSLATION_DICTIONARY: Record<string, { en: string; ur: string; ar: string; fa: string; ps: string }> = {
  // Products
  "walnut kernel": {
    en: "Walnut Kernel",
    ur: "اخروٹ گری",
    ar: "لب الجوز",
    fa: "مغز گردو",
    ps: "د غوزانو مغز"
  },
  "walnut inshell": {
    en: "Walnut Inshell",
    ur: "اخروٹ چھلکے کے ساتھ",
    ar: "جوز بالقشر",
    fa: "گردو با پوست",
    ps: "پوټکي لرونکي غوزان"
  },
  "almond kernel": {
    en: "Almond Kernel",
    ur: "بادام گری",
    ar: "لب اللوز",
    fa: "مغز بادام",
    ps: "د بادامو مغز"
  },
  "almond inshell": {
    en: "Almond Inshell",
    ur: "بادام چھلکے کے ساتھ",
    ar: "لوز بالقشر",
    fa: "بادام با پوست",
    ps: "پوټکي لرونکي بادام"
  },
  "pistachio kernel": {
    en: "Pistachio Kernel",
    ur: "پستہ گری",
    ar: "لب الفستق",
    fa: "مغز پسته",
    ps: "د پستې مغز"
  },
  "pistachio inshell": {
    en: "Pistachio Inshell",
    ur: "پستہ چھلکے کے ساتھ",
    ar: "فستق بالقشر",
    fa: "پسته با پوست",
    ps: "پوټکي لرونکي پسته"
  },

  // Origins & Countries
  "usa": {
    en: "USA",
    ur: "امریکہ",
    ar: "الولايات المتحدة الأمريكية",
    fa: "ایالات متحده آمریکا",
    ps: "د امریکا متحده ایالات"
  },
  "united states": {
    en: "USA",
    ur: "امریکہ",
    ar: "الولايات المتحدة الأمريكية",
    fa: "ایالات متحده آمریکا",
    ps: "د امریکا متحده ایالات"
  },
  "australia": {
    en: "Australia",
    ur: "آسٹریلیا",
    ar: "أستراليا",
    fa: "استرالیا",
    ps: "آسټرالیا"
  },
  "chile": {
    en: "Chile",
    ur: "چلی",
    ar: "تشيلي",
    fa: "شیلی",
    ps: "چیلي"
  },
  "china": {
    en: "China",
    ur: "چین",
    ar: "الصين",
    fa: "چین",
    ps: "چین"
  },
  "india": {
    en: "India",
    ur: "بھارت",
    ar: "الهند",
    fa: "هند",
    ps: "هندوستان"
  },
  "afghanistan": {
    en: "Afghanistan",
    ur: "افغانستان",
    ar: "أفغانستان",
    fa: "افغانستان",
    ps: "افغانستان"
  },
  "iran": {
    en: "Iran",
    ur: "ایران",
    ar: "إيران",
    fa: "ایران",
    ps: "ایران"
  },
  "turkey": {
    en: "Turkey",
    ur: "ترکی",
    ar: "تركيا",
    fa: "ترکیه",
    ps: "ترکیه"
  },
  "pakistan": {
    en: "Pakistan",
    ur: "پاکستان",
    ar: "باكستان",
    fa: "پاکستان",
    ps: "پاکستان"
  },
  "uae": {
    en: "UAE",
    ur: "متحدہ عرب امارات",
    ar: "الإمارات العربية المتحدة",
    fa: "امارات متحده عربی",
    ps: "متحده عربي امارات"
  },
  "united arab emirates": {
    en: "United Arab Emirates",
    ur: "متحدہ عرب امارات",
    ar: "الإمارات العربية المتحدة",
    fa: "امارات متحده عربی",
    ps: "متحده عربي امارات"
  },

  // States
  "punjab": {
    en: "Punjab",
    ur: "پنجاب",
    ar: "البنجاب",
    fa: "پنجاب",
    ps: "پنجاب"
  },
  "sindh": {
    en: "Sindh",
    ur: "سندھ",
    ar: "السند",
    fa: "سند",
    ps: "سند"
  },
  "kpk": {
    en: "KPK",
    ur: "خیبر پختونخوا",
    ar: "خيبر بختونخوا",
    fa: "خیبر پختونخوا",
    ps: "خیبر پښتونخوا"
  },
  "balochistan": {
    en: "Balochistan",
    ur: "بلوچستان",
    ar: "بلوشستان",
    fa: "بلوچستان",
    ps: "بلوچستان"
  },
  "gilgit baltistan": {
    en: "Gilgit Baltistan",
    ur: "گلگت بلتستان",
    ar: "غلغت بلتستان",
    fa: "گلگت بلتستان",
    ps: "ګلګت بلتستان"
  },

  // Cities
  "lahore": {
    en: "Lahore",
    ur: "لاہور",
    ar: "لاهور",
    fa: "لاهور",
    ps: "لاهور"
  },
  "faisalabad": {
    en: "Faisalabad",
    ur: "فیصل آباد",
    ar: "فيصل آباد",
    fa: "فیصل آباد",
    ps: "فیصل آباد"
  },
  "multan": {
    en: "Multan",
    ur: "ملتان",
    ar: "ملتان",
    fa: "ملتان",
    ps: "ملتان"
  },
  "rawalpindi": {
    en: "Rawalpindi",
    ur: "راولپنڈی",
    ar: "راولبندي",
    fa: "راولپندی",
    ps: "راولپنډۍ"
  },

  // Tehsils
  "model town": {
    en: "Model Town",
    ur: "ماڈل ٹاؤن",
    ar: "موديل تاون",
    fa: "مدل تاون",
    ps: "ماډل ټاون"
  },
  "raiwind": {
    en: "Raiwind",
    ur: "رائے ونڈ",
    ar: "رايوند",
    fa: "رایوند",
    ps: "رایوند"
  },
  "shahdara": {
    en: "Shahdara",
    ur: "شاہدرہ",
    ar: "شاهدرة",
    fa: "شاهدره",
    ps: "شاهدره"
  }
};

// Build reverse lookup index maps
const lookupMap = new Map<string, { en: string; ur: string; ar: string; fa: string; ps: string }>();
for (const key of Object.keys(TRANSLATION_DICTIONARY)) {
  const translations = TRANSLATION_DICTIONARY[key];
  lookupMap.set(translations.en.toLowerCase().trim(), translations);
  lookupMap.set(translations.ur.toLowerCase().trim(), translations);
  lookupMap.set(translations.ar.toLowerCase().trim(), translations);
  lookupMap.set(translations.fa.toLowerCase().trim(), translations);
  lookupMap.set(translations.ps.toLowerCase().trim(), translations);
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function translateText(text: string): { en: string; ur: string; ar: string; fa: string; ps: string } {
  const val = text.trim();
  if (!val) {
    return { en: "", ur: "", ar: "", fa: "", ps: "" };
  }
  const valLower = val.toLowerCase();
  
  // Direct match first
  const direct = lookupMap.get(valLower);
  if (direct) {
    return direct;
  }

  // Fallback to phrase search and replace or word-by-word
  let workingEn = val;
  let workingUr = val;
  let workingAr = val;
  let workingFa = val;
  let workingPs = val;

  const entries = Object.values(TRANSLATION_DICTIONARY).sort((a, b) => b.en.length - a.en.length);

  for (const entry of entries) {
    const regexEn = new RegExp(`\\b${escapeRegExp(entry.en)}\\b`, "gi");
    const regexUr = new RegExp(escapeRegExp(entry.ur), "g");
    const regexAr = new RegExp(escapeRegExp(entry.ar), "g");
    const regexFa = new RegExp(escapeRegExp(entry.fa), "g");
    const regexPs = new RegExp(escapeRegExp(entry.ps), "g");

    if (regexEn.test(workingEn)) {
      workingEn = workingEn.replace(regexEn, entry.en);
      workingUr = workingUr.replace(regexEn, entry.ur);
      workingAr = workingAr.replace(regexEn, entry.ar);
      workingFa = workingFa.replace(regexEn, entry.fa);
      workingPs = workingPs.replace(regexEn, entry.ps);
    } else if (regexUr.test(workingUr)) {
      workingEn = workingEn.replace(regexUr, entry.en);
      workingUr = workingUr.replace(regexUr, entry.ur);
      workingAr = workingAr.replace(regexUr, entry.ar);
      workingFa = workingFa.replace(regexUr, entry.fa);
      workingPs = workingPs.replace(regexUr, entry.ps);
    } else if (regexAr.test(workingAr)) {
      workingEn = workingEn.replace(regexAr, entry.en);
      workingUr = workingUr.replace(regexAr, entry.ur);
      workingAr = workingAr.replace(regexAr, entry.ar);
      workingFa = workingFa.replace(regexAr, entry.fa);
      workingPs = workingPs.replace(regexAr, entry.ps);
    } else if (regexFa.test(workingFa)) {
      workingEn = workingEn.replace(regexFa, entry.en);
      workingUr = workingUr.replace(regexFa, entry.ur);
      workingAr = workingAr.replace(regexFa, entry.ar);
      workingFa = workingFa.replace(regexFa, entry.fa);
      workingPs = workingPs.replace(regexFa, entry.ps);
    } else if (regexPs.test(workingPs)) {
      workingEn = workingEn.replace(regexPs, entry.en);
      workingUr = workingUr.replace(regexPs, entry.ur);
      workingAr = workingAr.replace(regexPs, entry.ar);
      workingFa = workingFa.replace(regexPs, entry.fa);
      workingPs = workingPs.replace(regexPs, entry.ps);
    }
  }

  // Last-resort word-by-word fallback if the string did not change at all
  if (workingEn === val && val.includes(" ")) {
    const words = val.split(/\s+/);
    const resolvedEn: string[] = [];
    const resolvedUr: string[] = [];
    const resolvedAr: string[] = [];
    const resolvedFa: string[] = [];
    const resolvedPs: string[] = [];

    for (const w of words) {
      const match = lookupMap.get(w.toLowerCase());
      if (match) {
        resolvedEn.push(match.en);
        resolvedUr.push(match.ur);
        resolvedAr.push(match.ar);
        resolvedFa.push(match.fa);
        resolvedPs.push(match.ps);
      } else {
        resolvedEn.push(w);
        resolvedUr.push(w);
        resolvedAr.push(w);
        resolvedFa.push(w);
        resolvedPs.push(w);
      }
    }

    return {
      en: resolvedEn.join(" "),
      ur: resolvedUr.join(" "),
      ar: resolvedAr.join(" "),
      fa: resolvedFa.join(" "),
      ps: resolvedPs.join(" ")
    };
  }

  return {
    en: workingEn,
    ur: workingUr,
    ar: workingAr,
    fa: workingFa,
    ps: workingPs
  };
}

export class MultilingualService {
  supportedLanguages = supportedLanguages;

  isRtl(languageCode: SupportedLanguage) {
    return getLanguageDirection(languageCode) === "rtl";
  }

  resolveText(text: MultilingualText, languageCode: SupportedLanguage) {
    const field = languageFieldMap[languageCode];
    return text[field] || text.en || text.originalText;
  }

  createRecordTranslationPayload(input: {
    recordTable: string;
    recordId: string;
    fieldName: string;
    text: MultilingualText;
  }): RecordTranslationPayload {
    return {
      recordTable: input.recordTable,
      recordId: input.recordId,
      fieldName: input.fieldName,
      originalText: input.text.originalText,
      originalLanguageCode: input.text.originalLanguage,
      englishText: input.text.en ?? null,
      arabicText: input.text.ar ?? null,
      urduText: input.text.ur ?? null,
      persianText: input.text.fa ?? null,
      pashtoText: input.text.ps ?? null
    };
  }

  createAutomaticTranslationShell(originalText: string, originalLanguage: SupportedLanguage): MultilingualText {
    const translations = translateText(originalText);
    return {
      originalText,
      originalLanguage,
      en: translations.en || originalText,
      ar: translations.ar || originalText,
      ur: translations.ur || originalText,
      fa: translations.fa || originalText,
      ps: translations.ps || originalText
    };
  }
}

export const multilingualService = new MultilingualService();
