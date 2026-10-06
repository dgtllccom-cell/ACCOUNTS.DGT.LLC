import { describe, expect, it } from "vitest";
import { assertBalancedJournal, checkBalancedJournal } from "@/lib/accounting/ledger";

describe("ledger balancing", () => {
  it("accepts balanced debit and credit lines", () => {
    const result = checkBalancedJournal([
      { debit: 100, credit: 0 },
      { debit: 0, credit: 100 }
    ]);

    expect(result).toEqual({
      balanced: true,
      debitTotal: 100,
      creditTotal: 100,
      difference: 0
    });
  });

  it("rejects unbalanced journal entries", () => {
    expect(() =>
      assertBalancedJournal([
        { debit: 125, credit: 0 },
        { debit: 0, credit: 100 }
      ])
    ).toThrow("Journal entry is not balanced");
  });
});
