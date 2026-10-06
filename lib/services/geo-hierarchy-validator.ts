import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";

/**
 * Enforces the Country → State/Province → District → City → Area/Location master-data
 * hierarchy on the BACKEND — the only place it can actually be trusted. The frontend
 * cascading selects (LocationHierarchySelect) already prevent a user from picking an
 * incompatible combination in the UI, but that is presentation only; an API caller (a
 * stale form, a bug, a direct request) could still send an inconsistent set of ids.
 *
 * Used by Customer Management and Company Management (and any future module that
 * captures Country/State/District/City) so "Country = Afghanistan, State = Dubai" can
 * never be saved, no matter how the request was made.
 *
 * Throws ApiClientError (400) with a clear message; callers should let it propagate
 * to handleApiError. A `null`/`undefined` field is simply not checked (optional geo
 * fields stay optional) — only a field that IS provided must belong to its parent.
 */
export type GeoHierarchyInput = {
  countryId?: string | null;
  stateProvinceId?: string | null;
  districtId?: string | null;
  cityId?: string | null;
  areaLocationId?: string | null;
};

export async function assertGeoHierarchy(input: GeoHierarchyInput): Promise<void> {
  const countryId = input.countryId || null;
  const stateProvinceId = input.stateProvinceId || null;
  const districtId = input.districtId || null;
  const cityId = input.cityId || null;
  const areaLocationId = input.areaLocationId || null;

  if (!stateProvinceId && !districtId && !cityId && !areaLocationId) return; // nothing to check

  const rows = await withLocalPg(async (sql) => {
    const [sp] = stateProvinceId
      ? await sql`select id, country_id, name from public.states_provinces where id = ${stateProvinceId}::uuid`
      : [null];
    const [di] = districtId
      ? await sql`select id, country_id, state_province_id, name from public.districts where id = ${districtId}::uuid`
      : [null];
    const [ci] = cityId
      ? await sql`select id, country_id, state_province_id, district_id, name from public.cities where id = ${cityId}::uuid`
      : [null];
    const [ar] = areaLocationId
      ? await sql`select id, country_id, state_province_id, district_id, city_id, name from public.areas_locations where id = ${areaLocationId}::uuid`
      : [null];
    return { sp, di, ci, ar };
  });
  if (!rows) return;
  const { sp, di, ci, ar } = rows as any;

  if (stateProvinceId) {
    if (!sp) throw new ApiClientError("Selected State/Province was not found.", { status: 400, code: "GEO_INVALID_STATE" });
    if (countryId && sp.country_id !== countryId) {
      throw new ApiClientError(
        `State/Province "${sp.name}" does not belong to the selected country.`,
        { status: 400, code: "GEO_STATE_COUNTRY_MISMATCH" },
      );
    }
  }
  if (districtId) {
    if (!di) throw new ApiClientError("Selected District was not found.", { status: 400, code: "GEO_INVALID_DISTRICT" });
    if (countryId && di.country_id !== countryId) {
      throw new ApiClientError(`District "${di.name}" does not belong to the selected country.`, { status: 400, code: "GEO_DISTRICT_COUNTRY_MISMATCH" });
    }
    if (stateProvinceId && di.state_province_id && di.state_province_id !== stateProvinceId) {
      throw new ApiClientError(`District "${di.name}" does not belong to the selected State/Province.`, { status: 400, code: "GEO_DISTRICT_STATE_MISMATCH" });
    }
  }
  if (cityId) {
    if (!ci) throw new ApiClientError("Selected City was not found.", { status: 400, code: "GEO_INVALID_CITY" });
    if (countryId && ci.country_id !== countryId) {
      throw new ApiClientError(`City "${ci.name}" does not belong to the selected country.`, { status: 400, code: "GEO_CITY_COUNTRY_MISMATCH" });
    }
    if (stateProvinceId && ci.state_province_id && ci.state_province_id !== stateProvinceId) {
      throw new ApiClientError(`City "${ci.name}" does not belong to the selected State/Province.`, { status: 400, code: "GEO_CITY_STATE_MISMATCH" });
    }
    if (districtId && ci.district_id && ci.district_id !== districtId) {
      throw new ApiClientError(`City "${ci.name}" does not belong to the selected District.`, { status: 400, code: "GEO_CITY_DISTRICT_MISMATCH" });
    }
  }
  if (areaLocationId) {
    if (!ar) throw new ApiClientError("Selected Area/Location was not found.", { status: 400, code: "GEO_INVALID_AREA" });
    if (countryId && ar.country_id && ar.country_id !== countryId) {
      throw new ApiClientError(`Area/Location "${ar.name}" does not belong to the selected country.`, { status: 400, code: "GEO_AREA_COUNTRY_MISMATCH" });
    }
    if (cityId && ar.city_id && ar.city_id !== cityId) {
      throw new ApiClientError(`Area/Location "${ar.name}" does not belong to the selected City.`, { status: 400, code: "GEO_AREA_CITY_MISMATCH" });
    }
  }
}
