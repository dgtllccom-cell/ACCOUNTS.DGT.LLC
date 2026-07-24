import type { JournalLineInput } from "@/lib/accounting/types";

export type BalanceCheck = {
  balanced: boolean;
  debitTotal: number;
  creditTotal: number;
  difference: number;
};

export function checkBalancedJournal(lines: Pick<JournalLineInput, "debit" | "credit">[]): BalanceCheck {
  const debitTotal = roundMoney(lines.reduce((sum, line) => sum + Number(line.debit), 0));
  const creditTotal = roundMoney(lines.reduce((sum, line) => sum + Number(line.credit), 0));
  const difference = roundMoney(debitTotal - creditTotal);

  return {
    balanced: debitTotal > 0 && difference === 0,
    debitTotal,
    creditTotal,
    difference
  };
}

export function assertBalancedJournal(lines: Pick<JournalLineInput, "debit" | "credit">[]) {
  const check = checkBalancedJournal(lines);

  if (!check.balanced) {
    throw new Error(`Journal entry is not balanced. Difference: ${check.difference.toFixed(4)}`);
  }

  return check;
}

function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}
