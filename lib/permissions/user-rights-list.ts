import { t } from "@/lib/i18n/ui";
import {
  ERP_ACTION_KEYS,
  ERP_PERMISSION_HIERARCHY,
  buildHierarchicalMatrixState,
  type ErpActionKey,
  type HierarchicalMatrixState,
} from "@/lib/permissions/rbac-matrix-builder";

/**
 * The COMPLETE list of what one user was given: every granted module form (with its actions), the expense bill types, and every other
 * permission token that is not part of the form matrix. Pure data, no truncation: the screen, the A4 print and the profile report all read
 * this one structure, so they cannot disagree.
 */

export type AuthorityTier = "global" | "country" | "branch" | "operations" | "read_only";

export const EXPENSE_BILL_SECTION_KEY = "sec_expense_bills";

/** Effective role → authority tier. Role names are the effective roles (stored role + access profile), see deriveEffectiveRole. */
export function authorityTierForRole(role: string): AuthorityTier {
  switch (role) {
    case "super_admin":
    case "super_admin_reports":
    case "business_super_admin":
    case "shipping_super_admin":
    case "global_operations_admin":
      return "global";
    case "country_admin":
    case "country_operations_admin":
      return "country";
    case "main_branch_admin":
    case "city_branch_admin":
    case "city_operations_admin":
    case "shipping_line_admin":
      return "branch";
    case "auditor_viewer":
      return "read_only";
    default:
      return "operations";
  }
}

export type RightsFormRow = {
  key: string;
  /** English source name (the translated name is resolved by rightsFormName / the renderers) */
  name: string;
  description?: string;
  granted: ErpActionKey[];
};

export type RightsSection = { key: string; name: string; forms: RightsFormRow[] };
export type RightsModule = { key: string; name: string; category: string; sections: RightsSection[] };
export type OtherRightsGroup = { resource: string; actions: string[] };

export type UserRightsList = {
  authorityTier: AuthorityTier;
  /** Super Admin or the wildcard permission: every form is granted */
  fullAuthority: boolean;
  /** Modules with at least one granted form, in matrix order */
  modules: RightsModule[];
  /** Modules with no granted form at all */
  restrictedModules: Array<{ key: string; name: string }>;
  /** Every expense bill type form, granted or not, so the reader sees each one's status */
  expenseBillTypes: RightsFormRow[];
  /** Permission tokens that the form matrix does not cover (grouped by resource) */
  otherRights: OtherRightsGroup[];
  counts: { modules: number; sections: number; forms: number; actions: number; otherTokens: number };
};

export type UserRightsInput = {
  /** effective role (see deriveEffectiveRole) */
  role: string;
  /** permission tokens as stored in user_permission_sets (or as they will be saved) */
  permissions?: readonly string[] | null;
  /** the form grid the wizard is editing; when given it is used for the form rows instead of re-deriving them from the tokens */
  matrixState?: HierarchicalMatrixState | null;
};

const matrixTokens: ReadonlySet<string> = new Set(
  ERP_PERMISSION_HIERARCHY.flatMap((mod) =>
    mod.sections.flatMap((sec) => sec.forms.flatMap((form) => ERP_ACTION_KEYS.flatMap((action) => form.actions[action] ?? [])))
  )
);

export function buildUserRightsList(input: UserRightsInput): UserRightsList {
  const permissions = [...new Set(input.permissions ?? [])];
  const fullAuthority = input.role === "super_admin" || permissions.includes("*:*");
  const state: HierarchicalMatrixState =
    input.matrixState ?? buildHierarchicalMatrixState(input.role as Parameters<typeof buildHierarchicalMatrixState>[0], permissions);

  const modules: RightsModule[] = [];
  const restrictedModules: Array<{ key: string; name: string }> = [];
  const expenseBillTypes: RightsFormRow[] = [];
  let sectionCount = 0;
  let formCount = 0;
  let actionCount = 0;

  for (const mod of ERP_PERMISSION_HIERARCHY) {
    const sections: RightsSection[] = [];
    for (const sec of mod.sections) {
      const forms: RightsFormRow[] = [];
      for (const form of sec.forms) {
        const formState = state[form.key] ?? {};
        const granted = ERP_ACTION_KEYS.filter((action) => formState[action] === true);
        const row: RightsFormRow = { key: form.key, name: form.name, description: form.description, granted };
        if (sec.key === EXPENSE_BILL_SECTION_KEY) expenseBillTypes.push(row);
        if (granted.length) forms.push(row);
      }
      if (forms.length) {
        sections.push({ key: sec.key, name: sec.name, forms });
        sectionCount += 1;
        formCount += forms.length;
        actionCount += forms.reduce((sum, f) => sum + f.granted.length, 0);
      }
    }
    if (sections.length) modules.push({ key: mod.key, name: mod.name, category: mod.category, sections });
    else restrictedModules.push({ key: mod.key, name: mod.name });
  }

  const groups = new Map<string, string[]>();
  for (const token of permissions) {
    if (token === "*:*" || matrixTokens.has(token)) continue;
    const colon = token.indexOf(":");
    const resource = colon > 0 ? token.slice(0, colon) : token;
    const action = colon > 0 ? token.slice(colon + 1) : "";
    groups.set(resource, [...(groups.get(resource) ?? []), action]);
  }
  const otherRights: OtherRightsGroup[] = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resource, actions]) => ({ resource, actions: [...new Set(actions)].sort() }));
  const otherTokens = otherRights.reduce((sum, g) => sum + g.actions.length, 0);

  return {
    authorityTier: authorityTierForRole(input.role),
    fullAuthority,
    modules,
    restrictedModules,
    expenseBillTypes,
    otherRights,
    counts: { modules: modules.length, sections: sectionCount, forms: formCount, actions: actionCount, otherTokens },
  };
}

