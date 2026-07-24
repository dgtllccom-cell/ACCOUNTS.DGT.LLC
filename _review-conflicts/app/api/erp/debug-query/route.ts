import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/api/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();
    
    // Fetch recent 10 purchase orders
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, purchase_order_no, ledger_posting_status, payment_status, advance_paid, remaining_due, super_admin_serial_number, country_transaction_serial_number, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    const poIds = po?.map(p => p.id) || [];
    let form_data = null;
    if (poIds.length > 0) {
      const { data: poForm } = await supabase
        .from('purchase_orders')
        .select('id, form_data')
        .in('id', poIds);
      form_data = poForm;
    }

    const { data: roz, error: rozErr } = await supabase
      .from('roznamcha_entries')
      .select('id, journal_no, voucher_no, entry_date, super_admin_serial_number')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({ po, poErr, roz, rozErr, form_data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
