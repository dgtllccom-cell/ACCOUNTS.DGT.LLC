/**
 * AI Receptionist / Calling — ERP-side service.
 *
 * Reuses the existing modules for every call OUTPUT:
 *   - customer identity  → public.customers (matched by phone, never duplicated)
 *   - message / requirement → public.customer_inquiries (source='phone', ai_voice)
 *   - the central translation engine registers the inquiry's free-text fields
 * This file only owns the call spine (ai_calls / ai_call_events / ai_call_number_map).
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { AiCallNumberMap, AiCallRow, CallIntent, CallStatus } from "./types";

/** withLocalPg but non-null — throws a clean error when the pool is unavailable. */
async function pg<T>(fn: Parameters<typeof withLocalPg<T>>[0]): Promise<T> {
  const out = await withLocalPg(fn);
  if (out === null) throw new ApiClientError("Database is temporarily unavailable.", { status: 503, code: "AI_CALL_ERROR" });
  return out;
}

function schemaMissing(error: unknown): boolean {
  const e = error as any;
  const code = e?.code || e?.cause?.code;
  return code === "42P01" || /relation "?public\.ai_call/i.test(String(e?.message || e || ""));
}

export function mapCallError(error: unknown): { code: string; message: string; status: number; setupPending?: boolean } {
  if (error instanceof ApiClientError) {
    return { code: (error as any).code || "AI_CALL_ERROR", message: error.message, status: (error as any).status || 400 };
  }
  if (schemaMissing(error)) {
    return { code: "SETUP_PENDING", message: "AI Receptionist is not set up on this database yet (run migration 20261026).", status: 200, setupPending: true };
  }
  console.error("[ai-receptionist]", error instanceof Error ? error.stack || error.message : error);
  return { code: "AI_CALL_ERROR", message: "AI Receptionist is temporarily unavailable.", status: 503 };
}

// ── number map ───────────────────────────────────────────────────────────────

export async function resolveNumberMap(dialledE164: string): Promise<AiCallNumberMap | null> {
  const clean = (dialledE164 || "").trim();
  if (!clean) return null;
  const wrapped = await pg(async (sql) => {
    const rows = (await sql`
      select * from public.ai_call_number_map
      where lower(btrim(phone_e164)) = lower(${clean}) and is_active = true
      limit 1
    `) as unknown as AiCallNumberMap[];
    return { row: rows[0] ?? null };
  });
  return wrapped.row;
}

export async function listNumberMap(session: ErpSession): Promise<AiCallNumberMap[]> {
  return pg(async (sql) => {
    if (session.isSuperAdmin) {
      return (await sql`select * from public.ai_call_number_map order by created_at desc`) as unknown as AiCallNumberMap[];
    }
    const countryIds = session.countryIds ?? [];
    return (await sql`
      select * from public.ai_call_number_map
      where country_id is null or country_id = any(${countryIds}::uuid[])
      order by created_at desc
    `) as unknown as AiCallNumberMap[];
  });
}

export async function upsertNumberMap(
  session: ErpSession,
  input: Partial<AiCallNumberMap> & { phone_e164: string },
): Promise<{ id: string }> {
  if (!session.isSuperAdmin) {
    throw new ApiClientError("Only a Super Admin can configure AI Receptionist numbers.", { status: 403, code: "FORBIDDEN" });
  }
  const phone = (input.phone_e164 || "").trim();
  if (!/^\+?[0-9]{6,18}$/.test(phone)) throw new ApiClientError("A valid E.164 phone number is required.", { status: 400, code: "VALIDATION" });
  return pg(async (sql) => {
    const rows = (await sql`
      insert into public.ai_call_number_map
        (id, phone_e164, label, country_id, country_branch_id, city_branch_id, purpose, default_language,
         greeting_override, announce_recording, assigned_to, is_active, created_by)
      values (
        coalesce(${input.id ?? null}::uuid, gen_random_uuid()),
        ${phone}, ${input.label ?? null}, ${input.country_id ?? null}, ${input.country_branch_id ?? null}, ${input.city_branch_id ?? null},
        ${input.purpose ?? "reception"}, ${input.default_language ?? "en"},
        ${input.greeting_override ?? null}, ${input.announce_recording ?? true}, ${input.assigned_to ?? null},
        ${input.is_active ?? true}, ${session.userId}::uuid
      )
      on conflict (id) do update set
        phone_e164 = excluded.phone_e164, label = excluded.label,
        country_id = excluded.country_id, country_branch_id = excluded.country_branch_id, city_branch_id = excluded.city_branch_id,
        purpose = excluded.purpose, default_language = excluded.default_language,
        greeting_override = excluded.greeting_override, announce_recording = excluded.announce_recording,
        assigned_to = excluded.assigned_to, is_active = excluded.is_active
      returning id
    `) as unknown as Array<{ id: string }>;
    return rows[0];
  });
}

