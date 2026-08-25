import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

const COLS =
  "id, country_id, country_branch_id, city_branch_id, entry_no, customs_declaration_no, declaration_type, agent_name, agent_id, customs_station, consignee_name, consignee_person_id, consignor_name, consignor_person_id, hscode, goods_description, assessed_value, duty_paid, currency_code, clearance_status, remarks, status, is_active, created_at, updated_at";

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("clearing_agent_custom_entries")
      .select(COLS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      query = query.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    if (status && status !== "all") {
      query = query.eq("clearance_status", status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to load custom entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const supabase = createSupabaseAdminClient();
    const body = await req.json();

    const {
      entry_no,
      customs_declaration_no,
      declaration_type = "import",
      agent_name,
      agent_id,
      customs_station,
      consignee_name,
      consignee_person_id,
      consignor_name,
      consignor_person_id,
      hscode,
      goods_description,
      assessed_value = 0,
      duty_paid = 0,
      currency_code = "USD",
      clearance_status = "submitted",
      remarks,
    } = body;

    const countryId = body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);
    const countryBranchId = body.country_branch_id ?? session.countryBranchIds?.[0] ?? null;
    const cityBranchId = body.city_branch_id ?? session.cityBranchIds?.[0] ?? null;

    const year = new Date().getFullYear();
    const { count } = await Promise.resolve(
      supabase
        .from("clearing_agent_custom_entries")
        .select("*", { count: "exact", head: true })
    ).catch(() => ({ count: 0 }));

    const serial = String((count || 0) + 1).padStart(4, "0");
    const auto_entry_no = entry_no || `CUST-DEC-${year}-${serial}`;

    const payload = {
      country_id: countryId,
      country_branch_id: countryBranchId,
      city_branch_id: cityBranchId,
      entry_no: auto_entry_no,
      customs_declaration_no: customs_declaration_no || null,
      declaration_type: declaration_type || "import",
      agent_name: agent_name ? String(agent_name).trim() : "Default Clearing Agent",
      agent_id: agent_id || null,
      customs_station: customs_station ? String(customs_station).trim() : "Karachi Customs House",
      consignee_name: consignee_name ? String(consignee_name).trim() : null,
      consignee_person_id: consignee_person_id || null,
      consignor_name: consignor_name ? String(consignor_name).trim() : null,
      consignor_person_id: consignor_person_id || null,
      hscode: hscode ? String(hscode).trim() : null,
      goods_description: goods_description ? String(goods_description).trim() : null,
      assessed_value: Number(assessed_value || 0),
      duty_paid: Number(duty_paid || 0),
      currency_code: currency_code || "USD",
      clearance_status: clearance_status || "submitted",
      remarks: remarks ? String(remarks).trim() : null,
      status: "active",
      is_active: true,
      created_by: session.userId,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("clearing_agent_custom_entries")
      .insert(payload)
      .select(COLS)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await syncRecordTranslations({
      table: "clearing_agent_custom_entries",
      recordId: (data as any).id,
      record: data,
    }).catch(() => null);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
