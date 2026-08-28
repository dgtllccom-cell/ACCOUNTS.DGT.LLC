import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Scoped employee picker for the HRM screens (lifecycle, KYC, payroll …).
 * Role-gated by guardHr; country scope repeated in the WHERE.
 */
export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const search = sp.get("search")?.trim().toLowerCase() || "";
    const status = sp.get("status") || "";

    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [sql`e.deleted_at IS NULL`];
      if (scope.countryIds !== null) where.push(sql`(e.country_id = ANY(${scope.countryIds}) OR e.country_id IS NULL)`);
      if (scope.cityBranchIds && scope.cityBranchIds.length) {
        where.push(sql`(e.city_branch_id = ANY(${scope.cityBranchIds}) OR e.city_branch_id IS NULL)`);
      }
      if (status) where.push(sql`e.status = ${status}`);
      if (search) where.push(sql`lower(COALESCE(c.customer_name, c.company_name, '') || ' ' || e.employee_code || ' ' || COALESCE(e.designation,'')) LIKE ${"%" + search + "%"}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT e.id, e.employee_code,
               COALESCE(c.customer_name, c.company_name, e.employee_code) AS name,
               e.designation, e.department, e.hr_department_id, e.hr_designation_id,
               e.country_id, e.country_branch_id, e.city_branch_id,
               e.status, e.basic_salary, e.monthly_salary, e.salary_currency,
               co.name AS country_name
        FROM public.employees e
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.countries co ON co.id = e.country_id
        WHERE ${w}
        ORDER BY name ASC
        LIMIT 1000`;
    });
    return apiOk({ rows: rows ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
