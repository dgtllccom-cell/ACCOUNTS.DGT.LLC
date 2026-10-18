import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { orgRowInSessionScope, recordInHierarchyScope } from "@/lib/api/scope-middleware";
import { rowInSessionDomain } from "@/lib/permissions/domain-scope";
import type { ErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/branch-management/org-chart
 *
 * Builds the live Country -> Branch -> City Branch -> Department -> Employee tree
 * directly from the existing countries/country_branches/city_branches/employees
 * tables — there is no separate "org chart" table to keep in sync. A branch (or
 * employee) shows up here the moment it exists in those tables and disappears the
 * moment it's renamed/deleted there, so the chart can never drift from the real
 * Branch Management records.
 *
 * Reads via withLocalPg (see lib/db/local-postgres.ts) since RLS on these tables
 * is gated on auth.uid(), which is NULL under the app's temp-session bootstrap —
 * falls back to the Supabase admin client if DATABASE_URL isn't configured.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireErpSession();

    const viaPg = await withLocalPg((sql) => loadViaPg(sql, session));
    if (viaPg) return apiOk(viaPg);

    return apiOk(await loadViaSupabase(session));
  } catch (error) {
    return handleApiError(error);
  }
}

type EmployeeRow = {
  id: string;
  name: string;
  designation: string | null;
  department: string | null;
  employeeCode: string | null;
  reportingManagerId: string | null;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
};

function groupEmployeesByDepartment(employees: EmployeeRow[]) {
  const byManager = new Map(employees.map((e) => [e.id, e]));
  const departments = new Map<string, EmployeeRow[]>();
  for (const e of employees) {
    const key = e.department?.trim() || "Unassigned";
    if (!departments.has(key)) departments.set(key, []);
    departments.get(key)!.push(e);
  }
  return Array.from(departments.entries()).map(([name, deptEmployees]) => ({
    name,
    employees: deptEmployees.map((e) => ({
      id: e.id,
      name: e.name,
      designation: e.designation,
      employeeCode: e.employeeCode,
      managerName: e.reportingManagerId ? byManager.get(e.reportingManagerId)?.name ?? null : null
    }))
  }));
}

function buildTree(
  countries: any[],
  countryBranches: any[],
  cityBranches: any[],
  employees: EmployeeRow[]
) {
  const employeesByCityBranch = new Map<string, EmployeeRow[]>();
  const employeesByCountryBranch = new Map<string, EmployeeRow[]>();
  const employeesByCountry = new Map<string, EmployeeRow[]>();
  const unassignedEmployees: EmployeeRow[] = [];

  for (const e of employees) {
    if (e.cityBranchId) {
      if (!employeesByCityBranch.has(e.cityBranchId)) employeesByCityBranch.set(e.cityBranchId, []);
      employeesByCityBranch.get(e.cityBranchId)!.push(e);
    } else if (e.countryBranchId) {
      if (!employeesByCountryBranch.has(e.countryBranchId)) employeesByCountryBranch.set(e.countryBranchId, []);
      employeesByCountryBranch.get(e.countryBranchId)!.push(e);
    } else if (e.countryId) {
      if (!employeesByCountry.has(e.countryId)) employeesByCountry.set(e.countryId, []);
      employeesByCountry.get(e.countryId)!.push(e);
    } else {
      unassignedEmployees.push(e);
    }
  }

  const cityBranchesByCountryBranch = new Map<string, any[]>();
  for (const cb of cityBranches) {
    const key = cb.country_branch_id;
    if (!cityBranchesByCountryBranch.has(key)) cityBranchesByCountryBranch.set(key, []);
    cityBranchesByCountryBranch.get(key)!.push(cb);
  }

  const countryBranchesByCountry = new Map<string, any[]>();
  for (const b of countryBranches) {
    const key = b.country_id;
    if (!countryBranchesByCountry.has(key)) countryBranchesByCountry.set(key, []);
    countryBranchesByCountry.get(key)!.push(b);
  }

  const tree = countries.map((country) => {
    const branches = (countryBranchesByCountry.get(country.id) || []).map((branch) => {
      const cbs = (cityBranchesByCountryBranch.get(branch.id) || []).map((cb) => {
        const cbEmployees = employeesByCityBranch.get(cb.id) || [];
        return {
          id: cb.id,
          name: cb.name,
          code: cb.code,
          cityName: cb.city_name,
          status: cb.status,
          employeeCount: cbEmployees.length,
          departments: groupEmployeesByDepartment(cbEmployees)
        };
      });
      const branchEmployees = employeesByCountryBranch.get(branch.id) || [];
      const totalEmployees =
        branchEmployees.length + cbs.reduce((sum, cb) => sum + cb.employeeCount, 0);
      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        isMain: branch.is_main,
        status: branch.status,
        employeeCount: totalEmployees,
        cityBranchCount: cbs.length,
        departments: groupEmployeesByDepartment(branchEmployees),
        cityBranches: cbs
      };
    });
    const countryEmployees = employeesByCountry.get(country.id) || [];
    const totalEmployees =
      countryEmployees.length + branches.reduce((sum, b) => sum + b.employeeCount, 0);
    return {
      id: country.id,
      name: country.name,
      iso2: country.iso2,
      currencyCode: country.currency_code,
      employeeCount: totalEmployees,
      branchCount: branches.length,
      departments: groupEmployeesByDepartment(countryEmployees),
      branches
    };
  });

  return {
    countries: tree,
    unassigned: {
      employeeCount: unassignedEmployees.length,
      departments: groupEmployeesByDepartment(unassignedEmployees)
    }
  };
}

