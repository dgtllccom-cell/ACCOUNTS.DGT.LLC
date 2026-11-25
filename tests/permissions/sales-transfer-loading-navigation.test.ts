import { describe, expect, it } from "vitest";
import { visibleMenuHrefsFor, DAMAN_SIDEBAR_ITEMS } from "@/components/layout/digital-dock-premium-sidebar";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";

const transfer = "/dashboard/sales/sales-order";
const optedInTransfer = `${transfer}?transfer=1`;
const loading = "/dashboard/sales/sales-loading";
const localTransfer = `${optedInTransfer}&source=local`;
const localLoading = `${loading}?source=local`;

describe("Sales Booking transfer and loading navigation", () => {
  it("puts Transfer and Loading directly below New Sales Booking, preserving the old Local Sales link", () => {
    const sections = DAMAN_SIDEBAR_ITEMS.find((item) => item.key === "purchase-sales-trade")?.children ?? [];
    const booking = sections.find((item) => item.key === "sub-sales-booking");
    expect(booking?.children?.slice(0, 3).map(({ label, href }) => [label, href])).toEqual([
      ["New Sales Booking Order", "/dashboard/sales/new-sales-booking-order"],
      ["Sales Transfer Payment", optedInTransfer],
      ["Sales Loading", loading],
    ]);
    expect(booking?.children?.map((item) => item.href)).not.toContain(transfer);
    expect(sections.some((item) => [optedInTransfer, loading].includes(item.href ?? ""))).toBe(false);
    expect(sections.find((item) => item.key === "sub-local-sales")?.children?.filter((item) => item.href === transfer)).toHaveLength(1);
  });

  it("keeps both Local Sales functions immediately below the Local Sales Order link", () => {
    const trade = DAMAN_SIDEBAR_ITEMS.find((item) => item.key === "purchase-sales-trade");
    expect(trade?.children?.find(item => item.key === "sub-local-sales")?.children?.map(item => item.href)).toEqual([
      "/dashboard/sales/local-sales", localTransfer, localLoading, transfer,
    ]);
  });

  for (const role of ["super_admin", "country_admin", "city_branch_admin"] as const) {
    it(`${role} gets the distinct transfer register, the untouched legacy link and one loading register`, () => {
      const context = { operationalDomains: ["business" as const], canViewFinancials: true };
      const permissions = enterpriseRolePermissions[role];
      const links = visibleMenuHrefsFor([role], permissions, context);
      expect(links.filter((link) => link === transfer)).toHaveLength(1);
      expect(links.filter((link) => link === optedInTransfer)).toHaveLength(1);
      expect(links.filter((link) => link === loading)).toHaveLength(1);
      expect(links.filter((link) => link === localTransfer)).toHaveLength(1);
      expect(links.filter((link) => link === localLoading)).toHaveLength(1);
      expect(evaluateRouteAccess({ pathname: loading, permissions, roles: [role], ...context }).allowed).toBe(true);
    });
  }

  it("a shipping-only account cannot see or open the business transfer or loading pages", () => {
    const context = { operationalDomains: ["shipping" as const], canViewFinancials: true };
    const roles = ["shipping_line_user"];
    // Even an accidental grant must not cross an operational boundary.
    const permissions = [...enterpriseRolePermissions.shipping_line_user, "sales:read", "sales:update"];
    const links = visibleMenuHrefsFor(roles, permissions, context);
    expect(links).not.toContain(optedInTransfer);
    expect(links).not.toContain(localTransfer);
    expect(links).not.toContain(localLoading);
    for (const pathname of [transfer, loading]) {
      expect(links).not.toContain(pathname);
      expect(evaluateRouteAccess({ pathname, roles, permissions, ...context })).toMatchObject({ allowed: false, reason: "domain_blocked" });
    }
  });

  it("preserves legacy Sales Order Management route access for a non-financial business login", () => {
    const context = { operationalDomains: ["business" as const], canViewFinancials: false };
    const roles = ["city_branch_admin"];
    const permissions = enterpriseRolePermissions.city_branch_admin;
    const links = visibleMenuHrefsFor(roles, permissions, context);
    expect(links).toContain(transfer);
    expect(links).toContain(loading);
    expect(links).not.toContain(optedInTransfer);
    expect(links).not.toContain(localTransfer);
    expect(links).toContain(localLoading);
    for (const pathname of [transfer, `${transfer}/view`]) {
      expect(evaluateRouteAccess({ pathname, roles, permissions, ...context })).toMatchObject({ allowed: true });
    }
  });
  it("does not offer transfer to a financial employee with only legacy route/create permission", () => {
    const context = { operationalDomains: ["business" as const], canViewFinancials: true };
    const links = visibleMenuHrefsFor(["city_branch_admin"], ["sales:create", `route:${transfer}`], context);
    expect(links).toContain(transfer);
    expect(links).not.toContain(optedInTransfer);
  });
  it("does not leak the opt-in register to a shipping-only assignment with a wildcard grant", () => {
    const links = visibleMenuHrefsFor(["shipping_line_user"], ["*:*"], { operationalDomains: ["shipping"], canViewFinancials: true });
    expect(links).not.toContain(optedInTransfer);
  });
});
