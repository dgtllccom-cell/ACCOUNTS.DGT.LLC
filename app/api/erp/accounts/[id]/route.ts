import { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { accountUpdateSchema, uuidSchema } from "@/lib/api/erp-validation";
import { auditApiAction } from "@/lib/api/audit";
import { createApiSupabaseClient, type LooseSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession, type ErpSession } from "@/lib/auth/session";

type AccountRow = {
  id: string;
  company_id: string;
  branch_id: string | null;
  parent_id: string | null;
  code: string;
  name: string;
  kind: string;
  currency: string;
  status: string;
  is_control_account: boolean;
  created_at: string;
  updated_at: string;
};

async function requireApprovedChangeIfNeeded(input: {
  session: ErpSession;
  supabase: LooseSupabaseClient;
  approvalRequestId?: string;
  targetId: string;
  action: "update" | "delete";
}) {
  if (input.session.isSuperAdmin) {
    return null;
  }

  if (!input.approvalRequestId) {
    return apiError(
      "APPROVAL_REQUIRED",
      "This account change requires an approved approval request",
      409,
      { targetTable: "accounts", targetId: input.targetId, action: input.action }
    );
  }

  const { data, error } = await input.supabase
    .from("approval_requests")
    .select("id, status, action, target_table, target_id")
    .eq("id", input.approvalRequestId)
    .eq("target_table", "accounts")
    .eq("target_id", input.targetId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const approval = data as { status: string; action: string };

  if (approval.status !== "approved" || (approval.action !== input.action && approval.action !== "edit")) {
    return apiError(
      "APPROVAL_REQUIRED",
      "Approval request is not approved for this account change",
      409,
      { approvalRequestId: input.approvalRequestId, targetId: input.targetId, action: input.action }
    );
  }

  return null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const accountId = uuidSchema.parse(id);

    authorizeApiScope(session, {
      resource: "accounts",
      action: "read",
      countryId: request.nextUrl.searchParams.get("countryId"),
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId"),
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId")
    });

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .select(
        "id, company_id, branch_id, parent_id, code, name, kind, currency, status, is_control_account, created_at, updated_at"
      )
      .eq("id", accountId)
      .is("deleted_at", null)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return apiOk({
      account: data
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const accountId = uuidSchema.parse(id);
    const body = accountUpdateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "accounts",
      action: "update",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const supabase = await createApiSupabaseClient();
    const beforeResult = await supabase
      .from("accounts")
      .select(
        "id, company_id, branch_id, parent_id, code, name, kind, currency, status, is_control_account, created_at, updated_at"
      )
      .eq("id", accountId)
      .is("deleted_at", null)
      .single();

    if (beforeResult.error) {
      throw new Error(beforeResult.error.message);
    }

    const approvalError = await requireApprovedChangeIfNeeded({
      session,
      supabase,
      approvalRequestId: body.approvalRequestId,
      targetId: accountId,
      action: "update"
    });

    if (approvalError) return approvalError;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (body.branchId !== undefined) patch.branch_id = body.branchId ?? null;
    if (body.parentId !== undefined) patch.parent_id = body.parentId ?? null;
    if (body.code !== undefined) patch.code = body.code;
    if (body.name !== undefined) patch.name = body.name;
    if (body.kind !== undefined) patch.kind = body.kind;
    if (body.currency !== undefined) patch.currency = body.currency;
    if (body.status !== undefined) patch.status = body.status;
    if (body.isControlAccount !== undefined) patch.is_control_account = body.isControlAccount;

    if (Object.keys(patch).length === 1) {
      return apiError("VALIDATION_ERROR", "No account fields were provided for update", 422);
    }

    const updateResult = await supabase
      .from("accounts")
      .update(patch)
      .eq("id", accountId)
      .select(
        "id, company_id, branch_id, parent_id, code, name, kind, currency, status, is_control_account, created_at, updated_at"
      )
      .single();

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    const before = beforeResult.data as AccountRow;

    await auditApiAction(request, {
      action: "account.update.api",
      entityTable: "accounts",
      entityId: accountId,
      companyId: before.company_id,
      before,
      after: updateResult.data
    });

    return apiOk({
      account: updateResult.data
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const accountId = uuidSchema.parse(id);
    const approvalRequestId = request.nextUrl.searchParams.get("approvalRequestId") ?? undefined;

    authorizeApiScope(session, {
      resource: "accounts",
      action: "update",
      countryId: request.nextUrl.searchParams.get("countryId"),
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId"),
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId")
    });

    const supabase = await createApiSupabaseClient();
    const beforeResult = await supabase
      .from("accounts")
      .select(
        "id, company_id, branch_id, parent_id, code, name, kind, currency, status, is_control_account, created_at, updated_at"
      )
      .eq("id", accountId)
      .is("deleted_at", null)
      .single();

    if (beforeResult.error) {
      throw new Error(beforeResult.error.message);
    }

    const approvalError = await requireApprovedChangeIfNeeded({
      session,
      supabase,
      approvalRequestId,
      targetId: accountId,
      action: "delete"
    });

    if (approvalError) return approvalError;

    const deletedAt = new Date().toISOString();
    const updateResult = await supabase
      .from("accounts")
      .update({
        status: "archived",
        deleted_at: deletedAt,
        updated_at: deletedAt
      })
      .eq("id", accountId)
      .select("id, company_id, status, deleted_at")
      .single();

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    const before = beforeResult.data as AccountRow;

    await auditApiAction(request, {
      action: "account.soft_delete.api",
      entityTable: "accounts",
      entityId: accountId,
      companyId: before.company_id,
      before,
      after: updateResult.data
    });

    return apiOk({
      accountId,
      deletedAt,
      softDeleted: true
    });
  } catch (error) {
    return handleApiError(error);
  }
}
