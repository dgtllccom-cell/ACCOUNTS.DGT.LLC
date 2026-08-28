import { Metadata } from "next";
import { DeletedRecordDetailView } from "@/features/audit/components/deleted-record-detail-view";

export const metadata: Metadata = {
  title: "Deleted Record Details",
  description: "Detailed deleted record snapshot, evidence, and version lifecycle"
};

export default async function DeletedRecordDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DeletedRecordDetailView recordId={id} />;
}
