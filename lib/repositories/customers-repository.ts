import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { withLocalPg } from "@/lib/db/local-postgres";
import { searchRecordIdsByTranslation } from "@/lib/i18n/localize-records";

export type CustomerRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  customer_name: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  photo_url: string | null;
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

const CUSTOMER_COLUMNS = [
  "id", "country_id", "state_province_id", "district_id", "city_id", "area_location_id",
  "customer_name", "first_name", "last_name", "gender", "photo_url",
  "company_name", "contact_person", "mobile", "whatsapp", "email", "address",
  "notes", "original_language_code", "is_active", "created_at", "updated_at"
];

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export class CustomersRepository {
  // `customers` has scoped RLS (customers_scope_read) and this app's Supabase client is not
  // guaranteed to carry a real service-role key that bypasses RLS on its own — confirmed live:
  // list search silently returned an empty array and getById threw "Cannot coerce the result
  // to a single JSON object" (PostgREST's 0-rows-under-RLS error for .single()). Reads go
  // through a direct Postgres connection (DATABASE_URL, via withLocalPg — same proven bypass
  // already used by companies-repository.ts) when available, falling back to the Supabase
  // client otherwise. See banks-repository.ts for the same pattern.
  async search(input: { query?: string | null; countryId?: string | null; limit?: number }) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const q = cleanQuery(input.query ?? "");
    const like = q ? `%${q}%` : null;

    // Multilingual search: an approved transliteration of a customer/company name (never a
    // guess — see the master-data no-guess policy) should also match. Central resolver,
    // same as goods-repository.ts.
    const translatedMatchIds = q
      ? await searchRecordIdsByTranslation("customers", ["customer_name", "company_name", "contact_person"], q)
      : [];

    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT ${sql(CUSTOMER_COLUMNS)} FROM public.customers
        WHERE deleted_at IS NULL
          AND (${input.countryId ? sql`country_id = ${input.countryId}::uuid` : sql`true`})
          AND (${
            like
              ? sql`(customer_name ILIKE ${like} OR first_name ILIKE ${like} OR last_name ILIKE ${like} OR company_name ILIKE ${like} OR contact_person ILIKE ${like} OR email ILIKE ${like} OR mobile ILIKE ${like} OR whatsapp ILIKE ${like} OR address ILIKE ${like} OR notes ILIKE ${like} ${
                  translatedMatchIds.length > 0 ? sql`OR id = ANY(${translatedMatchIds}::uuid[])` : sql``
                })`
              : sql`true`
          })
        ORDER BY customer_name ASC
        LIMIT ${limit}
      `;
      return { customers: rows as unknown as CustomerRow[], limit };
    });
    if (viaPg) return viaPg;

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("customers")
      .select(CUSTOMER_COLUMNS.join(", "))
      .is("deleted_at", null)
      .order("customer_name", { ascending: true });

    if (input.countryId) query = query.eq("country_id", input.countryId);
    if (q) {
      query = query.or(
        [
          `customer_name.ilike.${like}`,
          `company_name.ilike.${like}`,
          `contact_person.ilike.${like}`,
          `email.ilike.${like}`,
          `mobile.ilike.${like}`,
          `whatsapp.ilike.${like}`
        ].join(",")
      );
    }

    const { data, error } = await query.limit(limit);
    if (error) {
      console.warn("Customers query fallback warning:", error.message);
      return { customers: [], limit };
    }
    return { customers: (data ?? []) as CustomerRow[], limit };
  }

  async getById(id: string) {
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT ${sql(CUSTOMER_COLUMNS)} FROM public.customers WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
      `;
      return (rows[0] as unknown as CustomerRow) ?? null;
    });
    if (viaPg) return viaPg;

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("customers")
      .select(CUSTOMER_COLUMNS.join(", "))
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return data as CustomerRow;
  }

  async getContacts(customerId: string) {
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT id, customer_id, contact_type, contact_value, is_primary, created_at
        FROM public.customer_contacts
        WHERE customer_id = ${customerId}::uuid AND deleted_at IS NULL
        ORDER BY is_primary DESC, created_at ASC
      `;
      return rows as unknown as CustomerContactRow[];
    });
    if (viaPg) return viaPg;

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
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT id, customer_id, registration_type, registration_value, created_at
        FROM public.customer_registrations
        WHERE customer_id = ${customerId}::uuid AND deleted_at IS NULL
        ORDER BY created_at ASC
      `;
      return rows as unknown as CustomerRegistrationRow[];
    });
    if (viaPg) return viaPg;

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
    countryId?: string | null;
    stateProvinceId?: string | null;
    districtId?: string | null;
    cityId?: string | null;
    areaLocationId?: string | null;
    customerName: string;
    firstName?: string | null;
    lastName?: string | null;
    gender?: string | null;
    photoUrl?: string | null;
    companyName?: string | null;
    contactPerson?: string | null;
    mobile?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    originalLanguageCode: string;
    actorId?: string | null;
  }) {
    const now = new Date().toISOString();

    const viaPg = await withLocalPg(async (sql) => {
      let resolvedCountryId: string | null = null;
      if (input.countryId) {
        const [c] = await sql`SELECT id FROM public.countries WHERE id = ${input.countryId}::uuid LIMIT 1`;
        if (c) resolvedCountryId = c.id;
      }
      if (!resolvedCountryId) {
        const [c] = await sql`SELECT id FROM public.countries WHERE is_active = true ORDER BY name ASC LIMIT 1`;
        resolvedCountryId = c?.id ?? null;
      }

      let validStateId: string | null = null;
      if (input.stateProvinceId) {
        try {
          const [st] = await sql`SELECT id FROM public.states_provinces WHERE id = ${input.stateProvinceId}::uuid LIMIT 1`;
          if (st) validStateId = st.id;
        } catch {
          validStateId = null;
        }
      }

      let validDistrictId: string | null = null;
      if (input.districtId) {
        try {
          const [dst] = await sql`SELECT id FROM public.districts WHERE id = ${input.districtId}::uuid LIMIT 1`;
          if (dst) validDistrictId = dst.id;
        } catch {
          validDistrictId = null;
        }
      }

      let validCityId: string | null = null;
      if (input.cityId) {
        try {
          const [ct] = await sql`SELECT id FROM public.cities WHERE id = ${input.cityId}::uuid LIMIT 1`;
          if (ct) validCityId = ct.id;
        } catch {
          validCityId = null;
        }
      }

      let validAreaId: string | null = null;
      if (input.areaLocationId) {
        try {
          const [ar] = await sql`SELECT id FROM public.area_locations WHERE id = ${input.areaLocationId}::uuid LIMIT 1`;
          if (ar) validAreaId = ar.id;
        } catch {
          validAreaId = null;
        }
      }

      let validActorId: string | null = null;
      if (input.actorId) {
        try {
          const [prof] = await sql`SELECT id FROM public.users WHERE id = ${input.actorId}::uuid LIMIT 1`;
          if (prof) validActorId = prof.id;
        } catch {
          validActorId = null;
        }
      }

      const insertRow = {
        country_id: resolvedCountryId,
        state_province_id: validStateId,
        district_id: validDistrictId,
        city_id: validCityId,
        area_location_id: validAreaId,
        customer_name: input.customerName.trim(),
        first_name: input.firstName?.trim() || null,
        last_name: input.lastName?.trim() || null,
        gender: input.gender ?? null,
        photo_url: input.photoUrl ?? null,
        company_name: input.companyName ?? null,
        contact_person: input.contactPerson ?? null,
        mobile: input.mobile ?? null,
        whatsapp: input.whatsapp ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        original_language_code: input.originalLanguageCode,
        is_active: true,
        created_by: validActorId,
        created_at: now,
        updated_at: now
      };

      const rows = await sql`INSERT INTO public.customers ${sql(insertRow)} RETURNING id`;
      const createdId = (rows[0] as any).id as string;

      try {
        const serials = await allocateFormSerials("customers", { countryId: resolvedCountryId, branchKey: input.cityId ?? null });
        const serialPatch = {
          super_admin_serial: serials.superAdminSerial,
          country_serial: serials.countrySerial,
          branch_serial: serials.branchSerial,
          entry_serial: serials.entrySerial
        };
        await sql`UPDATE public.customers SET ${sql(serialPatch)} WHERE id = ${createdId}::uuid`;
      } catch { /* non-fatal */ }

      return createdId;
    });

    if (!viaPg) {
      throw new Error("Customer create requires DATABASE_URL connection.");
    }
    return viaPg as string;
  }

  async insertContacts(customerId: string, contacts: Array<{ type: string; value: string; isPrimary?: boolean }>) {
    if (!contacts.length) return;
    const rows = contacts.map((c) => ({
      customer_id: customerId,
      contact_type: c.type,
      contact_value: c.value,
      is_primary: Boolean(c.isPrimary)
    }));

    const viaPg = await withLocalPg(async (sql) => {
      await sql`INSERT INTO public.customer_contacts ${sql(rows)}`;
      return true;
    });
    if (viaPg) return;

    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase.from("customer_contacts").insert(rows);
    if (error) throw new Error(error.message);
  }

  async insertRegistrations(
    customerId: string,
    regs: Array<{ type: string; value: string }>
  ) {
    if (!regs.length) return;
    const rows = regs.map((r) => ({
      customer_id: customerId,
      registration_type: r.type,
      registration_value: r.value
    }));

    const viaPg = await withLocalPg(async (sql) => {
      await sql`INSERT INTO public.customer_registrations ${sql(rows)}`;
      return true;
    });
    if (viaPg) return;

    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase.from("customer_registrations").insert(rows);
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
      firstName: string | null;
      lastName: string | null;
      gender: string | null;
      photoUrl: string | null;
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
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("stateProvinceId" in input) patch.state_province_id = input.stateProvinceId;
    if ("districtId" in input) patch.district_id = input.districtId;
    if ("cityId" in input) patch.city_id = input.cityId;
    if ("areaLocationId" in input) patch.area_location_id = input.areaLocationId;
    if ("customerName" in input) patch.customer_name = input.customerName;
    if ("firstName" in input) patch.first_name = input.firstName;
    if ("lastName" in input) patch.last_name = input.lastName;
    if ("gender" in input) patch.gender = input.gender;
    if ("photoUrl" in input) patch.photo_url = input.photoUrl;
    if ("companyName" in input) patch.company_name = input.companyName;
    if ("contactPerson" in input) patch.contact_person = input.contactPerson;
    if ("mobile" in input) patch.mobile = input.mobile;
    if ("whatsapp" in input) patch.whatsapp = input.whatsapp;
    if ("email" in input) patch.email = input.email;
    if ("address" in input) patch.address = input.address;
    if ("notes" in input) patch.notes = input.notes;
    if ("originalLanguageCode" in input) patch.original_language_code = input.originalLanguageCode;
    if ("isActive" in input) patch.is_active = input.isActive;

    const viaPg = await withLocalPg(async (sql) => {
      await sql`UPDATE public.customers SET ${sql(patch)} WHERE id = ${id}::uuid AND deleted_at IS NULL`;
      return true;
    });
    if (!viaPg) {
      const supabase = createSupabaseAdminClient() as any;
      const { error } = await supabase.from("customers").update(patch).eq("id", id).is("deleted_at", null);
      if (error) throw new Error(error.message);
    }
    // Translation write stays the sole responsibility of customers-service.ts.update() — see
    // the note in create() above.
  }

  async softDelete(id: string) {
    const patch = { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false };
    const viaPg = await withLocalPg(async (sql) => {
      await sql`UPDATE public.customers SET ${sql(patch)} WHERE id = ${id}::uuid AND deleted_at IS NULL`;
      return true;
    });
    if (viaPg) return;

    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const customersRepository = new CustomersRepository();
