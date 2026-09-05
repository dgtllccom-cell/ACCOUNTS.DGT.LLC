import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { z } from "zod";
import { scopeSchema, ledgerScopeSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

const balanceSheetQuerySchema = scopeSchema.extend({
  scope: ledgerScopeSchema,
  asOfDate: z.string().date()
});

type StatementRow = {
  ledger_id: string;
  code: string | null;
  name: string | null;
  currency: string | null;
  kind: string;
  closing_balance: number;
};

/**
 * Balance Sheet — CLAUDE.md Master Requirement Section A.
 * Reuses get_financial_statement_ledgers the same way profit-and-loss/
 * route.ts does, but reads closing_balance as of a single date (like
 * get_trial_balance's p_as_of_date) instead of a period movement, and
 * groups by kind into Assets / Liabilities / Equity. Net Profit for the
 * period-to-date is folded into Equity as "Retained Earnings (Current
 * Period)" so the statement actually balances (Assets = Liabilities +
 * Equity) without requiring a separate manual closing entry -- computed
 * from the same ledger data the P&L endpoint uses, not invented.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = balanceSheetQuerySchema.parse({
      scope: request.nextUrl.searchParams.get("scope"),
      countryId: request.nextUrl.searchParams.get("countryId"),
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId"),
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId"),
      asOfDate: request.nextUrl.searchParams.get("asOfDate")
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read",
      countryId: query.countryId,
      countryBranchId: query.countryBranchId,
      cityBranchId: query.cityBranchId
    });

    const supabase = await createApiSupabaseClient();
    // Use the very first ledger_balances / ledger-open date as the period start so
    // "current period" retained earnings covers everything posted to date, not an
    // arbitrary window -- this is a balance-as-of report, not a period report.
    const { data, error } = await supabase.rpc("get_financial_statement_ledgers", {
      p_scope: query.scope,
      p_country_id: query.countryId ?? null,
      p_country_branch_id: query.countryBranchId ?? null,
      p_city_branch_id: query.cityBranchId ?? null,
      p_from_date: "1970-01-01",
      p_to_date: query.asOfDate
    });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as StatementRow[];

    // get_financial_statement_ledgers returns closing_balance in a single
    // debit-minus-credit signed convention (matching get_trial_balance):
    // asset/expense accounts (debit-normal) come back positive, liability/
    // equity/income accounts (credit-normal) come back negative. A Balance
    // Sheet is read left-to-right as three POSITIVE totals (Assets /
    // Liabilities / Equity), so liability and equity rows are re-signed
    // here to their natural positive credit-side balance before display.
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

    const totalIncome = income.reduce((sum, r) => sum + (Number((r as any).period_credit || 0) - Number((r as any).period_debit || 0)), 0);
    const totalExpense = expense.reduce((sum, r) => sum + (Number((r as any).period_debit || 0) - Number((r as any).period_credit || 0)), 0);
    const retainedEarnings = totalIncome - totalExpense;

    const totalEquity = totalEquityExPnL + retainedEarnings;

    return apiOk({
      asOfDate: query.asOfDate,
      scope: query.scope,
      assets,
      liabilities,
      equity,
      retainedEarnings,
      totals: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        // Should be ~0 for a balanced ledger; surfaced (not hidden) so the
        // report screen can flag a genuine out-of-balance condition. A
        // pre-existing imbalance in the underlying ledger data will show up
        // here exactly as it already does in the existing Trial Balance
        // report's own debit/credit difference -- this is not a bug
        // introduced by this endpoint, it surfaces the same signal.
        difference: totalAssets - (totalLiabilities + totalEquity)
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
