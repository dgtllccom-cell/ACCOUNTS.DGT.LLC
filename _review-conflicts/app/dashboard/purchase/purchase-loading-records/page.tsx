import { PurchaseLoadingRecordsView } from "@/features/purchases/components/purchase-loading-records-view";
import { requireErpSession } from "@/lib/auth/session";

export default async function PurchaseLoadingRecordsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireErpSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const openRecordId = typeof resolvedParams.openRecordId === "string" ? resolvedParams.openRecordId : undefined;
  return <PurchaseLoadingRecordsView openRecordId={openRecordId} />;
}
