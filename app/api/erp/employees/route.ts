import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "employees", action: "read" });

    const db = createSupabaseAdminClient();
    let qb = db.from("employees").select(`id, employee_code, name, designation, department, country_id, branch_id, is_active, created_at, country:countries(name)`);

    if (!session.isSuperAdmin && session.countryIds.length > 0) {
      qb = qb.in("country_id", session.countryIds);
    }

    const { data, error } = await qb.order("created_at", { ascending: false }).limit(500);

    if (error) throw error;
    const active = data?.filter((d: any) => d.is_active).length || 0;
    return apiOk({ employees: data || [], summary: { total: data?.length || 0, active, inactive: (data?.length || 0) - active } });
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
    const { data, error } = await db
      .from("employees")
      .insert([{ employee_code: employeeCode, name, designation: designation || null, department: department || null, country_id: countryId, branch_id: branchId || null, is_active: isActive !== false, created_at: new Date().toISOString() }])
      .select();

    if (error) throw error;
    return apiOk({ employee: data?.[0] }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
