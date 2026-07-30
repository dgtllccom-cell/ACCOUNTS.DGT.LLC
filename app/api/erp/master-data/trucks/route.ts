import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateFormSerials } from "@/lib/services/form-serials";

/**
 * Truck Registration master (Settings -> Truck Management).
 * One central truck record reused by all loading forms. Secure + scoped.
 * Table: trucks (migration 20260801_truck_registration.sql).
 */
const COLS =
  "id, country_id, country_branch_id, city_branch_id, super_admin_serial, country_serial, branch_serial, entry_serial, truck_serial, truck_number, registration_number, registration_country_id, truck_type, make, model, manufacturing_year, color, chassis_number, engine_number, capacity, owner_name, owner_mobile, transport_company, driver_name, driver_mobile, driver_cnic_passport, registration_expiry_date, insurance_expiry_date, driver_docs_expiry_date, status, notes, is_active, created_at, updated_at";

const TEXT = [
  "truck_serial", "truck_number", "registration_number", "truck_type", "make", "model",
  "color", "chassis_number", "engine_number", "capacity", "owner_name", "owner_mobile",
  "transport_company", "driver_name", "driver_mobile", "driver_cnic_passport", "notes",
];
const DATES = ["registration_expiry_date", "insurance_expiry_date", "driver_docs_expiry_date"];

export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const selectable = searchParams.get("selectable") === "true";

    const supabase = createSupabaseAdminClient();
    let q = supabase.from("trucks").select(COLS).is("deleted_at", null).order("truck_number", { ascending: true });
    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      q = q.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    // #6: expired/inactive/suspended trucks are not selectable for new loadings.
    if (selectable) q = q.eq("status", "active");
    else if (status) q = q.eq("status", status);
    if (search) {
      q = q.or(`truck_number.ilike.%${search}%,registration_number.ilike.%${search}%,owner_name.ilike.%${search}%,driver_name.ilike.%${search}%,transport_company.ilike.%${search}%`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ trucks: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const body = await req.json();

    const truckNumber = typeof body.truck_number === "string" ? body.truck_number.trim() : "";
    if (!truckNumber) return NextResponse.json({ error: "truck_number is required" }, { status: 400 });

    const row: Record<string, unknown> = {
      country_id: body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null),
      country_branch_id: body.country_branch_id ?? session.countryBranchIds?.[0] ?? null,
      city_branch_id: body.city_branch_id ?? session.cityBranchIds?.[0] ?? null,
      registration_country_id: body.registration_country_id ?? null,
      manufacturing_year: body.manufacturing_year ? Number(body.manufacturing_year) : null,
      status: ["active", "inactive", "suspended", "expired"].includes(body.status) ? body.status : "active",
      is_active: true,
      created_by: session.userId,
    };
    for (const f of TEXT) if (body[f] !== undefined) row[f] = body[f] === "" ? null : String(body[f]).trim();
    for (const d of DATES) if (body[d] !== undefined) row[d] = body[d] || null;
    row.truck_number = truckNumber;

    // Four independent serials for the Truck Registration form.
    const serials = await allocateFormSerials("truck", {
      countryId: row.country_id as string | null,
      branchKey: (row.country_branch_id as string | null) ?? (row.city_branch_id as string | null),
    });
    row.super_admin_serial = serials.superAdminSerial;
    row.country_serial = serials.countrySerial;
    row.branch_serial = serials.branchSerial;
    row.entry_serial = serials.entrySerial;
    if (!row.truck_serial) row.truck_serial = serials.entrySerial;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("trucks").insert(row).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ truck: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
