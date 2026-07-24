import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { LedgerReportView } from "@/features/reports/ledger-report/components/ledger-general-report-view";

export default async function SuperAdminLedgerReportPage() {
  const lang = await getRequestLanguage();
  return (
    <LedgerReportView
      lang={lang}
      reportScope="super_admin"
      pageTitle={t(lang, "nav.super_admin_ledger_report")}
    />
  );
}
