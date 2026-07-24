const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, purchase_order_no, form_data')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Loaded ${data.length} purchase orders.`);
  for (const po of data) {
    console.log(`\nPO: ${po.purchase_order_no}`);
    const fd = po.form_data || {};
    const form = fd.form || {};
    console.log('Keys in form_data:', Object.keys(fd));
    console.log('Keys in form:', Object.keys(form));
    
    // Check if there is anything containing "sales", "agent", "user", "person", "man"
    const searchKeys = [...Object.keys(fd), ...Object.keys(form)];
    const matchingKeys = searchKeys.filter(k => /sales|agent|user|person|man|buyer|staff/i.test(k));
    if (matchingKeys.length > 0) {
      console.log('Matching keys:', matchingKeys);
      matchingKeys.forEach(k => {
        console.log(`  ${k} =`, fd[k] !== undefined ? fd[k] : form[k]);
      });
    }
  }
}

check();
