export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";

export const metadata = { title: "Journal — Purchase Order Payment — Advance" };


export default function PurchaseOrderAdvancePaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-500">Loading Purchase Advance Payment Journal...</div>}>
      <PurchaseOrderPaymentJournal mode="advance" />
    </Suspense>
  );
}
