import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

/**
 * Truck Registration master (Settings -> Truck Management).
 * One central truck record reused by all loading forms. Secure + scoped.
 * Table: trucks (migration 20260801_truck_registration.sql).
 *
 * withLocalPg, not the RLS-gated Supabase admin client: trucks_scope_all's WITH CHECK requires
 * is_super_admin()/can_access_country(), which only evaluates against a real Supabase JWT —
 * createSupabaseAdminClient() has no real service-role key on DEV, so every insert/update was
 * silently rejected by RLS (confirmed live: POST always 500'd with "new row violates row-level
 * security policy"). Same root cause already fixed for warehouses/roznamcha/purchase-payments.
 */

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
    const searchLike = search ? `%${search}%` : null;

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select id, country_id, country_branch_id, city_branch_id, super_admin_serial, country_serial,
               branch_serial, entry_serial, truck_serial, truck_number, registration_number,
               registration_country_id, truck_type, make, model, manufacturing_year, color,
               chassis_number, engine_number, capacity, owner_name, owner_mobile, owner_person_id,
               transport_company, transport_company_id, driver_name, driver_mobile, driver_cnic_passport,
               driver_person_id, registration_expiry_date, insurance_expiry_date, driver_docs_expiry_date,
               base_state_province_id, base_district_id, base_city_id, status, notes, is_active,
               created_at, updated_at
        from public.trucks
        where deleted_at is null
          and (${session.isSuperAdmin ? sql`true` : sql`(country_id = any(${session.countryIds}) or country_id is null)`})
          and (${selectable ? sql`status = 'active'` : status ? sql`status = ${status}` : sql`true`})
          and (${searchLike ? sql`(truck_number ilike ${searchLike} or registration_number ilike ${searchLike} or owner_name ilike ${searchLike} or driver_name ilike ${searchLike} or transport_company ilike ${searchLike})` : sql`true`})
        order by truck_number asc
      `;
    });

    return NextResponse.json({ trucks: rows || [] });
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

    const truckNumber = typeof body.truck_number === "string" ? body.truck_number.trim() : "";
    if (!truckNumber) return NextResponse.json({ error: "truck_number is required" }, { status: 400 });

    const row: Record<string, unknown> = {
      country_id: body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null),
      country_branch_id: body.country_branch_id ?? session.countryBranchIds?.[0] ?? null,
      city_branch_id: body.city_branch_id ?? session.cityBranchIds?.[0] ?? null,
      registration_country_id: body.registration_country_id ?? null,
      base_state_province_id: body.base_state_province_id ?? null,
      base_district_id: body.base_district_id ?? null,
      base_city_id: body.base_city_id ?? null,
      manufacturing_year: body.manufacturing_year ? Number(body.manufacturing_year) : null,
      owner_person_id: body.owner_person_id || null,
      driver_person_id: body.driver_person_id || null,
      transport_company_id: body.transport_company_id || null,
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

    const data = await withLocalPg(async (sql) => {
      const rows = await sql`
        insert into public.trucks ${sql(row as any)}
        returning id, country_id, country_branch_id, city_branch_id, super_admin_serial, country_serial,
                  branch_serial, entry_serial, truck_serial, truck_number, registration_number,
                  registration_country_id, truck_type, make, model, manufacturing_year, color,
                  chassis_number, engine_number, capacity, owner_name, owner_mobile, owner_person_id,
                  transport_company, transport_company_id, driver_name, driver_mobile, driver_cnic_passport,
                  driver_person_id, registration_expiry_date, insurance_expiry_date, driver_docs_expiry_date,
                  base_state_province_id, base_district_id, base_city_id, status, notes, is_active,
                  created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) return NextResponse.json({ error: "Insert failed." }, { status: 500 });

    void saveVerifiedEnterpriseRecordTranslations({
      recordTable: "trucks",
      recordId: (data as any).id,
      originalLanguage: session.preferredLanguage ?? "en",
      fields: [
        { fieldName: "driver_name", value: String(row.driver_name ?? ""), mode: "transliterate" },
        { fieldName: "owner_name", value: String(row.owner_name ?? ""), mode: "transliterate" }
      ],
      actorId: session.userId,
      source: "auto"
    });

    return NextResponse.json({ truck: data });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
