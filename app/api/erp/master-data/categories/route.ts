import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

/**
 * Product Categories master — list + create (secure-by-default).
 * Table: product_categories (id, country_id, category_code, category_name,
 *        description, original_language_code, is_active, created_by, timestamps)
 * Centralized multilingual write-time helper; role-based authorizeApiScope.
 */
export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_categories", action: "read" });
    const supabase = createSupabaseAdminClient();
    let q = supabase
      .from("product_categories")
      .select("id, country_id, category_code, category_name, description, is_active, created_at")
      .is("deleted_at", null)
      .order("category_name", { ascending: true });

    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      q = q.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = (data || []).map((r: any) => ({
      id: r.id,
      countryId: r.country_id,
      categoryCode: r.category_code,
      categoryName: r.category_name,
      description: r.description,
      isActive: r.is_active,
    }));
    return NextResponse.json({ categories: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_categories", action: "create" });
    const body = await req.json();

    const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim() : "";
    if (!categoryName) return NextResponse.json({ error: "categoryName is required" }, { status: 400 });

    const countryId = body.countryId ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("product_categories")
      .insert({
        country_id: countryId,
        category_code: body.categoryCode ? String(body.categoryCode).trim() : null,
        category_name: categoryName,
        description: body.description ? String(body.description).trim() : null,
        is_active: true,
        created_by: session.userId,
      })
      .select("id, country_id, category_code, category_name, description, is_active")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Registry-driven: syncs category_name + description into record_translations (all 5 languages).
    void syncRecordTranslations({ table: "product_categories", recordId: data.id, record: data, originalLanguage: session.preferredLanguage ?? "en", actorId: session.userId });

    return NextResponse.json({
      id: data.id,
      countryId: data.country_id,
      categoryCode: data.category_code,
      categoryName: data.category_name,
      description: data.description,
      isActive: data.is_active,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
