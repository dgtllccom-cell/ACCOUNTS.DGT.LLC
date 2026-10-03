import { describe, expect, it } from "vitest";
import {
  capPermissionsForRoles, dashboardForRoles, deriveEffectiveRole, enterpriseRolePermissions, FINANCIAL_RESOURCES,
} from "@/lib/permissions/enterprise-roles";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { assignmentIsEffective, deriveCanViewFinancials, type AssignmentGrant, type ErpSession } from "@/lib/auth/session";
import { financialModuleDenied, hasRolePermission, isStrictOperationalSession, narrowSessionToPermission } from "@/lib/permissions/middleware";

const UAE = "c-uae", PK = "c-pk", DEIRA = "city-deira", ALRAS = "city-alras", UAE_MAIN = "mb-uae", PK_MAIN = "mb-pk";

function session(over: Partial<ErpSession>): ErpSession {
  return {
    userId: "u", email: "u@test", fullName: "U", preferredLanguage: "en", roles: [], permissions: [], assignments: [],
    countryIds: [], countryBranchIds: [], cityBranchIds: [], isSuperAdmin: false, isGlobalScope: false, shippingLineIds: [],
    canViewFinancials: false, ...over,
  } as ErpSession;
}

describe("deriveEffectiveRole — stored role + access profile", () => {
  it("keeps every existing user unchanged when no profile is set", () => {
    expect(deriveEffectiveRole("country_admin", null)).toBe("country_admin");
    expect(deriveEffectiveRole("city_branch_admin", undefined)).toBe("city_branch_admin");
  });
  it("maps the operations profile by scope level", () => {
    expect(deriveEffectiveRole("super_admin", "operations")).toBe("global_operations_admin");
    expect(deriveEffectiveRole("country_admin", "operations")).toBe("country_operations_admin");
    expect(deriveEffectiveRole("main_branch_admin", "operations")).toBe("city_operations_admin");
    expect(deriveEffectiveRole("city_branch_admin", "operations")).toBe("city_operations_admin");
  });
  it("maps the shipping-line profile to admin vs branch user", () => {
    expect(deriveEffectiveRole("country_admin", "shipping_line")).toBe("shipping_line_admin");
    expect(deriveEffectiveRole("city_branch_admin", "shipping_line")).toBe("shipping_line_admin");
    expect(deriveEffectiveRole("staff_user", "shipping_line")).toBe("shipping_line_user");
    expect(deriveEffectiveRole("agent_user", "shipping_line")).toBe("shipping_line_user");
  });
});

describe("operational templates never contain a financial resource", () => {
  for (const role of ["global_operations_admin", "country_operations_admin", "city_operations_admin", "shipping_line_admin", "shipping_line_user"] as const) {
    it(role, () => {
      const fin = enterpriseRolePermissions[role].filter((p) => FINANCIAL_RESOURCES.includes(p.split(":")[0]));
      expect(fin).toEqual([]);
      expect(enterpriseRolePermissions[role]).not.toContain("*:*");
    });
  }
});

describe("capPermissionsForRoles — hard cap for operational logins", () => {
  it("strips wildcards and financial resources (stale saved set / branch-rule grant)", () => {
    const out = capPermissionsForRoles(["country_operations_admin"], ["*:*", "accounts:read", "ledgers:*", "shipments:read", "finance_amounts:read", "finance_amounts:deny"]);
    expect(out).not.toContain("*:*");
    expect(out).not.toContain("accounts:read");
    expect(out).not.toContain("ledgers:*");
    expect(out).not.toContain("finance_amounts:read");
    expect(out).toContain("finance_amounts:deny");
    expect(out).toContain("shipments:read");
  });
  it("does not touch a combined business + operations login", () => {
    const perms = ["accounts:read", "shipments:read"];
    expect(capPermissionsForRoles(["city_branch_admin", "city_operations_admin"], perms)).toEqual(perms);
  });
});

