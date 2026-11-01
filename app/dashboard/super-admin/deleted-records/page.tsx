import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { accessibleCategories } from "@/lib/reports/center-nav";
import { ReportsCenterNav } from "@/features/reports/components/reports-center-nav";
import { AllDeletedRecordsView } from "@/features/audit/components/all-deleted-records-view";

export const metadata: Metadata = {
  title: "All Deleted Records Control",
  description: "Complete deletion monitoring, approval evidence, and recoverable record history"
};

export default async function SuperAdminDeletedRecordsPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login?redirectTo=/dashboard/super-admin/deleted-records");
  if (!session.isSuperAdmin) redirect("/dashboard");
  return (
    <div className="w-full">
      <div className="px-3 pt-3 sm:px-6"><ReportsCenterNav lang={session.preferredLanguage ?? "en"} items={accessibleCategories(session)} activeKey="deleted" /></div>
      <AllDeletedRecordsView />
    </div>
  );
}
