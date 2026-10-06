import { describe, expect, it } from "vitest";
import { ledgerService } from "@/lib/services/ledger-service";
import { roznamchaService } from "@/lib/services/roznamcha-service";

const debitAccountId = "11111111-1111-4111-8111-111111111111";
const creditAccountId = "22222222-2222-4222-8222-222222222222";
const countryId = "33333333-3333-4333-8333-333333333333";
const cityBranchId = "44444444-4444-4444-8444-444444444444";

describe("enterprise API service foundation", () => {
  it("creates a balanced ledger posting plan with USD conversion totals", () => {
    const plan = ledgerService.createPostingPlan({
      countryId,
      entryDate: "2026-05-20",
      lines: [
        {
          accountId: debitAccountId,
          debit: 100,
          credit: 0,
          currency: "PKR",
          exchangeRate: 0.0036
        },
        {
          accountId: creditAccountId,
          debit: 0,
          credit: 100,
          currency: "PKR",
          exchangeRate: 0.0036
        }
      ]
    });

    expect(plan.debitTotal).toBe(100);
    expect(plan.creditTotal).toBe(100);
    expect(plan.baseDebitTotal).toBe(0.36);
    expect(plan.baseCreditTotal).toBe(0.36);
  });

  it("rejects unbalanced ledger posting plans", () => {
    expect(() =>
      ledgerService.createPostingPlan({
        countryId,
        entryDate: "2026-05-20",
        lines: [
          {
            accountId: debitAccountId,
            debit: 120,
            credit: 0,
            currency: "AED",
            exchangeRate: 0.2723
          },
          {
            accountId: creditAccountId,
            debit: 0,
            credit: 100,
            currency: "AED",
            exchangeRate: 0.2723
          }
        ]
      })
    ).toThrow("Debit total must equal credit total");
  });

  it("requires country scope for country Roznamcha", () => {
    expect(() =>
      roznamchaService.createPostingPlan({
        type: "country",
        entryDate: "2026-05-20",
        journalNo: "JR-001",
        voucherNo: "V-001",
        lines: []
      })
    ).toThrow("Country Roznamcha requires country");
  });

  it("creates a branch Roznamcha posting plan that is backed by balanced ledger lines", () => {
    const plan = roznamchaService.createPostingPlan({
      type: "branch",
      countryId,
      cityBranchId,
      entryDate: "2026-05-20",
      journalNo: "BR-JR-001",
      voucherNo: "BR-V-001",
      narration: "Daily cash transfer",
      lines: [
        {
          accountId: debitAccountId,
          paymentEntryType: "cash_receipt",
          debit: 500,
          credit: 0,
          currency: "PKR",
          exchangeRate: 0.0036
        },
        {
          accountId: creditAccountId,
          paymentEntryType: "cash_payment",
          debit: 0,
          credit: 500,
          currency: "PKR",
          exchangeRate: 0.0036
        }
      ]
    });

    expect(plan.type).toBe("branch");
    expect(plan.ledgerPosting.debitTotal).toBe(500);
    expect(plan.ledgerPosting.creditTotal).toBe(500);
  });
});
