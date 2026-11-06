import { describe, expect, it } from "vitest";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import nextConfig from "@/next.config";

const path = "/dashboard/reports/exchange-rate";
describe("Chaman Shipping daily rate navigation", () => {
  it("redirects saved legacy links to the existing rate page", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toContainEqual({ source: "/dashboard/currency/daily-rates", destination: path, permanent: false });
  });
  it("allows a Shipping city admin with Roznamcha access to view shared rates", () => {
    expect(evaluateRouteAccess({ pathname: path, roles: ["city_branch_admin"], permissions: enterpriseRolePermissions.city_branch_admin, operationalDomains: ["shipping"], canViewFinancials: true }).allowed).toBe(true);
  });
  it("keeps the financial visibility restriction", () => {
    expect(evaluateRouteAccess({ pathname: path, roles: ["city_branch_admin"], permissions: ["roznamcha:read"], operationalDomains: ["shipping"], canViewFinancials: false }).allowed).toBe(false);
  });
  it("does not grant access without a rate or Roznamcha read permission", () => {
    expect(evaluateRouteAccess({ pathname: path, roles: ["staff"], permissions: ["dashboard:read"], operationalDomains: ["shipping"] }).allowed).toBe(false);
  });
  it("keeps business booking and ledger reports blocked for Shipping", () => {
    for (const pathname of ["/dashboard/purchase", "/dashboard/reports/journal", "/dashboard/reports/payments"]) {
      expect(evaluateRouteAccess({ pathname, roles: ["city_branch_admin"], permissions: enterpriseRolePermissions.city_branch_admin, operationalDomains: ["shipping"] }).allowed).toBe(false);
    }
  });
});
