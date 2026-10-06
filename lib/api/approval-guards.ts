import { apiError } from "@/lib/api/response";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import type { ErpSession } from "@/lib/auth/session";

export async function requireApprovedActionUnlessSuperAdmin(input: {
  session: ErpSession;
  approvalRequestId?: string | null;
  targetTable: string;
  targetId: string;
  action: "edit" | "delete" | "update" | "reverse" | "lock" | "unlock";
}) {
  if (input.session.isSuperAdmin) {
    return null;
  }

  if (!input.approvalRequestId) {
    return apiError("APPROVAL_REQUIRED", "This action requires an approved approval request", 409, {
      targetTable: input.targetTable,
      targetId: input.targetId,
      action: input.action
    });
  }

  const supabase = await createApiSupabaseClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select("id, status, action, target_table, target_id")
    .eq("id", input.approvalRequestId)
    .eq("target_table", input.targetTable)
    .eq("target_id", input.targetId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const approval = data as { status: string; action: string };

  if (approval.status !== "approved" || approval.action !== input.action) {
    return apiError("APPROVAL_REQUIRED", "Approval request is not approved for this action", 409, {
      approvalRequestId: input.approvalRequestId,
      targetTable: input.targetTable,
      targetId: input.targetId,
      action: input.action
    });
  }

  return null;
}
