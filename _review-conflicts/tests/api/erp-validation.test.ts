import { describe, expect, it } from "vitest";
import {
  accountCreateSchema,
  enterpriseAccountCreateSchema,
  enterpriseLedgerCreateSchema,
  financialPeriodCreateSchema,
  ledgerPostingSchema,
  reversalSchema,
  roznamchaPostingSchema,
  trialBalanceQuerySchema
} from "@/lib/api/erp-validation";

const accountId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const ledgerId = "33333333-3333-4333-8333-333333333333";

describe("ERP API validation schemas", () => {
  it("normalizes account currency and accepts scoped account creation", () => {
    const parsed = accountCreateSchema.parse({
      companyId,
      code: "1001",
      name: "Cash Account",
      kind: "asset",
      currency: "usd",
      isControlAccount: false
    });

    expect(parsed.currency).toBe("USD");
  });

  it("requires ledgerId on every ledger line when posting", () => {
    expect(() =>
      ledgerPostingSchema.parse({
        mode: "post",
        scope: "super_admin",
        entryDate: "2026-05-20",
        lines: [
          { accountId, debit: 10, credit: 0, currency: "USD", exchangeRate: 1 },
          { accountId, ledgerId, debit: 0, credit: 10, currency: "USD", exchangeRate: 1 }
        ]
      })
    ).toThrow("ledgerId is required on every line when posting");
  });

  it("accepts Roznamcha validate mode without ledger IDs", () => {
    const parsed = roznamchaPostingSchema.parse({
      mode: "validate",
      type: "branch",
      cityBranchId: "44444444-4444-4444-8444-444444444444",
      entryDate: "2026-05-20",
      journalNo: "BR-JR-001",
      voucherNo: "BR-V-001",
      lines: [
        {
          accountId,
          paymentEntryType: "cash_receipt",
          debit: 50,
          credit: 0,
          currency: "USD",
          exchangeRate: 1
        },
        {
          accountId,
          paymentEntryType: "cash_payment",
          debit: 0,
          credit: 50,
          currency: "USD",
          exchangeRate: 1
        }
      ]
    });

    expect(parsed.mode).toBe("validate");
  });

  it("validates scoped enterprise account and ledger creation", () => {
    const account = enterpriseAccountCreateSchema.parse({
      scope: "country",
      countryId: "44444444-4444-4444-8444-444444444444",
      code: "PK-CASH",
      name: "Pakistan Cash",
      kind: "asset",
      currency: "pkr"
    });

    const ledger = enterpriseLedgerCreateSchema.parse({
      scope: "country",
      countryId: account.countryId,
      code: "PK-CASH-L",
      name: "Pakistan Cash Ledger",
      currency: "pkr",
      normalBalance: "debit"
    });

    expect(account.currency).toBe("PKR");
    expect(ledger.currency).toBe("PKR");
  });

  it("validates period, trial balance, and reversal API inputs", () => {
    expect(
      financialPeriodCreateSchema.parse({
        scope: "city_branch",
        cityBranchId: "55555555-5555-4555-8555-555555555555",
        periodName: "May 2026",
        startDate: "2026-05-01",
        endDate: "2026-05-31"
      }).scope
    ).toBe("city_branch");

    expect(
      trialBalanceQuerySchema.parse({
        scope: "super_admin",
        asOfDate: "2026-05-20"
      }).scope
    ).toBe("super_admin");

    expect(
      reversalSchema.parse({
        sourceType: "ledger_batch",
        sourceId: "66666666-6666-4666-8666-666666666666",
        reason: "Correction approved"
      }).sourceType
    ).toBe("ledger_batch");
  });
});
