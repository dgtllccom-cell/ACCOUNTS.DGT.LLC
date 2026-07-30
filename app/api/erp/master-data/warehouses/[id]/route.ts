import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

/** Warehouses master — update + soft-delete (secure-by-default). */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "warehouses", action: "update" });
    const { id } = await context.params;
    const body = await req.json();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.warehouseCode !== undefined) patch.warehouse_code = body.warehouseCode ? String(body.warehouseCode).trim() : null;
    if (body.warehouseName !== undefined) patch.warehouse_name = String(body.warehouseName).trim();
    if (body.warehouseType !== undefined) patch.warehouse_type = body.warehouseType ? String(body.warehouseType).trim() : null;
    if (body.address !== undefined) patch.address = body.address ? String(body.address).trim() : null;
    if (body.description !== undefined) patch.description = body.description ? String(body.description).trim() : null;
    if (body.countryId !== undefined) patch.country_id = body.countryId ?? null;
    if (body.countryBranchId !== undefined) patch.country_branch_id = body.countryBranchId ?? null;
    if (body.cityBranchId !== undefined) patch.city_branch_id = body.cityBranchId ?? null;
    if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("warehouses")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, country_id, country_branch_id, city_branch_id, warehouse_code, warehouse_name, warehouse_type, address, description, is_active")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void translateMasterRecord("warehouses", id, { warehouse_name: data.warehouse_name }, "en", session.userId);

    return NextResponse.json({
      id: data.id,
      countryId: data.country_id,
      countryBranchId: data.country_branch_id,
      cityBranchId: data.city_branch_id,
      warehouseCode: data.warehouse_code,
      warehouseName: data.warehouse_name,
      warehouseType: data.warehouse_type,
      address: data.address,
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
