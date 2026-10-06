import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Connecting to Supabase at:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data: order, error: fetchErr } = await supabase
    .from('purchase_orders')
    .select('id, purchase_order_no, form_data')
    .eq('id', '95a4c4ba-f81e-4001-a0ea-cb08a74bb1d7')
    .single();

  if (fetchErr || !order) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  const updatedFormData = {
    ...order.form_data,
    form: {
      ...order.form_data?.form,
      paymentType: 'Credit',
      paymentCondition: 'Credit',
      advancePercent: 0,
      advanceAmount: 0
    }
  };

  const { data: updated, error: updateErr } = await supabase
    .from('purchase_orders')
    .update({
      form_data: updatedFormData,
      advance_paid: 0
    })
    .eq('id', order.id)
    .select('id, purchase_order_no, form_data');

  if (updateErr) {
    console.error('Update error:', updateErr);
    return;
  }

  console.log('Successfully updated order:', updated[0]?.purchase_order_no);
  console.log('New advancePercent:', updated[0]?.form_data?.form?.advancePercent);
  console.log('New paymentType:', updated[0]?.form_data?.form?.paymentType);
}

fix();
