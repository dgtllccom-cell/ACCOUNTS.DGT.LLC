import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { z } from "zod";
import { scopeSchema, ledgerScopeSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { fetchFinancialStatementRows, classifyBalanceSheet } from "@/lib/reports/financial-statement-data";

const balanceSheetQuerySchema = scopeSchema.extend({
  scope: ledgerScopeSchema,
  asOfDate: z.string().date()
});

/**
 * Balance Sheet — CLAUDE.md Master Requirement Section A.
 * Reuses get_financial_statement_ledgers the same way profit-and-loss/
 * route.ts does, but reads closing_balance as of a single date (like
 * get_trial_balance's p_as_of_date) instead of a period movement. Net
 * Profit for the period-to-date is folded into Equity as "Retained
 * Earnings (Current Period)" so the statement actually balances (Assets =
 * Liabilities + Equity) without a separate manual closing entry.
 * Classification (lib/reports/financial-statement-data.ts) is shared with
 * the AI Business Assistant.
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
    // Use 1970-01-01 as the period start so "current period" retained
    // earnings covers everything posted to date, not an arbitrary window --
    // this is a balance-as-of report, not a period report.
    const rows = await fetchFinancialStatementRows(supabase, { ...query, fromDate: "1970-01-01", toDate: query.asOfDate });
    const { assets, liabilities, equity, retainedEarnings, totals } = classifyBalanceSheet(rows);

    return apiOk({ asOfDate: query.asOfDate, scope: query.scope, assets, liabilities, equity, retainedEarnings, totals });
  } catch (error) {
    return handleApiError(error);
  }
}
