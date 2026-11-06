import { PurchaseLoadTracking } from "@/features/purchases/components/purchase-load-tracking";
import { requireErpSession } from "@/lib/auth/session";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Shipment & Container Auto-Tracking" };

export default async function TrackingPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; purchaseLaneId?: string }>;
}) {
  const { id, purchaseLaneId } = await searchParams;
  const lang = await getRequestLanguage();
  const session = await requireErpSession();
  const canReadLoads = hasRolePermission(session, "purchases", "read") || hasRolePermission(session, "purchase_logistics", "read");
  return (
    <div className="p-3 sm:p-5">
      {canReadLoads && <PurchaseLoadTracking laneId={purchaseLaneId} />}
      <CanonicalShipmentTrackingView
        domain="both"
        initialShipmentId={id || null}
        title={t(lang, "cst.portal_title", "Container & Vessel Tracking")}
        description={t(lang, "cst.portal_desc", "Track shipments, containers and vessels in real-time with complete journey details.")}
      />
    </div>
  );
}
