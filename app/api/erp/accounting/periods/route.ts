import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { financialPeriodCreateSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);

    authorizeApiScope(session, {
      resource: "financial_periods",
      action: "read",
      ...scope
    });

    const supabase = await createApiSupabaseClient();
    let query = supabase
      .from("financial_periods")
      .select(
        "id, scope, country_id, country_branch_id, city_branch_id, period_name, start_date, end_date, status, locked_by, locked_at, lock_reason, closed_by, closed_at, created_at, updated_at"
      )
      .is("deleted_at", null)
      .order("start_date", { ascending: false });

    if (scope.countryId) query = query.eq("country_id", scope.countryId);
    if (scope.countryBranchId) query = query.eq("country_branch_id", scope.countryBranchId);
    if (scope.cityBranchId) query = query.eq("city_branch_id", scope.cityBranchId);

    const { data, error } = await query.limit(100);

    if (error) {
      throw new Error(error.message);
    }

    return apiOk({
      periods: data ?? []
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = financialPeriodCreateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "financial_periods",
      action: "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("create_financial_period", {
      p_scope: body.scope,
      p_country_id: body.countryId ?? null,
      p_country_branch_id: body.countryBranchId ?? null,
      p_city_branch_id: body.cityBranchId ?? null,
      p_period_name: body.periodName,
      p_start_date: body.startDate,
      p_end_date: body.endDate
    });

    if (error) {
      throw new Error(error.message);
    }

    return apiCreated({
      financialPeriodId: data as string
    });
  } catch (error) {
    return handleApiError(error);
  }
}
