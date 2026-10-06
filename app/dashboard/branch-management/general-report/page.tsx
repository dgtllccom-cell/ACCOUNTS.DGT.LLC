import { BranchGeneralReportView } from "@/features/branch-management/components/branch-general-report-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Branch Management — General Report" };


export default async function BranchGeneralReportPage() {
  const lang = await getRequestLanguage();

  return (
    <BranchGeneralReportView
      title={t(lang, "nav.branch_general_report")}
      subtitle="Super Admin → Countries → Main Branches → City Branches"
    />
  );
}
