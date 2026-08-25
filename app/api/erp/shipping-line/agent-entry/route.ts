import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

// shipping_agent_entries has RLS enabled, gated to is_super_admin() (Person Master
// Phase 2 migration). SUPABASE_SERVICE_ROLE_KEY resolves to the anon key in this
// environment, so the Supabase admin client can get silently RLS-filtered to zero
// rows / blocked writes — same root cause already fixed for warehouses. Reads/writes
// go through a direct Postgres connection (withLocalPg) when available.
export async function GET(req: NextRequest) {
  try {
    const viaPg = await withLocalPg(async (sql) => {
      return sql`
        SELECT * FROM public.shipping_agent_entries
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
      `;
    });
    if (viaPg) return NextResponse.json({ success: true, data: viaPg });

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("shipping_agent_entries")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 500 });

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      agent_code,
      agent_name,
      clearing_agent_id,
      shipping_line_name,
      shipping_line_id,
      contact_person,
      email,
      phone,
      city_name,
      country_name,
      status = "active",
      remarks,
    } = body;

    const payload = {
      agent_name: agent_name ? String(agent_name).trim() : "New Shipping Agent",
      clearing_agent_id: clearing_agent_id || null,
      shipping_line_name: shipping_line_name ? String(shipping_line_name).trim() : null,
      shipping_line_id: shipping_line_id || null,
      contact_person: contact_person ? String(contact_person).trim() : null,
      email: email ? String(email).trim().toLowerCase() : null,
      phone: phone ? String(phone).trim() : null,
      city_name: city_name ? String(city_name).trim() : null,
      country_name: country_name ? String(country_name).trim() : null,
      status: status || "active",
      remarks: remarks ? String(remarks).trim() : null,
    };

    const viaPg = await withLocalPg(async (sql) => {
      const [countRow] = await sql`SELECT COUNT(*)::int AS c FROM public.shipping_agent_entries`;
      const year = new Date().getFullYear();
      const serial = String((countRow?.c || 0) + 1).padStart(4, "0");
      const autoCode = agent_code || `SHIP-AGT-${year}-${serial}`;

      const rows = await sql`
        INSERT INTO public.shipping_agent_entries (
          agent_code, agent_name, clearing_agent_id, shipping_line_name, shipping_line_id,
          contact_person, email, phone, city_name, country_name, status, remarks
        ) VALUES (
          ${autoCode}, ${payload.agent_name}, ${payload.clearing_agent_id}::uuid,
          ${payload.shipping_line_name}, ${payload.shipping_line_id}::uuid,
          ${payload.contact_person}, ${payload.email}, ${payload.phone},
          ${payload.city_name}, ${payload.country_name}, ${payload.status}, ${payload.remarks}
        )
        RETURNING *
      `;
      return rows[0];
    });

    if (viaPg) {
      void syncRecordTranslations({
        table: "shipping_agent_entries",
        recordId: viaPg.id,
        record: viaPg,
      }).catch(() => null);
      return NextResponse.json({ success: true, data: viaPg });
    }

    const year = new Date().getFullYear();
    const supabase = createSupabaseAdminClient() as any;
    const { count } = await supabase
      .from("shipping_agent_entries")
      .select("*", { count: "exact", head: true });
    const serial = String((count || 0) + 1).padStart(4, "0");
    const autoCode = agent_code || `SHIP-AGT-${year}-${serial}`;

    const { data, error } = await supabase
      .from("shipping_agent_entries")
      .insert({ ...payload, agent_code: autoCode, created_at: new Date().toISOString() })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    void syncRecordTranslations({
      table: "shipping_agent_entries",
      recordId: data.id,
      record: data,
    }).catch(() => null);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
