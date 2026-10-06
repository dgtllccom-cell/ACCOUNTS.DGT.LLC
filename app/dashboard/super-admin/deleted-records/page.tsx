import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { AllDeletedRecordsView } from "@/features/audit/components/all-deleted-records-view";

export const metadata: Metadata = {
  title: "All Deleted Records Control",
  description: "Complete deletion monitoring, approval evidence, and recoverable record history"
};

export default async function SuperAdminDeletedRecordsPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login?redirectTo=/dashboard/super-admin/deleted-records");
  if (!session.isSuperAdmin) redirect("/dashboard");
  return <AllDeletedRecordsView />;
}
