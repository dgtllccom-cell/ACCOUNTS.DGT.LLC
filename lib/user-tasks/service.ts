import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import {
  allowedTransitions,
  assignableUserIds,
  canAssignTo,
  canManageTasks,
  canViewTask,
  isTaskManager,
  taskManagerScope,
  transitionResultStatus,
} from "./access";
import type {
  PerformanceRow,
  TaskListScope as _TaskListScope,
  TaskTransition,
  UserTaskRow,
} from "./types";
import { RELATED_MODULES } from "./types";

export class TaskSchemaMissingError extends Error {}

function isSchemaMissing(error: unknown): boolean {
  const e = error as any;
  const code = e?.code || e?.cause?.code;
  const msg = String(e?.message || e || "");
  return code === "42P01" || /relation "?public\.?user_tasks?"? does not exist/i.test(msg) || /relation "?public\.user_task/i.test(msg);
}

export function mapTaskError(error: unknown): { code: string; message: string; status: number; setupPending?: boolean } {
  if (error instanceof ApiClientError) {
    return { code: (error as any).code || "TASK_ERROR", message: error.message, status: (error as any).status || 400 };
  }
  if (isSchemaMissing(error)) {
    return { code: "SETUP_PENDING", message: "User Tasks is not set up on this database yet.", status: 200, setupPending: true };
  }
  console.error("[user-tasks]", error instanceof Error ? error.stack || error.message : error);
  const detail =
    (process.env.APP_ENV || "").toLowerCase() === "development" && error instanceof Error
      ? ` [dev: ${error.message}]`
      : "";
  return { code: "TASK_ERROR", message: "User Tasks is temporarily unavailable." + detail, status: 503 };
}

const OPEN_STATUSES = ["new", "accepted", "in_progress", "waiting", "returned"] as const;

const LIST_SELECT = `
  t.*,
  ap.full_name  as assignee_name,
  cp.full_name  as creator_name,
  vp.full_name  as verifier_name,
  co.name       as country_name,
  cb.name       as country_branch_name,
  cib.name      as city_branch_name,
  (t.due_at is not null and t.due_at < now()
     and t.status not in ('completed','verified','cancelled')) as is_overdue,
  coalesce((select count(*) from public.user_task_attachments a
            where a.task_id = t.id and a.deleted_at is null), 0)::int as attachment_count,
  coalesce((select count(*) from public.user_task_notifications n
            where n.task_id = t.id and n.recipient_id = $1 and n.is_read = false), 0)::int as unread_count
`;

/** SQL WHERE fragment (returned as a builder) limiting rows to what `session` may see. */
function visibilityClause(session: ErpSession) {
  // Returns { text, params }. `text` uses $P placeholders; `build()` renumbers them.
  const me = session.userId;
  if (session.isSuperAdmin) return { text: "true", params: [] as any[] };
  const scope = taskManagerScope(session);
  const clauses: string[] = ["t.assigned_to = $P", "t.created_by = $P"];
  const params: any[] = [me, me];
  if (scope.isManager) {
    if (scope.level === "global") {
      clauses.push("true");
    } else if (scope.level === "country") {
      const ids = scope.countryIds.length ? scope.countryIds : ([scope.countryId].filter(Boolean) as string[]);
      if (ids.length) { clauses.push("t.country_id = any($P::uuid[])"); params.push(ids); }
    } else {
      const cbs = scope.countryBranchIds.length ? scope.countryBranchIds : ([scope.countryBranchId].filter(Boolean) as string[]);
      const cts = scope.cityBranchIds.length ? scope.cityBranchIds : ([scope.cityBranchId].filter(Boolean) as string[]);
      if (cbs.length) { clauses.push("t.country_branch_id = any($P::uuid[])"); params.push(cbs); }
      if (cts.length) { clauses.push("t.city_branch_id = any($P::uuid[])"); params.push(cts); }
    }
  }
  return { text: `(${clauses.join(" OR ")})`, params };
}

/**
 * Number the $P placeholders in `sqlText` sequentially, starting at `$${startAt}`.
 * `params` must line up with the $P occurrences in order. `values` prepends any
 * `fixed` params that already occupy $1..$(startAt-1) in the surrounding SQL.
 */
