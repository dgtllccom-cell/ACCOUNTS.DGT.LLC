import { Suspense } from "react";
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";

export default function PurchaseOrderAdvanceCompletedPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Advance Completed Journal...</div>}>
      <PurchaseOrderPaymentJournal mode="advance_completed" />
    </Suspense>
  );
}
