import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase.from('ledgers').select('id, name, scope, country_id, currency, city_branch_id').ilike('name', '%Damaan Sales Account%');
  const { data: data2 } = await supabase.from('ledgers').select('id, name, scope, country_id, currency, city_branch_id').ilike('name', '%Dubai Purchase Account%');
  return NextResponse.json({ damaan: data, dubai: data2 });
}
