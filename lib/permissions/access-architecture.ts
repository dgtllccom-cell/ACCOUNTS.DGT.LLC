import type { EnterpriseRole } from "./enterprise-roles";
import type { PermissionDefinition } from "./catalog";

export type AccessDomain =
  | "dashboard"
  | "users"
  | "master-data"
  | "finance"
  | "reports"
  | "kyc"
  | "documents"
  | "shipping"
  | "communication"
  | "audit"
  | "settings"
  | "other";

export type AccessSummary = {
  domain: AccessDomain;
  label: string;
  count: number;
  permissions: string[];
};

export type KycWorkflowStatus =
  | "not_started"
  | "incomplete"
  | "submitted"
  | "under_review"
  | "correction_required"
  | "verified"
  | "rejected"
  | "expired"
  | "renewal_required";

export type KycWorkflowStep = {
  key: KycWorkflowStatus;
  label: string;
  tone: "slate" | "amber" | "blue" | "violet" | "emerald" | "rose";
};

export const KYC_WORKFLOW_STEPS: KycWorkflowStep[] = [
  { key: "not_started", label: "Not Started", tone: "slate" },
  { key: "incomplete", label: "Incomplete", tone: "rose" },
  { key: "submitted", label: "Submitted", tone: "blue" },
  { key: "under_review", label: "Under Review", tone: "violet" },
  { key: "correction_required", label: "Correction Required", tone: "amber" },
  { key: "verified", label: "Verified", tone: "emerald" },
  { key: "rejected", label: "Rejected", tone: "rose" },
  { key: "expired", label: "Expired", tone: "rose" },
  { key: "renewal_required", label: "Renewal Required", tone: "amber" }
];

export const ACCESS_DOMAIN_META: Record<AccessDomain, { label: string; keywords: string[] }> = {
  dashboard: { label: "Dashboard", keywords: ["dashboard", "overview"] },
  users: { label: "Users & Roles", keywords: ["users", "roles", "permissions"] },
  "master-data": { label: "Master Data", keywords: ["companies", "customers", "banks", "warehouses", "accounts"] },
  finance: { label: "Finance", keywords: ["accounts", "ledgers", "journal", "roznamcha", "cash", "payments"] },
  reports: { label: "Reports", keywords: ["reports", "print", "export"] },
  kyc: { label: "KYC / KVC", keywords: ["kyc", "kvc", "compliance"] },
  documents: { label: "Documents", keywords: ["documents", "scanner", "attachments", "files"] },
  shipping: { label: "Shipping / Clearing", keywords: ["shipping", "clearing", "container", "bl", "truck"] },
  communication: { label: "Communication", keywords: ["messages", "email", "whatsapp", "notifications"] },
  audit: { label: "Audit", keywords: ["audit", "history", "logs"] },
  settings: { label: "Settings", keywords: ["settings", "modules", "config"] },
  other: { label: "Other", keywords: [] }
};

export function getAccessDomain(permission: PermissionDefinition): AccessDomain {
  const haystack = `${permission.group} ${permission.label} ${permission.description} ${permission.resources.join(" ")}`.toLowerCase();
  const domainOrder: AccessDomain[] = [
    "dashboard",
    "users",
    "master-data",
    "finance",
    "reports",
    "kyc",
    "documents",
    "shipping",
    "communication",
    "audit",
    "settings"
  ];
  for (const domain of domainOrder) {
    if (ACCESS_DOMAIN_META[domain].keywords.some((keyword) => haystack.includes(keyword))) {
      return domain;
    }
  }
  return "other";
}

export function groupPermissionsByDomain(permissionDefinitions: PermissionDefinition[]) {
  return permissionDefinitions.reduce<Record<AccessDomain, PermissionDefinition[]>>((groups, permission) => {
    const domain = getAccessDomain(permission);
    groups[domain] = groups[domain] ?? [];
    groups[domain].push(permission);
    return groups;
  }, {
    dashboard: [],
    users: [],
    "master-data": [],
    finance: [],
    reports: [],
    kyc: [],
    documents: [],
    shipping: [],
    communication: [],
    audit: [],
    settings: [],
    other: []
  });
}

export function buildAccessSummary(selectedPermissions: string[], permissionDefinitions: PermissionDefinition[]) {
  const lookup = new Map(permissionDefinitions.map((permission) => [permission.key, permission] as const));
  const domainMap = new Map<AccessDomain, string[]>();

  for (const permissionKey of selectedPermissions) {
    const permission = lookup.get(permissionKey);
    if (!permission) continue;
    const domain = getAccessDomain(permission);
    const list = domainMap.get(domain) ?? [];
    list.push(permissionKey);
    domainMap.set(domain, list);
  }

  return (Object.keys(ACCESS_DOMAIN_META) as AccessDomain[])
    .map((domain) => ({
      domain,
      label: ACCESS_DOMAIN_META[domain].label,
      count: domainMap.get(domain)?.length ?? 0,
      permissions: domainMap.get(domain) ?? []
    }))
    .filter((entry) => entry.count > 0);
}

export function summarizeScope(scope: {
  level: "global" | "country" | "branch";
  scopeLabel: string;
  countryId: string | null;
  branchId: string | null;
  countryBranchId?: string | null;
}) {
  return {
    level: scope.level,
    label: scope.scopeLabel,
    countryId: scope.countryId,
    branchId: scope.branchId,
    branchType: scope.countryBranchId ? "main-or-city-branch" : "global"
  };
}

export function isKycWorkflowTerminal(status: KycWorkflowStatus) {
  return ["verified", "rejected", "expired"].includes(status);
}
