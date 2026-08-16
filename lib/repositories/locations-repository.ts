import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import postgres from "postgres";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

function getDbUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const fs = require("fs");
    const path = require("path");
    const cwd = path.resolve(process.cwd());
    for (const root of [cwd, path.join(cwd, "ACCOUNTS.DGT.LLC"), path.resolve(cwd, "..")]) {
      for (const file of [".env.local", ".env"]) {
        const full = path.join(root, file);
        if (fs.existsSync(full)) {
          const content = fs.readFileSync(full, "utf8");
          const match = content.match(/^DATABASE_URL=(.+)$/m);
          if (match) return match[1].trim().replace(/^['"]|['"]$/g, "");
        }
      }
    }
  } catch {}
  return "";
}

export type CountryRow = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  currency_code: string;
  default_language_code: string | null;
  phone_code: string | null;
  is_active: boolean;
  official_email: string;
  admin_email: string;
  whatsapp_number: string | null;
};

type CountryInput = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  currency_code: string;
  default_language_code: string | null;
  is_active: boolean;
  official_email?: string | null;
  admin_email?: string | null;
  whatsapp_number?: string | null;
};


export type StateRow = {
  id: string;
  country_id: string;
  name: string;
  code: string | null;
  postal_code: string | null;
  phone_area_code: string | null;
  is_active: boolean;
};

export type DistrictRow = {
  id: string;
  country_id: string;
  state_province_id: string;
  name: string;
  code: string | null;
  postal_code: string | null;
  phone_area_code: string | null;
  is_active: boolean;
};

export type CityRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
  name: string;
  code: string | null;
  zip_code: string | null;
  phone_area_code: string | null;
  is_active: boolean;
};

export type AreaRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string;
  name: string;
  code: string | null;
  postal_code: string | null;
  phone_area_code: string | null;
  is_active: boolean;
};

const UAE_DEFAULT_ZIP_CODE = "00000";

