/**
 * Permission grants of a saved Country main branch, prepared for the form.
 *
 * The save API accepts only catalog group keys (allPermissionGroupKeys). Some saved rows hold the
 * expanded "resource:action" form (for example "shipping:read"), which the catalog cannot map back
 * to a group without widening access, so those are reported and NOT carried into the form.
 * A row with no valid grant gets the template's grants pre-selected and is flagged, so the user
 * reviews them before saving; nothing is written until the user saves.
 */
import { allPermissionGroupKeys, getPermissionKeysForTemplate } from "@/lib/permissions/catalog";

export const COUNTRY_DEFAULT_PERMISSION_TEMPLATE = "country-standard";

export type CountryGrantsForForm = {
  grants: string[];
  /** Stored keys that the catalog does not recognise (kept out of the form). */
  unrecognised: string[];
  /** True when no valid grant was stored and the template defaults were pre-selected. */
  prefilled: boolean;
};

export function countryGrantsForForm(stored: unknown, template: string | null | undefined): CountryGrantsForForm {
  const valid = new Set(allPermissionGroupKeys());
  const list = Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  const grants: string[] = [];
  const unrecognised: string[] = [];
  for (const key of list) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    if (valid.has(trimmed)) {
      if (!grants.includes(trimmed)) grants.push(trimmed);
    } else if (!unrecognised.includes(trimmed)) {
      unrecognised.push(trimmed);
    }
  }
  if (grants.length > 0) return { grants, unrecognised, prefilled: false };
  const defaults = getPermissionKeysForTemplate(template || COUNTRY_DEFAULT_PERMISSION_TEMPLATE);
  return { grants: [...defaults], unrecognised, prefilled: true };
}