function build(sqlText: string, params: any[], startAt = 1, fixed: any[] = []): { text: string; values: any[] } {
  let i = startAt - 1;
  const text = sqlText.replace(/\$P/g, () => `$${++i}`);
  const used = i - (startAt - 1);
  if (used !== params.length) throw new Error(`param count mismatch: ${used} placeholders vs ${params.length} params`);
  return { text, values: [...fixed, ...params] };
}

export async function listTasks(
  session: ErpSession,
  opts: {
    scope: _TaskListScope;
    status?: string | null;
    priority?: string | null;
    q?: string | null;
    assigneeId?: string | null;
    countryId?: string | null;
    module?: string | null;
    limit?: number;
  }
): Promise<any[]> {
  const rows = await withLocalPg(async (sql) => {
    const vis = visibilityClause(session);
    const where: string[] = [`t.deleted_at is null`, vis.text];
    const params: any[] = [...vis.params];

    if (opts.scope === "my") { where.push("t.assigned_to = $P"); params.push(session.userId); }
    else if (opts.scope === "team") {
      // Team view = everything the manager oversees that isn't simply their own personal task.
      // The visibility clause already limits rows to the manager's scope; here we just drop
      // the rows where the manager is the assignee (those belong in "My Tasks").
      where.push("t.assigned_to <> $P");
      params.push(session.userId);
    }
    if (opts.scope === "overdue") {
      where.push("t.due_at is not null and t.due_at < now() and t.status not in ('completed','verified','cancelled')");
    }
    if (opts.scope === "completed") {
      where.push("t.status in ('completed','verified')");
    }
    if (opts.status && opts.status !== "all") {
      if (opts.status === "open") { where.push(`t.status = any($P::text[])`); params.push([...OPEN_STATUSES]); }
      else { where.push("t.status = $P"); params.push(opts.status); }
    }
    if (opts.priority && opts.priority !== "all") { where.push("t.priority = $P"); params.push(opts.priority); }
    if (opts.assigneeId) { where.push("t.assigned_to = $P"); params.push(opts.assigneeId); }
    if (opts.countryId) { where.push("t.country_id = $P"); params.push(opts.countryId); }
    if (opts.module && opts.module !== "all") { where.push("t.related_module = $P"); params.push(opts.module); }
    if (opts.q) {
      where.push("(t.title ilike $P or t.task_no ilike $P or t.description ilike $P or t.related_record_label ilike $P)");
      const like = `%${opts.q}%`;
      params.push(like, like, like, like);
    }

    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
    const q = build(
      `select ${LIST_SELECT}
       from public.user_tasks t
       left join public.profiles ap on ap.id = t.assigned_to
       left join public.profiles cp on cp.id = t.created_by
       left join public.profiles vp on vp.id = t.verified_by
       left join public.countries co on co.id = t.country_id
       left join public.country_branches cb on cb.id = t.country_branch_id
       left join public.city_branches cib on cib.id = t.city_branch_id
       where ${where.join(" AND ")}
       order by
         case t.status when 'returned' then 0 when 'new' then 1 when 'in_progress' then 2
              when 'accepted' then 3 when 'waiting' then 4 when 'completed' then 5
              when 'verified' then 7 else 6 end,
         (t.due_at is null), t.due_at asc, t.created_at desc
       limit ${limit}`,
      params,
      2,
      [session.userId]
    );
    return (await sql.unsafe(q.text, q.values)) as unknown as any[];
  });
  return rows ?? [];
}

