import { PurchaseOrderWizard } from "@/features/purchases/components/purchase-order-wizard.jsx";
import { requireErpSession } from "@/lib/auth/session";

export default async function NewPurchaseBookingOrderPage() {
  const session = await requireErpSession();
  return <PurchaseOrderWizard session={session} />;
}
