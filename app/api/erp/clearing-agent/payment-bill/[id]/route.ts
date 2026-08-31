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
      const existingRows = await sql`
        select customs_duty, port_charges, demurrage_charges, clearance_fee, freight_charges, other_charges
        from public.clearing_payment_bills where id = ${id}::uuid and deleted_at is null
      `;
      const existing = existingRows[0];
      if (!existing) return null;

      const customsDuty = body.customs_duty !== undefined ? Number(body.customs_duty || 0) : Number(existing.customs_duty);
      const portCharges = body.port_charges !== undefined ? Number(body.port_charges || 0) : Number(existing.port_charges);
      const demurrageCharges = body.demurrage_charges !== undefined ? Number(body.demurrage_charges || 0) : Number(existing.demurrage_charges);
      const clearanceFee = body.clearance_fee !== undefined ? Number(body.clearance_fee || 0) : Number(existing.clearance_fee);
      const freightCharges = body.freight_charges !== undefined ? Number(body.freight_charges || 0) : Number(existing.freight_charges);
      const otherCharges = body.other_charges !== undefined ? Number(body.other_charges || 0) : Number(existing.other_charges);
      const totalAmount = customsDuty + portCharges + demurrageCharges + clearanceFee + freightCharges + otherCharges;

      const rows = await sql`
        update public.clearing_payment_bills set
          order_no = ${body.order_no !== undefined ? (body.order_no || null) : sql`order_no`},
          bl_number = ${body.bl_number !== undefined ? (body.bl_number || null) : sql`bl_number`},
          gd_number = ${body.gd_number !== undefined ? (body.gd_number || null) : sql`gd_number`},
          agent_name = ${body.agent_name !== undefined ? (body.agent_name || null) : sql`agent_name`},
          agent_id = ${body.agent_id !== undefined ? (body.agent_id || null) : sql`agent_id`},
          port_name = ${body.port_name !== undefined ? (body.port_name || null) : sql`port_name`},
          customs_duty = ${customsDuty},
          port_charges = ${portCharges},
          demurrage_charges = ${demurrageCharges},
          clearance_fee = ${clearanceFee},
          freight_charges = ${freightCharges},
          other_charges = ${otherCharges},
          total_amount = ${totalAmount},
          currency_code = ${body.currency_code !== undefined ? (body.currency_code || null) : sql`currency_code`},
          payment_status = ${body.payment_status !== undefined ? (body.payment_status || null) : sql`payment_status`},
          payment_method = ${body.payment_method !== undefined ? (body.payment_method || null) : sql`payment_method`},
          remarks = ${body.remarks !== undefined ? (body.remarks || null) : sql`remarks`},
          updated_at = now()
        where id = ${id}::uuid and deleted_at is null
        returning id, country_id, country_branch_id, city_branch_id, bill_no, order_no, bl_number, gd_number,
                  agent_name, agent_id, port_name, customs_duty, port_charges, demurrage_charges, clearance_fee,
                  freight_charges, other_charges, total_amount, currency_code, payment_status, payment_method,
                  remarks, status, is_active, created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });

    void syncRecordTranslations({
      table: "clearing_payment_bills",
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
        update public.clearing_payment_bills
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