export async function getTask(session: ErpSession, id: string) {
  return withLocalPg(async (sql) => {
    const trows = (await sql`
      select t.*,
             ap.full_name as assignee_name, cp.full_name as creator_name, vp.full_name as verifier_name,
             co.name as country_name, cb.name as country_branch_name, cib.name as city_branch_name,
             (t.due_at is not null and t.due_at < now() and t.status not in ('completed','verified','cancelled')) as is_overdue
      from public.user_tasks t
      left join public.profiles ap on ap.id = t.assigned_to
      left join public.profiles cp on cp.id = t.created_by
      left join public.profiles vp on vp.id = t.verified_by
      left join public.countries co on co.id = t.country_id
      left join public.country_branches cb on cb.id = t.country_branch_id
      left join public.city_branches cib on cib.id = t.city_branch_id
      where t.id = ${id}::uuid and t.deleted_at is null
      limit 1
    `) as unknown as any[];
    const task = trows[0] as (UserTaskRow & Record<string, any>) | undefined;
    if (!task) return { notFound: true as const };
    if (!canViewTask(session, task)) return { forbidden: true as const };

    const events = (await sql`
      select e.*, p.full_name as actor_name
      from public.user_task_events e
      left join public.profiles p on p.id = e.actor_id
      where e.task_id = ${id}::uuid
      order by e.created_at asc
    `) as unknown as any[];

    const attachments = (await sql`
      select a.*, p.full_name as uploader_name
      from public.user_task_attachments a
      left join public.profiles p on p.id = a.uploaded_by
      where a.task_id = ${id}::uuid and a.deleted_at is null
      order by a.created_at asc
    `) as unknown as any[];

    let relatedRecord: any = null;
    if (task.related_record_table && task.related_record_id) {
      relatedRecord = await projectRelatedRecord(sql, task.related_record_table, task.related_record_id);
    }

    return {
      task,
      events,
      attachments,
      relatedRecord,
      permissions: {
        isAssignee: task.assigned_to === session.userId,
        isManager: isTaskManager(session, task),
        transitions: allowedTransitions(session, task),
      },
    };
  });
}

const RELATED_TABLE_WHITELIST: Record<string, { ref: string; date?: string; amount?: string; party?: string }> = {
  purchase_orders: { ref: "purchase_order_no", date: "created_at", amount: "order_total" },
  sales_orders: { ref: "sales_order_no", date: "order_date", amount: "order_total", party: "customer_name" },
  local_purchases: { ref: "manual_bill_no", date: "created_at", amount: "final_cost", party: "supplier_name" },
  roznamcha_entries: { ref: "journal_no", date: "entry_date" },
  ledgers: { ref: "code", party: "name" },
  bill_expenses: { ref: "bill_no", date: "bill_date", amount: "original_bill_amount", party: "party_name" },
  settlement_transactions: { ref: "source_reference_no", date: "source_date", amount: "local_amount", party: "party_name" },
  employees: { ref: "employee_code" },
  documents: { ref: "id" },
};

async function projectRelatedRecord(sql: any, table: string, id: string) {
  const cfg = RELATED_TABLE_WHITELIST[table];
  if (!cfg) return null;
  try {
    const cols = ["id"];
    if (cfg.ref) cols.push(`${cfg.ref} as ref_no`);
    if (cfg.date) cols.push(`${cfg.date} as ref_date`);
    if (cfg.amount) cols.push(`${cfg.amount} as ref_amount`);
    if (cfg.party) cols.push(`${cfg.party} as ref_party`);
    const rows = await sql.unsafe(
      `select ${cols.join(", ")} from public.${table} where id = $1::uuid limit 1`,
      [id]
    );
    return rows[0] ? { table, ...rows[0] } : { table, id, missing: true };
  } catch {
    return { table, id, missing: true };
  }
}

async function recordEvent(
  sql: any,
  taskId: string,
  actorId: string,
  eventType: string,
  opts: { fromStatus?: string | null; toStatus?: string | null; note?: string | null; meta?: Record<string, unknown> } = {}
): Promise<string> {
  const rows = await sql`
    insert into public.user_task_events (task_id, actor_id, event_type, from_status, to_status, note, meta)
    values (${taskId}::uuid, ${actorId}::uuid, ${eventType}, ${opts.fromStatus ?? null}, ${opts.toStatus ?? null},
            ${opts.note ?? null}, ${sql.json((opts.meta ?? {}) as any)})
    returning id
  `;
  return rows[0].id as string;
}

async function notify(sql: any, taskId: string, recipientId: string, kind: string, title: string | null, eventId?: string) {
  if (!recipientId) return;
  await sql`
    insert into public.user_task_notifications (task_id, recipient_id, event_id, kind, title)
    values (${taskId}::uuid, ${recipientId}::uuid, ${eventId ?? null}, ${kind}, ${title})
  `;
}

