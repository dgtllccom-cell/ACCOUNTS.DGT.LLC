import { describe, expect, it } from "vitest";
import { canAccessDocumentRow, canFileDocumentAt, documentDomainAllowed, isShippingDocument, mayDoDocumentAction } from "@/lib/documents/document-access";
import { NO_MATCH_ID, assertBusinessCrm, crmModuleFor, crmScopeIds } from "@/lib/crm/crm-access";
import { hrKycCaps } from "@/lib/services/hr-api";
import { maskIdentifier } from "@/lib/services/hr-kyc-service";

const PK = "11111111-1111-1111-1111-111111111111";
const AE = "22222222-2222-2222-2222-222222222222";
const PK_MAIN = "33333333-3333-3333-3333-333333333333";
const QUETTA = "44444444-4444-4444-4444-444444444444";
const CHAMAN = "55555555-5555-5555-5555-555555555555";

type Over = Record<string, unknown>;
const login = (roles: string[], over: Over = {}) =>
  ({
    userId: "99999999-9999-9999-9999-999999999999",
    isSuperAdmin: false,
    roles,
    permissions: [],
    operationalDomains: ["business"],
    countryIds: [],
    countryBranchIds: [],
    cityBranchIds: [],
    assignments: [],
    ...over
  }) as never;

// a branch-only assignment: the country list is EMPTY (the case the old routes treated as "no filter")
const quettaBranchAdmin = login(["city_branch_admin"], { cityBranchIds: [QUETTA], assignments: [{ countryId: PK, countryBranchId: PK_MAIN, cityBranchId: QUETTA }] });
const pkCountryAdmin = login(["country_admin"], { countryIds: [PK], assignments: [{ countryId: PK }] });
const superAdmin = { ...(login(["super_admin"]) as object), isSuperAdmin: true } as never;
const noScope = login(["country_admin"]);

describe("documents - a login with an EMPTY country list is scoped to its branch, never unfiltered", () => {
  const row = (over: Over) => ({ country_id: PK, country_branch_id: PK_MAIN, city_branch_id: QUETTA, module_type: "purchase", source_module: null, ...over });
  it("a branch-only login opens its own branch's document and nobody else's", () => {
    expect(canAccessDocumentRow(quettaBranchAdmin, row({}))).toBe(true);
    expect(canAccessDocumentRow(quettaBranchAdmin, row({ city_branch_id: CHAMAN }))).toBe(false);
    expect(canAccessDocumentRow(quettaBranchAdmin, row({ country_id: AE, country_branch_id: null, city_branch_id: null }))).toBe(false);
  });
  it("a document with no country / branch at all is global: Super Admin only", () => {
    const unscoped = row({ country_id: null, country_branch_id: null, city_branch_id: null });
    expect(canAccessDocumentRow(superAdmin, unscoped)).toBe(true);
    expect(canAccessDocumentRow(quettaBranchAdmin, unscoped)).toBe(false);
    expect(canAccessDocumentRow(pkCountryAdmin, unscoped)).toBe(false);
  });
  it("a country login reaches its country and no other", () => {
    expect(canAccessDocumentRow(pkCountryAdmin, row({}))).toBe(true);
    expect(canAccessDocumentRow(pkCountryAdmin, row({ country_id: AE }))).toBe(false);
  });
  it("a login holding no scope at all reaches nothing", () => {
    expect(canAccessDocumentRow(noScope, row({}))).toBe(false);
  });
  it("Business and Shipping Line documents stay apart", () => {
    const ship = row({ module_type: "shipping_order" });
    expect(isShippingDocument(ship)).toBe(true);
    expect(isShippingDocument(row({ module_type: "bills of lading" }))).toBe(true);
    expect(isShippingDocument(row({ module_type: "purchase" }))).toBe(false);
    expect(documentDomainAllowed(quettaBranchAdmin, ship)).toBe(false);
    const shippingBranch = login(["city_branch_admin"], { operationalDomains: ["shipping"], cityBranchIds: [QUETTA], assignments: [{ countryId: PK, countryBranchId: PK_MAIN, cityBranchId: QUETTA }] });
    expect(canAccessDocumentRow(shippingBranch, ship)).toBe(true);
    expect(canAccessDocumentRow(shippingBranch, row({ module_type: "purchase" }))).toBe(false);
  });
  it("a document can only be filed inside the uploader's own scope", () => {
    expect(canFileDocumentAt(quettaBranchAdmin, { country_id: PK, country_branch_id: PK_MAIN, city_branch_id: QUETTA, module_type: "purchase" })).toBe(true);
    expect(canFileDocumentAt(quettaBranchAdmin, { country_id: PK, country_branch_id: PK_MAIN, city_branch_id: CHAMAN, module_type: "purchase" })).toBe(false);
    expect(canFileDocumentAt(quettaBranchAdmin, { module_type: "purchase" })).toBe(false); // an unscoped filing place is a global document
    expect(canFileDocumentAt(superAdmin, { module_type: "purchase" })).toBe(true);
  });
  it("every action needs its documents:* permission", () => {
    // permissions are resolved from the role catalog at login and carried on the session
    const reader = login(["country_admin"], { permissions: ["documents:read"] });
    expect(mayDoDocumentAction(reader, "read")).toBe(true);
    expect(mayDoDocumentAction(reader, "delete")).toBe(false);
    expect(mayDoDocumentAction(login(["staff_user"]), "read")).toBe(false);
    expect(mayDoDocumentAction(login(["country_admin"], { permissions: ["documents:*"] }), "delete")).toBe(true);
    expect(mayDoDocumentAction(superAdmin, "delete")).toBe(true);
  });
});

