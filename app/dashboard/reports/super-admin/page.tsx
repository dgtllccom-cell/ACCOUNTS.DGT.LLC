import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { ReportPanel } from "@/features/reports/components/report-panel";

export const metadata: Metadata = {
  title: "Super Admin Reports — ERP Global Dashboard",
  description: "Access complete global reports across all countries, branches, currencies, and users."
};

export default async function SuperAdminReportsPage() {
  const session = await requireErpSession();
  const scope = resolveReportScope(session);

  // Only super admins can access this page
  if (scope.level !== "global") {
    redirect("/dashboard/reports");
  }

  const lang = session.preferredLanguage ?? "en";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <ReportPanel
          lang={lang}
          initialScopeLevel="global"
          workspace="super-admin"
          viewerId={session.userId}
          viewerName={session.fullName || session.email || undefined}
        />
      </div>
    </div>
  );
}