export async function createTask(
  session: ErpSession,
  input: {
    title: string;
    description?: string | null;
    instructions?: string | null;
    remarks?: string | null;
    assignedTo: string;
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
    department?: string | null;
    relatedModule?: string | null;
    relatedRecordTable?: string | null;
    relatedRecordId?: string | null;
    relatedRecordLabel?: string | null;
    relatedRoute?: string | null;
    priority?: string | null;
    startDate?: string | null;
    dueAt?: string | null;
  }
): Promise<{ id: string; taskNo: string }> {
  if (!canManageTasks(session)) throw new ApiClientError("You are not allowed to assign tasks.", { status: 403, code: "FORBIDDEN" });
  const title = (input.title || "").trim();
  if (!title) throw new ApiClientError("Task title is required.", { status: 400, code: "VALIDATION" });
  if (!input.assignedTo) throw new ApiClientError("An assignee is required.", { status: 400, code: "VALIDATION" });
  if (!(await canAssignTo(session, input.assignedTo))) {
    throw new ApiClientError("This user is outside your assignable scope.", { status: 403, code: "OUT_OF_SCOPE" });
  }
  if (input.relatedModule && !RELATED_MODULES.includes(input.relatedModule as any)) {
    throw new ApiClientError("Unknown related module.", { status: 400, code: "VALIDATION" });
  }

  // Resolve the task's scope: an explicit request must stay within the creator's own scope
  // (super admin may target anything). Otherwise inherit from the assignee's assignment.
  const scope = taskManagerScope(session);
  let countryId = input.countryId ?? null;
  let countryBranchId = input.countryBranchId ?? null;
  let cityBranchId = input.cityBranchId ?? null;

  const result = await withLocalPg(async (sql) => {
    if (!countryId) {
      const a = (await sql`
        select country_id, country_branch_id, city_branch_id
        from public.user_role_assignments
        where user_id = ${input.assignedTo}::uuid and is_active = true and deleted_at is null
        order by created_at asc limit 1
      `) as unknown as any[];
      if (a[0]) {
        countryId = a[0].country_id ?? null;
        countryBranchId = countryBranchId ?? a[0].country_branch_id ?? null;
        cityBranchId = cityBranchId ?? a[0].city_branch_id ?? null;
      }
    }
    if (!session.isSuperAdmin && scope.level === "country" && countryId && scope.countryIds.length && !scope.countryIds.includes(countryId)) {
      throw new ApiClientError("Task country is outside your scope.", { status: 403, code: "OUT_OF_SCOPE" });
    }

    const rows = await sql`
      insert into public.user_tasks (
        title, description, instructions, remarks,
        country_id, country_branch_id, city_branch_id, department,
        created_by, assigned_to,
        related_module, related_record_table, related_record_id, related_record_label, related_route,
        priority, start_date, due_at, status
      ) values (
        ${title}, ${input.description ?? null}, ${input.instructions ?? null}, ${input.remarks ?? null},
        ${countryId}, ${countryBranchId}, ${cityBranchId}, ${input.department ?? null},
        ${session.userId}::uuid, ${input.assignedTo}::uuid,
        ${input.relatedModule ?? null}, ${input.relatedRecordTable ?? null},
        ${input.relatedRecordId ?? null}, ${input.relatedRecordLabel ?? null}, ${input.relatedRoute ?? null},
        ${(input.priority as any) || "normal"}, ${input.startDate ?? null}, ${input.dueAt ?? null}, 'new'
      )
      returning id, task_no
    `;
    return rows[0];
  });
  if (!result) throw new ApiClientError("Could not create the task.", { status: 503, code: "TASK_ERROR" });
  return { id: result.id, taskNo: result.task_no };
}

