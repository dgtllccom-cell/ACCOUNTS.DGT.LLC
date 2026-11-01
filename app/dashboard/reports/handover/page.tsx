import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/ui";
import { accessibleCategories } from "@/lib/reports/center-nav";
import { ReportsCenterNav } from "@/features/reports/components/reports-center-nav";
import { HandoverReportView } from "@/features/reports/components/handover-report-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `${t("en", "rc.nav.handover", "Handover & Journal PDF Report")} — ERP` };

export default async function HandoverReportPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  // the operational handover report is for everyone with report access; the access register / credential references / system documentation are privileged
  return (
    <div className="w-full">
      <div className="px-3 pt-3 sm:px-6"><ReportsCenterNav lang={lang} items={accessibleCategories(session)} activeKey="handover" /></div>
      <HandoverReportView privileged={session.isSuperAdmin} />
    </div>
  );
}
