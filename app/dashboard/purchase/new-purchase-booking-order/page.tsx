import { Suspense } from "react";
import { PurchaseOrderWizard } from "@/features/purchases/components/purchase-order-wizard.jsx";
import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewPurchaseBookingOrderPage() {
  const session = await requireErpSession().catch(() => null);
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Purchase Booking Order Form...</div>}>
      <PurchaseOrderWizard session={session} />
    </Suspense>
  );
}
