import { withLocalPg } from "@/lib/db/local-postgres";
import type { HrScope } from "@/lib/services/hr-api";

/**
 * HRM employment-history / lifecycle service.
 *
 * All history rows are append-only. `apply*` writes the approved change onto the
 * live `employees` row inside a single transaction and stamps `applied_at`.
 * Corrections are new rows, never edits. Scope is repeated in every WHERE.
 */

function empScopeWhere(sql: any, scope: HrScope, alias = "x") {
  if (scope.countryIds === null) return sql`TRUE`;
  return sql`(${sql(alias + ".country_id")} = ANY(${scope.countryIds}) OR ${sql(alias + ".country_id")} IS NULL)`;
}

async function assertEmployeeInScope(employeeId: string, scope: HrScope) {
  if (scope.countryIds === null) return;
  const ok = await withLocalPg(async (sql) => {
    const r = await sql`SELECT 1 FROM public.employees e
      WHERE e.id = ${employeeId} AND e.deleted_at IS NULL
        AND (e.country_id = ANY(${scope.countryIds}) OR e.country_id IS NULL) LIMIT 1`;
    return (r?.length ?? 0) > 0;
  });
  if (!ok) throw new Error("Employee not found in your scope.");
}

export type PositionEventInput = {
  employeeId: string;
  eventType: "promotion" | "demotion" | "salary_revision" | "confirmation" | "probation_extension" | "role_change";
  effectiveDate: string;
  newDesignation?: string | null;
  newDesignationId?: string | null;
  newDepartment?: string | null;
  newBasicSalary?: number | null;
  newMonthlySalary?: number | null;
  salaryCurrency?: string | null;
  reason?: string | null;
  referenceNo?: string | null;
};

export type TransferInput = {
  employeeId: string;
  transferType: "country" | "main_branch" | "city_branch" | "department" | "manager";
  effectiveDate: string;
  newCountryId?: string | null;
  newCountryBranchId?: string | null;
  newCityBranchId?: string | null;
  newDepartment?: string | null;
  newManagerId?: string | null;
  reason?: string | null;
  referenceNo?: string | null;
};

export type SeparationInput = {
  employeeId: string;
  separationType: "resignation" | "termination" | "end_of_contract" | "retirement" | "absconding" | "death" | "redundancy";
  noticeDate?: string | null;
  lastWorkingDate: string;
  reason?: string | null;
  rehireEligible?: boolean;
  exitNotes?: string | null;
  referenceNo?: string | null;
};

export class HrLifecycleService {
  async timeline(employeeId: string, scope: HrScope) {
    await assertEmployeeInScope(employeeId, scope);
    const rows = await withLocalPg(async (sql) =>
      sql`SELECT * FROM public.hr_employee_lifecycle_v WHERE employee_id = ${employeeId} ORDER BY effective_date DESC, created_at DESC`,
    );
    return rows ?? [];
  }

  async listPositionEvents(scope: HrScope, filters: { status?: string; eventType?: string; fromDate?: string; toDate?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [empScopeWhere(sql, scope)];
      if (filters.status) where.push(sql`x.status = ${filters.status}`);
      if (filters.eventType) where.push(sql`x.event_type = ${filters.eventType}`);
      if (filters.fromDate) where.push(sql`x.effective_date >= ${filters.fromDate}`);
      if (filters.toDate) where.push(sql`x.effective_date <= ${filters.toDate}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT x.*, e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
        FROM public.hr_employee_position_events x
        JOIN public.employees e ON e.id = x.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE x.deleted_at IS NULL AND ${w}
        ORDER BY x.effective_date DESC, x.created_at DESC`;
    });
    return rows ?? [];
  }

  async listTransfers(scope: HrScope, filters: { status?: string; transferType?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [
        scope.countryIds === null ? sql`TRUE` : sql`(x.new_country_id = ANY(${scope.countryIds}) OR x.prev_country_id = ANY(${scope.countryIds}))`,
      ];
      if (filters.status) where.push(sql`x.status = ${filters.status}`);
      if (filters.transferType) where.push(sql`x.transfer_type = ${filters.transferType}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT x.*, e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
        FROM public.hr_employee_transfers x
        JOIN public.employees e ON e.id = x.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE x.deleted_at IS NULL AND ${w}
        ORDER BY x.effective_date DESC, x.created_at DESC`;
    });
    return rows ?? [];
  }

