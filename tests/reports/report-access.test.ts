import { describe, expect, it } from "vitest";
import {
  assertAuditAccess,
  assertSuperAdminOnly,
  auditTableVisible,
  canReadAudit,
  isShippingRecordTable,
  reportScopeLevel,
  sessionReportDomains
} from "@/lib/reports/report-access";

const login = (roles: string[], extra: Record<string, unknown> = {}) =>
  ({ isSuperAdmin: false, roles, permissions: [], operationalDomains: ["business"], ...extra }) as never;

describe("audit access - audit evidence is for audit-eligible roles only", () => {
  it("Super Admin, the domain Super Admins, country / main-branch / branch admins and auditors may read it", () => {
    for (const roles of [["super_admin_reports"], ["auditor_viewer"], ["business_super_admin"], ["shipping_super_admin"], ["country_admin"], ["main_branch_admin"], ["city_branch_admin"], ["shipping_line_admin"]]) {
      expect(canReadAudit(login(roles))).toBe(true);
    }
    expect(canReadAudit({ isSuperAdmin: true, roles: ["super_admin"], permissions: [] } as never)).toBe(true);
  });
  it("a normal user never reads the audit trail, however many report permissions it holds", () => {
    for (const roles of [["staff_user"], ["cashier"], ["agent_user"], ["accountant"], ["country_user"], ["shipping_line_user"]]) {
      const s = login(roles, { permissions: ["reports:read", "transactions:read", "ledgers:read"] });
      expect(canReadAudit(s)).toBe(false);
      expect(() => assertAuditAccess(s)).toThrow(/audit-eligible/);
    }
  });
  it("an explicit audit_logs:read grant is honoured", () => {
    expect(canReadAudit(login(["staff_user"], { permissions: ["audit_logs:read"] }))).toBe(true);
  });
});

describe("Business and Shipping audit records stay separate", () => {
  it("classifies the shipping record tables", () => {
    for (const t of ["clearing_customer_orders", "clearing_payment_bills", "clearing_bill_customer_charges", "customer_receipts", "shipping_lines"]) expect(isShippingRecordTable(t)).toBe(true);
    for (const t of ["enterprise_accounts", "customers", "companies", "goods", "banks", "purchase_orders", "sales_orders"]) expect(isShippingRecordTable(t)).toBe(false);
    expect(isShippingRecordTable(null)).toBe(false);
  });
  it("a Business login sees only Business tables, a Shipping login only Shipping tables, Super Admin both", () => {
    const biz = login(["city_branch_admin"], { operationalDomains: ["business"] });
    const ship = login(["shipping_line_admin"], { operationalDomains: ["shipping"] });
    const both = login(["country_admin"], { operationalDomains: ["both"] });
    expect(auditTableVisible(biz, "purchase_orders")).toBe(true);
    expect(auditTableVisible(biz, "clearing_customer_orders")).toBe(false);
    expect(auditTableVisible(ship, "clearing_customer_orders")).toBe(true);
    expect(auditTableVisible(ship, "purchase_orders")).toBe(false);
    expect(auditTableVisible(both, "purchase_orders") && auditTableVisible(both, "clearing_customer_orders")).toBe(true);
    expect(sessionReportDomains({ isSuperAdmin: true, roles: [], operationalDomains: ["business"] } as never)).toEqual({ business: true, shipping: true });
  });
});

describe("Super-Admin-only reports", () => {
  it("are closed to every other role, including the domain Super Admins", () => {
    expect(() => assertSuperAdminOnly({ isSuperAdmin: true, roles: ["super_admin"] } as never)).not.toThrow();
    for (const roles of [["business_super_admin"], ["shipping_super_admin"], ["super_admin_reports"], ["country_admin"], ["city_branch_admin"]]) {
      expect(() => assertSuperAdminOnly(login(roles))).toThrow(/Super Admin only/);
    }
  });
});

describe("report scope level (the Reports Center header and the scope badge)", () => {
  it("a Country Admin is Country level - never Branch", () => {
    expect(reportScopeLevel(login(["country_admin"]))).toBe("country");
    expect(reportScopeLevel(login(["country_operations_admin"]))).toBe("country");
  });
  it("global, main branch, branch and own", () => {
    expect(reportScopeLevel({ isSuperAdmin: true, roles: ["super_admin"] } as never)).toBe("global");
    expect(reportScopeLevel(login(["shipping_super_admin"]))).toBe("global");
    expect(reportScopeLevel(login(["main_branch_admin"]))).toBe("main_branch");
    expect(reportScopeLevel(login(["city_branch_admin"]))).toBe("branch");
    expect(reportScopeLevel(login(["shipping_line_admin"]))).toBe("branch");
    expect(reportScopeLevel(login(["staff_user"]))).toBe("own");
  });
});
