import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { ensureEmployeesTable } from "@/lib/services/ensure-employees-table";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

function isSchemaCacheError(errMsg: string) {
  if (!errMsg) return false;
  const msg = errMsg.toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("relation \"employees\" does not exist") ||
    msg.includes("relation \"public.employees\" does not exist")
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    let supabase = await createServerSupabaseClient();

    const searchParams = request.nextUrl.searchParams;
    const countryId = searchParams.get("countryId");
    const branchId = searchParams.get("branchId");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim().toLowerCase();

    // Reads go through a SECURITY DEFINER RPC (list_employees_with_relations) rather than a
    // direct .from("employees").select(...) — employees has RLS enabled with scope-based
    // policies (mirroring customers_scope_read), and the Supabase client used by this app is
    // not guaranteed to carry a real service-role key that bypasses RLS. The RPC returns the
    // same joined person/country/branch shape the client already expects.
    // Cast to a loosely-typed client for these RPC calls — the generated Database types
    // haven't been regenerated since the migration added these functions (same pattern used
    // by lib/services/enterprise-multilingual-service.ts's EnterpriseDbClient cast).
    let { data: rpcResult, error } = await (supabase as any).rpc("list_employees_with_relations", {
      p_country_id: countryId || null,
      p_branch_id: branchId || null,
      p_category: category || null,
      p_status: status || null
    });

    if (error && isSchemaCacheError(error.message)) {
      console.log("[HR-PAYROLL] Schema cache error detected on GET /employees, attempting auto-repair...");
      await ensureEmployeesTable();
      supabase = await createServerSupabaseClient();
      const retry = await (supabase as any).rpc("list_employees_with_relations", {
        p_country_id: countryId || null,
        p_branch_id: branchId || null,
        p_category: category || null,
        p_status: status || null
      });
      rpcResult = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let employees: any[] = Array.isArray(rpcResult) ? rpcResult : [];
    const lang = (searchParams.get("lang") || "en") as any;

    // Filter by search terms across all fields if provided
    let filtered = employees || [];
    if (search) {
      filtered = filtered.filter((emp: any) => {
        const name = String(emp.person?.customer_name || "").toLowerCase();
        const firstName = String(emp.person?.first_name || "").toLowerCase();
        const lastName = String(emp.person?.last_name || "").toLowerCase();
        const fullName = String(emp.full_name || "").toLowerCase();
        const company = String(emp.person?.company_name || "").toLowerCase();
        const mobile = String(emp.person?.mobile || "").toLowerCase();
        const whatsapp = String(emp.person?.whatsapp || "").toLowerCase();
        const code = String(emp.employee_code || "").toLowerCase();
        const desig = String(emp.designation || "").toLowerCase();
        const dept = String(emp.department || "").toLowerCase();
        const cat = String(emp.category || "").toLowerCase();
        const country = String(emp.country?.name || "").toLowerCase();
        const branch = String(emp.branch?.name || "").toLowerCase();
        return (
          name.includes(search) ||
          firstName.includes(search) ||
          lastName.includes(search) ||
          fullName.includes(search) ||
          company.includes(search) ||
          mobile.includes(search) ||
          whatsapp.includes(search) ||
          code.includes(search) ||
          desig.includes(search) ||
          dept.includes(search) ||
          cat.includes(search) ||
          country.includes(search) ||
          branch.includes(search)
        );
      });
    }

    if (filtered.length > 0 && lang) {
      filtered = await localizeRecordNames(filtered, "employees", "full_name", lang);
      const persons = filtered.map((e: any) => e.person).filter(Boolean);
      if (persons.length > 0) {
        const localizedPersons = await localizeRecordNames(persons, "customers", "customer_name", lang);
        const personMap = new Map(localizedPersons.map((p: any) => [p.id, p]));
        filtered = filtered.map((e: any) => ({
          ...e,
          person: e.person ? (personMap.get(e.person.id) || e.person) : e.person
        }));
      }
    }

    return NextResponse.json({ employees: filtered });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    let supabase = await createServerSupabaseClient();
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

    const newEmployeeId = await withLocalPg(async (sql) => {
      // Generate employee code
      const countRes = await sql`SELECT count(*)::int as c FROM public.employees`;
      const empCount = (countRes[0]?.c || 0) + 1;
      const generatedCode = `EMP-${String(empCount).padStart(4, "0")}`;

      // Allocate form serials
      let superAdminSerial = null;
      let countrySerial = null;
      let branchSerial = null;
      let entrySerial = null;
      try {
        const s = await allocateFormSerials("employees", { countryId: countryId || null, branchKey: countryBranchId || null });
        superAdminSerial = s.superAdminSerial;
        countrySerial = s.countrySerial;
        branchSerial = s.branchSerial;
        entrySerial = s.entrySerial;
      } catch {}

      const [row] = await sql`
        INSERT INTO public.employees (
          id, person_master_id, employee_code, category, designation, department,
          country_id, country_branch_id, city_branch_id, reporting_manager_id,
          joining_date, probation_start_date, probation_end_date, employment_type,
          job_status, working_shift, duty_start_time, duty_end_time, weekly_off_day,
          contract_start_date, contract_end_date, status,
          salary_type, basic_salary, salary_currency, monthly_salary, daily_salary,
          hourly_salary, overtime_rate, allowance, accommodation_allowance,
          transport_allowance, food_allowance, mobile_allowance, other_allowance,
          deduction, advance_deduction, loan_deduction, tax_deduction, net_salary,
          salary_start_date, salary_payment_date, salary_payment_method, salary_schedule,
          salary_schedule_date, salary_expense_account_id, employee_payable_account_id,
          cash_account_id, bank_account_id, advance_salary_account_id, loan_account_id,
          deduction_account_id, created_by, super_admin_serial, country_serial, branch_serial, entry_serial
        ) VALUES (
          gen_random_uuid(), ${personMasterId}, ${generatedCode}, ${category}, ${designation || null}, ${department || null},
          ${countryId || null}, ${countryBranchId || null}, ${cityBranchId || null}, ${reportingManagerId || null},
          ${joiningDate || null}, ${probationStartDate || null}, ${probationEndDate || null}, ${employmentType || null},
          ${jobStatus || null}, ${workingShift || null}, ${dutyStartTime || null}, ${dutyEndTime || null}, ${weeklyOffDay || null},
          ${contractStartDate || null}, ${contractEndDate || null}, ${status || "Active"},
          ${salaryType || "Monthly"}, ${Number(basicSalary || 0)}, ${salaryCurrency || "USD"}, ${Number(monthlySalary || 0)}, ${Number(dailySalary || 0)},
          ${Number(hourlySalary || 0)}, ${Number(overtimeRate || 0)}, ${Number(allowance || 0)}, ${Number(accommodationAllowance || 0)},
          ${Number(transportAllowance || 0)}, ${Number(foodAllowance || 0)}, ${Number(mobileAllowance || 0)}, ${Number(otherAllowance || 0)},
          ${Number(deduction || 0)}, ${Number(advanceDeduction || 0)}, ${Number(loanDeduction || 0)}, ${Number(taxDeduction || 0)}, ${Number(netSalary || 0)},
          ${salaryStartDate || null}, ${salaryPaymentDate || null}, ${salaryPaymentMethod || "Cash"}, ${salarySchedule || "Monthly"},
          ${salaryScheduleDate || "last"}, ${salaryExpenseAccountId || null}, ${employeePayableAccountId || null},
          ${cashAccountId || null}, ${bankAccountId || null}, ${advanceSalaryAccountId || null}, ${loanAccountId || null},
          ${deductionAccountId || null}, ${session.userId || null}, ${superAdminSerial}, ${countrySerial}, ${branchSerial}, ${entrySerial}
        )
        RETURNING id, employee_code, category, designation, department
      `;
      return row.id;
    });

    let newEmployee = null;
    try {
      const { data } = await (supabase as any).rpc("get_employee_with_relations", {
        p_id: newEmployeeId
      });
      newEmployee = data;
    } catch {
      newEmployee = { id: newEmployeeId };
    }

    // Register the employee's name in all 5 languages (honest engine; proper name →
    // needs_review until approved in the Local Translator). Fire-and-forget.
    if (newEmployeeId && (newEmployee as any)?.full_name) {
      void syncRecordTranslations({
        table: "employees",
        recordId: newEmployeeId as string,
        record: { full_name: (newEmployee as any).full_name },
        originalLanguage: session.preferredLanguage ?? "en",
        actorId: session.userId
      }).catch(() => {});
    }

    return NextResponse.json({ employee: newEmployee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
