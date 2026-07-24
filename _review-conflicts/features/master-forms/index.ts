/**
 * Master Forms — Single Source of Data
 *
 * This barrel file re-exports every Master Form picker and API helper
 * so that ANY future module can integrate with one import line:
 *
 *   import {
 *     LocationHierarchySelect,
 *     CustomerPicker,
 *     CompanyPicker,
 *     BankPicker,
 *     listCountries,
 *     listStates,
 *     listCities,
 *     listAreas,
 *   } from "@/features/master-forms";
 *
 * ─────────────────────────────────────────────────────────────────
 *  RULE: Data is entered ONCE in a Master Form and reused everywhere.
 *  Never create a free-text input for Country, Company, Customer,
 *  or Bank — always use the corresponding picker from this module.
 * ─────────────────────────────────────────────────────────────────
 */

// ── Location Master ──────────────────────────────────────────────
export {
  LocationHierarchySelect,
  type LocationHierarchyValue,
  type LocationHierarchyMeta,
} from "@/features/locations/components/location-hierarchy-select";

export {
  listCountries,
  listStates,
  listCities,
  listAreas,
  type LocationCountry,
  type LocationState,
  type LocationCity,
  type LocationArea,
} from "@/features/locations/location-api";

// ── Company Master ───────────────────────────────────────────────
export { CompanyPicker } from "@/features/companies/components/company-picker";

// ── Bank Master (Dedicated Bank Database) ────────────────────────────
// BankPicker queries /api/erp/banks (NOT companies).
// Search: bank name, account title, account number, branch name, branch code.
export { BankPicker } from "@/features/banks/components/bank-picker";
export { BankForm }  from "@/features/banks/components/bank-form";
export {
  listBanks,
  getBankById,
  createBank,
  type BankRecord,
} from "@/features/banks/bank-api";

// ── Customer Master ──────────────────────────────────────────────
export { CustomerPicker } from "@/features/customers/components/customer-picker";

// ── Branch Owner Picker (Customer or ERP User) ───────────────────
export { BranchOwnerPicker } from "@/features/branches/components/branch-owner-picker";
