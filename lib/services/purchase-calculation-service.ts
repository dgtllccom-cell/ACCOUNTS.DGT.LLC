/**
 * purchase-calculation-service.ts
 *
 * Single source of truth for all purchase order financial calculations.
 * Used by both frontend components and backend API routes.
 *
 * Principles:
 * - All calculations are proportional to loaded quantity
 * - Original (foreign) currency and local currency are always tracked separately
 * - Exchange rate is always foreign→local (e.g. 1 USD = 280 PKR)
 * - No ad-hoc inline calculations anywhere else in the codebase
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type PurchaseOrderData = {
  id?: string;
  order_total?: number | null;
  advance_paid?: number | null;
  remaining_paid?: number | null;
  credit_amount?: number | null;
  remaining_due?: number | null;
  currency_code?: string | null;
  exchange_rate?: number | null;
  form_data?: {
    form?: {
      advancePercent?: number | string;
      advanceAmount?: number | string;
      totalAmount?: number | string;
      subTotal?: number | string;
      exchangeRate?: number | string;
      purchaseCurrency?: string;
      pricingCurrency?: string;
      officeCurrency?: string;
      localCurrency?: string;
      [key: string]: unknown;
    };
    goodsEntries?: Array<{
      totalAmount?: number | string;
      amount?: number | string;
      qtyNo?: number | string;
      quantity?: number | string;
      purchaseCurrency?: string;
      pricingCurrency?: string;
      [key: string]: unknown;
    }>;
    totals?: {
      grandPrimaryFinal?: number | string;
      grandFinal?: number | string;
      totalQuantity?: number | string;
      [key: string]: unknown;
    };
    workflow?: {
      totalQuantity?: number | string;
      loadedQuantity?: number | string;
      totalContainers?: number | string;
      loadedContainers?: number | string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

export type PurchaseAmounts = {
  /** Currency of the purchase contract (e.g. "USD") */
  purchaseCurrency: string;
  /** Local/office currency (e.g. "PKR", "AED") */
  localCurrency: string;
  /** Exchange rate: 1 purchaseCurrency = X localCurrency */
  exchangeRate: number;

  /** Total purchase amount in purchase (foreign) currency */
  totalPurchaseFC: number;
  /** Total purchase amount in local currency */
  totalPurchaseLC: number;

  /** Advance percentage */
  advancePercent: number;
  /** Required advance in purchase currency */
  advanceAmountFC: number;
  /** Required advance in local currency */
  advanceAmountLC: number;

  /** Actual advance paid so far (purchase currency) */
  paidAdvanceFC: number;
  /** Actual advance paid so far (local currency) */
  paidAdvanceLC: number;

  /** Remaining advance to pay (purchase currency) */
  remainingAdvanceFC: number;
  /** Remaining advance to pay (local currency) */
  remainingAdvanceLC: number;

  /** Total remaining purchase balance (purchase currency) */
  remainingPurchaseFC: number;
  /** Total remaining purchase balance (local currency) */
  remainingPurchaseLC: number;

  /** Total quantity from goods entries */
  totalQuantity: number;
};

export type LoadingProportions = {
  /** Loaded quantity */
  loadedQuantity: number;
  /** Total quantity */
  totalQuantity: number;
  /** Loading percentage (0-100) */
  loadingPercentage: number;
  /** Remaining quantity */
  remainingQuantity: number;

  /** Proportional purchase value for this loading (FC) */
  loadedPurchaseFC: number;
  /** Proportional purchase value for this loading (LC) */
  loadedPurchaseLC: number;

  /** Proportional advance allocated to this loading (FC) */
  loadedAdvanceFC: number;
  /** Proportional advance allocated to this loading (LC) */
  loadedAdvanceLC: number;

  /** Remaining payment for this loading entry (FC) */
  remainingLoadingFC: number;
  /** Remaining payment for this loading entry (LC) */
  remainingLoadingLC: number;
};

