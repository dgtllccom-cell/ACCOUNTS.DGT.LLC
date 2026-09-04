import { Suspense } from "react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { AllRoznamchaReportView } from "@/features/roznamcha/components/all-roznamcha-report-view";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Roznamcha — All" };


export default async function AllRoznamchaPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">{t(lang, "roz.loading_roznamcha_report", "Loading Roznamcha Report...")}</div>}>
      <AllRoznamchaReportView lang={lang} />
    </Suspense>
  );
}
