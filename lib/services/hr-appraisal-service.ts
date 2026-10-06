/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Employee Performance & Appraisal.
 *
 * draft (HR / reviewer set goals, actuals, scores, comments)
 *   → submitted (reviewer; every goal scored, weights = 100, improvement plan when rating < 2.5)
 *   → acknowledged (the employee, from their own login, with optional comments)
 *   → closed (HR).  cancel: HR, before acknowledgement.  reopen: submitted → draft (HR / reviewer).
 *
 * System KPIs read the EXISTING records — user_tasks (task completion / on-time) through the
 * employee's linked user, and office_attendance (attendance rate). No data → actual stays empty.
 * Follow-ups (acknowledge, improvement plan) are EXISTING user_tasks (related_module 'performance').
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { recordInSessionScope, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { assertEmployeeAccess, hasHrRole } from "@/lib/services/hr-api";
import { createTask } from "@/lib/user-tasks/service";

export type KpiType = "manual" | "task_completion" | "task_on_time" | "attendance_rate";
export type GoalInput = { title: string; kpiType?: KpiType; target?: number | null; actual?: number | null; unit?: string | null; weight?: number; score?: number | null; comments?: string | null };
export type AppraisalAction = "submit" | "acknowledge" | "close" | "cancel" | "reopen" | "refresh_metrics";

const ROUTE = "/dashboard/general-office/performance";
const notFound = () => new ApiClientError("Appraisal not found.", { status: 404, code: "NOT_FOUND" });
const bad = (m: string, code = "VALIDATION") => new ApiClientError(m, { status: 400, code });
const forbidden = (m = "You are not allowed to do this.") => new ApiClientError(m, { status: 403, code: "FORBIDDEN" });
const round2 = (n: number) => Math.round(n * 100) / 100;

export function ratingBand(r: number | null): string | null {
  if (r == null) return null;
  if (r >= 4.5) return "outstanding";
  if (r >= 3.5) return "exceeds";
  if (r >= 2.5) return "meets";
  if (r >= 1.5) return "needs_improvement";
  return "unsatisfactory";
}

/** Weighted overall rating (weights sum to 100); null until every goal is scored. */
export function overallRating(goals: Array<{ weight: number; score: number | null }>): number | null {
  if (!goals.length || goals.some((g) => g.score == null)) return null;
  const w = goals.reduce((a, g) => a + Number(g.weight || 0), 0);
  if (w <= 0) return null;
  return round2(goals.reduce((a, g) => a + Number(g.score) * Number(g.weight || 0), 0) / w);
}

export function periodFor(periodType: "quarterly" | "annual" | "custom", label: string | null, start?: string | null, end?: string | null) {
  if (periodType === "annual") {
    if (!/^\d{4}$/.test(label ?? "")) throw bad("Annual period must be a year, e.g. 2026.");
    return { label: label!, start: `${label}-01-01`, end: `${label}-12-31` };
  }
  if (periodType === "quarterly") {
    const m = /^(\d{4})-Q([1-4])$/.exec(label ?? "");
    if (!m) throw bad("Quarter must look like 2026-Q3.");
    const y = Number(m[1]), q = Number(m[2]);
    const sm = (q - 1) * 3 + 1;
    const endDay = new Date(Date.UTC(y, sm + 2, 0)).getUTCDate();
    return { label: label!, start: `${y}-${String(sm).padStart(2, "0")}-01`, end: `${y}-${String(sm + 2).padStart(2, "0")}-${endDay}` };
  }
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) throw bad("Custom period needs a valid start and end date.");
  return { label: `${start} – ${end}`, start, end };
}

// ── access ──────────────────────────────────────────────────────────────────

type Loaded = Record<string, any> & { employee_user_id: string | null; country_id: string | null; country_branch_id: string | null; city_branch_id: string | null };

async function load(id: string): Promise<Loaded | null> {
  return (((await withReadPg((sql) => sql`
    SELECT a.*, e.user_id AS employee_user_id, e.employee_code
    FROM public.hr_appraisals a JOIN public.employees e ON e.id = a.employee_id
    WHERE a.id = ${id}::uuid AND a.deleted_at IS NULL
  `)) as any[] | null)?.[0] ?? null) as Loaded | null;
}
const isHrInScope = (s: ErpSession, a: Loaded, action: "read" | "write") => hasHrRole(s, action) && recordInSessionScope(s, a);
const isReviewer = (s: ErpSession, a: Loaded) => !!a.reviewer_id && a.reviewer_id === s.userId;
const isEmployee = (s: ErpSession, a: Loaded) => !!a.employee_user_id && a.employee_user_id === s.userId;

