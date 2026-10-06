import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Purchase — Finalized Purchase Orders" };


export const dynamic = "force-dynamic";

export default async function FinalizedPurchaseOrdersPage() {
  const lang = await getRequestLanguage();
  return (
    <PurchaseModuleWorkspace
      title="Finalized Purchase Orders"
      displayTitle={t(lang, "pmw.finalized_po_title", "Finalized Purchase Orders")}
      description={t(lang, "pmw.finalized_po_desc", "Closed purchase orders with final payment, shipping documents, arrival confirmation, and inventory entry status.")}
    />
  );
}
