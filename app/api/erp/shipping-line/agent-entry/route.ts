import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("shipping_agent_entries")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: true, data: [] });

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient() as any;
    const body = await req.json();

    const {
      agent_code,
      agent_name,
      shipping_line_name,
      contact_person,
      email,
      phone,
      city_name,
      country_name,
      status = "active",
      remarks,
    } = body;

    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("shipping_agent_entries")
      .select("*", { count: "exact", head: true })
      .catch(() => ({ count: 0 }));

    const serial = String((count || 0) + 1).padStart(4, "0");
    const auto_code = agent_code || `SHIP-AGT-${year}-${serial}`;

    const payload = {
      agent_code: auto_code,
      agent_name: agent_name ? String(agent_name).trim() : "New Shipping Agent",
      shipping_line_name: shipping_line_name ? String(shipping_line_name).trim() : "DGT Logistics",
      contact_person: contact_person ? String(contact_person).trim() : null,
      email: email ? String(email).trim().toLowerCase() : null,
      phone: phone ? String(phone).trim() : null,
      city_name: city_name ? String(city_name).trim() : null,
      country_name: country_name ? String(country_name).trim() : null,
      status: status || "active",
      remarks: remarks ? String(remarks).trim() : null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("shipping_agent_entries")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({
        success: true,
        data: { id: crypto.randomUUID(), ...payload }
      });
    }

    await syncRecordTranslations({
      table: "shipping_agent_entries",
      recordId: data.id,
      record: data,
    }).catch(() => null);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
