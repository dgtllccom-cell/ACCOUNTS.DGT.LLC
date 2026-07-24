"use server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function checkDB() {
  try {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase.from('purchase_orders').select('id, purchase_order_no, country_id, payment_status, created_at, deleted_at').order('created_at', { ascending: false }).limit(5);
    return { ok: true, data, error };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
