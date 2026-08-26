import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import postgres from "postgres";
import { searchRecordIdsByTranslation } from "@/lib/i18n/localize-records";

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
  company_code: string | null;
  name: string;
  legal_name: string | null;
  base_currency: string;
  owner_name: string | null;
  owner_person_id: string | null;
  manager_person_id: string | null;
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
  ownerPersonId?: string | null;
  managerPersonId?: string | null;
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
  "company_code",
  "name",
  "legal_name",
  "base_currency",
  "owner_name",
  "owner_person_id",
  "manager_person_id",
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

function parseJsonField(val: any) {
  if (!val) return [];
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return Array.isArray(val) ? val : [];
}

function mapRawRow(r: any): CompanyRow {
  return {
    id: r.id,
    company_code: r.company_code ?? null,
    name: r.name,
    legal_name: r.legal_name ?? null,
    base_currency: r.base_currency ?? "USD",
    owner_name: r.owner_name ?? null,
    owner_person_id: r.owner_person_id ?? null,
    manager_person_id: r.manager_person_id ?? null,
    business_type: r.business_type ?? null,
    country_id: r.country_id ?? null,
    state_province_id: r.state_province_id ?? null,
    district_id: r.district_id ?? null,
    city_id: r.city_id ?? null,
    area_location_id: r.area_location_id ?? null,
    country_name: r.country_name ?? null,
    state_name: r.state_name ?? null,
    district_name: r.district_name ?? null,
    city_name: r.city_name ?? null,
    area_name: r.area_name ?? null,
    zip_code: r.zip_code ?? null,
    address: r.address ?? null,
    contacts: parseJsonField(r.contacts),
    registrations: parseJsonField(r.registrations),
    owner_ids: parseJsonField(r.owner_ids),
    is_active: r.is_active ?? true,
    created_at: String(r.created_at || new Date().toISOString()),
    updated_at: String(r.updated_at || new Date().toISOString())
  };
}

