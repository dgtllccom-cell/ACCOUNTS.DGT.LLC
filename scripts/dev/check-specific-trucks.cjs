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
  const { data: trucks } = await supabase.from('trucks').select('id, truck_number, truck_name, country_id, city_branch_id, status');
  console.log('Found trucks:', trucks ? trucks.length : 0);
  if (trucks) {
    trucks.forEach(t => console.log(t.id, t.truck_number, t.truck_name));
  }
}
run();
