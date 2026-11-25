type RecordData = Record<string, any>;

function record(value: unknown): RecordData {
  if (typeof value === "string") {
    try { return record(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordData : {};
}

function amount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function salesPaymentTransferReport(order: RecordData, payments?: RecordData[]) {
  const data = record(order.form_data);
  const form = record(data.form);
  const verification = record(data.transferVerification);
  const trace: RecordData = {
    ...record(data.transferTrace),
    voucherNo: data.transferTrace?.voucherNo || verification.voucherNo,
    roznamchaEntryId: data.transferTrace?.roznamchaEntryId || verification.journalId,
    lines: data.transferTrace?.lines ?? null,
  };
  const workflow = record(data.workflow);
  const settlement = record(trace.settlement);
  const originalCurrency: string | undefined = settlement.originalCurrency || form.salesCurrency || order.original_currency_code;
  const finalCurrency: string | undefined = String(settlement.finalCurrency || order.currency_code || "").toUpperCase() || undefined;
  const originalAmount = amount(settlement.originalAmount ?? order.total_goods_original);
  const finalAmount = amount(settlement.finalAmount ?? order.order_total);
  const rate = amount(settlement.exchangeRate ?? form.exchangeRate ?? order.exchange_rate);
  const operator = settlement.operator || (form.operator === "/" ? "/" : "*");
  const factor = originalCurrency && originalCurrency === finalCurrency ? 1
    : rate && rate > 0 ? operator === "/" ? 1 / rate : rate : null;
  // Existing order balances follow the original-sales-amount convention. Prefer
  // the receipt rows when available and the original transfer payment can be excluded.
  const historicalPaid = amount(order.paid_amount);
  const fallbackReceived = historicalPaid === 0 ? 0
    : factor != null && historicalPaid != null ? historicalPaid * factor : null;
  const receipts = payments && (trace.paymentId || trace.roznamchaEntryId) ? payments.filter(payment =>
    payment.status === "posted" && payment.id !== trace.paymentId && payment.payment_kind !== "booking"
    && (!trace.roznamchaEntryId || payment.roznamcha_entry_id !== trace.roznamchaEntryId)
    && (!payment.journal_status || payment.journal_status === "posted")
    && (!payment.operational_domain || payment.operational_domain === "business")
    && !payment.journal_deleted_at) : undefined;
  const fromReceipt = (payment: RecordData) => String(payment.currency_code || "").toUpperCase() === finalCurrency
    ? amount(payment.amount) : amount(payment.base_currency_amount);
  const sumReceipts = (rows: RecordData[]) => {
    const values = rows.map(fromReceipt);
    return values.some(value => value == null) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  };
  const summary = order.transferReceiptSummary;
  const received = receipts ? sumReceipts(receipts) : summary ? amount(summary.received) : fallbackReceived;
  const advance = receipts ? sumReceipts(receipts.filter(p => p.payment_kind === "advance")) : amount(summary?.advance);
  const remaining = finalAmount != null && received != null ? Math.max(0, finalAmount - received) : null;
  const method = form.paymentMethodName || form.paymentMethod;
  const storedCondition = form.paymentCondition || form.paymentTerms || form.paymentType || workflow.paymentRouteLabel;
  const condition = advance != null && advance > 0 && remaining != null && remaining > 0 && /credit/i.test(storedCondition || "")
    ? "Partial Advance + Credit" : storedCondition;
  const items = Array.isArray(data.goodsEntries) && data.goodsEntries.length ? data.goodsEntries.map(record) : [form];
  return { data, form, trace, originalCurrency, finalCurrency, originalAmount, finalAmount, rate, operator,
    received, advance, remaining, method, condition, items, transferredAt: trace.transferredAt || workflow.transferredAt,
    reference: trace.referenceNo || workflow.referenceNo };
}