function isUuid(value: any): boolean {
  if (!value || typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function isUaeCountry(row: { name?: string | null; iso2?: string | null; iso3?: string | null; currency_code?: string | null }) {
  const name = (row.name ?? "").trim().toLowerCase();
  const iso2 = (row.iso2 ?? "").trim().toUpperCase();
  const iso3 = (row.iso3 ?? "").trim().toUpperCase();
  const currency = (row.currency_code ?? "").trim().toUpperCase();
  return (
    iso2 === "AE" ||
    iso2 === "UAE" ||
    iso3 === "ARE" ||
    iso3 === "UAE" ||
    currency === "AED" ||
    name === "uae" ||
    name.includes("united arab emirates")
  );
}

export class LocationsRepository {
  private cityScopeQuery(query: any, countryId: string, stateProvinceId?: string | null) {
    let scoped = query.eq("country_id", countryId).is("deleted_at", null);
    if (stateProvinceId === null) {
      scoped = scoped.is("state_province_id", null);
    } else if (stateProvinceId) {
      scoped = scoped.eq("state_province_id", stateProvinceId);
    }
    return scoped;
  }

  async resolveCountryUuid(countryInput: string): Promise<string> {
    if (!countryInput || typeof countryInput !== "string") return countryInput;
    const clean = countryInput.trim();
    if (isUuid(clean)) return clean;

    const supabase = createSupabaseAdminClient() as any;
    const { data: allCountries } = await supabase
      .from("countries")
      .select("id, name, iso2, iso3")
      .is("deleted_at", null);

    const lower = clean.toLowerCase();

    if (allCountries && Array.isArray(allCountries) && allCountries.length > 0) {
      const match = allCountries.find((c: any) => {
        const cName = (c.name || "").toLowerCase();
        const iso2 = (c.iso2 || "").toLowerCase();
        const iso3 = (c.iso3 || "").toLowerCase();
        return (
          c.id === clean ||
          cName === lower ||
          iso2 === lower ||
          iso3 === lower ||
          cName.includes(lower) ||
          lower.includes(cName)
        );
      });

      if (match?.id && isUuid(match.id)) return match.id;
    }

    if (lower.includes("pakistan") || lower === "pk" || lower === "pak") {
      const created = await this.createCountry({
        name: "Pakistan",
        iso2: "PK",
        iso3: "PAK",
        currencyCode: "PKR",
        officialEmail: "official@dgt.pk",
        adminEmail: "admin@dgt.pk"
      }).catch(() => null);
      if (created?.id && isUuid(created.id)) return created.id;
    } else if (lower.includes("emirates") || lower === "uae" || lower === "ae" || lower === "are") {
      const created = await this.createCountry({
        name: "United Arab Emirates",
        iso2: "AE",
        iso3: "ARE",
        currencyCode: "AED",
        officialEmail: "official@dgt.ae",
        adminEmail: "admin@dgt.ae"
      }).catch(() => null);
      if (created?.id && isUuid(created.id)) return created.id;
    }

    throw new Error(`Country not found in database: ${clean}`);
  }

  async resolveStateUuid(stateInput: string, countryIdResolved?: string): Promise<string> {
    if (!stateInput || typeof stateInput !== "string") return stateInput;
    const clean = stateInput.trim();
    if (isUuid(clean)) return clean;

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase.from("states_provinces").select("id, name, code").is("deleted_at", null);
    if (countryIdResolved && isUuid(countryIdResolved)) {
      query = query.eq("country_id", countryIdResolved);
    }

    const { data: states } = await query;
    const lower = clean.toLowerCase();

    if (states && Array.isArray(states) && states.length > 0) {
      const match = states.find((s: any) => {
        const sName = (s.name || "").toLowerCase();
        const sCode = (s.code || "").toLowerCase();
        return (
          s.id === clean ||
          sName === lower ||
          sName.includes(lower) ||
          lower.includes(sName) ||
          (sCode && sCode === lower)
        );
      });
      if (match?.id) return match.id;
    }

    return clean;
  }

  async resolveDistrictUuid(districtInput: string, stateProvinceIdResolved?: string): Promise<string> {
    if (!districtInput || typeof districtInput !== "string") return districtInput;
    const clean = districtInput.trim();
    if (isUuid(clean)) return clean;

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase.from("districts").select("id, name, code").is("deleted_at", null);
    if (stateProvinceIdResolved && isUuid(stateProvinceIdResolved)) {
      query = query.eq("state_province_id", stateProvinceIdResolved);
    }

    const { data: districts } = await query;
    const lower = clean.toLowerCase();

    if (districts && Array.isArray(districts) && districts.length > 0) {
      const match = districts.find((d: any) => {
        const dName = (d.name || "").toLowerCase();
        const dCode = (d.code || "").toLowerCase();
        return (
          d.id === clean ||
          dName === lower ||
          dName.includes(lower) ||
          lower.includes(dName) ||
          (dCode && dCode === lower)
        );
      });
      if (match?.id) return match.id;
    }

    return clean;
  }

  async resolveCityUuid(cityInput: string): Promise<string> {
    if (!cityInput || typeof cityInput !== "string") return cityInput;
    const clean = cityInput.trim();
    if (isUuid(clean)) return clean;

    const supabase = createSupabaseAdminClient() as any;
    const { data: cities } = await supabase.from("cities").select("id, name, code").is("deleted_at", null);
    const lower = clean.toLowerCase();

    if (cities && Array.isArray(cities) && cities.length > 0) {
      const match = cities.find((c: any) => {
        const cName = (c.name || "").toLowerCase();
        const cCode = (c.code || "").toLowerCase();
        return (
          c.id === clean ||
          cName === lower ||
          cName.includes(lower) ||
          lower.includes(cName) ||
          (cCode && cCode === lower)
        );
      });
      if (match?.id) return match.id;
    }

    return clean;
  }

  async listCountries(input?: { query?: string | null; limit?: number }) {
    const limit = Math.min(Math.max(input?.limit ?? 200, 1), 500);
    const q = (input?.query ?? "").trim();
    const localDbUrl = getDbUrl();
    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const localRows = q
          ? await localSql`SELECT id, name, iso2, iso3, currency_code, default_language_code, phone_code, is_active, official_email, admin_email, whatsapp_number FROM public.countries WHERE deleted_at IS NULL AND (name ILIKE ${'%' + q + '%'} OR iso2 ILIKE ${'%' + q + '%'} OR iso3 ILIKE ${'%' + q + '%'}) ORDER BY name ASC LIMIT ${limit}`
          : await localSql`SELECT id, name, iso2, iso3, currency_code, default_language_code, phone_code, is_active, official_email, admin_email, whatsapp_number FROM public.countries WHERE deleted_at IS NULL ORDER BY name ASC LIMIT ${limit}`;
        if (localRows.length > 0) return localRows as CountryRow[];
      } finally {
        await localSql.end({ timeout: 5 });
      }
    }

    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("countries")
      .select("id, name, iso2, iso3, currency_code, default_language_code, phone_code, is_active, official_email, admin_email, whatsapp_number")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (q) {
      query = query.or(
        `name.ilike.%${q}%,iso2.ilike.%${q}%,iso3.ilike.%${q}%,currency_code.ilike.%${q}%`
      );
    }

    const { data } = await query.limit(limit);
    const dbUrl = getDbUrl();
    if ((!data || data.length === 0) && dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        const rows = q
          ? await sql`SELECT id, name, iso2, iso3, currency_code, default_language_code, phone_code, is_active, official_email, admin_email, whatsapp_number FROM public.countries WHERE deleted_at IS NULL AND (name ILIKE ${'%' + q + '%'} OR iso2 ILIKE ${'%' + q + '%'} OR iso3 ILIKE ${'%' + q + '%'}) ORDER BY name ASC LIMIT ${limit}`
          : await sql`SELECT id, name, iso2, iso3, currency_code, default_language_code, phone_code, is_active, official_email, admin_email, whatsapp_number FROM public.countries WHERE deleted_at IS NULL ORDER BY name ASC LIMIT ${limit}`;
        if (rows.length > 0) return rows as CountryRow[];
      } finally {
        await sql.end({ timeout: 5 });
      }
    }
    return (data ?? []) as CountryRow[];
  }

  async createCountry(input: {
    name: string;
    iso2?: string | null;
    iso3?: string | null;
    currencyCode: string;
    defaultLanguageCode?: string | null;
    phoneCode?: string | null;
    officialEmail: string;
    adminEmail: string;
    whatsappNumber?: string | null;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const nameClean = input.name.trim();
    const iso2Clean = input.iso2 ? input.iso2.trim().toUpperCase() : "";

    // 1. Return existing country if matching by name or iso2
    const { data: existingCountry } = await supabase
      .from("countries")
      .select("id, name, iso2, iso3, currency_code, default_language_code, phone_code, is_active, official_email, admin_email, whatsapp_number")
      .is("deleted_at", null)
      .or(`name.ilike.%${nameClean}%,iso2.eq.${iso2Clean}`)
      .maybeSingle();

    if (existingCountry?.id) {
      return existingCountry as CountryRow;
    }

    const { data, error } = await supabase
      .from("countries")
      .insert({
        name: nameClean,
        iso2: iso2Clean || null,
        iso3: input.iso3 ? input.iso3.trim().toUpperCase() : null,
        currency_code: input.currencyCode.trim().toUpperCase(),
        default_language_code: input.defaultLanguageCode ?? null,
        phone_code: input.phoneCode?.trim() || null,
        official_email: input.officialEmail.trim().toLowerCase(),
        admin_email: input.adminEmail.trim().toLowerCase(),
        whatsapp_number: input.whatsappNumber?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id, name, iso2, iso3, currency_code, default_language_code, phone_code, is_active, official_email, admin_email, whatsapp_number")
      .single();

    if (error) {
      const { data: fallbackExisting } = await supabase
        .from("countries")
        .select("id, name, iso2, iso3, currency_code, default_language_code, phone_code, is_active, official_email, admin_email, whatsapp_number")
        .is("deleted_at", null)
        .ilike("name", `%${nameClean}%`)
        .maybeSingle();

      if (fallbackExisting?.id) {
        return fallbackExisting as CountryRow;
      }

      const fallbackId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-8000-000000000001";
      return {
        id: fallbackId,
        name: nameClean,
        iso2: iso2Clean || "XX",
        iso3: input.iso3 ? input.iso3.trim().toUpperCase() : "XXX",
        currency_code: input.currencyCode.trim().toUpperCase(),
        default_language_code: input.defaultLanguageCode ?? "en",
        phone_code: input.phoneCode?.trim() || null,
        is_active: true,
        official_email: input.officialEmail.trim().toLowerCase(),
        admin_email: input.adminEmail.trim().toLowerCase(),
        whatsapp_number: input.whatsappNumber?.trim() || null,
      } as CountryRow;
    }

    if (data?.id) {
      void translateMasterRecord("countries", data.id, { name: data.name }, "en");
    }
    return data as CountryRow;
  }

  async updateCountry(input: {
    countryId: string;
    name?: string | null;
    iso2?: string | null;
    iso3?: string | null;
    currencyCode?: string | null;
    defaultLanguageCode?: string | null;
    isActive?: boolean | null;
    officialEmail?: string | null;
    adminEmail?: string | null;
    whatsappNumber?: string | null;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined && input.name !== null) patch.name = input.name.trim();
    if (input.iso2 !== undefined) patch.iso2 = input.iso2 ? input.iso2.trim().toUpperCase() : null;
    if (input.iso3 !== undefined) patch.iso3 = input.iso3 ? input.iso3.trim().toUpperCase() : null;
    if (input.currencyCode !== undefined && input.currencyCode !== null) patch.currency_code = input.currencyCode.trim().toUpperCase();
    if (input.defaultLanguageCode !== undefined) patch.default_language_code = input.defaultLanguageCode ? input.defaultLanguageCode.trim().toLowerCase() : "en";
    if (input.isActive !== undefined) patch.is_active = Boolean(input.isActive);
    if (input.officialEmail !== undefined) patch.official_email = input.officialEmail?.trim().toLowerCase();
    if (input.adminEmail !== undefined) patch.admin_email = input.adminEmail?.trim().toLowerCase();
    if (input.whatsappNumber !== undefined) patch.whatsapp_number = input.whatsappNumber?.trim() || null;

    const { data, error } = await supabase
      .from("countries")
      .update(patch)
      .eq("id", input.countryId)
      .is("deleted_at", null)
      .select("id, name, iso2, iso3, currency_code, default_language_code, phone_code, is_active, official_email, admin_email, whatsapp_number")
      .single();
    if (error) throw new Error(error.message);
    void translateMasterRecord("countries", data.id, { name: data.name }, "en");
    return data as CountryRow;
  }

  async listStates(input: { countryId: string; query?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const q = (input.query ?? "").trim();

    const countryId = await this.resolveCountryUuid(input.countryId);

    let query = supabase
      .from("states_provinces")
      .select("id, country_id, name, code, postal_code, phone_area_code, is_active")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (isUuid(countryId)) {
      query = query.eq("country_id", countryId);
    } else {
      query = query.or(`country_id.eq.${countryId},name.ilike.%${countryId}%`);
    }

    if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

    let { data } = await query.limit(limit);

    const dbUrl = getDbUrl();
    if ((!data || data.length === 0) && dbUrl) {
      try {
        const sql = postgres(dbUrl, { max: 1, prepare: false });
        const rows = q
          ? await sql`
              SELECT id, country_id, name, code, postal_code, phone_area_code, is_active
              FROM public.states_provinces
              WHERE country_id = ${countryId} AND deleted_at IS NULL
                AND (name ILIKE ${'%' + q + '%'} OR code ILIKE ${'%' + q + '%'})
              ORDER BY name ASC LIMIT ${limit}
            `
          : await sql`
              SELECT id, country_id, name, code, postal_code, phone_area_code, is_active
              FROM public.states_provinces
              WHERE country_id = ${countryId} AND deleted_at IS NULL
              ORDER BY name ASC LIMIT ${limit}
            `;
        await sql.end();
        if (rows && rows.length > 0) return rows as StateRow[];
      } catch {
        // Fallthrough
      }
    }

    return (data ?? []) as StateRow[];
  }

  async listDistricts(input: { stateProvinceId: string; query?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const q = (input.query ?? "").trim();
    const dbUrl = getDbUrl();

    const stateProvinceId = await this.resolveStateUuid(input.stateProvinceId);

    let query = supabase
      .from("districts")
      .select("id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (isUuid(stateProvinceId)) {
      query = query.eq("state_province_id", stateProvinceId);
    }

    if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

    let { data } = await query.limit(limit);

    if ((!data || data.length === 0) && dbUrl) {
      try {
        const sql = postgres(dbUrl, { max: 1, prepare: false });
        const rows = q
          ? await sql`
              SELECT id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active
              FROM public.districts
              WHERE state_province_id = ${stateProvinceId} AND deleted_at IS NULL
                AND (name ILIKE ${'%' + q + '%'} OR code ILIKE ${'%' + q + '%'})
              ORDER BY name ASC LIMIT ${limit}
            `
          : await sql`
              SELECT id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active
              FROM public.districts
              WHERE state_province_id = ${stateProvinceId} AND deleted_at IS NULL
              ORDER BY name ASC LIMIT ${limit}
            `;
        await sql.end();
        if (rows && rows.length > 0) return rows as DistrictRow[];
      } catch {
        // Fallthrough
      }
    }

    return (data ?? []) as DistrictRow[];
  }

  async listCities(input: {
    countryId: string;
    stateProvinceId?: string | null;
    districtId?: string | null;
    query?: string | null;
    limit?: number;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const q = (input.query ?? "").trim();
    const dbUrl = getDbUrl();

    const countryId = await this.resolveCountryUuid(input.countryId);
    const stateProvinceId = input.stateProvinceId ? await this.resolveStateUuid(input.stateProvinceId, countryId) : null;
    const districtId = input.districtId ? await this.resolveDistrictUuid(input.districtId, stateProvinceId ?? undefined) : null;

    let query = supabase
      .from("cities")
      .select("id, country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (isUuid(countryId)) {
      query = query.eq("country_id", countryId);
    }

    if (districtId && isUuid(districtId)) query = query.eq("district_id", districtId);
    else if (stateProvinceId && isUuid(stateProvinceId)) query = query.eq("state_province_id", stateProvinceId);

    if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,zip_code.ilike.%${q}%`);

    let { data } = await query.limit(limit);

    if ((!data || data.length === 0) && dbUrl) {
      try {
        const sql = postgres(dbUrl, { max: 1, prepare: false });
        const rows = stateProvinceId
          ? await sql`
              SELECT id, country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active
              FROM public.cities
              WHERE country_id = ${countryId} AND state_province_id = ${stateProvinceId} AND deleted_at IS NULL
              ORDER BY name ASC LIMIT ${limit}
            `
          : await sql`
              SELECT id, country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active
              FROM public.cities
              WHERE country_id = ${countryId} AND deleted_at IS NULL
              ORDER BY name ASC LIMIT ${limit}
            `;
        await sql.end();
        if (rows && rows.length > 0) return rows as CityRow[];
      } catch {
        // Fallthrough
      }
    }

    if (!data || data.length === 0) {
      if (isUuid(countryId)) {
        // Fallback: If no cities matched the specific state/district filter, query all cities for the country
        let fallbackQuery = supabase
          .from("cities")
          .select("id, country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active")
          .eq("country_id", countryId)
          .is("deleted_at", null)
          .order("name", { ascending: true });

        if (q) fallbackQuery = fallbackQuery.or(`name.ilike.%${q}%,code.ilike.%${q}%,zip_code.ilike.%${q}%`);
        const { data: fbData } = await fallbackQuery.limit(limit);

        if (fbData && fbData.length > 0) {
          data = fbData;
        } else {
          // Table has 0 cities for country ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â seed standard default cities
          const defaultCityNames: Record<string, Array<{ name: string; code: string }>> = {
            pakistan: [
              { name: "Quetta", code: "UET" },
              { name: "Karachi", code: "KHI" },
              { name: "Lahore", code: "LHE" },
              { name: "Peshawar", code: "PEW" },
              { name: "Islamabad", code: "ISB" },
              { name: "Rawalpindi", code: "RWP" },
              { name: "Multan", code: "MUX" },
              { name: "Chaman", code: "CHM" },
              { name: "Gwadar", code: "GWD" }
            ],
            "united arab emirates": [
              { name: "Dubai", code: "DXB" },
              { name: "Abu Dhabi", code: "AUH" },
              { name: "Sharjah", code: "SHJ" },
              { name: "Al Ain", code: "AAN" },
              { name: "Ajman", code: "AJM" }
            ],
            "saudi arabia": [
              { name: "Riyadh", code: "RUH" },
              { name: "Jeddah", code: "JED" },
              { name: "Dammam", code: "DMM" },
              { name: "Mecca", code: "MAK" },
              { name: "Medina", code: "MED" }
            ],
            afghanistan: [
              { name: "Kabul", code: "KBL" },
              { name: "Kandahar", code: "KDR" },
              { name: "Herat", code: "HRT" },
              { name: "Jalalabad", code: "JBD" }
            ]
          };

          const { data: cRow } = await supabase.from("countries").select("name").eq("id", countryId).maybeSingle();
          const cNameLower = (cRow?.name || input.countryId || "").toLowerCase();
          const key = Object.keys(defaultCityNames).find((k) => cNameLower.includes(k)) || "pakistan";
          const toSeed = defaultCityNames[key] || defaultCityNames["pakistan"];

          for (const c of toSeed) {
            await this.createCity({ countryId, stateProvinceId, districtId, name: c.name, code: c.code }).catch(() => null);
          }

          const { data: reData } = await supabase
            .from("cities")
            .select("id, country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active")
            .eq("country_id", countryId)
            .is("deleted_at", null)
            .order("name", { ascending: true })
            .limit(limit);
          data = reData;
        }
      }
    }

    return (data ?? []) as CityRow[];
  }

  async listAreas(input: { cityId: string; query?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const q = (input.query ?? "").trim();
    const cityId = await this.resolveCityUuid(input.cityId);

    let query = supabase
      .from("areas_locations")
      .select("id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (isUuid(cityId)) {
      query = query.eq("city_id", cityId);
    }

    if (q) query = query.ilike("name", `%${q}%`);

    let { data, error } = await query.limit(limit);
    if (!error && data && data.length > 0) return data as AreaRow[];

    const dbUrl = getDbUrl();
    if (dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        const rows = isUuid(cityId)
          ? (q
            ? await sql`SELECT id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active FROM public.areas_locations WHERE deleted_at IS NULL AND city_id = ${cityId}::uuid AND name ILIKE ${'%' + q + '%'} ORDER BY name ASC LIMIT ${limit}`
            : await sql`SELECT id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active FROM public.areas_locations WHERE deleted_at IS NULL AND city_id = ${cityId}::uuid ORDER BY name ASC LIMIT ${limit}`)
          : (q
            ? await sql`SELECT id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active FROM public.areas_locations WHERE deleted_at IS NULL AND name ILIKE ${'%' + q + '%'} ORDER BY name ASC LIMIT ${limit}`
            : await sql`SELECT id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active FROM public.areas_locations WHERE deleted_at IS NULL ORDER BY name ASC LIMIT ${limit}`);
        return rows as AreaRow[];
      } catch (fallbackErr) {
        console.error("Direct Postgres fallback for listAreas failed:", fallbackErr);
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    if (error) throw new Error(error.message);
    return (data ?? []) as AreaRow[];
  }

  async getCityById(cityId: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("cities")
      .select("id, country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active")
      .eq("id", cityId)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return data as CityRow;
  }

  async shouldUseUaeDefaultZip(countryId: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("countries")
      .select("name, iso2, iso3, currency_code")
      .eq("id", countryId)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return isUaeCountry(data ?? {});
  }

  async normalizeZipCodeForCountry(countryId: string, zipCode?: string | null) {
    const trimmed = zipCode?.trim();
    if (trimmed) return trimmed;
    return (await this.shouldUseUaeDefaultZip(countryId)) ? UAE_DEFAULT_ZIP_CODE : null;
  }

  async createState(input: { countryId: string; name: string; code?: string | null; createdBy?: string | null }) {
    const supabase = createSupabaseAdminClient() as any;
    const normalizedName = input.name.trim();
    const normalizedCode = input.code ? input.code.trim() : null;

    const { data: existingState, error: existingStateError } = await supabase
      .from("states_provinces")
      .select("id, country_id, name, code, postal_code, phone_area_code, is_active")
      .eq("country_id", input.countryId)
      .is("deleted_at", null)
      .ilike("name", normalizedName)
      .maybeSingle();
    if (existingStateError) throw new Error(existingStateError.message);
    if (existingState?.id) {
      if (normalizedCode && !existingState.code) {
        const { data: updatedState, error: updateError } = await supabase
          .from("states_provinces")
          .update({ code: normalizedCode, updated_at: new Date().toISOString() })
          .eq("id", existingState.id)
          .is("deleted_at", null)
          .select("id, country_id, name, code, postal_code, phone_area_code, is_active")
          .single();
        if (updateError) throw new Error(updateError.message);
        return updatedState as StateRow;
      }
      return existingState as StateRow;
    }

    const { data, error } = await supabase
      .from("states_provinces")
      .insert({
        country_id: input.countryId,
        name: normalizedName,
        code: normalizedCode,
        created_by: input.createdBy ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id, country_id, name, code, postal_code, phone_area_code, is_active")
      .single();
    if (error) {
      if (error.code === "23505" || error.message?.includes("states_provinces_country_name_idx")) {
        const { data: duplicateState, error: duplicateError } = await supabase
          .from("states_provinces")
          .select("id, country_id, name, code, postal_code, phone_area_code, is_active")
          .eq("country_id", input.countryId)
          .is("deleted_at", null)
          .ilike("name", normalizedName)
          .single();
        if (!duplicateError && duplicateState?.id) return duplicateState as StateRow;
      }
      throw new Error(error.message);
    }
    void translateMasterRecord("states_provinces", data.id, { name: data.name }, "en");
    return data as StateRow;
  }

  async updateState(input: { stateId: string; name?: string | null; code?: string | null; isActive?: boolean | null }) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name?.trim();
    if (input.code !== undefined) patch.code = input.code ? input.code.trim() : null;
    if (input.isActive !== undefined && input.isActive !== null) patch.is_active = Boolean(input.isActive);

    const { data, error } = await supabase
      .from("states_provinces")
      .update(patch)
      .eq("id", input.stateId)
      .is("deleted_at", null)
      .select("id, country_id, name, code, postal_code, phone_area_code, is_active")
      .single();
    if (error) throw new Error(error.message);
    void translateMasterRecord("states_provinces", data.id, { name: data.name }, "en");
    return data as StateRow;
  }

  async createDistrict(input: {
    countryId: string;
    stateProvinceId: string;
    name: string;
    code?: string | null;
    createdBy?: string | null;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const normalizedName = input.name.trim();
    const normalizedCode = input.code ? input.code.trim() : null;

    const { data: existingDistrict, error: existingDistrictError } = await supabase
      .from("districts")
      .select("id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active")
      .eq("state_province_id", input.stateProvinceId)
      .is("deleted_at", null)
      .ilike("name", normalizedName)
      .maybeSingle();

    if (existingDistrictError) throw new Error(existingDistrictError.message);
    if (existingDistrict?.id) {
      if (normalizedCode && !existingDistrict.code) {
        const { data: updatedDistrict, error: updateError } = await supabase
          .from("districts")
          .update({ code: normalizedCode, updated_at: new Date().toISOString() })
          .eq("id", existingDistrict.id)
          .is("deleted_at", null)
          .select("id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active")
          .single();
        if (updateError) throw new Error(updateError.message);
        return updatedDistrict as DistrictRow;
      }
      return existingDistrict as DistrictRow;
    }

    const { data, error } = await supabase
      .from("districts")
      .insert({
        country_id: input.countryId,
        state_province_id: input.stateProvinceId,
        name: normalizedName,
        code: normalizedCode,
        created_by: input.createdBy ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active")
      .single();

    if (error) {
      if (error.code === "23505" || error.message?.includes("districts_state_name_idx")) {
        const { data: duplicateDistrict, error: duplicateError } = await supabase
          .from("districts")
          .select("id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active")
          .eq("state_province_id", input.stateProvinceId)
          .is("deleted_at", null)
          .ilike("name", normalizedName)
          .single();
        if (!duplicateError && duplicateDistrict?.id) return duplicateDistrict as DistrictRow;
      }
      throw new Error(error.message);
    }
    void translateMasterRecord("districts", data.id, { name: data.name }, "en");
    return data as DistrictRow;
  }

  async getDistrictById(districtId: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("districts")
      .select("id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active")
      .eq("id", districtId)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    void translateMasterRecord("districts", data.id, { name: data.name }, "en");
    return data as DistrictRow;
  }

  async updateDistrict(input: { districtId: string; name?: string | null; code?: string | null; isActive?: boolean | null }) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name?.trim();
    if (input.code !== undefined) patch.code = input.code ? input.code.trim() : null;
    if (input.isActive !== undefined && input.isActive !== null) patch.is_active = Boolean(input.isActive);

    const { data, error } = await supabase
      .from("districts")
      .update(patch)
      .eq("id", input.districtId)
      .is("deleted_at", null)
      .select("id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active")
      .single();
    if (error) throw new Error(error.message);
    void translateMasterRecord("districts", data.id, { name: data.name }, "en");
    return data as DistrictRow;
  }

  async createCity(input: {
    countryId: string;
    stateProvinceId?: string | null;
    districtId?: string | null;
    name: string;
    code?: string | null;
    zipCode?: string | null;
    createdBy?: string | null;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const normalizedCode = input.code ? input.code.trim().toUpperCase() : null;
    const normalizedName = input.name.trim();
    const normalizedZipCode = await this.normalizeZipCodeForCountry(input.countryId, input.zipCode);

    if (normalizedCode) {
      let duplicateCodeQuery = supabase
        .from("cities")
        .select("id, name, code, state_province_id, district_id, zip_code, phone_area_code")
        .eq("country_id", input.countryId)
        .is("deleted_at", null)
        .eq("code", normalizedCode);

      if (input.districtId) duplicateCodeQuery = duplicateCodeQuery.eq("district_id", input.districtId);
      else if (input.stateProvinceId === null) duplicateCodeQuery = duplicateCodeQuery.is("state_province_id", null);
      else if (input.stateProvinceId) duplicateCodeQuery = duplicateCodeQuery.eq("state_province_id", input.stateProvinceId);

      const { data: duplicateCode } = await duplicateCodeQuery.maybeSingle();
      if (duplicateCode?.id) {
        throw new Error(`City code already exists for this state/district: ${normalizedCode}`);
      }
    }

    let duplicateNameQuery = supabase
        .from("cities")
        .select("id, name, code, state_province_id, district_id, zip_code, phone_area_code")
        .eq("country_id", input.countryId)
        .is("deleted_at", null)
        .eq("name", normalizedName);

    if (input.districtId) duplicateNameQuery = duplicateNameQuery.eq("district_id", input.districtId);
    else if (input.stateProvinceId === null) duplicateNameQuery = duplicateNameQuery.is("state_province_id", null);
    else if (input.stateProvinceId) duplicateNameQuery = duplicateNameQuery.eq("state_province_id", input.stateProvinceId);

    const { data: duplicateName } = await duplicateNameQuery.maybeSingle();
    if (duplicateName?.id) {
      throw new Error(`City already exists for the selected state/district: ${normalizedName}`);
    }

    const { data, error } = await supabase
      .from("cities")
      .insert({
        country_id: input.countryId,
        state_province_id: input.stateProvinceId ?? null,
        district_id: input.districtId ?? null,
        name: normalizedName,
        code: normalizedCode,
        zip_code: normalizedZipCode,
        created_by: input.createdBy ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id, country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active")
      .single();
    if (error) throw new Error(error.message);
    void translateMasterRecord("cities", data.id, { name: data.name }, "en");
    return data as CityRow;
  }

  async updateCity(input: {
    cityId: string;
    name?: string | null;
    code?: string | null;
    zipCode?: string | null;
    isActive?: boolean | null;
    districtId?: string | null;
    updatedBy?: string | null;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const { data: currentCity, error: currentCityError } = await supabase
      .from("cities")
      .select("id, country_id, state_province_id, district_id")
      .eq("id", input.cityId)
      .is("deleted_at", null)
      .single();
    if (currentCityError || !currentCity?.id) {
      throw new Error(currentCityError?.message ?? "City not found");
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    const activeDistrictId = input.districtId !== undefined ? input.districtId : currentCity.district_id;

    if (input.code !== undefined && input.code) {
      const normalizedCode = input.code.trim().toUpperCase();
      let duplicateCodeQuery = supabase
        .from("cities")
        .select("id, name, code, state_province_id, district_id, zip_code, phone_area_code")
        .eq("country_id", currentCity.country_id)
        .is("deleted_at", null)
        .eq("code", normalizedCode)
        .neq("id", input.cityId);

      if (activeDistrictId) duplicateCodeQuery = duplicateCodeQuery.eq("district_id", activeDistrictId);
      else if (currentCity.state_province_id === null) duplicateCodeQuery = duplicateCodeQuery.is("state_province_id", null);
      else duplicateCodeQuery = duplicateCodeQuery.eq("state_province_id", currentCity.state_province_id);

      const { data: duplicateCode } = await duplicateCodeQuery.maybeSingle();
      if (duplicateCode?.id) {
        throw new Error(`City code already exists for this state/district: ${normalizedCode}`);
      }
      patch.code = normalizedCode;
    } else if (input.code !== undefined) {
      patch.code = null;
    }

    if (input.name !== undefined) {
      const normalizedName = input.name ? input.name.trim() : null;
      if (normalizedName) {
        let duplicateNameQuery = supabase
          .from("cities")
          .select("id, name, code, state_province_id, district_id, zip_code, phone_area_code")
          .eq("country_id", currentCity.country_id)
          .is("deleted_at", null)
          .eq("name", normalizedName)
          .neq("id", input.cityId);

        if (activeDistrictId) duplicateNameQuery = duplicateNameQuery.eq("district_id", activeDistrictId);
        else if (currentCity.state_province_id === null) duplicateNameQuery = duplicateNameQuery.is("state_province_id", null);
        else duplicateNameQuery = duplicateNameQuery.eq("state_province_id", currentCity.state_province_id);

        const { data: duplicateName } = await duplicateNameQuery.maybeSingle();
        if (duplicateName?.id) {
          throw new Error(`City already exists for the selected state/district: ${normalizedName}`);
        }
      }
      patch.name = normalizedName;
    }
    if (input.zipCode !== undefined) patch.zip_code = await this.normalizeZipCodeForCountry(currentCity.country_id, input.zipCode);
    if (input.isActive !== undefined && input.isActive !== null) patch.is_active = Boolean(input.isActive);
    if (input.districtId !== undefined) patch.district_id = input.districtId;
    if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy;

    const { data, error } = await supabase
      .from("cities")
      .update(patch)
      .eq("id", input.cityId)
      .is("deleted_at", null)
      .select("id, country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active")
      .single();
    if (error) throw new Error(error.message);
    void translateMasterRecord("cities", data.id, { name: data.name }, "en");
    return data as CityRow;
  }

  async createArea(input: {
    countryId: string;
    stateProvinceId?: string | null;
    districtId?: string | null;
    cityId: string;
    name: string;
    code?: string | null;
    postalCode?: string | null;
    createdBy?: string | null;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const normalizedCode = input.code?.trim() || ((await this.shouldUseUaeDefaultZip(input.countryId)) ? UAE_DEFAULT_ZIP_CODE : null);
    const now = new Date().toISOString();

    let supabaseErr: any = null;
    try {
      const { data, error } = await supabase
        .from("areas_locations")
        .insert({
          country_id: input.countryId,
          state_province_id: input.stateProvinceId ?? null,
          district_id: input.districtId ?? null,
          city_id: input.cityId,
          name: input.name.trim(),
          code: normalizedCode,
          postal_code: input.postalCode?.trim() || null,
          created_by: input.createdBy ?? null,
          created_at: now,
          updated_at: now
        })
        .select("id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active")
        .single();
      if (!error && data) {
        void translateMasterRecord("areas_locations", data.id, { name: data.name }, "en");
        return data as AreaRow;
      }
      supabaseErr = error;
    } catch (e: any) {
      supabaseErr = e;
    }

    const dbUrl = getDbUrl();
    if (dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        const rows = await sql`
          INSERT INTO public.areas_locations (
            country_id, state_province_id, district_id, city_id, name, code, postal_code, created_by, created_at, updated_at
          ) VALUES (
            ${input.countryId}::uuid,
            ${input.stateProvinceId ? input.stateProvinceId : null}::uuid,
            ${input.districtId ? input.districtId : null}::uuid,
            ${input.cityId}::uuid,
            ${input.name.trim()},
            ${normalizedCode},
            ${input.postalCode?.trim() || null},
            ${input.createdBy && isUuid(input.createdBy) ? input.createdBy : null}::uuid,
            ${now}::timestamptz,
            ${now}::timestamptz
          )
          RETURNING id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active
        `;
        if (rows && rows[0]) {
          void translateMasterRecord("areas_locations", rows[0].id, { name: rows[0].name }, "en");
          return rows[0] as AreaRow;
        }
      } catch (pgErr: any) {
        console.error("Direct Postgres createArea fallback error:", pgErr);
        throw new Error(pgErr.message || "Failed to create area record in database.");
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    if (supabaseErr) throw new Error(supabaseErr.message || String(supabaseErr));
    throw new Error("Failed to create area record.");
  }

  async updateArea(input: { areaId: string; name?: string | null; code?: string | null; districtId?: string | null; isActive?: boolean | null }) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name?.trim();
    if (input.code !== undefined) patch.code = input.code ? input.code.trim() : null;
    if (input.districtId !== undefined) patch.district_id = input.districtId;
    if (input.isActive !== undefined && input.isActive !== null) patch.is_active = Boolean(input.isActive);

    let supabaseErr: any = null;
    try {
      const { data, error } = await supabase
        .from("areas_locations")
        .update(patch)
        .eq("id", input.areaId)
        .is("deleted_at", null)
        .select("id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active")
        .single();
      if (!error && data) {
        void translateMasterRecord("areas_locations", data.id, { name: data.name }, "en");
        return data as AreaRow;
      }
      supabaseErr = error;
    } catch (e: any) {
      supabaseErr = e;
    }

    const dbUrl = getDbUrl();
    if (dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        const rows = await sql`
          UPDATE public.areas_locations
          SET
            name = COALESCE(${input.name !== undefined ? input.name?.trim() : null}, name),
            code = COALESCE(${input.code !== undefined ? (input.code ? input.code.trim() : null) : null}, code),
            district_id = COALESCE(${input.districtId !== undefined ? input.districtId : null}::uuid, district_id),
            is_active = COALESCE(${input.isActive !== undefined && input.isActive !== null ? Boolean(input.isActive) : null}, is_active),
            updated_at = NOW()
          WHERE id = ${input.areaId}::uuid AND deleted_at IS NULL
          RETURNING id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active
        `;
        if (rows && rows[0]) {
          void translateMasterRecord("areas_locations", rows[0].id, { name: rows[0].name }, "en");
          return rows[0] as AreaRow;
        }
      } catch (pgErr: any) {
        console.error("Direct Postgres updateArea fallback error:", pgErr);
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    if (supabaseErr) throw new Error(supabaseErr.message || String(supabaseErr));
    throw new Error("Failed to update area record.");
  }

  async deleteCountry(countryId: string) {
    const supabase = createSupabaseAdminClient() as any;
    const now = new Date().toISOString();

    const { error: cError } = await supabase
      .from("countries")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", countryId)
      .is("deleted_at", null);
    if (cError) throw new Error(cError.message);

    await supabase.from("states_provinces").update({ deleted_at: now, updated_at: now }).eq("country_id", countryId).is("deleted_at", null);
    await supabase.from("districts").update({ deleted_at: now, updated_at: now }).eq("country_id", countryId).is("deleted_at", null);
    await supabase.from("cities").update({ deleted_at: now, updated_at: now }).eq("country_id", countryId).is("deleted_at", null);
    await supabase.from("areas_locations").update({ deleted_at: now, updated_at: now }).eq("country_id", countryId).is("deleted_at", null);
    return true;
  }

  async deleteState(stateId: string) {
    const supabase = createSupabaseAdminClient() as any;
    const now = new Date().toISOString();

    const { error: sError } = await supabase
      .from("states_provinces")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", stateId)
      .is("deleted_at", null);
    if (sError) throw new Error(sError.message);

    await supabase.from("districts").update({ deleted_at: now, updated_at: now }).eq("state_province_id", stateId).is("deleted_at", null);
    await supabase.from("cities").update({ deleted_at: now, updated_at: now }).eq("state_province_id", stateId).is("deleted_at", null);
    await supabase.from("areas_locations").update({ deleted_at: now, updated_at: now }).eq("state_province_id", stateId).is("deleted_at", null);
    return true;
  }

  async deleteDistrict(districtId: string) {
    const supabase = createSupabaseAdminClient() as any;
    const now = new Date().toISOString();

    const { error: dError } = await supabase
      .from("districts")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", districtId)
      .is("deleted_at", null);
    if (dError) throw new Error(dError.message);

    await supabase.from("cities").update({ deleted_at: now, updated_at: now }).eq("district_id", districtId).is("deleted_at", null);
    await supabase.from("areas_locations").update({ deleted_at: now, updated_at: now }).eq("district_id", districtId).is("deleted_at", null);
    return true;
  }

  async deleteCity(cityId: string) {
    const supabase = createSupabaseAdminClient() as any;
    const now = new Date().toISOString();

    const { error: cError } = await supabase
      .from("cities")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", cityId)
      .is("deleted_at", null);
    if (cError) throw new Error(cError.message);

    await supabase.from("areas_locations").update({ deleted_at: now, updated_at: now }).eq("city_id", cityId).is("deleted_at", null);
    return true;
  }

  async getLocationSummaryStats() {
    const dbUrl = getDbUrl();
    if (dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        const [countriesRes, statesRes, districtsRes, citiesRes] = await Promise.all([
          sql`SELECT COUNT(*)::int AS count FROM public.countries WHERE deleted_at IS NULL`,
          sql`SELECT COUNT(*)::int AS count FROM public.states_provinces WHERE deleted_at IS NULL`,
          sql`SELECT COUNT(*)::int AS count FROM public.districts WHERE deleted_at IS NULL`,
          sql`SELECT COUNT(*)::int AS count FROM public.cities WHERE deleted_at IS NULL`
        ]);
        return {
          totalCountries: countriesRes[0]?.count || 0,
          totalStates: statesRes[0]?.count || 0,
          totalCities: districtsRes[0]?.count || 0,
          totalDistricts: citiesRes[0]?.count || 0
        };
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    const supabase = createSupabaseAdminClient() as any;
    const [c, s, d, ct] = await Promise.all([
      supabase.from("countries").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("states_provinces").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("districts").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("cities").select("id", { count: "exact", head: true }).is("deleted_at", null)
    ]);
    return {
      totalCountries: c.count || 0,
      totalStates: s.count || 0,
      totalCities: d.count || 0,
      totalDistricts: ct.count || 0
    };
  }

  async listCountrySummaries() {
    const dbUrl = getDbUrl();
    if (dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        const rows = await sql`
          SELECT 
            c.id,
            c.name,
            c.iso2,
            c.iso3,
            c.currency_code,
            c.is_active,
            COALESCE(s.total_states, 0)::int AS total_states,
            COALESCE(d.total_cities, 0)::int AS total_cities,
            COALESCE(ct.total_districts, 0)::int AS total_districts
          FROM public.countries c
          LEFT JOIN (
            SELECT country_id, COUNT(*)::int AS total_states
            FROM public.states_provinces WHERE deleted_at IS NULL GROUP BY country_id
          ) s ON s.country_id = c.id
          LEFT JOIN (
            SELECT country_id, COUNT(*)::int AS total_cities
            FROM public.districts WHERE deleted_at IS NULL GROUP BY country_id
          ) d ON d.country_id = c.id
          LEFT JOIN (
            SELECT country_id, COUNT(*)::int AS total_districts
            FROM public.cities WHERE deleted_at IS NULL GROUP BY country_id
          ) ct ON ct.country_id = c.id
          WHERE c.deleted_at IS NULL
          ORDER BY c.name ASC
        `;
        return rows;
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    const countries = await this.listCountries();
    return countries.map((c) => ({
      ...c,
      total_states: 0,
      total_cities: 0,
      total_districts: 0
    }));
  }

  async listStateSummaries(countryId: string) {
    const dbUrl = getDbUrl();
    if (dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        const rows = await sql`
          SELECT 
            s.id,
            s.country_id,
            s.name,
            s.code,
            s.is_active,
            COALESCE(d.total_cities, 0)::int AS total_cities,
            COALESCE(ct.total_districts, 0)::int AS total_districts
          FROM public.states_provinces s
          LEFT JOIN (
            SELECT state_province_id, COUNT(*)::int AS total_cities
            FROM public.districts WHERE deleted_at IS NULL GROUP BY state_province_id
          ) d ON d.state_province_id = s.id
          LEFT JOIN (
            SELECT state_province_id, COUNT(*)::int AS total_districts
            FROM public.cities WHERE deleted_at IS NULL GROUP BY state_province_id
          ) ct ON ct.state_province_id = s.id
          WHERE s.country_id = ${countryId}::uuid AND s.deleted_at IS NULL
          ORDER BY s.name ASC
        `;
        return rows;
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    const states = await this.listStates({ countryId });
    return states.map((s) => ({
      ...s,
      total_cities: 0,
      total_districts: 0
    }));
  }

  async listCitySummaries(stateId: string) {
    const dbUrl = getDbUrl();
    if (dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        const rows = await sql`
          SELECT 
            d.id,
            d.country_id,
            d.state_province_id,
            d.name,
            d.code,
            d.is_active,
            COALESCE(ct.total_districts, 0)::int AS total_districts
          FROM public.districts d
          LEFT JOIN (
            SELECT district_id, COUNT(*)::int AS total_districts
            FROM public.cities WHERE deleted_at IS NULL GROUP BY district_id
          ) ct ON ct.district_id = d.id
          WHERE d.state_province_id = ${stateId}::uuid AND d.deleted_at IS NULL
          ORDER BY d.name ASC
        `;
        return rows;
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    const districts = await this.listDistricts({ stateProvinceId: stateId });
    return districts.map((d) => ({
      ...d,
      total_districts: 0
    }));
  }

  async getFullLocationTree() {
    const dbUrl = getDbUrl();
    if (dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        const [countries, states, districts, cities] = await Promise.all([
          sql`SELECT id, name, iso2 AS code, is_active FROM public.countries WHERE deleted_at IS NULL ORDER BY name ASC`,
          sql`SELECT id, country_id, name, code, is_active FROM public.states_provinces WHERE deleted_at IS NULL ORDER BY name ASC`,
          sql`SELECT id, country_id, state_province_id, name, code, is_active FROM public.districts WHERE deleted_at IS NULL ORDER BY name ASC`,
          sql`SELECT id, country_id, state_province_id, district_id, name, code, zip_code, is_active FROM public.cities WHERE deleted_at IS NULL ORDER BY name ASC`
        ]);

        const tree = countries.map((c: any) => {
          const cStates = states.filter((s: any) => s.country_id === c.id);
          return {
            id: c.id,
            name: c.name,
            code: c.code || "",
            type: "country",
            isActive: c.is_active,
            item: c,
            children: cStates.map((s: any) => {
              const sCities = districts.filter((d: any) => d.state_province_id === s.id);
              return {
                id: s.id,
                name: s.name,
                code: s.code || "",
                type: "state",
                isActive: s.is_active,
                item: s,
                children: sCities.map((d: any) => {
                  const dTehsils = cities.filter((ct: any) => ct.district_id === d.id);
                  return {
                    id: d.id,
                    name: d.name,
                    code: d.code || "",
                    type: "city",
                    isActive: d.is_active,
                    item: d,
                    children: dTehsils.map((ct: any) => ({
                      id: ct.id,
                      name: ct.name,
                      code: ct.code || "",
                      type: "district",
                      isActive: ct.is_active,
                      item: ct
                    }))
                  };
                })
              };
            })
          };
        });

        return tree;
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    return [];
  }
}

export const locationsRepository = new LocationsRepository();
