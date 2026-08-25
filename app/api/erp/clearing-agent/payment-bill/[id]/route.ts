import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

const COLS =
  "id, country_id, country_branch_id, city_branch_id, bill_no, order_no, bl_number, gd_number, agent_name, agent_id, port_name, customs_duty, port_charges, demurrage_charges, clearance_fee, freight_charges, other_charges, total_amount, currency_code, payment_status, payment_method, remarks, status, is_active, created_at, updated_at";

const FIELDS = [
  "order_no", "bl_number", "gd_number", "agent_name", "agent_id", "port_name",
  "currency_code", "payment_status", "payment_method", "remarks",
];
const NUM = ["customs_duty", "port_charges", "demurrage_charges", "clearance_fee", "freight_charges", "other_charges"];

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const { id } = await context.params;
    const body = await req.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f] === "" ? null : body[f];
    for (const n of NUM) if (body[n] !== undefined) patch[n] = Number(body[n] || 0);

    if (NUM.some((n) => body[n] !== undefined)) {
      const supabase0 = createSupabaseAdminClient();
      const { data: existing } = await supabase0.from("clearing_payment_bills").select(NUM.join(",")).eq("id", id).single();
      const merged = { ...(existing as any), ...patch };
      patch.total_amount = NUM.reduce((sum, n) => sum + Number(merged[n] || 0), 0);
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("clearing_payment_bills")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select(COLS)
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    void syncRecordTranslations({
      table: "clearing_payment_bills",
      recordId: id,
      record: data,
    }).catch(() => null);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "delete" });
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("clearing_payment_bills")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