// ── five-language labels for the list (English is the fallback; every key lives in lib/i18n/ui.ts) ──────────────────────────────

export function rightsModuleName(lang: string, key: string, fallback: string): string {
  return t(lang, `udr.mod.${key}`, fallback);
}
export function rightsSectionName(lang: string, key: string, fallback: string): string {
  return t(lang, `udr.sec.${key}`, fallback);
}
export function rightsFormName(lang: string, key: string, fallback: string): string {
  return t(lang, `udr.form.${key}`, fallback);
}

const CATEGORY_KEYS: Record<string, string> = {
  "Logistics & Customs": "logistics",
  "Finance & Accounting": "finance",
  "Trading & Inventory": "trading",
  "Administration, HR & System": "admin",
};
export function rightsCategoryName(lang: string, category: string): string {
  const key = CATEGORY_KEYS[category];
  return key ? t(lang, `udr.cat.${key}`, category) : category;
}

export const RIGHTS_ACTION_ORDER: readonly ErpActionKey[] = ERP_ACTION_KEYS;
export function rightsActionLabel(lang: string, action: ErpActionKey): string {
  return t(lang, `udr.act.${action}`, action);
}

export function authorityTierLabel(lang: string, tier: AuthorityTier): string {
  return t(lang, `udr.tier.${tier}`, tier);
}

/** Five-language role name for an EFFECTIVE role. Stored roles reuse the wizard's urw2.* labels; derived roles have udr.role.* keys. */
const ROLE_LABEL_KEYS: Record<string, { key: string; fallback: string }> = {
  super_admin: { key: "urw2.role_super_admin", fallback: "Super Admin" },
  country_admin: { key: "urw2.role_country_admin", fallback: "Country Admin" },
  country_user: { key: "urw2.role_country_user", fallback: "Country Normal User" },
  main_branch_admin: { key: "urw2.role_main_branch_admin", fallback: "Main Branch Admin" },
  city_branch_admin: { key: "urw2.role_city_branch_admin", fallback: "City Branch Admin" },
  staff_user: { key: "urw2.role_staff_user", fallback: "City Normal User / Staff" },
  agent_user: { key: "urw2.role_agent_user", fallback: "Clearing Agent Admin / Agent User" },
  accountant: { key: "urw2.role_accountant", fallback: "Accountant" },
  cashier: { key: "urw2.role_cashier", fallback: "Cashier" },
  auditor_viewer: { key: "urw2.role_auditor_viewer", fallback: "Auditor / Read-Only Viewer" },
  super_admin_reports: { key: "udr.role.super_admin_reports", fallback: "Super Admin Reports Auditor" },
  business_super_admin: { key: "udr.role.business_super_admin", fallback: "Business Super Admin" },
  shipping_super_admin: { key: "udr.role.shipping_super_admin", fallback: "Shipping Super Admin" },
  global_operations_admin: { key: "udr.role.global_operations_admin", fallback: "Global Operations Admin" },
  country_operations_admin: { key: "udr.role.country_operations_admin", fallback: "Country Operations Admin" },
  city_operations_admin: { key: "udr.role.city_operations_admin", fallback: "City Operations Admin" },
  shipping_line_admin: { key: "udr.role.shipping_line_admin", fallback: "Shipping Line Admin" },
  shipping_line_user: { key: "udr.role.shipping_line_user", fallback: "Shipping Line User" },
};

export function roleDisplayLabel(lang: string, role: string): string {
  const entry = ROLE_LABEL_KEYS[role];
  return entry ? t(lang, entry.key, entry.fallback) : role;
}
