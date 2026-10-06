/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Conversation Intelligence + Lead Reactivation on the EXISTING Customer Inquiry module.
 *
 *  analyze  — meeting notes / WhatsApp export / email or Document Intelligence text → structured
 *             preview (no writes).
 *  confirm  — the user-approved preview is written to the existing customer_inquiries (new or an
 *             existing inquiry) + customer_inquiry_events, and each approved action item / date
 *             becomes an existing User Task linked back to its source. Nothing is sent.
 *  reactivation — old / lost / stalled inquiries in scope, scored from real activity; reactivate =
 *             inquiry back to follow-up + CRM action item + follow-up note + User Task, all on the
 *             existing tables. AI Calls history for the customer is shown; outbound calling itself
 *             needs the telephony provider (not configured).
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { createTask } from "@/lib/user-tasks/service";
import { createInquiry, event, loadRow, updateInquiry, visibilityClause, build } from "./service";
import { canEditInquiry, canViewInquiry } from "./access";
import { analyzeConversation, type Channel } from "./conversation-intel";
import { intakeScopeFromSession, rowInScope } from "@/lib/document-intelligence/scope";

const bad = (m: string, code = "VALIDATION") => new ApiClientError(m, { status: 400, code });
const today = () => new Date().toISOString().slice(0, 10);

// ── inputs ──────────────────────────────────────────────────────────────────

/** Text of a Document Intelligence job (its extracted fields), scope-checked. */
export async function textFromIntakeJob(session: ErpSession, jobId: string) {
  const job = ((await withReadPg((sql) => sql`
    SELECT id, job_no, original_filename, doc_type_code, country_id, country_branch_id, city_branch_id, clearing_agent_id, operational_domain
    FROM public.document_intake_jobs WHERE id = ${jobId}::uuid`)) as any[] | null)?.[0];
  if (!job || !rowInScope(intakeScopeFromSession(session), job)) throw new ApiClientError("Document not found.", { status: 404, code: "NOT_FOUND" });
  const fields = ((await withReadPg((sql) => sql`
    SELECT field_label, COALESCE(corrected_value, normalized_value, raw_value) AS value
    FROM public.document_intake_fields WHERE job_id = ${jobId}::uuid ORDER BY page_number NULLS LAST, created_at`)) ?? []) as any[];
  const text = [`Document: ${job.original_filename ?? job.job_no} (${job.doc_type_code ?? "document"})`, ...fields.filter((f) => f.value).map((f) => `${f.field_label}: ${f.value}`)].join("\n");
  return { text, label: `${job.job_no} · ${job.original_filename ?? ""}`, route: `/dashboard/document-intelligence?job=${job.id}` };
}

export async function analyze(session: ErpSession, input: { channel: Channel; text?: string | null; intakeJobId?: string | null; lang: string }) {
  let text = (input.text ?? "").trim();
  let source: { label: string; route: string } | null = null;
  if (input.intakeJobId) {
    const j = await textFromIntakeJob(session, input.intakeJobId);
    text = [j.text, text].filter(Boolean).join("\n\n");
    source = { label: j.label, route: j.route };
  }
  if (text.length < 10) throw bad("Paste the meeting notes, chat or email text first.", "TEXT_REQUIRED");
  if (text.length > 60000) throw bad("The text is too long (max 60,000 characters).", "TEXT_TOO_LONG");
  const a = analyzeConversation({ channel: input.channel, text, refDate: today(), lang: input.lang, authorName: session.fullName ?? null });
  // Existing-customer matches (same lookup the inquiry AI draft uses) so the user links instead of duplicating.
  const terms = [a.draft.customer_name, a.draft.company_name, a.draft.mobile, a.draft.email, a.draft.whatsapp].filter(Boolean).map(String);
  const matches = terms.length ? ((await withReadPg((sql) => sql`
      SELECT id, customer_name, company_name, mobile, email FROM public.customers
      WHERE deleted_at IS NULL AND (customer_name ILIKE ANY(${terms.map((x) => `%${x.replace(/[%_]/g, "")}%`)}) OR company_name ILIKE ANY(${terms.map((x) => `%${x.replace(/[%_]/g, "")}%`)})
                                    OR mobile = ANY(${terms}) OR email = ANY(${terms}))
      LIMIT 8`)) ?? []) as any[] : [];
  // Existing open inquiries for the same person (so a meeting can be added to it).
  const vis = visibilityClause(session);
  const inq = terms.length ? ((await withReadPg(async (sql) => {
    const q = build(`SELECT i.id, i.inquiry_no, i.customer_name, i.company_name, i.status FROM public.customer_inquiries i
                     WHERE i.deleted_at IS NULL AND ${vis.text} AND i.status NOT IN ('converted')
                       AND (i.customer_name ILIKE ANY($P) OR i.company_name ILIKE ANY($P) OR i.mobile = ANY($P) OR i.email = ANY($P))
                     ORDER BY i.updated_at DESC LIMIT 8`, [...vis.params, terms.map((x) => `%${x}%`), terms.map((x) => `%${x}%`), terms, terms]);
    return sql.unsafe(q.text, q.values);
  })) ?? []) as any[] : [];
  return { ...a, text, source, customerMatches: matches.map((m) => ({ id: m.id, label: [m.customer_name, m.company_name].filter(Boolean).join(" · "), mobile: m.mobile, email: m.email })), inquiryMatches: inq };
}

