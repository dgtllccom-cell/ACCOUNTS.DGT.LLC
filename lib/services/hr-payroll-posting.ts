import { withLocalPg } from "@/lib/db/local-postgres";
import type { HrScope } from "@/lib/services/hr-api";

/**
 * HRM Phase 5/7 — payroll accounting posting.
 *
 * Posting reuses the existing post_roznamcha_entry RPC (the same path the
 * per-employee salary transfer already uses). Every payroll run line also gets a
 * linked employee_salaries_due row so the existing Payroll Register / Salary Slip
 * / Employee Ledger stay consistent.
 *
 * Guarantees:
 *   * Only an APPROVED run posts. posted_at is the idempotency guard — a run
 *     cannot post twice.
 *   * Reversal is a controlled contra roznamcha entry; nothing is ever deleted.
 */

type Sql = any;

async function assertRunInScope(sql: Sql, runId: string, scope: HrScope) {
  if (scope.countryIds === null) return;
  const r = await sql`SELECT 1 FROM public.hr_payroll_runs r
    WHERE r.id = ${runId} AND r.deleted_at IS NULL
      AND (r.country_id = ANY(${scope.countryIds}) OR r.country_id IS NULL) LIMIT 1`;
  if (!r?.length) throw new Error("Payroll run not found in your scope.");
}

async function postEntry(
  sql: Sql,
  args: {
    type: "country" | "branch";
    countryId: string | null;
    countryBranchId: string | null;
    entryDate: string;
    journalNo: string;
    voucherNo: string;
    referenceNo: string;
    narration: string;
    lines: any[];
  },
): Promise<string | null> {
  const rows = await sql`
    SELECT public.post_roznamcha_entry(
      p_type := ${args.type}::roznamcha_type,
      p_country_id := ${args.countryId},
      p_country_branch_id := ${args.countryBranchId},
      p_city_branch_id := ${null},
      p_journal_no := ${args.journalNo},
      p_voucher_no := ${args.voucherNo},
      p_entry_date := ${args.entryDate},
      p_payment_method_id := ${null},
      p_reference_no := ${args.referenceNo},
      p_narration := ${args.narration},
      p_lines := ${sql.json(args.lines)},
      p_bypass_ledger_scope := ${true}
    ) AS id`;
  return rows?.[0]?.id ?? null;
}