describe("deriveCanViewFinancials — field-level financial permission", () => {
  it("super admin always", () => expect(deriveCanViewFinancials(["super_admin"], [], true)).toBe(true));
  it("explicit deny wins over a business role", () => expect(deriveCanViewFinancials(["accountant"], ["finance_amounts:deny"], false)).toBe(false));
  it("operations / shipping-line logins never, even with the read token", () => {
    expect(deriveCanViewFinancials(["global_operations_admin"], ["finance_amounts:read"], false)).toBe(false);
    expect(deriveCanViewFinancials(["shipping_line_user"], [], false)).toBe(false);
  });
  it("business roles by default", () => expect(deriveCanViewFinancials(["country_admin"], [], false)).toBe(true));
});

describe("assignmentIsEffective — effective dates", () => {
  const today = "2026-10-03";
  it("open window", () => expect(assignmentIsEffective({}, today)).toBe(true));
  it("not yet started", () => expect(assignmentIsEffective({ effectiveFrom: "2026-10-04" }, today)).toBe(false));
  it("ended", () => expect(assignmentIsEffective({ effectiveTo: "2026-10-02" }, today)).toBe(false));
  it("inside", () => expect(assignmentIsEffective({ effectiveFrom: "2026-10-01", effectiveTo: "2026-10-03" }, today)).toBe(true));
});

describe("evaluateRouteAccess — the policy shared by the server gate, client frame and sidebar", () => {
  const ops = { roles: ["country_operations_admin"], permissions: enterpriseRolePermissions.country_operations_admin };
  const sl = { roles: ["shipping_line_user"], permissions: enterpriseRolePermissions.shipping_line_user };
  it("super admin opens everything", () => {
    expect(evaluateRouteAccess({ pathname: "/dashboard/ledger/detailed", permissions: ["*:*"], roles: ["super_admin"] }).allowed).toBe(true);
  });
  it("operations admin: operational pages yes, financial pages never", () => {
    expect(evaluateRouteAccess({ pathname: "/dashboard/logistics", ...ops }).allowed).toBe(true);
    expect(evaluateRouteAccess({ pathname: "/dashboard/purchase/purchase-loading-records", ...ops }).allowed).toBe(true);
    expect(evaluateRouteAccess({ pathname: "/dashboard/purchase/purchase-transit-lane", ...ops }).allowed).toBe(true);
    for (const p of ["/dashboard/ledger/detailed", "/dashboard/roznamcha/cash-entry", "/dashboard/accounts", "/dashboard/general-office/payroll", "/dashboard/purchase/purchase-payments", "/dashboard/crm"]) {
      expect(evaluateRouteAccess({ pathname: p, ...ops }).allowed, p).toBe(false);
    }
  });
  it("operations admin cannot reach an unmapped purchase page through the parent prefix", () => {
    expect(evaluateRouteAccess({ pathname: "/dashboard/purchase/purchase-orders", ...ops }).allowed).toBe(false);
  });
  it("strict logins: unmapped pages are denied (default deny)", () => {
    const d = evaluateRouteAccess({ pathname: "/dashboard/some-new-unmapped-page", ...sl });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("unmapped_denied");
  });
  it("shared pages stay open", () => {
    expect(evaluateRouteAccess({ pathname: "/dashboard", ...sl }).allowed).toBe(true);
  });
  it("business-only domain never opens Shipping & Clearing", () => {
    expect(evaluateRouteAccess({ pathname: "/dashboard/logistics", roles: ["accountant"], permissions: ["shipping_records:read"], operationalDomains: ["business"] }).allowed).toBe(false);
  });
});

describe("dashboardForRoles — one landing router", () => {
  it("routes each role to its dashboard", () => {
    expect(dashboardForRoles(["super_admin"], { isSuperAdmin: true })).not.toBe("/dashboard/logistics");
    expect(dashboardForRoles(["country_operations_admin"])).toBe("/dashboard/logistics");
    expect(dashboardForRoles(["shipping_line_admin"])).toBe("/dashboard/logistics");
  });
  it("never returns /dashboard itself (that page is only a router)", () => {
    for (const r of ["country_admin", "city_branch_admin", "accountant", "agent_user", "staff_user", "global_operations_admin"]) {
      expect(dashboardForRoles([r])).not.toBe("/dashboard");
    }
  });
});

