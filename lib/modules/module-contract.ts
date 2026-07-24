export type ModuleContract = {
  moduleCode: string;
  displayName: string;
  isFinancial: boolean;
  requiredPermissions: string[];
  approvalRules: string[];
  translationFields: string[];
  reportDefinitions: string[];
  numberSequences: string[];
};

export const requiredModuleIntegrationPoints = [
  "country_scope",
  "branch_scope",
  "role_permissions",
  "approval_workflow",
  "audit_logs",
  "translations",
  "reports",
  "attachments",
  "number_sequences"
] as const;

export const financialModuleIntegrationPoints = [
  "chart_of_accounts",
  "journal_builder",
  "balanced_journal_lines",
  "ledger_posting",
  "ledger_balances",
  "financial_reports"
] as const;

export function moduleRequiresLedger(contract: ModuleContract) {
  return contract.isFinancial;
}

