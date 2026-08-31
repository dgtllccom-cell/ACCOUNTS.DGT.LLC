import { randomUUID } from "node:crypto";
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { localizeRecordFields } from "@/lib/i18n/localize-records";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { saveDocumentBlob, resolveDocumentFileUrl, deleteDocumentBlob } from "@/lib/documents/document-storage";
import { createTask } from "@/lib/user-tasks/service";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { extractInquiryDraft } from "./ai-extract";
import {
  canEditInquiry,
  canManageInquiries,
  canViewInquiry,
  inquiryScope,
  allowedNextStatuses,
} from "./access";
import {
  INQUIRY_SOURCES,
  INQUIRY_STATUSES,
  INQUIRY_TRANSLATABLE_FIELDS,
  ORIGINAL_LANGS,
  type InquiryDraft,
  type InquiryRow,
  type InquiryStatus,
} from "./types";

function isSchemaMissing(error: unknown): boolean {
  const e = error as any;
  const code = e?.code || e?.cause?.code;
  const msg = String(e?.message || e || "");
  return code === "42P01" || /relation "?public\.customer_inquir/i.test(msg);
}

export function mapInquiryError(error: unknown): { code: string; message: string; status: number; setupPending?: boolean } {
  if (error instanceof ApiClientError) {
    return { code: (error as any).code || "INQUIRY_ERROR", message: error.message, status: (error as any).status || 400 };
  }
  if (isSchemaMissing(error)) {
    return { code: "SETUP_PENDING", message: "Customer Inquiries is not set up on this database yet.", status: 200, setupPending: true };
  }
  console.error("[customer-inquiry]", error instanceof Error ? error.stack || error.message : error);
  const detail =
    (process.env.APP_ENV || "").toLowerCase() === "development" && error instanceof Error ? ` [dev: ${error.message}]` : "";
  return { code: "INQUIRY_ERROR", message: "Customer Inquiries is temporarily unavailable." + detail, status: 503 };
}

/** $P → $1..$n renumberer (same helper the User Tasks service uses). */
function build(sqlText: string, params: any[], startAt = 1, fixed: any[] = []): { text: string; values: any[] } {
  let i = startAt - 1;
  const text = sqlText.replace(/\$P/g, () => `$${++i}`);
  const used = i - (startAt - 1);
  if (used !== params.length) throw new Error(`param count mismatch: ${used} vs ${params.length}`);
  return { text, values: [...fixed, ...params] };
}

/** Server-side visibility predicate for `customer_inquiries i` (uses $P placeholders). */
function visibilityClause(session: ErpSession): { text: string; params: any[] } {
  if (session.isSuperAdmin) return { text: "true", params: [] };
  const s = inquiryScope(session);
  const clauses = ["i.created_by = $P", "i.assigned_to = $P"];
  const params: any[] = [session.userId, session.userId];
  if (s.isManager) {
    if (s.level === "global") clauses.push("true");
    else if (s.level === "country") {
      const ids = s.countryIds.length ? s.countryIds : ([s.countryId].filter(Boolean) as string[]);
      if (ids.length) { clauses.push("i.country_id = any($P::uuid[])"); params.push(ids); }
    } else {
      const cbs = s.countryBranchIds.length ? s.countryBranchIds : ([s.countryBranchId].filter(Boolean) as string[]);
      const cts = s.cityBranchIds.length ? s.cityBranchIds : ([s.cityBranchId].filter(Boolean) as string[]);
      if (cbs.length) { clauses.push("i.country_branch_id = any($P::uuid[])"); params.push(cbs); }
      if (cts.length) { clauses.push("i.city_branch_id = any($P::uuid[])"); params.push(cts); }
    }
  }
  return { text: `(${clauses.join(" OR ")})`, params };
}

const LIST_SELECT = `
  i.*,
  ap.full_name  as assignee_name,
  cp.full_name  as creator_name,
  co.name       as country_name,
  cb.name       as country_branch_name,
  cib.name      as city_branch_name,
  cu.customer_name as linked_customer_name,
  (i.follow_up_date is not null and i.follow_up_date < (now() at time zone 'UTC')::date
     and i.status not in ('converted','closed','lost')) as follow_up_overdue,
  coalesce((select count(*) from public.customer_inquiry_attachments a
            where a.inquiry_id = i.id and a.deleted_at is null),0)::int as attachment_count
`;