  async listSeparations(scope: HrScope, filters: { status?: string; separationType?: string; settlementStatus?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [empScopeWhere(sql, scope)];
      if (filters.status) where.push(sql`x.status = ${filters.status}`);
      if (filters.separationType) where.push(sql`x.separation_type = ${filters.separationType}`);
      if (filters.settlementStatus) where.push(sql`x.settlement_status = ${filters.settlementStatus}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT x.*, e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
        FROM public.hr_employee_separations x
        JOIN public.employees e ON e.id = x.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE x.deleted_at IS NULL AND ${w}
        ORDER BY x.last_working_date DESC, x.created_at DESC`;
    });
    return rows ?? [];
  }

  // ── create ─────────────────────────────────────────────────────────────
  async createPositionEvent(input: PositionEventInput, actorId: string, scope: HrScope) {
    await assertEmployeeInScope(input.employeeId, scope);
    return withLocalPg(async (sql) => {
      const emp = (await sql`SELECT designation, department, basic_salary, monthly_salary, salary_currency, country_id, country_branch_id, city_branch_id
        FROM public.employees WHERE id = ${input.employeeId}`)?.[0];
      const rows = await sql`
        INSERT INTO public.hr_employee_position_events
          (employee_id, event_type, effective_date, prev_designation, new_designation, new_designation_id,
           prev_department, new_department, prev_basic_salary, new_basic_salary, prev_monthly_salary, new_monthly_salary,
           salary_currency, reason, reference_no, country_id, country_branch_id, city_branch_id, created_by)
        VALUES
          (${input.employeeId}, ${input.eventType}, ${input.effectiveDate},
           ${emp?.designation ?? null}, ${input.newDesignation ?? null}, ${input.newDesignationId ?? null},
           ${emp?.department ?? null}, ${input.newDepartment ?? null},
           ${emp?.basic_salary ?? null}, ${input.newBasicSalary ?? null},
           ${emp?.monthly_salary ?? null}, ${input.newMonthlySalary ?? null},
           ${input.salaryCurrency ?? emp?.salary_currency ?? null}, ${input.reason ?? null}, ${input.referenceNo ?? null},
           ${emp?.country_id ?? null}, ${emp?.country_branch_id ?? null}, ${emp?.city_branch_id ?? null}, ${actorId})
        RETURNING id`;
      return rows?.[0] ?? null;
    });
  }

  async createTransfer(input: TransferInput, actorId: string, scope: HrScope) {
    await assertEmployeeInScope(input.employeeId, scope);
    return withLocalPg(async (sql) => {
      const emp = (await sql`SELECT country_id, country_branch_id, city_branch_id, department, reporting_manager_id
        FROM public.employees WHERE id = ${input.employeeId}`)?.[0];
      const rows = await sql`
        INSERT INTO public.hr_employee_transfers
          (employee_id, transfer_type, effective_date,
           prev_country_id, new_country_id, prev_country_branch_id, new_country_branch_id,
           prev_city_branch_id, new_city_branch_id, prev_department, new_department,
           prev_manager_id, new_manager_id, reason, reference_no, created_by)
        VALUES
          (${input.employeeId}, ${input.transferType}, ${input.effectiveDate},
           ${emp?.country_id ?? null}, ${input.newCountryId ?? null},
           ${emp?.country_branch_id ?? null}, ${input.newCountryBranchId ?? null},
           ${emp?.city_branch_id ?? null}, ${input.newCityBranchId ?? null},
           ${emp?.department ?? null}, ${input.newDepartment ?? null},
           ${emp?.reporting_manager_id ?? null}, ${input.newManagerId ?? null},
           ${input.reason ?? null}, ${input.referenceNo ?? null}, ${actorId})
        RETURNING id`;
      return rows?.[0] ?? null;
    });
  }

  async createSeparation(input: SeparationInput, actorId: string, scope: HrScope) {
    await assertEmployeeInScope(input.employeeId, scope);
    return withLocalPg(async (sql) => {
      const emp = (await sql`SELECT country_id, country_branch_id, city_branch_id FROM public.employees WHERE id = ${input.employeeId}`)?.[0];
      const rows = await sql`
        INSERT INTO public.hr_employee_separations
          (employee_id, separation_type, notice_date, last_working_date, reason, rehire_eligible,
           exit_notes, reference_no, country_id, country_branch_id, city_branch_id, created_by)
        VALUES
          (${input.employeeId}, ${input.separationType}, ${input.noticeDate ?? null}, ${input.lastWorkingDate},
           ${input.reason ?? null}, ${input.rehireEligible ?? true}, ${input.exitNotes ?? null}, ${input.referenceNo ?? null},
           ${emp?.country_id ?? null}, ${emp?.country_branch_id ?? null}, ${emp?.city_branch_id ?? null}, ${actorId})
        RETURNING id`;
      return rows?.[0] ?? null;
    });
  }

