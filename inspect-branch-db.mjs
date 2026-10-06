import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching City Branches...");
  const { data: cityBranches, error: cityErr } = await supabase.from('city_branches').select('*').ilike('name', '%Skandar%');
  if (cityErr) console.error("City error:", cityErr);
  console.log("City Branches matching Skandar:", cityBranches);

  console.log("Fetching Country Branches...");
  const { data: countryBranches, error: countryErr } = await supabase.from('country_branches').select('*').ilike('name', '%Skandar%');
  if (countryErr) console.error("Country error:", countryErr);
  console.log("Country Branches matching Skandar:", countryBranches);
  
  if (cityBranches?.length === 0 && countryBranches?.length === 0) {
      console.log("Fetching all branches to find Skandar or similar...");
      const { data: allCity } = await supabase.from('city_branches').select('id, name, code, country_branch_id');
      console.log("All City Branches:", allCity);
      const { data: allCountry } = await supabase.from('country_branches').select('id, name, code');
      console.log("All Country Branches:", allCountry);
  }
}

main().catch(console.error);
