import fs from 'node:fs';
import path from 'node:path';

const uiPath = path.join(process.cwd(), 'lib', 'i18n', 'ui.ts');
let content = fs.readFileSync(uiPath, 'utf8');

if (!content.includes('"nav.journal_report_pdf_erp"')) {
  content = content.replace(
    '  | "nav.ledgers"',
    '  | "nav.ledgers"\n  | "nav.journal_report_pdf_erp"'
  );

  content = content.replace(
    '  "nav.ledgers": "Ledgers",',
    '  "nav.ledgers": "Ledgers",\n  "nav.journal_report_pdf_erp": "Journal Report PDF ERP",'
  );

  content = content.replace(
    '  "nav.ledgers": "لیجر",',
    '  "nav.ledgers": "لیجر",\n  "nav.journal_report_pdf_erp": "جرنل رپورٹ پی ڈی ایف ERP",'
  );

  content = content.replace(
    '  "nav.ledgers": "دفاتر الأستاذ",',
    '  "nav.ledgers": "دفاتر الأستاذ",\n  "nav.journal_report_pdf_erp": "تقرير اليومية PDF ERP",'
  );

  content = content.replace(
    '  "nav.ledgers": "دفاتر کل",',
    '  "nav.ledgers": "دفاتر کل",\n  "nav.journal_report_pdf_erp": "گزارش روزنامه PDF ERP",'
  );

  content = content.replace(
    '  "nav.ledgers": "لېجرونه",',
    '  "nav.ledgers": "لېجرونه",\n  "nav.journal_report_pdf_erp": "د ژورنال راپور PDF ERP",'
  );

  fs.writeFileSync(uiPath, content, 'utf8');
  console.log('✅ Added nav.journal_report_pdf_erp to lib/i18n/ui.ts');
} else {
  console.log('Already exists in ui.ts');
}
