import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CompanyContact = {
  id?: string;
  type?: string;
  value?: string;
  isPrimary?: boolean;
};

export type CompanyRegistration = {
  id?: string;
  type?: string;
  value?: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  legal_name: string | null;
  base_currency: string;
  owner_name: string | null;
  business_type: string | null;
  country_id: string | null;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  country_name: string | null;
  state_name: string | null;
  district_name: string | null;
  city_name: string | null;
  area_name: string | null;
  zip_code: string | null;
  address: string | null;
  contacts: CompanyContact[];
  registrations: CompanyRegistration[];
  owner_ids: CompanyRegistration[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyWriteInput = {
  name: string;
  legalName?: string | null;
  baseCurrency: string;
  ownerName?: string | null;
  businessType?: string | null;
  countryId?: string | null;
  stateProvinceId?: string | null;
  districtId?: string | null;
  cityId?: string | null;
  areaLocationId?: string | null;
  countryName?: string | null;
  stateName?: string | null;
  districtName?: string | null;
  cityName?: string | null;
  areaName?: string | null;
  zipCode?: string | null;
  address?: string | null;
  contacts?: CompanyContact[];
  registrations?: CompanyRegistration[];
  ownerIds?: CompanyRegistration[];
  isActive?: boolean;
};

const COMPANY_SELECT = [
  "id",
  "name",
  "legal_name",
  "base_currency",
  "owner_name",
  "business_type",
  "country_id",
  "state_province_id",
  "district_id",
  "city_id",
  "area_location_id",
  "country_name",
  "state_name",
  "district_name",
  "city_name",
  "area_name",
  "zip_code",
  "address",
  "contacts",
  "registrations",
  "owner_ids",
  "is_active",
  "created_at",
  "updated_at"
].join(",");

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function cleanText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function cleanJsonArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function toPayload(input: Partial<CompanyWriteInput>) {
  const payload: Record<string, unknown> = {};
  if ("name" in input) payload.name = cleanText(input.name) ?? "";
  if ("legalName" in input) payload.legal_name = cleanText(input.legalName);
  if ("baseCurrency" in input) payload.base_currency = cleanText(input.baseCurrency)?.toUpperCase() ?? "USD";
  if ("ownerName" in input) payload.owner_name = cleanText(input.ownerName);
  if ("businessType" in input) payload.business_type = cleanText(input.businessType);
  if ("countryId" in input) payload.country_id = input.countryId || null;
  if ("stateProvinceId" in input) payload.state_province_id = input.stateProvinceId || null;
  if ("districtId" in input) payload.district_id = input.districtId || null;
  if ("cityId" in input) payload.city_id = input.cityId || null;
  if ("areaLocationId" in input) payload.area_location_id = input.areaLocationId || null;
  if ("countryName" in input) payload.country_name = cleanText(input.countryName);
  if ("stateName" in input) payload.state_name = cleanText(input.stateName);
  if ("districtName" in input) payload.district_name = cleanText(input.districtName);
  if ("cityName" in input) payload.city_name = cleanText(input.cityName);
  if ("areaName" in input) payload.area_name = cleanText(input.areaName);
  if ("zipCode" in input) payload.zip_code = cleanText(input.zipCode);
  if ("address" in input) payload.address = cleanText(input.address);
  if ("contacts" in input) payload.contacts = cleanJsonArray(input.contacts);
  if ("registrations" in input) payload.registrations = cleanJsonArray(input.registrations);
  if ("ownerIds" in input) payload.owner_ids = cleanJsonArray(input.ownerIds);
  if ("isActive" in input) payload.is_active = Boolean(input.isActive);
  return payload;
}

export class CompaniesRepository {
  async search(input: { query?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

    let query = supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    const q = cleanQuery(input.query ?? "");
    if (q) {
      const like = `%${q}%`;
      query = query.or([`name.ilike.${like}`, `legal_name.ilike.${like}`, `owner_name.ilike.${like}`, `country_name.ilike.${like}`, `city_name.ilike.${like}`].join(","));
    }

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);
    return { companies: (data ?? []) as CompanyRow[], limit };
  }

  async getById(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return data as CompanyRow;
  }

  async create(input: CompanyWriteInput) {
    const supabase = createSupabaseAdminClient() as any;
    const now = new Date().toISOString();
    const payload = {
      ...toPayload(input),
      is_active: true,
      created_at: now,
      updated_at: now
    };

    const { data, error } = await supabase.from("companies").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async update(id: string, input: Partial<CompanyWriteInput>) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { ...toPayload(input), updated_at: new Date().toISOString() };

    const { error } = await supabase.from("companies").update(patch).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("companies")
      .update({ deleted_at: now, updated_at: now, is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const companiesRepository = new CompaniesRepository();