const LIST_JOINS = `
  from public.customer_inquiries i
  left join public.profiles ap on ap.id = i.assigned_to
  left join public.profiles cp on cp.id = i.created_by
  left join public.countries co on co.id = i.country_id
  left join public.country_branches cb on cb.id = i.country_branch_id
  left join public.city_branches cib on cib.id = i.city_branch_id
  left join public.customers cu on cu.id = i.customer_id
`;

// ─── AI draft ────────────────────────────────────────────────────────────────
export async function aiDraft(session: ErpSession, rawInput: string): Promise<InquiryDraft> {
  const text = (rawInput || "").trim();
  if (text.length < 4) throw new ApiClientError("Please provide the meeting notes or speak longer.", { status: 400, code: "VALIDATION" });
  const base = extractInquiryDraft(text);

  // possible existing-customer matches (scoped) so the user can LINK instead of duplicating
  const matches = await withLocalPg(async (sql) => {
    const terms = [base.customer_name, base.company_name, base.mobile, base.email].filter(Boolean).map(String);
    if (!terms.length) return [] as any[];
    const like = terms.map((t) => `%${t.replace(/[%_]/g, "")}%`);
    const rows = (await sql`
      select id, customer_name, company_name, mobile, email
      from public.customers
      where deleted_at is null
        and ( customer_name ilike any(${like})
           or company_name ilike any(${like})
           or mobile = any(${terms})
           or email = any(${terms}) )
      limit 8
    `) as unknown as any[];
    return rows;
  });

  const customerMatches = (matches ?? []).map((r: any) => {
    let score = 0;
    if (base.customer_name && r.customer_name && r.customer_name.toLowerCase().includes(base.customer_name.toLowerCase())) score += 0.4;
    if (base.company_name && r.company_name && r.company_name.toLowerCase().includes(base.company_name.toLowerCase())) score += 0.4;
    if (base.mobile && r.mobile === base.mobile) score += 0.5;
    if (base.email && r.email && r.email.toLowerCase() === base.email.toLowerCase()) score += 0.5;
    return { id: r.id, label: [r.customer_name, r.company_name].filter(Boolean).join(" · "), score: Math.min(1, score) };
  }).sort((a, b) => b.score - a.score);

  return { ...base, customerMatches };
}

