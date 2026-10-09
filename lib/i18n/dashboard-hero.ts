/**
 * Dashboard hero text. Keep all five supported languages in one place so
 * dashboard banners never fall back to English for RTL users.
 */
export type DashboardHeroLanguage = "en" | "ur" | "ar" | "fa" | "ps";
export type DashboardHeroVariant = "business" | "shipping";

type DashboardHeroCopy = {
  eyebrow: string;
  heading: string;
  description: string;
};

const COPY: Record<DashboardHeroVariant, Record<DashboardHeroLanguage, DashboardHeroCopy>> = {
  business: {
    en: { eyebrow: "Business operations", heading: "DGT ERP", description: "Import • Export • General Trading • Shipping & Logistics" },
    ur: { eyebrow: "کاروباری آپریشنز", heading: "ڈی جی ٹی ای آر پی", description: "درآمد • برآمد • جنرل ٹریڈنگ • شپنگ اور لاجسٹکس" },
    ar: { eyebrow: "العمليات التجارية", heading: "نظام DGT ERP", description: "الاستيراد • التصدير • التجارة العامة • الشحن والخدمات اللوجستية" },
    fa: { eyebrow: "عملیات بازرگانی", heading: "دی جی تی ERP", description: "واردات • صادرات • تجارت عمومی • حمل‌ونقل و لجستیک" },
    ps: { eyebrow: "سوداګریزې چارې", heading: "ډي جي ټي ERP", description: "واردات • صادرات • عمومي سوداګري • بار وړنه او لوژستیک" },
  },
  shipping: {
    en: { eyebrow: "Shipping line operations", heading: "Shipping & Logistics", description: "Vessels • Containers • BL Tracking • Clearing & Delivery" },
    ur: { eyebrow: "شپنگ لائن آپریشنز", heading: "شپنگ اور لاجسٹکس", description: "بحری جہاز • کنٹینرز • بی ایل ٹریکنگ • کلیئرنگ اور ڈیلیوری" },
    ar: { eyebrow: "عمليات خطوط الشحن", heading: "الشحن والخدمات اللوجستية", description: "السفن • الحاويات • تتبع بوليصة الشحن • التخليص والتسليم" },
    fa: { eyebrow: "عملیات خطوط کشتیرانی", heading: "حمل‌ونقل و لجستیک", description: "کشتی‌ها • کانتینرها • رهگیری بارنامه • ترخیص و تحویل" },
    ps: { eyebrow: "د بار وړلو چارې", heading: "بار وړنه او لوژستیک", description: "بېړۍ • کانټینرونه • د بارنامې څارنه • ګمرکي تصفیه او سپارل" },
  },
};

export function getDashboardHeroCopy(variant: DashboardHeroVariant, language: string): DashboardHeroCopy {
  const normalized = language.trim().toLowerCase().split("-")[0];
  const lang: DashboardHeroLanguage =
    normalized === "ur" || normalized === "ar" || normalized === "fa" || normalized === "ps"
      ? normalized
      : "en";
  return COPY[variant][lang];
}
