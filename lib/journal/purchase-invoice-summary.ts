/** Read-only invoice projection. Never feeds the payment POST or its limits. */
type Row = Record<string, any>;
const number = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = Number(String(value).replace(/,/g, ''));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
};
const positive = (...values: unknown[]) => {
  for (const value of values) { const n = number(value); if (n != null && n > 0) return n; }
  return null;
};
const currency = (...values: unknown[]) => {
  for (const value of values) {
    const code = String(value ?? '').trim().toUpperCase().match(/^[A-Z]{3}(?=$|\s|[-–])/);
    if (code) return code[0];
  }
  return '';
};
const json = (value: any): Row => {
  if (typeof value !== 'string') return value ?? {};
  try { return JSON.parse(value); } catch { return {}; }
};
const round = (n: number | null) => n == null ? null : Math.round((n + Number.EPSILON) * 100) / 100;
const sumKnown = (values: (number | null)[]) => values.some(v => v == null) ? null : values.reduce<number>((s,v) => s + v!, 0);

export type InvoicePayment = {
  id: string;
  date: string;
  purchase: number | null;
  final: number | null;
  rate: number | null;
  paymentCurrency: string;
};
export type PurchaseInvoiceSummary = {
  purchaseCurrency: string;
  finalCurrency: string;
  invoiceRate: number | null;
  invoice: { purchase: number | null; final: number | null };
  paid: { purchase: number | null; final: number | null };
  remaining: { purchase: number | null; final: number | null };
  payments: InvoicePayment[];
};

export function isActualInvoicePayment(row: Row): boolean {
  return !row.deleted_at && String(row.status ?? '').toLowerCase() === 'posted' &&
    ['advance', 'endorsement', 'remaining', 'credit', 'final', 'payment'].includes(String(row.kind ?? '').toLowerCase());
}

export function purchaseInvoiceSummary(row: Row, savedPayments: Row[] | null, finalCurrencyHint = '', historyComplete = true): PurchaseInvoiceSummary {
  const data = json(row.form_data);
  const form = data.form ?? {};
  const totals = data.totals ?? {};
  const goods: Row[] = Array.isArray(data.goodsEntries) ? data.goodsEntries : [];
  const local = row.order_type === 'local_purchase' || row.is_local_purchase || !!row.local_purchase_id;
  const purchaseCurrency = currency(form.currencyType, form.pricingCurrency, goods[0]?.currencyType, goods[0]?.pricingCurrency, row.purchase_currency, row.currency_code, form.currency);
  const finalCurrency = currency(form.secondaryCurrency, form.finalCurrency, form.branchCurrency, row.final_currency, row.local_currency, row.base_currency, row.countries?.currency_code, form.baseCurrency, finalCurrencyHint);
  const same = !!purchaseCurrency && purchaseCurrency === finalCurrency;
  const invoiceRate = same ? 1 : positive(row.exchange_rate, form.exchangeRate);
  const goodsOriginal = goods.length && goods.every(g => number(g.totalAmount, g.amount) != null)
    ? goods.reduce((s,g) => s + number(g.totalAmount, g.amount)!, 0) : null;
  // order_total / grandFinal are CONVERTED values in the saved booking contract.
  // total_goods_original / grandPrimaryFinal / goods.totalAmount are purchase amounts.
  // The Local Purchase adapter copies final_cost into its synthetic goods/form
  // totals. Only purchase_cost is an original amount there; never convert the
  // synthetic final total a second time.
  let purchase = local ? number(row.purchase_cost) :
    positive(row.total_goods_original, totals.grandPrimaryFinal, goodsOriginal, form.totalAmount) ??
    number(row.total_goods_original, totals.grandPrimaryFinal, goodsOriginal, form.totalAmount);
  const storedFinal = number(local ? row.final_cost : row.order_total, totals.grandFinal);
  if (purchase == null || (purchase === 0 && (storedFinal ?? 0) > 0)) {
    purchase = storedFinal != null && invoiceRate != null ? storedFinal / invoiceRate : null;
  }
  const invoiceFinal = purchase != null && invoiceRate != null ? purchase * invoiceRate : storedFinal;

  const seen = new Set<string>();
  const payments = (savedPayments ?? []).filter(isActualInvoicePayment).filter(p => {
    const identity = String(p.id || p.roznamcha_entry_id || '');
    if (!identity) return true;
    if (seen.has(identity)) return false;
    seen.add(identity); return true;
  }).sort((a,b) => String(a.entry_date || a.created_at || '').localeCompare(String(b.entry_date || b.created_at || ''))).map((p, index): InvoicePayment => {
    const amount = number(p.amount);
    const paymentCurrency = currency(p.currency_code);
    const rate = same && paymentCurrency === purchaseCurrency ? 1 : positive(p.exchange_rate);
    const inPurchase = !!purchaseCurrency && paymentCurrency === purchaseCurrency;
    const inFinal = !!finalCurrency && paymentCurrency === finalCurrency;
    return {
      id: String(p.id || `payment-${index}`), date: String(p.entry_date || p.created_at || '').slice(0,10),
      purchase: inPurchase ? amount : inFinal && amount != null && rate != null ? amount / rate : null,
      final: inFinal ? amount : inPurchase && amount != null && rate != null ? amount * rate : null,
      rate, paymentCurrency,
    };
  });
  // A legacy aggregate is not another payment. If history is missing, don't invent its currency or rate.
  const historicalGap = savedPayments == null || !historyComplete ||
    (payments.length === 0 && positive(row.advance_paid, row.remaining_paid, row.paid_amount) != null);
  const paidPurchase = historicalGap ? null : sumKnown(payments.map(p => p.purchase));
  const paidFinal = historicalGap ? null : sumKnown(payments.map(p => p.final));
  const remaining = purchase == null || paidPurchase == null ? null : round(Math.max(0, purchase - paidPurchase));
  return {
    purchaseCurrency, finalCurrency, invoiceRate,
    invoice: { purchase: round(purchase), final: round(invoiceFinal) },
    paid: { purchase: round(paidPurchase), final: round(paidFinal) },
    remaining: { purchase: round(remaining), final: round(remaining != null && invoiceRate != null ? remaining * invoiceRate : null) },
    payments,
  };
}
