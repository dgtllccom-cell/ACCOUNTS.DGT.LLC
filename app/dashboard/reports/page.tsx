import { Metadata } from "next";
import { t } from "@/lib/i18n/ui";
import { requireErpSession } from "@/lib/auth/session";
import { accessibleCategories } from "@/lib/reports/center-nav";
import { defaultDomain } from "@/lib/reports/center-register";
import { ReportsCenterNav } from "@/features/reports/components/reports-center-nav";
import { ReportsCenterPage } from "@/features/reports/components/reports-center-page";
import { SuperAdminReportView } from "@/features/reports/components/super-admin-report-view";
import { resolveReportScope } from "@/lib/permissions/middleware";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `${t("en", "rc.title", "Reports Center")} — ERP`,
  description: "One role-aware register of the saved Business and Shipping Line records you are authorized to see."
};

export default async function ReportsPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  const scope = resolveReportScope(session);
  // the global overview stays available to the Super Admin, as a tab beside the register (never duplicated)
  const globalOverview = session.isSuperAdmin || session.roles.includes("super_admin_reports");
  return (
    <div className="w-full px-3 py-4 sm:px-6 lg:px-8">
      <ReportsCenterNav lang={lang} items={accessibleCategories(session)} activeKey="center" />
      <ReportsCenterPage
        lang={lang}
        initialDomain={defaultDomain(session)}
        extra={globalOverview ? <SuperAdminReportView viewerId={session.userId} viewerName={session.fullName || session.email || "SUPER ADMIN"} viewerRole={scope.level === "global" ? "GLOBAL" : "ADMIN"} /> : undefined}
        extraLabelKey="tab.overview"
        extraLabelFallback="Global overview"
      />
    </div>
  );
}
