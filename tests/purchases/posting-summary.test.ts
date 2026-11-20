import { describe, expect, it } from "vitest";
import { buildPostingSummary, describePostingMismatch, postedDebitTotal } from "@/lib/purchases/posting-summary";

const dr = { id: "L-DR", code: "ACC-000006", name: "Purchase and sales Dubai office" };
const cr = { id: "L-CR", code: "ACC-000010", name: "Haji abdullah chaman" };

describe("posting summary (AE-001-0005)", () => {
  it("names the debited and credited accounts with the posted amounts and the user", () => {
    const s = buildPostingSummary({
      lines: [{ ledger_id: "L-DR", debit: "262305.6995", credit: 0 }, { ledger_id: "L-CR", debit: 0, credit: "262305.6995" }],
      debitAccount: dr, creditAccount: cr, originalAmount: 20250000, currency: "PKR", baseCurrency: "AED", rate: 77.2, op: "/",
      roznamchaSerialNo: "RZ-0042", postedAt: "2026-11-20T20:00:00.000Z", postedBy: { id: "u1", name: "Super Admin" },
    });
    expect(s.status).toBe("posted");
    expect(s.debit).toMatchObject({ code: "ACC-000006", amount: 262305.6995, originalAmount: 20250000, currency: "PKR" });
    expect(s.credit).toMatchObject({ code: "ACC-000010", amount: 262305.6995 });
    expect(s.balanced).toBe(true);
    expect(s.postedBy.name).toBe("Super Admin");
  });

  it("a planned (stopped) posting shows the bill total on both sides", () => {
    const s = buildPostingSummary({ status: "not_posted", debitAccount: dr, creditAccount: cr, plannedBaseAmount: 262305.6995,
      originalAmount: 20250000, currency: "PKR", baseCurrency: "AED", rate: 77.2, op: "/", reason: "stopped" });
    expect(s.status).toBe("not_posted");
    expect(s.debit.amount).toBe(262305.6995);
    expect(s.reason).toBe("stopped");
  });

  it("the mismatch message gives the figures and says nothing was posted", () => {
    const msg = describePostingMismatch({ postedBase: postedDebitTotal([{ debit: 1563300000 }, { debit: 0 }]), expectedBase: 262305.6995,
      originalAmount: 20250000, currency: "PKR", baseCurrency: "AED", rate: 77.2, op: "/" });
    expect(msg).toContain("nothing was posted");
    expect(msg).toContain("262,305.70 AED");
    expect(msg).toContain("20,250,000.00 PKR ÷ 77.2");
    expect(msg).toContain("1,563,300,000.00 AED");
  });
});
