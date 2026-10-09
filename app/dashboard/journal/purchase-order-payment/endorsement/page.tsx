export const dynamic = "force-dynamic";

import { PurchaseOrderPaymentJournal } from "@/features/journal/components/purchase-order-payment-journal";

export const metadata = { title: "Journal — Purchase Order Payment — Endorsement" };

export default function PurchaseOrderEndorsementPaymentPage() {
  return <PurchaseOrderPaymentJournal mode="endorsement" />;
}

