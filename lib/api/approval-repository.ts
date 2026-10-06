import type { ApprovalDecision, ApprovalRequestDraft, ApprovalsRepository } from "@/lib/repositories/approvals-repository";
import { createApiSupabaseClient } from "@/lib/api/supabase";

function createRequestNo() {
  return `APR-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export class SupabaseApprovalsRepository implements ApprovalsRepository {
  async createRequest(input: ApprovalRequestDraft) {
    const supabase = await createApiSupabaseClient();
    const requestNo = createRequestNo();

    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        request_no: requestNo,
        action: input.action,
        status: "pending",
        target_table: input.targetTable,
        target_id: input.targetId,
        country_id: input.countryId ?? null,
        country_branch_id: input.countryBranchId ?? null,
        city_branch_id: input.cityBranchId ?? null,
        requested_by: input.requestedBy,
        reason: input.reason ?? null,
        before_data: input.beforeData ?? null,
        after_data: input.afterData ?? null
      })
      .select("id, request_no")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const row = data as { id: string; request_no: string };

    const historyResult = await supabase.from("approval_status_history").insert({
      approval_request_id: row.id,
      from_status: null,
      to_status: "pending",
      actor_id: input.requestedBy,
      note: input.reason ?? null
    });

    if (historyResult.error) {
      throw new Error(historyResult.error.message);
    }

    return {
      id: row.id,
      requestNo: row.request_no
    };
  }

  async updateStatus(input: ApprovalDecision) {
    const supabase = await createApiSupabaseClient();
    const currentResult = await supabase
      .from("approval_requests")
      .select("status")
      .eq("id", input.approvalRequestId)
      .single();

    if (currentResult.error) {
      throw new Error(currentResult.error.message);
    }

    const current = currentResult.data as { status: string };
    const patch =
      input.status === "approved"
        ? { status: input.status, approved_by: input.actorId, decided_at: new Date().toISOString() }
        : input.status === "rejected"
          ? {
              status: input.status,
              rejected_by: input.actorId,
              rejection_reason: input.note ?? null,
              decided_at: new Date().toISOString()
            }
          : { status: input.status, decided_at: new Date().toISOString() };

    const { error } = await supabase.from("approval_requests").update(patch).eq("id", input.approvalRequestId);

    if (error) {
      throw new Error(error.message);
    }

    const historyResult = await supabase.from("approval_status_history").insert({
      approval_request_id: input.approvalRequestId,
      from_status: current.status,
      to_status: input.status,
      actor_id: input.actorId,
      note: input.note ?? null
    });

    if (historyResult.error) {
      throw new Error(historyResult.error.message);
    }
  }

  async lockRecord(input: {
    recordTable: string;
    recordId: string;
    approvalRequestId: string;
    lockedBy: string;
    reason?: string;
  }) {
    const supabase = await createApiSupabaseClient();
    const { error } = await supabase.from("record_locks").insert({
      record_table: input.recordTable,
      record_id: input.recordId,
      approval_request_id: input.approvalRequestId,
      locked_by: input.lockedBy,
      locked_reason: input.reason ?? null,
      is_active: true
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async unlockRecord(input: { recordTable: string; recordId: string; unlockedBy: string }) {
    const supabase = await createApiSupabaseClient();
    const { error } = await supabase
      .from("record_locks")
      .update({
        is_active: false,
        unlocked_by: input.unlockedBy,
        unlocked_at: new Date().toISOString()
      })
      .eq("record_table", input.recordTable)
      .eq("record_id", input.recordId);

    if (error) {
      throw new Error(error.message);
    }
  }
}