// ─── create ──────────────────────────────────────────────────────────────────
export async function createInquiry(
  session: ErpSession,
  input: {
    customerId?: string | null;
    customerName: string;
    companyName?: string | null;
    contactPerson?: string | null;
    mobile?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
    businessType?: string | null;
    inquirySummary?: string | null;
    meetingNotes?: string | null;
    requirements?: string | null;
    source?: string | null;
    inquiryDate?: string | null;
    followUpDate?: string | null;
    assignedTo?: string | null;
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
    entryMode?: "manual" | "ai_text" | "ai_voice";
    aiRawInput?: string | null;
    aiConfidence?: number | null;
    originalLanguageCode?: string | null;
    status?: InquiryStatus | null;
  }
): Promise<{ id: string; inquiryNo: string }> {
  const name = (input.customerName || "").trim();
  if (!name) throw new ApiClientError("Customer name is required.", { status: 400, code: "VALIDATION" });
  const source = INQUIRY_SOURCES.includes((input.source as any)) ? input.source! : "meeting";
  const status: InquiryStatus = INQUIRY_STATUSES.includes((input.status as any)) ? (input.status as InquiryStatus) : "new";
  const lang = ORIGINAL_LANGS.includes((input.originalLanguageCode as any)) ? input.originalLanguageCode! : "en";

  // scope: an explicit request must stay within the creator's own scope (super admin may target anything)
  const s = inquiryScope(session);
  let countryId = input.countryId ?? null;
  let countryBranchId = input.countryBranchId ?? null;
  let cityBranchId = input.cityBranchId ?? null;
  if (!session.isSuperAdmin) {
    countryId = countryId ?? s.countryId;
    countryBranchId = countryBranchId ?? s.countryBranchId;
    cityBranchId = cityBranchId ?? s.cityBranchId;
    if (s.level === "country" && countryId && s.countryIds.length && !s.countryIds.includes(countryId)) {
      throw new ApiClientError("Inquiry country is outside your scope.", { status: 403, code: "OUT_OF_SCOPE" });
    }
  }

  const row = await withLocalPg(async (sql) => {
    let existing = false;
    if (input.customerId) {
      const c = (await sql`select id, country_id from public.customers where id = ${input.customerId}::uuid and deleted_at is null`) as unknown as any[];
      if (!c.length) throw new ApiClientError("Linked customer not found.", { status: 404, code: "NOT_FOUND" });
      existing = true;
      countryId = countryId ?? c[0].country_id ?? null;
    }
    const rows = await sql`
      insert into public.customer_inquiries (
        country_id, country_branch_id, city_branch_id,
        customer_id, is_existing_customer,
        customer_name, company_name, contact_person, mobile, whatsapp, email, address,
        business_type, inquiry_summary, meeting_notes, requirements, source,
        inquiry_date, follow_up_date, assigned_to, status,
        ai_raw_input, ai_confidence, entry_mode, original_language_code,
        created_by
      ) values (
        ${countryId}, ${countryBranchId}, ${cityBranchId},
        ${input.customerId ?? null}, ${existing},
        ${name}, ${input.companyName ?? null}, ${input.contactPerson ?? null}, ${input.mobile ?? null}, ${input.whatsapp ?? null}, ${input.email ?? null}, ${input.address ?? null},
        ${input.businessType ?? null}, ${input.inquirySummary ?? null}, ${input.meetingNotes ?? null}, ${input.requirements ?? null}, ${source},
        ${input.inquiryDate || new Date().toISOString().slice(0, 10)}, ${input.followUpDate || null}, ${input.assignedTo ?? session.userId}::uuid, ${status},
        ${input.aiRawInput ?? null}, ${input.aiConfidence ?? null}, ${input.entryMode ?? "manual"}, ${lang},
        ${session.userId}::uuid
      )
      returning id, inquiry_no
    `;
    return rows[0] as any;
  });
  if (!row) throw new ApiClientError("Could not create the inquiry.", { status: 503, code: "INQUIRY_ERROR" });

  // translated views (non-fatal): register the record's free-text fields in record_translations
  await translateMasterRecord(
    "customer_inquiries",
    row.id,
    {
      customer_name: name,
      company_name: input.companyName ?? undefined,
      contact_person: input.contactPerson ?? undefined,
      business_type: input.businessType ?? undefined,
      inquiry_summary: input.inquirySummary ?? undefined,
      meeting_notes: input.meetingNotes ?? undefined,
      requirements: input.requirements ?? undefined,
    },
    lang as SupportedLanguage,
    session.userId,
  );

  return { id: row.id, inquiryNo: row.inquiry_no };
}

// ─── list / register ─────────────────────────────────────────────────────────
export async function listInquiries(
  session: ErpSession,
  opts: {
    scope?: "all" | "mine" | "assigned" | "follow_up";
    status?: string | null;
    source?: string | null;
    assigneeId?: string | null;
    countryId?: string | null;
    q?: string | null;
    lang: SupportedLanguage;
    original?: boolean;
    limit?: number;
  }
): Promise<any[]> {
  const rows = await withLocalPg(async (sql) => {
    const vis = visibilityClause(session);
    const where: string[] = ["i.deleted_at is null", vis.text];
    const params: any[] = [...vis.params];

    if (opts.scope === "mine") { where.push("i.created_by = $P"); params.push(session.userId); }
    else if (opts.scope === "assigned") { where.push("i.assigned_to = $P"); params.push(session.userId); }
    else if (opts.scope === "follow_up") {
      where.push("i.follow_up_date is not null and i.status not in ('converted','closed','lost')");
    }
    if (opts.status && opts.status !== "all") { where.push("i.status = $P"); params.push(opts.status); }
    if (opts.source && opts.source !== "all") { where.push("i.source = $P"); params.push(opts.source); }
    if (opts.assigneeId) { where.push("i.assigned_to = $P"); params.push(opts.assigneeId); }
    if (opts.countryId) { where.push("i.country_id = $P"); params.push(opts.countryId); }
    if (opts.q) {
      where.push("(i.customer_name ilike $P or i.company_name ilike $P or i.inquiry_no ilike $P or i.mobile ilike $P or i.email ilike $P or i.requirements ilike $P)");
      const like = `%${opts.q}%`;
      params.push(like, like, like, like, like, like);
    }
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
    const q = build(
      `select ${LIST_SELECT} ${LIST_JOINS}
       where ${where.join(" AND ")}
       order by (i.follow_up_date is null), i.follow_up_date asc, i.created_at desc
       limit ${limit}`,
      params,
    );
    return (await sql.unsafe(q.text, q.values)) as unknown as any[];
  });
  const list = rows ?? [];
  if (opts.original || opts.lang === "en") return list;
  return localizeRecordFields(list as any[], "customer_inquiries", [...INQUIRY_TRANSLATABLE_FIELDS] as any, opts.lang);
}

