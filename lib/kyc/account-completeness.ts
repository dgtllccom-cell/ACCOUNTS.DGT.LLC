export type QvcAccountCompletenessInput = {
  name?: string | null;
  code?: string | null;
  currency?: string | null;
  qvc_status?: string | null;
};

/**
 * An account stays in the completion queue until QVC explicitly approves it.
 * Core account fields are checked independently so an approved-but-incomplete
 * historical row cannot disappear from the report.
 */
export function getAccountMissingRequirements(account: QvcAccountCompletenessInput): string[] {
  const missing: string[] = [];

  if (!account.name?.trim()) missing.push("Missing Account Title");
  if (!account.code?.trim()) missing.push("Missing Account Code");
  if (!account.currency?.trim()) missing.push("Missing Account Currency");

  const qvcStatus = account.qvc_status?.trim();
  if (qvcStatus !== "qvc_approved") {
    if (qvcStatus === "needs_review") missing.push("qvc.needs_review");
    else if (qvcStatus === "error") missing.push("qvc.error");
    else missing.push("qvc.pending");
  }

  return missing;
}

