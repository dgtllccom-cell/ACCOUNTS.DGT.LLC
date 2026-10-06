import { SalesOrderPaymentJournal } from "@/features/journal/components/sales-order-payment-journal";

export const metadata = { title: "Journal — Sales Order Payment — Charges" };


export default function SalesOrderChargesPaymentPage() {
  return <SalesOrderPaymentJournal mode="charges" />;
}