// ─── detail ──────────────────────────────────────────────────────────────────
export async function getInquiry(session: ErpSession, id: string, opts: { lang: SupportedLanguage; original?: boolean }) {
  return withLocalPg(async (sql) => {
    const rows = (await sql.unsafe(
      `select ${LIST_SELECT} ${LIST_JOINS} where i.id = $1 and i.deleted_at is null`,
      [id],
    )) as unknown as any[];
    const row = rows[0] as InquiryRow | undefined;
    if (!row) throw new ApiClientError("Inquiry not found.", { status: 404, code: "NOT_FOUND" });
    if (!canViewInquiry(session, row)) throw new ApiClientError("You cannot view this inquiry.", { status: 403, code: "FORBIDDEN" });

    const events = (await sql`
      select e.*, coalesce(e.actor_name, p.full_name) as actor_display
      from public.customer_inquiry_events e
      left join public.profiles p on p.id = e.actor_id
      where e.inquiry_id = ${id}::uuid order by e.created_at asc
    `) as unknown as any[];

    const attachments = (await sql`
      select a.*, p.full_name as uploader_name
      from public.customer_inquiry_attachments a
      left join public.profiles p on p.id = a.uploaded_by
      where a.inquiry_id = ${id}::uuid and a.deleted_at is null order by a.created_at asc
    `) as unknown as any[];

    let out: any = { ...row, events, attachments };
    if (!opts.original && opts.lang !== "en") {
      [out] = await localizeRecordFields([out], "customer_inquiries", [...INQUIRY_TRANSLATABLE_FIELDS] as any, opts.lang);
      out.events = events;
      out.attachments = attachments;
    }
    out.allowedNextStatuses = allowedNextStatuses(session, row);
    out.isManager = canManageInquiries(session);
    out.canEdit = canEditInquiry(session, row);
    return out;
  });
}

async function loadRow(sql: any, id: string): Promise<InquiryRow> {
  const rows = (await sql`select * from public.customer_inquiries where id = ${id}::uuid and deleted_at is null`) as unknown as any[];
  if (!rows.length) throw new ApiClientError("Inquiry not found.", { status: 404, code: "NOT_FOUND" });
  return rows[0] as InquiryRow;
}

async function event(sql: any, inquiryId: string, type: string, payload: { note?: string; from?: string; to?: string; meta?: any }, session: ErpSession) {
  await sql`
    insert into public.customer_inquiry_events (inquiry_id, actor_id, actor_name, event_type, from_status, to_status, note, meta)
    values (${inquiryId}::uuid, ${session.userId}::uuid, ${session.fullName ?? session.email ?? null},
            ${type}, ${payload.from ?? null}, ${payload.to ?? null}, ${payload.note ?? null},
            ${sql.json((payload.meta ?? {}) as any)})
  `;
}

// ─── update fields (partial) ─────────────────────────────────────────────────
export async function updateInquiry(session: ErpSession, id: string, patch: Record<string, any>): Promise<void> {
  await withLocalPg(async (sql) => {
    const row = await loadRow(sql, id);
    if (!canEditInquiry(session, row)) throw new ApiClientError("You cannot edit this inquiry.", { status: 403, code: "FORBIDDEN" });

    const COLS: Record<string, string> = {
      customerName: "customer_name", companyName: "company_name", contactPerson: "contact_person",
      mobile: "mobile", whatsapp: "whatsapp", email: "email", address: "address",
      businessType: "business_type", inquirySummary: "inquiry_summary", meetingNotes: "meeting_notes",
      requirements: "requirements", source: "source", followUpDate: "follow_up_date", assignedTo: "assigned_to",
      inquiryDate: "inquiry_date",
    };
    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, col] of Object.entries(COLS)) {
      if (k in patch) { sets.push(`${col} = $P`); vals.push(patch[k] === "" ? null : patch[k]); }
    }
    if (!sets.length) return;
    const q = build(`update public.customer_inquiries set ${sets.join(", ")} where id = $P`, [...vals, id], 1);
    await sql.unsafe(q.text, q.values);
    await event(sql, id, "note", { note: "Details updated", meta: { fields: Object.keys(patch) } }, session);

    // refresh translated views for changed free-text fields
    const tFields: Record<string, string | undefined> = {};
    if ("customerName" in patch) tFields.customer_name = patch.customerName;
    if ("companyName" in patch) tFields.company_name = patch.companyName;
    if ("contactPerson" in patch) tFields.contact_person = patch.contactPerson;
    if ("businessType" in patch) tFields.business_type = patch.businessType;
    if ("inquirySummary" in patch) tFields.inquiry_summary = patch.inquirySummary;
    if ("meetingNotes" in patch) tFields.meeting_notes = patch.meetingNotes;
    if ("requirements" in patch) tFields.requirements = patch.requirements;
    if (Object.keys(tFields).length) {
      await translateMasterRecord("customer_inquiries", id, tFields, (row.original_language_code || "en") as SupportedLanguage, session.userId);
    }
  });
}

