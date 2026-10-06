import { describe, expect, it } from "vitest";
import { hasPermission, systemRoles } from "@/lib/permissions/model";

describe("permission model", () => {
  it("allows accountants to post journals but not manage roles", () => {
    expect(hasPermission(systemRoles.accountant, "journal_entries:post")).toBe(true);
    expect(hasPermission(systemRoles.accountant, "roles:update")).toBe(false);
  });

  it("keeps viewer access read-only", () => {
    expect(hasPermission(systemRoles.viewer, "ledger:read")).toBe(true);
    expect(hasPermission(systemRoles.viewer, "journal_entries:update")).toBe(false);
  });

  it("scopes multi-country branch roles", () => {
    expect(hasPermission(systemRoles.superAdmin, "countries:create")).toBe(true);
    expect(hasPermission(systemRoles.superAdmin, "global_reports:export")).toBe(true);
    expect(hasPermission(systemRoles.countryAdmin, "city_branches:create")).toBe(true);
    expect(hasPermission(systemRoles.countryAdmin, "global_reports:read")).toBe(false);
    expect(hasPermission(systemRoles.branchAdmin, "transactions:post")).toBe(true);
    expect(hasPermission(systemRoles.staff, "reports:export")).toBe(false);
  });
});
