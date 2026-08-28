const fs = require('fs');
const path = require('path');

const uiFilePath = path.join(__dirname, '..', 'lib', 'i18n', 'ui.ts');
let content = fs.readFileSync(uiFilePath, 'utf8');

// 1. Add to UiKey union
const uiKeyTarget = '  | "nav.dashboard"';
const uiKeyAdd = `  | "nav.dashboard"\n  | "nav.new_entry"\n  | "nav.new_account"\n  | "nav.new_branch"\n  | "nav.new_user"\n  | "nav.register_employee"\n  | "nav.entry_reports"`;

if (content.includes(uiKeyTarget)) {
  content = content.replace(uiKeyTarget, uiKeyAdd);
}

// 2. Add to en dictionary
const enTarget = '  "nav.all_release_entries": "All Release Entries",';
const enAdd = `  "nav.new_entry": "New Entry",\n  "nav.new_account": "New Account / Ledger",\n  "nav.new_branch": "Branch Setup / Network",\n  "nav.new_user": "New User Registration",\n  "nav.register_employee": "Register Employee",\n  "nav.entry_reports": "Entry & Release Reports",\n  "nav.all_release_entries": "All Release Entries",`;

if (content.includes(enTarget)) {
  content = content.replace(enTarget, enAdd);
}

// 3. Add to ur dictionary
const urTarget = '  "nav.all_release_entries": "تمام ریلیز اندراجات",';
const urAdd = `  "nav.new_entry": "نیا اندراج",\n  "nav.new_account": "نیا کھاتہ / لیجر",\n  "nav.new_branch": "برانچ نیٹ ورک و سیٹ اپ",\n  "nav.new_user": "نئے صارف کا اندراج",\n  "nav.register_employee": "ملازم کا اندراج",\n  "nav.entry_reports": "اندراج رپورٹس",\n  "nav.all_release_entries": "تمام ریلیز اندراجات",`;

if (content.includes(urTarget)) {
  content = content.replace(urTarget, urAdd);
}

// 4. Add to ar dictionary
const arTarget = '  "nav.all_release_entries": "جميع القيود الصادرة",';
const arAdd = `  "nav.new_entry": "إدخال جديد",\n  "nav.new_account": "حساب جديد / دفتر الأستاذ",\n  "nav.new_branch": "إعداد الفروع والشبكة",\n  "nav.new_user": "تسجيل مستخدم جديد",\n  "nav.register_employee": "تسجيل موظف",\n  "nav.entry_reports": "تقارير الإدخالات",\n  "nav.all_release_entries": "جميع القيود الصادرة",`;

if (content.includes(arTarget)) {
  content = content.replace(arTarget, arAdd);
}

// 5. Add to fa dictionary
const faTarget = '  "nav.all_release_entries": "تمام ثبت‌های منتشرشده",';
const faAdd = `  "nav.new_entry": "ثبت جدید",\n  "nav.new_account": "حساب جدید / دفتر کل",\n  "nav.new_branch": "تنظیم شعبات و شبکه",\n  "nav.new_user": "ثبت کاربر جدید",\n  "nav.register_employee": "ثبت کارمند",\n  "nav.entry_reports": "گزارش‌های ثبت و ترخیص",\n  "nav.all_release_entries": "تمام ثبت‌های منتشرشده",`;

if (content.includes(faTarget)) {
  content = content.replace(faTarget, faAdd);
}

// 6. Add to ps dictionary
const psTarget = '  "nav.all_release_entries": "ټول خپاره شوي ثبتونه",';
const psAdd = `  "nav.new_entry": "نوې ننوتنه",\n  "nav.new_account": "نوی حساب / لیجر",\n  "nav.new_branch": "د څانګې او شبکې تنظیم",\n  "nav.new_user": "د نوي کارن ثبت",\n  "nav.register_employee": "د کارمند ثبت",\n  "nav.entry_reports": "د ننوتنو او ریلیز راپورونه",\n  "nav.all_release_entries": "ټول خپاره شوي ثبتونه",`;

if (content.includes(psTarget)) {
  content = content.replace(psTarget, psAdd);
}

fs.writeFileSync(uiFilePath, content, 'utf8');
console.log('Successfully patched lib/i18n/ui.ts across all 5 languages!');
