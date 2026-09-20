import { CanonicalShipmentTrackingView } from "@/features/shipping/components/canonical-shipment-tracking-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Purchase — Shipment & Container Cargo Tracking" };

export default async function BusinessShipmentTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const lang = await getRequestLanguage();
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <CanonicalShipmentTrackingView
        domain="business"
        initialShipmentId={id || null}
        title={t(lang, "cst.business_title", "Business Cargo & Container Tracking")}
        description={t(lang, "cst.business_desc", "Track physical movement of purchased goods, containers, and vessel routes across domestic and international transit.")}
      />
    </div>
  );
}
