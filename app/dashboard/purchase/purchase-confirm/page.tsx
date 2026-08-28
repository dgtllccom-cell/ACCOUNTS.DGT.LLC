import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";

export const metadata = { title: "Purchase — Purchase Confirm" };


export const dynamic = "force-dynamic";

export default function PurchaseConfirmPage() {
  return (
    <PurchaseModuleWorkspace
      title="Booking Confirm"
      description="Review booking-confirmed purchase orders with invoice, account, goods, payment, and transfer status in the approved spreadsheet dashboard layout."
    />
  );
}
