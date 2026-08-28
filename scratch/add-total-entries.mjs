import fs from 'fs';

const headersPath = 'lib/i18n/table-headers.ts';
let headersContent = fs.readFileSync(headersPath, 'utf8');

const additionalKeys = `  "TOTAL ENTRIES": {
    ur: "کل اندراجات",
    ar: "إجمالي المدخلات",
    fa: "مجموع ورودی‌ها",
    ps: "ټولې داخلې",
  },
  "TOTAL ENTRIES:": {
    ur: "کل اندراجات:",
    ar: "إجمالي المدخلات:",
    fa: "مجموع ورودی‌ها:",
    ps: "ټولې داخلې:",
  },
  "TOTAL COUNTRIES:": {
    ur: "کل ممالک:",
    ar: "إجمالي الدول:",
    fa: "مجموع کشورها:",
    ps: "ټول هیوادونه:",
  },
  "TOTAL COUNTRIES": {
    ur: "کل ممالک",
    ar: "إجمالي الدول",
    fa: "مجموع کشورها",
    ps: "ټول هیوادونه",
  },
};
`;

headersContent = headersContent.replace('};', additionalKeys);
fs.writeFileSync(headersPath, headersContent, 'utf8');
console.log("Added TOTAL ENTRIES and TOTAL COUNTRIES to table-headers.ts");
