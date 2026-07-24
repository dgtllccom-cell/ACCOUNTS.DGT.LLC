import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findLocationMasterCountry, type LocationMasterCountry } from "@/lib/locations/location-master-data";

function normalizeCountryName(name: string) {
  if (name.trim().toLowerCase() === "uae") return "United Arab Emirates";
  return name.trim();
}

async function upsertCountry(country: LocationMasterCountry) {
  const supabase = createSupabaseAdminClient() as any;

  const { data: countryRows, error: findError } = await supabase
    .from("countries")
    .select("id, name, iso2, iso3, currency_code")
    .is("deleted_at", null);
  if (findError) throw new Error(findError.message);

  const existing = (countryRows ?? []).find((row: any) => {
    const name = String(row.name ?? "").trim().toLowerCase();
    const iso2 = String(row.iso2 ?? "").trim().toUpperCase();
    const iso3 = String(row.iso3 ?? "").trim().toUpperCase();
    return (
      name === country.name.toLowerCase() ||
      (country.iso3 === "ARE" && name === "uae") ||
      iso2 === country.iso2 ||
      iso3 === country.iso3
    );
  });

  if (existing?.id) {
    const { data, error } = await supabase
      .from("countries")
      .update({
        name: normalizeCountryName(existing.name || country.name),
        iso2: country.iso2,
        iso3: country.iso3,
        currency_code: country.currencyCode,
        phone_code: country.phoneCode,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  const { data, error } = await supabase
    .from("countries")
    .insert({
      name: country.name,
      iso2: country.iso2,
      iso3: country.iso3,
      currency_code: country.currencyCode,
      phone_code: country.phoneCode,
      default_language_code: "en",
      official_email: `official@dgt.${country.iso2.toLowerCase()}`,
      admin_email: `admin@dgt.${country.iso2.toLowerCase()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function upsertByName(table: string, match: Record<string, string>, patch: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient() as any;
  let query = supabase.from(table).select("id");
  for (const [key, value] of Object.entries(match)) query = query.eq(key, value);
  const { data: existing, error: findError } = await query.is("deleted_at", null).maybeSingle();
  if (findError) throw new Error(findError.message);

  if (existing?.id) {
    const { data, error } = await supabase
      .from(table)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ ...match, ...patch, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function ensureCountryLocationMasterData(countryInput: { name?: string | null; iso2?: string | null; iso3?: string | null }) {
  const masterCountry = findLocationMasterCountry(countryInput);
  if (!masterCountry) return { countryMatched: false, states: 0, districts: 0, cities: 0, tehsils: 0 };

  const countryId = await upsertCountry(masterCountry);
  let states = 0;
  let districts = 0;
  let cities = 0;
  let tehsils = 0;

  for (const state of masterCountry.states) {
    const stateId = await upsertByName(
      "states_provinces",
      { country_id: countryId, name: state.name },
      { code: state.code, postal_code: state.postalCode ?? null, phone_area_code: state.phoneAreaCode ?? null, is_active: true }
    );
    states++;

    for (const district of state.districts) {
      const districtId = await upsertByName(
        "districts",
        { country_id: countryId, state_province_id: stateId, name: district.name },
        { code: district.code, postal_code: district.postalCode ?? null, phone_area_code: district.phoneAreaCode ?? null, is_active: true }
      );
      districts++;

      for (const city of district.cities) {
        const cityId = await upsertByName(
          "cities",
          { country_id: countryId, state_province_id: stateId, district_id: districtId, name: city.name },
          { code: city.code, zip_code: city.postalCode ?? null, phone_area_code: city.phoneAreaCode ?? null, is_active: true }
        );
        cities++;

        for (const tehsil of city.tehsils ?? []) {
          await upsertByName(
            "areas_locations",
            { country_id: countryId, state_province_id: stateId, district_id: districtId, city_id: cityId, name: tehsil.name },
            { code: tehsil.code, postal_code: tehsil.postalCode ?? city.postalCode ?? null, phone_area_code: tehsil.phoneAreaCode ?? city.phoneAreaCode ?? null, is_active: true }
          );
          tehsils++;
        }
      }
    }
  }

  return { countryMatched: true, countryId, states, districts, cities, tehsils };
}
