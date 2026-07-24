const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, purchase_order_no, form_data')
    .limit(30);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Loaded ${data.length} purchase orders.`);
  for (const po of data) {
    const fd = po.form_data || {};
    const form = fd.form || {};
    
    // Check if there is anything containing "sales", "agent", "user", "person", "man", "ref", "name"
    const searchKeys = [...Object.keys(fd), ...Object.keys(form)];
    const matchingKeys = searchKeys.filter(k => /sales|agent|user|person|man|buyer|staff|ref|name|username/i.test(k));
    if (matchingKeys.length > 0) {
      console.log(`\nPO: ${po.purchase_order_no}`);
      console.log('Matching keys:', matchingKeys);
      matchingKeys.forEach(k => {
        const val = fd[k] !== undefined ? fd[k] : form[k];
        if (typeof val !== 'object') {
          console.log(`  ${k} =`, val);
        } else {
          console.log(`  ${k} =`, JSON.stringify(val));
        }
      });
    }
  }
}

check();
