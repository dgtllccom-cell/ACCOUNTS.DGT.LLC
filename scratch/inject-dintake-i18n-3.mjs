import fs from "node:fs";
const UI = "B:/accounts.dgt.llc.code_project/ACCOUNTS.DGT.LLC/lib/i18n/ui.ts";

const K = {
  "dintake.em_title":        ["Select Entry Method", "انٹری کا طریقہ منتخب کریں", "اختر طريقة الإدخال", "روش ورود را انتخاب کنید", "د ننوتلو طریقه وټاکئ"],
  "dintake.em_manual":       ["Manual Entry", "دستی اندراج", "إدخال يدوي", "ورود دستی", "لاسي ننوتل"],
  "dintake.em_manual_desc":  ["Fill the form yourself. Always available.", "فارم خود بھریں۔ ہمیشہ دستیاب۔", "املأ النموذج بنفسك. متاح دائماً.", "فرم را خودتان پر کنید. همیشه در دسترس.", "فورمه پخپله ډکه کړئ. تل شتون لري."],
  "dintake.em_scan":         ["Scan / Upload Document", "دستاویز اسکین / اپلوڈ کریں", "مسح / رفع مستند", "اسکن / بارگذاری سند", "سند سکن / اپلوډ کړئ"],
  "dintake.em_scan_desc":    ["Upload a PDF or photo — local OCR extracts the fields for your review.", "پی ڈی ایف یا تصویر اپلوڈ کریں — لوکل او سی آر آپ کے جائزے کے لیے فیلڈز نکالتا ہے۔", "ارفع ملف PDF أو صورة — يستخرج التعرف الضوئي المحلي الحقول لمراجعتك.", "یک PDF یا عکس بارگذاری کنید — OCR محلی فیلدها را برای بازبینی شما استخراج می‌کند.", "PDF یا انځور اپلوډ کړئ — ځايي OCR ستاسو د بیاکتنې لپاره ساحې راباسي."],
  "dintake.em_draft":        ["Continue Saved Draft", "محفوظ مسودہ جاری رکھیں", "متابعة المسودة المحفوظة", "ادامه پیش‌نویس ذخیره‌شده", "خوندي شوې مسوده دوام ورکړئ"],
  "dintake.em_draft_desc":   ["A reviewed draft prepared by the Document Intake Center pre-fills this form.", "دستاویز اِن ٹیک مرکز کا تیار کردہ جائزہ شدہ مسودہ اس فارم کو پہلے سے بھر دیتا ہے۔", "مسودة مُراجَعة أعدّها مركز استقبال المستندات تملأ هذا النموذج مسبقاً.", "پیش‌نویس بازبینی‌شده‌ای که مرکز دریافت اسناد آماده کرده این فرم را از پیش پر می‌کند.", "د سند اخیستلو مرکز لخوا چمتو شوې بیاکتل شوې مسوده دا فورمه له مخکې ډکوي."],
  "dintake.em_cancel_desc":  ["Go back without creating anything.", "کچھ بنائے بغیر واپس جائیں۔", "ارجع دون إنشاء أي شيء.", "بدون ایجاد چیزی برگردید.", "پرته له دې چې څه جوړ کړئ بیرته لاړ شئ."],
  "dintake.em_no_drafts":    ["No saved drafts for this screen.", "اس اسکرین کے لیے کوئی محفوظ مسودہ نہیں۔", "لا توجد مسودات محفوظة لهذه الشاشة.", "پیش‌نویس ذخیره‌شده‌ای برای این صفحه نیست.", "د دې پاڼې لپاره هیڅ خوندي شوې مسوده نشته."],
  "dintake.wizard_prefilled":      ["Pre-filled from reviewed document draft", "جائزہ شدہ دستاویز مسودے سے پہلے سے بھرا گیا", "مُعبّأ مسبقاً من مسودة مستند مُراجَعة", "از پیش‌نویس سند بازبینی‌شده از پیش پر شد", "د بیاکتل شوي سند مسودې څخه له مخکې ډک شو"],
  "dintake.wizard_prefilled_hint": ["Review every field, then save and post as usual.", "ہر فیلڈ کا جائزہ لیں، پھر معمول کے مطابق محفوظ اور پوسٹ کریں۔", "راجع كل حقل، ثم احفظ ورحّل كالمعتاد.", "هر فیلد را بازبینی کنید، سپس مثل همیشه ذخیره و ثبت کنید.", "هره ساحه وګورئ، بیا د معمول په څیر خوندي او ثبت کړئ."],
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