export class HrPayrollPosting {
  /** APPROVED -> POSTED. Accrual entries + linked employee_salaries_due rows. Idempotent. */
  async post(
    runId: string,
    opts: { taxPayableLedgerId?: string | null },
    actorId: string,
    actorName: string | null,
    scope: HrScope,
  ) {
    return withLocalPg(async (sql) => {
      await sql`BEGIN`;
      try {
        await assertRunInScope(sql, runId, scope);
        const run = (await sql`SELECT * FROM public.hr_payroll_runs WHERE id = ${runId} AND deleted_at IS NULL FOR UPDATE`)?.[0];
        if (!run) throw new Error("Run not found.");
        if (run.status === "posted" || run.status === "paid") { await sql`ROLLBACK`; return { runId, alreadyPosted: true }; }
        if (run.status !== "approved") throw new Error(`Only an approved run can be posted (run is ${run.status}).`);

        const lines = await sql`
          SELECT l.*, e.employee_code, e.salary_expense_account_id, e.employee_payable_account_id,
                 e.advance_salary_account_id, e.deduction_account_id,
                 COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
          FROM public.hr_payroll_run_lines l
          JOIN public.employees e ON e.id = l.employee_id
          LEFT JOIN public.customers c ON c.id = e.person_master_id
          WHERE l.run_id = ${runId} AND l.status = 'calculated'`;
        if (!lines?.length) throw new Error("Run has no calculated lines to post.");

        const missing = lines.filter((l: any) => !l.salary_expense_account_id || !l.employee_payable_account_id);
        if (missing.length) {
          throw new Error(
            `Salary Expense + Employee Payable ledgers must be set on ${missing.length} employee profile(s) before posting: ${missing.slice(0, 5).map((m: any) => m.employee_code).join(", ")}`,
          );
        }

        const scopeType: "country" | "branch" = run.country_branch_id ? "branch" : "country";
        let firstJournalId: string | null = null;

        let __accrualIdx = 0;
        for (const l of lines) {
          __accrualIdx += 1;
          const gross = Number(l.gross_salary);
          const net = Number(l.net_salary);
          const otherDed = Number(l.unpaid_leave_deduction) + Number(l.other_deductions);
          const adv = Number(l.advance_recovery);
          const tax = Number(l.tax_employee);
          const rate = Number(l.exchange_rate) || 1;

          const accrualLines: any[] = [
            { ledgerId: l.salary_expense_account_id, debit: Math.round((gross - otherDed) * 100) / 100, credit: 0, currency: l.currency, exchangeRate: rate, paymentEntryType: "debit", description: `Salary accrual ${l.employee_name} (${run.period_month})` },
            { ledgerId: l.employee_payable_account_id, debit: 0, credit: net, currency: l.currency, exchangeRate: rate, paymentEntryType: "credit", description: `Net payable ${l.employee_name} (${run.period_month})` },
          ];
          if (adv > 0 && l.advance_salary_account_id) {
            accrualLines.push({ ledgerId: l.advance_salary_account_id, debit: 0, credit: adv, currency: l.currency, exchangeRate: rate, paymentEntryType: "credit", description: `Salary advance recovery ${l.employee_name}` });
          }
          const taxLedger = opts.taxPayableLedgerId || l.deduction_account_id;
          if (tax > 0 && taxLedger) {
            accrualLines.push({ ledgerId: taxLedger, debit: 0, credit: tax, currency: l.currency, exchangeRate: rate, paymentEntryType: "credit", description: `Payroll tax withheld ${l.employee_name} (${run.period_month})` });
          } else if (tax > 0) {
            // no tax payable ledger -> fold back into expense so the entry balances
            accrualLines[0].debit = Math.round((accrualLines[0].debit + tax) * 100) / 100;
            accrualLines[1].credit = Math.round((net + tax) * 100) / 100;
          }

          const jid = await postEntry(sql, {
            type: scopeType,
            countryId: run.country_id,
            countryBranchId: run.country_branch_id,
            entryDate: `${run.period_month}-28`,
            journalNo: "JO-PAYROLL-ACCRUAL",
            // roznamcha_entries.voucher_no is globally unique — one voucher per
            // employee accrual line, all sharing the run_no prefix.
            voucherNo: `${run.run_no}-A${String(__accrualIdx).padStart(3, "0")}`,
            referenceNo: `Payroll Run ${run.run_no}`,
            narration: `Accrued salary ${l.employee_name} — ${run.period_month} (${run.run_no})`,
            lines: accrualLines,
          });
          if (!firstJournalId) firstJournalId = jid;

          // linked employee_salaries_due row (journal_entry_id stays NULL — that FK
          // points at the legacy/empty journal_entries table; the live GL is
          // roznamcha_entries, whose id we keep on the run line + the due row's
          // reference is the shared voucher_no = run_no).
          const due = await sql`
            INSERT INTO public.employee_salaries_due
              (employee_id, salary_month, due_date, basic_salary, allowances, overtime, deductions,
               advance_recovery, loan_recovery, net_salary, currency, exchange_rate, local_currency_amount,
               status, posting_date, country_id, branch_id, created_by, approved_by)
            VALUES (${l.employee_id}, ${run.period_month}, ${`${run.period_month}-28`},
              ${Number(l.basic_salary)}, ${Number(l.allowances_total)}, ${Number(l.overtime_amount)},
              ${Math.round((otherDed + tax) * 100) / 100}, ${adv}, 0, ${net}, ${l.currency}, ${rate},
              ${Number(l.local_amount)}, 'Transferred', ${`${run.period_month}-28`},
              ${run.country_id}, ${run.country_branch_id}, ${actorId}, ${actorId})
            ON CONFLICT DO NOTHING
            RETURNING id`;
          const dueId = due?.[0]?.id ?? null;
          await sql`UPDATE public.hr_payroll_run_lines
            SET status = 'posted', salary_due_id = COALESCE(${dueId}, salary_due_id),
                accrual_roznamcha_id = ${jid}, updated_at = now()
            WHERE id = ${l.id}`;
        }

        await sql`UPDATE public.hr_payroll_runs SET status = 'posted', posted_at = now(),
          accrual_journal_entry_id = ${firstJournalId}, idempotency_key = ${`payrollrun:${runId}:post`}, updated_at = now()
          WHERE id = ${runId}`;
        await sql`INSERT INTO public.hr_payroll_run_events (run_id, action, actor_id, actor_name, detail)
          VALUES (${runId}, 'posted', ${actorId}, ${actorName}, ${sql.json({ lines: lines.length, firstJournalId })})`;
        await sql`COMMIT`;
        return { runId, posted: true, lines: lines.length };
      } catch (e) {
        await sql`ROLLBACK`;
        throw e;
      }
    });
  }

