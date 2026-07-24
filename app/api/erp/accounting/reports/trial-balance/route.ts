import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { trialBalanceQuerySchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = trialBalanceQuerySchema.parse({
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
    const { data, error } = await supabase.rpc("get_trial_balance", {
      p_scope: query.scope,
      p_country_id: query.countryId ?? null,
      p_country_branch_id: query.countryBranchId ?? null,
      p_city_branch_id: query.cityBranchId ?? null,
      p_as_of_date: query.asOfDate
    });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Array<{ debit_balance?: number; credit_balance?: number }>;
    const debitTotal = rows.reduce((total, row) => total + Number(row.debit_balance ?? 0), 0);
    const creditTotal = rows.reduce((total, row) => total + Number(row.credit_balance ?? 0), 0);

    return apiOk({
      asOfDate: query.asOfDate,
      scope: query.scope,
      rows,
      totals: {
        debitTotal,
        creditTotal,
        difference: debitTotal - creditTotal
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
