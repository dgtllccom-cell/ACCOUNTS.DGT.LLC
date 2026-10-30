import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { CountryAdminReportsView } from "@/features/reports/components/country-admin-reports-view";

export const metadata: Metadata = {
  title: "Country Admin Reports — ERP",
  description: "Country-level reports for all branches and transactions within your assigned country."
};

export default async function CountryReportsPage() {
  const session = await requireErpSession();
  const scope = resolveReportScope(session);
  const lang = session.preferredLanguage ?? "en";

  return (
    <div className="min-h-screen w-full bg-slate-50/50 dark:bg-background text-foreground animate-in fade-in duration-200">
      <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
        <CountryAdminReportsView
          lang={lang}
          initialScopeLevel={scope.level === "global" ? "global" : "country"}
          viewerName={session.fullName || session.email || "Country Admin"}
          viewerId={session.userId}
        />
      </div>
    </div>
  );
}
