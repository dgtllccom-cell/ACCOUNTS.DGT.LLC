import { describe, expect, it } from "vitest";
import { translateCountry } from "@/lib/i18n/table-values";
import {
  amountInPurchaseCurrency,
  buildPaymentEntryModel,
  checkPaymentLimit,
  isEndorsementOrder,
  officeCurrencyForCountryName,
  orderPaymentPercent,
  paymentAmountsOf,
  paymentSummaryFigures,
  type EntryModelInput
} from "@/lib/journal/purchase-payment-entry-model";

const goods = [
  { name: "Golden Raisins", hsCode: "080620", qty: 100, netKg: 100000, amount: 520000, finalAmount: 1909700 },
  { name: "Sultana Raisins", hsCode: "080620", qty: 70, netKg: 70000, amount: 357000, finalAmount: 1310107.5 },
  { name: "Mixed Raisins", hsCode: "080620", qty: 50, netKg: 50000, amount: 255000, finalAmount: 936487.5 }
];

const base: EntryModelInput = {
  mode: "endorsement",
  contractTotal: 1132000,
  contractTotalLocal: 4156295,
  rate: 3.6725,
  percent: 10,
  endorsementOrder: true,
  goods,
  payments: [],
  totalPaid: 0,
  balance: 1132000
};

describe("orderPaymentPercent / isEndorsementOrder", () => {
  it("uses the endorsement percent first, then the advance percent (same order as the payment API)", () => {
    expect(orderPaymentPercent({ endorsementPercent: 10, advancePercent: 30 })).toBe(10);
    expect(orderPaymentPercent({ advancePercent: 30 })).toBe(30);
    expect(orderPaymentPercent({ advance_percent: "25" })).toBe(25);
    expect(orderPaymentPercent({})).toBe(0);
    expect(orderPaymentPercent(null)).toBe(0);
  });
  it("detects endorsement orders from the payment type or condition", () => {
    expect(isEndorsementOrder({ paymentType: "Endorsement Payment" })).toBe(true);
    expect(isEndorsementOrder({ paymentCondition: "endorsement" })).toBe(true);
    expect(isEndorsementOrder({ paymentType: "Advance Payment" })).toBe(false);
  });
});

describe("amountInPurchaseCurrency (mirror of the server)", () => {
  it("keeps an amount typed in the purchase currency", () => {
    expect(amountInPurchaseCurrency({ amount: 52000, paymentCurrency: "USD", rate: 3.6725, purchaseCurrency: "USD", localCurrency: "AED", orderRate: 3.6725 })).toBe(52000);
  });
  it("divides a LOCAL-currency amount by the rate", () => {
    const v = amountInPurchaseCurrency({ amount: 190970, paymentCurrency: "AED", rate: 3.6725, purchaseCurrency: "USD", localCurrency: "AED", orderRate: 3.6725 });
    expect(v).toBeCloseTo(52000.0, 0);
  });
  it("ignores a client rate that is more than 10% away from the order rate (cannot understate the amount)", () => {
    const honoured = amountInPurchaseCurrency({ amount: 36725, paymentCurrency: "AED", rate: 3.7, purchaseCurrency: "USD", localCurrency: "AED", orderRate: 3.6725 });
    const ignored = amountInPurchaseCurrency({ amount: 36725, paymentCurrency: "AED", rate: 36.725, purchaseCurrency: "USD", localCurrency: "AED", orderRate: 3.6725 });
    expect(honoured).toBeCloseTo(36725 / 3.7, 6);
    expect(ignored).toBeCloseTo(10000, 6); // falls back to the order's own rate
  });
  it("converts a third currency through the rates", () => {
    expect(amountInPurchaseCurrency({ amount: 100, paymentCurrency: "EUR", rate: 1.1, purchaseCurrency: "USD", localCurrency: "AED", orderRate: 1 })).toBeCloseTo(110, 6);
  });
});

