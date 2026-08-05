import { Suspense } from "react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { RoznamchaTypeReportView } from "@/features/roznamcha/components/roznamcha-type-report-view";

export default async function BankRoznamchaReportPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Bank Roznamcha Report...</div>}>
      <RoznamchaTypeReportView lang={lang} pageTitle="Bank Roznamcha Report" entryCategory="bank" />
    </Suspense>
  );
}
