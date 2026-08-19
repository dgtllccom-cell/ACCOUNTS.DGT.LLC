import fs from 'fs';

const filePath = 'features/currency/daily-exchange-rate-manager.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add imports
if (!content.includes('useActiveLanguage')) {
  content = content.replace(
    'import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";',
    'import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";\nimport { useActiveLanguage } from "@/lib/i18n/use-active-language";\nimport { translateHeader } from "@/lib/i18n/table-headers";'
  );
}

// In DailyExchangeRateManager
content = content.replace(
  'export function DailyExchangeRateManager() {',
  'export function DailyExchangeRateManager() {\n  const lang = useActiveLanguage();\n  const th = (label: string) => translateHeader(lang, label);'
);

// Update title and action buttons
content = content.replace('DAILY EXCHANGE RATE MANAGEMENT', '{th("DAILY EXCHANGE RATE MANAGEMENT")}');
content = content.replace('Print Rate Table', '{th("Print Rate Table")}');
content = content.replace('Refresh Rates', '{th("Refresh Rates")}');
content = content.replace('EXCHANGE RATE ENTRY FORM', '{th("EXCHANGE RATE ENTRY FORM")}');
content = content.replace('INTRA-DAY LIVE ENTRY', '{th("INTRA-DAY LIVE ENTRY")}');
content = content.replace('1. COUNTRY NAME', '{th("1. COUNTRY NAME")}');
content = content.replace('2. DATE', '{th("2. DATE")}');
content = content.replace('3. TIME', '{th("3. TIME")}');
content = content.replace('OPERATOR USER', '{th("OPERATOR USER")}');
content = content.replace('BRANCH NAME', '{th("BRANCH NAME")}');
content = content.replace('4. CREDIT DOLLAR PRICE ($)', '{th("4. CREDIT DOLLAR PRICE ($)")}');
content = content.replace('5. DEBIT DOLLAR PRICE ($)', '{th("5. DEBIT DOLLAR PRICE ($)")}');
content = content.replace('SAVE EXCHANGE RATE', '{th("SAVE EXCHANGE RATE")}');
content = content.replace('SAVING EXCHANGE RATE...', '{th("SAVING EXCHANGE RATE...")}');
content = content.replace('SUPER ADMIN LIVE EXCHANGE RATES TABLE', '{th("SUPER ADMIN LIVE EXCHANGE RATES TABLE")}');
content = content.replace('ALL COUNTRIES', '{th("ALL COUNTRIES")}');
content = content.replace('ALL BRANCHES', '{th("ALL BRANCHES")}');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated daily-exchange-rate-manager.tsx");
