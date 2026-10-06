import type { ApprovalAction, ApprovalStatus } from "@/lib/approval/approval-actions";

export type ApprovalRequestDraft = {
  action: ApprovalAction;
  targetTable: string;
  targetId: string;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  requestedBy: string;
  reason?: string;
  beforeData?: unknown;
  afterData?: unknown;
};

export type ApprovalDecision = {
  approvalRequestId: string;
  status: ApprovalStatus;
  actorId: string;
  note?: string;
};

export type ApprovalsRepository = {
  createRequest(input: ApprovalRequestDraft): Promise<{ id: string; requestNo: string }>;
  updateStatus(input: ApprovalDecision): Promise<void>;
  lockRecord(input: {
    recordTable: string;
    recordId: string;
    approvalRequestId: string;
    lockedBy: string;
    reason?: string;
  }): Promise<void>;
  unlockRecord(input: {
    recordTable: string;
    recordId: string;
    unlockedBy: string;
  }): Promise<void>;
};

