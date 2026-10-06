import { getRequestLanguage } from "@/lib/i18n/server";
import { AstraJournalReportView } from "@/features/reports/journal-report/astra-journal-report-view";

export const metadata = { title: "Country Ledger" };


export default async function CountryLedgerPage() {
  const lang = await getRequestLanguage();
  return <AstraJournalReportView lang={lang} scope="country" />;
}
