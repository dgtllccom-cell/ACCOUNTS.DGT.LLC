import { ShippingLineStagePage } from "@/features/shipping/components/shipping-line-stage-page";

export default function ShipmentReportPage() {
  return (
    <ShippingLineStagePage
      title="Shipment Report"
      eyebrow="Shipping Line / Shipment Report"
      description="Shipment report for B/L numbers, vessels, voyages, containers, goods, shipper, consignee and dates."
      activeStage="report"
    />
  );
}
