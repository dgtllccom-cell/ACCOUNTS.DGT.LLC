import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { accessibleCategories } from "@/lib/reports/center-nav";
import { sessionReportDomains } from "@/lib/reports/report-access";
import { ReportPanel } from "@/features/reports/components/report-panel";
import { ReportsCenterNav } from "@/features/reports/components/reports-center-nav";
import { ReportsCenterPage } from "@/features/reports/components/reports-center-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shipping & Clearing Reports — ERP",
  description: "Shipping line, clearing agent, container tracking, and customs cargo reports."
};

export default async function ShippingReportsPage() {
  const session = await requireErpSession();
  const scope = resolveReportScope(session);
  const lang = session.preferredLanguage ?? "en";
  const domains = sessionReportDomains(session);
  return (
    <div className="w-full px-3 py-4 sm:px-6 lg:px-8">
      <ReportsCenterNav lang={lang} items={accessibleCategories(session)} activeKey="shipping" />
      <ReportsCenterPage
        lang={lang}
        initialDomain={domains.shipping ? "shipping" : undefined}
        titleKey="title_shipping"
        titleFallback="Shipping & Clearing Reports"
        extraLabelKey="tab.detailed_shipping"
        extraLabelFallback="Detailed shipping reports"
        // the real scope level (a Country Admin is Country level - it used to be shown as Branch)
        extra={<ReportPanel lang={lang} initialScopeLevel={scope.level} viewerName={session.fullName || session.email || "ERP User"} viewerId={session.userId} />}
      />
    </div>
  );
}
