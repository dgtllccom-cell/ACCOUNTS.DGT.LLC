import { describe, expect, it } from "vitest";
import { branchDomainAllowed, resolveScopedCityBranch } from "@/lib/permissions/branch-page-scope";
import type { ErpSession } from "@/lib/auth/session";

const session = (over: Partial<ErpSession>) => ({ isSuperAdmin: false, roles: ["city_branch_admin"], countryIds: ["PK"], countryBranchIds: ["PK-MAIN"], cityBranchIds: ["CHAMAN"], assignments: [], operationalDomains: ["shipping"], ...over }) as unknown as ErpSession;

describe("branch pages stay inside the login's own scope", () => {
  it("a branch login gets its own branch and can only ask for branches it may access", () => {
    expect(resolveScopedCityBranch(session({}), undefined)).toEqual({ branchId: "CHAMAN", denied: false });
    expect(resolveScopedCityBranch(session({}), "CHAMAN")).toEqual({ branchId: "CHAMAN", denied: false });
    expect(resolveScopedCityBranch(session({}), "QUETTA")).toEqual({ branchId: null, denied: true });
  });
  it("a Country Admin of another country is refused a foreign branch (its session list is its own country's branches)", () => {
    const uae = session({ roles: ["country_admin"], countryIds: ["UAE"], countryBranchIds: ["UAE-MAIN"], cityBranchIds: ["ALRAS", "DEIRA"] });
    expect(resolveScopedCityBranch(uae, "DEIRA").denied).toBe(false);
    expect(resolveScopedCityBranch(uae, "CHAMAN").denied).toBe(true);
  });
  it("a login with no branch gets NO branch (no first-branch-of-the-database fallback on the page)", () => {
    expect(resolveScopedCityBranch(session({ cityBranchIds: [], assignments: [] as never }), undefined)).toEqual({ branchId: null, denied: false });
  });
  it("only the Global Super Admin may ask for any branch", () => {
    expect(resolveScopedCityBranch(session({ isSuperAdmin: true, cityBranchIds: [] }), "ANY").denied).toBe(false);
  });
  it("a Business-only / Shipping-only login never opens a branch of the other domain", () => {
    expect(branchDomainAllowed(session({ operationalDomains: ["shipping"] }), "business")).toBe(false);
    expect(branchDomainAllowed(session({ operationalDomains: ["shipping"] }), "shipping")).toBe(true);
    expect(branchDomainAllowed(session({ operationalDomains: ["business"] }), "shipping")).toBe(false);
    expect(branchDomainAllowed(session({ operationalDomains: ["both"] }), "shipping")).toBe(true);
    expect(branchDomainAllowed(session({ operationalDomains: ["business", "shipping"] }), "business")).toBe(true);
    expect(branchDomainAllowed(session({ isSuperAdmin: true, operationalDomains: ["shipping"] }), "business")).toBe(true);
    expect(branchDomainAllowed(session({ operationalDomains: ["shipping"] }), "both")).toBe(true);
  });
});
