import { withLocalPg } from "@/lib/db/local-postgres";
import type { HrScope } from "@/lib/services/hr-api";

/**
 * HRM Phase 4 service — shifts, holidays, leave types, leave balances,
 * attendance corrections. Scope repeated in every WHERE (withLocalPg bypasses RLS).
 */

function scopeCol(sql: any, scope: HrScope, col: string) {
  if (scope.countryIds === null) return sql`TRUE`;
  return sql`(${sql(col)} = ANY(${scope.countryIds}) OR ${sql(col)} IS NULL)`;
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

export class HrAttendanceLeaveService {
  // ── leave types ────────────────────────────────────────────────────────
  async listLeaveTypes(scope: HrScope, activeOnly = false) {
    const rows = await withLocalPg(async (sql) => {
      const where = [scopeCol(sql, scope, "country_id")];
      if (activeOnly) where.push(sql`is_active = true`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT * FROM public.hr_leave_types WHERE deleted_at IS NULL AND ${w} ORDER BY rank_order ASC, name ASC`;
    });
    return rows ?? [];
  }

  async upsertLeaveType(input: any, id: string | null, scope: HrScope) {
    if (scope.countryIds && input.countryId && !scope.countryIds.includes(input.countryId)) throw new Error("Country outside your scope.");
    return withLocalPg(async (sql) => {
      if (id) {
        await sql`UPDATE public.hr_leave_types SET
          code = COALESCE(${input.code ?? null}, code),
          name = COALESCE(${input.name ?? null}, name),
          country_id = ${input.countryId === undefined ? sql`country_id` : input.countryId},
          is_paid = COALESCE(${input.isPaid ?? null}, is_paid),
          annual_entitlement_days = COALESCE(${input.annualEntitlementDays ?? null}, annual_entitlement_days),
          accrual_method = COALESCE(${input.accrualMethod ?? null}, accrual_method),
          max_carry_forward_days = COALESCE(${input.maxCarryForwardDays ?? null}, max_carry_forward_days),
          requires_document = COALESCE(${input.requiresDocument ?? null}, requires_document),
          min_notice_days = COALESCE(${input.minNoticeDays ?? null}, min_notice_days),
          is_active = COALESCE(${input.isActive ?? null}, is_active),
          rank_order = COALESCE(${input.rankOrder ?? null}, rank_order),
          updated_at = now()
          WHERE id = ${id} AND deleted_at IS NULL`;
        return { id };
      }
      const r = await sql`INSERT INTO public.hr_leave_types
        (code, name, country_id, is_paid, annual_entitlement_days, accrual_method, max_carry_forward_days, requires_document, min_notice_days, is_active, rank_order)
        VALUES (${input.code}, ${input.name}, ${input.countryId ?? null}, ${input.isPaid ?? true},
          ${input.annualEntitlementDays ?? 0}, ${input.accrualMethod ?? "annual"}, ${input.maxCarryForwardDays ?? 0},
          ${input.requiresDocument ?? false}, ${input.minNoticeDays ?? 0}, ${input.isActive ?? true}, ${input.rankOrder ?? 0})
        RETURNING id`;
      return r?.[0] ?? null;
    });
  }

  async deleteLeaveType(id: string) {
    await withLocalPg(async (sql) => {
      const used = await sql`SELECT 1 FROM public.hr_employee_leave_balances WHERE leave_type_id = ${id} AND deleted_at IS NULL LIMIT 1`;
      if (used?.length) throw new Error("Cannot delete: leave balances reference this type.");
      await sql`UPDATE public.hr_leave_types SET deleted_at = now() WHERE id = ${id}`;
    });
    return { id };
  }

  // ── shifts ─────────────────────────────────────────────────────────────
  async listShifts(scope: HrScope) {
    const rows = await withLocalPg(async (sql) =>
      sql`SELECT s.*, co.name AS country_name FROM public.hr_shifts s
          LEFT JOIN public.countries co ON co.id = s.country_id
          WHERE s.deleted_at IS NULL AND ${scopeCol(sql, scope, "s.country_id")} ORDER BY s.name ASC`,
    );
    return rows ?? [];
  }

  async upsertShift(input: any, id: string | null, actorId: string, scope: HrScope) {
    if (scope.countryIds && input.countryId && !scope.countryIds.includes(input.countryId)) throw new Error("Country outside your scope.");
    return withLocalPg(async (sql) => {
      if (id) {
        await sql`UPDATE public.hr_shifts SET
          code = COALESCE(${input.code ?? null}, code),
          name = COALESCE(${input.name ?? null}, name),
          country_id = ${input.countryId === undefined ? sql`country_id` : input.countryId},
          country_branch_id = ${input.countryBranchId === undefined ? sql`country_branch_id` : input.countryBranchId},
          city_branch_id = ${input.cityBranchId === undefined ? sql`city_branch_id` : input.cityBranchId},
          start_time = COALESCE(${input.startTime ?? null}, start_time),
          end_time = COALESCE(${input.endTime ?? null}, end_time),
          break_minutes = COALESCE(${input.breakMinutes ?? null}, break_minutes),
          grace_minutes = COALESCE(${input.graceMinutes ?? null}, grace_minutes),
          working_days = COALESCE(${input.workingDays ?? null}, working_days),
          is_night_shift = COALESCE(${input.isNightShift ?? null}, is_night_shift),
          is_active = COALESCE(${input.isActive ?? null}, is_active),
          updated_by = ${actorId}, updated_at = now()
          WHERE id = ${id} AND deleted_at IS NULL`;
        return { id };
      }
      const r = await sql`INSERT INTO public.hr_shifts
        (code, name, country_id, country_branch_id, city_branch_id, start_time, end_time, break_minutes, grace_minutes, working_days, is_night_shift, is_active, created_by, updated_by)
        VALUES (${input.code}, ${input.name}, ${input.countryId ?? null}, ${input.countryBranchId ?? null}, ${input.cityBranchId ?? null},
          ${input.startTime ?? "09:00"}, ${input.endTime ?? "18:00"}, ${input.breakMinutes ?? 60}, ${input.graceMinutes ?? 15},
          ${input.workingDays ?? "Mon,Tue,Wed,Thu,Fri"}, ${input.isNightShift ?? false}, ${input.isActive ?? true}, ${actorId}, ${actorId})
        RETURNING id`;
      return r?.[0] ?? null;
    });
  }

  async deleteShift(id: string) {
    await withLocalPg(async (sql) => sql`UPDATE public.hr_shifts SET deleted_at = now() WHERE id = ${id}`);
    return { id };
  }

  // ── holidays ───────────────────────────────────────────────────────────
  async listHolidays(scope: HrScope, opts: { year?: number; countryId?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where = [scopeCol(sql, scope, "h.country_id")];
      if (opts.year) where.push(sql`extract(year from h.holiday_date) = ${opts.year}`);
      if (opts.countryId) where.push(sql`h.country_id = ${opts.countryId}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT h.*, co.name AS country_name FROM public.hr_holidays h
        LEFT JOIN public.countries co ON co.id = h.country_id
        WHERE h.deleted_at IS NULL AND ${w} ORDER BY h.holiday_date ASC`;
    });
    return rows ?? [];
  }

  async upsertHoliday(input: any, id: string | null, actorId: string, scope: HrScope) {
    if (scope.countryIds && input.countryId && !scope.countryIds.includes(input.countryId)) throw new Error("Country outside your scope.");
    return withLocalPg(async (sql) => {
      if (id) {
        await sql`UPDATE public.hr_holidays SET
          name = COALESCE(${input.name ?? null}, name),
          holiday_date = COALESCE(${input.holidayDate ?? null}, holiday_date),
          country_id = ${input.countryId === undefined ? sql`country_id` : input.countryId},
          country_branch_id = ${input.countryBranchId === undefined ? sql`country_branch_id` : input.countryBranchId},
          city_branch_id = ${input.cityBranchId === undefined ? sql`city_branch_id` : input.cityBranchId},
          holiday_type = COALESCE(${input.holidayType ?? null}, holiday_type),
          is_recurring = COALESCE(${input.isRecurring ?? null}, is_recurring),
          is_paid = COALESCE(${input.isPaid ?? null}, is_paid),
          notes = ${input.notes === undefined ? sql`notes` : input.notes},
          updated_at = now()
          WHERE id = ${id} AND deleted_at IS NULL`;
        return { id };
      }
      const r = await sql`INSERT INTO public.hr_holidays
        (name, holiday_date, country_id, country_branch_id, city_branch_id, holiday_type, is_recurring, is_paid, notes, created_by)
        VALUES (${input.name}, ${input.holidayDate}, ${input.countryId ?? null}, ${input.countryBranchId ?? null}, ${input.cityBranchId ?? null},
          ${input.holidayType ?? "public"}, ${input.isRecurring ?? false}, ${input.isPaid ?? true}, ${input.notes ?? null}, ${actorId})
        RETURNING id`;
      return r?.[0] ?? null;
    });
  }

  async deleteHoliday(id: string) {
    await withLocalPg(async (sql) => sql`UPDATE public.hr_holidays SET deleted_at = now() WHERE id = ${id}`);
    return { id };
  }

  // ── leave balances ─────────────────────────────────────────────────────
  async listBalances(scope: HrScope, opts: { year?: number; employeeId?: string; search?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where = [scopeCol(sql, scope, "country_id")];
      if (opts.year) where.push(sql`year = ${opts.year}`);
      if (opts.employeeId) where.push(sql`employee_id = ${opts.employeeId}`);
      if (opts.search) where.push(sql`(employee_name ILIKE ${"%" + opts.search + "%"} OR employee_code ILIKE ${"%" + opts.search + "%"})`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT * FROM public.hr_employee_leave_balances_v WHERE ${w} ORDER BY employee_name ASC, leave_type_name ASC`;
    });
    return rows ?? [];
  }

  /** Create/refresh balances for every in-scope employee for a year from leave-type entitlements. */
  async initializeYear(year: number, actorId: string, scope: HrScope) {
    const n = await withLocalPg(async (sql) => {
      const scoped = scope.countryIds === null ? sql`TRUE` : sql`(e.country_id = ANY(${scope.countryIds}) OR e.country_id IS NULL)`;
      const res = await sql`
        INSERT INTO public.hr_employee_leave_balances (employee_id, leave_type_id, year, entitled_days, country_id, city_branch_id, updated_by)
        SELECT e.id, lt.id, ${year}, lt.annual_entitlement_days, e.country_id, e.city_branch_id, ${actorId}
        FROM public.employees e
        JOIN public.hr_leave_types lt ON lt.deleted_at IS NULL AND lt.is_active
          AND (lt.country_id IS NULL OR lt.country_id = e.country_id)
        WHERE e.deleted_at IS NULL AND e.status = 'Active' AND ${scoped}
        ON CONFLICT (employee_id, leave_type_id, year) WHERE deleted_at IS NULL
        DO UPDATE SET entitled_days = EXCLUDED.entitled_days, updated_by = ${actorId}, updated_at = now()
        RETURNING id`;
      return res?.length ?? 0;
    });
    return { upserted: n };
  }

  /** Recompute taken / pending days from office_leave_requests for a year. */
  async recomputeBalances(year: number, scope: HrScope) {
    const n = await withLocalPg(async (sql) => {
      const scoped = scope.countryIds === null ? sql`TRUE` : sql`(b.country_id = ANY(${scope.countryIds}) OR b.country_id IS NULL)`;
      const res = await sql`
        WITH agg AS (
          SELECT l.employee_id, lt.id AS leave_type_id,
            SUM(l.days) FILTER (WHERE lower(l.status) IN ('approved','applied')) AS taken,
            SUM(l.days) FILTER (WHERE lower(l.status) IN ('pending','submitted')) AS pending
          FROM public.office_leave_requests l
          JOIN public.hr_leave_types lt ON lower(lt.code) = lower(l.leave_type) OR lower(lt.name) = lower(l.leave_type)
          WHERE l.deleted_at IS NULL AND extract(year from l.from_date) = ${year}
          GROUP BY l.employee_id, lt.id
        )
        UPDATE public.hr_employee_leave_balances b
        SET taken_days = COALESCE(a.taken, 0), pending_days = COALESCE(a.pending, 0), updated_at = now()
        FROM agg a
        WHERE b.employee_id = a.employee_id AND b.leave_type_id = a.leave_type_id AND b.year = ${year}
          AND b.deleted_at IS NULL AND ${scoped}
        RETURNING b.id`;
      return res?.length ?? 0;
    });
    return { updated: n };
  }

  async adjustBalance(id: string, adjustmentDays: number, actorId: string, scope: HrScope) {
    await withLocalPg(async (sql) => {
      const row = (await sql`SELECT employee_id FROM public.hr_employee_leave_balances WHERE id = ${id} AND deleted_at IS NULL`)?.[0];
      if (!row) throw new Error("Balance row not found.");
      await assertEmployeeInScope(row.employee_id, scope);
      await sql`UPDATE public.hr_employee_leave_balances SET adjustment_days = adjustment_days + ${adjustmentDays}, updated_by = ${actorId}, updated_at = now() WHERE id = ${id}`;
    });
    return { id };
  }

  // ── attendance corrections ─────────────────────────────────────────────
  async listCorrections(scope: HrScope, opts: { status?: string; employeeId?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where = [scopeCol(sql, scope, "x.country_id")];
      if (opts.status) where.push(sql`x.status = ${opts.status}`);
      if (opts.employeeId) where.push(sql`x.employee_id = ${opts.employeeId}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT x.*, e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
        FROM public.hr_attendance_corrections x
        JOIN public.employees e ON e.id = x.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE x.deleted_at IS NULL AND ${w}
        ORDER BY x.attendance_date DESC, x.created_at DESC`;
    });
    return rows ?? [];
  }

  async createCorrection(input: any, actorId: string, scope: HrScope) {
    await assertEmployeeInScope(input.employeeId, scope);
    return withLocalPg(async (sql) => {
      const emp = (await sql`SELECT country_id, city_branch_id FROM public.employees WHERE id = ${input.employeeId}`)?.[0];
      const att = input.attendanceId
        ? (await sql`SELECT id, check_in, check_out, status, work_hours FROM public.office_attendance WHERE id = ${input.attendanceId}`)?.[0]
        : (await sql`SELECT id, check_in, check_out, status, work_hours FROM public.office_attendance
            WHERE employee_id = ${input.employeeId} AND attendance_date = ${input.attendanceDate} AND deleted_at IS NULL LIMIT 1`)?.[0];
      const r = await sql`INSERT INTO public.hr_attendance_corrections
        (attendance_id, employee_id, attendance_date, prev_check_in, new_check_in, prev_check_out, new_check_out,
         prev_status, new_status, prev_work_hours, new_work_hours, reason, requested_by, country_id, city_branch_id)
        VALUES (${att?.id ?? null}, ${input.employeeId}, ${input.attendanceDate},
          ${att?.check_in ?? null}, ${input.newCheckIn ?? null}, ${att?.check_out ?? null}, ${input.newCheckOut ?? null},
          ${att?.status ?? null}, ${input.newStatus ?? null}, ${att?.work_hours ?? null}, ${input.newWorkHours ?? null},
          ${input.reason}, ${actorId}, ${emp?.country_id ?? null}, ${emp?.city_branch_id ?? null})
        RETURNING id`;
      return r?.[0] ?? null;
    });
  }

  async setCorrectionStatus(id: string, action: "approve" | "reject" | "apply", actorId: string, scope: HrScope) {
    return withLocalPg(async (sql) => {
      await sql`BEGIN`;
      try {
        const row = (await sql`SELECT * FROM public.hr_attendance_corrections WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`)?.[0];
        if (!row) throw new Error("Correction not found.");
        await assertEmployeeInScope(row.employee_id, scope);
        if (action === "reject") {
          await sql`UPDATE public.hr_attendance_corrections SET status = 'rejected', approved_by = ${actorId}, approved_at = now(), updated_at = now() WHERE id = ${id}`;
          await sql`COMMIT`;
          return { id, status: "rejected" };
        }
        if (action === "approve") {
          await sql`UPDATE public.hr_attendance_corrections SET status = 'approved', approved_by = ${actorId}, approved_at = now(), updated_at = now() WHERE id = ${id}`;
          await sql`COMMIT`;
          return { id, status: "approved" };
        }
        // apply
        if (row.status === "applied") { await sql`ROLLBACK`; return { id, alreadyApplied: true }; }
        if (row.status !== "approved") throw new Error("Correction must be approved before it can be applied.");
        if (row.attendance_id) {
          await sql`UPDATE public.office_attendance SET
            check_in = COALESCE(${row.new_check_in}, check_in),
            check_out = COALESCE(${row.new_check_out}, check_out),
            status = COALESCE(${row.new_status}, status),
            work_hours = COALESCE(${row.new_work_hours}, work_hours),
            updated_at = now()
            WHERE id = ${row.attendance_id}`;
        } else {
          await sql`INSERT INTO public.office_attendance (employee_id, attendance_date, check_in, check_out, status, work_hours, country_id, city_branch_id, created_by)
            VALUES (${row.employee_id}, ${row.attendance_date}, ${row.new_check_in}, ${row.new_check_out},
              COALESCE(${row.new_status}, 'Present'), ${row.new_work_hours}, ${row.country_id}, ${row.city_branch_id}, ${actorId})`;
        }
        await sql`UPDATE public.hr_attendance_corrections SET status = 'applied', applied_at = now(), updated_at = now() WHERE id = ${id}`;
        await sql`COMMIT`;
        return { id, applied: true };
      } catch (e) {
        await sql`ROLLBACK`;
        throw e;
      }
    });
  }
}

export const hrAttendanceLeaveService = new HrAttendanceLeaveService();
