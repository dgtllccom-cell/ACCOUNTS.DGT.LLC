/**
 * Server-side enforcement: an address edit must never move a record's assigned
 * (access-scope) country. See `lib/locations/physical-address.ts` for the model.
 */
import { ApiClientError } from "@/lib/api/response";
import { isAssignedCountryChange } from "@/lib/locations/physical-address";

export { geographyCountryForValidation, physicalAddressCountryId } from "@/lib/locations/physical-address";

export const ASSIGNED_COUNTRY_LOCKED = "ASSIGNED_COUNTRY_LOCKED";

/** Throws 409 when an update tries to move a record to a different assigned country. */
export function assertAssignedCountryUnchanged(existingCountryId: string | null | undefined, requested: unknown): void {
  if (isAssignedCountryChange(existingCountryId, requested)) {
    throw new ApiClientError("The assigned country controls access and cannot be changed from an address edit.", {
      status: 409, code: ASSIGNED_COUNTRY_LOCKED,
    });
  }
}
