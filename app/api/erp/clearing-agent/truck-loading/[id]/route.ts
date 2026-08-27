import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";

const COLS =
  "id, country_id, country_branch_id, city_branch_id, loading_date, loading_serial, super_admin_serial, country_serial, branch_serial, entry_serial, truck_id, truck_name, truck_number, driver_name, driver_mobile_1, driver_mobile_2, cnic_passport, truck_owner_name, truck_owner_mobile, vehicle_type, goods_name, quantity, unit, net_weight, gross_weight, destination, dest_country_id, dest_state_province_id, dest_district_id, dest_city_id, booking_company_id, remarks, status, is_active, created_at, updated_at";

const FIELDS = [
  "dest_country_id", "dest_state_province_id", "dest_district_id", "dest_city_id",
  "truck_id", "loading_date", "loading_serial", "truck_name", "truck_number", "driver_name",
  "driver_mobile_1", "driver_mobile_2", "cnic_passport", "truck_owner_name",
  "truck_owner_mobile", "vehicle_type", "goods_name", "unit", "destination", "remarks",
  "booking_company_id",
];
const NUM = ["quantity", "net_weight", "gross_weight"];

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const { id } = await context.params;
    const body = await req.json();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f] === "" ? null : body[f];
    for (const n of NUM) if (body[n] !== undefined) patch[n] = body[n] === "" || body[n] === null ? null : Number(body[n]);
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase.from("truck_loadings").update(patch).eq("id", id).is("deleted_at", null).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (patch.goods_name !== undefined || patch.driver_name !== undefined || patch.truck_name !== undefined || patch.truck_owner_name !== undefined) {
      void saveVerifiedEnterpriseRecordTranslations({
        recordTable: "truck_loadings",
        recordId: id,
        originalLanguage: session.preferredLanguage ?? "en",
        fields: [
          { fieldName: "goods_name", value: String((data as any).goods_name ?? ""), mode: "translate" },
          { fieldName: "driver_name", value: String((data as any).driver_name ?? ""), mode: "transliterate" },
          { fieldName: "truck_name", value: String((data as any).truck_name ?? ""), mode: "transliterate" },
          { fieldName: "truck_owner_name", value: String((data as any).truck_owner_name ?? ""), mode: "transliterate" }
        ],
        actorId: session.userId,
        source: "auto"
      });
    }

    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "delete" });
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("truck_loadings")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
