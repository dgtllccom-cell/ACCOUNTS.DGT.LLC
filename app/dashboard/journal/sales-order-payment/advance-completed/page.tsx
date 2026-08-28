import { SalesOrderPaymentJournal } from "@/features/journal/components/sales-order-payment-journal";

export const metadata = { title: "Journal — Sales Order Payment — Advance Completed" };


export default function SalesOrderAdvanceCompletedPaymentPage() {
  return <SalesOrderPaymentJournal mode="advance_completed" />;
}
