import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireErpSession();
    const supabase = createSupabaseAdminClient();

    const { data: employee, error } = await supabase
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
      .eq("id", params.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireErpSession();
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

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (personMasterId !== undefined) updateData.person_master_id = personMasterId;
    if (category !== undefined) updateData.category = category;
    if (designation !== undefined) updateData.designation = designation;
    if (department !== undefined) updateData.department = department;
    if (countryId !== undefined) updateData.country_id = countryId || null;
    if (countryBranchId !== undefined) updateData.country_branch_id = countryBranchId || null;
    if (cityBranchId !== undefined) updateData.city_branch_id = cityBranchId || null;
    if (reportingManagerId !== undefined) updateData.reporting_manager_id = reportingManagerId || null;
    if (joiningDate !== undefined) updateData.joining_date = joiningDate || null;
    if (probationStartDate !== undefined) updateData.probation_start_date = probationStartDate || null;
    if (probationEndDate !== undefined) updateData.probation_end_date = probationEndDate || null;
    if (employmentType !== undefined) updateData.employment_type = employmentType || null;
    if (jobStatus !== undefined) updateData.job_status = jobStatus || null;
    if (workingShift !== undefined) updateData.working_shift = workingShift || null;
    if (dutyStartTime !== undefined) updateData.duty_start_time = dutyStartTime || null;
    if (dutyEndTime !== undefined) updateData.duty_end_time = dutyEndTime || null;
    if (weeklyOffDay !== undefined) updateData.weekly_off_day = weeklyOffDay || null;
    if (contractStartDate !== undefined) updateData.contract_start_date = contractStartDate || null;
    if (contractEndDate !== undefined) updateData.contract_end_date = contractEndDate || null;
    if (status !== undefined) updateData.status = status;

    if (salaryType !== undefined) updateData.salary_type = salaryType;
    if (basicSalary !== undefined) updateData.basic_salary = Number(basicSalary || 0);
    if (salaryCurrency !== undefined) updateData.salary_currency = salaryCurrency;
    if (monthlySalary !== undefined) updateData.monthly_salary = Number(monthlySalary || 0);
    if (dailySalary !== undefined) updateData.daily_salary = Number(dailySalary || 0);
    if (hourlySalary !== undefined) updateData.hourly_salary = Number(hourlySalary || 0);
    if (overtimeRate !== undefined) updateData.overtime_rate = Number(overtimeRate || 0);
    if (allowance !== undefined) updateData.allowance = Number(allowance || 0);
    if (accommodationAllowance !== undefined) updateData.accommodation_allowance = Number(accommodationAllowance || 0);
    if (transportAllowance !== undefined) updateData.transport_allowance = Number(transportAllowance || 0);
    if (foodAllowance !== undefined) updateData.food_allowance = Number(foodAllowance || 0);
    if (mobileAllowance !== undefined) updateData.mobile_allowance = Number(mobileAllowance || 0);
    if (otherAllowance !== undefined) updateData.other_allowance = Number(otherAllowance || 0);
    if (deduction !== undefined) updateData.deduction = Number(deduction || 0);
    if (advanceDeduction !== undefined) updateData.advance_deduction = Number(advanceDeduction || 0);
    if (loanDeduction !== undefined) updateData.loan_deduction = Number(loanDeduction || 0);
    if (taxDeduction !== undefined) updateData.tax_deduction = Number(taxDeduction || 0);
    if (netSalary !== undefined) updateData.net_salary = Number(netSalary || 0);
    if (salaryStartDate !== undefined) updateData.salary_start_date = salaryStartDate || null;
    if (salaryPaymentDate !== undefined) updateData.salary_payment_date = salaryPaymentDate || null;
    if (salaryPaymentMethod !== undefined) updateData.salary_payment_method = salaryPaymentMethod;
    if (salarySchedule !== undefined) updateData.salary_schedule = salarySchedule;
    if (salaryScheduleDate !== undefined) updateData.salary_schedule_date = salaryScheduleDate;

    if (salaryExpenseAccountId !== undefined) updateData.salary_expense_account_id = salaryExpenseAccountId || null;
    if (employeePayableAccountId !== undefined) updateData.employee_payable_account_id = employeePayableAccountId || null;
    if (cashAccountId !== undefined) updateData.cash_account_id = cashAccountId || null;
    if (bankAccountId !== undefined) updateData.bank_account_id = bankAccountId || null;
    if (advanceSalaryAccountId !== undefined) updateData.advance_salary_account_id = advanceSalaryAccountId || null;
    if (loanAccountId !== undefined) updateData.loan_account_id = loanAccountId || null;
    if (deductionAccountId !== undefined) updateData.deduction_account_id = deductionAccountId || null;

    const { data: updatedEmployee, error: updateError } = await supabase
      .from("employees")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ employee: updatedEmployee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireErpSession();
    const supabase = createSupabaseAdminClient();

    const { error: deleteError } = await supabase
      .from("employees")
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq("id", params.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
