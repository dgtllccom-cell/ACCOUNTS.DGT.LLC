import { withLocalPg } from "@/lib/db/local-postgres";
import type { HrScope } from "@/lib/services/hr-api";

/**
 * HRM Phase 5 — Payroll run engine.
 *
 * Workflow: draft -> calculated -> reviewed -> approved -> posted -> paid
 *   * Only an APPROVED run may post accounting.
 *   * A run can never post twice (posted_at guard + idempotency_key).
 *   * Posting is done via the existing post_roznamcha_entry RPC; every line also
 *     gets a linked employee_salaries_due row (the existing per-employee register).
 *   * Reversal is a controlled contra entry, never a delete.
 *
 * Scope repeated in every WHERE (withLocalPg bypasses RLS).
 */

type Sql = any;

function runScopeWhere(sql: Sql, scope: HrScope, alias = "r") {
  if (scope.countryIds === null) return sql`TRUE`;
  return sql`(${sql(alias + ".country_id")} = ANY(${scope.countryIds}) OR ${sql(alias + ".country_id")} IS NULL)`;
}

async function assertRunInScope(sql: Sql, runId: string, scope: HrScope) {
  if (scope.countryIds === null) return;
  const r = await sql`SELECT 1 FROM public.hr_payroll_runs r
    WHERE r.id = ${runId} AND r.deleted_at IS NULL
      AND (r.country_id = ANY(${scope.countryIds}) OR r.country_id IS NULL) LIMIT 1`;
  if (!r?.length) throw new Error("Payroll run not found in your scope.");
}