export type PaymentAllocation = {
  /** Amount in the payment currency */
  paymentAmount: number;
  /** Payment currency */
  paymentCurrency: string;
  /** Exchange rate used for this payment */
  exchangeRate: number;
  /** Equivalent amount in local currency */
  localAmount: number;
  /** New remaining balance after this payment (FC) */
  newRemainingFC: number;
  /** New remaining balance after this payment (LC) */
  newRemainingLC: number;
};

export type PurchaseLoadingSummary = {
  totalQuantity: number;
  previousLoadedQuantity: number;
  currentLoadedQuantity: number;
  remainingQuantity: number;
  totalPurchaseFC: number;
  totalPurchaseLC: number;
  paidAmountFC: number;
  paidAmountLC: number;
  remainingAmountFC: number;
  remainingAmountLC: number;
  loadedPurchaseFC: number;
  loadedPurchaseLC: number;
  loadedAdvanceFC: number;
  loadedAdvanceLC: number;
  remainingLoadingFC: number;
  remainingLoadingLC: number;
};

export type PurchaseLoadingEntryInput = {
  goodsName?: unknown;
  quantityNo?: unknown;
  loadedQuantity?: unknown;
  loadingQuantity?: unknown;
  qtyName?: unknown;
  oneQtyKgs?: unknown;
  oneEmptyKgs?: unknown;
  priceType?: unknown;
  priceRateC1?: unknown;
  divideType?: unknown;
  divideWeightValue?: unknown;
  originCountry?: unknown;
  hsCode?: unknown;
  brand?: unknown;
  sizeSpec?: unknown;
  allotName?: unknown;
  qualityReportRef?: unknown;
  pricingCurrency?: unknown;
  exchangeRatePKR?: unknown;
};

export type NormalizedPurchaseLoadingEntry = {
  goodsName: string;
  quantity: number;
  qtyName: string | null;
  oneQtyKgs: number | null;
  oneEmptyKgs: number | null;
  priceType: string | null;
  priceRateC1: number | null;
  divideType: string | null;
  divideWeightValue: number | null;
  originCountry: string | null;
  hsCode: string | null;
  brand: string | null;
  sizeSpec: string | null;
  allotName: string | null;
  qualityReportRef: string | null;
  pricingCurrency: string | null;
  exchangeRatePKR: number | null;
};

export function normalizePurchaseLoadingEntry(entry: PurchaseLoadingEntryInput): NormalizedPurchaseLoadingEntry {
  const goodsName = String(entry.goodsName ?? "").trim();
  const quantity = toNum(entry.quantityNo ?? entry.loadedQuantity ?? entry.loadingQuantity, 0);
  return {
    goodsName,
    quantity,
    qtyName: String(entry.qtyName ?? "").trim() || null,
    oneQtyKgs: toNum(entry.oneQtyKgs, NaN as number) || null,
    oneEmptyKgs: toNum(entry.oneEmptyKgs, NaN as number) || null,
    priceType: String(entry.priceType ?? "").trim() || null,
    priceRateC1: toNum(entry.priceRateC1, NaN as number) || null,
    divideType: String(entry.divideType ?? "").trim() || null,
    divideWeightValue: toNum(entry.divideWeightValue, NaN as number) || null,
    originCountry: String(entry.originCountry ?? "").trim() || null,
    hsCode: String(entry.hsCode ?? "").trim() || null,
    brand: String(entry.brand ?? "").trim() || null,
    sizeSpec: String(entry.sizeSpec ?? "").trim() || null,
    allotName: String(entry.allotName ?? "").trim() || null,
    qualityReportRef: String(entry.qualityReportRef ?? "").trim() || null,
    pricingCurrency: String(entry.pricingCurrency ?? "").trim() || null,
    exchangeRatePKR: toNum(entry.exchangeRatePKR, NaN as number) || null
  };
}

