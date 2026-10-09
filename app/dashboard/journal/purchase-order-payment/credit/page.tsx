export const dynamic = "force-dynamic";

import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";

export const metadata = { title: "Journal — Purchase Order Payment — Credit" };

export default function PurchaseOrderCreditPaymentPage() {
  return <PurchaseOrderPaymentJournal mode="credit" />;
}

