import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "employees", action: "read" });

    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() || "";
    const category = request.nextUrl.searchParams.get("category");
    const status = request.nextUrl.searchParams.get("status");
    const countryId = request.nextUrl.searchParams.get("countryId");
    const branchId = request.nextUrl.searchParams.get("branchId");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "500");

    const employees = (await withLocalPg(async (sql) => {
      const rows = await sql<any[]>`
        SELECT
          e.id,
          e.employee_code,
          e.category,
          COALESCE(c.customer_name, c.company_name, e.employee_code) AS name,
          e.designation,
          e.department,
          e.country_id,
          COALESCE(e.city_branch_id, e.country_branch_id) AS branch_id,
          CASE WHEN e.status = 'Active' THEN true ELSE false END AS is_active,
          e.status,
          e.created_at,
          co.name AS country_name
        FROM public.employees e
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.countries co ON co.id = e.country_id
        WHERE e.deleted_at IS NULL
        ORDER BY e.created_at DESC
      `;
      return rows;
    })) || [];

    const scoped = employees.filter((emp: any) => {
      if (!session.isSuperAdmin && session.countryIds.length > 0 && emp.country_id && !session.countryIds.includes(emp.country_id)) {
        return false;
      }
      if (countryId && emp.country_id !== countryId) return false;
      if (branchId && emp.branch_id !== branchId) return false;
      if (status === "Active" && !emp.is_active) return false;
      if (status === "Inactive" && emp.is_active) return false;
      if (category && emp.category !== category) return false;
      if (search) {
        const haystack = [emp.employee_code, emp.name, emp.designation, emp.department, emp.country_name].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    const limited = scoped.slice(0, limit);
    const active = scoped.filter((d: any) => d.is_active).length;
    return apiOk({
      employees: limited.map((emp: any) => ({
        ...emp,
        country: emp.country_name ? { name: emp.country_name } : undefined
      })),
      summary: { total: scoped.length, active, inactive: scoped.length - active }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "employees", action: "create" });

    const body = await request.json();
    const { employeeCode, name, designation, department, countryId, branchId, isActive } = body;

    if (!name || !employeeCode) {
      return new Response(JSON.stringify({ error: "name and employeeCode required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const db = createSupabaseAdminClient();
    const insertRow: any = {
      employee_code: employeeCode,
      name,
      designation: designation || null,
      department: department || null,
      country_id: countryId,
      branch_id: branchId || null,
      is_active: isActive !== false,
      created_at: new Date().toISOString()
    };
    const { data, error } = await db
      .from("employees")
      .insert([insertRow])
      .select();

    if (error) throw error;
    return apiOk({ employee: data?.[0] }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
