import fs from "node:fs";
const UI = "B:/accounts.dgt.llc.code_project/ACCOUNTS.DGT.LLC/lib/i18n/ui.ts";

const K = {
  "dintake.batch_open":       ["Open in Purchase Loading", "پرچیز لوڈنگ میں کھولیں", "افتح في تحميل المشتريات", "در بارگیری خرید باز کن", "د پیرود بارولو کې پرانیزئ"],
  "dintake.hi_request_opened":["A clearing customer order was opened from this handover — continue it in the Customer Order / BL workflow.", "اس ہینڈ اوور سے ایک کلیئرنگ کسٹمر آرڈر کھولا گیا — اسے کسٹمر آرڈر / بی ایل ورک فلو میں جاری رکھیں۔", "تم فتح أمر عميل تخليص من هذا التسليم — تابعه في سير عمل أمر العميل / بوليصة الشحن.", "یک سفارش مشتری ترخیص از این تحویل باز شد — آن را در گردش‌کار سفارش مشتری / بارنامه ادامه دهید.", "له دې سپارنې څخه د ترخیص پیرودونکي امر پرانیستل شو — دا د پیرودونکي امر / BL کاري بهیر کې دوام ورکړئ."],
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
