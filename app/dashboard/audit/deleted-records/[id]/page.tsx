import { redirect } from "next/navigation";

export const metadata = { title: "Redirecting — Deleted Record" };

export default async function DeletedRecordDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/super-admin/deleted-records/${id}`);
}
