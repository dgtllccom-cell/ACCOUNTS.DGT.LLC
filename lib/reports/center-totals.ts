/**
 * Pure helpers of the Reports Center register: the row shape, the report-type catalogue and the CURRENCY-SAFE totals.
 *
 * Money is never added across currencies: every total is grouped by (report type, currency) and each figure keeps its own currency code.
 * A row without a currency or an amount (a Shipping order carries no financial figure) is counted but never summed.
 */

export type CenterDomain = "business" | "shipping";

export type CenterRow = {
  /** stable key of the register row (table + id) */
  key: string;
  serial: number;
  date: string;
  domain: CenterDomain;
  /** one of CENTER_TYPES[].key */
  type: string;
  entryNo: string;
  referenceNo: string;
  /** supplier / customer / party the record is about (empty when the record has none) */
  party: string;
  countryName: string;
  branchName: string;
  userName: string;
  currency: string;
  /** the record's own amount in `currency`; null when the record has no amount */
  amount: number | null;
  /** what is still to pay on the record, same currency (null when not applicable) */
  balance: number | null;
  status: string;
  /** whether the row's amount belongs in the totals (a cancelled / reversed voucher does not) */
  counted: boolean;
  /** Shipping-specific columns (empty for Business rows) */
  blNumber: string;
  container: string;
  truck: string;
  shipment: string;
  clearingStatus: string;
  /** where View reads the full record from */
  source: { table: string; id: string };
};

export type CenterType = { key: string; domain: CenterDomain; labelKey: string; fallback: string };

export const CENTER_TYPES: readonly CenterType[] = [
  { key: "purchase_booking", domain: "business", labelKey: "rc.type.purchase_booking", fallback: "Purchase Booking" },
  { key: "local_purchase", domain: "business", labelKey: "rc.type.local_purchase", fallback: "Local Purchase" },
  { key: "sales_booking", domain: "business", labelKey: "rc.type.sales_booking", fallback: "Sales Booking" },
  { key: "local_sales", domain: "business", labelKey: "rc.type.local_sales", fallback: "Local Sales" },
  { key: "advance_payment", domain: "business", labelKey: "rc.type.advance_payment", fallback: "Advance Payment" },
  { key: "remaining_payment", domain: "business", labelKey: "rc.type.remaining_payment", fallback: "Remaining Payment" },
  { key: "final_payment", domain: "business", labelKey: "rc.type.final_payment", fallback: "Final / Credit Payment" },
  { key: "cash_entry", domain: "business", labelKey: "rc.type.cash_entry", fallback: "Cash Entry" },
  { key: "bank_entry", domain: "business", labelKey: "rc.type.bank_entry", fallback: "Bank Entry" },
  { key: "journal_entry", domain: "business", labelKey: "rc.type.journal_entry", fallback: "Journal Entry" },
  { key: "shipping_order", domain: "shipping", labelKey: "rc.type.shipping_order", fallback: "Shipping Order" },
  { key: "clearing_bill", domain: "shipping", labelKey: "rc.type.clearing_bill", fallback: "Clearing / Payment Bill" },
  { key: "customer_bill", domain: "shipping", labelKey: "rc.type.customer_bill", fallback: "Customer Bill" },
  { key: "shipping_payment", domain: "shipping", labelKey: "rc.type.shipping_payment", fallback: "Shipping Payment (Receipt)" }
] as const;

export const centerTypesOf = (domain: CenterDomain) => CENTER_TYPES.filter((t) => t.domain === domain);

export type CenterTotal = { type: string; currency: string; count: number; amount: number; balance: number };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Totals per (type, currency). Rows with no amount/currency add to `countsByType` only. Never converts, never mixes currencies. */
export function totalsByCurrency(rows: readonly Pick<CenterRow, "type" | "currency" | "amount" | "balance" | "counted">[]): CenterTotal[] {
  const map = new Map<string, CenterTotal>();
  for (const r of rows) {
    if (!r.counted || r.amount == null || !r.currency) continue;
    const key = `${r.type}|${r.currency.toUpperCase()}`;
    const t = map.get(key) ?? { type: r.type, currency: r.currency.toUpperCase(), count: 0, amount: 0, balance: 0 };
    t.count += 1;
    t.amount += r.amount;
    t.balance += r.balance ?? 0;
    map.set(key, t);
  }
  return [...map.values()].map((t) => ({ ...t, amount: round2(t.amount), balance: round2(t.balance) })).sort((a, b) => a.currency.localeCompare(b.currency) || a.type.localeCompare(b.type));
}

/** The grand total per currency over every counted row (the KPI strip). */
export function grandTotalsByCurrency(rows: readonly Pick<CenterRow, "currency" | "amount" | "balance" | "counted">[]): Array<{ currency: string; count: number; amount: number; balance: number }> {
  const map = new Map<string, { currency: string; count: number; amount: number; balance: number }>();
  for (const r of rows) {
    if (!r.counted || r.amount == null || !r.currency) continue;
    const c = r.currency.toUpperCase();
    const t = map.get(c) ?? { currency: c, count: 0, amount: 0, balance: 0 };
    t.count += 1;
    t.amount += r.amount;
    t.balance += r.balance ?? 0;
    map.set(c, t);
  }
  return [...map.values()].map((t) => ({ ...t, amount: round2(t.amount), balance: round2(t.balance) })).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function countsByType(rows: readonly Pick<CenterRow, "type">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.type] = (out[r.type] ?? 0) + 1;
  return out;
}

/** The purchase-currency total of a purchase order. order_total is stored in the LOCAL currency, total_goods_original / total_goods_usd in the purchase currency. */
export function purchaseTotalInOrderCurrency(po: { total_goods_original?: unknown; total_goods_usd?: unknown; order_total?: unknown; exchange_rate?: unknown; currency_code?: unknown; base_currency?: unknown }): number {
  const orig = Number(po.total_goods_original);
  if (Number.isFinite(orig) && orig > 0) return orig;
  const usd = Number(po.total_goods_usd);
  if (Number.isFinite(usd) && usd > 0 && String(po.currency_code ?? "").toUpperCase() === "USD") return usd;
  const total = Number(po.order_total) || 0;
  const rate = Number(po.exchange_rate) || 0;
  return rate > 1 ? total / rate : total;
}
