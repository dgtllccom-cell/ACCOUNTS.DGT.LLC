import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin.from("roznamcha_entries").select("id, type, journal_no, voucher_no, reference_no, created_at").order("created_at", { ascending: false }).limit(50);
    return NextResponse.json({ data, error });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
