import { describe, expect, it } from "vitest";
import { resolveLoadingEligibility, resolvePaymentCondition } from "@/lib/services/purchase-calculation-service";
import { isLedgerPosted, loadedPayable, paidForLoadingGate, paymentInPurchaseCurrency, verifiedPaid } from "@/lib/purchases/loaded-payable";

const RATE = 3.6725; // AED per USD

const ledgerOk = { posted_to_journal: true, roznamcha_entry_id: "r1", debit_ledger_id: "d1", credit_ledger_id: "c1" };
/** an advance entered in AED (the branch's local currency) for a USD order: `amount` is AED, base_currency_amount is AED too */
const aedAdvance = (usd: number, extra: Record<string, unknown> = {}) => ({
  kind: "advance", status: "posted", amount: usd * RATE, currency_code: "AED", exchange_rate: RATE, base_currency_amount: usd * RATE, ...ledgerOk, ...extra,
});
const usdAdvance = (usd: number, extra: Record<string, unknown> = {}) => ({
  kind: "advance", status: "posted", amount: usd, currency_code: "USD", exchange_rate: RATE, base_currency_amount: usd * RATE, ...ledgerOk, ...extra,
});

const advanceOrder = {
  order_total: 80000 * RATE,
  advance_paid: 0,
  remaining_paid: 0,
  remaining_due: 80000,
  currency_code: "USD",
  exchange_rate: RATE,
  payment_status: "pending",
  form_data: {
    form: { paymentType: "Advance", advancePercent: 50, totalAmount: 80000, currency: "USD", exchangeRate: RATE },
    goodsEntries: [{ qtyNo: 500, totalAmount: 80000 }],
    totals: { totalQuantity: 500, totalAmount: 80000 },
    workflow: { totalQuantity: 500 },
  },
};

describe("paymentInPurchaseCurrency", () => {
  it("keeps an amount already in the purchase currency", () => {
    expect(paymentInPurchaseCurrency({ amount: 12000, currency_code: "USD", exchange_rate: RATE, base_currency_amount: 12000 * RATE }, "USD", RATE)).toBe(12000);
  });
  it("converts a local-currency (AED) amount back to the purchase currency instead of treating it as USD", () => {
    expect(paymentInPurchaseCurrency({ amount: 44070, currency_code: "AED", exchange_rate: RATE, base_currency_amount: 44070 }, "USD", RATE)).toBeCloseTo(12000, 2);
  });
  it("falls back to amount × rate when there is no base amount", () => {
    expect(paymentInPurchaseCurrency({ amount: 100, currency_code: "EUR", exchange_rate: 4, base_currency_amount: null }, "USD", 2)).toBe(200);
  });
});

describe("verifiedPaid — what the Loading gate may count", () => {
  it("counts only posted advance / remaining / credit rows that are really in the ledger", () => {
    const rows = [
      usdAdvance(10000),
      { ...usdAdvance(5000), status: "cancelled" },
      { ...usdAdvance(5000), roznamcha_entry_id: null },
      { ...usdAdvance(5000), posted_to_journal: false },
      { kind: "booking", status: "posted", amount: 80000 * RATE, currency_code: "AED", exchange_rate: 1, base_currency_amount: 80000 * RATE, ...ledgerOk },
      { kind: "remaining", status: "posted", amount: 2000, currency_code: "USD", exchange_rate: RATE, base_currency_amount: 2000 * RATE, ...ledgerOk },
    ];
    const v = verifiedPaid(rows, "USD", RATE);
    expect(v.advanceFC).toBe(10000);
    expect(v.settledFC).toBe(12000);
    expect(v.ledgerGaps).toBe(2); // the two posted rows missing their ledger link; the cancelled row is not "posted" at all
  });
  it("uses the advance only for advance / endorsement orders and everything settled for the rest", () => {
    const v = verifiedPaid([usdAdvance(10000), { ...usdAdvance(0), kind: "remaining", amount: 3000, base_currency_amount: 3000 * RATE }], "USD", RATE);
    expect(paidForLoadingGate("advance", v)).toBe(10000);
    expect(paidForLoadingGate("endorsement", v)).toBe(10000);
    expect(paidForLoadingGate("cash", v)).toBe(13000);
    expect(paidForLoadingGate("invoice", v)).toBe(13000);
  });
  it("isLedgerPosted needs all four marks", () => {
    expect(isLedgerPosted(usdAdvance(1))).toBe(true);
    expect(isLedgerPosted({ ...usdAdvance(1), debit_ledger_id: null })).toBe(false);
    expect(isLedgerPosted({ ...usdAdvance(1), status: "draft" })).toBe(false);
  });
});

