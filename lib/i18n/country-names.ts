import type { SupportedLanguage } from "@/lib/i18n/languages";

type CountryNames = { ur: string; ar: string; fa: string; ps: string };

const COUNTRY_NAMES: Record<string, CountryNames> = {
  "afghanistan": { ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" },
  "bahrain": { ur: "بحرین", ar: "البحرين", fa: "بحرین", ps: "بحرین" },
  "chile": { ur: "چلی", ar: "تشيلي", fa: "شیلی", ps: "چیلي" },
  "china": { ur: "چین", ar: "الصين", fa: "چین", ps: "چین" },
  "india": { ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" },
  "iran": { ur: "ایران", ar: "إيران", fa: "ایران", ps: "ایران" },
  "kazakhstan": { ur: "قازقستان", ar: "كازاخستان", fa: "قزاقستان", ps: "قزاقستان" },
  "kuwait": { ur: "کویت", ar: "الكويت", fa: "کویت", ps: "کويت" },
  "oman": { ur: "عمان", ar: "عُمان", fa: "عمان", ps: "عمان" },
  "pakistan": { ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
  "qatar": { ur: "قطر", ar: "قطر", fa: "قطر", ps: "قطر" },
  "russia": { ur: "روس", ar: "روسيا", fa: "روسیه", ps: "روسیه" },
  "saudi arabia": { ur: "سعودی عرب", ar: "المملكة العربية السعودية", fa: "عربستان سعودی", ps: "سعودي عربستان" },
  "tajikistan": { ur: "تاجکستان", ar: "طاجيكستان", fa: "تاجیکستان", ps: "تاجکستان" },
  "turkiye": { ur: "ترکی", ar: "تركيا", fa: "ترکیه", ps: "ترکیه" },
  "turkey": { ur: "ترکی", ar: "تركيا", fa: "ترکیه", ps: "ترکیه" },
  "turkmenistan": { ur: "ترکمانستان", ar: "تركمانستان", fa: "ترکمنستان", ps: "ترکمنستان" },
  "usa": { ur: "امریکہ", ar: "الولايات المتحدة", fa: "ایالات متحده", ps: "متحده ایالتونه" },
  "united states": { ur: "امریکہ", ar: "الولايات المتحدة", fa: "ایالات متحده", ps: "متحده ایالتونه" },
  "united arab emirates": { ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
  "uzbekistan": { ur: "ازبکستان", ar: "أوزبكستان", fa: "ازبکستان", ps: "ازبکستان" },
};

/** Country names are standard geography, not user data: show them in the active language, unknown names stay as stored. */
export function localizeCountryName(name: string | null | undefined, lang: SupportedLanguage | string): string {
  const raw = (name ?? "").trim();
  if (!raw || lang === "en") return raw;
  const m = raw.match(/^([^\p{L}\p{N}]*)(.*)$/u);
  const prefix = m ? m[1] : "";
  const bare = m ? m[2].trim() : raw;
  const hit = COUNTRY_NAMES[bare.toLowerCase()];
  return hit ? prefix + (hit[lang as keyof CountryNames] ?? bare) : raw;
}
