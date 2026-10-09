import { describe, expect, it } from "vitest";
import { z } from "zod";
import { assignmentAccessFields } from "@/lib/api/erp-validation";
import {
  capPermissionsForRoles, dashboardForRoles, deriveEffectiveRole, domainSuperAdminDomain, enterpriseRolePermissions,
  FINANCIAL_RESOURCES, SHIPPING_DOMAIN_RESOURCES,
} from "@/lib/permissions/enterprise-roles";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { deriveCanViewFinancials, type ErpSession } from "@/lib/auth/session";
import { assertResourceDomain } from "@/lib/permissions/middleware";
import { domainManagerTargetError, isUserManager, userInManagerScope } from "@/lib/permissions/user-management-scope";

const PK = "c-pk", UAE = "c-uae", PK_MAIN = "mb-pk", UAE_MAIN = "mb-uae";
const QUETTA = "city-quetta", ALRAS = "city-alras", CHAMAN_SHIP = "city-chaman-ship";

function session(over: Partial<ErpSession>): ErpSession {
  return {
    userId: "u", email: "u@test", fullName: "U", preferredLanguage: "en", roles: [], permissions: [], assignments: [],
    countryIds: [], countryBranchIds: [], cityBranchIds: [], isSuperAdmin: false, isGlobalScope: false, shippingLineIds: [],
    canViewFinancials: false, operationalDomains: ["business"], ...over,
  } as ErpSession;
}

// what the session builder produces for each profile (expandToDomainNetwork)
const businessSA = session({
  roles: ["business_super_admin"], permissions: enterpriseRolePermissions.business_super_admin, operationalDomains: ["business"],
  countryIds: [PK, UAE], countryBranchIds: [PK_MAIN, UAE_MAIN], cityBranchIds: [QUETTA, ALRAS], canViewFinancials: true,
});
const shippingSA = session({
  roles: ["shipping_super_admin"], permissions: enterpriseRolePermissions.shipping_super_admin,
  operationalDomains: ["shipping"], countryIds: [PK, UAE], countryBranchIds: [PK_MAIN, UAE_MAIN], cityBranchIds: [CHAMAN_SHIP],
  canViewFinancials: true,
});

describe("three separated Super Admin profiles (stored role super_admin + operational domain)", () => {
  it("both = Global Super Admin; business / shipping = domain super admins", () => {
    expect(deriveEffectiveRole("super_admin", null, "both")).toBe("super_admin");
    expect(deriveEffectiveRole("super_admin", null, "business")).toBe("business_super_admin");
    expect(deriveEffectiveRole("super_admin", null, "shipping")).toBe("shipping_super_admin");
    // no domain given keeps the old meaning (callers that do not know the domain)
    expect(deriveEffectiveRole("super_admin", null)).toBe("super_admin");
    // an access profile still wins (Global Operations Admin unchanged)
    expect(deriveEffectiveRole("super_admin", "operations", "business")).toBe("global_operations_admin");
    // the domain never changes any other role
    expect(deriveEffectiveRole("country_admin", null, "shipping")).toBe("country_admin");
  });
  it("domain super admins hold no wildcard", () => {
    expect(enterpriseRolePermissions.business_super_admin).not.toContain("*:*");
    expect(enterpriseRolePermissions.shipping_super_admin).not.toContain("*:*");
    expect(domainSuperAdminDomain(["business_super_admin"])).toBe("business");
    expect(domainSuperAdminDomain(["super_admin", "business_super_admin"])).toBeNull();
  });
  it("Business Super Admin never receives a Shipping-Line resource", () => {
    const leaked = enterpriseRolePermissions.business_super_admin.filter((p) => SHIPPING_DOMAIN_RESOURCES.includes(p.split(":")[0]));
    expect(leaked).toEqual([]);
    expect(enterpriseRolePermissions.business_super_admin).toEqual(expect.arrayContaining(["purchases:create", "ledgers:read", "users:create", "city_branches:create"]));
    // main branches (country structure) stay Global-only
    expect(enterpriseRolePermissions.business_super_admin).not.toContain("country_branches:create");
    expect(enterpriseRolePermissions.shipping_super_admin).not.toContain("country_branches:create");
  });
  it("Shipping Line Super Admin receives shipping operational accounting, never commercial trade", () => {
    expect(shippingSA.permissions).toEqual(expect.arrayContaining([
      "accounts:create", "accounts:read", "ledgers:read", "roznamcha:read", "expenses:read", "shipping_records:create", "users:create"
    ]));
    const commercialLeaked = shippingSA.permissions.filter((p) => ["purchases", "sales", "inventory", "warehouses", "payroll", "uae_tax"].includes(p.split(":")[0]));
    expect(commercialLeaked).toEqual([]);
    expect(deriveCanViewFinancials(shippingSA.roles, shippingSA.permissions, false)).toBe(true);
  });
  it("API domain guard: Shipping SA is refused commercial trade resources", () => {
    expect(() => assertResourceDomain(shippingSA, "purchase_orders")).toThrow();
    expect(() => assertResourceDomain(shippingSA, "sales_orders")).toThrow();
    expect(() => assertResourceDomain(shippingSA, "shipping_records")).not.toThrow();
  });
});

