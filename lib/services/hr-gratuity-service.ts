import { withLocalPg } from "@/lib/db/local-postgres";
import type { HrScope } from "@/lib/services/hr-api";

/**
 * HRM Phase 8 — gratuity & final settlement.
 * Worksheet: pending salary + leave encashment + gratuity + other additions
 *            − advances − other deductions = net settlement.
 * calculate() pulls gratuity from hr_calc_gratuity() + leave balance encashment
 * + outstanding salary advances. Payment posts one balanced roznamcha entry.
 */

type Sql = any;

async function assertEmployeeInScope(sql: Sql, employeeId: string, scope: HrScope) {
  if (scope.countryIds === null) return;
  const r = await sql`SELECT 1 FROM public.employees e
    WHERE e.id = ${employeeId} AND e.deleted_at IS NULL
      AND (e.country_id = ANY(${scope.countryIds}) OR e.country_id IS NULL) LIMIT 1`;
  if (!r?.length) throw new Error("Employee not found in your scope.");
}

export class HrGratuityService {
  async list(scope: HrScope, filters: { status?: string; search?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [scope.countryIds === null ? sql`TRUE` : sql`(s.country_id = ANY(${scope.countryIds}) OR s.country_id IS NULL)`];
      if (filters.status) where.push(sql`s.status = ${filters.status}`);
      if (filters.search) where.push(sql`(s.employee_name ILIKE ${"%" + filters.search + "%"} OR s.employee_code ILIKE ${"%" + filters.search + "%"})`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT s.* FROM public.hr_gratuity_settlements_v s WHERE ${w} ORDER BY s.calc_as_of DESC, s.created_at DESC`;
    });
    return rows ?? [];
  }

  async get(id: string, scope: HrScope) {
    return withLocalPg(async (sql) => {
      const row = (await sql`SELECT * FROM public.hr_gratuity_settlements_v WHERE id = ${id}`)?.[0];
      if (!row) return null;
      await assertEmployeeInScope(sql, row.employee_id, scope);
      return row;
    });
  }

  policies(scope: HrScope) {
    return withLocalPg(async (sql) => {
      const w = scope.countryIds === null ? sql`TRUE` : sql`country_id = ANY(${scope.countryIds})`;
      return (await sql`SELECT p.*, co.name AS country_name FROM public.hr_gratuity_policy p
        LEFT JOIN public.countries co ON co.id = p.country_id
        WHERE p.deleted_at IS NULL AND ${w} ORDER BY co.name, p.effective_from DESC`) ?? [];
    });
  }

  /** Build (or refresh) a settlement worksheet for one employee. */
  async calculate(
    input: { employeeId: string; separationId?: string | null; calcAsOf?: string; pendingSalaryAmount?: number; noticePayAmount?: number; otherAdditions?: number; otherDeductions?: number },
    actorId: string,
    scope: HrScope,
  ) {
    return withLocalPg(async (sql) => {
      await assertEmployeeInScope(sql, input.employeeId, scope);
      const asOf = input.calcAsOf || new Date().toISOString().slice(0, 10);
      const e = (await sql`SELECT e.*, co.reporting_currency FROM public.employees e LEFT JOIN public.countries co ON co.id = e.country_id WHERE e.id = ${input.employeeId}`)?.[0];
      if (!e) throw new Error("Employee not found.");

      const sep = input.separationId
        ? (await sql`SELECT * FROM public.hr_employee_separations WHERE id = ${input.separationId} AND deleted_at IS NULL`)?.[0]
        : (await sql`SELECT * FROM public.hr_employee_separations WHERE employee_id = ${input.employeeId} AND deleted_at IS NULL AND status IN ('approved','applied') ORDER BY last_working_date DESC LIMIT 1`)?.[0];
      const sepType = sep?.separation_type || "end_of_contract";

      const g = (await sql`SELECT * FROM public.hr_calc_gratuity(${input.employeeId}, ${asOf}, ${sepType})`)?.[0] ?? {};
      // Official currency of the employee's country/branch — resolved dynamically.
      const curRow = await sql`SELECT public.hr_resolve_currency(${e.country_id}, ${e.country_branch_id}, ${e.city_branch_id}) AS c`;
      const currency = curRow?.[0]?.c || e.salary_currency || e.reporting_currency || "USD";
      const dailyBasic = Number(e.basic_salary || e.monthly_salary || 0) / 30;

      // leave encashment: sum of remaining paid-leave-type balances for the current year
      const year = Number(asOf.slice(0, 4));
      const leaveRows = await sql`
        SELECT COALESCE(sum(b.entitled_days + b.carried_forward + b.adjustment_days - b.taken_days - b.pending_days), 0) AS d
        FROM public.hr_employee_leave_balances b
        JOIN public.hr_leave_types lt ON lt.id = b.leave_type_id AND lt.is_paid
        WHERE b.employee_id = ${input.employeeId} AND b.year = ${year} AND b.deleted_at IS NULL`;
      const leaveDays = Math.max(0, Number(leaveRows?.[0]?.d || 0));
      const leaveAmount = Math.round(leaveDays * dailyBasic * 100) / 100;

      // outstanding salary advances
      const advRows = await sql`SELECT COALESCE(sum(remaining_balance), 0) AS r
        FROM public.employee_advances_loans
        WHERE employee_id = ${input.employeeId} AND deleted_at IS NULL AND lower(status) = 'active' AND lower(type) = 'advance' AND remaining_balance > 0`;
      const advanceDeduction = Number(advRows?.[0]?.r || 0);

      const pendingSalary = Number(input.pendingSalaryAmount ?? 0);
      const noticePay = Number(input.noticePayAmount ?? 0);
      const otherAdd = Number(input.otherAdditions ?? 0);
      const otherDed = Number(input.otherDeductions ?? 0);
      const gratuityAmount = Number(g.gratuity_amount || 0);

      const net = Math.round((pendingSalary + leaveAmount + gratuityAmount + noticePay + otherAdd - advanceDeduction - otherDed) * 100) / 100;

      let rate = 1;
      if (currency !== "USD") {
        const rr = await sql`SELECT selling_rate FROM public.daily_usd_rates WHERE deleted_at IS NULL AND (country_id = ${e.country_id} OR ${e.country_id} IS NULL) ORDER BY rate_date DESC LIMIT 1`;
        rate = Number(rr?.[0]?.selling_rate || 0) || 1;
      }
      const usd = currency === "USD" ? net : Math.round((net / rate) * 100) / 100;

      const seq = (await sql`SELECT count(*)::int n FROM public.hr_gratuity_settlements`)?.[0]?.n ?? 0;
      const settlementNo = `FS-${String(seq + 1).padStart(4, "0")}`;
      const rows = await sql`
        INSERT INTO public.hr_gratuity_settlements
          (employee_id, separation_id, settlement_no, calc_as_of, separation_type, service_years, last_basic_salary, last_gross_salary,
           gratuity_days, gratuity_amount, leave_encashment_days, leave_encashment_amount, pending_salary_amount, notice_pay_amount,
           other_additions, advance_deduction, other_deductions, net_settlement, currency, exchange_rate, local_amount, usd_amount,
           status, country_id, country_branch_id, city_branch_id, created_by, updated_by)
        VALUES
          (${input.employeeId}, ${sep?.id ?? null}, ${settlementNo}, ${asOf}, ${sepType},
           ${Number(g.service_years || 0)}, ${Number(e.basic_salary || 0)}, ${Number(e.monthly_salary || 0)},
           ${Number(g.gratuity_days || 0)}, ${gratuityAmount}, ${leaveDays}, ${leaveAmount}, ${pendingSalary}, ${noticePay},
           ${otherAdd}, ${advanceDeduction}, ${otherDed}, ${net}, ${currency}, ${rate}, ${net}, ${usd},
           'calculated', ${e.country_id}, ${e.country_branch_id}, ${e.city_branch_id}, ${actorId}, ${actorId})
        ON CONFLICT (employee_id) WHERE deleted_at IS NULL AND status IN ('draft','calculated','approved')
        DO UPDATE SET
          separation_id = EXCLUDED.separation_id, calc_as_of = EXCLUDED.calc_as_of, separation_type = EXCLUDED.separation_type,
          service_years = EXCLUDED.service_years, last_basic_salary = EXCLUDED.last_basic_salary, last_gross_salary = EXCLUDED.last_gross_salary,
          gratuity_days = EXCLUDED.gratuity_days, gratuity_amount = EXCLUDED.gratuity_amount,
          leave_encashment_days = EXCLUDED.leave_encashment_days, leave_encashment_amount = EXCLUDED.leave_encashment_amount,
          pending_salary_amount = EXCLUDED.pending_salary_amount, notice_pay_amount = EXCLUDED.notice_pay_amount,
          other_additions = EXCLUDED.other_additions, advance_deduction = EXCLUDED.advance_deduction, other_deductions = EXCLUDED.other_deductions,
          net_settlement = EXCLUDED.net_settlement, currency = EXCLUDED.currency, exchange_rate = EXCLUDED.exchange_rate,
          local_amount = EXCLUDED.local_amount, usd_amount = EXCLUDED.usd_amount, status = 'calculated',
          updated_by = EXCLUDED.updated_by, updated_at = now()
        RETURNING id`;
      return rows?.[0] ?? null;
    });
  }

  async setStatus(id: string, action: "approve" | "cancel", actorId: string, scope: HrScope) {
    return withLocalPg(async (sql) => {
      const row = (await sql`SELECT * FROM public.hr_gratuity_settlements WHERE id = ${id} AND deleted_at IS NULL`)?.[0];
      if (!row) throw new Error("Settlement not found.");
      await assertEmployeeInScope(sql, row.employee_id, scope);
      if (row.status === "paid") throw new Error("A paid settlement cannot change status.");
      if (action === "cancel") {
        await sql`UPDATE public.hr_gratuity_settlements SET status = 'cancelled', updated_by = ${actorId}, updated_at = now() WHERE id = ${id}`;
        return { id, status: "cancelled" };
      }
      if (row.status !== "calculated") throw new Error("Only a calculated settlement can be approved.");
      await sql`UPDATE public.hr_gratuity_settlements SET status = 'approved', approved_by = ${actorId}, approved_at = now(), updated_by = ${actorId}, updated_at = now() WHERE id = ${id}`;
      return { id, status: "approved" };
    });
  }

  /** Post the payment: Dr Salary Expense (net) / Cr Cash-Bank (net). APPROVED -> PAID. */
  async pay(id: string, opts: { expenseLedgerId?: string | null; paymentLedgerId: string; paymentDate: string }, actorId: string, scope: HrScope) {
    if (!opts.paymentLedgerId) throw new Error("A cash/bank payment ledger is required.");
    return withLocalPg(async (sql) => {
      await sql`BEGIN`;
      try {
        const s = (await sql`SELECT * FROM public.hr_gratuity_settlements WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`)?.[0];
        if (!s) throw new Error("Settlement not found.");
        await assertEmployeeInScope(sql, s.employee_id, scope);
        if (s.status === "paid") { await sql`ROLLBACK`; return { id, alreadyPaid: true }; }
        if (s.status !== "approved") throw new Error("Only an approved settlement can be paid.");

        const emp = (await sql`SELECT e.salary_expense_account_id,
            COALESCE(c.customer_name, c.company_name, e.employee_code) AS nm
          FROM public.employees e LEFT JOIN public.customers c ON c.id = e.person_master_id
          WHERE e.id = ${s.employee_id}`)?.[0];
        const expenseLedger = opts.expenseLedgerId || emp?.salary_expense_account_id;
        if (!expenseLedger) throw new Error("A settlement expense ledger is required (or set Salary Expense on the employee).");
        const net = Number(s.net_settlement);
        if (net <= 0) throw new Error("Net settlement is not positive — nothing to pay.");
        const rate = Number(s.exchange_rate) || 1;

        const lines = [
          { ledgerId: expenseLedger, debit: net, credit: 0, currency: s.currency, exchangeRate: rate, paymentEntryType: "debit", description: `Final settlement ${emp?.nm ?? ""} (gratuity + dues)` },
          { ledgerId: opts.paymentLedgerId, debit: 0, credit: net, currency: s.currency, exchangeRate: rate, paymentEntryType: "credit", description: `Final settlement paid to ${emp?.nm ?? ""} via cash/bank` },
        ];
        const scopeType = s.country_branch_id ? "branch" : "country";
        const jid = (await sql`SELECT public.post_roznamcha_entry(
          p_type := ${scopeType}::roznamcha_type, p_country_id := ${s.country_id}, p_country_branch_id := ${s.country_branch_id},
          p_city_branch_id := ${null}, p_journal_no := 'JO-FINAL-SETTLEMENT', p_voucher_no := ${s.settlement_no},
          p_entry_date := ${opts.paymentDate}, p_payment_method_id := ${null}, p_reference_no := ${`Final Settlement ${s.settlement_no}`},
          p_narration := ${`Final settlement / gratuity — ${emp?.nm ?? ""}`}, p_lines := ${sql.json(lines)}, p_bypass_ledger_scope := ${true}
        ) AS id`)?.[0]?.id;

        // clear outstanding advances (recovered from the settlement)
        if (Number(s.advance_deduction) > 0) {
          await sql`UPDATE public.employee_advances_loans SET remaining_balance = 0, status = 'Closed', updated_at = now()
            WHERE employee_id = ${s.employee_id} AND deleted_at IS NULL AND lower(status) = 'active' AND lower(type) = 'advance'`;
        }
        if (s.separation_id) {
          await sql`UPDATE public.hr_employee_separations SET settlement_status = 'paid', final_settlement_id = ${id}, updated_at = now() WHERE id = ${s.separation_id}`;
        }
        await sql`UPDATE public.hr_gratuity_settlements SET status = 'paid', paid_roznamcha_id = ${jid}, paid_at = now(), updated_by = ${actorId}, updated_at = now() WHERE id = ${id}`;
        await sql`COMMIT`;
        return { id, paid: true, journalId: jid };
      } catch (e) {
        await sql`ROLLBACK`;
        throw e;
      }
    });
  }
}

export const hrGratuityService = new HrGratuityService();
