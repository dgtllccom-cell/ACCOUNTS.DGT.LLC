import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const COLS =
  "id, country_id, country_branch_id, city_branch_id, super_admin_serial, country_serial, branch_serial, entry_serial, truck_serial, truck_number, registration_number, registration_country_id, truck_type, make, model, manufacturing_year, color, chassis_number, engine_number, capacity, owner_name, owner_mobile, transport_company, driver_name, driver_mobile, driver_cnic_passport, registration_expiry_date, insurance_expiry_date, driver_docs_expiry_date, base_state_province_id, base_district_id, base_city_id, status, notes, is_active, created_at, updated_at";

const TEXT = [
  "truck_serial", "truck_number", "registration_number", "truck_type", "make", "model",
  "color", "chassis_number", "engine_number", "capacity", "owner_name", "owner_mobile",
  "transport_company", "driver_name", "driver_mobile", "driver_cnic_passport", "notes",
];
const DATES = ["registration_expiry_date", "insurance_expiry_date", "driver_docs_expiry_date"];

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const { id } = await context.params;
    const body = await req.json();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of TEXT) if (body[f] !== undefined) patch[f] = body[f] === "" ? null : String(body[f]).trim();
    for (const d of DATES) if (body[d] !== undefined) patch[d] = body[d] || null;
    if (body.manufacturing_year !== undefined) patch.manufacturing_year = body.manufacturing_year ? Number(body.manufacturing_year) : null;
    if (body.registration_country_id !== undefined) patch.registration_country_id = body.registration_country_id ?? null;
    if (body.base_state_province_id !== undefined) patch.base_state_province_id = body.base_state_province_id ?? null;
    if (body.base_district_id !== undefined) patch.base_district_id = body.base_district_id ?? null;
    if (body.base_city_id !== undefined) patch.base_city_id = body.base_city_id ?? null;
    if (body.status !== undefined && ["active", "inactive", "suspended", "expired"].includes(body.status)) patch.status = body.status;
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("trucks").update(patch).eq("id", id).is("deleted_at", null).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ truck: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "delete" });
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("trucks")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
