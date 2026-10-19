const fs = require('fs');

const UI_PATH = 'lib/i18n/ui.ts';
let content = fs.readFileSync(UI_PATH, 'utf8');

// 1. Add to UiKey
const typeTarget = '  // Registered Truck redesign (trk.* additions, 2026-09-09)\n  | "trk.registered_truck_title"';
const typeReplace = '  // Registered Truck redesign (trk.* additions, 2026-09-09)\n  | "trk.last_login" | "trk.all_dates_year" | "trk.search_placeholder_full" | "trk.btn_new_clearing_truck"\n  | "trk.registered_truck_title"';

if (!content.includes(typeReplace)) {
  content = content.replace(typeTarget, typeReplace);
}

// 2. Add to EN
const enTarget = '  "trk.registered_truck_title": "Clearing Truck Registration",';
const enReplace = `  "trk.last_login": "Last Login",
  "trk.all_dates_year": "All Dates (2026)",
  "trk.search_placeholder_full": "Search by Truck No, Name, Owner, Driver, Company...",
  "trk.btn_new_clearing_truck": "New Clearing Truck",
  "trk.registered_truck_title": "Clearing Truck Registration",`;

if (!content.includes('"trk.last_login": "Last Login"')) {
  content = content.replace(enTarget, enReplace);
}

// 3. Add to UR
const urTarget = '  "trk.registered_truck_title": "کلیئرنگ ٹرک رجسٹریشن",';
const urReplace = `  "trk.last_login": "آخری لاگ ان",
  "trk.all_dates_year": "تمام تاریخیں (2026)",
  "trk.search_placeholder_full": "ٹرک نمبر، نام، مالک، ڈرائیور، کمپنی سے تلاش کریں...",
  "trk.btn_new_clearing_truck": "نیا کلیرنگ ٹرک",
  "trk.registered_truck_title": "کلیئرنگ ٹرک رجسٹریشن",`;

if (!content.includes('"trk.last_login": "آخری لاگ ان"')) {
  content = content.replace(urTarget, urReplace);
}

// 4. Add to AR
const arTarget = '  "trk.registered_truck_title": "تسجيل شاحنة التخليص",';
const arReplace = `  "trk.last_login": "آخر تسجيل دخول",
  "trk.all_dates_year": "جميع التواريخ (2026)",
  "trk.search_placeholder_full": "البحث برقم الشاحنة، الاسم، المالك، السائق، الشركة...",
  "trk.btn_new_clearing_truck": "شاحنة تخليص جديدة",
  "trk.registered_truck_title": "تسجيل شاحنة التخليص",`;

if (!content.includes('"trk.last_login": "آخر تسجيل دخول"')) {
  content = content.replace(arTarget, arReplace);
}

// 5. Add to FA
const faTarget = '  "trk.registered_truck_title": "ثبت کامیون ترخیص",';
const faReplace = `  "trk.last_login": "آخرین ورود",
  "trk.all_dates_year": "همه تاریخ‌ها (2026)",
  "trk.search_placeholder_full": "جستجو بر اساس شماره موتر، نام، مالک، راننده، شرکت...",
  "trk.btn_new_clearing_truck": "کامیون ترخیص جدید",
  "trk.registered_truck_title": "ثبت کامیون ترخیص",`;

if (!content.includes('"trk.last_login": "آخرین ورود"')) {
  content = content.replace(faTarget, faReplace);
}

// 6. Add to PS
const psTarget = '  "trk.registered_truck_title": "د کلیرنس د لارۍ راجستر",';
const psReplace = `  "trk.last_login": "وروستی ننوتل",
  "trk.all_dates_year": "ټولې نېټې (2026)",
  "trk.search_placeholder_full": "د موټر شمېرې، نوم، مالک، چلوونکي، شرکت له لارې لټون...",
  "trk.btn_new_clearing_truck": "د تصفیې نوی موټر",
  "trk.registered_truck_title": "د کلیرنس د لارۍ راجستر",`;

if (!content.includes('"trk.last_login": "وروستی ننوتل"')) {
  content = content.replace(psTarget, psReplace);
}

fs.writeFileSync(UI_PATH, content, 'utf8');
console.log('Successfully updated lib/i18n/ui.ts');
