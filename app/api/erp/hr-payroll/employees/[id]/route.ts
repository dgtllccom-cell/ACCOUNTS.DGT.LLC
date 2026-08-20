import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireErpSession();

    let employee = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT 
          e.*,
          CASE WHEN c.id IS NOT NULL THEN json_build_object(
            'id', c.id,
            'customer_name', c.customer_name,
            'company_name', c.company_name,
            'mobile', c.mobile,
            'phone', c.phone,
            'whatsapp', c.whatsapp,
            'email', c.email,
            'address', c.address,
            'first_name', c.first_name,
            'last_name', c.last_name,
            'gender', c.gender
          ) ELSE NULL END as person,
          CASE WHEN co.id IS NOT NULL THEN json_build_object(
            'id', co.id,
            'name', co.name,
            'code', co.iso2
          ) ELSE NULL END as country,
          CASE WHEN cb.id IS NOT NULL THEN json_build_object(
            'id', cb.id,
            'name', cb.name,
            'code', cb.code
          ) ELSE NULL END as country_branch,
          CASE WHEN ctb.id IS NOT NULL THEN json_build_object(
            'id', ctb.id,
            'name', ctb.name,
            'code', ctb.code
          ) ELSE NULL END as city_branch
        FROM public.employees e
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.countries co ON co.id = e.country_id
        LEFT JOIN public.country_branches cb ON cb.id = e.country_branch_id
        LEFT JOIN public.city_branches ctb ON ctb.id = e.city_branch_id
        WHERE e.id = ${params.id}::uuid AND e.deleted_at IS NULL
        LIMIT 1
      `;
      return rows[0] || null;
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");
    if (employee.person) {
      const [resolved] = await localizeRecordNames([employee.person as any], "customers", "customer_name", lang);
      const [resolved2] = await localizeRecordNames([resolved], "customers", "company_name", lang);
      employee = { ...employee, person: resolved2 };
    }

    return NextResponse.json({ employee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requireErpSession();
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

      // Account integrations
      salaryExpenseAccountId,
      employeePayableAccountId,
      cashAccountId,
      bankAccountId,
      advanceSalaryAccountId,
      loanAccountId,
      deductionAccountId
    } = body;

    const updatedEmployee = await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.employees
        SET
          person_master_id = COALESCE(${personMasterId || null}::uuid, person_master_id),
          category = COALESCE(${category || null}, category),
          designation = ${designation || null},
          department = ${department || null},
          country_id = ${countryId || null}::uuid,
          country_branch_id = ${countryBranchId || null}::uuid,
          city_branch_id = ${cityBranchId || null}::uuid,
          reporting_manager_id = ${reportingManagerId || null}::uuid,
          joining_date = ${joiningDate || null}::date,
          probation_start_date = ${probationStartDate || null}::date,
          probation_end_date = ${probationEndDate || null}::date,
          employment_type = ${employmentType || null},
          job_status = ${jobStatus || null},
          working_shift = ${workingShift || null},
          duty_start_time = ${dutyStartTime || null},
          duty_end_time = ${dutyEndTime || null},
          weekly_off_day = ${weeklyOffDay || null},
          contract_start_date = ${contractStartDate || null}::date,
          contract_end_date = ${contractEndDate || null}::date,
          status = COALESCE(${status || null}, status),

          salary_type = ${salaryType || null},
          basic_salary = COALESCE(${basicSalary !== undefined ? Number(basicSalary) : null}, basic_salary),
          salary_currency = COALESCE(${salaryCurrency || null}, salary_currency),
          monthly_salary = COALESCE(${monthlySalary !== undefined ? Number(monthlySalary) : null}, monthly_salary),
          daily_salary = COALESCE(${dailySalary !== undefined ? Number(dailySalary) : null}, daily_salary),
          hourly_salary = COALESCE(${hourlySalary !== undefined ? Number(hourlySalary) : null}, hourly_salary),
          overtime_rate = COALESCE(${overtimeRate !== undefined ? Number(overtimeRate) : null}, overtime_rate),
          allowance = COALESCE(${allowance !== undefined ? Number(allowance) : null}, allowance),
          accommodation_allowance = COALESCE(${accommodationAllowance !== undefined ? Number(accommodationAllowance) : null}, accommodation_allowance),
          transport_allowance = COALESCE(${transportAllowance !== undefined ? Number(transportAllowance) : null}, transport_allowance),
          food_allowance = COALESCE(${foodAllowance !== undefined ? Number(foodAllowance) : null}, food_allowance),
          mobile_allowance = COALESCE(${mobileAllowance !== undefined ? Number(mobileAllowance) : null}, mobile_allowance),
          other_allowance = COALESCE(${otherAllowance !== undefined ? Number(otherAllowance) : null}, other_allowance),
          deduction = COALESCE(${deduction !== undefined ? Number(deduction) : null}, deduction),
          advance_deduction = COALESCE(${advanceDeduction !== undefined ? Number(advanceDeduction) : null}, advance_deduction),
          loan_deduction = COALESCE(${loanDeduction !== undefined ? Number(loanDeduction) : null}, loan_deduction),
          tax_deduction = COALESCE(${taxDeduction !== undefined ? Number(taxDeduction) : null}, tax_deduction),
          net_salary = COALESCE(${netSalary !== undefined ? Number(netSalary) : null}, net_salary),
          salary_start_date = ${salaryStartDate || null}::date,
          salary_payment_date = ${salaryPaymentDate || null}::date,
          salary_payment_method = ${salaryPaymentMethod || null},
          salary_schedule = ${salarySchedule || null},
          salary_schedule_date = ${salaryScheduleDate || null},

          salary_expense_account_id = ${salaryExpenseAccountId || null}::uuid,
          employee_payable_account_id = ${employeePayableAccountId || null}::uuid,
          cash_account_id = ${cashAccountId || null}::uuid,
          bank_account_id = ${bankAccountId || null}::uuid,
          advance_salary_account_id = ${advanceSalaryAccountId || null}::uuid,
          loan_account_id = ${loanAccountId || null}::uuid,
          deduction_account_id = ${deductionAccountId || null}::uuid,
          updated_at = now()
        WHERE id = ${params.id}::uuid AND deleted_at IS NULL
      `;

      const rows = await sql`
        SELECT 
          e.*,
          CASE WHEN c.id IS NOT NULL THEN json_build_object(
            'id', c.id,
            'customer_name', c.customer_name,
            'company_name', c.company_name,
            'mobile', c.mobile,
            'phone', c.phone,
            'whatsapp', c.whatsapp,
            'email', c.email,
            'address', c.address,
            'first_name', c.first_name,
            'last_name', c.last_name,
            'gender', c.gender
          ) ELSE NULL END as person,
          CASE WHEN co.id IS NOT NULL THEN json_build_object(
            'id', co.id,
            'name', co.name,
            'code', co.iso2
          ) ELSE NULL END as country,
          CASE WHEN cb.id IS NOT NULL THEN json_build_object(
            'id', cb.id,
            'name', cb.name,
            'code', cb.code
          ) ELSE NULL END as country_branch,
          CASE WHEN ctb.id IS NOT NULL THEN json_build_object(
            'id', ctb.id,
            'name', ctb.name,
            'code', ctb.code
          ) ELSE NULL END as city_branch
        FROM public.employees e
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.countries co ON co.id = e.country_id
        LEFT JOIN public.country_branches cb ON cb.id = e.country_branch_id
        LEFT JOIN public.city_branches ctb ON ctb.id = e.city_branch_id
        WHERE e.id = ${params.id}::uuid AND e.deleted_at IS NULL
        LIMIT 1
      `;
      return rows[0] || null;
    });

    if (!updatedEmployee) {
      return NextResponse.json({ error: "Employee not found after update" }, { status: 404 });
    }

    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");
    let result = updatedEmployee;
    if (result.person) {
      const [resolved] = await localizeRecordNames([result.person as any], "customers", "customer_name", lang);
      const [resolved2] = await localizeRecordNames([resolved], "customers", "company_name", lang);
      result = { ...result, person: resolved2 };
    }

    if ((result as any)?.person?.customer_name) {
      void syncRecordTranslations({
        table: "employees",
        recordId: params.id,
        record: { full_name: (result as any).person.customer_name },
        originalLanguage: session.preferredLanguage ?? "en",
        actorId: session.userId
      }).catch(() => {});
    }

    return NextResponse.json({ employee: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireErpSession();
    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.employees
        SET deleted_at = now()
        WHERE id = ${params.id}::uuid
      `;
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
