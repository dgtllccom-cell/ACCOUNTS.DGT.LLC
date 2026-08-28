import fs from "node:fs";
const UI = "B:/accounts.dgt.llc.code_project/ACCOUNTS.DGT.LLC/lib/i18n/ui.ts";

const K = {
  "dintake.prepare_draft":     ["Prepare Reviewed Draft", "جائزہ شدہ مسودہ تیار کریں", "إعداد مسودة مُراجَعة", "آماده‌سازی پیش‌نویس بازبینی‌شده", "بیاکتل شوې مسوده چمتو کړئ"],
  "dintake.draft_ready_banner":["Reviewed draft prepared", "جائزہ شدہ مسودہ تیار", "تم إعداد مسودة مُراجَعة", "پیش‌نویس بازبینی‌شده آماده شد", "بیاکتل شوې مسوده چمتو شوه"],
  "dintake.draft_open_hint":   ["Open the target module's New Entry screen and choose “Continue Saved Draft” to complete and post it. The AI has not created or posted anything.",
                               "ہدف ماڈیول کی نئی انٹری اسکرین کھولیں اور اسے مکمل و پوسٹ کرنے کے لیے ”محفوظ مسودہ جاری رکھیں“ منتخب کریں۔ اے آئی نے کچھ نہیں بنایا یا پوسٹ کیا۔",
                               "افتح شاشة الإدخال الجديد للوحدة المستهدفة واختر ”متابعة المسودة المحفوظة“ لإكمالها وترحيلها. لم يقم الذكاء الاصطناعي بإنشاء أو ترحيل أي شيء.",
                               "صفحه ورود جدید ماژول مقصد را باز کنید و برای تکمیل و ثبت آن ”ادامه پیش‌نویس ذخیره‌شده“ را انتخاب کنید. هوش مصنوعی چیزی ایجاد یا ثبت نکرده است.",
                               "د موخې ماډل د نوي ننوتلو پاڼه پرانیزئ او د بشپړولو او ثبتولو لپاره ”خوندي شوې مسوده دوام ورکړئ“ وټاکئ. مصنوعي ذهانت هیڅ نه دي جوړ کړي یا ثبت کړي."],
  "dintake.ev_draft_prepared": ["Draft prepared", "مسودہ تیار", "تم إعداد المسودة", "پیش‌نویس آماده شد", "مسوده چمتو شوه"],
  "dintake.ev_draft_discarded":["Draft discarded", "مسودہ رد", "تم تجاهل المسودة", "پیش‌نویس دور انداخته شد", "مسوده لغوه شوه"],
  "dintake.ev_draft_consumed": ["Draft used to create record", "ریکارڈ بنانے کے لیے مسودہ استعمال", "استُخدمت المسودة لإنشاء سجل", "پیش‌نویس برای ایجاد رکورد استفاده شد", "مسوده د ریکارډ جوړولو لپاره وکارول شوه"],
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
