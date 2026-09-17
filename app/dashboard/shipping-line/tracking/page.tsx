import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";

export const metadata = { title: "Shipping Line — Container & Vessel Auto-Tracking" };

export default async function ShippingLineTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <CanonicalShipmentTrackingView
        domain="shipping"
        initialShipmentId={id || null}
        title="Shipping Line & Container Auto-Tracker"
        description="Monitor vessel departures, transshipment, port arrivals, container discharges, and multi-leg customer cargo."
      />
    </div>
  );
}
