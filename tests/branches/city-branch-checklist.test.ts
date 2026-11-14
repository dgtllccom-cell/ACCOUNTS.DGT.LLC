import { describe, expect, it } from "vitest";
import { evaluateCityBranchChecklist, type CityBranchChecklistInput } from "@/features/branches/lib/city-branch-checklist";

const SAVED_ID = "33333333-3333-4333-8333-333333333333";

/** Every field empty: a brand-new, unsaved draft. */
const EMPTY: CityBranchChecklistInput = {
  countryId: "",
  countryBranchId: "",
  operationalDomain: "",
  branchCategory: "",
  branchName: "",
  branchCode: "",
  stateProvinceId: "",
  cityId: "",
  cityName: "",
  fullAddress: "",
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

/** Every real item filled, with one active branch admin for each required role. */
const COMPLETE: CityBranchChecklistInput = {
  countryId: "44444444-4444-4444-8444-444444444444",
  countryBranchId: "55555555-5555-4555-8555-555555555555",
  operationalDomain: "shipping",
  branchCategory: "clearing_agent",
  branchName: "Dubai Shipping & Clearing Branch",
  branchCode: "ARE-DXB-SHIP-01",
  stateProvinceId: "66666666-6666-4666-8666-666666666666",
  cityId: "77777777-7777-4777-8777-777777777777",
  cityName: "Dubai",
  fullAddress: "Shed 4, Jebel Ali Free Zone",
  currency: "AED",
  companyId: "88888888-8888-4888-8888-888888888888",
  ownerCustomerId: "99999999-9999-4999-8999-999999999999",
  ownerProfileId: null,
  contacts: [
    { type: "Mobile", value: "+971500000010" },
    { type: "Email", value: "dxb-ship@dgt.llc" }
  ],
  emailAddress: "dxb-ship@dgt.llc",
  permissionGrants: ["city.view", "city.edit"],
  savedBranchId: SAVED_ID,
  linkedUsers: [
    { role: "city_branch_admin", operationalDomain: "shipping", accessProfile: "shipping_line", isActive: true },
    { role: "branch_admin", operationalDomain: "business", accessProfile: "operations", isActive: true }
  ],
  linkedDocumentCount: 2,
  companyBankCount: 1
};

describe("evaluateCityBranchChecklist", () => {
  it("empty draft: only the shipping-admin rule passes, because it does not apply without a shipping section", () => {
    const result = evaluateCityBranchChecklist(EMPTY);
    expect(result.total).toBe(20);
    expect(result.status.countrySelected).toBe(false);
    expect(result.status.mainBranchSelected).toBe(false);
    expect(result.status.branchNameCodeGenerated).toBe(false);
    expect(result.status.ownerResponsiblePerson).toBe(false);
    expect(result.status.companyLinked).toBe(false);
    expect(result.status.fullAddressLocation).toBe(false);
    expect(result.status.mobileEmail).toBe(false);
    expect(result.status.currencySelected).toBe(false);
    expect(result.status.bankAccountSetup).toBe(false);
    expect(result.status.userAdminAssigned).toBe(false);
    expect(result.status.rolePermissions).toBe(false);
    expect(result.status.requiredDocumentsUploaded).toBe(false);
    expect(result.status.serialNumbersGenerated).toBe(false);
    expect(result.status.ledgerScopeConfirmed).toBe(false);
    expect(result.status.approvalStatusReady).toBe(false);
    // Not applicable to a draft without a shipping section: the rule is only required for shipping branches.
    expect(result.status.shippingClearingAdminAssigned).toBe(true);
    expect(result.completed).toBe(1);
  });

  it("complete shipping branch: every item is complete, approval is ready", () => {
    const result = evaluateCityBranchChecklist(COMPLETE);
    expect(result.completed).toBe(result.total);
    expect(Object.values(result.status).every(Boolean)).toBe(true);
  });

  it("incomplete saved branch: no shipping admin, no documents, no bank account, no owner", () => {
    const result = evaluateCityBranchChecklist({
      ...COMPLETE,
      ownerCustomerId: null,
      linkedUsers: [{ role: "branch_admin", operationalDomain: "business", accessProfile: "", isActive: true }],
      linkedDocumentCount: 0,
      companyBankCount: 0
    });
    expect(result.status.ownerResponsiblePerson).toBe(false);
    expect(result.status.shippingClearingAdminAssigned).toBe(false);
    expect(result.status.businessAdminAssigned).toBe(true);
    expect(result.status.requiredDocumentsUploaded).toBe(false);
    expect(result.status.bankAccountSetup).toBe(false);
    expect(result.status.approvalStatusReady).toBe(false);
    expect(result.completed).toBeLessThan(result.total);
  });

  it("business branch: the shipping/clearing admin rule is not applicable and counts as complete", () => {
    const result = evaluateCityBranchChecklist({
      ...COMPLETE,
      operationalDomain: "business",
      branchCategory: "business",
      linkedUsers: [{ role: "city_branch_admin", operationalDomain: "business", accessProfile: "operations", isActive: true }]
    });
    expect(result.status.shippingClearingAdminAssigned).toBe(true);
    expect(result.status.businessAdminAssigned).toBe(true);
  });

  it("inactive assignments do not count as assigned users or admins", () => {
    const result = evaluateCityBranchChecklist({
      ...COMPLETE,
      linkedUsers: [{ role: "city_branch_admin", operationalDomain: "shipping", accessProfile: "operations", isActive: false }]
    });
    expect(result.status.userAdminAssigned).toBe(false);
    expect(result.status.operationsAdminAssigned).toBe(false);
    expect(result.status.shippingClearingAdminAssigned).toBe(false);
  });

  it("mobile/email: needs a phone-type contact and an email address; repeated values are not a failure", () => {
    const noPhone = evaluateCityBranchChecklist({ ...COMPLETE, contacts: [{ type: "Email", value: "a@dgt.llc" }] });
    expect(noPhone.status.mobileEmail).toBe(false);
    const repeated = evaluateCityBranchChecklist({
      ...COMPLETE,
      contacts: [
        { type: "Mobile", value: "+971500000010" },
        { type: "WhatsApp", value: "+971500000010" }
      ],
      emailAddress: "dxb-ship@dgt.llc"
    });
    expect(repeated.status.mobileEmail).toBe(true);
  });

  it("address needs state, city and the full address together", () => {
    expect(evaluateCityBranchChecklist({ ...COMPLETE, fullAddress: "   " }).status.fullAddressLocation).toBe(false);
    expect(evaluateCityBranchChecklist({ ...COMPLETE, stateProvinceId: "" }).status.fullAddressLocation).toBe(false);
  });

  it("ledger scope and serial number only count once the branch is saved", () => {
    const draft = evaluateCityBranchChecklist({ ...COMPLETE, savedBranchId: "" });
    expect(draft.status.serialNumbersGenerated).toBe(false);
    expect(draft.status.ledgerScopeConfirmed).toBe(false);
    expect(draft.status.approvalStatusReady).toBe(false);
  });
});
