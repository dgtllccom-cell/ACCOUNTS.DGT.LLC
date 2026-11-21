import { describe, expect, it } from "vitest";
import { resolvePurchaseBookingTransferDestination } from "@/lib/services/purchase-booking-transfer-routing";
import { billFxOperator, checkPostingAgainstSaved, effectiveFxRate } from "@/lib/purchases/fx-operator";
import { buildLedgerTransferPreview } from "@/lib/purchases/ledger-transfer-preview";

// Bill AE-001-0005 as saved on production (read-only check, 20 Nov): PKR 20,250,000, operator "/", rate 77.2.
const AE_0005 = {
  original: 20250000,
  rate: 77.2,
  op: "/" as const,
  savedBase: 262305.6995,
};

describe("ledger transfer: where each payment type goes after booking", () => {
  it("Cash never routes to the Advance journal (Cash needs no advance)", () => {
    const d = resolvePurchaseBookingTransferDestination("Cash");
    expect(d.flow).toBe("remaining");
    expect(d.path).not.toContain("/advance");
  });

  it("Advance still routes to the Advance journal", () => {
    expect(resolvePurchaseBookingTransferDestination("Advance Payment").flow).toBe("advance");
  });

  it("Credit routes to the Credit journal; Final routes to the remaining journal", () => {
    expect(resolvePurchaseBookingTransferDestination("Credit").path).toContain("/credit");
    expect(resolvePurchaseBookingTransferDestination("Final Payment").flow).toBe("remaining");
  });
});

describe("ledger transfer: amount and currency for AE-001-0005", () => {
  it("reads the operator from the saved bill, '/' for PKR per AED", () => {
    expect(billFxOperator({ form: { operator: "/" } })).toBe("/");
  });

  it("divides PKR 20,250,000 by 77.2 to AED 262,305.70 and matches the saved total", () => {
    const eff = effectiveFxRate(AE_0005.rate, AE_0005.op);
    expect(AE_0005.original * eff).toBeCloseTo(262305.7, 1);
    const check = checkPostingAgainstSaved(AE_0005);
    expect(check.ok).toBe(true);
    expect(check.computedBase).toBeCloseTo(262305.6995, 3);
  });

  it("would be refused if the operator were wrongly '*' (the 1,563,300,000 AED inflation)", () => {
    const wrong = checkPostingAgainstSaved({ ...AE_0005, op: "*" });
    expect(wrong.ok).toBe(false);
  });
});

describe("ledger transfer: the preview", () => {
  const dr = { id: "dr-1", code: "AE-AEDU-PS-001", name: "Purchase and sales Dubai office" };
  const cr = { id: "cr-1", code: "AE-AEDU-BC-003", name: "Haji abdullah chaman" };

  const base = {
    billNo: "AE-001-0005",
    paymentType: "Credit",
    currency: "PKR",
    operator: "/" as const,
    rate: 77.2,
    originalAmount: 20250000,
    baseAmount: 262305.6995,
    savedBase: 262305.6995,
    debitAccount: dr,
    creditAccount: cr,
    existingPayment: null,
  };

  it("lets AE-001-0005 be posted: DR/CR present, amounts agree, nothing posted yet", () => {
    const p = buildLedgerTransferPreview(base);
    expect(p.canPost).toBe(true);
    expect(p.blockers).toEqual([]);
    expect(p.baseAmount).toBe(262305.7);
    expect(p.alreadyPosted).toBe(false);
    expect(p.debit?.code).toBe("AE-AEDU-PS-001");
    expect(p.credit?.code).toBe("AE-AEDU-BC-003");
  });

  it("refuses a second posting when the bill already has a booking posting (no duplicate ledger entries)", () => {
    const p = buildLedgerTransferPreview({ ...base, existingPayment: { id: "pay-1", roznamchaEntryId: "entry-1" } });
    expect(p.alreadyPosted).toBe(true);
    expect(p.canPost).toBe(false);
    expect(p.postedEntryId).toBe("entry-1");
    expect(p.blockers.join(" ")).toMatch(/already posted/i);
  });

  it("blocks when a ledger is not linked", () => {
    const p = buildLedgerTransferPreview({ ...base, creditAccount: null });
    expect(p.canPost).toBe(false);
    expect(p.blockers.join(" ")).toMatch(/not linked/i);
  });

  it("blocks when DR and CR are the same ledger", () => {
    const p = buildLedgerTransferPreview({ ...base, creditAccount: dr });
    expect(p.canPost).toBe(false);
    expect(p.blockers.join(" ")).toMatch(/same/i);
  });

  it("blocks when the computed base disagrees with the saved total", () => {
    const p = buildLedgerTransferPreview({ ...base, baseAmount: 1563300000 });
    expect(p.canPost).toBe(false);
    expect(p.blockers.join(" ")).toMatch(/does not match/i);
  });
});
