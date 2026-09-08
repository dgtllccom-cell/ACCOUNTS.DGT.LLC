/**
 * ERP Health & Integrity Center — shared result shapes.
 *
 * Every check is READ-ONLY. A scan NEVER creates or alters ledger / journal /
 * roznamcha / purchase / sales / payment / stock / customer / account /
 * employee or any other business record.
 */

export type HealthStatus =
  | "healthy"
  | "warning"
  | "failed"
  | "unauthorized_expected" // 401/403 where that is the correct behaviour
  | "redirected" // 3xx to the expected place (e.g. → /auth/login)
  | "not_found" // 404
  | "server_error" // 500
  | "not_tested"
  | "unknown";

export type HealthCategory =
  | "page"
  | "navigation"
  | "api"
  | "permission"
  | "language"
  | "print_pdf"
  | "build_deploy";

export interface HealthFinding {
  id: string;
  category: HealthCategory;
  module: string;
  /** route, api path, menu key, dictionary namespace, builder name … */
  target: string;
  status: HealthStatus;
  title: string;
  /** what a correct system should have returned */
  expected?: string;
  /** what we actually observed */
  actual?: string;
  /** per-language pass map, when relevant */
  language?: Partial<Record<"en" | "ur" | "ps" | "fa" | "ar", "pass" | "fail" | "n/a">>;
  /** permission observations, when relevant */
  permission?: string;
  /** print/PDF observations, when relevant */
  printPdf?: string;
  /** free-form evidence lines */
  evidence?: string[];
  /** safe deep-link to the affected ERP page/record, when one exists */
  link?: string;
  checkedAt: string;
}

export interface HealthCategorySummary {
  category: HealthCategory;
  total: number;
  healthy: number;
  warning: number;
  failed: number;
  notTested: number;
}

export interface HealthReport {
  generatedAt: string;
  scope: {
    role: string;
    isSuperAdmin: boolean;
    countryIds: number;
    branchIds: number;
  };
  environment: {
    appEnv: string;
    nodeVersion: string;
    nextRuntime: string;
  };
  build: {
    localSha: string | null;
    localShaShort: string | null;
    originMainSha: string | null;
    workingTreeDirtyFiles: number | null;
    buildId: string | null;
    note: string;
  };
  gates: {
    i18nGuard: "pass" | "fail" | "not_tested";
    i18nGuardDetail: string;
    typecheck: "pass" | "fail" | "not_tested";
    typecheckDetail: string;
  };
  overall: {
    score: number; // 0-100
    label: "healthy" | "attention" | "critical";
    healthyPages: number;
    warnings: number;
    brokenPages: number;
    failedApis: number;
    permissionIssues: number;
    languageIssues: number;
    printPdfIssues: number;
  };
  categories: HealthCategorySummary[];
  findings: HealthFinding[];
  /** checks that were deliberately skipped and why — honesty requirement */
  notTested: { area: string; reason: string }[];
}

export const HEALTH_STATUS_TONE: Record<HealthStatus, "good" | "warn" | "bad" | "muted" | "info"> = {
  healthy: "good",
  redirected: "good",
  unauthorized_expected: "good",
  warning: "warn",
  failed: "bad",
  not_found: "bad",
  server_error: "bad",
  not_tested: "muted",
  unknown: "muted",
};
