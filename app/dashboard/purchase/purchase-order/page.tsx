import { PurchaseOrderManagementDashboard } from "@/features/purchases/components/purchase-order-management-dashboard";

export const metadata = { title: "Purchase — Purchase Order" };


export const dynamic = "force-dynamic";

export default function PurchaseOrderPage() {
  return <PurchaseOrderManagementDashboard />;
}