function periodBounds(periodMonth: string): { start: string; end: string; days: number } {
  const [y, m] = periodMonth.split("-").map(Number);
  const start = `${periodMonth}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end, days };
}

export class HrPayrollService {
  async listRuns(scope: HrScope, filters: { status?: string; periodMonth?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [runScopeWhere(sql, scope)];
      if (filters.status) where.push(sql`r.status = ${filters.status}`);
      if (filters.periodMonth) where.push(sql`r.period_month = ${filters.periodMonth}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT r.* FROM public.hr_payroll_runs_v r WHERE ${w} ORDER BY r.period_month DESC, r.created_at DESC`;
    });
    return rows ?? [];
  }

  async getRun(runId: string, scope: HrScope) {
    return withLocalPg(async (sql) => {
      await assertRunInScope(sql, runId, scope);
      const run = (await sql`SELECT * FROM public.hr_payroll_runs_v WHERE id = ${runId}`)?.[0];
      if (!run) return null;
      const lines = await sql`
        SELECT l.*, e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
        FROM public.hr_payroll_run_lines l
        JOIN public.employees e ON e.id = l.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE l.run_id = ${runId}
        ORDER BY employee_name ASC`;
      const events = await sql`SELECT * FROM public.hr_payroll_run_events WHERE run_id = ${runId} ORDER BY created_at DESC LIMIT 100`;
      return { run, lines: lines ?? [], events: events ?? [] };
    });
  }

  async createRun(
    input: { periodMonth: string; countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null; presentationCurrency?: string; notes?: string | null },
    actorId: string,
    actorName: string | null,
    scope: HrScope,
  ) {
    if (scope.countryIds && input.countryId && !scope.countryIds.includes(input.countryId)) throw new Error("Country outside your scope.");
    return withLocalPg(async (sql) => {
      const seq = (await sql`SELECT count(*)::int n FROM public.hr_payroll_runs`)?.[0]?.n ?? 0;
      const runNo = `PR-${input.periodMonth.replace("-", "")}-${String(seq + 1).padStart(4, "0")}`;
      // presentation currency = the scope's official currency (USD is the
      // consolidated-reporting fallback for a global / mixed run).
      let presCurrency = input.presentationCurrency;
      if (!presCurrency && (input.countryId || input.countryBranchId || input.cityBranchId)) {
        const cr = await sql`SELECT public.hr_resolve_currency(${input.countryId ?? null}, ${input.countryBranchId ?? null}, ${input.cityBranchId ?? null}) AS c`;
        presCurrency = cr?.[0]?.c || "USD";
      }
      const rows = await sql`
        INSERT INTO public.hr_payroll_runs
          (run_no, period_month, country_id, country_branch_id, city_branch_id, presentation_currency, notes, created_by)
        VALUES (${runNo}, ${input.periodMonth}, ${input.countryId ?? null}, ${input.countryBranchId ?? null},
          ${input.cityBranchId ?? null}, ${presCurrency ?? "USD"}, ${input.notes ?? null}, ${actorId})
        RETURNING id`;
      const runId = rows?.[0]?.id;
      await sql`INSERT INTO public.hr_payroll_run_events (run_id, action, actor_id, actor_name, detail)
        VALUES (${runId}, 'created', ${actorId}, ${actorName}, ${sql.json({ runNo })})`;
      return { id: runId, runNo };
    });
  }

  /** Populate / refresh lines from active in-scope employees. Run must be draft or calculated. */
  async calculate(runId: string, actorId: string, actorName: string | null, scope: HrScope) {
    return withLocalPg(async (sql) => {
      await assertRunInScope(sql, runId, scope);
      const run = (await sql`SELECT * FROM public.hr_payroll_runs WHERE id = ${runId} AND deleted_at IS NULL`)?.[0];
      if (!run) throw new Error("Run not found.");
      if (!["draft", "calculated"].includes(run.status)) throw new Error(`Cannot recalculate a ${run.status} run.`);
      const { start, end, days } = periodBounds(run.period_month);

      const empScoped =
        run.city_branch_id ? sql`e.city_branch_id = ${run.city_branch_id}`
        : run.country_branch_id ? sql`e.country_branch_id = ${run.country_branch_id}`
        : run.country_id ? sql`e.country_id = ${run.country_id}`
        : (scope.countryIds === null ? sql`TRUE` : sql`e.country_id = ANY(${scope.countryIds})`);

      const employees = await sql`
        SELECT e.*, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
        FROM public.employees e
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE e.deleted_at IS NULL AND e.status = 'Active' AND ${empScoped}`;

      // latest USD rate per country (local units per 1 USD)
      let insertedLines = 0;
      for (const e of employees ?? []) {
        const basic = Number(e.basic_salary || e.monthly_salary || 0);
        const allowBreakdown = {
          general: Number(e.allowance || 0),
          accommodation: Number(e.accommodation_allowance || 0),
          transport: Number(e.transport_allowance || 0),
          food: Number(e.food_allowance || 0),
          mobile: Number(e.mobile_allowance || 0),
          other: Number(e.other_allowance || 0),
        };
        const allowancesTotal = Object.values(allowBreakdown).reduce((a: number, b) => a + Number(b), 0);

        // overtime from attendance overtime_hours * overtime_rate
        const otRows = await sql`SELECT COALESCE(sum(overtime_hours),0)::numeric AS h
          FROM public.office_attendance
          WHERE employee_id = ${e.id} AND deleted_at IS NULL AND attendance_date BETWEEN ${start} AND ${end}`;
        const otHours = Number(otRows?.[0]?.h || 0);
        const overtimeAmount = Math.round(otHours * Number(e.overtime_rate || 0) * 100) / 100;

        // unpaid leave days that month -> deduction pro-rata on 'unpaid' type
        const ulRows = await sql`
          SELECT COALESCE(sum(l.days),0)::numeric AS d
          FROM public.office_leave_requests l
          WHERE l.employee_id = ${e.id} AND l.deleted_at IS NULL
            AND lower(l.status) IN ('approved','applied')
            AND lower(l.leave_type) IN ('unpaid','unpaid leave','lwp','leave without pay')
            AND l.from_date <= ${end} AND l.to_date >= ${start}`;
        const unpaidDays = Number(ulRows?.[0]?.d || 0);
        const unpaidLeaveDeduction = Math.round((basic / days) * unpaidDays * 100) / 100;

        // salary advance recovery (type='advance' only — NO loan module)
        const advRows = await sql`
          SELECT COALESCE(sum(LEAST(monthly_deduction, remaining_balance)),0)::numeric AS r
          FROM public.employee_advances_loans
          WHERE employee_id = ${e.id} AND deleted_at IS NULL AND lower(status) = 'active'
            AND lower(type) = 'advance'
            AND (start_month IS NULL OR start_month <= ${run.period_month})
            AND remaining_balance > 0`;
        const advanceRecovery = Number(advRows?.[0]?.r || 0);

        const otherDeductions = Number(e.deduction || 0);
        const gross = Math.round((basic + allowancesTotal + overtimeAmount) * 100) / 100;

        // Country payroll-tax config (hr_payroll_tax_config) — falls back to the
        // employee's fixed tax_deduction when no country rule is configured.
        let taxEmployee = Number(e.tax_deduction || 0);
        let employerContrib = 0;
        if (e.country_id) {
          const tx = await sql`SELECT employee_tax, employer_contribution FROM public.hr_payroll_tax_for(${e.country_id}, ${gross}, ${basic}, ${run.period_month})`;
          const hasRule = await sql`SELECT 1 FROM public.hr_payroll_tax_config
            WHERE deleted_at IS NULL AND is_active AND country_id = ${e.country_id}
              AND effective_from <= ${run.period_month + "-01"} LIMIT 1`;
          if (hasRule?.length) {
            taxEmployee = Number(tx?.[0]?.employee_tax || 0);
            employerContrib = Number(tx?.[0]?.employer_contribution || 0);
          }
        }

        const net = Math.round((gross - unpaidLeaveDeduction - otherDeductions - advanceRecovery - taxEmployee) * 100) / 100;

        // Currency is the OFFICIAL currency of the employee's country/branch —
        // resolved dynamically (city branch → main branch → country), never the
        // stale employees.salary_currency column and never hard-coded.
        const curRow = await sql`SELECT public.hr_resolve_currency(${e.country_id}, ${e.country_branch_id}, ${e.city_branch_id}) AS c`;
        const currency = curRow?.[0]?.c || e.salary_currency || run.presentation_currency || "USD";
        let rate = 1;
        if (currency !== "USD") {
          const rr = await sql`SELECT selling_rate FROM public.daily_usd_rates
            WHERE deleted_at IS NULL AND (country_id = ${e.country_id} OR ${e.country_id} IS NULL)
            ORDER BY rate_date DESC LIMIT 1`;
          rate = Number(rr?.[0]?.selling_rate || 0) || 1;
        }
        const usdAmount = currency === "USD" ? net : Math.round((net / rate) * 100) / 100;

        await sql`
          INSERT INTO public.hr_payroll_run_lines
            (run_id, employee_id, basic_salary, allowances_total, allowances_breakdown, overtime_amount, bonus_amount,
             unpaid_leave_deduction, other_deductions, advance_recovery, tax_employee, employer_contributions,
             gross_salary, net_salary, currency, exchange_rate, local_amount, usd_amount, unpaid_leave_days, status)
          VALUES (${runId}, ${e.id}, ${basic}, ${allowancesTotal}, ${sql.json(allowBreakdown)}, ${overtimeAmount}, 0,
            ${unpaidLeaveDeduction}, ${otherDeductions}, ${advanceRecovery}, ${taxEmployee}, ${employerContrib},
            ${gross}, ${net}, ${currency}, ${rate}, ${net}, ${usdAmount}, ${unpaidDays}, 'calculated')
          ON CONFLICT (run_id, employee_id) DO UPDATE SET
            basic_salary = EXCLUDED.basic_salary, allowances_total = EXCLUDED.allowances_total,
            allowances_breakdown = EXCLUDED.allowances_breakdown, overtime_amount = EXCLUDED.overtime_amount,
            unpaid_leave_deduction = EXCLUDED.unpaid_leave_deduction, other_deductions = EXCLUDED.other_deductions,
            advance_recovery = EXCLUDED.advance_recovery, tax_employee = EXCLUDED.tax_employee,
            gross_salary = EXCLUDED.gross_salary, net_salary = EXCLUDED.net_salary, currency = EXCLUDED.currency,
            exchange_rate = EXCLUDED.exchange_rate, local_amount = EXCLUDED.local_amount, usd_amount = EXCLUDED.usd_amount,
            unpaid_leave_days = EXCLUDED.unpaid_leave_days, updated_at = now()
          WHERE public.hr_payroll_run_lines.status = 'calculated'`;
        insertedLines++;
      }

      await this._recomputeTotals(sql, runId);
      await sql`UPDATE public.hr_payroll_runs SET status = 'calculated', calculated_at = now(), updated_at = now() WHERE id = ${runId}`;
      await sql`INSERT INTO public.hr_payroll_run_events (run_id, action, actor_id, actor_name, detail)
        VALUES (${runId}, 'calculated', ${actorId}, ${actorName}, ${sql.json({ employees: insertedLines })})`;
      return { runId, lines: insertedLines };
    });
  }

  async updateLine(lineId: string, patch: { bonusAmount?: number; otherDeductions?: number; taxEmployee?: number; employerContributions?: number; exclude?: boolean; notes?: string | null }, scope: HrScope) {
    return withLocalPg(async (sql) => {
      const line = (await sql`SELECT l.*, r.status AS run_status, r.country_id AS run_country
        FROM public.hr_payroll_run_lines l JOIN public.hr_payroll_runs r ON r.id = l.run_id
        WHERE l.id = ${lineId}`)?.[0];
      if (!line) throw new Error("Line not found.");
      if (scope.countryIds !== null && line.run_country && !scope.countryIds.includes(line.run_country)) throw new Error("Out of scope.");
      if (!["draft", "calculated", "reviewed"].includes(line.run_status)) throw new Error(`Run is ${line.run_status}; lines are locked.`);

      const bonus = patch.bonusAmount ?? Number(line.bonus_amount);
      const otherDed = patch.otherDeductions ?? Number(line.other_deductions);
      const tax = patch.taxEmployee ?? Number(line.tax_employee);
      const employer = patch.employerContributions ?? Number(line.employer_contributions);
      const gross = Math.round((Number(line.basic_salary) + Number(line.allowances_total) + Number(line.overtime_amount) + bonus) * 100) / 100;
      const net = Math.round((gross - Number(line.unpaid_leave_deduction) - otherDed - Number(line.advance_recovery) - tax) * 100) / 100;
      const usd = line.currency === "USD" ? net : Math.round((net / (Number(line.exchange_rate) || 1)) * 100) / 100;

      await sql`UPDATE public.hr_payroll_run_lines SET
        bonus_amount = ${bonus}, other_deductions = ${otherDed}, tax_employee = ${tax}, employer_contributions = ${employer},
        gross_salary = ${gross}, net_salary = ${net}, local_amount = ${net}, usd_amount = ${usd},
        status = ${patch.exclude === true ? "excluded" : patch.exclude === false ? "calculated" : line.status},
        notes = ${patch.notes === undefined ? sql`notes` : patch.notes}, updated_at = now()
        WHERE id = ${lineId}`;
      await this._recomputeTotals(sql, line.run_id);
      return { id: lineId };
    });
  }

  async setStatus(runId: string, action: "review" | "approve" | "cancel", actorId: string, actorName: string | null, scope: HrScope) {
    return withLocalPg(async (sql) => {
      await assertRunInScope(sql, runId, scope);
      const run = (await sql`SELECT * FROM public.hr_payroll_runs WHERE id = ${runId} AND deleted_at IS NULL`)?.[0];
      if (!run) throw new Error("Run not found.");
      if (action === "cancel") {
        if (["posted", "paid"].includes(run.status)) throw new Error("A posted run must be reversed, not cancelled.");
        await sql`UPDATE public.hr_payroll_runs SET status = 'cancelled', updated_at = now() WHERE id = ${runId}`;
      } else if (action === "review") {
        if (run.status !== "calculated") throw new Error("Only a calculated run can be moved to Reviewed.");
        await sql`UPDATE public.hr_payroll_runs SET status = 'reviewed', reviewed_by = ${actorId}, reviewed_at = now(), updated_at = now() WHERE id = ${runId}`;
      } else {
        if (run.status !== "reviewed") throw new Error("Only a reviewed run can be Approved.");
        await sql`UPDATE public.hr_payroll_runs SET status = 'approved', approved_by = ${actorId}, approved_at = now(), updated_at = now() WHERE id = ${runId}`;
      }
      await sql`INSERT INTO public.hr_payroll_run_events (run_id, action, actor_id, actor_name)
        VALUES (${runId}, ${action === "review" ? "reviewed" : action === "approve" ? "approved" : "cancelled"}, ${actorId}, ${actorName})`;
      return { runId, status: action };
    });
  }

  private async _recomputeTotals(sql: Sql, runId: string) {
    await sql`
      UPDATE public.hr_payroll_runs r SET
        employee_count = t.cnt, total_gross = t.gross, total_allowances = t.allow, total_overtime = t.ot,
        total_bonus = t.bonus, total_deductions = t.ded, total_tax_employee = t.tax, total_employer_cost = t.emp,
        total_advance_recovery = t.adv, total_net = t.net, total_net_usd = t.usd, updated_at = now()
      FROM (
        SELECT
          count(*) FILTER (WHERE status <> 'excluded') AS cnt,
          COALESCE(sum(gross_salary) FILTER (WHERE status <> 'excluded'),0) AS gross,
          COALESCE(sum(allowances_total) FILTER (WHERE status <> 'excluded'),0) AS allow,
          COALESCE(sum(overtime_amount) FILTER (WHERE status <> 'excluded'),0) AS ot,
          COALESCE(sum(bonus_amount) FILTER (WHERE status <> 'excluded'),0) AS bonus,
          COALESCE(sum(unpaid_leave_deduction + other_deductions) FILTER (WHERE status <> 'excluded'),0) AS ded,
          COALESCE(sum(tax_employee) FILTER (WHERE status <> 'excluded'),0) AS tax,
          COALESCE(sum(employer_contributions) FILTER (WHERE status <> 'excluded'),0) AS emp,
          COALESCE(sum(advance_recovery) FILTER (WHERE status <> 'excluded'),0) AS adv,
          COALESCE(sum(net_salary) FILTER (WHERE status <> 'excluded'),0) AS net,
          COALESCE(sum(usd_amount) FILTER (WHERE status <> 'excluded'),0) AS usd
        FROM public.hr_payroll_run_lines WHERE run_id = ${runId}
      ) t
      WHERE r.id = ${runId}`;
  }

  async recomputeTotals(runId: string, scope: HrScope) {
    await withLocalPg(async (sql) => {
      await assertRunInScope(sql, runId, scope);
      await this._recomputeTotals(sql, runId);
    });
    return { runId };
  }
}

export const hrPayrollService = new HrPayrollService();