async function loadForView(s: ErpSession, id: string) {
  const a = await load(id);
  if (!a || !(isHrInScope(s, a, "read") || isReviewer(s, a) || isEmployee(s, a))) throw notFound();
  return a;
}

async function event(sql: any, appraisalId: string, s: ErpSession, action: string, from: string | null, to: string | null, detail: Record<string, unknown> = {}) {
  await sql`INSERT INTO public.hr_appraisal_events (appraisal_id, action, from_status, to_status, detail, actor_id, actor_name)
            VALUES (${appraisalId}::uuid, ${action}, ${from}, ${to}, ${sql.json(detail as any)}, ${s.userId}::uuid, ${s.fullName ?? null})`;
}

// ── system KPIs (real records only) ─────────────────────────────────────────

export async function computeSystemKpis(employeeId: string, start: string, end: string) {
  return (await withReadPg(async (sql) => {
    const emp = ((await sql`SELECT user_id FROM public.employees WHERE id = ${employeeId}::uuid`) as any[])[0];
    let tasks = { total: 0, completed: 0, onTime: 0 };
    if (emp?.user_id) {
      const t = ((await sql`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE status IN ('completed','verified'))::int AS completed,
               count(*) FILTER (WHERE status IN ('completed','verified') AND completed_at IS NOT NULL AND (due_at IS NULL OR completed_at <= due_at))::int AS on_time
        FROM public.user_tasks
        WHERE deleted_at IS NULL AND status <> 'cancelled' AND assigned_to = ${emp.user_id}::uuid
          AND created_at >= ${start}::date AND created_at < (${end}::date + 1)
      `) as any[])[0];
      tasks = { total: t.total, completed: t.completed, onTime: t.on_time };
    }
    const att = ((await sql`
      SELECT count(*)::int AS recorded,
             count(*) FILTER (WHERE lower(coalesce(status,'')) IN ('present','late','half day','half-day','work from home','wfh'))::int AS present
      FROM public.office_attendance
      WHERE deleted_at IS NULL AND employee_id = ${employeeId}::uuid AND attendance_date BETWEEN ${start}::date AND ${end}::date
    `) as any[])[0];
    return {
      linkedUser: !!emp?.user_id,
      tasks,
      attendance: { recorded: att.recorded as number, present: att.present as number },
      task_completion: tasks.total ? round2((tasks.completed / tasks.total) * 100) : null,
      task_on_time: tasks.completed ? round2((tasks.onTime / tasks.completed) * 100) : null,
      attendance_rate: att.recorded ? round2((att.present / att.recorded) * 100) : null,
    };
  })) as any;
}

async function refreshSystemActuals(sql: any, a: Loaded) {
  const k = await computeSystemKpis(a.employee_id, iso(a.period_start), iso(a.period_end));
  for (const type of ["task_completion", "task_on_time", "attendance_rate"] as const) {
    await sql`UPDATE public.hr_appraisal_goals SET actual = ${k[type]}, actual_source = 'system', actual_computed_at = now(), unit = '%', updated_at = now()
              WHERE appraisal_id = ${a.id}::uuid AND kpi_type = ${type}`;
  }
  return k;
}
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

// ── queries ─────────────────────────────────────────────────────────────────

