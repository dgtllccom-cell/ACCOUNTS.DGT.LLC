import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const supabase = createSupabaseAdminClient();
    
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month"); // e.g. '2026-07'
    const countryId = searchParams.get("countryId");
    const branchId = searchParams.get("branchId");
    const status = searchParams.get("status");

    let query = supabase
      .from("employee_salaries_due")
      .select(`
        *,
        employee:employees (
          id,
          employee_code,
          category,
          designation,
          basic_salary,
          salary_currency,
          salary_expense_account_id,
          employee_payable_account_id,
          cash_account_id,
          bank_account_id,
          person:customers!person_master_id (
            customer_name,
            company_name
          )
        )
      `)
      .is("deleted_at", null);

    if (month) query = query.eq("salary_month", month);
    if (countryId) query = query.eq("country_id", countryId);
    if (branchId) query = query.eq("branch_id", branchId);
    if (status) query = query.eq("status", status);

    const { data: records, error } = await query.order("due_date", { ascending: false });

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

    const { salaryMonth, countryId, countryBranchId } = body;

    if (!salaryMonth) {
      return NextResponse.json({ error: "Salary Month (YYYY-MM) is required" }, { status: 400 });
    }

    // 1. Fetch active employees matching scope
    let empQuery = supabase
      .from("employees")
      .select("*")
      .eq("status", "Active")
      .is("deleted_at", null);

    if (countryId) empQuery = empQuery.eq("country_id", countryId);
    if (countryBranchId) empQuery = empQuery.eq("country_branch_id", countryBranchId);

    const { data: employees, error: empError } = await empQuery;
    if (empError) throw empError;

    if (!employees || employees.length === 0) {
      return NextResponse.json({ message: "No active employees found in selected scope", count: 0 });
    }

    let generatedCount = 0;
    const dueDate = `${salaryMonth}-28`; // Default due date on 28th of the month

    for (const emp of employees) {
      // Check if due record already exists for this employee and month
      const { data: existing, error: existError } = await supabase
        .from("employee_salaries_due")
        .select("id")
        .eq("employee_id", emp.id)
        .eq("salary_month", salaryMonth)
        .is("deleted_at", null)
        .maybeSingle();

      if (existError) throw existError;
      if (existing) continue; // Already generated

      // Calculate recoveries for Loans and Advances
      let advanceRecovery = 0;
      let loanRecovery = 0;

      // Query active advances / loans
      const { data: advLoans, error: alError } = await supabase
        .from("employee_advances_loans")
        .select("*")
        .eq("employee_id", emp.id)
        .eq("status", "Active")
        .is("deleted_at", null);

      if (alError) throw alError;

      if (advLoans && advLoans.length > 0) {
        for (const record of advLoans) {
          // If start_month is set and greater than salaryMonth, skip recovery
          if (record.start_month && record.start_month > salaryMonth) continue;

          const deductionAmount = Math.min(Number(record.monthly_deduction || 0), Number(record.remaining_balance || 0));
          if (deductionAmount > 0) {
            if (record.type.toLowerCase().includes("loan")) {
              loanRecovery += deductionAmount;
            } else {
              advanceRecovery += deductionAmount;
            }
          }
        }
      }

      // Allowances & Deductions total
      const totalAllowances = Number(emp.allowance || 0) + 
                             Number(emp.accommodation_allowance || 0) + 
                             Number(emp.transport_allowance || 0) + 
                             Number(emp.food_allowance || 0) + 
                             Number(emp.mobile_allowance || 0) + 
                             Number(emp.other_allowance || 0);

      // We combine general deductions + advance recovery + loan recovery + tax deductions
      const totalDeductions = Number(emp.deduction || 0) + Number(emp.tax_deduction || 0);
      const netSalary = Math.max(0, Number(emp.basic_salary || 0) + totalAllowances - totalDeductions - advanceRecovery - loanRecovery);

      // Insert salary due registry row
      const { error: insertError } = await supabase
        .from("employee_salaries_due")
        .insert({
          employee_id: emp.id,
          salary_month: salaryMonth,
          due_date: dueDate,
          basic_salary: Number(emp.basic_salary || 0),
          allowances: totalAllowances,
          overtime: Number(emp.overtime_rate || 0),
          deductions: totalDeductions,
          advance_recovery: advanceRecovery,
          loan_recovery: loanRecovery,
          net_salary: netSalary,
          currency: emp.salary_currency || "USD",
          status: "Due",
          country_id: emp.country_id,
          branch_id: emp.country_branch_id,
          created_by: session.userId
        });

      if (insertError) throw insertError;
      generatedCount++;
    }

    return NextResponse.json({ message: `Successfully generated ${generatedCount} salary due records`, count: generatedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
