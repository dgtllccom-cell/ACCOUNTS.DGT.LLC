import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { financialStatementQuerySchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { fetchFinancialStatementRows, classifyCashPosition } from "@/lib/reports/financial-statement-data";

/**
 * Cash Flow — CLAUDE.md Master Requirement Section A.
 *
 * Deliberately a "Cash & Bank Position" direct-method report, not an
 * indirect-method 3-way (Operating/Investing/Financing) cash flow
 * statement -- nothing in this schema tags accounts by activity type
 * (confirmed by the capability audit), and inventing that classification
 * would fabricate a misleading report. Shows the REAL opening vs closing
 * balance, over the requested period, of every ledger identifiably a cash
 * or bank account. Classification (lib/reports/financial-statement-data.ts)
 * is shared with the AI Business Assistant.
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
    const allRows = await fetchFinancialStatementRows(supabase, query);
    const { bankAccounts, cashAccounts, totals } = await classifyCashPosition(allRows);

    return apiOk({ fromDate: query.fromDate, toDate: query.toDate, scope: query.scope, methodology: "direct", bankAccounts, cashAccounts, totals });
  } catch (error) {
    return handleApiError(error);
  }
}
