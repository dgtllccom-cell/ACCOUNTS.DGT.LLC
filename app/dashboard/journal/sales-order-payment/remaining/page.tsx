import { SalesOrderPaymentJournal } from "@/features/journal/components/sales-order-payment-journal";

export const metadata = { title: "Journal — Sales Order Payment — Remaining" };

const isUuid = (value: unknown): value is string => typeof value === "string" && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);

export default async function SalesOrderRemainingPaymentPage({ searchParams }: {
  searchParams: Promise<{ orderId?: string; invoiceId?: string }>;
}) {
  const { orderId, invoiceId } = await searchParams;
  const invoiceReceipt = isUuid(orderId) && isUuid(invoiceId) ? { orderId, invoiceId } : undefined;
  return <SalesOrderPaymentJournal mode="remaining" invoiceReceipt={invoiceReceipt} />;
}