// ── confirm (writes, user-approved) ─────────────────────────────────────────

export async function confirm(
  session: ErpSession,
  input: {
    channel: Channel; text: string; lang: string; sourceRoute?: string | null; sourceLabel?: string | null;
    inquiry: { mode: "new" | "existing" | "none"; inquiryId?: string | null; customerId?: string | null;
      customerName?: string | null; companyName?: string | null; contactPerson?: string | null; mobile?: string | null; whatsapp?: string | null; email?: string | null;
      businessType?: string | null; summary?: string | null; requirements?: string | null; followUpDate?: string | null };
    tasks: Array<{ title: string; assignedTo: string; dueDate?: string | null; priority?: "high" | "normal" | null; kind: "action" | "date" }>;
  }
) {
  const created: { inquiryId: string | null; inquiryNo: string | null; tasks: string[]; skipped: Array<{ title: string; reason: string }> } = { inquiryId: null, inquiryNo: null, tasks: [], skipped: [] };
  const src = input.channel === "meeting" ? "meeting" : input.channel === "whatsapp" ? "whatsapp" : "email";
  const q = input.inquiry;
  if (q.mode === "new") {
    if (!q.customerName?.trim()) throw bad("Enter the customer name for the new inquiry.", "NAME_REQUIRED");
    const r = await createInquiry(session, {
      customerId: q.customerId ?? null, customerName: q.customerName.trim(), companyName: q.companyName ?? null, contactPerson: q.contactPerson ?? null,
      mobile: q.mobile ?? null, whatsapp: q.whatsapp ?? null, email: q.email ?? null, businessType: q.businessType ?? null,
      inquirySummary: q.summary ?? null, meetingNotes: input.text.slice(0, 20000), requirements: q.requirements ?? null, source: src,
      followUpDate: q.followUpDate ?? null, entryMode: "ai_text", aiRawInput: input.text.slice(0, 20000), originalLanguageCode: input.lang,
    });
    created.inquiryId = r.id; created.inquiryNo = r.inquiryNo;
  } else if (q.mode === "existing") {
    if (!q.inquiryId) throw bad("Choose the inquiry to update.", "INQUIRY_REQUIRED");
    const row = await withLocalPg((sql) => loadRow(sql, q.inquiryId!));
    if (!row || !canEditInquiry(session, row)) throw new ApiClientError("Inquiry not found.", { status: 404, code: "NOT_FOUND" });
    const stamp = `[${today()} · ${src}] `;
    await updateInquiry(session, row.id, {
      meetingNotes: `${row.meeting_notes ? `${row.meeting_notes}\n\n` : ""}${stamp}${input.text}`.slice(0, 40000),
      ...(q.requirements ? { requirements: [row.requirements, q.requirements].filter(Boolean).join("\n") } : {}),
      ...(q.followUpDate ? { followUpDate: q.followUpDate } : {}),
    });
    created.inquiryId = row.id; created.inquiryNo = row.inquiry_no;
  }
  const row = created.inquiryId ? await withLocalPg((sql) => loadRow(sql, created.inquiryId!)) : null;
  for (const t of input.tasks ?? []) {
    if (!t.title?.trim() || !t.assignedTo) { created.skipped.push({ title: t.title, reason: "missing title or assignee" }); continue; }
    try {
      const task = await createTask(session, {
        title: t.title.trim().slice(0, 240),
        description: `${input.sourceLabel ?? src}\n\n${(q.summary ?? "").slice(0, 1500)}`,
        assignedTo: t.assignedTo,
        countryId: row?.country_id ?? null, countryBranchId: row?.country_branch_id ?? null, cityBranchId: row?.city_branch_id ?? null,
        relatedModule: row ? "customer_inquiry" : input.channel === "email" && input.sourceRoute?.includes("document-intelligence") ? "documents" : input.channel === "whatsapp" ? "whatsapp" : input.channel === "email" ? "dgt_mail" : "customer_inquiry",
        relatedRecordTable: row ? "customer_inquiries" : null, relatedRecordId: row?.id ?? null,
        relatedRecordLabel: row?.inquiry_no ?? input.sourceLabel ?? null,
        relatedRoute: row ? `/dashboard/customer-inquiries?id=${row.id}` : input.sourceRoute ?? null,
        priority: t.priority === "high" ? "high" : "normal",
        dueAt: t.dueDate ? `${t.dueDate}T09:00:00.000Z` : null,
      });
      created.tasks.push(task.taskNo);
    } catch (e) {
      created.skipped.push({ title: t.title, reason: (e as Error).message });
    }
  }
  if (row) {
    await withLocalPg((sql) => event(sql, row.id, "note", { note: `${src} captured`, meta: { conversation: { channel: input.channel, tasks: created.tasks, skipped: created.skipped.length, source: input.sourceLabel ?? null } } }, session));
  }
  return created;
}

