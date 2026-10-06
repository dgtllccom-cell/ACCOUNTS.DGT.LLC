import { SalesOrderPaymentJournal } from "@/features/journal/components/sales-order-payment-journal";

export const metadata = { title: "Journal — Sales Order Payment — History" };


export default function SalesOrderPaymentHistoryPage() {
  return <SalesOrderPaymentJournal mode="history" />;
}
