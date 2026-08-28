import { SalesOrderPaymentJournal } from "@/features/journal/components/sales-order-payment-journal";

export const metadata = { title: "Journal — Sales Order Payment — Remaining" };


export default function SalesOrderRemainingPaymentPage() {
  return <SalesOrderPaymentJournal mode="remaining" />;
}
