import type { ErpSession } from "@/lib/auth/session";

/**
 * Two-stage activation chain for Shipping Line accounts opened by a BRANCH-level login (e.g. the Chaman Shipping Branch Admin).
 *
 *   Branch Admin creates the account  ->  status `pending_approval` (ledger inactive: no posting is possible)
 *   Stage 1  Country Admin approves    ->  still pending, waits for Operations
 *   Stage 2  Operations Country Admin  ->  account Active inside its scope
 *
 * It rides on the EXISTING `approval_requests` / `approval_status_history` records (one request, `after_data` carries the chain
 * state) — there is no second approval system. Every stage decision is a history row with the actor and a timestamp.
 */
export const SHIPPING_ACCOUNT_CHAIN = [
  { stage: 1, role: "country_admin", label: "Country Admin" },
  { stage: 2, role: "country_operations_admin", label: "Operations Country Admin" },
] as const;

export type ChainStageApproval = { stage: number; role: string; actorId: string; at: string; note?: string | null };

export type AccountApprovalAfterData = {
  approvalChain?: Array<{ stage: number; role: string; label: string }>;
  approvalStage?: number;
  stageApprovals?: ChainStageApproval[];
  [k: string]: unknown;
};

/** Roles that open an account WITHOUT the branch-level chain (they are the approvers, or above them). */
const CHAIN_EXEMPT_ROLES = ["super_admin", "country_admin", "business_super_admin", "shipping_super_admin", "global_operations_admin", "country_operations_admin"] as const;

/** True when an account opened by this login in this operational domain must go through the two-stage chain. */
export function accountNeedsApprovalChain(roles: readonly string[], isSuperAdmin: boolean, domain: string | null | undefined): boolean {
  if (isSuperAdmin) return false;
  if ((domain ?? "business") === "business") return false;
  return !roles.some((r) => (CHAIN_EXEMPT_ROLES as readonly string[]).includes(r));
}

export function initialChainState() {
  return {
    approvalChain: SHIPPING_ACCOUNT_CHAIN.map((s) => ({ stage: s.stage, role: s.role, label: s.label })),
    approvalStage: 1,
    stageApprovals: [] as ChainStageApproval[],
  };
}

export function chainOf(afterData: unknown): AccountApprovalAfterData | null {
  const d = (typeof afterData === "string" ? safeParse(afterData) : afterData) as AccountApprovalAfterData | null;
  return d && Array.isArray(d.approvalChain) && d.approvalChain.length > 1 ? d : null;
}

function safeParse(v: string) {
  try { return JSON.parse(v); } catch { return null; }
}

/**
 * May this session decide the CURRENT stage of the chain? A Global Super Admin may decide any stage; a stage is otherwise
 * decided only by its own role inside the request's country (or, for Global Operations Admin, any country). Nobody decides a
 * request they raised themselves.
 */
export function canDecideChainStage(
  session: Pick<ErpSession, "isSuperAdmin" | "roles" | "countryIds" | "userId"> & { operationalDomains?: readonly string[] },
  stageRole: string,
  request: { country_id: string | null; requested_by?: string | null; operational_domain?: string | null }
): boolean {
  if (session.isSuperAdmin) return true;
  if (request.requested_by && request.requested_by === session.userId) return false;
  // the approver must work in the request's operational domain: a Business Country Admin never approves a Shipping Line account
  const domains = session.operationalDomains;
  if (domains && !domains.includes("both") && !domains.includes(request.operational_domain || "shipping")) return false;
  const inCountry = Boolean(request.country_id && session.countryIds.includes(request.country_id));
  if (stageRole === "country_operations_admin") {
    return session.roles.includes("global_operations_admin") || (session.roles.includes("country_operations_admin") && inCountry);
  }
  return session.roles.includes(stageRole) && inCountry;
}

/** Record an approved stage. `done` = that was the last stage (the caller then activates the account). */
export function advanceChain(afterData: AccountApprovalAfterData, actorId: string, note?: string | null, now = new Date()) {
  const chain = afterData.approvalChain ?? [];
  const stage = Number(afterData.approvalStage ?? 1);
  const current = chain.find((s) => s.stage === stage);
  const approvals: ChainStageApproval[] = [...(afterData.stageApprovals ?? []), { stage, role: current?.role ?? "?", actorId, at: now.toISOString(), note: note ?? null }];
  const done = stage >= chain.length;
  return { done, next: { ...afterData, approvalStage: done ? stage : stage + 1, stageApprovals: approvals } as AccountApprovalAfterData };
}
