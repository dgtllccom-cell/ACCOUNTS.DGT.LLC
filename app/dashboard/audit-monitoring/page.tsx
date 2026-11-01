import { Metadata } from "next";
import { forbidden } from "next/navigation";
import { requireErpSession } from "@/lib/auth/session";
import { canReadAudit } from "@/lib/reports/report-access";
import { accessibleCategories } from "@/lib/reports/center-nav";
import { ReportsCenterNav } from "@/features/reports/components/reports-center-nav";
import { EnterpriseAuditMonitoringDashboard } from "@/features/audit/components/enterprise-audit-monitoring-dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Enterprise Audit & Monitoring Center",
  description: "Comprehensive multi-country edit version timelines, deleted records vault, and daily branch monitoring."
};

export default async function AuditMonitoringPage() {
  const session = await requireErpSession();
  // audit evidence is for audit-eligible roles only - checked here as well as by the route policy and by every audit API
  if (!canReadAudit(session)) forbidden();
  return (
    <div className="w-full">
      <div className="px-3 pt-3 sm:px-6"><ReportsCenterNav lang={session.preferredLanguage ?? "en"} items={accessibleCategories(session)} activeKey="audit" /></div>
      <EnterpriseAuditMonitoringDashboard />
    </div>
  );
}
