import { getRequestLanguage } from "@/lib/i18n/server";
import { AllRoznamchaReportView } from "@/features/roznamcha/components/all-roznamcha-report-view";

export default async function AllRoznamchaPage() {
  const lang = await getRequestLanguage();
  return <AllRoznamchaReportView lang={lang} />;
}
