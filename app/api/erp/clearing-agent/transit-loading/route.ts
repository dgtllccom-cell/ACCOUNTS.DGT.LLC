import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";

/** Clearing Agent — Transit Loading (secure CRUD). Table: transit_truck_loadings. */
const COLS =
  "id, country_id, country_branch_id, city_branch_id, super_admin_serial, country_serial, branch_serial, entry_serial, truck_id, transit_date, transit_serial, transit_company, transit_company_id, truck_number, driver_name, driver_mobile, goods_name, quantity, unit, transit_route, border, destination, dest_country_id, dest_state_province_id, dest_district_id, dest_city_id, customs_information, container_number, seal_number, remarks, status, is_active, created_at, updated_at";

const FIELDS = [
  "truck_id", "transit_date", "transit_serial", "transit_company", "transit_company_id", "truck_number", "driver_name", "driver_mobile",
  "goods_name", "unit", "transit_route", "border", "destination", "customs_information", "container_number", "seal_number", "remarks",
  "dest_country_id", "dest_state_province_id", "dest_district_id", "dest_city_id",
];
const NUM = ["quantity"];

export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const supabase = createSupabaseAdminClient();
    let q = supabase.from("transit_truck_loadings").select(COLS).is("deleted_at", null).order("transit_date", { ascending: false });
    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      q = q.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    if (search) {
      q = q.or(`truck_number.ilike.%${search}%,transit_company.ilike.%${search}%,goods_name.ilike.%${search}%,transit_serial.ilike.%${search}%,container_number.ilike.%${search}%`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ records: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const body = await req.json();
    if (!body.truck_number && !body.transit_company && !body.goods_name) {
      return NextResponse.json({ error: "truck_number, transit_company or goods_name is required" }, { status: 400 });
    }
    const row: Record<string, unknown> = {
      country_id: body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null),
      country_branch_id: body.country_branch_id ?? session.countryBranchIds?.[0] ?? null,
      city_branch_id: body.city_branch_id ?? session.cityBranchIds?.[0] ?? null,
      status: "active", is_active: true, created_by: session.userId,
    };
    for (const f of FIELDS) if (body[f] !== undefined) row[f] = body[f] === "" ? null : body[f];
    for (const n of NUM) if (body[n] !== undefined && body[n] !== "" && body[n] !== null) row[n] = Number(body[n]);
    if (!row.transit_date) row.transit_date = new Date().toISOString().slice(0, 10);

    const serials = await allocateFormSerials("transit_truck_loading", {
      countryId: row.country_id as string | null,
      branchKey: (row.country_branch_id as string | null) ?? (row.city_branch_id as string | null),
    });
    row.super_admin_serial = serials.superAdminSerial;
    row.country_serial = serials.countrySerial;
    row.branch_serial = serials.branchSerial;
    row.entry_serial = serials.entrySerial;
    if (!row.transit_serial) row.transit_serial = serials.entrySerial;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("transit_truck_loadings").insert(row).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void saveVerifiedEnterpriseRecordTranslations({
      recordTable: "transit_truck_loadings",
      recordId: (data as any).id,
      originalLanguage: session.preferredLanguage ?? "en",
      fields: [
        { fieldName: "goods_name", value: String(row.goods_name ?? ""), mode: "translate" },
        { fieldName: "driver_name", value: String(row.driver_name ?? ""), mode: "transliterate" }
      ],
      actorId: session.userId,
      source: "auto"
    });

    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
