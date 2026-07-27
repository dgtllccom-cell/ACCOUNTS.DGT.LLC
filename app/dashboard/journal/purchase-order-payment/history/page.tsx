import { Suspense } from "react";
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";

export default function PurchaseOrderPaymentHistoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Payment History Journal...</div>}>
      <PurchaseOrderPaymentJournal mode="history" />
    </Suspense>
  );
}
