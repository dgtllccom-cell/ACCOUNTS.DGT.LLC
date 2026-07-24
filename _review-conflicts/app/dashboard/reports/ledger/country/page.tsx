import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { LedgerReportView } from "@/features/reports/ledger-report/components/ledger-general-report-view";

export default async function CountryLedgerReportPage() {
  const lang = await getRequestLanguage();
  return <LedgerReportView lang={lang} reportScope="country" pageTitle={t(lang, "nav.country_ledger_report")} />;
}
