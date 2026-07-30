import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

/**
 * Warehouses master — list + create (secure-by-default).
 * Table: warehouses (migration 20260730_warehouses_master.sql)
 * Role-based authorizeApiScope + centralized multilingual write-time helper.
 */
export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "warehouses", action: "read" });
    const supabase = createSupabaseAdminClient();
    let q = supabase
      .from("warehouses")
      .select("id, country_id, country_branch_id, city_branch_id, warehouse_code, warehouse_name, warehouse_type, address, description, is_active, created_at")
      .is("deleted_at", null)
      .order("warehouse_name", { ascending: true });

    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      q = q.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = (data || []).map((r: any) => ({
      id: r.id,
      countryId: r.country_id,
      countryBranchId: r.country_branch_id,
      cityBranchId: r.city_branch_id,
      warehouseCode: r.warehouse_code,
      warehouseName: r.warehouse_name,
      warehouseType: r.warehouse_type,
      address: r.address,
      description: r.description,
      isActive: r.is_active,
    }));
    return NextResponse.json({ warehouses: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "warehouses", action: "create" });
    const body = await req.json();

    const warehouseName = typeof body.warehouseName === "string" ? body.warehouseName.trim() : "";
    if (!warehouseName) return NextResponse.json({ error: "warehouseName is required" }, { status: 400 });

    const countryId = body.countryId ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("warehouses")
      .insert({
        country_id: countryId,
        country_branch_id: body.countryBranchId ?? null,
        city_branch_id: body.cityBranchId ?? null,
        warehouse_code: body.warehouseCode ? String(body.warehouseCode).trim() : null,
        warehouse_name: warehouseName,
        warehouse_type: body.warehouseType ? String(body.warehouseType).trim() : null,
        address: body.address ? String(body.address).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        is_active: true,
        created_by: session.userId,
      })
      .select("id, country_id, country_branch_id, city_branch_id, warehouse_code, warehouse_name, warehouse_type, address, description, is_active")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void translateMasterRecord("warehouses", data.id, { warehouse_name: data.warehouse_name }, "en", session.userId);

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