describe("checkPaymentLimit", () => {
  it("allows paying 100% of the contract on a fresh order", () => {
    const r = checkPaymentLimit({ entered: 1132000, balance: 1132000, contractTotal: 1132000 });
    expect(r.over).toBe(false);
    expect(r.enteredPercentOfContract).toBe(100);
    expect(r.maxPayable).toBe(1132000);
  });
  it("allows exactly the remaining balance and the 0.01 tolerance, nothing more", () => {
    expect(checkPaymentLimit({ entered: 300, balance: 300, contractTotal: 1000 }).over).toBe(false);
    expect(checkPaymentLimit({ entered: 300.01, balance: 300, contractTotal: 1000 }).over).toBe(false);
    const r = checkPaymentLimit({ entered: 300.02, balance: 300, contractTotal: 1000 });
    expect(r.over).toBe(true);
    expect(r.excess).toBe(0.02);
  });
  it("blocks any payment on a fully paid order", () => {
    expect(checkPaymentLimit({ entered: 1, balance: 0, contractTotal: 1000 }).over).toBe(true);
    expect(checkPaymentLimit({ entered: 0, balance: 0, contractTotal: 1000 }).over).toBe(false);
  });
  it("never reports a negative maximum", () => {
    expect(checkPaymentLimit({ entered: 5, balance: -20, contractTotal: 100 }).maxPayable).toBe(0);
  });
});

describe("buildPaymentEntryModel — endorsement (the reference example)", () => {
  it("splits the contract into 10% per goods line and totals them", () => {
    const m = buildPaymentEntryModel(base);
    expect(m.requiredAmount).toBe(113200);
    expect(m.goods.map((g) => g.stageAmount)).toEqual([52000, 35700, 25500]);
    expect(m.goodsTotals.amount).toBe(1132000);
    expect(m.goodsTotals.stageAmount).toBe(113200);
    expect(m.goodsTotals.stageFinal).toBeCloseTo(415629.5, 2);
    expect(m.goodsTotals.qty).toBe(220);
    expect(m.goodsTotals.netKg).toBe(220000);
    expect(m.status).toBe("draft");
  });

  it("fills the endorsement first, then counts the rest as advance, and reports the balance", () => {
    const m = buildPaymentEntryModel({
      ...base,
      payments: [
        { id: "1", kind: "advance", amountPurchase: 113200, amountLocal: 415629.5, date: "2026-10-10" },
        { id: "2", kind: "advance", amountPurchase: 300000, amountLocal: 1101750, date: "2026-10-20" },
        { id: "3", kind: "advance", amountPurchase: 400000, amountLocal: 1469000, date: "2026-10-25" },
        { id: "4", kind: "advance", amountPurchase: 318800, amountLocal: 1170810, date: "2026-10-28" }
      ],
      totalPaid: 1132000,
      balance: 0
    });
    expect(m.endorsementPaid).toBe(113200);
    expect(m.advancePaid).toBe(1018800);
    expect(m.remainingPaid).toBe(0);
    expect(m.stillRequired).toBe(0);
    expect(m.balance).toBe(0);
    expect(m.paidPercent).toBe(100);
    expect(m.status).toBe("paid");
  });

  it("orders payments by date, not by the order they arrive in", () => {
    const m = buildPaymentEntryModel({
      ...base,
      payments: [
        { id: "late", kind: "advance", amountPurchase: 500000, amountLocal: 0, date: "2026-11-01" },
        { id: "early", kind: "advance", amountPurchase: 60000, amountLocal: 0, date: "2026-10-01" }
      ],
      totalPaid: 560000,
      balance: 572000
    });
    expect(m.endorsementPaid).toBe(113200); // 60,000 (early) + 53,200 of the later one
    expect(m.advancePaid).toBe(446800);
    expect(m.allocations.early).toEqual({ endorsement: 60000, advance: 0 });
    expect(m.allocations.late).toEqual({ endorsement: 53200, advance: 446800 });
    expect(m.stillRequired).toBe(0);
    expect(m.status).toBe("partial");
  });

  it("does not invent an endorsement for a plain advance order", () => {
    const m = buildPaymentEntryModel({
      ...base,
      endorsementOrder: false,
      mode: "advance",
      percent: 30,
      payments: [{ id: "1", kind: "advance", amountPurchase: 100000, amountLocal: 0, date: "2026-10-10" }],
      totalPaid: 100000,
      balance: 1032000
    });
    expect(m.endorsementPaid).toBe(0);
    expect(m.advancePaid).toBe(100000);
    expect(m.requiredAmount).toBe(339600);
    expect(m.stillRequired).toBe(239600);
  });
});

