import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: pop, error: err1 } = await supabase.from('purchase_order_payments').select('*').order('created_at', { ascending: false }).limit(2);
  console.log('Last PO payments:', pop);
  
  const { data: roz, error: err2 } = await supabase.from('roznamcha_entries').select('*, roznamcha_lines(*)').order('created_at', { ascending: false }).limit(2);
  console.log('Last Roznamcha:', JSON.stringify(roz, null, 2));
}

check();
