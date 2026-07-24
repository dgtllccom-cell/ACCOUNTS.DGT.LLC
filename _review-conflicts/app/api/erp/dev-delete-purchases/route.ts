import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("purchase_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
  return NextResponse.json({ success: true, message: "Deleted all purchase orders" });
}
