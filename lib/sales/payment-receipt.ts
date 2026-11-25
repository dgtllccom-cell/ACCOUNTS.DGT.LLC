import { isLocalSalesFormData } from "@/lib/sales/local-sales-source";

export type SalesPaymentReceipt = {
  orderId: string; number: string; date: string; bill: string; customer: string; local: boolean;
  amount: number; currency: string; method: "cash" | "bank" | null; reference: string;
};

/** Only issued journals can produce a customer copy; a booking transfer is not money received. */
export function issuedSalesPaymentReceipt(order: {
  id?: unknown; sales_order_no?: unknown; customer_name?: unknown; form_data?: any;
}, payment: {
  payment_kind?: unknown; payment_date?: unknown; status?: unknown; amount?: unknown; currency_code?: unknown;
}, journal: {
  status?: unknown; voucher_no?: unknown; super_admin_serial_number?: unknown; source_reference_no?: unknown;
  entry_category?: unknown; deleted_at?: unknown;
} | null | undefined): SalesPaymentReceipt | null {
  if (!journal || journal.deleted_at || journal.status !== "posted" || payment.status !== "posted" || payment.payment_kind === "booking") return null;
  const clean = (v: unknown) => String(v ?? "").trim();
  const number = clean(journal.voucher_no) || clean(journal.super_admin_serial_number);
  const bill = clean(order.sales_order_no);
  const currency = clean(payment.currency_code).toUpperCase();
  const amount = Number(payment.amount);
  const date = payment.payment_date instanceof Date && Number.isFinite(payment.payment_date.getTime())
    ? payment.payment_date.toISOString().slice(0, 10) : clean(payment.payment_date).slice(0, 10);
  if (!number || !bill || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const form = order.form_data?.form ?? {};
  const customer = clean(form.customerAccountName || form.customerName || form.buyerName || order.customer_name);
  const method = journal.entry_category === "cash" ? "cash" : journal.entry_category === "bank" || journal.entry_category === "transfer" ? "bank" : null;
  return { orderId: clean(order.id), number, date, customer, bill, local: isLocalSalesFormData(order.form_data), amount, currency,
    method, reference: clean(journal.source_reference_no) };
}
