import { ShippingLineStagePage } from "@/features/shipping/components/shipping-line-stage-page";

export default function ShipmentDetailsPage() {
  return (
    <ShippingLineStagePage
      title="Shipment Details"
      eyebrow="Shipping Line / Shipment Stage"
      description="Enter shipping line, vessel, voyage, container, port, ETA and ETD details for shipment tracking."
      activeStage="shipment"
    />
  );
}
