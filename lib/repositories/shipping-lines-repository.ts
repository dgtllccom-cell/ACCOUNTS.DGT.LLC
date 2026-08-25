import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import postgres from "postgres";

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

export type ShippingLineRow = {
  id: string;
  shipping_line_code: string | null;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  country_id: string | null;
  remarks: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ShippingLineWriteInput = {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  countryId?: string | null;
  remarks?: string | null;
  originalLanguage?: string;
  isActive?: boolean;
};

const SHIPPING_LINE_SELECT = [
  "id",
  "shipping_line_code",
  "name",
  "contact_person",
  "phone",
  "email",
  "website",
  "country_id",
  "remarks",
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

function mapRawRow(r: any): ShippingLineRow {
  return {
    id: r.id,
    shipping_line_code: r.shipping_line_code ?? null,
    name: r.name,
    contact_person: r.contact_person ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    website: r.website ?? null,
    country_id: r.country_id ?? null,
    remarks: r.remarks ?? null,
    is_active: r.is_active ?? true,
    created_at: String(r.created_at || new Date().toISOString()),
    updated_at: String(r.updated_at || new Date().toISOString())
  };
}

function toPayload(input: Partial<ShippingLineWriteInput>) {
  const payload: Record<string, unknown> = {};
  if ("name" in input) payload.name = cleanText(input.name) ?? "";
  if ("contactPerson" in input) payload.contact_person = cleanText(input.contactPerson);
  if ("phone" in input) payload.phone = cleanText(input.phone);
  if ("email" in input) payload.email = cleanText(input.email);
  if ("website" in input) payload.website = cleanText(input.website);
  if ("countryId" in input) payload.country_id = input.countryId || null;
  if ("remarks" in input) payload.remarks = cleanText(input.remarks);
  if ("isActive" in input) payload.is_active = Boolean(input.isActive);
  return payload;
}

export class ShippingLinesRepository {
  async search(input: { query?: string | null; limit?: number }) {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const q = cleanQuery(input.query ?? "");
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = q
          ? await localSql`
              SELECT * FROM public.shipping_lines
              WHERE deleted_at IS NULL
                AND (name ILIKE ${'%' + q + '%'} OR shipping_line_code ILIKE ${'%' + q + '%'} OR contact_person ILIKE ${'%' + q + '%'} OR email ILIKE ${'%' + q + '%'})
              ORDER BY name ASC
              LIMIT ${limit}
            `
          : await localSql`
              SELECT * FROM public.shipping_lines
              WHERE deleted_at IS NULL
              ORDER BY name ASC
              LIMIT ${limit}
            `;
        if (rows && rows.length > 0) {
          return { shippingLines: rows.map(mapRawRow), limit };
        }
      } catch (err) {
        console.error("Direct postgres search error:", err);
      } finally {
        await localSql.end({ timeout: 5 });
      }
    }

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("shipping_lines")
      .select(SHIPPING_LINE_SELECT)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (q) {
      const like = `%${q}%`;
      query = query.or([`name.ilike.${like}`, `shipping_line_code.ilike.${like}`, `contact_person.ilike.${like}`, `email.ilike.${like}`].join(","));
    }

    const { data } = await query.limit(limit);
    return { shippingLines: ((data ?? []).map(mapRawRow)) as ShippingLineRow[], limit };
  }

  async getById(id: string) {
    const localDbUrl = getDbUrl();
    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = await localSql`
          SELECT * FROM public.shipping_lines WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
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
      .from("shipping_lines")
      .select(SHIPPING_LINE_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return mapRawRow(data);
  }

  async create(input: ShippingLineWriteInput) {
    const now = new Date().toISOString();
    const payload = toPayload(input);
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = await localSql`
          INSERT INTO public.shipping_lines (
            name, contact_person, phone, email, website, country_id, remarks,
            original_language_code, is_active, created_at, updated_at
          ) VALUES (
            ${(payload.name as string) || ""},
            ${(payload.contact_person as string) || null},
            ${(payload.phone as string) || null},
            ${(payload.email as string) || null},
            ${(payload.website as string) || null},
            ${payload.country_id ? String(payload.country_id) : null}::uuid,
            ${(payload.remarks as string) || null},
            ${input.originalLanguage || "en"},
            true, ${now}, ${now}
          )
          RETURNING id
        `;
        if (rows && rows[0]?.id) {
          const createdId = rows[0].id as string;
          // Shipping Line Master identity code (SHL-000001 style) — same direct
          // next_entity_serial() pattern as customers.person_code/companies.company_code.
          try {
            const [row] = await localSql`SELECT next_entity_serial('global', 'GLOBAL', 'shipping_line', 'SHL') AS code`;
            if (row?.code) {
              await localSql`UPDATE public.shipping_lines SET shipping_line_code = ${row.code} WHERE id = ${createdId}::uuid AND shipping_line_code IS NULL`;
            }
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
    const { data, error } = await supabase.from("shipping_lines").insert({
      ...payload,
      original_language_code: input.originalLanguage || "en",
      is_active: true,
      created_at: now,
      updated_at: now
    }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async update(id: string, input: Partial<ShippingLineWriteInput>) {
    const now = new Date().toISOString();
    const payload = toPayload(input);
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = await localSql`
          UPDATE public.shipping_lines SET
            name = COALESCE(${payload.name !== undefined ? (payload.name as string) : null}, name),
            contact_person = COALESCE(${payload.contact_person !== undefined ? (payload.contact_person as string) : null}, contact_person),
            phone = COALESCE(${payload.phone !== undefined ? (payload.phone as string) : null}, phone),
            email = COALESCE(${payload.email !== undefined ? (payload.email as string) : null}, email),
            website = COALESCE(${payload.website !== undefined ? (payload.website as string) : null}, website),
            country_id = COALESCE(${payload.country_id !== undefined ? (payload.country_id ? String(payload.country_id) : null) : null}::uuid, country_id),
            remarks = COALESCE(${payload.remarks !== undefined ? (payload.remarks as string) : null}, remarks),
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
    const { error } = await supabase.from("shipping_lines").update(patch).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const now = new Date().toISOString();
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        await localSql`
          UPDATE public.shipping_lines SET deleted_at = ${now}, updated_at = ${now}, is_active = false
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
      .from("shipping_lines")
      .update({ deleted_at: now, updated_at: now, is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const shippingLinesRepository = new ShippingLinesRepository();
