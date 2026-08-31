import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

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

    // employee_salaries_due has scoped RLS and this app's client isn't guaranteed to carry a
    // real service-role key — read via the SECURITY DEFINER RPC (see employees RPCs).
    const { data: records, error } = await (supabase as any).rpc("list_salaries_due", {
      p_month: month || null,
      p_country_id: countryId || null,
      p_branch_id: branchId || null,
      p_status: status || null
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ records: records || [] });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
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

    // 1. Fetch active employees matching scope — via SECURITY DEFINER RPC (see employees RPCs).
    const { data: employees, error: empError } = await (supabase as any).rpc("list_active_employees_in_scope", {
      p_country_id: countryId || null,
      p_branch_id: countryBranchId || null
    });
    if (empError) throw empError;

    if (!employees || employees.length === 0) {
      return NextResponse.json({ message: "No active employees found in selected scope", count: 0 });
    }

    let generatedCount = 0;
    const dueDate = `${salaryMonth}-28`; // Default due date on 28th of the month

    for (const emp of employees) {
      // Check if due record already exists for this employee and month
      const { data: alreadyExists, error: existError } = await (supabase as any).rpc("salary_due_exists", {
        p_employee_id: emp.id,
        p_salary_month: salaryMonth
      });

      if (existError) throw existError;
      if (alreadyExists) continue; // Already generated

      // Calculate recoveries for Loans and Advances
      let advanceRecovery = 0;
      let loanRecovery = 0;

      // Query active advances / loans
      const { data: advLoans, error: alError } = await (supabase as any).rpc("list_employee_advances_loans", {
        p_employee_id: emp.id,
        p_status: "Active"
      });

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
      const { error: insertError } = await (supabase as any).rpc("insert_salary_due", {
        p_payload: {
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
          branch_id: emp.country_branch_id
        },
        p_actor_id: session.userId
      });

      if (insertError) throw insertError;
      generatedCount++;
    }

    return NextResponse.json({ message: `Successfully generated ${generatedCount} salary due records`, count: generatedCount });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
