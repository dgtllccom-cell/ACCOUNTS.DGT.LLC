import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

const COLS =
  "id, country_id, country_branch_id, city_branch_id, bill_no, order_no, bl_number, gd_number, agent_name, agent_id, port_name, customs_duty, port_charges, demurrage_charges, clearance_fee, freight_charges, other_charges, total_amount, currency_code, payment_status, payment_method, remarks, status, is_active, created_at, updated_at";

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("clearing_payment_bills")
      .select(COLS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      query = query.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    if (status && status !== "all") {
      query = query.eq("payment_status", status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to load payment bills" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const supabase = createSupabaseAdminClient();
    const body = await req.json();

    const {
      bill_no,
      order_no,
      bl_number,
      gd_number,
      agent_name,
      agent_id,
      port_name,
      customs_duty = 0,
      port_charges = 0,
      demurrage_charges = 0,
      clearance_fee = 0,
      freight_charges = 0,
      other_charges = 0,
      currency_code = "USD",
      payment_status = "pending",
      payment_method = "bank_transfer",
      remarks,
    } = body;

    const total_amount =
      Number(customs_duty || 0) +
      Number(port_charges || 0) +
      Number(demurrage_charges || 0) +
      Number(clearance_fee || 0) +
      Number(freight_charges || 0) +
      Number(other_charges || 0);

    const countryId = body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);
    const countryBranchId = body.country_branch_id ?? session.countryBranchIds?.[0] ?? null;
    const cityBranchId = body.city_branch_id ?? session.cityBranchIds?.[0] ?? null;

    const year = new Date().getFullYear();
    const { count } = await Promise.resolve(
      supabase
        .from("clearing_payment_bills")
        .select("*", { count: "exact", head: true })
    ).catch(() => ({ count: 0 }));

    const serial = String((count || 0) + 1).padStart(4, "0");
    const auto_bill_no = bill_no || `CL-BILL-${year}-${serial}`;

    const payload = {
      country_id: countryId,
      country_branch_id: countryBranchId,
      city_branch_id: cityBranchId,
      bill_no: auto_bill_no,
      order_no: order_no || null,
      bl_number: bl_number || null,
      gd_number: gd_number || null,
      agent_name: agent_name ? String(agent_name).trim() : "Default Clearing Agent",
      agent_id: agent_id || null,
      port_name: port_name ? String(port_name).trim() : "Karachi Port",
      customs_duty: Number(customs_duty || 0),
      port_charges: Number(port_charges || 0),
      demurrage_charges: Number(demurrage_charges || 0),
      clearance_fee: Number(clearance_fee || 0),
      freight_charges: Number(freight_charges || 0),
      other_charges: Number(other_charges || 0),
      total_amount,
      currency_code: currency_code || "USD",
      payment_status: payment_status || "pending",
      payment_method: payment_method || "bank_transfer",
      remarks: remarks ? String(remarks).trim() : null,
      status: "active",
      is_active: true,
      created_by: session.userId,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("clearing_payment_bills")
      .insert(payload)
      .select(COLS)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await syncRecordTranslations({
      table: "clearing_payment_bills",
      recordId: (data as any).id,
      record: data,
    }).catch(() => null);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
