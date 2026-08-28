import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";

export const metadata = { title: "Journal — Final Payments — Advance Nil" };


export default function AdvancePaymentNilReceiptPage() {
  return <PurchaseOrderPaymentJournal mode="advance_completed" />;
}