// ── call lifecycle (called by the provider webhook — no ErpSession) ───────────

export async function matchCustomerByPhone(phoneE164: string): Promise<{ id: string; country_id: string | null; name: string } | null> {
  const digits = (phoneE164 || "").replace(/[^\d]/g, "").slice(-9); // last 9 digits — resilient to country-code formatting
  if (digits.length < 6) return null;
  const wrapped = await pg(async (sql) => {
    const rows = (await sql`
      select id, country_id, coalesce(customer_name, company_name, 'Customer') as name
      from public.customers
      where deleted_at is null
        and (regexp_replace(coalesce(mobile,''),'[^0-9]','','g') like ${"%" + digits}
          or regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g') like ${"%" + digits})
      limit 1
    `) as unknown as Array<{ id: string; country_id: string | null; name: string }>;
    return { row: rows[0] ?? null };
  });
  return wrapped.row;
}

export async function openInboundCall(params: {
  provider: string;
  providerCallId: string;
  fromE164: string;
  toE164: string;
}): Promise<AiCallRow> {
  const map = await resolveNumberMap(params.toE164);
  const customer = await matchCustomerByPhone(params.fromE164);
  return pg(async (sql) => {
    const rows = (await sql`
      insert into public.ai_calls
        (direction, provider, provider_call_id, from_e164, to_e164, number_map_id,
         customer_id, country_id, country_branch_id, city_branch_id, language_code, status)
      values (
        'inbound', ${params.provider}, ${params.providerCallId}, ${params.fromE164}, ${params.toE164}, ${map?.id ?? null},
        ${customer?.id ?? null}, ${map?.country_id ?? customer?.country_id ?? null},
        ${map?.country_branch_id ?? null}, ${map?.city_branch_id ?? null},
        ${(map?.default_language ?? "en") as SupportedLanguage}, 'in_progress'
      )
      on conflict (provider, provider_call_id) where provider_call_id is not null
        do update set status = 'in_progress'
      returning *
    `) as unknown as AiCallRow[];
    return rows[0];
  });
}

export async function recordEvent(callId: string, kind: string, detail: Record<string, unknown> = {}): Promise<void> {
  await pg(async (sql) => {
    await sql`insert into public.ai_call_events (call_id, kind, detail) values (${callId}::uuid, ${kind}, ${sql.json(detail as any)})`;
  });
}

/**
 * Close a call and, when the caller left content, file it into the EXISTING
 * customer_inquiries module (source='phone', ai_voice) assigned to the number's
 * designated ERP user. Returns the created inquiry id (if any).
 */
