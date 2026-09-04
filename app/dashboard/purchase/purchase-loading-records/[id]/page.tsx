import { PurchaseLoadingRecordDetailsView } from "@/features/purchases/components/purchase-loading-record-details-view";
import { requireErpSession } from "@/lib/auth/session";
import { Suspense } from "react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Purchase — Purchase Loading Records" };


export default async function PurchaseLoadingRecordDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireErpSession();
  const { id } = await params;
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center text-muted-foreground">{t(lang, "common.loading_details", "Loading details...")}</div>}>
      <PurchaseLoadingRecordDetailsView recordId={id} />
    </Suspense>
  );
}
