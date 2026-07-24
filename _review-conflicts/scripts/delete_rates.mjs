import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteRates() {
  console.log("Deleting all daily_usd_rates...");
  const { error } = await supabase.from('daily_usd_rates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.error("Error deleting rates:", error);
  } else {
    console.log("Successfully deleted all daily_usd_rates.");
  }
}

deleteRates();
