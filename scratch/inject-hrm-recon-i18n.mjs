import fs from "node:fs";
const UI = "B:/accounts.dgt.llc.code_project/ACCOUNTS.DGT.LLC/lib/i18n/ui.ts";

const K = {
  "hrm.recon_nav":         ["Payroll Reconciliation", "پے رول مفاہمت", "تسوية الرواتب", "تطبیق حقوق و دستمزد", "د معاش پخلاینه"],
  "hrm.recon_title":       ["Payroll ↔ Accounting ↔ Tax Reconciliation", "پے رول ↔ اکاؤنٹنگ ↔ ٹیکس مفاہمت", "تسوية الرواتب ↔ المحاسبة ↔ الضريبة", "تطبیق حقوق ↔ حسابداری ↔ مالیات", "معاش ↔ حساب ↔ مالیه پخلاینه"],
  "hrm.recon_blurb":       ["Payroll Register → Salary Due → Roznamcha → Journal / Ledger → Payroll Tax. Each posted line is checked for Total Debit = Total Credit. This report does not post anything.",
                            "پے رول رجسٹر ← واجب الادا تنخواہ ← روزنامچہ ← جرنل / لیجر ← پے رول ٹیکس۔ ہر پوسٹ شدہ لائن کے لیے کل ڈیبٹ = کل کریڈٹ چیک کیا جاتا ہے۔ یہ رپورٹ کچھ پوسٹ نہیں کرتی۔",
                            "سجل الرواتب ← الراتب المستحق ← اليومية ← دفتر اليومية / الأستاذ ← ضريبة الرواتب. يتم التحقق من كل بند مُرحَّل بأن إجمالي المدين = إجمالي الدائن. لا يقوم هذا التقرير بأي ترحيل.",
                            "دفتر حقوق ← حقوق قابل پرداخت ← روزنامچه ← دفتر روزنامه / کل ← مالیات حقوق. هر سطر ثبت‌شده برای مجموع بدهکار = مجموع بستانکار بررسی می‌شود. این گزارش چیزی ثبت نمی‌کند.",
                            "د معاش راجستر ← د ورکړې معاش ← روزنامچه ← ژورنال / لیجر ← د معاش مالیه. هره ثبت شوې کرښه د ټول ډیبیټ = ټول کریډیټ لپاره ګورل کیږي. دا راپور هیڅ نه ثبتوي."],
  "hrm.recon_k_lines":     ["Lines", "لائنیں", "البنود", "سطرها", "کرښې"],
  "hrm.recon_k_balanced":  ["Balanced", "متوازن", "متوازن", "متوازن", "برابر"],
  "hrm.recon_k_unbalanced":["Unbalanced", "غیر متوازن", "غير متوازن", "نامتوازن", "نابرابر"],
  "hrm.recon_k_not_posted":["Not Posted", "غیر پوسٹ شدہ", "غير مُرحَّل", "ثبت‌نشده", "نه ثبت شوی"],
  "hrm.recon_k_gross":     ["Gross", "مجموعی", "الإجمالي", "ناخالص", "ناخالص"],
  "hrm.recon_k_tax":       ["Tax", "ٹیکس", "الضريبة", "مالیات", "مالیه"],
  "hrm.recon_k_net":       ["Net", "خالص", "الصافي", "خالص", "خالص"],
  "hrm.recon_dr_cr_warn":  ["Total Debit − Credit across posted payroll entries is not zero", "پوسٹ شدہ پے رول اندراجات میں کل ڈیبٹ − کریڈٹ صفر نہیں ہے", "إجمالي المدين − الدائن في قيود الرواتب المُرحَّلة ليس صفراً", "مجموع بدهکار − بستانکار در ثبت‌های حقوق ثبت‌شده صفر نیست", "په ثبت شویو معاش ننوتنو کې ټول ډیبیټ − کریډیټ صفر نه دی"],
  "hrm.recon_dr_cr_ok":    ["All posted payroll accrual entries balance (Debit = Credit).", "تمام پوسٹ شدہ پے رول اکروئل اندراجات متوازن ہیں (ڈیبٹ = کریڈٹ)۔", "جميع قيود استحقاق الرواتب المُرحَّلة متوازنة (المدين = الدائن).", "همه ثبت‌های تعهدی حقوق ثبت‌شده متوازن‌اند (بدهکار = بستانکار).", "ټول ثبت شوي د معاش تعهدي ننوتنې برابرې دي (ډیبیټ = کریډیټ)."],
  "hrm.recon_c_run":       ["Run", "رن", "الدورة", "اجرا", "چلونه"],
  "hrm.recon_c_period":    ["Period", "مدت", "الفترة", "دوره", "موده"],
  "hrm.recon_c_emp":       ["Employee", "ملازم", "الموظف", "کارمند", "کارمند"],
  "hrm.recon_c_gross":     ["Gross", "مجموعی", "الإجمالي", "ناخالص", "ناخالص"],
  "hrm.recon_c_tax":       ["Tax", "ٹیکس", "الضريبة", "مالیات", "مالیه"],
  "hrm.recon_c_net":       ["Net", "خالص", "الصافي", "خالص", "خالص"],
  "hrm.recon_c_due":       ["Salary Due", "واجب الادا تنخواہ", "الراتب المستحق", "حقوق قابل پرداخت", "د ورکړې معاش"],
  "hrm.recon_c_accrual":   ["Accrual Voucher", "اکروئل واؤچر", "سند الاستحقاق", "سند تعهدی", "د تعهد واؤچر"],
  "hrm.recon_c_drcr":      ["Dr − Cr", "ڈیبٹ − کریڈٹ", "مدين − دائن", "بدهکار − بستانکار", "ډیبیټ − کریډیټ"],
  "hrm.recon_c_check":     ["Check", "چیک", "الفحص", "بررسی", "کتنه"],
  "hrm.recon_empty":       ["No payroll lines for this filter. Run and post a payroll to see the reconciliation trace.", "اس فلٹر کے لیے کوئی پے رول لائن نہیں۔ مفاہمت ٹریس دیکھنے کے لیے پے رول چلائیں اور پوسٹ کریں۔", "لا توجد بنود رواتب لهذا المرشّح. شغّل ورحّل رواتب لرؤية أثر التسوية.", "سطر حقوقی برای این فیلتر نیست. برای دیدن ردیابی تطبیق، حقوق را اجرا و ثبت کنید.", "د دې فلټر لپاره د معاش کرښې نشته. د پخلاینې نښه لیدو لپاره معاش چل او ثبت کړئ."],
  "hrm.recon_chk_balanced":  ["Balanced", "متوازن", "متوازن", "متوازن", "برابر"],
  "hrm.recon_chk_unbalanced":["Unbalanced", "غیر متوازن", "غير متوازن", "نامتوازن", "نابرابر"],
  "hrm.recon_chk_not_posted":["Not Posted", "غیر پوسٹ شدہ", "غير مُرحَّل", "ثبت‌نشده", "نه ثبت شوی"],
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
