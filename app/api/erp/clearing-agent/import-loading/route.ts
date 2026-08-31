import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

/**
 * Clearing Agent — Import Loading (secure, scoped CRUD). Table: import_truck_loadings.
 * withLocalPg, not the RLS-gated Supabase admin client — import_truck_loadings_scope_all's
 * WITH CHECK requires is_super_admin()/can_access_country(), which only evaluates against a
 * real Supabase JWT; createSupabaseAdminClient() has no real service-role key on DEV, so every
 * insert was silently rejected by RLS (confirmed live: POST always 500'd with "new row
 * violates row-level security policy"). Same root cause already fixed for trucks/warehouses.
 */
const FIELDS = [
  "dest_country_id", "dest_state_province_id", "dest_district_id", "dest_city_id",
  "truck_id", "import_date", "import_bill_number", "import_serial", "importer_name", "importer_person_id", "supplier_name", "supplier_person_id",
  "driver_name", "driver_mobile", "truck_number", "truck_type", "goods_name", "unit",
  "customs_office", "border_crossing", "country_of_origin", "destination_country", "clearing_agent", "clearing_agent_id", "remarks",
];
const NUM = ["quantity"];

export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const searchLike = search ? `%${search}%` : null;

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select id, country_id, country_branch_id, city_branch_id, super_admin_serial, country_serial,
               branch_serial, entry_serial, truck_id, import_date, import_bill_number, import_serial,
               importer_name, importer_person_id, supplier_name, supplier_person_id, driver_name,
               driver_mobile, truck_number, truck_type, goods_name, quantity, unit, customs_office,
               border_crossing, country_of_origin, destination_country, clearing_agent, clearing_agent_id,
               dest_country_id, dest_state_province_id, dest_district_id, dest_city_id, remarks, status,
               is_active, created_at, updated_at
        from public.import_truck_loadings
        where deleted_at is null
          and (${session.isSuperAdmin ? sql`true` : sql`(country_id = any(${session.countryIds}) or country_id is null)`})
          and (${searchLike ? sql`(truck_number ilike ${searchLike} or importer_name ilike ${searchLike} or supplier_name ilike ${searchLike} or import_bill_number ilike ${searchLike} or goods_name ilike ${searchLike})` : sql`true`})
        order by import_date desc
      `;
    });

    return NextResponse.json({ records: rows || [] });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const body = await req.json();
    if (!body.truck_number && !body.importer_name && !body.goods_name) {
      return NextResponse.json({ error: "truck_number, importer_name or goods_name is required" }, { status: 400 });
    }
    const row: Record<string, unknown> = {
      country_id: body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null),
      country_branch_id: body.country_branch_id ?? session.countryBranchIds?.[0] ?? null,
      city_branch_id: body.city_branch_id ?? session.cityBranchIds?.[0] ?? null,
      status: "active", is_active: true, created_by: session.userId,
    };
    for (const f of FIELDS) if (body[f] !== undefined) row[f] = body[f] === "" ? null : body[f];
    for (const n of NUM) if (body[n] !== undefined && body[n] !== "" && body[n] !== null) row[n] = Number(body[n]);
    if (!row.import_date) row.import_date = new Date().toISOString().slice(0, 10);

    const serials = await allocateFormSerials("import_truck_loading", {
      countryId: row.country_id as string | null,
      branchKey: (row.country_branch_id as string | null) ?? (row.city_branch_id as string | null),
    });
    row.super_admin_serial = serials.superAdminSerial;
    row.country_serial = serials.countrySerial;
    row.branch_serial = serials.branchSerial;
    row.entry_serial = serials.entrySerial;
    if (!row.import_serial) row.import_serial = serials.entrySerial;

    const data = await withLocalPg(async (sql) => {
      const rows = await sql`
        insert into public.import_truck_loadings ${sql(row as any)}
        returning id, country_id, country_branch_id, city_branch_id, super_admin_serial, country_serial,
                  branch_serial, entry_serial, truck_id, import_date, import_bill_number, import_serial,
                  importer_name, importer_person_id, supplier_name, supplier_person_id, driver_name,
                  driver_mobile, truck_number, truck_type, goods_name, quantity, unit, customs_office,
                  border_crossing, country_of_origin, destination_country, clearing_agent, clearing_agent_id,
                  dest_country_id, dest_state_province_id, dest_district_id, dest_city_id, remarks, status,
                  is_active, created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) return NextResponse.json({ error: "Insert failed." }, { status: 500 });

    void saveVerifiedEnterpriseRecordTranslations({
      recordTable: "import_truck_loadings",
      recordId: (data as any).id,
      originalLanguage: session.preferredLanguage ?? "en",
      fields: [
        { fieldName: "goods_name", value: String(row.goods_name ?? ""), mode: "translate" },
        { fieldName: "supplier_name", value: String(row.supplier_name ?? ""), mode: "transliterate" },
        { fieldName: "importer_name", value: String(row.importer_name ?? ""), mode: "transliterate" },
        { fieldName: "driver_name", value: String(row.driver_name ?? ""), mode: "transliterate" }
      ],
      actorId: session.userId,
      source: "auto"
    });

    return NextResponse.json({ record: data });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
