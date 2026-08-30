import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { resolveReportScope } from "@/lib/permissions/middleware";
import type { TaskStatus, TaskTransition, UserTaskRow } from "./types";

/**
 * USER TASKS access model — enforced SERVER-SIDE on every read and mutation.
 *
 *  - super_admin ......... manage (assign / verify / edit / cancel / reassign) any task,
 *                          review every user's performance, see the whole audit trail.
 *  - country_admin /
 *    main_branch_admin ... manage tasks whose scope country is one of theirs; assign to
 *                          any user with an active assignment in that country.
 *  - city_branch_admin ... manage tasks whose scope city/country-branch is one of theirs;
 *                          assign to users assigned to that branch.
 *  - everybody else ...... only their own tasks (assigned_to = them); may run the
 *                          assignee-side workflow (accept/start/hold/complete) and attach
 *                          evidence, but cannot assign or verify.
 */

const MANAGER_ROLES = new Set(["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]);

export type TaskManagerScope = {
  isManager: boolean;
  level: "global" | "country" | "branch";
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  countryIds: string[];
  countryBranchIds: string[];
  cityBranchIds: string[];
};

export function canManageTasks(session: ErpSession): boolean {
  return session.isSuperAdmin || session.roles.some((r) => MANAGER_ROLES.has(r));
}

export function taskManagerScope(session: ErpSession): TaskManagerScope {
  const rs = resolveReportScope(session);
  return {
    isManager: canManageTasks(session),
    level: rs.level === "global" ? "global" : rs.level === "country" ? "country" : "branch",
    countryId: rs.countryId,
    countryBranchId: rs.countryBranchId,
    cityBranchId: rs.branchId,
    countryIds: session.isSuperAdmin ? [] : session.countryIds,
    countryBranchIds: session.isSuperAdmin ? [] : session.countryBranchIds,
    cityBranchIds: session.isSuperAdmin ? [] : session.cityBranchIds,
  };
}

/** The set of user ids `session` is allowed to assign a task to. */
export async function assignableUserIds(session: ErpSession): Promise<
  { userId: string; name: string | null; role: string; countryId: string | null; countryBranchId: string | null; cityBranchId: string | null }[]
> {
  if (!canManageTasks(session)) return [];
  const scope = taskManagerScope(session);
  const rows = await withLocalPg(async (sql) => {
    return (await sql`
      select ura.user_id,
             p.full_name as name,
             ura.role,
             ura.country_id,
             ura.country_branch_id,
             ura.city_branch_id
      from public.user_role_assignments ura
      join public.profiles p on p.id = ura.user_id
      where ura.is_active = true
        and ura.deleted_at is null
        and p.deleted_at is null
      order by p.full_name asc nulls last
    `) as unknown as any[];
  });
  const all = (rows ?? []) as any[];
  if (session.isSuperAdmin || scope.level === "global") {
    return dedupeUsers(all);
  }
  if (scope.level === "country") {
    const allowed = new Set(scope.countryIds.length ? scope.countryIds : [scope.countryId].filter(Boolean) as string[]);
    return dedupeUsers(all.filter((r) => r.country_id && allowed.has(r.country_id)));
  }
  // branch level
  const cb = new Set(scope.countryBranchIds.length ? scope.countryBranchIds : [scope.countryBranchId].filter(Boolean) as string[]);
  const city = new Set(scope.cityBranchIds.length ? scope.cityBranchIds : [scope.cityBranchId].filter(Boolean) as string[]);
  return dedupeUsers(
    all.filter((r) => (r.city_branch_id && city.has(r.city_branch_id)) || (r.country_branch_id && cb.has(r.country_branch_id)))
  );
}

function dedupeUsers(rows: any[]) {
  const seen = new Map<string, any>();
  for (const r of rows) {
    if (!seen.has(r.user_id)) {
      seen.set(r.user_id, {
        userId: r.user_id,
        name: r.name ?? null,
        role: r.role,
        countryId: r.country_id ?? null,
        countryBranchId: r.country_branch_id ?? null,
        cityBranchId: r.city_branch_id ?? null,
      });
    }
  }
  return [...seen.values()];
}

export async function canAssignTo(session: ErpSession, assigneeId: string): Promise<boolean> {
  if (session.isSuperAdmin) return canManageTasks(session);
  const list = await assignableUserIds(session);
  return list.some((u) => u.userId === assigneeId);
}

/** Is `session` a manager for THIS task (created it, or its scope is within their reach)? */
export function isTaskManager(session: ErpSession, task: Pick<UserTaskRow, "created_by" | "country_id" | "country_branch_id" | "city_branch_id">): boolean {
  if (session.isSuperAdmin) return true;
  if (task.created_by === session.userId && canManageTasks(session)) return true;
  if (!canManageTasks(session)) return false;
  const scope = taskManagerScope(session);
  if (scope.level === "global") return true;
  if (scope.level === "country") {
    const allowed = new Set(scope.countryIds);
    return Boolean(task.country_id && allowed.has(task.country_id));
  }
  const cb = new Set(scope.countryBranchIds);
  const city = new Set(scope.cityBranchIds);
  return Boolean((task.city_branch_id && city.has(task.city_branch_id)) || (task.country_branch_id && cb.has(task.country_branch_id)));
}

export function canViewTask(session: ErpSession, task: UserTaskRow): boolean {
  if (task.assigned_to === session.userId) return true;
  if (task.created_by === session.userId) return true;
  return isTaskManager(session, task);
}

/**
 * Which workflow transitions `session` may perform on `task` right now.
 * Assignee runs the left side of the workflow; a manager verifies / returns / cancels / reassigns.
 */
export function allowedTransitions(session: ErpSession, task: UserTaskRow): TaskTransition[] {
  const isAssignee = task.assigned_to === session.userId;
  const isManager = isTaskManager(session, task);
  const s: TaskStatus = task.status;
  const out = new Set<TaskTransition>();

  if (isAssignee) {
    if (s === "new" || s === "returned") out.add("accept");
    if (s === "accepted" || s === "waiting") out.add("start");
    if (s === "in_progress") { out.add("hold"); out.add("complete"); }
    if (s === "waiting") out.add("resume");
  }
  if (isManager) {
    if (s === "completed") { out.add("verify"); out.add("return"); }
    if (s === "verified") out.add("reopen");
    if (s !== "verified" && s !== "cancelled") out.add("cancel");
    // a manager can also nudge a stalled task back for rework
    if (s === "in_progress" || s === "waiting" || s === "accepted") out.add("return");
  }
  return [...out];
}

export function transitionResultStatus(action: TaskTransition): TaskStatus | null {
  switch (action) {
    case "accept": return "accepted";
    case "start": return "in_progress";
    case "resume": return "in_progress";
    case "hold": return "waiting";
    case "complete": return "completed";
    case "verify": return "verified";
    case "return": return "returned";
    case "reopen": return "in_progress";
    case "cancel": return "cancelled";
    default: return null;
  }
}
