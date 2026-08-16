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
    <div className="min-h-screen w-full bg-slate-50/50 dark:bg-background text-foreground animate-in fade-in duration-200">
      <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
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
