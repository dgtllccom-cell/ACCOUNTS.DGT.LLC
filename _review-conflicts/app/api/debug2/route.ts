import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase.from('purchase_orders')
      .select('id, purchase_order_no, payment_status, created_at, deleted_at')
      .order('created_at', { ascending: false })
      .limit(10);
    return NextResponse.json({ ok: true, data, error });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}