export async function editTask(
  session: ErpSession,
  id: string,
  patch: Record<string, any>
): Promise<void> {
  await withLocalPg(async (sql) => {
    const rows = (await sql`select * from public.user_tasks where id = ${id}::uuid and deleted_at is null limit 1`) as unknown as any[];
    const task = rows[0] as UserTaskRow | undefined;
    if (!task) throw new ApiClientError("Task not found.", { status: 404, code: "NOT_FOUND" });
    if (!isTaskManager(session, task)) throw new ApiClientError("Only a task manager can edit this task.", { status: 403, code: "FORBIDDEN" });

    const sets: string[] = [];
    const params: any[] = [];
    const allow: Record<string, string> = {
      title: "title", description: "description", instructions: "instructions", remarks: "remarks",
      department: "department", priority: "priority", startDate: "start_date", dueAt: "due_at",
      relatedModule: "related_module", relatedRecordTable: "related_record_table",
      relatedRecordId: "related_record_id", relatedRecordLabel: "related_record_label", relatedRoute: "related_route",
    };
    for (const [k, col] of Object.entries(allow)) {
      if (k in patch) { params.push(patch[k] === "" ? null : patch[k]); sets.push(`${col} = $${params.length}`); }
    }
    if (!sets.length) return;
    params.push(id);
    await sql.unsafe(`update public.user_tasks set ${sets.join(", ")} where id = $${params.length}::uuid`, params);

    const notes: string[] = [];
    if ("dueAt" in patch) { await recordEvent(sql, id, session.userId, "due_changed", { note: String(patch.dueAt ?? "cleared"), meta: { due_at: patch.dueAt } }); notes.push("due"); }
    if ("priority" in patch) { await recordEvent(sql, id, session.userId, "priority_changed", { note: String(patch.priority), meta: { priority: patch.priority } }); }
    if (!("dueAt" in patch) && !("priority" in patch)) {
      await recordEvent(sql, id, session.userId, "comment", { note: "Task details updated." });
    }
    if (task.assigned_to !== session.userId) await notify(sql, id, task.assigned_to, "updated", task.title);
  });
}

export async function transition(
  session: ErpSession,
  id: string,
  action: TaskTransition,
  opts: { note?: string | null; evidenceTable?: string | null; evidenceId?: string | null; evidenceRef?: string | null; returnReason?: string | null } = {}
): Promise<{ status: string }> {
  return (await withLocalPg(async (sql) => {
    const rows = (await sql`select * from public.user_tasks where id = ${id}::uuid and deleted_at is null limit 1`) as unknown as any[];
    const task = rows[0] as UserTaskRow | undefined;
    if (!task) throw new ApiClientError("Task not found.", { status: 404, code: "NOT_FOUND" });

    const allowed = allowedTransitions(session, task);
    if (!allowed.includes(action)) {
      throw new ApiClientError(`Action "${action}" is not allowed from status "${task.status}".`, { status: 409, code: "INVALID_TRANSITION" });
    }
    const nextStatus = transitionResultStatus(action);
    if (!nextStatus) throw new ApiClientError("Unknown action.", { status: 400, code: "VALIDATION" });

    if (action === "complete" && !(opts.note || "").trim() && !opts.evidenceId && !opts.evidenceRef) {
      // require *some* evidence of work — a note at minimum
      throw new ApiClientError("Add a completion note or link an ERP record as evidence before completing.", { status: 400, code: "EVIDENCE_REQUIRED" });
    }
    if (action === "return" && !(opts.returnReason || opts.note || "").trim()) {
      throw new ApiClientError("A reason is required when returning a task.", { status: 400, code: "REASON_REQUIRED" });
    }

    const stampCol: Record<string, string | null> = {
      accept: "accepted_at", start: "started_at", resume: null, hold: "waiting_at",
      complete: "completed_at", verify: "verified_at", return: "returned_at", reopen: null, cancel: "cancelled_at",
    };

    const sets = [`status = $1`];
    const params: any[] = [nextStatus];
    const stamp = stampCol[action];
    if (stamp) { params.push(new Date().toISOString()); sets.push(`${stamp} = $${params.length}`); }
    if (action === "verify") { params.push(session.userId); sets.push(`verified_by = $${params.length}`); if (opts.note) { params.push(opts.note); sets.push(`verification_notes = $${params.length}`); } }
    if (action === "return") { params.push(opts.returnReason || opts.note); sets.push(`return_reason = $${params.length}`); }
    if (action === "complete") {
      if (opts.note) { params.push(opts.note); sets.push(`completion_notes = $${params.length}`); }
      if (opts.evidenceTable) { params.push(opts.evidenceTable); sets.push(`evidence_record_table = $${params.length}`); }
      if (opts.evidenceId) { params.push(opts.evidenceId); sets.push(`evidence_record_id = $${params.length}`); }
      if (opts.evidenceRef) { params.push(opts.evidenceRef); sets.push(`evidence_reference_no = $${params.length}`); }
    }
    params.push(id);
    await sql.unsafe(`update public.user_tasks set ${sets.join(", ")} where id = $${params.length}::uuid`, params);

    const eventType =
      action === "accept" ? "accepted" :
      action === "start" || action === "resume" || action === "reopen" ? "started" :
      action === "hold" ? "waiting" :
      action === "complete" ? "completed" :
      action === "verify" ? "verified" :
      action === "return" ? "returned" : "cancelled";
    const evId = await recordEvent(sql, id, session.userId, eventType, {
      fromStatus: task.status, toStatus: nextStatus, note: opts.returnReason || opts.note || null,
      meta: opts.evidenceId || opts.evidenceRef ? { evidence: { table: opts.evidenceTable, id: opts.evidenceId, ref: opts.evidenceRef } } : {},
    });
    if (action === "complete" && (opts.evidenceId || opts.evidenceRef)) {
      await recordEvent(sql, id, session.userId, "evidence_linked", { note: opts.evidenceRef || opts.evidenceId, meta: { table: opts.evidenceTable } });
    }

    // notify the other side
    const target = session.userId === task.assigned_to ? task.created_by : task.assigned_to;
    await notify(sql, id, target, eventType, task.title, evId);

    return { status: nextStatus };
  }))!;
}

