import { describe, expect, it } from "vitest";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";

// The permission set a login really holds = its role permissions (the session builder unions them the same way).
const open = (path: string, roles: string[], domains: string[] = ["business"]) =>
  evaluateRouteAccess({
    pathname: path,
    roles,
    permissions: roles.flatMap((r) => (enterpriseRolePermissions as Record<string, string[]>)[r] ?? []),
    operationalDomains: domains,
    canViewFinancials: true
  }).allowed;

const AUDIT_PAGES = ["/dashboard/audit-monitoring"];
const SUPER_ADMIN_ONLY = ["/dashboard/super-admin/edit-history", "/dashboard/super-admin/deleted-records", "/dashboard/reports/system-forms-directory"];

describe("the audit monitor is for audit-eligible roles only", () => {
  it("a normal user cannot open the audit monitor by direct URL", () => {
    for (const role of ["staff_user", "cashier", "agent_user", "accountant", "country_user"]) {
      for (const p of AUDIT_PAGES) expect(open(p, [role]), `${role} ${p}`).toBe(false);
    }
  });
  it("Super Admin, Country Admin, Main Branch Admin, Branch Admin and auditors can", () => {
    for (const role of ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "auditor_viewer", "super_admin_reports"]) {
      for (const p of AUDIT_PAGES) expect(open(p, [role]), `${role} ${p}`).toBe(true);
    }
  });
  it("the Shipping Line admins can open them too (their records are filtered to the Shipping domain by the APIs)", () => {
    expect(open("/dashboard/audit-monitoring", ["shipping_super_admin"], ["shipping"])).toBe(true);
  });
});

describe("edit history, deleted records and the system forms directory are Super Admin only", () => {
  it("every other role is refused, including the domain Super Admins, the auditors and the Country Admin", () => {
    for (const p of SUPER_ADMIN_ONLY) {
      expect(open(p, ["super_admin"]), p).toBe(true);
      for (const role of ["business_super_admin", "shipping_super_admin", "super_admin_reports", "auditor_viewer", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "staff_user", "shipping_line_admin"]) {
        expect(open(p, [role]), p + " " + role).toBe(false);
      }
    }
  });
});

describe("Business and Shipping reports stay on their own side", () => {
  it("a Shipping-only login does not open the Business report pages, a Business-only login does not open Shipping reports", () => {
    expect(open("/dashboard/reports/shipping", ["shipping_line_admin"], ["shipping"])).toBe(true);
    expect(open("/dashboard/reports/shipping", ["city_branch_admin"], ["business"])).toBe(false);
  });
  it("the report pages need reports:read - a login without it is refused", () => {
    expect(open("/dashboard/reports/payments", ["cashier"])).toBe(false);
    expect(open("/dashboard/reports/payments", ["accountant"])).toBe(true);
  });
});
