import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  async listCountries(input?: { query?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input?.limit ?? 200, 1), 500);
    const q = (input?.query ?? "").trim();

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

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);
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
    const { data, error } = await supabase
      .from("countries")
      .insert({
        name: input.name.trim(),
        iso2: input.iso2 ? input.iso2.trim().toUpperCase() : null,
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
    if (error) throw new Error(error.message);
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
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name?.trim();
    if (input.iso2 !== undefined) patch.iso2 = input.iso2 ? input.iso2.trim().toUpperCase() : null;
    if (input.iso3 !== undefined) patch.iso3 = input.iso3 ? input.iso3.trim().toUpperCase() : null;
    if (input.currencyCode !== undefined) patch.currency_code = input.currencyCode ? input.currencyCode.trim().toUpperCase() : null;
    if (input.defaultLanguageCode !== undefined) patch.default_language_code = input.defaultLanguageCode ?? null;
    if (input.isActive !== undefined && input.isActive !== null) patch.is_active = Boolean(input.isActive);
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
    return data as CountryRow;
  }

  async listStates(input: { countryId: string; query?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const q = (input.query ?? "").trim();

    let query = supabase
      .from("states_provinces")
      .select("id, country_id, name, code, postal_code, phone_area_code, is_active")
      .eq("country_id", input.countryId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as StateRow[];
  }

  async listDistricts(input: { stateProvinceId: string; query?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const q = (input.query ?? "").trim();

    let query = supabase
      .from("districts")
      .select("id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active")
      .eq("state_province_id", input.stateProvinceId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);
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

    let query = supabase
      .from("cities")
      .select("id, country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active")
      .eq("country_id", input.countryId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (input.districtId === null) query = query.is("district_id", null);
    else if (input.districtId) query = query.eq("district_id", input.districtId);
    else if (input.stateProvinceId === null) query = query.is("state_province_id", null);
    else if (input.stateProvinceId) query = query.eq("state_province_id", input.stateProvinceId);

    if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,zip_code.ilike.%${q}%`);

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as CityRow[];
  }

  async listAreas(input: { cityId: string; query?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const q = (input.query ?? "").trim();

    let query = supabase
      .from("areas_locations")
      .select("id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active")
      .eq("city_id", input.cityId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (q) query = query.ilike("name", `%${q}%`);

    const { data, error } = await query.limit(limit);
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active")
      .single();
    if (error) throw new Error(error.message);
    return data as AreaRow;
  }

  async updateArea(input: { areaId: string; name?: string | null; code?: string | null; districtId?: string | null; isActive?: boolean | null }) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name?.trim();
    if (input.code !== undefined) patch.code = input.code ? input.code.trim() : null;
    if (input.districtId !== undefined) patch.district_id = input.districtId;
    if (input.isActive !== undefined && input.isActive !== null) patch.is_active = Boolean(input.isActive);

    const { data, error } = await supabase
      .from("areas_locations")
      .update(patch)
      .eq("id", input.areaId)
      .is("deleted_at", null)
      .select("id, country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code, is_active")
      .single();
    if (error) throw new Error(error.message);
    return data as AreaRow;
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
}

export const locationsRepository = new LocationsRepository();
