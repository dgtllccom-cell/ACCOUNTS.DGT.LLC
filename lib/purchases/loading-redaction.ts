/**
 * Loading / Transit & Lane are OPERATIONAL screens. A login that may not see financial amounts (Operations Admin, Shipping Line
 * roles, or a user with the field-level permission finance_amounts:deny) still needs quantities, BL, containers, trucks and
 * routes — but never purchase prices, payables, exchange rates or the booking's payment state.
 *
 * `redactLoadingRecord` keeps the operational payload and removes every financial field, recursively inside the booking JSON.
 */

const FINANCIAL_COLUMNS = [
  "loaded_purchase_amount", "loaded_advance_amount", "purchase_currency", "exchange_rate", "loaded_purchase_local", "loaded_advance_local",
  "payment_made", "remaining_loading_balance", "local_currency", "posted_to_journal", "journal_entry_id", "journal_posted_at",
  "transport_expense_amount", "transport_expense_currency",
];

/** Keys that carry money anywhere inside report_payload / purchase_orders.form_data. */
const FINANCIAL_KEY = /(price|amount|rate|total|balance|advance|currency|payable|payment|credit|debit|cost|charge|expense|invoice|paid|due|ledger|account|bank|grand|final|commission|margin|profit)/i;
/** Operational keys that merely CONTAIN a financial word and must survive (e.g. quantity totals, container counts, weights). */
const OPERATIONAL_KEEP = /^(totalQuantity|totalContainers|totalGrossWeight|totalNetWeight|loadedQuantity|remainingQuantity|totalWeight|containerCount|loadedContainers|remainingContainers|accountNumber)$/;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!OPERATIONAL_KEEP.test(k) && FINANCIAL_KEY.test(k)) continue;
      out[k] = scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function redactLoadingRecord<T extends Record<string, any>>(record: T): T {
  const out: Record<string, unknown> = { ...record };
  for (const c of FINANCIAL_COLUMNS) delete out[c];
  if (out.report_payload) out.report_payload = scrub(out.report_payload);
  if (out.purchase_orders && typeof out.purchase_orders === "object") {
    const po = out.purchase_orders as Record<string, unknown>;
    out.purchase_orders = {
      form_data: scrub(po.form_data),
      // the booking's money state is not operational
      advance_paid: undefined, remaining_due: undefined, order_total: undefined, purchase_order_payments: undefined,
    };
  }
  return out as T;
}

export function redactLoadingRecords<T extends Record<string, unknown>>(records: T[], canViewFinancials: boolean): T[] {
  return canViewFinancials ? records : records.map((r) => redactLoadingRecord(r));
}

/**
 * Generic financial redaction for any operational record (BL, shipment, order): removes the named money columns and scrubs
 * money keys from the given JSON payload columns. Used wherever a login without financial field access receives records.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function redactFinancialFields<T extends Record<string, any>>(records: T[], canViewFinancials: boolean, columns: readonly string[], payloadColumns: readonly string[] = []): T[] {
  if (canViewFinancials) return records;
  return records.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const c of columns) delete out[c];
    for (const c of payloadColumns) if (out[c]) out[c] = scrub(out[c]);
    return out as T;
  });
}