export async function listAppraisals(s: ErpSession, opts: { periodLabel?: string | null; status?: string | null; mine?: boolean }) {
  const hr = hasHrRole(s, "read") && !opts.mine;
  const scope = sessionSqlScope(s);
  return ((await withReadPg((sql) => sql`
    SELECT a.id, a.appraisal_no, a.employee_id, a.period_type, a.period_label, a.period_start, a.period_end, a.status, a.overall_rating, a.rating_band,
           a.reviewer_id, a.submitted_at, a.acknowledged_at, a.improvement_due, e.employee_code, e.department,
           COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name, p.full_name AS reviewer_name, cb.name AS city_branch_name,
           (SELECT count(*) FROM public.hr_appraisal_goals g WHERE g.appraisal_id = a.id)::int AS goal_count
    FROM public.hr_appraisals a
    JOIN public.employees e ON e.id = a.employee_id
    LEFT JOIN public.customers c ON c.id = e.person_master_id
    LEFT JOIN public.profiles p ON p.id = a.reviewer_id
    LEFT JOIN public.city_branches cb ON cb.id = a.city_branch_id
    WHERE a.deleted_at IS NULL
      AND (${opts.periodLabel ?? null}::text IS NULL OR a.period_label = ${opts.periodLabel ?? null})
      AND (${opts.status ?? null}::text IS NULL OR a.status = ${opts.status ?? null})
      AND (${hr ? sql`${sqlScopeCondition(sql, scope, "a")}` : sql`(a.reviewer_id = ${s.userId}::uuid OR e.user_id = ${s.userId}::uuid)`})
    ORDER BY a.period_end DESC, e.employee_code
    LIMIT 1000
  `)) ?? []) as any[];
}

export async function getAppraisal(s: ErpSession, id: string) {
  const a = await loadForView(s, id);
  const [goals, events, kpis] = await Promise.all([
    withReadPg((sql) => sql`SELECT * FROM public.hr_appraisal_goals WHERE appraisal_id = ${id}::uuid ORDER BY sort_order, created_at`),
    withReadPg((sql) => sql`SELECT * FROM public.hr_appraisal_events WHERE appraisal_id = ${id}::uuid ORDER BY created_at DESC`),
    computeSystemKpis(a.employee_id, iso(a.period_start), iso(a.period_end)),
  ]);
  const emp = ((await withReadPg((sql) => sql`
    SELECT e.employee_code, e.designation, e.department, COALESCE(c.customer_name, c.company_name, e.employee_code) AS name, cb.name AS city_branch_name, p.full_name AS reviewer_name
    FROM public.employees e LEFT JOIN public.customers c ON c.id = e.person_master_id LEFT JOIN public.city_branches cb ON cb.id = e.city_branch_id
    LEFT JOIN public.profiles p ON p.id = ${a.reviewer_id ?? null}::uuid
    WHERE e.id = ${a.employee_id}::uuid`)) as any[] | null)?.[0];
  const { employee_user_id: _u, ...appraisal } = a;
  return {
    appraisal, employee: emp, goals: goals ?? [], events: events ?? [], liveKpis: kpis,
    can: {
      edit: a.status === "draft" && (isHrInScope(s, a, "write") || isReviewer(s, a)),
      submit: a.status === "draft" && (isHrInScope(s, a, "write") || isReviewer(s, a)),
      acknowledge: a.status === "submitted" && isEmployee(s, a),
      close: a.status === "acknowledged" && isHrInScope(s, a, "write"),
      cancel: ["draft", "submitted"].includes(a.status) && isHrInScope(s, a, "write"),
      reopen: a.status === "submitted" && (isHrInScope(s, a, "write") || isReviewer(s, a)),
    },
  };
}

// ── commands ────────────────────────────────────────────────────────────────

