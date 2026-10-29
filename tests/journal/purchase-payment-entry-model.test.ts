import { describe, expect, it } from "vitest";
import { translateCountry } from "@/lib/i18n/table-values";
import {
  amountInPurchaseCurrency,
  buildPaymentEntryModel,
  checkPaymentLimit,
  isEndorsementOrder,
  officeCurrencyForCountryName,
  orderPaymentPercent,
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
