import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { SuperAdminRoznamchaReportView } from "@/features/roznamcha/components/super-admin-roznamcha-report-view";

export const metadata = { title: "Roznamcha — Branch" };


export default async function BranchRoznamchaPage() {
  const lang = await getRequestLanguage();
  return <SuperAdminRoznamchaReportView lang={lang} pageTitle={t(lang, "roz.mgmt_title", "Roznamcha Management")} typeFilter="branch" />;
}
