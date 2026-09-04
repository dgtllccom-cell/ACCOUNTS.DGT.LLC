import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Purchase — Purchase Order Tracking" };


export const dynamic = "force-dynamic";

export default async function PurchaseOrderTrackingPage() {
  const lang = await getRequestLanguage();
  return (
    <PurchaseModuleWorkspace
      title="Purchase Order Tracking"
      displayTitle={t(lang, "pmw.po_tracking_title", "Purchase Order Tracking")}
      description={t(lang, "pmw.po_tracking_desc", "Track purchase order creation, journal posting, payments, loading, shipping documents, finalization, and stock entry from one workflow.")}
    />
  );
}