describe("CRM scope fails closed", () => {
  it("Super Admin is unfiltered", () => {
    expect(crmScopeIds(superAdmin)).toEqual({ countries: [], branches: [] });
  });
  it("a login with no usable scope gets a scope that matches nothing", () => {
    expect(crmScopeIds(noScope).countries).toEqual([NO_MATCH_ID]);
  });
  it("a branch login keeps its own branch list, a country login its country list", () => {
    expect(crmScopeIds(quettaBranchAdmin)).toEqual({ countries: [], branches: [QUETTA] });
    expect(crmScopeIds(pkCountryAdmin)).toEqual({ countries: [PK], branches: [] });
  });
  it("a main-branch login with no city list fails closed instead of reading its whole country", () => {
    const mainOnly = login(["main_branch_admin"], { countryIds: [PK], countryBranchIds: [PK_MAIN], assignments: [{ countryId: PK, countryBranchId: PK_MAIN }] });
    expect(crmScopeIds(mainOnly).countries).toEqual([NO_MATCH_ID]);
  });
  it("Business CRM financials are closed to a Shipping-only login; its manual follow-ups belong to Shipping CRM", () => {
    const shippingOnly = login(["shipping_line_admin"], { operationalDomains: ["shipping"], cityBranchIds: [CHAMAN] });
    expect(() => assertBusinessCrm(shippingOnly)).toThrow();
    expect(crmModuleFor(shippingOnly)).toBe("shipping");
    expect(crmModuleFor(quettaBranchAdmin)).toBe("business");
  });
});

describe("Employee KYC - view, upload/edit and approve/reject are three different rights", () => {
  it("HR admin / manager hold all three", () => {
    for (const roles of [["hr_admin"], ["hr_manager"], ["country_admin"], ["main_branch_admin"], ["city_branch_admin"]]) {
      expect(hrKycCaps(login(roles))).toEqual({ ownOnly: false, upload: true, verify: true, identifiers: true });
    }
    expect(hrKycCaps(superAdmin)).toEqual({ ownOnly: false, upload: true, verify: true, identifiers: true });
  });
  it("accountants and payroll officers maintain documents but do not approve identity documents", () => {
    for (const roles of [["accountant"], ["payroll_officer"]]) {
      expect(hrKycCaps(login(roles))).toEqual({ ownOnly: false, upload: true, verify: false, identifiers: true });
    }
  });
  it("auditors and country users can view the register but never upload, approve, or see ID numbers", () => {
    for (const roles of [["auditor_viewer"], ["country_user"]]) {
      expect(hrKycCaps(login(roles))).toEqual({ ownOnly: false, upload: false, verify: false, identifiers: false });
    }
  });
  it("a normal user sees only their own profile and can neither upload nor approve", () => {
    for (const roles of [["staff_user"], ["cashier"], ["agent_user"], ["shipping_line_user"]]) {
      const c = hrKycCaps(login(roles));
      expect(c.ownOnly).toBe(true);
      expect(c.upload).toBe(false);
      expect(c.verify).toBe(false);
    }
  });
  it("identifiers are masked to the last four characters", () => {
    expect(maskIdentifier("AB1234567")).toBe("*****4567");
    expect(maskIdentifier("12")).toBe("****");
    expect(maskIdentifier("")).toBeNull();
    expect(maskIdentifier(null)).toBeNull();
  });
});
