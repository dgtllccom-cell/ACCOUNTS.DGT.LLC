import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Shipment & Container Auto-Tracking" };

export default async function TrackingPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const lang = await getRequestLanguage();
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <CanonicalShipmentTrackingView
        domain="both"
        initialShipmentId={id || null}
        title={t(lang, "cst.portal_title", "Shipment & Container Auto-Tracking Portal")}
        description={t(lang, "cst.portal_desc", "Unified tracking across all transport modes: Search by Shipment No, BL No, Container No, Vessel, Voyage, Customer, or Shipping Line.")}
      />
    </div>
  );
}
