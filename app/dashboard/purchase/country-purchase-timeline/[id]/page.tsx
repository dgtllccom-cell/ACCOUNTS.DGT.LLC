import { CountryPurchaseTimelineView } from "@/features/purchases/components/country-purchase-timeline-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Country Purchase Timeline" };


export const dynamic = "force-dynamic";

export default async function CountryPurchaseTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  await requireErpSession();
  const { id } = await params;
  return <CountryPurchaseTimelineView purchaseOrderId={id} />;
}
