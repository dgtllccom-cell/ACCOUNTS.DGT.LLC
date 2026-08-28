import { withLocalPg } from "@/lib/db/local-postgres";
import type { HrScope } from "@/lib/services/hr-api";

/**
 * HRM masters service — Departments & Designations.
 *
 * Reads the localised views `hr_departments_v` / `hr_designations_v` and writes
 * `hr_departments` / `hr_designations`. Geographic scope is repeated in every
 * WHERE (withLocalPg bypasses RLS). `scope.countryIds === null` = global.
 *
 * The free-text `employees.department` / `employees.designation` columns are
 * never touched here — the masters are additive.
 */

function deptScopeWhere(sql: any, scope?: HrScope) {
  if (!scope || scope.countryIds === null) return sql`TRUE`;
  return sql`(d.country_id = ANY(${scope.countryIds}) OR d.country_id IS NULL)`;
}
function desigScopeWhere(sql: any, scope?: HrScope) {
  if (!scope || scope.countryIds === null) return sql`TRUE`;
  return sql`(g.country_id = ANY(${scope.countryIds}) OR g.country_id IS NULL)`;
}

export type DepartmentInput = {
  code?: string;
  name: string;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  headEmployeeId?: string | null;
  parentDepartmentId?: string | null;
  monthlyBudget?: number | null;
  budgetCurrency?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export type DesignationInput = {
  code?: string;
  title: string;
  departmentId?: string | null;
  countryId?: string | null;
  payGrade?: string | null;
  minBasicSalary?: number | null;
  maxBasicSalary?: number | null;
  salaryCurrency?: string | null;
  rankOrder?: number | null;
  description?: string | null;
  isActive?: boolean;
};

function slugCode(s: string): string {
  return (s || "")
    .trim()
    .slice(0, 14)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase() || "DEPT";
}

export class HrMastersService {
  // ── Departments ────────────────────────────────────────────────────────
  async listDepartments(scope: HrScope, opts: { search?: string; activeOnly?: boolean } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [deptScopeWhere(sql, scope)];
      if (opts.search) where.push(sql`(d.name ILIKE ${"%" + opts.search + "%"} OR d.code ILIKE ${"%" + opts.search + "%"})`);
      if (opts.activeOnly) where.push(sql`d.is_active = true`);
      const whereSql = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT d.* FROM public.hr_departments_v d WHERE ${whereSql} ORDER BY d.name ASC`;
    });
    return rows ?? [];
  }

  async createDepartment(input: DepartmentInput, actorId: string | null, scope: HrScope) {
    if (scope.countryIds && input.countryId && !scope.countryIds.includes(input.countryId)) {
      throw new Error("Country is outside your assigned scope.");
    }
    const res = await withLocalPg(async (sql) => {
      const rows = await sql`
        INSERT INTO public.hr_departments
          (code, name, country_id, country_branch_id, city_branch_id, head_employee_id,
           parent_department_id, monthly_budget, budget_currency, description, is_active, created_by, updated_by)
        VALUES
          (${input.code?.trim() || slugCode(input.name)}, ${input.name.trim()},
           ${input.countryId ?? null}, ${input.countryBranchId ?? null}, ${input.cityBranchId ?? null},
           ${input.headEmployeeId ?? null}, ${input.parentDepartmentId ?? null},
           ${input.monthlyBudget ?? 0}, ${input.budgetCurrency ?? "USD"}, ${input.description ?? null},
           ${input.isActive ?? true}, ${actorId}, ${actorId})
        RETURNING id`;
      return rows?.[0] ?? null;
    });
    return res;
  }

  async updateDepartment(id: string, input: Partial<DepartmentInput>, actorId: string | null, scope: HrScope) {
    await this.assertDepartmentInScope(id, scope);
    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.hr_departments SET
          code = COALESCE(${input.code ?? null}, code),
          name = COALESCE(${input.name ?? null}, name),
          country_id = ${input.countryId === undefined ? sql`country_id` : input.countryId},
          country_branch_id = ${input.countryBranchId === undefined ? sql`country_branch_id` : input.countryBranchId},
          city_branch_id = ${input.cityBranchId === undefined ? sql`city_branch_id` : input.cityBranchId},
          head_employee_id = ${input.headEmployeeId === undefined ? sql`head_employee_id` : input.headEmployeeId},
          parent_department_id = ${input.parentDepartmentId === undefined ? sql`parent_department_id` : input.parentDepartmentId},
          monthly_budget = COALESCE(${input.monthlyBudget ?? null}, monthly_budget),
          budget_currency = COALESCE(${input.budgetCurrency ?? null}, budget_currency),
          description = ${input.description === undefined ? sql`description` : input.description},
          is_active = COALESCE(${input.isActive ?? null}, is_active),
          updated_by = ${actorId},
          updated_at = now()
        WHERE id = ${id} AND deleted_at IS NULL`;
    });
    return { id };
  }

  async deleteDepartment(id: string, actorId: string | null, scope: HrScope) {
    await this.assertDepartmentInScope(id, scope);
    const inUse = await withLocalPg(async (sql) => {
      const r = await sql`SELECT count(*)::int n FROM public.employees WHERE hr_department_id = ${id} AND deleted_at IS NULL`;
      return r?.[0]?.n ?? 0;
    });
    if (inUse > 0) throw new Error(`Cannot delete: ${inUse} employee(s) are still assigned to this department.`);
    await withLocalPg(async (sql) => {
      await sql`UPDATE public.hr_departments SET deleted_at = now(), updated_by = ${actorId} WHERE id = ${id}`;
    });
    return { id };
  }

  private async assertDepartmentInScope(id: string, scope: HrScope) {
    if (scope.countryIds === null) return;
    const ok = await withLocalPg(async (sql) => {
      const r = await sql`SELECT 1 FROM public.hr_departments d
        WHERE d.id = ${id} AND d.deleted_at IS NULL AND (d.country_id = ANY(${scope.countryIds}) OR d.country_id IS NULL) LIMIT 1`;
      return (r?.length ?? 0) > 0;
    });
    if (!ok) throw new Error("Department not found in your scope.");
  }

  // ── Designations ───────────────────────────────────────────────────────
  async listDesignations(scope: HrScope, opts: { search?: string; departmentId?: string; activeOnly?: boolean } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [desigScopeWhere(sql, scope)];
      if (opts.search) where.push(sql`(g.title ILIKE ${"%" + opts.search + "%"} OR g.code ILIKE ${"%" + opts.search + "%"})`);
      if (opts.departmentId) where.push(sql`g.department_id = ${opts.departmentId}`);
      if (opts.activeOnly) where.push(sql`g.is_active = true`);
      const whereSql = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT g.* FROM public.hr_designations_v g WHERE ${whereSql} ORDER BY g.rank_order ASC, g.title ASC`;
    });
    return rows ?? [];
  }

  async createDesignation(input: DesignationInput, actorId: string | null, scope: HrScope) {
    if (scope.countryIds && input.countryId && !scope.countryIds.includes(input.countryId)) {
      throw new Error("Country is outside your assigned scope.");
    }
    const res = await withLocalPg(async (sql) => {
      const rows = await sql`
        INSERT INTO public.hr_designations
          (code, title, department_id, country_id, pay_grade, min_basic_salary, max_basic_salary,
           salary_currency, rank_order, description, is_active, created_by, updated_by)
        VALUES
          (${input.code?.trim() || slugCode(input.title)}, ${input.title.trim()},
           ${input.departmentId ?? null}, ${input.countryId ?? null}, ${input.payGrade ?? null},
           ${input.minBasicSalary ?? 0}, ${input.maxBasicSalary ?? 0}, ${input.salaryCurrency ?? "USD"},
           ${input.rankOrder ?? 0}, ${input.description ?? null}, ${input.isActive ?? true}, ${actorId}, ${actorId})
        RETURNING id`;
      return rows?.[0] ?? null;
    });
    return res;
  }

  async updateDesignation(id: string, input: Partial<DesignationInput>, actorId: string | null, scope: HrScope) {
    await this.assertDesignationInScope(id, scope);
    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.hr_designations SET
          code = COALESCE(${input.code ?? null}, code),
          title = COALESCE(${input.title ?? null}, title),
          department_id = ${input.departmentId === undefined ? sql`department_id` : input.departmentId},
          country_id = ${input.countryId === undefined ? sql`country_id` : input.countryId},
          pay_grade = ${input.payGrade === undefined ? sql`pay_grade` : input.payGrade},
          min_basic_salary = COALESCE(${input.minBasicSalary ?? null}, min_basic_salary),
          max_basic_salary = COALESCE(${input.maxBasicSalary ?? null}, max_basic_salary),
          salary_currency = COALESCE(${input.salaryCurrency ?? null}, salary_currency),
          rank_order = COALESCE(${input.rankOrder ?? null}, rank_order),
          description = ${input.description === undefined ? sql`description` : input.description},
          is_active = COALESCE(${input.isActive ?? null}, is_active),
          updated_by = ${actorId},
          updated_at = now()
        WHERE id = ${id} AND deleted_at IS NULL`;
    });
    return { id };
  }

  async deleteDesignation(id: string, actorId: string | null, scope: HrScope) {
    await this.assertDesignationInScope(id, scope);
    const inUse = await withLocalPg(async (sql) => {
      const r = await sql`SELECT count(*)::int n FROM public.employees WHERE hr_designation_id = ${id} AND deleted_at IS NULL`;
      return r?.[0]?.n ?? 0;
    });
    if (inUse > 0) throw new Error(`Cannot delete: ${inUse} employee(s) still hold this designation.`);
    await withLocalPg(async (sql) => {
      await sql`UPDATE public.hr_designations SET deleted_at = now(), updated_by = ${actorId} WHERE id = ${id}`;
    });
    return { id };
  }

  private async assertDesignationInScope(id: string, scope: HrScope) {
    if (scope.countryIds === null) return;
    const ok = await withLocalPg(async (sql) => {
      const r = await sql`SELECT 1 FROM public.hr_designations g
        WHERE g.id = ${id} AND g.deleted_at IS NULL AND (g.country_id = ANY(${scope.countryIds}) OR g.country_id IS NULL) LIMIT 1`;
      return (r?.length ?? 0) > 0;
    });
    if (!ok) throw new Error("Designation not found in your scope.");
  }
}

export const hrMastersService = new HrMastersService();