/**
 * The org chart is a directory of the caller's OWN hierarchy: countries / branches / employees inside its scope, and only the
 * branches of its operational domain (a Business login never receives a Shipping Line branch or its employees, and the reverse).
 */
function scopeOrgInputs(session: ErpSession, countries: any[], countryBranches: any[], cityBranches: any[], employees: EmployeeRow[]) {
  if (session.isSuperAdmin) return { countries, countryBranches, cityBranches, employees };
  const city = cityBranches.filter((b) => rowInSessionDomain(session, b.operational_domain) && orgRowInSessionScope(session, "cityBranch", b));
  const cityIds = new Set(city.map((b) => b.id));
  return {
    countries: countries.filter((c) => orgRowInSessionScope(session, "country", c)),
    countryBranches: countryBranches.filter((b) => orgRowInSessionScope(session, "countryBranch", b)),
    cityBranches: city,
    // an employee filed under a city branch follows that branch (domain + scope); branch-less employees follow the hierarchy scope
    employees: employees.filter((e) =>
      e.cityBranchId ? cityIds.has(e.cityBranchId) : recordInHierarchyScope(session, { country_id: e.countryId, country_branch_id: e.countryBranchId, city_branch_id: null })
    ),
  };
}

async function loadViaPg(sql: any, session: ErpSession) {
  const countries = await sql`
    select id, name, iso2, currency_code
    from public.countries
    where deleted_at is null
    order by name
  `;

  const countryBranches = await sql`
    select id, country_id, name, code, is_main, status
    from public.country_branches
    where deleted_at is null
    order by name
  `;

  const cityBranches = await sql`
    select id, country_id, country_branch_id, name, code, city_name, status, operational_domain
    from public.city_branches
    where deleted_at is null
    order by name
  `;

  const employeeRows = await sql`
    select
      e.id, e.designation, e.department, e.employee_code, e.reporting_manager_id,
      e.country_id, e.country_branch_id, e.city_branch_id,
      coalesce(c.customer_name, 'Unnamed Employee') as person_name
    from public.employees e
    left join public.customers c on c.id = e.person_master_id
    where e.deleted_at is null
    order by person_name
  `;

  const employees: EmployeeRow[] = employeeRows.map((e: any) => ({
    id: e.id,
    name: e.person_name,
    designation: e.designation,
    department: e.department,
    employeeCode: e.employee_code,
    reportingManagerId: e.reporting_manager_id,
    countryId: e.country_id,
    countryBranchId: e.country_branch_id,
    cityBranchId: e.city_branch_id
  }));

  const scoped = scopeOrgInputs(session, countries, countryBranches, cityBranches, employees);
  return buildTree(scoped.countries, scoped.countryBranches, scoped.cityBranches, scoped.employees);
}

async function loadViaSupabase(session: ErpSession) {
  const admin = createSupabaseAdminClient();

  const { data: countries } = await admin
    .from("countries")
    .select("id, name, iso2, currency_code")
    .is("deleted_at", null)
    .order("name");

  const { data: countryBranches } = await admin
    .from("country_branches")
    .select("id, country_id, name, code, is_main, status")
    .is("deleted_at", null)
    .order("name");

  const { data: cityBranches } = await admin
    .from("city_branches")
    .select("id, country_id, country_branch_id, name, code, city_name, status, operational_domain")
    .is("deleted_at", null)
    .order("name");

  const { data: employeeRows } = await admin
    .from("employees")
    .select("id, designation, department, employee_code, reporting_manager_id, country_id, country_branch_id, city_branch_id, person_master_id")
    .is("deleted_at", null);

  const personIds = Array.from(new Set((employeeRows ?? []).map((e: any) => e.person_master_id).filter(Boolean)));
  const { data: persons } = personIds.length
    ? await admin.from("customers").select("id, customer_name").in("id", personIds)
    : { data: [] as any[] };
  const nameById = new Map((persons ?? []).map((p: any) => [p.id, p.customer_name]));

  const employees: EmployeeRow[] = (employeeRows ?? []).map((e: any) => ({
    id: e.id,
    name: nameById.get(e.person_master_id) || "Unnamed Employee",
    designation: e.designation,
    department: e.department,
    employeeCode: e.employee_code,
    reportingManagerId: e.reporting_manager_id,
    countryId: e.country_id,
    countryBranchId: e.country_branch_id,
    cityBranchId: e.city_branch_id
  }));

  const scoped = scopeOrgInputs(session, countries ?? [], countryBranches ?? [], cityBranches ?? [], employees);
  return buildTree(scoped.countries, scoped.countryBranches, scoped.cityBranches, scoped.employees);
}