// ─── status transition ───────────────────────────────────────────────────────
export async function setStatus(session: ErpSession, id: string, to: string, note?: string | null, lostReason?: string | null): Promise<void> {
  await withLocalPg(async (sql) => {
    const row = await loadRow(sql, id);
    const allowed = allowedNextStatuses(session, row);
    if (!allowed.includes(to as InquiryStatus)) {
      throw new ApiClientError(`Cannot move this inquiry to "${to}" from "${row.status}".`, { status: 409, code: "BAD_TRANSITION" });
    }
    const stamps: string[] = ["status = $P"];
    const vals: any[] = [to];
    if (to === "confirmed") stamps.push("confirmed_at = now()");
    if (to === "converted") stamps.push("converted_at = now()");
    if (to === "closed") stamps.push("closed_at = now()");
    if (note != null) { stamps.push("status_note = $P"); vals.push(note); }
    if (to === "lost" && lostReason) { stamps.push("lost_reason = $P"); vals.push(lostReason); }
    const q = build(`update public.customer_inquiries set ${stamps.join(", ")} where id = $P`, [...vals, id], 1);
    await sql.unsafe(q.text, q.values);
    await event(sql, id, "status", { from: row.status, to, note: note ?? lostReason ?? undefined }, session);
  });
}

// ─── link to an existing customer ───────────────────────────────────────────
export async function linkCustomer(session: ErpSession, id: string, customerId: string): Promise<void> {
  await withLocalPg(async (sql) => {
    const row = await loadRow(sql, id);
    if (!canEditInquiry(session, row)) throw new ApiClientError("You cannot edit this inquiry.", { status: 403, code: "FORBIDDEN" });
    const c = (await sql`select id, customer_name, company_name from public.customers where id = ${customerId}::uuid and deleted_at is null`) as unknown as any[];
    if (!c.length) throw new ApiClientError("Customer not found.", { status: 404, code: "NOT_FOUND" });
    await sql`update public.customer_inquiries set customer_id = ${customerId}::uuid, is_existing_customer = true where id = ${id}::uuid`;
    await event(sql, id, "linked_customer", { note: [c[0].customer_name, c[0].company_name].filter(Boolean).join(" · "), meta: { customer_id: customerId } }, session);
  });
}

// ─── convert to a customer master (create if new, else just mark converted) ──
export async function convertToCustomer(session: ErpSession, id: string): Promise<{ customerId: string; created: boolean }> {
  return (await withLocalPg(async (sql) => {
    const row = await loadRow(sql, id);
    if (!canEditInquiry(session, row)) throw new ApiClientError("You cannot edit this inquiry.", { status: 403, code: "FORBIDDEN" });

    let customerId = row.customer_id;
    let created = false;
    if (!customerId) {
      const ins = (await sql`
        insert into public.customers (country_id, customer_name, company_name, contact_person, mobile, whatsapp, email, address, notes, original_language_code, is_active, created_by)
        values (${row.country_id}, ${row.customer_name}, ${row.company_name}, ${row.contact_person}, ${row.mobile}, ${row.whatsapp}, ${row.email}, ${row.address},
                ${[row.business_type, row.requirements].filter(Boolean).join(" — ") || null}, ${row.original_language_code}, true, ${session.userId}::uuid)
        returning id
      `) as unknown as any[];
      customerId = ins[0].id;
      created = true;
    }
    await sql`
      update public.customer_inquiries
      set customer_id = ${customerId}::uuid, is_existing_customer = true,
          converted_customer_id = ${customerId}::uuid, converted_at = now(),
          status = case when status in ('converted','closed','lost') then status else 'converted' end
      where id = ${id}::uuid
    `;
    await event(sql, id, "converted", { to: "converted", meta: { customer_id: customerId, created } }, session);
    return { customerId: customerId as string, created };
  })) as { customerId: string; created: boolean };
}

