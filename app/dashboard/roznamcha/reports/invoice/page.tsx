import { Suspense } from "react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { RoznamchaTypeReportView } from "@/features/roznamcha/components/roznamcha-type-report-view";

export const metadata = { title: "Roznamcha — Reports — Invoice" };


export default async function InvoiceRoznamchaReportPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Invoice Roznamcha Report...</div>}>
      <RoznamchaTypeReportView lang={lang} pageTitle="Invoice Roznamcha Report" entryCategory="invoice" />
    </Suspense>
  );
}
