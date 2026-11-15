/**
 * Final Completion Checklist for the Country Main Branch page. Each of the 20 items is computed from
 * the entered or saved data passed in here. Nothing defaults to "complete" (the Country page used to
 * hard-code 14 of them as true, which produced an inconsistent total).
 */
import type { BranchChecklistStatus } from "@/features/branches/components/branch-final-review";
import type { CityBranchLinkedUser } from "@/features/branches/lib/city-branch-checklist";

export type CountryBranchChecklistInput = {
  countryId: string;
  operationalDomain: "business" | "shipping" | "";
  branchCategory: "business" | "clearing_agent" | "";
  /** Derived branch name ("<Country> Main Branch" / "<Country> Shipping Line Main Branch"). */
  branchName: string;
  branchCode: string;
  stateProvinceId: string;
  cityId: string;
  /** Street / full address line typed on the form. */
  address: string;
  currency: string;
  companyId: string;
  ownerCustomerId: string | null;
  ownerProfileId: string | null;
  contacts: Array<{ type: string; value: string }>;
  /** Branch email (required for the saved branch and its mailbox). */
  emailAddress: string;
  permissionGrants: string[];
  /** Saved branch id; empty while the branch has never been saved. */
  savedBranchId: string;
  /** Active role assignments bound to this saved main branch (direct, not city-level). */
  linkedUsers: CityBranchLinkedUser[];
  /** Documents linked to this saved branch. */
  linkedDocumentCount: number;
  /** Live bank accounts owned by the selected company. */
  companyBankCount: number;
};

export type CountryBranchChecklistResult = {
  status: Required<BranchChecklistStatus>;
  completed: number;
  total: number;
};

/** DB role codes that administer a Country main branch (assigned with country_branch_id, no city). */
export const COUNTRY_BRANCH_ADMIN_ROLES = ["main_branch_admin"] as const;

function isCountryAdminRole(role: string) {
  return (COUNTRY_BRANCH_ADMIN_ROLES as readonly string[]).includes(role);
}

function hasPhoneContact(contacts: CountryBranchChecklistInput["contacts"]) {
  return contacts.some((row) => {
    const type = (row.type || "").toLowerCase();
    return Boolean(row.value?.trim()) && (type.includes("mobile") || type.includes("phone") || type.includes("whatsapp"));
  });
}

export function evaluateCountryBranchChecklist(input: CountryBranchChecklistInput): CountryBranchChecklistResult {
  const active = input.linkedUsers.filter((u) => u.isActive);
  const domain = input.operationalDomain;
  const hasSaved = Boolean(input.savedBranchId);

  const businessAdmin = active.some(
    (u) => isCountryAdminRole(u.role) && (u.operationalDomain === "business" || u.operationalDomain === "both")
  );
  const shippingAdmin = active.some(
    (u) => isCountryAdminRole(u.role) && (u.operationalDomain === "shipping" || u.operationalDomain === "both")
  );

  const base: Omit<Required<BranchChecklistStatus>, "approvalStatusReady"> = {
    // The Country main is the root of its country: it is selected as soon as a country is.
    countrySelected: Boolean(input.countryId),
    mainBranchSelected: Boolean(input.countryId),
    branchNameCodeGenerated: Boolean(input.branchName.trim() && input.branchCode.trim()),
    branchCategoryType: Boolean(domain && input.branchCategory),
    ownerResponsiblePerson: Boolean(input.ownerCustomerId || input.ownerProfileId),
    companyLinked: Boolean(input.companyId),
    businessShippingDomain: Boolean(domain),
    fullAddressLocation: Boolean(input.stateProvinceId && input.cityId && input.address.trim()),
    mobileEmail: hasPhoneContact(input.contacts) && input.emailAddress.includes("@"),
    currencySelected: Boolean(input.currency),
    bankAccountSetup: Boolean(input.companyId) && input.companyBankCount > 0,
    userAdminAssigned: active.length > 0,
    rolePermissions: input.permissionGrants.length > 0,
    requiredDocumentsUploaded: input.linkedDocumentCount > 0,
    serialNumbersGenerated: hasSaved,
    // Each section needs its own administrator: a business main needs a business admin, a shipping main needs a shipping admin.
    // The other section's item is not applicable and counts as complete.
    businessAdminAssigned: domain === "shipping" ? true : businessAdmin,
    shippingClearingAdminAssigned: domain === "shipping" ? shippingAdmin : true,
    operationsAdminAssigned: active.some((u) => u.accessProfile === "operations" || isCountryAdminRole(u.role)),
    ledgerScopeConfirmed: hasSaved && Boolean(domain)
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
