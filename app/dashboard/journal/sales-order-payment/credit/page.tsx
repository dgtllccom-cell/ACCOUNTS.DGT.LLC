export const dynamic = "force-dynamic";

import { SalesOrderPaymentJournal } from "@/features/journal/components/sales-order-payment-journal";

export const metadata = { title: "Journal — Sales Order Payment — Credit" };

export default function SalesOrderCreditPaymentPage() {
  return <SalesOrderPaymentJournal mode="credit" />;
}

