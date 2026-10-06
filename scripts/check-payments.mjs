import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  });
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('purchase_order_payments')
    .select('*')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Total purchase_order_payments:', data?.length);
  console.log(JSON.stringify(data, null, 2));
}
run();