// ── lead reactivation ───────────────────────────────────────────────────────

export async function reactivationCandidates(session: ErpSession, opts: { days: number; includeLost: boolean }) {
  const days = Math.min(Math.max(Math.round(opts.days || 90), 14), 1095);
  const vis = visibilityClause(session);
  const statuses = ["new", "ai_draft", "confirmed", "in_progress", "follow_up", ...(opts.includeLost ? ["lost", "closed"] : [])];
  const rows = ((await withReadPg(async (sql) => {
    const q = build(`
      WITH base AS (
        SELECT i.*, GREATEST(i.updated_at, COALESCE((SELECT max(e.created_at) FROM public.customer_inquiry_events e WHERE e.inquiry_id = i.id), i.updated_at),
                              COALESCE((SELECT max(c.started_at) FROM public.ai_calls c WHERE c.customer_id = i.customer_id), i.updated_at)) AS last_activity
        FROM public.customer_inquiries i
        WHERE i.deleted_at IS NULL AND ${vis.text} AND i.status = ANY($P)
      )
      SELECT b.id, b.inquiry_no, b.customer_id, b.customer_name, b.company_name, b.mobile, b.whatsapp, b.email, b.status, b.lost_reason,
             b.inquiry_summary, b.requirements, b.business_type, b.last_activity, b.assigned_to, p.full_name AS assignee_name,
             (current_date - b.last_activity::date) AS idle_days,
             (SELECT count(*) FROM public.ai_calls c WHERE c.customer_id = b.customer_id)::int AS call_count,
             (SELECT ci.summary FROM public.ai_calls c JOIN public.ai_call_intelligence ci ON ci.call_id = c.id WHERE c.customer_id = b.customer_id ORDER BY c.started_at DESC LIMIT 1) AS last_call_summary,
             (SELECT ci.risk_level FROM public.ai_calls c JOIN public.ai_call_intelligence ci ON ci.call_id = c.id WHERE c.customer_id = b.customer_id ORDER BY c.started_at DESC LIMIT 1) AS last_call_risk
      FROM base b LEFT JOIN public.profiles p ON p.id = b.assigned_to
      WHERE b.last_activity < now() - ($P || ' days')::interval
      ORDER BY b.last_activity ASC
      LIMIT 300`, [...vis.params, statuses, String(days)]);
    return sql.unsafe(q.text, q.values);
  })) ?? []) as any[];
  return rows.map((r) => {
    // Transparent score from real fields only (0–100).
    const contactable = !!(r.mobile || r.whatsapp || r.email);
    let score = 0;
    score += Math.min(40, Math.round(Number(r.idle_days) / 9));
    score += r.requirements ? 20 : 0;
    score += contactable ? 20 : 0;
    score += r.customer_id ? 10 : 0;
    score += r.status === "lost" || r.status === "closed" ? 0 : 10;
    return { ...r, contactable, score: Math.min(100, score), talkingPoints: [r.inquiry_summary, r.requirements, r.last_call_summary, r.lost_reason ? `Lost: ${r.lost_reason}` : null].filter(Boolean) };
  }).sort((a, b) => b.score - a.score);
}

