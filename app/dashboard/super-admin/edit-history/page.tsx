import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { accessibleCategories } from "@/lib/reports/center-nav";
import { ReportsCenterNav } from "@/features/reports/components/reports-center-nav";
import { EditHistoryV21LocalView } from "@/features/audit/components/edit-history-v21-local-view";

export const metadata: Metadata = {
  title: "All Edit & Version History",
  description: "Enterprise audit control, version history timeline, and before/after comparisons"
};

export default async function SuperAdminEditHistoryPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login?redirectTo=/dashboard/super-admin/edit-history");
  if (!session.isSuperAdmin) redirect("/dashboard");
  return (
    <div className="w-full">
      <div className="px-3 pt-3 sm:px-6"><ReportsCenterNav lang={session.preferredLanguage ?? "en"} items={accessibleCategories(session)} activeKey="edit_history" /></div>
      <EditHistoryV21LocalView />
    </div>
  );
}
