import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );
    
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('purchase_order_no, currency_code, total_amount, form_data')
      .in('purchase_order_no', ['PUR-000001', 'PUR-000002', 'PUR-000003', 'PUR-000004'])
      .order('created_at', { ascending: true })
      .limit(5);

    return NextResponse.json({ ok: true, data, error });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}