export async function addNote(
  session: ErpSession,
  id: string,
  input: { note: string; kind?: "progress_note" | "comment" }
): Promise<void> {
  const note = (input.note || "").trim();
  if (!note) throw new ApiClientError("Note text is required.", { status: 400, code: "VALIDATION" });
  await withLocalPg(async (sql) => {
    const rows = (await sql`select * from public.user_tasks where id = ${id}::uuid and deleted_at is null limit 1`) as unknown as any[];
    const task = rows[0] as UserTaskRow | undefined;
    if (!task) throw new ApiClientError("Task not found.", { status: 404, code: "NOT_FOUND" });
    if (!canViewTask(session, task)) throw new ApiClientError("Not allowed.", { status: 403, code: "FORBIDDEN" });
    const kind = input.kind === "comment" ? "comment" : "progress_note";
    const evId = await recordEvent(sql, id, session.userId, kind, { note });
    const target = session.userId === task.assigned_to ? task.created_by : task.assigned_to;
    await notify(sql, id, target, "note", task.title, evId);
  });
}

export async function addAttachment(
  session: ErpSession,
  id: string,
  input: { kind?: "instruction" | "evidence"; name: string; mime?: string | null; sizeBytes?: number | null; file?: Record<string, unknown> | null; note?: string | null }
): Promise<{ id: string }> {
  const name = (input.name || "").trim();
  if (!name) throw new ApiClientError("Attachment name is required.", { status: 400, code: "VALIDATION" });
  return (await withLocalPg(async (sql) => {
    const rows = (await sql`select * from public.user_tasks where id = ${id}::uuid and deleted_at is null limit 1`) as unknown as any[];
    const task = rows[0] as UserTaskRow | undefined;
    if (!task) throw new ApiClientError("Task not found.", { status: 404, code: "NOT_FOUND" });
    if (!canViewTask(session, task)) throw new ApiClientError("Not allowed.", { status: 403, code: "FORBIDDEN" });
    const kind = input.kind === "instruction" ? "instruction" : "evidence";
    if (kind === "instruction" && !isTaskManager(session, task)) {
      throw new ApiClientError("Only a task manager can add instruction files.", { status: 403, code: "FORBIDDEN" });
    }
    const ins = await sql`
      insert into public.user_task_attachments (task_id, kind, uploaded_by, name, mime, size_bytes, file, note)
      values (${id}::uuid, ${kind}, ${session.userId}::uuid, ${name}, ${input.mime ?? null},
              ${input.sizeBytes ?? null}, ${input.file ? sql.json(input.file as any) : null}, ${input.note ?? null})
      returning id
    `;
    const evId = await recordEvent(sql, id, session.userId, "attachment_added", { note: name, meta: { kind } });
    const target = session.userId === task.assigned_to ? task.created_by : task.assigned_to;
    await notify(sql, id, target, "attachment", task.title, evId);
    return { id: ins[0].id };
  }))!;
}

