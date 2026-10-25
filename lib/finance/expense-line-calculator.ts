/**
 * ONE calculation for every expense bill row (form, API, tests). Sequence, per row:
 *
 *   Original Amount   = Quantity × Unit Price                       (or the typed amount when no quantity / price)
 *   Converted Amount  = Original × Exchange Rate   (operation "*")   or   Original ÷ Exchange Rate (operation "/")
 *                       — into the country BASE currency; same currency => rate 1, no conversion
 *   Tax (exclusive)   = Converted × Tax %           Final = Converted + Tax
 *   Tax (inclusive)   = Converted − Converted ÷ (1 + Tax %)   Final = Converted   (the price already contains the tax)
 *   Tax (exempt)      = 0                           Final = Converted
 *
 * Where a jurisdiction prescribes a statutory conversion rate for tax, pass `statutoryRate`: the tax is then computed on the
 * ORIGINAL amount at that rate (Original × Tax % × statutoryRate). Nothing else is hard-coded per country.
 *
 * The converted amount is the figure posted to the ledger at exchange rate 1 — it is NEVER converted a second time.
 * Every stage is rounded to the minor unit of the BASE currency so the row figures add up exactly to the bill total.
 */

export type TaxMode = "exclusive" | "inclusive" | "exempt";
export type ConversionOperation = "*" | "/";

export type ExpenseLineInput = {
  qty?: number | null;
  unitPrice?: number | null;
  /** typed original amount; used when qty / unitPrice are not both given */
  amount?: number | null;
  currency: string;
  baseCurrency: string;
  operation?: ConversionOperation | "" | null;
  exchangeRate?: number | null;
  taxMode: TaxMode;
  taxPct?: number | null;
  statutoryRate?: number | null;
};

export type ExpenseLineResult = {
  originalAmount: number;
  currency: string;
  baseCurrency: string;
  operation: ConversionOperation | "";
  exchangeRate: number;
  /** original expressed in the base currency, before tax (DB: final_amount) */
  convertedAmount: number;
  taxMode: TaxMode;
  taxPct: number;
  /** amount the tax was computed on, in the base currency */
  taxBase: number;
  taxAmount: number;
  /** what the row costs in the base currency, tax included (DB: grand_amount) */
  grandAmount: number;
};

export class ExpenseCalcError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "ExpenseCalcError";
  }
}

const THREE_DECIMALS = new Set(["KWD", "BHD", "OMR", "JOD", "TND", "IQD", "LYD"]);
const ZERO_DECIMALS = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XOF", "XAF", "PYG", "RWF", "KMF", "GNF", "DJF", "BIF", "VUV", "XPF"]);

export function currencyDecimals(currency: string): number {
  const c = String(currency || "").trim().toUpperCase();
  return THREE_DECIMALS.has(c) ? 3 : ZERO_DECIMALS.has(c) ? 0 : 2;
}

export function roundMoney(value: number, currency: string): number {
  const d = currencyDecimals(currency);
  const f = 10 ** d;
  // toPrecision(15) removes binary noise (1.005 * 100 = 100.49999999999999) before rounding half away from zero
  const scaled = Number((Math.abs(value) * f).toPrecision(15));
  return (Math.sign(value) * Math.round(scaled)) / f;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function calculateExpenseLine(input: ExpenseLineInput): ExpenseLineResult {
  const currency = String(input.currency || "").trim().toUpperCase();
  const baseCurrency = String(input.baseCurrency || "").trim().toUpperCase();
  if (!baseCurrency) throw new ExpenseCalcError("The base currency of the selected branch / country is not configured.", "NO_BASE_CURRENCY");
  if (!currency) throw new ExpenseCalcError("A currency is required on every row.", "NO_CURRENCY");

  const qty = num(input.qty);
  const unit = num(input.unitPrice);
  const originalRaw = qty > 0 && unit > 0 ? qty * unit : num(input.amount);
  if (!(originalRaw > 0)) throw new ExpenseCalcError("The row amount must be greater than zero.", "ZERO_AMOUNT");
  const originalAmount = roundMoney(originalRaw, currency);

  let operation: ConversionOperation | "" = "";
  let exchangeRate = 1;
  let convertedAmount = originalAmount;
  if (currency !== baseCurrency) {
    const rate = num(input.exchangeRate);
    if (!(rate > 0)) throw new ExpenseCalcError(`An exchange rate (${currency} → ${baseCurrency}) is required for a row in ${currency}.`, "NO_RATE");
    operation = input.operation === "/" ? "/" : "*";
    exchangeRate = rate;
    convertedAmount = roundMoney(operation === "*" ? originalAmount * rate : originalAmount / rate, baseCurrency);
  }

  const taxMode: TaxMode = input.taxMode === "inclusive" || input.taxMode === "exempt" ? input.taxMode : "exclusive";
  const pct = taxMode === "exempt" ? 0 : num(input.taxPct);
  if (pct < 0 || pct > 100) throw new ExpenseCalcError("The tax rate must be between 0 and 100.", "BAD_TAX_RATE");

  let taxBase = convertedAmount;
  let taxAmount = 0;
  let grandAmount = convertedAmount;
  if (taxMode === "exclusive" && pct > 0) {
    const statutory = num(input.statutoryRate);
    taxAmount = roundMoney(statutory > 0 && currency !== baseCurrency ? originalAmount * (pct / 100) * statutory : convertedAmount * (pct / 100), baseCurrency);
    grandAmount = roundMoney(convertedAmount + taxAmount, baseCurrency);
  } else if (taxMode === "inclusive" && pct > 0) {
    taxBase = roundMoney(convertedAmount / (1 + pct / 100), baseCurrency);
    taxAmount = roundMoney(convertedAmount - taxBase, baseCurrency);
    grandAmount = convertedAmount;
  }

  return { originalAmount, currency, baseCurrency, operation, exchangeRate, convertedAmount, taxMode, taxPct: pct, taxBase, taxAmount, grandAmount };
}

/** Bill total in the base currency = the sum of the (already rounded) row grand amounts. */
export function sumGrand(results: readonly Pick<ExpenseLineResult, "grandAmount" | "baseCurrency">[]): { total: number; baseCurrency: string } {
  const baseCurrency = results[0]?.baseCurrency ?? "";
  const total = results.reduce((s, r) => s + r.grandAmount, 0);
  return { total: roundMoney(total, baseCurrency), baseCurrency };
}
