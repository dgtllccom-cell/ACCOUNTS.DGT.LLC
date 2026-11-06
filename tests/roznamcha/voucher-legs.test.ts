import { describe, expect, it } from "vitest";
import { voucherLegsFromLines } from "@/lib/roznamcha/voucher-legs";

/**
 * Rule (operator-confirmed): a Roznamcha ENTRY is one-sided - a cash payment is a CR, a cash receipt is a DR.
 * Its voucher must print only the side it was stored with. Postings from purchase / sales / expense modules
 * are stored with both legs and print both. The print never adds a counter-leg the entry does not have.
 */
describe("voucherLegsFromLines - the voucher prints exactly the stored legs", () => {
  it("a one-sided CR cash entry prints ONLY the CR side", () => {
    const { drLines, crLines } = voucherLegsFromLines([
      { debit: 0, credit: 1200000, account_number: "UAE-DUB-AC-0002", description: "Cash Details: Receiver/Sender" },
    ]);
    expect(drLines).toEqual([]);
    expect(crLines).toEqual([{ code: "UAE-DUB-AC-0002", name: null, amount: 1200000, narration: "Cash Details: Receiver/Sender" }]);
  });

  it("a one-sided DR cash entry prints ONLY the DR side", () => {
    const { drLines, crLines } = voucherLegsFromLines([
      { debit: 36725, credit: 0, account_number: "UAE-DUB-AC-0002", description: "E2E Audit" },
    ]);
    expect(crLines).toEqual([]);
    expect(drLines).toEqual([{ code: "UAE-DUB-AC-0002", name: null, amount: 36725, narration: "E2E Audit" }]);
  });

  it("a stored two-leg posting prints both sides, with the account name", () => {
    const { drLines, crLines } = voucherLegsFromLines([
      { debit: 138.08, credit: 0, account_number: "UAE-DUB-AC-0007", accounts: { name: "UAE Ops Test Acc 7562" } },
      { debit: 0, credit: 138.08, account_number: "UAE-DUB-AC-0008", accounts: { name: "UAE Automated UI Test" } },
    ]);
    expect(drLines.map((l) => [l.code, l.name, l.amount])).toEqual([["UAE-DUB-AC-0007", "UAE Ops Test Acc 7562", 138.08]]);
    expect(crLines.map((l) => [l.code, l.name, l.amount])).toEqual([["UAE-DUB-AC-0008", "UAE Automated UI Test", 138.08]]);
  });

  it("a zero or empty line is not printed on either side", () => {
    const { drLines, crLines } = voucherLegsFromLines([
      { debit: 0, credit: 0, account_number: "X" },
      { debit: null, credit: undefined, account_number: "Y" },
    ]);
    expect(drLines).toEqual([]);
    expect(crLines).toEqual([]);
  });

  it("falls back to the ledger name and the account code when no account name is set", () => {
    const { crLines } = voucherLegsFromLines([
      { debit: 0, credit: 50, account_code: "C-1", ledgers: { name: "Petty Cash" } },
    ]);
    expect(crLines[0]).toMatchObject({ code: "C-1", name: "Petty Cash", amount: 50 });
  });
});