export async function createAppraisal(
  s: ErpSession,
  input: { employeeId: string; periodType: "quarterly" | "annual" | "custom"; periodLabel?: string | null; periodStart?: string | null; periodEnd?: string | null; reviewerId?: string | null; goals?: GoalInput[] }
) {
  if (!hasHrRole(s, "write")) throw forbidden("Only HR can open an appraisal.");
  await assertEmployeeAccess(s, input.employeeId);
  const p = periodFor(input.periodType, input.periodLabel ?? null, input.periodStart, input.periodEnd);
  try {
    return await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
      const emp = ((await tx`
        SELECT e.id, e.country_id, e.country_branch_id, e.city_branch_id, e.user_id, m.user_id AS manager_user_id
        FROM public.employees e LEFT JOIN public.employees m ON m.id = e.reporting_manager_id
        WHERE e.id = ${input.employeeId}::uuid AND e.deleted_at IS NULL`) as any[])[0];
      const reviewer = input.reviewerId ?? emp.manager_user_id ?? null;
      if (reviewer && emp.user_id && reviewer === emp.user_id) throw bad("An employee cannot review their own appraisal.");
      const n = ((await tx`SELECT count(*)::int AS n FROM public.hr_appraisals`) as any[])[0].n + 1;
      const no = `APR-${p.start.slice(0, 4)}-${String(n).padStart(5, "0")}`;
      const a = ((await tx`
        INSERT INTO public.hr_appraisals (appraisal_no, employee_id, period_type, period_label, period_start, period_end, reviewer_id, country_id, country_branch_id, city_branch_id, created_by)
        VALUES (${no}, ${input.employeeId}::uuid, ${input.periodType}, ${p.label}, ${p.start}::date, ${p.end}::date, ${reviewer}::uuid,
                ${emp.country_id}::uuid, ${emp.country_branch_id}::uuid, ${emp.city_branch_id}::uuid, ${s.userId}::uuid)
        RETURNING *`) as any[])[0];
      await writeGoals(tx, a.id, input.goals ?? []);
      await refreshSystemActuals(tx, a);
      await event(tx, a.id, s, "created", null, "draft", { period: p.label, reviewer });
      return { id: a.id as string, appraisalNo: no };
    }));
  } catch (e: any) {
    if (String(e?.code) === "23505") throw new ApiClientError("This employee already has an appraisal for this period.", { status: 409, code: "APPRAISAL_EXISTS" });
    throw e;
  }
}

async function writeGoals(tx: any, appraisalId: string, goals: GoalInput[]) {
  await tx`DELETE FROM public.hr_appraisal_goals WHERE appraisal_id = ${appraisalId}::uuid`;
  let i = 0;
  for (const g of goals) {
    const title = (g.title || "").trim();
    if (!title) throw bad("Every goal needs a title.");
    const kpi = g.kpiType ?? "manual";
    const score = g.score == null || (g.score as any) === "" ? null : Number(g.score);
    if (score != null && (score < 1 || score > 5)) throw bad("Scores run from 1 to 5.");
    const weight = Number(g.weight ?? 0);
    if (!(weight >= 0 && weight <= 100)) throw bad("Weights run from 0 to 100.");
    await tx`INSERT INTO public.hr_appraisal_goals (appraisal_id, title, kpi_type, target, actual, unit, weight, score, comments, sort_order, actual_source)
             VALUES (${appraisalId}::uuid, ${title}, ${kpi}, ${g.target ?? null}, ${kpi === "manual" ? g.actual ?? null : null}, ${kpi === "manual" ? g.unit ?? null : "%"},
                     ${weight}, ${score}, ${g.comments ?? null}, ${i++}, ${kpi === "manual" ? "manager" : "system"})`;
  }
}

export async function updateDraft(
  s: ErpSession,
  id: string,
  input: { goals?: GoalInput[]; managerComments?: string | null; strengths?: string | null; improvementPlan?: string | null; improvementDue?: string | null; reviewerId?: string | null }
) {
  const a = await loadForView(s, id);
  if (a.status !== "draft") throw new ApiClientError("Only a draft appraisal can be edited.", { status: 409, code: "NOT_DRAFT" });
  if (!(isHrInScope(s, a, "write") || isReviewer(s, a))) throw forbidden();
  if (input.reviewerId !== undefined && !isHrInScope(s, a, "write")) throw forbidden("Only HR can change the reviewer.");
  if (input.reviewerId && a.employee_user_id && input.reviewerId === a.employee_user_id) throw bad("An employee cannot review their own appraisal.");
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    if (input.goals) await writeGoals(tx, id, input.goals);
    await tx`UPDATE public.hr_appraisals SET
               manager_comments = COALESCE(${input.managerComments ?? null}, manager_comments),
               strengths = COALESCE(${input.strengths ?? null}, strengths),
               improvement_plan = COALESCE(${input.improvementPlan ?? null}, improvement_plan),
               improvement_due = COALESCE(${input.improvementDue ?? null}::date, improvement_due),
               reviewer_id = ${input.reviewerId !== undefined ? sql`${input.reviewerId}::uuid` : sql`reviewer_id`},
               updated_at = now()
             WHERE id = ${id}::uuid`;
    await refreshSystemActuals(tx, a);
    const goals = (await tx`SELECT weight, score FROM public.hr_appraisal_goals WHERE appraisal_id = ${id}::uuid`) as any[];
    const r = overallRating(goals.map((g) => ({ weight: Number(g.weight), score: g.score == null ? null : Number(g.score) })));
    await tx`UPDATE public.hr_appraisals SET overall_rating = ${r}, rating_band = ${ratingBand(r)} WHERE id = ${id}::uuid`;
    await event(tx, id, s, "updated", "draft", "draft", { goals: input.goals?.length ?? null });
  }));
  return { id };
}

