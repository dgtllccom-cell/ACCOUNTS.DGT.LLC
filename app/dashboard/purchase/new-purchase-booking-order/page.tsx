import { Suspense } from "react";
import { PurchaseOrderWizard } from "@/features/purchases/components/purchase-order-wizard.jsx";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — New Purchase Booking Order" };


export const dynamic = "force-dynamic";

export default async function NewPurchaseBookingOrderPage() {
  let session = null;
  try {
    session = await requireErpSession();
  } catch {
    session = null;
  }
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Purchase Booking Order Form...</div>}>
      <PurchaseOrderWizard session={session} />
    </Suspense>
  );
}
