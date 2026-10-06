import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Shared classification logic behind the three Financial Statement
 * endpoints (profit-and-loss, balance-sheet, cash-flow) AND the read-only
 * AI Business Assistant (app/api/erp/ai/query/route.ts). All three routes
 * and the assistant call get_financial_statement_ledgers
 * (20261103_financial_statements.sql) for the raw ledger rows; this file
 * holds the one classification of those rows into Income/Expense,
 * Assets/Liabilities/Equity and Bank/Cash so there is exactly one place
 * that convention lives — not a second accounting engine, and not
 * duplicated per-caller math that could drift out of sync.
 */

export type FinancialStatementRow = {
  ledger_id: string;
  parent_ledger_id?: string | null;
  code: string | null;
  name: string | null;
  currency: string | null;
  kind: string;
  opening_balance: number;
  period_debit: number;
  period_credit: number;
  closing_balance: number;
};

export type FinancialStatementScopeParams = {
  scope: string;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  fromDate: string;
  toDate: string;
};

export async function fetchFinancialStatementRows(
  supabase: any,
  params: FinancialStatementScopeParams
): Promise<FinancialStatementRow[]> {
  const { data, error } = await supabase.rpc("get_financial_statement_ledgers", {
    p_scope: params.scope,
    p_country_id: params.countryId ?? null,
    p_country_branch_id: params.countryBranchId ?? null,
    p_city_branch_id: params.cityBranchId ?? null,
    p_from_date: params.fromDate,
    p_to_date: params.toDate
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FinancialStatementRow[];
}

export function classifyProfitAndLoss(rows: FinancialStatementRow[]) {
  const income = rows
    .filter((r) => r.kind === "income")
    .map((r) => ({ ...r, amount: Number(r.period_credit || 0) - Number(r.period_debit || 0) }))
    .filter((r) => r.amount !== 0);

  const expense = rows
    .filter((r) => r.kind === "expense")
    .map((r) => ({ ...r, amount: Number(r.period_debit || 0) - Number(r.period_credit || 0) }))
    .filter((r) => r.amount !== 0);

  const totalIncome = income.reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = expense.reduce((sum, r) => sum + r.amount, 0);

  return { income, expense, totals: { totalIncome, totalExpense, netProfit: totalIncome - totalExpense } };
}

export function classifyBalanceSheet(rows: FinancialStatementRow[]) {
  // get_financial_statement_ledgers returns closing_balance in a single
  // debit-minus-credit signed convention (matching get_trial_balance):
  // asset/expense accounts (debit-normal) come back positive, liability/
  // equity/income accounts (credit-normal) come back negative. A Balance
  // Sheet reads left-to-right as three POSITIVE totals, so liability and
  // equity rows are re-signed here to their natural positive convention.
  const assets = rows
    .filter((r) => r.kind === "asset" && Number(r.closing_balance || 0) !== 0)
    .map((r) => ({ ...r, closing_balance: Number(r.closing_balance || 0) }));
  const liabilities = rows
    .filter((r) => r.kind === "liability" && Number(r.closing_balance || 0) !== 0)
    .map((r) => ({ ...r, closing_balance: -Number(r.closing_balance || 0) }));
  const equity = rows
    .filter((r) => r.kind === "equity" && Number(r.closing_balance || 0) !== 0)
    .map((r) => ({ ...r, closing_balance: -Number(r.closing_balance || 0) }));
  const income = rows.filter((r) => r.kind === "income");
  const expense = rows.filter((r) => r.kind === "expense");

  const totalAssets = assets.reduce((sum, r) => sum + r.closing_balance, 0);
  const totalLiabilities = liabilities.reduce((sum, r) => sum + r.closing_balance, 0);
  const totalEquityExPnL = equity.reduce((sum, r) => sum + r.closing_balance, 0);

  const totalIncome = income.reduce((sum, r) => sum + (Number(r.period_credit || 0) - Number(r.period_debit || 0)), 0);
  const totalExpense = expense.reduce((sum, r) => sum + (Number(r.period_debit || 0) - Number(r.period_credit || 0)), 0);
  const retainedEarnings = totalIncome - totalExpense;
  const totalEquity = totalEquityExPnL + retainedEarnings;

  return {
    assets,
    liabilities,
    equity,
    retainedEarnings,
    totals: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      difference: totalAssets - (totalLiabilities + totalEquity)
    }
  };
}

export async function resolveCashBankLedgerIds(assetLedgerIds: string[]) {
  if (assetLedgerIds.length === 0) return [] as { ledger_id: string; is_bank: boolean }[];
  const rows = await withLocalPg(async (sql) => {
    return sql<{ ledger_id: string; is_bank: boolean }[]>`
      select l.id as ledger_id,
             (ea.bank_id is not null or ea.name ilike '%bank%' or ea.code ilike '%bank%') as is_bank
      from public.ledgers l
      join public.enterprise_accounts ea on ea.id = l.enterprise_account_id
      where l.id = any(${assetLedgerIds}::uuid[])
        and (
          ea.bank_id is not null
          or ea.name ilike '%cash%' or ea.code ilike '%cash%'
          or ea.name ilike '%bank%' or ea.code ilike '%bank%'
        );
    `;
  });
  return rows || [];
}

export async function classifyCashPosition(allRows: FinancialStatementRow[]) {
  const assetLedgerIds = allRows.filter((r) => r.kind === "asset").map((r) => r.ledger_id);
  if (assetLedgerIds.length === 0) {
    return { bankAccounts: [], cashAccounts: [], totals: { openingBalance: 0, closingBalance: 0, netMovement: 0 } };
  }

  const cashBankIds = await resolveCashBankLedgerIds(assetLedgerIds);
  const bankIdSet = new Set(cashBankIds.filter((r) => r.is_bank).map((r) => r.ledger_id));
  const cashBankSet = new Set(cashBankIds.map((r) => r.ledger_id));

  const bankAccounts = allRows.filter((r) => bankIdSet.has(r.ledger_id));
  const cashAccounts = allRows.filter((r) => cashBankSet.has(r.ledger_id) && !bankIdSet.has(r.ledger_id));
  const combined = allRows.filter((r) => cashBankSet.has(r.ledger_id));

  const openingBalance = combined.reduce((sum, r) => sum + Number(r.opening_balance || 0), 0);
  const closingBalance = combined.reduce((sum, r) => sum + Number(r.closing_balance || 0), 0);

  return {
    bankAccounts,
    cashAccounts,
    totals: { openingBalance, closingBalance, netMovement: closingBalance - openingBalance }
  };
}
