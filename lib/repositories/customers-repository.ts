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
  country_name?: string | null;
  state_province_name?: string | null;
  city_name?: string | null;
  customer_name: string;
  first_name: string | null;
  last_name: string | null;
  father_name: string | null;
  gender: string | null;
  photo_url: string | null;
  person_code: string | null;
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
  "customer_name", "first_name", "last_name", "father_name", "gender", "photo_url", "person_code",
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
        SELECT 
          c.id, c.country_id, c.state_province_id, c.district_id, c.city_id, c.area_location_id,
          c.customer_name, c.first_name, c.last_name, c.father_name, c.gender, c.photo_url, c.person_code,
          c.company_name, c.contact_person, c.mobile, c.whatsapp, c.email, c.address,
          c.notes, c.original_language_code, c.is_active, c.created_at, c.updated_at,
          cnt.name as country_name,
          sp.name as state_province_name,
          ct.name as city_name
        FROM public.customers c
        LEFT JOIN public.countries cnt ON c.country_id = cnt.id
        LEFT JOIN public.states_provinces sp ON c.state_province_id = sp.id
        LEFT JOIN public.cities ct ON c.city_id = ct.id
        WHERE c.deleted_at IS NULL
          AND (${input.countryId ? sql`c.country_id = ${input.countryId}::uuid` : sql`true`})
          AND (${
            like
              ? sql`(c.customer_name ILIKE ${like} OR c.first_name ILIKE ${like} OR c.last_name ILIKE ${like} OR c.father_name ILIKE ${like} OR c.person_code ILIKE ${like} OR c.company_name ILIKE ${like} OR c.contact_person ILIKE ${like} OR c.email ILIKE ${like} OR c.mobile ILIKE ${like} OR c.whatsapp ILIKE ${like} OR c.address ILIKE ${like} OR c.notes ILIKE ${like}
                  OR EXISTS (SELECT 1 FROM public.customer_registrations cr WHERE cr.customer_id = c.id AND cr.deleted_at IS NULL AND cr.registration_value ILIKE ${like}) ${
                  translatedMatchIds.length > 0 ? sql`OR c.id = ANY(${translatedMatchIds}::uuid[])` : sql``
                })`
              : sql`true`
          })
        ORDER BY c.customer_name ASC
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
          `father_name.ilike.${like}`,
          `person_code.ilike.${like}`,
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
        SELECT 
          c.id, c.country_id, c.state_province_id, c.district_id, c.city_id, c.area_location_id,
          c.customer_name, c.first_name, c.last_name, c.father_name, c.gender, c.photo_url, c.person_code,
          c.company_name, c.contact_person, c.mobile, c.whatsapp, c.email, c.address,
          c.notes, c.original_language_code, c.is_active, c.created_at, c.updated_at,
          cnt.name as country_name,
          sp.name as state_province_name,
          ct.name as city_name
        FROM public.customers c
        LEFT JOIN public.countries cnt ON c.country_id = cnt.id
        LEFT JOIN public.states_provinces sp ON c.state_province_id = sp.id
        LEFT JOIN public.cities ct ON c.city_id = ct.id
        WHERE c.id = ${id}::uuid AND c.deleted_at IS NULL LIMIT 1
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
    fatherName?: string | null;
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
        father_name: input.fatherName?.trim() || null,
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

      // Person Master identity code (PER-000001 style) — a single global sequence, distinct
      // from the 4-scope allocateFormSerials() engine above (that one is for transactional
      // forms; a person identity only needs one clean global number, not country/branch/entry
      // variants). Calls next_entity_serial() directly on the same connection rather than via
      // the Supabase admin client, matching this repository's established direct-Postgres
      // preference (see class-level comment).
      try {
        const [row] = await sql`SELECT next_entity_serial('global', 'GLOBAL', 'person', 'PER') AS code`;
        if (row?.code) {
          await sql`UPDATE public.customers SET person_code = ${row.code} WHERE id = ${createdId}::uuid AND person_code IS NULL`;
        }
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
      fatherName: string | null;
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
    if ("fatherName" in input) patch.father_name = input.fatherName;
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
