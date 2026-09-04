import { Suspense } from "react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { RoznamchaTypeReportView } from "@/features/roznamcha/components/roznamcha-type-report-view";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Roznamcha — Reports — Transfer" };


export default async function TransferRoznamchaReportPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">{t(lang, "roz.loading_transfer_report", "Loading Transfer Roznamcha Report...")}</div>}>
      <RoznamchaTypeReportView lang={lang} pageTitle="Transfer Roznamcha Report" entryCategory="transfer" />
    </Suspense>
  );
}