export async function act(s: ErpSession, id: string, action: AppraisalAction, input: { employeeComments?: string | null } = {}) {
  const a = await loadForView(s, id);
  if (action === "refresh_metrics") {
    if (a.status !== "draft" || !(isHrInScope(s, a, "write") || isReviewer(s, a))) throw forbidden();
    const k = await withLocalPg((sql) => refreshSystemActuals(sql, a));
    return { id, kpis: k };
  }
  if (action === "submit") {
    if (a.status !== "draft") throw new ApiClientError("Only a draft can be submitted.", { status: 409, code: "BAD_TRANSITION" });
    if (!(isHrInScope(s, a, "write") || isReviewer(s, a))) throw forbidden();
    const goals = ((await withReadPg((sql) => sql`SELECT weight, score FROM public.hr_appraisal_goals WHERE appraisal_id = ${id}::uuid`)) ?? []) as any[];
    if (!goals.length) throw bad("Add at least one goal before submitting.", "NO_GOALS");
    if (goals.some((g) => g.score == null)) throw bad("Score every goal (1–5) before submitting.", "UNSCORED");
    const wsum = goals.reduce((x, g) => x + Number(g.weight), 0);
    if (Math.abs(wsum - 100) > 0.001) throw bad(`Goal weights must add up to 100 (now ${round2(wsum)}).`, "WEIGHTS");
    if (!String(a.manager_comments ?? "").trim()) throw bad("Add the manager's review comments before submitting.", "NO_COMMENTS");
    const r = overallRating(goals.map((g) => ({ weight: Number(g.weight), score: Number(g.score) })))!;
    if (r < 2.5 && (!String(a.improvement_plan ?? "").trim() || !a.improvement_due)) throw bad("A rating below 2.5 needs an improvement plan and a review date.", "NEEDS_PLAN");

    await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
      await refreshSystemActuals(tx, a); // freeze the system actuals at submission
      await tx`UPDATE public.hr_appraisals SET status = 'submitted', submitted_at = now(), overall_rating = ${r}, rating_band = ${ratingBand(r)}, updated_at = now() WHERE id = ${id}::uuid AND status = 'draft'`;
      await event(tx, id, s, "submit", "draft", "submitted", { rating: r, band: ratingBand(r) });
    }));
    // Follow-ups on the EXISTING task system; a failure is recorded, never hidden.
    const followUps: Record<string, unknown> = {};
    const label = `${a.appraisal_no} · ${a.employee_code} · ${a.period_label}`;
    if (a.employee_user_id) {
      try {
        const t = await createTask(s, {
          title: `Acknowledge your performance appraisal ${a.appraisal_no}`, assignedTo: a.employee_user_id, relatedModule: "performance",
          relatedRecordTable: "hr_appraisals", relatedRecordId: id, relatedRecordLabel: label, relatedRoute: `${ROUTE}?appraisal=${id}`,
          priority: "normal", dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        });
        followUps.ackTask = t.taskNo;
        await withReadPg((sql) => sql`UPDATE public.hr_appraisals SET ack_task_id = ${t.id}::uuid WHERE id = ${id}::uuid`);
      } catch (e) { followUps.ackTaskSkipped = (e as Error).message; }
    } else followUps.ackTaskSkipped = "employee has no ERP login";
    const fresh = await load(id);
    if (fresh?.improvement_plan && fresh.improvement_due && (fresh.reviewer_id || s.userId)) {
      try {
        const t = await createTask(s, {
          title: `Improvement plan review — ${a.employee_code} (${a.appraisal_no})`, assignedTo: fresh.reviewer_id ?? s.userId, relatedModule: "performance",
          relatedRecordTable: "hr_appraisals", relatedRecordId: id, relatedRecordLabel: label, relatedRoute: `${ROUTE}?appraisal=${id}`,
          priority: "high", dueAt: `${iso(fresh.improvement_due)}T12:00:00.000Z`, description: String(fresh.improvement_plan).slice(0, 2000),
        });
        followUps.improvementTask = t.taskNo;
        await withReadPg((sql) => sql`UPDATE public.hr_appraisals SET improvement_task_id = ${t.id}::uuid WHERE id = ${id}::uuid`);
      } catch (e) { followUps.improvementTaskSkipped = (e as Error).message; }
    }
    await withLocalPg((sql) => event(sql, id, s, "follow_up", "submitted", "submitted", followUps));
    return { id, status: "submitted", rating: r, band: ratingBand(r), followUps };
  }
  const T: Record<string, { from: string[]; to: string; who: (x: Loaded) => boolean }> = {
    acknowledge: { from: ["submitted"], to: "acknowledged", who: (x) => isEmployee(s, x) },
    close: { from: ["acknowledged"], to: "closed", who: (x) => isHrInScope(s, x, "write") },
    cancel: { from: ["draft", "submitted"], to: "cancelled", who: (x) => isHrInScope(s, x, "write") },
    reopen: { from: ["submitted"], to: "draft", who: (x) => isHrInScope(s, x, "write") || isReviewer(s, x) },
  };
  const t = T[action];
  if (!t) throw bad("Unknown action.");
  if (!t.from.includes(a.status)) throw new ApiClientError(`A '${a.status}' appraisal cannot be moved to '${t.to}'.`, { status: 409, code: "BAD_TRANSITION" });
  if (!t.who(a)) throw forbidden(action === "acknowledge" ? "Only the employee can acknowledge their appraisal." : undefined);
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    const u = (await tx`
      UPDATE public.hr_appraisals SET status = ${t.to}, updated_at = now(),
        acknowledged_at = CASE WHEN ${action} = 'acknowledge' THEN now() ELSE acknowledged_at END,
        acknowledged_by = CASE WHEN ${action} = 'acknowledge' THEN ${s.userId}::uuid ELSE acknowledged_by END,
        employee_comments = CASE WHEN ${action} = 'acknowledge' THEN ${input.employeeComments ?? null} ELSE employee_comments END,
        closed_at = CASE WHEN ${action} = 'close' THEN now() ELSE closed_at END,
        submitted_at = CASE WHEN ${action} = 'reopen' THEN NULL ELSE submitted_at END
      WHERE id = ${id}::uuid AND status = ${a.status} RETURNING id`) as any[];
    if (!u.length) throw new ApiClientError("The appraisal changed meanwhile — reload and try again.", { status: 409, code: "CONFLICT" });
    await event(tx, id, s, action, a.status, t.to, input.employeeComments ? { employeeComments: input.employeeComments } : {});
  }));
  return { id, status: t.to };
}

