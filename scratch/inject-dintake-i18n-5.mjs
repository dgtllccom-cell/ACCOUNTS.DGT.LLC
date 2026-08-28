import fs from "node:fs";
const UI = "B:/accounts.dgt.llc.code_project/ACCOUNTS.DGT.LLC/lib/i18n/ui.ts";

const K = {
  "dintake.roz_preview":        ["Cash / Bank Pre-Post Preview", "کیش / بینک پری پوسٹ پیش نظارہ", "معاينة ما قبل الترحيل للنقد / البنك", "پیش‌نمایش پیش از ثبت نقد / بانک", "د نغدو / بانک د ثبت مخکې کتنه"],
  "dintake.roz_preview_title":  ["Before Posting — Cash / Bank Roznamcha", "پوسٹنگ سے پہلے — کیش / بینک روزنامچہ", "قبل الترحيل — يومية النقد / البنك", "پیش از ثبت — روزنامچه نقد / بانک", "له ثبت مخکې — د نغدو / بانک روزنامچه"],
  "dintake.roz_dup":            ["A matching Roznamcha entry already exists", "ایک ملتا جلتا روزنامچہ اندراج پہلے سے موجود ہے", "يوجد قيد يومية مطابق بالفعل", "یک ثبت روزنامچه مطابق از قبل وجود دارد", "ورته د روزنامچې ننوت له مخکې شتون لري"],
  "dintake.roz_unbalanced":     ["Debit and Credit are not balanced yet.", "ڈیبٹ اور کریڈٹ ابھی متوازن نہیں ہیں۔", "المدين والدائن غير متوازنين بعد.", "بدهکار و بستانکار هنوز متوازن نیستند.", "ډیبیټ او کریډیټ لا سم نه دي."],
  "dintake.roz_note":           ["Serial numbers are allocated only when you post from the Cash / Bank Roznamcha screen. The AI does not post.", "سیریل نمبر صرف اسی وقت مختص ہوتے ہیں جب آپ کیش / بینک روزنامچہ اسکرین سے پوسٹ کرتے ہیں۔ اے آئی پوسٹ نہیں کرتا۔", "تُخصَّص الأرقام التسلسلية فقط عند الترحيل من شاشة يومية النقد / البنك. الذكاء الاصطناعي لا يقوم بالترحيل.", "شماره‌های سریال فقط هنگام ثبت از صفحه روزنامچه نقد / بانک تخصیص می‌یابند. هوش مصنوعی ثبت نمی‌کند.", "سریال شمېرې یوازې هغه وخت ټاکل کیږي چې تاسو د نغدو / بانک روزنامچه پاڼې څخه ثبت کوئ. مصنوعي ذهانت نه ثبتوي."],
  "dintake.roz_f_method":       ["Payment Method", "ادائیگی کا طریقہ", "طريقة الدفع", "روش پرداخت", "د تادیې طریقه"],
  "dintake.roz_f_cheque_status":["Cheque Status", "چیک کی حالت", "حالة الشيك", "وضعیت چک", "د چک حالت"],
  "dintake.roz_f_sa_serial":    ["Super Admin Serial", "سپر ایڈمن سیریل", "التسلسل الإداري الأعلى", "سریال سوپر ادمین", "د سوپر اډمین سریال"],
  "dintake.roz_f_country_serial":["Country Serial", "ملک سیریل", "التسلسل القُطري", "سریال کشور", "د هېواد سریال"],
  "dintake.roz_f_branch_serial":["Branch Serial", "برانچ سیریل", "التسلسل الفرعي", "سریال شعبه", "د څانګې سریال"],
  "dintake.roz_f_entry_serial": ["Entry Serial", "اندراج سیریل", "تسلسل القيد", "سریال ثبت", "د ننوت سریال"],
  "dintake.roz_f_bill":         ["Bill Number", "بل نمبر", "رقم الفاتورة", "شماره صورت‌حساب", "د بل شمېره"],
  "dintake.roz_f_manual_bill":  ["Manual Bill Number", "دستی بل نمبر", "رقم الفاتورة اليدوي", "شماره صورت‌حساب دستی", "لاسي د بل شمېره"],
  "dintake.roz_f_debit":        ["Debit Account", "ڈیبٹ اکاؤنٹ", "الحساب المدين", "حساب بدهکار", "د ډیبیټ حساب"],
  "dintake.roz_f_credit":       ["Credit Account", "کریڈٹ اکاؤنٹ", "الحساب الدائن", "حساب بستانکار", "د کریډیټ حساب"],
  "dintake.roz_f_currency":     ["Original Currency", "اصل کرنسی", "العملة الأصلية", "ارز اصلی", "اصلي اسعارو"],
  "dintake.roz_f_rate":         ["Exchange Rate", "شرح تبادلہ", "سعر الصرف", "نرخ ارز", "د تبادلې نرخ"],
  "dintake.roz_f_final":        ["Final Amount", "حتمی رقم", "المبلغ النهائي", "مبلغ نهایی", "وروستۍ اندازه"],
  "dintake.roz_f_base":         ["Base Amount", "بنیادی رقم", "المبلغ الأساسي", "مبلغ پایه", "بنسټیزه اندازه"],
  "dintake.roz_f_source_module":["Source Module", "سورس ماڈیول", "الوحدة المصدر", "ماژول مبدأ", "سرچینه ماډل"],
  "dintake.roz_f_source_ref":   ["Contract / Purchase / Sales Reference", "معاہدہ / خرید / فروخت حوالہ", "مرجع العقد / الشراء / البيع", "مرجع قرارداد / خرید / فروش", "د تړون / پیرود / پلور حواله"],
  "dintake.roz_f_date":         ["Entry Date", "اندراج کی تاریخ", "تاريخ القيد", "تاریخ ثبت", "د ننوت نېټه"],
  "dintake.pm_cash":            ["Cash", "نقد", "نقداً", "نقدی", "نغدي"],
  "dintake.pm_bank_transfer":   ["Bank Transfer", "بینک ٹرانسفر", "تحويل بنكي", "انتقال بانکی", "بانکي لېږد"],
  "dintake.pm_cheque":          ["Cheque", "چیک", "شيك", "چک", "چک"],
  "dintake.pm_other":           ["Other", "دیگر", "أخرى", "دیگر", "بل"],
  "dintake.cs_pending":         ["Pending", "زیر التوا", "قيد الانتظار", "در انتظار", "پاتې"],
  "dintake.cs_cleared":         ["Cleared", "کلیئر شدہ", "تمت التسوية", "تسویه‌شده", "تصفیه شوی"],
  "dintake.cs_dishonoured":     ["Dishonoured", "ناقابل ادائیگی", "مرتجع", "برگشت‌خورده", "رد شوی"],
  "dintake.cs_cancelled":       ["Cancelled", "منسوخ", "ملغى", "لغوشده", "لغوه شوی"],
  "dintake.f_payment_method":   ["Payment Method", "ادائیگی کا طریقہ", "طريقة الدفع", "روش پرداخت", "د تادیې طریقه"],
  "dintake.f_cheque_number":    ["Cheque Number", "چیک نمبر", "رقم الشيك", "شماره چک", "د چک شمېره"],
  "dintake.f_cheque_status":    ["Cheque Status", "چیک کی حالت", "حالة الشيك", "وضعیت چک", "د چک حالت"],
  "dintake.f_bank_name":        ["Bank Name", "بینک کا نام", "اسم البنك", "نام بانک", "د بانک نوم"],
  "dintake.f_value_date":       ["Value Date", "ویلیو ڈیٹ", "تاريخ القيمة", "تاریخ ارزش", "د ارزښت نېټه"],
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