/** Attachment row (scope-checked) for the download route to resolve its stored file. */
export async function getAttachmentForDownload(
  session: ErpSession,
  id: string,
  attachmentId: string,
): Promise<{ file: unknown; name: string; mime: string | null } | null> {
  return withLocalPg(async (sql) => {
    const rows = (await sql`
      select a.file, a.name, a.mime,
             t.assigned_to, t.created_by, t.country_id, t.country_branch_id, t.city_branch_id
      from public.user_task_attachments a join public.user_tasks t on t.id = a.task_id
      where a.id = ${attachmentId}::uuid and a.task_id = ${id}::uuid and a.deleted_at is null limit 1
    `) as unknown as any[];
    const row = rows[0];
    if (!row) return null;
    if (!canViewTask(session, { ...row } as UserTaskRow)) return null;
    return { file: row.file, name: row.name, mime: row.mime };
  });
}

export async function deleteAttachment(session: ErpSession, id: string, attachmentId: string): Promise<void> {
  await withLocalPg(async (sql) => {
    const rows = (await sql`
      select a.*, t.assigned_to, t.created_by, t.country_id, t.country_branch_id, t.city_branch_id
      from public.user_task_attachments a join public.user_tasks t on t.id = a.task_id
      where a.id = ${attachmentId}::uuid and a.task_id = ${id}::uuid and a.deleted_at is null limit 1
    `) as unknown as any[];
    const att = rows[0];
    if (!att) throw new ApiClientError("Attachment not found.", { status: 404, code: "NOT_FOUND" });
    const isOwner = att.uploaded_by === session.userId;
    const isMgr = isTaskManager(session, att as any);
    if (!isOwner && !isMgr) throw new ApiClientError("Not allowed.", { status: 403, code: "FORBIDDEN" });
    await sql`update public.user_task_attachments set deleted_at = now() where id = ${attachmentId}::uuid`;
    const storageKey = (att.file as any)?.storageKey as string | undefined;
    if (storageKey) {
      try {
        const { deleteDocumentBlob } = await import("@/lib/documents/document-storage");
        await deleteDocumentBlob(storageKey);
      } catch {
        /* best-effort — the row is already soft-deleted */
      }
    }
  });
}

export async function summary(session: ErpSession) {
  return (await withLocalPg(async (sql) => {
    const mine = (await sql`
      select
        count(*) filter (where assigned_to = ${session.userId}::uuid and status = any(${[...OPEN_STATUSES]}::text[])) as my_open,
        count(*) filter (where assigned_to = ${session.userId}::uuid and due_at is not null and due_at < now()
                         and status not in ('completed','verified','cancelled')) as my_overdue,
        count(*) filter (where assigned_to = ${session.userId}::uuid and status in ('new','returned')) as my_new,
        count(*) filter (where created_by = ${session.userId}::uuid and status = 'completed') as awaiting_my_verification
      from public.user_tasks
      where deleted_at is null
    `) as unknown as any[];
    const unread = (await sql`
      select count(*)::int c from public.user_task_notifications
      where recipient_id = ${session.userId}::uuid and is_read = false
    `) as unknown as any[];
    const notifications = (await sql`
      select n.id, n.task_id, n.kind, n.title, n.is_read, n.created_at, t.task_no, t.status
      from public.user_task_notifications n
      join public.user_tasks t on t.id = n.task_id
      where n.recipient_id = ${session.userId}::uuid
      order by n.created_at desc
      limit 30
    `) as unknown as any[];
    return {
      myOpen: Number(mine[0]?.my_open ?? 0),
      myOverdue: Number(mine[0]?.my_overdue ?? 0),
      myNew: Number(mine[0]?.my_new ?? 0),
      awaitingMyVerification: Number(mine[0]?.awaiting_my_verification ?? 0),
      unread: Number(unread[0]?.c ?? 0),
      notifications,
    };
  }))!;
}

export async function markNotificationsRead(session: ErpSession, ids?: string[]): Promise<number> {
  return (await withLocalPg(async (sql) => {
    const res = ids?.length
      ? await sql`update public.user_task_notifications set is_read = true, read_at = now()
                  where recipient_id = ${session.userId}::uuid and is_read = false and id = any(${ids}::uuid[])`
      : await sql`update public.user_task_notifications set is_read = true, read_at = now()
                  where recipient_id = ${session.userId}::uuid and is_read = false`;
    return (res as any).count ?? 0;
  })) ?? 0;
}

