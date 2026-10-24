import { describe, expect, it } from "vitest";
import { canDelegateUserRole, isUserCreator, isUserManager, userCreationTargetError } from "@/lib/permissions/user-management-scope";
import { userCreateSchema } from "@/lib/api/erp-validation";
import { nameMatches } from "@/lib/utils/person-duplicate-match";

const city = {
  isSuperAdmin: false, roles: ["city_branch_admin"], permissions: ["users:create", "customers:read"],
  countryIds: ["PK"], countryBranchIds: ["PK-MAIN"], cityBranchIds: ["CHAMAN"], operationalDomains: ["shipping"],
  assignments: [{ role: "city_branch_admin", countryId: "PK", countryBranchId: "PK-MAIN", cityBranchId: "CHAMAN", operationalDomain: "shipping" }],
};
const target = { role: "staff_user", countryId: "PK", countryBranchId: "PK-MAIN", cityBranchId: "CHAMAN", operationalDomain: "shipping" };
const country = { ...city, roles: ["country_admin"], countryIds: ["UAE"], operationalDomains: ["business"],
  assignments: [{ role: "country_admin", countryId: "UAE", countryBranchId: null, cityBranchId: null, operationalDomain: "business" }] };

describe("delegated city staff creation", () => {
  it("allows scoped creation without enabling existing-user/password administration", () => {
    expect(isUserCreator(city)).toBe(true);
    expect(isUserManager(city)).toBe(false);
    expect(userCreationTargetError(city, target)).toBeNull();
  });
  it("requires an explicit creation grant", () => {
    expect(isUserCreator({ ...city, permissions: ["users:read"] })).toBe(false);
    expect(userCreationTargetError({ ...city, permissions: [] }, target)).not.toBeNull();
  });
  it.each(["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "country_user", "agent_user"])("rejects undelegated %s", (role) => {
    expect(userCreationTargetError(city, { ...target, role })).not.toBeNull();
  });
  it.each([{ countryId: "UAE" }, { cityBranchId: "QUETTA" }, { countryBranchId: "OTHER" }, { cityBranchId: null }, { operationalDomain: "business" }, { operationalDomain: "both" }, { accessProfile: "operations" }, { mode: "assign_scope" }])("rejects out-of-scope or administrative target %o", (patch) => {
    expect(userCreationTargetError(city, { ...target, ...patch })).not.toBeNull();
  });
  it("cannot combine a country from one assignment with the domain of another", () => {
    const combined = { ...city, countryIds: ["PK", "UAE"], operationalDomains: ["shipping", "business"], assignments: [
      ...city.assignments, { ...city.assignments[0], countryId: "UAE", cityBranchId: "ALRAS", operationalDomain: "business" },
    ] };
    expect(userCreationTargetError(combined, { ...target, operationalDomain: "business" })).not.toBeNull();
  });
});

describe("country creation delegation", () => {
  it.each(["city_branch_admin", "main_branch_admin", "staff_user"])("allows %s in the authorized country/domain", (role) => {
    expect(userCreationTargetError(country, { ...target, role, countryId: "UAE", cityBranchId: "ALRAS", operationalDomain: "business" })).toBeNull();
  });
  it.each(["super_admin", "country_admin", "super_admin_reports", "country_user"])("rejects %s", (role) => {
    expect(canDelegateUserRole(country, role)).toBe(false);
  });
  it("rejects another country and another domain", () => {
    expect(userCreationTargetError(country, target)).not.toBeNull();
    expect(userCreationTargetError(country, { ...target, countryId: "UAE" })).not.toBeNull();
  });
  it("does not infer authority from scope IDs without an assignment", () => {
    expect(userCreationTargetError({ ...country, assignments: [] }, { ...target, countryId: "UAE", operationalDomain: "business" })).not.toBeNull();
  });
});

describe("existing-login API contract", () => {
  it("accepts assign_scope without issuing a new login and rejects the former UI wire value", () => {
    const payload = { role: "staff_user", fullName: "Existing Person", assignExistingUserId: "existing-user-id" };
    expect(userCreateSchema.safeParse({ ...payload, mode: "assign_scope" }).success).toBe(true);
    expect(userCreateSchema.safeParse({ ...payload, mode: "use_existing" }).success).toBe(false);
  });
});

describe("person duplicate review across scripts", () => {
  it.each(["عصمت اللہ", "محمد أحمد", "عبدالله احمد", "عبدالله احمدی", "عبدالله خان"])("retains a match for %s", (name) => {
    expect(nameMatches(name, name)).toBe(true);
  });
  it("normalizes compatible Unicode and preserves Latin matching", () => {
    expect(nameMatches("ＡＳＭＡＴＵＬＬＡＨ", "Asmatullah")).toBe(true);
    expect(nameMatches("Asmat Ullah", "Asmatullah")).toBe(true);
  });
  it("does not equate unrelated names, empty values or punctuation", () => {
    expect(nameMatches("محمد أحمد", "عصمت اللہ")).toBe(false);
    expect(nameMatches("---", "...")).toBe(false);
    expect(nameMatches(null, "Ali")).toBe(false);
  });
});
