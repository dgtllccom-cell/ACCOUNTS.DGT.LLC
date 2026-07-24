import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await (supabase as any).rpc("exec_sql", { query: `
    SELECT pg_get_functiondef(oid) 
    FROM pg_proc 
    WHERE proname = 'post_purchase_order_payment';
  `});

  if (error) {
    return NextResponse.json({ error });
  }

  return NextResponse.json({ data });
}
