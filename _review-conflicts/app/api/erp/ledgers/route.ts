import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { ledgerPostingSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { ledgerService } from "@/lib/services/ledger-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);

    authorizeApiScope(session, {
      resource: "ledgers",
      action: "read",
      ...scope
    });

    const supabase = await createApiSupabaseClient();
    let query = supabase
      .from("ledgers")
      .select(`
        id, scope, country_id, country_branch_id, city_branch_id, account_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, is_active, created_at, updated_at,
        enterprise_accounts(account_number, contacts),
        countries(name),
        city_branches(name)
      `)
      .is("deleted_at", null)
      .order("code", { ascending: true });

    // Enforce ledger security boundaries based on user scope
    if (!session.isSuperAdmin) {
      if (session.cityBranchIds.length > 0) {
        query = query.in("city_branch_id", session.cityBranchIds);
      } else if (session.countryBranchIds.length > 0) {
        query = query.in("country_branch_id", session.countryBranchIds);
      } else if (session.countryIds.length > 0) {
        query = query.in("country_id", session.countryIds);
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    }

    if (scope.countryId) query = query.eq("country_id", scope.countryId);
    if (scope.countryBranchId) query = query.eq("country_branch_id", scope.countryBranchId);
    if (scope.cityBranchId) query = query.eq("city_branch_id", scope.cityBranchId);

    const { data, error } = await query.limit(100);

    if (error) {
      throw new Error(error.message);
    }

    return apiOk({
      ledgers: data ?? [],
      limit: 100
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = ledgerPostingSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "journal_entries",
      action: body.mode === "post" ? "post" : "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const postingPlan = ledgerService.createPostingPlan({
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId,
      entryDate: body.entryDate,
      lines: body.lines
    });

    if (body.mode === "validate") {
      return apiOk({
        mode: body.mode,
        balanced: true,
        postingPlan
      });
    }

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("post_enterprise_ledger_batch", {
      p_scope: body.scope,
      p_country_id: body.countryId ?? null,
      p_country_branch_id: body.countryBranchId ?? null,
      p_city_branch_id: body.cityBranchId ?? null,
      p_entry_date: body.entryDate,
      p_reference_no: body.referenceNo ?? null,
      p_narration: body.narration ?? null,
      p_lines: body.lines
    });

    if (error) {
      throw new Error(error.message);
    }

    const batchId = data as string;

    return apiCreated({
      mode: body.mode,
      balanced: true,
      batchId,
      postingPlan
    });
  } catch (error) {
    return handleApiError(error);
  }
}
