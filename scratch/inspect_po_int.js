const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('purchase_order_no', 'PO-INT-0002');
  console.log('PO Detail:', JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}

check();
