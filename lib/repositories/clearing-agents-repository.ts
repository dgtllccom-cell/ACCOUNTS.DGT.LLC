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

// clearing_agents already existed live before Phase 2 (RBAC binding — see
// 20260818_shipping_clearing_rbac.sql: user_role_assignments.clearing_agent_id,
// shipping_line_records.clearing_agent_id, shipping_bl_records.clearing_agent_id,
// can_access_clearing_agent()/is_shipping_scoped_user()). The pre-existing
// `code`/`status`/`head_office_country_id`/`notes` columns are carried through
// unchanged here — never renamed or repurposed — so RBAC keeps working exactly
// as before. `clearing_agent_code` is the NEW, separate, serial-generated
// permanent identity added by Phase 2's master-data work.
export type ClearingAgentRow = {
  id: string;
  code: string | null;
  clearing_agent_code: string | null;
  name: string;
  person_id: string | null;
  company_id: string | null;
  head_office_country_id: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClearingAgentWriteInput = {
  name: string;
  personId?: string | null;
  companyId?: string | null;
  headOfficeCountryId?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  notes?: string | null;
  originalLanguage?: string;
};

const CLEARING_AGENT_SELECT = [
  "id",
  "code",
  "clearing_agent_code",
  "name",
  "person_id",
  "company_id",
  "head_office_country_id",
  "contact_person",
  "phone",
  "email",
  "status",
  "notes",
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

function mapRawRow(r: any): ClearingAgentRow {
  return {
    id: r.id,
    code: r.code ?? null,
    clearing_agent_code: r.clearing_agent_code ?? null,
    name: r.name,
    person_id: r.person_id ?? null,
    company_id: r.company_id ?? null,
    head_office_country_id: r.head_office_country_id ?? null,
    contact_person: r.contact_person ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    status: r.status ?? null,
    notes: r.notes ?? null,
    created_at: String(r.created_at || new Date().toISOString()),
    updated_at: String(r.updated_at || new Date().toISOString())
  };
}

/** An agent is an individual, a firm, or neither — never both at once (matches the DB CHECK). */
function assertOwnerExclusive(personId?: string | null, companyId?: string | null) {
  if (personId && companyId) {
    throw new Error("A clearing agent can be linked to a Person or a Company, not both.");
  }
}

function toPayload(input: Partial<ClearingAgentWriteInput>) {
  const payload: Record<string, unknown> = {};
  if ("name" in input) payload.name = cleanText(input.name) ?? "";
  if ("personId" in input) payload.person_id = input.personId || null;
  if ("companyId" in input) payload.company_id = input.companyId || null;
  if ("headOfficeCountryId" in input) payload.head_office_country_id = input.headOfficeCountryId || null;
  if ("contactPerson" in input) payload.contact_person = cleanText(input.contactPerson);
  if ("phone" in input) payload.phone = cleanText(input.phone);
  if ("email" in input) payload.email = cleanText(input.email);
  if ("status" in input) payload.status = cleanText(input.status) ?? "active";
  if ("notes" in input) payload.notes = cleanText(input.notes);
  return payload;
}

export class ClearingAgentsRepository {
  async search(input: { query?: string | null; limit?: number }) {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const q = cleanQuery(input.query ?? "");
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = q
          ? await localSql`
              SELECT * FROM public.clearing_agents
              WHERE deleted_at IS NULL
                AND (name ILIKE ${'%' + q + '%'} OR code ILIKE ${'%' + q + '%'} OR clearing_agent_code ILIKE ${'%' + q + '%'} OR contact_person ILIKE ${'%' + q + '%'})
              ORDER BY name ASC
              LIMIT ${limit}
            `
          : await localSql`
              SELECT * FROM public.clearing_agents
              WHERE deleted_at IS NULL
              ORDER BY name ASC
              LIMIT ${limit}
            `;
        if (rows && rows.length > 0) {
          return { clearingAgents: rows.map(mapRawRow), limit };
        }
      } catch (err) {
        console.error("Direct postgres search error:", err);
      } finally {
        await localSql.end({ timeout: 5 });
      }
    }

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("clearing_agents")
      .select(CLEARING_AGENT_SELECT)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (q) {
      const like = `%${q}%`;
      query = query.or([`name.ilike.${like}`, `code.ilike.${like}`, `clearing_agent_code.ilike.${like}`, `contact_person.ilike.${like}`].join(","));
    }

    const { data } = await query.limit(limit);
    return { clearingAgents: ((data ?? []).map(mapRawRow)) as ClearingAgentRow[], limit };
  }

  async getById(id: string) {
    const localDbUrl = getDbUrl();
    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = await localSql`
          SELECT * FROM public.clearing_agents WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
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
      .from("clearing_agents")
      .select(CLEARING_AGENT_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return mapRawRow(data);
  }

  async create(input: ClearingAgentWriteInput) {
    assertOwnerExclusive(input.personId, input.companyId);
    const now = new Date().toISOString();
    const payload = toPayload(input);
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = await localSql`
          INSERT INTO public.clearing_agents (
            name, person_id, company_id, head_office_country_id, contact_person, phone, email,
            status, notes, original_language_code, created_at, updated_at
          ) VALUES (
            ${(payload.name as string) || ""},
            ${payload.person_id ? String(payload.person_id) : null}::uuid,
            ${payload.company_id ? String(payload.company_id) : null}::uuid,
            ${payload.head_office_country_id ? String(payload.head_office_country_id) : null}::uuid,
            ${(payload.contact_person as string) || null},
            ${(payload.phone as string) || null},
            ${(payload.email as string) || null},
            ${(payload.status as string) || "active"},
            ${(payload.notes as string) || null},
            ${input.originalLanguage || "en"},
            ${now}, ${now}
          )
          RETURNING id
        `;
        if (rows && rows[0]?.id) {
          const createdId = rows[0].id as string;
          // Clearing Agent Master identity code (CLA-000001 style) — separate from
          // the pre-existing free-text `code` column (RBAC still reads that one).
          try {
            const [row] = await localSql`SELECT next_entity_serial('global', 'GLOBAL', 'clearing_agent', 'CLA') AS code`;
            if (row?.code) {
              await localSql`UPDATE public.clearing_agents SET clearing_agent_code = ${row.code} WHERE id = ${createdId}::uuid AND clearing_agent_code IS NULL`;
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
    const { data, error } = await supabase.from("clearing_agents").insert({
      ...payload,
      original_language_code: input.originalLanguage || "en",
      created_at: now,
      updated_at: now
    }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async update(id: string, input: Partial<ClearingAgentWriteInput>) {
    // person_id/company_id are nullable FKs where explicitly clearing one to NULL is a
    // real, valid operation (e.g. the picker's Individual/Firm/Neither toggle) — the
    // COALESCE-if-present pattern used for every other field here can't distinguish
    // "leave unchanged" from "set to null". Simplest correct fix: always read the
    // current row first and resolve both to concrete final values, so the UPDATE can
    // assign them directly with no COALESCE ambiguity, and the mutual-exclusivity rule
    // is validated against the real resolved pair either way.
    const current = await this.getById(id);
    const finalPersonId = input.personId !== undefined ? (input.personId || null) : current.person_id;
    const finalCompanyId = input.companyId !== undefined ? (input.companyId || null) : current.company_id;
    assertOwnerExclusive(finalPersonId, finalCompanyId);

    const now = new Date().toISOString();
    const payload = toPayload(input);
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        const rows = await localSql`
          UPDATE public.clearing_agents SET
            name = COALESCE(${payload.name !== undefined ? (payload.name as string) : null}, name),
            person_id = ${finalPersonId}::uuid,
            company_id = ${finalCompanyId}::uuid,
            head_office_country_id = COALESCE(${payload.head_office_country_id !== undefined ? (payload.head_office_country_id ? String(payload.head_office_country_id) : null) : null}::uuid, head_office_country_id),
            contact_person = COALESCE(${payload.contact_person !== undefined ? (payload.contact_person as string) : null}, contact_person),
            phone = COALESCE(${payload.phone !== undefined ? (payload.phone as string) : null}, phone),
            email = COALESCE(${payload.email !== undefined ? (payload.email as string) : null}, email),
            status = COALESCE(${payload.status !== undefined ? (payload.status as string) : null}, status),
            notes = COALESCE(${payload.notes !== undefined ? (payload.notes as string) : null}, notes),
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
    const patch: Record<string, unknown> = { ...payload, updated_at: now, person_id: finalPersonId, company_id: finalCompanyId };
    const { error } = await supabase.from("clearing_agents").update(patch).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const now = new Date().toISOString();
    const localDbUrl = getDbUrl();

    if (localDbUrl) {
      const localSql = postgres(localDbUrl, { max: 1, prepare: false });
      try {
        await localSql`
          UPDATE public.clearing_agents SET deleted_at = ${now}, updated_at = ${now}
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
      .from("clearing_agents")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const clearingAgentsRepository = new ClearingAgentsRepository();