export function validatePurchaseLoadingEntries(input: {
  entryCount: number;
  entries: PurchaseLoadingEntryInput[];
  totalQuantity: number;
  previousLoadedQuantity?: number;
}) {
  const entryCount = Number(input.entryCount);
  const previousLoadedQuantity = Math.max(0, toNum(input.previousLoadedQuantity, 0));
  const totalQuantity = Math.max(0, toNum(input.totalQuantity, 0));
  const normalized = (Array.isArray(input.entries) ? input.entries : []).map((entry) => normalizePurchaseLoadingEntry(entry));
  const validEntries = normalized.filter((entry) => entry.goodsName && entry.quantity > 0);

  if (![1, 2].includes(entryCount)) {
    throw new Error("Entry count must be exactly 1 or 2.");
  }

  if (validEntries.length !== entryCount) {
    throw new Error(`Provide exactly ${entryCount} goods entr${entryCount === 1 ? "y" : "ies"} before submit.`);
  }

  const loadedQuantity = validEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const remainingQuantity = totalQuantity - previousLoadedQuantity - loadedQuantity;

  if (loadedQuantity <= 0) {
    throw new Error("Loading quantity must be greater than zero.");
  }

  if (remainingQuantity < 0) {
    throw new Error("Loaded quantity exceeds the remaining purchase quantity.");
  }

  return {
    entries: validEntries,
    entryCount,
    loadedQuantity,
    remainingQuantity
  };
}

