export type LedgerPostingLine = {
  // Backward compatible: legacy accounting uses `accountId` (accounts.id).
  // Enterprise accounting uses `enterpriseAccountId` (enterprise_accounts.id).
  // At least one should be present for posting.
  accountId?: string | null;
  enterpriseAccountId?: string | null;
  ledgerId?: string | null;
  description?: string;
  debit: number;
  credit: number;
  currency: string;
  exchangeRate: number;
};

export type LedgerPostingPlan = {
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  entryDate: string;
  lines: LedgerPostingLine[];
  debitTotal: number;
  creditTotal: number;
  baseDebitTotal: number;
  baseCreditTotal: number;
};

export class LedgerValidationError extends Error {}

function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}

export class LedgerService {
  calculateTotals(lines: LedgerPostingLine[]) {
    return lines.reduce(
      (totals, line) => ({
        debitTotal: roundMoney(totals.debitTotal + line.debit),
        creditTotal: roundMoney(totals.creditTotal + line.credit),
        baseDebitTotal: roundMoney(totals.baseDebitTotal + line.debit * line.exchangeRate),
        baseCreditTotal: roundMoney(totals.baseCreditTotal + line.credit * line.exchangeRate)
      }),
      { debitTotal: 0, creditTotal: 0, baseDebitTotal: 0, baseCreditTotal: 0 }
    );
  }

  validateDoubleEntry(lines: LedgerPostingLine[]) {
    if (!lines.length) {
      throw new LedgerValidationError("At least one journal line is required");
    }

    for (const line of lines) {
      const hasDebit = line.debit > 0;
      const hasCredit = line.credit > 0;

      if (hasDebit === hasCredit) {
        throw new LedgerValidationError("Each line must have either debit or credit, not both");
      }

      if (line.exchangeRate <= 0) {
        throw new LedgerValidationError("Exchange rate must be positive");
      }
    }

    const totals = this.calculateTotals(lines);

    if (totals.debitTotal <= 0 || totals.debitTotal !== totals.creditTotal) {
      throw new LedgerValidationError("Debit total must equal credit total");
    }

    return totals;
  }

  createPostingPlan(input: {
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
    entryDate: string;
    lines: LedgerPostingLine[];
  }): LedgerPostingPlan {
    const totals = this.validateDoubleEntry(input.lines);

    return {
      ...input,
      ...totals
    };
  }

  calculateNextBalance(input: { currentBalance: number; debit: number; credit: number }) {
    return roundMoney(input.currentBalance + input.debit - input.credit);
  }
}

export const ledgerService = new LedgerService();
