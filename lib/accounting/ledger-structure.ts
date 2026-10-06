export const ledgerScopes = ["super_admin", "country", "main_branch", "city_branch"] as const;

export const defaultLedgerTemplates = [
  { scope: "super_admin", code: "GL-CASH", name: "Global Cash Ledger", currency: "USD" },
  { scope: "super_admin", code: "GL-USD", name: "Global USD Ledger", currency: "USD" },
  { scope: "super_admin", code: "GL-BANK", name: "Global Bank Ledger", currency: "USD" },
  { scope: "super_admin", code: "GL-EXP", name: "Global Expense Ledger", currency: "USD" },
  { scope: "super_admin", code: "GL-INC", name: "Global Income Ledger", currency: "USD" },
  { scope: "country", code: "CT-CASH", name: "Country Cash Ledger", currency: "LOCAL" },
  { scope: "country", code: "CT-USD", name: "Country USD Ledger", currency: "USD" },
  { scope: "country", code: "CT-BANK", name: "Country Bank Ledger", currency: "LOCAL" },
  { scope: "city_branch", code: "BR-CASH", name: "Branch Cash Ledger", currency: "LOCAL" },
  { scope: "city_branch", code: "BR-BANK", name: "Branch Bank Ledger", currency: "LOCAL" }
] as const;

export type LedgerScope = (typeof ledgerScopes)[number];

export function isBalancedEntry(lines: Array<{ debit: number; credit: number }>) {
  const totals = lines.reduce(
    (sum, line) => ({
      debit: sum.debit + line.debit,
      credit: sum.credit + line.credit
    }),
    { debit: 0, credit: 0 }
  );

  return totals.debit > 0 && totals.debit === totals.credit;
}