  /** POSTED -> PAID. Payment entries (Dr payable / Cr bank) + apply advance recovery + finalise due rows. */
  async markPaid(
    runId: string,
    opts: { paymentLedgerId: string; paymentDate: string },
    actorId: string,
    actorName: string | null,
    scope: HrScope,
  ) {
    if (!opts.paymentLedgerId) throw new Error("A cash/bank payment ledger is required.");
    return withLocalPg(async (sql) => {
      await sql`BEGIN`;
      try {
        await assertRunInScope(sql, runId, scope);
        const run = (await sql`SELECT * FROM public.hr_payroll_runs WHERE id = ${runId} AND deleted_at IS NULL FOR UPDATE`)?.[0];
        if (!run) throw new Error("Run not found.");
        if (run.status === "paid") { await sql`ROLLBACK`; return { runId, alreadyPaid: true }; }
        if (run.status !== "posted") throw new Error(`Only a posted run can be marked Paid (run is ${run.status}).`);

        const lines = await sql`
          SELECT l.*, e.employee_payable_account_id,
                 COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
          FROM public.hr_payroll_run_lines l
          JOIN public.employees e ON e.id = l.employee_id
          LEFT JOIN public.customers c ON c.id = e.person_master_id
          WHERE l.run_id = ${runId} AND l.status = 'posted'`;

        const scopeType: "country" | "branch" = run.country_branch_id ? "branch" : "country";
        let firstPayId: string | null = null;
        let __payIdx = 0;
        for (const l of lines ?? []) {
          __payIdx += 1;
          const net = Number(l.net_salary);
          if (net <= 0) { await sql`UPDATE public.hr_payroll_run_lines SET status = 'paid' WHERE id = ${l.id}`; continue; }
          const rate = Number(l.exchange_rate) || 1;
          const paymentLines = [
            { ledgerId: l.employee_payable_account_id, debit: net, credit: 0, currency: l.currency, exchangeRate: rate, paymentEntryType: "debit", description: `Clear payable ${l.employee_name} (${run.period_month})` },
            { ledgerId: opts.paymentLedgerId, debit: 0, credit: net, currency: l.currency, exchangeRate: rate, paymentEntryType: "credit", description: `Salary paid ${l.employee_name} via cash/bank (${run.period_month})` },
          ];
          const pid = await postEntry(sql, {
            type: scopeType,
            countryId: run.country_id,
            countryBranchId: run.country_branch_id,
            entryDate: opts.paymentDate,
            journalNo: "JO-PAYROLL-PAYMENT",
            voucherNo: run.run_no,
            referenceNo: `Payroll Run ${run.run_no}`,
            narration: `Salary payment ${l.employee_name} — ${run.period_month} (${run.run_no})`,
            lines: paymentLines,
          });
          if (!firstPayId) firstPayId = pid;

          if (Number(l.advance_recovery) > 0) {
            await sql`
              UPDATE public.employee_advances_loans SET
                remaining_balance = GREATEST(0, remaining_balance - LEAST(monthly_deduction, remaining_balance)),
                status = CASE WHEN remaining_balance - LEAST(monthly_deduction, remaining_balance) <= 0 THEN 'Closed' ELSE status END,
                updated_at = now()
              WHERE employee_id = ${l.employee_id} AND deleted_at IS NULL AND lower(status) = 'active' AND lower(type) = 'advance' AND remaining_balance > 0`;
          }
          if (l.salary_due_id) {
            await sql`UPDATE public.employee_salaries_due SET status = 'Paid', payment_account_id = ${opts.paymentLedgerId},
              paid_date = ${opts.paymentDate}, transferred_by = ${actorId}, updated_at = now()
              WHERE id = ${l.salary_due_id}`;
          }
          await sql`UPDATE public.hr_payroll_run_lines SET status = 'paid', payment_roznamcha_id = ${pid}, updated_at = now() WHERE id = ${l.id}`;
        }

        await sql`UPDATE public.hr_payroll_runs SET status = 'paid', paid_at = now(), payment_journal_entry_id = ${firstPayId}, updated_at = now() WHERE id = ${runId}`;
        await sql`INSERT INTO public.hr_payroll_run_events (run_id, action, actor_id, actor_name, detail)
          VALUES (${runId}, 'paid', ${actorId}, ${actorName}, ${sql.json({ paymentLedgerId: opts.paymentLedgerId, firstPayId })})`;
        await sql`COMMIT`;
        return { runId, paid: true };
      } catch (e) {
        await sql`ROLLBACK`;
        throw e;
      }
    });
  }

