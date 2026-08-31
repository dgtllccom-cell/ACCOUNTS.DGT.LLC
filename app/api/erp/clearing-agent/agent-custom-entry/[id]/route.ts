import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const { id } = await context.params;
    const body = await req.json();

    const data = await withLocalPg(async (sql) => {
      const rows = await sql`
        update public.clearing_agent_custom_entries set
          customs_declaration_no = ${body.customs_declaration_no !== undefined ? (body.customs_declaration_no || null) : sql`customs_declaration_no`},
          declaration_type = ${body.declaration_type !== undefined ? (body.declaration_type || null) : sql`declaration_type`},
          agent_name = ${body.agent_name !== undefined ? (body.agent_name || null) : sql`agent_name`},
          agent_id = ${body.agent_id !== undefined ? (body.agent_id || null) : sql`agent_id`},
          customs_station = ${body.customs_station !== undefined ? (body.customs_station || null) : sql`customs_station`},
          consignee_name = ${body.consignee_name !== undefined ? (body.consignee_name || null) : sql`consignee_name`},
          consignee_person_id = ${body.consignee_person_id !== undefined ? (body.consignee_person_id || null) : sql`consignee_person_id`},
          consignor_name = ${body.consignor_name !== undefined ? (body.consignor_name || null) : sql`consignor_name`},
          consignor_person_id = ${body.consignor_person_id !== undefined ? (body.consignor_person_id || null) : sql`consignor_person_id`},
          hscode = ${body.hscode !== undefined ? (body.hscode || null) : sql`hscode`},
          goods_description = ${body.goods_description !== undefined ? (body.goods_description || null) : sql`goods_description`},
          assessed_value = ${body.assessed_value !== undefined ? Number(body.assessed_value || 0) : sql`assessed_value`},
          duty_paid = ${body.duty_paid !== undefined ? Number(body.duty_paid || 0) : sql`duty_paid`},
          currency_code = ${body.currency_code !== undefined ? (body.currency_code || null) : sql`currency_code`},
          clearance_status = ${body.clearance_status !== undefined ? (body.clearance_status || null) : sql`clearance_status`},
          remarks = ${body.remarks !== undefined ? (body.remarks || null) : sql`remarks`},
          updated_at = now()
        where id = ${id}::uuid and deleted_at is null
        returning id, country_id, country_branch_id, city_branch_id, entry_no, customs_declaration_no,
                  declaration_type, agent_name, agent_id, customs_station, consignee_name, consignee_person_id,
                  consignor_name, consignor_person_id, hscode, goods_description, assessed_value, duty_paid,
                  currency_code, clearance_status, remarks, status, is_active, created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });

    void syncRecordTranslations({
      table: "clearing_agent_custom_entries",
      recordId: id,
      record: data,
    }).catch(() => null);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "delete" });
    const { id } = await context.params;
    await withLocalPg(async (sql) => {
      await sql`
        update public.clearing_agent_custom_entries
        set deleted_at = now(), updated_at = now(), is_active = false
        where id = ${id}::uuid and deleted_at is null
      `;
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
