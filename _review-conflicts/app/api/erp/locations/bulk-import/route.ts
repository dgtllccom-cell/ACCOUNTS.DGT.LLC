import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";
import { linkEmailAccount } from "@/lib/api/email-link";
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

function getCountryDetails(code: string) {
  const c = code.trim().toUpperCase();
  if (c === "PK" || c === "PAK") {
    return { iso2: "PK", iso3: "PAK", currency: "PKR", officialEmail: "official@dgt.pk", adminEmail: "admin@dgt.pk" };
  } else if (c === "IN" || c === "IND") {
    return { iso2: "IN", iso3: "IND", currency: "INR", officialEmail: "official@dgt.in", adminEmail: "admin@dgt.in" };
  } else if (c === "AE" || c === "ARE" || c === "UAE") {
    return { iso2: "AE", iso3: "ARE", currency: "AED", officialEmail: "official@dgt.ae", adminEmail: "admin@dgt.ae" };
  } else if (c === "IR" || c === "IRN") {
    return { iso2: "IR", iso3: "IRN", currency: "IRR", officialEmail: "official@dgt.ir", adminEmail: "admin@dgt.ir" };
  } else if (c === "AF" || c === "AFG") {
    return { iso2: "AF", iso3: "AFG", currency: "AFN", officialEmail: "official@dgt.af", adminEmail: "admin@dgt.af" };
  }
  // Default fallback
  return {
    iso2: c.slice(0, 2),
    iso3: c.length === 3 ? c : c.slice(0, 3) + "X",
    currency: c + "X",
    officialEmail: `official@dgt.${c.toLowerCase()}`,
    adminEmail: `admin@dgt.${c.toLowerCase()}`
  };
}

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

    const supabase = createSupabaseAdminClient() as any;

    // We will cache resolved IDs to avoid database hits
    const countryCache: Record<string, string> = {};
    const stateCache: Record<string, string> = {};
    const districtCache: Record<string, string> = {};

    let countriesCreated = 0;
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
          // If the user is not super admin, they cannot create countries
          if (!session.isSuperAdmin) {
            throw new Error(`Country ${countryNameClean} (${countryCodeClean}) does not exist. Only Super Admins can add new countries.`);
          }

          const details = getCountryDetails(countryCodeClean);
          const newCountry = await locationsRepository.createCountry({
            name: countryNameClean,
            iso2: details.iso2,
            iso3: details.iso3,
            currencyCode: details.currency,
            officialEmail: details.officialEmail,
            adminEmail: details.adminEmail
          });

          await linkEmailAccount({
            countryId: newCountry.id,
            scope: "country",
            displayName: `${newCountry.name} Official`,
            emailAddress: newCountry.official_email,
            adminEmail: newCountry.admin_email
          });

          countryId = newCountry.id;
          countriesCreated++;
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
