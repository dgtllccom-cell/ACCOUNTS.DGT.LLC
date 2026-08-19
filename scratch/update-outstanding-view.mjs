import fs from 'fs';

const filePath = 'features/reports/ledger-report/components/outstanding-recovery-ledger-view.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace panel 1 headings and labels
content = content.replace('1. BRANCH & USER DETAILS', '{tr("1. BRANCH & USER DETAILS")}');
content = content.replace('<span>COUNTRY:</span>', '<span>{tr("COUNTRY:")}</span>');
content = content.replace('<span>BRANCH NAME:</span>', '<span>{tr("BRANCH NAME:")}</span>');
content = content.replace('<span>USER ID:</span>', '<span>{tr("USER ID:")}</span>');
content = content.replace('<span>USER NAME:</span>', '<span>{tr("USER NAME:")}</span>');
content = content.replace('<span>ROLE:</span>', '<span>{tr("ROLE:")}</span>');
content = content.replace('<span>DATE & TIME:</span>', '<span>{tr("DATE & TIME:")}</span>');
content = content.replace('<span>STATUS:</span>', '<span>{tr("STATUS:")}</span>');

// Replace panel 2 headings and labels
content = content.replace('2. GLOBAL FINANCIAL SUMMARY', '{tr("2. GLOBAL FINANCIAL SUMMARY")}');
content = content.replace('<span>OUTSTANDING ACCOUNTS:</span>', '<span>{tr("OUTSTANDING ACCOUNTS:")}</span>');
content = content.replace('<span>TOTAL RECEIVABLE:</span>', '<span>{tr("TOTAL RECEIVABLE:")}</span>');
content = content.replace('<span>TOTAL PAYABLE:</span>', '<span>{tr("TOTAL PAYABLE:")}</span>');
content = content.replace('<span>OVERDUE (>10 DAYS):</span>', '<span>{tr("OVERDUE (>10 DAYS):")}</span>');
content = content.replace('<span>NET OUTSTANDING:</span>', '<span>{tr("NET OUTSTANDING:")}</span>');

// Replace panel 3 headings and labels
content = content.replace('3. BILL ENTRIES SUMMARY', '{tr("3. BILL ENTRIES SUMMARY")}');
content = content.replace('<span>TOTAL BILL ENTRIES:</span>', '<span>{tr("TOTAL BILL ENTRIES:")}</span>');
content = content.replace('<span>CLEARED ENTRIES:</span>', '<span>{tr("CLEARED ENTRIES:")}</span>');
content = content.replace('<span>REMAINING ENTRIES:</span>', '<span>{tr("REMAINING ENTRIES:")}</span>');
content = content.replace('<span>SYSTEM STATUS:</span>', '<span>{tr("SYSTEM STATUS:")}</span>');

// Replace panel 4 headings and labels
content = content.replace('4. ALL COUNTRIES REPORT', '{tr("4. ALL COUNTRIES REPORT")}');
content = content.replace('<span>TOTAL COUNTRIES:</span>', '<span>{tr("TOTAL COUNTRIES:")}</span>');
content = content.replace('<span>TOTAL BRANCHES:</span>', '<span>{tr("TOTAL BRANCHES:")}</span>');
content = content.replace('<span>ACTIVE CURRENCY:</span>', '<span>{tr("ACTIVE CURRENCY:")}</span>');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated outstanding-recovery-ledger-view.tsx");
