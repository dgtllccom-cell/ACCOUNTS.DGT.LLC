import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/api/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.from('purchase_orders').select('*').limit(1);

    if (error) {
      return NextResponse.json({ error: error.message, details: error });
    }

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      return NextResponse.json({ columns });
    } else {
      return NextResponse.json({ message: "No rows found" });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