function toPayload(input: Partial<CompanyWriteInput>) {
  const payload: Record<string, unknown> = {};
  if ("name" in input) payload.name = cleanText(input.name) ?? "";
  if ("legalName" in input) payload.legal_name = cleanText(input.legalName);
  if ("baseCurrency" in input) payload.base_currency = cleanText(input.baseCurrency)?.toUpperCase() ?? "USD";
  if ("ownerName" in input) payload.owner_name = cleanText(input.ownerName);
  if ("ownerPersonId" in input) payload.owner_person_id = input.ownerPersonId || null;
  if ("managerPersonId" in input) payload.manager_person_id = input.managerPersonId || null;
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
    const limit = Math.min(Math.max(input.limit ?? 500, 1), 500);
    const q = cleanQuery(input.query ?? "");
    const localDbUrl = getDbUrl();
    // Multilingual search: an approved translation/transliteration of a company name
    // should also match. Central resolver, same as goods/customers/accounts/banks search.
    const translatedMatchIds = q
      ? await searchRecordIdsByTranslation("companies", ["name", "legal_name", "owner_name"], q)
      : [];

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = q
          ? await localSql`
              SELECT * FROM public.companies
              WHERE deleted_at IS NULL
                AND (name ILIKE ${'%' + q + '%'} OR legal_name ILIKE ${'%' + q + '%'} OR owner_name ILIKE ${'%' + q + '%'} OR country_name ILIKE ${'%' + q + '%'} OR city_name ILIKE ${'%' + q + '%'} OR id = ANY(${translatedMatchIds}::uuid[]))
              ORDER BY name ASC
              LIMIT ${limit}
            `
          : await localSql`
              SELECT * FROM public.companies 
              WHERE deleted_at IS NULL 
              ORDER BY name ASC 
              LIMIT ${limit}
            `;
        if (rows && rows.length > 0) {
          return { companies: rows.map(mapRawRow), limit };
        }
      } catch (err) {
        console.error("Direct postgres search error:", err);
      } finally {
        await localSql.end({ timeout: 5 });
      }
    }

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (q) {
      const like = `%${q}%`;
      query = query.or([`name.ilike.${like}`, `legal_name.ilike.${like}`, `owner_name.ilike.${like}`, `country_name.ilike.${like}`, `city_name.ilike.${like}`].join(","));
    }

    const { data } = await query.limit(limit);
    return { companies: ((data ?? []).map(mapRawRow)) as CompanyRow[], limit };
  }

  async getById(id: string) {
    const localDbUrl = getDbUrl();
    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = await localSql`
          SELECT * FROM public.companies WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
        `;
        if (rows && rows.length > 0) {
          return mapRawRow(rows[0]);
        }
      } catch (err) {
        console.error("Direct postgres getById error:", err);
      } finally {
        await localSql.end({ timeout: 5 });
      }
    }

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return mapRawRow(data);
  }

  async create(input: CompanyWriteInput) {
    const now = new Date().toISOString();
    const payload = toPayload(input);
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = await localSql`
          INSERT INTO public.companies (
            name, legal_name, base_currency, owner_name, owner_person_id, manager_person_id, business_type,
            country_id, state_province_id, district_id, city_id, area_location_id,
            country_name, state_name, district_name, city_name, area_name, zip_code, address,
            contacts, registrations, owner_ids, is_active, created_at, updated_at
          ) VALUES (
            ${(payload.name as string) || ""},
            ${(payload.legal_name as string) || null},
            ${(payload.base_currency as string) || "USD"},
            ${(payload.owner_name as string) || null},
            ${payload.owner_person_id ? String(payload.owner_person_id) : null}::uuid,
            ${payload.manager_person_id ? String(payload.manager_person_id) : null}::uuid,
            ${(payload.business_type as string) || null},
            ${payload.country_id ? String(payload.country_id) : null}::uuid,
            ${payload.state_province_id ? String(payload.state_province_id) : null}::uuid,
            ${payload.district_id ? String(payload.district_id) : null}::uuid,
            ${payload.city_id ? String(payload.city_id) : null}::uuid,
            ${payload.area_location_id ? String(payload.area_location_id) : null}::uuid,
            ${(payload.country_name as string) || null},
            ${(payload.state_name as string) || null},
            ${(payload.district_name as string) || null},
            ${(payload.city_name as string) || null},
            ${(payload.area_name as string) || null},
            ${(payload.zip_code as string) || null},
            ${(payload.address as string) || null},
            ${localSql.json((payload.contacts || []) as any)},
            ${localSql.json((payload.registrations || []) as any)},
            ${localSql.json((payload.owner_ids || []) as any)},
            true, ${now}, ${now}
          )
          RETURNING id
        `;
        if (rows && rows[0]?.id) {
          const createdId = rows[0].id as string;
          try {
            const serials = await allocateFormSerials("companies", {
              countryId: (payload.country_id as string) || null,
              branchKey: (payload.city_id as string) || null,
              prefix: "CMP"
            });
            const serialPatch = {
              super_admin_serial: serials.superAdminSerial,
              country_serial: serials.countrySerial,
              branch_serial: serials.branchSerial,
              entry_serial: serials.entrySerial,
              company_code: serials.entrySerial
            };
            await localSql`UPDATE public.companies SET ${localSql(serialPatch)} WHERE id = ${createdId}::uuid`;
          } catch { /* non-fatal */ }
          return createdId;
        }
      } catch (err) {
        console.error("Direct postgres create error:", err);
      } finally {
        await localSql.end({ timeout: 5 });
      }
    }

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase.from("companies").insert({
      ...payload,
      is_active: true,
      created_at: now,
      updated_at: now
    }).select("id").single();
    if (error) throw new Error(error.message);
    const createdId = data.id as string;
    try {
      const serials = await allocateFormSerials("companies", {
        countryId: (payload.country_id as string) || null,
        branchKey: (payload.city_id as string) || null,
        prefix: "CMP"
      });
      await supabase.from("companies").update({
        super_admin_serial: serials.superAdminSerial,
        country_serial: serials.countrySerial,
        branch_serial: serials.branchSerial,
        entry_serial: serials.entrySerial,
        company_code: serials.entrySerial
      }).eq("id", createdId);
    } catch {}
    return createdId;
  }

  async update(id: string, input: Partial<CompanyWriteInput>) {
    const now = new Date().toISOString();
    const payload = toPayload(input);
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = await localSql`
          UPDATE public.companies SET
            name = COALESCE(${payload.name !== undefined ? (payload.name as string) : null}, name),
            legal_name = COALESCE(${payload.legal_name !== undefined ? (payload.legal_name as string) : null}, legal_name),
            base_currency = COALESCE(${payload.base_currency !== undefined ? (payload.base_currency as string) : null}, base_currency),
            owner_name = COALESCE(${payload.owner_name !== undefined ? (payload.owner_name as string) : null}, owner_name),
            owner_person_id = COALESCE(${payload.owner_person_id !== undefined ? (payload.owner_person_id ? String(payload.owner_person_id) : null) : null}::uuid, owner_person_id),
            manager_person_id = COALESCE(${payload.manager_person_id !== undefined ? (payload.manager_person_id ? String(payload.manager_person_id) : null) : null}::uuid, manager_person_id),
            business_type = COALESCE(${payload.business_type !== undefined ? (payload.business_type as string) : null}, business_type),
            country_id = COALESCE(${payload.country_id !== undefined ? (payload.country_id ? String(payload.country_id) : null) : null}::uuid, country_id),
            state_province_id = COALESCE(${payload.state_province_id !== undefined ? (payload.state_province_id ? String(payload.state_province_id) : null) : null}::uuid, state_province_id),
            district_id = COALESCE(${payload.district_id !== undefined ? (payload.district_id ? String(payload.district_id) : null) : null}::uuid, district_id),
            city_id = COALESCE(${payload.city_id !== undefined ? (payload.city_id ? String(payload.city_id) : null) : null}::uuid, city_id),
            area_location_id = COALESCE(${payload.area_location_id !== undefined ? (payload.area_location_id ? String(payload.area_location_id) : null) : null}::uuid, area_location_id),
            country_name = COALESCE(${payload.country_name !== undefined ? (payload.country_name as string) : null}, country_name),
            state_name = COALESCE(${payload.state_name !== undefined ? (payload.state_name as string) : null}, state_name),
            district_name = COALESCE(${payload.district_name !== undefined ? (payload.district_name as string) : null}, district_name),
            city_name = COALESCE(${payload.city_name !== undefined ? (payload.city_name as string) : null}, city_name),
            area_name = COALESCE(${payload.area_name !== undefined ? (payload.area_name as string) : null}, area_name),
            zip_code = COALESCE(${payload.zip_code !== undefined ? (payload.zip_code as string) : null}, zip_code),
            address = COALESCE(${payload.address !== undefined ? (payload.address as string) : null}, address),
            contacts = COALESCE(${payload.contacts !== undefined ? localSql.json(payload.contacts as any) : null}, contacts),
            registrations = COALESCE(${payload.registrations !== undefined ? localSql.json(payload.registrations as any) : null}, registrations),
            owner_ids = COALESCE(${payload.owner_ids !== undefined ? localSql.json(payload.owner_ids as any) : null}, owner_ids),
            is_active = COALESCE(${payload.is_active !== undefined ? Boolean(payload.is_active) : null}, is_active),
            updated_at = ${now}
          WHERE id = ${id}::uuid AND deleted_at IS NULL
          RETURNING id
        `;
        if (rows && rows.length > 0) return;
      } catch (err) {
        console.error("Direct postgres update error:", err);
      } finally {
        await localSql.end({ timeout: 5 });
      }
    }

    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { ...payload, updated_at: now };
    const { error } = await supabase.from("companies").update(patch).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const now = new Date().toISOString();
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        await localSql`
          UPDATE public.companies SET deleted_at = ${now}, updated_at = ${now}, is_active = false
          WHERE id = ${id}::uuid AND deleted_at IS NULL
        `;
        return;
      } catch (err) {
        console.error("Direct postgres softDelete error:", err);
      } finally {
        await localSql.end({ timeout: 5 });
      }
    }

    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("companies")
      .update({ deleted_at: now, updated_at: now, is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const companiesRepository = new CompaniesRepository();
