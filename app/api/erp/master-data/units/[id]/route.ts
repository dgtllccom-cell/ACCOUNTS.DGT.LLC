import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

/** Product Units master — update + soft-delete. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_units", action: "update" });
    const { id } = await context.params;
    const body = await req.json();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.unitCode !== undefined) patch.unit_code = String(body.unitCode).trim().toUpperCase();
    if (body.unitName !== undefined) patch.unit_name = String(body.unitName).trim();
    if (body.baseUnitCode !== undefined) patch.base_unit_code = body.baseUnitCode ? String(body.baseUnitCode).trim().toUpperCase() : null;
    if (body.conversionFactor !== undefined) {
      const cf = Number(body.conversionFactor);
      if (!(cf > 0)) return NextResponse.json({ error: "conversionFactor must be greater than 0" }, { status: 400 });
      patch.conversion_factor = cf;
    }
    if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("product_units")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, unit_code, unit_name, base_unit_code, conversion_factor, is_active")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void translateMasterRecord("product_units", id, { unit_name: data.unit_name, unit_code: data.unit_code }, session.preferredLanguage ?? "en", session.userId);

    return NextResponse.json({
      id: data.id,
      unitCode: data.unit_code,
      unitName: data.unit_name,
      baseUnitCode: data.base_unit_code,
      conversionFactor: data.conversion_factor != null ? Number(data.conversion_factor) : 1,
      isActive: data.is_active,
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_units", action: "delete" });
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("product_units")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
