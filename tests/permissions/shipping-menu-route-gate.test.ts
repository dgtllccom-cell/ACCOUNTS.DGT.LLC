import { describe, expect, it } from "vitest";
import { visibleMenuHrefsFor } from "@/components/layout/digital-dock-premium-sidebar";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";

/**
 * Menu and route gate share ONE policy: a link a login is shown must be a page the gate lets it open (no dead links), and a page
 * nobody mapped stays refused to the default-deny Shipping Line logins.
 */
describe("Shipping Line menus vs the route gate", () => {
  for (const role of ["shipping_line_user", "shipping_line_admin", "city_branch_admin"] as const) {
    it(`${role}: every visible menu entry is a page the route gate allows`, () => {
      const perms = enterpriseRolePermissions[role];
      const hrefs = visibleMenuHrefsFor([role], perms, { operationalDomains: ["shipping"], canViewFinancials: true });
      expect(hrefs.length).toBeGreaterThan(3);
      const dead = hrefs
        .map((h) => h.split("?")[0])
        .filter((h) => !evaluateRouteAccess({ pathname: h, permissions: perms, roles: [role], operationalDomains: ["shipping"], canViewFinancials: true }).allowed);
      expect(dead, `${role} is offered pages the gate refuses: ${dead.join(", ")}`).toEqual([]);
    });
  }

  it("the Branch Shipping Line user stays default-deny: an unmapped page is refused, the approved accounting pages are open", () => {
    const perms = enterpriseRolePermissions.shipping_line_user;
    const can = (pathname: string) => evaluateRouteAccess({ pathname, permissions: perms, roles: ["shipping_line_user"], operationalDomains: ["shipping"], canViewFinancials: true });
    expect(can("/dashboard/some-new-unmapped-page")).toMatchObject({ allowed: false, reason: "unmapped_denied" });
    expect(can("/dashboard/accounts/setup").allowed).toBe(true);
    expect(can("/dashboard/roznamcha/cash-entry").allowed).toBe(true);
    // approved bundle has no expenses / purchases / user administration
    expect(can("/dashboard/roznamcha/expenses-bill").allowed).toBe(false);
    expect(can("/dashboard/purchase/new-purchase-booking-order").allowed).toBe(false);
    expect(can("/dashboard/users").allowed).toBe(false);
  });

  it("the country-level shipping dashboard is not opened by dashboard:read alone (it shows a whole country)", () => {
    const decide = (roles: string[], permissions: string[]) => evaluateRouteAccess({ pathname: "/dashboard/country/shipping-line", permissions, roles, operationalDomains: ["shipping"], canViewFinancials: true }).allowed;
    expect(decide(["staff_user"], ["dashboard:read"])).toBe(false);
    expect(decide(["shipping_line_user"], enterpriseRolePermissions.shipping_line_user)).toBe(false);
    expect(decide(["city_branch_admin"], enterpriseRolePermissions.city_branch_admin)).toBe(false);
    expect(decide(["country_admin"], enterpriseRolePermissions.country_admin)).toBe(true);
    expect(decide(["country_operations_admin"], enterpriseRolePermissions.country_operations_admin)).toBe(true);
  });
});
