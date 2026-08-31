import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

// withLocalPg, not the RLS-gated Supabase admin client — see ../route.ts for the root cause.

const FIELDS = [
  "dest_country_id", "dest_state_province_id", "dest_district_id", "dest_city_id",
  "truck_id", "import_date", "import_bill_number", "import_serial", "importer_name", "importer_person_id", "supplier_name", "supplier_person_id",
  "driver_name", "driver_mobile", "truck_number", "truck_type", "goods_name", "unit",
  "customs_office", "border_crossing", "country_of_origin", "destination_country", "clearing_agent", "clearing_agent_id", "remarks",
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
        update public.import_truck_loadings set ${(sql as any)(patch)}
        where id = ${id}::uuid and deleted_at is null
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

    if (!data) return NextResponse.json({ error: "Record not found." }, { status: 404 });

    if (patch.goods_name !== undefined || patch.supplier_name !== undefined || patch.importer_name !== undefined || patch.driver_name !== undefined) {
      void saveVerifiedEnterpriseRecordTranslations({
        recordTable: "import_truck_loadings",
        recordId: id,
        originalLanguage: session.preferredLanguage ?? "en",
        fields: [
          { fieldName: "goods_name", value: String((data as any).goods_name ?? ""), mode: "translate" },
          { fieldName: "supplier_name", value: String((data as any).supplier_name ?? ""), mode: "transliterate" },
          { fieldName: "importer_name", value: String((data as any).importer_name ?? ""), mode: "transliterate" },
          { fieldName: "driver_name", value: String((data as any).driver_name ?? ""), mode: "transliterate" }
        ],
        actorId: session.userId,
        source: "auto"
      });
    }

    return NextResponse.json({ record: data });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
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
        update public.import_truck_loadings
        set deleted_at = now(), updated_at = now(), is_active = false
        where id = ${id}::uuid and deleted_at is null
      `;
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
