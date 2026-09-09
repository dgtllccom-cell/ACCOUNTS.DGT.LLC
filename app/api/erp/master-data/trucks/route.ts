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
  "truck_serial", "truck_number", "truck_name", "registration_number", "truck_type", "make", "model",
  "color", "chassis_number", "engine_number", "capacity", "owner_name", "owner_mobile",
  "transport_company", "driver_name", "driver_mobile", "driver_cnic_passport", "notes",
];
const DATES = ["registration_expiry_date", "insurance_expiry_date", "driver_docs_expiry_date"];

export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const selectable = searchParams.get("selectable") === "true";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || (selectable ? 50 : 500)), 1), 1000);
    const searchLike = search ? `%${search}%` : null;
    const prefixLike = search ? `${search}%` : null;

    // Truck Registration is a CENTRAL ERP-WIDE master (owner requirement): any
    // user with shipping_records:read may search and reuse ANY registered truck,
    // regardless of the country/branch it was registered from. The
    // `authorizeApiScope` check above is the access gate; no per-country filter here.
    const rows = await withLocalPg(async (sql) => {
      return sql`
        select t.id, t.country_id, t.country_branch_id, t.city_branch_id, t.super_admin_serial, t.country_serial,
               t.branch_serial, t.entry_serial, t.truck_serial, t.truck_number, t.truck_name, t.registration_number,
               t.registration_country_id, t.truck_type, t.make, t.model, t.manufacturing_year, t.color,
               t.chassis_number, t.engine_number, t.capacity, t.owner_name, t.owner_mobile, t.owner_person_id,
               t.transport_company, t.transport_company_id, t.transporter_person_id,
               t.driver_name, t.driver_mobile, t.driver_cnic_passport,
               t.driver_person_id, t.registration_expiry_date, t.insurance_expiry_date, t.driver_docs_expiry_date,
               t.base_state_province_id, t.base_district_id, t.base_city_id, t.status, t.notes, t.is_active,
               t.created_at, t.updated_at,
               owner.customer_name as owner_display_name,
               driver.customer_name as driver_display_name,
               transporter.customer_name as transporter_display_name,
               company.name as company_display_name,
               coalesce(cb.name, crb.name) as branch_display_name
        from public.trucks t
        left join public.customers owner on owner.id = t.owner_person_id
        left join public.customers driver on driver.id = t.driver_person_id
        left join public.customers transporter on transporter.id = t.transporter_person_id
        left join public.companies company on company.id = t.transport_company_id
        left join public.city_branches cb on cb.id = t.city_branch_id
        left join public.country_branches crb on crb.id = t.country_branch_id
        where t.deleted_at is null
          and (${selectable ? sql`t.status = 'active'` : status ? sql`t.status = ${status}` : sql`true`})
          and (${searchLike ? sql`(t.truck_number ilike ${searchLike} or t.registration_number ilike ${searchLike} or t.owner_name ilike ${searchLike} or t.driver_name ilike ${searchLike} or t.transport_company ilike ${searchLike})` : sql`true`})
        order by ${prefixLike ? sql`(lower(t.truck_number) like lower(${prefixLike})) desc,` : sql``} t.truck_number asc
        limit ${limit}
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

    // Central master — one vehicle, one record. If this number is already
    // registered anywhere in the ERP, return the existing truck (409) so the
    // caller can reuse it instead of creating a duplicate.
    const existing = await withLocalPg(async (sql) => {
      const r = await sql`
        select id, country_id, truck_number, registration_number, truck_type, capacity,
               owner_name, owner_mobile, transport_company, driver_name, driver_mobile,
               driver_cnic_passport, status, registration_expiry_date, insurance_expiry_date
        from public.trucks
        where deleted_at is null and lower(btrim(truck_number)) = lower(${truckNumber})
        limit 1`;
      return r[0] ?? null;
    });
    if (existing) {
      return NextResponse.json(
        { error: "A truck with this number is already registered.", duplicate: true, truck: existing },
        { status: 409 },
      );
    }

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
      transporter_person_id: body.transporter_person_id || null,
      status: ["active", "inactive", "suspended", "expired"].includes(body.status) ? body.status : "active",
      is_active: true,
      created_by: session.userId,
    };
    for (const f of TEXT) if (body[f] !== undefined) row[f] = body[f] === "" || body[f] === null ? null : String(body[f]).trim();
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
                  branch_serial, entry_serial, truck_serial, truck_number, truck_name, registration_number,
                  registration_country_id, truck_type, make, model, manufacturing_year, color,
                  chassis_number, engine_number, capacity, owner_name, owner_mobile, owner_person_id,
                  transport_company, transport_company_id, transporter_person_id, driver_name, driver_mobile, driver_cnic_passport,
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
