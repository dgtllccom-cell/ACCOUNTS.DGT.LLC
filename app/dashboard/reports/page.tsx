import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { ReportPanel } from "@/features/reports/components/report-panel";

export const metadata: Metadata = {
  title: "ERP Reports",
  description: "Scoped ERP reports with shared filters, summaries, and table controls."
};

export default async function ReportsPage() {
  const session = await requireErpSession();
  const scope = resolveReportScope(session);
  const lang = session.preferredLanguage ?? "en";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <ReportPanel
          lang={lang}
          initialScopeLevel={scope.level}
          viewerName={session.fullName || session.email || "ERP User"}
        />
      </div>
    </div>
  );
}
