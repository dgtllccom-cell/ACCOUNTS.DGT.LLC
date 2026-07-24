const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('purchase_order_no', 'PK-001-0001')
    .is('deleted_at', null)
    .maybeSingle();

  if (poErr) {
    console.error('PO Error:', poErr);
    return;
  }
  if (!po) {
    console.log('PO PK-001-0001 not found.');
    return;
  }

  console.log('PO Details:');
  console.log('ID:', po.id);
  console.log('PO No:', po.purchase_order_no);
  console.log('Currency Code:', po.currency_code);
  console.log('Exchange Rate:', po.exchange_rate);
  console.log('Order Total:', po.order_total);
  console.log('Advance Paid:', po.advance_paid);
  console.log('Remaining Paid:', po.remaining_paid);
  console.log('Credit Amount:', po.credit_amount);
  console.log('Remaining Due:', po.remaining_due);
  console.log('Form Data (Form):', JSON.stringify(po.form_data?.form, null, 2));

  // Also query payments for this PO
  const { data: payments, error: pmErr } = await supabase
    .from('purchase_order_payments')
    .select('*')
    .eq('purchase_order_id', po.id)
    .is('deleted_at', null);

  if (pmErr) {
    console.error('Payments Error:', pmErr);
    return;
  }
  console.log('\nPayments List:');
  console.log(JSON.stringify(payments, null, 2));
}

check();
