import { describe, expect, it, vi } from "vitest";
import type { ErpSession } from "@/lib/auth/session";
import { controlCheckSession, runControlChecks } from "@/lib/services/smart-operations-detectors";
import { recordInSessionScope } from "@/lib/api/scope-middleware";
vi.mock("@/lib/db/local-postgres", () => ({ withReadPg: vi.fn(async () => null) }));
function session(overrides: Partial<ErpSession> = {}): ErpSession {
  return { userId: "u", roles: ["staff_user"], permissions: ["reports:read"], assignments: [], countryIds: ["PK"],
    countryBranchIds: [], cityBranchIds: ["QUETTA"], canViewFinancials: true, isSuperAdmin: false,
    isGlobalScope: false, operationalDomains: ["business"], mobileProfile: "standard", ...overrides } as ErpSession;
}
describe("Smart Operations uses source-module access", () => {
  it("a report grant alone exposes neither finance nor HR nor shipment checks", () => {
    for (const code of ["unbalanced_entry", "overdue_receivable", "overdue_payable", "payroll_exception", "employee_document_expired", "eta_passed_no_update"]) {
      expect(controlCheckSession(session(), code)).toBeNull();
    }
  });
  it("requires every source for combined queries and financial field access", () => {
    expect(controlCheckSession(session({ permissions: ["purchases:read"] }), "missing_posting")).toBeNull();
    expect(controlCheckSession(session({ permissions: ["sales:read"], canViewFinancials: false }), "overdue_receivable")).toBeNull();
    expect(controlCheckSession(session({ permissions: ["sales:read"], operationalDomains: ["shipping"] }), "overdue_receivable")).toBeNull();
    expect(controlCheckSession(session({ permissions: ["roznamcha:read"], roles: ["shipping_super_admin"], operationalDomains: ["shipping"] }), "unbalanced_entry")).toBeNull();
  });
  it("narrows an allowed source to its real branch and preserves the caller session", () => {
    const original = session({ roles: ["city_branch_admin"], permissions: ["sales:read", "tasks:read"], cityBranchIds: ["QUETTA", "CHAMAN"], assignmentGrants: [
      { role: "city_branch_admin", permissions: ["sales:read"], countryIds: ["PK"], countryBranchIds: [], cityBranchIds: ["QUETTA"], assignment: {} },
      { role: "staff_user", permissions: ["tasks:read"], countryIds: ["PK"], countryBranchIds: [], cityBranchIds: ["CHAMAN"], assignment: {} },
    ] as any });
    const permitted = controlCheckSession(original, "overdue_receivable")!;
    expect(recordInSessionScope(permitted, { city_branch_id: "QUETTA" })).toBe(true);
    expect(recordInSessionScope(permitted, { city_branch_id: "CHAMAN" })).toBe(false);
    expect(original.cityBranchIds).toEqual(["QUETTA", "CHAMAN"]);
  });
  it("blocks agent/line aggregates until an agent/line partition is available", () => {
    expect(controlCheckSession(session({ permissions: ["shipping:read"], isShippingScoped: true }), "eta_passed_no_update")).toBeNull();
  });
  it("a missing database is unavailable, never a successful clean report", async () => {
    await expect(runControlChecks(session({ isSuperAdmin: true }))).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
  });
});

import { smartDueSourceSql } from "@/lib/services/smart-due-access";
function sql(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((a, s, i) => a + s + (i < values.length ? JSON.stringify(values[i]) : ""), "");
}
sql.unsafe = (name: string) => name;
describe("Smart Due summary and item scoping", () => {
  it("does not widen a branch assignment through its parent country", () => {
    const clause = smartDueSourceSql(sql, session({ permissions: ["sales:read"] }), "sales", "so");
    expect(clause).toContain("so.city_branch_id");
    expect(clause).toContain("QUETTA");
    expect(clause).not.toContain("so.country_id");
  });
  it("requires the source permission and keeps personal tasks private", () => {
    expect(smartDueSourceSql(sql, session(), "sales", "so")).toContain("FALSE");
    const clause = smartDueSourceSql(sql, session({ permissions: ["tasks:read"] }), "tasks", "ut");
    expect(clause).toContain("ut.assigned_to");
    expect(clause).toContain("ut.created_by");
  });
});
