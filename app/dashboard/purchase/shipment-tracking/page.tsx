import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";

export const metadata = { title: "Purchase — Shipment & Container Cargo Tracking" };

export default async function BusinessShipmentTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <CanonicalShipmentTrackingView
        domain="business"
        initialShipmentId={id || null}
        title="Business Cargo & Container Tracking"
        description="Track physical movement of purchased goods, containers, and vessel routes across domestic and international transit."
      />
    </div>
  );
}