describe("Advance → Loading gate (REGRESSION: an AED advance used to be added up as if it were USD)", () => {
  // required advance = 50 % of USD 80,000 = USD 40,000
  it("old behaviour: summing raw payment amounts lets an advance of only USD 12,000 (AED 44,070) unlock Loading", () => {
    const rawSum = [aedAdvance(12000)].reduce((s, r) => s + Number(r.amount), 0); // 44,070 "units"
    expect(resolveLoadingEligibility(advanceOrder as any, rawSum).eligible).toBe(true); // the defect
  });
  it("now: the same advance is USD 12,000 → blocked, with the shortfall shown", () => {
    const paid = paidForLoadingGate(resolvePaymentCondition(advanceOrder as any), verifiedPaid([aedAdvance(12000)], "USD", RATE));
    expect(paid).toBeCloseTo(12000, 2);
    const r = resolveLoadingEligibility(advanceOrder as any, paid);
    expect(r.eligible).toBe(false);
    expect(r.requiredAmountFC).toBe(40000);
    expect(r.shortfallFC).toBeCloseTo(28000, 2);
  });
  it("a booking row, a Remaining row or a payment without its ledger posting never unlocks Loading", () => {
    const rows = [
      { kind: "booking", status: "posted", amount: 80000 * RATE, currency_code: "AED", exchange_rate: 1, base_currency_amount: 80000 * RATE, ...ledgerOk },
      aedAdvance(40000, { roznamcha_entry_id: null }),
    ];
    const paid = paidForLoadingGate("advance", verifiedPaid(rows, "USD", RATE));
    expect(paid).toBe(0);
    expect(resolveLoadingEligibility(advanceOrder as any, paid).eligible).toBe(false);
  });
  it("unlocks only when the full required advance is posted in the ledger (AED + USD parts add up correctly)", () => {
    const rows = [aedAdvance(12000), usdAdvance(28000)];
    const paid = paidForLoadingGate("advance", verifiedPaid(rows, "USD", RATE));
    expect(paid).toBeCloseTo(40000, 2);
    expect(resolveLoadingEligibility(advanceOrder as any, paid).eligible).toBe(true);
  });
  it("one cent short stays blocked beyond the 0.01 tolerance", () => {
    const paid = paidForLoadingGate("advance", verifiedPaid([usdAdvance(39999.9)], "USD", RATE));
    expect(resolveLoadingEligibility(advanceOrder as any, paid).eligible).toBe(false);
  });
});

