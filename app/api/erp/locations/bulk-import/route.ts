import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ImportRow = {
  countryCode: string;
  countryName: string;
  stateCode: string;
  stateName: string;
  cityCode: string; // District/City code
  cityName: string; // District/City name
  tehsilCode: string; // Tehsil/City code
  tehsilName: string; // Tehsil/City name
};

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    // Bulk import updates location configuration, so requires Super Admin or write permission
    if (!session.isSuperAdmin && !session.countryIds.length) {
      throw new Error("You do not have permission to import locations.");
    }

    const { rows } = (await request.json()) as { rows: ImportRow[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("No rows provided for import.");
    }

    const supabase = createSupabaseAdminClient();

    // We will cache resolved IDs to avoid database hits
    const countryCache: Record<string, string> = {};
    const stateCache: Record<string, string> = {};
    const districtCache: Record<string, string> = {};

    const countriesCreated = 0;
    let statesCreated = 0;
    let districtsCreated = 0;
    let citiesCreated = 0;

    for (const row of rows) {
      const countryCodeClean = (row.countryCode || "").trim().toUpperCase();
      const countryNameClean = (row.countryName || "").trim();
      const stateCodeClean = (row.stateCode || "").trim();
      const stateNameClean = (row.stateName || "").trim();
      const cityCodeClean = (row.cityCode || "").trim(); // maps to district
      const cityNameClean = (row.cityName || "").trim(); // maps to district
      const tehsilCodeClean = (row.tehsilCode || "").trim(); // maps to city/tehsil
      const tehsilNameClean = (row.tehsilName || "").trim(); // maps to city/tehsil

      if (!countryCodeClean || !countryNameClean) {
        continue;
      }

      // 1. Resolve Country
      let countryId = countryCache[countryCodeClean];
      if (!countryId) {
        // Query database
        const { data: existingCountry } = await supabase
          .from("countries")
          .select("id")
          .eq("iso2", countryCodeClean)
          .is("deleted_at", null)
          .maybeSingle();

        if (existingCountry?.id) {
          countryId = existingCountry.id;
        } else {
          throw new Error(`Country ${countryNameClean} (${countryCodeClean}) does not exist. Create the country master record before importing its locations.`);
        }
        countryCache[countryCodeClean] = countryId;
      }

      // Check country scope permission for non-super admins
      if (!session.isSuperAdmin && !session.countryIds.includes(countryId)) {
        throw new Error(`You do not have permission to modify locations in country: ${countryNameClean}`);
      }

      // 2. Resolve State
      if (!stateNameClean) continue;
      const stateCacheKey = `${countryId}:${stateNameClean.toLowerCase()}`;
      let stateId = stateCache[stateCacheKey];
      if (!stateId) {
        const state = await locationsRepository.createState({
          countryId,
          name: stateNameClean,
          code: stateCodeClean || null,
          createdBy: session.userId
        });
        stateId = state.id;
        // In locationsRepository, createState handles existing check, but if created we count it
        // To be safe on counts, we'll check if a state code was updated or if a new row was inserted.
        // We can check if it already existed in database prior
        stateCache[stateCacheKey] = stateId;
        statesCreated++;
      }

      // 3. Resolve District
      if (!cityNameClean) continue;
      const districtCacheKey = `${stateId}:${cityNameClean.toLowerCase()}`;
      let districtId = districtCache[districtCacheKey];
      if (!districtId) {
        const district = await locationsRepository.createDistrict({
          countryId,
          stateProvinceId: stateId,
          name: cityNameClean,
          code: cityCodeClean || null,
          createdBy: session.userId
        });
        districtId = district.id;
        districtCache[districtCacheKey] = districtId;
        districtsCreated++;
      }

      // 4. Resolve Tehsil (mapped to cities table)
      if (!tehsilNameClean) continue;
      
      const { data: existingCity } = await supabase
        .from("cities")
        .select("id")
        .eq("country_id", countryId)
        .eq("district_id", districtId)
        .is("deleted_at", null)
        .ilike("name", tehsilNameClean)
        .maybeSingle();

      if (!existingCity?.id) {
        // Create city
        await locationsRepository.createCity({
          countryId,
          stateProvinceId: stateId,
          districtId,
          name: tehsilNameClean,
          code: tehsilCodeClean || null,
          zipCode: null,
          createdBy: session.userId
        });
        citiesCreated++;
      }
    }

    return apiOk({
      success: true,
      countriesCreated,
      statesCreated,
      districtsCreated,
      citiesCreated
    });
  } catch (error) {
    return handleApiError(error);
  }
}
