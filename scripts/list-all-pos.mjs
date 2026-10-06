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
    .from('purchase_orders')
    .select('id, purchase_order_no, payment_status, advance_paid, remaining_due, form_data, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(data.map(d => ({
    id: d.id,
    no: d.purchase_order_no,
    status: d.payment_status,
    advPaid: d.advance_paid,
    formPaymentType: d.form_data?.form?.paymentType,
    formPaymentCondition: d.form_data?.form?.paymentCondition,
    advPct: d.form_data?.form?.advancePercent,
    formKeys: Object.keys(d.form_data?.form || {}),
    workflow: d.form_data?.workflow,
    createdAt: d.created_at
  })), null, 2));
}
run();