describe("loadedPayable — Remaining Payment reflects only the loaded quantity", () => {
  const base = { orderTotalFC: 80000, advancePaidFC: 40000, totalQuantity: 500 };
  const load = (id: string, quantity: number, reportedValueFC?: number) => ({ id, quantity, reportedValueFC });
  it("nothing loaded → nothing payable", () => {
    expect(loadedPayable({ ...base, loadings: [], remainingPaidAllFC: 0 }).loadedOutstandingFC).toBe(0);
  });
  it("200 of 500 loaded → 40 % of the unpaid USD 40,000 = 16,000", () => {
    const r = loadedPayable({ ...base, loadings: [load("L1", 200)], remainingPaidAllFC: 0, loadingId: "L1" });
    expect(r.loadedOutstandingFC).toBe(16000);
    expect(r.loadingOutstandingFC).toBe(16000);
    expect(r.loadedQuantity).toBe(200);
  });
  it("payments already made reduce it; it never goes negative", () => {
    expect(loadedPayable({ ...base, loadings: [load("L1", 200)], remainingPaidAllFC: 6000 }).loadedOutstandingFC).toBe(10000);
    expect(loadedPayable({ ...base, loadings: [load("L1", 200)], remainingPaidAllFC: 99999 }).loadedOutstandingFC).toBe(0);
  });
  it("partial loading, second container: each loading owes its own share, and a paid one owes nothing more", () => {
    const loadings = [load("L1", 200), load("L2", 300)];
    const first = loadedPayable({ ...base, loadings, remainingPaidAllFC: 16000, loadingId: "L1", remainingPaidThisLoadingFC: 16000 });
    expect(first.loadingOutstandingFC).toBe(0);
    const second = loadedPayable({ ...base, loadings, remainingPaidAllFC: 16000, loadingId: "L2", remainingPaidThisLoadingFC: 0 });
    expect(second.loadingOutstandingFC).toBe(24000);
    expect(second.loadedOutstandingFC).toBe(24000);
  });
  it("a weight-priced container may be worth more than its quantity share: its recorded value is honoured, never above the order total", () => {
    // 200 of 500 bales but 45 % of the weight → recorded value 36,000 (quantity share would be 32,000)
    const r = loadedPayable({ ...base, loadings: [load("L1", 200, 36000)], remainingPaidAllFC: 0, loadingId: "L1" });
    expect(r.loadingOutstandingFC).toBe(36000 - 16000); // value − advance share (40,000 × 0.4)
    const capped = loadedPayable({ ...base, loadings: [load("L1", 500, 999999)], remainingPaidAllFC: 0 });
    expect(capped.loadedOutstandingFC).toBe(40000);
  });
  it("a loading that is not in the list has no per-loading figure", () => {
    expect(loadedPayable({ ...base, loadings: [load("L1", 200)], remainingPaidAllFC: 0, loadingId: "OTHER" }).loadingOutstandingFC).toBeNull();
  });
  it("a fully paid-by-advance order owes nothing; the loaded share cannot exceed the whole", () => {
    expect(loadedPayable({ orderTotalFC: 80000, advancePaidFC: 80000, totalQuantity: 500, loadings: [load("L1", 500)], remainingPaidAllFC: 0 }).loadedOutstandingFC).toBe(0);
    expect(loadedPayable({ ...base, loadings: [load("L1", 900)], remainingPaidAllFC: 0 }).loadedOutstandingFC).toBe(40000);
  });
});

import { advanceClearance, loadingPaymentStates } from "@/lib/purchases/loaded-payable";

