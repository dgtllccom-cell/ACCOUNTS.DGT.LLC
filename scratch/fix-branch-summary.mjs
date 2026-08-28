import fs from 'fs';

const filePath = 'features/roznamcha/components/super-admin-roznamcha-report-view.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `function BranchJournalGeneralStyleSummary({`;
const targetEnd = `  const uniqueCountries = new Set(rows.map((row) => row.countryId || row.countryName).filter(Boolean));`;

const idx1 = content.indexOf(targetStr);
const idx2 = content.indexOf(targetEnd);

if (idx1 !== -1 && idx2 !== -1) {
  const cleanFunc = `function BranchJournalGeneralStyleSummary({
  rows,
  viewerName,
  generatedAt,
  selectedCountryLabel,
  selectedBranchLabel,
  totalDebit,
  totalCredit,
  onPrint,
  onPdf,
  onRefresh
}: {
  rows: SuperAdminRoznamchaRow[];
  viewerName: string;
  generatedAt: string;
  selectedCountryLabel: string;
  selectedBranchLabel: string;
  totalDebit: number;
  totalCredit: number;
  onPrint: () => void;
  onPdf: () => void;
  onRefresh: () => void;
}) {
  const activeLang = useActiveLanguage();
  const th = (label: string) => translateHeader(activeLang, label);
`;

  content = content.substring(0, idx1) + cleanFunc + content.substring(idx2);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully fixed BranchJournalGeneralStyleSummary signature!");
} else {
  console.error("Could not find markers for BranchJournalGeneralStyleSummary");
}
