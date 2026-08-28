import fs from "node:fs";
const UI = "B:/accounts.dgt.llc.code_project/ACCOUNTS.DGT.LLC/lib/i18n/ui.ts";

const K = {
  "dintake.lp_title":     ["Container Loading Progress", "کنٹینر لوڈنگ پیش رفت", "تقدّم تحميل الحاويات", "پیشرفت بارگیری کانتینر", "د کانټینر بارولو پرمختګ"],
  "dintake.lp_planned":   ["Planned", "منصوبہ بند", "مخطط", "برنامه‌ریزی‌شده", "پلان شوی"],
  "dintake.lp_loaded":    ["Loaded", "لوڈ شدہ", "مُحمَّل", "بارگیری‌شده", "بار شوی"],
  "dintake.lp_remaining": ["Remaining", "باقی", "المتبقي", "باقی‌مانده", "پاتې"],
  "dintake.lp_status":    ["Status", "حالت", "الحالة", "وضعیت", "حالت"],
  "dintake.lp_batches":   ["batch(es)", "بیچ", "دفعة/دفعات", "دسته", "ډله(ی)"],
  "dintake.lp_containers":["containers", "کنٹینرز", "حاويات", "کانتینرها", "کانټینرونه"],
  "dintake.lp_confirm":   ["Confirm Batch", "بیچ کی تصدیق کریں", "تأكيد الدفعة", "تأیید دسته", "ډله تایید کړئ"],
  "dintake.lp_all_loaded":["All containers in this batch are loaded.", "اس بیچ کے تمام کنٹینرز لوڈ ہو چکے ہیں۔", "تم تحميل جميع حاويات هذه الدفعة.", "همه کانتینرهای این دسته بارگیری شده‌اند.", "پدې ډله کې ټول کانټینرونه بار شوي."],
  "dintake.lp_no_batches":["No AI-proposed loading batches for this booking. Batches are proposed from scanned loading documents in the Document Intake Center.", "اس بکنگ کے لیے کوئی اے آئی تجویز کردہ لوڈنگ بیچ نہیں۔ بیچ دستاویز اِن ٹیک مرکز میں اسکین کیے گئے لوڈنگ دستاویزات سے تجویز کیے جاتے ہیں۔", "لا توجد دفعات تحميل مقترحة من الذكاء الاصطناعي لهذا الحجز. تُقترح الدفعات من مستندات التحميل الممسوحة في مركز استقبال المستندات.", "دسته بارگیری پیشنهادی هوش مصنوعی برای این رزرو نیست. دسته‌ها از اسناد بارگیری اسکن‌شده در مرکز دریافت اسناد پیشنهاد می‌شوند.", "د دې بکنګ لپاره د مصنوعي ذهانت وړاندیز شوې د بارولو ډلې نشته. ډلې د سند اخیستلو مرکز کې د سکن شویو بارولو اسنادو څخه وړاندیز کیږي."],
  "dintake.lp_partially_loaded": ["Partially Loaded", "جزوی طور پر لوڈ", "محمَّل جزئياً", "بارگیری جزئی", "نیمګړی بار شوی"],
  "dintake.lp_fully_loaded":     ["Fully Loaded", "مکمل لوڈ", "محمَّل بالكامل", "بارگیری کامل", "بشپړ بار شوی"],
  "dintake.lp_bs_proposed":  ["Proposed", "تجویز شدہ", "مُقترح", "پیشنهادشده", "وړاندیز شوی"],
  "dintake.lp_bs_confirmed": ["Confirmed", "تصدیق شدہ", "مؤكَّد", "تأییدشده", "تایید شوی"],
  "dintake.lp_bs_loaded":    ["Loaded", "لوڈ شدہ", "مُحمَّل", "بارگیری‌شده", "بار شوی"],
  "dintake.lp_bs_cancelled": ["Cancelled", "منسوخ", "ملغى", "لغوشده", "لغوه شوی"],
};

const LANGS = ["en", "ur", "ar", "fa", "ps"];
const IDX = { en: 0, ur: 1, ar: 2, fa: 3, ps: 4 };
let src = fs.readFileSync(UI, "utf8");
for (const lang of LANGS) {
  const re = new RegExp(`(const ${lang}: Dict = \\{[\\s\\S]*?)(\\n\\};)`);
  const m = src.match(re);
  if (!m) throw new Error(`block not found: ${lang}`);
  const lines = Object.entries(K).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v[IDX[lang]])},`).join("\n");
  src = src.replace(re, `$1\n${lines}$2`);
}
fs.writeFileSync(UI, src);
console.log(`injected ${Object.keys(K).length} keys × 5`);
