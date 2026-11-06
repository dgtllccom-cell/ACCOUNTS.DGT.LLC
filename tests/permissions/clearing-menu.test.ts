import { describe, expect, it } from "vitest";
import { CLEARING_MENU_PATHS, CLEARING_MENU_MARKER, CLEARING_MENU_PERMISSIONS, capClearingMenuPermissions, clearingMenuAllowsApi, clearingAgentForWrite, clearingRecordAllowed } from "@/lib/permissions/clearing-menu";
import { visibleMenuHrefsFor } from "@/components/layout/digital-dock-premium-sidebar";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
const session = (extra = {}) => ({ isSuperAdmin: false, roles: ["city_operations_admin"], permissions: [...CLEARING_MENU_PERMISSIONS], countryIds: ["pk"], countryBranchIds: ["pk-main"], cityBranchIds: ["chaman"], clearingAgentIds: ["agent"], operationalDomains: ["shipping"], assignments: [{ countryId: "pk", countryBranchId: "pk-main", cityBranchId: "chaman" }], ...extra }) as any;
describe("assigned Clearing Agent menu boundary", () => {
  it("shows precisely the six authorized links and all route gates agree", () => {
    const s = session();
    expect(visibleMenuHrefsFor(s.roles, s.permissions, { operationalDomains: ["shipping"], canViewFinancials: false }).sort()).toEqual([...CLEARING_MENU_PATHS].sort());
    for (const pathname of CLEARING_MENU_PATHS) expect(evaluateRouteAccess({ ...s, pathname }).allowed).toBe(true);
  });
  it.each(["/dashboard", "/dashboard/shipping-line", "/dashboard/purchase", "/dashboard/roznamcha/cash-entry", "/dashboard/users", "/dashboard/accounts/setup", "/dashboard/clearing-agent/customer-order"])("denies unrelated page %s even with inherited wildcards", (pathname) => {
    expect(evaluateRouteAccess({ ...session({ permissions: [...CLEARING_MENU_PERMISSIONS, "*:*"] }), pathname }).allowed).toBe(false);
  });
  it("caps inherited permissions without changing any unmarked or global user", () => {
    expect(capClearingMenuPermissions([...CLEARING_MENU_PERMISSIONS, "*:*", "users:create", "roznamcha:post"], false)).toEqual([...CLEARING_MENU_PERMISSIONS]);
    expect(capClearingMenuPermissions(["*:*"], false)).toEqual(["*:*"]);
    expect(capClearingMenuPermissions([CLEARING_MENU_MARKER, "*:*"], true)).toContain("*:*");
    expect(() => authorizeApiScope(session({ permissions: [...CLEARING_MENU_PERMISSIONS, "*:*"] }), { resource: "roznamcha", action: "create" })).toThrow();
    expect(() => authorizeApiScope(session(), { resource: "shipping_records", action: "create", countryId: "pk", cityBranchId: "other" })).toThrow();
  });
  it("automatically binds saves to the existing agent and refuses foreign records", () => {
    expect(clearingAgentForWrite(session(), "")).toBe("agent");
    expect(() => clearingAgentForWrite(session(), "foreign")).toThrow();
    const row = { agent_id: "agent", country_id: "pk", country_branch_id: "pk-main", city_branch_id: "chaman" };
    expect(clearingRecordAllowed(session(), row)).toBe(true);
    expect(clearingRecordAllowed(session(), { ...row, agent_id: "foreign" })).toBe(false);
    expect(clearingRecordAllowed(session(), { ...row, city_branch_id: "quetta" })).toBe(false);
    expect(clearingRecordAllowed(session(), { ...row, country_id: null })).toBe(false);
    expect(clearingRecordAllowed(session({ permissions: [] }), { agent_id: "foreign" })).toBe(true);
  });
  it.each(["/api/erp/shipping-line/agent-entry", "/api/erp/clearing-agent/agent-custom-entry", "/api/erp/clearing-agent/payment-bill"])("permits authorized form reads and saves: %s", (path) => {
    expect(clearingMenuAllowsApi(path, "GET")).toBe(true);
    expect(clearingMenuAllowsApi(path, "POST")).toBe(true);
    expect(clearingMenuAllowsApi(path, "DELETE")).toBe(false);
  });
  it.each(["/api/erp/roznamcha", "/api/erp/clearing-agent/customer-order", "/api/erp/users", "/api/erp/shipping/bl-records/anything", "/api/erp/ledgers", "/api/erp/purchase/orders"])("denies sibling API %s", (path) => {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) expect(clearingMenuAllowsApi(path, method)).toBe(false);
  });
  it("keeps internal pickers read-only, never grants account or user management", () => {
    expect(clearingMenuAllowsApi("/api/erp/users/eligible-assignees", "GET")).toBe(true);
    expect(clearingMenuAllowsApi("/api/erp/users/eligible-assignees", "POST")).toBe(false);
    expect(clearingMenuAllowsApi("/api/erp/clearing-agents", "POST")).toBe(false);
    expect(clearingMenuAllowsApi("/api/erp/shipping/bl-records", "POST")).toBe(false);
    expect(clearingMenuAllowsApi("/api/erp/companies", "POST")).toBe(false);
  });
});
