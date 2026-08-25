import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";

// withLocalPg, not the RLS-gated Supabase admin client — see ../route.ts for the root cause.

const FIELDS = [
  "truck_id", "transit_date", "transit_serial", "transit_company", "transit_company_id", "truck_number", "driver_name", "driver_mobile",
  "goods_name", "unit", "transit_route", "border", "destination", "customs_information", "container_number", "seal_number", "remarks",
  "dest_country_id", "dest_state_province_id", "dest_district_id", "dest_city_id",
];
const NUM = ["quantity"];

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

    const data = await withLocalPg(async (sql) => {
      const rows = await sql`
        update public.transit_truck_loadings set ${(sql as any)(patch)}
        where id = ${id}::uuid and deleted_at is null
        returning id, country_id, country_branch_id, city_branch_id, super_admin_serial, country_serial,
                  branch_serial, entry_serial, truck_id, transit_date, transit_serial, transit_company,
                  transit_company_id, truck_number, driver_name, driver_mobile, goods_name, quantity, unit,
                  transit_route, border, destination, dest_country_id, dest_state_province_id,
                  dest_district_id, dest_city_id, customs_information, container_number, seal_number,
                  remarks, status, is_active, created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) return NextResponse.json({ error: "Record not found." }, { status: 404 });

    if (patch.goods_name !== undefined || patch.driver_name !== undefined) {
      void saveVerifiedEnterpriseRecordTranslations({
        recordTable: "transit_truck_loadings",
        recordId: id,
        originalLanguage: session.preferredLanguage ?? "en",
        fields: [
          { fieldName: "goods_name", value: String((data as any).goods_name ?? ""), mode: "translate" },
          { fieldName: "driver_name", value: String((data as any).driver_name ?? ""), mode: "transliterate" }
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
    await withLocalPg(async (sql) => {
      await sql`
        update public.transit_truck_loadings
        set deleted_at = now(), updated_at = now(), is_active = false
        where id = ${id}::uuid and deleted_at is null
      `;
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
