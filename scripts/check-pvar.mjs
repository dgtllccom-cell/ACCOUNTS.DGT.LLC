import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, purchase_order_no, payment_status, advance_paid, remaining_due, form_data')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Query error:', error);
    return;
  }
  console.log('Orders:', data?.map(d => ({
    no: d.purchase_order_no,
    status: d.payment_status,
    advPaid: d.advance_paid,
    formPaymentType: d.form_data?.form?.paymentType,
    formPaymentCondition: d.form_data?.form?.paymentCondition,
    advPct: d.form_data?.form?.advancePercent,
  })));
}
run();
