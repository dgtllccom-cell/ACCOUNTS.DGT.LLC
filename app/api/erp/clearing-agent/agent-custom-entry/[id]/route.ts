import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

const COLS =
  "id, country_id, country_branch_id, city_branch_id, entry_no, customs_declaration_no, declaration_type, agent_name, agent_id, customs_station, consignee_name, consignee_person_id, consignor_name, consignor_person_id, hscode, goods_description, assessed_value, duty_paid, currency_code, clearance_status, remarks, status, is_active, created_at, updated_at";

const FIELDS = [
  "customs_declaration_no", "declaration_type", "agent_name", "agent_id", "customs_station",
  "consignee_name", "consignee_person_id", "consignor_name", "consignor_person_id", "hscode",
  "goods_description", "clearance_status", "remarks", "currency_code",
];
const NUM = ["assessed_value", "duty_paid"];

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const { id } = await context.params;
    const body = await req.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f] === "" ? null : body[f];
    for (const n of NUM) if (body[n] !== undefined) patch[n] = Number(body[n] || 0);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("clearing_agent_custom_entries")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select(COLS)
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    void syncRecordTranslations({
      table: "clearing_agent_custom_entries",
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
      .from("clearing_agent_custom_entries")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