describe("buildPaymentEntryModel — remaining", () => {
  it("covers the whole balance, shared across the goods lines in proportion", () => {
    const m = buildPaymentEntryModel({
      ...base,
      mode: "remaining",
      payments: [{ id: "1", kind: "advance", amountPurchase: 283000, amountLocal: 0, date: "2026-10-10" }],
      totalPaid: 283000,
      balance: 849000
    });
    expect(m.requiredAmount).toBe(849000);
    expect(m.stagePercent).toBe(75);
    expect(m.goodsTotals.stageAmount).toBe(849000);
    expect(m.goods[0].stageAmount).toBe(390000);
  });

  it("derives a line's rate from its own local amount", () => {
    const m = buildPaymentEntryModel(base);
    expect(m.goods[0].rate).toBeCloseTo(3.6725, 4);
  });

  it("falls back to the order rate when a line has no local amount", () => {
    const m = buildPaymentEntryModel({ ...base, goods: [{ name: "X", hsCode: "", qty: 1, netKg: 1, amount: 1000, finalAmount: 0 }] });
    expect(m.goods[0].finalAmount).toBeCloseTo(3672.5, 6);
    expect(m.goods[0].rate).toBe(3.6725);
  });
});

describe("officeCurrencyForCountryName", () => {
  it("recognises the English country names", () => {
    expect(officeCurrencyForCountryName("Pakistan")).toBe("PKR");
    expect(officeCurrencyForCountryName("United Arab Emirates")).toBe("AED");
    expect(officeCurrencyForCountryName("China")).toBe("CNY");
    expect(officeCurrencyForCountryName("India")).toBe("INR");
    expect(officeCurrencyForCountryName("Afghanistan")).toBe("AFN");
  });
  it("recognises the localized (UR/AR/FA/PS) names the API returns, so non-English users keep their local currency", () => {
    for (const lang of ["ur", "ar", "fa", "ps"]) {
      expect(officeCurrencyForCountryName(translateCountry("Pakistan", lang))).toBe("PKR");
      expect(officeCurrencyForCountryName(translateCountry("United Arab Emirates", lang))).toBe("AED");
      expect(officeCurrencyForCountryName(translateCountry("China", lang))).toBe("CNY");
      expect(officeCurrencyForCountryName(translateCountry("India", lang))).toBe("INR");
      expect(officeCurrencyForCountryName(translateCountry("Afghanistan", lang))).toBe("AFN");
    }
  });
  it("falls back to USD for an unknown or empty country", () => {
    expect(officeCurrencyForCountryName("")).toBe("USD");
    expect(officeCurrencyForCountryName(null)).toBe("USD");
    expect(officeCurrencyForCountryName("Atlantis")).toBe("USD");
  });
});