/** Quarterly / annual report: real appraisals in scope for one period label. */
export async function appraisalReport(s: ErpSession, periodLabel: string | null) {
  if (!hasHrRole(s, "read")) throw forbidden();
  const rows = await listAppraisals(s, { periodLabel });
  const live = rows.filter((r) => r.status !== "cancelled");
  const rated = live.filter((r) => r.overall_rating != null && r.status !== "draft");
  const byBand: Record<string, number> = {};
  for (const r of rated) byBand[r.rating_band] = (byBand[r.rating_band] ?? 0) + 1;
  const byDept = new Map<string, { n: number; sum: number }>();
  for (const r of rated) {
    const k = r.department || "—";
    const v = byDept.get(k) ?? { n: 0, sum: 0 };
    v.n++; v.sum += Number(r.overall_rating);
    byDept.set(k, v);
  }
  return {
    periodLabel,
    totals: {
      appraisals: live.length,
      draft: live.filter((r) => r.status === "draft").length,
      submitted: live.filter((r) => r.status === "submitted").length,
      acknowledged: live.filter((r) => r.status === "acknowledged").length,
      closed: live.filter((r) => r.status === "closed").length,
      averageRating: rated.length ? round2(rated.reduce((a, r) => a + Number(r.overall_rating), 0) / rated.length) : null,
    },
    byBand,
    byDepartment: [...byDept.entries()].map(([department, v]) => ({ department, count: v.n, averageRating: round2(v.sum / v.n) })).sort((x, y) => y.averageRating - x.averageRating),
    rows,
  };
}
