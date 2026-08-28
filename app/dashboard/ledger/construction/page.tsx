import { getRequestLanguage } from "@/lib/i18n/server";
import { AstraJournalReportView } from "@/features/reports/journal-report/astra-journal-report-view";

export const metadata = { title: "Ledger — Construction" };


export default async function ConstructionJournalReportPage() {
  const lang = await getRequestLanguage();
  return <AstraJournalReportView lang={lang} scope="construction" />;
}
