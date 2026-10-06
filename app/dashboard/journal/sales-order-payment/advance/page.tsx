import { SalesOrderPaymentJournal } from "@/features/journal/components/sales-order-payment-journal";

export const metadata = { title: "Journal — Sales Order Payment — Advance" };


export default function SalesOrderAdvancePaymentPage() {
  return <SalesOrderPaymentJournal mode="advance" />;
}
