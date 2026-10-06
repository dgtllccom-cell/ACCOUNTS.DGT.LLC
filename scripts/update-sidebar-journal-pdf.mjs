import fs from 'node:fs';
import path from 'node:path';

const sidebarPath = path.join(process.cwd(), 'lib', 'navigation', 'sidebar.ts');
let content = fs.readFileSync(sidebarPath, 'utf8');

// 1. Add to ledgers children
if (!content.includes('key: "ledgers-journal-report-pdf"')) {
  content = content.replace(
    '    key: "ledgers",\n    labelKey: "nav.ledgers",\n    iconKey: "book-open",\n    children: [',
    `    key: "ledgers",\n    labelKey: "nav.ledgers",\n    iconKey: "book-open",\n    children: [\n      {\n        key: "ledgers-journal-report-pdf",\n        labelKey: "nav.journal_report_pdf_erp",\n        iconKey: "file-text",\n        href: "/dashboard/reports/handover" as Route\n      },`
  );
}

// 2. Add to reports children
if (!content.includes('key: "reports-journal-report-pdf"')) {
  content = content.replace(
    '    key: "reports",\n    labelKey: "nav.reports",\n    iconKey: "bar-chart",\n    href: "/dashboard/reports" as Route,\n    children: [',
    `    key: "reports",\n    labelKey: "nav.reports",\n    iconKey: "bar-chart",\n    href: "/dashboard/reports" as Route,\n    children: [\n      {\n        key: "reports-journal-report-pdf",\n        labelKey: "nav.journal_report_pdf_erp",\n        iconKey: "file-text",\n        href: "/dashboard/reports/handover" as Route\n      },`
  );
}

// 3. Add to journal-stock children
if (!content.includes('key: "journal-stock-pdf-erp"')) {
  content = content.replace(
    '    key: "journal-stock",\n    labelKey: "nav.journal_stock",\n    iconKey: "scroll-text",\n    children: [',
    `    key: "journal-stock",\n    labelKey: "nav.journal_stock",\n    iconKey: "scroll-text",\n    children: [\n      {\n        key: "journal-stock-pdf-erp",\n        labelKey: "nav.journal_report_pdf_erp",\n        iconKey: "file-text",\n        href: "/dashboard/reports/handover" as Route\n      },`
  );
}

// 4. Update top-level handover-report
content = content.replace(
  '    key: "handover-report",\n    labelKey: "nav.reports" as any,',
  '    key: "handover-report",\n    labelKey: "nav.journal_report_pdf_erp",'
);

fs.writeFileSync(sidebarPath, content, 'utf8');
console.log('✅ Updated sidebar.ts with Journal Report PDF ERP in Ledgers, Journal Stock, Reports & Top level!');
