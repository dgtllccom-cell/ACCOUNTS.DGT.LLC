import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";

export default function FinalizedPurchaseOrdersPage() {
  return (
    <PurchaseModuleWorkspace
      title="Finalized Purchase Orders"
      description="Closed purchase orders with final payment, shipping documents, arrival confirmation, and inventory entry status."
    />
  );
}
