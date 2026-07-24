const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Simple script to test DB connection and select from purchase_orders
require('dotenv').config({ path: '../../.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('purchase_orders').select('id, purchase_order_no').limit(10);
  console.log('Purchase Orders:', data?.length, 'Error:', error);
}

run();
