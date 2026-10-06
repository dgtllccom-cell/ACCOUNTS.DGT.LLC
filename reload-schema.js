require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Reloading schema cache...");
  const { data, error } = await supabase.rpc('pg_notify', { payload: 'reload schema', channel: 'pgrst' });
  console.log("Response:", data, error);
}

run();
