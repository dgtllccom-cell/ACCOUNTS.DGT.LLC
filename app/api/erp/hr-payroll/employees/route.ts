import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { ensureEmployeesTable } from "@/lib/services/ensure-employees-table";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

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
    let supabase = createSupabaseAdminClient();

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
      supabase = createSupabaseAdminClient();
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

    if (filtered.length > 0 && lang) {
      filtered = await localizeRecordNames(filtered, "employees", "full_name", lang);
      const persons = filtered.map(e => e.person).filter(Boolean);
      if (persons.length > 0) {
        const localizedPersons = await localizeRecordNames(persons, "customers", "customer_name", lang);
        const personMap = new Map(localizedPersons.map(p => [p.id, p]));
        filtered = filtered.map(e => ({
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
    let supabase = createSupabaseAdminClient();
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

    const insertPayload = {
      person_master_id: personMasterId,
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
      deduction_account_id: deductionAccountId || null
    };

    // Write via the create_employee SECURITY DEFINER RPC instead of a direct
    // .from("employees").insert(...) — employees has scoped RLS policies (see
    // employees_scope_insert) and this app's Supabase client is not guaranteed to carry a
    // real service-role key that bypasses RLS on its own. The RPC also auto-generates
    // employee_code and binds created_by to the authenticated actor server-side.
    let { data: newEmployeeId, error: insertError } = await (supabase as any).rpc("create_employee", {
      p_payload: insertPayload,
      p_actor_id: session.userId
    });

    if (insertError && isSchemaCacheError(insertError.message)) {
      console.log("[HR-PAYROLL] Schema cache error detected on insert, auto-repairing...");
      await ensureEmployeesTable();
      supabase = createSupabaseAdminClient();
      const retryInsert = await (supabase as any).rpc("create_employee", {
        p_payload: insertPayload,
        p_actor_id: session.userId
      });
      newEmployeeId = retryInsert.data;
      insertError = retryInsert.error;
    }

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // 4-level serial (Global/Country/Branch/Entry) — independent 'employees' sequence.
    try {
      const s = await allocateFormSerials("employees", { countryId: countryId || null, branchKey: countryBranchId || null });
      await supabase
        .from("employees")
        .update({ super_admin_serial: s.superAdminSerial, country_serial: s.countrySerial, branch_serial: s.branchSerial, entry_serial: s.entrySerial })
        .eq("id", newEmployeeId as string);
    } catch { /* non-fatal */ }

    const { data: newEmployee, error: readBackError } = await (supabase as any).rpc("get_employee_with_relations", {
      p_id: newEmployeeId
    });

    if (readBackError) {
      return NextResponse.json({ error: readBackError.message }, { status: 400 });
    }

    return NextResponse.json({ employee: newEmployee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
