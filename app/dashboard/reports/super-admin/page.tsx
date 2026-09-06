import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { SuperAdminReportView } from "@/features/reports/components/super-admin-report-view";

export const metadata: Metadata = {
  title: "Super Admin Reports — ERP Global",
  description: "Access complete global reports across all countries, branches, currencies, and users."
};

export default async function SuperAdminReportsPage() {
  const session = await requireErpSession();
  const scope = resolveReportScope(session);

  // Only super admins can access this page
  if (scope.level !== "global") {
    redirect("/dashboard/reports");
  }

  return (
    <SuperAdminReportView
      viewerId={session.userId}
      viewerName={session.fullName || session.email || "SUPER ADMIN"}
      viewerRole={session.isSuperAdmin ? "GLOBAL" : "ADMIN"}
    />
  );
}
