import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  });
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('purchase_orders').select('*').ilike('purchase_order_no', '%AE-001-0001%').limit(1);
  if (error) {
    console.error('Error:', error);
    return;
  }
  if (!data || !data[0]) {
    console.log('Not found');
    return;
  }
  const row = data[0];
  console.log('order_total:', row.order_total);
  console.log('final_amount:', row.final_amount);
  console.log('currency_code:', row.currency_code);
  console.log('exchange_rate:', row.exchange_rate);
  console.log('form totalAmount:', row.form_data?.form?.totalAmount);
  console.log('form finalAmount:', row.form_data?.form?.finalAmount);
  console.log('form currency:', row.form_data?.form?.currency);
  console.log('form currencyType:', row.form_data?.form?.currencyType);
  console.log('form exchangeRate:', row.form_data?.form?.exchangeRate);
  console.log('goodsEntries:', JSON.stringify(row.form_data?.goodsEntries));
}
check();