  /** Controlled reversal — contra entry, run marked 'reversed'. Never deletes journal rows. */
  async reverse(runId: string, reason: string, actorId: string, actorName: string | null, scope: HrScope) {
    return withLocalPg(async (sql) => {
      await sql`BEGIN`;
      try {
        await assertRunInScope(sql, runId, scope);
        const run = (await sql`SELECT * FROM public.hr_payroll_runs WHERE id = ${runId} AND deleted_at IS NULL FOR UPDATE`)?.[0];
        if (!run) throw new Error("Run not found.");
        if (!["posted", "paid"].includes(run.status)) throw new Error("Only a posted or paid run can be reversed.");

        const lines = await sql`
          SELECT l.*, e.salary_expense_account_id, e.employee_payable_account_id, e.advance_salary_account_id, e.deduction_account_id,
                 COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
          FROM public.hr_payroll_run_lines l
          JOIN public.employees e ON e.id = l.employee_id
          LEFT JOIN public.customers c ON c.id = e.person_master_id
          WHERE l.run_id = ${runId} AND l.status IN ('posted','paid')`;
        const scopeType: "country" | "branch" = run.country_branch_id ? "branch" : "country";
        let reversalId: string | null = null;
        for (const l of lines ?? []) {
          const gross = Number(l.gross_salary);
          const net = Number(l.net_salary);
          const otherDed = Number(l.unpaid_leave_deduction) + Number(l.other_deductions);
          const rate = Number(l.exchange_rate) || 1;
          // contra of the accrual: Dr payable / Cr expense
          const contra = [
            { ledgerId: l.employee_payable_account_id, debit: net, credit: 0, currency: l.currency, exchangeRate: rate, paymentEntryType: "debit", description: `Reversal — net payable ${l.employee_name} (${run.period_month})` },
            { ledgerId: l.salary_expense_account_id, debit: 0, credit: Math.round((gross - otherDed) * 100) / 100, currency: l.currency, exchangeRate: rate, paymentEntryType: "credit", description: `Reversal — salary expense ${l.employee_name} (${run.period_month})` },
          ];
          const adv = Number(l.advance_recovery);
          if (adv > 0 && l.advance_salary_account_id) {
            contra.push({ ledgerId: l.advance_salary_account_id, debit: adv, credit: 0, currency: l.currency, exchangeRate: rate, paymentEntryType: "debit", description: `Reversal — advance recovery ${l.employee_name}` });
            contra[1].credit = Math.round((contra[1].credit + adv) * 100) / 100;
          }
          const rid = await postEntry(sql, {
            type: scopeType, countryId: run.country_id, countryBranchId: run.country_branch_id,
            entryDate: new Date().toISOString().slice(0, 10),
            journalNo: "JO-PAYROLL-REVERSAL", voucherNo: run.run_no,
            referenceNo: `Payroll Run ${run.run_no} reversal`,
            narration: `Reversal of payroll ${run.run_no} — ${l.employee_name}: ${reason}`,
            lines: contra,
          });
          if (!reversalId) reversalId = rid;
          await sql`UPDATE public.hr_payroll_run_lines SET reversal_roznamcha_id = ${rid}, updated_at = now() WHERE id = ${l.id}`;
          if (l.salary_due_id) {
            await sql`UPDATE public.employee_salaries_due SET status = 'Reversed', updated_at = now() WHERE id = ${l.salary_due_id}`;
          }
        }
        await sql`UPDATE public.hr_payroll_runs SET status = 'reversed', reversal_journal_entry_id = ${reversalId}, notes = ${reason}, updated_at = now() WHERE id = ${runId}`;
        await sql`INSERT INTO public.hr_payroll_run_events (run_id, action, actor_id, actor_name, detail)
          VALUES (${runId}, 'reversed', ${actorId}, ${actorName}, ${sql.json({ reason, reversalId })})`;
        await sql`COMMIT`;
        return { runId, reversed: true };
      } catch (e) {
        await sql`ROLLBACK`;
        throw e;
      }
    });
  }
}

export const hrPayrollPosting = new HrPayrollPosting();
