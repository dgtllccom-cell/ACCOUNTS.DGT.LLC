import { Metadata } from "next";
import { t } from "@/lib/i18n/ui";
import { requireErpSession } from "@/lib/auth/session";
import { accessibleCategories } from "@/lib/reports/center-nav";
import { defaultDomain } from "@/lib/reports/center-register";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { ReportsCenterNav } from "@/features/reports/components/reports-center-nav";
import { ReportsCenterPage } from "@/features/reports/components/reports-center-page";
import { SuperAdminReportView } from "@/features/reports/components/super-admin-report-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `${t("en", "rc.nav.super_admin", "Super Admin Reports")} — ERP Global`,
  description: "Global ERP reports with shared filters, KPI summaries, and table controls."
};

// the same Reports Center as /dashboard/reports, opened on the global overview (the route policy keeps this URL Super Admin only)
export default async function SuperAdminReportsPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  const scope = resolveReportScope(session);
  return (
    <div className="w-full px-3 py-4 sm:px-6 lg:px-8">
      <ReportsCenterNav lang={lang} items={accessibleCategories(session)} activeKey="super_admin" />
      <ReportsCenterPage
        lang={lang}
        initialDomain={defaultDomain(session)}
        defaultTab="extra"
        extra={<SuperAdminReportView viewerId={session.userId} viewerName={session.fullName || session.email || "SUPER ADMIN"} viewerRole={scope.level === "global" ? "GLOBAL" : "ADMIN"} />}
        extraLabelKey="tab.overview"
        extraLabelFallback="Global overview"
      />
    </div>
  );
}
