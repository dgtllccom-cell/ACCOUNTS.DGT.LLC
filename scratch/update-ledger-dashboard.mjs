import fs from 'fs';

const filePath = 'features/ledger/components/new-ledger-dashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add imports
if (!content.includes('useActiveLanguage')) {
  content = content.replace(
    'import { Th } from "@/components/ui/translated-th";',
    'import { Th } from "@/components/ui/translated-th";\nimport { useActiveLanguage } from "@/lib/i18n/use-active-language";\nimport { translateHeader } from "@/lib/i18n/table-headers";'
  );
}

// Update NewLedgerDashboard function top
content = content.replace(
  'export function NewLedgerDashboard({ initialAccount = "" }: { initialAccount?: string }) {',
  'export function NewLedgerDashboard({ initialAccount = "" }: { initialAccount?: string }) {\n  const activeLang = useActiveLanguage();\n  const th = (label: string) => translateHeader(activeLang, label);'
);

// Update Header in Card
content = content.replace(
  '<h1 className="text-2xl font-semibold tracking-tight text-cyan-600 dark:text-cyan-300">\n                  Ledger Statement\n                </h1>',
  '<h1 className="text-2xl font-semibold tracking-tight text-cyan-600 dark:text-cyan-300">\n                  {th("Ledger Statement")}\n                </h1>'
);

content = content.replace(
  'Status: Active | Created:',
  '{th("Status")}: {th("Active")} | {th("Created")}:'
);

content = content.replace(
  'Account: <span className="font-semibold text-foreground">{safeText(account?.accountCode)}</span>',
  '{th("Account")}: <span className="font-semibold text-foreground">{safeText(account?.accountCode)}</span>'
);

content = content.replace(
  'Loading ledger data...',
  '{th("Loading ledger data...")}'
);

content = content.replace(
  'No ledger entries available for this account.',
  '{th("No ledger entries available for this account.")}'
);

// Update InfoPanel and InfoRow components
const oldInfoSection = `function InfoPanel({
  title,
  accent,
  children
}: {
  title: string;
  accent: "cyan" | "blue" | "indigo" | "violet";
  children: React.ReactNode;
}) {
  const accentClass = {
    cyan: "border-cyan-400 text-cyan-600 dark:text-cyan-300",
    blue: "border-blue-500 text-blue-600 dark:text-blue-300",
    indigo: "border-indigo-500 text-indigo-600 dark:text-indigo-300",
    violet: "border-violet-500 text-violet-600 dark:text-violet-300"
  }[accent];

  return (
    <section className="border-b p-5 lg:border-b-0 lg:border-r last:lg:border-r-0">
      <h2 className={cn("mb-3 border-l-4 pl-3 text-xs font-bold uppercase tracking-wide", accentClass)}>{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  strong,
  success,
  danger
}: {
  label: string;
  value: string;
  strong?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span
        dir="auto"
        className={cn(
          "text-right text-foreground",
          strong && "font-semibold text-cyan-600 dark:text-cyan-300",
          success && "font-semibold text-emerald-600",
          danger && "font-semibold text-rose-500"
        )}
      >
        {value || "-"}
      </span>
    </div>
  );
}`;

const newInfoSection = `function InfoPanel({
  title,
  accent,
  children
}: {
  title: string;
  accent: "cyan" | "blue" | "indigo" | "violet";
  children: React.ReactNode;
}) {
  const lang = useActiveLanguage();
  const accentClass = {
    cyan: "border-cyan-400 text-cyan-600 dark:text-cyan-300",
    blue: "border-blue-500 text-blue-600 dark:text-blue-300",
    indigo: "border-indigo-500 text-indigo-600 dark:text-indigo-300",
    violet: "border-violet-500 text-violet-600 dark:text-violet-300"
  }[accent];

  return (
    <section className="border-b p-5 lg:border-b-0 lg:border-r last:lg:border-r-0">
      <h2 className={cn("mb-3 border-l-4 pl-3 text-xs font-bold uppercase tracking-wide", accentClass)}>
        {translateHeader(lang, title)}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  strong,
  success,
  danger
}: {
  label: string;
  value: string;
  strong?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  const lang = useActiveLanguage();
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-xs">
      <span className="text-muted-foreground">{translateHeader(lang, label)}:</span>
      <span
        dir="auto"
        className={cn(
          "text-right text-foreground",
          strong && "font-semibold text-cyan-600 dark:text-cyan-300",
          success && "font-semibold text-emerald-600",
          danger && "font-semibold text-rose-500"
        )}
      >
        {value || "-"}
      </span>
    </div>
  );
}`;

content = content.replace(oldInfoSection, newInfoSection);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated new-ledger-dashboard.tsx with language hooks");
