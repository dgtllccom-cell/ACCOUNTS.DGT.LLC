import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { LedgerReportView } from "@/features/reports/ledger-report/components/ledger-general-report-view";

export default async function LedgerGeneralReportPage({
  searchParams
}: {
  searchParams?: Promise<{ ledgerId?: string; fromDate?: string; toDate?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;

  return (
    <LedgerReportView
      lang={lang}
      reportScope="super_admin"
      pageTitle={t(lang, "nav.ledger_general_report")}
      initialLedgerId={params?.ledgerId ?? null}
      initialFromDate={params?.fromDate ?? null}
      initialToDate={params?.toDate ?? null}
    />
  );
}
