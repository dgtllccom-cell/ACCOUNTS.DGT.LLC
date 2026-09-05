import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { financialStatementQuerySchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { fetchFinancialStatementRows, classifyProfitAndLoss } from "@/lib/reports/financial-statement-data";

/**
 * Profit & Loss (Income Statement) — CLAUDE.md Master Requirement Section A.
 * Reuses get_financial_statement_ledgers (20261103_financial_statements.sql),
 * the same RBAC scope pattern as get_trial_balance, and the same
 * ledgers/ledger_balances tables. Classification (lib/reports/
 * financial-statement-data.ts) is shared with the AI Business Assistant.
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
    const rows = await fetchFinancialStatementRows(supabase, query);
    const { income, expense, totals } = classifyProfitAndLoss(rows);

    return apiOk({ fromDate: query.fromDate, toDate: query.toDate, scope: query.scope, income, expense, totals });
  } catch (error) {
    return handleApiError(error);
  }
}