/** Mark every unread notification for one task as read (called when the user opens it). */
export async function markTaskSeen(session: ErpSession, taskId: string): Promise<void> {
  await withLocalPg(async (sql) => {
    await sql`update public.user_task_notifications set is_read = true, read_at = now()
              where recipient_id = ${session.userId}::uuid and task_id = ${taskId}::uuid and is_read = false`;
  });
}

export async function performance(
  session: ErpSession,
  opts: { countryId?: string | null; from?: string | null; to?: string | null; userId?: string | null }
): Promise<PerformanceRow[]> {
  if (!canManageTasks(session)) throw new ApiClientError("Not allowed.", { status: 403, code: "FORBIDDEN" });
  const rows = await withLocalPg(async (sql) => {
    const vis = visibilityClause(session);
    const where: string[] = ["t.deleted_at is null", vis.text];
    const params: any[] = [...vis.params];
    if (opts.countryId) { where.push("t.country_id = $P"); params.push(opts.countryId); }
    if (opts.userId) { where.push("t.assigned_to = $P"); params.push(opts.userId); }
    if (opts.from) { where.push("t.created_at >= $P"); params.push(`${opts.from}T00:00:00.000Z`); }
    if (opts.to) { where.push("t.created_at <= $P"); params.push(`${opts.to}T23:59:59.999Z`); }

    const q = build(
      `select
         t.assigned_to as user_id,
         p.full_name as user_name,
         t.country_id, co.name as country_name,
         count(*)::int as total_assigned,
         count(*) filter (where t.status in ('completed','verified'))::int as completed,
         count(*) filter (where t.status = 'verified')::int as verified,
         count(*) filter (where t.status = 'in_progress')::int as in_progress,
         count(*) filter (where t.status = 'waiting')::int as waiting,
         count(*) filter (where t.status in ('new','accepted','returned'))::int as pending,
         count(*) filter (where t.due_at is not null and t.due_at < now() and t.status not in ('completed','verified','cancelled'))::int as overdue,
         count(*) filter (where t.status = 'returned')::int as returned,
         coalesce(
           avg(case when t.status in ('completed','verified') and t.completed_at is not null
                    then case when t.due_at is null or t.completed_at <= t.due_at then 1.0 else 0.0 end end),
           0)::float as on_time_rate
       from public.user_tasks t
       left join public.profiles p on p.id = t.assigned_to
       left join public.countries co on co.id = t.country_id
       where ${where.join(" AND ")}
       group by t.assigned_to, p.full_name, t.country_id, co.name
       order by total_assigned desc, user_name asc`,
      params
    );
    return (await sql.unsafe(q.text, q.values)) as unknown as any[];
  });
  return (rows ?? []) as PerformanceRow[];
}

export async function auditTrail(
  session: ErpSession,
  opts: { taskId?: string | null; userId?: string | null; from?: string | null; to?: string | null; limit?: number }
) {
  const rows = await withLocalPg(async (sql) => {
    const vis = visibilityClause(session);
    const where: string[] = ["t.deleted_at is null", vis.text];
    const params: any[] = [...vis.params];
    if (opts.taskId) { where.push("e.task_id = $P"); params.push(opts.taskId); }
    if (opts.userId) { where.push("e.actor_id = $P"); params.push(opts.userId); }
    if (opts.from) { where.push("e.created_at >= $P"); params.push(`${opts.from}T00:00:00.000Z`); }
    if (opts.to) { where.push("e.created_at <= $P"); params.push(`${opts.to}T23:59:59.999Z`); }
    const limit = Math.min(Math.max(opts.limit ?? 300, 1), 1000);
    const q = build(
      `select e.id, e.task_id, e.actor_id, e.event_type, e.from_status, e.to_status, e.note, e.meta, e.created_at,
              p.full_name as actor_name, t.task_no, t.title, t.assigned_to, ap.full_name as assignee_name
       from public.user_task_events e
       join public.user_tasks t on t.id = e.task_id
       left join public.profiles p on p.id = e.actor_id
       left join public.profiles ap on ap.id = t.assigned_to
       where ${where.join(" AND ")}
       order by e.created_at desc
       limit ${limit}`,
      params
    );
    return (await sql.unsafe(q.text, q.values)) as unknown as any[];
  });
  return rows ?? [];
}

export async function listAssignees(session: ErpSession) {
  return assignableUserIds(session);
}
