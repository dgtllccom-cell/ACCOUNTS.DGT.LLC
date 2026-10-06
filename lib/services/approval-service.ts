import type { ErpSession } from "@/lib/auth/session";
import type { ApprovalAction, ApprovalStatus } from "@/lib/approval/approval-actions";
import { requiresApproval } from "@/lib/approval/approval-actions";
import { authorize, canApprove } from "@/lib/permissions/middleware";
import type { ApprovalRequestDraft, ApprovalsRepository } from "@/lib/repositories/approvals-repository";

export const recordWorkflowStates = [
  "pending",
  "approved",
  "rejected",
  "reversed",
  "locked",
  "unlocked"
] as const;

export type RecordWorkflowState = (typeof recordWorkflowStates)[number];

export type ApprovalServiceRequest = Omit<ApprovalRequestDraft, "requestedBy"> & {
  resource: string;
};

export class ApprovalService {
  constructor(private readonly repository: ApprovalsRepository) {}

  shouldRequireApproval(resource: string, action: ApprovalAction) {
    return requiresApproval(resource, action);
  }

  async requestApproval(session: ErpSession, input: ApprovalServiceRequest) {
    authorize(session, {
      resource: "approvals",
      action: "create",
      countryId: input.countryId,
      countryBranchId: input.countryBranchId,
      cityBranchId: input.cityBranchId
    });

    const request = await this.repository.createRequest({
      ...input,
      requestedBy: session.userId
    });

    await this.repository.lockRecord({
      recordTable: input.targetTable,
      recordId: input.targetId,
      approvalRequestId: request.id,
      lockedBy: session.userId,
      reason: input.reason
    });

    return request;
  }

  async decide(session: ErpSession, input: {
    approvalRequestId: string;
    status: Extract<ApprovalStatus, "approved" | "rejected" | "cancelled">;
    countryId?: string | null;
    cityBranchId?: string | null;
    note?: string;
  }) {
    if (!canApprove(session, input.countryId, input.cityBranchId)) {
      authorize(session, {
        resource: "approvals",
        action: "approve",
        countryId: input.countryId,
        cityBranchId: input.cityBranchId,
        approvalAction: input.status
      });
    }

    await this.repository.updateStatus({
      approvalRequestId: input.approvalRequestId,
      status: input.status,
      actorId: session.userId,
      note: input.note
    });
  }

  async unlockRecord(session: ErpSession, input: { recordTable: string; recordId: string }) {
    authorize(session, { resource: "approvals", action: "approve", approvalAction: "unlock" });

    await this.repository.unlockRecord({
      ...input,
      unlockedBy: session.userId
    });
  }
}