// ─── customer approval ──────────────────────────────────────────────────────
export async function setCustomerApproval(session: ErpSession, id: string, status: "approved" | "declined" | "not_required", note?: string | null): Promise<void> {
  await withLocalPg(async (sql) => {
    const row = await loadRow(sql, id);
    if (!canEditInquiry(session, row)) throw new ApiClientError("You cannot edit this inquiry.", { status: 403, code: "FORBIDDEN" });
    await sql`
      update public.customer_inquiries
      set customer_approval_status = ${status},
          customer_approved_at = ${status === "approved" ? sql`now()` : null},
          customer_approved_note = ${note ?? null},
          status = case when ${status} = 'approved' and status in ('in_progress','follow_up') then 'customer_approved' else status end
      where id = ${id}::uuid
    `;
    await event(sql, id, "customer_approval", { note: `${status}${note ? " — " + note : ""}` }, session);
  });
}

// ─── create a follow-up in the existing User Tasks module ────────────────────
export async function createFollowUpTask(
  session: ErpSession,
  id: string,
  input: { assignedTo: string; dueAt?: string | null; instructions?: string | null; priority?: string | null },
): Promise<{ taskId: string; taskNo: string }> {
  const row = await withLocalPg(async (sql) => loadRow(sql, id));
  if (!row) throw new ApiClientError("Inquiry not found.", { status: 404, code: "NOT_FOUND" });
  if (!canEditInquiry(session, row)) throw new ApiClientError("You cannot edit this inquiry.", { status: 403, code: "FORBIDDEN" });

  const task = await createTask(session, {
    title: `Follow up: ${row.customer_name}${row.company_name ? " (" + row.company_name + ")" : ""}`,
    description: [row.inquiry_summary, row.requirements].filter(Boolean).join("\n"),
    instructions: input.instructions ?? null,
    assignedTo: input.assignedTo,
    countryId: row.country_id,
    countryBranchId: row.country_branch_id,
    cityBranchId: row.city_branch_id,
    relatedModule: "customer_inquiry",
    relatedRecordTable: "customer_inquiries",
    relatedRecordId: row.id,
    relatedRecordLabel: row.inquiry_no,
    relatedRoute: `/dashboard/customer-inquiries?id=${row.id}`,
    priority: input.priority ?? "normal",
    dueAt: input.dueAt ?? (row.follow_up_date ? `${row.follow_up_date}T09:00:00Z` : null),
  });

  await withLocalPg(async (sql) => {
    await sql`update public.customer_inquiries set linked_task_id = ${task.id}::uuid, status = case when status = 'confirmed' then 'follow_up' else status end where id = ${id}::uuid`;
    await event(sql, id, "followup_task", { note: task.taskNo, meta: { task_id: task.id } }, session);
  });
  return { taskId: task.id, taskNo: task.taskNo };
}

// ─── attachments ─────────────────────────────────────────────────────────────
export async function addAttachment(
  session: ErpSession,
  id: string,
  file: { name: string; buffer: Buffer; contentType: string; kind?: string },
): Promise<{ id: string }> {
  return (await withLocalPg(async (sql) => {
    const row = await loadRow(sql, id);
    if (!canEditInquiry(session, row)) throw new ApiClientError("You cannot edit this inquiry.", { status: 403, code: "FORBIDDEN" });
    const attId = randomUUID();
    const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
    const saved = await saveDocumentBlob({
      storageKey: `customer-inquiries/${id}/${attId}-${safe}`,
      buffer: file.buffer,
      contentType: file.contentType,
      upsert: false,
    });
    const ins = (await sql`
      insert into public.customer_inquiry_attachments (id, inquiry_id, file, name, kind, content_type, size_bytes, uploaded_by)
      values (${attId}::uuid, ${id}::uuid, ${sql.json({ storageKey: saved.storageKey, storageProvider: saved.storageProvider } as any)},
              ${safe}, ${file.kind ?? null}, ${file.contentType}, ${file.buffer.length}, ${session.userId}::uuid)
      returning id
    `) as unknown as any[];
    await event(sql, id, "attachment", { note: safe }, session);
    return { id: ins[0].id };
  })) as { id: string };
}

