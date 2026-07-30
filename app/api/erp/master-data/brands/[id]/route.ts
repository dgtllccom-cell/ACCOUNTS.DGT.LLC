import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

/** Product Brands master — update + soft-delete. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_brands", action: "update" });
    const { id } = await context.params;
    const body = await req.json();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.brandCode !== undefined) patch.brand_code = body.brandCode ? String(body.brandCode).trim() : null;
    if (body.brandName !== undefined) patch.brand_name = String(body.brandName).trim();
    if (body.description !== undefined) patch.description = body.description ? String(body.description).trim() : null;
    if (body.countryId !== undefined) patch.country_id = body.countryId ?? null;
    if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("product_brands")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, country_id, brand_code, brand_name, description, is_active")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void translateMasterRecord("product_brands", id, { brand_name: data.brand_name }, "en", session.userId);

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

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_brands", action: "delete" });
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("product_brands")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
