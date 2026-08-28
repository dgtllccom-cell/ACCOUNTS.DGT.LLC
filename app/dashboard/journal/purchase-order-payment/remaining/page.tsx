import { Suspense } from "react";
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";

export const metadata = { title: "Journal — Purchase Order Payment — Remaining" };


export default function PurchaseOrderRemainingPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Remaining Payment Journal...</div>}>
      <PurchaseOrderPaymentJournal mode="remaining" />
    </Suspense>
  );
}
