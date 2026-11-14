/**
 * Final Completion Checklist for the City Branch page. Every item is computed from the
 * entered or saved data passed in here; nothing defaults to "complete".
 */
import type { BranchChecklistStatus } from "@/features/branches/components/branch-final-review";

export type CityBranchLinkedUser = {
  role: string;
  operationalDomain: string | null;
  accessProfile: string | null;
  isActive: boolean;
};

export type CityBranchChecklistInput = {
  countryId: string;
  countryBranchId: string;
  operationalDomain: "business" | "shipping" | "";
  branchCategory: "business" | "clearing_agent" | "";
  branchName: string;
  branchCode: string;
  stateProvinceId: string;
  cityId: string;
  cityName: string;
  fullAddress: string;
  currency: string;
  companyId: string;
  ownerCustomerId: string | null;
  ownerProfileId: string | null;
  contacts: Array<{ type: string; value: string }>;
  /** Effective branch email (official prefix address or an email contact). */
  emailAddress: string;
  permissionGrants: string[];
  /** Saved branch id; empty while the branch has never been saved. */
  savedBranchId: string;
  /** Active role assignments that are bound to this saved branch. */
  linkedUsers: CityBranchLinkedUser[];
  /** Documents linked to this saved branch. */
  linkedDocumentCount: number;
  /** Live bank accounts owned by the selected company. */
  companyBankCount: number;
};

export type CityBranchChecklistResult = {
  status: Required<BranchChecklistStatus>;
  completed: number;
  total: number;
};

/** DB role codes that act as branch administrators for a city branch. */
export const CITY_BRANCH_ADMIN_ROLES = ["city_branch_admin", "branch_admin"] as const;

function isBranchAdminRole(role: string) {
  return (CITY_BRANCH_ADMIN_ROLES as readonly string[]).includes(role);
}

function hasPhoneContact(contacts: CityBranchChecklistInput["contacts"]) {
  return contacts.some((row) => {
    const type = (row.type || "").toLowerCase();
    return Boolean(row.value?.trim()) && (type.includes("mobile") || type.includes("phone") || type.includes("whatsapp"));
  });
}

export function evaluateCityBranchChecklist(input: CityBranchChecklistInput): CityBranchChecklistResult {
  const active = input.linkedUsers.filter((u) => u.isActive);
  const domain = input.operationalDomain;
  const hasSaved = Boolean(input.savedBranchId);

  const businessAdmin = active.some(
    (u) => isBranchAdminRole(u.role) && (u.operationalDomain === "business" || u.operationalDomain === "both")
  );
  const shippingAdmin = active.some(
    (u) => isBranchAdminRole(u.role) && (u.operationalDomain === "shipping" || u.operationalDomain === "both")
  );

  const base: Omit<Required<BranchChecklistStatus>, "approvalStatusReady"> = {
    countrySelected: Boolean(input.countryId),
    mainBranchSelected: Boolean(input.countryBranchId),
    branchNameCodeGenerated: Boolean(input.branchName.trim() && input.branchCode.trim()),
    branchCategoryType: Boolean(domain && input.branchCategory),
    ownerResponsiblePerson: Boolean(input.ownerCustomerId || input.ownerProfileId),
    companyLinked: Boolean(input.companyId),
    businessShippingDomain: Boolean(domain),
    fullAddressLocation: Boolean(input.stateProvinceId && input.cityId && input.cityName.trim() && input.fullAddress.trim()),
    mobileEmail: hasPhoneContact(input.contacts) && input.emailAddress.includes("@"),
    currencySelected: Boolean(input.currency),
    bankAccountSetup: Boolean(input.companyId) && input.companyBankCount > 0,
    userAdminAssigned: active.length > 0,
    rolePermissions: input.permissionGrants.length > 0,
    requiredDocumentsUploaded: input.linkedDocumentCount > 0,
    serialNumbersGenerated: hasSaved,
    businessAdminAssigned: businessAdmin,
    // Shipping/clearing administrator is only required for shipping-line branches.
    shippingClearingAdminAssigned: domain === "shipping" ? shippingAdmin : true,
    operationsAdminAssigned: active.some((u) => u.accessProfile === "operations" || isBranchAdminRole(u.role)),
    ledgerScopeConfirmed: hasSaved && Boolean(domain) && Boolean(input.countryBranchId)
  };

  // Approval is ready only when every other item is complete.
  const approvalStatusReady = Object.values(base).every(Boolean);
  const status = { ...base, approvalStatusReady };
  const values = Object.values(status);
  return {
    status,
    completed: values.filter(Boolean).length,
    total: values.length
  };
}