export async function getAttachmentUrl(session: ErpSession, id: string, attachmentId: string): Promise<string> {
  return (await withLocalPg(async (sql) => {
    const row = await loadRow(sql, id);
    if (!canViewInquiry(session, row)) throw new ApiClientError("Forbidden.", { status: 403, code: "FORBIDDEN" });
    const a = (await sql`select file from public.customer_inquiry_attachments where id = ${attachmentId}::uuid and inquiry_id = ${id}::uuid and deleted_at is null`) as unknown as any[];
    if (!a.length) throw new ApiClientError("Attachment not found.", { status: 404, code: "NOT_FOUND" });
    const url = await resolveDocumentFileUrl(a[0].file?.storageKey);
    if (!url) throw new ApiClientError("File is unavailable.", { status: 502, code: "STORAGE_ERROR" });
    return url;
  })) as string;
}

export async function deleteAttachment(session: ErpSession, id: string, attachmentId: string): Promise<void> {
  await withLocalPg(async (sql) => {
    const row = await loadRow(sql, id);
    if (!canEditInquiry(session, row)) throw new ApiClientError("Forbidden.", { status: 403, code: "FORBIDDEN" });
    const a = (await sql`select file from public.customer_inquiry_attachments where id = ${attachmentId}::uuid and inquiry_id = ${id}::uuid and deleted_at is null`) as unknown as any[];
    if (!a.length) return;
    await sql`update public.customer_inquiry_attachments set deleted_at = now() where id = ${attachmentId}::uuid`;
    await event(sql, id, "attachment", { note: "Attachment removed" }, session);
    if (a[0].file?.storageKey) { try { await deleteDocumentBlob(a[0].file.storageKey); } catch { /* non-fatal */ } }
  });
}

// ─── delete (soft) ──────────────────────────────────────────────────────────
export async function deleteInquiry(session: ErpSession, id: string): Promise<void> {
  await withLocalPg(async (sql) => {
    const row = await loadRow(sql, id);
    if (!(session.isSuperAdmin || (canManageInquiries(session) && row.created_by === session.userId) || row.created_by === session.userId)) {
      throw new ApiClientError("You cannot delete this inquiry.", { status: 403, code: "FORBIDDEN" });
    }
    await sql`update public.customer_inquiries set deleted_at = now() where id = ${id}::uuid`;
    await event(sql, id, "status", { note: "Inquiry deleted" }, session);
  });
}

// ─── register summary (KPIs) ────────────────────────────────────────────────
export async function inquirySummary(session: ErpSession): Promise<Record<string, number>> {
  const rows = await withLocalPg(async (sql) => {
    const vis = visibilityClause(session);
    const q = build(
      `select i.status, count(*)::int c,
              count(*) filter (where i.follow_up_date is not null and i.follow_up_date < (now() at time zone 'UTC')::date
                                and i.status not in ('converted','closed','lost'))::int overdue
       from public.customer_inquiries i
       where i.deleted_at is null and ${vis.text}
       group by i.status`,
      [...vis.params],
    );
    return (await sql.unsafe(q.text, q.values)) as unknown as any[];
  });
  const out: Record<string, number> = { total: 0, follow_up_overdue: 0 };
  for (const st of INQUIRY_STATUSES) out[st] = 0;
  for (const r of rows ?? []) {
    out[r.status] = r.c;
    out.total += r.c;
    out.follow_up_overdue += r.overdue;
  }
  return out;
}

export async function inquiryAssignees(session: ErpSession) {
  const rows = await withLocalPg(async (sql) => {
    return (await sql`
      select distinct ura.user_id, p.full_name as name
      from public.user_role_assignments ura
      join public.profiles p on p.id = ura.user_id
      where ura.is_active = true and ura.deleted_at is null and p.deleted_at is null
      order by p.full_name asc nulls last
    `) as unknown as any[];
  });
  const s = inquiryScope(session);
  const all = (rows ?? []).map((r: any) => ({ userId: r.user_id, name: r.name }));
  return all;
  void s;
}
