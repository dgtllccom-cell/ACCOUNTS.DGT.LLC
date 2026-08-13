import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "company_registration_types", action: "read" });

    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("company_registration_types")
      .select(`id, code, name, country_id, description, is_active, created_at, country:countries(name)`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    const active = data?.filter((d: any) => d.is_active).length || 0;
    return apiOk({ companyRegistrationTypes: data || [], summary: { total: data?.length || 0, active, inactive: (data?.length || 0) - active } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "company_registration_types", action: "create" });

    const body = await request.json();
    const { name, code, countryId, description, isActive } = body;

    if (!name || !code) {
      return new Response(JSON.stringify({ error: "name and code required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("company_registration_types")
      .insert([{ name, code, country_id: countryId || null, description: description || null, is_active: isActive !== false, created_at: new Date().toISOString() }])
      .select();

    if (error) throw error;
    return apiOk({ companyRegistrationType: data?.[0] }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
