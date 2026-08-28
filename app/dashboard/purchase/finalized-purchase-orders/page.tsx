import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";

export const metadata = { title: "Purchase — Finalized Purchase Orders" };


export const dynamic = "force-dynamic";

export default function FinalizedPurchaseOrdersPage() {
  return (
    <PurchaseModuleWorkspace
      title="Finalized Purchase Orders"
      description="Closed purchase orders with final payment, shipping documents, arrival confirmation, and inventory entry status."
    />
  );
}
