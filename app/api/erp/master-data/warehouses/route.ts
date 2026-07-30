import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

/**
 * Warehouses master — list + create (secure-by-default).
 * Backs the existing WarehouseForm (features/warehouses) — same field shape,
 * so no duplicate UI/logic. Table: migration 20260730_warehouses_master.sql.
 */
const COLS =
  "id, country_id, state_province_id, district_id, city_id, area_id, owner_name, warehouse_code, warehouse_name, warehouse_type, full_address, contact_number, status, description, is_active, created_at, updated_at";

export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "warehouses", action: "read" });
    const supabase = createSupabaseAdminClient();
    let q = supabase.from("warehouses").select(COLS).is("deleted_at", null).order("warehouse_name", { ascending: true });
    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      q = q.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ warehouses: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "warehouses", action: "create" });
    const body = await req.json();

    const warehouseName = typeof body.warehouse_name === "string" ? body.warehouse_name.trim() : "";
    if (!warehouseName) return NextResponse.json({ error: "warehouse_name is required" }, { status: 400 });

    const countryId = body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("warehouses")
      .insert({
        country_id: countryId,
        state_province_id: body.state_province_id ?? null,
        district_id: body.district_id ?? null,
        city_id: body.city_id ?? null,
        area_id: body.area_id ?? null,
        owner_name: body.owner_name ? String(body.owner_name).trim() : null,
        warehouse_code: body.warehouse_code ? String(body.warehouse_code).trim() : null,
        warehouse_name: warehouseName,
        warehouse_type: body.warehouse_type ? String(body.warehouse_type).trim() : null,
        full_address: body.full_address ? String(body.full_address).trim() : null,
        contact_number: body.contact_number ?? null,
        status: body.status ? String(body.status).trim() : "Active",
        description: body.description ? String(body.description).trim() : null,
        is_active: true,
        created_by: session.userId,
      })
      .select(COLS)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void translateMasterRecord("warehouses", data.id, { warehouse_name: data.warehouse_name }, "en", session.userId);

    return NextResponse.json({ warehouse: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
