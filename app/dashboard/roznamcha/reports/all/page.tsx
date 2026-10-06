import { Suspense } from "react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { RoznamchaTypeReportView } from "@/features/roznamcha/components/roznamcha-type-report-view";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Roznamcha — Reports — All" };


export default async function AllRoznamchaTypeReportPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">{t(lang, "roz.loading_all_report", "Loading All Roznamcha Report...")}</div>}>
      <RoznamchaTypeReportView lang={lang} pageTitle="All Roznamcha Report" entryCategory="all" />
    </Suspense>
  );
}
