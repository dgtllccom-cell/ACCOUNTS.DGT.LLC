import { describe, expect, it } from "vitest";
import { evaluateCountryBranchChecklist, type CountryBranchChecklistInput } from "@/features/branches/lib/country-branch-checklist";

const SAVED_ID = "33333333-3333-4333-8333-333333333333";

/** Every field empty: a brand-new country draft that has not been saved. */
const EMPTY: CountryBranchChecklistInput = {
  countryId: "",
  operationalDomain: "",
  branchCategory: "",
  branchName: "",
  branchCode: "",
  stateProvinceId: "",
  cityId: "",
  address: "",
  currency: "",
  companyId: "",
  ownerCustomerId: null,
  ownerProfileId: null,
  contacts: [],
  emailAddress: "",
  permissionGrants: [],
  savedBranchId: "",
  linkedUsers: [],
  linkedDocumentCount: 0,
  companyBankCount: 0
};

/** Every real item filled for a business main, with one active main-branch admin. */
const COMPLETE_BUSINESS: CountryBranchChecklistInput = {
  countryId: "44444444-4444-4444-8444-444444444444",
  operationalDomain: "business",
  branchCategory: "business",
  branchName: "Pakistan Main Branch",
  branchCode: "PAK-MAIN-001",
  stateProvinceId: "66666666-6666-4666-8666-666666666666",
  cityId: "77777777-7777-4777-8777-777777777777",
  address: "Hazar Ganji, Quetta",
  currency: "PKR",
  companyId: "88888888-8888-4888-8888-888888888888",
  ownerCustomerId: "99999999-9999-4999-8999-999999999999",
  ownerProfileId: null,
  contacts: [{ type: "Mobile", value: "+92 300 0000000" }],
  emailAddress: "pak.main@example.com",
  permissionGrants: ["dashboard.access", "branch.new_entry"],
  savedBranchId: SAVED_ID,
  linkedUsers: [
    { role: "main_branch_admin", operationalDomain: "business", accessProfile: "", isActive: true }
  ],
  linkedDocumentCount: 1,
  companyBankCount: 2
};

describe("evaluateCountryBranchChecklist", () => {
  it("reports 1 of 20 for an empty draft: only the not-applicable shipping admin item counts", () => {
    const result = evaluateCountryBranchChecklist(EMPTY);
    expect(result.total).toBe(20);
    expect(result.completed).toBe(1);
    expect(result.status.countrySelected).toBe(false);
    expect(result.status.serialNumbersGenerated).toBe(false);
    expect(result.status.approvalStatusReady).toBe(false);
    expect(result.status.shippingClearingAdminAssigned).toBe(true);
  });

  it("reports 20 of 20 and approval ready when every real item is filled", () => {
    const result = evaluateCountryBranchChecklist(COMPLETE_BUSINESS);
    expect(result.total).toBe(20);
    expect(result.completed).toBe(20);
    expect(result.status.approvalStatusReady).toBe(true);
    expect(Object.values(result.status).every(Boolean)).toBe(true);
  });

  it("does not count bank setup when the company has no live bank account", () => {
    const result = evaluateCountryBranchChecklist({ ...COMPLETE_BUSINESS, companyBankCount: 0 });
    expect(result.status.bankAccountSetup).toBe(false);
    expect(result.status.approvalStatusReady).toBe(false);
    // Bank setup and the approval item (which needs every other item) are both incomplete.
    expect(result.completed).toBe(18);
    expect(result.total).toBe(20);
  });

  it("needs a saved record for serial number and ledger scope, even when the form is complete", () => {
    const result = evaluateCountryBranchChecklist({ ...COMPLETE_BUSINESS, savedBranchId: "" });
    expect(result.status.serialNumbersGenerated).toBe(false);
    expect(result.status.ledgerScopeConfirmed).toBe(false);
    expect(result.status.approvalStatusReady).toBe(false);
  });

  it("requires a Shipping Line administrator for a shipping main, and not for a business main", () => {
    const shippingWithoutAdmin = evaluateCountryBranchChecklist({
      ...COMPLETE_BUSINESS,
      operationalDomain: "shipping",
      branchCategory: "clearing_agent",
      linkedUsers: [{ role: "main_branch_admin", operationalDomain: "business", accessProfile: "", isActive: true }]
    });
    expect(shippingWithoutAdmin.status.shippingClearingAdminAssigned).toBe(false);

    const shippingWithAdmin = evaluateCountryBranchChecklist({
      ...COMPLETE_BUSINESS,
      operationalDomain: "shipping",
      branchCategory: "clearing_agent",
      linkedUsers: [{ role: "main_branch_admin", operationalDomain: "shipping", accessProfile: "", isActive: true }]
    });
    expect(shippingWithAdmin.status.shippingClearingAdminAssigned).toBe(true);
    expect(shippingWithAdmin.status.approvalStatusReady).toBe(true);
  });

  it("ignores inactive assignments and counts only active ones", () => {
    const result = evaluateCountryBranchChecklist({
      ...COMPLETE_BUSINESS,
      linkedUsers: [{ role: "main_branch_admin", operationalDomain: "business", accessProfile: "", isActive: false }]
    });
    expect(result.status.userAdminAssigned).toBe(false);
    expect(result.status.businessAdminAssigned).toBe(false);
    expect(result.status.approvalStatusReady).toBe(false);
  });

  it("requires the full address (state, city and street line) and a phone contact with an email", () => {
    expect(evaluateCountryBranchChecklist({ ...COMPLETE_BUSINESS, address: "   " }).status.fullAddressLocation).toBe(false);
    expect(evaluateCountryBranchChecklist({ ...COMPLETE_BUSINESS, cityId: "" }).status.fullAddressLocation).toBe(false);
    expect(evaluateCountryBranchChecklist({ ...COMPLETE_BUSINESS, contacts: [{ type: "Email", value: "x@y.z" }] }).status.mobileEmail).toBe(false);
    expect(evaluateCountryBranchChecklist({ ...COMPLETE_BUSINESS, emailAddress: "not-an-email" }).status.mobileEmail).toBe(false);
  });

  it("treats documents and permissions as real counts, not defaults", () => {
    const result = evaluateCountryBranchChecklist({ ...COMPLETE_BUSINESS, linkedDocumentCount: 0, permissionGrants: [] });
    expect(result.status.requiredDocumentsUploaded).toBe(false);
    expect(result.status.rolePermissions).toBe(false);
    expect(result.status.approvalStatusReady).toBe(false);
  });
});
