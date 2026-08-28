import fs from 'fs';

// 1. Update lib/i18n/table-headers.ts with missing keys
const headersPath = 'lib/i18n/table-headers.ts';
let headersContent = fs.readFileSync(headersPath, 'utf8');

const missingReportKeys = `  "REPORT GENERATED:": {
    ur: "رپورٹ تیار کی گئی:",
    ar: "تم إنشاء التقرير:",
    fa: "گزارش ایجاد شد:",
    ps: "راپور جوړ شوی:",
  },
  "SELECTED PERIOD:": {
    ur: "منتخب مدت:",
    ar: "الفترة المحددة:",
    fa: "دوره انتخابی:",
    ps: "ټاکل شوې موده:",
  },
  "VIEW LEDGER": {
    ur: "لیجر دیکھیں",
    ar: "عرض دفتر الأستاذ",
    fa: "مشاهده دفتر کل",
    ps: "لیجر وګورئ",
  },
  "VIEW STATEMENT": {
    ur: "اسٹیٹمنٹ دیکھیں",
    ar: "عرض كشف الحساب",
    fa: "مشاهده صورتحساب",
    ps: "صورت حساب وګورئ",
  },
  "LANGUAGE": {
    ur: "زبان",
    ar: "اللغة",
    fa: "زبان",
    ps: "ژبه",
  },
  "TOGGLE THEME": {
    ur: "تھیم تبدیل کریں",
    ar: "تبديل المظهر",
    fa: "تغییر پوسته",
    ps: "بڼه بدل کړئ",
  },
  "LOG OUT": {
    ur: "لاگ آؤٹ",
    ar: "تسجيل الخروج",
    fa: "خروج",
    ps: "وتل",
  },
};
`;

headersContent = headersContent.replace('};', missingReportKeys);
fs.writeFileSync(headersPath, headersContent, 'utf8');
console.log("Updated table-headers.ts with report & header keys!");