describe("advanceClearance — purchase currency only (REAL Production bills)", () => {
  // AE-001-0007: USD 1,158,750, 10 % advance, USD 115,875 paid (order_total in AED = 4,252,612.5 — the old comparison used this)
  it("AE-001-0007: required 115,875 = paid 115,875 → cleared", () => {
    const r = advanceClearance({ totalPurchaseFC: 1158750, advancePercent: 10, advancePaidFC: 115875 });
    expect(r).toMatchObject({ requiredFC: 115875, paidFC: 115875, remainingFC: 0, cleared: true });
  });
  it("the old comparison (AED total vs USD paid) said 309,386 was still missing", () => {
    const old = advanceClearance({ totalPurchaseFC: 4252612.5, advancePercent: 10, advancePaidFC: 115875 });
    expect(old.cleared).toBe(false);
    expect(old.remainingFC).toBeGreaterThan(300000);
  });
  it("AE-001-0005: USD 193,375 at 10 % = 19,337.50 required, 19,618 paid → cleared", () => {
    expect(advanceClearance({ totalPurchaseFC: 193375, advancePercent: 10, advancePaidFC: 19618 }).cleared).toBe(true);
  });
  it("AE-001-0004: 20 % of 116,250 = 23,250, 22,000 paid → 1,250 still due", () => {
    expect(advanceClearance({ totalPurchaseFC: 116250, advancePercent: 20, advancePaidFC: 22000 })).toMatchObject({ requiredFC: 23250, remainingFC: 1250, cleared: false });
  });
  it("AE-001-0006: 100 % advance of 126,500, 30,000 paid → 96,500 due", () => {
    expect(advanceClearance({ totalPurchaseFC: 126500, advancePercent: 100, advancePaidFC: 30000 })).toMatchObject({ requiredFC: 126500, remainingFC: 96500, cleared: false });
  });
  it("no advance percent: cleared as soon as something is paid", () => {
    expect(advanceClearance({ totalPurchaseFC: 1000, advancePercent: 0, advancePaidFC: 0 }).cleared).toBe(false);
    expect(advanceClearance({ totalPurchaseFC: 1000, advancePercent: 0, advancePaidFC: 1 }).cleared).toBe(true);
  });
});

describe("loadingPaymentStates — 2,000 cartons, 800 loaded", () => {
  // bill USD 100,000, advance paid 20,000; 2,000 cartons
  const base = { orderTotalFC: 100000, advancePaidFC: 20000, totalQuantity: 2000 };
  it("only the 800 loaded cartons owe anything: 40,000 value − 8,000 advance share = 32,000", () => {
    const [a] = loadingPaymentStates({ ...base, loadings: [{ id: "L1", quantity: 800 }], remainingPayments: [] });
    expect(a).toMatchObject({ valueFC: 40000, advanceAllocFC: 8000, paidFC: 0, outstandingFC: 32000, complete: false });
  });
  it("paying exactly 32,000 against L1 completes it", () => {
    const [a] = loadingPaymentStates({ ...base, loadings: [{ id: "L1", quantity: 800 }], remainingPayments: [{ amountFC: 32000, loadingId: "L1" }] });
    expect(a).toMatchObject({ outstandingFC: 0, complete: true, paidFC: 32000 });
  });
  it("a second loading is tracked separately: L2 (600 cartons) owes 30,000 − 6,000 = 24,000", () => {
    const s = loadingPaymentStates({ ...base, loadings: [{ id: "L1", quantity: 800 }, { id: "L2", quantity: 600 }], remainingPayments: [{ amountFC: 32000, loadingId: "L1" }] });
    expect(s[0].complete).toBe(true);
    expect(s[1]).toMatchObject({ valueFC: 30000, advanceAllocFC: 6000, outstandingFC: 24000, complete: false });
  });
  it("part payment leaves the loading incomplete", () => {
    const [a] = loadingPaymentStates({ ...base, loadings: [{ id: "L1", quantity: 800 }], remainingPayments: [{ amountFC: 10000, loadingId: "L1" }] });
    expect(a).toMatchObject({ outstandingFC: 22000, complete: false });
  });
  it("payments recorded before the link existed are applied oldest-first", () => {
    const s = loadingPaymentStates({ ...base, loadings: [{ id: "L1", quantity: 800 }, { id: "L2", quantity: 600 }], remainingPayments: [{ amountFC: 40000, loadingId: null }] });
    expect(s[0].complete).toBe(true);
    expect(s[1]).toMatchObject({ paidFC: 8000, outstandingFC: 16000, complete: false });
  });
  it("a fully settled bill completes every loading", () => {
    const s = loadingPaymentStates({ ...base, loadings: [{ id: "L1", quantity: 800 }], remainingPayments: [], orderRemainingDueFC: 0 });
    expect(s[0].complete).toBe(true);
  });
});
