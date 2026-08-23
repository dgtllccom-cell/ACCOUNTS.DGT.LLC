import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

/** Product Categories master — update + soft-delete (secure-by-default). */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_categories", action: "update" });
    const { id } = await context.params;
    const body = await req.json();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.categoryCode !== undefined) patch.category_code = body.categoryCode ? String(body.categoryCode).trim() : null;
    if (body.categoryName !== undefined) patch.category_name = String(body.categoryName).trim();
    if (body.description !== undefined) patch.description = body.description ? String(body.description).trim() : null;
    if (body.countryId !== undefined) patch.country_id = body.countryId ?? null;
    if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("product_categories")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, country_id, category_code, category_name, description, is_active")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void translateMasterRecord("product_categories", id, { category_name: data.category_name }, session.preferredLanguage ?? "en", session.userId);

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

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_categories", action: "delete" });
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("product_categories")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
