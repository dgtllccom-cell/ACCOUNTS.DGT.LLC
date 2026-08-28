import { Suspense } from "react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { BankRoznamchaReportView } from "@/features/roznamcha/components/bank-roznamcha-report-view";

export const metadata = { title: "Roznamcha — Reports — Bank" };


export default async function BankRoznamchaReportPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Bank Roznamcha Report...</div>}>
      <BankRoznamchaReportView lang={lang} pageTitle="Bank Roznamcha Report" />
    </Suspense>
  );
}
