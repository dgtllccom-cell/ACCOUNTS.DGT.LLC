export const approvalActions = ["edit", "delete", "update", "reverse", "lock", "unlock"] as const;

export const approvalStatuses = ["draft", "pending", "approved", "rejected", "applied", "cancelled"] as const;

export type ApprovalAction = (typeof approvalActions)[number];
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const approvalRequiredResources = [
  "journal_entries",
  "ledger_entries",
  "ledgers",
  "accounts",
  "roznamcha_entries",
  "daily_usd_rates",
  "usd_purchase_sales",
  "sales",
  "purchases",
  "payments",
  "country_branches",
  "city_branches"
] as const;

export type ApprovalRequiredResource = (typeof approvalRequiredResources)[number];

export function requiresApproval(resource: string, action: ApprovalAction) {
  return approvalRequiredResources.includes(resource as ApprovalRequiredResource) && approvalActions.includes(action);
}
