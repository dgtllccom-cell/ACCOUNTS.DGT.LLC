import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { ReportPanel } from "@/features/reports/components/report-panel";

export const metadata: Metadata = {
  title: "Country Reports — ERP",
  description: "Country-level reports for all branches within your assigned country."
};

export default async function CountryReportsPage() {
  const session = await requireErpSession();
  const scope = resolveReportScope(session);

  // Super admins should use the super-admin panel
  if (scope.level === "global") {
    redirect("/dashboard/reports/super-admin");
  }

  // Branch-level users should use the branch panel
  if (scope.level === "branch") {
    redirect("/dashboard/reports/branch");
  }

  const lang = session.preferredLanguage ?? "en";

  return (
    <div className="min-h-screen w-full bg-slate-50/50 dark:bg-background text-foreground animate-in fade-in duration-200">
      <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
        <ReportPanel lang={lang} initialScopeLevel="country" />
      </div>
    </div>
  );
}
