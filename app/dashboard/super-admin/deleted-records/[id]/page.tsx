import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { DeletedRecordDetailView } from "@/features/audit/components/deleted-record-detail-view";

export const metadata: Metadata = {
  title: "Deleted Record Details",
  description: "Detailed deleted record snapshot, evidence, and version lifecycle"
};

export default async function SuperAdminDeletedRecordDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login?redirectTo=/dashboard/super-admin/deleted-records");
  if (!session.isSuperAdmin) redirect("/dashboard");
  const { id } = await params;
  return <DeletedRecordDetailView recordId={id} />;
}