export function resolvePurchaseLoadingSummary(
  order: PurchaseOrderData,
  previousLoadedQuantity = 0,
  currentLoadedQuantity = 0,
  paymentMadeForLoading = 0
): PurchaseLoadingSummary {
  const amounts = resolvePurchaseAmounts(order);
  const prev = Math.max(0, toNum(previousLoadedQuantity, 0));
  const current = Math.max(0, toNum(currentLoadedQuantity, 0));
  const loadedQuantity = Math.min(amounts.totalQuantity, prev + current);
  const proportions = resolveLoadingProportions(amounts, loadedQuantity, amounts.totalQuantity, paymentMadeForLoading);

  return {
    totalQuantity: proportions.totalQuantity,
    previousLoadedQuantity: prev,
    currentLoadedQuantity: current,
    remainingQuantity: proportions.remainingQuantity,
    totalPurchaseFC: amounts.totalPurchaseFC,
    totalPurchaseLC: amounts.totalPurchaseLC,
    paidAmountFC: amounts.paidAdvanceFC,
    paidAmountLC: amounts.paidAdvanceLC,
    remainingAmountFC: amounts.remainingPurchaseFC,
    remainingAmountLC: amounts.remainingPurchaseLC,
    loadedPurchaseFC: proportions.loadedPurchaseFC,
    loadedPurchaseLC: proportions.loadedPurchaseLC,
    loadedAdvanceFC: proportions.loadedAdvanceFC,
    loadedAdvanceLC: proportions.loadedAdvanceLC,
    remainingLoadingFC: proportions.remainingLoadingFC,
    remainingLoadingLC: proportions.remainingLoadingLC
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toNum(val: unknown, fallback = 0): number {
  if (val == null) return fallback;
  const n = Number(String(val).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function getForm(order: PurchaseOrderData) {
  return order.form_data?.form ?? {};
}

function getGoods(order: PurchaseOrderData) {
  return Array.isArray(order.form_data?.goodsEntries) ? order.form_data!.goodsEntries : [];
}

function getTotals(order: PurchaseOrderData) {
  return order.form_data?.totals ?? {};
}

function getWorkflow(order: PurchaseOrderData) {
  return order.form_data?.workflow ?? {};
}

// ─── Core Calculations ─────────────────────────────────────────────────────

/**
 * Resolve all purchase amounts for an order.
 * This is THE single source of truth — used everywhere.
 */
export function resolvePurchaseAmounts(order: PurchaseOrderData): PurchaseAmounts {
  const form = getForm(order);
  const goods = getGoods(order);
  const totals = getTotals(order);
  const workflow = getWorkflow(order);

  // ── Currency identification ──
  const purchaseCurrency = (
    String(goods[0]?.purchaseCurrency || goods[0]?.pricingCurrency || form.purchaseCurrency || form.pricingCurrency || order.currency_code || "USD")
  ).toUpperCase();

  const localCurrency = (
    String(form.officeCurrency || form.localCurrency || "PKR")
  ).toUpperCase();

  // ── Exchange rate ──
  let exchangeRate = toNum(order.exchange_rate || form.exchangeRate, 1);
  if (exchangeRate <= 0) exchangeRate = 1;

  // ── Total Purchase Amount (in purchase/foreign currency) ──
  let totalPurchaseFC = 0;
  if (goods.length > 0) {
    totalPurchaseFC = goods.reduce((sum, g) => sum + toNum(g.totalAmount || g.amount), 0);
  }
  if (totalPurchaseFC <= 0) {
    totalPurchaseFC = toNum(totals.grandPrimaryFinal || form.subTotal || form.totalAmount, 0);
  }
  // Fallback: if order_total is stored but seems to be in local currency, convert back
  if (totalPurchaseFC <= 0) {
    const rawTotal = toNum(order.order_total, 0);
    if (exchangeRate > 1 && rawTotal > 1000000) {
      // Likely stored in local currency
      totalPurchaseFC = rawTotal / exchangeRate;
    } else {
      totalPurchaseFC = rawTotal;
    }
  }

  // ── Total Purchase in Local Currency ──
  const totalPurchaseLC = totalPurchaseFC * exchangeRate;

  // ── Advance Percentage ──
  const advancePercent = toNum(form.advancePercent, 0);

  // ── Required Advance (FC) ──
  let advanceAmountFC = 0;
  if (advancePercent > 0) {
    advanceAmountFC = (totalPurchaseFC * advancePercent) / 100;
  } else {
    const rawAdv = toNum(order.advance_paid || form.advanceAmount, 0);
    // Guard against local-currency value stored in advance_paid
    if (exchangeRate > 1 && rawAdv > totalPurchaseFC * 1.05) {
      advanceAmountFC = rawAdv / exchangeRate;
    } else {
      advanceAmountFC = rawAdv;
    }
  }
  const advanceAmountLC = advanceAmountFC * exchangeRate;

  // ── Paid Advance (FC) ──
  const paidAdvanceFC = toNum(order.advance_paid, 0);
  const paidAdvanceLC = paidAdvanceFC * exchangeRate;

  // ── Remaining Advance ──
  const remainingAdvanceFC = Math.max(0, advanceAmountFC - paidAdvanceFC);
  const remainingAdvanceLC = remainingAdvanceFC * exchangeRate;

  // ── Remaining Purchase Balance ──
  const remainingPurchaseFC = Math.max(0, totalPurchaseFC - paidAdvanceFC);
  const remainingPurchaseLC = remainingPurchaseFC * exchangeRate;

  // ── Total Quantity ──
  let totalQuantity = toNum(workflow.totalQuantity || totals.totalQuantity, 0);
  if (totalQuantity <= 0 && goods.length > 0) {
    totalQuantity = goods.reduce((sum, g) => sum + toNum(g.qtyNo || g.quantity), 0);
  }

  return {
    purchaseCurrency,
    localCurrency,
    exchangeRate,
    totalPurchaseFC,
    totalPurchaseLC,
    advancePercent,
    advanceAmountFC,
    advanceAmountLC,
    paidAdvanceFC,
    paidAdvanceLC,
    remainingAdvanceFC,
    remainingAdvanceLC,
    remainingPurchaseFC,
    remainingPurchaseLC,
    totalQuantity,
  };
}

/**
 * Calculate proportional loading amounts based on loaded quantity.
 *
 * Formula:
 *   loadingPercentage = (loadedQty / totalQty) × 100
 *   loadedPurchaseFC = totalPurchaseFC × loadingPercentage / 100
 *   loadedAdvanceFC = advanceAmountFC × loadingPercentage / 100
 *   remainingLoadingFC = loadedPurchaseFC - paymentMade
 */
export function resolveLoadingProportions(
  amounts: PurchaseAmounts,
  loadedQty: number,
  totalQty?: number,
  paymentMadeForLoading = 0
): LoadingProportions {
  const effectiveTotalQty = totalQty && totalQty > 0 ? totalQty : amounts.totalQuantity;
  
  if (effectiveTotalQty <= 0 || loadedQty <= 0) {
    return {
      loadedQuantity: loadedQty,
      totalQuantity: effectiveTotalQty,
      loadingPercentage: 0,
      remainingQuantity: effectiveTotalQty,
      loadedPurchaseFC: 0,
      loadedPurchaseLC: 0,
      loadedAdvanceFC: 0,
      loadedAdvanceLC: 0,
      remainingLoadingFC: 0,
      remainingLoadingLC: 0,
    };
  }

  const loadingPercentage = Math.min(100, (loadedQty / effectiveTotalQty) * 100);
  const remainingQuantity = Math.max(0, effectiveTotalQty - loadedQty);

  const loadedPurchaseFC = amounts.totalPurchaseFC * (loadingPercentage / 100);
  const loadedPurchaseLC = loadedPurchaseFC * amounts.exchangeRate;

  const loadedAdvanceFC = amounts.advanceAmountFC * (loadingPercentage / 100);
  const loadedAdvanceLC = loadedAdvanceFC * amounts.exchangeRate;

  const remainingLoadingFC = Math.max(0, loadedPurchaseFC - paymentMadeForLoading);
  const remainingLoadingLC = remainingLoadingFC * amounts.exchangeRate;

  return {
    loadedQuantity: loadedQty,
    totalQuantity: effectiveTotalQty,
    loadingPercentage: Math.round(loadingPercentage * 10000) / 10000,
    remainingQuantity,
    loadedPurchaseFC: Math.round(loadedPurchaseFC * 10000) / 10000,
    loadedPurchaseLC: Math.round(loadedPurchaseLC * 10000) / 10000,
    loadedAdvanceFC: Math.round(loadedAdvanceFC * 10000) / 10000,
    loadedAdvanceLC: Math.round(loadedAdvanceLC * 10000) / 10000,
    remainingLoadingFC: Math.round(remainingLoadingFC * 10000) / 10000,
    remainingLoadingLC: Math.round(remainingLoadingLC * 10000) / 10000,
  };
}

/**
 * Validate and compute a payment allocation.
 * Ensures amount does not exceed remaining balance.
 */
export function resolvePaymentAllocation(
  amounts: PurchaseAmounts,
  paymentAmount: number,
  paymentCurrency: string,
  paymentExchangeRate: number,
  kind: "advance" | "remaining" | "credit" | "booking"
): PaymentAllocation {
  const exRate = paymentExchangeRate > 0 ? paymentExchangeRate : 1;
  const isSameCurrency = paymentCurrency.toUpperCase() === amounts.purchaseCurrency.toUpperCase();
  
  const localAmount = isSameCurrency
    ? paymentAmount * amounts.exchangeRate
    : paymentAmount * exRate;

  const amountInPurchaseCurrency = isSameCurrency
    ? paymentAmount
    : paymentAmount / (amounts.exchangeRate > 0 ? amounts.exchangeRate : 1);

  let newRemainingFC = amounts.remainingPurchaseFC;
  let newRemainingLC = amounts.remainingPurchaseLC;

  if (kind === "advance") {
    newRemainingFC = Math.max(0, amounts.remainingAdvanceFC - amountInPurchaseCurrency);
    newRemainingLC = newRemainingFC * amounts.exchangeRate;
  } else if (kind === "remaining" || kind === "credit") {
    newRemainingFC = Math.max(0, amounts.remainingPurchaseFC - amountInPurchaseCurrency);
    newRemainingLC = newRemainingFC * amounts.exchangeRate;
  }
  // 'booking' does not reduce remaining balance

  return {
    paymentAmount,
    paymentCurrency: paymentCurrency.toUpperCase(),
    exchangeRate: exRate,
    localAmount: Math.round(localAmount * 10000) / 10000,
    newRemainingFC: Math.round(newRemainingFC * 10000) / 10000,
    newRemainingLC: Math.round(newRemainingLC * 10000) / 10000,
  };
}

/**
 * Format a number for display with locale-aware separators.
 */
export function formatAmount(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Check if a payment has already been posted to the journal.
 * Returns true if duplicate posting should be blocked.
 */
export function isDuplicatePosting(record: { posted_to_journal?: boolean; status?: string }): boolean {
  return record.posted_to_journal === true || record.status === "posted";
}
