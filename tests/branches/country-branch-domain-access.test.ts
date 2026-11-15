import { describe, expect, it } from "vitest";
import {
  countryBranchDomainAccess,
  isCountryBranchVisibleInDomain
} from "@/features/branches/lib/country-branch-domain-access";

describe("country main branch visibility in the Business and Shipping Lane modules", () => {
  it("a main branch is visible to both modules, whichever section it was approved under", () => {
    const businessMain = { operational_domain: "business", is_main: true, deleted_at: null };
    const shippingMain = { operational_domain: "shipping", is_main: true, deleted_at: null };
    expect(countryBranchDomainAccess(businessMain)).toEqual({ business: true, shipping: true });
    expect(countryBranchDomainAccess(shippingMain)).toEqual({ business: true, shipping: true });
  });

  it("a non-main row is visible only to its own section", () => {
    const businessRow = { operational_domain: "business", is_main: false, deleted_at: null };
    const shippingRow = { operational_domain: "shipping", is_main: false, deleted_at: null };
    expect(countryBranchDomainAccess(businessRow)).toEqual({ business: true, shipping: false });
    expect(countryBranchDomainAccess(shippingRow)).toEqual({ business: false, shipping: true });
  });

  it("a NULL section counts as business, matching the lookup filter", () => {
    expect(isCountryBranchVisibleInDomain({ operational_domain: null, is_main: false }, "business")).toBe(true);
    expect(isCountryBranchVisibleInDomain({ operational_domain: null, is_main: false }, "shipping")).toBe(false);
  });

  it("a soft-deleted row is never visible, even when it is a main branch", () => {
    const deleted = { operational_domain: "business", is_main: true, deleted_at: "2026-09-09T20:13:26.735Z" };
    expect(countryBranchDomainAccess(deleted)).toEqual({ business: false, shipping: false });
  });
});
