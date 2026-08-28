import { Suspense } from "react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { RoznamchaTypeReportView } from "@/features/roznamcha/components/roznamcha-type-report-view";

export const metadata = { title: "Roznamcha — Reports — Cash Entry" };


export default async function CashEntryRoznamchaReportPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Cash Entry Report...</div>}>
      <RoznamchaTypeReportView lang={lang} pageTitle="Cash Entry Report" entryCategory="cash" />
    </Suspense>
  );
}
