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

    // 1. Fetch salary due record and mapped employee profile
    const { data: dueRecord, error: fetchError } = await supabase
      .from("employee_salaries_due")
      .select(`
        *,
        employee:employees (
          id,
          employee_code,
          person:customers!person_master_id (
            customer_name
          ),
          salary_expense_account_id,
          employee_payable_account_id,
          cash_account_id,
          bank_account_id,
          advance_salary_account_id,
          loan_account_id
        )
      `)
      .eq("id", dueRecordId)
      .is("deleted_at", null)
      .single();

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
    });

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
      });

      if (payPostError) {
        // Rollback accrual entry? Supabase transactions are atomic if called inside single RPC, 
        // but here we are calling sequentially. For safety, we return the error.
        return NextResponse.json({ error: "Payment transfer post error: " + payPostError.message }, { status: 400 });
      }
      paymentJournalEntryId = payJournalId as string;
    }

    // 4. Update loan and advance balances
    if (advanceRec > 0) {
      const { data: advances, error: advError } = await supabase
        .from("employee_advances_loans")
        .select("*")
        .eq("employee_id", emp.id)
        .eq("status", "Active")
        .not("type", "ilike", "%loan%")
        .is("deleted_at", null)
        .order("payment_date", { ascending: true });

      if (!advError && advances) {
        let remainingToDeduct = advanceRec;
        for (const adv of advances) {
          if (remainingToDeduct <= 0) break;
          const toDeduct = Math.min(remainingToDeduct, Number(adv.remaining_balance || 0));
          const newBalance = Number(adv.remaining_balance || 0) - toDeduct;
          await supabase
            .from("employee_advances_loans")
            .update({
              remaining_balance: newBalance,
              status: newBalance <= 0 ? "Completed" : "Active"
            })
            .eq("id", adv.id);
          remainingToDeduct -= toDeduct;
        }
      }
    }

    if (loanRec > 0) {
      const { data: loans, error: loanError } = await supabase
        .from("employee_advances_loans")
        .select("*")
        .eq("employee_id", emp.id)
        .eq("status", "Active")
        .ilike("type", "%loan%")
        .is("deleted_at", null)
        .order("payment_date", { ascending: true });

      if (!loanError && loans) {
        let remainingToDeduct = loanRec;
        for (const loan of loans) {
          if (remainingToDeduct <= 0) break;
          const toDeduct = Math.min(remainingToDeduct, Number(loan.remaining_balance || 0));
          const newBalance = Number(loan.remaining_balance || 0) - toDeduct;
          await supabase
            .from("employee_advances_loans")
            .update({
              remaining_balance: newBalance,
              status: newBalance <= 0 ? "Completed" : "Active"
            })
            .eq("id", loan.id);
          remainingToDeduct -= toDeduct;
        }
      }
    }

    // 5. Deduct employee advance/loan deductions from employee profile if balances completed
    const { data: activeAdvLoans } = await supabase
      .from("employee_advances_loans")
      .select("type, monthly_deduction")
      .eq("employee_id", emp.id)
      .eq("status", "Active")
      .is("deleted_at", null);

    let activeLoanDed = 0;
    let activeAdvDed = 0;
    if (activeAdvLoans) {
      for (const item of activeAdvLoans) {
        if (item.type.toLowerCase().includes("loan")) {
          activeLoanDed += Number(item.monthly_deduction || 0);
        } else {
          activeAdvDed += Number(item.monthly_deduction || 0);
        }
      }
    }
    const totalDeds = Number(emp.deduction || 0) + Number(emp.tax_deduction || 0);
    const nextNet = Number(emp.basic_salary || 0) + Number(emp.allowance || 0) - totalDeds - activeAdvDed - activeLoanDed;

    await supabase
      .from("employees")
      .update({
        advance_deduction: activeAdvDed,
        loan_deduction: activeLoanDed,
        net_salary: Math.max(0, nextNet)
      })
      .eq("id", emp.id);

    // 6. Finalize salary due record
    const { data: updatedRecord, error: finalError } = await supabase
      .from("employee_salaries_due")
      .update({
        status: "Paid",
        payment_method: "Bank/Cash Transfer",
        payment_account_id: paymentLedgerId,
        exchange_rate: activeRate,
        local_currency_amount: localAmount,
        journal_entry_id: journalEntryId,
        payment_journal_entry_id: paymentJournalEntryId,
        transfer_date: new Date().toISOString(),
        posting_date: paymentDate,
        paid_date: paymentDate,
        transferred_by: session.userId
      })
      .eq("id", dueRecordId)
      .select()
      .single();

    if (finalError) {
      return NextResponse.json({ error: finalError.message }, { status: 400 });
    }

    return NextResponse.json({ record: updatedRecord, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
