import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods_master", action: "read" });

    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("goods_master")
      .select(`id, chs_code, name, category, origin_country, brand, sizes, is_active, created_at`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    const active = data?.filter((d: any) => d.is_active).length || 0;
    return apiOk({ goods: data || [], summary: { total: data?.length || 0, active, inactive: (data?.length || 0) - active } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods_master", action: "create" });

    const body = await request.json();
    const { chsCode, name, category, originCountry, brand, sizes, isActive } = body;

    if (!name || !chsCode) {
      return new Response(JSON.stringify({ error: "name and chsCode required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("goods_master")
      .insert([{ chs_code: chsCode, name, category: category || null, origin_country: originCountry || null, brand: brand || null, sizes: sizes || null, is_active: isActive !== false, created_at: new Date().toISOString() }])
      .select();

    if (error) throw error;
    return apiOk({ goods: data?.[0] }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
