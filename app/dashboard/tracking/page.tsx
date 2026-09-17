import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";

export const metadata = { title: "Shipment & Container Auto-Tracking" };

export default async function TrackingPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <CanonicalShipmentTrackingView
        domain="both"
        initialShipmentId={id || null}
        title="Shipment & Container Auto-Tracking Portal"
        description="Unified tracking across all transport modes: Search by Shipment No, BL No, Container No, Vessel, Voyage, Customer, or Shipping Line."
      />
    </div>
  );
}
