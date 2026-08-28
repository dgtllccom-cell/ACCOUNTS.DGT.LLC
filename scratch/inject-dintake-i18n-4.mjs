import fs from "node:fs";
const UI = "B:/accounts.dgt.llc.code_project/ACCOUNTS.DGT.LLC/lib/i18n/ui.ts";

const K = {
  "dintake.propose_batch":   ["Propose Loading Batch", "لوڈنگ بیچ تجویز کریں", "اقتراح دفعة تحميل", "پیشنهاد دسته بارگیری", "د بارولو ډله وړاندیز کړئ"],
  "dintake.batch_proposed":  ["Loading batch proposed", "لوڈنگ بیچ تجویز کر دیا گیا", "تم اقتراح دفعة التحميل", "دسته بارگیری پیشنهاد شد", "د بارولو ډله وړاندیز شوه"],
  "dintake.batch_containers":["container(s)", "کنٹینر", "حاوية/حاويات", "کانتینر", "کانټینر(ونه)"],
  "dintake.batch_planned":   ["planned", "منصوبہ بند", "مخطط", "برنامه‌ریزی‌شده", "پلان شوی"],
  "dintake.batch_next":      ["Confirm it in Purchase Loading and create the loading records there — no second Purchase Booking, no duplicate containers.",
                             "اسے پرچیز لوڈنگ میں تصدیق کریں اور لوڈنگ ریکارڈ وہیں بنائیں — کوئی دوسری پرچیز بکنگ نہیں، کوئی نقل کنٹینر نہیں۔",
                             "أكّدها في تحميل المشتريات وأنشئ سجلات التحميل هناك — دون حجز شراء ثانٍ ودون حاويات مكررة.",
                             "آن را در بارگیری خرید تأیید کنید و رکوردهای بارگیری را همان‌جا ایجاد کنید — بدون رزرو خرید دوم، بدون کانتینر تکراری.",
                             "دا د پیرود بارولو کې تایید کړئ او هلته د بارولو ریکارډونه جوړ کړئ — دویم د پیرود بکنګ نشته، تکراري کانټینر نشته."],
  "dintake.ev_loading_batch_proposed":  ["Loading batch proposed", "لوڈنگ بیچ تجویز", "اقتُرحت دفعة تحميل", "دسته بارگیری پیشنهاد شد", "د بارولو ډله وړاندیز شوه"],
  "dintake.ev_loading_batch_confirmed": ["Loading batch confirmed", "لوڈنگ بیچ تصدیق", "تم تأكيد دفعة التحميل", "دسته بارگیری تأیید شد", "د بارولو ډله تایید شوه"],
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
