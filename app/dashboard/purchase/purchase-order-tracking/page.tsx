import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";

export const metadata = { title: "Purchase — Purchase Order Tracking" };


export const dynamic = "force-dynamic";

export default function PurchaseOrderTrackingPage() {
  return (
    <PurchaseModuleWorkspace
      title="Purchase Order Tracking"
      description="Track purchase order creation, journal posting, payments, loading, shipping documents, finalization, and stock entry from one workflow."
    />
  );
}
