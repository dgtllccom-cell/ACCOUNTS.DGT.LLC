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
    <div className="p-3 sm:p-5">
      <CanonicalShipmentTrackingView
        domain="both"
        initialShipmentId={id || null}
        title={t(lang, "cst.portal_title", "Container & Vessel Tracking")}
        description={t(lang, "cst.portal_desc", "Track shipments, containers and vessels in real-time with complete journey details.")}
      />
    </div>
  );
}
