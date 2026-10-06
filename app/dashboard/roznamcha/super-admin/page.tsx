import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { SuperAdminRoznamchaReportView } from "@/features/roznamcha/components/super-admin-roznamcha-report-view";

export const metadata = { title: "Roznamcha — Super Admin" };


export default async function SuperAdminRoznamchaPage() {
  const lang = await getRequestLanguage();
  return (
    <SuperAdminRoznamchaReportView
      lang={lang}
      pageTitle={t(lang, "roz.mgmt_title", "Roznamcha Management")}
      typeFilter="super_admin"
    />
  );
}
