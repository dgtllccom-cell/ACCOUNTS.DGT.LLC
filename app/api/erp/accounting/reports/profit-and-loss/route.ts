import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { financialStatementQuerySchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

type StatementRow = {
  ledger_id: string;
  code: string | null;
  name: string | null;
  currency: string | null;
  kind: string;
  period_debit: number;
  period_credit: number;
};

/**
 * Profit & Loss (Income Statement) — CLAUDE.md Master Requirement Section A.
 * Reuses get_financial_statement_ledgers (20261103_financial_statements.sql),
 * the same RBAC scope pattern as get_trial_balance, and the same
 * ledgers/ledger_balances tables. Classifies rows already tagged by
 * enterprise_accounts.kind: income accounts show revenue as
 * (credit - debit) for the period, expense accounts show cost as
 * (debit - credit). Net Profit = totalIncome - totalExpense.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = financialStatementQuerySchema.parse({
      scope: request.nextUrl.searchParams.get("scope"),
      countryId: request.nextUrl.searchParams.get("countryId"),
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId"),
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId"),
      fromDate: request.nextUrl.searchParams.get("fromDate"),
      toDate: request.nextUrl.searchParams.get("toDate")
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read",
      countryId: query.countryId,
      countryBranchId: query.countryBranchId,
      cityBranchId: query.cityBranchId
    });

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("get_financial_statement_ledgers", {
      p_scope: query.scope,
      p_country_id: query.countryId ?? null,
      p_country_branch_id: query.countryBranchId ?? null,
      p_city_branch_id: query.cityBranchId ?? null,
      p_from_date: query.fromDate,
      p_to_date: query.toDate
    });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as StatementRow[];

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

    return apiOk({
      fromDate: query.fromDate,
      toDate: query.toDate,
      scope: query.scope,
      income,
      expense,
      totals: {
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
