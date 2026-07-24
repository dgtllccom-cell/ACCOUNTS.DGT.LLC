import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { accountCreateSchema } from "@/lib/api/erp-validation";
import { auditApiAction } from "@/lib/api/audit";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);

    authorizeApiScope(session, {
      resource: "accounts",
      action: "read",
      ...scope
    });

    const companyId = request.nextUrl.searchParams.get("companyId");
    const branchId = request.nextUrl.searchParams.get("branchId");
    const kind = request.nextUrl.searchParams.get("kind");

    const supabase = await createApiSupabaseClient();
    let query = supabase
      .from("accounts")
      .select(
        "id, company_id, branch_id, parent_id, code, name, kind, currency, status, is_control_account, created_at, updated_at"
      )
      .is("deleted_at", null)
      .order("code", { ascending: true });

    if (companyId) query = query.eq("company_id", companyId);
    if (branchId) query = query.eq("branch_id", branchId);
    if (kind) query = query.eq("kind", kind);

    const { data, error } = await query.limit(100);

    if (error) {
      throw new Error(error.message);
    }

    return apiOk({
      accounts: data ?? [],
      limit: 100
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = accountCreateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "accounts",
      action: "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("create_account", {
      target_company_id: body.companyId,
      target_branch_id: body.branchId ?? null,
      parent_account_id: body.parentId ?? null,
      account_code: body.code,
      account_name: body.name,
      account_kind_value: body.kind,
      account_currency: body.currency,
      is_control: body.isControlAccount
    });

    if (error) {
      throw new Error(error.message);
    }

    const accountId = data as string;

    await auditApiAction(request, {
      action: "account.create.api",
      entityTable: "accounts",
      entityId: accountId,
      companyId: body.companyId,
      after: {
        code: body.code,
        name: body.name,
        kind: body.kind,
        currency: body.currency,
        branchId: body.branchId ?? null,
        parentId: body.parentId ?? null
      }
    });

    return apiCreated({
      accountId
    });
  } catch (error) {
    return handleApiError(error);
  }
}
