import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";

export const metadata = { title: "Shipping Line — Container & Vessel Auto-Tracking" };

export default async function ShippingLineTrackingPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; status?: string; tab?: string; q?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  return (
    <div className="p-3 sm:p-5">
      <CanonicalShipmentTrackingView
        domain="shipping"
        initialShipmentId={params.id || null}
        initialStatus={params.status || "all"}
        initialTab={(params.tab as any) || "all"}
        initialQuery={params.q || ""}
        title="Container & Vessel Tracking"
        description="Track shipments, containers and vessels in real-time with complete journey details."
      />
    </div>
  );
}
