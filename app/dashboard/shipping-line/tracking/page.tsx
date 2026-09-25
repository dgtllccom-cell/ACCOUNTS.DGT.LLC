import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";

export const metadata = { title: "Shipping Line — Container & Vessel Auto-Tracking" };

export default async function ShippingLineTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <div className="p-3 sm:p-5">
      <CanonicalShipmentTrackingView
        domain="shipping"
        initialShipmentId={id || null}
        title="Container & Vessel Tracking"
        description="Track shipments, containers and vessels in real-time with complete journey details."
      />
    </div>
  );
}
