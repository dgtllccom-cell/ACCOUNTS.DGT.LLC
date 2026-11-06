import { PurchaseLoadTracking } from "@/features/purchases/components/purchase-load-tracking";
import { requireErpSession } from "@/lib/auth/session";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";

export const metadata = { title: "Shipping Line — Container & Vessel Auto-Tracking" };

export default async function ShippingLineTrackingPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; purchaseLaneId?: string; status?: string; tab?: string; q?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const session = await requireErpSession();
  const canReadLoads = hasRolePermission(session, "purchases", "read") || hasRolePermission(session, "purchase_logistics", "read");
  return (
    <div className="p-3 sm:p-5">
      {canReadLoads && <PurchaseLoadTracking laneId={params.purchaseLaneId} />}
      <CanonicalShipmentTrackingView
        domain="shipping"
        initialShipmentId={params.id || null}
        initialStatus={params.status || "all"}
        initialTab={(params.tab as any) || "all"}
        initialQuery={params.q || ""}
      />
    </div>
  );
}
