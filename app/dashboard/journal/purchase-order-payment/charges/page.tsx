import { Suspense } from "react";
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";

export const metadata = { title: "Journal — Purchase Order Payment — Charges" };


export default function PurchaseOrderChargesPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Credit / Charges Payment Journal...</div>}>
      <PurchaseOrderPaymentJournal mode="credit" />
    </Suspense>
  );
}
