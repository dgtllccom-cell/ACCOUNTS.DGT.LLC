import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { financialPeriodUpdateSchema, uuidSchema } from "@/lib/api/erp-validation";
import { auditApiAction } from "@/lib/api/audit";
import { requireApprovedActionUnlessSuperAdmin } from "@/lib/api/approval-guards";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const periodId = uuidSchema.parse(id);
    const body = financialPeriodUpdateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "financial_periods",
      action: "update"
    });

    const approvalAction = body.status === "open" ? "unlock" : "lock";
    const approvalError = await requireApprovedActionUnlessSuperAdmin({
      session,
      approvalRequestId: body.approvalRequestId,
      targetTable: "financial_periods",
      targetId: periodId,
      action: approvalAction
    });

    if (approvalError) return approvalError;

    const supabase = await createApiSupabaseClient();
    const beforeResult = await supabase
      .from("financial_periods")
      .select("*")
      .eq("id", periodId)
      .is("deleted_at", null)
      .single();

    if (beforeResult.error) {
      throw new Error(beforeResult.error.message);
    }

    const now = new Date().toISOString();
    const patch =
      body.status === "open"
        ? {
            status: body.status,
            locked_by: null,
            locked_at: null,
            lock_reason: body.reason ?? null,
            updated_at: now
          }
        : body.status === "locked"
          ? {
              status: body.status,
              locked_by: session.userId,
              locked_at: now,
              lock_reason: body.reason ?? null,
              updated_at: now
            }
          : {
              status: body.status,
              closed_by: session.userId,
              closed_at: now,
              lock_reason: body.reason ?? null,
              updated_at: now
            };

    const updateResult = await supabase
      .from("financial_periods")
      .update(patch)
      .eq("id", periodId)
      .select("*")
      .single();

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    await auditApiAction(request, {
      action: `financial_period.${body.status}`,
      entityTable: "financial_periods",
      entityId: periodId,
      before: beforeResult.data,
      after: updateResult.data
    });

    return apiOk({
      financialPeriod: updateResult.data
    });
  } catch (error) {
    return handleApiError(error);
  }
}
