import { describe, expect, it } from "vitest";
import { visibleMenuHrefsFor, DAMAN_SIDEBAR_ITEMS } from "@/components/layout/digital-dock-premium-sidebar";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";

const transfer = "/dashboard/sales/sales-order";
const loading = "/dashboard/sales/sales-loading";

describe("Sales Booking transfer and loading navigation", () => {
  it("reuses the existing Sales Payment Transfer route under Sales Booking, not Local Sales", () => {
    const sections = DAMAN_SIDEBAR_ITEMS.flatMap((item) => item.children ?? []);
    expect(sections.find((item) => item.key === "sub-sales-booking")?.children?.filter((item) => item.href === transfer)).toHaveLength(1);
    expect(sections.find((item) => item.key === "sub-local-sales")?.children?.map((item) => item.href)).not.toContain(transfer);
  });

  it("names the Sales Loading menu separately and points it to the one existing register", () => {
    const sections = DAMAN_SIDEBAR_ITEMS.flatMap((item) => item.children ?? []);
    const menu = sections.find((item) => item.key === "sub-sales-loading");
    expect(menu?.label).toBe("Sales Loading");
    expect(menu?.href).toBeUndefined();
    expect(menu?.children?.map(({ label, href }) => ({ label, href }))).toEqual([{ label: "Sales Loading Register", href: loading }]);
  });

  for (const role of ["super_admin", "country_admin", "city_branch_admin"] as const) {
    it(`${role} gets a single transfer entry and a reachable loading register`, () => {
      const context = { operationalDomains: ["business" as const], canViewFinancials: true };
      const permissions = enterpriseRolePermissions[role];
      const links = visibleMenuHrefsFor([role], permissions, context);
      expect(links.filter((link) => link === transfer)).toHaveLength(1);
      expect(links.filter((link) => link === loading)).toHaveLength(1);
      expect(evaluateRouteAccess({ pathname: loading, permissions, roles: [role], ...context }).allowed).toBe(true);
    });
  }

  it("a shipping-only account cannot see or open the business transfer or loading pages", () => {
    const context = { operationalDomains: ["shipping" as const], canViewFinancials: true };
    const roles = ["shipping_line_user"];
    // Even an accidental grant must not cross an operational boundary.
    const permissions = [...enterpriseRolePermissions.shipping_line_user, "sales:read", "sales:update"];
    const links = visibleMenuHrefsFor(roles, permissions, context);
    for (const pathname of [transfer, loading]) {
      expect(links).not.toContain(pathname);
      expect(evaluateRouteAccess({ pathname, roles, permissions, ...context })).toMatchObject({ allowed: false, reason: "domain_blocked" });
    }
  });

  it("denies the financial register and its detail routes to an explicitly non-financial business login", () => {
    const context = { operationalDomains: ["business" as const], canViewFinancials: false };
    const roles = ["city_branch_admin"];
    const permissions = enterpriseRolePermissions.city_branch_admin;
    expect(visibleMenuHrefsFor(roles, permissions, context)).not.toContain(transfer);
    for (const pathname of [transfer, `${transfer}/view`]) {
      expect(evaluateRouteAccess({ pathname, roles, permissions, ...context })).toMatchObject({ allowed: false, reason: "financial_denied" });
    }
  });
});