export async function finalizeCall(params: {
  callId: string;
  status: CallStatus;
  intent?: CallIntent | null;
  outcome?: string | null;
  transcript?: string | null;
  durationSeconds?: number | null;
  recordingUrl?: string | null;
  cost?: { amount: number; currency: string } | null;
}): Promise<{ inquiryId: string | null }> {
  return pg(async (sql) => {
    const callRows = (await sql`select * from public.ai_calls where id = ${params.callId}::uuid`) as unknown as AiCallRow[];
    const call = callRows[0];
    if (!call) throw new ApiClientError("Call not found.", { status: 404, code: "NOT_FOUND" });

    let inquiryId: string | null = call.inquiry_id;
    const transcript = (params.transcript || call.transcript || "").trim();
    const leftContent = Boolean(transcript) && params.intent !== "hours" && params.intent !== "address";

    if (leftContent && !inquiryId) {
      let assignedTo: string | null = null;
      if (call.number_map_id) {
        const m = (await sql`select assigned_to from public.ai_call_number_map where id = ${call.number_map_id}::uuid`) as unknown as Array<{ assigned_to: string | null }>;
        assignedTo = m[0]?.assigned_to ?? null;
      }
      let name = "Phone caller";
      if (call.customer_id) {
        const c = (await sql`select coalesce(customer_name, company_name, 'Customer') as n from public.customers where id = ${call.customer_id}::uuid`) as unknown as Array<{ n: string }>;
        name = c[0]?.n ?? name;
      } else if (call.from_e164) {
        name = `Caller ${call.from_e164}`;
      }

      const inq = (await sql`
        insert into public.customer_inquiries (
          country_id, country_branch_id, city_branch_id,
          customer_id, is_existing_customer,
          customer_name, mobile, source,
          inquiry_summary, meeting_notes, requirements,
          assigned_to, status,
          ai_raw_input, entry_mode, original_language_code, created_by
        ) values (
          ${call.country_id}, ${call.country_branch_id}, ${call.city_branch_id},
          ${call.customer_id}, ${Boolean(call.customer_id)},
          ${name}, ${call.from_e164}, 'phone',
          ${(params.outcome || "Inbound AI call").slice(0, 240)},
          ${transcript.slice(0, 4000)},
          ${transcript.slice(0, 4000)},
          ${assignedTo}, 'ai_draft',
          ${transcript.slice(0, 8000)}, 'ai_voice', ${call.language_code}, ${assignedTo}
        )
        returning id
      `) as unknown as Array<{ id: string }>;
      inquiryId = inq[0]?.id ?? null;
    }

    await sql`
      update public.ai_calls set
        status = ${params.status},
        intent = ${params.intent ?? call.intent ?? null},
        outcome = ${params.outcome ?? call.outcome ?? null},
        transcript = ${transcript || null},
        duration_seconds = ${params.durationSeconds ?? call.duration_seconds ?? null},
        recording_url = ${params.recordingUrl ?? call.recording_url ?? null},
        cost_amount = ${params.cost?.amount ?? call.cost_amount ?? null},
        cost_currency = ${params.cost?.currency ?? call.cost_currency ?? null},
        inquiry_id = ${inquiryId},
        ended_at = now()
      where id = ${params.callId}::uuid
    `;

    if (inquiryId && !call.inquiry_id) {
      // register translated views through the central engine (non-fatal)
      try {
        await translateMasterRecord(
          "customer_inquiries",
          inquiryId,
          { meeting_notes: transcript.slice(0, 4000), requirements: transcript.slice(0, 4000), inquiry_summary: (params.outcome || "Inbound AI call").slice(0, 240) },
          call.language_code as SupportedLanguage,
          null,
        );
      } catch {
        /* non-fatal */
      }
    }
    return { inquiryId };
  });
}

// ── read side (ErpSession-scoped) ────────────────────────────────────────────

export async function listCalls(
  session: ErpSession,
  opts: { direction?: string; status?: string; limit?: number } = {},
): Promise<AiCallRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const countryIds = session.countryIds ?? [];
  return pg(async (sql) => {
    const scoped = session.isSuperAdmin
      ? sql`true`
      : sql`(c.country_id is null or c.country_id = any(${countryIds}::uuid[]))`;
    const dir = opts.direction ? sql`and c.direction = ${opts.direction}` : sql``;
    const st = opts.status ? sql`and c.status = ${opts.status}` : sql``;
    return (await sql`
      select c.* from public.ai_calls c
      where ${scoped} ${dir} ${st}
      order by c.started_at desc
      limit ${limit}
    `) as unknown as AiCallRow[];
  });
}

export async function getCall(session: ErpSession, id: string): Promise<{ call: AiCallRow; events: any[] }> {
  const countryIds = session.countryIds ?? [];
  return pg(async (sql) => {
    const scoped = session.isSuperAdmin
      ? sql`true`
      : sql`(c.country_id is null or c.country_id = any(${countryIds}::uuid[]))`;
    const rows = (await sql`select c.* from public.ai_calls c where c.id = ${id}::uuid and ${scoped}`) as unknown as AiCallRow[];
    if (!rows[0]) throw new ApiClientError("Call not found.", { status: 404, code: "NOT_FOUND" });
    const events = (await sql`select * from public.ai_call_events where call_id = ${id}::uuid order by at asc`) as unknown as any[];
    return { call: rows[0], events };
  });
}

export async function callSummary(session: ErpSession): Promise<Record<string, number>> {
  const countryIds = session.countryIds ?? [];
  return pg(async (sql) => {
    const scoped = session.isSuperAdmin
      ? sql`true`
      : sql`(c.country_id is null or c.country_id = any(${countryIds}::uuid[]))`;
    const rows = (await sql`
      select
        count(*)::int as total,
        count(*) filter (where c.status = 'completed')::int as completed,
        count(*) filter (where c.status = 'handed_off')::int as handed_off,
        count(*) filter (where c.inquiry_id is not null)::int as with_inquiry,
        count(*) filter (where c.started_at >= now() - interval '7 days')::int as last_7d
      from public.ai_calls c where ${scoped}
    `) as unknown as Array<Record<string, number>>;
    return rows[0] ?? {};
  });
}
