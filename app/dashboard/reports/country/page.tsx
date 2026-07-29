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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <ReportPanel lang={lang} initialScopeLevel="country" />
      </div>
    </div>
  );
}
