import { salesReceiptQueue } from "@/lib/sales/payment-workflow";
import { SalesOrderPaymentJournal } from "@/features/journal/components/sales-order-payment-journal";

export const metadata = { title: "Journal — Sales Order Payment — Advance" };


export default async function SalesOrderAdvancePaymentPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const params = await searchParams;
  return <SalesOrderPaymentJournal mode="advance" receiptQueue={salesReceiptQueue(params.payment)} />;
}
