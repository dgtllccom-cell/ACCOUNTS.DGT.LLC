import { describe, expect, it } from "vitest";
import {
  EXPENSE_BILL_SECTION_KEY,
  authorityTierForRole,
  buildUserRightsList,
} from "@/lib/permissions/user-rights-list";
import {
  ERP_ACTION_KEYS,
  ERP_PERMISSION_HIERARCHY,
  buildHierarchicalMatrixState,
  convertMatrixToPermissions,
} from "@/lib/permissions/rbac-matrix-builder";
import { enterpriseRolePermissions, type EnterpriseRole } from "@/lib/permissions/enterprise-roles";

const ALL_FORMS = ERP_PERMISSION_HIERARCHY.flatMap((m) => m.sections.flatMap((s) => s.forms));
const EXPENSE_FORM_KEYS = ERP_PERMISSION_HIERARCHY
  .flatMap((m) => m.sections)
  .filter((s) => s.key === EXPENSE_BILL_SECTION_KEY)
  .flatMap((s) => s.forms.map((f) => f.key));

function grantedFormKeys(role: EnterpriseRole, permissions: string[]) {
  const state = buildHierarchicalMatrixState(role, permissions);
  return ALL_FORMS.filter((f) => ERP_ACTION_KEYS.some((a) => state[f.key][a])).map((f) => f.key);
}

describe("complete user rights list", () => {
  it("super admin has full authority: every form and every action, nothing restricted", () => {
    const r = buildUserRightsList({ role: "super_admin", permissions: ["*:*"] });
    expect(r.fullAuthority).toBe(true);
    expect(r.authorityTier).toBe("global");
    expect(r.counts.forms).toBe(ALL_FORMS.length);
    // an action is a granted right only where the form defines at least one permission token for it (the matrix's own rule)
    const actionsDefined = ALL_FORMS.reduce((n, f) => n + ERP_ACTION_KEYS.filter((a) => (f.actions[a] ?? []).length > 0).length, 0);
    expect(r.counts.actions).toBe(actionsDefined);
    expect(r.restrictedModules).toEqual([]);
    // the wildcard is not an "other right"; the form matrix already says everything
    expect(r.otherRights).toEqual([]);
  });

  it("lists EVERY granted form, not a preview: the listed forms are exactly the granted forms", () => {
    for (const role of ["staff_user", "accountant", "country_user"] as const) {
      const perms = enterpriseRolePermissions[role] ?? [];
      const r = buildUserRightsList({ role, permissions: perms });
      const listed = r.modules.flatMap((m) => m.sections.flatMap((s) => s.forms.map((f) => f.key))).sort();
      expect(listed).toEqual(grantedFormKeys(role, perms).sort());
      expect(r.counts.forms).toBe(listed.length);
    }
  });

  it("the expense bill types are reported one by one, with each one's status", () => {
    const perms = enterpriseRolePermissions["accountant"] ?? [];
    const r = buildUserRightsList({ role: "accountant", permissions: perms });
    expect(r.expenseBillTypes.map((f) => f.key).sort()).toEqual([...EXPENSE_FORM_KEYS].sort());
    const state = buildHierarchicalMatrixState("accountant", perms);
    for (const row of r.expenseBillTypes) {
      const expected = ERP_ACTION_KEYS.filter((a) => state[row.key][a]);
      expect(row.granted).toEqual(expected);
    }
  });

  it("uses the form grid the wizard is editing when one is supplied (live step-4 view)", () => {
    const base = buildHierarchicalMatrixState("staff_user", []);
    const state = { ...base, customer_orders_step_1a: { ...base.customer_orders_step_1a, view: true, print: true } };
    const r = buildUserRightsList({ role: "staff_user", permissions: [], matrixState: state });
    const forms = r.modules.flatMap((m) => m.sections.flatMap((s) => s.forms));
    expect(forms).toHaveLength(1);
    expect(forms[0].key).toBe("customer_orders_step_1a");
    expect(forms[0].granted).toEqual(["view", "print"]);
    expect(r.counts.actions).toBe(2);
  });

  it("lists every permission token the form matrix does not cover (other granted rights), grouped by resource", () => {
    const matrixPerms = convertMatrixToPermissions("staff_user", buildHierarchicalMatrixState("staff_user", enterpriseRolePermissions["staff_user"] ?? []));
    const r = buildUserRightsList({ role: "staff_user", permissions: [...matrixPerms, "finance_amounts:deny", "documents:export", "documents:read"] });
    const docs = r.otherRights.find((g) => g.resource === "documents");
    expect(docs?.actions).toEqual(["export", "read"]);
    const fin = r.otherRights.find((g) => g.resource === "finance_amounts");
    expect(fin?.actions).toEqual(["deny"]);
    // matrix tokens are never repeated as other rights
    expect(r.otherRights.some((g) => g.resource === "customer_orders")).toBe(false);
    expect(r.counts.otherTokens).toBe(3);
  });

  it("modules with no granted form are reported as restricted (none are hidden)", () => {
    const r = buildUserRightsList({ role: "staff_user", permissions: [] });
    expect(r.modules).toEqual([]);
    expect(r.restrictedModules.map((m) => m.key).sort()).toEqual(ERP_PERMISSION_HIERARCHY.map((m) => m.key).sort());
    expect(r.counts.forms).toBe(0);
    expect(r.counts.actions).toBe(0);
  });

  it("maps every effective role to an authority tier", () => {
    expect(authorityTierForRole("super_admin")).toBe("global");
    expect(authorityTierForRole("business_super_admin")).toBe("global");
    expect(authorityTierForRole("country_admin")).toBe("country");
    expect(authorityTierForRole("country_operations_admin")).toBe("country");
    expect(authorityTierForRole("main_branch_admin")).toBe("branch");
    expect(authorityTierForRole("city_branch_admin")).toBe("branch");
    expect(authorityTierForRole("shipping_line_admin")).toBe("branch");
    expect(authorityTierForRole("auditor_viewer")).toBe("read_only");
    expect(authorityTierForRole("accountant")).toBe("operations");
    expect(authorityTierForRole("staff_user")).toBe("operations");
  });
});