  // ── approve + apply ────────────────────────────────────────────────────
  async setStatus(
    table: "position" | "transfer" | "separation",
    id: string,
    status: "approved" | "rejected" | "cancelled",
    actorId: string,
    scope: HrScope,
  ) {
    const tbl =
      table === "position" ? "hr_employee_position_events" : table === "transfer" ? "hr_employee_transfers" : "hr_employee_separations";
    return withLocalPg(async (sql) => {
      const row = (await sql`SELECT * FROM ${sql(tbl)} WHERE id = ${id} AND deleted_at IS NULL`)?.[0];
      if (!row) throw new Error("Record not found.");
      await assertEmployeeInScope(row.employee_id, scope);
      if (row.status === "applied") throw new Error("Already applied — use a correcting record instead.");
      await sql`UPDATE ${sql(tbl)} SET status = ${status}, approved_by = ${actorId}, approved_at = now(), updated_at = now() WHERE id = ${id}`;
      return { id, status };
    });
  }

  /** Apply an approved event: write it onto the live employees row + stamp applied_at. Idempotent. */
  async apply(table: "position" | "transfer" | "separation", id: string, actorId: string, scope: HrScope) {
    return withLocalPg(async (sql) => {
      await sql`BEGIN`;
      try {
        if (table === "position") {
          const r = (await sql`SELECT * FROM public.hr_employee_position_events WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`)?.[0];
          if (!r) throw new Error("Record not found.");
          await assertEmployeeInScope(r.employee_id, scope);
          if (r.status === "applied") { await sql`ROLLBACK`; return { id, alreadyApplied: true }; }
          if (r.status !== "approved") throw new Error("Event must be approved before it can be applied.");
          await sql`
            UPDATE public.employees SET
              designation = COALESCE(${r.new_designation}, designation),
              hr_designation_id = COALESCE(${r.new_designation_id}, hr_designation_id),
              department = COALESCE(${r.new_department}, department),
              basic_salary = COALESCE(${r.new_basic_salary}, basic_salary),
              monthly_salary = COALESCE(${r.new_monthly_salary}, monthly_salary),
              salary_currency = COALESCE(${r.salary_currency}, salary_currency),
              updated_at = now()
            WHERE id = ${r.employee_id}`;
        } else if (table === "transfer") {
          const r = (await sql`SELECT * FROM public.hr_employee_transfers WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`)?.[0];
          if (!r) throw new Error("Record not found.");
          await assertEmployeeInScope(r.employee_id, scope);
          if (r.status === "applied") { await sql`ROLLBACK`; return { id, alreadyApplied: true }; }
          if (r.status !== "approved") throw new Error("Transfer must be approved before it can be applied.");
          await sql`
            UPDATE public.employees SET
              country_id = COALESCE(${r.new_country_id}, country_id),
              country_branch_id = COALESCE(${r.new_country_branch_id}, country_branch_id),
              city_branch_id = COALESCE(${r.new_city_branch_id}, city_branch_id),
              department = COALESCE(${r.new_department}, department),
              reporting_manager_id = COALESCE(${r.new_manager_id}, reporting_manager_id),
              updated_at = now()
            WHERE id = ${r.employee_id}`;
        } else {
          const r = (await sql`SELECT * FROM public.hr_employee_separations WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`)?.[0];
          if (!r) throw new Error("Record not found.");
          await assertEmployeeInScope(r.employee_id, scope);
          if (r.status === "applied") { await sql`ROLLBACK`; return { id, alreadyApplied: true }; }
          if (r.status !== "approved") throw new Error("Separation must be approved before it can be applied.");
          await sql`
            UPDATE public.employees SET
              status = 'Inactive',
              job_status = ${r.separation_type},
              contract_end_date = COALESCE(contract_end_date, ${r.last_working_date}),
              updated_at = now()
            WHERE id = ${r.employee_id}`;
        }
        const tbl =
          table === "position" ? "hr_employee_position_events" : table === "transfer" ? "hr_employee_transfers" : "hr_employee_separations";
        await sql`UPDATE ${sql(tbl)} SET status = 'applied', applied_at = now(), updated_at = now() WHERE id = ${id}`;
        await sql`COMMIT`;
        return { id, applied: true };
      } catch (e) {
        await sql`ROLLBACK`;
        throw e;
      }
    });
  }
}

export const hrLifecycleService = new HrLifecycleService();
