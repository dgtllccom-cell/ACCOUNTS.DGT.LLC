import { describe, expect, it } from "vitest";
import { getAccountMissingRequirements } from "@/lib/kyc/account-completeness";

const completeCore = {
  name: "Branch Cash",
  code: "PK-CASH-001",
  currency: "PKR"
};

describe("QVC account completion queue", () => {
  it("keeps a QVC-pending account in action required", () => {
    expect(getAccountMissingRequirements({ ...completeCore, qvc_status: "qvc_pending" }))
      .toEqual(["qvc.pending"]);
  });

  it("keeps legacy accounts without a QVC decision in action required", () => {
    expect(getAccountMissingRequirements({ ...completeCore, qvc_status: null }))
      .toEqual(["qvc.pending"]);
  });

  it("recognizes review and error states without losing them from QVC", () => {
    expect(getAccountMissingRequirements({ ...completeCore, qvc_status: "needs_review" }))
      .toEqual(["qvc.needs_review"]);
    expect(getAccountMissingRequirements({ ...completeCore, qvc_status: "error" }))
      .toEqual(["qvc.error"]);
  });

  it("marks only an approved account with all core fields complete", () => {
    expect(getAccountMissingRequirements({ ...completeCore, qvc_status: "qvc_approved" }))
      .toEqual([]);
  });

  it("does not hide approved historical rows with missing core fields", () => {
    expect(getAccountMissingRequirements({ name: "", code: null, currency: "", qvc_status: "qvc_approved" }))
      .toEqual(["Missing Account Title", "Missing Account Code", "Missing Account Currency"]);
  });
});

