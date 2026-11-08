import { PurchaseLoadTracking } from "@/features/purchases/components/purchase-load-tracking";
import { requireErpSession } from "@/lib/auth/session";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Purchase — Shipment & Container Cargo Tracking" };

export default async function BusinessShipmentTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; purchaseLaneId?: string }>;
}) {
  const { id, purchaseLaneId } = await searchParams;
  const lang = await getRequestLanguage();
  const session = await requireErpSession();
  const canReadLoads = hasRolePermission(session, "purchases", "read") || hasRolePermission(session, "purchase_logistics", "read");
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {canReadLoads && <PurchaseLoadTracking laneId={purchaseLaneId} />}
      <CanonicalShipmentTrackingView
        domain="business"
        initialShipmentId={id || null}
        title={t(lang, "cst.business_title", "Business Cargo & Container Tracking")}
        description={t(lang, "cst.business_desc", "Track physical movement of purchased goods, containers, and vessel routes across domestic and international transit.")}
      />
    </div>
  );
}
