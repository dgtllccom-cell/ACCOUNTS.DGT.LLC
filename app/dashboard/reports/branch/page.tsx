import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { ReportPanel } from "@/features/reports/components/report-panel";

export const metadata: Metadata = {
  title: "Branch Reports — ERP",
  description: "Branch-level reports restricted to your assigned city branch."
};

export default async function BranchReportsPage() {
  const session = await requireErpSession();
  const scope = resolveReportScope(session);

  // Redirect higher-privilege users to their correct panels
  if (scope.level === "global") {
    redirect("/dashboard/reports/super-admin");
  }
  if (scope.level === "country") {
    redirect("/dashboard/reports/country");
  }

  const lang = session.preferredLanguage ?? "en";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <ReportPanel lang={lang} initialScopeLevel="branch" />
      </div>
    </div>
  );
}