describe("buildPaymentEntryModel - calculated advance vs paid vs outstanding, per-payment running balance", () => {
  // the AE-001-0004 case: USD 116,250, 20 % advance = USD 23,250 (= AED 85,327.50 at 3.67), 1,249.85 more paid later
  const ae4: EntryModelInput = {
    mode: "advance", contractTotal: 116250, contractTotalLocal: 426637.5, rate: 3.67, percent: 20, endorsementOrder: false, goods: [],
    payments: [
      { id: "p2", kind: "advance", amountPurchase: 1249.85, amountLocal: 4586.9495, date: "2026-10-31" },
      { id: "p1", kind: "advance", amountPurchase: 23250, amountLocal: 85327.5, date: "2026-10-28" }
    ],
    totalPaid: 24499.85, balance: 91750.15
  };
  it("keeps the CALCULATED advance, the advance PAID and the advance still due apart - all in the purchase currency", () => {
    const m = buildPaymentEntryModel(ae4);
    expect(m.advanceRequired).toBe(23250);
    expect(m.advanceRequiredLocal).toBe(85327.5);
    expect(m.advanceKindPaid).toBe(24499.85);
    expect(m.advanceStillDue).toBe(0); // covered (over-paid by 1,249.85, never shown as a negative "due")
    expect(m.contractTotal).toBe(116250);
    expect(m.balance).toBe(91750.15);
    expect(m.paidPercent).toBe(21.08); // 24,499.85 of 116,250
  });
  it("breaks the payments down in date order with the balance left after each - the local figure is beside the bill-currency amount, never mixed", () => {
    const m = buildPaymentEntryModel(ae4);
    expect(m.breakdown.map((r) => r.id)).toEqual(["p1", "p2"]);
    expect(m.breakdown[0]).toMatchObject({ amount: 23250, local: 85327.5, rate: 3.67, paidToDate: 23250, remainingAfter: 93000 });
    expect(m.breakdown[1]).toMatchObject({ amount: 1249.85, local: 4586.95, paidToDate: 24499.85, remainingAfter: 91750.15 });
  });
  it("a part-paid advance: the shortfall is the advance still due", () => {
    const m = buildPaymentEntryModel({ ...ae4, payments: [{ id: "p", kind: "advance", amountPurchase: 22000, amountLocal: 80740, date: "2026-10-28" }], totalPaid: 22000, balance: 94250 });
    expect(m.advanceRequired).toBe(23250);
    expect(m.advanceKindPaid).toBe(22000);
    expect(m.advanceStillDue).toBe(1250);
    expect(m.breakdown[0].remainingAfter).toBe(94250);
  });
  it("remaining and credit payments are separate from the advance in the running balance", () => {
    const m = buildPaymentEntryModel({
      ...ae4, mode: "remaining",
      payments: [
        { id: "a", kind: "advance", amountPurchase: 23250, amountLocal: 85327.5, date: "2026-10-28" },
        { id: "r", kind: "remaining", amountPurchase: 50000, amountLocal: 183500, date: "2026-11-02" },
        { id: "c", kind: "credit", amountPurchase: 43000, amountLocal: 157810, date: "2026-11-05" }
      ],
      totalPaid: 116250, balance: 0
    });
    expect([m.advanceKindPaid, m.remainingPaid, m.creditPaid, m.totalPaid, m.balance, m.paidPercent]).toEqual([23250, 50000, 43000, 116250, 0, 100]);
    expect(m.breakdown.map((r) => r.remainingAfter)).toEqual([93000, 43000, 0]);
    expect(m.status).toBe("paid");
  });
  it("paymentAmountsOf: a payment posted in the local currency converts by its own rate, a bill-currency payment keeps its amount - never mixed", () => {
    expect(paymentAmountsOf({ amount: 85327.5, currency_code: "AED", exchange_rate: 3.67 }, 3.67, "AED")).toEqual({ purchase: 23250, local: 85327.5 });
    expect(paymentAmountsOf({ amount: 23250, currency_code: "USD", exchange_rate: 3.67 }, 3.67, "AED")).toEqual({ purchase: 23250, local: 85327.5 });
    // a row with no rate of its own falls back to the order's rate
    expect(paymentAmountsOf({ amount: 367, currency_code: "aed" }, 3.67, "AED")).toEqual({ purchase: 100, local: 367 });
  });
  it("AE-001-0004: the calculated advance, what was paid and what is still outstanding are three different figures", () => {
    const m = buildPaymentEntryModel(ae4);
    const f = paymentSummaryFigures(m, 20, 3.67);
    expect(f.contractTotal).toBe(116250);
    expect(f.advancePercent).toBe(20);
    expect(f.advanceRequired).toBe(23250); // calculated: 116,250 x 20%
    expect(f.advanceRequiredLocal).toBe(85327.5); // x 3.67
    expect(f.advancePaid).toBe(24499.85); // actually paid as advance
    expect(f.advanceStillDue).toBe(0);
    expect(f.remainingPaid).toBe(0);
    expect(f.finalPaid).toBe(0);
    expect(f.totalPaid).toBe(24499.85);
    expect(f.balance).toBe(91750.15);
    expect(f.paidPercent).toBe(21.08);
  });
  it("splitKnown: the advance / remaining / final split is only claimed when a payment row backs it", () => {
    // the order says 6,000 was paid but no payment row is available -> the split is unknown, the overall figure still stands
    const noRows = buildPaymentEntryModel({ ...ae4, payments: [], totalPaid: 6000, balance: 110250 });
    const f1 = paymentSummaryFigures(noRows, 20, 3.67);
    expect(f1.splitKnown).toBe(false);
    expect(f1.totalPaid).toBe(6000);
    // nothing paid at all -> nothing to split, nothing unknown
    const unpaid = paymentSummaryFigures(buildPaymentEntryModel({ ...ae4, payments: [], totalPaid: 0, balance: 116250 }), 20, 3.67);
    expect(unpaid.splitKnown).toBe(true);
    expect(unpaid.advanceStillDue).toBe(23250);
    // rows present -> known
    expect(paymentSummaryFigures(buildPaymentEntryModel(ae4), 20, 3.67).splitKnown).toBe(true);
  });
  it("falls back to paid + balance for the contract total when the order has no goods lines, and to the order rate for the local figure", () => {
    const m = buildPaymentEntryModel({ ...ae4, contractTotal: 0, contractTotalLocal: 0, goods: [], totalPaid: 24499.85, balance: 91750.15 });
    const f = paymentSummaryFigures(m, 20, 3.67);
    expect(f.contractTotal).toBe(116250);
    expect(f.contractTotalLocal).toBe(426637.5);
  });
});
