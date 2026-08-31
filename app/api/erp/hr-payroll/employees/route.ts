import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { ensureEmployeesTable } from "@/lib/services/ensure-employees-table";
import { localizeRecordGroups } from "@/lib/i18n/localize-records";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

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
    // Auto-sync any unlinked persons in `customers` who have an Owner / Employee role
    try {
      await withLocalPg(async (sql) => {
        const unlinked = await sql`
          SELECT c.id, c.customer_name, c.gender, c.country_id, c.created_at
          FROM public.customers c
          WHERE c.gender IN ('Country Owner', 'Branch Owner', 'Company Owner', 'Manager', 'Normal Staff', 'Employee')
            AND NOT EXISTS (
              SELECT 1 FROM public.employees e WHERE e.person_master_id = c.id
            )
        `;
        if (unlinked && unlinked.length > 0) {
          for (const u of unlinked) {
            const countRes = await sql`SELECT count(*)::int as c FROM public.employees`;
            const code = `EMP-${String((countRes[0]?.c || 0) + 1).padStart(4, "0")}`;
            const desig = u.gender === 'Country Owner' ? 'Country Director / Managing Partner'
              : u.gender === 'Branch Owner' ? 'Branch Owner / Manager'
              : u.gender === 'Company Owner' ? 'Company Owner / Partner'
              : u.gender === 'Manager' ? 'General Manager'
              : 'Office Staff';
            const dept = (u.gender === 'Country Owner' || u.gender === 'Branch Owner' || u.gender === 'Company Owner')
              ? 'Executive Management'
              : 'General Operations';
            await sql`
              INSERT INTO public.employees (
                id, person_master_id, employee_code, category, designation, department,
                country_id, status, created_at, updated_at
              ) VALUES (
                gen_random_uuid(), ${u.id}, ${code}, ${u.gender}, ${desig}, ${dept},
                ${u.country_id || null}, 'Active', ${u.created_at || new Date().toISOString()}, NOW()
              )
              ON CONFLICT DO NOTHING
            `;
          }
        }
      });
    } catch (syncErr) {
      rethrowIfNextControlFlow(syncErr);
      console.warn("[EMPLOYEES] Auto-sync unlinked persons warning:", syncErr);
    }

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

    // Resolve all visible related records first so both display and search operate on the
    // same localized values. This keeps the table from mixing raw English company/branch/country
    // names with translated employee/person fields.
    if (employees.length > 0 && lang) {
      // One shared DB connection for every related record set instead of six separate
      // connect/query/disconnect cycles against the remote pooler (~2 s each).
      const [locEmp, locPersons, locCountries, locCountryBranches, locCityBranches] = await localizeRecordGroups(
        [
          { records: employees, table: "employees", fields: ["full_name"] },
          {
            records: employees.map((e: any) => e.person).filter(Boolean),
            table: "customers",
            fields: ["customer_name", "company_name"]
          },
          { records: employees.map((e: any) => e.country).filter(Boolean), table: "countries", fields: ["name"] },
          {
            records: employees.map((e: any) => e.country_branch).filter(Boolean),
            table: "country_branches",
            fields: ["name"]
          },
          {
            records: employees.map((e: any) => e.city_branch).filter(Boolean),
            table: "city_branches",
            fields: ["name"]
          }
        ],
        lang
      );

      const personMap = new Map(locPersons.map((p: any) => [p.id, p]));
      const countryMap = new Map(locCountries.map((c: any) => [c.id, c]));
      const countryBranchMap = new Map(locCountryBranches.map((b: any) => [b.id, b]));
      const cityBranchMap = new Map(locCityBranches.map((b: any) => [b.id, b]));

      employees = locEmp.map((e: any) => ({
        ...e,
        person: e.person ? personMap.get(e.person.id) || e.person : e.person,
        country: e.country ? countryMap.get(e.country.id) || e.country : e.country,
        country_branch: e.country_branch ? countryBranchMap.get(e.country_branch.id) || e.country_branch : e.country_branch,
        city_branch: e.city_branch ? cityBranchMap.get(e.city_branch.id) || e.city_branch : e.city_branch
      }));
    }

    // Filter by search terms across all visible fields if provided.
    let filtered = employees || [];
    if (search) {
      filtered = filtered.filter((emp: any) => {
        const haystack = [
          emp.person?.customer_name,
          emp.person?.first_name,
          emp.person?.last_name,
          emp.person?.company_name,
          emp.full_name,
          emp.employee_code,
          emp.category,
          emp.designation,
          emp.department,
          emp.status,
          emp.country?.name,
          emp.country_branch?.name,
          emp.city_branch?.name,
          emp.person?.mobile,
          emp.person?.whatsapp,
          emp.person?.email,
          emp.person?.address
        ].map((v) => String(v || "").toLowerCase()).join(" ");
        return haystack.includes(search);
      });
    }

    return NextResponse.json({ employees: filtered });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
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

      // Validate session.userId exists in public.profiles to prevent foreign key violation
      let validCreatedBy: string | null = null;
      if (session?.userId) {
        try {
          const [prof] = await sql`SELECT id FROM public.profiles WHERE id = ${session.userId} LIMIT 1`;
          if (prof?.id) {
            validCreatedBy = prof.id;
          }
        } catch {
          validCreatedBy = null;
        }
      }

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
          ${deductionAccountId || null}, ${validCreatedBy}, ${superAdminSerial}, ${countrySerial}, ${branchSerial}, ${entrySerial}
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
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
