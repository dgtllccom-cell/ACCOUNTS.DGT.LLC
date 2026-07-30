import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateFormSerials } from "@/lib/services/form-serials";

/**
 * Clearing Agent — Truck Loading form (secure, scoped CRUD).
 * Table: truck_loadings (migration 20260731_clearing_agent_truck_forms.sql).
 * Attachments reuse /api/erp/documents (entity_type = 'truck_loading').
 */
const COLS =
  "id, country_id, country_branch_id, city_branch_id, loading_date, loading_serial, super_admin_serial, country_serial, branch_serial, entry_serial, truck_id, truck_name, truck_number, driver_name, driver_mobile_1, driver_mobile_2, cnic_passport, truck_owner_name, truck_owner_mobile, vehicle_type, goods_name, quantity, unit, net_weight, gross_weight, destination, remarks, status, is_active, created_at, updated_at";

export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();

    const supabase = createSupabaseAdminClient();
    let q = supabase.from("truck_loadings").select(COLS).is("deleted_at", null).order("loading_date", { ascending: false });
    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      q = q.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    if (search) {
      q = q.or(`truck_number.ilike.%${search}%,driver_name.ilike.%${search}%,goods_name.ilike.%${search}%,loading_serial.ilike.%${search}%`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ records: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const FIELDS = [
  "truck_id", "loading_date", "loading_serial", "truck_name", "truck_number", "driver_name",
  "driver_mobile_1", "driver_mobile_2", "cnic_passport", "truck_owner_name",
  "truck_owner_mobile", "vehicle_type", "goods_name", "unit", "destination", "remarks",
];
const NUM = ["quantity", "net_weight", "gross_weight"];

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const body = await req.json();

    if (!body.truck_number && !body.goods_name) {
      return NextResponse.json({ error: "truck_number or goods_name is required" }, { status: 400 });
    }

    const row: Record<string, unknown> = {
      country_id: body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null),
      country_branch_id: body.country_branch_id ?? session.countryBranchIds?.[0] ?? null,
      city_branch_id: body.city_branch_id ?? session.cityBranchIds?.[0] ?? null,
      status: "active",
      is_active: true,
      created_by: session.userId,
    };
    for (const f of FIELDS) if (body[f] !== undefined) row[f] = body[f] === "" ? null : body[f];
    for (const n of NUM) if (body[n] !== undefined && body[n] !== "" && body[n] !== null) row[n] = Number(body[n]);
    if (!row.loading_date) row.loading_date = new Date().toISOString().slice(0, 10);

    // Four independent serials for THIS form (never mixed with other modules).
    const serials = await allocateFormSerials("truck_loading", {
      countryId: row.country_id as string | null,
      branchKey: (row.country_branch_id as string | null) ?? (row.city_branch_id as string | null),
    });
    row.super_admin_serial = serials.superAdminSerial;
    row.country_serial = serials.countrySerial;
    row.branch_serial = serials.branchSerial;
    row.entry_serial = serials.entrySerial;
    if (!row.loading_serial) row.loading_serial = serials.entrySerial;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("truck_loadings").insert(row).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
