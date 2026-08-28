import fs from 'fs';

const filePath = 'features/roznamcha/components/super-admin-roznamcha-report-view.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports if not present
if (!content.includes('useActiveLanguage')) {
  content = content.replace(
    'import { t } from "@/lib/i18n/ui";',
    'import { t } from "@/lib/i18n/ui";\nimport { useActiveLanguage } from "@/lib/i18n/use-active-language";\nimport { translateHeader } from "@/lib/i18n/table-headers";'
  );
}

// 2. In SuperAdminRoznamchaSummary
content = content.replace(
  'const [showAllCountries, setShowAllCountries] = useState(false);\n\n  if (!rows || rows.length === 0) return null;',
  'const activeLang = useActiveLanguage();\n  const th = (label: string) => translateHeader(activeLang, label);\n  const [showAllCountries, setShowAllCountries] = useState(false);\n\n  if (!rows || rows.length === 0) return null;'
);

content = content.replace('{typeFilter === "branch" ? "1. BRANCH & USER DETAILS" : typeFilter === "country" ? "1. COUNTRY & USER DETAILS" : "1. BRANCH & USER DETAILS"}', '{th(typeFilter === "branch" ? "1. BRANCH & USER DETAILS" : typeFilter === "country" ? "1. COUNTRY & USER DETAILS" : "1. BRANCH & USER DETAILS")}');
content = content.replace('<span>Country:</span>', '<span>{th("Country:")}</span>');
content = content.replace('<span>Branch Name:</span>', '<span>{th("Branch Name:")}</span>');
content = content.replace('<span>User ID:</span>', '<span>{th("User ID:")}</span>');
content = content.replace('<span>User Name:</span>', '<span>{th("User Name:")}</span>');
content = content.replace('<span>Role:</span>', '<span>{th("Role:")}</span>');
content = content.replace('<span>Date & Time:</span>', '<span>{th("Date & Time:")}</span>');
content = content.replace('<span>Scope:</span>', '<span>{th("Scope:")}</span>');

content = content.replace('{typeFilter === "branch" ? "2. BRANCH FINANCIAL SUMMARY" : typeFilter === "country" ? "2. COUNTRY FINANCIAL SUMMARY" : "2. GLOBAL FINANCIAL SUMMARY (USD)"}', '{th(typeFilter === "branch" ? "2. BRANCH FINANCIAL SUMMARY" : typeFilter === "country" ? "2. COUNTRY FINANCIAL SUMMARY" : "2. GLOBAL FINANCIAL SUMMARY (USD)")}');
content = content.replace('<span>{typeFilter === "branch" ? "Total Branch Entries:" : typeFilter === "country" ? "Total Country Entries:" : "Total Global Entries:"}</span>', '<span>{th(typeFilter === "branch" ? "Total Branch Entries:" : typeFilter === "country" ? "Total Country Entries:" : "Total Global Entries:")}</span>');
content = content.replace('<span>Debit / Credit Entries:</span>', '<span>{th("Debit / Credit Entries:")}</span>');
content = content.replace('<span>Posted / Pending:</span>', '<span>{th("Posted / Pending:")}</span>');
content = content.replace('<span>Total Credit:</span>', '<span>{th("Total Credit:")}</span>');
content = content.replace('<span className="text-rose-600 dark:text-rose-500">Total Debit:</span>', '<span className="text-rose-600 dark:text-rose-500">{th("Total Debit:")}</span>');
content = content.replace('<span className="text-slate-600 dark:text-slate-400 uppercase font-bold">Balance:</span>', '<span className="text-slate-600 dark:text-slate-400 uppercase font-bold">{th("Balance:")}</span>');

content = content.replace('<h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400 truncate">3. SCOPE COVERAGE SUMMARY</h4>', '<h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400 truncate">{th("3. SCOPE COVERAGE SUMMARY")}</h4>');
content = content.replace('<span>Countries in Scope:</span>', '<span>{th("Countries in Scope:")}</span>');
content = content.replace('<span>Branches in Scope:</span>', '<span>{th("Branches in Scope:")}</span>');
content = content.replace('<span>Users in Scope:</span>', '<span>{th("Users in Scope:")}</span>');
content = content.replace('<span>Selected Currency Mode:</span>', '<span>{th("Selected Currency Mode:")}</span>');
content = content.replace('<span>Live Rows:</span>', '<span>{th("Live Rows:")}</span>');

// 3. In BranchJournalGeneralStyleSummary
content = content.replace(
  'function BranchJournalGeneralStyleSummary({\n  rows,\n  viewerName,\n  generatedAt,\n  selectedCountryLabel,\n  selectedBranchLabel,\n  totalDebit,\n  totalCredit,\n  onPrint,\n  onPdf,\n  onRefresh\n}: {\n  rows: SuperAdminRoznamchaRow[];\n  viewerName: string;\n  generatedAt: string;\n  selectedCountryLabel: string;\n  selectedBranchLabel: string;\n  totalDebit: number;\n  totalCredit: number;\n  onPrint: () => void;\n  onPdf: () => void;\n  onRefresh: () => void;\n}) {',
  'function BranchJournalGeneralStyleSummary({\n  rows,\n  viewerName,\n  generatedAt,\n  selectedCountryLabel,\n  selectedBranchLabel,\n  totalDebit,\n  totalCredit,\n  onPrint,\n  onPdf,\n  onRefresh\n}: {\n  rows: SuperAdminRoznamchaRow[];\n  viewerName: string;\n  generatedAt: string;\n  selectedCountryLabel: string;\n  selectedBranchLabel: string;\n  totalDebit: number;\n  totalCredit: number;\n  onPrint: () => void;\n  onPdf: () => void;\n  onRefresh: () => void;\n}) {\n  const activeLang = useActiveLanguage();\n  const th = (label: string) => translateHeader(activeLang, label);'
);

content = content.replace('<div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{card.title}</div>', '<div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{th(card.title)}</div>');
content = content.replace('<div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{card.label}</div>', '<div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{th(card.label)}</div>');
content = content.replace('<div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">Total Debit</div>', '<div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">{th("Total Debit")}</div>');
content = content.replace('<div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Total Credit</div>', '<div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">{th("Total Credit")}</div>');
content = content.replace('<div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Balance</div>', '<div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{th("Balance")}</div>');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully and cleanly updated super-admin-roznamcha-report-view.tsx");
