import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

/**
 * Product Brands master — list + create.
 * Table: product_brands (id, country_id, brand_code, brand_name, description,
 *        original_language_code, is_active, created_by, timestamps, deleted_at)
 * Uses the centralized multilingual write-time helper (no duplicate logic).
 */
export async function GET() {
  try {
    const session = await requireErpSession();
    const supabase = createSupabaseAdminClient();
    let q = supabase
      .from("product_brands")
      .select("id, country_id, brand_code, brand_name, description, is_active, created_at")
      .is("deleted_at", null)
      .order("brand_name", { ascending: true });

    // Scope: non-super-admins see their own countries' brands (and global ones).
    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      q = q.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = (data || []).map((r: any) => ({
      id: r.id,
      countryId: r.country_id,
      brandCode: r.brand_code,
      brandName: r.brand_name,
      description: r.description,
      isActive: r.is_active,
    }));
    return NextResponse.json({ brands: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    const body = await req.json();

    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    if (!brandName) return NextResponse.json({ error: "brandName is required" }, { status: 400 });

    const countryId = body.countryId ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("product_brands")
      .insert({
        country_id: countryId,
        brand_code: body.brandCode ? String(body.brandCode).trim() : null,
        brand_name: brandName,
        description: body.description ? String(body.description).trim() : null,
        is_active: true,
        created_by: session.userId,
      })
      .select("id, country_id, brand_code, brand_name, description, is_active")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void translateMasterRecord("product_brands", data.id, { brand_name: data.brand_name }, "en", session.userId);

    return NextResponse.json({
      id: data.id,
      countryId: data.country_id,
      brandCode: data.brand_code,
      brandName: data.brand_name,
      description: data.description,
      isActive: data.is_active,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
