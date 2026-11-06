import { buildBillPayment } from "@/lib/services/purchase-loading-payment-service";
import { parseJsonish } from "@/lib/stock-journal/model";

type Row = Record<string, any>;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const isLocalFinalBill = (row: Row) => Boolean(row.is_local_purchase || row.order_type === "local_purchase" || row.local_purchase_id);

/** Read-only presentation of saved purchase totals. Never allocates or posts money. */
export function finalPaymentReconciliation(row: Row, due?: Row) {
  const local = isLocalFinalBill(row);
  const form = (parseJsonish(row.form_data) || {}).form || {};
  const authoritative = local ? null : (due || buildBillPayment(row, [], []));
  // Local Purchase's API paid_amount/balance_amount are POSTED-payment aggregates.
  // Its normalized credit_amount is a credit allocation, not an actual payment.
  const total = local ? number(row.final_cost ?? row.purchase_cost ?? row.order_total) : number(authoritative?.billTotal);
  const totalPaid = local ? number(row.paid_amount ?? row.cleared_amount) : number(authoritative?.totalPaid);
  const posted = (Array.isArray(row.payment_entries) ? row.payment_entries : []).filter((entry: Row) => entry.status === "posted");
  const localKindPaid = (kind: string) => posted.filter((entry: Row) => entry.kind === kind).reduce((sum: number, entry: Row) => sum + number(entry.amount), 0);
  const advancePaid = local ? (posted.length ? localKindPaid("advance") : Math.min(totalPaid, number(row.advance_amount))) : number(authoritative?.advancePaid);
  const remainingPaid = local ? (posted.length ? localKindPaid("remaining") : Math.max(0, totalPaid - advancePaid)) : number(authoritative?.remainingPaid);
  const outstanding = local ? number(row.balance_amount ?? Math.max(0, total - totalPaid)) : number(authoritative?.outstanding);
  const loadings: Row[] = local ? [] : Array.isArray(due?.loadings) ? due.loadings : [];
  const completed = [...new Map(loadings.filter(entry => entry.id && entry.complete === true && number(entry.value) > 0 && number(entry.outstanding) <= 0.05).map(entry => [String(entry.id), entry])).values()];
  return {
    id: String(row.id), local, billNo: String(row.purchase_order_no || row.bill_no || row.order_no || "—"),
    supplier: String(due?.supplier || row.supplier_name || form.supplierName || "—"),
    date: String(row.order_date || form.orderDate || row.created_at || "").slice(0, 10),
    branch: String(row.branch_name || form.branchCode || "—"),
    currency: String(local ? row.local_currency || row.currency_code || "" : authoritative?.currency || row.purchase_currency || row.currency_code || "").toUpperCase(),
    total, advancePaid, afterAdvance: Math.max(0, total - advancePaid), remainingPaid,
    totalPaid, outstanding, completed,
  };
}
