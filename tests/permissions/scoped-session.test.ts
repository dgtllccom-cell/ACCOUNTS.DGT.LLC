import { describe, expect, it } from "vitest";
import type { ErpSession } from "@/lib/auth/session";
import { scopedSessionForPermission } from "@/lib/permissions/scoped-session";
import { sessionSqlScope } from "@/lib/api/scope-middleware";
import { controlCheckSession } from "@/lib/services/smart-operations-detectors";
const grant = (role: string, permissions: string[], branches: string[]) => ({ role, permissions, countryIds: ["PK"], countryBranchIds: [], cityBranchIds: branches, assignment: { role, operationalDomain: "business" } });
const session = () => ({
  userId: "u", roles: ["global_operations_admin", "accountant"], permissions: ["customers:read", "purchases:read", "sales:read"],
  isSuperAdmin: false, isGlobalScope: true, canViewFinancials: true, operationalDomains: ["business"], mobileProfile: "standard",
  countryIds: ["PK"], countryBranchIds: [], cityBranchIds: ["Q", "C"], assignments: [],
  assignmentGrants: [grant("global_operations_admin", ["customers:read"], ["Q", "C"]), grant("accountant", ["purchases:read", "sales:read"], ["Q"])],
} as unknown as ErpSession);
describe("audited SQL permissions stay tied to their assignment", () => {
  it("does not carry global scope from an operations assignment into branch finance", () => {
    const s = scopedSessionForPermission(session(), "purchases", "read");
    expect(s.isGlobalScope).toBe(false); expect(sessionSqlScope(s)).toMatchObject({ kind: "cityBranch", ids: ["Q"] });
  });
  it("does not carry financial-field access from an accountant into global operations", () => {
    const s = scopedSessionForPermission(session(), "customers", "read");
    expect(s.canViewFinancials).toBe(false);
  });
  it("cannot borrow a second permission after narrowing to a single assignment", () => {
    const s = scopedSessionForPermission(session(), "customers", "read");
    expect(() => scopedSessionForPermission(s, "sales", "read")).toThrow();
  });
  it("does not run a combined purchase/sales detector across disjoint grants", () => {
    const s = session(); s.isGlobalScope = false; s.assignmentGrants = [grant("accountant", ["purchases:read"], ["Q"]), grant("accountant", ["sales:read"], ["C"])] as any;
    expect(controlCheckSession(s, "missing_posting")).toBeNull();
  });
});
