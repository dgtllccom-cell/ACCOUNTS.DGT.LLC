import { describe, expect, it } from "vitest";
import { fmtMoney, fmtPct, unitFor, valueIn } from "@/lib/purchase-ui/money-unit";
import { ordersToPayRows, reportsToPayRows } from "@/features/purchases/components/purchase-payments-approved-header";
import { bookingStage } from "@/features/purchases/components/purchase-booking-approved-header";

type R = { cur: string; amt: number };
const cur = (r: R) => r.cur;
const amt = (r: R) => r.amt;

describe("approved Purchase headers — money unit (no guessed or double-converted figures)", () => {
  it("one currency is shown as is, without any conversion", () => {
    const rows: R[] = [{ cur: "PKR", amt: 1000 }, { cur: "PKR", amt: 500 }];
    const u = unitFor(rows, cur, amt, () => undefined);
    expect(u).toEqual({ kind: "native", cur: "PKR" });
    expect(fmtMoney(u, valueIn(u, rows, cur, amt, () => undefined))).toBe("PKR 1,500");
  });
  it("mixed currencies convert to USD exactly once, only when every currency has a rate", () => {
    const rows: R[] = [{ cur: "USD", amt: 100 }, { cur: "AED", amt: 367.25 }, { cur: "PKR", amt: 2872 }];
    const rates = { AED: 3.6725, PKR: 287.2 };
    const u = unitFor(rows, cur, amt, (c) => (rates as Record<string, number>)[c]);
    expect(u).toEqual({ kind: "usd" });
    expect(valueIn(u, rows, cur, amt, (c) => (rates as Record<string, number>)[c])).toBeCloseTo(100 + 100 + 10, 6);
  });
  it("mixed currencies with a missing rate show — instead of a wrong number", () => {
    const rows: R[] = [{ cur: "USD", amt: 100 }, { cur: "AFN", amt: 7050 }];
    const u = unitFor(rows, cur, amt, () => undefined);
    expect(u).toEqual({ kind: "none" });
    expect(fmtMoney(u, valueIn(u, rows, cur, amt, () => undefined))).toBe("—");
  });
  it("no rows is — (never a fabricated zero) and percentages need a real base", () => {
    expect(fmtMoney(unitFor([], cur, amt, () => undefined), null)).toBe("—");
    expect(fmtPct(5, 0)).toBeUndefined();
    expect(fmtPct(null, 10)).toBeUndefined();
    expect(fmtPct(25, 100)).toBe("25.0%");
  });
});

describe("approved Purchase headers — row adapters read only fields the API already returns", () => {
  it("orders: paid = advance + remaining paid + credit; due comes from remaining_due; completed = settled", () => {
    const [r] = ordersToPayRows([{ order_total: "1000", advance_paid: "100", remaining_paid: "200", credit_amount: "50", remaining_due: "650", currency_code: "aed", payment_status: "partial", countryName: "UAE" }]);
    expect(r).toMatchObject({ total: 1000, advance: 100, remainingPaid: 200, credit: 50, due: 650, currency: "AED", settled: false, country: "UAE" });
    const [done] = ordersToPayRows([{ order_total: "10", remaining_due: "0", payment_status: "completed", currency_code: "USD" }]);
    expect(done.settled).toBe(true);
  });
  it("reports: falls back to total − paid only when no due field exists", () => {
    const [a] = reportsToPayRows([{ totalPurchaseAmount: 500, advance_paid: 100, remaining_due: 300, currency: "USD", countryName: "PK" }]);
    expect(a.due).toBe(300);
    const [b] = reportsToPayRows([{ totalPurchaseAmount: 500, advance_paid: 100, currency: "USD" }]);
    expect(b.due).toBe(400);
  });
  it("booking stages partition every record exactly once", () => {
    expect(bookingStage({ status: "Transferred" })).toBe("confirmed");
    expect(bookingStage({ status: "Completed" })).toBe("confirmed");
    expect(bookingStage({ status: "Accepted" })).toBe("pending");
    expect(bookingStage({ status: "Draft" })).toBe("draft");
    expect(bookingStage({ status: "Accepted", ledgerPostingStatus: "Posted" })).toBe("confirmed");
  });
});
