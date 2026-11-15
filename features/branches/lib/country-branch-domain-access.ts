/**
 * Which module can see a Country main branch.
 *
 * Mirrors the filter used by GET /api/branch-management/country-branches?operationalDomain=...:
 *   - business module: operational_domain = 'business' (or NULL), plus every main branch;
 *   - shipping module (Shipping Lane / clearing): operational_domain = 'shipping', plus every main branch;
 *   - a soft-deleted row is never visible.
 * A main branch is therefore visible to BOTH modules, which is the approval check for item 9.
 * Pure: no database and no fetch. The route uses it on the row it just saved.
 */

export type CountryBranchModuleDomain = "business" | "shipping";

export const COUNTRY_BRANCH_MODULE_DOMAINS: readonly CountryBranchModuleDomain[] = ["business", "shipping"];

export type CountryBranchVisibilityRow = {
  operational_domain?: string | null;
  is_main?: boolean | null;
  deleted_at?: string | null;
};

export function isCountryBranchVisibleInDomain(row: CountryBranchVisibilityRow, domain: CountryBranchModuleDomain): boolean {
  if (row.deleted_at) return false;
  if (row.is_main === true) return true;
  if (domain === "business") {
    return row.operational_domain == null || row.operational_domain === "business";
  }
  return row.operational_domain === "shipping";
}

/** Visibility for each module, in the order the modules are listed above. */
export function countryBranchDomainAccess(row: CountryBranchVisibilityRow): Record<CountryBranchModuleDomain, boolean> {
  return {
    business: isCountryBranchVisibleInDomain(row, "business"),
    shipping: isCountryBranchVisibleInDomain(row, "shipping")
  };
}