describe("route policy per profile", () => {
  const can = (s: ErpSession, p: string) => evaluateRouteAccess({ pathname: p, permissions: s.permissions, roles: s.roles, operationalDomains: s.operationalDomains, canViewFinancials: s.canViewFinancials }).allowed;
  it("neither domain super admin opens the Global Super Admin console", () => {
    expect(can(businessSA, "/dashboard/super-admin")).toBe(false);
    expect(can(shippingSA, "/dashboard/super-admin")).toBe(false);
  });
  it("Business SA: business modules + user/branch management, never Shipping & Clearing", () => {
    expect(can(businessSA, "/dashboard/country")).toBe(true);
    expect(can(businessSA, "/dashboard/ledger/detailed")).toBe(true);
    expect(can(businessSA, "/dashboard/new-entry/users/branch")).toBe(true);
    expect(can(businessSA, "/dashboard/new-entry/branch-entry/city-branch")).toBe(true);
    expect(can(businessSA, "/dashboard/shipping-clearing")).toBe(false);
    expect(can(businessSA, "/dashboard/logistics")).toBe(false);
  });
  it("Shipping SA: shipping modules + user/branch management + operational accounting, never commercial trade", () => {
    expect(can(shippingSA, "/dashboard/logistics")).toBe(true);
    expect(can(shippingSA, "/dashboard/new-entry/users/branch")).toBe(true);
    expect(can(shippingSA, "/dashboard/new-entry/branch-entry/city-branch")).toBe(true);
    expect(can(shippingSA, "/dashboard/ledger/detailed")).toBe(true);
    expect(can(shippingSA, "/dashboard/roznamcha/cash-entry")).toBe(true);
    expect(can(shippingSA, "/dashboard/purchase")).toBe(false);
    expect(can(shippingSA, "/dashboard/sales")).toBe(false);
    expect(can(shippingSA, "/dashboard/new-entry/users/super-admin")).toBe(false);
  });
  it("landing dashboards", () => {
    expect(dashboardForRoles(["business_super_admin"])).toBe("/dashboard/country");
    expect(dashboardForRoles(["shipping_super_admin"])).toBe("/dashboard/logistics");
  });
});

describe("user edit payload: an absent shipping line stays absent", () => {
  it("does not turn a missing shippingLineId into null (which failed every edit of a Shipping Line login)", () => {
    const schema = z.object({ ...assignmentAccessFields });
    expect(schema.parse({}).shippingLineId).toBeUndefined();
    expect(schema.parse({ shippingLineId: null }).shippingLineId).toBeNull();
    expect(schema.parse({ shippingLineId: "" }).shippingLineId).toBeNull();
    expect(schema.parse({ shippingLineId: "9b568b89-5541-450d-b3e5-45053cf7364c" }).shippingLineId).toBe("9b568b89-5541-450d-b3e5-45053cf7364c");
  });
});

describe("user management authority", () => {
  const quettaUser = { role: "city_branch_admin", country_id: PK, country_branch_id: PK_MAIN, city_branch_id: QUETTA, operational_domain: "business" };
  const chamanUser = { role: "city_branch_admin", country_id: PK, country_branch_id: PK_MAIN, city_branch_id: CHAMAN_SHIP, operational_domain: "shipping" };
  const pkAdmin = { role: "country_admin", country_id: PK, country_branch_id: null, city_branch_id: null, operational_domain: "business" };
  const globalSA = { role: "super_admin", country_id: null, country_branch_id: null, city_branch_id: null, operational_domain: "both" };

  it("both domain super admins are user managers", () => {
    expect(isUserManager(businessSA)).toBe(true);
    expect(isUserManager(shippingSA)).toBe(true);
  });
  it("Business SA manages Business branch users only", () => {
    expect(userInManagerScope(businessSA, quettaUser)).toBe(true);
    expect(userInManagerScope(businessSA, chamanUser)).toBe(false);
    expect(userInManagerScope(businessSA, pkAdmin)).toBe(false);
    expect(userInManagerScope(businessSA, globalSA)).toBe(false);
  });
  it("Shipping SA manages Shipping branch users only", () => {
    expect(userInManagerScope(shippingSA, chamanUser)).toBe(true);
    expect(userInManagerScope(shippingSA, quettaUser)).toBe(false);
    expect(userInManagerScope(shippingSA, pkAdmin)).toBe(false);
  });
  it("creation: own domain + own branches only; Global-only roles refused", () => {
    expect(domainManagerTargetError(businessSA, { role: "city_branch_admin", operationalDomain: "business", cityBranchId: ALRAS })).toBeNull();
    expect(domainManagerTargetError(businessSA, { role: "agent_user", operationalDomain: "shipping", cityBranchId: CHAMAN_SHIP })).not.toBeNull();
    expect(domainManagerTargetError(businessSA, { role: "staff_user", operationalDomain: "business", cityBranchId: CHAMAN_SHIP })).not.toBeNull();
    expect(domainManagerTargetError(businessSA, { role: "staff_user", operationalDomain: "both", cityBranchId: QUETTA })).not.toBeNull();
    expect(domainManagerTargetError(businessSA, { role: "super_admin", operationalDomain: "business" })).not.toBeNull();
    expect(domainManagerTargetError(businessSA, { role: "country_admin", operationalDomain: "business" })).not.toBeNull();
    expect(domainManagerTargetError(businessSA, { role: "city_branch_admin", operationalDomain: "business", cityBranchId: QUETTA, accessProfile: "shipping_line" })).not.toBeNull();
    expect(domainManagerTargetError(shippingSA, { role: "agent_user", operationalDomain: "shipping", cityBranchId: CHAMAN_SHIP })).toBeNull();
    expect(domainManagerTargetError(shippingSA, { role: "staff_user", operationalDomain: "business", cityBranchId: QUETTA })).not.toBeNull();
    expect(domainManagerTargetError(shippingSA, { role: "main_branch_admin", operationalDomain: "shipping", countryBranchId: PK_MAIN })).not.toBeNull();
  });
});
