import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const supabase = createSupabaseAdminClient();
    
    const searchParams = request.nextUrl.searchParams;
    const countryId = searchParams.get("countryId");
    const branchId = searchParams.get("branchId");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim().toLowerCase();

    let query = supabase
      .from("employees")
      .select(`
        *,
        person:customers!person_master_id (
          id,
          customer_name,
          company_name,
          contact_person,
          mobile,
          whatsapp,
          email,
          address
        ),
        country:countries (
          id,
          name,
          currency_code
        ),
        country_branch:country_branches (
          id,
          name,
          code
        ),
        city_branch:city_branches (
          id,
          name,
          code
        )
      `)
      .is("deleted_at", null);

    if (countryId) query = query.eq("country_id", countryId);
    if (branchId) query = query.eq("country_branch_id", branchId);
    if (category) query = query.eq("category", category);
    if (status) query = query.eq("status", status);

    const { data: employees, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Filter by search terms in customer/person fields if provided
    let filtered = employees || [];
    if (search) {
      filtered = filtered.filter((emp: any) => {
        const name = String(emp.person?.customer_name || "").toLowerCase();
        const company = String(emp.person?.company_name || "").toLowerCase();
        const mobile = String(emp.person?.mobile || "").toLowerCase();
        const code = String(emp.employee_code || "").toLowerCase();
        return name.includes(search) || company.includes(search) || mobile.includes(search) || code.includes(search);
      });
    }

    return NextResponse.json({ employees: filtered });
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
      personMasterId,
      category,
      designation,
      department,
      countryId,
      countryBranchId,
      cityBranchId,
      reportingManagerId,
      joiningDate,
      probationStartDate,
      probationEndDate,
      employmentType,
      jobStatus,
      workingShift,
      dutyStartTime,
      dutyEndTime,
      weeklyOffDay,
      contractStartDate,
      contractEndDate,
      status,

      // Salary details
      salaryType,
      basicSalary,
      salaryCurrency,
      monthlySalary,
      dailySalary,
      hourlySalary,
      overtimeRate,
      allowance,
      accommodationAllowance,
      transportAllowance,
      foodAllowance,
      mobileAllowance,
      otherAllowance,
      deduction,
      advanceDeduction,
      loanDeduction,
      taxDeduction,
      netSalary,
      salaryStartDate,
      salaryPaymentDate,
      salaryPaymentMethod,
      salarySchedule,
      salaryScheduleDate,

      // Accounts
      salaryExpenseAccountId,
      employeePayableAccountId,
      cashAccountId,
      bankAccountId,
      advanceSalaryAccountId,
      loanAccountId,
      deductionAccountId
    } = body;

    if (!personMasterId) {
      return NextResponse.json({ error: "Person Master Name is required" }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: "Employee category is required" }, { status: 400 });
    }

    // Auto-generate employee code
    const { count, error: countError } = await supabase
      .from("employees")
      .select("id", { count: "exact", head: true });
    
    if (countError) throw countError;

    const sequence = String((count ?? 0) + 1).padStart(4, "0");
    const employeeCode = `EMP-${sequence}`;

    const { data: newEmployee, error: insertError } = await supabase
      .from("employees")
      .insert({
        person_master_id: personMasterId,
        employee_code: employeeCode,
        category,
        designation,
        department,
        country_id: countryId || null,
        country_branch_id: countryBranchId || null,
        city_branch_id: cityBranchId || null,
        reporting_manager_id: reportingManagerId || null,
        joining_date: joiningDate || null,
        probation_start_date: probationStartDate || null,
        probation_end_date: probationEndDate || null,
        employment_type: employmentType || null,
        job_status: jobStatus || null,
        working_shift: workingShift || null,
        duty_start_time: dutyStartTime || null,
        duty_end_time: dutyEndTime || null,
        weekly_off_day: weeklyOffDay || null,
        contract_start_date: contractStartDate || null,
        contract_end_date: contractEndDate || null,
        status: status || "Active",

        // Salary components
        salary_type: salaryType || "Monthly",
        basic_salary: Number(basicSalary || 0),
        salary_currency: salaryCurrency || "USD",
        monthly_salary: Number(monthlySalary || 0),
        daily_salary: Number(dailySalary || 0),
        hourly_salary: Number(hourlySalary || 0),
        overtime_rate: Number(overtimeRate || 0),
        allowance: Number(allowance || 0),
        accommodation_allowance: Number(accommodationAllowance || 0),
        transport_allowance: Number(transportAllowance || 0),
        food_allowance: Number(foodAllowance || 0),
        mobile_allowance: Number(mobileAllowance || 0),
        other_allowance: Number(otherAllowance || 0),
        deduction: Number(deduction || 0),
        advance_deduction: Number(advanceDeduction || 0),
        loan_deduction: Number(loanDeduction || 0),
        tax_deduction: Number(taxDeduction || 0),
        net_salary: Number(netSalary || 0),
        salary_start_date: salaryStartDate || null,
        salary_payment_date: salaryPaymentDate || null,
        salary_payment_method: salaryPaymentMethod || "Cash",
        salary_schedule: salarySchedule || "Monthly",
        salary_schedule_date: salaryScheduleDate || "last",

        // Accounts linking
        salary_expense_account_id: salaryExpenseAccountId || null,
        employee_payable_account_id: employeePayableAccountId || null,
        cash_account_id: cashAccountId || null,
        bank_account_id: bankAccountId || null,
        advance_salary_account_id: advanceSalaryAccountId || null,
        loan_account_id: loanAccountId || null,
        deduction_account_id: deductionAccountId || null,
        
        created_by: session.userId
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ employee: newEmployee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
