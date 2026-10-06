const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('ledgers').select('id, name, scope, country_id, currency, city_branch_id').ilike('name', '%Dubai Purchase Account%');
  console.log("Dubai Purchase Account:", data);

  const { data: data2 } = await supabase.from('ledgers').select('id, name, scope, country_id, currency, city_branch_id').ilike('name', '%Damaan Sales Account%');
  console.log("Damaan Sales Account:", data2);
}

check();
