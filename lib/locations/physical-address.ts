/**
 * Client-safe helpers for physical address vs. assigned (access-scope) country.
 *
 * Bank, Warehouse, Company and Customer records carry two different countries:
 *  - `country_id`          — the ASSIGNED country: access scope, permissions, branch
 *                            numbering, ledger/currency context. Never moved by an address edit.
 *  - `address_country_id`  — the PHYSICAL address country from Location Management
 *                            (e.g. a bank branch in India for a UAE-assigned account).
 *
 * Legacy rows (written before `address_country_id` existed) used `country_id` for both;
 * they are read back with `country_id` as the address country only when they carry
 * saved geography, so a blank address never inherits the operational country.
 * Server-side enforcement lives in `lib/services/physical-address-scope.ts`.
 */

type GeoRow = {
  country_id?: string | null;
  address_country_id?: string | null;
  state_province_id?: string | null;
  district_id?: string | null;
  city_id?: string | null;
  area_id?: string | null;
  area_location_id?: string | null;
};

/** The country to show in the physical-address picker for an existing record. */
export function physicalAddressCountryId(row: GeoRow | null | undefined): string {
  if (!row) return "";
  if (row.address_country_id) return row.address_country_id;
  const hasLegacyPlace = Boolean(row.state_province_id || row.district_id || row.city_id || row.area_id || row.area_location_id);
  return hasLegacyPlace ? row.country_id ?? "" : "";
}

/** Country the geography validator must check the selected state/city against. */
export function geographyCountryForValidation(addressCountryId: string | null | undefined, assignedCountryId: string | null | undefined) {
  return addressCountryId || assignedCountryId || null;
}

/** True when an update payload would move the record to a different assigned country. */
export function isAssignedCountryChange(existingCountryId: string | null | undefined, requested: unknown): boolean {
  if (requested === undefined) return false;
  const next = typeof requested === "string" && requested.trim() ? requested.trim() : null;
  return next !== (existingCountryId ?? null);
}
