import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { SuperAdminReportView } from "@/features/reports/components/super-admin-report-view";

export const metadata: Metadata = {
  title: "Super Admin Reports — ERP Global",
  description: "Global ERP reports with shared filters, KPI summaries, and table controls."
};

export default async function ReportsPage() {
  const session = await requireErpSession();
  const scope = resolveReportScope(session);

  return (
    <SuperAdminReportView
      viewerId={session.userId}
      viewerName={session.fullName || session.email || "SUPER ADMIN"}
      viewerRole={session.isSuperAdmin ? "GLOBAL" : (scope.level === "global" ? "GLOBAL" : "ADMIN")}
    />
  );
}

