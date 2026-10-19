const fs = require('fs');
let envText = '';
try { envText = fs.readFileSync('.env.local', 'utf8'); } catch(e) { envText = fs.readFileSync('.env', 'utf8'); }
const env = {};
envText.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
async function run() {
  const { data: trucks } = await supabase.from('trucks').select('id, truck_number, truck_name, country_id, city_branch_id, country_branch_id, status').limit(20);
  console.log('Trucks count:', trucks ? trucks.length : 0);
  if (trucks) console.log(trucks);
  const { data: countries } = await supabase.from('countries').select('id, name');
  console.log('Countries:', countries);
  const { data: cityBranches } = await supabase.from('city_branches').select('id, name, country_id');
  console.log('City branches:', cityBranches);
  const { data: countryBranches } = await supabase.from('country_branches').select('id, name, country_id');
  console.log('Country branches:', countryBranches);
}
run();
