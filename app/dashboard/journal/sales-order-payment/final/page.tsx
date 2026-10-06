import { SalesOrderPaymentJournal } from "@/features/journal/components/sales-order-payment-journal";

export const metadata = { title: "Journal — Sales Order Payment — Final / Remaining Balance" };

export default function SalesOrderFinalPaymentPage() {
  return <SalesOrderPaymentJournal mode="final" />;
}
