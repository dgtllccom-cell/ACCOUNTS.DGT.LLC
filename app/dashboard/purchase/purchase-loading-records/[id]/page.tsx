import { PurchaseLoadingRecordDetailsView } from "@/features/purchases/components/purchase-loading-record-details-view";
import { requireErpSession } from "@/lib/auth/session";
import { Suspense } from "react";

export default async function PurchaseLoadingRecordDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireErpSession();
  const { id } = await params;
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center text-muted-foreground">Loading details...</div>}>
      <PurchaseLoadingRecordDetailsView recordId={id} />
    </Suspense>
  );
}
