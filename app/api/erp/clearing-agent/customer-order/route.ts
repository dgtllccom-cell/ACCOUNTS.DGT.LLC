import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("clearing_customer_orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json();

    const {
      customer_id,
      customer_name,
      route_name,
      shipment_type = "FCL",
      transport_mode = "by_sea",
      movement_type = "import",
      loading_country_id,
      loading_country_name,
      receiving_country_id,
      receiving_country_name,
      loading_port_id,
      loading_port_name,
      destination_port_id,
      destination_port_name,
      cargo_details,
      expected_loading_date,
      remarks,
    } = body;

    if (!customer_name) {
      return NextResponse.json({ success: false, error: "Customer name is required" }, { status: 400 });
    }

    // Generate Order Serial e.g. CL-ORD-2026-0001
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("clearing_customer_orders")
      .select("*", { count: "exact", head: true });

    const serial = String((count || 0) + 1).padStart(4, "0");
    const order_no = `CL-ORD-${year}-${serial}`;

    const payload = {
      order_no,
      customer_id: customer_id || null,
      customer_name: String(customer_name).trim(),
      route_name: route_name ? String(route_name).trim() : null,
      shipment_type: shipment_type || "FCL",
      transport_mode: transport_mode || "by_sea",
      movement_type: movement_type || "import",
      loading_country_id: loading_country_id || null,
      loading_country_name: loading_country_name ? String(loading_country_name).trim() : null,
      receiving_country_id: receiving_country_id || null,
      receiving_country_name: receiving_country_name ? String(receiving_country_name).trim() : null,
      loading_port_id: loading_port_id || null,
      loading_port_name: loading_port_name ? String(loading_port_name).trim() : null,
      destination_port_id: destination_port_id || null,
      destination_port_name: destination_port_name ? String(destination_port_name).trim() : null,
      cargo_details: cargo_details ? String(cargo_details).trim() : null,
      expected_loading_date: expected_loading_date || new Date().toISOString(),
      remarks: remarks ? String(remarks).trim() : null,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("clearing_customer_orders")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    // Synchronous 5-language database storage across dedicated tables
    await syncRecordTranslations({
      table: "clearing_customer_orders",
      recordId: data.id,
      record: data,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