describe("narrowSessionToPermission — combined roles never take the highest access", () => {
  // Country Admin (UAE, no finance) + Accountant (Deira only, finance)
  const grants: AssignmentGrant[] = [
    { role: "country_operations_admin", permissions: ["shipments:read"], countryIds: [UAE], countryBranchIds: [UAE_MAIN], cityBranchIds: [DEIRA, ALRAS], assignment: { role: "country_operations_admin" } as never },
    { role: "accountant", permissions: ["shipments:read", "ledgers:read"], countryIds: [UAE], countryBranchIds: [UAE_MAIN], cityBranchIds: [DEIRA], assignment: { role: "accountant" } as never },
  ];
  const base = () => session({
    roles: ["country_operations_admin", "accountant"], permissions: ["shipments:read", "ledgers:read"], assignmentGrants: grants.map((g) => ({ ...g })),
    countryIds: [UAE], countryBranchIds: [UAE_MAIN], cityBranchIds: [DEIRA, ALRAS], canViewFinancials: true,
  });
  it("a permission held by one assignment is narrowed to that assignment's scope", () => {
    const s = base();
    narrowSessionToPermission(s, "ledgers", "read");
    expect(s.cityBranchIds).toEqual([DEIRA]);
    expect(s.roles).toEqual(["accountant"]);
  });
  it("a permission held by every assignment keeps the union", () => {
    const s = base();
    narrowSessionToPermission(s, "shipments", "read");
    expect(s.cityBranchIds.sort()).toEqual([ALRAS, DEIRA].sort());
  });
});

describe("financial module gate and strict-session helpers", () => {
  it("denies an operations login even if it carried a purchases token", () => {
    const s = session({ roles: ["city_operations_admin"], permissions: ["purchases:read"], canViewFinancials: false });
    expect(financialModuleDenied(s, ["purchases", "sales"], "read")).toBe(true);
    expect(isStrictOperationalSession(s)).toBe(true);
  });
  it("allows a finance user holding the permission", () => {
    const s = session({ roles: ["accountant"], permissions: ["purchases:read"], canViewFinancials: true, countryIds: [PK], countryBranchIds: [PK_MAIN] });
    expect(financialModuleDenied(s, ["purchases", "sales"], "read")).toBe(false);
    expect(isStrictOperationalSession(s)).toBe(false);
  });
  it("denies a business login with finance_amounts:deny", () => {
    const s = session({ roles: ["staff_user"], permissions: ["purchases:read", "finance_amounts:deny"], canViewFinancials: false });
    expect(financialModuleDenied(s, ["purchases"], "read")).toBe(true);
    expect(hasRolePermission(s, "purchases", "read")).toBe(true); // module permission alone is not enough
  });
});

describe("field-level financial deny on routes (business roles)", () => {
  const restricted = { roles: ["staff_user"], permissions: ["ledgers:read", "users:read", "route:/dashboard/users"], canViewFinancials: false };
  it("a finance-denied business login never opens amount pages", () => {
    expect(evaluateRouteAccess({ pathname: "/dashboard/ledger/detailed", ...restricted }).allowed).toBe(false);
    expect(evaluateRouteAccess({ pathname: "/dashboard/roznamcha/cash-entry", ...restricted }).allowed).toBe(false);
  });
  it("but keeps its non-financial module pages", () => {
    expect(evaluateRouteAccess({ pathname: "/dashboard/users", ...restricted }).allowed).toBe(true);
  });
  it("a finance-allowed login with the permission opens the ledger", () => {
    expect(evaluateRouteAccess({ pathname: "/dashboard/ledger/detailed", ...restricted, canViewFinancials: true }).allowed).toBe(true);
  });
});
