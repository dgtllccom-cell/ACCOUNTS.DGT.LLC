import { describe, expect, it } from "vitest";
import { capTruckTrialPermissions, isTruckTrial, TRUCK_TRIAL_HOME, TRUCK_TRIAL_MARKER, TRUCK_TRIAL_PERMISSIONS, truckTrialAllowsApi } from "@/lib/permissions/truck-trial";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { authorizeApiScope, sessionSqlScope } from "@/lib/api/scope-middleware";

const session = () => ({ isSuperAdmin: false, roles: ["staff_user"], permissions: [...TRUCK_TRIAL_PERMISSIONS],
  countryIds: ["pk"], countryBranchIds: ["pk-main"], cityBranchIds: ["chaman"],
  operationalDomains: ["shipping"], assignments: [{ countryId: "pk", countryBranchId: "pk-main", cityBranchId: "chaman" }] }) as any;

describe("Truck Registration trial perimeter", () => {
  it("opens the existing truck dashboard/register and rejects unrelated ERP pages", () => {
    expect(evaluateRouteAccess({ ...session(), pathname: TRUCK_TRIAL_HOME }).allowed).toBe(true);
    for (const pathname of ["/dashboard/super-admin", "/dashboard/accounts/setup", "/dashboard/crm", "/dashboard/reports/exchange-rate", "/dashboard/shipping-line", "/dashboard/clearing-agent/customer-order"]) {
      expect(evaluateRouteAccess({ ...session(), pathname }).allowed).toBe(false);
    }
  });
  it("does not restrict the Global Super Admin", () => {
    expect(isTruckTrial({ isSuperAdmin: true, permissions: [TRUCK_TRIAL_MARKER] })).toBe(false);
    expect(capTruckTrialPermissions(["*:*", TRUCK_TRIAL_MARKER], true)).toContain("*:*");
    expect(evaluateRouteAccess({ ...session(), roles: ["super_admin"], permissions: ["*:*", TRUCK_TRIAL_MARKER], pathname: "/dashboard/super-admin" }).allowed).toBe(true);
  });
  it("removes inherited wildcards, accounts, finance and user management grants", () => {
    const result = capTruckTrialPermissions([...TRUCK_TRIAL_PERMISSIONS, "*:*", "accounts:read", "users:create", "roznamcha:post"], false);
    expect(result).toEqual([...TRUCK_TRIAL_PERMISSIONS]);
    expect(() => authorizeApiScope({ ...session(), permissions: [...session().permissions, "*:*"] }, { resource: "roznamcha", action: "post" })).toThrow("Missing permission");
  });
  it("keeps the city-branch scope on truck writes and reports", () => {
    expect(sessionSqlScope(session())).toMatchObject({ kind: "cityBranch", ids: ["chaman"] });
    expect(() => authorizeApiScope(session(), { resource: "shipping_records", action: "create", countryId: "pk", cityBranchId: "other" })).toThrow();
    expect(() => authorizeApiScope(session(), { resource: "shipping_records", action: "create", countryId: "other" })).toThrow();
    expect(() => authorizeApiScope(session(), { resource: "shipping_records", action: "create", countryId: "pk", cityBranchId: "chaman" })).not.toThrow();
  });
  it.each(["/api/erp/master-data/trucks", "/api/erp/customers", "/api/erp/companies"])("allows only the required existing master collection create: %s", (path) => {
    expect(truckTrialAllowsApi(path, "POST")).toBe(true);
    expect(truckTrialAllowsApi(path, "DELETE")).toBe(false);
    expect(truckTrialAllowsApi(path + "/11111111-1111-4111-8111-111111111111", "PATCH")).toBe(false);
  });
  it.each(["/api/erp/roznamcha", "/api/erp/users", "/api/erp/ledgers", "/api/erp/clearing-agent/customer-order", "/api/erp/companies/not-an-id", "/api/erp/customers/11111111-1111-4111-8111-111111111111/accounts"])("rejects sibling and financial endpoints: %s", (path) => {
    expect(truckTrialAllowsApi(path, "GET")).toBe(false);
    expect(truckTrialAllowsApi(path, "POST")).toBe(false);
  });
});
