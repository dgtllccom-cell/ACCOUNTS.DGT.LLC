import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { AllEditVersionHistoryView } from "@/features/audit/components/all-edit-version-history-view";

export const metadata: Metadata = {
  title: "All Edit & Version History",
  description: "Enterprise audit control, version history timeline, and before/after comparisons"
};

export default async function SuperAdminEditHistoryPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login?redirectTo=/dashboard/super-admin/edit-history");
  if (!session.isSuperAdmin) redirect("/dashboard");
  return <AllEditVersionHistoryView />;
}
