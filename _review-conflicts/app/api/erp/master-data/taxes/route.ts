import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const session = await requireErpSession();

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tax_codes")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to camelCase
    const formatted = (data || []).map(r => ({
      id: r.id,
      taxName: r.tax_name,
      taxPct: Number(r.tax_pct),
      countryName: r.country_name,
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();

    const body = await req.json();
    if (!body.taxName || body.taxPct == null || !body.countryName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tax_codes")
      .insert({
        tax_name: body.taxName,
        tax_pct: Number(body.taxPct),
        country_name: body.countryName,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      taxName: data.tax_name,
      taxPct: Number(data.tax_pct),
      countryName: data.country_name,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
