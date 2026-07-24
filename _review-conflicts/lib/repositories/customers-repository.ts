import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CustomerRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  original_language_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerContactRow = {
  id: string;
  customer_id: string;
  contact_type: string;
  contact_value: string;
  is_primary: boolean;
  created_at: string;
};

export type CustomerRegistrationRow = {
  id: string;
  customer_id: string;
  registration_type: string;
  registration_value: string;
  created_at: string;
};

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export class CustomersRepository {
  async search(input: { query?: string | null; countryId?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

    let query = supabase
      .from("customers")
      .select(
        "id, country_id, state_province_id, district_id, city_id, area_location_id, customer_name, company_name, contact_person, mobile, whatsapp, email, address, notes, original_language_code, is_active, created_at, updated_at"
      )
      .is("deleted_at", null)
      .order("customer_name", { ascending: true });

    if (input.countryId) query = query.eq("country_id", input.countryId);

    const q = cleanQuery(input.query ?? "");
    if (q) {
      const like = `%${q}%`;
      query = query.or(
        [
          `customer_name.ilike.${like}`,
          `company_name.ilike.${like}`,
          `email.ilike.${like}`,
          `mobile.ilike.${like}`,
          `whatsapp.ilike.${like}`
        ].join(",")
      );
    }

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);
    return { customers: (data ?? []) as CustomerRow[], limit };
  }

  async getById(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, country_id, state_province_id, district_id, city_id, area_location_id, customer_name, company_name, contact_person, mobile, whatsapp, email, address, notes, original_language_code, is_active, created_at, updated_at"
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return data as CustomerRow;
  }

  async getContacts(customerId: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("customer_contacts")
      .select("id, customer_id, contact_type, contact_value, is_primary, created_at")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as CustomerContactRow[];
  }

  async getRegistrations(customerId: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("customer_registrations")
      .select("id, customer_id, registration_type, registration_value, created_at")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as CustomerRegistrationRow[];
  }

  async create(input: {
    countryId: string;
    stateProvinceId?: string | null;
    districtId?: string | null;
    cityId?: string | null;
    areaLocationId?: string | null;
    customerName: string;
    companyName?: string | null;
    contactPerson?: string | null;
    mobile?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    originalLanguageCode: string;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase.rpc("create_customer", {
      p_country_id: input.countryId,
      p_state_province_id: input.stateProvinceId ?? null,
      p_district_id: input.districtId ?? null,
      p_city_id: input.cityId ?? null,
      p_area_location_id: input.areaLocationId ?? null,
      p_customer_name: input.customerName,
      p_company_name: input.companyName ?? null,
      p_contact_person: input.contactPerson ?? null,
      p_mobile: input.mobile ?? null,
      p_whatsapp: input.whatsapp ?? null,
      p_email: input.email ?? null,
      p_address: input.address ?? null,
      p_notes: input.notes ?? null,
      p_original_language_code: input.originalLanguageCode
    });
    if (error) throw new Error(error.message);
    return data as string;
  }

  async insertContacts(customerId: string, contacts: Array<{ type: string; value: string; isPrimary?: boolean }>) {
    if (!contacts.length) return;
    const supabase = createSupabaseAdminClient() as any;
    const payload = contacts.map((c) => ({
      customer_id: customerId,
      contact_type: c.type,
      contact_value: c.value,
      is_primary: Boolean(c.isPrimary)
    }));
    const { error } = await supabase.from("customer_contacts").insert(payload);
    if (error) throw new Error(error.message);
  }

  async insertRegistrations(
    customerId: string,
    regs: Array<{ type: string; value: string }>
  ) {
    if (!regs.length) return;
    const supabase = createSupabaseAdminClient() as any;
    const payload = regs.map((r) => ({
      customer_id: customerId,
      registration_type: r.type,
      registration_value: r.value
    }));
    const { error } = await supabase.from("customer_registrations").insert(payload);
    if (error) throw new Error(error.message);
  }

  async update(
    id: string,
    input: Partial<{
      stateProvinceId: string | null;
      districtId: string | null;
      cityId: string | null;
      areaLocationId: string | null;
      customerName: string;
      companyName: string | null;
      contactPerson: string | null;
      mobile: string | null;
      whatsapp: string | null;
      email: string | null;
      address: string | null;
      notes: string | null;
      originalLanguageCode: string;
      isActive: boolean;
    }>
  ) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("stateProvinceId" in input) patch.state_province_id = input.stateProvinceId;
    if ("districtId" in input) patch.district_id = input.districtId;
    if ("cityId" in input) patch.city_id = input.cityId;
    if ("areaLocationId" in input) patch.area_location_id = input.areaLocationId;
    if ("customerName" in input) patch.customer_name = input.customerName;
    if ("companyName" in input) patch.company_name = input.companyName;
    if ("contactPerson" in input) patch.contact_person = input.contactPerson;
    if ("mobile" in input) patch.mobile = input.mobile;
    if ("whatsapp" in input) patch.whatsapp = input.whatsapp;
    if ("email" in input) patch.email = input.email;
    if ("address" in input) patch.address = input.address;
    if ("notes" in input) patch.notes = input.notes;
    if ("originalLanguageCode" in input) patch.original_language_code = input.originalLanguageCode;
    if ("isActive" in input) patch.is_active = input.isActive;

    const { error } = await supabase.from("customers").update(patch).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const customersRepository = new CustomersRepository();

