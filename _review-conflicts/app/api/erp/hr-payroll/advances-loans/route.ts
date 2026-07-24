import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const supabase = createSupabaseAdminClient();
    
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");

    let query = supabase
      .from("employee_advances_loans")
      .select(`
        *,
        employee:employees (
          id,
          employee_code,
          person:customers!person_master_id (
            customer_name
          )
        ),
        payment_ledger:ledgers!payment_account_id (
          id,
          name,
          code
        )
      `)
      .is("deleted_at", null);

    if (employeeId) query = query.eq("employee_id", employeeId);
    if (status) query = query.eq("status", status);

    const { data: records, error } = await query.order("payment_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ records });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const supabase = createSupabaseAdminClient();
    const body = await request.json();

    const {
      employeeId,
      type, // 'Salary Advance', 'Employee Loan', etc.
      amount,
      currency,
      paymentDate,
      paymentAccountId, // Cash or Bank ledger ID
      recoveryMethod,
      monthlyDeduction,
      startMonth,
      remarks,
      postToRoznamcha // boolean flag to post to general ledger
    } = body;

    if (!employeeId || !type || !amount || !paymentDate || !paymentAccountId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch employee to check ledger setup
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select(`
        *,
        person:customers!person_master_id (
          customer_name
        )
      `)
      .eq("id", employeeId)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: "Employee details not found" }, { status: 400 });
    }

    // Determine target ledger for the advance/loan based on type
    const employeeLedgerId = type.toLowerCase().includes("loan") 
      ? employee.loan_account_id 
      : employee.advance_salary_account_id;

    if (!employeeLedgerId && postToRoznamcha) {
      return NextResponse.json({ 
        error: `No default accounting ledger (${type.toLowerCase().includes("loan") ? "Loan Account" : "Advance Account"}) is linked for this employee. Please edit the employee profile first.` 
      }, { status: 400 });
    }

    let journalEntryId: string | null = null;

    // 2. Post to Roznamcha if requested
    if (postToRoznamcha) {
      // Accrue or pay directly:
      // Debit: Employee Advance/Loan Ledger
      // Credit: Cash/Bank Ledger
      const lines = [
        {
          ledgerId: employeeLedgerId,
          debit: Number(amount),
          credit: 0,
          currency: currency || "USD",
          exchangeRate: 1,
          paymentEntryType: "debit",
          description: `${type} issued to ${employee.person?.customer_name || ""}`
        },
        {
          ledgerId: paymentAccountId,
          debit: 0,
          credit: Number(amount),
          currency: currency || "USD",
          exchangeRate: 1,
          paymentEntryType: "credit",
          description: `${type} payment from cash/bank`
        }
      ];

      // Auto-generate serial prefixes using database RPC serial generation
      const scopeType = employee.city_branch_id ? "branch" : "country";
      const { data: journalId, error: postError } = await supabase.rpc("post_roznamcha_entry", {
        p_type: scopeType === "branch" ? "branch" : "country",
        p_country_id: employee.country_id,
        p_country_branch_id: employee.country_branch_id,
        p_city_branch_id: employee.city_branch_id,
        p_journal_no: `JO-${type.replace(/\s+/g, "-").toUpperCase()}`,
        p_voucher_no: `VO-${type.replace(/\s+/g, "-").toUpperCase()}`,
        p_entry_date: paymentDate,
        p_payment_method_id: null,
        p_reference_no: "Employee Payroll System",
        p_narration: remarks || `${type} issued to ${employee.person?.customer_name || ""}`,
        p_lines: lines,
        p_bypass_ledger_scope: true
      });

      if (postError) {
        return NextResponse.json({ error: "Failed to post to Roznamcha: " + postError.message }, { status: 400 });
      }

      journalEntryId = journalId as string;
    }

    // 3. Save advance/loan record
    const { data: record, error: insertError } = await supabase
      .from("employee_advances_loans")
      .insert({
        employee_id: employeeId,
        type,
        amount: Number(amount),
        currency: currency || "USD",
        payment_date: paymentDate,
        payment_account_id: paymentAccountId,
        recovery_method: recoveryMethod || "Monthly Salary Deduction",
        monthly_deduction: Number(monthlyDeduction || 0),
        remaining_balance: Number(amount),
        start_month: startMonth || null,
        remarks,
        status: "Active",
        journal_entry_id: journalEntryId,
        created_by: session.userId
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // 4. Update employee active deductions details so that net salary reflects it
    // Wait! Let's increase the deduction metrics on the employee record!
    const updatedDeduction = Number(employee.deduction || 0) + Number(monthlyDeduction || 0);
    const updatedAdvanceDeduction = type.toLowerCase().includes("loan") 
      ? Number(employee.loan_deduction || 0) + Number(monthlyDeduction || 0)
      : Number(employee.advance_deduction || 0) + Number(monthlyDeduction || 0);
    
    const updatedNetSalary = Number(employee.basic_salary || 0) + Number(employee.allowance || 0) - updatedDeduction;

    await supabase
      .from("employees")
      .update({
        deduction: updatedDeduction,
        advance_deduction: type.toLowerCase().includes("loan") ? employee.advance_deduction : updatedAdvanceDeduction,
        loan_deduction: type.toLowerCase().includes("loan") ? updatedAdvanceDeduction : employee.loan_deduction,
        net_salary: updatedNetSalary
      })
      .eq("id", employeeId);

    return NextResponse.json({ record });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
