import { getRequestLanguage } from "@/lib/i18n/server";
import { AstraJournalReportView } from "@/features/reports/journal-report/astra-journal-report-view";

export default async function BranchLedgerPage() {
  const lang = await getRequestLanguage();
  return <AstraJournalReportView lang={lang} scope="city" />;
}
