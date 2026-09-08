import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { ledgerStatementQuerySchema, uuidSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { ErpPermissionError, canAccessCountry, canAccessCountryBranch, canAccessCityBranch } from "@/lib/permissions/middleware";
import { requireErpSession } from "@/lib/auth/session";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, {
      resource: "ledgers",
      action: "read",
      countryId: request.nextUrl.searchParams.get("countryId"),
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId"),
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId")
    });

    const { id } = await context.params;
    const ledgerId = uuidSchema.parse(id);
    const query = ledgerStatementQuerySchema.parse({
      fromDate: request.nextUrl.searchParams.get("fromDate"),
      toDate: request.nextUrl.searchParams.get("toDate")
    });

    // Record-level scope check: the ledger being asked for must itself belong to
    // a country/branch this user is allowed to see. Without this a user could read
    // ANY ledger's statement by guessing its UUID (the RPC does no scope filter).
    if (!session.isSuperAdmin) {
      const admin = createSupabaseAdminClient() as any;
      const { data: led } = await admin
        .from("ledgers")
        .select("country_id, country_branch_id, city_branch_id")
        .eq("id", ledgerId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!led) throw new ErpPermissionError("Ledger not found or not in your scope.");
      const inScope =
        (led.city_branch_id && canAccessCityBranch(session, led.city_branch_id)) ||
        (led.country_branch_id && canAccessCountryBranch(session, led.country_branch_id)) ||
        (led.country_id && canAccessCountry(session, led.country_id));
      if (!inScope) throw new ErpPermissionError("This ledger is outside your country/branch scope.");
    }

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("get_ledger_statement", {
      p_ledger_id: ledgerId,
      p_from_date: query.fromDate,
      p_to_date: query.toDate
    });

    if (error) {
      throw new Error(error.message);
    }

    return apiOk({
      ledgerId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      statement: data ?? []
    });
  } catch (error) {
    return handleApiError(error);
  }
}
