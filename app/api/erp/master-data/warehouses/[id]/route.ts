import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

const COLS =
  "id, country_id, state_province_id, district_id, city_id, area_id, owner_name, warehouse_code, warehouse_name, warehouse_type, full_address, contact_number, status, description, is_active, created_at, updated_at";

/** Warehouses master — update + soft-delete (secure-by-default). */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "warehouses", action: "update" });
    const { id } = await context.params;
    const body = await req.json();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const setStr = (k: string, col: string) => { if (body[k] !== undefined) patch[col] = body[k] ? String(body[k]).trim() : null; };
    setStr("warehouse_name", "warehouse_name");
    setStr("owner_name", "owner_name");
    setStr("warehouse_type", "warehouse_type");
    setStr("warehouse_code", "warehouse_code");
    setStr("full_address", "full_address");
    setStr("description", "description");
    if (body.contact_number !== undefined) patch.contact_number = body.contact_number ?? null;
    if (body.status !== undefined) patch.status = body.status ? String(body.status).trim() : "Active";
    if (body.country_id !== undefined) patch.country_id = body.country_id ?? null;
    if (body.state_province_id !== undefined) patch.state_province_id = body.state_province_id ?? null;
    if (body.district_id !== undefined) patch.district_id = body.district_id ?? null;
    if (body.city_id !== undefined) patch.city_id = body.city_id ?? null;
    if (body.area_id !== undefined) patch.area_id = body.area_id ?? null;
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("warehouses")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select(COLS)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void translateMasterRecord("warehouses", id, { warehouse_name: data.warehouse_name }, session.preferredLanguage ?? "en", session.userId);

    return NextResponse.json({ warehouse: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "warehouses", action: "delete" });
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("warehouses")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
