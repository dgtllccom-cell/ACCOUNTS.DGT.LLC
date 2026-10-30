/**
 * Sales Booking — goods line + currency rules, pure (no UI, no database) so the wizard, the review step and the server share them.
 *
 * The line formula is the Purchase Booking one (`calculateItemTotals` in the Purchase wizard), so a Sales and a Purchase booking of the same
 * goods give the same amounts:
 *   gross  = quantity × KG per unit
 *   net    = typed Net KG, else gross − quantity × empty KG
 *   amount = net ÷ divide weight × price rate                     (invoice currency)
 *   final  = amount × exchange rate   (or ÷ rate when the operator is "/")  (settlement currency)
 *
 * Unlike the old Sales form, a rate is NEVER invented: when the invoice and settlement currencies differ a missing, zero or negative rate
 * is reported (`rate.ok === false`) instead of silently using 1.
 */

export type RateOperator = "*" | "/";

export type SalesLineInput = {
  qtyNo?: number | string | null;
  qtyKgs?: number | string | null;
  emptyKgs?: number | string | null;
  /** typed Net KG (optional): when > 0 it replaces gross − empty */
  netWeight?: number | string | null;
  divideWeight?: number | string | null;
  coursePrice?: number | string | null;
  exchangeRate?: number | string | null;
  operator?: RateOperator | string | null;
  invoiceCurrency?: string | null;
  settlementCurrency?: string | null;
  /** a figure the user typed over the calculated one */
  manualTotalAmount?: number | string | null;
  manualFinalAmount?: number | string | null;
};

const num = (v: unknown): number => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const ccy = (c: unknown) => String(c ?? "").trim().toUpperCase();

export type ResolvedRate =
  | { ok: true; rate: number; operator: RateOperator; sameCurrency: boolean }
  | { ok: false; reason: "missing_currency" | "missing_rate"; rate: 0; operator: RateOperator; sameCurrency: false };

/**
 * The rate a line (or the booking) converts with. Same currency → exactly 1 (stated, not defaulted). Different currencies → the typed rate,
 * which must be a positive number.
 */
export function resolveBookingRate(input: Pick<SalesLineInput, "exchangeRate" | "operator" | "invoiceCurrency" | "settlementCurrency">): ResolvedRate {
  const operator: RateOperator = input.operator === "/" ? "/" : "*";
  const invoice = ccy(input.invoiceCurrency);
  const settlement = ccy(input.settlementCurrency);
  if (!invoice || !settlement) return { ok: false, reason: "missing_currency", rate: 0, operator, sameCurrency: false };
  if (invoice === settlement) return { ok: true, rate: 1, operator: "*", sameCurrency: true };
  const rate = num(input.exchangeRate);
  if (!(rate > 0)) return { ok: false, reason: "missing_rate", rate: 0, operator, sameCurrency: false };
  return { ok: true, rate, operator, sameCurrency: false };
}

export type SalesLineTotals = {
  grossWeight: number;
  netWeight: number;
  /** invoice currency */
  totalAmount: number;
  /** settlement currency */
  finalAmount: number;
  rate: ResolvedRate;
};

export function calcSalesLine(line: SalesLineInput): SalesLineTotals {
  const qty = num(line.qtyNo);
  const grossWeight = qty * num(line.qtyKgs);
  const typedNet = num(line.netWeight);
  const netWeight = typedNet > 0 ? typedNet : Math.max(0, grossWeight - qty * num(line.emptyKgs));
  const divide = num(line.divideWeight) > 0 ? num(line.divideWeight) : 1;
  const price = num(line.coursePrice);
  const calculatedAmount = (netWeight / divide) * price;
  const rate = resolveBookingRate(line);
  const calculatedFinal = !rate.ok ? 0 : rate.operator === "/" ? calculatedAmount / rate.rate : calculatedAmount * rate.rate;
  const manualTotal = line.manualTotalAmount !== "" && line.manualTotalAmount != null ? num(line.manualTotalAmount) : null;
  const manualFinal = line.manualFinalAmount !== "" && line.manualFinalAmount != null ? num(line.manualFinalAmount) : null;
  return {
    grossWeight: round(grossWeight),
    netWeight: round(netWeight),
    totalAmount: round(manualTotal ?? calculatedAmount, 2),
    finalAmount: round(manualFinal ?? calculatedFinal, 2),
    rate
  };
}

/** What may still be sold from a stock lot, and whether a requested quantity fits. */
export function stockBalance(input: { availableQty: number; soldQty?: number; requestedQty: number }): {
  remaining: number;
  after: number;
  over: boolean;
  overBy: number;
} {
  const remaining = Math.max(0, round(num(input.availableQty) - Math.max(0, num(input.soldQty)), 4));
  const requested = Math.max(0, num(input.requestedQty));
  const after = round(remaining - requested, 4);
  return { remaining, after, over: requested > remaining + 1e-9, overBy: requested > remaining ? round(requested - remaining, 4) : 0 };
}

export type LineProblem =
  | "goods_name"
  | "quantity"
  | "price"
  | "currency"
  | "rate"
  | "over_stock"
  | "stock_without_balance";

/** Everything that stops a line from being added to the table. Empty array = ready. */
export function salesLineProblems(
  line: SalesLineInput & { goodsName?: string | null; stockLinked?: boolean; stockRemaining?: number | null }
): LineProblem[] {
  const problems: LineProblem[] = [];
  if (!String(line.goodsName ?? "").trim()) problems.push("goods_name");
  if (!(num(line.qtyNo) > 0)) problems.push("quantity");
  if (!(num(line.coursePrice) > 0)) problems.push("price");
  const rate = resolveBookingRate(line);
  if (!rate.ok) problems.push(rate.reason === "missing_currency" ? "currency" : "rate");
  if (line.stockLinked) {
    if (line.stockRemaining == null || !Number.isFinite(Number(line.stockRemaining))) problems.push("stock_without_balance");
    else if (num(line.qtyNo) > Number(line.stockRemaining) + 1e-9) problems.push("over_stock");
  }
  return problems;
}

/**
 * Daily Exchange Rate (USD per branch) → a suggestion for a booking's currency pair. The daily table is USD-based, so a suggestion exists only
 * when the pair is USD ↔ the branch's local currency; every other pair must be typed.
 */
export type DailyRateInfo = { buyRate?: number | null; sellRate?: number | null; creditRate?: number | null; debitRate?: number | null; effectiveDate?: string | null; source?: string | null };
export function suggestDailyRate(
  daily: DailyRateInfo | null | undefined,
  invoiceCurrency: string,
  settlementCurrency: string,
  localCurrency: string
): { rate: number; operator: RateOperator; effectiveDate: string | null } | null {
  if (!daily || daily.source !== "daily_usd_rates") return null;
  const base = num(daily.buyRate) > 0 ? num(daily.buyRate) : num(daily.sellRate) > 0 ? num(daily.sellRate) : 0;
  if (!(base > 0)) return null;
  const inv = ccy(invoiceCurrency), set = ccy(settlementCurrency), local = ccy(localCurrency);
  if (!local || inv === set) return null;
  if (inv === "USD" && set === local) return { rate: base, operator: "*", effectiveDate: daily.effectiveDate ?? null };
  if (inv === local && set === "USD") return { rate: base, operator: "/", effectiveDate: daily.effectiveDate ?? null };
  return null;
}
