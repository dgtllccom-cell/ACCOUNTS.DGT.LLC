import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const supabase = createSupabaseAdminClient();
    const body = await request.json();

    const {
      dueRecordId,
      paymentLedgerId, // The selected cash/bank ledger ID for payment
      paymentDate,
      exchangeRate, // Override exchange rate if provided, defaults to 1
      remarks
    } = body;

    if (!dueRecordId || !paymentLedgerId || !paymentDate) {
      return NextResponse.json({ error: "Missing required parameters: dueRecordId, paymentLedgerId, and paymentDate are required" }, { status: 400 });
    }

    // 1. Fetch salary due record and mapped employee profile — via SECURITY DEFINER RPC
    // (see employees RPCs for the full rationale).
    const { data: dueRecord, error: fetchError } = await (supabase as any).rpc("get_salary_due_with_employee", {
      p_id: dueRecordId
    });

    if (fetchError || !dueRecord) {
      return NextResponse.json({ error: "Salary due record not found" }, { status: 404 });
    }

    if (dueRecord.status === "Paid") {
      return NextResponse.json({ error: "Salary has already been transferred and marked Paid" }, { status: 400 });
    }

    const emp = dueRecord.employee;
    if (!emp) {
      return NextResponse.json({ error: "Employee profile not linked to this due record" }, { status: 400 });
    }

    // Validate account links
    const expenseLedgerId = emp.salary_expense_account_id;
    const payableLedgerId = emp.employee_payable_account_id;
    const advanceLedgerId = emp.advance_salary_account_id;
    const loanLedgerId = emp.loan_account_id;

    if (!expenseLedgerId || !payableLedgerId) {
      return NextResponse.json({ 
        error: "Salary Expense Ledger and Employee Payable Ledger must be configured on the employee profile before posting." 
      }, { status: 400 });
    }

    const netSalary = Number(dueRecord.net_salary || 0);
    const advanceRec = Number(dueRecord.advance_recovery || 0);
    const loanRec = Number(dueRecord.loan_recovery || 0);
    const totalDeductions = Number(dueRecord.deductions || 0);
    const grossSalary = Number(dueRecord.basic_salary || 0) + Number(dueRecord.allowances || 0);

    const activeRate = Number(exchangeRate || dueRecord.exchange_rate || 1);
    const localAmount = Math.round(netSalary * activeRate * 100) / 100;

    let journalEntryId: string | null = null;
    let paymentJournalEntryId: string | null = null;

    const employeeName = emp.person?.customer_name || "";
    const employeeCode = emp.employee_code || "";
    const scopeType = dueRecord.branch_id ? "branch" : "country";

    // 2. Post ACCRUAL entry:
    // Debit: Salary Expense Ledger (basic + allowances - general deductions)
    // Credit: Employee Payable Ledger (netSalary)
    // Credit: Advance Salary Ledger (advanceRec, if any)
    // Credit: Loan Ledger (loanRec, if any)
    const accrualLines: any[] = [
      {
        ledgerId: expenseLedgerId,
        debit: grossSalary - totalDeductions,
        credit: 0,
        currency: dueRecord.currency,
        exchangeRate: activeRate,
        paymentEntryType: "debit",
        description: `Salary Accrual for ${employeeName} (${dueRecord.salary_month})`
      },
      {
        ledgerId: payableLedgerId,
        debit: 0,
        credit: netSalary,
        currency: dueRecord.currency,
        exchangeRate: activeRate,
        paymentEntryType: "credit",
        description: `Net Payable Salary for ${employeeName} (${dueRecord.salary_month})`
      }
    ];

    if (advanceRec > 0 && advanceLedgerId) {
      accrualLines.push({
        ledgerId: advanceLedgerId,
        debit: 0,
        credit: advanceRec,
        currency: dueRecord.currency,
        exchangeRate: activeRate,
        paymentEntryType: "credit",
        description: `Advance Salary recovery deduction for ${employeeName}`
      });
    }

    if (loanRec > 0 && loanLedgerId) {
      accrualLines.push({
        ledgerId: loanLedgerId,
        debit: 0,
        credit: loanRec,
        currency: dueRecord.currency,
        exchangeRate: activeRate,
        paymentEntryType: "credit",
        description: `Loan recovery deduction for ${employeeName}`
      });
    }

    const { data: accJournalId, error: accPostError } = await supabase.rpc("post_roznamcha_entry", {
      p_type: scopeType === "branch" ? "branch" : "country",
      p_country_id: dueRecord.country_id,
      p_country_branch_id: dueRecord.branch_id,
      p_city_branch_id: null,
      p_journal_no: "JO-PAYROLL-ACCRUAL",
      p_voucher_no: "VO-PAYROLL-ACCRUAL",
      p_entry_date: paymentDate,
      p_payment_method_id: null,
      p_reference_no: "Payroll Accrual Register",
      p_narration: `Accrued Salary for ${employeeName} - Month: ${dueRecord.salary_month}`,
      p_lines: accrualLines,
      p_bypass_ledger_scope: true
    } as any);

    if (accPostError) {
      return NextResponse.json({ error: "Accrual post error: " + accPostError.message }, { status: 400 });
    }
    journalEntryId = accJournalId as string;

    // 3. Post TRANSFER / PAYMENT entry:
    // Debit: Employee Payable Ledger (netSalary)
    // Credit: Payment Ledger (netSalary)
    if (netSalary > 0) {
      const paymentLines = [
        {
          ledgerId: payableLedgerId,
          debit: netSalary,
          credit: 0,
          currency: dueRecord.currency,
          exchangeRate: activeRate,
          paymentEntryType: "debit",
          description: `Debit Payable Salary for ${employeeName} (${dueRecord.salary_month})`
        },
        {
          ledgerId: paymentLedgerId,
          debit: 0,
          credit: netSalary,
          currency: dueRecord.currency,
          exchangeRate: activeRate,
          paymentEntryType: "credit",
          description: `Salary transfer to ${employeeName} via cash/bank`
        }
      ];

      const { data: payJournalId, error: payPostError } = await supabase.rpc("post_roznamcha_entry", {
        p_type: scopeType === "branch" ? "branch" : "country",
        p_country_id: dueRecord.country_id,
        p_country_branch_id: dueRecord.branch_id,
        p_city_branch_id: null,
        p_journal_no: "JO-PAYROLL-PAYMENT",
        p_voucher_no: "VO-PAYROLL-PAYMENT",
        p_entry_date: paymentDate,
        p_payment_method_id: null,
        p_reference_no: "Payroll Transfer Register",
        p_narration: `Salary payment transfer to ${employeeName} - Month: ${dueRecord.salary_month}`,
        p_lines: paymentLines,
        p_bypass_ledger_scope: true
      } as any);

      if (payPostError) {
        // Rollback accrual entry? Supabase transactions are atomic if called inside single RPC, 
        // but here we are calling sequentially. For safety, we return the error.
        return NextResponse.json({ error: "Payment transfer post error: " + payPostError.message }, { status: 400 });
      }
      paymentJournalEntryId = payJournalId as string;
    }

    // 4. Update loan and advance balances (FIFO by payment_date) — via SECURITY DEFINER RPC.
    if (advanceRec > 0) {
      await (supabase as any).rpc("apply_advance_loan_recovery", {
        p_employee_id: emp.id,
        p_is_loan: false,
        p_recovery_amount: advanceRec
      });
    }

    if (loanRec > 0) {
      await (supabase as any).rpc("apply_advance_loan_recovery", {
        p_employee_id: emp.id,
        p_is_loan: true,
        p_recovery_amount: loanRec
      });
    }

    // 5. Recompute employee advance/loan deductions + net_salary from currently-Active
    // advances/loans — via SECURITY DEFINER RPC.
    await (supabase as any).rpc("recompute_employee_active_deductions", { p_employee_id: emp.id });

    // 6. Finalize salary due record — via SECURITY DEFINER RPC.
    const { data: updatedRecord, error: finalError } = await (supabase as any).rpc("finalize_salary_due_payment", {
      p_id: dueRecordId,
      p_payload: {
        payment_method: "Bank/Cash Transfer",
        payment_account_id: paymentLedgerId,
        exchange_rate: activeRate,
        local_currency_amount: localAmount,
        journal_entry_id: journalEntryId,
        payment_journal_entry_id: paymentJournalEntryId,
        posting_date: paymentDate,
        paid_date: paymentDate
      },
      p_actor_id: session.userId
    });

    if (finalError) {
      return NextResponse.json({ error: finalError.message }, { status: 400 });
    }

    return NextResponse.json({ record: updatedRecord, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
