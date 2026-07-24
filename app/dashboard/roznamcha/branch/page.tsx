import { getRequestLanguage } from "@/lib/i18n/server";
import { SuperAdminRoznamchaReportView } from "@/features/roznamcha/components/super-admin-roznamcha-report-view";

export default async function BranchRoznamchaPage() {
  const lang = await getRequestLanguage();
  return <SuperAdminRoznamchaReportView lang={lang} pageTitle="Roznamcha Management" typeFilter="branch" />;
}