export async function reactivate(session: ErpSession, inquiryId: string, input: { assignedTo: string; dueDate: string; note: string; channel?: string | null }) {
  if (!input.assignedTo) throw bad("Choose who follows up.", "ASSIGNEE_REQUIRED");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate || "")) throw bad("Choose the follow-up date.", "DATE_REQUIRED");
  const note = (input.note || "").trim();
  if (note.length < 3) throw bad("Add a short reactivation note (what you will offer / ask).", "NOTE_REQUIRED");
  const row = await withLocalPg((sql) => loadRow(sql, inquiryId));
  if (!row || !canViewInquiry(session, row)) throw new ApiClientError("Inquiry not found.", { status: 404, code: "NOT_FOUND" });
  if (row.status === "converted") throw new ApiClientError("A converted inquiry is already a customer — use the customer follow-up instead.", { status: 409, code: "ALREADY_CONVERTED" });
  const task = await createTask(session, {
    title: `Reactivate: ${row.customer_name}${row.company_name ? ` (${row.company_name})` : ""}`,
    description: [row.inquiry_summary, row.requirements].filter(Boolean).join("\n"), instructions: note,
    assignedTo: input.assignedTo, countryId: row.country_id, countryBranchId: row.country_branch_id, cityBranchId: row.city_branch_id,
    relatedModule: "customer_inquiry", relatedRecordTable: "customer_inquiries", relatedRecordId: row.id, relatedRecordLabel: row.inquiry_no,
    relatedRoute: `/dashboard/customer-inquiries?id=${row.id}`, priority: "normal", dueAt: `${input.dueDate}T09:00:00.000Z`,
  });
  const crmItemId = await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    await tx`UPDATE public.customer_inquiries SET status = 'follow_up', follow_up_date = ${input.dueDate}::date, assigned_to = ${input.assignedTo}::uuid,
               linked_task_id = ${task.id}::uuid, status_note = ${note}, updated_at = now() WHERE id = ${row.id}::uuid`;
    await event(tx, row.id, "status", { from: row.status, to: "follow_up", note: `Reactivated: ${note}`, meta: { reactivation: true, task: task.taskNo, channel: input.channel ?? null } }, session);
    // CRM action item (existing Smart CRM table) + follow-up note, so it appears in the CRM work queue.
    const existing = ((await tx`SELECT id FROM public.crm_action_items WHERE source_type = 'customer_inquiry' AND source_id = ${row.id} AND COALESCE(is_completed,false) = false LIMIT 1`) as any[])[0];
    let id = existing?.id as string | undefined;
    if (!id) {
      id = ((await tx`
        INSERT INTO public.crm_action_items (source_type, source_id, reference_no, party_name, due_date, item_type, module, amount, paid_amount, remaining_amount, currency,
                                             country_id, country_branch_id, city_branch_id, responsible_user_id, urgency_class, status, notes, next_follow_up)
        VALUES ('customer_inquiry', ${row.id}, ${row.inquiry_no}, ${row.company_name || row.customer_name}, ${input.dueDate}::date, 'reactivation', 'CRM', 0, 0, 0, 'AED',
                ${row.country_id}, ${row.country_branch_id}, ${row.city_branch_id}, ${input.assignedTo}, 'upcoming', 'In Progress', ${note}, ${input.dueDate}::date)
        RETURNING id`) as any[])[0].id;
    } else {
      await tx`UPDATE public.crm_action_items SET due_date = ${input.dueDate}::date, next_follow_up = ${input.dueDate}::date, notes = ${note}, status = 'In Progress', responsible_user_id = ${input.assignedTo}, updated_at = now() WHERE id = ${id}::uuid`;
    }
    await tx`INSERT INTO public.crm_followup_notes (crm_item_id, user_id, user_name, user_role, note_type, note_text)
             VALUES (${id}, ${session.userId}, ${session.fullName ?? "User"}, ${session.roles?.[0] ?? "user"}, 'Reactivation', ${note})`;
    return id;
  }));
  return { inquiryId: row.id, inquiryNo: row.inquiry_no, status: "follow_up", taskNo: task.taskNo, crmItemId };
}
