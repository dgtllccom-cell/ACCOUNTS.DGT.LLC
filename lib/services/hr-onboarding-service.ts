import { withLocalPg } from "@/lib/db/local-postgres";
import type { HrScope } from "@/lib/services/hr-api";

/** HRM Phase 10 — onboarding / offboarding checklists. Scope repeated in WHERE. */

async function assertEmployeeInScope(sql: any, employeeId: string, scope: HrScope) {
  if (scope.countryIds === null) return;
  const r = await sql`SELECT 1 FROM public.employees e WHERE e.id = ${employeeId} AND e.deleted_at IS NULL
    AND (e.country_id = ANY(${scope.countryIds}) OR e.country_id IS NULL) LIMIT 1`;
  if (!r?.length) throw new Error("Employee not found in your scope.");
}

export class HrOnboardingService {
  async list(scope: HrScope, filters: { phase?: string; employeeId?: string; status?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [scope.countryIds === null ? sql`TRUE` : sql`(ec.country_id = ANY(${scope.countryIds}) OR ec.country_id IS NULL)`];
      if (filters.phase) where.push(sql`ec.phase = ${filters.phase}`);
      if (filters.employeeId) where.push(sql`ec.employee_id = ${filters.employeeId}`);
      if (filters.status) where.push(sql`ec.status = ${filters.status}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT * FROM public.hr_employee_checklist_v ec WHERE ${w}
        ORDER BY employee_name, phase, category, task_name`;
    });
    return rows ?? [];
  }

  /** Progress summary per employee+phase. */
  async summary(scope: HrScope, phase?: string) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [scope.countryIds === null ? sql`TRUE` : sql`(ec.country_id = ANY(${scope.countryIds}) OR ec.country_id IS NULL)`];
      if (phase) where.push(sql`ec.phase = ${phase}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT ec.employee_id, ec.employee_code, ec.employee_name, ec.phase, ec.country_name,
               count(*)::int AS total,
               count(*) FILTER (WHERE ec.status IN ('done','not_applicable'))::int AS done,
               count(*) FILTER (WHERE ec.is_mandatory AND ec.status = 'pending')::int AS pending_mandatory
        FROM public.hr_employee_checklist_v ec WHERE ${w}
        GROUP BY ec.employee_id, ec.employee_code, ec.employee_name, ec.phase, ec.country_name
        ORDER BY ec.employee_name`;
    });
    return rows ?? [];
  }

  async seed(employeeId: string, phase: "onboarding" | "offboarding", actorId: string, scope: HrScope) {
    return withLocalPg(async (sql) => {
      await assertEmployeeInScope(sql, employeeId, scope);
      const r = await sql`SELECT public.hr_seed_employee_checklist(${employeeId}, ${phase}, ${actorId}) AS n`;
      return { created: Number(r?.[0]?.n ?? 0) };
    });
  }

  async updateTask(id: string, patch: { status?: string; notes?: string | null; dueDate?: string | null }, actorId: string, scope: HrScope) {
    return withLocalPg(async (sql) => {
      const row = (await sql`SELECT * FROM public.hr_employee_checklist WHERE id = ${id} AND deleted_at IS NULL`)?.[0];
      if (!row) throw new Error("Task not found.");
      await assertEmployeeInScope(sql, row.employee_id, scope);
      const done = patch.status === "done" || patch.status === "not_applicable";
      await sql`UPDATE public.hr_employee_checklist SET
        status = COALESCE(${patch.status ?? null}, status),
        notes = ${patch.notes === undefined ? sql`notes` : patch.notes},
        due_date = ${patch.dueDate === undefined ? sql`due_date` : patch.dueDate},
        done_by = ${done ? actorId : null},
        done_at = ${done ? sql`now()` : null},
        updated_at = now()
        WHERE id = ${id}`;
      return { id };
    });
  }
}

export const hrOnboardingService = new HrOnboardingService();
